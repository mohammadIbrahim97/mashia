
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.

## 2026-07-04 - Rate Limiting on Authentication Endpoints
**Vulnerability:** The application was missing route-level rate limits on sensitive authentication endpoints (`/otp/send`, `/login`, `/register`, etc.), making them vulnerable to brute-force attacks and credential stuffing.
**Learning:** Default `@nestjs/throttler` configurations in `AppModule` are often too permissive for authentication endpoints. Additionally, if the app is behind a reverse proxy, `ThrottlerGuard` relies on the proxy's IP address, which could result in a global denial of service (DoS) if not correctly configured.
**Prevention:** Apply strict `@Throttle` limits on all authentication endpoints and ensure the NestJS app is configured to correctly trust the reverse proxy (e.g., `app.set('trust proxy', 1)`) so that throttling acts on individual client IPs instead of the proxy IP.
