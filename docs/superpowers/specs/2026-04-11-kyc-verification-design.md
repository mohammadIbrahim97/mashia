# KYC Verification — Design Specification

**User Story:** G1-US02 — KYC Verification
**Traces to:** Goal 1 → User Story 2
**Date:** 2026-04-11
**Status:** Approved

---

## 1. Goal

Deliver end-to-end KYC document upload and verification tracking for the Mashia backend. Users can submit identity documents (role-specific) via a single multipart endpoint; documents are stored privately in S3; a reusable guard blocks unverified users from privileged routes. Admin approval flow is out of scope (delivered in US10).

## 2. Scope

**In scope:**
- New `KycModule` with two endpoints: `POST /kyc/submit` and `GET /kyc/status`
- New shared `S3Module` wrapping `@aws-sdk/client-s3`, reusable by listings/certificates later
- New `KycVerifiedGuard` in `src/shared/guards/` — dumb guard, checks `user.kycStatus === VERIFIED`
- LocalStack added to `docker-compose.yml` for local S3 emulation
- File validation: image mime types, size limits, dimensions
- Role-aware document requirements (buyer vs seller/broker)
- Resubmission support for rejected users
- Unit tests across KYC service, controller, S3 service, guard

**Out of scope (deferred to later stories):**
- Admin approval endpoint (`PATCH /admin/users/:id/kyc`) — US10-03
- Signed read URLs for admin review — US10
- Applying `KycVerifiedGuard` to listing creation routes — US04
- Applying `KycVerifiedGuard` to order placement routes — US06
- Third-party KYC provider integration (Jumio/Onfido) — post-MVP
- Audit trail of submissions (separate `KycSubmission` entity) — added when needed

## 3. Document Requirements

| Role | nationalId | selfie | businessLicense |
|---|---|---|---|
| Buyer | **Required** | Not allowed | Not allowed |
| Seller | **Required** | **Required** | Optional |
| Broker | **Required** | **Required** | Optional |
| Admin | N/A (admins don't KYC through this flow) | — | — |

**Rationale:** Sellers/brokers handle money and shipment, so selfie is required for face-match against ID. Business license is optional because not all sellers are formally registered businesses. Buyers face less risk, so selfie is skipped to reduce onboarding friction.

## 4. State Model

Existing `KycStatus` enum (3 values) is kept unchanged:

```
PENDING    — default on registration; also the state during admin review
VERIFIED   — admin approved (transition happens in US10)
REJECTED   — admin rejected; user may resubmit
```

**"Has the user submitted?" is derived** from `user.kycDocuments !== null`, not stored as a separate enum value. This avoids an enum migration on the existing schema.

**State transitions in US02 scope:**

```
PENDING (no docs)     → PENDING (with docs)    — user submits
PENDING (with docs)   → PENDING (new docs)     — user resubmits before admin review
REJECTED              → PENDING (with docs)    — user resubmits after rejection
VERIFIED              → (blocked, 409)         — no resubmission once verified
```

**State transitions NOT in US02 scope** (delivered in US10):
- `PENDING → VERIFIED` (admin approves)
- `PENDING → REJECTED` (admin rejects)

## 5. Architecture

### 5.1 Module Layout

```
src/modules/kyc/                      # NEW — parallel to auth, users
├── kyc.module.ts                     # imports UsersModule, S3Module
├── kyc.controller.ts                 # POST /submit, GET /status
├── kyc.service.ts                    # orchestration
├── dto/
│   ├── submit-kyc.dto.ts             # metadata only; files via multipart
│   └── kyc-status-response.dto.ts    # shared by both endpoints
├── kyc.controller.spec.ts
└── kyc.service.spec.ts

src/shared/guards/
└── kyc-verified.guard.ts             # NEW — reusable, 403 if !VERIFIED
└── kyc-verified.guard.spec.ts

src/shared/s3/                        # NEW — mirrors src/shared/redis/ pattern, @Global()
├── s3.module.ts                      # @Global, exports S3Service
├── s3.service.ts                     # upload, delete, getSignedReadUrl, ensureBucket
├── s3.constants.ts                   # S3_CLIENT injection token
└── s3.service.spec.ts

src/config/
└── s3.config.ts                      # MODIFIED — add endpoint, forcePathStyle
```

### 5.2 Dependency Graph

```
KycModule ─→ UsersModule       (reads/writes user.kycStatus and user.kycDocuments)
KycModule ─→ S3Module (@Global) (upload/delete files — injected via S3_CLIENT token)
KycVerifiedGuard ─→ (nothing)  (reads user off request, set by JwtStrategy)
S3Module (@Global)             (wraps @aws-sdk/client-s3, follows RedisModule pattern)
```

### 5.3 Why Separate Module, Not Inside Users

KYC will grow beyond a simple upload: re-verification, expiry reminders, third-party provider integration, audit logs. Keeping it out of `users` prevents that module from bloating. S3 client lives in `shared/modules/s3` because listings (US04) and certificates (US08) will reuse the same client — same pattern as Redis, which is shared by auth now and Socket.io later.

## 6. Data Model

**No new entities.** Reuse the existing `User` entity fields:

```typescript
// src/modules/users/user.entity.ts (unchanged)
@Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING, name: 'kyc_status' })
kycStatus: KycStatus;

@Column({ type: 'jsonb', nullable: true, name: 'kyc_documents' })
kycDocuments: Record<string, string> | null;
```

**`kycDocuments` jsonb shape:**

```json
{
  "nationalId": "kyc/550e8400-e29b-41d4-a716-446655440000/nationalId-a1b2c3d4.jpg",
  "selfie": "kyc/550e8400-e29b-41d4-a716-446655440000/selfie-e5f6g7h8.jpg",
  "businessLicense": "kyc/550e8400-e29b-41d4-a716-446655440000/businessLicense-i9j0k1l2.jpg"
}
```

Values are S3 keys (not URLs). Keys stay server-side; clients never see them.

**Why no `KycSubmission` entity now:** audit trail and history are valuable but not blocking for MVP. Overwrite-on-resubmit loses history but simplifies everything. We can add a `KycSubmission` entity later without breaking the existing `User` schema — the jsonb field becomes a cache of the "current submission" while the entity holds history.

## 7. API Specification

### 7.1 `POST /api/v1/kyc/submit`

**Purpose:** Submit KYC documents for the authenticated user.

**Guards:** `JwtAuthGuard` (no KYC guard — this is how you become verified)

**Content-Type:** `multipart/form-data`

**Form fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `nationalId` | image file | Yes (all roles) | JPEG/PNG/WebP, max 5 MB |
| `selfie` | image file | Yes (seller/broker), forbidden (buyer) | Same constraints |
| `businessLicense` | image file | Optional (seller/broker), forbidden (buyer) | Same constraints |

**File validation rules:**
- Mime types: `image/jpeg`, `image/png`, `image/webp`
- Max file size: 5 MB per file (enforced by Multer config)
- Min image dimensions: 800×600
- Max image dimensions: 4096×4096
- Wrong mime type, oversize, or out-of-range dimensions → 400

**Service-side role validation (after files parsed):**
- Buyer with `selfie` or `businessLicense` field → 400 "Buyers must upload only nationalId"
- Seller/broker missing `selfie` → 400 "Selfie is required for sellers and brokers"
- Seller/broker missing `nationalId` → 400 "National ID is required"
- User with `kycStatus === VERIFIED` → 409 "Already verified; contact support to update documents"

**Response (200):**

```json
{
  "kycStatus": "pending",
  "submitted": true,
  "documents": {
    "nationalId": true,
    "selfie": true,
    "businessLicense": false
  },
  "submittedAt": "2026-04-11T14:30:00.000Z"
}
```

**Response shape rationale:** booleans not S3 keys. Mobile app only needs to know which slots are filled for the UI. Leaking S3 keys would undermine private-bucket security.

**Error responses:**
- 400 — file validation or role rule violation
- 401 — missing/invalid JWT
- 409 — already verified
- 500 — S3 upload failure (after rollback of partially-uploaded files)

### 7.2 `GET /api/v1/kyc/status`

**Purpose:** Fetch current KYC state for the authenticated user. Mobile app polls this to render the right UI screen.

**Guards:** `JwtAuthGuard`

**Response (200):** identical shape to `POST /kyc/submit` response, so the client has a single renderer for both responses.

```json
{
  "kycStatus": "pending" | "verified" | "rejected",
  "submitted": true | false,
  "documents": {
    "nationalId": true | false,
    "selfie": true | false,
    "businessLicense": true | false
  },
  "submittedAt": "2026-04-11T14:30:00.000Z" | null
}
```

- `submitted` is `user.kycDocuments !== null`
- `documents.*` booleans reflect which keys are present in `kycDocuments`
- `submittedAt` is `user.updatedAt` when `submitted === true`, else `null`

## 8. S3 Integration

### 8.1 Package Choice

- **`@aws-sdk/client-s3` (v3)** — modular, tree-shakeable, actively maintained
- **Not `aws-sdk` v2** — deprecated by AWS

### 8.2 `S3Service` API

```typescript
@Injectable()
export class S3Service implements OnModuleInit {
  async onModuleInit(): Promise<void>  // calls ensureBucketExists()

  upload(key: string, body: Buffer, contentType: string): Promise<void>
  delete(key: string): Promise<void>
  getSignedReadUrl(key: string, expiresInSeconds: number): Promise<string>
  ensureBucketExists(): Promise<void>
}
```

**Design notes:**
- Deliberately minimal surface. Listings (US04) and certificates (US08) use the same 4 methods.
- All uploads use `ServerSideEncryption: 'AES256'`
- All uploads set `Private` ACL (default)
- Bucket created automatically on module init if missing (idempotent)

### 8.3 Configuration

Env vars read by `s3.config.ts`:

| Var | Dev value | Prod value |
|---|---|---|
| `AWS_S3_ENDPOINT` | `http://localhost:4566` | (unset — SDK uses real AWS) |
| `AWS_REGION` | `me-south-1` | `me-south-1` |
| `AWS_S3_BUCKET` | `mashia-files` | `mashia-files` |
| `AWS_S3_FORCE_PATH_STYLE` | `true` (LocalStack requirement) | `false` |
| `AWS_ACCESS_KEY_ID` | `test` | (from IAM task role) |
| `AWS_SECRET_ACCESS_KEY` | `test` | (from IAM task role) |

The same code path serves both environments — production switching is config-only. Existing `backend/src/config/s3.config.ts` is extended (not replaced) to add `endpoint` and `forcePathStyle`. Existing env var names (`AWS_REGION`, `AWS_S3_BUCKET`) are kept to avoid churn.

### 8.4 Bucket Layout

**Single bucket `mashia-files` with prefixes:**
- `kyc/{userId}/{docType}-{uuid}.{ext}` — KYC documents (this story)
- `listings/{listingId}/...` — listing media (US04, future)
- `certificates/{certId}/...` — vet certs (US08, future)

One bucket simplifies IAM and LocalStack setup. Prefix-based separation gives logical isolation without operational overhead. Separate buckets can be introduced later if compliance requires.

### 8.5 LocalStack docker-compose Addition

```yaml
localstack:
  image: localstack/localstack:3.0
  container_name: mashia-localstack
  ports:
    - "4566:4566"
  environment:
    - SERVICES=s3
    - DEFAULT_REGION=me-south-1
    - PERSISTENCE=1
  volumes:
    - localstack-data:/var/lib/localstack

volumes:
  localstack-data:
```

- `SERVICES=s3` — only boot S3, not full LocalStack (faster startup, less memory)
- `PERSISTENCE=1` — uploaded files survive `docker compose down`

### 8.6 Migration Path to Real AWS

Moving from LocalStack to real AWS requires only:
1. Unset `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE` in production env
2. Use IAM task role credentials instead of `test`/`test`
3. Create the real bucket (either manually or let `ensureBucketExists()` handle it on first deploy)

**No application code changes.** This is LocalStack's core value prop and the reason we chose it over a disk-stub.

## 9. KycVerifiedGuard Design

**Location:** `src/shared/guards/kyc-verified.guard.ts`

**Implementation:**

```typescript
@Injectable()
export class KycVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.kycStatus !== KycStatus.VERIFIED) {
      throw new ForbiddenException('KYC verification required');
    }
    return true;
  }
}
```

**Design decisions:**

1. **Dumb guard, not smart.** No decorator metadata, no role-aware branching, no per-route config tables. Caller decides where to apply it. This keeps the rule "must be KYC-verified" visible at the route definition.

2. **Reads `user` off the request.** `JwtStrategy.validate()` already fetches the full user entity from the database during token validation and attaches it to the request. `KycVerifiedGuard` piggybacks on that — zero additional database queries per request.

3. **Order dependency on `JwtAuthGuard`.** The guard throws `UnauthorizedException` if `request.user` is missing, which indicates `JwtAuthGuard` didn't run first. This is a programming-error guardrail, not a runtime auth check.

4. **Status codes:** `UnauthorizedException` (401) for "not logged in", `ForbiddenException` (403) for "logged in but not verified". Semantically correct per RFC 7235.

5. **Generic error message.** "KYC verification required" doesn't leak whether the user is PENDING vs REJECTED. The mobile app learns the distinction from `GET /kyc/status`, not from guard errors.

### Usage pattern (future, in US04/US06)

```typescript
@Post('listings')
@UseGuards(JwtAuthGuard, RolesGuard, KycVerifiedGuard)
@Roles(UserRole.SELLER, UserRole.BROKER)
async createListing(...) { ... }
```

Guard chain order: authentication → role → KYC state. Each layer narrows access.

## 10. Testing Strategy

### 10.1 Unit Tests

**`s3.service.spec.ts` (~5 tests)** using [`aws-sdk-client-mock`](https://github.com/m-radzikowski/aws-sdk-client-mock):
1. `upload()` sends `PutObjectCommand` with bucket/key/body/contentType/SSE
2. `delete()` sends `DeleteObjectCommand` with the right key
3. `getSignedReadUrl()` returns a URL string via `getSignedUrl()` helper
4. `ensureBucketExists()` creates the bucket when `HeadBucket` 404s
5. `ensureBucketExists()` no-ops when `HeadBucket` succeeds

**`kyc.service.spec.ts` (~10 tests)** with mocked `S3Service` and `UsersService`:
1. Seller submits all 3 docs → all uploaded, user updated with 3 keys, status stays PENDING
2. Seller submits nationalId + selfie only → 2 uploads, no `businessLicense` key
3. Buyer submits nationalId only → 1 upload
4. Buyer attempts to upload selfie → `BadRequestException`
5. Seller missing selfie → `BadRequestException`
6. Seller missing nationalId → `BadRequestException`
7. User with `kycStatus === VERIFIED` attempts resubmit → `ConflictException`
8. REJECTED user resubmits → old keys deleted, new keys saved, status → PENDING
9. S3 upload fails mid-way → rollback deletes already-uploaded files, user not modified
10. `getStatus()` returns the correct response shape for each of PENDING/VERIFIED/REJECTED

**`kyc.controller.spec.ts` (~3 tests)** — thin passthrough, mirrors auth controller pattern:
1. `POST /kyc/submit` calls `kycService.submit()` with files + user
2. `GET /kyc/status` calls `kycService.getStatus()` with user
3. Error propagation (service errors bubble up)

**`kyc-verified.guard.spec.ts` (~4 tests)** with mocked `ExecutionContext`:
1. Allows when `user.kycStatus === VERIFIED`
2. Blocks when `PENDING` — throws `ForbiddenException`
3. Blocks when `REJECTED` — throws `ForbiddenException`
4. Throws `UnauthorizedException` when `user` is undefined

**Total new tests: ~22.** Running total after US02: ~66 passing tests (44 existing + 22 new).

### 10.2 Integration Tests

**Not included in MVP.** No integration tests against LocalStack in CI. Rationale: unit tests with `aws-sdk-client-mock` catch SDK command-shape bugs; LocalStack verification is manual during dev. If we later want a smoke test, we can add one gated behind an `INTEGRATION_TESTS=true` env var — not blocking US02 closure.

## 11. Security Considerations

- **All files private.** No public ACL, no public bucket policy.
- **Server-side encryption.** Every upload uses `AES256`.
- **S3 keys hidden from clients.** Response DTOs expose booleans, not keys. Only signed URLs leave the server, and only for admin reads (US10).
- **File validation at multiple layers:** Multer limits (size), mime-type filter, post-upload dimension check via `sharp` or equivalent.
- **No PDF uploads.** Images only. PDFs invite malware payloads and parsing complexity.
- **Path traversal protection.** File names generated server-side with `crypto.randomUUID()`, never derived from client input.
- **Rate limiting.** Not in this story — applies globally at the gateway later. Can add per-user upload throttling if abuse appears.

## 12. Issue Mapping

How the 5 US02 sub-issues carve up the implementation:

| Issue | Title | Files | Depends on |
|---|---|---|---|
| **US02-01** | KYC upload endpoint with S3 storage | `docker-compose.yml` (+localstack), `src/shared/modules/s3/*` (new), `src/modules/kyc/*` (new module, POST /submit), `src/app.module.ts` (register), `package.json` (+aws-sdk-client-s3, multer deps) | None |
| **US02-02** | KYC status tracking on user entity | `kyc.controller.ts` (+GET /status), `kyc.service.ts` (+getStatus) | US02-01 |
| **US02-03** | Guard blocks sellers/brokers | `src/shared/guards/kyc-verified.guard.ts` (new) | US02-01 |
| **US02-04** | Guard blocks buyers | Same guard — closes as "covered by US02-03; application tracked in US06" | US02-03 |
| **US02-05** | Unit tests for KYC upload and status transitions | `kyc.service.spec.ts`, `kyc.controller.spec.ts`, `kyc-verified.guard.spec.ts`, `s3.service.spec.ts` | All above |

## 13. Implementation Order

1. **S3 foundation** — docker-compose localstack service, `S3Module`, `S3Service`, `s3.service.spec.ts`. Standalone, unblocks everything.
2. **US02-01** — `KycModule` scaffold, `POST /kyc/submit`, role-aware validation, file upload pipeline.
3. **US02-02** — `GET /kyc/status` endpoint. Small addition.
4. **US02-03 + US02-04** — `KycVerifiedGuard` + guard tests. Both issues close together.
5. **US02-05** — fill in remaining service/controller tests.

Each step dispatches to a subagent (Sonnet for logic, Haiku for mechanical scaffolding). User commits manually between steps. Spec review after each chunk per the validated US01 workflow.

## 14. Dependencies Added

Backend `package.json`:
- `@aws-sdk/client-s3` (S3 client v3)
- `@aws-sdk/s3-request-presigner` (for `getSignedReadUrl`)
- `@nestjs/platform-express` (already present — for `FileInterceptor`)
- `multer` (already transitively present)
- `@types/multer` (dev)
- `aws-sdk-client-mock` (dev — for S3 unit tests)
- `image-size` (for dimension validation — lightweight, no native deps, reads width/height from buffer without decoding)

## 15. Open Questions

None remaining. All design decisions resolved during brainstorming.

## 16. References

- Memory: `project_mashia.md` — project context, US01 completion state
- Requirements: `docs/requirements/goal-1-backend-api-requirements.md` — G1-US02 (5 issues)
- Design spec (system-wide): `docs/specs/design-specification.md`
- Related prior specs:
  - `docs/superpowers/specs/2026-04-10-jwt-passport-strategy-design.md` — JwtStrategy behavior this guard depends on
  - `docs/superpowers/specs/2026-04-08-otp-generation-storage-design.md` — SMS stub pattern (chose LocalStack over stub here because S3 has real quirks worth testing against)
