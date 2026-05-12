# 08 — Orders, Payments & Escrow

Orders and payments are tightly coupled — they share a state machine driven by events. Read both halves; mutating one without understanding the other is how you cause split-brain bugs.

Authoritative files:

- Orders: `backend/src/modules/orders/` (`order.entity.ts`, `orders.service.ts`, `orders.controller.ts`, `payment-status.listener.ts`)
- Payments: `backend/src/modules/payments/` (`payment.entity.ts`, `payments.service.ts`, `payments.controller.ts`, `escrow.service.ts`, `order-delivered.listener.ts`)
- Events: `backend/src/shared/events/` (`order-created`, `order-delivered`, `payment-held`, `payment-released`, `payment-refunded`)

## The order state machine

```
            ┌─────────┐   accept (seller)  ┌─────────┐
            │ PENDING │ ──────────────────►│ ACCEPTED│
            └─────────┘                    └─────────┘
                 │                              │
       cancel (either)               payment.held (internal listener)
                 │                              │
                 ▼                              ▼
            ┌───────────┐                  ┌─────────┐  in_transit (seller)
            │ CANCELLED │                  │  PAID   │ ──────────────────────►┐
            └───────────┘                  └─────────┘                        │
                  ▲                                                            ▼
                  │                                                    ┌────────────┐
       payment.refunded                                                │ IN_TRANSIT │
       (internal listener)                                             └────────────┘
                  │                                                            │
                  │                                                  delivered (BUYER only)
                  │                                                            ▼
                  │                                                     ┌───────────┐
                  │                                                     │ DELIVERED │
                  │                                                     └───────────┘
                  │                                                            │
                  │                                          payment.released (manual or 7d cron)
                  │                                                            ▼
            ┌──────────┐                                                ┌───────────┐
            │ DISPUTED │ ◄──────────── dispute (either, from PAID,      │ COMPLETED │
            └──────────┘             IN_TRANSIT, or DELIVERED)          └───────────┘
```

Transitions split into two kinds:

- **User-driven** via `PATCH /orders/:id/status` — handled by `OrdersService.updateStatus`.
- **System-driven** via `transitionFromPayment` — called only by `PaymentStatusListener` on `payment.*` events.

### User-driven transitions

`OrdersService.updateStatus(orderId, userId, newStatus)`:

| From | To | Who |
|---|---|---|
| `PENDING` | `ACCEPTED` | seller |
| `PENDING` | `CANCELLED` | either party |
| `PAID` | `IN_TRANSIT` | seller |
| `PAID` | `DISPUTED` | either |
| `IN_TRANSIT` | `DELIVERED` | **buyer** (not seller) |
| `IN_TRANSIT` | `DISPUTED` | either |
| `DELIVERED` | `DISPUTED` | either |

Anything else is `BadRequestException('Invalid transition from X to Y')`. If `userId` isn't `buyer` or `seller` on the order, you get `NotFoundException` (we hide existence rather than say "forbidden", to reduce information disclosure).

The transition into `DELIVERED` is the only one where the **buyer** is the actor with the seller as the other party. This is the design call that keeps the seller from short-circuiting escrow release.

### System-driven transitions

`OrdersService.transitionFromPayment(orderId, target)` — bypasses the user-authorisation check. Allowed:

| From | To | Trigger event |
|---|---|---|
| `ACCEPTED` | `PAID` | `payment.held` |
| `DELIVERED` | `COMPLETED` | `payment.released` |
| `DISPUTED` | `CANCELLED` | `payment.refunded` |

Anything else → `BadRequestException('Invalid payment-driven transition...')`. **Don't call this from anywhere except `PaymentStatusListener`** — that's the entire audit surface.

## Order data model

```
orders
  id                 uuid
  listing_id         uuid?       → listings.id  ON DELETE SET NULL
  buyer_id           uuid        → users.id     ON DELETE CASCADE
  seller_id          uuid        → users.id     ON DELETE CASCADE
  broker_id          uuid?       → users.id     ON DELETE SET NULL
  quantity           int
  unit_price         numeric(12,2)
  currency           enum
  total_price        numeric(14,2)
  commission_rate    numeric(5,2)  default 5.00
  commission_amount  numeric(14,2) default 0
  status             enum
  delivery_country, delivery_city, delivery_address
  created_at, updated_at
```

Why some fields are denormalised onto the order:

- `seller_id` is a copy of `listing.seller_id` at order time. If the listing is later deleted (cascading not applied because `ON DELETE SET NULL`), the order keeps its seller. Otherwise we'd lose attribution.
- `currency`, `unit_price`, `total_price` snapshot the price at order time. Listings can be edited, orders can't be.
- `commission_rate` is captured per-order. A future flat-rate-only or broker-fee adjustment won't retroactively change old orders.

## Order endpoints

| Method | Path | Auth | Role | KYC |
|---|---|---|---|---|
| `POST` | `/orders` | JWT | `BUYER` | required |
| `GET` | `/orders?status[]=&page=&pageSize=` | JWT | (any party) | — |
| `GET` | `/orders/:id` | JWT | (party check inside service) | — |
| `PATCH` | `/orders/:id/status` | JWT | (party check inside service) | — |

`POST /orders` rejects buying your own listing (`order.sellerId === buyerId → 403`). It also rejects non-active listings.

`GET /orders` filters by **party** (`buyer_id = me OR seller_id = me OR broker_id = me`) with optional `status[]=pending&status[]=accepted` multi-select. Sorted by `created_at DESC`.

`GET /orders/:id` returns an `OrderDetailResponse` shaped for the calling user — counterparty info, payment summary, "what should I show" hints. See `dto/order-detail.response.ts`.

## Commission math

In `OrdersService.create`:

```ts
const totalPrice        = round(quantity * unitPrice, 2);
const commissionRate    = 5.00;                        // hardcoded today
const commissionAmount  = round(totalPrice * 5 / 100, 2);   // == totalPrice * commissionRate / 100
```

Rounding strategy: `Math.round(x * 100) / 100` (banker's-rounding-free, "half-up" via JS Math.round). Acceptable for SAR/AED/USD which are 2-decimal currencies. SYP is also represented as 2-decimal, but real-world SYP has no fractional value — be aware if you ever expose buying in SYP through a real gateway.

If you change the commission rate, edit `DEFAULT_COMMISSION_RATE` in `orders.service.ts`. Old orders retain their stored rate. To allow per-listing rates, expose `commissionRate` on the listing and read it during order creation.

## Payment model

```
payments
  id                  uuid
  order_id            uuid       UNIQUE  → orders.id  ON DELETE CASCADE
  payer_id            uuid       → users.id  (buyer)  ON DELETE CASCADE
  amount              numeric(14,2)   == order.total_price
  commission_amount   numeric(14,2)   == order.commission_amount
  seller_amount       numeric(14,2)   == amount - commission_amount
  currency            enum
  method              enum: stc_pay | mada | bank_transfer
  escrow_status       enum: held | released | refunded
  transaction_ref     text                 STUB-<uuid> today
  auto_release_at     timestamptz?         set by OrderDeliveredListener
  paid_at             timestamptz          NOT NULL  (when initiate was called)
  released_at         timestamptz?
  refunded_at         timestamptz?
  created_at, updated_at
```

**The unique index on `order_id`** is the cornerstone of the escrow invariant: there is at most one payment per order, ever. If `PaymentsService.initiate` gets called twice (race or retry), the second insert fails with Postgres `23505` and the service throws `ConflictException('Payment already exists for this order')`.

## Payment endpoints

| Method | Path | Auth | Role | Effect |
|---|---|---|---|---|
| `POST` | `/payments/initiate` | JWT | (no role) | Buyer initiates escrow hold |
| `POST` | `/payments/:id/release` | JWT | (no role) | Buyer releases held funds after delivery |
| `POST` | `/payments/:id/refund` | JWT | `ADMIN` | Admin refunds disputed order |
| `GET` | `/payments/by-order/:orderId` | JWT | (party check) | Fetch payment for an order |
| `GET` | `/payments/:id` | JWT | (party + admin check) | Payment detail |

There is no `KycVerifiedGuard` on payment endpoints. The service-level checks already require that the caller be the buyer/payer on the order, and orders cannot exist without a KYC-verified buyer (because `POST /orders` is guarded). So a non-KYC user *can't* reach a payment they're authorised for.

## Lifecycle: from initiate to release

```
1. Buyer: POST /payments/initiate { orderId, method }
   ├─ verifies buyer ownership, order.status === ACCEPTED
   ├─ escrow.holdFunds(amount, currency, method)            (stub returns STUB-<uuid>)
   ├─ insert Payment { escrowStatus: HELD, paidAt: now, autoReleaseAt: null }
   │   * Postgres unique index on order_id rejects duplicates → 409
   └─ emit PaymentHeldEvent(paymentId, orderId, buyerId, sellerId, sellerAmount, commission, currency)
            │
            ▼
       PaymentStatusListener.onPaymentHeld
            └─ ordersService.transitionFromPayment(orderId, PAID)
                       (synchronous, same request)

2. Seller: PATCH /orders/:id/status { status: 'in_transit' }   → PAID → IN_TRANSIT

3. Buyer: PATCH /orders/:id/status { status: 'delivered' }     → IN_TRANSIT → DELIVERED
            └─ ordersService emits OrderDeliveredEvent
                       │
                       ▼
                  OrderDeliveredListener.onOrderDelivered  (in payments module)
                       ├─ find HELD payment for orderId
                       └─ set payment.autoReleaseAt = now + 7 days, save

4a. Buyer: POST /payments/:id/release                          (manual, before 7d expiry)
4b. Cron: PaymentsService.processAutoReleases @ '0 */15 * * * *'  (every quarter hour)
            ├─ inside ONE transaction, lock HELD + autoReleaseAt <= NOW + order=DELIVERED
            │   with pessimistic_write + skip_locked (multi-worker safe)
            ├─ escrow.releaseFunds(ref)
            ├─ set escrow_status = RELEASED, released_at = now
            └─ emit PaymentReleasedEvent (OUTSIDE the transaction, after commit)
                       │
                       ▼
                  PaymentStatusListener.onPaymentReleased
                       └─ ordersService.transitionFromPayment(orderId, COMPLETED)
```

### Why events instead of direct cross-module calls

`OrdersService` and `PaymentsService` both depend on each other's state. If they invoked one another's methods directly, we'd have a circular import problem and a tangled transaction story. Events let each module own its writes:

- `payments` writes the payment row, then *announces* what happened.
- `orders` *listens* and decides what (if anything) to do.

Today both listeners synchronously trigger an order update. If you want to add a notification (push, SMS, email), add a *new* listener — don't extend the existing one. Listeners are the unit of "things that happen after X".

## Refund path

Refunds are admin-only because they can move real money in the production gateway. The flow:

```
Admin: POST /payments/:id/refund
   ├─ payment.escrowStatus === HELD
   ├─ order.status === DISPUTED      ← must dispute first
   ├─ escrow.refundFunds(ref)
   ├─ payment.escrowStatus = REFUNDED, refundedAt = now
   └─ emit PaymentRefundedEvent
            │
            ▼
       PaymentStatusListener.onPaymentRefunded
            └─ ordersService.transitionFromPayment(orderId, CANCELLED)
```

There is **no** "refund without dispute" today. If a buyer wants their money back, they must first `PATCH /orders/:id/status { status: 'disputed' }` and then the admin issues the refund.

## The auto-release cron in detail

`PaymentsService.processAutoReleases` — read it carefully if you ever touch payment logic.

```ts
@Cron('0 */15 * * * *')          // every 15 minutes
async processAutoReleases(): Promise<number> {
  const releasedEvents: PaymentReleasedEvent[] = [];

  await this.dataSource.transaction(async (manager) => {
    const { entities, raw } = await manager
      .createQueryBuilder(Payment, 'payment')
      .innerJoin('orders', 'order', 'order.id = payment.order_id')
      .where('payment.escrow_status = :held', { held: 'held' })
      .andWhere('payment.auto_release_at IS NOT NULL')
      .andWhere('payment.auto_release_at <= NOW()')
      .andWhere('order.status = :delivered', { delivered: 'delivered' })
      .addSelect('order.seller_id', 'order_seller_id')
      .setLock('pessimistic_write', undefined, ['payment'])
      .setOnLocked('skip_locked')                        // tolerate concurrent runs
      .getRawAndEntities();

    for (let i = 0; i < entities.length; i++) {
      const payment = entities[i];
      const sellerId = raw[i].order_seller_id as string;
      try {
        await this.escrow.releaseFunds(payment.transactionRef);
        payment.escrowStatus = 'released';
        payment.releasedAt = new Date();
        await manager.save(payment);
        releasedEvents.push(new PaymentReleasedEvent(...));
      } catch (err) {
        this.logger.error('Auto-release failed for payment ${payment.id}', err);
        // continue with the rest — don't crash the batch
      }
    }
  });

  // Emit events AFTER the transaction commits.
  for (const event of releasedEvents) {
    this.eventEmitter.emit(PaymentReleasedEvent.EVENT_NAME, event);
  }
  return releasedEvents.length;
}
```

Three things to keep in mind:

1. **`skip_locked`** means concurrent workers don't contend — each one just picks rows the others haven't grabbed. Safe to run multiple backend replicas.
2. **Events fire after commit.** If we emitted inside the transaction and a listener took a long time, we'd hold the row lock for that listener's duration. By the time `PaymentStatusListener` updates the order, the payment row is already free.
3. **Failures are logged, not raised.** One bad payment doesn't stop the batch.

If you want to change the 7-day grace window, edit `AUTO_RELEASE_DAYS` in `payments/order-delivered.listener.ts`.

## Authorisation rules at a glance

| Endpoint | Allowed callers |
|---|---|
| `POST /orders` | KYC-verified `BUYER` |
| `PATCH /orders/:id/status` | `buyer` or `seller` on the order (broker can't transition today) |
| `POST /payments/initiate` | `buyer` on the order (= `order.buyerId`) |
| `POST /payments/:id/release` | `payerId` on the payment (= the buyer) |
| `POST /payments/:id/refund` | Any `ADMIN` |
| `GET /orders/:id` | Any party (buyer/seller/broker); else 404 |
| `GET /payments/by-order/:orderId` | Any party on the order |
| `GET /payments/:id` | `payerId`, the order's seller, or any admin |

## Idempotency and retries

- **`POST /payments/initiate`** is idempotent at the SQL level via the unique constraint. Calling twice returns 409 the second time.
- **`POST /payments/:id/release`** is NOT idempotent — the second call rejects with "Payment must be HELD". This is acceptable because the client only calls it once; if the user double-taps, the second call just errors and the UI can ignore it.
- **Auto-release cron** is safe to run with overlapping schedules thanks to `skip_locked`.

## When the escrow stub becomes a real gateway

`EscrowService` today is just three methods returning fake refs. When you wire it to a real provider:

- `holdFunds(amount, currency, method)`: should return a non-stub `transactionRef` from the gateway. If the gateway is asynchronous (webhook-based), this method should *initiate* and return a pending ref; a webhook handler then flips `escrow_status` once the gateway confirms.
- `releaseFunds(ref)`: trigger payout to seller.
- `refundFunds(ref)`: trigger refund to buyer.

Real gateway integrations bring their own listeners (webhook controllers). Add them in `payments/webhooks/` and emit `PaymentHeldEvent`/`Released`/`Refunded` from there, not from the synchronous controller path. The rest of the system already responds correctly to those events.

The full gateway swap is tracked as issue #132 and labelled `After Beta phase`.

## Cross-references

- [05 — Buyer flow](05-buyer-flow.md) and [06 — Seller flow](06-seller-flow.md) — the same story from each side's UI.
- [11 — Admin dashboard](11-admin-dashboard.md) — admin's view of orders and payments (mostly TODO).
- [12 — Database schema](12-database-schema.md) — full column types and indexes.
