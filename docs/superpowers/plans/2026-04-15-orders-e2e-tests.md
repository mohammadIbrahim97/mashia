# Orders E2E Test Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add integration test infrastructure (supertest + helpers + global setup + jest-e2e config) and write 16 e2e tests for the orders module that exercise real HTTP pipeline → guards → service → Postgres round-trip. Target: 180 total tests passing (164 unit + 16 e2e).

**Architecture:** Tests run SuperTest against a real `AppModule` bootstrapped with a separate `mashia_test` Postgres DB (same dev container, different DB name). Schema is auto-created via TypeORM `synchronize: true`. `TRUNCATE ... CASCADE` resets state between tests. Real JWTs signed via the app's `JwtService` authenticate requests end-to-end through the guard chain.

**Tech Stack:** NestJS + Jest + SuperTest + TypeORM + Postgres 16 (Docker).

**Spec:** `docs/superpowers/specs/2026-04-15-orders-e2e-tests-design.md`

**Note on git:** The user commits manually — do NOT run `git add`, `git commit`, or `git push` in any step.

**Prerequisite for running tests:** Docker Compose must be up (`docker compose up -d postgres redis` from project root). `JWT_SECRET` and `JWT_REFRESH_SECRET` should be set in shell env or `.env`; `global-setup.ts` provides test-only defaults if missing.

---

### Task 1: Install SuperTest dependencies

**Files:**
- Modify: `backend/package.json` (devDependencies)

- [ ] **Step 1: Install supertest + types**

Run:
```
cd /home/mohammadibrahim/mashia/backend && npm install --save-dev supertest@^6.3.0 @types/supertest@^6.0.0 2>&1 | tail -10
```

Expected: `added N packages` with no errors.

- [ ] **Step 2: Verify devDependencies in package.json**

Run:
```
grep -E "supertest|@types/supertest" /home/mohammadibrahim/mashia/backend/package.json
```

Expected: Two lines matching `"supertest": "^6.3..."` and `"@types/supertest": "^6.0..."` — both under `devDependencies`.

---

### Task 2: Set up e2e test configuration and global setup

**Files:**
- Modify: `backend/test/jest-e2e.json`
- Create: `backend/test/global-setup.ts`

- [ ] **Step 1: Replace jest-e2e.json**

Write to `backend/test/jest-e2e.json` (replace existing contents):

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

- [ ] **Step 2: Create test/global-setup.ts**

Write to `backend/test/global-setup.ts`:

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
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-change-me';
  process.env.JWT_REFRESH_SECRET =
    process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-change-me';
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run:
```
cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: No errors. If `test/global-setup.ts` is not included in the tsconfig scope, that's acceptable — ts-jest compiles it at test runtime.

---

### Task 3: Create test helper files

**Files:**
- Create: `backend/test/helpers/test-app.ts`
- Create: `backend/test/helpers/truncate.ts`
- Create: `backend/test/helpers/fixtures.ts`
- Create: `backend/test/helpers/event-capture.ts`

- [ ] **Step 1: Create test/helpers/test-app.ts**

Write to `backend/test/helpers/test-app.ts`:

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

- [ ] **Step 2: Create test/helpers/truncate.ts**

Write to `backend/test/helpers/truncate.ts`:

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

- [ ] **Step 3: Create test/helpers/fixtures.ts**

Write to `backend/test/helpers/fixtures.ts`:

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

- [ ] **Step 4: Create test/helpers/event-capture.ts**

Write to `backend/test/helpers/event-capture.ts`:

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

- [ ] **Step 5: Verify all helpers compile**

Run:
```
cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: No errors related to the new files. (Files under `test/` may or may not be in tsconfig; ts-jest compiles them at test runtime regardless.)

---

### Task 4: Write orders.e2e-spec.ts — all 16 tests

**Files:**
- Create: `backend/test/orders.e2e-spec.ts`

- [ ] **Step 1: Write the complete test file**

Write to `backend/test/orders.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { createTestApp } from './helpers/test-app';
import { truncateAll } from './helpers/truncate';
import {
  makeAuthenticatedUser,
  createListing,
  createOrder,
} from './helpers/fixtures';
import { captureEvents, EventCapture } from './helpers/event-capture';
import { KycStatus, OrderStatus, UserRole } from '../src/shared/enums';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let events: EventCapture;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    events = captureEvents(app);
  });

  beforeEach(async () => {
    await truncateAll(dataSource);
    events.reset();
  });

  afterAll(async () => {
    await app.close();
  });

  // ----------------------------------------------------------------------
  describe('POST /api/v1/orders', () => {
    it('creates an order (happy path): BUYER + VERIFIED KYC, correct decimals', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
        kycStatus: KycStatus.VERIFIED,
      });
      const { user: buyer, token } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
        kycStatus: KycStatus.VERIFIED,
      });
      const listing = await createListing(app, seller);

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          listingId: listing.id,
          quantity: 10,
          unitPrice: 1150,
          deliveryCountry: 'SA',
          deliveryCity: 'Riyadh',
          deliveryAddress: '123 Market St',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toEqual(expect.any(String));
      expect(res.body.buyerId).toBe(buyer.id);
      expect(res.body.sellerId).toBe(seller.id);
      // Decimal round-trip: ensure numbers returned as numbers or numeric strings
      // TypeORM returns decimals as strings; controller returns the raw saved entity
      expect(Number(res.body.totalPrice)).toBe(11500);
      expect(Number(res.body.commissionAmount)).toBe(575);
      expect(res.body.status).toBe(OrderStatus.PENDING);
    });

    it('returns 401 when no JWT is provided', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const listing = await createListing(app, seller);

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .send({
          listingId: listing.id,
          quantity: 10,
          unitPrice: 1150,
          deliveryCountry: 'SA',
          deliveryCity: 'Riyadh',
          deliveryAddress: '123 Market St',
        });

      expect(res.status).toBe(401);
    });

    it('returns 403 when SELLER role attempts to place an order (RolesGuard)', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { token } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
        kycStatus: KycStatus.VERIFIED,
      });
      const listing = await createListing(app, seller);

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          listingId: listing.id,
          quantity: 10,
          unitPrice: 1150,
          deliveryCountry: 'SA',
          deliveryCity: 'Riyadh',
          deliveryAddress: '123 Market St',
        });

      expect(res.status).toBe(403);
    });

    it('returns 403 when BUYER has PENDING KYC (KycVerifiedGuard)', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { token } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
        kycStatus: KycStatus.PENDING,
      });
      const listing = await createListing(app, seller);

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          listingId: listing.id,
          quantity: 10,
          unitPrice: 1150,
          deliveryCountry: 'SA',
          deliveryCity: 'Riyadh',
          deliveryAddress: '123 Market St',
        });

      expect(res.status).toBe(403);
    });

    it('returns 400 when DTO is invalid (negative quantity, ValidationPipe)', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { token } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
        kycStatus: KycStatus.VERIFIED,
      });
      const listing = await createListing(app, seller);

      const res = await request(app.getHttpServer())
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          listingId: listing.id,
          quantity: -5,
          unitPrice: 1150,
          deliveryCountry: 'SA',
          deliveryCity: 'Riyadh',
          deliveryAddress: '123 Market St',
        });

      expect(res.status).toBe(400);
    });
  });

  // ----------------------------------------------------------------------
  describe('PATCH /api/v1/orders/:id/status', () => {
    it('allows seller to transition PENDING → ACCEPTED', async () => {
      const { user: seller, token: sellerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.SELLER },
      );
      const { user: buyer } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const listing = await createListing(app, seller);
      const order = await createOrder(app, buyer, seller, listing);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ status: OrderStatus.ACCEPTED });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(OrderStatus.ACCEPTED);
    });

    it('returns 404 when caller is not a party (privacy)', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const { token: strangerToken } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const listing = await createListing(app, seller);
      const order = await createOrder(app, buyer, seller, listing);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ status: OrderStatus.CANCELLED });

      expect(res.status).toBe(404);
    });

    it('returns 400 on invalid transition (PENDING → DELIVERED)', async () => {
      const { user: seller, token: sellerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.SELLER },
      );
      const { user: buyer } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const listing = await createListing(app, seller);
      const order = await createOrder(app, buyer, seller, listing);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ status: OrderStatus.DELIVERED });

      expect(res.status).toBe(400);
    });

    it('emits OrderDeliveredEvent when buyer transitions IN_TRANSIT → DELIVERED', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const listing = await createListing(app, seller);
      const order = await createOrder(app, buyer, seller, listing, {
        status: OrderStatus.IN_TRANSIT,
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ status: OrderStatus.DELIVERED });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe(OrderStatus.DELIVERED);

      const delivered = events.getEmitted('order.delivered');
      expect(delivered).toHaveLength(1);
      expect(delivered[0]).toEqual(
        expect.objectContaining({
          orderId: order.id,
          buyerId: buyer.id,
          sellerId: seller.id,
        }),
      );
    });
  });

  // ----------------------------------------------------------------------
  describe('GET /api/v1/orders', () => {
    it('returns mixed buyer+seller orders with correct myRole per item', async () => {
      const { user: me, token } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const { user: other } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });

      // I'm buyer on this one
      const listing1 = await createListing(app, other);
      await createOrder(app, me, other, listing1);

      // I'm seller on this one (role=BUYER but I'm still the sellerId on the order)
      const listing2 = await createListing(app, me);
      const { user: anotherBuyer } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      await createOrder(app, anotherBuyer, me, listing2);

      const res = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.total).toBe(2);

      const roles = res.body.items.map((i: { myRole: string }) => i.myRole).sort();
      expect(roles).toEqual(['buyer', 'seller']);
    });

    it('paginates correctly (25 orders, page=2, pageSize=10)', async () => {
      const { user: me, token } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const listing = await createListing(app, seller);

      for (let i = 0; i < 25; i += 1) {
        await createOrder(app, me, seller, listing);
      }

      const res = await request(app.getHttpServer())
        .get('/api/v1/orders?page=2&pageSize=10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(10);
      expect(res.body.total).toBe(25);
      expect(res.body.page).toBe(2);
      expect(res.body.pageSize).toBe(10);
      expect(res.body.totalPages).toBe(3);
    });

    it('filters by status array (?status=pending&status=accepted)', async () => {
      const { user: me, token } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const listing = await createListing(app, seller);

      await createOrder(app, me, seller, listing, { status: OrderStatus.PENDING });
      await createOrder(app, me, seller, listing, { status: OrderStatus.ACCEPTED });
      await createOrder(app, me, seller, listing, { status: OrderStatus.PAID });
      await createOrder(app, me, seller, listing, { status: OrderStatus.COMPLETED });

      const res = await request(app.getHttpServer())
        .get('/api/v1/orders?status=pending&status=accepted')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      const statuses = res.body.items
        .map((i: { status: string }) => i.status)
        .sort();
      expect(statuses).toEqual([OrderStatus.ACCEPTED, OrderStatus.PENDING]);
    });

    it('returns 401 when no JWT is provided', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/orders');

      expect(res.status).toBe(401);
    });
  });

  // ----------------------------------------------------------------------
  describe('GET /api/v1/orders/:id', () => {
    it('returns full detail (with phone, delivery address) for party', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
        fullName: 'Seller Two',
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER, fullName: 'Buyer Two' },
      );
      const listing = await createListing(app, seller);
      const order = await createOrder(app, buyer, seller, listing);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(order.id);
      expect(res.body.myRole).toBe('buyer');
      expect(res.body.deliveryAddress).toBe('123 Test St');
      expect(res.body.buyer.phone).toBe(buyer.phone);
      expect(res.body.seller.phone).toBe(seller.phone);
    });

    it('returns 404 when order does not exist', async () => {
      const { token } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 when caller is not a party (privacy)', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const { token: strangerToken } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });
      const listing = await createListing(app, seller);
      const order = await createOrder(app, buyer, seller, listing);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(404);
    });
  });
});
```

- [ ] **Step 2: Verify TypeScript compilation of the test file**

Run:
```
cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: No errors related to `test/orders.e2e-spec.ts`. Note: the test file may not be in the main `tsconfig.json` scope; ts-jest compiles it at test runtime using its own config derived from the jest-e2e setup.

---

### Task 5: Run e2e tests, verify, and run regression

**Prerequisite check:** Docker Compose must be running. Verify with:
```
docker ps --format '{{.Names}}' | grep -E 'mashia-db|mashia-redis'
```
Expected: both `mashia-db` and `mashia-redis` listed. If either is missing, run:
```
cd /home/mohammadibrahim/mashia && docker compose up -d postgres redis
```

- [ ] **Step 1: Run e2e tests**

Run:
```
cd /home/mohammadibrahim/mashia/backend && npm run test:e2e 2>&1 | tail -40
```

Expected: `Tests: 16 passed, 16 total`.

If tests fail, inspect output carefully. Common issues:
- **Redis not running:** AppModule may fail to bootstrap. Verify `docker ps`.
- **JWT_SECRET missing:** global-setup.ts provides a default, but if something else reads it earlier, export it manually: `export JWT_SECRET=test-secret-change-me`.
- **Schema synchronize errors:** May indicate entity metadata conflicts. Rarely, dropping the test DB helps: `psql -U sheep_user -h localhost -d postgres -c 'DROP DATABASE mashia_test'` and re-run.
- **Status filter test failing with 0 items instead of 2:** TypeORM may not parse `?status=pending&status=accepted` as an array. If so, the issue is server-side DTO coercion, not the test — report back for diagnosis.
- **Phone uniqueness collisions:** If the `phoneCounter` helper rolls over across test files (global module state), expect no collisions within a single e2e run since only `orders.e2e-spec.ts` exists.

- [ ] **Step 2: Run unit tests to confirm no regression**

Run:
```
cd /home/mohammadibrahim/mashia/backend && npx jest --silent 2>&1 | tail -8
```

Expected: `Tests: 164 passed, 164 total`. The 4 pre-existing empty scaffold suites (payments/messaging/admin/certificates controllers) continue to "fail" as empty suites — that's pre-existing and not a regression.

- [ ] **Step 3: Verify combined test count**

Unit + e2e = 164 + 16 = **180 tests**. Confirm both numbers separately.
