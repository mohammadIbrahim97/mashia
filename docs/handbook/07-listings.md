# 07 — Listings

A listing is a seller's advert: "I have N sheep of breed X to sell for Y per head." It is the central pivot table between sellers, buyers, certificates, and orders.

Authoritative files:

- Entity: `backend/src/modules/listings/listing.entity.ts`
- Service: `backend/src/modules/listings/listings.service.ts`
- Controller: `backend/src/modules/listings/listings.controller.ts`
- DTOs: `backend/src/modules/listings/dto/`
- Mobile service: `mobile/src/services/listings.service.ts`
- Mobile screens: `mobile/src/screens/listings/`

## Data model

```
listings
  id              uuid
  seller_id       uuid  → users.id  ON DELETE CASCADE
  title           varchar(200)
  breed           enum: awassi | najdi | arabi | shami | other
  quantity        int
  age_months      int
  weight_kg       numeric(10,2)
  price_per_head  numeric(12,2)
  currency        enum: SYP | SAR | AED | USD
  origin_country  varchar(100)
  origin_city     varchar(100)
  description     text?
  images          jsonb (array of S3 keys/URLs, 2–10)
  video_url       varchar?
  health_status   enum: certified | pending | unchecked (default: unchecked)
  certificate_id  uuid?  → certificates.id  ON DELETE SET NULL
  status          enum: active | sold | expired | flagged (default: active)
  created_at      timestamp
  updated_at      timestamp
  deleted_at      timestamp?  (soft delete via @DeleteDateColumn)
```

Two of the four enum fields are write-restricted:

- `health_status` is **never set by the seller**. It's driven by the certificate state machine in `CertificatesService` (see [09 — Certificates](09-certificates.md)).
- `status` is `active` on creation. Transitions (sold / expired / flagged) come from order completion and admin moderation, not seller input.

## Endpoints

| Method | Path | Auth | Role | KYC |
|---|---|---|---|---|
| `POST` | `/listings` | JWT | `SELLER` | required |
| `GET` | `/listings` | public | — | — |
| `GET` | `/listings/mine` | JWT | — | not required |
| `GET` | `/listings/:id` | public | — | — |
| `PATCH` | `/listings/:id` | JWT | `SELLER` | required |
| `DELETE` | `/listings/:id` | JWT | `SELLER` | required |

Notes:

- `GET /listings` is **public**. Buyers browse without signing in. The service hard-codes `status = ACTIVE` in the WHERE clause, so soft-deleted and sold/expired listings never appear in the feed.
- `GET /listings/mine` is owner-scoped: returns *all* statuses for the calling user.
- Soft-deleted (`deleted_at IS NOT NULL`) rows are transparently filtered out by TypeORM's default scope.

## Search & filter (`GET /listings`)

DTO: `SearchListingsDto`. All filters optional, AND-combined:

```http
GET /listings?
  breed=awassi          # exact match
  &minPrice=500          # listing.pricePerHead >= 500
  &maxPrice=1500
  &minQuantity=10
  &originCountry=SY      # exact (uppercase ISO)
  &healthStatus=certified
  &sort=newest|price_asc|price_desc
  &page=1
  &limit=20
```

Sort defaults to `newest` (`created_at DESC`). Pagination is offset-based, returning `{ data, total, page, limit }`.

### Performance notes

- The query starts from `listings` and uses `andWhere` to compose filters; nothing is joined. The seller relation is only loaded on the detail endpoint.
- No filter is `LIKE` — text search is not implemented. If you want full-text on `title`/`description`, add a Postgres GIN tsvector index.
- The `status = ACTIVE` filter is the most selective in production, so a composite index `(status, created_at)` may help once the dataset grows. None today (Init migration creates no listing indexes beyond the PK).

## Create

`CreateListingDto`:

```ts
{
  title: string;            // ≤200 chars
  breed: Breed;             // enum
  quantity: number;         // int ≥1
  ageMonths: number;        // int ≥0
  weightKg: number;         // decimal >0
  pricePerHead: number;     // decimal >0
  currency: Currency;       // enum
  originCountry: string;    // ≤100 chars
  originCity: string;       // ≤100 chars
  description?: string;
  images: string[];         // 2..10 entries (S3 keys or URLs)
  videoUrl?: string;
}
```

Service inserts with `sellerId = currentUser.id`, `status = ACTIVE`, `healthStatus = UNCHECKED`. There's no enforcement that images actually exist on S3 — we trust the presigned upload completed before the create call. If a key is bogus, the buyer will see a broken image on the feed and you'll learn fast.

## Update

`UpdateListingDto = PartialType(CreateListingDto)`. The service:

```ts
const listing = await repo.findOne({ where: { id } });
if (!listing) throw NotFoundException;
if (listing.sellerId !== sellerId) throw ForbiddenException;
Object.assign(listing, dto);
return repo.save(listing);
```

Notable: there's no allowlist on which fields can be changed post-creation. A seller could in principle PATCH `quantity` after an order is placed against it — and there's no business logic to prevent shrinking quantity below what's already sold. **Open improvement**: clamp `quantity ≥ sum(open_orders.quantity)` or freeze certain fields once an order exists.

## Delete

`ListingsService.remove` calls `softDelete(id)`. This sets `deleted_at = NOW()` and removes the listing from all default-scope queries.

Existing orders survive — `orders.listing_id` is `ON DELETE SET NULL`. The order keeps `listing_id = null` and the buyer's `OrderDetailScreen` shows the cached title/breed via the snapshot fields on the order itself (but those snapshots only include `unit_price`, `quantity`, `currency` — not breed or title). For now, the listing is left in the order's `listing` relation as `null` and the UI must gracefully handle it.

## Owner views (`GET /listings/mine`)

Returns the same shape as `GET /listings` but:

- Filters by `seller_id = currentUser.id`
- Includes **all** statuses (active, sold, expired, flagged) and soft-deleted is still excluded (because TypeORM's default scope hides `deleted_at`).
- No filter parameters except `page`, `limit`.

This is what `MyListingsScreen` calls.

## Detail endpoint (`GET /listings/:id`)

Loads the listing **with the `seller` relation populated** (`fullName`, `country`, `city`, `kycStatus`). The full `User` entity is returned in the relation — `ProfileResponseDto` is not applied here, so be aware: `kyc_documents`, `password_hash`, etc. are NOT returned because `findOne({ relations: ['seller'] })` brings in the full entity but the serializer in `class-transformer` doesn't strip — **a future improvement is to expose only a `SellerSummaryDto` here**. Right now the entity columns we want to hide (`passwordHash`, `totpSecret`, `kycDocuments`, `kycRejectionReason`, `kycReviewedAt`, `kycReviewedById`) are null for non-admin users, so the leak is small but real.

If you change this: add a `SellerSummary` shape in `dto/` and map manually in `findById`.

## Health status & certificate sync

`listings.health_status` reflects vet certification:

| `health_status` | Meaning |
|---|---|
| `unchecked` | No certificate uploaded (or rejected) |
| `pending` | Certificate uploaded, awaiting admin review |
| `certified` | Admin verified |

Driven by `CertificatesService`:

```
upload(listingId)    → health_status = pending,  listing.certificate_id = newCertId
verify(VERIFIED)     → health_status = certified
verify(REJECTED)     → health_status = unchecked  (and certificate_id is NOT reset — the rejected
                                                   record stays linked so the seller sees why)
```

If a seller uploads a *new* certificate, the previous one is replaced (`listing.certificate_id` is overwritten). The old certificate record stays in the DB but is no longer linked from the listing.

## Indexes

The Init migration creates none beyond the primary key. With volumes today this is fine; if filters slow down, add:

- `(status, created_at DESC)` — the default browse query.
- `(seller_id, created_at DESC)` — `findMine`.
- GIN on `to_tsvector('simple', title || ' ' || description)` if text search is added.

## Mobile-side data layer

`mobile/src/services/listings.service.ts` matches the backend types 1:1. The store (`mobile/src/store/listings.store.ts`) handles:

- Page accumulation for infinite-scroll-ish UX.
- Filter state (the FilterSheet writes here).
- Optimistic insert on create (so the new listing shows up in MyListings immediately, then is reconciled by the response).

## Admin endpoints (still TODO)

The root README lists four admin-listing endpoints that aren't yet shipped:

| Endpoint | Purpose |
|---|---|
| `GET /admin/listings` | Index across all statuses incl. flagged |
| `PATCH /admin/listings/:id/flag` | Set `status = FLAGGED` |
| `DELETE /admin/listings/:id` | Force-remove |
| `GET /admin/listings/:id` | (implicit — detail with seller and order counts) |

When implementing, mirror `AdminController`'s pattern: class-level `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(ADMIN)`. Service work goes in `ListingsService` with names like `flagAsAdmin` / `findForAdmin` to mirror what `UsersService` and `CertificatesService` already do.
