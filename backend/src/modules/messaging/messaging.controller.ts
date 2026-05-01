import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { Conversation } from './conversation.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { MessagingService } from './messaging.service';

@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  async listConversations() {
    return [];
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
