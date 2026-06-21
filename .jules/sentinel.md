## 2026-06-19 - Added Helmet and Rate Limiting
**Vulnerability:** Missing global rate limiting on APIs and missing secure HTTP headers.
**Learning:** In a NestJS application, basic defense-in-depth measures like `helmet` and `@nestjs/throttler` should be implemented globally to prevent brute-force attacks and configure secure HTTP headers.
**Prevention:** Ensure `ThrottlerModule` is imported and `ThrottlerGuard` is applied as an `APP_GUARD` globally, and `app.use(helmet())` is executed during application bootstrap.
## 2026-06-21 - [Stricter Rate Limiting on Authentication Endpoints]
**Vulnerability:** Weak rate limiting on sensitive authentication endpoints (e.g., login, register, OTP generation). The application relied only on a permissive global rate limit (100 req/min), leaving it vulnerable to brute-force attacks and OTP flooding.
**Learning:** In NestJS applications using `@nestjs/throttler` v6+, global rate limits are insufficient for sensitive routes. Specific route-level throttling using the `@Throttle` decorator must be applied. Note that Throttler v6+ requires an object syntax for overrides (e.g., `@Throttle({ default: { limit: 5, ttl: 60000 } })`).
**Prevention:** Always apply strict route-level `@Throttle` decorators (e.g., 5 requests per minute) to all endpoints handling authentication, OTP generation, or password resets to mitigate brute-force and credential stuffing attacks.
