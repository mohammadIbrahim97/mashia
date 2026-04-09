import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsEmail,
  Matches,
  Length,
  NotEquals,
} from 'class-validator';
import { UserRole, PreferredLanguage } from '@shared/enums';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone must be in E.164 format (e.g., +966501234567)',
  })
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'OTP code must be exactly 6 digits' })
  code: string;

  @IsNotEmpty()
  @IsEnum(UserRole)
  @NotEquals(UserRole.ADMIN, { message: 'Cannot register as admin' })
  role: UserRole;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  country: string;

  @IsNotEmpty()
  @IsString()
  city: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(PreferredLanguage)
  preferredLanguage?: PreferredLanguage;
}
