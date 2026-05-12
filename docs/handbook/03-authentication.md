# 03 — Authentication

Mashia has **two completely separate auth flows** that converge on the same JWT pair. Read both halves of this chapter — even if you're working on the trader flow, the admin guard surface affects you.

| | Trader flow | Admin flow |
|---|---|---|
| Identifier | Phone number (E.164) | Email |
| First factor | SMS OTP (6 digits, 5 min TTL) | Bcrypt password (12 chars min, 12 rounds) |
| Second factor | none | Optional TOTP (RFC 6238) |
| Registration | `POST /auth/register` (open to public) | `scripts/create-admin.js` (out-of-band) |
| KYC required for write ops | yes (`KycVerifiedGuard`) | no |

Files: `backend/src/modules/auth/`.

**Last verified date:** 2026-05-12  
**Verified against paths:** `backend/src/modules/auth/*`, `backend/src/modules/admin/admin.controller.ts`, `admin/src/services/auth.service.ts`, `admin/src/services/session.ts`, `admin/src/app/login/page.tsx`

## Token model (shared)

Both flows finish by minting a pair from `AuthService.generateTokens(user)`:

```ts
payload = { sub: user.id, phone: user.phone, role: user.role }
accessToken  = jwt.sign(payload,           { secret: JWT_SECRET,         expiresIn: JWT_EXPIRATION  })   // 15 min default
refreshToken = jwt.sign({ ...payload, jti }, { secret: JWT_REFRESH_SECRET, expiresIn: JWT_REFRESH_EXPIRATION }) // 7 days default
```

- Two different secrets. `JWT_SECRET` validates access tokens via `JwtStrategy`; `JWT_REFRESH_SECRET` only ever passes through `AuthService.refresh()`.
- The refresh token carries a `jti` (random UUID). When refresh is consumed, that `jti` lands in Redis with key `rt_blacklist:<jti>` and TTL equal to the remaining lifetime of the token. Replaying the same refresh after rotation → `UnauthorizedException('Refresh token already used')`.
- `JwtStrategy.validate` looks up the user fresh on every request and **rejects suspended accounts** (`user.suspended === true → UnauthorizedException('Account suspended')`). This means an admin clicking "Suspend" takes effect on the *next* request from that user.

### Refresh-on-401 (client side)

Both clients (`mobile/src/services/api.ts`, `admin/src/services/api.ts`) implement the same dance:

1. Send request with `Authorization: Bearer <access>`.
2. On `401`, lazily call `POST /auth/refresh` with the refresh token.
3. If the refresh succeeds, update the stored pair and retry the original request **once**.
4. If the refresh fails, wipe the session and redirect to login.

A module-scoped `refreshing` promise guarantees that even if 10 requests 401 at the same time, only one refresh call goes out (thundering-herd protection). See `admin/src/services/api.ts` lines 30–86 for the canonical implementation.

## Trader flow (phone + OTP)

### State machine

```
+-----------+    POST /auth/otp/send       +-----------+
|  client   | ---------------------------> |  Redis    |  otp:code:+966... = "123456"  (5 min TTL)
|           |                              |           |  otp:attempts:+966... incremented (1h TTL, max 5)
|           | <----------- SMS ----------- |  SMS svc  |  ConsoleSmsService logs to stdout
+-----------+                              +-----------+
      |
      | POST /auth/otp/verify  { phone, code }     (optional — only used to branch on userExists)
      v
+-----------+
| /verify   |  peek the OTP without consuming it. Returns { verified, userExists }
+-----------+
      |
      | branch on userExists:
      |   true  → POST /auth/login    { phone, code }
      |   false → POST /auth/register { phone, code, role, fullName, country, city, email?, lang? }
      v
+-----------+
| backend   |  otpService.verify(...) — consumes the OTP (DEL otp:code:...)
|           |  generateTokens(user)  → { accessToken, refreshToken, user }
+-----------+
```

### Why `verify` is "peek-only"

The client needs to know `userExists` so it can choose between login and register. If we consumed the OTP on `/verify`, the user would have to request a new one to actually log in. So `/auth/otp/verify` calls `otpService.peek(...)` (just checks the code), and the final consume happens inside `/auth/login` or `/auth/register`.

`OtpService.verify` (consuming) and `peek` (non-consuming) live side-by-side in `backend/src/modules/auth/otp.service.ts`.

### OTP storage and rate limiting

`OtpService` uses two Redis keys per phone:

| Key | Value | TTL | Why |
|---|---|---|---|
| `otp:code:<phone>` | `"123456"` (6-digit string) | 300 s | Single-use; deleted on successful verify |
| `otp:attempts:<phone>` | counter | 3600 s | Caps abuse: 5 requests/hour → 429 |

`POST /auth/otp/send` increments the counter and refreshes its TTL. After 5 sends in an hour the next `send` returns `TooManyRequestsException` ("Too many OTP requests. Try again later.").

There is no per-IP rate limit. The intended hardening is a `@nestjs/throttler` guard on the OTP and admin-login endpoints — currently still on the TODO list (see root `README.md`, "Loose ends on the foundation").

### Registration constraints

`RegisterDto` enforces:

- `role` must be one of `seller | buyer | broker` — `admin` is rejected by the DTO. Admin accounts are created via the bootstrap script. **Don't add a back door**, e.g. via an admin endpoint that toggles role.
- Phone E.164 (`/^\+[1-9]\d{1,14}$/`).
- `country` / `city` are required free-text. The choice of countries is currently the mobile app's constants file (`mobile/src/utils/constants.ts`).
- `preferredLanguage` defaults to `ar` if omitted.

A successful `/auth/register` automatically issues tokens and logs the user in.

### SMS provider

`backend/src/shared/sms/sms.interface.ts` exports `SmsService`:

```ts
export interface SmsService { sendOtp(phone: string, code: string): Promise<void>; }
```

Default implementation is `ConsoleSmsService`: prints `[SMS] OTP for +9665...: 123456` to the logger. That's why the seed script (and your local dev) reads codes from the backend log.

Production swap is a one-class change — implement `SmsService` for Unifonic / AWS SNS / your preferred KSA provider and bind it in `SmsModule`. Deferred until business / sender-ID registration is approved.

## Admin flow (email + password + optional TOTP)

`backend/src/modules/auth/auth.service.ts` — see the `// ----- Admin auth -----` block.

### Login

```
POST /auth/admin/login { email, password }
        │
        ├── usersService.findAdminByEmail(email)  (NOT findByEmail — filters role=admin)
        │
        ├── bcrypt.compare(password, hash)         (always run, even on missing user, to keep
        │                                           timing constant — see hardcoded dummy hash)
        │
        ├── if !user || !ok → 401 "Invalid email or password"
        │
        ├── if user.totpEnabled
        │      → mint a 5-minute ticket in Redis: admin_totp_ticket:<uuid> = user.id
        │      → return { requiresTotp: true, ticket }
        │
        └── else generateTokens(user) → return { accessToken, refreshToken, user }
```

Timing safety: on a missing user we still run `bcrypt.compare(password, INVALID_HASH)` so attackers can't enumerate emails by response latency.

### TOTP completion

```
POST /auth/admin/totp/verify { ticket, code }
        │
        ├── redis.get(admin_totp_ticket:ticket) → userId  (or 401 if expired)
        │
        ├── load user, check totpEnabled and totpSecret
        │
        ├── authenticator.verify({ token: code, secret })  ← otplib
        │
        ├── redis.del(ticket)  (one-shot)
        │
        └── generateTokens(user) → return { accessToken, refreshToken, user }
```

### Enabling TOTP for an existing admin

Two-step (so the admin proves the secret made it into the authenticator app before we lock them out):

1. `POST /auth/admin/totp/setup` (`JwtAuthGuard + Roles(ADMIN)`)
   - generates a base32 secret with `authenticator.generateSecret()`
   - stores it on the user (`totp_secret`), keeps `totp_enabled = false`
   - returns `{ secret, otpauthUrl }` — backend flow is implemented, but a dedicated `/settings` admin UI for setup/enable is still open.
2. `POST /auth/admin/totp/enable { code }` (same guards)
   - verifies the code against the stored secret
   - flips `totp_enabled = true`

After this, the next login goes through the ticket flow.

### Why ticket-based instead of a single login call

If `/auth/admin/login` returned the full token pair only when `password + code` were both present, the client would have to hold the password in memory while the user fishes for the code. The ticket lets the password be discarded immediately, and gives the server a chance to apply a different rate-limit profile to the TOTP-verify endpoint.

### Bootstrap script details

`backend/scripts/create-admin.js` — see file for full code. Key behaviour:

- Validates email regex + password length (≥ 12).
- Uses a synthetic phone `+admin-<timestamp>` to satisfy the `NOT NULL UNIQUE` constraint on `users.phone`.
- Sets `kyc_status = 'verified'` so the admin doesn't trip `KycVerifiedGuard` if they ever hit a trader endpoint.
- TOTP setup prompts in-process; if you decline, you can run `POST /auth/admin/totp/setup` later.
- **Idempotent**: re-running with the same email **updates** the password instead of creating a duplicate.

## Guards

All in `backend/src/shared/guards/`.

### `JwtAuthGuard`

Thin wrapper over `AuthGuard('jwt')`. Decorate a route with `@UseGuards(JwtAuthGuard)`. Hydrates `req.user: User`.

### `RolesGuard`

Pair it with the `@Roles(...)` decorator:

```ts
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SELLER, UserRole.BROKER)
create(@CurrentUser() user: User, @Body() dto: CreateXDto) { ... }
```

If `@Roles()` is absent or empty, the guard returns `true` (no role restriction).

### `KycVerifiedGuard`

```ts
@Post()
@UseGuards(JwtAuthGuard, RolesGuard, KycVerifiedGuard)
@Roles(UserRole.SELLER)
create(...) { ... }
```

Throws `ForbiddenException('KYC verification required')` if `user.kycStatus !== VERIFIED`. **Applied to every state-changing trader endpoint** — listing CRUD, order create, certificate upload. Read endpoints (`GET /listings`, `GET /orders`) do not require KYC.

Admins are *not* exempt mechanically; they just have `kyc_status = 'verified'` from the bootstrap script.

## Decorators

`backend/src/shared/decorators/`:

- `@Roles(...UserRole[])` — sets metadata read by `RolesGuard`.
- `@CurrentUser()` — extracts `req.user` (the entity from `JwtStrategy.validate`). Always typed as `User`.

## Mobile auth state

`mobile/src/store/auth.store.ts` (Zustand) holds:

```
{ status: 'loading' | 'authenticated' | 'anonymous',
  user:   AuthUser | null }
```

Tokens are *not* in this store — they live in `react-native-keychain` (encrypted device storage), wrapped by `loadTokens/setTokens` in `mobile/src/services/api.ts`. `RootNavigator.tsx` reads `status` to pick between `AuthStack` and `MainTabs`.

Boot sequence:

1. `App.tsx` mounts `RootNavigator`.
2. `useEffect(() => hydrate())` runs once.
3. `hydrate()` reads tokens from Keychain. If present, calls `authService.fetchMe()` (`GET /users/me`) to validate and populate `user`. If that 401s, tokens are wiped.
4. State flips to `authenticated` or `anonymous`, navigator re-renders.

## Admin auth state (web)

Two cookies, both **non-HttpOnly** today, in `admin/src/services/session.ts`:

| Cookie | TTL | Holds |
|---|---|---|
| `access_token` | 15 minutes | Access JWT |
| `refresh_token` | 7 days | Refresh JWT |

`admin/src/middleware.ts` checks for `access_token` and redirects between `/login` and `/dashboard`. The cookies are non-HttpOnly because the axios interceptor needs to read the refresh token client-side; moving to HttpOnly requires a Next.js Server Action / Route Handler to proxy the refresh — listed as a hardening item in the root README.

## What to add when you touch auth

- New trader endpoint that mutates state? **Add `KycVerifiedGuard`.**
- New admin endpoint? **Add `JwtAuthGuard, RolesGuard` + `@Roles(UserRole.ADMIN)`.** Easier: put it under `AdminController` which already class-decorates with both.
- New role? Update `UserRole` enum + migration on `users_role_enum` + wherever the enum value is hardcoded in tests.
- Changing token TTL? Update `JWT_EXPIRATION` / `JWT_REFRESH_EXPIRATION`. Also adjust the admin session cookie `max-age` in `admin/src/services/session.ts` so the cookie can't outlive the JWT.
- Want to test rate limiting? `docker exec -it mashia-redis redis-cli FLUSHDB` to clear all counters between attempts.
