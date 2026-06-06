import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MessageType } from '@shared/enums';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { MessagingService } from './messaging.service';

const conversationId = '11111111-1111-4111-8111-111111111111';
const conversationId2 = '22222222-2222-4222-8222-222222222222';
const participantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const participantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const stranger = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const participantC = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const listingId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

interface ConvQbStub {
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getOne: jest.Mock<Promise<Conversation | null>, []>;
  getMany: jest.Mock<Promise<Conversation[]>, []>;
}

const buildConvQb = (existing: Conversation | null = null, many: Conversation[] = []): ConvQbStub => {
  const qb: Partial<ConvQbStub> = {};
  qb.where = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.orderBy = jest.fn().mockReturnValue(qb);
  qb.addOrderBy = jest.fn().mockReturnValue(qb);
  qb.skip = jest.fn().mockReturnValue(qb);
  qb.take = jest.fn().mockReturnValue(qb);
  qb.getOne = jest.fn().mockResolvedValue(existing);
  qb.getMany = jest.fn().mockResolvedValue(many);
  return qb as ConvQbStub;
};

interface MsgQbStub {
  distinctOn: jest.Mock;
  select: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  addOrderBy: jest.Mock;
  groupBy: jest.Mock;
  take: jest.Mock;
  getMany: jest.Mock<Promise<Message[]>, []>;
  getRawMany: jest.Mock<Promise<unknown[]>, []>;
}

const buildMsgQb = (
  many: Message[] = [],
  raw: unknown[] = [],
): MsgQbStub => {
  const qb: Partial<MsgQbStub> = {};
  qb.distinctOn = jest.fn().mockReturnValue(qb);
  qb.select = jest.fn().mockReturnValue(qb);
  qb.addSelect = jest.fn().mockReturnValue(qb);
  qb.where = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.orderBy = jest.fn().mockReturnValue(qb);
  qb.addOrderBy = jest.fn().mockReturnValue(qb);
  qb.groupBy = jest.fn().mockReturnValue(qb);
  qb.take = jest.fn().mockReturnValue(qb);
  qb.getMany = jest.fn().mockResolvedValue(many);
  qb.getRawMany = jest.fn().mockResolvedValue(raw);
  return qb as MsgQbStub;
};

describe('MessagingService', () => {
  let service: MessagingService;
  let convRepo: jest.Mocked<
    Pick<Repository<Conversation>, 'findOne' | 'createQueryBuilder' | 'create' | 'save'>
  >;
  let msgRepo: jest.Mocked<Pick<Repository<Message>, 'createQueryBuilder'>>;
  let txManager: { save: jest.Mock; update: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    convRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    msgRepo = { createQueryBuilder: jest.fn() };
    txManager = {
      save: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    dataSource = {
      transaction: jest.fn(async (cb: (m: typeof txManager) => unknown) =>
        cb(txManager),
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: getRepositoryToken(Conversation), useValue: convRepo },
        { provide: getRepositoryToken(Message), useValue: msgRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = moduleRef.get(MessagingService);
  });

  describe('assertIsParticipant', () => {
    it('throws NotFoundException when conversation does not exist', async () => {
      convRepo.findOne.mockResolvedValue(null);
      await expect(
        service.assertIsParticipant(conversationId, participantA),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when userId is not in participant_ids', async () => {
      convRepo.findOne.mockResolvedValue({
        id: conversationId,
        participantIds: [participantA, participantB],
      } as Conversation);
      await expect(
        service.assertIsParticipant(conversationId, stranger),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('resolves when userId is in participant_ids', async () => {
      convRepo.findOne.mockResolvedValue({
        id: conversationId,
        participantIds: [participantA, participantB],
      } as Conversation);
      await expect(
        service.assertIsParticipant(conversationId, participantA),
      ).resolves.toMatchObject({ id: conversationId });
    });
  });

  describe('findOrCreateConversation', () => {
    it('throws BadRequestException when participantIds does not contain exactly two users', async () => {
      await expect(
        service.findOrCreateConversation(participantA, {
          participantIds: [participantA, participantB, participantC],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(convRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when current user is not in participantIds', async () => {
      await expect(
        service.findOrCreateConversation(stranger, {
          participantIds: [participantA, participantB],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(convRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('returns existing conversation (created=false) when match found', async () => {
      const existing = {
        id: conversationId,
        participantIds: [participantA, participantB],
        listingId,
      } as Conversation;
      const qb = buildConvQb(existing);
      convRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as ReturnType<typeof convRepo.createQueryBuilder>,
      );

      const result = await service.findOrCreateConversation(participantA, {
        participantIds: [participantA, participantB],
        listingId,
      });

      expect(result).toEqual({ created: false, conversation: existing });
      expect(convRepo.save).not.toHaveBeenCalled();
    });

    it('creates new conversation (created=true) when no match', async () => {
      const qb = buildConvQb(null);
      convRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as ReturnType<typeof convRepo.createQueryBuilder>,
      );
      const draft = { participantIds: [participantA, participantB] } as Conversation;
      const saved = {
        id: conversationId,
        participantIds: [participantA, participantB],
        listingId: null,
        orderId: null,
      } as Conversation;
      convRepo.create.mockReturnValue(draft);
      convRepo.save.mockResolvedValue(saved);

      const result = await service.findOrCreateConversation(participantA, {
        participantIds: [participantB, participantA],
      });

      expect(result).toEqual({ created: true, conversation: saved });
      expect(convRepo.create).toHaveBeenCalledWith({
        participantIds: [participantA, participantB].sort(),
        listingId: null,
        orderId: null,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('c.listing_id IS NULL');
    });

    it('matches existing conversation regardless of participantIds order', async () => {
      const qb = buildConvQb(null);
      convRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as ReturnType<typeof convRepo.createQueryBuilder>,
      );
      convRepo.create.mockReturnValue({} as Conversation);
      convRepo.save.mockResolvedValue({} as Conversation);

      await service.findOrCreateConversation(participantA, {
        participantIds: [participantB, participantA],
      });

      expect(qb.where).toHaveBeenCalledWith('c.participant_ids = :ids', {
        ids: [participantA, participantB].sort(),
      });
    });

    it('filters by listing_id when provided', async () => {
      const qb = buildConvQb(null);
      convRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as ReturnType<typeof convRepo.createQueryBuilder>,
      );
      convRepo.create.mockReturnValue({} as Conversation);
      convRepo.save.mockResolvedValue({} as Conversation);

      await service.findOrCreateConversation(participantA, {
        participantIds: [participantA, participantB],
        listingId,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('c.listing_id = :listingId', {
        listingId,
      });
    });
  });

  describe('listMessages', () => {
    const setup = (rows: Message[]) => {
      convRepo.findOne.mockResolvedValue({
        id: conversationId,
        participantIds: [participantA, participantB],
      } as Conversation);
      const qb = buildMsgQb(rows);
      msgRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as ReturnType<typeof msgRepo.createQueryBuilder>,
      );
      return qb;
    };

    it('throws ForbiddenException when caller is not a participant', async () => {
      convRepo.findOne.mockResolvedValue({
        id: conversationId,
        participantIds: [participantA, participantB],
      } as Conversation);
      await expect(
        service.listMessages(conversationId, stranger, { limit: 50 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFoundException when conversation does not exist', async () => {
      convRepo.findOne.mockResolvedValue(null);
      await expect(
        service.listMessages(conversationId, participantA, { limit: 50 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('queries by conversation_id and orders by created_at DESC then reverses to ASC', async () => {
      const newest = {
        id: 'm3',
        conversationId,
        createdAt: new Date('2026-05-01T03:00:00Z'),
      } as Message;
      const middle = {
        id: 'm2',
        conversationId,
        createdAt: new Date('2026-05-01T02:00:00Z'),
      } as Message;
      const oldest = {
        id: 'm1',
        conversationId,
        createdAt: new Date('2026-05-01T01:00:00Z'),
      } as Message;
      const qb = setup([newest, middle, oldest]);

      const result = await service.listMessages(conversationId, participantA, { limit: 50 });

      expect(qb.where).toHaveBeenCalledWith('m.conversation_id = :cid', { cid: conversationId });
      expect(qb.orderBy).toHaveBeenCalledWith('m.created_at', 'DESC');
      expect(qb.take).toHaveBeenCalledWith(50);
      expect(result.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    });

    it('applies "before" cursor with subquery on created_at', async () => {
      const qb = setup([]);
      const before = '99999999-9999-4999-8999-999999999999';

      await service.listMessages(conversationId, participantA, { before, limit: 50 });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'm.created_at < (SELECT m2.created_at FROM messages m2 WHERE m2.id = :before)',
        { before },
      );
    });

    it('does not apply "before" filter when undefined', async () => {
      const qb = setup([]);

      await service.listMessages(conversationId, participantA, { limit: 50 });

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('respects custom limit', async () => {
      const qb = setup([]);

      await service.listMessages(conversationId, participantA, { limit: 200 });

      expect(qb.take).toHaveBeenCalledWith(200);
    });
  });

  describe('listConversationsForUser', () => {
    it('returns empty array when user has no conversations', async () => {
      const convQb = buildConvQb(null, []);
      convRepo.createQueryBuilder.mockReturnValue(
        convQb as unknown as ReturnType<typeof convRepo.createQueryBuilder>,
      );

      const result = await service.listConversationsForUser(participantA, 1, 20);

      expect(result).toEqual([]);
      expect(msgRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('filters conversations by participant_ids using ANY()', async () => {
      const convQb = buildConvQb(null, []);
      convRepo.createQueryBuilder.mockReturnValue(
        convQb as unknown as ReturnType<typeof convRepo.createQueryBuilder>,
      );

      await service.listConversationsForUser(participantA, 1, 20);

      expect(convQb.where).toHaveBeenCalledWith(
        ':uid = ANY(c.participant_ids)',
        { uid: participantA },
      );
    });

    it('orders by last_message_at DESC NULLS LAST then created_at DESC', async () => {
      const convQb = buildConvQb(null, []);
      convRepo.createQueryBuilder.mockReturnValue(
        convQb as unknown as ReturnType<typeof convRepo.createQueryBuilder>,
      );

      await service.listConversationsForUser(participantA, 1, 20);

      expect(convQb.orderBy).toHaveBeenCalledWith(
        'c.last_message_at',
        'DESC',
        'NULLS LAST',
      );
      expect(convQb.addOrderBy).toHaveBeenCalledWith('c.created_at', 'DESC');
    });

    it('paginates with skip/take', async () => {
      const convQb = buildConvQb(null, []);
      convRepo.createQueryBuilder.mockReturnValue(
        convQb as unknown as ReturnType<typeof convRepo.createQueryBuilder>,
      );

      await service.listConversationsForUser(participantA, 3, 10);

      expect(convQb.skip).toHaveBeenCalledWith(20);
      expect(convQb.take).toHaveBeenCalledWith(10);
    });

    it('attaches lastMessage and unreadCount per conversation', async () => {
      const convs: Conversation[] = [
        {
          id: conversationId,
          participantIds: [participantA, participantB],
          listingId: null,
          orderId: null,
          lastMessageAt: new Date('2026-05-01T12:00:00Z'),
        } as Conversation,
        {
          id: conversationId2,
          participantIds: [participantA, participantB],
          listingId: null,
          orderId: null,
          lastMessageAt: null,
        } as Conversation,
      ];
      const convQb = buildConvQb(null, convs);
      convRepo.createQueryBuilder.mockReturnValue(
        convQb as unknown as ReturnType<typeof convRepo.createQueryBuilder>,
      );

      const lastMsgs: Message[] = [
        {
          id: 'm1',
          conversationId,
          senderId: participantB,
          content: 'hi',
          type: MessageType.TEXT,
          createdAt: new Date('2026-05-01T12:00:00Z'),
        } as Message,
      ];
      const unreadRows = [{ conversation_id: conversationId, count: '3' }];

      msgRepo.createQueryBuilder
        .mockReturnValueOnce(
          buildMsgQb(lastMsgs) as unknown as ReturnType<typeof msgRepo.createQueryBuilder>,
        )
        .mockReturnValueOnce(
          buildMsgQb([], unreadRows) as unknown as ReturnType<typeof msgRepo.createQueryBuilder>,
        );

      const result = await service.listConversationsForUser(participantA, 1, 20);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: conversationId,
        unreadCount: 3,
        lastMessage: {
          content: 'hi',
          type: MessageType.TEXT,
          senderId: participantB,
        },
      });
      expect(result[1]).toMatchObject({
        id: conversationId2,
        unreadCount: 0,
        lastMessage: null,
      });
    });

    it('unread count query excludes own messages', async () => {
      const convs: Conversation[] = [
        {
          id: conversationId,
          participantIds: [participantA, participantB],
          listingId: null,
          orderId: null,
          lastMessageAt: null,
        } as Conversation,
      ];
      const convQb = buildConvQb(null, convs);
      convRepo.createQueryBuilder.mockReturnValue(
        convQb as unknown as ReturnType<typeof convRepo.createQueryBuilder>,
      );
      const lastQb = buildMsgQb([]);
      const unreadQb = buildMsgQb([], []);
      msgRepo.createQueryBuilder
        .mockReturnValueOnce(lastQb as unknown as ReturnType<typeof msgRepo.createQueryBuilder>)
        .mockReturnValueOnce(unreadQb as unknown as ReturnType<typeof msgRepo.createQueryBuilder>);

      await service.listConversationsForUser(participantA, 1, 20);

      expect(unreadQb.andWhere).toHaveBeenCalledWith(
        'm.sender_id != :userId',
        { userId: participantA },
      );
      expect(unreadQb.andWhere).toHaveBeenCalledWith('m.read_at IS NULL');
    });
  });

  describe('markMessagesRead', () => {
    const buildParticipantConv = (): Conversation =>
      ({
        id: conversationId,
        participantIds: [participantA, participantB],
      }) as Conversation;

    interface UpdateQbStub {
      update: jest.Mock;
      set: jest.Mock;
      where: jest.Mock;
      andWhere: jest.Mock;
      returning: jest.Mock;
      execute: jest.Mock<Promise<{ raw: unknown[] }>, []>;
    }

    const buildUpdateQb = (raw: unknown[]): UpdateQbStub => {
      const qb: Partial<UpdateQbStub> = {};
      qb.update = jest.fn().mockReturnValue(qb);
      qb.set = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.returning = jest.fn().mockReturnValue(qb);
      qb.execute = jest.fn().mockResolvedValue({ raw });
      return qb as UpdateQbStub;
    };

    const messageIds = [
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
    ];

    it('throws ForbiddenException when caller is not a participant (no UPDATE)', async () => {
      convRepo.findOne.mockResolvedValue(buildParticipantConv());

      await expect(
        service.markMessagesRead(conversationId, stranger, messageIds),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(msgRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when conversation does not exist', async () => {
      convRepo.findOne.mockResolvedValue(null);

      await expect(
        service.markMessagesRead(conversationId, participantA, messageIds),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(msgRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when markRead is used on a group conversation', async () => {
      convRepo.findOne.mockResolvedValue({
        id: conversationId,
        participantIds: [participantA, participantB, participantC],
      } as Conversation);

      await expect(
        service.markMessagesRead(conversationId, participantA, messageIds),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(msgRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('issues a single guarded UPDATE and returns updated ids + readAt', async () => {
      convRepo.findOne.mockResolvedValue(buildParticipantConv());
      const qb = buildUpdateQb([{ id: messageIds[0] }, { id: messageIds[1] }]);
      msgRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as ReturnType<typeof msgRepo.createQueryBuilder>,
      );

      const result = await service.markMessagesRead(
        conversationId,
        participantA,
        messageIds,
      );

      expect(qb.update).toHaveBeenCalledWith(Message);
      expect(qb.set).toHaveBeenCalledWith({ readAt: expect.any(Date) });
      expect(qb.where).toHaveBeenCalledWith('id = ANY(:ids)', { ids: messageIds });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'conversation_id = :conversationId',
        { conversationId },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('sender_id != :readerId', {
        readerId: participantA,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('read_at IS NULL');
      expect(qb.returning).toHaveBeenCalledWith(['id']);
      expect(result.updated).toEqual(messageIds);
      const setArg = qb.set.mock.calls[0][0] as { readAt: Date };
      expect(result.readAt).toBe(setArg.readAt);
    });

    it('returns { updated: [], readAt: null } when UPDATE affects 0 rows (idempotent)', async () => {
      convRepo.findOne.mockResolvedValue(buildParticipantConv());
      const qb = buildUpdateQb([]);
      msgRepo.createQueryBuilder.mockReturnValue(
        qb as unknown as ReturnType<typeof msgRepo.createQueryBuilder>,
      );

      const result = await service.markMessagesRead(
        conversationId,
        participantA,
        messageIds,
      );

      expect(result).toEqual({ updated: [], readAt: null });
    });
  });

  describe('sendMessage', () => {
    const buildParticipantConv = (): Conversation =>
      ({
        id: conversationId,
        participantIds: [participantA, participantB],
      }) as Conversation;

    it('throws NotFoundException when conversation does not exist (no DB write)', async () => {
      convRepo.findOne.mockResolvedValue(null);

      await expect(
        service.sendMessage(conversationId, participantA, 'hi', MessageType.TEXT),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(txManager.save).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when sender is not a participant (no DB write)', async () => {
      convRepo.findOne.mockResolvedValue(buildParticipantConv());

      await expect(
        service.sendMessage(conversationId, stranger, 'hi', MessageType.TEXT),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(txManager.save).not.toHaveBeenCalled();
    });

    it('persists message and updates last_message_at inside a transaction', async () => {
      convRepo.findOne.mockResolvedValue(buildParticipantConv());
      const createdAt = new Date('2026-05-03T12:00:00Z');
      const saved = {
        id: 'msg-1',
        conversationId,
        senderId: participantA,
        content: 'hi',
        type: MessageType.TEXT,
        createdAt,
        readAt: null,
      } as Message;
      txManager.save.mockResolvedValue(saved);

      const result = await service.sendMessage(
        conversationId,
        participantA,
        'hi',
        MessageType.TEXT,
      );

      expect(result).toBe(saved);
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(txManager.save).toHaveBeenCalledWith(Message, {
        conversationId,
        senderId: participantA,
        content: 'hi',
        type: MessageType.TEXT,
      });
      expect(txManager.update).toHaveBeenCalledWith(Conversation, conversationId, {
        lastMessageAt: createdAt,
      });
    });
  });
});
