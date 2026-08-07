
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2026-08-07 - Missing Rate Limiting on Auth Endpoints
**Vulnerability:** The authentication and OTP endpoints (`/auth/login`, `/auth/otp/send`, etc.) were missing endpoint-specific rate limiting, relying only on the generous global limit of 100 requests per minute. This left the application vulnerable to brute-force and credential stuffing attacks on these sensitive endpoints.
**Learning:** Even with global rate limiting configured via `ThrottlerGuard` in `AppModule`, highly sensitive endpoints like login and OTP verification require much stricter, route-specific limits to prevent brute forcing.
**Prevention:** Always apply strict route-specific `@Throttle` decorators (e.g., limit of 5 per minute) to all authentication, OTP, and sensitive data mutation endpoints to complement broader global rate limits.
