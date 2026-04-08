import { Injectable, Logger } from '@nestjs/common';
import { SmsService } from './sms.interface';

@Injectable()
export class ConsoleSmsService implements SmsService {
  private readonly logger = new Logger('SmsService');

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(`[SMS] OTP for ${phone}: ${code}`);
  }
}
