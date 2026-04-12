# Livestock Listing Creation — Design Specification

**User Story:** G1-US04 — Livestock Listing Creation (+ partial G1-US05 search endpoints bundled)
**Traces to:** Goal 1 → User Story 4
**Date:** 2026-04-12
**Status:** Approved

---

## 1. Goal

Deliver end-to-end listing CRUD for the Mashia backend. Verified sellers can create listings with photos (uploaded via presigned S3 URLs), update them, mark them sold, and soft-delete them. Buyers can search, filter, sort, and view listings with seller profiles. A shared `UploadsModule` provides reusable presigned URL generation for listings now and certificates later.

## 2. Scope

**In scope:**
- 4 new enums: `Breed`, `Currency`, `ListingStatus`, `HealthStatus`
- New `Listing` entity with TypeORM soft-delete (`@DeleteDateColumn`)
- New `UploadsModule` (`POST /uploads/presigned-url`) — shared presigned URL endpoint
- New `getSignedUploadUrl()` method on existing `S3Service`
- 5 listing endpoints: POST, GET all (with filters/pagination/sort), GET :id, PATCH :id, DELETE :id
- `KycVerifiedGuard` applied to write operations (POST, PATCH, DELETE)
- Ownership enforcement on PATCH and DELETE
- Image validation: min 2, max 10 S3 keys per listing
- Unit tests across listings service, controller, uploads service/controller, S3 extension

**Out of scope (deferred to later stories):**
- Certificate linking (US08 adds FK + health status auto-update)
- Order creation from listings (US06)
- Admin flagging of listings (US10)
- Listing expiry (cron/TTL — post-MVP)
- Cross-currency price conversion
- S3 video hosting (video is external URL only)
- S3 cleanup on soft-delete (lifecycle rules, not app logic)

## 3. New Enums

Added to `backend/src/shared/enums/index.ts`:

```typescript
export enum Breed {
  AWASSI = 'awassi',
  NAJDI = 'najdi',
  ARABI = 'arabi',
  SHAMI = 'shami',
  OTHER = 'other',
}

export enum Currency {
  SYP = 'SYP',
  SAR = 'SAR',
  AED = 'AED',
  USD = 'USD',
}

export enum ListingStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  EXPIRED = 'expired',
  FLAGGED = 'flagged',
}

export enum HealthStatus {
  CERTIFIED = 'certified',
  PENDING = 'pending',
  UNCHECKED = 'unchecked',
}
```

## 4. Data Model

### Listing Entity

**File:** `backend/src/modules/listings/listing.entity.ts`

| Column | DB Name | Type | Notes |
|---|---|---|---|
| `id` | `id` | UUID PK | auto-generated |
| `seller` | — | ManyToOne → User | lazy, eager: false |
| `sellerId` | `seller_id` | UUID FK | indexed, onDelete: CASCADE |
| `title` | `title` | VARCHAR(200) | required |
| `breed` | `breed` | enum Breed | required |
| `quantity` | `quantity` | INT | min 1 |
| `ageMonths` | `age_months` | INT | min 0 |
| `weightKg` | `weight_kg` | DECIMAL(10,2) | min 0 |
| `pricePerHead` | `price_per_head` | DECIMAL(12,2) | min 0 |
| `currency` | `currency` | enum Currency | required |
| `originCountry` | `origin_country` | VARCHAR(100) | required |
| `originCity` | `origin_city` | VARCHAR(100) | required |
| `description` | `description` | TEXT nullable | max 2000 chars |
| `images` | `images` | JSONB string[] | min 2, max 10 S3 keys |
| `videoUrl` | `video_url` | VARCHAR nullable | external URL only |
| `healthStatus` | `health_status` | enum HealthStatus | default: unchecked |
| `certificateId` | `certificate_id` | UUID nullable | no FK constraint yet (US08) |
| `status` | `status` | enum ListingStatus | default: active |
| `createdAt` | `created_at` | TIMESTAMP | auto |
| `updatedAt` | `updated_at` | TIMESTAMP | auto |
| `deletedAt` | `deleted_at` | TIMESTAMP nullable | @DeleteDateColumn — soft delete |

**Design decisions:**
- `images` as JSONB string array, not a join table. S3 keys like `["listings/uuid/img-abc.jpg"]`. Simpler than a separate `ListingImage` entity for MVP.
- `certificateId` is a bare UUID with no FK constraint. US08 adds the Certificate entity and relation. Avoids circular dependency.
- `@DeleteDateColumn()` — TypeORM automatically excludes soft-deleted rows from `find*` queries. `repository.softDelete(id)` sets `deletedAt`.
- `onDelete: CASCADE` on the seller relation — deleting a user deletes their listings.
- No `price` column — only `pricePerHead`. Total = pricePerHead * quantity, calculated at order creation (US06).

## 5. Architecture

### 5.1 Module Layout

```
src/modules/uploads/                    # NEW — shared presigned URL endpoint
├── uploads.module.ts
├── uploads.controller.ts               # POST /uploads/presigned-url
├── uploads.service.ts                  # key generation + delegates to S3Service
├── uploads.controller.spec.ts
├── uploads.service.spec.ts
└── dto/
    └── presigned-url.dto.ts            # purpose, contentType, fileName

src/modules/listings/                   # FILL existing scaffold (all files empty)
├── listings.module.ts
├── listings.controller.ts              # 5 routes
├── listings.service.ts                 # CRUD + query builder
├── listing.entity.ts                   # TypeORM entity
├── dto/
│   ├── create-listing.dto.ts
│   ├── update-listing.dto.ts
│   └── search-listings.dto.ts
├── listings.service.spec.ts            # NEW
└── listings.controller.spec.ts         # exists as empty scaffold

src/shared/s3/
└── s3.service.ts                       # MODIFIED — +getSignedUploadUrl()
└── s3.service.spec.ts                  # MODIFIED — +1 test
```

### 5.2 Dependency Graph

```
UploadsModule  → S3Module (@Global)
ListingsModule → TypeOrmModule.forFeature([Listing])
ListingsModule → UsersModule (seller profile join in GET /:id, if needed)
```

### 5.3 S3Service Extension

New method added to existing `S3Service`:

```typescript
async getSignedUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string>
```

Uses `@aws-sdk/s3-request-presigner` with `PutObjectCommand` (vs `GetObjectCommand` for reads). Presigned request includes `ServerSideEncryption: 'AES256'` and `ContentType` headers — client must match content type or upload fails.

## 6. API Specification

### 6.1 `POST /api/v1/uploads/presigned-url`

**Purpose:** Get a presigned S3 PUT URL for direct client-to-S3 upload.

**Guards:** `JwtAuthGuard` only. No role or KYC guard — the consuming endpoint (`POST /listings`) handles that.

**Request body:**

| Field | Type | Validation | Notes |
|---|---|---|---|
| `purpose` | string | `@IsIn(['listing', 'certificate'])` | Determines S3 key prefix |
| `contentType` | string | `@IsIn(['image/jpeg', 'image/png', 'image/webp'])` | Must match what client uploads |
| `fileName` | string | `@IsString`, `@Length(1, 255)` | Extension extracted for S3 key |

**Response (200):**

```json
{
  "uploadUrl": "https://mashia-files.s3.me-south-1.amazonaws.com/listings/...",
  "key": "listings/550e8400-e29b-41d4-a716-446655440000/img-a1b2c3d4.jpg",
  "expiresIn": 300
}
```

**S3 key generation:**
- Pattern: `{purpose}s/{userId}/{uuid}.{ext}`
- Example: `listings/550e8400/img-a1b2c3d4.jpg`
- Extension extracted from `fileName` or derived from `contentType`

**Security:**
- Presigned URL expires in 300 seconds (5 minutes)
- URL is scoped to exact key + content type — can't upload to different path
- SSE enforced via presigned headers
- Keys are user-scoped

### 6.2 `POST /api/v1/listings`

**Purpose:** Create a new livestock listing.

**Guards:** `JwtAuthGuard` → `RolesGuard` → `KycVerifiedGuard`
**Roles:** `@Roles(UserRole.SELLER)`

**Request body (CreateListingDto):**

| Field | Type | Required | Validation |
|---|---|---|---|
| `title` | string | yes | 1-200 chars |
| `breed` | Breed | yes | `@IsEnum(Breed)` |
| `quantity` | number | yes | `@IsInt`, `@Min(1)` |
| `ageMonths` | number | yes | `@IsInt`, `@Min(0)` |
| `weightKg` | number | yes | `@IsNumber`, `@Min(0)` |
| `pricePerHead` | number | yes | `@IsNumber`, `@Min(0)` |
| `currency` | Currency | yes | `@IsEnum(Currency)` |
| `originCountry` | string | yes | 1-100 chars |
| `originCity` | string | yes | 1-100 chars |
| `description` | string | no | max 2000 chars |
| `images` | string[] | yes | `@ArrayMinSize(2)`, `@ArrayMaxSize(10)`, each `@IsString` |
| `videoUrl` | string | no | `@IsUrl()` |

**Service logic:**
1. Create Listing entity with `sellerId = user.id`, `status = ListingStatus.ACTIVE`, `healthStatus = HealthStatus.UNCHECKED`
2. Save and return

**Response (201):** the created Listing entity.

**Error responses:**
- 400 — validation failure (bad fields, <2 or >10 images)
- 401 — missing/invalid JWT
- 403 — not a seller, or KYC not verified

### 6.3 `GET /api/v1/listings`

**Purpose:** Search listings with filters, pagination, and sorting.

**Guards:** none (public endpoint).

**Query params (SearchListingsDto):**

| Param | Type | Default | Validation |
|---|---|---|---|
| `page` | number | 1 | `@IsInt`, `@Min(1)` |
| `limit` | number | 20 | `@IsInt`, `@Min(1)`, `@Max(100)` |
| `breed` | Breed | — | `@IsOptional`, `@IsEnum(Breed)` |
| `minPrice` | number | — | `@IsOptional`, `@IsNumber`, `@Min(0)` |
| `maxPrice` | number | — | `@IsOptional`, `@IsNumber`, `@Min(0)` |
| `minQuantity` | number | — | `@IsOptional`, `@IsInt`, `@Min(1)` |
| `originCountry` | string | — | `@IsOptional`, `@IsString` |
| `healthStatus` | HealthStatus | — | `@IsOptional`, `@IsEnum(HealthStatus)` |
| `sort` | string | `newest` | `@IsOptional`, `@IsIn(['newest', 'price_asc', 'price_desc'])` |

**Service logic (QueryBuilder):**
1. Always filter `status = 'active'` (soft-deleted rows excluded by TypeORM automatically)
2. Apply each optional filter with `andWhere` when present
3. Sort: `newest` → `createdAt DESC`, `price_asc` → `pricePerHead ASC`, `price_desc` → `pricePerHead DESC`
4. Pagination: `.skip((page - 1) * limit).take(limit)`
5. Use `getManyAndCount()` for total

**Response (200):**

```json
{
  "data": [Listing, Listing, ...],
  "total": 142,
  "page": 1,
  "limit": 20
}
```

**Notes:**
- `minPrice`/`maxPrice` filter on `pricePerHead`, not total price
- Cross-currency filtering is out of scope — all currencies returned together
- Query params need `@Type(() => Number)` from `class-transformer` for proper type coercion

### 6.4 `GET /api/v1/listings/:id`

**Purpose:** Get a single listing with seller profile.

**Guards:** none (public).

**Service logic:**
1. Find by ID with `relations: ['seller']`
2. Throw `NotFoundException` if not found
3. Return listing with seller joined

**Note:** returns listings of ANY status (active, sold, flagged). Only soft-deleted listings are excluded (by TypeORM). This allows buyers to view a listing they bookmarked after it sold.

**Response (200):** Listing entity with seller relation populated.

### 6.5 `PATCH /api/v1/listings/:id`

**Purpose:** Update a listing. Owner only.

**Guards:** `JwtAuthGuard` → `RolesGuard` → `KycVerifiedGuard`
**Roles:** `@Roles(UserRole.SELLER)`

**Request body (UpdateListingDto):** `PartialType(CreateListingDto)` plus:

| Field | Type | Validation |
|---|---|---|
| `status` | ListingStatus | `@IsOptional`, restricted to `active` and `sold` only via custom validator |

**Restriction:** seller can only set status to `active` or `sold`. The `flagged` and `expired` values are system-only — rejected by DTO validation. Implementation: custom `@IsIn([ListingStatus.ACTIVE, ListingStatus.SOLD])` on the status field in UpdateListingDto.

**Service logic:**
1. Find listing by ID, throw `NotFoundException` if not found
2. Check `listing.sellerId === user.id`, throw `ForbiddenException` if not owner
3. Apply updates, save, return updated listing

**Error responses:**
- 400 — validation failure (e.g., status = 'flagged')
- 401 — no JWT
- 403 — not owner, not seller, or KYC not verified
- 404 — listing not found

### 6.6 `DELETE /api/v1/listings/:id`

**Purpose:** Soft-delete a listing. Owner only.

**Guards:** `JwtAuthGuard` → `RolesGuard` → `KycVerifiedGuard`
**Roles:** `@Roles(UserRole.SELLER)`

**Service logic:**
1. Find listing by ID, throw `NotFoundException` if not found
2. Check `listing.sellerId === user.id`, throw `ForbiddenException` if not owner
3. `repository.softDelete(id)` — sets `deletedAt`
4. Return `{ message: 'Listing deleted' }`

**No S3 cleanup on delete.** Images stay in S3. Soft-deleted listings may be restored (admin, disputes). S3 lifecycle rules clean up old files in bulk later.

## 7. Client Upload Flow

Complete end-to-end flow for creating a listing with images:

```
Mobile App                          Backend                         S3 (LocalStack)
    │                                  │                                │
    │ 1. POST /uploads/presigned-url   │                                │
    │    { purpose: "listing",         │                                │
    │      contentType: "image/jpeg",  │                                │
    │      fileName: "sheep1.jpg" }    │                                │
    │ ──────────────────────────────►  │                                │
    │                                  │  Generate key + presign PUT    │
    │  ◄────────────────────────────── │                                │
    │  { uploadUrl, key, expiresIn }   │                                │
    │                                  │                                │
    │ 2. PUT uploadUrl (binary body)   │                                │
    │ ─────────────────────────────────────────────────────────────────►│
    │  ◄─────────────────────────────────────────────────────────────── │
    │  200 OK                          │                                │
    │                                  │                                │
    │ (repeat for each image,          │                                │
    │  can upload in parallel)         │                                │
    │                                  │                                │
    │ 3. POST /listings                │                                │
    │    { title: "...",               │                                │
    │      images: [key1, key2, ...],  │                                │
    │      ... }                       │                                │
    │ ──────────────────────────────►  │                                │
    │                                  │  Save listing with S3 keys     │
    │  ◄────────────────────────────── │                                │
    │  201 Created                     │                                │
```

## 8. Guard Stack

| Endpoint | JwtAuth | Roles | KycVerified | Ownership |
|---|---|---|---|---|
| POST /uploads/presigned-url | yes | — | — | — |
| POST /listings | yes | SELLER | yes | — |
| GET /listings | — | — | — | — |
| GET /listings/:id | — | — | — | — |
| PATCH /listings/:id | yes | SELLER | yes | service-level |
| DELETE /listings/:id | yes | SELLER | yes | service-level |

**Ownership check in service (not guard):** the service already loads the listing to process the request. Checking `listing.sellerId === user.id` in the service avoids a duplicate DB query that a guard would need.

## 9. Status Lifecycle

```
                     ┌──────────────────┐
                     │                  │
    create ──────►  ACTIVE  ◄──────── seller PATCH
                     │                  │
                     │  seller PATCH    │
                     ▼                  │
                    SOLD  ─────────────┘
                    
    (system only — not settable by seller)
                    
    admin flags ──► FLAGGED     (US10)
    cron/TTL ────► EXPIRED      (post-MVP)
```

Seller can toggle between `active` and `sold`. `flagged` and `expired` are system-only — DTO validation rejects them.

## 10. Testing Strategy

### Unit Tests

**`s3.service.spec.ts` — +1 test:**
1. `getSignedUploadUrl()` sends `PutObjectCommand` presigned with correct bucket/key/contentType/SSE

**`uploads.service.spec.ts` (~3 tests):**
1. Generates S3 key in format `listings/{userId}/{uuid}.{ext}` for listing purpose
2. Calls `S3Service.getSignedUploadUrl` with key, contentType, 300
3. Generates key with `certificates/` prefix for certificate purpose

**`uploads.controller.spec.ts` (~3 tests):**
1. Returns presigned URL + key for listing request
2. Returns presigned URL for certificate purpose
3. Error propagation

**`listings.service.spec.ts` (~15 tests):**
1. `create()` saves with sellerId, status=active, healthStatus=unchecked
2. `create()` preserves images array
3. `findAll()` returns paginated results with default limit 20
4. `findAll()` filters by breed
5. `findAll()` filters by minPrice/maxPrice
6. `findAll()` filters by minQuantity
7. `findAll()` filters by originCountry
8. `findAll()` filters by healthStatus
9. `findAll()` sorts by newest, price_asc, price_desc
10. `findAll()` only returns active listings
11. `findById()` returns listing with seller joined
12. `findById()` throws NotFoundException
13. `update()` succeeds when caller is owner
14. `update()` throws ForbiddenException when not owner
15. `remove()` soft-deletes when caller is owner
16. `remove()` throws ForbiddenException when not owner

**`listings.controller.spec.ts` (~5 tests):**
1. POST delegates to service.create with user.id
2. GET / delegates to service.findAll with query
3. GET /:id delegates to service.findById
4. PATCH /:id delegates to service.update with user.id
5. DELETE /:id delegates to service.remove with user.id

**Total new tests: ~28.** Running total after US04: ~111 passing tests (83 existing + 28 new).

## 11. Issue Mapping

| Issue | Title | Files | Depends on |
|---|---|---|---|
| **US04-01** | Listing entity with all fields | `shared/enums/index.ts` (+4 enums), `listing.entity.ts`, `listings.module.ts` (TypeOrmModule) | None |
| **US04-02** | POST /listings restricted to verified sellers | `uploads/` module (new), `S3Service` (+getSignedUploadUrl), `create-listing.dto.ts`, `listings.service.ts` (create), `listings.controller.ts` (POST + guards) | US04-01 |
| **US04-03** | Validate min 2, max 10 images | Part of `create-listing.dto.ts` (`@ArrayMinSize(2)` `@ArrayMaxSize(10)`) | US04-02 |
| **US04-04** | PATCH /listings/:id restricted to owner | `update-listing.dto.ts`, `listings.service.ts` (update + ownership), `listings.controller.ts` (PATCH) | US04-01 |
| **US04-05** | DELETE /listings/:id restricted to owner | `listings.service.ts` (remove + ownership), `listings.controller.ts` (DELETE) | US04-01 |
| **US04-06** | Unit tests for listing CRUD | all spec files | All above |

**US05 partial coverage:** GET /listings (with filters/pagination/sort) and GET /listings/:id are implemented as part of US04 since the controller needs all routes wired. US05 issues can be closed based on which filters are present in the `findAll` query builder.

## 12. Implementation Order

1. **Enums + Listing entity + module wiring** — foundation
2. **S3Service.getSignedUploadUrl + UploadsModule** — shared infra
3. **CreateListingDto + POST /listings** — includes image validation (US04-02 + US04-03)
4. **SearchListingsDto + GET /listings + GET /listings/:id** — search with filters/pagination/sort
5. **UpdateListingDto + PATCH /listings/:id** — owner check + status restriction (US04-04)
6. **DELETE /listings/:id** — soft delete + owner check (US04-05)
7. **All unit tests** (US04-06) — service, controller, uploads, S3 extension

## 13. Dependencies Added

Backend `package.json` — no new packages. All needed dependencies already installed:
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (from US02)
- `class-validator` + `class-transformer` (from project scaffold)
- `@nestjs/mapped-types` (for `PartialType` in UpdateListingDto — verify installed, add if missing)

## 14. Security Considerations

- **KycVerifiedGuard** on all write operations — unverified sellers cannot create, update, or delete listings
- **Ownership enforcement** in service layer — sellers can only modify their own listings
- **Image keys are S3 keys, not URLs** — listing responses contain raw S3 keys (e.g., `listings/uuid/img-abc.jpg`), not presigned read URLs. Generating presigned read URLs for 20 listings * 10 images per search page would be expensive. Instead, the mobile app can request presigned read URLs on demand (a batch `/uploads/read-urls` endpoint will be added when mobile integration begins — not in this spec).
- **Presigned upload URLs** are scoped to exact key + content type, expire in 5 minutes, and enforce SSE
- **Global ValidationPipe** with `whitelist: true` prevents field injection on all DTOs
- **Soft delete** preserves data for dispute resolution and admin review

## 15. Open Questions

None. All design decisions resolved during brainstorming.

## 16. References

- Memory: `project_mashia.md` — project context, US01-US03 completion state
- Requirements: `docs/requirements/goal-1-backend-api-requirements.md` — G1-US04 (6 issues), G1-US05 (8 issues)
- Design spec: `docs/specs/design-specification.md` — listing entity schema, flows
- Implementation plan templates: `docs/plans/backend-api-implementation-plan.md` — Task 7 (listings)
- Prior specs:
  - `docs/superpowers/specs/2026-04-11-kyc-verification-design.md` — S3Module, KycVerifiedGuard design
