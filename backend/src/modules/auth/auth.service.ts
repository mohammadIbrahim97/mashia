import * as crypto from 'node:crypto';
import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { OtpService } from './otp.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/user.entity';
import { REDIS_CLIENT } from '@shared/redis/redis.constants';

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async sendOtp(phone: string): Promise<void> {
    await this.otpService.generateAndSend(phone);
  }

  async verifyOtp(
    phone: string,
    code: string,
  ): Promise<{ verified: boolean; userExists: boolean }> {
    // Peek-only — the OTP is consumed by /auth/login or /auth/register so
    // the client can branch on userExists without spending the code first.
    await this.otpService.peek(phone, code);
    const user = await this.usersService.findByPhone(phone);
    return { verified: true, userExists: !!user };
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    await this.otpService.verify(dto.phone, dto.code);

    const existing = await this.usersService.findByPhone(dto.phone);
    if (existing) {
      throw new ConflictException('Phone number already registered');
    }

    const user = await this.usersService.create({
      phone: dto.phone,
      role: dto.role,
      fullName: dto.fullName,
      country: dto.country,
      city: dto.city,
      email: dto.email,
      preferredLanguage: dto.preferredLanguage,
    });

    const tokens = this.generateTokens(user);
    return { ...tokens, user };
  }

  async login(
    phone: string,
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    await this.otpService.verify(phone, code);

    const user = await this.usersService.findByPhone(phone);
    if (!user) {
      throw new NotFoundException('User not found. Please register first.');
    }

    const tokens = this.generateTokens(user);
    return { ...tokens, user };
  }

  async refresh(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: { sub: string; phone: string; role: string; jti: string; exp: number };

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Refresh token expired');
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    const blacklistKey = `rt_blacklist:${payload.jti}`;
    const isBlacklisted = await this.redis.get(blacklistKey);
    if (isBlacklisted) {
      throw new UnauthorizedException('Refresh token already used');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    await this.redis.set(blacklistKey, '1', 'EX', ttl);

    const tokens = this.generateTokens(user);
    return tokens;
  }

  private generateTokens(
    user: User,
  ): { accessToken: string; refreshToken: string } {
    const payload = { sub: user.id, phone: user.phone, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRATION'),
    });

    const refreshToken = this.jwtService.sign(
      { ...payload, jti: crypto.randomUUID() },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION'),
      },
    );

    return { accessToken, refreshToken };
  }
}
