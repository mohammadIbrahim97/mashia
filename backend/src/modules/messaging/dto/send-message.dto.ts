import { IsEnum, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { MessageType } from '@shared/enums';

export class SendMessageDto {
  @IsUUID('4')
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;

  @IsEnum(MessageType)
  type: MessageType;
}
