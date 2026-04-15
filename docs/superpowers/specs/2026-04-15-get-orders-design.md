# US06-06: GET /orders + GET /orders/:id Design Spec

**Date:** 2026-04-15
**Issue:** #42 (GET /orders). Implicitly covers GET /orders/:id (needed by #44 tests).

## Endpoints

```
GET /api/v1/orders              — list my orders (paginated, filterable)
GET /api/v1/orders/:id          — single order detail
```

Both guarded by `JwtAuthGuard` only. No `RolesGuard`, no `KycVerifiedGuard`.

- Any authenticated user may call these. Authorization to see a specific order is determined by whether the user is a party (buyer/seller/broker) — enforced per-endpoint in the service layer.

## Semantic: "My orders"

A user is a party to an order if any of these hold:
- `order.buyerId === user.id`
- `order.sellerId === user.id`
- `order.brokerId === user.id`

`brokerId` is always null in MVP (Phase 2 reserves it), but the query includes it for forward compatibility.

## GET /orders — List

### Query DTO

**File:** `backend/src/modules/orders/dto/list-orders-query.dto.ts`

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

Validation notes:
- `page`/`pageSize` accept string query params (`@Type(() => Number)` coerces).
- `status` supports repeated query params: `?status=pending&status=accepted`. NestJS/class-validator handles array form automatically when `ValidationPipe({ transform: true })` is configured.
- Invalid status value → `BadRequestException` with field error.

### Response shape

```typescript
{
  items: OrderListItemResponse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

### OrderListItemResponse

**File:** `backend/src/modules/orders/dto/order-list-item.response.ts`

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

Notes:
- `Number(order.unitPrice)` because TypeORM decimal columns deserialize as strings.
- `listing` is null if the underlying listing was soft-deleted (foreign key `SET NULL`).
- `counterparty` for a broker is the buyer by convention (brokers always coordinate with the buyer in our business logic). In MVP brokerId is always null so this branch is unreachable.

## GET /orders/:id — Detail

### OrderDetailResponse

**File:** `backend/src/modules/orders/dto/order-detail.response.ts`

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

Privacy notes:
- Buyer and seller phone numbers exposed on detail only (enables post-order contact). This is acceptable because only parties to the order can fetch this endpoint.
- Email, KYC status, preferredLanguage, and other User fields are NOT exposed.
- `commissionRate` and `commissionAmount` are exposed to both parties. The commission is part of the order record; transparency is appropriate (the buyer paid it indirectly via totalPrice markup, the seller knows it's deducted from what they receive).

## Service Methods

**File:** `backend/src/modules/orders/orders.service.ts`

### findMyOrders

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
    qb.andWhere('order.status IN (:...statuses)', { statuses: query.status });
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
```

### findOne

```typescript
async findOne(orderId: string, userId: string): Promise<OrderDetailResponse> {
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

Note: both "doesn't exist" and "not yours" return `NotFoundException`. Privacy: prevents order UUID enumeration.

## Scope Fix: updateStatus privacy

Non-party access to `updateStatus` currently throws `ForbiddenException` — this mildly leaks existence. Change to `NotFoundException` to match `findOne`.

**In `orders.service.ts`:**

```typescript
// BEFORE
if (!isBuyer && !isSeller) {
  throw new ForbiddenException('Not a party to this order');
}

// AFTER
if (!isBuyer && !isSeller) {
  throw new NotFoundException('Order not found');
}
```

Remove `ForbiddenException` from the import if unused elsewhere in this file (it is currently only used in `create` for self-order, which stays as `ForbiddenException` — that's a different check and should stay Forbidden since the caller clearly knows the listing exists).

**In `orders.service.spec.ts`:**
- Rename test `'throws ForbiddenException when caller is not buyer or seller'` → `'throws NotFoundException when caller is not buyer or seller'`.
- Change `.rejects.toThrow(ForbiddenException)` → `.rejects.toThrow(NotFoundException)`.

## Controller Methods

**File:** `backend/src/modules/orders/orders.controller.ts`

Add two new routes alongside existing `@Post()` and `@Patch(':id/status')`:

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

Add imports:
- `Get`, `Query` from `@nestjs/common`
- `ListOrdersQueryDto` from `./dto/list-orders-query.dto`
- `OrderDetailResponse` from `./dto/order-detail.response`

## Error Cases

| Condition | Exception | HTTP |
|-----------|-----------|------|
| Not authenticated | UnauthorizedException | 401 |
| Invalid query param (bad pagination, bad status) | BadRequestException | 400 |
| Invalid UUID in :id | BadRequestException | 400 |
| Order not found | NotFoundException | 404 |
| Caller not a party to order | NotFoundException | 404 (privacy — no 403) |

## Tests

### OrdersService (14 new tests + 1 modified)

**findMyOrders:**

1. Returns orders where user is buyer
2. Returns orders where user is seller
3. Returns orders where user is broker (edge case, will be empty in MVP but query path tested)
4. Returns orders from both buyer and seller roles mixed in one response
5. Paginates: `page=2, pageSize=5` → offset 5, limit 5
6. Filters by single status (one-element array)
7. Filters by multiple statuses (`[PENDING, ACCEPTED]`)
8. Returns empty items array and total=0 when user has no orders
9. Orders DESC by createdAt
10. Sets `myRole` correctly per item based on user's relation to each order

**findOne:**

11. Returns order detail for buyer (myRole='buyer')
12. Returns order detail for seller (myRole='seller')
13. Throws NotFoundException when order does not exist
14. Throws NotFoundException when user is not a party (privacy check)

**Modified existing:**

15. `updateStatus` non-party test — now expects `NotFoundException` (was `ForbiddenException`)

### OrdersController (2 new tests)

1. `findMyOrders` passes `(user.id, query)` to service and returns result unchanged
2. `findOne` passes `(id, user.id)` to service and returns result unchanged

## Files to create / modify

**Create:**
- `backend/src/modules/orders/dto/list-orders-query.dto.ts`
- `backend/src/modules/orders/dto/order-list-item.response.ts`
- `backend/src/modules/orders/dto/order-detail.response.ts`

**Modify:**
- `backend/src/modules/orders/orders.service.ts` — add `findMyOrders`, `findOne`; change non-party branch in `updateStatus` to NotFoundException
- `backend/src/modules/orders/orders.controller.ts` — add `@Get()` and `@Get(':id')` routes + imports
- `backend/src/modules/orders/orders.service.spec.ts` — 14 new tests + 1 test title/expectation change
- `backend/src/modules/orders/orders.controller.spec.ts` — 2 new tests

## Design Decisions

1. **Single mixed list with `myRole` field** — user-friendly for the common case (seller seeing their sold orders mixed with rare purchases). Client can render tabs without a second API call.

2. **Array status filter** — mobile "Active | Archived" tabs need multi-status (e.g., Active = pending + accepted + paid + in_transit + delivered). Single-status filter or semantic groupings would force multiple API calls or encode UX decisions server-side.

3. **Two response DTOs (list vs detail)** — orders carry sensitive data (delivery address, commission details, counterparty phone). Returning raw entities like listings does would leak this in every list fetch. Trimming ~20 lines of code, worth it.

4. **404 instead of 403 for non-parties on GET and updateStatus** — prevents order UUID enumeration. Listings get away with 403-ish because they're public anyway; orders are private. Fix updateStatus to match — piggy-backing as a privacy bugfix on an already-closed issue.

5. **QueryBuilder instead of FindOptionsWhere** — the `(buyerId = :uid OR sellerId = :uid OR brokerId = :uid)` clause is cleaner in QueryBuilder than in object form. Listings uses QueryBuilder too for filter composition.

6. **No sort param** — `createdAt DESC` is what every user wants on "My Orders". Adding sort is trivial when someone actually needs it.

7. **`counterparty` on list, full buyer/seller on detail** — list is for identification ("this is my order with Ahmad for 10 sheep"), detail is for action ("call Ahmad"). Phone exposed only on detail keeps list payload lean.

8. **Broker counterparty defaults to buyer** — arbitrary convention since brokerId is always null in MVP. Revisit when brokers are activated in Phase 2.

## Scope

This spec covers:
- GET /orders list endpoint (#42)
- GET /orders/:id detail endpoint (implied by #44)
- `ListOrdersQueryDto`, `OrderListItemResponse`, `OrderDetailResponse`
- Service methods `findMyOrders`, `findOne`
- Privacy fix: `updateStatus` non-party → NotFoundException
- Tests (14 service + 2 controller + 1 modification)

Does NOT cover:
- Events (#43 — separate spec)
- Catch-all integration tests (#44 — will reassess after this is done, probably minimal new work)
- Admin endpoints to list all orders (US10)
