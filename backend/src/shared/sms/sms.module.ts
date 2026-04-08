import { Global, Module } from '@nestjs/common';
import { SMS_SERVICE } from './sms.interface';
import { ConsoleSmsService } from './console-sms.service';

@Global()
@Module({
  providers: [{ provide: SMS_SERVICE, useClass: ConsoleSmsService }],
  exports: [SMS_SERVICE],
})
export class SmsModule {}
