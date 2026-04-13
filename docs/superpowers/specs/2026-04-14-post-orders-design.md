# US06-02+03: POST /orders + Auto-calculation Design Spec

**Date:** 2026-04-14
**Issues:** #38 (POST /orders) + #39 (auto-calculate totalPrice and commissionAmount)

## Endpoint

```
POST /api/v1/orders
```

**Guards (in order):**
1. `JwtAuthGuard` — populates `req.user`
2. `RolesGuard` with `@Roles(UserRole.BUYER)` — only BUYER role
3. `KycVerifiedGuard` — requires kycStatus === VERIFIED

**Response:** Raw `Order` entity (no relations loaded), HTTP 201.

## CreateOrderDto

**File:** `backend/src/modules/orders/dto/create-order.dto.ts`

| Field | Type | Validation |
|-------|------|------------|
| listingId | string | @IsUUID(), @IsNotEmpty() |
| quantity | number | @IsInt(), @Min(1) |
| unitPrice | number | @IsNumber(), @Min(0.01) |
| deliveryCountry | string | @IsString(), @IsNotEmpty(), @Length(1, 100) |
| deliveryCity | string | @IsString(), @IsNotEmpty(), @Length(1, 100) |
| deliveryAddress | string | @IsString(), @IsNotEmpty(), @Length(1, 500) |

**Not in DTO:**
- `currency` — copied from listing in service
- `brokerId` — Phase 2, set to null
- `sellerId` — derived from listing
- `totalPrice`, `commissionAmount`, `commissionRate` — calculated

## Service Logic

**File:** `backend/src/modules/orders/orders.service.ts`

```
OrdersService.create(buyerId: string, dto: CreateOrderDto): Promise<Order>
```

**Steps:**

1. Fetch listing: `listingRepo.findOne({ where: { id: dto.listingId } })`
   - If null → `NotFoundException('Listing not found')`
   - (TypeORM soft-delete automatically excludes soft-deleted rows)

2. Check `listing.status === ListingStatus.ACTIVE`
   - If not → `BadRequestException('Listing is not available for orders')`

3. Check `listing.sellerId !== buyerId`
   - If equal → `ForbiddenException('Cannot order your own listing')`

4. Calculate:
   ```typescript
   const commissionRate = 5.0;
   const totalPrice = Math.round(dto.quantity * dto.unitPrice * 100) / 100;
   const commissionAmount = Math.round(totalPrice * commissionRate) / 100;
   ```

5. Create order entity:
   ```typescript
   const order = orderRepo.create({
     listingId: dto.listingId,
     buyerId,
     sellerId: listing.sellerId,
     brokerId: null,
     quantity: dto.quantity,
     unitPrice: dto.unitPrice,
     currency: listing.currency,
     totalPrice,
     commissionRate,
     commissionAmount,
     status: OrderStatus.PENDING, // default, explicit for clarity
     deliveryCountry: dto.deliveryCountry,
     deliveryCity: dto.deliveryCity,
     deliveryAddress: dto.deliveryAddress,
   });
   return orderRepo.save(order);
   ```

## Controller

**File:** `backend/src/modules/orders/orders.controller.ts`

```typescript
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, KycVerifiedGuard)
  @Roles(UserRole.BUYER)
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateOrderDto,
  ): Promise<Order> {
    return this.ordersService.create(user.id, dto);
  }
}
```

## Error Cases

| Condition | Exception | HTTP |
|-----------|-----------|------|
| Listing not found / soft-deleted | NotFoundException | 404 |
| Listing status !== ACTIVE | BadRequestException | 400 |
| Buyer is the listing's seller | ForbiddenException | 403 |
| Not authenticated | UnauthorizedException | 401 |
| Not a BUYER role | ForbiddenException | 403 |
| KYC not verified | ForbiddenException | 403 |
| Invalid DTO | BadRequestException | 400 |

## Module Changes

**File:** `backend/src/modules/orders/orders.module.ts`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    ListingsModule, // for Listing repository access via exports
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [TypeOrmModule],
})
export class OrdersModule {}
```

**File:** `backend/src/modules/listings/listings.module.ts`

Must export `TypeOrmModule` (if not already) so orders module can inject `Repository<Listing>`.

## Tests

**OrdersService.create (8 tests):**

1. Happy path: creates order with buyerId, listing's sellerId, listing's currency, PENDING status
2. Currency copied from listing (test with different currencies)
3. Commission calculated at exactly 5% of totalPrice
4. Listing not found → NotFoundException
5. Listing status SOLD/EXPIRED/FLAGGED → BadRequestException
6. Buyer is the listing's seller → ForbiddenException
7. totalPrice rounds correctly for non-integer results (e.g., 3 × 99.99 = 299.97)
8. brokerId is set to null

**OrdersController.create (3 tests):**

1. Passes @CurrentUser().id as buyerId and DTO to service.create
2. Returns the exact service result
3. Propagates service errors (e.g., NotFoundException) unchanged

## Design Decisions

1. **Flexible `unitPrice`** — buyer can specify any unit price, not tied to `listing.pricePerHead`. Matches real-world negotiation behavior. Seller controls via accept/reject.

2. **Explicit self-order check** — defense in depth against future role changes. Single-line check.

3. **Only ACTIVE listings accepted** — sold/expired/flagged listings reject new orders.

4. **Hardcoded 5% commission** — no config yet. Defer to CommissionService if per-country or per-seller rates needed later.

5. **Raw entity response** — no relation eager-loading on create. Buyer already has the data they just submitted.

6. **Rounding** — both `totalPrice` and `commissionAmount` use `Math.round(x * 100) / 100` for 2-decimal precision before DB storage. Avoids floating-point drift on subsequent reads.

7. **`buyerId` from JWT, never DTO** — prevents buyer from spoofing orders on behalf of other users.

## Scope

This spec covers ONLY issues #38 and #39:
- POST /orders endpoint
- CreateOrderDto
- OrdersService.create with auto-calculation
- OrdersController.create
- Service + controller tests for create flow
- Module wiring

It does NOT cover: GET /orders, PATCH /orders/:id/status, status transitions, events, broker logic — those are issues #40–#44.
