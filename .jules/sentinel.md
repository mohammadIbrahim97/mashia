
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.
## 2026-06-25 - Rate Limiting on Authentication Endpoints
**Vulnerability:** Authentication endpoints like login and OTP verification lacked specific rate limiting, making them susceptible to brute force attacks despite global application rate limiting.
**Learning:** `ThrottlerGuard` is bound globally, but you need to specifically apply tighter limits to sensitive auth endpoints using the `@Throttle({ default: { limit: 5, ttl: 60000 } })` decorator directly in the controller to provide defense in depth.
**Prevention:** Apply stricter `@Throttle` decorators to authentication and other sensitive endpoints when writing new controllers, rather than solely relying on global limits.
