
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.
## 2026-02-08 - Added strict rate limiting to auth endpoints
**Vulnerability:** Authentication endpoints were lacking strict rate limiting, making them vulnerable to brute-force attacks and credential stuffing.
**Learning:** The global rate limiter is configured to allow 100 requests per minute, which is too permissive for sensitive routes like login and OTP verification. Applying route-specific limits using `@Throttle({ default: { limit: 5, ttl: 60000 } })` tightens security for these paths while leveraging the globally bound `ThrottlerGuard`.
**Prevention:** Always apply stricter rate limits to authentication and high-value endpoints to mitigate automated attacks, and ensure any global rate limits are evaluated for their suitability on sensitive routes.
