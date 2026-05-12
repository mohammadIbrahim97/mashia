# 02 — Architecture

## High-level picture

```
+--------------------+      +---------------------+
|   React Native     |      |   Next.js 14        |
|   mobile (traders) |      |   admin dashboard   |
+--------------------+      +---------------------+
       |  HTTP + Bearer JWT       |  HTTP + Bearer JWT
       |  Socket.io /chat         |
       v                          v
+--------------------------------------------+
|         NestJS 10 — modular monolith       |
|  AuthZ/AuthN guards · TransformInterceptor |
|  9 feature modules + shared infrastructure |
+--------------------------------------------+
       |                |             |
       v                v             v
   PostgreSQL 16     Redis 7         S3 (me-south-1)
   (TypeORM)        (ioredis)        — KYC docs
                    OTP store        — listing images
                    Refresh BL       — certificates
                    Admin tickets    — chat images
```

There is one HTTP backend, one database, one cache. All real-time messaging goes through the same NestJS process via a Socket.io gateway. **There is no separate microservice for any module.**

## Why a modular monolith

Three reasons:

1. **One-team velocity.** A small team can change a buyer flow that spans listings + orders + payments + notifications in a single PR, without coordinating deploys.
2. **Cross-domain transactions.** Orders write to `orders` and emit events that trigger payment auto-release scheduling. Doing this across services would force eventual consistency we don't need yet.
3. **One DB simplifies the escrow invariant.** `payments.order_id` has a unique constraint enforced by Postgres — there is exactly one payment per order, and the database guarantees it. Splitting payments into its own service would force us to re-implement that invariant.

When the platform outgrows one box, the natural split is: extract `messaging` (Socket.io is stateful and noisy), and put `payments` behind a real gateway integration. The current module boundaries already correspond to those future services.

## Modules and what they own

Located under `backend/src/modules/`:

| Module | Owns | Notable cross-module pull |
|---|---|---|
| `auth` | OTP, JWT, admin login, TOTP. | Depends on `users` (`UsersModule` is imported). |
| `users` | The `users` table, profile read/write, KYC review (admin-side). | Used by `auth`, `admin`. |
| `kyc` | KYC document upload (multipart), status query. | Calls `S3Service`, calls `UsersService.updateKycDocuments`. |
| `uploads` | Generic presigned-URL endpoint for trader-side image uploads. | Wraps `S3Service`. |
| `listings` | CRUD for `listings`. | Read by `orders`, `certificates`. |
| `orders` | The order state machine. | Reads `listings`, emits `OrderCreated/Delivered` events, listens to `PaymentHeld/Released/Refunded`. |
| `payments` | Escrow records; integrates with the stubbed `EscrowService`. | Reads `orders`, emits `PaymentHeld/Released/Refunded`, listens to `OrderDelivered`. |
| `certificates` | Vet certificates, sync into `listings.health_status`. | Reads + writes `listings`. |
| `messaging` | `conversations`, `messages`, the Socket.io gateway. | None — fully self-contained. |
| `admin` | Admin-only views over the other modules. | Imports `CertificatesService`, `UsersService` (read-only / write helpers). |

The boundaries are enforced by **constructor injection** only — there are no facades or gateways between modules, but a module never queries another module's tables directly. If you find yourself wanting to `@InjectRepository(SomeOtherDomainEntity)` outside of its owner, stop and add a service method instead.

## Shared infrastructure (`backend/src/shared/`)

| Folder | Contents |
|---|---|
| `guards/` | `JwtAuthGuard` (Passport JWT), `RolesGuard` (RBAC), `KycVerifiedGuard` (blocks non-KYC users from mutating routes). |
| `decorators/` | `@CurrentUser()` to grab the authenticated `User`, `@Roles(UserRole.SELLER, …)` to mark routes. |
| `interceptors/` | `TransformInterceptor` wraps every controller return value in `{ success: true, data: ... }`. All clients call `unwrap()` (see `mobile/src/services/api.ts` and `admin/src/services/api.ts`). |
| `enums/` | The canonical TypeScript enums shared across modules. Mirrored by Postgres `ENUM` types — touching either side requires a migration. |
| `events/` | Strongly-typed event classes (`OrderCreatedEvent`, `PaymentHeldEvent`, …) with a "listeners must try/catch and never throw" contract written in the JSDoc. |
| `redis/` | Single Redis client provider, injected as `@Inject(REDIS_CLIENT)`. |
| `s3/` | AWS SDK v3 wrapper: `upload`, `getSignedUploadUrl`, `getSignedReadUrl`, `delete`. |
| `sms/` | `SmsService` interface + `ConsoleSmsService` dev implementation (logs `[SMS] OTP for <phone>: <code>`). |
| `sentry/` | Sentry initialisation and an exception filter for unhandled errors. |

## Request anatomy

```
HTTP request
    |
    v
TransformInterceptor.intercept(...)        ← wraps response
    |
    v
ValidationPipe                              ← whitelist + class-validator on DTOs
    |
    v
@UseGuards(JwtAuthGuard, RolesGuard, KycVerifiedGuard?)
    |        |          |
    |        |          └─ user.kycStatus must be VERIFIED to pass
    |        └─ user.role must be in @Roles(...) list
    └─ extracts Bearer token, validates JWT, hydrates req.user
    |
    v
Controller method (DTO already validated, user already attached)
    |
    v
Service method (business logic)
    |
    v
Repository (TypeORM)  → PostgreSQL
            |
            └→ EventEmitter2.emit(...)      ← cross-module signal
                       |
                       v
                  @OnEvent listeners run synchronously inside the same
                  request; their failure is logged but never thrown.
```

The combination `ValidationPipe + DTO + class-validator` means that by the time you're inside a controller method, you can trust the shape and types of the input. There's no place to add ad-hoc parsing inside services.

## Event-driven internal contracts

Cross-module behaviour is wired through `@nestjs/event-emitter`:

| Event | Emitter | Listener(s) | Effect |
|---|---|---|---|
| `order.created` | `OrdersService.create` | _(none yet — reserved for future notifications)_ | — |
| `order.delivered` | `OrdersService.updateStatus(DELIVERED)` | `OrderDeliveredListener` (in `payments`) | Sets `payment.autoReleaseAt = now + 7 days` |
| `payment.held` | `PaymentsService.initiate` | `PaymentStatusListener` (in `orders`) | Transitions order `ACCEPTED → PAID` |
| `payment.released` | `PaymentsService.release` / cron | `PaymentStatusListener` | Transitions order `DELIVERED → COMPLETED` |
| `payment.refunded` | `PaymentsService.refund` (admin) | `PaymentStatusListener` | Transitions order `DISPUTED → CANCELLED` |

**Listener contract** (documented in each event file): handlers MUST try/catch internally, log via `Logger`, and never throw. The emitter does *not* catch listener errors — a thrown listener crashes the request that triggered the emit, even though the originating DB write already committed. This is enforced socially, not by the framework.

If you add a listener: copy the structure in `backend/src/modules/orders/payment-status.listener.ts`.

## Why "internal" state transitions exist

Look at `OrdersService.transitionFromPayment()`. It bypasses the user-authorisation check in `updateStatus()` because it runs on behalf of the system, not an authenticated user. Only three transitions are allowed:

| From | To | Trigger |
|---|---|---|
| `ACCEPTED` | `PAID` | `payment.held` |
| `DELIVERED` | `COMPLETED` | `payment.released` |
| `DISPUTED` | `CANCELLED` | `payment.refunded` |

Any other transition through this internal door throws `BadRequestException`. This is deliberate — we want listeners to be a narrow, audited surface.

## Authentication summary

There are two completely separate auth flows, sharing the same JWT tokens at the end:

| | Trader (buyer / seller / broker) | Admin |
|---|---|---|
| First factor | Phone number + 6-digit OTP (Redis-backed, 5 min TTL) | Email + bcrypt password (12 rounds, 12-char minimum) |
| Second factor | none | Optional TOTP (RFC 6238, 30-second window) |
| Registration | `POST /auth/register` (public) | Out-of-band via `scripts/create-admin.js` — `/auth/register` blocks `role=admin` |
| Access token | 15 min (configurable) | Same |
| Refresh token | 7 days, with **jti blacklist in Redis** to prevent reuse | Same |
| KYC required for write ops | Yes (`KycVerifiedGuard`) | No (admin is exempt) |

Details in [03 — Authentication](03-authentication.md).

## Response envelope

`TransformInterceptor` wraps everything:

```jsonc
// GET /api/v1/listings/abc-123
{
  "success": true,
  "data": {
    "id": "abc-123",
    "title": "Awassi sheep — Damascus farm",
    /* … */
  }
}
```

On the client side both `mobile/src/services/api.ts` and `admin/src/services/api.ts` expose an `unwrap(res)` helper that peels the layer. Always use it; never reach into `res.data.data` directly.

Validation errors come back as a NestJS shape (not wrapped in `{success, data}`):

```jsonc
{
  "statusCode": 400,
  "message": ["phone must match … pattern"],
  "error": "Bad Request"
}
```

The client `errorMessage()` helpers handle both shapes.

## Data flow: from button tap to database row

Concrete example — buyer taps "Place order":

1. `PlaceOrderScreen.tsx` calls `ordersService.create({ listingId, quantity, unitPrice, deliveryAddress })`.
2. `mobile/src/services/api.ts` attaches `Authorization: Bearer <access>` via request interceptor.
3. Backend `POST /orders` runs through `JwtAuthGuard` → `RolesGuard(BUYER)` → `KycVerifiedGuard`.
4. `OrdersController.create` calls `OrdersService.create(user.id, dto)`.
5. Service loads the listing, validates (`ACTIVE`, not own listing), computes commission, inserts the order, emits `OrderCreatedEvent`.
6. `TransformInterceptor` wraps the saved `Order`. Client unwraps it, routes to `OrderConfirmationScreen`.

The whole path stays inside one process. The event in step 5 is fire-and-forget — no one currently listens (it's reserved for the future notifications module), so it adds zero latency.

## When to add a new module

Add one when **all four** of these are true:

- The domain has its own entities (a new table or a new aggregate of tables).
- The domain has its own controller surface (a clear set of REST endpoints).
- Other modules will read or modify its state only through the service layer.
- The domain has its own permission model that doesn't fit the generic `Roles` decorator.

If you only need a new endpoint on an existing aggregate, just add a controller method — no new module.

## Further reading

- [12 — Database schema](12-database-schema.md) — the authoritative table list, with FKs.
- [13 — API reference](13-api-reference.md) — every endpoint with auth requirements.
- [docs/specs/design-specification.md](../specs/design-specification.md) — original product spec.
- [docs/System-Design.md](../System-Design.md) — earlier system-design notes.
