import * as crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import {
  Injectable,
  Inject,
  BadRequestException,
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

const ADMIN_TICKET_TTL_SECONDS = 5 * 60;
const TOTP_ISSUER = 'Mashia Admin';

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

  // ----- Admin auth (email + password + optional TOTP) -----

  async adminLogin(
    email: string,
    password: string,
  ):
    Promise<
      | { accessToken: string; refreshToken: string; user: User }
      | { requiresTotp: true; ticket: string }
    > {
    const user = await this.usersService.findAdminByEmail(email);
    // Avoid disclosing whether the email exists. Always run a bcrypt compare
    // to keep timing roughly constant.
    const hash =
      user?.passwordHash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalido';
    const ok = await bcrypt.compare(password, hash);
    if (!user || !ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.totpEnabled) {
      const ticket = crypto.randomUUID();
      await this.redis.set(
        `admin_totp_ticket:${ticket}`,
        user.id,
        'EX',
        ADMIN_TICKET_TTL_SECONDS,
      );
      return { requiresTotp: true, ticket };
    }

    const tokens = this.generateTokens(user);
    return { ...tokens, user };
  }

  async verifyAdminTotp(
    ticket: string,
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    const ticketKey = `admin_totp_ticket:${ticket}`;
    const userId = await this.redis.get(ticketKey);
    if (!userId) {
      throw new UnauthorizedException('Ticket expired or invalid');
    }

    const user = await this.usersService.findById(userId);
    if (!user || !user.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedException('TOTP not enabled for this account');
    }

    const ok = authenticator.verify({ token: code, secret: user.totpSecret });
    if (!ok) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.redis.del(ticketKey);
    const tokens = this.generateTokens(user);
    return { ...tokens, user };
  }

  /**
   * Generate (but don't yet enable) a TOTP secret for the calling admin.
   * Returns the secret + an otpauth:// URI that the admin can render as a QR
   * code and scan with their authenticator app. Call /enable with a valid
   * code to flip totpEnabled = true.
   */
  async setupAdminTotp(
    user: User,
  ): Promise<{ secret: string; otpauthUrl: string }> {
    const secret = authenticator.generateSecret();
    await this.usersService.updateAuthFields(user.id, {
      totpSecret: secret,
      totpEnabled: false,
    });
    const otpauthUrl = authenticator.keyuri(
      user.email ?? user.id,
      TOTP_ISSUER,
      secret,
    );
    return { secret, otpauthUrl };
  }

  async enableAdminTotp(user: User, code: string): Promise<{ enabled: true }> {
    if (!user.totpSecret) {
      throw new BadRequestException(
        'No TOTP secret on file — call /auth/admin/totp/setup first',
      );
    }
    const ok = authenticator.verify({ token: code, secret: user.totpSecret });
    if (!ok) {
      throw new UnauthorizedException('Invalid TOTP code');
    }
    await this.usersService.updateAuthFields(user.id, { totpEnabled: true });
    return { enabled: true };
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
