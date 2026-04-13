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
});
