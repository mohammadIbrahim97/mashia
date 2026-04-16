# US07 — Escrow Payment System — Design

**Date:** 2026-04-16
**Branch:** `us07-escrow-payment`
**Parent issue:** #45
**Sub-issues:** #46, #47, #48, #49, #50, #51, #52, #53, #54

## 1. Goal

Give a buyer a way to pay for an accepted order into escrow, hold those funds until delivery is confirmed, then release the seller's cut (minus commission) either on explicit buyer release or after a 7-day grace window. Admin can refund disputed orders. EscrowService is a stub for MVP — no real payment gateway yet.

## 2. Integration with Orders

Payments drive order status transitions via domain events — payments module never mutates order rows directly.

**Order state machine extensions** (transitions that US06 deferred as "system-only"):

| From | To | Trigger |
|---|---|---|
| ACCEPTED | PAID | `payment.held` event |
| DELIVERED | COMPLETED | `payment.released` event |
| DISPUTED | CANCELLED | `payment.refunded` event |

A new internal-only `OrdersService.transitionFromPayment(orderId, targetStatus)` performs these transitions. It bypasses the user-authorization branch of `updateStatus` because the listener is running on behalf of the system, not a user.

## 3. Data Model

### Payment entity (`payments` table)

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `orderId` | uuid, FK orders, **UNIQUE** | One payment per order |
| `payerId` | uuid, FK users | Buyer who initiated |
| `amount` | decimal(14,2) | Snapshot of `order.totalPrice` at initiate time |
| `commissionAmount` | decimal(14,2) | `amount × commissionRate / 100` |
| `sellerAmount` | decimal(14,2) | `amount − commissionAmount` |
| `currency` | enum Currency | Snapshot from order |
| `method` | enum PaymentMethod | `stc_pay` / `mada` / `bank_transfer` |
| `escrowStatus` | enum EscrowStatus | `held` / `released` / `refunded` |
| `transactionRef` | text | Stub generates `STUB-<uuid>` |
| `autoReleaseAt` | timestamptz nullable | Set by `order.delivered` listener to `now + 7d` |
| `paidAt` | timestamptz | = createdAt at initiate |
| `releasedAt` | timestamptz nullable | Set on RELEASED transition |
| `refundedAt` | timestamptz nullable | Set on REFUNDED transition |
| `createdAt` / `updatedAt` | timestamptz | |

### New enums in `shared/enums/index.ts`

```ts
export enum PaymentMethod {
  STC_PAY = 'stc_pay',
  MADA = 'mada',
  BANK_TRANSFER = 'bank_transfer',
}

export enum EscrowStatus {
  HELD = 'held',
  RELEASED = 'released',
  REFUNDED = 'refunded',
}
```

**Why snapshot amount/commission/seller on the Payment row:** `order.commissionRate` can be changed administratively after the fact; the payment must preserve the rate that was used at initiate time so released funds are reproducible.

**No `pending` escrow status:** initiate is synchronous in the stub. If and when a real gateway is wired up and async confirmations happen, we can add `PENDING` then.

## 4. Lifecycle

### Happy path

```
1. Seller accepts              → Order: ACCEPTED
2. Buyer POST /payments/initiate
     EscrowService.holdFunds() → STUB-<uuid>
     Payment saved (HELD, paidAt=now)
     emit payment.held
       ↳ OrdersService listener: ACCEPTED → PAID
3. Seller ships                → Order: IN_TRANSIT  (existing US06)
4. Buyer confirms arrival      → Order: DELIVERED   (existing US06)
     emit order.delivered
       ↳ PaymentsService listener: set autoReleaseAt = now + 7d
5. Release (either trigger):
   a. Buyer POST /payments/:id/release
   b. Cron finds autoReleaseAt ≤ now AND escrowStatus=HELD AND order.status=DELIVERED
     EscrowService.releaseFunds()
     Payment updated (RELEASED, releasedAt=now)
     emit payment.released
       ↳ OrdersService listener: DELIVERED → COMPLETED
```

### Dispute / refund path

```
- Buyer or seller disputes (existing US06) → Order: DISPUTED
  (no payment changes required; cron query filters out DISPUTED rows)
- Admin POST /payments/:id/refund
  EscrowService.refundFunds()
  Payment updated (REFUNDED, refundedAt=now)
  emit payment.refunded
    ↳ OrdersService listener: DISPUTED → CANCELLED
```

### Why the cron filters by order.status

Rather than clearing `autoReleaseAt` on dispute (which would require a new `order.disputed` event), the auto-release cron reads both payment and order rows and skips any row where the order has moved off DELIVERED. Simpler, one fewer event type, and it keeps the payments module independent of every order status change.

## 5. Events

Each event is a class with a static `EVENT_NAME` constant, matching the US06 pattern. Each source file carries the listener-contract header comment ("must try/catch, log, never throw").

```ts
export class PaymentHeldEvent {
  static readonly EVENT_NAME = 'payment.held';
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly sellerId: string,
    public readonly sellerAmount: number,
    public readonly commissionAmount: number,
    public readonly currency: Currency,
  ) {}
}

export class PaymentReleasedEvent {
  static readonly EVENT_NAME = 'payment.released';
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly sellerId: string,
    public readonly sellerAmount: number,
    public readonly currency: Currency,
  ) {}
}

export class PaymentRefundedEvent {
  static readonly EVENT_NAME = 'payment.refunded';
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly amount: number,
    public readonly currency: Currency,
  ) {}
}
```

**Cross-module listeners:**

- `orders/payment-status.listener.ts` — subscribes to all three payment events, calls `OrdersService.transitionFromPayment(orderId, target)`.
- `payments/order-delivered.listener.ts` — subscribes to `order.delivered`, sets `autoReleaseAt` on the matching payment.

## 6. HTTP API

Global prefix `/api/v1`. All endpoints `@UseGuards(JwtAuthGuard)`.

| Method | Path | Auth | Body | Success |
|---|---|---|---|---|
| POST | `/payments/initiate` | buyer only (payer === order.buyerId) | `{ orderId, method }` | 201 `PaymentResponse` |
| POST | `/payments/:id/release` | payer only | — | 200 `PaymentResponse` |
| POST | `/payments/:id/refund` | admin (`@Roles(ADMIN)` + RolesGuard) | `{ reason? }` | 200 `PaymentResponse` |
| GET | `/payments/:id` | payer / seller / admin | — | 200 `PaymentResponse` |
| GET | `/payments?orderId=` | party to the order | — | 200 `PaymentResponse` |

**Privacy:** 404-not-403 for non-parties, consistent with US06.

**Error codes:**
- 400 — wrong order status (e.g., initiate before ACCEPTED; release before DELIVERED; refund before DISPUTED); payment not HELD; invalid method enum.
- 403 — caller is a party but lacks the required role (refund endpoint, raised by RolesGuard when non-admin hits it).
- 404 — order/payment not found; non-party caller on resource-access endpoints.
- 409 — duplicate initiate (surfaced from unique constraint on `order_id`).

**403 vs 404:** the privacy-by-404 pattern applies to resource-access endpoints (GET, and POST /release when caller isn't the payer). The refund endpoint uses RolesGuard, which throws 403 — that's fine because the endpoint's existence is not secret; only the action is admin-gated.

## 7. Service Contracts

### PaymentsService

```ts
initiate(buyerId, { orderId, method }):
  - Load order; 404 if missing or buyerId !== order.buyerId
  - Require order.status === ACCEPTED; else 400
  - Compute commissionAmount, sellerAmount from order.commissionRate
  - holdFunds() → transactionRef
  - Save Payment (escrowStatus=HELD, paidAt=now, currency from order)
  - Emit PaymentHeldEvent
  - Unique order_id constraint → 409 Conflict

release(userId, paymentId):
  - Load payment + order; 404 if userId !== payment.payerId
  - Require payment.escrowStatus === HELD; else 400
  - Require order.status === DELIVERED; else 400
  - releaseFunds()
  - Update payment (RELEASED, releasedAt=now)
  - Emit PaymentReleasedEvent

refund(adminId, paymentId, reason?):
  - Load payment + order; controller guard enforces admin role
  - Require payment.escrowStatus === HELD; else 400
  - Require order.status === DISPUTED; else 400
  - refundFunds()
  - Update payment (REFUNDED, refundedAt=now)
  - Emit PaymentRefundedEvent

findByOrder(userId, orderId):
  - Load order; 404 if userId is not buyer/seller/broker
  - Return payment or 404

findOne(userId, paymentId):
  - Load payment + order; 404 unless userId is payer, seller, or admin

processAutoReleases():
  - SELECT payments p JOIN orders o ON p.order_id = o.id
    WHERE p.escrow_status = 'held'
      AND p.auto_release_at <= now()
      AND o.status = 'delivered'
  - For each: call private `_doRelease(payment)` — the same helper that
    `release(userId, paymentId)` calls after its payer/status guards.
    `_doRelease` owns the EscrowService call + DB update + event emit.
```

### EscrowService (stub)

```ts
holdFunds(amount, currency, method)  → { transactionRef: `STUB-${uuid}`, status: 'held' }
releaseFunds(transactionRef)         → { transactionRef, status: 'released' }
refundFunds(transactionRef)          → { transactionRef, status: 'refunded' }
```

No network calls, no failure modes in MVP. Each method logs the stub action for future gateway replacement.

### PaymentResponse DTO

```ts
{ id, orderId, payerId, amount, sellerAmount, commissionAmount, currency,
  method, escrowStatus, transactionRef, autoReleaseAt,
  paidAt, releasedAt, refundedAt, createdAt }
```

## 8. Scheduling

Add `@nestjs/schedule` package. Register `ScheduleModule.forRoot()` in `AppModule`. In PaymentsService:

```ts
@Cron(CronExpression.EVERY_15_MINUTES)
async processAutoReleases() { ... }
```

**Multi-instance note:** if we ever deploy >1 instance, each will run the cron and double-release. Acceptable for MVP (single-instance); add a DB lock or leader-election later. Record as follow-up tech debt when we hit phase-10.

## 9. Testing

### Unit tests

- `escrow.service.spec.ts` — 3 tests: each method returns a ref starting with `STUB-`.
- `payments.service.spec.ts` — mocked repos + EventEmitter2 spy:
  - `initiate`: happy path emits PaymentHeldEvent correctly; computes math (1000 SAR × 5% = 50 commission, 950 seller); 404 on wrong buyer; 404 on missing order; 400 on wrong order status; 409 on duplicate.
  - `release`: 404 non-payer; 400 not HELD; 400 order not DELIVERED; happy path emits PaymentReleasedEvent.
  - `refund`: 400 not HELD; 400 order not DISPUTED; happy path emits PaymentRefundedEvent.
  - `processAutoReleases`: picks correct rows; skips order.status != DELIVERED; updates to RELEASED.
- `orders/payment-status.listener.spec.ts` — listener calls `transitionFromPayment` with correct target for each event.

### E2E tests (`backend/test/payments.e2e-spec.ts`)

Reuses US06 harness (`test-app.ts`, `truncate.ts`, `fixtures.ts`, `event-capture.ts`). One new fixture: `createAcceptedOrder(app, buyer, seller)` that seeds listing + order in ACCEPTED state via repos.

~12 tests:

**POST /payments/initiate** (5)
- happy path → 201, payment HELD, order PAID, PaymentHeldEvent captured
- not buyer → 404
- order not ACCEPTED (e.g. PENDING) → 400
- duplicate initiate → 409
- invalid method enum → 400

**POST /payments/:id/release** (3)
- happy path from DELIVERED → 200, payment RELEASED, order COMPLETED, PaymentReleasedEvent captured
- non-payer → 404
- order not DELIVERED → 400

**POST /payments/:id/refund** (2)
- admin on DISPUTED order → 200, payment REFUNDED, order CANCELLED, PaymentRefundedEvent captured
- non-admin → 403

**Auto-release** (1)
- insert HELD payment with past `autoReleaseAt` + order DELIVERED → `processAutoReleases()` releases it.

**GET endpoints** (1 combined)
- payer sees, admin sees, stranger 404; missing payment 404.

## 10. File Layout

```
backend/src/modules/payments/
  payment.entity.ts
  payments.module.ts
  payments.service.ts
  payments.controller.ts
  escrow.service.ts
  order-delivered.listener.ts
  dto/
    initiate-payment.dto.ts
    refund-payment.dto.ts
    payment.response.ts
  events/
    payment-held.event.ts
    payment-released.event.ts
    payment-refunded.event.ts
  payments.service.spec.ts
  escrow.service.spec.ts

backend/src/modules/orders/
  payment-status.listener.ts                (NEW — cross-module glue)
  payment-status.listener.spec.ts           (NEW)
  orders.service.ts                         (MODIFY — add transitionFromPayment)

backend/src/shared/enums/index.ts           (MODIFY — PaymentMethod, EscrowStatus)
backend/src/app.module.ts                   (MODIFY — import ScheduleModule.forRoot())

backend/test/
  payments.e2e-spec.ts                      (NEW)
  helpers/fixtures.ts                       (MODIFY — createAcceptedOrder)

backend/package.json                        (MODIFY — @nestjs/schedule)
```

## 11. Sub-Issue → Commit Mapping

Nine sub-issues grouped into four commits:

1. **Commit 1 — #46, #48, #52, #53** (foundation)
   Payment entity, enums, EscrowService stub, seller_amount math, three event classes. Unit tests for EscrowService and math.

2. **Commit 2 — #47, #52** (initiate flow)
   POST /payments/initiate + initiate method + PaymentHeldEvent emission + orders listener (held → PAID). Unit tests for initiate. One e2e test (initiate happy path).

3. **Commit 3 — #49, #50** (release + refund)
   POST /payments/:id/release + POST /payments/:id/refund + their events + listener transitions (released → COMPLETED, refunded → CANCELLED). Unit + e2e tests for both.

4. **Commit 4 — #51, #54** (auto-release + full e2e suite)
   @nestjs/schedule dep, order-delivered listener sets autoReleaseAt, cron processAutoReleases(). Remaining e2e tests. Full suite smoke run.

## 12. Follow-ups (out of scope)

- Multi-instance cron safety (DB lock / leader election) — deferred to phase-10.
- `transitionFromPayment` is internal-only by convention (JSDoc `@internal`); stronger boundary enforcement can come later.
- Real payment gateway integration — replaces `EscrowService` stub without API surface changes.
- Surface `autoReleaseAt` in client UX as a countdown once frontend lands.
