# US06-01: Order Entity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OrderStatus enum and Order entity so TypeORM can create the `orders` table.

**Architecture:** Append enum to shared enums file, create entity following the Listing entity pattern (ManyToOne relations, decimal columns, snake_case DB names), register in OrdersModule.

**Tech Stack:** TypeORM, PostgreSQL, NestJS

**Spec:** `docs/superpowers/specs/2026-04-13-order-entity-design.md`

---

### Task 1: Add OrderStatus enum

**Files:**
- Modify: `backend/src/shared/enums/index.ts:47` (append after HealthStatus)

- [ ] **Step 1: Append OrderStatus enum**

Add this block at the end of `backend/src/shared/enums/index.ts`, after the closing `}` of `HealthStatus` on line 46:

```typescript

export enum OrderStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  PAID = 'paid',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to enums.

---

### Task 2: Create Order entity

**Files:**
- Create: `backend/src/modules/orders/order.entity.ts`

- [ ] **Step 1: Write the Order entity**

Write the full entity to `backend/src/modules/orders/order.entity.ts`:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';
import { Currency, OrderStatus } from '@shared/enums';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Listing, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'listing_id' })
  listing: Listing | null;

  @Column({ type: 'uuid', nullable: true, name: 'listing_id' })
  listingId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  @Column({ name: 'buyer_id' })
  buyerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @Column({ name: 'seller_id' })
  sellerId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'broker_id' })
  broker: User | null;

  @Column({ type: 'uuid', nullable: true, name: 'broker_id' })
  brokerId: string | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'unit_price' })
  unitPrice: number;

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'total_price' })
  totalPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5.0, name: 'commission_rate' })
  commissionRate: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'commission_amount' })
  commissionAmount: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({ name: 'delivery_country' })
  deliveryCountry: string;

  @Column({ name: 'delivery_city' })
  deliveryCity: string;

  @Column({ type: 'text', name: 'delivery_address' })
  deliveryAddress: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to Order entity.

---

### Task 3: Register Order entity in OrdersModule

**Files:**
- Modify: `backend/src/modules/orders/orders.module.ts`

- [ ] **Step 1: Update OrdersModule to register the entity**

Replace the entire content of `backend/src/modules/orders/orders.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  exports: [TypeOrmModule],
})
export class OrdersModule {}
```

Note: No controllers or providers yet — those come in issues #38–#44. `exports: [TypeOrmModule]` makes the Order repository available to other modules that import OrdersModule (e.g., PaymentsModule will need it).

- [ ] **Step 2: Verify full compilation**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --silent 2>&1 | tail -5`
Expected: `Tests: 114 passed, 114 total` — no regressions.
