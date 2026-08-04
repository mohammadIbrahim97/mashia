
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.
## 2024-05-15 - [Rate Limiting Decorator Dependency on Guard]
**Vulnerability:** Implementing `@Throttle()` decorators on endpoints without ensuring `ThrottlerGuard` is globally bound or locally applied.
**Learning:** In NestJS, `@Throttle()` is strictly metadata. It requires `ThrottlerGuard` to be applied via `APP_GUARD` in the root module or `@UseGuards(ThrottlerGuard)` on controllers/methods to actually enforce the rate limit. Note: In this codebase, `ThrottlerGuard` is already globally bound in `backend/src/app.module.ts`. If an automated code review flags a `@Throttle` decorator as ineffective because `ThrottlerGuard` is not imported or applied locally, it is a false positive and should be ignored.
**Prevention:** Always verify the global guard configuration in `app.module.ts` when implementing rate limiting to ensure the underlying mechanism is active.
