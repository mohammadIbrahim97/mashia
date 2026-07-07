
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2026-07-07 - Rate Limiting on Authentication Endpoints
**Vulnerability:** The application was missing strict route-level rate limiting on sensitive authentication and OTP/TOTP verification endpoints (e.g., login, register, verifyOtp, adminTotpVerify). The global rate limiter (100 req/min) was too permissive for these critical routes, allowing brute-force and credential stuffing attacks on passwords and 6-digit codes.
**Learning:** Default global rate limiting is insufficient for sensitive endpoints. 6-digit verification codes are particularly vulnerable to brute-force attacks if not strictly limited.
**Prevention:** Ensure strict route-level rate limiting is applied (using `@Throttle` and `ThrottlerGuard`) to all endpoints that handle authentication, password validation, or code verification.
