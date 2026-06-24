
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2026-06-25 - Missing Strict Rate Limiting on Authentication Endpoints
**Vulnerability:** Sensitive authentication endpoints (login, register, OTP) lacked strict route-level rate limiting, relying instead on permissive global defaults (100 req/min). This allowed potential brute-force attacks on OTP codes, passwords, and TOTP verification endpoints due to high request limits.
**Learning:** Global rate limit configurations are often too permissive for authentication endpoints. Additionally, overriding them in NestJS Throttler v6+ requires specific object syntax (`@Throttle({ default: ... })`) and explicitly reapplying the `ThrottlerGuard` on the route.
**Prevention:** Always apply strict, route-level rate limits (e.g., 5 req/min) to authentication endpoints (login, register, OTP) using `@Throttle` and explicitly attach `ThrottlerGuard`, overriding any permissive global defaults.
