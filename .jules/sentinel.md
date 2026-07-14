
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2026-06-25 - Missing Route-Level Rate Limiting on Sensitive Auth Endpoints
**Vulnerability:** The application had a global ThrottlerGuard in `AppModule` with permissive limits (100 req/min), but lacked strict, route-level rate limiting on highly sensitive authentication endpoints (`/auth/login`, `/auth/register`, `/auth/otp/send`, `/auth/admin/login`). This exposed the API to brute-force and credential-stuffing attacks.
**Learning:** Global rate limits are often tuned for general API traffic and are insufficient for endpoints that handle authentication or sensitive actions. Overriding limits on specific routes using `@Throttle()` is necessary.
**Prevention:** Always apply strict route-level rate limits (e.g., `@Throttle({ default: { limit: 5, ttl: 60000 } })`) to authentication and authorization endpoints to provide defense in depth, even when a global throttler is active.
