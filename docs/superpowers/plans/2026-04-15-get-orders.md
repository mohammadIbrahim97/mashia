# GET /orders + GET /orders/:id Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /api/v1/orders` (list my orders, paginated + filterable) and `GET /api/v1/orders/:id` (single order detail) with role-aware response DTOs. Also apply a piggy-backed privacy fix: `updateStatus` returns `NotFoundException` for non-parties instead of `ForbiddenException`, to match the new `findOne` behavior and prevent order UUID enumeration.

**Architecture:** Extend `OrdersService` with `findMyOrders(userId, query)` using a TypeORM QueryBuilder with `(buyerId = :uid OR sellerId = :uid OR brokerId = :uid)` plus optional status filter and pagination, and `findOne(orderId, userId)` that loads relations and returns 404 for both missing and non-party access. Two new response DTOs (`OrderListItemResponse`, `OrderDetailResponse`) trim sensitive fields and compute a `myRole` field per item. Add two new routes to `OrdersController` guarded by `JwtAuthGuard`.

**Tech Stack:** NestJS, TypeORM (QueryBuilder), class-validator, class-transformer, Jest.

**Spec:** `docs/superpowers/specs/2026-04-15-get-orders-design.md`

**Note on git:** The user commits manually — do NOT run `git add`, `git commit`, or `git push` in any step.

---

### Task 1: Create ListOrdersQueryDto

**Files:**
- Create: `backend/src/modules/orders/dto/list-orders-query.dto.ts`

- [ ] **Step 1: Write the DTO**

Write to `backend/src/modules/orders/dto/list-orders-query.dto.ts`:

```typescript
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OrderStatus } from '@shared/enums';

export class ListOrdersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsArray()
  @IsEnum(OrderStatus, { each: true })
  status?: OrderStatus[];
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

---

### Task 2: Create OrderListItemResponse

**Files:**
- Create: `backend/src/modules/orders/dto/order-list-item.response.ts`

- [ ] **Step 1: Write the response DTO with mapper**

Write to `backend/src/modules/orders/dto/order-list-item.response.ts`:

```typescript
import { Order } from '../order.entity';
import { Currency, OrderStatus } from '@shared/enums';

export type OrderRole = 'buyer' | 'seller' | 'broker';

export class OrderListItemResponse {
  id: string;
  status: OrderStatus;
  quantity: number;
  unitPrice: number;
  currency: Currency;
  totalPrice: number;
  createdAt: Date;
  myRole: OrderRole;
  listing: { id: string; title: string; primaryImage: string | null } | null;
  counterparty: { id: string; fullName: string };

  static fromOrder(order: Order, userId: string): OrderListItemResponse {
    const myRole: OrderRole =
      order.buyerId === userId
        ? 'buyer'
        : order.sellerId === userId
          ? 'seller'
          : 'broker';

    const counterpartyUser =
      myRole === 'buyer' ? order.seller : order.buyer;

    const primaryImage =
      order.listing?.images && order.listing.images.length > 0
        ? order.listing.images[0]
        : null;

    return {
      id: order.id,
      status: order.status,
      quantity: order.quantity,
      unitPrice: Number(order.unitPrice),
      currency: order.currency,
      totalPrice: Number(order.totalPrice),
      createdAt: order.createdAt,
      myRole,
      listing: order.listing
        ? {
            id: order.listing.id,
            title: order.listing.title,
            primaryImage,
          }
        : null,
      counterparty: {
        id: counterpartyUser.id,
        fullName: counterpartyUser.fullName,
      },
    };
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

---

### Task 3: Create OrderDetailResponse

**Files:**
- Create: `backend/src/modules/orders/dto/order-detail.response.ts`

- [ ] **Step 1: Write the detail response DTO with mapper**

Write to `backend/src/modules/orders/dto/order-detail.response.ts`:

```typescript
import { Order } from '../order.entity';
import { Breed, Currency, OrderStatus } from '@shared/enums';
import { OrderRole } from './order-list-item.response';

export class OrderDetailResponse {
  id: string;
  status: OrderStatus;
  quantity: number;
  unitPrice: number;
  currency: Currency;
  totalPrice: number;
  commissionRate: number;
  commissionAmount: number;
  deliveryCountry: string;
  deliveryCity: string;
  deliveryAddress: string;
  createdAt: Date;
  updatedAt: Date;
  myRole: OrderRole;

  listing:
    | {
        id: string;
        title: string;
        images: string[];
        pricePerHead: number;
        breed: Breed;
      }
    | null;

  buyer: { id: string; fullName: string; phone: string };
  seller: { id: string; fullName: string; phone: string };
  broker: { id: string; fullName: string } | null;

  static fromOrder(order: Order, userId: string): OrderDetailResponse {
    const myRole: OrderRole =
      order.buyerId === userId
        ? 'buyer'
        : order.sellerId === userId
          ? 'seller'
          : 'broker';

    return {
      id: order.id,
      status: order.status,
      quantity: order.quantity,
      unitPrice: Number(order.unitPrice),
      currency: order.currency,
      totalPrice: Number(order.totalPrice),
      commissionRate: Number(order.commissionRate),
      commissionAmount: Number(order.commissionAmount),
      deliveryCountry: order.deliveryCountry,
      deliveryCity: order.deliveryCity,
      deliveryAddress: order.deliveryAddress,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      myRole,
      listing: order.listing
        ? {
            id: order.listing.id,
            title: order.listing.title,
            images: order.listing.images ?? [],
            pricePerHead: Number(order.listing.pricePerHead),
            breed: order.listing.breed,
          }
        : null,
      buyer: {
        id: order.buyer.id,
        fullName: order.buyer.fullName,
        phone: order.buyer.phone,
      },
      seller: {
        id: order.seller.id,
        fullName: order.seller.fullName,
        phone: order.seller.phone,
      },
      broker: order.broker
        ? { id: order.broker.id, fullName: order.broker.fullName }
        : null,
    };
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

---

### Task 4: Extend OrdersService tests with findMyOrders, findOne, and updateStatus privacy change

**Files:**
- Modify: `backend/src/modules/orders/orders.service.spec.ts`

- [ ] **Step 1: Update imports and mockOrderRepo to include createQueryBuilder**

At the top of `backend/src/modules/orders/orders.service.spec.ts`, add imports for `Breed` and the new response DTOs. Find:

```typescript
import {
  Currency,
  ListingStatus,
  OrderStatus,
} from '@shared/enums';
import { CreateOrderDto } from './dto/create-order.dto';
```

Replace with:

```typescript
import {
  Breed,
  Currency,
  ListingStatus,
  OrderStatus,
} from '@shared/enums';
import { CreateOrderDto } from './dto/create-order.dto';
```

Then find the `beforeEach` block with `mockOrderRepo`:

```typescript
  beforeEach(async () => {
    const mockOrderRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };
```

Replace with:

```typescript
  let mockQb: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  beforeEach(async () => {
    mockQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };

    const mockOrderRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    };
```

**Important:** The `let mockQb` declaration must be at the `describe('OrdersService', ...)` outer scope (same level as `let service`, `let orderRepo`, etc.), NOT inside `beforeEach`. Move it up to the top of the describe block, right after the existing `let listingRepo: jest.Mocked<Repository<Listing>>;` line.

The final structure should look like:

```typescript
describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepo: jest.Mocked<Repository<Order>>;
  let listingRepo: jest.Mocked<Repository<Listing>>;
  let mockQb: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  // ... existing fixtures (buyerId, sellerId, listingId, activeListing, createDto) ...

  beforeEach(async () => {
    mockQb = { /* ... as shown above ... */ };
    const mockOrderRepo = { /* ... with createQueryBuilder ... */ };
    // ... rest unchanged ...
  });
```

- [ ] **Step 2: Modify the existing updateStatus non-party test to expect NotFoundException**

Find the existing test in the `describe('updateStatus', ...)` block:

```typescript
    it('throws ForbiddenException when caller is not buyer or seller', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.PENDING) as Order,
      );

      await expect(
        service.updateStatus(orderId, otherUserId, OrderStatus.CANCELLED),
      ).rejects.toThrow(ForbiddenException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });
```

Replace with:

```typescript
    it('throws NotFoundException when caller is not buyer or seller (privacy)', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.PENDING) as Order,
      );

      await expect(
        service.updateStatus(orderId, otherUserId, OrderStatus.CANCELLED),
      ).rejects.toThrow(NotFoundException);
      expect(orderRepo.save).not.toHaveBeenCalled();
    });
```

- [ ] **Step 3: Append findMyOrders test block to the file**

Append the following at the end of the file, INSIDE the outer `describe('OrdersService', ...)` block (before its closing `});`), after the existing `describe('updateStatus', ...)` block:

```typescript

  describe('findMyOrders', () => {
    const orderId1 = '44444444-4444-4444-4444-444444444444';
    const orderId2 = '55555555-5555-5555-5555-555555555555';
    const otherUserId = '99999999-9999-9999-9999-999999999999';

    const mockListing = {
      id: listingId,
      title: 'Test Sheep',
      images: ['kyc/a/img-1.jpg'],
      pricePerHead: 1200,
      breed: Breed.AWASSI,
    };
    const mockBuyerUser = {
      id: buyerId,
      fullName: 'Buyer One',
      phone: '+966500000001',
    };
    const mockSellerUser = {
      id: sellerId,
      fullName: 'Seller One',
      phone: '+966500000002',
    };

    const baseOrder = {
      id: orderId1,
      buyerId,
      sellerId,
      brokerId: null,
      status: OrderStatus.PENDING,
      quantity: 10,
      unitPrice: 1150,
      currency: Currency.SAR,
      totalPrice: 11500,
      commissionRate: 5.0,
      commissionAmount: 575,
      deliveryCountry: 'SA',
      deliveryCity: 'Riyadh',
      deliveryAddress: '123 Market St',
      createdAt: new Date('2026-04-10T00:00:00Z'),
      updatedAt: new Date('2026-04-10T00:00:00Z'),
      listing: mockListing,
      buyer: mockBuyerUser,
      seller: mockSellerUser,
      broker: null,
    };

    it('returns orders with buyer myRole when user is buyer', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[baseOrder], 1]);

      const result = await service.findMyOrders(buyerId, {});

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(orderId1);
      expect(result.items[0].myRole).toBe('buyer');
      expect(result.items[0].counterparty.id).toBe(sellerId);
      expect(result.total).toBe(1);
    });

    it('returns orders with seller myRole when user is seller', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[baseOrder], 1]);

      const result = await service.findMyOrders(sellerId, {});

      expect(result.items[0].myRole).toBe('seller');
      expect(result.items[0].counterparty.id).toBe(buyerId);
    });

    it('returns orders with broker myRole when user is broker', async () => {
      const brokerOrder = {
        ...baseOrder,
        brokerId: otherUserId,
        broker: { id: otherUserId, fullName: 'Broker One' },
      };
      mockQb.getManyAndCount.mockResolvedValue([[brokerOrder], 1]);

      const result = await service.findMyOrders(otherUserId, {});

      expect(result.items[0].myRole).toBe('broker');
    });

    it('mixes buyer and seller orders in one response with correct myRole per item', async () => {
      const asBuyer = { ...baseOrder, id: orderId1, buyerId, sellerId: otherUserId };
      const asSeller = {
        ...baseOrder,
        id: orderId2,
        buyerId: otherUserId,
        sellerId: buyerId,
        buyer: { id: otherUserId, fullName: 'Other', phone: '+966500000099' },
        seller: mockBuyerUser,
      };
      mockQb.getManyAndCount.mockResolvedValue([[asBuyer, asSeller], 2]);

      const result = await service.findMyOrders(buyerId, {});

      expect(result.items).toHaveLength(2);
      expect(result.items[0].myRole).toBe('buyer');
      expect(result.items[1].myRole).toBe('seller');
    });

    it('applies skip/take for pagination (page=2, pageSize=5)', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 10]);

      const result = await service.findMyOrders(buyerId, {
        page: 2,
        pageSize: 5,
      });

      expect(mockQb.skip).toHaveBeenCalledWith(5);
      expect(mockQb.take).toHaveBeenCalledWith(5);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(5);
      expect(result.totalPages).toBe(2);
    });

    it('defaults to page=1 pageSize=20 when not provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findMyOrders(buyerId, {});

      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(mockQb.take).toHaveBeenCalledWith(20);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('adds andWhere clause filtering by single status', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findMyOrders(buyerId, { status: [OrderStatus.PENDING] });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        { statuses: [OrderStatus.PENDING] },
      );
    });

    it('adds andWhere clause filtering by multiple statuses', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findMyOrders(buyerId, {
        status: [OrderStatus.PENDING, OrderStatus.ACCEPTED],
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('status'),
        { statuses: [OrderStatus.PENDING, OrderStatus.ACCEPTED] },
      );
    });

    it('does NOT call andWhere when status filter is not provided', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findMyOrders(buyerId, {});

      expect(mockQb.andWhere).not.toHaveBeenCalled();
    });

    it('returns empty items and total=0 when user has no orders', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findMyOrders(buyerId, {});

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('orders by createdAt DESC', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findMyOrders(buyerId, {});

      expect(mockQb.orderBy).toHaveBeenCalledWith('order.createdAt', 'DESC');
    });

    it('filters where buyer OR seller OR broker equals userId', async () => {
      mockQb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findMyOrders(buyerId, {});

      expect(mockQb.where).toHaveBeenCalledWith(
        expect.stringMatching(/buyerId.*OR.*sellerId.*OR.*brokerId/),
        { userId: buyerId },
      );
    });
  });

  describe('findOne', () => {
    const orderId = '44444444-4444-4444-4444-444444444444';
    const otherUserId = '99999999-9999-9999-9999-999999999999';

    const mockListing = {
      id: listingId,
      title: 'Test Sheep',
      images: ['kyc/a/img-1.jpg'],
      pricePerHead: 1200,
      breed: Breed.AWASSI,
    };

    const baseOrder = {
      id: orderId,
      buyerId,
      sellerId,
      brokerId: null,
      status: OrderStatus.PENDING,
      quantity: 10,
      unitPrice: 1150,
      currency: Currency.SAR,
      totalPrice: 11500,
      commissionRate: 5.0,
      commissionAmount: 575,
      deliveryCountry: 'SA',
      deliveryCity: 'Riyadh',
      deliveryAddress: '123 Market St',
      createdAt: new Date('2026-04-10T00:00:00Z'),
      updatedAt: new Date('2026-04-10T00:00:00Z'),
      listing: mockListing,
      buyer: { id: buyerId, fullName: 'Buyer One', phone: '+966500000001' },
      seller: { id: sellerId, fullName: 'Seller One', phone: '+966500000002' },
      broker: null,
    };

    it('returns detail response with myRole=buyer when caller is buyer', async () => {
      orderRepo.findOne.mockResolvedValue(baseOrder as unknown as Order);

      const result = await service.findOne(orderId, buyerId);

      expect(result.id).toBe(orderId);
      expect(result.myRole).toBe('buyer');
      expect(result.deliveryAddress).toBe('123 Market St');
      expect(result.buyer.phone).toBe('+966500000001');
      expect(result.seller.phone).toBe('+966500000002');
    });

    it('returns detail response with myRole=seller when caller is seller', async () => {
      orderRepo.findOne.mockResolvedValue(baseOrder as unknown as Order);

      const result = await service.findOne(orderId, sellerId);

      expect(result.myRole).toBe('seller');
    });

    it('throws NotFoundException when order does not exist', async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(orderId, buyerId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when caller is not a party to the order (privacy)', async () => {
      orderRepo.findOne.mockResolvedValue(baseOrder as unknown as Order);

      await expect(service.findOne(orderId, otherUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
```

- [ ] **Step 4: Run tests to verify the new cases fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/orders/orders.service.spec.ts 2>&1 | tail -25`
Expected: FAIL — either TypeScript error (`service.findMyOrders is not a function`, `service.findOne is not a function`) or the modified `updateStatus` test expecting NotFoundException but getting ForbiddenException.

---

### Task 5: Implement findMyOrders, findOne, and updateStatus privacy fix

**Files:**
- Modify: `backend/src/modules/orders/orders.service.ts`

- [ ] **Step 1: Update imports in orders.service.ts**

In `backend/src/modules/orders/orders.service.ts`, the current import block is:

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
import { ListingStatus, OrderStatus } from '@shared/enums';
```

Replace with:

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

Keep `ForbiddenException` — it is still used in `create` for the self-order check (caller clearly knows the listing exists, so 403 is appropriate there).

- [ ] **Step 2: Fix the updateStatus privacy branch**

Find this block in `orders.service.ts` inside `updateStatus`:

```typescript
    const isBuyer = order.buyerId === userId;
    const isSeller = order.sellerId === userId;
    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('Not a party to this order');
    }
```

Replace with:

```typescript
    const isBuyer = order.buyerId === userId;
    const isSeller = order.sellerId === userId;
    if (!isBuyer && !isSeller) {
      throw new NotFoundException('Order not found');
    }
```

- [ ] **Step 3: Add findMyOrders and findOne methods**

Append these two methods INSIDE the `OrdersService` class in `orders.service.ts`, after the existing `updateStatus` method (before the class closing `}`):

```typescript

  async findMyOrders(
    userId: string,
    query: ListOrdersQueryDto,
  ): Promise<{
    items: OrderListItemResponse[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.listing', 'listing')
      .leftJoinAndSelect('order.buyer', 'buyer')
      .leftJoinAndSelect('order.seller', 'seller')
      .leftJoinAndSelect('order.broker', 'broker')
      .where(
        '(order.buyerId = :userId OR order.sellerId = :userId OR order.brokerId = :userId)',
        { userId },
      )
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.status && query.status.length > 0) {
      qb.andWhere('order.status IN (:...statuses)', {
        statuses: query.status,
      });
    }

    const [orders, total] = await qb.getManyAndCount();

    return {
      items: orders.map((o) => OrderListItemResponse.fromOrder(o, userId)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(
    orderId: string,
    userId: string,
  ): Promise<OrderDetailResponse> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['listing', 'buyer', 'seller', 'broker'],
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

    return OrderDetailResponse.fromOrder(order, userId);
  }
```

- [ ] **Step 4: Run service tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/orders/orders.service.spec.ts 2>&1 | tail -15`
Expected: PASS — 38 tests passing (8 existing `create` + 16 `updateStatus` with 1 modified + 10 new `findMyOrders` + 4 new `findOne`).

---

### Task 6: Extend OrdersController tests with GET endpoint cases

**Files:**
- Modify: `backend/src/modules/orders/orders.controller.spec.ts`

- [ ] **Step 1: Add imports for new types**

At the top of `backend/src/modules/orders/orders.controller.spec.ts`, find the DTO imports block:

```typescript
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
```

Add directly below it:

```typescript
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
```

- [ ] **Step 2: Add findMyOrders and findOne to mock service**

Find the `beforeEach` block's `mockService`:

```typescript
    const mockService = {
      create: jest.fn(),
      updateStatus: jest.fn(),
    };
```

Replace with:

```typescript
    const mockService = {
      create: jest.fn(),
      updateStatus: jest.fn(),
      findMyOrders: jest.fn(),
      findOne: jest.fn(),
    };
```

- [ ] **Step 3: Append findMyOrders and findOne test blocks**

Append the following at the end of the file, INSIDE the outer `describe('OrdersController', ...)` block (before its closing `});`), after the existing `describe('updateStatus', ...)` block:

```typescript

  describe('findMyOrders', () => {
    const query: ListOrdersQueryDto = {
      page: 1,
      pageSize: 20,
      status: [OrderStatus.PENDING],
    };

    const serviceResult = {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    };

    it('calls service.findMyOrders with (user.id, query) and returns result', async () => {
      service.findMyOrders.mockResolvedValue(serviceResult);

      const result = await controller.findMyOrders(buyer, query);

      expect(service.findMyOrders).toHaveBeenCalledWith(buyer.id, query);
      expect(result).toEqual(serviceResult);
    });
  });

  describe('findOne', () => {
    const orderId = '44444444-4444-4444-4444-444444444444';
    const detailResponse = {
      id: orderId,
      myRole: 'buyer' as const,
    };

    it('calls service.findOne with (id, user.id) and returns result', async () => {
      service.findOne.mockResolvedValue(detailResponse as never);

      const result = await controller.findOne(orderId, buyer);

      expect(service.findOne).toHaveBeenCalledWith(orderId, buyer.id);
      expect(result).toEqual(detailResponse);
    });
  });
```

- [ ] **Step 4: Run controller tests to verify the new cases fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/orders/orders.controller.spec.ts 2>&1 | tail -15`
Expected: FAIL — "controller.findMyOrders is not a function" / "controller.findOne is not a function" or TypeScript compile error.

---

### Task 7: Add GET routes to OrdersController

**Files:**
- Modify: `backend/src/modules/orders/orders.controller.ts`

- [ ] **Step 1: Update imports**

In `backend/src/modules/orders/orders.controller.ts`, the current import block is:

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

Replace with:

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { OrderDetailResponse } from './dto/order-detail.response';
```

- [ ] **Step 2: Add GET methods to the controller class**

Inside the `OrdersController` class in `orders.controller.ts`, after the existing `updateStatus` method (before the class closing `}`), add:

```typescript

  @Get()
  @UseGuards(JwtAuthGuard)
  async findMyOrders(
    @CurrentUser() user: User,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.ordersService.findMyOrders(user.id, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<OrderDetailResponse> {
    return this.ordersService.findOne(id, user.id);
  }
```

**Important — route ordering:** NestJS matches routes top-down. `@Get(':id')` is a wildcard match for any path segment, so it MUST come AFTER `@Get()`. Similarly, `@Patch(':id/status')` must remain as-is (more specific than `:id` because of the trailing `/status`). The final method order in the controller class should be: `create` (POST), `updateStatus` (PATCH `:id/status`), `findMyOrders` (GET), `findOne` (GET `:id`).

- [ ] **Step 3: Run controller tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/orders/orders.controller.spec.ts 2>&1 | tail -10`
Expected: PASS — 6 tests passing (2 `create` + 2 `updateStatus` + 1 `findMyOrders` + 1 `findOne`).

---

### Task 8: Full regression check

- [ ] **Step 1: Run complete test suite**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --silent 2>&1 | tail -8`
Expected: `Tests: 158 passed` (142 existing + 14 new service tests + 2 new controller tests = 158; the 1 modified updateStatus test stays counted as one).

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.
