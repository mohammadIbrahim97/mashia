import {
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { plainToInstance } from 'class-transformer';
import { isUUID, validate } from 'class-validator';
import { Socket } from 'socket.io';
import { Message } from './message.entity';
import { MarkReadDto } from './dto/mark-read.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UsersService } from '../users/users.service';
import { MessagingService } from './messaging.service';

export type JoinConversationAckError =
  | 'forbidden'
  | 'not_found'
  | 'invalid_payload'
  | 'unauthorized';

export interface JoinConversationAck {
  ok: boolean;
  error?: JoinConversationAckError;
}

export type SendMessageAckError = JoinConversationAckError;

export interface SendMessageAck {
  ok: boolean;
  error?: SendMessageAckError;
  message?: Message;
}

export type MarkReadAckError = JoinConversationAckError;

export interface MarkReadAck {
  ok: boolean;
  error?: MarkReadAckError;
  updated?: string[];
  readAt?: Date | null;
}

type TypingAck = { ok: boolean; error?: JoinConversationAckError };

interface TypingState {
  isTyping: boolean;
  lastStartedAt: number;
  pendingAck?: Promise<TypingAck>;
}

interface TypingAttempt {
  suppressed: boolean;
  previous?: TypingState;
  pendingAck?: Promise<TypingAck>;
}

export interface AuthSocket extends Socket {
  data: { userId?: string; typingStates?: Map<string, TypingState> };
}

@WebSocketGateway({ namespace: '/chat', cors: true })
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private static readonly TYPING_START_MIN_INTERVAL_MS = 1000;

  private readonly logger = new Logger(MessagingGateway.name);

  constructor(
    private readonly messagingService: MessagingService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: AuthSocket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      const user = await this.usersService.findById(payload.sub);
      if (!user || user.suspended) {
        client.disconnect(true);
        return;
      }
      client.data.userId = user.id;
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthSocket): void {
    this.logger.log(`socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: unknown,
  ): Promise<JoinConversationAck> {
    const conversationId = (payload as { conversationId?: unknown } | null)
      ?.conversationId;
    if (typeof conversationId !== 'string' || !isUUID(conversationId, '4')) {
      return { ok: false, error: 'invalid_payload' };
    }

    const userId = await this.getActiveUserId(client);
    if (!userId) {
      return { ok: false, error: 'unauthorized' };
    }

    try {
      await this.messagingService.assertIsParticipant(conversationId, userId);
    } catch (err) {
      const error = this.mapServiceError(err);
      if (error) return { ok: false, error };
      throw err;
    }

    await client.join(`conversation:${conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: unknown,
  ): Promise<SendMessageAck> {
    const dto =
      plainToInstance(SendMessageDto, payload as object) ??
      new SendMessageDto();
    const errors = await validate(dto);
    if (errors.length > 0) {
      return { ok: false, error: 'invalid_payload' };
    }

    const userId = await this.getActiveUserId(client);
    if (!userId) {
      return { ok: false, error: 'unauthorized' };
    }

    let saved: Message;
    try {
      saved = await this.messagingService.sendMessage(
        dto.conversationId,
        userId,
        dto.content,
        dto.type,
      );
    } catch (err) {
      const error = this.mapServiceError(err);
      if (error) return { ok: false, error };
      throw err;
    }

    client.to(`conversation:${dto.conversationId}`).emit('newMessage', saved);
    return { ok: true, message: saved };
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: unknown,
  ): Promise<{ ok: boolean; error?: JoinConversationAckError }> {
    const data = payload as {
      conversationId?: unknown;
      isTyping?: unknown;
    } | null;
    const conversationId = data?.conversationId;
    const isTyping = data?.isTyping;
    if (
      typeof conversationId !== 'string' ||
      !isUUID(conversationId, '4') ||
      typeof isTyping !== 'boolean'
    ) {
      return { ok: false, error: 'invalid_payload' };
    }

    const room = `conversation:${conversationId}`;
    if (!client.rooms.has(room)) {
      return { ok: false, error: 'forbidden' };
    }

    let resolvePending: (ack: TypingAck) => void = () => undefined;
    let rejectPending: (err: unknown) => void = () => undefined;
    const pendingAck = new Promise<TypingAck>((resolve, reject) => {
      resolvePending = resolve;
      rejectPending = reject;
    });
    pendingAck.catch(() => undefined);

    const attempt = this.recordTypingAttempt(
      client,
      conversationId,
      isTyping,
      pendingAck,
    );
    if (attempt.suppressed) {
      return attempt.pendingAck ? await attempt.pendingAck : { ok: true };
    }

    let userId: string | null;
    try {
      userId = await this.getActiveUserId(client);
    } catch (err) {
      this.restoreTypingState(client, conversationId, attempt.previous);
      rejectPending(err);
      throw err;
    }
    if (!userId) {
      this.restoreTypingState(client, conversationId, attempt.previous);
      const ack: TypingAck = { ok: false, error: 'unauthorized' };
      resolvePending(ack);
      return ack;
    }

    try {
      await this.messagingService.assertIsParticipant(conversationId, userId);
    } catch (err) {
      this.restoreTypingState(client, conversationId, attempt.previous);
      const error = this.mapServiceError(err);
      if (error) {
        const ack: TypingAck = { ok: false, error };
        resolvePending(ack);
        return ack;
      }
      rejectPending(err);
      throw err;
    }

    this.finishTypingAttempt(client, conversationId);
    client.to(room).emit('userTyping', { conversationId, userId, isTyping });
    const ack: TypingAck = { ok: true };
    resolvePending(ack);
    return ack;
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() payload: unknown,
  ): Promise<MarkReadAck> {
    const dto =
      plainToInstance(MarkReadDto, payload as object) ?? new MarkReadDto();
    const errors = await validate(dto);
    if (errors.length > 0) {
      return { ok: false, error: 'invalid_payload' };
    }

    const userId = await this.getActiveUserId(client);
    if (!userId) {
      return { ok: false, error: 'unauthorized' };
    }

    let result: { updated: string[]; readAt: Date | null };
    try {
      result = await this.messagingService.markMessagesRead(
        dto.conversationId,
        userId,
        dto.messageIds,
      );
    } catch (err) {
      const error = this.mapServiceError(err);
      if (error) return { ok: false, error };
      throw err;
    }

    if (result.updated.length > 0) {
      client.to(`conversation:${dto.conversationId}`).emit('messageRead', {
        messageIds: result.updated,
        readerId: userId,
        readAt: result.readAt,
      });
    }
    return { ok: true, updated: result.updated, readAt: result.readAt };
  }

  private recordTypingAttempt(
    client: AuthSocket,
    conversationId: string,
    isTyping: boolean,
    pendingAck: Promise<TypingAck>,
  ): TypingAttempt {
    const typingStates =
      client.data.typingStates ?? new Map<string, TypingState>();
    client.data.typingStates = typingStates;

    const previous = typingStates.get(conversationId);
    if (previous?.isTyping === isTyping) {
      return { suppressed: true, pendingAck: previous.pendingAck };
    }
    if (
      isTyping &&
      previous &&
      Date.now() - previous.lastStartedAt <
        MessagingGateway.TYPING_START_MIN_INTERVAL_MS
    ) {
      return { suppressed: true, pendingAck: previous.pendingAck };
    }

    typingStates.set(conversationId, {
      isTyping,
      lastStartedAt: isTyping ? Date.now() : previous?.lastStartedAt ?? 0,
      pendingAck,
    });
    return { suppressed: false, previous };
  }

  private finishTypingAttempt(
    client: AuthSocket,
    conversationId: string,
  ): void {
    const state = client.data.typingStates?.get(conversationId);
    if (state) {
      state.pendingAck = undefined;
    }
  }

  private restoreTypingState(
    client: AuthSocket,
    conversationId: string,
    previous?: TypingState,
  ): void {
    const typingStates = client.data.typingStates;
    if (!typingStates) return;
    if (previous) {
      typingStates.set(conversationId, previous);
    } else {
      typingStates.delete(conversationId);
    }
  }

  private mapServiceError(
    err: unknown,
  ): 'not_found' | 'forbidden' | 'invalid_payload' | null {
    if (err instanceof NotFoundException) return 'not_found';
    if (err instanceof ForbiddenException) return 'forbidden';
    if (err instanceof BadRequestException) return 'invalid_payload';
    return null;
  }

  private async getActiveUserId(client: AuthSocket): Promise<string | null> {
    const userId = client.data.userId;
    if (!userId) {
      return null;
    }

    const user = await this.usersService.findById(userId);
    if (!user || user.suspended) {
      client.data.userId = undefined;
      client.disconnect(true);
      return null;
    }

    return user.id;
  }

  private extractToken(client: AuthSocket): string | null {
    const authToken = (client.handshake.auth?.token as string | undefined) ?? null;
    if (authToken) return authToken;
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return null;
  }
}
