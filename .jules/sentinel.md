
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2023-11-20 - Sensitive Data Leak in Auth Controllers
**Vulnerability:** The application was returning raw TypeORM `User` entities from auth endpoints (`register`, `login`, `adminLogin`, `adminTotpVerify`), which exposed sensitive internal data like `passwordHash` and `totpSecret` to clients.
**Learning:** The project does not use a global `ClassSerializerInterceptor` or TypeORM `@Exclude()` decorators to filter sensitive data automatically. Entities returned by services are raw database objects.
**Prevention:** Always manually serialize user data using `ProfileResponseDto.fromUser(user)` in controllers before returning it in HTTP responses to avoid leaking credentials.
