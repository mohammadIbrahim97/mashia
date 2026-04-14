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
      findOne: jest.fn(),
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
        sellerId: buyerId,
      } as Listing);

      await expect(service.create(buyerId, createDto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(orderRepo.save).not.toHaveBeenCalled();
    });
  });

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
});
