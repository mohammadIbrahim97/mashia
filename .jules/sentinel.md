
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.
## 2026-08-05 - Rate Limiting Admin Endpoints
**Vulnerability:** The admin authentication endpoints (`adminLogin`, `adminTotpVerify`) did not have strict rate limits applied, making them susceptible to brute-force credential stuffing attacks.
**Learning:** The `@nestjs/throttler` package is installed but requires the `@Throttle()` decorator to be explicitly applied to sensitive routes when the `ThrottlerGuard` is bound globally.
**Prevention:** Ensure high-value authentication endpoints always have explicit rate limiting (e.g. `@Throttle({ default: { limit: 5, ttl: 60000 } })`) applied, particularly for admin interfaces.
