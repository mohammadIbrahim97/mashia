
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2026-07-31 - Missing Rate Limiting on Login Endpoints
**Vulnerability:** The `/login` and `/admin/login` authentication endpoints were missing endpoint-specific rate limits, allowing potential brute force and credential stuffing attacks against user accounts.
**Learning:** Even if `ThrottlerGuard` is bound globally (with generous overall app limits), critical authentication routes require stricter, explicit limits (e.g., 5 requests per minute) via `@Throttle()` to prevent abuse.
**Prevention:** Always apply strict, specific `@Throttle()` decorators to all authentication and OTP verification endpoints by default when creating new modules.
