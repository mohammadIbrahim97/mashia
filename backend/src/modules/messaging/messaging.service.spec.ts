import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { MessagingService } from './messaging.service';

const conversationId = '11111111-1111-4111-8111-111111111111';
const participantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const participantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const stranger = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const listingId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

interface QbStub {
  where: jest.Mock;
  andWhere: jest.Mock;
  getOne: jest.Mock<Promise<Conversation | null>, []>;
}

const buildQb = (existing: Conversation | null = null): QbStub => {
  const qb: Partial<QbStub> = {};
  qb.where = jest.fn().mockReturnValue(qb);
  qb.andWhere = jest.fn().mockReturnValue(qb);
  qb.getOne = jest.fn().mockResolvedValue(existing);
  return qb as QbStub;
};

describe('MessagingService', () => {
  let service: MessagingService;
  let repo: jest.Mocked<
    Pick<Repository<Conversation>, 'findOne' | 'createQueryBuilder' | 'create' | 'save'>
  >;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: getRepositoryToken(Conversation), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(MessagingService);
  });

  describe('assertIsParticipant', () => {
    it('throws NotFoundException when conversation does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.assertIsParticipant(conversationId, participantA),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when userId is not in participant_ids', async () => {
      repo.findOne.mockResolvedValue({
        id: conversationId,
        participantIds: [participantA, participantB],
      } as Conversation);
      await expect(
        service.assertIsParticipant(conversationId, stranger),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('resolves when userId is in participant_ids', async () => {
      repo.findOne.mockResolvedValue({
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
      expect(repo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('returns existing conversation (created=false) when match found', async () => {
      const existing = {
        id: conversationId,
        participantIds: [participantA, participantB],
        listingId,
      } as Conversation;
      const qb = buildQb(existing);
      repo.createQueryBuilder.mockReturnValue(qb as unknown as ReturnType<typeof repo.createQueryBuilder>);

      const result = await service.findOrCreateConversation(participantA, {
        participantIds: [participantA, participantB],
        listingId,
      });

      expect(result).toEqual({ created: false, conversation: existing });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('creates new conversation (created=true) when no match', async () => {
      const qb = buildQb(null);
      repo.createQueryBuilder.mockReturnValue(qb as unknown as ReturnType<typeof repo.createQueryBuilder>);
      const draft = { participantIds: [participantA, participantB] } as Conversation;
      const saved = {
        id: conversationId,
        participantIds: [participantA, participantB],
        listingId: null,
        orderId: null,
      } as Conversation;
      repo.create.mockReturnValue(draft);
      repo.save.mockResolvedValue(saved);

      const result = await service.findOrCreateConversation(participantA, {
        participantIds: [participantB, participantA],
      });

      expect(result).toEqual({ created: true, conversation: saved });
      expect(repo.create).toHaveBeenCalledWith({
        participantIds: [participantA, participantB].sort(),
        listingId: null,
        orderId: null,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('c.listing_id IS NULL');
    });

    it('matches existing conversation regardless of participantIds order', async () => {
      const qb = buildQb(null);
      repo.createQueryBuilder.mockReturnValue(qb as unknown as ReturnType<typeof repo.createQueryBuilder>);
      repo.create.mockReturnValue({} as Conversation);
      repo.save.mockResolvedValue({} as Conversation);

      await service.findOrCreateConversation(participantA, {
        participantIds: [participantB, participantA],
      });

      expect(qb.where).toHaveBeenCalledWith(
        'c.participant_ids = :ids',
        { ids: [participantA, participantB].sort() },
      );
    });

    it('filters by listing_id when provided', async () => {
      const qb = buildQb(null);
      repo.createQueryBuilder.mockReturnValue(qb as unknown as ReturnType<typeof repo.createQueryBuilder>);
      repo.create.mockReturnValue({} as Conversation);
      repo.save.mockResolvedValue({} as Conversation);

      await service.findOrCreateConversation(participantA, {
        participantIds: [participantA, participantB],
        listingId,
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'c.listing_id = :listingId',
        { listingId },
      );
    });
  });
});
