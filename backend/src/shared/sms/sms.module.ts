import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SMS_SERVICE } from './sms.interface';
import { ConsoleSmsService } from './console-sms.service';
import { SnsSmsService } from './sns-sms.service';
import { UnifonicSmsService } from './unifonic-sms.service';

@Global()
@Module({
  providers: [
    {
      provide: SMS_SERVICE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('sms.provider');
        if (provider === 'sns') {
          return new SnsSmsService(configService);
        }
        if (provider === 'unifonic') {
          return new UnifonicSmsService(configService);
        }
        return new ConsoleSmsService();
      },
    },
  ],
  exports: [SMS_SERVICE],
})
export class SmsModule {}
