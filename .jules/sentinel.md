
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2026-06-25 - Missing Route-Level Rate Limiting on Sensitive Endpoints
**Vulnerability:** Even though the `ThrottlerGuard` is registered globally, strict route-level rate limiting was missing on sensitive authentication endpoints (OTP generation, OTP verification, registration, login, and admin login) in the `auth.controller.ts`. Without these limits, the application is highly susceptible to brute-force and credential-stuffing attacks.
**Learning:** Default global rate limiting (`limit: 100`) is often insufficient to secure endpoints prone to brute-forcing. More aggressive rate limits (e.g., 5 requests per minute) must be explicitly applied at the route level for login, registration, and OTP-related endpoints.
**Prevention:** Apply `@Throttle({ default: { limit: 5, ttl: 60000 } })` and ensure the `@UseGuards(ThrottlerGuard)` is present at the controller or route level for sensitive endpoints. Additionally, when testing these controllers, properly mock `ThrottlerGuard` with `.overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true })` to prevent DI resolution errors or test failures.
