# PATCH /orders/:id/status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PATCH /api/v1/orders/:id/status endpoint with role-aware transition validation covering 5 API-driven transitions.

**Architecture:** Extend existing `OrdersService` with `updateStatus` method using a switch statement on current status; per-case logic checks whether the calling user is buyer or seller and whether the target status is valid. Add PATCH route to existing `OrdersController` guarded by `JwtAuthGuard` only (transition-specific authorization lives in the service).

**Tech Stack:** NestJS, TypeORM, class-validator, Jest

**Spec:** `docs/superpowers/specs/2026-04-14-patch-order-status-design.md`

**Note on git:** The user commits manually — do NOT run `git add`, `git commit`, or `git push` in any step.

---

### Task 1: Create UpdateOrderStatusDto

**Files:**
- Create: `backend/src/modules/orders/dto/update-order-status.dto.ts`

- [ ] **Step 1: Write the DTO**

Write to `backend/src/modules/orders/dto/update-order-status.dto.ts`:

```typescript
import { IsEnum } from 'class-validator';
import { OrderStatus } from '@shared/enums';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

---

### Task 2: Extend OrdersService tests with updateStatus cases

**Files:**
- Modify: `backend/src/modules/orders/orders.service.spec.ts`

- [ ] **Step 1: Update mockOrderRepo to include findOne**

In `backend/src/modules/orders/orders.service.spec.ts`, find the `beforeEach` block (around line 45-65). The current `mockOrderRepo` looks like:

```typescript
    const mockOrderRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
```

Replace with:

```typescript
    const mockOrderRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };
```

- [ ] **Step 2: Append updateStatus test block to the file**

Append the following at the end of the file, INSIDE the outer `describe('OrdersService', ...)` block (i.e., before its closing `});`). This means placing it after the existing `describe('create', ...)` block:

```typescript

  describe('updateStatus', () => {
    const orderId = '44444444-4444-4444-4444-444444444444';
    const otherUserId = '99999999-9999-9999-9999-999999999999';

    const baseOrder: Partial<Order> = {
      id: orderId,
      buyerId,
      sellerId,
      status: OrderStatus.PENDING,
    };

    function mockOrderWithStatus(status: OrderStatus): Partial<Order> {
      return { ...baseOrder, status };
    }

    beforeEach(() => {
      orderRepo.save.mockImplementation(async (o) => o as Order);
    });

    it('allows seller to transition PENDING → ACCEPTED', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.PENDING) as Order,
      );

      const result = await service.updateStatus(
        orderId,
        sellerId,
        OrderStatus.ACCEPTED,
      );

      expect(result.status).toBe(OrderStatus.ACCEPTED);
      expect(orderRepo.save).toHaveBeenCalled();
    });

    it('allows buyer to transition PENDING → CANCELLED', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.PENDING) as Order,
      );

      const result = await service.updateStatus(
        orderId,
        buyerId,
        OrderStatus.CANCELLED,
      );

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('allows seller to transition PENDING → CANCELLED', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.PENDING) as Order,
      );

      const result = await service.updateStatus(
        orderId,
        sellerId,
        OrderStatus.CANCELLED,
      );

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('rejects buyer trying PENDING → ACCEPTED (seller-only)', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.PENDING) as Order,
      );

      await expect(
        service.updateStatus(orderId, buyerId, OrderStatus.ACCEPTED),
      ).rejects.toThrow(BadRequestException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('allows seller to transition PAID → IN_TRANSIT', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.PAID) as Order,
      );

      const result = await service.updateStatus(
        orderId,
        sellerId,
        OrderStatus.IN_TRANSIT,
      );

      expect(result.status).toBe(OrderStatus.IN_TRANSIT);
    });

    it('rejects buyer trying PAID → IN_TRANSIT (seller-only)', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.PAID) as Order,
      );

      await expect(
        service.updateStatus(orderId, buyerId, OrderStatus.IN_TRANSIT),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows buyer to transition IN_TRANSIT → DELIVERED', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.IN_TRANSIT) as Order,
      );

      const result = await service.updateStatus(
        orderId,
        buyerId,
        OrderStatus.DELIVERED,
      );

      expect(result.status).toBe(OrderStatus.DELIVERED);
    });

    it('rejects seller trying IN_TRANSIT → DELIVERED (buyer-only)', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.IN_TRANSIT) as Order,
      );

      await expect(
        service.updateStatus(orderId, sellerId, OrderStatus.DELIVERED),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows buyer to transition PAID → DISPUTED', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.PAID) as Order,
      );

      const result = await service.updateStatus(
        orderId,
        buyerId,
        OrderStatus.DISPUTED,
      );

      expect(result.status).toBe(OrderStatus.DISPUTED);
    });

    it('allows seller to transition DELIVERED → DISPUTED', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.DELIVERED) as Order,
      );

      const result = await service.updateStatus(
        orderId,
        sellerId,
        OrderStatus.DISPUTED,
      );

      expect(result.status).toBe(OrderStatus.DISPUTED);
    });

    it('rejects DISPUTED from PENDING (pre-payment, not disputable)', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.PENDING) as Order,
      );

      await expect(
        service.updateStatus(orderId, buyerId, OrderStatus.DISPUTED),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects PENDING → PAID (not a defined transition)', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.PENDING) as Order,
      );

      await expect(
        service.updateStatus(orderId, buyerId, OrderStatus.PAID),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when order does not exist', async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus(orderId, buyerId, OrderStatus.CANCELLED),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not buyer or seller', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.PENDING) as Order,
      );

      await expect(
        service.updateStatus(orderId, otherUserId, OrderStatus.CANCELLED),
      ).rejects.toThrow(ForbiddenException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('rejects any transition from terminal state COMPLETED', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.COMPLETED) as Order,
      );

      await expect(
        service.updateStatus(orderId, buyerId, OrderStatus.DISPUTED),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects any transition from terminal state CANCELLED', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.CANCELLED) as Order,
      );

      await expect(
        service.updateStatus(orderId, buyerId, OrderStatus.ACCEPTED),
      ).rejects.toThrow(BadRequestException);
    });
  });
```

- [ ] **Step 3: Run tests to verify the new cases fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/orders/orders.service.spec.ts 2>&1 | tail -15`
Expected: FAIL — TypeScript error or runtime error like "service.updateStatus is not a function".

---

### Task 3: Implement OrdersService.updateStatus

**Files:**
- Modify: `backend/src/modules/orders/orders.service.ts`

- [ ] **Step 1: Add updateStatus method**

Add the following method INSIDE the `OrdersService` class in `backend/src/modules/orders/orders.service.ts`, after the existing `create` method (before the class closing `}`):

```typescript

  async updateStatus(
    orderId: string,
    userId: string,
    newStatus: OrderStatus,
  ): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const isBuyer = order.buyerId === userId;
    const isSeller = order.sellerId === userId;
    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('Not a party to this order');
    }

    switch (order.status) {
      case OrderStatus.PENDING:
        if (newStatus === OrderStatus.ACCEPTED && isSeller) break;
        if (newStatus === OrderStatus.CANCELLED) break;
        throw new BadRequestException(
          `Invalid transition from PENDING to ${newStatus}`,
        );

      case OrderStatus.PAID:
        if (newStatus === OrderStatus.IN_TRANSIT && isSeller) break;
        if (newStatus === OrderStatus.DISPUTED) break;
        throw new BadRequestException(
          `Invalid transition from PAID to ${newStatus}`,
        );

      case OrderStatus.IN_TRANSIT:
        if (newStatus === OrderStatus.DELIVERED && isBuyer) break;
        if (newStatus === OrderStatus.DISPUTED) break;
        throw new BadRequestException(
          `Invalid transition from IN_TRANSIT to ${newStatus}`,
        );

      case OrderStatus.DELIVERED:
        if (newStatus === OrderStatus.DISPUTED) break;
        throw new BadRequestException(
          `Invalid transition from DELIVERED to ${newStatus}`,
        );

      case OrderStatus.ACCEPTED:
      case OrderStatus.COMPLETED:
      case OrderStatus.CANCELLED:
      case OrderStatus.DISPUTED:
      default:
        throw new BadRequestException(
          `Cannot transition from ${order.status} via this endpoint`,
        );
    }

    order.status = newStatus;
    return this.ordersRepository.save(order);
  }
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/orders/orders.service.spec.ts 2>&1 | tail -10`
Expected: PASS — 24 tests passing (8 existing `create` + 16 new `updateStatus`).

---

### Task 4: Extend OrdersController tests with PATCH cases

**Files:**
- Modify: `backend/src/modules/orders/orders.controller.spec.ts`

- [ ] **Step 1: Add imports for new types**

At the top of `backend/src/modules/orders/orders.controller.spec.ts`, find the import line for `@nestjs/common`:

```typescript
import { NotFoundException } from '@nestjs/common';
```

Replace it with:

```typescript
import { BadRequestException, NotFoundException } from '@nestjs/common';
```

Also find the CreateOrderDto import line:

```typescript
import { CreateOrderDto } from './dto/create-order.dto';
```

Add directly below it:

```typescript
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
```

- [ ] **Step 2: Add updateStatus to mock service**

Find the `beforeEach` block's `mockService`:

```typescript
    const mockService = {
      create: jest.fn(),
    };
```

Replace with:

```typescript
    const mockService = {
      create: jest.fn(),
      updateStatus: jest.fn(),
    };
```

- [ ] **Step 3: Append updateStatus test block**

Append the following at the end of the file, INSIDE the outer `describe('OrdersController', ...)` block (before its closing `});`), after the existing `describe('create', ...)` block:

```typescript

  describe('updateStatus', () => {
    const orderId = '44444444-4444-4444-4444-444444444444';
    const dto: UpdateOrderStatusDto = { status: OrderStatus.ACCEPTED };

    const updatedOrder: Partial<Order> = {
      id: orderId,
      status: OrderStatus.ACCEPTED,
    };

    it('calls service.updateStatus with orderId, user.id, dto.status', async () => {
      service.updateStatus.mockResolvedValue(updatedOrder as Order);

      const result = await controller.updateStatus(orderId, buyer, dto);

      expect(service.updateStatus).toHaveBeenCalledWith(
        orderId,
        buyer.id,
        OrderStatus.ACCEPTED,
      );
      expect(result).toEqual(updatedOrder);
    });

    it('propagates BadRequestException from service', async () => {
      service.updateStatus.mockRejectedValue(
        new BadRequestException('Invalid transition'),
      );

      await expect(
        controller.updateStatus(orderId, buyer, dto),
      ).rejects.toThrow(BadRequestException);
    });
  });
```

- [ ] **Step 4: Run tests to verify the new cases fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/orders/orders.controller.spec.ts 2>&1 | tail -15`
Expected: FAIL — "controller.updateStatus is not a function" or TypeScript compile error.

---

### Task 5: Add PATCH route to OrdersController

**Files:**
- Modify: `backend/src/modules/orders/orders.controller.ts`

- [ ] **Step 1: Update imports**

In `backend/src/modules/orders/orders.controller.ts`, replace the imports block (lines 1-11) with:

```typescript
import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { KycVerifiedGuard } from '@shared/guards/kyc-verified.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { UserRole } from '@shared/enums';
import { User } from '../users/user.entity';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
```

- [ ] **Step 2: Add the PATCH method to the controller class**

Inside the `OrdersController` class in `backend/src/modules/orders/orders.controller.ts`, after the existing `create` method (before the class closing `}`), add:

```typescript

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<Order> {
    return this.ordersService.updateStatus(id, user.id, dto.status);
  }
```

- [ ] **Step 3: Run controller tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/orders/orders.controller.spec.ts 2>&1 | tail -10`
Expected: PASS — 4 tests passing (2 existing `create` + 2 new `updateStatus`).

---

### Task 6: Full regression check

- [ ] **Step 1: Run complete test suite**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --silent 2>&1 | tail -8`
Expected: `Tests: 142 passed` (124 existing + 16 new service tests + 2 new controller tests = 142).

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.
