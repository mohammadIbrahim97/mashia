import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { OtpService } from './otp.service';

@Module({
  imports: [UsersModule],
  providers: [OtpService],
  exports: [OtpService],
})
export class AuthModule {}
