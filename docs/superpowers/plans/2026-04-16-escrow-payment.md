# Escrow Payment System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement US07 — the escrow payment system. Buyer pays accepted orders into escrow; funds release to seller (minus commission) on explicit buyer release or 7-day auto-release after DELIVERED; admin refunds disputed orders. Payments drive order status via domain events; EscrowService is a stub for MVP.

**Architecture:** New `payments` module with Payment entity, PaymentsService, EscrowService (stub), PaymentsController, and three domain events (`payment.held`, `payment.released`, `payment.refunded`). Orders module gains a cross-module listener that performs the corresponding status transitions via a new internal `transitionFromPayment()` method. Auto-release runs as an in-process `@nestjs/schedule` cron reading `payments.auto_release_at`.

**Tech Stack:** NestJS 10 + TypeORM + Postgres 16 + `@nestjs/event-emitter` + `@nestjs/schedule` + Jest + SuperTest.

**Spec:** `docs/superpowers/specs/2026-04-16-escrow-payment-design.md`

**Parent issue:** #45. Sub-issues: #46, #47, #48, #49, #50, #51, #52, #53, #54.

**Note on git:** The user commits manually — do NOT run `git add`, `git commit`, or `git push` in any step. Review checkpoints are labelled **COMMIT CHECKPOINT**; at each, stop and hand control back.

**Prerequisite for running tests:** Docker Compose must be up (`docker compose up -d postgres redis`). `JWT_SECRET` / `JWT_REFRESH_SECRET` set in shell env or `.env`; test `global-setup.ts` provides defaults.

---

## File Structure (decomposition)

### New files

- `backend/src/modules/payments/payment.entity.ts` — Payment entity
- `backend/src/modules/payments/escrow.service.ts` — stub gateway
- `backend/src/modules/payments/escrow.service.spec.ts` — unit tests for stub
- `backend/src/modules/payments/payments.service.ts` — business logic
- `backend/src/modules/payments/payments.service.spec.ts` — unit tests
- `backend/src/modules/payments/payments.controller.ts` — HTTP endpoints
- `backend/src/modules/payments/payments.module.ts` — wiring
- `backend/src/modules/payments/order-delivered.listener.ts` — sets `autoReleaseAt`
- `backend/src/modules/payments/dto/initiate-payment.dto.ts`
- `backend/src/modules/payments/dto/refund-payment.dto.ts`
- `backend/src/modules/payments/dto/payment.response.ts`
- `backend/src/modules/payments/events/payment-held.event.ts`
- `backend/src/modules/payments/events/payment-released.event.ts`
- `backend/src/modules/payments/events/payment-refunded.event.ts`
- `backend/src/modules/orders/payment-status.listener.ts` — orders side listener
- `backend/src/modules/orders/payment-status.listener.spec.ts`
- `backend/test/payments.e2e-spec.ts`

### Modified files

- `backend/src/shared/enums/index.ts` — add `PaymentMethod`, `EscrowStatus`
- `backend/src/modules/orders/orders.service.ts` — add `transitionFromPayment()`
- `backend/src/modules/orders/orders.module.ts` — register PaymentStatusListener
- `backend/src/app.module.ts` — import `ScheduleModule.forRoot()`
- `backend/test/helpers/fixtures.ts` — add `createAcceptedOrder`
- `backend/package.json` — add `@nestjs/schedule`

---

## Task 1: Add PaymentMethod and EscrowStatus enums

**Files:**
- Modify: `backend/src/shared/enums/index.ts`

- [ ] **Step 1: Append enums to `backend/src/shared/enums/index.ts`**

Add after the existing `OrderStatus` enum:

```typescript
export enum PaymentMethod {
  STC_PAY = 'stc_pay',
  MADA = 'mada',
  BANK_TRANSFER = 'bank_transfer',
}

export enum EscrowStatus {
  HELD = 'held',
  RELEASED = 'released',
  REFUNDED = 'refunded',
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors mentioning `shared/enums`.

---

## Task 2: Create Payment entity

**Files:**
- Create: `backend/src/modules/payments/payment.entity.ts`

- [ ] **Step 1: Write the entity**

Create `backend/src/modules/payments/payment.entity.ts`:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { Currency, EscrowStatus, PaymentMethod } from '@shared/enums';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'order_id' })
  orderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payer_id' })
  payer: User;

  @Column({ type: 'uuid', name: 'payer_id' })
  payerId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'commission_amount' })
  commissionAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'seller_amount' })
  sellerAmount: number;

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({
    type: 'enum',
    enum: EscrowStatus,
    name: 'escrow_status',
    default: EscrowStatus.HELD,
  })
  escrowStatus: EscrowStatus;

  @Column({ type: 'text', name: 'transaction_ref' })
  transactionRef: string;

  @Column({ type: 'timestamptz', name: 'auto_release_at', nullable: true })
  autoReleaseAt: Date | null;

  @Column({ type: 'timestamptz', name: 'paid_at' })
  paidAt: Date;

  @Column({ type: 'timestamptz', name: 'released_at', nullable: true })
  releasedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'refunded_at', nullable: true })
  refundedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors referencing `payment.entity.ts`.

---

## Task 3: Create three event classes

**Files:**
- Create: `backend/src/modules/payments/events/payment-held.event.ts`
- Create: `backend/src/modules/payments/events/payment-released.event.ts`
- Create: `backend/src/modules/payments/events/payment-refunded.event.ts`

- [ ] **Step 1: Create `events/payment-held.event.ts`**

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
 */
export class PaymentHeldEvent {
  static readonly EVENT_NAME = 'payment.held';

  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly sellerId: string,
    public readonly sellerAmount: number,
    public readonly commissionAmount: number,
    public readonly currency: Currency,
  ) {}
}
```

- [ ] **Step 2: Create `events/payment-released.event.ts`**

```typescript
import { Currency } from '@shared/enums';

/**
 * LISTENER CONTRACT — see payment-held.event.ts for full contract.
 * Handlers MUST try/catch, log, never throw.
 */
export class PaymentReleasedEvent {
  static readonly EVENT_NAME = 'payment.released';

  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly sellerId: string,
    public readonly sellerAmount: number,
    public readonly currency: Currency,
  ) {}
}
```

- [ ] **Step 3: Create `events/payment-refunded.event.ts`**

```typescript
import { Currency } from '@shared/enums';

/**
 * LISTENER CONTRACT — see payment-held.event.ts for full contract.
 * Handlers MUST try/catch, log, never throw.
 */
export class PaymentRefundedEvent {
  static readonly EVENT_NAME = 'payment.refunded';

  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly amount: number,
    public readonly currency: Currency,
  ) {}
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors.

---

## Task 4: EscrowService stub + unit tests (TDD)

**Files:**
- Create: `backend/src/modules/payments/escrow.service.spec.ts` (write first)
- Create: `backend/src/modules/payments/escrow.service.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `backend/src/modules/payments/escrow.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { EscrowService } from './escrow.service';
import { Currency, PaymentMethod } from '@shared/enums';

describe('EscrowService (stub)', () => {
  let service: EscrowService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [EscrowService],
    }).compile();
    service = module.get(EscrowService);
  });

  it('holdFunds returns a STUB-prefixed transactionRef', async () => {
    const result = await service.holdFunds(1000, Currency.SAR, PaymentMethod.MADA);
    expect(result.transactionRef).toMatch(/^STUB-[0-9a-f-]{36}$/);
    expect(result.status).toBe('held');
  });

  it('releaseFunds echoes the ref and returns status released', async () => {
    const ref = 'STUB-11111111-1111-1111-1111-111111111111';
    const result = await service.releaseFunds(ref);
    expect(result.transactionRef).toBe(ref);
    expect(result.status).toBe('released');
  });

  it('refundFunds echoes the ref and returns status refunded', async () => {
    const ref = 'STUB-22222222-2222-2222-2222-222222222222';
    const result = await service.refundFunds(ref);
    expect(result.transactionRef).toBe(ref);
    expect(result.status).toBe('refunded');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest escrow.service.spec.ts 2>&1 | tail -20`

Expected: FAIL — `Cannot find module './escrow.service'`.

- [ ] **Step 3: Implement EscrowService**

Create `backend/src/modules/payments/escrow.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Currency, PaymentMethod } from '@shared/enums';

export interface EscrowResult {
  transactionRef: string;
  status: 'held' | 'released' | 'refunded';
}

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  async holdFunds(
    amount: number,
    currency: Currency,
    method: PaymentMethod,
  ): Promise<EscrowResult> {
    const transactionRef = `STUB-${randomUUID()}`;
    this.logger.log(
      `[stub] holdFunds ${amount} ${currency} via ${method} → ${transactionRef}`,
    );
    return { transactionRef, status: 'held' };
  }

  async releaseFunds(transactionRef: string): Promise<EscrowResult> {
    this.logger.log(`[stub] releaseFunds ${transactionRef}`);
    return { transactionRef, status: 'released' };
  }

  async refundFunds(transactionRef: string): Promise<EscrowResult> {
    this.logger.log(`[stub] refundFunds ${transactionRef}`);
    return { transactionRef, status: 'refunded' };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest escrow.service.spec.ts 2>&1 | tail -10`

Expected: PASS, 3 tests.

---

## Task 5: Payment response DTO

**Files:**
- Create: `backend/src/modules/payments/dto/payment.response.ts`

- [ ] **Step 1: Write the DTO**

Create `backend/src/modules/payments/dto/payment.response.ts`:

```typescript
import { Payment } from '../payment.entity';
import { Currency, EscrowStatus, PaymentMethod } from '@shared/enums';

export class PaymentResponse {
  id: string;
  orderId: string;
  payerId: string;
  amount: number;
  sellerAmount: number;
  commissionAmount: number;
  currency: Currency;
  method: PaymentMethod;
  escrowStatus: EscrowStatus;
  transactionRef: string;
  autoReleaseAt: Date | null;
  paidAt: Date;
  releasedAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;

  static fromPayment(p: Payment): PaymentResponse {
    return {
      id: p.id,
      orderId: p.orderId,
      payerId: p.payerId,
      amount: Number(p.amount),
      sellerAmount: Number(p.sellerAmount),
      commissionAmount: Number(p.commissionAmount),
      currency: p.currency,
      method: p.method,
      escrowStatus: p.escrowStatus,
      transactionRef: p.transactionRef,
      autoReleaseAt: p.autoReleaseAt,
      paidAt: p.paidAt,
      releasedAt: p.releasedAt,
      refundedAt: p.refundedAt,
      createdAt: p.createdAt,
    };
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors.

---

## Task 6: InitiatePaymentDto

**Files:**
- Create: `backend/src/modules/payments/dto/initiate-payment.dto.ts`

- [ ] **Step 1: Write the DTO**

Create `backend/src/modules/payments/dto/initiate-payment.dto.ts`:

```typescript
import { IsEnum, IsUUID } from 'class-validator';
import { PaymentMethod } from '@shared/enums';

export class InitiatePaymentDto {
  @IsUUID()
  orderId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors.

---

## Task 7: OrdersService.transitionFromPayment + module export (TDD on existing service)

**Files:**
- Modify: `backend/src/modules/orders/orders.service.ts`
- Modify: `backend/src/modules/orders/orders.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `backend/src/modules/orders/orders.service.spec.ts` (within the existing `describe('OrdersService')` block — inspect the file first to find the closing brace position). If there's no existing describe structure that fits, add a new `describe('transitionFromPayment', () => { ... })` block at the end before the final `});`:

```typescript
  describe('transitionFromPayment', () => {
    it('moves ACCEPTED → PAID when called from payments module', async () => {
      const order = {
        id: 'order-1',
        buyerId: 'b',
        sellerId: 's',
        status: OrderStatus.ACCEPTED,
      } as Order;
      jest.spyOn(ordersRepo, 'findOne').mockResolvedValue(order);
      jest.spyOn(ordersRepo, 'save').mockImplementation(async (o) => o as Order);

      const result = await service.transitionFromPayment(
        'order-1',
        OrderStatus.PAID,
      );

      expect(result.status).toBe(OrderStatus.PAID);
    });

    it('moves DELIVERED → COMPLETED', async () => {
      const order = {
        id: 'order-1',
        status: OrderStatus.DELIVERED,
      } as Order;
      jest.spyOn(ordersRepo, 'findOne').mockResolvedValue(order);
      jest.spyOn(ordersRepo, 'save').mockImplementation(async (o) => o as Order);

      const result = await service.transitionFromPayment(
        'order-1',
        OrderStatus.COMPLETED,
      );

      expect(result.status).toBe(OrderStatus.COMPLETED);
    });

    it('moves DISPUTED → CANCELLED', async () => {
      const order = {
        id: 'order-1',
        status: OrderStatus.DISPUTED,
      } as Order;
      jest.spyOn(ordersRepo, 'findOne').mockResolvedValue(order);
      jest.spyOn(ordersRepo, 'save').mockImplementation(async (o) => o as Order);

      const result = await service.transitionFromPayment(
        'order-1',
        OrderStatus.CANCELLED,
      );

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('throws NotFoundException when order missing', async () => {
      jest.spyOn(ordersRepo, 'findOne').mockResolvedValue(null);
      await expect(
        service.transitionFromPayment('missing', OrderStatus.PAID),
      ).rejects.toThrow('Order not found');
    });

    it('throws BadRequestException for invalid transition', async () => {
      const order = {
        id: 'order-1',
        status: OrderStatus.PENDING,
      } as Order;
      jest.spyOn(ordersRepo, 'findOne').mockResolvedValue(order);
      await expect(
        service.transitionFromPayment('order-1', OrderStatus.PAID),
      ).rejects.toThrow(/Invalid payment-driven transition/);
    });
  });
```

Note: `ordersRepo` is the existing spec's repository mock reference — find its exact name in the file (it may be `orderRepository` or `repo`) and match.

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx jest orders.service.spec.ts 2>&1 | tail -15`

Expected: FAIL — `service.transitionFromPayment is not a function`.

- [ ] **Step 3: Implement `transitionFromPayment`**

Add to `backend/src/modules/orders/orders.service.ts` (after the existing `updateStatus` method, before `findMyOrders`):

```typescript
  /**
   * Internal-only transition invoked by cross-module listeners (payments).
   * Bypasses the user-authorization check in updateStatus() because it runs
   * on behalf of the system, not an authenticated user.
   *
   * Allowed transitions:
   *   ACCEPTED  → PAID       (on payment.held)
   *   DELIVERED → COMPLETED  (on payment.released)
   *   DISPUTED  → CANCELLED  (on payment.refunded)
   *
   * @internal
   */
  async transitionFromPayment(
    orderId: string,
    target: OrderStatus,
  ): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const allowed =
      (order.status === OrderStatus.ACCEPTED && target === OrderStatus.PAID) ||
      (order.status === OrderStatus.DELIVERED && target === OrderStatus.COMPLETED) ||
      (order.status === OrderStatus.DISPUTED && target === OrderStatus.CANCELLED);

    if (!allowed) {
      throw new BadRequestException(
        `Invalid payment-driven transition from ${order.status} to ${target}`,
      );
    }

    order.status = target;
    return this.ordersRepository.save(order);
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npx jest orders.service.spec.ts 2>&1 | tail -15`

Expected: PASS, all existing tests + 5 new transitionFromPayment tests.

---

## Task 8: PaymentStatusListener (orders-side) — all three handlers + unit tests

**Files:**
- Create: `backend/src/modules/orders/payment-status.listener.spec.ts` (write first)
- Create: `backend/src/modules/orders/payment-status.listener.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/modules/orders/payment-status.listener.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { PaymentStatusListener } from './payment-status.listener';
import { OrdersService } from './orders.service';
import { PaymentHeldEvent } from '../payments/events/payment-held.event';
import { PaymentReleasedEvent } from '../payments/events/payment-released.event';
import { PaymentRefundedEvent } from '../payments/events/payment-refunded.event';
import { Currency, OrderStatus } from '@shared/enums';

describe('PaymentStatusListener', () => {
  let listener: PaymentStatusListener;
  let ordersService: { transitionFromPayment: jest.Mock };

  beforeEach(async () => {
    ordersService = { transitionFromPayment: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        PaymentStatusListener,
        { provide: OrdersService, useValue: ordersService },
      ],
    }).compile();
    listener = module.get(PaymentStatusListener);
  });

  it('transitions ACCEPTED → PAID on payment.held', async () => {
    const event = new PaymentHeldEvent(
      'p1', 'o1', 'buyer', 'seller', 950, 50, Currency.SAR,
    );
    await listener.onPaymentHeld(event);
    expect(ordersService.transitionFromPayment).toHaveBeenCalledWith(
      'o1',
      OrderStatus.PAID,
    );
  });

  it('transitions DELIVERED → COMPLETED on payment.released', async () => {
    const event = new PaymentReleasedEvent(
      'p1', 'o1', 'seller', 950, Currency.SAR,
    );
    await listener.onPaymentReleased(event);
    expect(ordersService.transitionFromPayment).toHaveBeenCalledWith(
      'o1',
      OrderStatus.COMPLETED,
    );
  });

  it('transitions DISPUTED → CANCELLED on payment.refunded', async () => {
    const event = new PaymentRefundedEvent(
      'p1', 'o1', 'buyer', 1000, Currency.SAR,
    );
    await listener.onPaymentRefunded(event);
    expect(ordersService.transitionFromPayment).toHaveBeenCalledWith(
      'o1',
      OrderStatus.CANCELLED,
    );
  });

  it('swallows errors thrown by ordersService (listener contract)', async () => {
    ordersService.transitionFromPayment.mockRejectedValueOnce(
      new Error('boom'),
    );
    const event = new PaymentHeldEvent(
      'p1', 'o1', 'buyer', 'seller', 950, 50, Currency.SAR,
    );
    await expect(listener.onPaymentHeld(event)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && npx jest payment-status.listener.spec.ts 2>&1 | tail -15`

Expected: FAIL — `Cannot find module './payment-status.listener'`.

- [ ] **Step 3: Implement listener**

Create `backend/src/modules/orders/payment-status.listener.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { PaymentHeldEvent } from '../payments/events/payment-held.event';
import { PaymentReleasedEvent } from '../payments/events/payment-released.event';
import { PaymentRefundedEvent } from '../payments/events/payment-refunded.event';
import { OrderStatus } from '@shared/enums';

@Injectable()
export class PaymentStatusListener {
  private readonly logger = new Logger(PaymentStatusListener.name);

  constructor(private readonly ordersService: OrdersService) {}

  @OnEvent(PaymentHeldEvent.EVENT_NAME)
  async onPaymentHeld(event: PaymentHeldEvent): Promise<void> {
    try {
      await this.ordersService.transitionFromPayment(
        event.orderId,
        OrderStatus.PAID,
      );
    } catch (err) {
      this.logger.error(
        `Failed to transition order ${event.orderId} to PAID after payment.held (paymentId=${event.paymentId})`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  @OnEvent(PaymentReleasedEvent.EVENT_NAME)
  async onPaymentReleased(event: PaymentReleasedEvent): Promise<void> {
    try {
      await this.ordersService.transitionFromPayment(
        event.orderId,
        OrderStatus.COMPLETED,
      );
    } catch (err) {
      this.logger.error(
        `Failed to transition order ${event.orderId} to COMPLETED after payment.released (paymentId=${event.paymentId})`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  @OnEvent(PaymentRefundedEvent.EVENT_NAME)
  async onPaymentRefunded(event: PaymentRefundedEvent): Promise<void> {
    try {
      await this.ordersService.transitionFromPayment(
        event.orderId,
        OrderStatus.CANCELLED,
      );
    } catch (err) {
      this.logger.error(
        `Failed to transition order ${event.orderId} to CANCELLED after payment.refunded (paymentId=${event.paymentId})`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npx jest payment-status.listener.spec.ts 2>&1 | tail -15`

Expected: PASS, 4 tests.

- [ ] **Step 5: Register listener in OrdersModule**

Modify `backend/src/modules/orders/orders.module.ts` — add `PaymentStatusListener` to providers:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { Listing } from '../listings/listing.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PaymentStatusListener } from './payment-status.listener';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Listing])],
  controllers: [OrdersController],
  providers: [OrdersService, PaymentStatusListener],
  exports: [OrdersService],
})
export class OrdersModule {}
```

---

## Task 9: PaymentsService.initiate + unit tests (TDD)

**Files:**
- Create: `backend/src/modules/payments/payments.service.spec.ts` (write first)
- Create: `backend/src/modules/payments/payments.service.ts`

- [ ] **Step 1: Write the failing unit tests (initiate only — other methods added in later tasks)**

Create `backend/src/modules/payments/payments.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { EscrowService } from './escrow.service';
import { Payment } from './payment.entity';
import { Order } from '../orders/order.entity';
import { PaymentHeldEvent } from './events/payment-held.event';
import {
  Currency,
  EscrowStatus,
  OrderStatus,
  PaymentMethod,
} from '@shared/enums';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentsRepo: jest.Mocked<Repository<Payment>>;
  let ordersRepo: jest.Mocked<Repository<Order>>;
  let escrow: jest.Mocked<EscrowService>;
  let emitter: { emit: jest.Mock };

  beforeEach(async () => {
    paymentsRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;
    ordersRepo = { findOne: jest.fn() } as any;
    escrow = {
      holdFunds: jest.fn(),
      releaseFunds: jest.fn(),
      refundFunds: jest.fn(),
    } as any;
    emitter = { emit: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: EscrowService, useValue: escrow },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();
    service = module.get(PaymentsService);
  });

  describe('initiate', () => {
    const buyer = 'buyer-1';
    const dto = { orderId: 'order-1', method: PaymentMethod.MADA };
    const acceptedOrder = {
      id: 'order-1',
      buyerId: buyer,
      sellerId: 'seller-1',
      totalPrice: 1000,
      commissionRate: 5,
      currency: Currency.SAR,
      status: OrderStatus.ACCEPTED,
    } as Order;

    it('holds funds, saves payment, emits PaymentHeldEvent — happy path', async () => {
      ordersRepo.findOne.mockResolvedValue(acceptedOrder);
      escrow.holdFunds.mockResolvedValue({
        transactionRef: 'STUB-abc',
        status: 'held',
      });
      paymentsRepo.save.mockImplementation(async (p) => ({
        ...p,
        id: 'pay-1',
      }) as Payment);

      const result = await service.initiate(buyer, dto);

      expect(result.escrowStatus).toBe(EscrowStatus.HELD);
      expect(result.amount).toBe(1000);
      expect(result.commissionAmount).toBe(50);
      expect(result.sellerAmount).toBe(950);
      expect(escrow.holdFunds).toHaveBeenCalledWith(
        1000,
        Currency.SAR,
        PaymentMethod.MADA,
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        PaymentHeldEvent.EVENT_NAME,
        expect.objectContaining({
          paymentId: 'pay-1',
          orderId: 'order-1',
          sellerAmount: 950,
          commissionAmount: 50,
        }),
      );
    });

    it('throws NotFoundException when order missing', async () => {
      ordersRepo.findOne.mockResolvedValue(null);
      await expect(service.initiate(buyer, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when caller is not the buyer', async () => {
      ordersRepo.findOne.mockResolvedValue({
        ...acceptedOrder,
        buyerId: 'someone-else',
      } as Order);
      await expect(service.initiate(buyer, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when order not ACCEPTED', async () => {
      ordersRepo.findOne.mockResolvedValue({
        ...acceptedOrder,
        status: OrderStatus.PENDING,
      } as Order);
      await expect(service.initiate(buyer, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException on unique order_id violation', async () => {
      ordersRepo.findOne.mockResolvedValue(acceptedOrder);
      escrow.holdFunds.mockResolvedValue({
        transactionRef: 'STUB-abc',
        status: 'held',
      });
      const dbError: any = new Error('duplicate key');
      dbError.code = '23505';
      paymentsRepo.save.mockRejectedValue(dbError);
      await expect(service.initiate(buyer, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx jest payments.service.spec.ts 2>&1 | tail -15`

Expected: FAIL — `Cannot find module './payments.service'`.

- [ ] **Step 3: Implement PaymentsService (initiate only for now; release/refund/processAutoReleases stubbed)**

Create `backend/src/modules/payments/payments.service.ts`:

```typescript
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Payment } from './payment.entity';
import { Order } from '../orders/order.entity';
import { EscrowService } from './escrow.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentHeldEvent } from './events/payment-held.event';
import { EscrowStatus, OrderStatus } from '@shared/enums';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly escrow: EscrowService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async initiate(buyerId: string, dto: InitiatePaymentDto): Promise<Payment> {
    const order = await this.ordersRepository.findOne({
      where: { id: dto.orderId },
    });
    if (!order || order.buyerId !== buyerId) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.ACCEPTED) {
      throw new BadRequestException(
        `Order must be ACCEPTED to initiate payment (current: ${order.status})`,
      );
    }

    const amount = Number(order.totalPrice);
    const commissionRate = Number(order.commissionRate);
    const commissionAmount = Math.round(amount * commissionRate) / 100;
    const sellerAmount = Math.round((amount - commissionAmount) * 100) / 100;

    const { transactionRef } = await this.escrow.holdFunds(
      amount,
      order.currency,
      dto.method,
    );

    const now = new Date();
    const payment = this.paymentsRepository.create({
      orderId: order.id,
      payerId: buyerId,
      amount,
      commissionAmount,
      sellerAmount,
      currency: order.currency,
      method: dto.method,
      escrowStatus: EscrowStatus.HELD,
      transactionRef,
      autoReleaseAt: null,
      paidAt: now,
      releasedAt: null,
      refundedAt: null,
    });

    let saved: Payment;
    try {
      saved = await this.paymentsRepository.save(payment);
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('Payment already exists for this order');
      }
      throw err;
    }

    this.eventEmitter.emit(
      PaymentHeldEvent.EVENT_NAME,
      new PaymentHeldEvent(
        saved.id,
        saved.orderId,
        saved.payerId,
        order.sellerId,
        Number(saved.sellerAmount),
        Number(saved.commissionAmount),
        saved.currency,
      ),
    );

    return saved;
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npx jest payments.service.spec.ts 2>&1 | tail -15`

Expected: PASS, 5 tests.

---

## Task 10: PaymentsController (initiate only) + PaymentsModule wiring

**Files:**
- Create: `backend/src/modules/payments/payments.controller.ts`
- Create: `backend/src/modules/payments/payments.module.ts` (replace empty scaffold)

- [ ] **Step 1: Write controller**

Create `backend/src/modules/payments/payments.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentResponse } from './dto/payment.response';

interface AuthedRequest extends Request {
  user: { id: string; role: string };
}

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  async initiate(
    @Req() req: AuthedRequest,
    @Body() dto: InitiatePaymentDto,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsService.initiate(req.user.id, dto);
    return PaymentResponse.fromPayment(payment);
  }
}
```

- [ ] **Step 2: Write PaymentsModule**

Replace `backend/src/modules/payments/payments.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { Order } from '../orders/order.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { EscrowService } from './escrow.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Order])],
  controllers: [PaymentsController],
  providers: [PaymentsService, EscrowService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
```

- [ ] **Step 3: Verify app boots (TypeScript + DI)**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -30`

Expected: No errors.

- [ ] **Step 4: Run full unit suite to confirm no regression**

Run: `cd backend && npm test 2>&1 | tail -15`

Expected: All existing unit tests + new tests (escrow, payments, payment-status.listener, transitionFromPayment) pass.

---

## Task 11: Add `createAcceptedOrder` test fixture

**Files:**
- Modify: `backend/test/helpers/fixtures.ts`

- [ ] **Step 1: Append new fixture helper**

Append to `backend/test/helpers/fixtures.ts`:

```typescript
export async function createAcceptedOrder(
  app: INestApplication,
  buyer: User,
  seller: User,
  listingOverrides: Partial<Listing> = {},
  orderOverrides: Partial<Order> = {},
): Promise<{ listing: Listing; order: Order }> {
  const listing = await createListing(app, seller, listingOverrides);
  const order = await createOrder(app, buyer, seller, listing, {
    status: OrderStatus.ACCEPTED,
    ...orderOverrides,
  });
  return { listing, order };
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd backend && npx tsc --noEmit -p test/tsconfig.json 2>&1 | head -10` (if tsconfig.json exists under test; otherwise `cd backend && npx tsc --noEmit 2>&1 | head -10`)

Expected: No errors.

---

## Task 12: E2E test — POST /payments/initiate happy path

**Files:**
- Create: `backend/test/payments.e2e-spec.ts`

- [ ] **Step 1: Write the e2e spec (initiate happy path only — further tests added in later tasks)**

Create `backend/test/payments.e2e-spec.ts`:

```typescript
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createTestApp } from './helpers/test-app';
import { truncateAll } from './helpers/truncate';
import { captureEvents, EventCapture } from './helpers/event-capture';
import {
  createAcceptedOrder,
  makeAuthenticatedUser,
} from './helpers/fixtures';
import { Payment } from '../src/modules/payments/payment.entity';
import { Order } from '../src/modules/orders/order.entity';
import { PaymentHeldEvent } from '../src/modules/payments/events/payment-held.event';
import {
  EscrowStatus,
  OrderStatus,
  PaymentMethod,
  UserRole,
} from '../src/shared/enums';

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let events: EventCapture;
  let paymentsRepo: Repository<Payment>;
  let ordersRepo: Repository<Order>;

  beforeAll(async () => {
    app = await createTestApp();
    paymentsRepo = app.get<Repository<Payment>>(getRepositoryToken(Payment));
    ordersRepo = app.get<Repository<Order>>(getRepositoryToken(Order));
    events = captureEvents(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(app);
    events.reset();
  });

  describe('POST /api/v1/payments/initiate', () => {
    it('holds funds, transitions order ACCEPTED → PAID, emits payment.held', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { order } = await createAcceptedOrder(app, buyer, seller);

      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });

      expect(res.status).toBe(201);
      expect(res.body.escrowStatus).toBe(EscrowStatus.HELD);
      expect(res.body.orderId).toBe(order.id);
      expect(res.body.transactionRef).toMatch(/^STUB-/);
      expect(Number(res.body.sellerAmount)).toBeCloseTo(
        Number(order.totalPrice) * 0.95,
        2,
      );

      const savedPayment = await paymentsRepo.findOne({
        where: { id: res.body.id },
      });
      expect(savedPayment?.escrowStatus).toBe(EscrowStatus.HELD);

      const updatedOrder = await ordersRepo.findOne({
        where: { id: order.id },
      });
      expect(updatedOrder?.status).toBe(OrderStatus.PAID);

      expect(
        events.getEmitted(PaymentHeldEvent.EVENT_NAME).length,
      ).toBe(1);
    });
  });
});
```

- [ ] **Step 2: Run the e2e**

Run: `cd backend && npm run test:e2e -- payments 2>&1 | tail -25`

Expected: PASS, 1 test. Note: Docker must be up for this to work.

If a test fails with `secretOrPrivateKey must have a value`, check that `fixtures.ts` passes `{ secret: process.env.JWT_SECRET }` to `jwtService.sign` — that's a known codebase pattern from US06.

---

## COMMIT CHECKPOINT 1 — Foundation + initiate flow

**STOP.** Hand control back to the user.

At this checkpoint you should have:
- Payment entity + enums
- 3 event classes
- EscrowService stub (3 unit tests passing)
- OrdersService.transitionFromPayment (5 new unit tests)
- PaymentStatusListener (4 unit tests)
- PaymentsService.initiate (5 unit tests)
- PaymentsController /initiate endpoint
- PaymentsModule wired up
- `createAcceptedOrder` fixture
- 1 e2e test (initiate happy path) passing

Run full suite: `cd backend && npm test && npm run test:e2e 2>&1 | tail -20`

Tell the user:
> "Foundation + initiate flow complete. Unit: N tests passing. E2E: 1 test passing. Ready for you to review and commit. Covers sub-issues #46, #48, #52, #53, and the initiate half of #47."

Wait for user ack before proceeding.

---

## Task 13: PaymentsService.release + unit tests (TDD)

**Files:**
- Modify: `backend/src/modules/payments/payments.service.spec.ts`
- Modify: `backend/src/modules/payments/payments.service.ts`

- [ ] **Step 1: Add failing tests — append a `describe('release', ...)` block inside the existing `describe('PaymentsService', ...)` in `payments.service.spec.ts`**

```typescript
  describe('release', () => {
    const payerId = 'buyer-1';
    const paymentId = 'pay-1';

    const heldPayment = {
      id: paymentId,
      orderId: 'order-1',
      payerId,
      sellerAmount: 950,
      commissionAmount: 50,
      currency: Currency.SAR,
      escrowStatus: EscrowStatus.HELD,
      transactionRef: 'STUB-xyz',
      releasedAt: null,
    } as Payment;

    const deliveredOrder = {
      id: 'order-1',
      buyerId: payerId,
      sellerId: 'seller-1',
      status: OrderStatus.DELIVERED,
    } as Order;

    it('releases funds, updates payment RELEASED, emits PaymentReleasedEvent', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue(deliveredOrder);
      escrow.releaseFunds.mockResolvedValue({
        transactionRef: 'STUB-xyz',
        status: 'released',
      });
      paymentsRepo.save.mockImplementation(async (p) => p as Payment);

      const result = await service.release(payerId, paymentId);

      expect(result.escrowStatus).toBe(EscrowStatus.RELEASED);
      expect(result.releasedAt).toBeInstanceOf(Date);
      expect(emitter.emit).toHaveBeenCalledWith(
        'payment.released',
        expect.objectContaining({ paymentId, orderId: 'order-1' }),
      );
    });

    it('throws NotFoundException when caller is not the payer', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue(deliveredOrder);
      await expect(
        service.release('other-user', paymentId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when payment is not HELD', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...heldPayment,
        escrowStatus: EscrowStatus.RELEASED,
      });
      ordersRepo.findOne.mockResolvedValue(deliveredOrder);
      await expect(service.release(payerId, paymentId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when order is not DELIVERED', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue({
        ...deliveredOrder,
        status: OrderStatus.PAID,
      });
      await expect(service.release(payerId, paymentId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && npx jest payments.service.spec.ts 2>&1 | tail -15`

Expected: FAIL — `service.release is not a function`.

- [ ] **Step 3: Implement `release` (and private `_doRelease` helper used by both manual release and future cron)**

Add inside `PaymentsService` in `backend/src/modules/payments/payments.service.ts`. Also import `PaymentReleasedEvent`:

```typescript
import { PaymentReleasedEvent } from './events/payment-released.event';
```

Add methods:

```typescript
  async release(userId: string, paymentId: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment || payment.payerId !== userId) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.escrowStatus !== EscrowStatus.HELD) {
      throw new BadRequestException(
        `Payment must be HELD to release (current: ${payment.escrowStatus})`,
      );
    }
    const order = await this.ordersRepository.findOne({
      where: { id: payment.orderId },
    });
    if (!order || order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        `Order must be DELIVERED to release payment (current: ${order?.status ?? 'missing'})`,
      );
    }
    return this._doRelease(payment, order.sellerId);
  }

  private async _doRelease(
    payment: Payment,
    sellerId: string,
  ): Promise<Payment> {
    await this.escrow.releaseFunds(payment.transactionRef);
    payment.escrowStatus = EscrowStatus.RELEASED;
    payment.releasedAt = new Date();
    const saved = await this.paymentsRepository.save(payment);

    this.eventEmitter.emit(
      PaymentReleasedEvent.EVENT_NAME,
      new PaymentReleasedEvent(
        saved.id,
        saved.orderId,
        sellerId,
        Number(saved.sellerAmount),
        saved.currency,
      ),
    );

    return saved;
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npx jest payments.service.spec.ts 2>&1 | tail -15`

Expected: PASS. All release + initiate tests pass.

---

## Task 14: POST /payments/:id/release endpoint

**Files:**
- Modify: `backend/src/modules/payments/payments.controller.ts`

- [ ] **Step 1: Add the release route**

In `backend/src/modules/payments/payments.controller.ts`, add import for `Param` and a new method:

```typescript
import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
```

Add method inside the controller class:

```typescript
  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  async release(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsService.release(req.user.id, id);
    return PaymentResponse.fromPayment(payment);
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors.

---

## Task 15: E2E tests for release (3 tests)

**Files:**
- Modify: `backend/test/payments.e2e-spec.ts`

- [ ] **Step 1: Add a `describe('POST /api/v1/payments/:id/release', ...)` block**

Append inside the outer `describe('Payments (e2e)', ...)` block:

```typescript
  describe('POST /api/v1/payments/:id/release', () => {
    async function setupDeliveredPayment() {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { order } = await createAcceptedOrder(app, buyer, seller);
      const initRes = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });
      expect(initRes.status).toBe(201);

      // Move order through PAID → IN_TRANSIT → DELIVERED via direct repo
      // (exercising PATCH would be valid but slower and out-of-scope here)
      await ordersRepo.update(order.id, { status: OrderStatus.IN_TRANSIT });
      await ordersRepo.update(order.id, { status: OrderStatus.DELIVERED });

      return {
        buyerToken,
        paymentId: initRes.body.id,
        orderId: order.id,
      };
    }

    it('releases payment, transitions order DELIVERED → COMPLETED, emits payment.released', async () => {
      const { buyerToken, paymentId, orderId } = await setupDeliveredPayment();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentId}/release`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.escrowStatus).toBe(EscrowStatus.RELEASED);
      expect(res.body.releasedAt).not.toBeNull();

      const updatedOrder = await ordersRepo.findOne({ where: { id: orderId } });
      expect(updatedOrder?.status).toBe(OrderStatus.COMPLETED);

      expect(events.getEmitted('payment.released').length).toBe(1);
    });

    it('returns 404 when caller is not the payer', async () => {
      const { paymentId } = await setupDeliveredPayment();
      const { token: strangerToken } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentId}/release`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 400 when order is not DELIVERED', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { order } = await createAcceptedOrder(app, buyer, seller);
      const initRes = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });

      // Order is PAID (listener moved it after initiate), not DELIVERED
      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${initRes.body.id}/release`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(400);
    });
  });
```

- [ ] **Step 2: Run e2e tests**

Run: `cd backend && npm run test:e2e -- payments 2>&1 | tail -25`

Expected: PASS, 4 e2e tests (1 initiate + 3 release).

---

## Task 16: RefundPaymentDto

**Files:**
- Create: `backend/src/modules/payments/dto/refund-payment.dto.ts`

- [ ] **Step 1: Write DTO**

Create `backend/src/modules/payments/dto/refund-payment.dto.ts`:

```typescript
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RefundPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors.

---

## Task 17: PaymentsService.refund + unit tests (TDD)

**Files:**
- Modify: `backend/src/modules/payments/payments.service.spec.ts`
- Modify: `backend/src/modules/payments/payments.service.ts`

- [ ] **Step 1: Append `describe('refund', ...)` block to `payments.service.spec.ts`**

```typescript
  describe('refund', () => {
    const paymentId = 'pay-1';

    const heldPayment = {
      id: paymentId,
      orderId: 'order-1',
      payerId: 'buyer-1',
      amount: 1000,
      currency: Currency.SAR,
      escrowStatus: EscrowStatus.HELD,
      transactionRef: 'STUB-xyz',
      refundedAt: null,
    } as Payment;

    const disputedOrder = {
      id: 'order-1',
      buyerId: 'buyer-1',
      status: OrderStatus.DISPUTED,
    } as Order;

    it('refunds, updates payment REFUNDED, emits PaymentRefundedEvent', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue(disputedOrder);
      escrow.refundFunds.mockResolvedValue({
        transactionRef: 'STUB-xyz',
        status: 'refunded',
      });
      paymentsRepo.save.mockImplementation(async (p) => p as Payment);

      const result = await service.refund('admin-1', paymentId);

      expect(result.escrowStatus).toBe(EscrowStatus.REFUNDED);
      expect(result.refundedAt).toBeInstanceOf(Date);
      expect(emitter.emit).toHaveBeenCalledWith(
        'payment.refunded',
        expect.objectContaining({ paymentId, orderId: 'order-1' }),
      );
    });

    it('throws NotFoundException when payment missing', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);
      await expect(service.refund('admin-1', paymentId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when payment not HELD', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...heldPayment,
        escrowStatus: EscrowStatus.RELEASED,
      });
      ordersRepo.findOne.mockResolvedValue(disputedOrder);
      await expect(service.refund('admin-1', paymentId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when order not DISPUTED', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue({
        ...disputedOrder,
        status: OrderStatus.PAID,
      });
      await expect(service.refund('admin-1', paymentId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && npx jest payments.service.spec.ts 2>&1 | tail -15`

Expected: FAIL — `service.refund is not a function`.

- [ ] **Step 3: Implement `refund`**

Import `PaymentRefundedEvent` in `payments.service.ts`:

```typescript
import { PaymentRefundedEvent } from './events/payment-refunded.event';
```

Add method to `PaymentsService`:

```typescript
  async refund(adminId: string, paymentId: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.escrowStatus !== EscrowStatus.HELD) {
      throw new BadRequestException(
        `Payment must be HELD to refund (current: ${payment.escrowStatus})`,
      );
    }
    const order = await this.ordersRepository.findOne({
      where: { id: payment.orderId },
    });
    if (!order || order.status !== OrderStatus.DISPUTED) {
      throw new BadRequestException(
        `Order must be DISPUTED to refund payment (current: ${order?.status ?? 'missing'})`,
      );
    }

    await this.escrow.refundFunds(payment.transactionRef);
    payment.escrowStatus = EscrowStatus.REFUNDED;
    payment.refundedAt = new Date();
    const saved = await this.paymentsRepository.save(payment);

    this.eventEmitter.emit(
      PaymentRefundedEvent.EVENT_NAME,
      new PaymentRefundedEvent(
        saved.id,
        saved.orderId,
        saved.payerId,
        Number(saved.amount),
        saved.currency,
      ),
    );

    this.logger.log(
      `Refunded payment ${saved.id} for order ${saved.orderId} by admin ${adminId}`,
    );

    return saved;
  }
```

(Note: `adminId` is logged for audit, not stored; admin role already verified by RolesGuard at the controller.)

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npx jest payments.service.spec.ts 2>&1 | tail -15`

Expected: PASS.

---

## Task 18: POST /payments/:id/refund endpoint (admin-only)

**Files:**
- Modify: `backend/src/modules/payments/payments.controller.ts`

- [ ] **Step 1: Add refund route with role guard**

Add imports at top of `backend/src/modules/payments/payments.controller.ts` (the `@Roles` decorator and `RolesGuard` already exist in the codebase — see `backend/src/modules/orders/orders.controller.ts` for the pattern):

```typescript
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { UserRole } from '@shared/enums';
import { RefundPaymentDto } from './dto/refund-payment.dto';
```

Add method to the controller class:

```typescript
  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async refund(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: RefundPaymentDto,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsService.refund(req.user.id, id);
    return PaymentResponse.fromPayment(payment);
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors.

---

## Task 19: E2E tests for refund (2 tests)

**Files:**
- Modify: `backend/test/payments.e2e-spec.ts`

- [ ] **Step 1: Add `describe('POST /api/v1/payments/:id/refund', ...)` block**

Append inside the outer describe:

```typescript
  describe('POST /api/v1/payments/:id/refund', () => {
    async function setupDisputedPayment() {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { order } = await createAcceptedOrder(app, buyer, seller);
      const initRes = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });
      await ordersRepo.update(order.id, { status: OrderStatus.DISPUTED });

      return { paymentId: initRes.body.id, orderId: order.id, buyerToken };
    }

    it('admin refunds disputed payment, order → CANCELLED, emits payment.refunded', async () => {
      const { paymentId, orderId } = await setupDisputedPayment();
      const { token: adminToken } = await makeAuthenticatedUser(app, {
        role: UserRole.ADMIN,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'fraud reported' });

      expect(res.status).toBe(200);
      expect(res.body.escrowStatus).toBe(EscrowStatus.REFUNDED);

      const updatedOrder = await ordersRepo.findOne({ where: { id: orderId } });
      expect(updatedOrder?.status).toBe(OrderStatus.CANCELLED);

      expect(events.getEmitted('payment.refunded').length).toBe(1);
    });

    it('non-admin gets 403', async () => {
      const { paymentId, buyerToken } = await setupDisputedPayment();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentId}/refund`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({});
      expect(res.status).toBe(403);
    });
  });
```

- [ ] **Step 2: Run e2e**

Run: `cd backend && npm run test:e2e -- payments 2>&1 | tail -25`

Expected: PASS, 6 e2e tests.

---

## COMMIT CHECKPOINT 2 — Release + refund flows

**STOP.** Hand control back to the user.

At this checkpoint:
- PaymentsService.release + refund implemented
- Both endpoints live with correct authorization
- 6 e2e tests passing (initiate 1, release 3, refund 2)

Run full suite: `cd backend && npm test && npm run test:e2e 2>&1 | tail -25`

Tell the user:
> "Release + refund complete. Covers sub-issues #49 and #50. Ready for review and commit."

Wait for user ack.

---

## Task 20: Install @nestjs/schedule and register ScheduleModule

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Install dep**

Run: `cd backend && npm install @nestjs/schedule@^4.0.0 2>&1 | tail -5`

Expected: `added N packages` with no errors.

- [ ] **Step 2: Register ScheduleModule**

Modify `backend/src/app.module.ts` — add import and list in imports:

```typescript
import { ScheduleModule } from '@nestjs/schedule';
```

Add to the `imports:` array (near `EventEmitterModule.forRoot()`):

```typescript
    ScheduleModule.forRoot(),
```

- [ ] **Step 3: Verify app boots**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors.

---

## Task 21: OrderDeliveredListener (payments side) sets autoReleaseAt

**Files:**
- Create: `backend/src/modules/payments/order-delivered.listener.ts`
- Modify: `backend/src/modules/payments/payments.module.ts`

We intentionally skip a dedicated unit test file here: the listener body is 3 lines of repo-level code, and it is covered by the auto-release e2e test in Task 24. A unit test would repeat the e2e's assertions against mocks without catching additional bugs.

- [ ] **Step 1: Create the listener**

Create `backend/src/modules/payments/order-delivered.listener.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './payment.entity';
import { OrderDeliveredEvent } from '../orders/events/order-delivered.event';
import { EscrowStatus } from '@shared/enums';

const AUTO_RELEASE_DAYS = 7;

@Injectable()
export class OrderDeliveredListener {
  private readonly logger = new Logger(OrderDeliveredListener.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
  ) {}

  @OnEvent(OrderDeliveredEvent.EVENT_NAME)
  async onOrderDelivered(event: OrderDeliveredEvent): Promise<void> {
    try {
      const payment = await this.paymentsRepository.findOne({
        where: { orderId: event.orderId, escrowStatus: EscrowStatus.HELD },
      });
      if (!payment) {
        this.logger.warn(
          `order.delivered for ${event.orderId} but no HELD payment found`,
        );
        return;
      }
      const autoReleaseAt = new Date();
      autoReleaseAt.setDate(autoReleaseAt.getDate() + AUTO_RELEASE_DAYS);
      payment.autoReleaseAt = autoReleaseAt;
      await this.paymentsRepository.save(payment);
    } catch (err) {
      this.logger.error(
        `Failed to set autoReleaseAt for order ${event.orderId}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }
}
```

- [ ] **Step 2: Register in PaymentsModule**

Modify `backend/src/modules/payments/payments.module.ts` — add the listener as a provider:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { Order } from '../orders/order.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { EscrowService } from './escrow.service';
import { OrderDeliveredListener } from './order-delivered.listener';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Order])],
  controllers: [PaymentsController],
  providers: [PaymentsService, EscrowService, OrderDeliveredListener],
  exports: [PaymentsService],
})
export class PaymentsModule {}
```

- [ ] **Step 3: Verify TypeScript**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors.

---

## Task 22: PaymentsService.processAutoReleases + unit test (TDD)

**Files:**
- Modify: `backend/src/modules/payments/payments.service.spec.ts`
- Modify: `backend/src/modules/payments/payments.service.ts`

- [ ] **Step 1: Append failing test to `payments.service.spec.ts`**

```typescript
  describe('processAutoReleases', () => {
    it('releases eligible HELD payments joined to DELIVERED orders', async () => {
      const pastDate = new Date(Date.now() - 86400 * 1000);
      const eligible = {
        id: 'pay-1',
        orderId: 'order-1',
        payerId: 'buyer-1',
        sellerAmount: 950,
        currency: Currency.SAR,
        escrowStatus: EscrowStatus.HELD,
        transactionRef: 'STUB-1',
        autoReleaseAt: pastDate,
      } as Payment;

      // QueryBuilder mock: returns eligible payment joined with seller ID
      const qb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ payment_id: 'pay-1', order_seller_id: 'seller-1' }]),
      };
      paymentsRepo.createQueryBuilder.mockReturnValue(qb);
      paymentsRepo.findOne.mockResolvedValue({ ...eligible });
      escrow.releaseFunds.mockResolvedValue({
        transactionRef: 'STUB-1',
        status: 'released',
      });
      paymentsRepo.save.mockImplementation(async (p) => p as Payment);

      const count = await service.processAutoReleases();

      expect(count).toBe(1);
      expect(escrow.releaseFunds).toHaveBeenCalledWith('STUB-1');
      expect(emitter.emit).toHaveBeenCalledWith(
        'payment.released',
        expect.objectContaining({ paymentId: 'pay-1' }),
      );
    });
  });
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && npx jest payments.service.spec.ts 2>&1 | tail -15`

Expected: FAIL — `service.processAutoReleases is not a function`.

- [ ] **Step 3: Implement method with @Cron**

Add imports to `backend/src/modules/payments/payments.service.ts`:

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderStatus } from '@shared/enums';
```

Add method to PaymentsService:

```typescript
  @Cron(CronExpression.EVERY_15_MINUTES)
  async processAutoReleases(): Promise<number> {
    const rows = await this.paymentsRepository
      .createQueryBuilder('payment')
      .innerJoin(
        'orders',
        'order',
        'order.id = payment.order_id',
      )
      .where('payment.escrow_status = :held', { held: EscrowStatus.HELD })
      .andWhere('payment.auto_release_at IS NOT NULL')
      .andWhere('payment.auto_release_at <= NOW()')
      .andWhere('order.status = :delivered', { delivered: OrderStatus.DELIVERED })
      .select('payment.id', 'payment_id')
      .addSelect('order.seller_id', 'order_seller_id')
      .getRawMany<{ payment_id: string; order_seller_id: string }>();

    let released = 0;
    for (const row of rows) {
      try {
        const payment = await this.paymentsRepository.findOne({
          where: { id: row.payment_id },
        });
        if (!payment || payment.escrowStatus !== EscrowStatus.HELD) continue;
        await this._doRelease(payment, row.order_seller_id);
        released += 1;
      } catch (err) {
        this.logger.error(
          `Auto-release failed for payment ${row.payment_id}`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }

    if (released > 0) {
      this.logger.log(`Auto-released ${released} payment(s)`);
    }
    return released;
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && npx jest payments.service.spec.ts 2>&1 | tail -15`

Expected: PASS.

---

## Task 23: E2E test — auto-release flow

**Files:**
- Modify: `backend/test/payments.e2e-spec.ts`

- [ ] **Step 1: Add auto-release test block**

Append inside the outer describe (need `PaymentsService` + `EscrowStatus` already in scope from imports — check imports at file top and add `PaymentsService`):

Add to imports at top of spec file:
```typescript
import { PaymentsService } from '../src/modules/payments/payments.service';
```

Append describe block:

```typescript
  describe('auto-release cron', () => {
    it('releases HELD payment past autoReleaseAt on DELIVERED order', async () => {
      const paymentsService = app.get(PaymentsService);
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { order } = await createAcceptedOrder(app, buyer, seller);
      const initRes = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });

      // Force order to DELIVERED and backdate autoReleaseAt to 1 minute ago
      await ordersRepo.update(order.id, { status: OrderStatus.DELIVERED });
      await paymentsRepo.update(initRes.body.id, {
        autoReleaseAt: new Date(Date.now() - 60 * 1000),
      });

      const count = await paymentsService.processAutoReleases();

      expect(count).toBe(1);
      const updatedPayment = await paymentsRepo.findOne({
        where: { id: initRes.body.id },
      });
      expect(updatedPayment?.escrowStatus).toBe(EscrowStatus.RELEASED);
      const updatedOrder = await ordersRepo.findOne({
        where: { id: order.id },
      });
      expect(updatedOrder?.status).toBe(OrderStatus.COMPLETED);
    });

    it('skips payments whose order is DISPUTED (not DELIVERED)', async () => {
      const paymentsService = app.get(PaymentsService);
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { order } = await createAcceptedOrder(app, buyer, seller);
      const initRes = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });

      await ordersRepo.update(order.id, { status: OrderStatus.DISPUTED });
      await paymentsRepo.update(initRes.body.id, {
        autoReleaseAt: new Date(Date.now() - 60 * 1000),
      });

      const count = await paymentsService.processAutoReleases();
      expect(count).toBe(0);
      const payment = await paymentsRepo.findOne({
        where: { id: initRes.body.id },
      });
      expect(payment?.escrowStatus).toBe(EscrowStatus.HELD);
    });
  });
```

- [ ] **Step 2: Run e2e**

Run: `cd backend && npm run test:e2e -- payments 2>&1 | tail -25`

Expected: PASS, 8 e2e tests.

---

## Task 24: E2E test — order.delivered populates autoReleaseAt

**Files:**
- Modify: `backend/test/payments.e2e-spec.ts`

- [ ] **Step 1: Add test block for the delivered listener**

Append inside the outer describe:

```typescript
  describe('order.delivered → autoReleaseAt', () => {
    it('sets autoReleaseAt ~7 days out when order transitions to DELIVERED', async () => {
      const { user: seller, token: sellerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.SELLER },
      );
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { order } = await createAcceptedOrder(app, buyer, seller);
      const initRes = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });

      // Seller ships (PAID → IN_TRANSIT)
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ status: OrderStatus.IN_TRANSIT })
        .expect(200);

      // Buyer confirms delivery — fires order.delivered → listener sets autoReleaseAt
      await request(app.getHttpServer())
        .patch(`/api/v1/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ status: OrderStatus.DELIVERED })
        .expect(200);

      // Allow event-emitter microtask to settle
      await new Promise((r) => setImmediate(r));

      const payment = await paymentsRepo.findOne({
        where: { id: initRes.body.id },
      });
      expect(payment?.autoReleaseAt).not.toBeNull();
      const expected = Date.now() + 7 * 86400 * 1000;
      expect(
        Math.abs((payment!.autoReleaseAt as Date).getTime() - expected),
      ).toBeLessThan(60 * 1000); // within 1 minute tolerance
    });
  });
```

Note: `patch` to DELIVERED in orders requires the caller to be the buyer. Fixture `createAcceptedOrder` produces buyer/seller relationship; we confirm delivery as buyer.

- [ ] **Step 2: Run e2e**

Run: `cd backend && npm run test:e2e -- payments 2>&1 | tail -25`

Expected: PASS, 9 e2e tests.

---

## Task 25: GET /payments/:id and GET /payments?orderId= (service + controller + e2e)

**Files:**
- Modify: `backend/src/modules/payments/payments.service.ts`
- Modify: `backend/src/modules/payments/payments.controller.ts`
- Modify: `backend/test/payments.e2e-spec.ts`

No dedicated unit tests for these read methods — authorization branches are straightforward mirrors of patterns already tested in initiate/release, and the e2e test exercises all branches directly. Pure read methods with no state change carry minimal unit-test ROI.

- [ ] **Step 1: Add service methods**

Add imports to `payments.service.ts` (if not already):

```typescript
import { UserRole } from '@shared/enums';
```

Add methods:

```typescript
  async findOne(userId: string, userRole: string, paymentId: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    const order = await this.ordersRepository.findOne({
      where: { id: payment.orderId },
    });
    const isPayer = payment.payerId === userId;
    const isSeller = order?.sellerId === userId;
    const isAdmin = userRole === UserRole.ADMIN;
    if (!isPayer && !isSeller && !isAdmin) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async findByOrder(userId: string, orderId: string): Promise<Payment> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    const isParty =
      order.buyerId === userId ||
      order.sellerId === userId ||
      order.brokerId === userId;
    if (!isParty) {
      throw new NotFoundException('Order not found');
    }
    const payment = await this.paymentsRepository.findOne({
      where: { orderId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found for this order');
    }
    return payment;
  }
```

- [ ] **Step 2: Add controller routes**

Add imports to `payments.controller.ts`:

```typescript
import { Get, Query } from '@nestjs/common';
```

Add methods:

```typescript
  @Get(':id')
  async findOne(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsService.findOne(
      req.user.id,
      req.user.role,
      id,
    );
    return PaymentResponse.fromPayment(payment);
  }

  @Get()
  async findByOrder(
    @Req() req: AuthedRequest,
    @Query('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsService.findByOrder(
      req.user.id,
      orderId,
    );
    return PaymentResponse.fromPayment(payment);
  }
```

- [ ] **Step 3: Add e2e test block**

Append inside the outer describe in `payments.e2e-spec.ts`:

```typescript
  describe('GET /api/v1/payments/:id and GET /api/v1/payments?orderId=', () => {
    it('payer and admin see, stranger gets 404; missing payment 404', async () => {
      const { user: seller } = await makeAuthenticatedUser(app, {
        role: UserRole.SELLER,
      });
      const { user: buyer, token: buyerToken } = await makeAuthenticatedUser(
        app,
        { role: UserRole.BUYER },
      );
      const { token: adminToken } = await makeAuthenticatedUser(app, {
        role: UserRole.ADMIN,
      });
      const { token: strangerToken } = await makeAuthenticatedUser(app, {
        role: UserRole.BUYER,
      });

      const { order } = await createAcceptedOrder(app, buyer, seller);
      const initRes = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ orderId: order.id, method: PaymentMethod.MADA });

      const paymentId = initRes.body.id;

      await request(app.getHttpServer())
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/api/v1/payments?orderId=${order.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/payments?orderId=${order.id}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(404);

      // Missing payment lookup (use a different accepted order with no payment)
      const { order: unpaid } = await createAcceptedOrder(app, buyer, seller);
      await request(app.getHttpServer())
        .get(`/api/v1/payments?orderId=${unpaid.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(404);
    });
  });
```

- [ ] **Step 4: Run e2e**

Run: `cd backend && npm run test:e2e -- payments 2>&1 | tail -25`

Expected: PASS, 10 e2e tests.

---

## Task 26: Full smoke run + update project memory

**Files:**
- Modify: `/home/mohammadibrahim/.claude/projects/-home-mohammadibrahim/memory/project_mashia.md`

- [ ] **Step 1: Run full unit suite**

Run: `cd backend && npm test 2>&1 | tail -15`

Expected: All unit tests pass. Target: ~180 base + ~20 new = ~200 tests.

- [ ] **Step 2: Run full e2e suite**

Run: `cd backend && npm run test:e2e 2>&1 | tail -15`

Expected: Orders e2e (16) + Payments e2e (10) = 26 tests pass.

- [ ] **Step 3: Append to `project_mashia.md`**

Read the current memory file and add a note to the US07 line marking it complete. Format per existing file conventions.

---

## COMMIT CHECKPOINT 3 — Auto-release + GET endpoints + US07 complete

**STOP.** Hand control back to the user.

At this checkpoint:
- `@nestjs/schedule` installed, `ScheduleModule.forRoot()` registered
- OrderDeliveredListener sets `autoReleaseAt` on DELIVERED
- `processAutoReleases()` cron running every 15 min
- GET endpoints live
- Full suite: ~200 unit tests + 26 e2e tests passing
- Memory updated

Tell the user:
> "US07 complete. Covers sub-issues #51, #54, and finishes the full feature. All 9 sub-issues implemented. Ready for final commit and issue closure."

Wait for user ack.
