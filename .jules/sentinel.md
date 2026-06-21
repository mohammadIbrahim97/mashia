## 2026-06-19 - Added Helmet and Rate Limiting
**Vulnerability:** Missing global rate limiting on APIs and missing secure HTTP headers.
**Learning:** In a NestJS application, basic defense-in-depth measures like `helmet` and `@nestjs/throttler` should be implemented globally to prevent brute-force attacks and configure secure HTTP headers.
**Prevention:** Ensure `ThrottlerModule` is imported and `ThrottlerGuard` is applied as an `APP_GUARD` globally, and `app.use(helmet())` is executed during application bootstrap.
## 2026-06-21 - [Prevent Sensitive Data Exposure in Auth Responses]
**Vulnerability:** Raw `User` entities containing `passwordHash` and `totpSecret` were being returned directly to the client in multiple endpoints (`/auth/login`, `/auth/register`, `/auth/admin/login`, and `/auth/admin/totp/verify`).
**Learning:** The NestJS `TransformInterceptor` doesn't automatically strip sensitive fields since `ClassSerializerInterceptor` is not globally configured. Explicit mapping using DTOs is mandatory for all user objects.
**Prevention:** Always map raw `User` objects using `ProfileResponseDto.fromUser()` or an equivalent safe DTO before sending them in HTTP responses. Test specs must assert the DTO type, not the raw entity.
