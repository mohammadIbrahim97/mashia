# G1-US01-05: Token Refresh Endpoint with Rotation — Design Spec

**Issue:** #6
**Date:** 2026-04-09
**Status:** Approved

## Overview

Add two endpoints to the auth module: `POST /auth/login` for OTP-verified login of existing users, and `POST /auth/refresh` for token rotation with Redis-based blacklisting of used refresh tokens.

## Endpoints

### POST /auth/login

**Purpose:** Authenticate an existing user via OTP and return JWT tokens.

**Input (LoginDto):**
```json
{
  "phone": "+966501234567",
  "code": "123456"
}
```

**Flow:**
1. Verify OTP via `OtpService.verify(phone, code)`
2. Find user via `UsersService.findByPhone(phone)`
3. If user not found → throw `NotFoundException('User not found. Please register first.')`
4. Generate token pair via `generateTokens(user)` (existing private method)
5. Return `{ accessToken, refreshToken, user }`

**Response (200):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": { "id": "...", "phone": "+966501234567", "role": "buyer", ... }
}
```

**Errors:**
| Scenario | Status | Message |
|---|---|---|
| Invalid/expired OTP | 401 | From OtpService |
| Phone not registered | 404 | User not found. Please register first. |

### POST /auth/refresh

**Purpose:** Exchange a valid refresh token for a new token pair. Old refresh token is blacklisted (rotation).

**Input (RefreshTokenDto):**
```json
{
  "refreshToken": "eyJ..."
}
```

**Flow:**
1. Verify `refreshToken` against `JWT_REFRESH_SECRET` using `JwtService.verify()`
   - Catch `TokenExpiredError` → 401 "Refresh token expired"
   - Catch `JsonWebTokenError` → 401 "Invalid refresh token"
2. Extract `jti` from decoded payload
3. Check Redis key `rt_blacklist:{jti}` — if exists → 401 "Refresh token already used"
4. Extract `sub` (user ID) from decoded payload
5. Fetch user from DB via `UsersService.findById(sub)`
   - If user not found → 401 "User no longer exists"
6. Blacklist old token: set Redis key `rt_blacklist:{jti}` with TTL = `exp - now()` (remaining seconds)
7. Generate new token pair via `generateTokens(user)` (new refresh token gets a fresh `jti`)
8. Return `{ accessToken, refreshToken }`

**Response (200):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

**Errors:**
| Scenario | Status | Message |
|---|---|---|
| Malformed token | 401 | Invalid refresh token |
| Expired token | 401 | Refresh token expired |
| Already-used token (blacklisted) | 401 | Refresh token already used |
| User deleted after token issued | 401 | User no longer exists |

## Changes to Existing Code

### `generateTokens(user)` — Add `jti` to refresh token

Current payload for both tokens: `{ sub, phone, role }`

**Change:** Add `jti: crypto.randomUUID()` to refresh token payload only.

```typescript
private generateTokens(user: User): { accessToken: string; refreshToken: string } {
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

### Redis injection

`AuthService` currently does not inject the Redis client. It needs `@Inject(REDIS_CLIENT) private readonly redis: Redis` (from `ioredis`) to check/set blacklist keys. `REDIS_CLIENT` token is already exported from `@shared/redis/redis.constants`.

### Imports

- `crypto` from `node:crypto` (for `crypto.randomUUID()`)
- `Redis` from `ioredis` (for Redis type)
- `REDIS_CLIENT` from `@shared/redis/redis.constants`

## New Files

### `dto/login.dto.ts`
Same validators as `VerifyOtpDto`: phone (E.164) + code (6 digits).

### `dto/refresh-token.dto.ts`
Single field: `refreshToken` — `@IsNotEmpty()` `@IsString()`.

## Modified Files

| File | Change |
|---|---|
| `auth.service.ts` | Add `login()`, `refresh()` methods; inject Redis; modify `generateTokens()` to add `jti` |
| `auth.controller.ts` | Add `POST login` and `POST refresh` endpoints |
| `auth.service.spec.ts` | Add tests for `login()` and `refresh()` |
| `auth.module.ts` | No change needed (Redis is @Global) |

## Redis Keys

| Key pattern | Value | TTL |
|---|---|---|
| `rt_blacklist:{jti}` | `"1"` | Remaining seconds until original token's `exp` |

Keys auto-expire when the original refresh token would have expired naturally, keeping Redis clean.

## Test Cases

### login()
1. Verify OTP, find existing user, return tokens + user
2. Throw NotFoundException when phone not registered
3. Propagate OTP errors before user lookup

### refresh()
4. Verify valid refresh token, blacklist old, return new pair
5. Throw UnauthorizedException for expired token
6. Throw UnauthorizedException for malformed token
7. Throw UnauthorizedException for blacklisted (already-used) token
8. Throw UnauthorizedException when user no longer exists
9. Verify blacklist Redis key is set with correct TTL

## Not in Scope

- Access token blacklisting (short-lived, 15min — not worth the overhead)
- Token family tracking / reuse detection (can add later if needed)
- Rate limiting on refresh endpoint (can add via guard later)
