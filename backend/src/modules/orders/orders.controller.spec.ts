import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';

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
    passwordHash: null,
    totpSecret: null,
    totpEnabled: false,
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
      updateStatus: jest.fn(),
      findMyOrders: jest.fn(),
      findOne: jest.fn(),
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
});
