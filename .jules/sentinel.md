
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.
## 2026-07-07 - Missing Rate Limiting on Authentication Endpoints
**Vulnerability:** The application was missing strict rate limiting on authentication endpoints, leaving it vulnerable to brute force and credential stuffing attacks.
**Learning:** Even though `ThrottlerGuard` is globally registered, strict route-level limits (`@Throttle`) are necessary for highly sensitive endpoints like login and registration. Furthermore, applying `ThrottlerGuard` at the controller level without registering `ThrottlerModule` in the specific feature module leads to Dependency Injection errors during application bootstrapping. Wait, the `ThrottlerModule` is actually registered in `AppModule` globally... Oh, `ThrottlerModule.forRoot` is in `AppModule`. When `@UseGuards(ThrottlerGuard)` is used in `AuthController`, NestJS expects `ThrottlerGuard` to be resolvable. If `ThrottlerModule.forRoot()` is not `@Global()` and `ThrottlerModule` is not imported in `AuthModule`, DI might fail. However, `APP_GUARD` makes it global anyway.
**Prevention:** Apply `@Throttle` directly on authentication endpoints. Avoid redefining `@UseGuards(ThrottlerGuard)` if it's already bound globally via `APP_GUARD`, or explicitly ensure `ThrottlerModule` is available.
