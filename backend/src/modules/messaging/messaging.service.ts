import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';

export interface FindOrCreateResult {
  created: boolean;
  conversation: Conversation;
}

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
  ) {}

  async assertIsParticipant(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (!conversation.participantIds.includes(userId)) {
      throw new ForbiddenException('Not a conversation participant');
    }
  }

  async findOrCreateConversation(
    currentUserId: string,
    dto: CreateConversationDto,
  ): Promise<FindOrCreateResult> {
    if (!dto.participantIds.includes(currentUserId)) {
      throw new BadRequestException(
        'Current user must be one of the participants',
      );
    }

    const sortedIds = [...dto.participantIds].sort();
    const listingId = dto.listingId ?? null;
    const orderId = dto.orderId ?? null;

    const qb = this.conversationsRepository
      .createQueryBuilder('c')
      .where('c.participant_ids = :ids', { ids: sortedIds });
    if (listingId === null) {
      qb.andWhere('c.listing_id IS NULL');
    } else {
      qb.andWhere('c.listing_id = :listingId', { listingId });
    }

    const existing = await qb.getOne();
    if (existing) {
      return { created: false, conversation: existing };
    }

    const entity = this.conversationsRepository.create({
      participantIds: sortedIds,
      listingId,
      orderId,
    });
    const saved = await this.conversationsRepository.save(entity);
    return { created: true, conversation: saved };
  }
}
