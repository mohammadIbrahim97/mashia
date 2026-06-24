
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2026-06-24 - Rate Limiting Decorators Require Guard Configuration
**Vulnerability:** The application was missing functional route-level rate limiting on sensitive auth endpoints. Just adding the `@Throttle` metadata decorator without combining it with `@UseGuards(ThrottlerGuard)` leaves the endpoints completely unprotected.
**Learning:** In NestJS, `@Throttle` is purely metadata. The `ThrottlerGuard` is the active component that intercepts requests and enforces the limits defined by the metadata.
**Prevention:** Ensure any rate limit decorators are properly accompanied by the appropriate guards (e.g. `ThrottlerGuard`) either globally or locally on the controller.
