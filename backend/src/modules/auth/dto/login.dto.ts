import { IsNotEmpty, IsString, Matches, Length } from 'class-validator';

export class LoginDto {
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
}
