import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { MessagingService } from './messaging.service';

const conversationId = '11111111-1111-4111-8111-111111111111';
const participantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const participantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const stranger = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('MessagingService', () => {
  let service: MessagingService;
  let repo: jest.Mocked<Pick<Repository<Conversation>, 'findOne'>>;

  beforeEach(async () => {
    repo = { findOne: jest.fn() };
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
});
