import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
  Breed,
  Currency,
  ListingStatus,
  OrderStatus,
} from '@shared/enums';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderCreatedEvent } from '@shared/events/order-created.event';
import { OrderDeliveredEvent } from '@shared/events/order-delivered.event';

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
  let eventEmitter: jest.Mocked<EventEmitter2>;

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
    const mockListingRepo = {
      findOne: jest.fn(),
    };
    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: mockOrderRepo },
        { provide: getRepositoryToken(Listing), useValue: mockListingRepo },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    orderRepo = module.get(getRepositoryToken(Order));
    listingRepo = module.get(getRepositoryToken(Listing));
    eventEmitter = module.get(EventEmitter2);
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

    it('throws NotFoundException when caller is not buyer or seller (privacy)', async () => {
      orderRepo.findOne.mockResolvedValue(
        mockOrderWithStatus(OrderStatus.PENDING) as Order,
      );

      await expect(
        service.updateStatus(orderId, otherUserId, OrderStatus.CANCELLED),
      ).rejects.toThrow(NotFoundException);
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

  describe('event emission', () => {
    it('emits OrderCreatedEvent after successful order creation', async () => {
      listingRepo.findOne.mockResolvedValue(activeListing as Listing);
      orderRepo.create.mockImplementation((data) => data as Order);
      orderRepo.save.mockImplementation(async (data) => ({
        ...(data as Order),
        id: '44444444-4444-4444-4444-444444444444',
      }));

      await service.create(buyerId, createDto);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        OrderCreatedEvent.EVENT_NAME,
        expect.objectContaining({
          orderId: '44444444-4444-4444-4444-444444444444',
          buyerId,
          sellerId,
          totalPrice: 11500,
          currency: Currency.SAR,
        }),
      );
    });

    it('does NOT emit OrderCreatedEvent when create fails (self-order forbidden)', async () => {
      listingRepo.findOne.mockResolvedValue({
        ...activeListing,
        sellerId: buyerId,
      } as Listing);

      await expect(service.create(buyerId, createDto)).rejects.toThrow();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('emits OrderDeliveredEvent when updateStatus transitions to DELIVERED (IN_TRANSIT → DELIVERED by buyer)', async () => {
      const orderId = '44444444-4444-4444-4444-444444444444';
      orderRepo.findOne.mockResolvedValue({
        id: orderId,
        buyerId,
        sellerId,
        status: OrderStatus.IN_TRANSIT,
      } as Order);
      orderRepo.save.mockImplementation(async (o) => o as Order);

      await service.updateStatus(orderId, buyerId, OrderStatus.DELIVERED);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        OrderDeliveredEvent.EVENT_NAME,
        expect.objectContaining({ orderId, buyerId, sellerId }),
      );
    });

    it('does NOT emit OrderDeliveredEvent for other successful transitions (PENDING → ACCEPTED)', async () => {
      const orderId = '44444444-4444-4444-4444-444444444444';
      orderRepo.findOne.mockResolvedValue({
        id: orderId,
        buyerId,
        sellerId,
        status: OrderStatus.PENDING,
      } as Order);
      orderRepo.save.mockImplementation(async (o) => o as Order);

      await service.updateStatus(orderId, sellerId, OrderStatus.ACCEPTED);

      const deliveredEmits = eventEmitter.emit.mock.calls.filter(
        ([name]) => name === OrderDeliveredEvent.EVENT_NAME,
      );
      expect(deliveredEmits).toHaveLength(0);
    });
  });

  describe('transitionFromPayment', () => {
    it('moves ACCEPTED → PAID when called from payments module', async () => {
      const order = {
        id: 'order-1',
        buyerId: 'b',
        sellerId: 's',
        status: OrderStatus.ACCEPTED,
      } as Order;
      orderRepo.findOne.mockResolvedValue(order);
      orderRepo.save.mockImplementation(async (o) => o as Order);

      const result = await service.transitionFromPayment(
        'order-1',
        OrderStatus.PAID,
      );

      expect(result.status).toBe(OrderStatus.PAID);
    });

    it('moves DELIVERED → COMPLETED', async () => {
      const order = {
        id: 'order-1',
        status: OrderStatus.DELIVERED,
      } as Order;
      orderRepo.findOne.mockResolvedValue(order);
      orderRepo.save.mockImplementation(async (o) => o as Order);

      const result = await service.transitionFromPayment(
        'order-1',
        OrderStatus.COMPLETED,
      );

      expect(result.status).toBe(OrderStatus.COMPLETED);
    });

    it('moves DISPUTED → CANCELLED', async () => {
      const order = {
        id: 'order-1',
        status: OrderStatus.DISPUTED,
      } as Order;
      orderRepo.findOne.mockResolvedValue(order);
      orderRepo.save.mockImplementation(async (o) => o as Order);

      const result = await service.transitionFromPayment(
        'order-1',
        OrderStatus.CANCELLED,
      );

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('throws NotFoundException when order missing', async () => {
      orderRepo.findOne.mockResolvedValue(null);
      await expect(
        service.transitionFromPayment('missing', OrderStatus.PAID),
      ).rejects.toThrow('Order not found');
    });

    it('throws BadRequestException for invalid transition', async () => {
      const order = {
        id: 'order-1',
        status: OrderStatus.PENDING,
      } as Order;
      orderRepo.findOne.mockResolvedValue(order);
      await expect(
        service.transitionFromPayment('order-1', OrderStatus.PAID),
      ).rejects.toThrow(/Invalid payment-driven transition/);
    });

    it('moves DISPUTED → COMPLETED (admin force-release in dispute)', async () => {
      const order = {
        id: 'order-1',
        status: OrderStatus.DISPUTED,
      } as Order;
      orderRepo.findOne.mockResolvedValue(order);
      orderRepo.save.mockImplementation(async (o) => o as Order);

      const result = await service.transitionFromPayment(
        'order-1',
        OrderStatus.COMPLETED,
      );

      expect(result.status).toBe(OrderStatus.COMPLETED);
    });
  });

  describe('findForAdmin', () => {
    function makeQb(rows: Partial<Order>[], total: number) {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
      };
      orderRepo.createQueryBuilder.mockReturnValue(qb as never);
      return qb;
    }

    it('returns paginated items with seller + buyer + listing flattened', async () => {
      const row = {
        id: 'order-1',
        buyerId: 'buyer-1',
        sellerId: 'seller-1',
        listingId: 'listing-1',
        quantity: 50,
        totalPrice: 12000,
        currency: 'SAR',
        status: OrderStatus.DISPUTED,
        createdAt: new Date(),
        buyer: { fullName: 'Khalid' },
        seller: { fullName: 'Tarek' },
        listing: { title: 'Awassi flock' },
      } as unknown as Order;
      makeQb([row], 1);

      const result = await service.findForAdmin({});

      expect(result.items[0]).toMatchObject({
        id: 'order-1',
        buyerName: 'Khalid',
        sellerName: 'Tarek',
        listingTitle: 'Awassi flock',
      });
      expect(result.totalPages).toBe(1);
    });

    it('filters by status array', async () => {
      const qb = makeQb([], 0);

      await service.findForAdmin({ status: [OrderStatus.DISPUTED] });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'order.status IN (:...statuses)',
        { statuses: [OrderStatus.DISPUTED] },
      );
    });

    it('caps pageSize at 100', async () => {
      const qb = makeQb([], 0);

      await service.findForAdmin({ pageSize: 500 });

      expect(qb.take).toHaveBeenCalledWith(100);
    });
  });

  describe('findOneForAdmin', () => {
    it('returns order without party-membership check', async () => {
      const order = { id: 'order-1' } as Order;
      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.findOneForAdmin('order-1');

      expect(result).toBe(order);
    });

    it('throws NotFoundException when missing', async () => {
      orderRepo.findOne.mockResolvedValue(null);
      await expect(service.findOneForAdmin('missing')).rejects.toThrow(
        'Order not found',
      );
    });
  });
});
