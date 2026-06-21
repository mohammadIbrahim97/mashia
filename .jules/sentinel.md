
## 2026-06-19 - Missing Security Headers & Rate Limiting
**Vulnerability:** The application was missing global security headers (`helmet`) and global rate limiting to mitigate common attack vectors and DoS attempts. (We only addressed `helmet` in this PR to keep it small, but rate limiting remains an issue).
**Learning:** Default express/nestjs setup leaves the app open to missing HTTP security headers. The app also heavily relies on OTP rate limiting (Redis) but doesn't have general HTTP endpoint throttling.
**Prevention:** Ensure `helmet` and `@nestjs/throttler` (or equivalent) are part of the boilerplate backend template to prevent shipping APIs without basic protection.

## 2026-06-21 - Prevent Sensitive Data Leak in Auth Controller
**Vulnerability:** The AuthController was directly returning raw `User` entities in responses, which inadvertently exposed sensitive internal fields such as `passwordHash` and `totpSecret` to clients.
**Learning:** The project does not use global serialization interceptors (like `ClassSerializerInterceptor`). As a result, endpoints returning database entities must explicitly map the entities to DTOs before responding.
**Prevention:** Always wrap returned entity objects in response DTOs (e.g., `ProfileResponseDto.fromUser(user)`) in controllers to strictly control what is exposed to the client.
