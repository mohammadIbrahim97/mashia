# 06 — Seller Flow

The seller is the supply side. This chapter walks through "I have sheep to sell" → "I got paid (minus 5% commission)". Brokers are touched briefly at the end — they share the certificate-upload privilege but no exclusive flow yet.

## At a glance

```
register/login as seller → KYC (nationalId + selfie [+ business license])
       │
       ▼ (admin verifies KYC)
       │
       ▼
   create listing → optionally upload a vet certificate (→ admin verifies)
       │
       ▼ (buyer places order)
       │
       ▼
   accept order (PENDING → ACCEPTED)
       │
       ▼ (buyer initiates payment, escrow holds)
       │
       ▼  (system auto-transitions order to PAID via PaymentHeldEvent)
       │
       ▼
   mark IN_TRANSIT  (ship the animals)
       │
       ▼ (buyer marks DELIVERED)
       │
       ▼ (buyer releases, or 7-day auto-release fires)
       │
       ▼
   seller receives funds (escrow released, order COMPLETED)
```

Everything from "create listing" onwards needs `kycStatus === 'verified'`. The seller does *not* see the buyer's wallet, only the funds-released event.

## KYC for sellers

Stricter than buyers:

- **Required:** `nationalId` *and* `selfie`.
- **Optional:** `businessLicense` (used by farms/operators who can produce one).

Without all required docs, `POST /kyc/submit` returns 400. See [04 — Users & KYC](04-users-and-kyc.md).

## Create a listing

Screen: `mobile/src/screens/listings/CreateListingScreen.tsx`. Image upload uses S3 presigned URLs:

```
1. Pick images (2–10) from camera/gallery via react-native-image-picker
2. For each image:
     POST /uploads/presigned-url { purpose: "listing", contentType: "image/jpeg", fileName }
       ├─ returns { uploadUrl, fileUrl, key, expiresIn: 300 }
     PUT uploadUrl  (direct from device to S3; not via the API)
     remember `key` (or `fileUrl`)
3. POST /listings {
     title, breed, quantity, ageMonths, weightKg,
     pricePerHead, currency, originCountry, originCity,
     description?, images: string[], videoUrl?
   }
```

The keys/URLs collected in step 2 are sent as the `images` array. The backend doesn't re-validate that the S3 objects exist — it trusts the presigned upload completed.

**Server-side rules** in `CreateListingDto`:

- `title` ≤ 200 chars.
- `breed` must be in `Breed` enum (`awassi | najdi | arabi | shami | other`).
- `quantity` integer ≥ 1.
- `ageMonths` integer ≥ 0.
- `weightKg`, `pricePerHead` positive decimals.
- `currency` from `Currency` enum (`SYP | SAR | AED | USD`).
- `images` array length 2–10.

New listings default to `status = ACTIVE`, `healthStatus = UNCHECKED`. Sellers cannot set those fields directly — `healthStatus` is driven by the certificate flow, `status` by sale/expiry/moderation.

## Listing management

Three personal endpoints for the seller:

| Method | Path | Effect |
|---|---|---|
| `GET` | `/listings/mine?page=&limit=` | seller's own listings (all statuses), `created_at DESC` |
| `PATCH` | `/listings/:id` | update mutable fields; ownership check |
| `DELETE` | `/listings/:id` | soft delete (sets `deleted_at`); ownership check |

Ownership: `ListingsService.update` and `remove` load the listing and `403 Forbidden` if `sellerId !== userId`. There's no admin override on these endpoints; admins use `DELETE /admin/listings/:id` (still TODO).

`PATCH` uses `UpdateListingDto = PartialType(CreateListingDto)` — every field optional. Fields are persisted via `Object.assign(listing, dto)` then `save()`, so any field passed is applied.

`MyListingsScreen.tsx` is the UI. It shows all statuses (active, sold, expired, flagged) so the seller can manage the lifecycle.

## Upload a certificate

A seller (or broker) can attach a vaccination, health, or origin certificate to a listing. Screens: `UploadCertificateScreen.tsx` → `CertificateDetailScreen.tsx`.

```
POST /uploads/presigned-url { purpose: "certificate", contentType, fileName }
   → upload the file to S3 directly

POST /certificates
{
  listingId?, type, issuingAuthority, issueDate, expiryDate, fileUrl
}
```

Server behaviour (`CertificatesService.create`):

- `expiryDate >= issueDate` (else 400).
- If `listingId` provided, listing must exist and belong to the same `sellerId` (else 403/404).
- Inserts certificate with `status = PENDING`.
- If `listingId` set, updates `listings.certificate_id = cert.id` and `listings.health_status = PENDING`.

Once an admin verifies the certificate (`PATCH /certificates/:id/verify`):

- `VERIFIED` → `listings.health_status = CERTIFIED`.
- `REJECTED` → `listings.health_status = UNCHECKED`, certificate gets a `rejection_reason`.

Listings with `health_status = CERTIFIED` can be filtered by buyers via `GET /listings?healthStatus=certified`. There's currently no automatic "soon expiring" warning — issue #61 (certificate-expiry auto-flag scheduler) is open.

See [09 — Certificates](09-certificates.md) for the admin side.

## Receive orders

A new order on one of the seller's listings is visible immediately at `GET /orders`. The `OrdersService.findMyOrders` query selects `buyer_id = userId OR seller_id = userId OR broker_id = userId` — same endpoint for buyer, seller, and broker.

The list response is a `OrderListItemResponse`, which (via `fromOrder(order, userId)`) computes the **counterparty**, label, and what action buttons to show — so the same screen looks different to buyer vs seller without if-statements in the UI.

### Accept

```
PATCH /orders/:id/status { status: "accepted" }
```

Transition rules in `OrdersService.updateStatus`:

- Caller must be `buyer` or `seller` on the order (else 404 — same response as not found, to avoid leaking).
- Current state `PENDING`, target `ACCEPTED`, and `isSeller`.

Effect: order is now waiting on payment. Nothing else changes — payment is the buyer's move.

### Cancel

From `PENDING`, either side can cancel:

```
PATCH /orders/:id/status { status: "cancelled" }
```

Once payment is held, cancellation is no longer allowed — the order has to flow through delivery or dispute → refund.

## Shipping

When the buyer's escrow lands (`payment.held` fires, listener flips order to `PAID`), the seller's app shows an "I shipped it" button.

```
PATCH /orders/:id/status { status: "in_transit" }
```

Rules: from `PAID`, target `IN_TRANSIT`, `isSeller`.

`OrderDetailScreen.tsx` is responsible for rendering only the action buttons that match the current state and user role.

## Wait for delivery confirmation

Seller can't mark `DELIVERED` themselves — only the buyer can (`IN_TRANSIT → DELIVERED` requires `isBuyer`). This is deliberate: handing the delivery confirmation to the seller would let them release escrow against the buyer's intent.

Either party can flip to `DISPUTED` from `PAID`, `IN_TRANSIT`, or `DELIVERED` if something is wrong.

## Get paid

Two paths:

1. Buyer presses "Release payment" → `POST /payments/:id/release` → escrow released, `order → COMPLETED`.
2. The 7-day auto-release cron flips it for them after `payment.autoReleaseAt`.

In both cases, `PaymentReleasedEvent` is emitted with `sellerAmount`. Today there's no notification module, so the seller learns by refreshing — but the event is the right place to plug in a notification listener (FCM push, SMS, etc.) without touching the payment code.

`sellerAmount = totalPrice - commissionAmount`. With a 5% rate and a 1000 SAR order, the seller receives 950 SAR. Currency is preserved through the chain — no FX conversion in MVP.

## Status semantics for the seller side

| `order.status` | Seller view | Allowed actions for seller |
|---|---|---|
| `PENDING` | "Buyer wants to buy" | accept, cancel |
| `ACCEPTED` | "Waiting for buyer payment" | (none — buyer's move) |
| `PAID` | "Ship it" | mark `IN_TRANSIT`, dispute |
| `IN_TRANSIT` | "On the way" | dispute |
| `DELIVERED` | "Buyer received, waiting for release" | dispute (rare) |
| `COMPLETED` | "Paid out" | — |
| `CANCELLED` | "Order is dead" | — |
| `DISPUTED` | "Admin will resolve" | — |

The buyer view of the same states is in [05 — Buyer Flow](05-buyer-flow.md). UI is split per role through the `OrderListItemResponse` / `OrderDetailResponse` computed fields, not via separate endpoints.

## Brokers

A broker is just a third party recorded on the order via `orders.broker_id`. The role is half-modelled:

- `OrderListItemResponse.fromOrder` recognises the broker as a party when listing orders.
- The certificate-upload endpoint (`POST /certificates`) accepts `SELLER, BROKER`.
- `GET /orders` returns orders where `brokerId = userId` too.

**Not modelled** today:

- No endpoint sets `broker_id` on order creation. (The DTO doesn't accept it.)
- Brokers can't create listings (only sellers can).
- No commission split for brokers.

If a feature requires brokers actively participating in deals, you'll need to:

1. Add `brokerId?` to `CreateOrderDto` (or a separate "appoint broker" endpoint).
2. Decide how a buyer or seller selects a broker — by phone search? Pre-approved list?
3. Decide whether the broker gets a slice of the commission or a flat fee, and add columns to `orders` / `payments`.

## Screens used by sellers

| Screen | Purpose | Key API |
|---|---|---|
| `MyListingsScreen` | Sellers's own listings | `GET /listings/mine` |
| `CreateListingScreen` | New listing form | `POST /uploads/presigned-url`, `POST /listings` |
| `ListingDetailScreen` | Detail (with "Upload certificate" for owner) | `GET /listings/:id` |
| `UploadCertificateScreen` | Attach vet certificate to listing | `POST /uploads/presigned-url`, `POST /certificates` |
| `CertificateDetailScreen` | View existing cert + rejection reason | `GET /certificates/:id` |
| `MyOrdersScreen` | Same list as the buyer's, role-tinted | `GET /orders` |
| `OrderDetailScreen` | Timeline + accept/in_transit/dispute buttons | `GET /orders/:id`, `PATCH /orders/:id/status` |
| `ChatScreen` | Negotiate with buyer | Socket.io `/chat` |
| `KycUploadScreen`, `ProfileScreen`, `EditProfileScreen` | Profile | `/users/me`, `/kyc/*` |

## Common seller-side bugs to look for

- **Editing a listing after it's sold**: The endpoint still permits PATCH on `SOLD`/`EXPIRED`/`FLAGGED` listings. Decide whether to forbid it in `ListingsService.update` if business says listings are immutable post-sale.
- **Deleting a listing with open orders**: `listing.deleted_at` is set, but `orders.listingId` was modelled with `ON DELETE SET NULL` — orders survive. That means buyers will see the order in `/orders/:id` but the `listing` field is `null` and the UI must handle that. Don't surprise yourself; the mobile screen already does the null check.
- **Uploading a certificate without a listingId**: allowed (you can prep certs ahead of time). But then `listing.healthStatus` isn't touched until the seller later attaches the cert. There's no current endpoint to "attach an existing cert to a listing" — they need to upload it again with `listingId` set, or update the listing's `certificateId` via the listing PATCH (not currently exposed in the DTO — open improvement).
- **Forgetting that the buyer marks delivered**: junior devs often write seller-side "Mark as delivered" buttons. Don't; the buyer is the only one with that transition, by design.
