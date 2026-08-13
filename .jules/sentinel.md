
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2026-08-13 - Missing Route-Specific Rate Limiting
**Vulnerability:** Authentication and OTP endpoints were relying solely on global rate limits (`ThrottlerGuard` in `app.module.ts` set to 100 req/min), which is too permissive for sensitive routes, leaving the application vulnerable to brute-force attacks and OTP spamming.
**Learning:** Default global rate limiting is insufficient for sensitive endpoints. High-value routes like login, registration, and OTP verification require strict, custom limits.
**Prevention:** Always apply stricter route-specific rate limits using `@Throttle({ default: { limit: <number>, ttl: <milliseconds> } })` to authentication endpoints to mitigate brute-force attacks.
