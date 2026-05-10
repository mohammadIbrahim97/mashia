import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class AdminLoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @Length(8, 200)
  password: string;
}
