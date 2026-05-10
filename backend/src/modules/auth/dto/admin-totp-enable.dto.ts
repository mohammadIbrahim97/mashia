import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class AdminTotpEnableDto {
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'TOTP code must be exactly 6 digits' })
  code: string;
}
