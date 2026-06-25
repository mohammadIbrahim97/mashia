
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2026-06-25 - Missing strict Rate Limiting on Sensitive Auth Endpoints
**Vulnerability:** The application was missing strict rate limiting on sensitive authentication endpoints (`/auth/login`, `/auth/register`, `/auth/admin/login`, `/auth/admin/totp/verify`). The global rate limiting configuration was too permissive (`ttl: 60000, limit: 100`), which left these endpoints vulnerable to brute force and credential stuffing attacks.
**Learning:** Default global rate limiting limits can be too permissive for sensitive routes. We need to explicitly override them to enforce tighter limits.
**Prevention:** Apply route-level overrides using `@Throttle` and explicitly attach `ThrottlerGuard` using `@UseGuards(ThrottlerGuard)` for endpoints handling sensitive operations, such as authentication and authorization.
