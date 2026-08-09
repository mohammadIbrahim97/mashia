
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2026-08-09 - Missing Rate Limiting on Authentication Endpoints
**Vulnerability:** Sensitive authentication endpoints (`otp/send`, `login`, `register`, `admin/login`) were lacking explicit rate limiting, despite `ThrottlerGuard` being bound globally in `app.module.ts`. This left the application vulnerable to brute-force attacks, credential stuffing, and OTP flooding (which could incur SMS costs and cause denial of service).
**Learning:** While `ThrottlerModule` was configured with a default limit (e.g. 100 requests per 60000ms), sensitive endpoints require much stricter limits to be effective. The `@Throttle` decorator must be explicitly applied to override the defaults for these routes.
**Prevention:** Always apply strict, specific rate limits using `@Throttle` to authentication, authorization, and OTP endpoints, rather than relying solely on the application's global default rate limits.
