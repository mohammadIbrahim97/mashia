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
