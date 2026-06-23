## 2026-06-19 - Added Helmet and Rate Limiting
**Vulnerability:** Missing global rate limiting on APIs and missing secure HTTP headers.
**Learning:** In a NestJS application, basic defense-in-depth measures like `helmet` and `@nestjs/throttler` should be implemented globally to prevent brute-force attacks and configure secure HTTP headers.
**Prevention:** Ensure `ThrottlerModule` is imported and `ThrottlerGuard` is applied as an `APP_GUARD` globally, and `app.use(helmet())` is executed during application bootstrap.
## 2024-05-18 - Missing Granular Rate Limits on Authentication Endpoints
**Vulnerability:** The application configured `@nestjs/throttler` with a permissive default global rate limit (100 req/min). Sensitive authentication endpoints (`/auth/otp/send`, `/auth/login`, `/auth/admin/login`) relied solely on this global limit, making them susceptible to brute-force attacks and credential stuffing despite some service-layer protections.
**Learning:** Default global rate limiting in `@nestjs/throttler` does not provide sufficient protection for sensitive authentication routes when set to accommodate typical API traffic.
**Prevention:** Apply explicit, granular `@Throttle({ default: { limit: X, ttl: Y } })` limits directly on all authentication-related controller endpoints to ensure stricter thresholds are enforced regardless of the global configuration.
