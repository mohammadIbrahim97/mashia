# Order Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit `OrderCreatedEvent` after successful `OrdersService.create()` and `OrderDeliveredEvent` when `OrdersService.updateStatus()` transitions an order to `DELIVERED`. Establishes the event-driven integration point that US07 escrow and future notifications will subscribe to.

**Architecture:** Two class-based events with static `EVENT_NAME` constants live under `backend/src/modules/orders/events/`. `OrdersService` gains an `EventEmitter2` constructor dependency and emits synchronously after the DB save returns. Emit is fire-and-forget — listeners must never throw (contract documented in the event files). No listeners land in this issue; subscribers arrive in US07.

**Tech Stack:** NestJS, `@nestjs/event-emitter` v2 (already installed, `EventEmitterModule.forRoot()` already registered in `app.module.ts`), Jest.

**Spec:** `docs/superpowers/specs/2026-04-15-order-events-design.md`

**Note on git:** The user commits manually — do NOT run `git add`, `git commit`, or `git push` in any step.

---

### Task 1: Create event classes

**Files:**
- Create: `backend/src/modules/orders/events/order-created.event.ts`
- Create: `backend/src/modules/orders/events/order-delivered.event.ts`

- [ ] **Step 1: Write OrderCreatedEvent**

Write to `backend/src/modules/orders/events/order-created.event.ts`:

```typescript
import { Currency } from '@shared/enums';

/**
 * LISTENER CONTRACT
 *
 * Any `@OnEvent` handler for this event in the codebase MUST:
 * 1. Wrap its handler body in try/catch
 * 2. Log errors via the structured logger
 * 3. NEVER throw
 *
 * Emitters use synchronous `emit()` and do NOT catch listener errors.
 * A thrown listener will crash the HTTP request that triggered the emission,
 * even though the underlying DB transaction already committed.
 *
 * If you are building a listener: your code is responsible for its own
 * retry/reconciliation. The order has already been saved; your failure
 * must not surface to the end user.
 */
export class OrderCreatedEvent {
  static readonly EVENT_NAME = 'order.created';

  constructor(
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly sellerId: string,
    public readonly totalPrice: number,
    public readonly currency: Currency,
  ) {}
}
```

- [ ] **Step 2: Write OrderDeliveredEvent**

Write to `backend/src/modules/orders/events/order-delivered.event.ts`:

```typescript
/**
 * LISTENER CONTRACT
 *
 * Any `@OnEvent` handler for this event in the codebase MUST:
 * 1. Wrap its handler body in try/catch
 * 2. Log errors via the structured logger
 * 3. NEVER throw
 *
 * Emitters use synchronous `emit()` and do NOT catch listener errors.
 * A thrown listener will crash the HTTP request that triggered the emission,
 * even though the underlying DB transaction already committed.
 *
 * If you are building a listener: your code is responsible for its own
 * retry/reconciliation. The order has already been saved; your failure
 * must not surface to the end user.
 */
export class OrderDeliveredEvent {
  static readonly EVENT_NAME = 'order.delivered';

  constructor(
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly sellerId: string,
  ) {}
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

---

### Task 2: Extend OrdersService spec with event emission tests (TDD red)

**Files:**
- Modify: `backend/src/modules/orders/orders.service.spec.ts`

- [ ] **Step 1: Add EventEmitter2 import and test-scope declaration**

At the top of `backend/src/modules/orders/orders.service.spec.ts`, find the existing imports block. After the existing `@nestjs/typeorm` import line:

```typescript
import { getRepositoryToken } from '@nestjs/typeorm';
```

Add directly below it:

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
```

Then find the existing DTO/event imports. After:

```typescript
import { CreateOrderDto } from './dto/create-order.dto';
```

Add:

```typescript
import { OrderCreatedEvent } from './events/order-created.event';
import { OrderDeliveredEvent } from './events/order-delivered.event';
```

Then find the describe-scope `let` declarations (near the top of the describe block, where `listingRepo` and `mockQb` are declared). Add one more declaration immediately after `mockQb`:

```typescript
  let eventEmitter: jest.Mocked<EventEmitter2>;
```

- [ ] **Step 2: Extend beforeEach with EventEmitter2 mock**

Find the `beforeEach` block. After the existing `mockOrderRepo` and `mockListingRepo` definitions (before the `TestingModule.createTestingModule` call), add:

```typescript
    const mockEventEmitter = {
      emit: jest.fn(),
    };
```

Then find the providers array:

```typescript
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: mockOrderRepo },
        { provide: getRepositoryToken(Listing), useValue: mockListingRepo },
      ],
    }).compile();
```

Replace with:

```typescript
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: mockOrderRepo },
        { provide: getRepositoryToken(Listing), useValue: mockListingRepo },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();
```

Then find the existing `module.get` calls at the end of the `beforeEach`:

```typescript
    service = module.get<OrdersService>(OrdersService);
    orderRepo = module.get(getRepositoryToken(Order));
    listingRepo = module.get(getRepositoryToken(Listing));
```

Replace with:

```typescript
    service = module.get<OrdersService>(OrdersService);
    orderRepo = module.get(getRepositoryToken(Order));
    listingRepo = module.get(getRepositoryToken(Listing));
    eventEmitter = module.get(EventEmitter2);
```

- [ ] **Step 3: Append event emission describe block**

Append the following at the end of the file, INSIDE the outer `describe('OrdersService', ...)` block (before its closing `});`), AFTER the existing `describe('findOne', ...)` block:

```typescript

  describe('event emission', () => {
    it('emits OrderCreatedEvent after successful order creation', async () => {
      listingRepo.findOne.mockResolvedValue(activeListing as Listing);
      orderRepo.create.mockImplementation((data) => data as Order);
      orderRepo.save.mockImplementation(async (data) => ({
        ...(data as Order),
        id: '44444444-4444-4444-4444-444444444444',
      }));

      await service.create(buyerId, createDto);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        OrderCreatedEvent.EVENT_NAME,
        expect.objectContaining({
          orderId: '44444444-4444-4444-4444-444444444444',
          buyerId,
          sellerId,
          totalPrice: 11500,
          currency: Currency.SAR,
        }),
      );
    });

    it('does NOT emit OrderCreatedEvent when create fails (self-order forbidden)', async () => {
      listingRepo.findOne.mockResolvedValue({
        ...activeListing,
        sellerId: buyerId,
      } as Listing);

      await expect(service.create(buyerId, createDto)).rejects.toThrow();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('emits OrderDeliveredEvent when updateStatus transitions to DELIVERED (IN_TRANSIT → DELIVERED by buyer)', async () => {
      const orderId = '44444444-4444-4444-4444-444444444444';
      orderRepo.findOne.mockResolvedValue({
        id: orderId,
        buyerId,
        sellerId,
        status: OrderStatus.IN_TRANSIT,
      } as Order);
      orderRepo.save.mockImplementation(async (o) => o as Order);

      await service.updateStatus(orderId, buyerId, OrderStatus.DELIVERED);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        OrderDeliveredEvent.EVENT_NAME,
        expect.objectContaining({ orderId, buyerId, sellerId }),
      );
    });

    it('does NOT emit OrderDeliveredEvent for other successful transitions (PENDING → ACCEPTED)', async () => {
      const orderId = '44444444-4444-4444-4444-444444444444';
      orderRepo.findOne.mockResolvedValue({
        id: orderId,
        buyerId,
        sellerId,
        status: OrderStatus.PENDING,
      } as Order);
      orderRepo.save.mockImplementation(async (o) => o as Order);

      await service.updateStatus(orderId, sellerId, OrderStatus.ACCEPTED);

      const deliveredEmits = eventEmitter.emit.mock.calls.filter(
        ([name]) => name === OrderDeliveredEvent.EVENT_NAME,
      );
      expect(deliveredEmits).toHaveLength(0);
    });
  });
```

- [ ] **Step 4: Run tests to verify the new cases fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/orders/orders.service.spec.ts 2>&1 | tail -25`
Expected: FAIL. Without the service emitting, the `expect(eventEmitter.emit).toHaveBeenCalledWith(...)` assertions will fail for the positive tests. There may also be DI errors if the service isn't asking for EventEmitter2 yet — if that occurs, the failure is "Nest can't resolve dependencies of the OrdersService (..., ?)" or similar. Report whichever failure mode appears.

---

### Task 3: Implement event emission in OrdersService (TDD green)

**Files:**
- Modify: `backend/src/modules/orders/orders.service.ts`

- [ ] **Step 1: Update imports**

In `backend/src/modules/orders/orders.service.ts`, the current top imports include:

```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { Listing } from '../listings/listing.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { OrderListItemResponse } from './dto/order-list-item.response';
import { OrderDetailResponse } from './dto/order-detail.response';
import { ListingStatus, OrderStatus } from '@shared/enums';
```

Add these imports. Replace with:

```typescript
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { Listing } from '../listings/listing.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { OrderListItemResponse } from './dto/order-list-item.response';
import { OrderDetailResponse } from './dto/order-detail.response';
import { OrderCreatedEvent } from './events/order-created.event';
import { OrderDeliveredEvent } from './events/order-delivered.event';
import { ListingStatus, OrderStatus } from '@shared/enums';
```

- [ ] **Step 2: Add EventEmitter2 to the constructor**

Find the current constructor:

```typescript
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
  ) {}
```

Replace with:

```typescript
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    private readonly eventEmitter: EventEmitter2,
  ) {}
```

- [ ] **Step 3: Emit OrderCreatedEvent from create()**

Find the end of the `create` method:

```typescript
    return this.ordersRepository.save(order);
  }
```

Replace with:

```typescript
    const saved = await this.ordersRepository.save(order);
    this.eventEmitter.emit(
      OrderCreatedEvent.EVENT_NAME,
      new OrderCreatedEvent(
        saved.id,
        saved.buyerId,
        saved.sellerId,
        Number(saved.totalPrice),
        saved.currency,
      ),
    );
    return saved;
  }
```

- [ ] **Step 4: Emit OrderDeliveredEvent from updateStatus()**

Find the end of the `updateStatus` method:

```typescript
    order.status = newStatus;
    return this.ordersRepository.save(order);
  }
```

Replace with:

```typescript
    order.status = newStatus;
    const saved = await this.ordersRepository.save(order);
    if (newStatus === OrderStatus.DELIVERED) {
      this.eventEmitter.emit(
        OrderDeliveredEvent.EVENT_NAME,
        new OrderDeliveredEvent(saved.id, saved.buyerId, saved.sellerId),
      );
    }
    return saved;
  }
```

- [ ] **Step 5: Run service tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/orders/orders.service.spec.ts 2>&1 | tail -15`
Expected: PASS — 44 tests total (8 existing `create` + 16 `updateStatus` + 12 `findMyOrders` + 4 `findOne` + 4 new `event emission` = 44).

---

### Task 4: Full regression check

- [ ] **Step 1: Run complete test suite**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --silent 2>&1 | tail -8`
Expected: `Tests: 164 passed` (160 existing + 4 new = 164).

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.
