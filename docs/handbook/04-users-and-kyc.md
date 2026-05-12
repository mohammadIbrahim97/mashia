# 04 — Users & KYC

## The `users` table is the universe

Every actor in the system is a row in `users`. There are no separate buyer, seller, broker, or admin tables — discrimination happens by:

- `role` ∈ `{seller, buyer, broker, admin}`
- `kyc_status` ∈ `{pending, verified, rejected}`
- `suspended` (boolean)
- `password_hash` / `totp_enabled` (admins only; null for traders)

For the table layout see [12 — Database schema](12-database-schema.md). This chapter focuses on **how to write code against it**.

## Roles

Defined in `backend/src/shared/enums/index.ts`:

```ts
export enum UserRole {
  SELLER = 'seller',   // can create listings, upload certificates, accept orders, mark in-transit
  BUYER  = 'buyer',    // can place orders, initiate payment, mark delivered, release escrow
  BROKER = 'broker',   // can upload certificates; modelled in orders.broker_id but not yet wired
  ADMIN  = 'admin',    // can do admin-only routes; bypasses KYC guard via verified status
}
```

Two things to remember:

1. The role lives on the JWT payload (`{ sub, phone, role }`). `JwtStrategy.validate` re-fetches the user, so a role change in the DB takes effect on the *next* request from that user.
2. `RolesGuard` permits the route if `requiredRoles.includes(user.role)`. **No "OR"** semantics across roles for KYC — you can only constrain by role, not by KYC + role.

## Profile endpoints (trader)

`backend/src/modules/users/users.controller.ts` — minimal:

| Method | Path | Auth | Returns |
|---|---|---|---|
| `GET` | `/users/me` | `JwtAuthGuard` | `ProfileResponseDto` |
| `PATCH` | `/users/me` | `JwtAuthGuard` | updated `ProfileResponseDto` |

`UpdateProfileDto` lets the trader edit:

- `fullName`, `email`, `country`, `city`, `preferredLanguage`

It explicitly does **not** let them change `role`, `phone`, `kycStatus`, `suspended`, or admin-only fields. Anything outside the DTO's whitelist is rejected by `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`.

If you need to add a profile field, the change is in three places: `User` entity, migration, `UpdateProfileDto`. `ProfileResponseDto.fromUser()` filters fields exposed to the client — sensitive columns (`password_hash`, `totp_secret`, `kyc_documents` raw, KYC review metadata) are not returned by `/users/me`.

## The KYC lifecycle

```
              [trader]
                 │
                 │ POST /kyc/submit  (multipart: nationalId, selfie?, businessLicense?)
                 ▼
            ┌─────────────────┐
            │ kyc_status =    │
            │ PENDING         │
            │ kyc_documents = │
            │ { nationalId,   │
            │   selfie?, … }  │
            └─────────────────┘
                 │
                 │            [admin]
                 │      PATCH /admin/users/:id/kyc { decision, rejectionReason? }
                 ▼
        ┌───────────────────┐         ┌───────────────────┐
        │ kyc_status =      │         │ kyc_status =      │
        │ VERIFIED          │         │ REJECTED          │
        │                   │         │ kyc_rejection_    │
        │ (KycVerifiedGuard │         │ reason = "..."    │
        │ passes thereafter)│         │                   │
        └───────────────────┘         └───────────────────┘
```

The reviewer's id and timestamp are recorded: `kyc_reviewed_by_id`, `kyc_reviewed_at`.

### Submission rules

`KycService.validateRoleRules` — required documents depend on role:

| Role | Required | Allowed | Forbidden |
|---|---|---|---|
| `buyer` | `nationalId` | `nationalId` only | `selfie`, `businessLicense` (400 if present) |
| `seller`, `broker` | `nationalId`, `selfie` | + optional `businessLicense` | — |
| `admin` | — | — | `BadRequestException('This role cannot submit KYC documents')` |

Files are validated by `kyc-file.validator.ts` (MIME type + magic bytes) and capped at **5 MiB** each by `FileFieldsInterceptor`.

Files land in S3 under `kyc/<userId>/<docType>-<uuid>.<ext>`. Successful upload writes:

- `users.kyc_documents = { nationalId: "<s3-key>", selfie?: "<s3-key>", ... }`
- `users.kyc_status = PENDING`

### Replacing a previous submission

`KycService.submit` runs:

1. Reject if already `VERIFIED` (must contact support).
2. Upload all new files. **Rollback** any partial uploads on error.
3. Delete the *old* S3 objects from `user.kyc_documents` (best effort — failures are swallowed).
4. Atomically update both columns.

There's no separate "draft" state — submission either succeeds and goes to PENDING, or fails and leaves the user untouched.

### Reading the documents back

For the trader: `GET /kyc/status` returns:

```jsonc
{
  "kycStatus": "pending",
  "submitted": true,
  "documents": {
    "nationalId": true,
    "selfie": true,
    "businessLicense": false
  },
  "submittedAt": "2026-04-30T..."
}
```

The trader sees booleans, not URLs. They can't download their own KYC docs.

For the admin: `GET /admin/users/:id` returns `AdminUserDetail`, which includes `kycDocumentUrls` — each S3 key is signed with a **15-minute** presigned read URL (`getSignedReadUrl(key, 900)`). Always show the freshly-fetched URL; don't store it.

### Admin review API

```http
PATCH /admin/users/:id/kyc
{ "decision": "verified" | "rejected", "rejectionReason"?: "..." }
```

Rules in `UsersService.reviewKyc`:

- `decision === 'pending'` → 400 (no "un-review" path).
- `decision === 'rejected'` without `rejectionReason` → 400.
- On success, sets `kyc_status`, `kyc_reviewed_by_id`, `kyc_reviewed_at`, and `kyc_rejection_reason` (cleared on verify).

There is **no domain event** emitted on KYC change today. If you add a notification flow, emit a `UserKycReviewedEvent` from this service rather than from the controller — same pattern as `OrdersService`.

## Suspension

```http
PATCH /admin/users/:id/suspend     (no body)
PATCH /admin/users/:id/unsuspend
```

Calls `UsersService.setSuspended(id, true|false)`. Effect: `JwtStrategy.validate` rejects every request from that user with `401 Account suspended`. The user's tokens are not invalidated proactively — they keep them in their keychain, but they hit 401 immediately on next use.

There is no way for a user to "appeal" via the API today. Admin must manually `unsuspend`.

## Where guards meet roles in the wild

A summary of every endpoint that filters by role or KYC:

| Endpoint | `@Roles(...)` | `KycVerifiedGuard` |
|---|---|---|
| `POST /listings` | `SELLER` | yes |
| `PATCH /listings/:id` | `SELLER` | yes |
| `DELETE /listings/:id` | `SELLER` | yes |
| `POST /orders` | `BUYER` | yes |
| `PATCH /orders/:id/status` | (any party) | no — checks `buyerId === userId` or `sellerId === userId` in service |
| `POST /certificates` | `SELLER`, `BROKER` | yes |
| `PATCH /certificates/:id/verify` | `ADMIN` | no |
| `POST /payments/initiate` | (no role) | no — verifies `order.buyerId === userId` |
| `POST /payments/:id/release` | (no role) | no — checks `payment.payerId === userId` |
| `POST /payments/:id/refund` | `ADMIN` | no |
| `GET /admin/**` | `ADMIN` (class-level) | no |
| `POST /kyc/submit` | (no role) | no — that would deadlock |
| `GET /users/me`, `PATCH /users/me` | (no role) | no |

If you add a write endpoint that the trader hits, default to `JwtAuthGuard + RolesGuard + KycVerifiedGuard + @Roles(<owner>)` unless you have a reason not to.

## Admin views of users

`backend/src/modules/admin/admin.controller.ts` exposes:

| Method | Path | Service call |
|---|---|---|
| `GET` | `/admin/users?role=&kycStatus=&q=&page=&pageSize=` | `UsersService.findForAdmin` |
| `GET` | `/admin/users/:id` | `UsersService.findByIdForAdmin` (includes signed KYC URLs) |
| `PATCH` | `/admin/users/:id/kyc` | `UsersService.reviewKyc` |
| `PATCH` | `/admin/users/:id/suspend` | `UsersService.setSuspended(true)` |
| `PATCH` | `/admin/users/:id/unsuspend` | `UsersService.setSuspended(false)` |

`findForAdmin` uses an `ILIKE` search (`q`) across `full_name`, `phone`, `email`, sorts by `created_at DESC`, and caps `pageSize` at 100. Pagination uses `(page-1)*pageSize` — fine for the dashboard size; switch to keyset pagination later if you start serving lists in the hundreds of thousands.

`findByIdForAdmin` signs every S3 key in `kyc_documents` with a 15-minute presigned URL before returning, so the admin UI doesn't need to call uploads service separately.

## Common pitfalls

- **Don't bypass KYC by setting `kyc_status` directly in code.** The only sanctioned writes are `UsersService.updateKycDocuments` (during submission, → PENDING) and `UsersService.reviewKyc` (admin review). The seed script can set it to `verified` because seeds are dev-only.
- **Don't expose `passwordHash`, `totpSecret`, or raw `kycDocuments` keys.** `ProfileResponseDto.fromUser()` filters them out. If you add a new response type, mirror this.
- **Don't compare roles with strings.** `if (user.role === 'admin')` works but stops the linter from catching renames. Use the enum: `if (user.role === UserRole.ADMIN)`.
- **Don't put the user's S3 KYC URL in a response that doesn't require the admin role.** Buyers and sellers should not be able to view each other's documents.
