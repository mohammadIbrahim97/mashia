import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { MessageType } from '@shared/enums';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationListItemResponse } from './dto/conversation-list-item.response';

export interface FindOrCreateResult {
  created: boolean;
  conversation: Conversation;
}

interface UnreadCountRow {
  conversation_id: string;
  count: string;
}

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messagesRepository: Repository<Message>,
    private readonly dataSource: DataSource,
  ) {}

  async assertIsParticipant(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    await this.findParticipantConversation(conversationId, userId);
  }

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: MessageType,
  ): Promise<Message> {
    await this.assertIsParticipant(conversationId, senderId);

    return this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(Message, {
        conversationId,
        senderId,
        content,
        type,
      });
      await manager.update(Conversation, conversationId, {
        lastMessageAt: saved.createdAt,
      });
      return saved;
    });
  }

  async markMessagesRead(
    conversationId: string,
    readerId: string,
    messageIds: string[],
  ): Promise<{ updated: string[]; readAt: Date | null }> {
    const conversation = await this.findParticipantConversation(
      conversationId,
      readerId,
    );
    if (!this.hasExactlyTwoUniqueParticipants(conversation.participantIds)) {
      throw new BadRequestException(
        'Read receipts require a two-party conversation',
      );
    }

    const readAt = new Date();
    const result = await this.messagesRepository
      .createQueryBuilder()
      .update(Message)
      .set({ readAt })
      .where('id = ANY(:ids)', { ids: messageIds })
      .andWhere('conversation_id = :conversationId', { conversationId })
      .andWhere('sender_id != :readerId', { readerId })
      .andWhere('read_at IS NULL')
      .returning(['id'])
      .execute();

    const rows = (result.raw ?? []) as Array<{ id: string }>;
    if (rows.length === 0) {
      return { updated: [], readAt: null };
    }
    return {
      updated: rows.map((r) => r.id),
      readAt,
    };
  }

  async findOrCreateConversation(
    currentUserId: string,
    dto: CreateConversationDto,
  ): Promise<FindOrCreateResult> {
    if (!this.hasExactlyTwoUniqueParticipants(dto.participantIds)) {
      throw new BadRequestException(
        'Conversations must have exactly two unique participants',
      );
    }
    if (!dto.participantIds.includes(currentUserId)) {
      throw new BadRequestException(
        'Current user must be one of the participants',
      );
    }

    const sortedIds = [...dto.participantIds].sort();
    const listingId = dto.listingId ?? null;
    const orderId = dto.orderId ?? null;

    const existing = await this.findConversationByIdentity(
      sortedIds,
      listingId,
      orderId,
    );
    if (existing) {
      return { created: false, conversation: existing };
    }

    const entity = this.conversationsRepository.create({
      participantIds: sortedIds,
      listingId,
      orderId,
    });
    try {
      const saved = await this.conversationsRepository.save(entity);
      return { created: true, conversation: saved };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const conversation = await this.findConversationByIdentity(
          sortedIds,
          listingId,
          orderId,
        );
        if (conversation) {
          return { created: false, conversation };
        }
      }
      throw error;
    }
  }

  async listMessages(
    conversationId: string,
    userId: string,
    options: { before?: string; limit: number },
  ): Promise<Message[]> {
    await this.assertIsParticipant(conversationId, userId);

    const qb = this.messagesRepository
      .createQueryBuilder('m')
      .where('m.conversation_id = :cid', { cid: conversationId });

    if (options.before) {
      qb.andWhere(
        'm.created_at < (SELECT m2.created_at FROM messages m2 WHERE m2.id = :before)',
        { before: options.before },
      );
    }

    const rows = await qb
      .orderBy('m.created_at', 'DESC')
      .take(options.limit)
      .getMany();

    return rows.reverse();
  }

  async listConversationsForUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<ConversationListItemResponse[]> {
    const conversations = await this.conversationsRepository
      .createQueryBuilder('c')
      .where(':uid = ANY(c.participant_ids)', { uid: userId })
      .orderBy('c.last_message_at', 'DESC', 'NULLS LAST')
      .addOrderBy('c.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    if (conversations.length === 0) return [];

    const ids = conversations.map((c) => c.id);
    const [lastMessages, unreadCounts] = await Promise.all([
      this.fetchLastMessages(ids),
      this.fetchUnreadCounts(ids, userId),
    ]);

    return conversations.map((c) => ({
      id: c.id,
      participantIds: c.participantIds,
      listingId: c.listingId,
      orderId: c.orderId,
      lastMessageAt: c.lastMessageAt,
      lastMessage: lastMessages.get(c.id) ?? null,
      unreadCount: unreadCounts.get(c.id) ?? 0,
    }));
  }

  private async findConversationByIdentity(
    sortedIds: string[],
    listingId: string | null,
    orderId: string | null,
  ): Promise<Conversation | null> {
    const qb = this.conversationsRepository
      .createQueryBuilder('c')
      .where('c.participant_ids = :ids', { ids: sortedIds });
    if (listingId === null) {
      qb.andWhere('c.listing_id IS NULL');
    } else {
      qb.andWhere('c.listing_id = :listingId', { listingId });
    }
    if (orderId === null) {
      qb.andWhere('c.order_id IS NULL');
    } else {
      qb.andWhere('c.order_id = :orderId', { orderId });
    }

    return qb.getOne();
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505'
    );
  }

  private hasExactlyTwoUniqueParticipants(
    participantIds: unknown,
  ): participantIds is string[] {
    return (
      Array.isArray(participantIds) &&
      participantIds.length === 2 &&
      new Set(participantIds).size === 2
    );
  }

  private async findParticipantConversation(
    conversationId: string,
    userId: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (!conversation.participantIds.includes(userId)) {
      throw new ForbiddenException('Not a conversation participant');
    }
    return conversation;
  }

  private async fetchLastMessages(conversationIds: string[]) {
    const rows = await this.messagesRepository
      .createQueryBuilder('m')
      .distinctOn(['m.conversation_id'])
      .where({ conversationId: In(conversationIds) })
      .orderBy('m.conversation_id')
      .addOrderBy('m.created_at', 'DESC')
      .getMany();

    const map = new Map<
      string,
      { content: string; type: Message['type']; senderId: string; createdAt: Date }
    >();
    for (const m of rows) {
      map.set(m.conversationId, {
        content: m.content,
        type: m.type,
        senderId: m.senderId,
        createdAt: m.createdAt,
      });
    }
    return map;
  }

  private async fetchUnreadCounts(
    conversationIds: string[],
    userId: string,
  ): Promise<Map<string, number>> {
    const rows: UnreadCountRow[] = await this.messagesRepository
      .createQueryBuilder('m')
      .select('m.conversation_id', 'conversation_id')
      .addSelect('COUNT(*)', 'count')
      .where({ conversationId: In(conversationIds) })
      .andWhere('m.read_at IS NULL')
      .andWhere('m.sender_id != :userId', { userId })
      .groupBy('m.conversation_id')
      .getRawMany();

    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.conversation_id, parseInt(r.count, 10));
    }
    return map;
  }
}
