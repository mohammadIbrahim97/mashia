import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/send')
  async sendOtp(@Body() dto: SendOtpDto): Promise<{ message: string }> {
    await this.authService.sendOtp(dto.phone);
    return { message: 'OTP sent' };
  }

  @Post('otp/verify')
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
  ): Promise<{ verified: boolean; userExists: boolean }> {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }
}
