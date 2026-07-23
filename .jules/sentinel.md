## 2026-07-23 - Add Specific Rate Limits to Auth Controller
**Vulnerability:** Global rate limits (100 req/min) were too permissive for sensitive authentication endpoints (login, register, OTP), leaving the application vulnerable to brute-force and credential stuffing attacks.
**Learning:** Default rate limiting settings applied globally often fail to provide adequate protection for endpoints dealing with authentication and authorization. It is necessary to explicitly override these globals with much stricter limits on sensitive routes.
**Prevention:** Always identify authentication-related endpoints and apply custom, strict rate limit decorators (e.g., `@Throttle({ default: { limit: 5, ttl: 60000 } })`) to prevent automated abuse.
