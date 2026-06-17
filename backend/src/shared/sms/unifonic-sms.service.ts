import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from './sms.interface';

@Injectable()
export class UnifonicSmsService implements SmsService {
  private readonly logger = new Logger(UnifonicSmsService.name);
  private readonly appSid: string;
  private readonly senderId: string;
  private readonly apiUrl = 'https://el.cloud.unifonic.com/rest/SMS/messages';

  constructor(private readonly configService: ConfigService) {
    this.appSid = this.configService.get<string>('sms.unifonicAppSid') || '';
    this.senderId = this.configService.get<string>('sms.unifonicSenderId') || '';
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    const formattedPhone = phone.startsWith('+') ? phone.substring(1) : phone;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          AppSid: this.appSid,
          Recipient: formattedPhone,
          Body: `Your Mashia OTP code is: ${code}`,
          SenderID: this.senderId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Unifonic API error: ${response.status} ${response.statusText} - ${errorData}`);
      }

      const data = await response.json();

      if (data.success !== 'true' && data.success !== true) {
         throw new Error(`Unifonic API reported failure: ${JSON.stringify(data)}`);
      }

      this.logger.log(`[Unifonic SMS] OTP sent to ${phone}`);
    } catch (error) {
      this.logger.error(`[Unifonic SMS] Failed to send OTP to ${phone}: ${error}`);
      throw error;
    }
  }
}
