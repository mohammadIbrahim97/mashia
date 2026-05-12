# 16 — Glossary

Short definitions of the domain and tech terms you'll see in this codebase. Skim it once on day one; come back when a name in code or in a PR description doesn't ring a bell.

## Domain terms

**Awassi, Najdi, Arabi, Shami** — Sheep breeds. The `Breed` enum (`backend/src/shared/enums/index.ts`) restricts listings to these four plus `other`. Common in the GCC and Levantine markets.

**Broker** — A `UserRole` that can mediate orders. Modelled in `orders.broker_id` but not yet wired into the order-creation UI. Can upload certificates.

**Buyer** — A `UserRole`. Places orders against listings. Initiates and releases escrow payments.

**Certificate** — A vaccination, health, or origin document attached to a listing. Reviewed by an admin. When verified, flips the listing's `health_status` to `certified`.

**Commission** — The platform's cut of an order. Defaults to **5%** of `total_price`. Stored on the order so subsequent rate changes don't retroactively rewrite history.

**Counterparty** — Whichever side of an order isn't the caller. The mobile app computes it server-side via `OrderListItemResponse.fromOrder(order, userId)` so the same screen looks different to buyer vs seller without if-statements.

**Develop branch** — The integration branch. CI runs on every push to `develop` when `backend/**`, `mobile/**`, or `admin/**` changes. PRs target `develop`.

**Dispute** — A state the order enters when either buyer or seller flags a problem. From `DISPUTED`, the only forward path is a refund (admin-only), which sends the order to `CANCELLED`.

**Escrow** — Holding the buyer's money in a third-party account until the buyer confirms delivery. Today implemented as a stub (`EscrowService`); will be replaced with a real payment-gateway integration post-beta.

**GCC** — Gulf Cooperation Council (Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman). Mashia's target demand-side market.

**Held / Released / Refunded** — The three values of `payment.escrow_status`. A new payment is `HELD` immediately; transitions to `RELEASED` (seller gets paid) or `REFUNDED` (buyer gets money back) are terminal.

**KYC** — "Know Your Customer". Identity verification. Required documents differ by role: buyers need a national ID; sellers/brokers need national ID + selfie + optional business license. Status enum: `pending | verified | rejected`.

**Listing** — A seller's sale advert (title, breed, quantity, price, images, optional certificate). Status enum: `active | sold | expired | flagged`.

**Mashia** — The platform name. "Mashia" (ماشية) is the Arabic word for livestock.

**Mobile app** — The React Native client used by traders (buyer/seller/broker). Lives in `mobile/`. Does not include the admin dashboard.

**Order** — The buyer's commitment to purchase against a listing. Status machine: `pending → accepted → paid → in_transit → delivered → completed`, with side branches `cancelled` and `disputed`. See [chapter 08](08-orders-payments-escrow.md).

**OTP** — One-time password. 6 digits, 5-minute TTL, max 5 sends per phone per hour. Stored in Redis under `otp:code:<phone>`.

**Party** — A user attached to an order (buyer, seller, or broker). Authorisation in order/payment endpoints asks "is the caller a party?" rather than "is the caller the owner?".

**SAR / AED / SYP / USD** — Currencies supported by listings (`Currency` enum). One enum, three identical Postgres clones (one per table — `listings`, `orders`, `payments`).

**Seller** — A `UserRole`. Creates listings, uploads certificates, accepts orders, marks shipments in transit.

**STC Pay / Mada / Bank Transfer** — Payment methods (`PaymentMethod` enum). STC Pay is a wallet; Mada is the Saudi national card scheme; Bank Transfer is the MVP fallback that admins reconcile manually.

**Suspended** — A user flag (`users.suspended`). When true, `JwtStrategy.validate` rejects every request with `401 Account suspended`. Admin toggles via `PATCH /admin/users/:id/{suspend,unsuspend}`.

**Syrian sheep market** — The supply side that Mashia primarily serves. Many listings have `origin_country = SY`.

**TOTP** — Time-based one-time password (RFC 6238). Admin's optional second factor. 30-second window. Library: `otplib`.

**Trader** — Convenient umbrella term for buyer, seller, and broker (i.e. any non-admin). They share one auth flow (phone + OTP).

## Tech terms / project jargon

**`@CurrentUser()`** — Decorator (`backend/src/shared/decorators/current-user.decorator.ts`) that extracts the authenticated `User` from `req.user`.

**`@Roles(...)`** — Decorator that marks an endpoint as restricted to specific `UserRole`s. Paired with `RolesGuard`.

**Adapter (Socket.io)** — Mechanism by which a Socket.io broadcast reaches sockets connected to a different server replica. Not configured today; if you scale beyond one backend pod, add `@socket.io/redis-adapter`.

**App Router (Next.js)** — The `app/` directory style introduced in Next.js 13. The admin dashboard uses it.

**Auto-release** — The cron-based fallback that flips a held payment to released 7 days after the order is marked `DELIVERED`. Runs every 15 minutes (`@Cron('0 */15 * * * *')`).

**Bearer token** — The HTTP scheme used to send JWTs. `Authorization: Bearer <accessToken>`.

**bcrypt** — Hash function used for admin passwords. 12 rounds.

**Class-validator** — The decorator-based validation library used on DTOs. Combined with NestJS's `ValidationPipe` it rejects extra/missing fields.

**E.164** — International phone number format with leading `+`. Regex used in the OTP DTO: `/^\+[1-9]\d{1,14}$/`.

**Event emitter** — NestJS's in-process pub/sub (`@nestjs/event-emitter`). Used for cross-module signals (`payment.held` → order transition).

**Guard** — A NestJS interceptor that decides whether a request may proceed. Mashia uses `JwtAuthGuard`, `RolesGuard`, and `KycVerifiedGuard`.

**HttpOnly** — Cookie attribute that hides a cookie from JavaScript. The admin session cookies are *not* HttpOnly today (so the axios interceptor can read them for refresh).

**jti** — JWT ID. A random UUID embedded in every refresh token, used as the Redis key for the rotation blacklist (`rt_blacklist:<jti>`).

**Keychain** — iOS's encrypted credential store. On Android the same library uses Keystore. Used by the mobile app via `react-native-keychain`.

**KycVerifiedGuard** — Guard that throws `403 KYC verification required` if `user.kycStatus !== VERIFIED`. Applied to every state-changing trader endpoint.

**LocalStack** — Local AWS emulator. Used in `docker-compose.yml` to stand in for S3.

**me-south-1** — AWS region for Bahrain. The target production region.

**Middleware (Next.js)** — Code that runs before every matched request. `admin/src/middleware.ts` does the route-guard redirect.

**Migrations** — TypeORM SQL files under `backend/db/migrations/`. Run with `npm run migration:run`. Never edit a migration that's been applied to a shared DB.

**Modular monolith** — One process, many internal modules with clear boundaries. The backend's chosen shape.

**OTP** — see above (domain term).

**Pino** — The structured logger (`nestjs-pino`). Outputs JSON in production, pretty-printed in dev.

**Presigned URL** — A short-lived S3 URL with a signature embedded. Lets the mobile client upload directly to S3 without proxying through the API.

**Refresh-on-401** — Pattern where the axios response interceptor catches `401`, refreshes the token, and retries the request. Implemented in `admin/src/services/api.ts`; mobile client can adopt the same.

**Refresh token rotation** — Each call to `/auth/refresh` blacklists the old token's `jti` and issues a new pair. Re-using a refresh token after rotation triggers `401 Refresh token already used`.

**`req.user`** — The user entity attached to the request by `JwtStrategy.validate`. Available in any controller method after `JwtAuthGuard`.

**`skip_locked`** — Postgres clause that makes a `SELECT ... FOR UPDATE` query skip rows already locked by another transaction. Used in the auto-release cron so concurrent workers don't fight.

**Soft delete** — Logical deletion via a `deleted_at` timestamp instead of `DELETE FROM`. TypeORM filters them out by default. Only the `listings` table uses it currently.

**Stale token** — A refresh token still in the client's storage after rotation. Triggers `401 Refresh token already used`. The client wipes the storage and bounces to login.

**Ticket (admin TOTP)** — A short-lived (5 min) Redis key issued after admin password verifies. Required to complete the TOTP step. Format: `admin_totp_ticket:<uuid>`.

**TransformInterceptor** — Wraps every response in `{ success: true, data: <payload> }`. Clients use `unwrap()` to peel.

**TypeORM** — The ORM used by the backend. PostgreSQL-only here.

**Zustand** — Tiny state library used by the mobile app. One store per domain (auth, listings, orders, messaging).

## Conventions you should know

- File names are kebab-cased (`order-detail.response.ts`); class names PascalCased; functions camelCased.
- Modules under `backend/src/modules/<name>/` always have at minimum: `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `<name>.entity.ts` (if it owns one), and `dto/` subfolder.
- Tests live next to the file under test, suffixed `.spec.ts`.
- Migrations are named `<timestamp>-<PascalCaseDescription>.ts` (e.g. `1777700000000-AdminAuth.ts`).
- Mobile screens are named `<Purpose>Screen.tsx` with the file under `screens/<feature>/`.
- Admin pages live under `admin/src/app/(admin)/<segment>/page.tsx` for the auth-protected group.
- Issue references in commits or PRs: `#<num>` (e.g. `#266`). User-story IDs: `G<goal>-US<num>` (e.g. `G3-US05`).
