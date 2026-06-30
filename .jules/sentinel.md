
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2026-06-30 - NestJS Throttler Configuration
**Vulnerability:** Missing rate limiting on authentication endpoints allowed potential brute forcing.
**Learning:** In NestJS, `@UseGuards(ThrottlerGuard)` requires the module to be initialized globally with `ThrottlerModule.forRoot(...)`. When writing isolated controller tests with `Test.createTestingModule(...)`, you MUST provide BOTH the `ThrottlerStorage` and `getOptionsToken()` tokens (imported from `@nestjs/throttler`) as providers if the guard is applied directly to the controller, because isolated tests don't load the `AppModule` context.
**Prevention:** Always verify NestJS dependency injection requirements when applying global modules/guards at the controller level, especially in isolated unit tests.
