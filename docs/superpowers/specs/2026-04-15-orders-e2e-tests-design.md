# US06-08: Integration Test Infrastructure + Orders E2E Coverage Design Spec

**Date:** 2026-04-15
**Issue:** #44 (G1-US06-08), reframed as B1 (integration tests, not unit-test backfill).

## Purpose

Catch classes of bugs that unit tests fundamentally cannot:
- SQL correctness (QueryBuilder output against real Postgres)
- Guard stacking and route ordering at the HTTP pipeline level
- `ValidationPipe` wiring against actual DTOs
- Decimal round-trip (TypeORM string → number coercion)
- Cascade and FK behavior on deletes
- Event emitter + listener round-trip

Establish reusable e2e test infrastructure that future modules (listings, auth, payments) will adopt without re-designing the harness.

## Scope

**In:**
- Add `supertest` + `@types/supertest` as devDependencies
- Create `test/` helpers: DB bootstrap, truncate helper, fixtures, event capture
- Update `test/jest-e2e.json` with module path aliases and global setup
- Add `test/global-setup.ts` to create `mashia_test` DB on-demand
- Write `test/orders.e2e-spec.ts` with 16 integration tests covering POST/PATCH/GET /orders
- Document GitHub Actions CI shape (not implemented — documentation only)

**Out:**
- CI workflow file implementation (separate DevOps ticket)
- Backfill integration tests for US01–05 (separate tickets per module)
- Migration system — `synchronize: true` acceptable for MVP
- LocalStack-dependent S3 tests — orders module doesn't touch S3
- OTP flow in tests — we bypass by signing JWTs directly

## Test DB Strategy

**Decision: Shared Postgres on port 5432, separate database name `mashia_test`.**

Rationale:
- Existing dev Postgres container already runs on 5432 via Docker Compose; adding a second container is friction without gain.
- Separate DB name gives full schema isolation from dev work.
- `CREATE DATABASE` is idempotent (we check first) — no pollution.

Alternative testcontainers (ephemeral container per run) was considered and rejected for MVP: 5–15s startup cost hurts dev iteration. Documented as a future option if flakiness emerges.

## Data Isolation

**Decision: `TRUNCATE TABLE ... RESTART IDENTITY CASCADE` in `beforeEach` of every e2e spec.**

- Predictable empty state per test
- ~10–50ms cost; negligible vs HTTP roundtrip
- Reproducible failures (test order doesn't matter)

Transaction-rollback isolation was rejected: NestJS DI doesn't cleanly share a transaction context with downstream services.

## Schema Setup

**Decision: TypeORM `synchronize: true` on bootstrap.**

No migrations exist yet. Synchronize creates the schema from entity metadata on every test-app boot. When real migrations land (future ticket), tests should switch to `migration:run`.

## Auth Flow in Tests

**Decision: Generate real JWTs via the app's `JwtService`.**

Tests exercise the full guard chain: `JwtAuthGuard → RolesGuard → KycVerifiedGuard`. No guard mocking — that would defeat the purpose.

`makeAuthenticatedUser` helper:
1. Inserts a User row directly via the User repository
2. Signs a JWT with `app.get(JwtService).sign({ sub: user.id, phone: user.phone, role: user.role })` — payload shape MUST match `JwtStrategy.JwtPayload` in `src/modules/auth/jwt.strategy.ts`
3. Returns `{ user, token }`

Tests attach `Authorization: Bearer <token>` to SuperTest requests.

**Important constraint:** `JwtStrategy.validate(payload)` looks up the user in the DB on every request (via `usersService.findById(payload.sub)`). Since `truncateAll` runs in `beforeEach` and wipes the users table, test data MUST be created AFTER truncation (i.e., inside the test body or a later `beforeEach`, not in `beforeAll`). Pre-signed tokens referencing truncated users are invalid.

## File Layout

```
backend/
├── test/
│   ├── jest-e2e.json              (modified: moduleNameMapper, globalSetup)
│   ├── global-setup.ts            (new — creates mashia_test DB)
│   ├── helpers/
│   │   ├── test-app.ts            (new — bootstraps AppModule for tests)
│   │   ├── truncate.ts            (new — TRUNCATE CASCADE helper)
│   │   ├── fixtures.ts            (new — makeAuthenticatedUser, createListing, createOrder)
│   │   └── event-capture.ts       (new — captures emitted events)
│   └── orders.e2e-spec.ts         (new — 16 tests)
```

No changes to `src/`.

## Dependencies

Add to `backend/package.json` devDependencies:
- `supertest@^6.3.0`
- `@types/supertest@^6.0.0`

## `test/global-setup.ts`

Runs once before the Jest suite:

```typescript
import { Client } from 'pg';

export default async function globalSetup(): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'sheep_user',
    password: process.env.DB_PASSWORD ?? 'sheep_pass_dev',
    database: 'postgres',
  });
  await client.connect();
  const res = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = 'mashia_test'`,
  );
  if (res.rowCount === 0) {
    await client.query(`CREATE DATABASE mashia_test`);
  }
  await client.end();

  process.env.DB_NAME = 'mashia_test';
  process.env.NODE_ENV = 'test';

  // Ensure JWT secrets exist for tests — do not read real prod secrets.
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-change-me';
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-change-me';
}
```

## `test/helpers/test-app.ts`

```typescript
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}
```

Note: global prefix and ValidationPipe config must match `main.ts`. If `main.ts` uses different config, this helper MUST match it.

## `test/helpers/truncate.ts`

```typescript
import { DataSource } from 'typeorm';

export async function truncateAll(dataSource: DataSource): Promise<void> {
  const tables = dataSource.entityMetadatas
    .map((m) => `"${m.tableName}"`)
    .join(', ');
  await dataSource.query(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`,
  );
}
```

## `test/helpers/fixtures.ts`

```typescript
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../src/modules/users/user.entity';
import { Listing } from '../../src/modules/listings/listing.entity';
import { Order } from '../../src/modules/orders/order.entity';
import {
  Breed,
  Currency,
  HealthStatus,
  KycStatus,
  ListingStatus,
  OrderStatus,
  PreferredLanguage,
  UserRole,
} from '../../src/shared/enums';

let phoneCounter = 100000;
function uniquePhone(): string {
  phoneCounter += 1;
  return `+96650${phoneCounter}`;
}

export async function makeAuthenticatedUser(
  app: INestApplication,
  overrides: Partial<User> = {},
): Promise<{ user: User; token: string }> {
  const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
  const jwtService = app.get(JwtService);

  const user = await userRepo.save(
    userRepo.create({
      role: UserRole.BUYER,
      fullName: 'Test User',
      phone: uniquePhone(),
      email: null,
      country: 'SA',
      city: 'Riyadh',
      kycStatus: KycStatus.VERIFIED,
      kycDocuments: null,
      preferredLanguage: PreferredLanguage.AR,
      ...overrides,
    }),
  );

  const token = jwtService.sign({
    sub: user.id,
    phone: user.phone,
    role: user.role,
  });
  return { user, token };
}

export async function createListing(
  app: INestApplication,
  seller: User,
  overrides: Partial<Listing> = {},
): Promise<Listing> {
  const listingRepo = app.get<Repository<Listing>>(getRepositoryToken(Listing));
  return listingRepo.save(
    listingRepo.create({
      sellerId: seller.id,
      title: 'Test Listing',
      breed: Breed.AWASSI,
      quantity: 50,
      ageMonths: 12,
      weightKg: 45,
      pricePerHead: 1200,
      currency: Currency.SAR,
      originCountry: 'SY',
      originCity: 'Damascus',
      description: 'Healthy sheep',
      images: ['listings/test/img-1.jpg'],
      videoUrl: null,
      healthStatus: HealthStatus.UNCHECKED,
      certificateId: null,
      status: ListingStatus.ACTIVE,
      ...overrides,
    }),
  );
}

export async function createOrder(
  app: INestApplication,
  buyer: User,
  seller: User,
  listing: Listing,
  overrides: Partial<Order> = {},
): Promise<Order> {
  const orderRepo = app.get<Repository<Order>>(getRepositoryToken(Order));
  const quantity = 10;
  const unitPrice = 1150;
  const totalPrice = quantity * unitPrice;
  return orderRepo.save(
    orderRepo.create({
      listingId: listing.id,
      buyerId: buyer.id,
      sellerId: seller.id,
      brokerId: null,
      quantity,
      unitPrice,
      currency: Currency.SAR,
      totalPrice,
      commissionRate: 5,
      commissionAmount: totalPrice * 0.05,
      status: OrderStatus.PENDING,
      deliveryCountry: 'SA',
      deliveryCity: 'Riyadh',
      deliveryAddress: '123 Test St',
      ...overrides,
    }),
  );
}
```

## `test/helpers/event-capture.ts`

```typescript
import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface EventCapture {
  getEmitted(name: string): unknown[];
  reset(): void;
}

export function captureEvents(app: INestApplication): EventCapture {
  const emitter = app.get(EventEmitter2);
  const captured: Array<{ name: string; payload: unknown }> = [];

  emitter.onAny((name, payload) => {
    captured.push({ name: String(name), payload });
  });

  return {
    getEmitted: (name) =>
      captured.filter((e) => e.name === name).map((e) => e.payload),
    reset: () => {
      captured.length = 0;
    },
  };
}
```

## `test/jest-e2e.json`

Replace existing file with:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^@shared/(.*)$": "<rootDir>/../src/shared/$1",
    "^@modules/(.*)$": "<rootDir>/../src/modules/$1",
    "^@config/(.*)$": "<rootDir>/../src/config/$1"
  },
  "globalSetup": "<rootDir>/global-setup.ts",
  "testTimeout": 30000
}
```

Timeout bumped to 30s because the first test run must synchronize the full schema.

## Test scenarios: `test/orders.e2e-spec.ts`

### POST /api/v1/orders (5 tests)

1. **Happy path** — BUYER + VERIFIED KYC → creates order. Assert: 201, response has UUID id, DB row exists, `totalPrice === 11500` (number, not string, after decimal round-trip), `commissionAmount === 575`.
2. **401 no JWT** — no Authorization header → 401.
3. **403 wrong role** — SELLER with verified KYC attempts → 403 (RolesGuard fires).
4. **403 PENDING KYC** — BUYER with PENDING KYC attempts → 403 (KycVerifiedGuard fires).
5. **400 invalid DTO** — negative `quantity` → 400 (ValidationPipe fires).

### PATCH /api/v1/orders/:id/status (4 tests)

6. **Seller accepts pending order** — PENDING → ACCEPTED by seller → 200, DB row updated.
7. **Non-party gets 404** — third unrelated user tries to update → 404 (privacy, not 403).
8. **Invalid transition returns 400** — PENDING → DELIVERED (not allowed) → 400 with specific message.
9. **Delivered transition fires event** — pre-seed IN_TRANSIT order, buyer PATCHes to DELIVERED → assert `captureEvents.getEmitted('order.delivered')` has 1 entry with correct orderId/buyerId/sellerId.

### GET /api/v1/orders (4 tests)

10. **Mixes buyer + seller roles with correct myRole** — create 1 order where user is buyer, 1 where user is seller. GET returns both, myRole correctly set per item.
11. **Pagination** — create 25 orders (user as buyer on all), request `?page=2&pageSize=10` → items 11–20 returned, `total: 25`, `totalPages: 3`.
12. **Status array filter** — create orders in PENDING, ACCEPTED, PAID states. Request `?status=pending&status=accepted` → returns 2 results. **This is the critical SQL validation test** — verifies that TypeORM's `IN (:...statuses)` parameter binding works with Postgres.
13. **401 no JWT** — no token → 401.

### GET /api/v1/orders/:id (3 tests)

14. **Happy path detail** — party fetches order → 200, response includes `deliveryAddress`, `buyer.phone`, `seller.phone`, and correct `myRole`.
15. **Not found** — random UUID → 404.
16. **Non-party gets 404** — third user tries → 404 (privacy, matches the list behavior).

### Total: 16 tests

## CI Setup (documented, not implemented in this issue)

Future `.github/workflows/ci.yml` shape:

```yaml
name: CI
on: [push, pull_request]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: backend/package-lock.json }
      - run: npm ci
        working-directory: backend
      - run: npm test
        working-directory: backend

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: postgres
          POSTGRES_USER: sheep_user
          POSTGRES_PASSWORD: sheep_pass_dev
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: backend/package-lock.json }
      - run: npm ci
        working-directory: backend
      - run: npm run test:e2e
        working-directory: backend
        env:
          DB_HOST: localhost
          DB_PORT: 5432
          DB_USER: sheep_user
          DB_PASSWORD: sheep_pass_dev
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          JWT_SECRET: ci-test-secret
          JWT_REFRESH_SECRET: ci-test-refresh-secret
```

Creation of the CI workflow itself is a separate DevOps ticket.

## Developer setup

Running tests locally requires:
1. Docker Compose up: `docker compose up -d postgres redis` (from project root)
2. `.env` file with `JWT_SECRET` and `JWT_REFRESH_SECRET` populated (or shell env vars)
3. `cd backend && npm run test:e2e`

On first run, `global-setup.ts` creates `mashia_test`. On subsequent runs, `synchronize: true` updates the schema in-place and `truncateAll` clears data per test.

## Expected Outcomes

- `npm test` → 164 unit tests pass (unchanged)
- `npm run test:e2e` → 16 e2e tests pass against real Postgres
- **Total: 180 tests** (164 unit + 16 e2e)
- `test/helpers/*` reusable verbatim in future module integration tests

## Risks / Known Unknowns

- **Global prefix + ValidationPipe config drift** — `test-app.ts` must mirror `main.ts`. If these diverge, e2e tests stop matching production behavior. Mitigation: add a comment in `main.ts` pointing to `test-app.ts` (documentation only; detection is manual).
- **`synchronize: true` is risky in prod** — we must explicitly confirm the test-app does NOT run against the dev `sheep_marketplace` DB. `global-setup.ts` sets `DB_NAME=mashia_test` before anything else bootstraps.
- **Existing AppModule may not fully bootstrap without Redis** — auth module depends on Redis for refresh-token blacklist. Orders tests don't exercise refresh, but if AppModule eagerly connects to Redis on init, tests require Redis running. Docker Compose makes this trivial locally but must be noted for CI.
- **Port conflicts** — if dev Postgres is down and another Postgres is on 5432, tests will run against the wrong server. Unavoidable without additional isolation; document in setup notes.

## Design Decisions Summary

1. **Shared Postgres + separate DB name** — MVP simplicity, reuse existing infra
2. **TRUNCATE CASCADE per test** — predictable, fast, simple
3. **`synchronize: true`** — deferred migration system to a future ticket
4. **Real JWTs via JwtService** — exercises actual guard chain
5. **Full AppModule bootstrap** — tests real wiring, not a stripped-down test module
6. **EventEmitter2.onAny for capture** — no extra dependency
7. **SuperTest** — standard, minimal surface
8. **CI documented, not implemented** — focus on tests; separate DevOps work
