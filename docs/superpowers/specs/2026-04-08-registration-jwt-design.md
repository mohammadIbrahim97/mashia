# User Registration + JWT Token Generation Design

**Issues:** #4 (registration endpoint) + #5 (JWT token generation) — bundled because registration must return tokens
**Scope:** RegisterDto, AuthService.register, AuthService.generateTokens, AuthController.register, JwtModule setup
**Date:** 2026-04-08
**Depends on:** #2 (OtpService), #3 (AuthController, AuthService, DTOs)

---

## Overview

Adds user registration with OTP verification and JWT token generation. Client calls `POST /auth/register` with phone, OTP code, and profile data. Server verifies OTP, creates user, generates access + refresh tokens, returns all three.

## Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| OTP in registration | Phone + code in RegisterDto | Stateless, one API call, no intermediate tokens |
| Login vs register | Separate endpoints | Client knows from /auth/otp/verify whether user exists, calls the right one |
| JWT storage | Stateless (no DB/Redis) | MVP doesn't need revocation; add later if needed |
| Token secrets | Separate secrets for access and refresh | Tokens can't be confused; different expiry per secret |
| Admin role | Blocked in registration | Admins created through separate flow, not self-registration |

## 1. RegisterDto

**File:** `backend/src/modules/auth/dto/register.dto.ts`

```typescript
export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/)
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
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

- `@NotEquals(UserRole.ADMIN)` blocks admin self-registration at the DTO validation level
- Phone + code for OTP verification within the same request
- Optional email and preferredLanguage (defaults to AR in entity)

## 2. JWT Token Generation

**Added to:** `backend/src/modules/auth/auth.service.ts`

```typescript
private generateTokens(user: User): { accessToken: string; refreshToken: string } {
  const payload = { sub: user.id, phone: user.phone, role: user.role };

  const accessToken = this.jwtService.sign(payload, {
    secret: this.configService.get('JWT_SECRET'),
    expiresIn: this.configService.get('JWT_EXPIRATION'),  // 15m
  });

  const refreshToken = this.jwtService.sign(payload, {
    secret: this.configService.get('JWT_REFRESH_SECRET'),
    expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION'),  // 7d
  });

  return { accessToken, refreshToken };
}
```

- JWT payload: `{ sub: userId, phone, role }` — minimal, no sensitive data
- Access token: 15min expiry, signed with JWT_SECRET
- Refresh token: 7 days expiry, signed with JWT_REFRESH_SECRET
- Secrets and expiry from env vars via ConfigService

## 3. AuthService.register

**Added to:** `backend/src/modules/auth/auth.service.ts`

```typescript
async register(dto: RegisterDto): Promise<{ accessToken: string; refreshToken: string; user: User }> {
  // 1. Verify OTP (throws if invalid/expired)
  await this.otpService.verify(dto.phone, dto.code);

  // 2. Check phone not already registered
  const existing = await this.usersService.findByPhone(dto.phone);
  if (existing) {
    throw new ConflictException('Phone number already registered');
  }

  // 3. Create user
  const user = await this.usersService.create({
    phone: dto.phone,
    role: dto.role,
    fullName: dto.fullName,
    country: dto.country,
    city: dto.city,
    email: dto.email,
    preferredLanguage: dto.preferredLanguage,
  });

  // 4. Generate tokens
  const tokens = this.generateTokens(user);

  return { ...tokens, user };
}
```

Flow: verify OTP → check duplicate → create user → generate tokens → return.

Error cases:
- 400: OTP expired or invalid (from OtpService)
- 409: Phone already registered (ConflictException)
- 400: Validation errors (bad phone, admin role, missing fields)

## 4. AuthController.register

**Added to:** `backend/src/modules/auth/auth.controller.ts`

```typescript
@Post('register')
async register(@Body() dto: RegisterDto): Promise<{ accessToken: string; refreshToken: string; user: User }> {
  return this.authService.register(dto);
}
```

**Endpoint:** `POST /api/v1/auth/register`

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "user": { "id": "...", "phone": "+966501234567", "role": "buyer", ... }
  }
}
```

## 5. AuthModule Update

**Modified:** `backend/src/modules/auth/auth.module.ts`

```typescript
@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, OtpService],
  exports: [AuthService],
})
export class AuthModule {}
```

`JwtModule.register({})` with empty options — secrets and expiry are passed per-call in `generateTokens` since access and refresh tokens use different secrets.

## 6. New Dependencies on AuthService

AuthService constructor adds two new injections:

```typescript
constructor(
  private readonly otpService: OtpService,
  private readonly usersService: UsersService,
  private readonly jwtService: JwtService,        // NEW
  private readonly configService: ConfigService,   // NEW
)
```

## File Inventory

### Implement (exists but empty):
| File | Purpose |
|------|---------|
| `dto/register.dto.ts` | Registration input validation |

### Modify:
| File | Change |
|------|--------|
| `auth.service.ts` | Add `register`, `generateTokens`, inject JwtService + ConfigService |
| `auth.controller.ts` | Add `register` endpoint |
| `auth.module.ts` | Add JwtModule import |
| `auth.service.spec.ts` | Add tests for register + generateTokens |

## Not in Scope

- Login endpoint — #6 (will reuse `generateTokens`)
- Token refresh endpoint — #6
- Passport JWT strategy — #7
- Controller tests — #8
