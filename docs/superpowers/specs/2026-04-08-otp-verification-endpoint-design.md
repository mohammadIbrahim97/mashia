# OTP Verification Endpoint Design

**Issue:** #3 — G1-US01-02: Implement OTP verification endpoint with rate limiting (5 attempts/hour)
**Scope:** SendOtpDto, VerifyOtpDto, AuthService, AuthController, AuthModule update
**Date:** 2026-04-08
**Depends on:** #2 (OtpService, UsersService — implemented)

---

## Overview

Builds the HTTP layer for OTP send and verify. AuthController exposes two public endpoints. AuthService orchestrates between OtpService (OTP logic) and UsersService (user existence check). Rate limiting on sends is already handled by OtpService from #2.

## Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Orchestration | AuthService as thin orchestrator | Controller stays dumb, service handles logic. #4-#7 add methods to AuthService without rework. |
| Verify response | `{ verified, userExists }` | Saves client a round trip — knows whether to show registration or login flow |
| Rate limiting | Already in OtpService.generateAndSend (5 sends/hour) | No additional rate limiting needed for this issue |
| Phone format | E.164 validation (`/^\+[1-9]\d{1,14}$/`) | International standard, handles all GCC + Syria numbers |

## 1. DTOs

### SendOtpDto
**File:** `backend/src/modules/auth/dto/send-otp.dto.ts`

```typescript
export class SendOtpDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/)
  phone: string;
}
```

### VerifyOtpDto
**File:** `backend/src/modules/auth/dto/verify-otp.dto.ts`

```typescript
export class VerifyOtpDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/)
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  code: string;
}
```

## 2. AuthService

**File:** `backend/src/modules/auth/auth.service.ts`

```typescript
export class AuthService {
  constructor(
    private readonly otpService: OtpService,
    private readonly usersService: UsersService,
  ) {}

  async sendOtp(phone: string): Promise<void> {
    await this.otpService.generateAndSend(phone);
  }

  async verifyOtp(phone: string, code: string): Promise<{ verified: boolean; userExists: boolean }> {
    await this.otpService.verify(phone, code);
    const user = await this.usersService.findByPhone(phone);
    return { verified: true, userExists: !!user };
  }
}
```

- `sendOtp`: passthrough now, becomes the place for pre-checks later (block banned phones, etc.)
- `verifyOtp`: verify code first (throws if invalid/expired), then check user existence
- When #4-#7 arrive, `register`, `login`, `refreshTokens` are added as new methods — no existing code changes

## 3. AuthController

**File:** `backend/src/modules/auth/auth.controller.ts`

```typescript
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/send')
  async sendOtp(@Body() dto: SendOtpDto): Promise<{ message: string }> {
    await this.authService.sendOtp(dto.phone);
    return { message: 'OTP sent' };
  }

  @Post('otp/verify')
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<{ verified: boolean; userExists: boolean }> {
    return this.authService.verifyOtp(dto.phone, dto.code);
  }
}
```

**Endpoints:**
- `POST /api/v1/auth/otp/send` — body: `{ phone }` → `{ success: true, data: { message: "OTP sent" } }`
- `POST /api/v1/auth/otp/verify` — body: `{ phone, code }` → `{ success: true, data: { verified: true, userExists: false } }`

Both are public (no auth guard). TransformInterceptor wraps responses in standard `{ success, data }` format.

**Error responses** (thrown by OtpService):
- 429: Too many OTP requests (5 sends/hour exceeded)
- 400: OTP expired or not found
- 400: Invalid OTP
- 400: Validation errors (bad phone format, missing fields)

## 4. AuthModule Update

**File:** `backend/src/modules/auth/auth.module.ts`

```typescript
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService],
  exports: [AuthService],
})
export class AuthModule {}
```

- Adds AuthController and AuthService
- Exports AuthService instead of OtpService (AuthService is the public API)
- OtpService stays as internal provider

## File Inventory

### Implement (exist but empty):
| File | Purpose |
|------|---------|
| `dto/send-otp.dto.ts` | Phone validation for send endpoint |
| `dto/verify-otp.dto.ts` | Phone + code validation for verify endpoint |
| `auth.service.ts` | Orchestrates OtpService + UsersService |
| `auth.controller.ts` | HTTP endpoints for send + verify |

### Modify:
| File | Change |
|------|--------|
| `auth.module.ts` | Add AuthController, AuthService; export AuthService |

## Not in Scope

- Registration endpoint (#4)
- JWT token generation (#5)
- Token refresh (#6)
- Passport JWT strategy (#7)
- Auth controller unit tests (#8)
