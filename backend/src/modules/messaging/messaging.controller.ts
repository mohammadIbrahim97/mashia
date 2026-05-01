import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ListConversationsQueryDto } from './dto/list-conversations-query.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import { ConversationListItemResponse } from './dto/conversation-list-item.response';
import { MessagingService } from './messaging.service';

@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  async listConversations(
    @CurrentUser() user: User,
    @Query() query: ListConversationsQueryDto,
  ): Promise<ConversationListItemResponse[]> {
    return this.messagingService.listConversationsForUser(
      user.id,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Get('conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  async listMessages(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesQueryDto,
  ): Promise<Message[]> {
    return this.messagingService.listMessages(id, user.id, {
      before: query.before,
      limit: query.limit ?? 50,
    });
  }

  @Post('conversations')
  @UseGuards(JwtAuthGuard)
  async createConversation(
    @CurrentUser() user: User,
    @Body() dto: CreateConversationDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Conversation> {
    const { created, conversation } =
      await this.messagingService.findOrCreateConversation(user.id, dto);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return conversation;
  }
}
