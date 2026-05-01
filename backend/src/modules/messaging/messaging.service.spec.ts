import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageType } from '@shared/enums';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { MessagingService } from './messaging.service';

const conversationId = '11111111-1111-4111-8111-111111111111';
const conversationId2 = '22222222-2222-4222-8222-222222222222';
const participantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const participantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const stranger = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const listingId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

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

  beforeEach(async () => {
    convRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    msgRepo = { createQueryBuilder: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: getRepositoryToken(Conversation), useValue: convRepo },
        { provide: getRepositoryToken(Message), useValue: msgRepo },
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
      ).resolves.toBeUndefined();
    });
  });

  describe('findOrCreateConversation', () => {
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
});
