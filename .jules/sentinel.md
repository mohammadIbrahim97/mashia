## 2026-06-19 - Added Helmet and Rate Limiting
**Vulnerability:** Missing global rate limiting on APIs and missing secure HTTP headers.
**Learning:** In a NestJS application, basic defense-in-depth measures like `helmet` and `@nestjs/throttler` should be implemented globally to prevent brute-force attacks and configure secure HTTP headers.
**Prevention:** Ensure `ThrottlerModule` is imported and `ThrottlerGuard` is applied as an `APP_GUARD` globally, and `app.use(helmet())` is executed during application bootstrap.
## 2026-06-21 - Route-level Rate Limiting on Auth Endpoints
**Vulnerability:** Weak rate limiting on sensitive authentication routes (e.g., login, register, admin login), making them susceptible to brute-force and credential stuffing attacks. The global rate limiter (100 req/min) was too permissive for these critical endpoints.
**Learning:** In a NestJS application using `@nestjs/throttler` as a global guard, it's essential to apply stricter limits specifically on authentication routes using the `@Throttle` decorator to override the global defaults.
**Prevention:** Always identify sensitive authentication or OTP verification endpoints and explicitly decorate them with `@Throttle({ default: { limit: X, ttl: Y } })` where X is a low threshold (e.g., 5-10 requests per minute).
