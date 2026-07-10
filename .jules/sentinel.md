
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2024-07-10 - Missing Rate Limiting on Sensitive Auth Endpoints
**Vulnerability:** The application was missing strict rate limiting on sensitive authentication endpoints (`/auth/otp/send`, `/auth/login`, `/auth/register`, `/auth/admin/login`). The global throttler limit (100 requests / 60s) was too permissive for these endpoints, leaving them open to brute-force attacks and abuse.
**Learning:** In NestJS, global rate limits must be overridden with stricter limits on sensitive endpoints using the `@Throttle` decorator to prevent brute-forcing OTPs and passwords.
**Prevention:** Always apply `@Throttle` with strict limits (e.g., 5 requests per minute) on all authentication and registration endpoints, even if a global limit is in place.
