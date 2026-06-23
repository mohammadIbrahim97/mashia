
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Rate Limiting on Authentication Endpoints
**Vulnerability:** The application had globally configured rate limiting but lacked strict, route-level rate limiting on highly sensitive authentication endpoints (`login`, `register`, `otp/send`, etc.), leaving it susceptible to brute-force, credential stuffing, and OTP spamming attacks.
**Learning:** Default global rate limiting limits may be too permissive for sensitive endpoints. NestJS Throttler v6+ requires the object syntax (`@Throttle({ default: { limit: X, ttl: Y } })`) for route-level overrides.
**Prevention:** Always apply strict `@Throttle` limits directly to authentication and authorization controller methods, and ensure a global or controller-level `ThrottlerGuard` is active to enforce them.
