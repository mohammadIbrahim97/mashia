import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { EscrowService } from './escrow.service';
import { Payment } from './payment.entity';
import { Order } from '../orders/order.entity';
import { PaymentHeldEvent } from './events/payment-held.event';
import {
  Currency,
  EscrowStatus,
  OrderStatus,
  PaymentMethod,
} from '@shared/enums';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentsRepo: jest.Mocked<Repository<Payment>>;
  let ordersRepo: jest.Mocked<Repository<Order>>;
  let escrow: jest.Mocked<EscrowService>;
  let emitter: { emit: jest.Mock };

  beforeEach(async () => {
    paymentsRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;
    ordersRepo = { findOne: jest.fn() } as any;
    escrow = {
      holdFunds: jest.fn(),
      releaseFunds: jest.fn(),
      refundFunds: jest.fn(),
    } as any;
    emitter = { emit: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: EscrowService, useValue: escrow },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();
    service = module.get(PaymentsService);
  });

  describe('initiate', () => {
    const buyer = 'buyer-1';
    const dto = { orderId: 'order-1', method: PaymentMethod.MADA };
    const acceptedOrder = {
      id: 'order-1',
      buyerId: buyer,
      sellerId: 'seller-1',
      totalPrice: 1000,
      commissionRate: 5,
      currency: Currency.SAR,
      status: OrderStatus.ACCEPTED,
    } as Order;

    it('holds funds, saves payment, emits PaymentHeldEvent — happy path', async () => {
      ordersRepo.findOne.mockResolvedValue(acceptedOrder);
      escrow.holdFunds.mockResolvedValue({
        transactionRef: 'STUB-abc',
        status: EscrowStatus.HELD,
      });
      paymentsRepo.save.mockImplementation(async (p) => ({
        ...p,
        id: 'pay-1',
      }) as Payment);

      const result = await service.initiate(buyer, dto);

      expect(result.escrowStatus).toBe(EscrowStatus.HELD);
      expect(result.amount).toBe(1000);
      expect(result.commissionAmount).toBe(50);
      expect(result.sellerAmount).toBe(950);
      expect(escrow.holdFunds).toHaveBeenCalledWith(
        1000,
        Currency.SAR,
        PaymentMethod.MADA,
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        PaymentHeldEvent.EVENT_NAME,
        expect.objectContaining({
          paymentId: 'pay-1',
          orderId: 'order-1',
          sellerAmount: 950,
          commissionAmount: 50,
        }),
      );
    });

    it('throws NotFoundException when order missing', async () => {
      ordersRepo.findOne.mockResolvedValue(null);
      await expect(service.initiate(buyer, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when caller is not the buyer', async () => {
      ordersRepo.findOne.mockResolvedValue({
        ...acceptedOrder,
        buyerId: 'someone-else',
      } as Order);
      await expect(service.initiate(buyer, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when order not ACCEPTED', async () => {
      ordersRepo.findOne.mockResolvedValue({
        ...acceptedOrder,
        status: OrderStatus.PENDING,
      } as Order);
      await expect(service.initiate(buyer, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException on unique order_id violation', async () => {
      ordersRepo.findOne.mockResolvedValue(acceptedOrder);
      escrow.holdFunds.mockResolvedValue({
        transactionRef: 'STUB-abc',
        status: EscrowStatus.HELD,
      });
      const dbError: any = new Error('duplicate key');
      dbError.code = '23505';
      paymentsRepo.save.mockRejectedValue(dbError);
      await expect(service.initiate(buyer, dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
