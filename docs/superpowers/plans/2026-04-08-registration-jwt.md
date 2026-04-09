# User Registration + JWT Token Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user registration endpoint that verifies OTP, creates user, and returns JWT access + refresh tokens.

**Architecture:** AuthService gets a `register` method and a private `generateTokens` helper. AuthController gets a `POST /auth/register` endpoint. JWT tokens are stateless — signed with separate secrets for access (15min) and refresh (7d). `@nestjs/jwt` JwtService handles signing.

**Tech Stack:** NestJS 10, @nestjs/jwt, class-validator, Jest + ts-jest

**Spec:** `docs/superpowers/specs/2026-04-08-registration-jwt-design.md`

---

## File Structure

### Implement (exists but empty):
| File | Responsibility |
|------|---------------|
| `src/modules/auth/dto/register.dto.ts` | Validates registration input, blocks admin role |

### Modify:
| File | Change |
|------|--------|
| `src/modules/auth/auth.service.ts` | Add `register`, `generateTokens`, inject JwtService + ConfigService |
| `src/modules/auth/auth.controller.ts` | Add `register` endpoint |
| `src/modules/auth/auth.module.ts` | Add JwtModule import |
| `src/modules/auth/auth.service.spec.ts` | Add tests for register + generateTokens |

---

## Task 1: RegisterDto

**Files:**
- Implement: `src/modules/auth/dto/register.dto.ts`

- [ ] **Step 1: Implement RegisterDto**

```typescript
// src/modules/auth/dto/register.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsEmail,
  Matches,
  Length,
  NotEquals,
} from 'class-validator';
import { UserRole, PreferredLanguage } from '@shared/enums';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone must be in E.164 format (e.g., +966501234567)',
  })
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6, { message: 'OTP code must be exactly 6 digits' })
  code: string;

  @IsNotEmpty()
  @IsEnum(UserRole)
  @NotEquals(UserRole.ADMIN, { message: 'Cannot register as admin' })
  role: UserRole;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  country: string;

  @IsNotEmpty()
  @IsString()
  city: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(PreferredLanguage)
  preferredLanguage?: PreferredLanguage;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /home/mohammadibrahim/mashia
git add backend/src/modules/auth/dto/register.dto.ts
git commit -m "feat: add RegisterDto with admin role block and E.164 validation"
```

---

## Task 2: AuthService — register + generateTokens (TDD)

**Files:**
- Modify: `src/modules/auth/auth.service.ts`
- Modify: `src/modules/auth/auth.service.spec.ts`

- [ ] **Step 1: Add failing tests to auth.service.spec.ts**

Add these imports and mocks to the existing test file. The full updated file should be:

```typescript
// src/modules/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { UsersService } from '../users/users.service';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';
import { User } from '../users/user.entity';

describe('AuthService', () => {
  let authService: AuthService;
  let otpService: jest.Mocked<OtpService>;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    role: UserRole.BUYER,
    fullName: 'Ahmad Ali',
    phone: '+966501234567',
    email: null,
    country: 'SA',
    city: 'Riyadh',
    kycStatus: KycStatus.PENDING,
    kycDocuments: null,
    preferredLanguage: PreferredLanguage.AR,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    otpService = {
      generateAndSend: jest.fn().mockResolvedValue(undefined),
      verify: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<OtpService>;

    usersService = {
      findByPhone: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockUser),
    } as unknown as jest.Mocked<UsersService>;

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
    } as unknown as jest.Mocked<JwtService>;

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          JWT_SECRET: 'test-secret',
          JWT_EXPIRATION: '15m',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
          JWT_REFRESH_EXPIRATION: '7d',
        };
        return config[key];
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: OtpService, useValue: otpService },
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('sendOtp', () => {
    it('should call otpService.generateAndSend with the phone number', async () => {
      await authService.sendOtp('+966501234567');

      expect(otpService.generateAndSend).toHaveBeenCalledWith('+966501234567');
    });

    it('should propagate errors from otpService', async () => {
      otpService.generateAndSend.mockRejectedValue(new Error('Rate limited'));

      await expect(authService.sendOtp('+966501234567')).rejects.toThrow('Rate limited');
    });
  });

  describe('verifyOtp', () => {
    it('should return verified true and userExists false for new phone', async () => {
      usersService.findByPhone.mockResolvedValue(null);

      const result = await authService.verifyOtp('+966501234567', '123456');

      expect(otpService.verify).toHaveBeenCalledWith('+966501234567', '123456');
      expect(usersService.findByPhone).toHaveBeenCalledWith('+966501234567');
      expect(result).toEqual({ verified: true, userExists: false });
    });

    it('should return verified true and userExists true for existing user', async () => {
      usersService.findByPhone.mockResolvedValue(mockUser);

      const result = await authService.verifyOtp('+966501234567', '123456');

      expect(result).toEqual({ verified: true, userExists: true });
    });

    it('should propagate errors from otpService.verify', async () => {
      otpService.verify.mockRejectedValue(new Error('OTP expired'));

      await expect(authService.verifyOtp('+966501234567', '123456')).rejects.toThrow('OTP expired');
      expect(usersService.findByPhone).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    const registerDto = {
      phone: '+966501234567',
      code: '123456',
      role: UserRole.BUYER,
      fullName: 'Ahmad Ali',
      country: 'SA',
      city: 'Riyadh',
    };

    it('should verify OTP, create user, and return tokens', async () => {
      usersService.findByPhone.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await authService.register(registerDto);

      expect(otpService.verify).toHaveBeenCalledWith('+966501234567', '123456');
      expect(usersService.findByPhone).toHaveBeenCalledWith('+966501234567');
      expect(usersService.create).toHaveBeenCalledWith({
        phone: '+966501234567',
        role: UserRole.BUYER,
        fullName: 'Ahmad Ali',
        country: 'SA',
        city: 'Riyadh',
        email: undefined,
        preferredLanguage: undefined,
      });
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).toEqual(mockUser);
    });

    it('should sign access token with JWT_SECRET and 15m expiry', async () => {
      usersService.findByPhone.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);

      await authService.register(registerDto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, phone: mockUser.phone, role: mockUser.role },
        { secret: 'test-secret', expiresIn: '15m' },
      );
    });

    it('should sign refresh token with JWT_REFRESH_SECRET and 7d expiry', async () => {
      usersService.findByPhone.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);

      await authService.register(registerDto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, phone: mockUser.phone, role: mockUser.role },
        { secret: 'test-refresh-secret', expiresIn: '7d' },
      );
    });

    it('should throw ConflictException if phone already registered', async () => {
      usersService.findByPhone.mockResolvedValue(mockUser);

      await expect(authService.register(registerDto)).rejects.toThrow(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should propagate OTP errors before creating user', async () => {
      otpService.verify.mockRejectedValue(new Error('OTP expired'));

      await expect(authService.register(registerDto)).rejects.toThrow('OTP expired');
      expect(usersService.findByPhone).not.toHaveBeenCalled();
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should pass optional email and preferredLanguage to create', async () => {
      usersService.findByPhone.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...mockUser,
        email: 'ahmad@example.com',
        preferredLanguage: PreferredLanguage.EN,
      });

      await authService.register({
        ...registerDto,
        email: 'ahmad@example.com',
        preferredLanguage: PreferredLanguage.EN,
      });

      expect(usersService.create).toHaveBeenCalledWith({
        phone: '+966501234567',
        role: UserRole.BUYER,
        fullName: 'Ahmad Ali',
        country: 'SA',
        city: 'Riyadh',
        email: 'ahmad@example.com',
        preferredLanguage: PreferredLanguage.EN,
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/auth/auth.service.spec.ts --verbose 2>&1`
Expected: FAIL — new tests fail because `register` method doesn't exist and AuthService constructor doesn't accept JwtService/ConfigService

- [ ] **Step 3: Update AuthService with register + generateTokens**

Replace the full file:

```typescript
// src/modules/auth/auth.service.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/auth/auth.service.spec.ts --verbose 2>&1`
Expected: PASS — all 11 tests pass (5 existing + 6 new)

- [ ] **Step 5: Commit**

```bash
cd /home/mohammadibrahim/mashia
git add backend/src/modules/auth/auth.service.ts backend/src/modules/auth/auth.service.spec.ts
git commit -m "feat: add register method and JWT token generation to AuthService"
```

---

## Task 3: AuthController + AuthModule wiring

**Files:**
- Modify: `src/modules/auth/auth.controller.ts`
- Modify: `src/modules/auth/auth.module.ts`

- [ ] **Step 1: Add register endpoint to AuthController**

Replace the full file:

```typescript
// src/modules/auth/auth.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/send')
  async sendOtp(@Body() dto: SendOtpDto): Promise<{ message: string }> {
    await this.authService.sendOtp(dto.phone);
    return { message: 'OTP sent' };
  }

  @Post('otp/verify')
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
  ): Promise<{ verified: boolean; userExists: boolean }> {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    return this.authService.register(dto);
  }
}
```

- [ ] **Step 2: Add JwtModule to AuthModule**

Replace the full file:

```typescript
// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';

@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, OtpService],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 3: Run all tests**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --verbose 2>&1`
Expected: All real tests pass — OtpService (8) + UsersService (5) + AuthService (11) = 24 tests

- [ ] **Step 4: Commit**

```bash
cd /home/mohammadibrahim/mashia
git add backend/src/modules/auth/auth.controller.ts backend/src/modules/auth/auth.module.ts
git commit -m "feat: add register endpoint and JwtModule to AuthModule"
```

---

## Task 4: End-to-End Verification

- [ ] **Step 1: Ensure Docker containers are running**

Run: `docker compose -f /home/mohammadibrahim/mashia/docker-compose.yml up -d`

- [ ] **Step 2: Start app**

Run: `cd /home/mohammadibrahim/mashia/backend && npx nest start &`
Wait for: `Mashia API running on port 3000`
Verify route is mapped: look for `Mapped {/api/v1/auth/register, POST} route` in the logs

- [ ] **Step 3: Test full registration flow**

Send OTP:
```bash
curl -s -X POST http://localhost:3000/api/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "+966509999999"}'
```
Expected: `{"success":true,"data":{"message":"OTP sent"}}`

Get OTP from Redis:
```bash
docker exec mashia-redis redis-cli GET "otp:code:+966509999999"
```

Register with the OTP code (replace XXXXXX with actual code):
```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone": "+966509999999", "code": "XXXXXX", "role": "buyer", "fullName": "Test User", "country": "SA", "city": "Riyadh"}'
```
Expected: `{"success":true,"data":{"accessToken":"eyJ...","refreshToken":"eyJ...","user":{...}}}`

- [ ] **Step 4: Test error cases**

Duplicate registration (same phone):
```bash
# Send new OTP first
curl -s -X POST http://localhost:3000/api/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "+966509999999"}'
# Get code
docker exec mashia-redis redis-cli GET "otp:code:+966509999999"
# Try register again (replace XXXXXX)
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone": "+966509999999", "code": "XXXXXX", "role": "buyer", "fullName": "Test User", "country": "SA", "city": "Riyadh"}'
```
Expected: `{"message":"Phone number already registered","error":"Conflict","statusCode":409}`

Admin role blocked:
```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone": "+966501111111", "code": "123456", "role": "admin", "fullName": "Hacker", "country": "SA", "city": "Riyadh"}'
```
Expected: 400 with "Cannot register as admin"

- [ ] **Step 5: Verify user in database**

```bash
docker exec mashia-db psql -U sheep_user -d sheep_marketplace -c "SELECT id, role, full_name, phone, country, city, kyc_status FROM users;"
```
Expected: One row for +966509999999 with role=buyer, kyc_status=pending

- [ ] **Step 6: Kill server**

```bash
kill $(lsof -t -i:3000) 2>/dev/null
```
