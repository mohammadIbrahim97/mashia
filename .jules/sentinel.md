## 2026-06-19 - Added Helmet and Rate Limiting
**Vulnerability:** Missing global rate limiting on APIs and missing secure HTTP headers.
**Learning:** In a NestJS application, basic defense-in-depth measures like `helmet` and `@nestjs/throttler` should be implemented globally to prevent brute-force attacks and configure secure HTTP headers.
**Prevention:** Ensure `ThrottlerModule` is imported and `ThrottlerGuard` is applied as an `APP_GUARD` globally, and `app.use(helmet())` is executed during application bootstrap.
