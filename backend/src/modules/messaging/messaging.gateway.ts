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
import { isUUID } from 'class-validator';
import { Socket } from 'socket.io';
import { MessageType } from '@shared/enums';
import { Message } from './message.entity';
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

export interface AuthSocket extends Socket {
  data: { userId?: string };
}

const MAX_MESSAGE_CONTENT_LENGTH = 4000;

@WebSocketGateway({ namespace: '/chat', cors: true })
export class MessagingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MessagingGateway.name);

  constructor(
    private readonly messagingService: MessagingService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: AuthSocket): void {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
      client.data.userId = payload.sub;
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

    const userId = client.data.userId;
    if (!userId) {
      return { ok: false, error: 'unauthorized' };
    }

    try {
      await this.messagingService.assertIsParticipant(conversationId, userId);
    } catch (err) {
      if (err instanceof NotFoundException) {
        return { ok: false, error: 'not_found' };
      }
      if (err instanceof ForbiddenException) {
        return { ok: false, error: 'forbidden' };
      }
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
    const parsed = this.parseSendMessagePayload(payload);
    if (!parsed) {
      return { ok: false, error: 'invalid_payload' };
    }

    const userId = client.data.userId;
    if (!userId) {
      return { ok: false, error: 'unauthorized' };
    }

    let saved: Message;
    try {
      saved = await this.messagingService.sendMessage(
        parsed.conversationId,
        userId,
        parsed.content,
        parsed.type,
      );
    } catch (err) {
      if (err instanceof NotFoundException) {
        return { ok: false, error: 'not_found' };
      }
      if (err instanceof ForbiddenException) {
        return { ok: false, error: 'forbidden' };
      }
      throw err;
    }

    client
      .to(`conversation:${parsed.conversationId}`)
      .emit('newMessage', saved);
    return { ok: true, message: saved };
  }

  private parseSendMessagePayload(
    payload: unknown,
  ): { conversationId: string; content: string; type: MessageType } | null {
    const p = payload as
      | { conversationId?: unknown; content?: unknown; type?: unknown }
      | null;
    const conversationId = p?.conversationId;
    const content = p?.content;
    const type = p?.type;

    if (typeof conversationId !== 'string' || !isUUID(conversationId, '4')) {
      return null;
    }
    if (
      typeof content !== 'string' ||
      content.length === 0 ||
      content.length > MAX_MESSAGE_CONTENT_LENGTH
    ) {
      return null;
    }
    if (
      typeof type !== 'string' ||
      !Object.values(MessageType).includes(type as MessageType)
    ) {
      return null;
    }
    return { conversationId, content, type: type as MessageType };
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
