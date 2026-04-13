# US06-01: Order Entity Design Spec

**Date:** 2026-04-13
**Issue:** #37 — Implement Order entity with full lifecycle status enum

## OrderStatus Enum

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

### Status Transitions

```
PENDING → ACCEPTED (seller accepts)
PENDING → CANCELLED (buyer or seller cancels)
ACCEPTED → PAID (payment confirmed via US07)
PAID → IN_TRANSIT (seller ships)
IN_TRANSIT → DELIVERED (buyer confirms receipt)
DELIVERED → COMPLETED (escrow released, final state)
any → DISPUTED (buyer or seller raises dispute)
```

Terminal states: `COMPLETED`, `CANCELLED`, `DISPUTED`.

## Order Entity

**Table:** `orders`
**File:** `backend/src/modules/orders/order.entity.ts`

### Columns (17)

| Column | DB Column | TypeORM Type | Constraints |
|--------|-----------|-------------|-------------|
| id | id | uuid PK | @PrimaryGeneratedColumn('uuid') |
| listingId | listing_id | uuid FK | nullable (SET NULL on listing delete) |
| buyerId | buyer_id | uuid FK | required |
| sellerId | seller_id | uuid FK | required |
| brokerId | broker_id | uuid FK | nullable — reserved for Phase 2 broker commission tracking |
| quantity | quantity | int | required, positive |
| unitPrice | unit_price | decimal(12,2) | agreed price per head |
| currency | currency | enum Currency | copied from listing at order creation |
| totalPrice | total_price | decimal(14,2) | auto-calculated: quantity × unitPrice |
| commissionRate | commission_rate | decimal(5,2) | default 5.00 |
| commissionAmount | commission_amount | decimal(14,2) | auto-calculated: totalPrice × commissionRate / 100 |
| status | status | enum OrderStatus | default PENDING |
| deliveryCountry | delivery_country | varchar | required |
| deliveryCity | delivery_city | varchar | required |
| deliveryAddress | delivery_address | text | required |
| createdAt | created_at | timestamp | @CreateDateColumn |
| updatedAt | updated_at | timestamp | @UpdateDateColumn |

### Relations

```
Order.listing  → ManyToOne → Listing  (onDelete: 'SET NULL' — preserve order if listing soft-deleted)
Order.buyer    → ManyToOne → User     (onDelete: 'CASCADE')
Order.seller   → ManyToOne → User     (onDelete: 'CASCADE')
Order.broker   → ManyToOne → User     (onDelete: 'SET NULL', nullable: true)
```

**Why no CASCADE on listing:** Listings use soft-delete. If a listing is soft-deleted (seller removes it), existing orders must survive for dispute resolution and payment records. SET NULL preserves the order row; the listing data is still recoverable via soft-delete restore.

**Why CASCADE on buyer/seller:** If a user account is deleted, their orders are meaningless. But in practice, user deletion isn't implemented — this is a safety default.

**Why SET NULL on broker:** Broker is optional context, not a structural dependency.

### No Soft Delete

Orders are financial/legal records. They reach terminal states (COMPLETED, CANCELLED, DISPUTED) — they are never deleted. No @DeleteDateColumn.

## Design Decisions

1. **Currency copied from listing** — order is self-contained, immune to listing edits after order placement
2. **No stock validation** — seller accepts/rejects orders manually; no inventory decrement or race condition handling
3. **Broker column present but unused in MVP** — the column exists for Phase 2 broker commission tracking. For now, orders always set brokerId=null. The listing's sellerId is copied to order.sellerId regardless of whether the seller has role=BROKER (a broker posting a listing IS the seller for MVP purposes)
4. **Commission stored per-order** — allows rate changes without retroactively affecting existing orders
5. **listingId nullable after SET NULL** — entity must type listingId as `string | null` to handle the edge case where a listing is hard-deleted (shouldn't happen, but type-safe)

## Scope

This issue (#37) covers ONLY:
- Adding `OrderStatus` enum to `backend/src/shared/enums/index.ts`
- Creating the `Order` entity at `backend/src/modules/orders/order.entity.ts`
- Updating `OrdersModule` to register the entity with TypeORM

It does NOT cover: DTOs, service, controller, tests, events — those are issues #38–#44.
