# OTP Verification Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build HTTP endpoints for OTP send and verify, with AuthService orchestrating OtpService and UsersService.

**Architecture:** AuthController exposes two public endpoints (`POST /auth/otp/send`, `POST /auth/otp/verify`). AuthService is a thin orchestrator that delegates OTP logic to OtpService and user lookup to UsersService. DTOs validate input with class-validator.

**Tech Stack:** NestJS 10, class-validator, class-transformer, Jest + ts-jest

**Spec:** `docs/superpowers/specs/2026-04-08-otp-verification-endpoint-design.md`

---

## File Structure

### Implement (exist but empty):
| File | Responsibility |
|------|---------------|
| `src/modules/auth/dto/send-otp.dto.ts` | Validates phone in E.164 format |
| `src/modules/auth/dto/verify-otp.dto.ts` | Validates phone + 6-digit code |
| `src/modules/auth/auth.service.ts` | Orchestrates OtpService + UsersService |
| `src/modules/auth/auth.controller.ts` | HTTP endpoints for send + verify |

### Modify:
| File | Change |
|------|--------|
| `src/modules/auth/auth.module.ts` | Add AuthController, AuthService; export AuthService |

### Test:
| File | Responsibility |
|------|---------------|
| `src/modules/auth/auth.service.spec.ts` | Unit tests for AuthService (new file) |

---

## Task 1: DTOs

**Files:**
- Implement: `src/modules/auth/dto/send-otp.dto.ts`
- Implement: `src/modules/auth/dto/verify-otp.dto.ts`

- [ ] **Step 1: Implement SendOtpDto**

```typescript
// src/modules/auth/dto/send-otp.dto.ts
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone must be in E.164 format (e.g., +966501234567)',
  })
  phone: string;
}
```

- [ ] **Step 2: Implement VerifyOtpDto**

```typescript
// src/modules/auth/dto/verify-otp.dto.ts
import { IsNotEmpty, IsString, Matches, Length } from 'class-validator';

export class VerifyOtpDto {
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
}
```

- [ ] **Step 3: Verify they compile**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit src/modules/auth/dto/send-otp.dto.ts src/modules/auth/dto/verify-otp.dto.ts`
Expected: No output (clean compile)

- [ ] **Step 4: Commit**

```bash
cd /home/mohammadibrahim/mashia
git add backend/src/modules/auth/dto/send-otp.dto.ts backend/src/modules/auth/dto/verify-otp.dto.ts
git commit -m "feat: add SendOtpDto and VerifyOtpDto with E.164 validation"
```

---

## Task 2: AuthService (TDD)

**Files:**
- Implement: `src/modules/auth/auth.service.ts`
- Create: `src/modules/auth/auth.service.spec.ts`

- [ ] **Step 1: Write failing tests for AuthService**

```typescript
// src/modules/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { UsersService } from '../users/users.service';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';

describe('AuthService', () => {
  let authService: AuthService;
  let otpService: jest.Mocked<Partial<OtpService>>;
  let usersService: jest.Mocked<Partial<UsersService>>;

  beforeEach(async () => {
    otpService = {
      generateAndSend: jest.fn().mockResolvedValue(undefined),
      verify: jest.fn().mockResolvedValue(true),
    };

    usersService = {
      findByPhone: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: OtpService, useValue: otpService },
        { provide: UsersService, useValue: usersService },
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
      usersService.findByPhone.mockResolvedValue({
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
      } as any);

      const result = await authService.verifyOtp('+966501234567', '123456');

      expect(result).toEqual({ verified: true, userExists: true });
    });

    it('should propagate errors from otpService.verify', async () => {
      otpService.verify.mockRejectedValue(new Error('OTP expired'));

      await expect(authService.verifyOtp('+966501234567', '123456')).rejects.toThrow('OTP expired');
      expect(usersService.findByPhone).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/auth/auth.service.spec.ts --verbose 2>&1`
Expected: FAIL — `Cannot find module './auth.service'`

- [ ] **Step 3: Implement AuthService**

```typescript
// src/modules/auth/auth.service.ts
import { Injectable } from '@nestjs/common';
import { OtpService } from './otp.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly usersService: UsersService,
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
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/auth/auth.service.spec.ts --verbose 2>&1`
Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```bash
cd /home/mohammadibrahim/mashia
git add backend/src/modules/auth/auth.service.ts backend/src/modules/auth/auth.service.spec.ts
git commit -m "feat: implement AuthService with sendOtp and verifyOtp"
```

---

## Task 3: AuthController

**Files:**
- Implement: `src/modules/auth/auth.controller.ts`

- [ ] **Step 1: Implement AuthController**

```typescript
// src/modules/auth/auth.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

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
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /home/mohammadibrahim/mashia
git add backend/src/modules/auth/auth.controller.ts
git commit -m "feat: add AuthController with otp/send and otp/verify endpoints"
```

---

## Task 4: Wire AuthModule + End-to-End Verification

**Files:**
- Modify: `src/modules/auth/auth.module.ts`

- [ ] **Step 1: Update AuthModule**

```typescript
// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 2: Run all tests**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --verbose 2>&1`
Expected: All real tests pass — OtpService (8) + UsersService (5) + AuthService (5) = 18 tests

- [ ] **Step 3: Start app and test endpoints manually**

Run: `cd /home/mohammadibrahim/mashia/backend && npx nest start &`
Wait for: `Mashia API running on port 3000`

Test send OTP:
```bash
curl -s -X POST http://localhost:3000/api/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "+966501234567"}' | python3 -m json.tool
```
Expected: `{ "success": true, "data": { "message": "OTP sent" } }`
Check NestJS logs for: `[SmsService] [SMS] OTP for +966501234567: XXXXXX`

Test verify OTP (use the code from the log):
```bash
curl -s -X POST http://localhost:3000/api/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "+966501234567", "code": "XXXXXX"}' | python3 -m json.tool
```
Expected: `{ "success": true, "data": { "verified": true, "userExists": false } }`

Test validation error (bad phone):
```bash
curl -s -X POST http://localhost:3000/api/v1/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone": "not-a-phone"}' | python3 -m json.tool
```
Expected: 400 with validation error message about E.164 format

Kill the server: `kill %1`

- [ ] **Step 4: Commit**

```bash
cd /home/mohammadibrahim/mashia
git add backend/src/modules/auth/auth.module.ts
git commit -m "feat: wire AuthModule with controller, service, and OTP endpoints"
```
