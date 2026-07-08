
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.
## 2026-07-08 - Rate Limiting via Global APP_GUARD
**Vulnerability:** Missing rate limiting on sensitive authentication endpoints.
**Learning:** In NestJS, when a ThrottlerGuard is already provided globally in AppModule via APP_GUARD, applying it again at the feature controller level via @UseGuards(ThrottlerGuard) causes dependency injection errors if ThrottlerModule isn't explicitly imported into the feature module. The global guard will automatically pick up route-level @Throttle metadata.
**Prevention:** Rely on the global APP_GUARD configuration in AppModule and only apply @Throttle metadata decorators directly to the required feature endpoints, avoiding manual guard instantiation in feature controllers.
