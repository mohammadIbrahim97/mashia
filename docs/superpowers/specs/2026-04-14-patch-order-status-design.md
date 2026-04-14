# US06-04+05: PATCH /orders/:id/status + Transition Rules Design Spec

**Date:** 2026-04-14
**Issues:** #40 (PATCH endpoint) + #41 (valid status transitions)

## Endpoint

```
PATCH /api/v1/orders/:id/status
```

**Guards:** `JwtAuthGuard` only.
- No `RolesGuard` — both BUYER and SELLER can invoke this endpoint. Role-specific permissions are enforced per-transition in the service.
- No `KycVerifiedGuard` — KYC is required at order creation; existing orders don't need re-verification.

**Body:** `UpdateOrderStatusDto`
```typescript
{ status: OrderStatus }
```

**Response:** Updated `Order` entity (raw, no relations).

## Transition Matrix (API-driven)

| From | To | Allowed Caller |
|------|-----|---------------|
| PENDING | ACCEPTED | Seller |
| PENDING | CANCELLED | Buyer OR Seller |
| PAID | IN_TRANSIT | Seller |
| IN_TRANSIT | DELIVERED | Buyer |
| PAID | DISPUTED | Buyer OR Seller |
| IN_TRANSIT | DISPUTED | Buyer OR Seller |
| DELIVERED | DISPUTED | Buyer OR Seller |

All other transitions via this endpoint are rejected with `BadRequestException`.

## Transitions NOT Handled by This Endpoint

These are system-driven and will be called internally by US07 (Escrow/Payments):

| From | To | Trigger |
|------|-----|---------|
| ACCEPTED | PAID | Payment service on successful capture |
| DELIVERED | COMPLETED | Escrow service on release |

The OrderStatus enum includes these values, but the PATCH endpoint will return `BadRequestException` if a user tries to trigger them. US07 will expose internal service methods (not HTTP routes) for these.

## Terminal States

Once an order reaches one of these, no further transitions allowed via this endpoint:

- `COMPLETED`
- `CANCELLED`
- `DISPUTED`

Any PATCH against an order in a terminal state returns `BadRequestException`.

## Service Logic

**File:** `backend/src/modules/orders/orders.service.ts`

```typescript
async updateStatus(
  orderId: string,
  userId: string,
  newStatus: OrderStatus,
): Promise<Order>
```

**Steps:**

1. Fetch order: `ordersRepository.findOne({ where: { id: orderId } })`
   - If null → `NotFoundException('Order not found')`

2. Identify caller's role in this order:
   ```typescript
   const isBuyer = order.buyerId === userId;
   const isSeller = order.sellerId === userId;
   if (!isBuyer && !isSeller) {
     throw new ForbiddenException('Not a party to this order');
   }
   ```

3. Validate transition via switch on `order.status`:
   ```typescript
   switch (order.status) {
     case OrderStatus.PENDING:
       if (newStatus === OrderStatus.ACCEPTED && isSeller) break;
       if (newStatus === OrderStatus.CANCELLED) break; // buyer or seller
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

     // Terminal states: ACCEPTED handled internally by US07; if user tries to hit
     // ACCEPTED -> anything else here, it's always an error.
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
   ```

Note: ACCEPTED is treated as "no user-driven outgoing transition" — the only outgoing transition is ACCEPTED→PAID which is system-only.

## Controller

**File:** `backend/src/modules/orders/orders.controller.ts`

Add new endpoint alongside the existing `POST /`:

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

## DTO

**File:** `backend/src/modules/orders/dto/update-order-status.dto.ts`

```typescript
import { IsEnum } from 'class-validator';
import { OrderStatus } from '@shared/enums';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
```

## Error Cases

| Condition | Exception | HTTP |
|-----------|-----------|------|
| Order not found | NotFoundException | 404 |
| Caller not buyer or seller | ForbiddenException | 403 |
| Invalid transition for user's role | BadRequestException | 400 |
| Transition from terminal state | BadRequestException | 400 |
| User tries system-only transition (PENDING→PAID, ACCEPTED→anything, DELIVERED→COMPLETED) | BadRequestException | 400 |
| Invalid DTO (non-enum status) | BadRequestException | 400 |
| Not authenticated | UnauthorizedException | 401 |

## Tests

**OrdersService.updateStatus (16 tests):**

1. Seller PENDING→ACCEPTED ✓ (happy path)
2. Buyer PENDING→CANCELLED ✓
3. Seller PENDING→CANCELLED ✓
4. Buyer PENDING→ACCEPTED rejected (seller-only)
5. Seller PAID→IN_TRANSIT ✓
6. Buyer PAID→IN_TRANSIT rejected
7. Buyer IN_TRANSIT→DELIVERED ✓
8. Seller IN_TRANSIT→DELIVERED rejected
9. Buyer PAID→DISPUTED ✓
10. Seller DELIVERED→DISPUTED ✓
11. Buyer PENDING→DISPUTED rejected (pre-payment has nothing to dispute)
12. Buyer PENDING→PAID rejected (not a defined transition)
13. Any caller on non-existent order → NotFoundException
14. User who is not buyer or seller → ForbiddenException
15. Already COMPLETED, attempt any transition → BadRequestException
16. Already CANCELLED, attempt any transition → BadRequestException

**OrdersController.updateStatus (2 tests):**

1. Passes (id, user.id, dto.status) to service.updateStatus and returns result
2. Propagates BadRequestException from service

## Design Decisions

1. **No RolesGuard** — endpoint is open to any authenticated user; authorization is transition-specific. A single `@Roles(BUYER)` or `@Roles(SELLER)` decorator can't express "either buyer OR seller of this specific order."

2. **Identity by ownership, not by role enum** — service compares `userId` to `order.buyerId`/`order.sellerId`. A user with `role: SELLER` who is the buyer on this order is treated as the buyer.

3. **Switch statement in service** — simple, direct, no premature abstraction. 5 transitions total; a transition map adds indirection for little gain.

4. **ACCEPTED has no valid outgoing transition via PATCH** — the only outgoing transition is ACCEPTED→PAID which is payment-system-only. Any user attempt returns BadRequestException.

5. **DISPUTED only from paid-onwards** — pre-payment (PENDING, ACCEPTED) has no money at risk. If parties disagree, they cancel. Disputes are reserved for situations with financial harm.

6. **No status history** — MVP. Audit log table can come later if disputes need transition trail. `updatedAt` captures last change timestamp.

7. **Error messages name the specific transition** — makes debugging clearer than a generic "invalid transition."

## Scope

This spec covers ONLY issues #40 and #41:
- PATCH /orders/:id/status endpoint
- UpdateOrderStatusDto
- OrdersService.updateStatus with transition validation
- OrdersController.updateStatus
- Tests

It does NOT cover: GET /orders (#42), events (#43), the internal service methods for accepted→paid and delivered→completed (those belong to US07).
