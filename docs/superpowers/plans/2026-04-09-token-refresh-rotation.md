# Token Refresh Endpoint with Rotation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `POST /auth/login` (OTP login for existing users) and `POST /auth/refresh` (token rotation with Redis blacklist) to the auth module.

**Architecture:** Extends `AuthService` with two new public methods. `login()` mirrors `register()` but finds an existing user instead of creating one. `refresh()` verifies the old refresh token, blacklists its `jti` in Redis, fetches fresh user data, and issues a new token pair. `generateTokens()` is updated to include a `jti` in the refresh token payload.

**Tech Stack:** NestJS 10, @nestjs/jwt, ioredis (Redis), class-validator, Jest

---

### Task 1: Create LoginDto and RefreshTokenDto

**Files:**
- Create: `src/modules/auth/dto/login.dto.ts`
- Create: `src/modules/auth/dto/refresh-token.dto.ts`

- [ ] **Step 1: Create LoginDto**

```typescript
// src/modules/auth/dto/login.dto.ts
import { IsNotEmpty, IsString, Matches, Length } from 'class-validator';

export class LoginDto {
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

- [ ] **Step 2: Create RefreshTokenDto**

```typescript
// src/modules/auth/dto/refresh-token.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit`
Expected: No errors related to the new DTOs.

- [ ] **Step 4: Commit**

```bash
git add src/modules/auth/dto/login.dto.ts src/modules/auth/dto/refresh-token.dto.ts
git commit -m "feat(auth): add LoginDto and RefreshTokenDto for #6"
```

---

### Task 2: Write failing tests for login()

**Files:**
- Modify: `src/modules/auth/auth.service.spec.ts`

The existing spec file has mocks for `otpService`, `usersService`, `jwtService`, `configService`, and a `mockUser` fixture. The new `login()` tests will reuse all of these.

- [ ] **Step 1: Add NotFoundException import and login() describe block**

Add `NotFoundException` to the existing `@nestjs/common` import at line 2 of `auth.service.spec.ts`, then add the following `describe('login')` block after the closing `});` of the existing `describe('register')` block (before the final `});` that closes the top-level `describe('AuthService')`):

```typescript
  // Add NotFoundException to the import on line 2:
  // import { ConflictException, NotFoundException } from '@nestjs/common';

  describe('login', () => {
    it('should verify OTP, find existing user, and return tokens', async () => {
      usersService.findByPhone.mockResolvedValue(mockUser);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await authService.login('+966501234567', '123456');

      expect(otpService.verify).toHaveBeenCalledWith('+966501234567', '123456');
      expect(usersService.findByPhone).toHaveBeenCalledWith('+966501234567');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).toEqual(mockUser);
    });

    it('should throw NotFoundException when phone not registered', async () => {
      usersService.findByPhone.mockResolvedValue(null);

      await expect(authService.login('+966501234567', '123456')).rejects.toThrow(
        NotFoundException,
      );
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should propagate OTP errors before user lookup', async () => {
      otpService.verify.mockRejectedValue(new Error('OTP expired'));

      await expect(authService.login('+966501234567', '123456')).rejects.toThrow(
        'OTP expired',
      );
      expect(usersService.findByPhone).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern auth.service.spec --verbose 2>&1 | tail -20`
Expected: 3 failures — `authService.login is not a function`

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/auth.service.spec.ts
git commit -m "test(auth): add failing login() tests for #6"
```

---

### Task 3: Implement login() and make tests pass

**Files:**
- Modify: `src/modules/auth/auth.service.ts`

- [ ] **Step 1: Add NotFoundException import and login() method**

Add `NotFoundException` to the import on line 1:

```typescript
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
```

Add the `login()` method to `AuthService` after the `register()` method and before `generateTokens()`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern auth.service.spec --verbose 2>&1 | tail -30`
Expected: All 14 tests pass (11 existing + 3 new login tests).

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/auth.service.ts
git commit -m "feat(auth): implement login() method for #6"
```

---

### Task 4: Write failing tests for refresh()

**Files:**
- Modify: `src/modules/auth/auth.service.spec.ts`

This task adds a Redis mock to the test setup and 6 new tests for `refresh()`.

- [ ] **Step 1: Add UnauthorizedException import, Redis mock, and REDIS_CLIENT provider**

Update the imports at the top of `auth.service.spec.ts`:

```typescript
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
```

Add the `REDIS_CLIENT` import after the existing imports:

```typescript
import { REDIS_CLIENT } from '@shared/redis/redis.constants';
```

Add a `mockRedis` variable declaration after the existing mock declarations (after line 15 `let configService: ...`):

```typescript
  let mockRedis: Record<string, jest.Mock>;
```

Inside `beforeEach`, add the Redis mock before the `const module` line:

```typescript
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };
```

Add the Redis provider to the `providers` array in the TestingModule:

```typescript
        { provide: REDIS_CLIENT, useValue: mockRedis },
```

- [ ] **Step 2: Add the refresh() describe block**

Add this after the `describe('login')` block, before the final `});`:

```typescript
  describe('refresh', () => {
    const validPayload = {
      sub: '550e8400-e29b-41d4-a716-446655440000',
      phone: '+966501234567',
      role: 'buyer',
      jti: 'test-jti-uuid',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    it('should verify token, blacklist old jti, and return new tokens', async () => {
      jwtService.verify = jest.fn().mockReturnValue(validPayload);
      mockRedis.get.mockResolvedValue(null); // not blacklisted
      usersService.findById.mockResolvedValue(mockUser);
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await authService.refresh('old-refresh-token');

      expect(jwtService.verify).toHaveBeenCalledWith('old-refresh-token', {
        secret: 'test-refresh-secret',
      });
      expect(mockRedis.get).toHaveBeenCalledWith('rt_blacklist:test-jti-uuid');
      expect(usersService.findById).toHaveBeenCalledWith(validPayload.sub);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'rt_blacklist:test-jti-uuid',
        '1',
        'EX',
        expect.any(Number),
      );
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';
      jwtService.verify = jest.fn().mockImplementation(() => { throw error; });

      await expect(authService.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for malformed token', async () => {
      const error = new Error('jwt malformed');
      error.name = 'JsonWebTokenError';
      jwtService.verify = jest.fn().mockImplementation(() => { throw error; });

      await expect(authService.refresh('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for blacklisted token', async () => {
      jwtService.verify = jest.fn().mockReturnValue(validPayload);
      mockRedis.get.mockResolvedValue('1'); // blacklisted

      await expect(authService.refresh('used-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user no longer exists', async () => {
      jwtService.verify = jest.fn().mockReturnValue(validPayload);
      mockRedis.get.mockResolvedValue(null);
      usersService.findById.mockResolvedValue(null);

      await expect(authService.refresh('orphan-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should set blacklist TTL to remaining seconds until token expiry', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const payloadWithKnownExp = { ...validPayload, exp: nowSec + 5000 };
      jwtService.verify = jest.fn().mockReturnValue(payloadWithKnownExp);
      mockRedis.get.mockResolvedValue(null);
      usersService.findById.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('token');

      await authService.refresh('some-token');

      const setCall = mockRedis.set.mock.calls[0];
      const ttl = setCall[3]; // 4th arg is the TTL
      // TTL should be approximately 5000 (±2 sec for test execution)
      expect(ttl).toBeGreaterThanOrEqual(4998);
      expect(ttl).toBeLessThanOrEqual(5000);
    });
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern auth.service.spec --verbose 2>&1 | tail -30`
Expected: 6 failures — `authService.refresh is not a function`

- [ ] **Step 4: Commit**

```bash
git add src/modules/auth/auth.service.spec.ts
git commit -m "test(auth): add failing refresh() tests for #6"
```

---

### Task 5: Implement refresh() and update generateTokens()

**Files:**
- Modify: `src/modules/auth/auth.service.ts`

- [ ] **Step 1: Add imports for Redis, UnauthorizedException, and crypto**

Replace the imports at the top of `auth.service.ts` with:

```typescript
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
```

- [ ] **Step 2: Inject Redis into constructor**

Replace the constructor with:

```typescript
  constructor(
    private readonly otpService: OtpService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}
```

- [ ] **Step 3: Add refresh() method**

Add this method after `login()` and before `generateTokens()`:

```typescript
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
```

- [ ] **Step 4: Update generateTokens() to add jti to refresh token**

Replace the existing `generateTokens()` method with:

```typescript
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
```

- [ ] **Step 5: Run all tests**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern auth.service.spec --verbose 2>&1 | tail -30`
Expected: All 20 tests pass (11 existing + 3 login + 6 refresh).

- [ ] **Step 6: Run full test suite to catch regressions**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --verbose 2>&1 | tail -30`
Expected: All 24+ tests pass (otp.service 8 + users.service 5 + auth.service 20).

- [ ] **Step 7: Commit**

```bash
git add src/modules/auth/auth.service.ts
git commit -m "feat(auth): implement refresh() with Redis blacklist rotation for #6"
```

---

### Task 6: Add login and refresh endpoints to controller

**Files:**
- Modify: `src/modules/auth/auth.controller.ts`

- [ ] **Step 1: Update the controller**

Replace the entire contents of `auth.controller.ts` with:

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
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

  @Post('login')
  async login(
    @Body() dto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    return this.authService.login(dto.phone, dto.code);
  }

  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refresh(dto.refreshToken);
  }
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/auth.controller.ts
git commit -m "feat(auth): add login and refresh endpoints to controller for #6"
```

---

### Task 7: E2E smoke test

**Files:** None (manual verification only)

- [ ] **Step 1: Ensure Docker containers are running**

Run: `cd /home/mohammadibrahim/mashia && docker compose ps`
Expected: `mashia-db` and `mashia-redis` both healthy. If not, run `docker compose up -d`.

- [ ] **Step 2: Start the NestJS server**

Run: `cd /home/mohammadibrahim/mashia/backend && npx nest start 2>&1 &`
Wait a few seconds for startup.

- [ ] **Step 3: Test login flow (send OTP → verify → register → login)**

Send OTP:
```bash
curl -s -X POST http://localhost:3000/api/v1/auth/otp/send \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+966509999999"}' | jq .
```
Expected: `{ "data": { "message": "OTP sent" } }`

Check console for OTP code, then register:
```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+966509999999","code":"<OTP>","role":"buyer","fullName":"Test User","country":"SA","city":"Riyadh"}' | jq .
```
Expected: `{ "data": { "accessToken": "...", "refreshToken": "...", "user": {...} } }`

Send another OTP for login:
```bash
curl -s -X POST http://localhost:3000/api/v1/auth/otp/send \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+966509999999"}' | jq .
```

Login:
```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+966509999999","code":"<OTP>"}' | jq .
```
Expected: `{ "data": { "accessToken": "...", "refreshToken": "...", "user": {...} } }`

- [ ] **Step 4: Test refresh flow**

Use the refresh token from the login response:
```bash
curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}' | jq .
```
Expected: `{ "data": { "accessToken": "...", "refreshToken": "..." } }` — new token pair.

- [ ] **Step 5: Test rotation — reuse the same refresh token**

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<SAME_OLD_REFRESH_TOKEN>"}' | jq .
```
Expected: 401 — `"Refresh token already used"`

- [ ] **Step 6: Test invalid token**

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"not-a-real-token"}' | jq .
```
Expected: 401 — `"Invalid refresh token"`

- [ ] **Step 7: Test login with unregistered phone**

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/otp/send \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+966501111111"}' | jq .
```
Then:
```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+966501111111","code":"<OTP>"}' | jq .
```
Expected: 404 — `"User not found. Please register first."`

- [ ] **Step 8: Kill the server**

Run: `kill $(lsof -t -i:3000) 2>/dev/null`
