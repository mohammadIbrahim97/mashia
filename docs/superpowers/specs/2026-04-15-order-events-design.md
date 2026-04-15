# US06-07: EventEmitter for order.created + order.delivered Design Spec

**Date:** 2026-04-15
**Issue:** #43 (G1-US06-07)

## Purpose

Establish event-driven communication between modules. `OrdersService` emits typed events after significant state changes; downstream modules (US07 escrow/payments, a future notifications module) will subscribe via `@OnEvent`. This issue covers emission + event classes only — no listeners are implemented here.

## Scope

**In:**
- `OrderCreatedEvent` class
- `OrderDeliveredEvent` class
- Emission from `OrdersService.create` and `OrdersService.updateStatus`
- Unit tests for emission behavior

**Out (deferred):**
- Listeners for either event (live in US07)
- Additional events: `OrderAcceptedEvent`, `OrderPaidEvent`, `OrderCancelledEvent`, `OrderDisputedEvent`, etc. (YAGNI; add when a consumer needs them)
- Cross-transaction guarantees, message-queue backing, distributed tracing

## Infrastructure (already in place)

- `@nestjs/event-emitter@^2.0.0` installed.
- `EventEmitterModule.forRoot()` registered globally in `app.module.ts`.
- No current users — this issue establishes the first emitter and the listener contract.

No new infrastructure required.

## Event Classes

Location: `backend/src/modules/orders/events/`.

### OrderCreatedEvent

**File:** `backend/src/modules/orders/events/order-created.event.ts`

```typescript
import { Currency } from '@shared/enums';

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

**Payload rationale:**
- `orderId` — primary key, every consumer needs it
- `buyerId`, `sellerId` — escrow account routing, notification targets
- `totalPrice`, `currency` — escrow payment intent creation

### OrderDeliveredEvent

**File:** `backend/src/modules/orders/events/order-delivered.event.ts`

```typescript
export class OrderDeliveredEvent {
  static readonly EVENT_NAME = 'order.delivered';

  constructor(
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly sellerId: string,
  ) {}
}
```

**Payload rationale:**
- `orderId` — identifier for escrow to find its payment record
- `buyerId`, `sellerId` — notification targets
- No monetary fields — escrow already has them from the earlier `order.created` → payment intent chain. Passing them again invites drift.

## Listener Contract (documented convention, not runtime-enforced)

Include this contract as a header comment block in BOTH event files:

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
```

No runtime enforcement for MVP. Reviewer discipline during US07 implementation.

## Service Changes

**File:** `backend/src/modules/orders/orders.service.ts`

### Constructor injection

Add `EventEmitter2` as the third constructor parameter:

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';
// ...
import { OrderCreatedEvent } from './events/order-created.event';
import { OrderDeliveredEvent } from './events/order-delivered.event';

// ...

constructor(
  @InjectRepository(Order)
  private readonly ordersRepository: Repository<Order>,
  @InjectRepository(Listing)
  private readonly listingsRepository: Repository<Listing>,
  private readonly eventEmitter: EventEmitter2,
) {}
```

### create() — emit order.created

Current end of `create` method:
```typescript
    return this.ordersRepository.save(order);
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
```

Note: `Number(saved.totalPrice)` because TypeORM decimal columns deserialize as strings.

### updateStatus() — emit order.delivered

Current end of `updateStatus` method:
```typescript
    order.status = newStatus;
    return this.ordersRepository.save(order);
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
```

The check is keyed on `newStatus === DELIVERED` not on the specific transition case. If we later add another path to DELIVERED (e.g., an admin-forced transition), it still emits correctly.

## Test Changes

**File:** `backend/src/modules/orders/orders.service.spec.ts`

### Test module setup

Add `EventEmitter2` to the providers:

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter';

// at describe scope:
let eventEmitter: jest.Mocked<EventEmitter2>;

// in beforeEach:
const mockEventEmitter = {
  emit: jest.fn(),
};

const module: TestingModule = await Test.createTestingModule({
  providers: [
    OrdersService,
    { provide: getRepositoryToken(Order), useValue: mockOrderRepo },
    { provide: getRepositoryToken(Listing), useValue: mockListingRepo },
    { provide: EventEmitter2, useValue: mockEventEmitter },
  ],
}).compile();

// retrieve:
eventEmitter = module.get(EventEmitter2);
```

### New tests

Add a new `describe('event emission', ...)` block after the existing describes, containing 4 tests:

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

      await service.updateStatus(orderId, sellerId, OrderStatus.ACCEPTED);

      const deliveredEmits = eventEmitter.emit.mock.calls.filter(
        ([name]) => name === OrderDeliveredEvent.EVENT_NAME,
      );
      expect(deliveredEmits).toHaveLength(0);
    });
  });
```

Imports added at top of the spec:
```typescript
import { OrderCreatedEvent } from './events/order-created.event';
import { OrderDeliveredEvent } from './events/order-delivered.event';
```

## Files to Create / Modify

**Create:**
- `backend/src/modules/orders/events/order-created.event.ts`
- `backend/src/modules/orders/events/order-delivered.event.ts`

**Modify:**
- `backend/src/modules/orders/orders.service.ts` — inject EventEmitter2, emit in `create` and `updateStatus`
- `backend/src/modules/orders/orders.service.spec.ts` — EventEmitter2 mock + 4 new tests + 2 imports

No module, AppModule, or package.json changes.

## Test Count

Current: 160. After this issue: **164** (160 + 4 new event-emission tests).

## Design Decisions Summary

1. **Curated payload shape** — explicit contract, no schema coupling, no re-fetch waste.
2. **Sync emit, listeners own errors** — never fail primary operation due to listener issues. Listener contract documented.
3. **Class-based events with static `EVENT_NAME`** — typo-safe, self-documenting, standard NestJS community pattern.
4. **Emit AFTER save returns** — DB is committed before any listener runs.
5. **DELIVERED emission keyed on newStatus, not transition case** — future-proof if new paths to DELIVERED are added.
6. **No listeners in this issue** — emission only. Subscribers arrive in US07 + notifications.
7. **No OrderAccepted/OrderCancelled/etc events yet** — YAGNI. Add when a consumer requires them.

## Error Cases

| Condition | Behavior |
|-----------|----------|
| Listener throws synchronously | Exception propagates; request 500s despite saved order. Prevented by listener contract (not enforced at runtime). |
| No listeners registered | `emit()` returns silently; no error. Normal during MVP. |
| Emit called after transaction rollback | Not applicable — we don't use explicit transactions, and emit happens only after `save()` returns. |
