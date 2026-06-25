import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminTotpVerifyDto } from './dto/admin-totp-verify.dto';
import { AdminTotpEnableDto } from './dto/admin-totp-enable.dto';
import { User } from '../users/user.entity';
import { ProfileResponseDto } from '../users/dto/profile-response.dto';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { UserRole } from '@shared/enums';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/send')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async sendOtp(@Body() dto: SendOtpDto): Promise<{ message: string }> {
    await this.authService.sendOtp(dto.phone);
    return { message: 'OTP sent' };
  }

  @Post('otp/verify')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
  ): Promise<{ verified: boolean; userExists: boolean }> {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(
    @Body() dto: RegisterDto,
  ): Promise<{ accessToken: string; refreshToken: string; user: ProfileResponseDto }> {
    const result = await this.authService.register(dto);
    return { ...result, user: ProfileResponseDto.fromUser(result.user) };
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string; user: ProfileResponseDto }> {
    const result = await this.authService.login(dto.phone, dto.code);
    return { ...result, user: ProfileResponseDto.fromUser(result.user) };
  }

  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refresh(dto.refreshToken);
  }

  // ----- Admin auth (email + password + optional TOTP) -----

  @Post('admin/login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async adminLogin(@Body() dto: AdminLoginDto) {
    const result = await this.authService.adminLogin(dto.email, dto.password);
    if ('user' in result && result.user) {
      return { ...result, user: ProfileResponseDto.fromUser(result.user) };
    }
    return result;
  }

  @Post('admin/totp/verify')
  async adminTotpVerify(@Body() dto: AdminTotpVerifyDto) {
    const result = await this.authService.verifyAdminTotp(dto.ticket, dto.code);
    return { ...result, user: ProfileResponseDto.fromUser(result.user) };
  }

  @Post('admin/totp/setup')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminTotpSetup(@CurrentUser() user: User) {
    return this.authService.setupAdminTotp(user);
  }

  @Post('admin/totp/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminTotpEnable(
    @CurrentUser() user: User,
    @Body() dto: AdminTotpEnableDto,
  ) {
    return this.authService.enableAdminTotp(user, dto.code);
  }
}
