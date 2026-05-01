import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message])],
})
export class MessagingModule {}
