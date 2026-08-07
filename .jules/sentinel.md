
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-23 - Sensitive Data Leak in Auth Responses
**Vulnerability:** The `User` entity, which includes `passwordHash` and `totpSecret`, was being returned directly from auth controllers (`register`, `login`, `adminLogin`, `adminTotpVerify`), exposing sensitive fields to clients.
**Learning:** Returning raw TypeORM entities directly from controllers bypasses serialization, leaking internal database fields.
**Prevention:** Always use dedicated Data Transfer Objects (DTOs), like `ProfileResponseDto.fromUser(user)`, to map and sanitize entities before returning them in API responses.
## 2026-08-07 - Rate Limiting Decorators without Module Dependency Pollution
**Vulnerability:** Missing strict route-level rate limiting on sensitive authentication endpoints, making them vulnerable to brute-force attacks.
**Learning:** `ThrottlerGuard` is already globally registered in `src/app.module.ts`, so adding `@UseGuards(ThrottlerGuard)` is unnecessary and redundant. Further, avoid adding `ThrottlerModule` imports or guard boilerplate unnecessarily as it triggers automated code reviewer false positives, and never commit auto-generated `pnpm-lock.yaml` files created by running `pnpm install` during testing without `package.json` changes.
**Prevention:** Rely on the global `ThrottlerGuard` and only add `@Throttle` decorators. Always check `git status` to clean up unintended lockfile modifications after running setup commands.
