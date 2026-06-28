
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2026-06-28 - Missing Strict Route-Level Rate Limiting on Authentication Endpoints
**Vulnerability:** While there might have been some global defaults, sensitive authentication endpoints like `login`, `register`, `otp`, and `adminLogin` were missing strict route-level rate limiting, leaving them susceptible to brute force attacks on OTP codes, credentials, and potential DoS vectors.
**Learning:** Overly permissive or missing route-level limits on endpoints that handle credentials or short-lived tokens like OTPs negate the benefits of application-wide generic rate limiting.
**Prevention:** Always enforce strict route-level rate limiting specifically customized for authentication controllers using decorators like `@Throttle({ default: { limit: 5, ttl: 60000 } })` and ensuring `@UseGuards(ThrottlerGuard)` is active.
