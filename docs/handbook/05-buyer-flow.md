# 05 — Buyer Flow

The buyer is the demand side of Mashia. This chapter is a vertical slice through the codebase from "I want to buy sheep" to "the seller has my money". If you are touching anything in browse / order / payment, start here.

## At a glance

```
register/login → KYC submitted → KYC verified ──┐
                                                 │
                                                 ▼
                          browse listings  ──►  place order  ──►  seller accepts
                                                                       │
                                                                       ▼
                                                                 buyer initiates payment
                                                                       │  (held in escrow)
                                                                       ▼
                                                                 seller marks in_transit
                                                                       │
                                                                       ▼
                                                                 buyer marks delivered
                                                                       │
                                                                       ▼
                                                              buyer releases (or 7d auto)
                                                                       │
                                                                       ▼
                                                                 order COMPLETED
                                                                seller paid (minus 5%)
```

Any step from "place order" onwards requires `kycStatus === 'verified'`. The browse step is **public** — no JWT required.

## Sign up & sign in

Same flow as everyone else, but the role choice on `/auth/register` is `buyer`.

- Screens: `WelcomeScreen` → `SignInScreen` (existing user) or `SignUpScreen` (new). For SignUp, OTP comes first, then role+profile collection.
- Services: `mobile/src/services/auth.service.ts`.
- Tokens land in `react-native-keychain`. See [03 — Authentication](03-authentication.md) for the OTP details.

## KYC

A buyer's KYC has lighter requirements than a seller's:

- **Required:** `nationalId` image.
- **Forbidden:** `selfie`, `businessLicense` (`400 Bad Request` if provided — see `KycService.validateRoleRules`).

UI: `KycUploadScreen` (`mobile/src/screens/profile/KycUploadScreen.tsx`). The screen sends a multipart `POST /kyc/submit` and immediately updates the local user model to reflect `kyc_status = pending`. Until an admin verifies, the buyer can browse but cannot order.

Polling: the mobile app does not currently poll for KYC state. The next time the buyer hits the API (e.g. tries to place an order) and gets `403 KYC verification required`, the UI shows the pending banner.

## Browse

`HomeScreen.tsx` calls `listingsService.search(params)`:

```http
GET /listings?breed=&minPrice=&maxPrice=&minQuantity=&originCountry=&healthStatus=&sort=&page=&limit=
```

No auth required. Server returns only listings with `status = ACTIVE`. Soft-deleted listings (`deleted_at IS NOT NULL`) are filtered automatically by TypeORM.

| Param | Effect |
|---|---|
| `breed` | exact match on `listings.breed` enum |
| `minPrice` / `maxPrice` | range on `pricePerHead` |
| `minQuantity` | `quantity >= minQuantity` |
| `originCountry` | exact match (case-sensitive — country is ISO-uppercase) |
| `healthStatus` | exact match (`certified`, `pending`, `unchecked`) |
| `sort` | `newest` (default), `price_asc`, `price_desc` |
| `page`, `limit` | classic offset pagination |

Filter sheet UI: `FilterSheet.tsx`. Sort UI is wired through the same component.

Pagination model: `{ data, total, page, limit }`. The mobile store concatenates new pages into a single array. There is no infinite-scroll prefetch yet — explicit "Load more" pulls the next page.

## Listing detail

`ListingDetailScreen.tsx` → `GET /listings/:id`. The listing entity comes back with the `seller` relation populated (`fullName`, `country`, `city`, `kycStatus`). The screen shows:

- Image carousel
- Title, breed, quantity, weight, age
- Price per head + currency
- Origin (country + city)
- Health status badge — driven by `listing.healthStatus` (separate from `certificate.status`)
- "View certificate" if `listing.certificateId` is set (else nothing for buyers; only the owner sees "Upload certificate")
- Seller card with a "Chat" button that calls `POST /messaging/conversations` and navigates to `ChatScreen`

## Place order

```
Buyer taps "Place order"
  └─> PlaceOrderScreen.tsx
        ├─ quantity input (validates ≤ listing.quantity)
        ├─ delivery country + city + address
        └─ ordersService.create({ listingId, quantity, unitPrice, deliveryAddress })
              │
              ▼
        POST /orders   (Bearer JWT)
              │
              ▼  JwtAuthGuard + RolesGuard(BUYER) + KycVerifiedGuard
              ▼
        OrdersService.create(buyerId, dto)
              ├─ load listing, verify status === ACTIVE, sellerId !== buyerId
              ├─ totalPrice  = round(quantity * unitPrice, 2)
              ├─ commissionRate = 5.00, commissionAmount = round(totalPrice * 5 / 100, 2)
              ├─ insert order with status=PENDING
              └─ emit OrderCreatedEvent (currently no listener)
```

Server-side gotchas:

- **Buyer cannot buy their own listing.** `403 Cannot order your own listing`.
- **Listing must be `ACTIVE`.** Sold, expired, or flagged listings can't be ordered against.
- **Currency is forced** to the listing's currency. Even though `unitPrice` is supplied in the DTO, the order copies `listing.currency`. (Why client sends `unitPrice` instead of trusting the listing: the screen shows it on confirmation and the buyer can in principle negotiate. Today the price isn't negotiable in-app — but we model it.)
- **Commission is computed server-side.** Don't let any client tell us the commission.

Successful create returns an `Order` with status `PENDING`. The mobile screen routes to `OrderConfirmationScreen` with the new order id.

## Wait for seller to accept

Order is now in `PENDING`. Buyer can:

- See it in **MyOrdersScreen** (with status badge "Awaiting seller").
- Cancel it (`PATCH /orders/:id/status { status: 'cancelled' }`) — allowed from `PENDING`.

Seller picks it up in their own MyOrdersScreen and either accepts (`PENDING → ACCEPTED`) or, in practice, can also cancel via the same endpoint.

## Initiate payment

Once accepted:

```
Buyer taps "Pay now"
  └─> PaymentMethodScreen.tsx
        ├─ picks STC_PAY | MADA | BANK_TRANSFER
        └─> paymentsService.initiate({ orderId, method })
              │
              ▼
        POST /payments/initiate
              │
              ▼  JwtAuthGuard (no roles, no KYC guard on /payments because the
              ▼   service already verifies order.buyerId === userId)
              ▼
        PaymentsService.initiate(buyerId, dto)
              ├─ order.buyerId === buyerId (else 404)
              ├─ order.status === ACCEPTED (else 400)
              ├─ escrow.holdFunds(amount, currency, method) → { transactionRef }   (stub)
              ├─ insert Payment { escrowStatus=HELD, paidAt=now, autoReleaseAt=null }
              │     • DB unique constraint on order_id catches double-initiation → 409
              └─ emit PaymentHeldEvent
                       │
                       ▼
                  PaymentStatusListener (in orders module)
                       └─ ordersService.transitionFromPayment(orderId, PAID)
```

Effects observable to the buyer:

- New `Payment` row with `escrow_status = held`.
- Order auto-transitions to `PAID` (via internal listener) inside the same request lifecycle.
- `PaymentResultScreen` shows success.

The escrow money is **stubbed**. `EscrowService.holdFunds` only returns a `STUB-<uuid>` reference and logs. The real payment-gateway integration is deferred to after-beta (#132). For MVP, an admin handles bank-transfers manually and triggers `release`/`refund` from the dashboard.

## Receive delivery

Seller marks `PAID → IN_TRANSIT` from their end. Buyer's app polls (or refresh-on-pull) `GET /orders/:id` to see the new status. When the buyer physically receives the goods:

```
Buyer taps "Mark delivered"
  └─> ordersService.updateStatus(orderId, 'delivered')
        │
        ▼
   PATCH /orders/:id/status { status: 'delivered' }
        │
        ▼
   OrdersService.updateStatus(orderId, userId, 'delivered')
        ├─ verifies userId is buyer (or seller)
        ├─ verifies state machine: IN_TRANSIT → DELIVERED requires isBuyer
        ├─ saves order
        └─ emit OrderDeliveredEvent
                 │
                 ▼
            OrderDeliveredListener (in payments module)
                 └─ payment.autoReleaseAt = now + 7 days, save
```

Why a 7-day grace period: the buyer has up to a week to dispute (e.g. animals don't match the listing). After 7 days, the auto-release cron flips the escrow to `released` automatically — see the next section.

## Release payment

Two paths get to `payment.escrow_status = released`:

### Manual: buyer-triggered

```
POST /payments/:id/release   (buyer's JWT)
        │
        ▼
   PaymentsService.release(userId, paymentId)
        ├─ payment.payerId === userId
        ├─ payment.escrowStatus === HELD
        ├─ order.status === DELIVERED   ← critical
        ├─ escrow.releaseFunds(transactionRef)
        ├─ payment.escrowStatus = RELEASED, releasedAt = now
        └─ emit PaymentReleasedEvent
                 │
                 ▼
            PaymentStatusListener
                 └─ ordersService.transitionFromPayment(orderId, COMPLETED)
```

### Auto: cron at every quarter hour

`PaymentsService.processAutoReleases` runs on `@Cron('0 */15 * * * *')`:

1. Inside one transaction, select `Payment` rows where `escrow_status='held' AND auto_release_at <= NOW()`, joined with `orders` where `status='delivered'`.
2. Lock with `pessimistic_write` + `skip_locked` so concurrent crons (multiple workers) never double-process.
3. For each, call `escrow.releaseFunds`, mark released, save.
4. Emit `PaymentReleasedEvent` outside the transaction (so the order transition happens after commit).
5. Log the total count.

The matching partial index `idx_payments_auto_release_held` (`WHERE escrow_status='held'`) keeps the scan cheap.

## Dispute path

Buyer is not happy after delivery? They mark the order `DISPUTED`:

```
PATCH /orders/:id/status { status: 'disputed' }
```

Allowed transitions: from `PAID`, `IN_TRANSIT`, or `DELIVERED`. Either party can dispute.

The order sits in `DISPUTED` waiting for admin intervention. Today the admin path is `POST /payments/:id/refund` (admin only):

```
PaymentsService.refund(paymentId)   ← no userId check, admin guard at controller
        ├─ payment.escrowStatus === HELD
        ├─ order.status === DISPUTED   ← required
        ├─ escrow.refundFunds(transactionRef)
        ├─ payment.escrowStatus = REFUNDED, refundedAt = now
        └─ emit PaymentRefundedEvent
                 │
                 ▼
            PaymentStatusListener
                 └─ ordersService.transitionFromPayment(orderId, CANCELLED)
```

So `DISPUTED → CANCELLED` is *only* reachable via a payment refund. There is no direct "admin cancels disputed order" endpoint — admin always refunds, the order follows.

## What the buyer sees

| Screen | Purpose | Key API call |
|---|---|---|
| `HomeScreen` | Browse with filter/sort | `GET /listings` |
| `FilterSheet` | Bottom-sheet filters | (no API — controls Home's params) |
| `ListingDetailScreen` | Full listing view | `GET /listings/:id` |
| `PlaceOrderScreen` | Order form | `POST /orders` |
| `OrderConfirmationScreen` | "You're booked" summary | (none — passed via params) |
| `PaymentMethodScreen` | Pick a method | `POST /payments/initiate` |
| `PaymentResultScreen` | Success/failure | (none) |
| `MyOrdersScreen` | Orders list (filtered by status) | `GET /orders` |
| `OrderDetailScreen` | Timeline + actions | `GET /orders/:id`, `PATCH /orders/:id/status`, `POST /payments/:id/release` |
| `ChatScreen` | Talk to seller | Socket.io `/chat` |
| `ProfileScreen`, `EditProfileScreen`, `KycUploadScreen`, `SettingsScreen` | Profile management | `/users/me`, `/kyc/*` |

## Common buyer-side bugs to look for

- **Re-paying an order**: the unique constraint on `payments.order_id` prevents a second `POST /payments/initiate`. The error surfaces as `ConflictException('Payment already exists for this order')`. UI should hide the pay button once a payment exists.
- **Skipping states**: trying `PATCH /orders/:id/status` to a non-adjacent status returns `BadRequestException('Invalid transition from X to Y')`. Always render only the buttons that match the current state, not all buttons.
- **Stale KYC**: if the admin rejects a buyer's KYC after they signed in, their next mutating call returns `403 KYC verification required` — the UI must `GET /users/me` on focus or reconnect to surface the rejection reason.
- **Currency confusion**: the order's currency is the *listing's*, not whatever the buyer types. Display the listing currency on the order form and don't let users edit it.

## Cross-references

- [07 — Listings](07-listings.md) — schema and seller side of the same listings.
- [08 — Orders, payments & escrow](08-orders-payments-escrow.md) — full state machine.
- [10 — Messaging](10-messaging.md) — buyer-seller chat.
- [04 — Users & KYC](04-users-and-kyc.md) — KYC rules buyers must satisfy.
