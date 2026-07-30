
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.
## 2026-07-30 - Add Rate Limiting to Admin Login endpoint
**Vulnerability:** The `/auth/admin/login` endpoint lacked explicit rate limiting, leaving it vulnerable to brute-force attacks against high-value admin accounts.
**Learning:** `ThrottlerGuard` is bound globally in `src/app.module.ts`. Using the `@Throttle()` decorator on a controller route is sufficient to enforce rate limiting without explicitly adding `@UseGuards(ThrottlerGuard)`.
**Prevention:** Ensure all sensitive authentication endpoints (especially admin logins) have strict rate limiting explicitly configured.
