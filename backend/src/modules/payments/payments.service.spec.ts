import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, Repository } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { EscrowService } from './escrow.service';
import { Payment } from './payment.entity';
import { Order } from '../orders/order.entity';
import { PaymentHeldEvent } from '@shared/events/payment-held.event';
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
  let txManager: { createQueryBuilder: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock };

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
    txManager = {
      createQueryBuilder: jest.fn(),
      save: jest.fn(async (p) => p),
    };
    dataSource = {
      transaction: jest.fn(async (cb: (m: typeof txManager) => unknown) =>
        cb(txManager),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: paymentsRepo },
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: EscrowService, useValue: escrow },
        { provide: EventEmitter2, useValue: emitter },
        { provide: DataSource, useValue: dataSource },
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
      commissionAmount: 50,
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

  describe('release', () => {
    const payerId = 'buyer-1';
    const paymentId = 'pay-1';

    const heldPayment = {
      id: paymentId,
      orderId: 'order-1',
      payerId,
      sellerAmount: 950,
      commissionAmount: 50,
      currency: Currency.SAR,
      escrowStatus: EscrowStatus.HELD,
      transactionRef: 'STUB-xyz',
      releasedAt: null,
    } as Payment;

    const deliveredOrder = {
      id: 'order-1',
      buyerId: payerId,
      sellerId: 'seller-1',
      status: OrderStatus.DELIVERED,
    } as Order;

    it('releases funds, updates payment RELEASED, emits PaymentReleasedEvent', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue(deliveredOrder);
      escrow.releaseFunds.mockResolvedValue({
        transactionRef: 'STUB-xyz',
        status: EscrowStatus.RELEASED,
      });
      paymentsRepo.save.mockImplementation(async (p) => p as Payment);

      const result = await service.release(payerId, paymentId);

      expect(result.escrowStatus).toBe(EscrowStatus.RELEASED);
      expect(result.releasedAt).toBeInstanceOf(Date);
      expect(emitter.emit).toHaveBeenCalledWith(
        'payment.released',
        expect.objectContaining({ paymentId, orderId: 'order-1' }),
      );
    });

    it('throws NotFoundException when caller is not the payer', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue(deliveredOrder);
      await expect(
        service.release('other-user', paymentId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when payment is not HELD', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...heldPayment,
        escrowStatus: EscrowStatus.RELEASED,
      });
      ordersRepo.findOne.mockResolvedValue(deliveredOrder);
      await expect(service.release(payerId, paymentId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when order is not DELIVERED', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue({
        ...deliveredOrder,
        status: OrderStatus.PAID,
      });
      await expect(service.release(payerId, paymentId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('refund', () => {
    const paymentId = 'pay-1';

    const heldPayment = {
      id: paymentId,
      orderId: 'order-1',
      payerId: 'buyer-1',
      amount: 1000,
      currency: Currency.SAR,
      escrowStatus: EscrowStatus.HELD,
      transactionRef: 'STUB-xyz',
      refundedAt: null,
    } as Payment;

    const disputedOrder = {
      id: 'order-1',
      buyerId: 'buyer-1',
      status: OrderStatus.DISPUTED,
    } as Order;

    it('refunds, updates payment REFUNDED, emits PaymentRefundedEvent', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue(disputedOrder);
      escrow.refundFunds.mockResolvedValue({
        transactionRef: 'STUB-xyz',
        status: EscrowStatus.REFUNDED,
      });
      paymentsRepo.save.mockImplementation(async (p) => p as Payment);

      const result = await service.refund(paymentId);

      expect(result.escrowStatus).toBe(EscrowStatus.REFUNDED);
      expect(result.refundedAt).toBeInstanceOf(Date);
      expect(emitter.emit).toHaveBeenCalledWith(
        'payment.refunded',
        expect.objectContaining({ paymentId, orderId: 'order-1' }),
      );
    });

    it('throws NotFoundException when payment missing', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);
      await expect(service.refund(paymentId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when payment not HELD', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...heldPayment,
        escrowStatus: EscrowStatus.RELEASED,
      });
      ordersRepo.findOne.mockResolvedValue(disputedOrder);
      await expect(service.refund(paymentId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when order not DISPUTED', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue({
        ...disputedOrder,
        status: OrderStatus.PAID,
      });
      await expect(service.refund(paymentId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('forceReleaseByAdmin', () => {
    const paymentId = 'pay-1';
    const heldPayment = {
      id: paymentId,
      orderId: 'order-1',
      payerId: 'buyer-1',
      amount: 1000,
      sellerAmount: 950,
      currency: Currency.SAR,
      escrowStatus: EscrowStatus.HELD,
      transactionRef: 'STUB-xyz',
      releasedAt: null,
    } as Payment;
    const disputedOrder = {
      id: 'order-1',
      sellerId: 'seller-1',
      status: OrderStatus.DISPUTED,
    } as Order;

    it('releases to seller and emits PaymentReleasedEvent when order is DISPUTED', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue(disputedOrder);
      escrow.releaseFunds.mockResolvedValue({
        transactionRef: 'STUB-xyz',
        status: EscrowStatus.RELEASED,
      });
      paymentsRepo.save.mockImplementation(async (p) => p as Payment);

      const result = await service.forceReleaseByAdmin(paymentId);

      expect(result.escrowStatus).toBe(EscrowStatus.RELEASED);
      expect(result.releasedAt).toBeInstanceOf(Date);
      expect(emitter.emit).toHaveBeenCalledWith(
        'payment.released',
        expect.objectContaining({
          paymentId,
          orderId: 'order-1',
          sellerId: 'seller-1',
        }),
      );
    });

    it('throws NotFoundException when payment missing', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);
      await expect(service.forceReleaseByAdmin(paymentId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when payment not HELD', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...heldPayment,
        escrowStatus: EscrowStatus.RELEASED,
      });
      await expect(service.forceReleaseByAdmin(paymentId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when order is not DISPUTED', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue({
        ...disputedOrder,
        status: OrderStatus.PAID,
      });
      await expect(service.forceReleaseByAdmin(paymentId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findByOrderForAdmin', () => {
    it('returns the payment when found', async () => {
      const stub = { id: 'pay-1' } as Payment;
      paymentsRepo.findOne.mockResolvedValue(stub);

      const result = await service.findByOrderForAdmin('order-1');

      expect(paymentsRepo.findOne).toHaveBeenCalledWith({
        where: { orderId: 'order-1' },
      });
      expect(result).toBe(stub);
    });

    it('returns null when no payment exists for the order', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);

      const result = await service.findByOrderForAdmin('order-1');

      expect(result).toBeNull();
    });
  });

  describe('processAutoReleases', () => {
    it('releases eligible HELD payments joined to DELIVERED orders', async () => {
      const pastDate = new Date(Date.now() - 86400 * 1000);
      const eligible = {
        id: 'pay-1',
        orderId: 'order-1',
        payerId: 'buyer-1',
        sellerAmount: 950,
        currency: Currency.SAR,
        escrowStatus: EscrowStatus.HELD,
        transactionRef: 'STUB-1',
        autoReleaseAt: pastDate,
      } as Payment;

      const qb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        setOnLocked: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [{ ...eligible }],
          raw: [{ order_seller_id: 'seller-1' }],
        }),
      };
      txManager.createQueryBuilder.mockReturnValue(qb);
      escrow.releaseFunds.mockResolvedValue({
        transactionRef: 'STUB-1',
        status: EscrowStatus.RELEASED,
      });

      const count = await service.processAutoReleases();

      expect(count).toBe(1);
      expect(qb.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
        undefined,
        ['payment'],
      );
      expect(qb.setOnLocked).toHaveBeenCalledWith('skip_locked');
      expect(escrow.releaseFunds).toHaveBeenCalledWith('STUB-1');
      expect(txManager.save).toHaveBeenCalled();
      expect(emitter.emit).toHaveBeenCalledWith(
        'payment.released',
        expect.objectContaining({ paymentId: 'pay-1' }),
      );
    });
  });
});
