import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SmsService } from './sms.interface';

@Injectable()
export class SnsSmsService implements SmsService {
  private readonly logger = new Logger(SnsSmsService.name);
  private readonly client: SNSClient;

  constructor(private readonly configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('sms.snsAccessKeyId');
    const secretAccessKey = this.configService.get<string>('sms.snsSecretAccessKey');

    this.client = new SNSClient({
      region: this.configService.get<string>('sms.snsRegion'),
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    try {
      await this.client.send(
        new PublishCommand({
          PhoneNumber: phone,
          Message: `Your Mashia OTP code is: ${code}`,
          MessageAttributes: {
            'AWS.SNS.SMS.SMSType': {
              DataType: 'String',
              StringValue: 'Transactional',
            },
          },
        }),
      );
      this.logger.log(`[SNS SMS] OTP sent to ${phone}`);
    } catch (error) {
      this.logger.error(`[SNS SMS] Failed to send OTP to ${phone}: ${error}`);
      throw error;
    }
  }
}
