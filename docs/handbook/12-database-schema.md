# 12 — Database Schema

PostgreSQL 16. All tables use UUID primary keys (`uuid_generate_v4()`). Timestamps are `TIMESTAMP WITH TIME ZONE` unless noted; older tables (created in the `Init` migration) use plain `TIMESTAMP` and the codebase treats them as UTC.

The TypeORM `synchronize` flag is **off** outside of test environments — every schema change must go through a migration file in `backend/db/migrations/`.

## Tables at a glance

```
users (1) ─── (N) listings ─── (0..1) certificates
  │              │                          ▲
  │              │                          │
  │              └── (N) orders ──── (0..1) payments
  │                       │
  │                       └── (N) conversations ── (N) messages
  │
  └── (N) certificates.seller_id, certificates.verified_by_id,
          orders.buyer_id, orders.seller_id, orders.broker_id,
          payments.payer_id, messages.sender_id,
          conversations.participant_ids[]
```

## `users`

Authoritative file: `backend/src/modules/users/user.entity.ts`. Spans both traders and admins (one table by design — see "Why one users table" below).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `role` | `users_role_enum` | `seller \| buyer \| broker \| admin` |
| `full_name` | `varchar` NOT NULL | |
| `phone` | `varchar` NOT NULL | UNIQUE. Trader login key. Admins get a synthetic `+admin-<ts>` value. |
| `email` | `varchar` NULL | Admin login key. Partial unique index `WHERE role = 'admin'`. |
| `country` | `varchar` NOT NULL | ISO country code (e.g. `SA`). |
| `city` | `varchar` NOT NULL | |
| `kyc_status` | `users_kyc_status_enum` | `pending \| verified \| rejected`. Default `pending`. |
| `kyc_documents` | `jsonb` NULL | `{ nationalId: "<s3-key>", selfie: "<s3-key>", businessLicense?: "<s3-key>" }`. |
| `preferred_language` | `users_preferred_language_enum` | `ar \| tr \| en`. Default `ar`. |
| `password_hash` | `varchar` NULL | bcrypt hash, 12 rounds. Only admins have this. |
| `totp_secret` | `varchar` NULL | base32 secret. Set during `/auth/admin/totp/setup`. |
| `totp_enabled` | `boolean` | Flipped true after `/auth/admin/totp/enable`. |
| `suspended` | `boolean` | True blocks JWT validation (see `JwtStrategy.validate`). |
| `kyc_rejection_reason` | `text` NULL | Required when admin rejects KYC. |
| `kyc_reviewed_at` | `timestamptz` NULL | |
| `kyc_reviewed_by_id` | `uuid` NULL | FK → `users.id` (the admin who reviewed). |
| `created_at`, `updated_at` | `timestamp` | |

**Indexes & constraints**

- `phone` unique.
- `idx_users_admin_email_unique`: partial unique index on `email WHERE role = 'admin'` (lets traders share `null` email but forces admins to have a unique one).
- `idx_users_kyc_status` on `kyc_status`.
- `idx_users_suspended_true`: partial index `WHERE suspended = true`.
- `FK_users_kyc_reviewed_by_id`: `kyc_reviewed_by_id` → `users.id` on delete `SET NULL`.

### Why one `users` table

Earlier drafts had `traders` and `admins` separate. We merged them because:

- Both flows ultimately mint the same JWT shape `{ sub, phone, role }`.
- An admin can be added or revoked by editing the role column without data migration.
- Foreign keys (`orders.broker_id`, `kyc_reviewed_by_id`, `certificates.verified_by_id`) all point at "any user", regardless of role.

The price is null-heavy auth columns (password/TOTP for traders, kyc fields for admins). Worth it.

## `listings`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `seller_id` | `uuid` NOT NULL | FK → `users.id` (`ON DELETE CASCADE`) |
| `title` | `varchar(200)` | |
| `breed` | `listings_breed_enum` | `awassi \| najdi \| arabi \| shami \| other` |
| `quantity` | `int` | |
| `age_months` | `int` | |
| `weight_kg` | `numeric(10,2)` | |
| `price_per_head` | `numeric(12,2)` | |
| `currency` | `listings_currency_enum` | `SYP \| SAR \| AED \| USD` |
| `origin_country` / `origin_city` | `varchar(100)` | |
| `description` | `text` NULL | |
| `images` | `jsonb` NOT NULL | Array of S3 keys/URLs (validated 2–10 in `CreateListingDto`). |
| `video_url` | `varchar` NULL | |
| `health_status` | `listings_health_status_enum` | `certified \| pending \| unchecked`. Default `unchecked`. Driven by certificate verification. |
| `certificate_id` | `uuid` NULL | FK → `certificates.id` (`ON DELETE SET NULL`). |
| `status` | `listings_status_enum` | `active \| sold \| expired \| flagged`. Default `active`. |
| `created_at`, `updated_at`, `deleted_at` | timestamps | Soft delete via `@DeleteDateColumn`. |

## `orders`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `listing_id` | `uuid` NULL | `ON DELETE SET NULL` — preserve order history if a listing is removed. |
| `buyer_id` | `uuid` NOT NULL | FK → `users.id` cascade |
| `seller_id` | `uuid` NOT NULL | Denormalised from `listing.seller_id` so admin queries don't need a 3-way join. |
| `broker_id` | `uuid` NULL | Optional intermediary. `ON DELETE SET NULL`. |
| `quantity` | `int` | |
| `unit_price` | `numeric(12,2)` | |
| `currency` | `orders_currency_enum` | Snapshot of `listing.currency` at order time. |
| `total_price` | `numeric(14,2)` | `quantity * unit_price`, server-computed. |
| `commission_rate` | `numeric(5,2)` | Default `5.00` (%). |
| `commission_amount` | `numeric(14,2)` | `total_price * commission_rate / 100`. |
| `status` | `orders_status_enum` | See state diagram in [chapter 08](08-orders-payments-escrow.md). |
| `delivery_country` / `delivery_city` / `delivery_address` | strings | |
| `created_at`, `updated_at` | timestamp | |

Enum order: `pending → accepted → paid → in_transit → delivered → completed`, with side branches `cancelled` and `disputed`.

## `payments`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `order_id` | `uuid` NOT NULL | **UNIQUE** — exactly one payment per order, enforced at the DB level. |
| `payer_id` | `uuid` NOT NULL | The buyer; cascades on user delete. |
| `amount` | `numeric(14,2)` | Equals `order.total_price` at initiation. |
| `commission_amount` | `numeric(14,2)` | Snapshot. |
| `seller_amount` | `numeric(14,2)` | `amount - commission_amount`. |
| `currency` | `payments_currency_enum` | |
| `method` | `payments_method_enum` | `stc_pay \| mada \| bank_transfer` |
| `escrow_status` | `payments_escrow_status_enum` | `held \| released \| refunded`. Default `held`. |
| `transaction_ref` | `text` | Reference returned by `EscrowService.holdFunds` (today: `STUB-<uuid>`). |
| `auto_release_at` | `timestamptz` NULL | Set 7 days after `OrderDeliveredEvent`. Cron releases held payments past this. |
| `paid_at` | `timestamptz` NOT NULL | When the buyer initiated payment. |
| `released_at` / `refunded_at` | `timestamptz` NULL | Terminal timestamps. |
| `created_at`, `updated_at` | timestamp | |

**Indexes**

- `IDX_b2f7b823...` — unique on `order_id`.
- `idx_payments_auto_release_held`: partial index on `auto_release_at WHERE escrow_status = 'held'`. Used by the auto-release cron — keeps the scan tiny.

## `certificates`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `seller_id` | `uuid` NOT NULL | FK → `users.id` cascade. |
| `listing_id` | `uuid` NULL | Cert may be uploaded before being attached. `ON DELETE SET NULL`. |
| `type` | `certificates_type_enum` | `vaccination \| health \| origin` |
| `issuing_authority` | `varchar(200)` | |
| `issue_date` / `expiry_date` | `date` | |
| `file_url` | `varchar` | S3 key (presigned by the uploads service for read). |
| `status` | `certificates_status_enum` | `pending \| verified \| rejected`. Default `pending`. |
| `verified_by_id` | `uuid` NULL | FK → `users.id` (the reviewing admin). |
| `verified_at` | `timestamptz` NULL | |
| `rejection_reason` | `text` NULL | Required when rejecting. |
| `created_at`, `updated_at` | timestamp | |

**Indexes**: by `seller_id`, by `listing_id`, by `status`.

**Cross-table effect**: when a certificate flips to `VERIFIED`, the service updates `listings.health_status = certified`. On `REJECTED` it goes back to `unchecked`. See `CertificatesService.verify`.

## `conversations`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `participant_ids` | `uuid[]` NOT NULL | Sorted array. Used as the equality key for find-or-create. |
| `listing_id` | `uuid` NULL | FK → `listings.id` cascade-null. |
| `order_id` | `uuid` NULL | FK → `orders.id` cascade-null. |
| `last_message_at` | `timestamptz` NULL | Touched by `sendMessage` for sort ordering. |
| `created_at`, `updated_at` | `timestamptz` | |

**Indexes**

- `idx_conversations_participant_ids` — **GIN** index on `participant_ids` for `:uid = ANY(...)` lookups.
- `idx_conversations_listing_id`.

`findOrCreateConversation` sorts the participant array before lookup so `[A, B]` and `[B, A]` map to the same row.

## `messages`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `conversation_id` | `uuid` NOT NULL | FK cascade. |
| `sender_id` | `uuid` NOT NULL | FK `ON DELETE RESTRICT` — we never want to lose authorship via cascading deletes. |
| `content` | `text` | For `IMAGE` and `CERTIFICATE` types, this is the URL/ID; for `TEXT` it's the literal text. |
| `type` | `messages_type_enum` | `text \| image \| certificate \| offer`. Default `text`. |
| `read_at` | `timestamptz` NULL | NULL = unread. |
| `created_at` | `timestamptz` | No `updated_at` — messages are immutable. |

**Indexes**: `idx_messages_conversation_created` on `(conversation_id, created_at)` — backs the paginated `listMessages` query.

## Enum mapping (TypeScript ⇄ Postgres)

The enums in `backend/src/shared/enums/index.ts` are the canonical source. Each one has a matching Postgres ENUM created in a migration:

| TS enum | Postgres type |
|---|---|
| `UserRole` | `users_role_enum` |
| `KycStatus` | `users_kyc_status_enum` |
| `PreferredLanguage` | `users_preferred_language_enum` |
| `Breed` | `listings_breed_enum` |
| `Currency` | `listings_currency_enum`, `orders_currency_enum`, `payments_currency_enum` (three identical clones, one per table) |
| `HealthStatus` | `listings_health_status_enum` |
| `ListingStatus` | `listings_status_enum` |
| `OrderStatus` | `orders_status_enum` |
| `PaymentMethod` | `payments_method_enum` |
| `EscrowStatus` | `payments_escrow_status_enum` |
| `CertificateType` | `certificates_type_enum` |
| `CertificateStatus` | `certificates_status_enum` |
| `MessageType` | `messages_type_enum` |

Adding a value: write the migration first (`ALTER TYPE ... ADD VALUE 'new_value'`), then add the constant in TS, then use it. Postgres enum values are append-only — to *remove* one you must rename the type and recreate.

## Migration list

In execution order (timestamp = file prefix):

| Migration | Effect |
|---|---|
| `1700000000000-Init` | Create `users`, `listings`, `orders`, `payments` and all their FKs/indexes. |
| `1777382579000-PaymentsAutoReleaseHeldIndex` | Add the partial index used by the auto-release cron. |
| `1777500000000-CreateConversations` | Conversation table + GIN index. |
| `1777500001000-CreateMessages` | Message table + composite index. |
| `1777600000000-CreateCertificates` | Certificate table + FK to `listings.certificate_id`. |
| `1777700000000-AdminAuth` | Add `password_hash`, `totp_secret`, `totp_enabled` to `users`. Partial unique index on admin email. |
| `1777800000000-AdminUserReview` | Add `suspended`, `kyc_rejection_reason`, `kyc_reviewed_at`, `kyc_reviewed_by_id` to `users`. Add KYC-status index. |

Run them all with `npm run migration:run` from `backend/`. To roll back the most recent one: `npm run migration:revert`.

## Conventions to follow when adding a table

- Primary key `id uuid DEFAULT uuid_generate_v4()`.
- `created_at` / `updated_at` via TypeORM's `@CreateDateColumn` / `@UpdateDateColumn`. Use `timestamptz` (not `timestamp`) for new tables.
- Soft delete (`@DeleteDateColumn deleted_at`) only when the business requires "show me deleted records" later. Don't bake it in by default — repository queries filter it transparently but raw SQL doesn't.
- Foreign keys: pick `ON DELETE CASCADE` for owner relationships (a listing dies with its seller), `SET NULL` for soft references (order survives a deleted listing), and `RESTRICT` for fields where authorship matters (`messages.sender_id`).
- Index foreign keys you'll query by, and consider partial indexes for status-filtered queries (see `idx_payments_auto_release_held`).
