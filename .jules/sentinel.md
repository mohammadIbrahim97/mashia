
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.
## 2026-08-15 - Missing rate limiting on sensitive authentication endpoints
**Vulnerability:** The NestJS backend application had globally registered the `ThrottlerGuard` but did not have route-specific `@Throttle()` decorators applied to sensitive authentication routes (`sendOtp`, `verifyOtp`, `register`, `login`, `adminLogin`, `adminTotpVerify`) in the `AuthController`. This left these critical endpoints vulnerable to brute-force attacks and credential stuffing, as the global rate limit might be too permissive or easily exhausted by an attacker targeting these specific routes without penalizing other parts of the system as effectively.
**Learning:** Developers might assume that registering `ThrottlerGuard` globally provides sufficient protection for all routes. However, authentication endpoints require significantly stricter rate limits (e.g., 5 requests per minute) compared to general API endpoints (e.g., 100 requests per minute) to effectively thwart automated attacks.
**Prevention:** Always apply stricter, route-specific `@Throttle({ default: { limit: <number>, ttl: <milliseconds> } })` decorators to all sensitive endpoints, particularly those handling authentication, registration, password resets, and OTP verification, overriding the global defaults.
