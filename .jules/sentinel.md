
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2026-07-19 - Strict Rate Limiting on Auth Endpoints
**Vulnerability:** Sensitive authentication endpoints (`sendOtp`, `verifyOtp`, `register`, `login`, `adminLogin`, `adminTotpVerify`) were relying on permissive global rate limits (e.g., 100 requests per minute), leaving them vulnerable to credential stuffing, brute-forcing, and denial-of-service attacks.
**Learning:** In NestJS, when `ThrottlerGuard` is bound globally (e.g., via `APP_GUARD`), the `@Throttle` decorator can be used directly on feature controllers to override the global defaults. Applying `@UseGuards(ThrottlerGuard)` at the feature level is unnecessary and can cause dependency injection errors if `ThrottlerModule` isn't imported locally.
**Prevention:** Always apply strict route-level rate limiting using the `@Throttle` decorator (using the object syntax for v6+) to all sensitive endpoints that handle credentials or trigger external services (like SMS OTPs), overriding the permissive global limits.
