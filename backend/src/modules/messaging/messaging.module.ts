import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { Listing } from '../listings/listing.entity';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { MessagingGateway } from './messaging.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, Message, User, Listing, Order]),
    AuthModule,
    UsersModule,
  ],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingGateway],
  exports: [MessagingService],
})
export class MessagingModule {}
