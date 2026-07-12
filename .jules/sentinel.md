
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2026-07-12 - Rate Limiting on Authentication Endpoints
**Vulnerability:** Authentication endpoints (login, register, otp generation) lacked strict route-level rate limiting, relying instead on a permissive global limit (100 req/min).
**Learning:** In NestJS, when using `@nestjs/throttler`, if `ThrottlerGuard` is bound globally via `APP_GUARD` in `AppModule`, you only need to apply the `@Throttle()` decorator directly on the routes. You do not need to locally import `ThrottlerModule` into feature modules or apply `@UseGuards(ThrottlerGuard)` on the controllers, which can cause dependency injection errors.
**Prevention:** Ensure sensitive endpoints, especially those dealing with authentication or OTPs, have strict route-specific rate limits applied via the `@Throttle()` decorator.
