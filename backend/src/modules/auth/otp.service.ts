import {
  Injectable,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@shared/redis/redis.constants';
import { SMS_SERVICE, SmsService } from '@shared/sms/sms.interface';
import { TooManyRequestsException } from '@shared/exceptions/too-many-requests.exception';

@Injectable()
export class OtpService {
  private static readonly OTP_TTL = 300; // 5 minutes
  private static readonly ATTEMPTS_TTL = 3600; // 1 hour
  private static readonly MAX_ATTEMPTS = 5;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(SMS_SERVICE) private readonly smsService: SmsService,
  ) {}

  async generateAndSend(phone: string): Promise<void> {
    const attemptsKey = `otp:attempts:${phone}`;
    const attempts = await this.redis.get(attemptsKey);

    if (attempts && parseInt(attempts, 10) >= OtpService.MAX_ATTEMPTS) {
      throw new TooManyRequestsException(
        'Too many OTP requests. Try again later.',
      );
    }

    const code = randomInt(100000, 999999).toString();

    await this.redis.set(`otp:code:${phone}`, code, 'EX', OtpService.OTP_TTL);
    await this.redis.incr(attemptsKey);
    await this.redis.expire(attemptsKey, OtpService.ATTEMPTS_TTL);

    await this.smsService.sendOtp(phone, code);
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const codeKey = `otp:code:${phone}`;
    const verifyAttemptsKey = `otp:verify:attempts:${phone}`;
    const storedCode = await this.redis.get(codeKey);

    if (!storedCode) {
      throw new BadRequestException('OTP expired or not found.');
    }

    if (storedCode !== code) {
      const attempts = await this.redis.incr(verifyAttemptsKey);
      await this.redis.expire(verifyAttemptsKey, OtpService.OTP_TTL);

      if (attempts >= OtpService.MAX_ATTEMPTS) {
        await this.redis.del(codeKey, verifyAttemptsKey);
        throw new BadRequestException('OTP expired or not found.');
      }

      throw new BadRequestException('Invalid OTP.');
    }

    await this.redis.del(codeKey, verifyAttemptsKey);
    return true;
  }

  /**
   * Like {@link verify} but does not consume the code on success. Used by
   * `/auth/otp/verify` so the client can branch on `userExists` before
   * spending the OTP on the actual `/auth/login` or `/auth/register` call.
   */
  async peek(phone: string, code: string): Promise<boolean> {
    const storedCode = await this.redis.get(`otp:code:${phone}`);

    if (!storedCode) {
      throw new BadRequestException('OTP expired or not found.');
    }

    if (storedCode !== code) {
      throw new BadRequestException('Invalid OTP.');
    }

    return true;
  }
}
