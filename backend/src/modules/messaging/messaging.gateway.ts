import {
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

export interface AuthSocket extends Socket {
  data: { userId?: string };
}

@WebSocketGateway({ namespace: '/chat', cors: true })
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
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
    const data = payload as { conversationId?: unknown; isTyping?: unknown } | null;
    const conversationId = data?.conversationId;
    const isTyping = data?.isTyping;
    if (
      typeof conversationId !== 'string' ||
      !isUUID(conversationId, '4') ||
      typeof isTyping !== 'boolean'
    ) {
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

    client
      .to(`conversation:${conversationId}`)
      .emit('userTyping', { conversationId, userId, isTyping });
    return { ok: true };
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

  private mapServiceError(
    err: unknown,
  ): 'not_found' | 'forbidden' | null {
    if (err instanceof NotFoundException) return 'not_found';
    if (err instanceof ForbiddenException) return 'forbidden';
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
