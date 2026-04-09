import { Injectable, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OtpService } from './otp.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

  private generateTokens(
    user: User,
  ): { accessToken: string; refreshToken: string } {
    const payload = { sub: user.id, phone: user.phone, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRATION'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION'),
    });

    return { accessToken, refreshToken };
  }
}
