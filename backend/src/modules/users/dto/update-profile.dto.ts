import { IsOptional, IsString, IsEmail, IsEnum, Length } from 'class-validator';
import { PreferredLanguage } from '@shared/enums';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  city?: string;

  @IsOptional()
  @IsEnum(PreferredLanguage)
  preferredLanguage?: PreferredLanguage;
}
