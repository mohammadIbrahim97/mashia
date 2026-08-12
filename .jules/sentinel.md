
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.
## 2023-10-27 - [Add route-specific rate limiting to sensitive authentication endpoints]
**Vulnerability:** Missing strict route-specific rate limits on sensitive authentication endpoints (e.g., login, register, OTP), leaving them susceptible to brute-force attacks and credential stuffing, as the global rate limit (100 reqs/min) was too permissive.
**Learning:** In NestJS applications using `@nestjs/throttler`, global rate limits are often insufficient for high-risk endpoints. It is crucial to apply stricter rate limits at the route level using the `@Throttle()` decorator.
**Prevention:** Always evaluate the sensitivity of individual endpoints, especially those related to authentication and authorization, and apply appropriate route-specific rate limiting configurations using `@Throttle()` or custom guards.
