import { IsIn, IsString, Length } from 'class-validator';

export class PresignedUrlDto {
  @IsIn(['listing', 'certificate', 'chat_image'])
  purpose: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType: string;

  @IsString()
  @Length(1, 255)
  fileName: string;
}
