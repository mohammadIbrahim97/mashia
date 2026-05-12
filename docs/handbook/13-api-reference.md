# 13 — API Reference

This is the authoritative endpoint list as of the merge that includes the Admin/Certificates section. Every endpoint is mounted under the global prefix `/api/v1`, so a path of `/auth/login` is really `POST http://<host>/api/v1/auth/login`.

Every response is wrapped by `TransformInterceptor` in `{ success: true, data: <payload> }` unless the request errored before the interceptor (e.g. validation failures). Clients use `unwrap()` to peel.

Legend for the auth column:

- **public**: no auth required.
- **JWT**: requires `Authorization: Bearer <accessToken>`.
- **JWT + role**: also requires a role in `@Roles(...)`.
- **JWT + KYC**: also requires `kyc_status = verified`.

## Auth (trader)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| `POST` | `/auth/otp/send` | public | `{ phone }` | Rate-limited to 5/hour per phone. `phone` must match E.164. |
| `POST` | `/auth/otp/verify` | public | `{ phone, code }` | Peek-only — does NOT consume the OTP. Returns `{ verified, userExists }`. |
| `POST` | `/auth/register` | public | `{ phone, code, role, fullName, country, city, email?, preferredLanguage? }` | `role` ∈ `{seller, buyer, broker}` only (admin blocked). Consumes the OTP. Returns `{ accessToken, refreshToken, user }`. |
| `POST` | `/auth/login` | public | `{ phone, code }` | Consumes the OTP. Returns same envelope as `/register`. |
| `POST` | `/auth/refresh` | public | `{ refreshToken }` | Returns a new pair; old refresh token's `jti` is blacklisted in Redis. |

## Auth (admin)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| `POST` | `/auth/admin/login` | public | `{ email, password }` | Returns either `{ accessToken, refreshToken, user }` or `{ requiresTotp: true, ticket }`. |
| `POST` | `/auth/admin/totp/verify` | public | `{ ticket, code }` | Completes a TOTP-enabled login. |
| `POST` | `/auth/admin/totp/setup` | JWT + `ADMIN` | — | Generates a TOTP secret; returns `{ secret, otpauthUrl }`. Doesn't enable yet. |
| `POST` | `/auth/admin/totp/enable` | JWT + `ADMIN` | `{ code }` | Verifies the code and flips `totp_enabled = true`. |

## Users (self)

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| `GET` | `/users/me` | JWT | — | Returns `ProfileResponseDto` — sensitive fields (`passwordHash`, `totpSecret`, `kycDocuments` raw, KYC review metadata) are filtered out. |
| `PATCH` | `/users/me` | JWT | `{ fullName?, email?, country?, city?, preferredLanguage? }` | Cannot change role, phone, kyc_status, or admin fields. |

## KYC

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| `POST` | `/kyc/submit` | JWT | `multipart/form-data` with fields `nationalId`, optional `selfie`, optional `businessLicense` | Buyers must send only `nationalId`; sellers/brokers must send `nationalId` + `selfie`. Max 5 MiB per file. |
| `GET` | `/kyc/status` | JWT | — | Returns `{ kycStatus, submitted, documents: { nationalId, selfie, businessLicense }, submittedAt }`. |

## Uploads

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| `POST` | `/uploads/presigned-url` | JWT | `{ purpose, contentType, fileName }` | Returns `{ uploadUrl, fileUrl, key, expiresIn: 300 }`. Upload via direct `PUT` to `uploadUrl`. Read URL TTL is 7 days. |

`purpose` is a free-string namespace — `listing`, `certificate`, `chat` are the conventional values; the service uses it as the S3 key prefix.

## Listings

| Method | Path | Auth | Body / query | Notes |
|---|---|---|---|---|
| `POST` | `/listings` | JWT + `SELLER` + KYC | `CreateListingDto` | Inserts active, unchecked health. |
| `GET` | `/listings` | public | `breed, minPrice, maxPrice, minQuantity, originCountry, healthStatus, sort, page, limit` | Returns `{ data, total, page, limit }`. Only `status = active` and non-soft-deleted. |
| `GET` | `/listings/mine` | JWT | `page, limit` | All statuses for the calling user. |
| `GET` | `/listings/:id` | public | — | Returns listing with `seller` relation. |
| `PATCH` | `/listings/:id` | JWT + `SELLER` + KYC | `PartialType(CreateListingDto)` | Ownership-checked. |
| `DELETE` | `/listings/:id` | JWT + `SELLER` + KYC | — | Soft delete (`deleted_at`). |

## Orders

| Method | Path | Auth | Body / query | Notes |
|---|---|---|---|---|
| `POST` | `/orders` | JWT + `BUYER` + KYC | `{ listingId, quantity, unitPrice, deliveryCountry, deliveryCity, deliveryAddress, brokerId? }` | Validates listing is `ACTIVE` and not own listing. Computes commission server-side. |
| `GET` | `/orders` | JWT | `status[]=&page=&pageSize=` | Returns orders where caller is buyer, seller, or broker. |
| `GET` | `/orders/:id` | JWT | — | Returns `OrderDetailResponse` — counterparty info and computed UI hints. Party-check; 404 if not. |
| `PATCH` | `/orders/:id/status` | JWT | `{ status: OrderStatus }` | Enforces state machine + actor role. See [chapter 08](08-orders-payments-escrow.md). |

## Payments

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| `POST` | `/payments/initiate` | JWT | `{ orderId, method }` | `method` ∈ `{stc_pay, mada, bank_transfer}`. Requires order in `ACCEPTED`. Unique-per-order — second initiation returns 409. |
| `POST` | `/payments/:id/release` | JWT | — | Caller must be `payerId`. Requires `escrow_status = held` and order in `DELIVERED`. |
| `POST` | `/payments/:id/refund` | JWT + `ADMIN` | — | Requires `escrow_status = held` and order in `DISPUTED`. |
| `GET` | `/payments/by-order/:orderId` | JWT | — | Party-check on the underlying order. |
| `GET` | `/payments/:id` | JWT | — | Caller must be payer, the order's seller, or admin. |

## Certificates

| Method | Path | Auth | Body / query | Notes |
|---|---|---|---|---|
| `POST` | `/certificates` | JWT + `SELLER \| BROKER` + KYC | `{ listingId?, type, issuingAuthority, issueDate, expiryDate, fileUrl }` | If `listingId` is supplied, the listing must belong to the caller. Sets `listing.health_status = PENDING`. |
| `GET` | `/certificates/:id` | JWT | — | Returns the certificate entity. `file_url` is the raw S3 key; sign separately via `/uploads/presigned-url`. |
| `PATCH` | `/certificates/:id/verify` | JWT + `ADMIN` | `{ status, rejectionReason? }` | `status` ∈ `{verified, rejected}`. `rejectionReason` required on reject. Cross-updates `listings.health_status`. |

## Messaging (REST)

| Method | Path | Auth | Body / query | Notes |
|---|---|---|---|---|
| `POST` | `/messaging/conversations` | JWT | `{ participantIds[], listingId?, orderId? }` | Caller must be in `participantIds`. Find-or-create — returns 200 if found, 201 if created. |
| `GET` | `/messaging/conversations?page=&limit=` | JWT | — | Returns list with `lastMessage` and `unreadCount` per row. |
| `GET` | `/messaging/conversations/:id/messages?before=&limit=` | JWT | — | Cursor pagination by message id. |

## Messaging (Socket.io)

Namespace `/chat`. Authenticate by `socket.handshake.auth.token = <accessToken>`.

| Event (client → server) | Payload | Ack |
|---|---|---|
| `joinConversation` | `{ conversationId }` | `{ ok, error? }` |
| `sendMessage` | `{ conversationId, content, type? }` | `{ ok, error?, message? }` |
| `typing` | `{ conversationId, isTyping }` | `{ ok, error? }` |
| `markRead` | `{ conversationId, messageIds[] }` | `{ ok, error?, updated?, readAt? }` |

| Event (server → client, broadcast to room) | Payload |
|---|---|
| `newMessage` | `Message` entity |
| `userTyping` | `{ conversationId, userId, isTyping }` |
| `messageRead` | `{ messageIds, readerId, readAt }` |

Ack errors are one of `invalid_payload \| unauthorized \| not_found \| forbidden`.

## Admin

All under `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(ADMIN)`.

| Method | Path | Body / query | Status |
|---|---|---|---|
| `GET` | `/admin/certificates?status=&page=&pageSize=` | — | **shipped** |
| `GET` | `/admin/users?role=&kycStatus=&q=&page=&pageSize=` | — | shipped |
| `GET` | `/admin/users/:id` | — | shipped — includes signed KYC URLs |
| `PATCH` | `/admin/users/:id/kyc` | `{ decision: 'verified' \| 'rejected', rejectionReason? }` | shipped |
| `PATCH` | `/admin/users/:id/suspend` | — | shipped |
| `PATCH` | `/admin/users/:id/unsuspend` | — | shipped |
| `GET` | `/admin/dashboard` | — | TODO |
| `GET` | `/admin/listings` | — | TODO |
| `PATCH` | `/admin/listings/:id/flag` | — | TODO |
| `DELETE` | `/admin/listings/:id` | — | TODO |
| `GET` | `/admin/orders` | — | TODO |
| `POST` | `/admin/payments/:id/release` | — | TODO (different from buyer's release — admin-driven dispute resolution) |
| `GET` | `/admin/payments` | — | TODO |
| `GET` | `/admin/revenue` | — | TODO |

## Response shapes

### Standard envelope

```jsonc
{
  "success": true,
  "data": { ... }    // the controller's return value
}
```

### Paginated lists

Controllers return `{ data: T[], total: number, page: number, limit: number }` (listings) or `{ items: T[], total, page, pageSize, totalPages }` (orders, admin user list). Be consistent within a new endpoint — pick one shape, don't mix.

### Errors

NestJS shape, **not wrapped**:

```jsonc
{
  "statusCode": 400,
  "message": ["expiryDate must be a Date instance"],   // string or array
  "error": "Bad Request"
}
```

The mobile and admin clients have an `errorMessage(err, fallback)` helper that unwraps either shape and returns a user-displayable string.

## Conventions to follow when adding a new endpoint

- Mount it on the right controller — don't create a new one if it belongs to an existing aggregate.
- DTO with `class-validator` decorators; the global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` will reject unknown fields.
- Use `@CurrentUser()` to access the authenticated user.
- For ID params, use `@Param('id', ParseUUIDPipe)`.
- For pagination, accept `page` and `limit`/`pageSize` (be consistent with the rest of the module).
- For state-changing trader endpoints, default to `JwtAuthGuard + RolesGuard + KycVerifiedGuard + @Roles(<owner-role>)`.
- For admin endpoints, mount under `AdminController` (class-level guards already applied).
- Return DTOs / mapped shapes for sensitive entities (users), or raw entities for non-sensitive ones (listings). Never return `User` entity directly from a non-admin endpoint.
- Emit events at the **service** boundary (not the controller) when the change is observable to other modules.
