import { Injectable } from '@nestjs/common';
import { OtpService } from './otp.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly usersService: UsersService,
  ) {}

  async sendOtp(phone: string): Promise<void> {
    await this.otpService.generateAndSend(phone);
  }

  async verifyOtp(
    phone: string,
    code: string,
  ): Promise<{ verified: boolean; userExists: boolean }> {
    await this.otpService.verify(phone, code);
    const user = await this.usersService.findByPhone(phone);
    return { verified: true, userExists: !!user };
  }
}
