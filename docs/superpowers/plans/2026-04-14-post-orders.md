# POST /orders + Auto-calculation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement POST /api/v1/orders for verified buyers to place orders on active listings, with server-side auto-calculation of totalPrice and commissionAmount (5%).

**Architecture:** Follow the existing ListingsModule pattern. OrdersModule registers both Order and Listing entities via `TypeOrmModule.forFeature([Order, Listing])` so OrdersService can inject both repositories directly. Controller uses the same three-guard stack as seller endpoints (JWT + Roles + KYC). Service rounds decimals explicitly to avoid floating-point drift.

**Tech Stack:** NestJS, TypeORM, class-validator, Jest

**Spec:** `docs/superpowers/specs/2026-04-14-post-orders-design.md`

**Note on git:** The user commits manually — do NOT run `git add`, `git commit`, or `git push` in any step.

---

### Task 1: Create CreateOrderDto

**Files:**
- Create: `backend/src/modules/orders/dto/create-order.dto.ts`

- [ ] **Step 1: Write the DTO**

Write to `backend/src/modules/orders/dto/create-order.dto.ts`:

```typescript
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  @IsNotEmpty()
  listingId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0.01)
  unitPrice: number;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  deliveryCountry: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  deliveryCity: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  deliveryAddress: string;
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

---

### Task 2: Write OrdersService.create failing tests

**Files:**
- Create: `backend/src/modules/orders/orders.service.spec.ts`

- [ ] **Step 1: Write the test file**

Write to `backend/src/modules/orders/orders.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order } from './order.entity';
import { Listing } from '../listings/listing.entity';
import {
  Currency,
  ListingStatus,
  OrderStatus,
} from '@shared/enums';
import { CreateOrderDto } from './dto/create-order.dto';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepo: jest.Mocked<Repository<Order>>;
  let listingRepo: jest.Mocked<Repository<Listing>>;

  const buyerId = '11111111-1111-1111-1111-111111111111';
  const sellerId = '22222222-2222-2222-2222-222222222222';
  const listingId = '33333333-3333-3333-3333-333333333333';

  const activeListing: Partial<Listing> = {
    id: listingId,
    sellerId,
    status: ListingStatus.ACTIVE,
    currency: Currency.SAR,
    pricePerHead: 1200,
  };

  const createDto: CreateOrderDto = {
    listingId,
    quantity: 10,
    unitPrice: 1150,
    deliveryCountry: 'SA',
    deliveryCity: 'Riyadh',
    deliveryAddress: '123 Market St',
  };

  beforeEach(async () => {
    const mockOrderRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    const mockListingRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: mockOrderRepo },
        { provide: getRepositoryToken(Listing), useValue: mockListingRepo },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    orderRepo = module.get(getRepositoryToken(Order));
    listingRepo = module.get(getRepositoryToken(Listing));
  });

  describe('create', () => {
    it('creates order with buyerId, sellerId from listing, currency from listing, PENDING status', async () => {
      listingRepo.findOne.mockResolvedValue(activeListing as Listing);
      orderRepo.create.mockImplementation((data) => data as Order);
      orderRepo.save.mockImplementation(async (data) => data as Order);

      const result = await service.create(buyerId, createDto);

      expect(orderRepo.create).toHaveBeenCalledWith({
        listingId,
        buyerId,
        sellerId,
        brokerId: null,
        quantity: 10,
        unitPrice: 1150,
        currency: Currency.SAR,
        totalPrice: 11500,
        commissionRate: 5.0,
        commissionAmount: 575,
        status: OrderStatus.PENDING,
        deliveryCountry: 'SA',
        deliveryCity: 'Riyadh',
        deliveryAddress: '123 Market St',
      });
      expect(orderRepo.save).toHaveBeenCalled();
      expect(result.status).toBe(OrderStatus.PENDING);
    });

    it('copies currency from listing (different currency)', async () => {
      listingRepo.findOne.mockResolvedValue({
        ...activeListing,
        currency: Currency.USD,
      } as Listing);
      orderRepo.create.mockImplementation((data) => data as Order);
      orderRepo.save.mockImplementation(async (data) => data as Order);

      const result = await service.create(buyerId, createDto);

      expect(result.currency).toBe(Currency.USD);
    });

    it('calculates commission at exactly 5% of totalPrice', async () => {
      listingRepo.findOne.mockResolvedValue(activeListing as Listing);
      orderRepo.create.mockImplementation((data) => data as Order);
      orderRepo.save.mockImplementation(async (data) => data as Order);

      const result = await service.create(buyerId, createDto);

      // totalPrice = 10 * 1150 = 11500; commission = 5% = 575
      expect(result.totalPrice).toBe(11500);
      expect(result.commissionAmount).toBe(575);
      expect(result.commissionRate).toBe(5.0);
    });

    it('rounds totalPrice and commissionAmount to 2 decimals (3 × 99.99 = 299.97, 5% = 14.9985 → 15.00)', async () => {
      listingRepo.findOne.mockResolvedValue(activeListing as Listing);
      orderRepo.create.mockImplementation((data) => data as Order);
      orderRepo.save.mockImplementation(async (data) => data as Order);

      const result = await service.create(buyerId, {
        ...createDto,
        quantity: 3,
        unitPrice: 99.99,
      });

      expect(result.totalPrice).toBe(299.97);
      expect(result.commissionAmount).toBe(15);
    });

    it('sets brokerId to null', async () => {
      listingRepo.findOne.mockResolvedValue(activeListing as Listing);
      orderRepo.create.mockImplementation((data) => data as Order);
      orderRepo.save.mockImplementation(async (data) => data as Order);

      const result = await service.create(buyerId, createDto);

      expect(result.brokerId).toBeNull();
    });

    it('throws NotFoundException when listing does not exist', async () => {
      listingRepo.findOne.mockResolvedValue(null);

      await expect(service.create(buyerId, createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when listing status is not ACTIVE', async () => {
      listingRepo.findOne.mockResolvedValue({
        ...activeListing,
        status: ListingStatus.SOLD,
      } as Listing);

      await expect(service.create(buyerId, createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(orderRepo.save).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when buyer is the listing seller', async () => {
      listingRepo.findOne.mockResolvedValue({
        ...activeListing,
        sellerId: buyerId, // buyer === seller
      } as Listing);

      await expect(service.create(buyerId, createDto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(orderRepo.save).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/orders/orders.service.spec.ts 2>&1 | tail -10`
Expected: FAIL — "Cannot find module './orders.service'" or similar.

---

### Task 3: Implement OrdersService.create

**Files:**
- Create: `backend/src/modules/orders/orders.service.ts`

- [ ] **Step 1: Write the service**

Write to `backend/src/modules/orders/orders.service.ts`:

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

const DEFAULT_COMMISSION_RATE = 5.0;

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
  ) {}

  async create(buyerId: string, dto: CreateOrderDto): Promise<Order> {
    const listing = await this.listingsRepository.findOne({
      where: { id: dto.listingId },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Listing is not available for orders');
    }
    if (listing.sellerId === buyerId) {
      throw new ForbiddenException('Cannot order your own listing');
    }

    const commissionRate = DEFAULT_COMMISSION_RATE;
    const totalPrice = Math.round(dto.quantity * dto.unitPrice * 100) / 100;
    const commissionAmount = Math.round(totalPrice * commissionRate) / 100;

    const order = this.ordersRepository.create({
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
      status: OrderStatus.PENDING,
      deliveryCountry: dto.deliveryCountry,
      deliveryCity: dto.deliveryCity,
      deliveryAddress: dto.deliveryAddress,
    });
    return this.ordersRepository.save(order);
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/orders/orders.service.spec.ts 2>&1 | tail -10`
Expected: PASS — 8 tests passing.

---

### Task 4: Write OrdersController.create failing tests

**Files:**
- Create: `backend/src/modules/orders/orders.controller.spec.ts`

- [ ] **Step 1: Write the test file**

Write to `backend/src/modules/orders/orders.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { User } from '../users/user.entity';
import { Order } from './order.entity';
import {
  Currency,
  KycStatus,
  OrderStatus,
  PreferredLanguage,
  UserRole,
} from '@shared/enums';
import { CreateOrderDto } from './dto/create-order.dto';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: jest.Mocked<OrdersService>;

  const buyer: User = {
    id: '11111111-1111-1111-1111-111111111111',
    role: UserRole.BUYER,
    fullName: 'Buyer One',
    phone: '+966500000001',
    email: null,
    country: 'SA',
    city: 'Riyadh',
    kycStatus: KycStatus.VERIFIED,
    kycDocuments: null,
    preferredLanguage: PreferredLanguage.AR,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createDto: CreateOrderDto = {
    listingId: '33333333-3333-3333-3333-333333333333',
    quantity: 10,
    unitPrice: 1150,
    deliveryCountry: 'SA',
    deliveryCity: 'Riyadh',
    deliveryAddress: '123 Market St',
  };

  const savedOrder: Partial<Order> = {
    id: '44444444-4444-4444-4444-444444444444',
    listingId: createDto.listingId,
    buyerId: buyer.id,
    sellerId: '22222222-2222-2222-2222-222222222222',
    quantity: 10,
    unitPrice: 1150,
    currency: Currency.SAR,
    totalPrice: 11500,
    commissionRate: 5.0,
    commissionAmount: 575,
    status: OrderStatus.PENDING,
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get(OrdersService);
  });

  describe('create', () => {
    it('calls service.create with buyer.id and DTO, returns result', async () => {
      service.create.mockResolvedValue(savedOrder as Order);

      const result = await controller.create(buyer, createDto);

      expect(service.create).toHaveBeenCalledWith(buyer.id, createDto);
      expect(result).toEqual(savedOrder);
    });

    it('propagates NotFoundException from service', async () => {
      service.create.mockRejectedValue(new NotFoundException('Listing not found'));

      await expect(controller.create(buyer, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/orders/orders.controller.spec.ts 2>&1 | tail -10`
Expected: FAIL — "Cannot find module './orders.controller'" or similar.

---

### Task 5: Implement OrdersController

**Files:**
- Create: `backend/src/modules/orders/orders.controller.ts`

- [ ] **Step 1: Write the controller**

Write to `backend/src/modules/orders/orders.controller.ts`:

```typescript
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/orders/orders.controller.spec.ts 2>&1 | tail -10`
Expected: PASS — 2 tests passing.

---

### Task 6: Wire up OrdersModule

**Files:**
- Modify: `backend/src/modules/orders/orders.module.ts`

- [ ] **Step 1: Update the module**

Replace the entire content of `backend/src/modules/orders/orders.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { Listing } from '../listings/listing.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Listing])],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
```

Note: Registering `Listing` here allows OrdersService to inject the Listing repository without depending on ListingsModule. This does not create a duplicate entity definition — TypeORM uses one schema globally.

- [ ] **Step 2: Verify compilation**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

---

### Task 7: Full regression check

- [ ] **Step 1: Run the complete test suite**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --silent 2>&1 | tail -8`
Expected: `Tests: 124 passed` (114 existing + 10 new: 8 service + 2 controller).

Note: 5 scaffold test suites (payments, orders.controller — wait, orders is now implemented, so only 4 scaffold suites should still fail: payments, messaging, admin, certificates). That's expected — those are placeholders for unimplemented features.

- [ ] **Step 2: Verify app boots**

Run: `cd /home/mohammadibrahim/mashia/backend && timeout 10 npx ts-node -T -r tsconfig-paths/register src/main.ts 2>&1 | head -30 || true`
Expected: Output contains "Nest application successfully started" OR fails to connect to Postgres (if DB not running locally — that's fine, the module wiring compiled).

If the output shows a DI error ("Nest can't resolve dependencies"), that means the module wiring is broken — debug before proceeding.
