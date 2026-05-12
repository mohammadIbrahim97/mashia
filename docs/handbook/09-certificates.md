# 09 — Certificates

A certificate is a vaccination, health, or origin document attached to a listing and signed off by an admin. They're the trust layer: a buyer should be able to filter the feed by `healthStatus=certified` and trust what they see.

Authoritative files:

- Entity: `backend/src/modules/certificates/certificate.entity.ts`
- Service: `backend/src/modules/certificates/certificates.service.ts`
- Controller: `backend/src/modules/certificates/certificates.controller.ts`
- Admin endpoint: `GET /admin/certificates` lives in `AdminController` but the service method is `CertificatesService.findForAdmin`.
- Migration: `backend/db/migrations/1777600000000-CreateCertificates.ts`
- Mobile: `mobile/src/screens/certificates/UploadCertificateScreen.tsx`, `CertificateDetailScreen.tsx`
- Admin: `admin/src/app/(admin)/certificates/page.tsx` and `[id]/page.tsx`

## Data model

```
certificates
  id                 uuid
  seller_id          uuid    → users.id     ON DELETE CASCADE
  listing_id         uuid?   → listings.id  ON DELETE SET NULL
  type               enum: vaccination | health | origin
  issuing_authority  varchar(200)
  issue_date         date
  expiry_date        date
  file_url           varchar          (S3 key; presigned at read time)
  status             enum: pending | verified | rejected   (default: pending)
  verified_by_id     uuid?   → users.id     ON DELETE SET NULL
  verified_at        timestamptz?
  rejection_reason   text?
  created_at, updated_at
```

`listings.certificate_id` points back; cardinality is 0..1 — a listing has at most one active certificate. When a seller uploads a new one, the new id replaces the previous in `listings.certificate_id` and the old record is orphaned (not deleted).

Indexes: `seller_id`, `listing_id`, `status`. The status index supports the admin pending-queue.

## Trader endpoints

| Method | Path | Auth | Role | KYC |
|---|---|---|---|---|
| `POST` | `/certificates` | JWT | `SELLER`, `BROKER` | required |
| `GET` | `/certificates/:id` | JWT | (any auth user) | — |
| `PATCH` | `/certificates/:id/verify` | JWT | `ADMIN` | — |

`POST /certificates` uses `UploadCertificateDto`:

```ts
{
  listingId?: string;     // optional — can prep certs ahead of attaching
  type: CertificateType;
  issuingAuthority: string;
  issueDate: string;      // ISO date (YYYY-MM-DD)
  expiryDate: string;     // must be >= issueDate
  fileUrl: string;        // S3 key returned by /uploads/presigned-url
}
```

Server-side rules (in `CertificatesService.create`):

- `expiryDate >= issueDate` (else 400).
- If `listingId` is given:
  - Listing must exist (else 404).
  - Listing must belong to the same seller (else 403).
- Inserts certificate with `status = PENDING`.
- If `listingId`, also: `listings.certificate_id = <new>`, `listings.health_status = PENDING`.

`GET /certificates/:id` returns the entity as-is. Any authenticated user can view a certificate today (no party check) — useful for buyers who want to inspect the document on the listing page. The `file_url` field is the S3 key; the client must call `/uploads/presigned-url` separately to mint a signed read URL, or you can switch the controller to return a presigned URL inline. **Today: client is responsible for signing.**

## Admin endpoints

| Method | Path | Auth | Role | Effect |
|---|---|---|---|---|
| `GET` | `/admin/certificates?status=&page=&pageSize=` | JWT | `ADMIN` | Paginated list with seller and listing joins |
| `PATCH` | `/certificates/:id/verify` | JWT | `ADMIN` | Approve or reject |

`GET /admin/certificates` uses `CertificatesService.findForAdmin`. It:

- Defaults to **all** statuses if `status` is omitted or `'all'`.
- Joins `seller` (selects `fullName`) and `listing` (selects `title`) — those are projected into `sellerName` / `listingTitle` on each item.
- Orders by `createdAt DESC`.
- Page size capped at 100.

### Verify

```http
PATCH /certificates/:id/verify
{ "status": "verified" | "rejected", "rejectionReason"?: "..." }
```

Rules (`CertificatesService.verify`):

- `status === 'pending'` → 400 (can't undo).
- `status === 'rejected'` without `rejectionReason` → 400.
- Sets `status`, `verifiedById`, `verifiedAt`, `rejectionReason` (nulled on verified).
- If the cert is linked to a listing:
  - `VERIFIED` → `listings.health_status = CERTIFIED`.
  - `REJECTED` → `listings.health_status = UNCHECKED`. **Note**: `listings.certificate_id` is *not* unset — the rejected record stays linked so the seller can see the rejection reason. If they upload a new one, the new id replaces it.

## Mobile flow

```
Seller on a listing without a cert
   └─ "Upload certificate" button
        ├─ UploadCertificateScreen
        │   ├─ pick type: vaccination | health | origin
        │   ├─ issuing authority, issue date, expiry date
        │   ├─ pick file (image)
        │   ├─ POST /uploads/presigned-url { purpose: "certificate", ... }
        │   ├─ PUT to uploadUrl (direct to S3)
        │   └─ POST /certificates { listingId, type, ..., fileUrl: key }
        └─ back to listing — now shows "View certificate" with PENDING badge

Buyer on a listing with a cert
   └─ "View certificate" — opens CertificateDetailScreen
        ├─ GET /certificates/:id
        ├─ fetch presigned read URL for the file
        └─ render image + metadata + status badge
```

The seller's view of `CertificateDetailScreen` includes the rejection reason if status is `REJECTED`.

## Admin UI

`admin/src/app/(admin)/certificates/page.tsx` is the list. Tabs (Pending / Verified / Rejected / All) hit `GET /admin/certificates?status=...` for each.

`admin/src/app/(admin)/certificates/[id]/page.tsx` is the detail with **Approve / Reject** buttons. The reject button opens a `ConfirmDialog` with a required-reason textarea. Both buttons call `PATCH /certificates/:id/verify`.

The shared `ConfirmDialog` component (`admin/src/components/ui/ConfirmDialog.tsx`) is reused for any "Are you sure? + optional/required reason" pattern; expect to see it again for user-suspend, listing-flag, and order-dispute resolution as those sections are built.

## How `health_status` flows

```
listing created                                listings.health_status = UNCHECKED
   │
   ▼
seller uploads cert (links by listingId)       listings.health_status = PENDING
   │                                            listings.certificate_id  = newCertId
   ▼
admin verifies → VERIFIED                      listings.health_status = CERTIFIED
   ▼
admin verifies → REJECTED                      listings.health_status = UNCHECKED
                                                listings.certificate_id stays — UI shows rejection reason
   ▼
seller uploads a fresh cert                    listings.health_status = PENDING (again)
                                                listings.certificate_id = newerCertId
```

The `health_status` field is what buyers filter on; the certificate's own `status` is what admins manage. They move in lock-step but they're different columns on different tables.

## Future work

- **Expiry scheduler** (#61): a daily cron that finds `certificates` with `expiry_date < NOW()` and flips the linked listing's `health_status` back to `UNCHECKED`. Not built yet. When you add it, mirror the pattern in `PaymentsService.processAutoReleases` — `@Cron` plus a transaction with `skip_locked` if you ever scale to multiple replicas.
- **Multi-certificate per listing**: today the model is 0..1. If a listing should carry both a vaccination and an origin cert simultaneously, drop the `listings.certificate_id` column and query certificates by `listing_id` directly. That refactor would also kill the "old cert orphaned" pattern in favour of an explicit `is_active` boolean on certificates.
- **Read URL signing on the server**: today the mobile client has to mint its own presigned read URL via `/uploads/presigned-url`. A cleaner option is for `GET /certificates/:id` to return the file URL already signed (15-minute TTL). Mirrors the admin user-detail pattern.
