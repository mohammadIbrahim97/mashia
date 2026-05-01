import { ArrayMinSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @IsArray()
  @ArrayMinSize(2)
  @IsUUID('4', { each: true })
  participantIds: string[];

  @IsOptional()
  @IsUUID('4')
  listingId?: string;

  @IsOptional()
  @IsUUID('4')
  orderId?: string;
}
