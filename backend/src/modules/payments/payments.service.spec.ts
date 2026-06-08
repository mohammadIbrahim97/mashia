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
  let txManager: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };
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
    let txPayment: Payment | null = null;
    txManager = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(async (_entity, options) => {
        if (txPayment) return { ...txPayment };
        const payment = await paymentsRepo.findOne(options);
        return payment ? { ...payment } : payment;
      }),
      save: jest.fn(async (p) => {
        txPayment = { ...p };
        return { ...p };
      }),
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


    it('throws ServiceUnavailableException in production mode', async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        await expect(service.initiate(buyer, dto)).rejects.toThrow(
          'Payment initiation is unavailable until escrow integration is configured',
        );
      } finally {
        if (prev === undefined) {
          delete process.env.NODE_ENV;
        } else {
          process.env.NODE_ENV = prev;
        }
      }
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
      const result = await service.release(payerId, paymentId);

      expect(result.escrowStatus).toBe(EscrowStatus.RELEASED);
      expect(result.releasedAt).toBeInstanceOf(Date);
      expect(txManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ escrowStatus: EscrowStatus.RELEASING }),
      );
      expect(txManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ escrowStatus: EscrowStatus.RELEASED }),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        'payment.released',
        expect.objectContaining({ paymentId, orderId: 'order-1' }),
      );
    });

    it('does not call escrow again after release succeeds but final save fails', async () => {
      const held = { ...heldPayment };
      const releasing = { ...heldPayment, escrowStatus: EscrowStatus.RELEASING };
      paymentsRepo.findOne
        .mockResolvedValueOnce(held)
        .mockResolvedValueOnce(releasing);
      ordersRepo.findOne.mockResolvedValue(deliveredOrder);
      escrow.releaseFunds.mockResolvedValue({
        transactionRef: 'STUB-xyz',
        status: EscrowStatus.RELEASED,
      });
      txManager.findOne
        .mockResolvedValueOnce(held)
        .mockResolvedValueOnce(releasing);
      txManager.save
        .mockResolvedValueOnce(releasing)
        .mockRejectedValueOnce(new Error('database commit failed'));

      await expect(service.release(payerId, paymentId)).rejects.toThrow(
        'database commit failed',
      );
      await expect(service.release(payerId, paymentId)).rejects.toThrow(
        BadRequestException,
      );

      expect(escrow.releaseFunds).toHaveBeenCalledTimes(1);
      expect(emitter.emit).not.toHaveBeenCalledWith(
        'payment.released',
        expect.anything(),
      );
    });

    it('rolls release claims back to HELD when the provider fails', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue(deliveredOrder);
      escrow.releaseFunds.mockRejectedValue(new Error('provider unavailable'));

      await expect(service.release(payerId, paymentId)).rejects.toThrow(
        'provider unavailable',
      );

      expect(txManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ escrowStatus: EscrowStatus.RELEASING }),
      );
      expect(txManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ escrowStatus: EscrowStatus.HELD }),
      );
      expect(escrow.releaseFunds).toHaveBeenCalledTimes(1);
      expect(emitter.emit).not.toHaveBeenCalledWith(
        'payment.released',
        expect.anything(),
      );
    });

    it('retries a stale release claim instead of leaving it stuck', async () => {
      const staleReleasing = {
        ...heldPayment,
        escrowStatus: EscrowStatus.RELEASING,
        updatedAt: new Date(Date.now() - 16 * 60 * 1000),
      };
      paymentsRepo.findOne.mockResolvedValue(staleReleasing);
      ordersRepo.findOne.mockResolvedValue(deliveredOrder);
      escrow.releaseFunds.mockResolvedValue({
        transactionRef: 'STUB-xyz',
        status: EscrowStatus.RELEASED,
      });

      const result = await service.release(payerId, paymentId);

      expect(result.escrowStatus).toBe(EscrowStatus.RELEASED);
      expect(escrow.releaseFunds).toHaveBeenCalledWith('STUB-xyz');
      expect(txManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ escrowStatus: EscrowStatus.RELEASED }),
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
      const result = await service.refund(paymentId);

      expect(result.escrowStatus).toBe(EscrowStatus.REFUNDED);
      expect(result.refundedAt).toBeInstanceOf(Date);
      expect(txManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ escrowStatus: EscrowStatus.REFUNDING }),
      );
      expect(txManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ escrowStatus: EscrowStatus.REFUNDED }),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        'payment.refunded',
        expect.objectContaining({ paymentId, orderId: 'order-1' }),
      );
    });

    it('does not call escrow again after refund succeeds but final save fails', async () => {
      const held = { ...heldPayment };
      const refunding = { ...heldPayment, escrowStatus: EscrowStatus.REFUNDING };
      paymentsRepo.findOne
        .mockResolvedValueOnce(held)
        .mockResolvedValueOnce(refunding);
      ordersRepo.findOne.mockResolvedValue(disputedOrder);
      escrow.refundFunds.mockResolvedValue({
        transactionRef: 'STUB-xyz',
        status: EscrowStatus.REFUNDED,
      });
      txManager.findOne
        .mockResolvedValueOnce(held)
        .mockResolvedValueOnce(refunding);
      txManager.save
        .mockResolvedValueOnce(refunding)
        .mockRejectedValueOnce(new Error('database commit failed'));

      await expect(service.refund(paymentId)).rejects.toThrow(
        'database commit failed',
      );
      await expect(service.refund(paymentId)).rejects.toThrow(
        BadRequestException,
      );

      expect(escrow.refundFunds).toHaveBeenCalledTimes(1);
      expect(emitter.emit).not.toHaveBeenCalledWith(
        'payment.refunded',
        expect.anything(),
      );
    });

    it('rolls refund claims back to HELD when the provider fails', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue(disputedOrder);
      escrow.refundFunds.mockRejectedValue(new Error('provider unavailable'));

      await expect(service.refund(paymentId)).rejects.toThrow(
        'provider unavailable',
      );

      expect(txManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ escrowStatus: EscrowStatus.REFUNDING }),
      );
      expect(txManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ escrowStatus: EscrowStatus.HELD }),
      );
      expect(escrow.refundFunds).toHaveBeenCalledTimes(1);
      expect(emitter.emit).not.toHaveBeenCalledWith(
        'payment.refunded',
        expect.anything(),
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

  describe('forceReleaseByOrder', () => {
    const orderId = 'order-1';
    const heldPayment = {
      id: 'pay-1',
      orderId,
      payerId: 'buyer-1',
      amount: 1000,
      sellerAmount: 950,
      currency: Currency.SAR,
      escrowStatus: EscrowStatus.HELD,
      transactionRef: 'STUB-xyz',
      releasedAt: null,
    } as Payment;
    const disputedOrder = {
      id: orderId,
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
      const result = await service.forceReleaseByOrder(orderId);

      expect(paymentsRepo.findOne).toHaveBeenCalledWith({ where: { orderId } });
      expect(result.escrowStatus).toBe(EscrowStatus.RELEASED);
      expect(result.releasedAt).toBeInstanceOf(Date);
      expect(emitter.emit).toHaveBeenCalledWith(
        'payment.released',
        expect.objectContaining({
          paymentId: 'pay-1',
          orderId,
          sellerId: 'seller-1',
        }),
      );
    });

    it('throws NotFoundException when no payment for the order', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);
      await expect(service.forceReleaseByOrder(orderId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when payment not HELD', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...heldPayment,
        escrowStatus: EscrowStatus.RELEASED,
      });
      await expect(service.forceReleaseByOrder(orderId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when order is not DISPUTED', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue({
        ...disputedOrder,
        status: OrderStatus.PAID,
      });
      await expect(service.forceReleaseByOrder(orderId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('refundByOrder', () => {
    const orderId = 'order-1';
    const heldPayment = {
      id: 'pay-1',
      orderId,
      payerId: 'buyer-1',
      amount: 1000,
      currency: Currency.SAR,
      escrowStatus: EscrowStatus.HELD,
      transactionRef: 'STUB-xyz',
      refundedAt: null,
    } as Payment;
    const disputedOrder = {
      id: orderId,
      sellerId: 'seller-1',
      status: OrderStatus.DISPUTED,
    } as Order;

    it('refunds buyer and emits PaymentRefundedEvent', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...heldPayment });
      ordersRepo.findOne.mockResolvedValue(disputedOrder);
      escrow.refundFunds.mockResolvedValue({
        transactionRef: 'STUB-xyz',
        status: EscrowStatus.REFUNDED,
      });
      const result = await service.refundByOrder(orderId);

      expect(result.escrowStatus).toBe(EscrowStatus.REFUNDED);
      expect(emitter.emit).toHaveBeenCalledWith(
        'payment.refunded',
        expect.objectContaining({ paymentId: 'pay-1', orderId }),
      );
    });

    it('throws NotFoundException when no payment for the order', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);
      await expect(service.refundByOrder(orderId)).rejects.toThrow(
        NotFoundException,
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
      txManager.findOne.mockResolvedValue({
        ...eligible,
        escrowStatus: EscrowStatus.RELEASING,
      });

      const count = await service.processAutoReleases();

      expect(count).toBe(1);
      expect(qb.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
        undefined,
        ['payment'],
      );
      expect(qb.setOnLocked).toHaveBeenCalledWith('skip_locked');
      expect(qb.where).toHaveBeenCalledWith(
        `(payment.escrow_status = :held OR (payment.escrow_status = :releasing AND payment.updated_at < NOW() - INTERVAL '15 minutes'))`,
        { held: EscrowStatus.HELD, releasing: EscrowStatus.RELEASING },
      );
      expect(txManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ escrowStatus: EscrowStatus.RELEASING }),
      );
      expect(escrow.releaseFunds).toHaveBeenCalledWith('STUB-1');
      expect(txManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ escrowStatus: EscrowStatus.RELEASED }),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        'payment.released',
        expect.objectContaining({ paymentId: 'pay-1' }),
      );
    });

    it('rolls auto-release claims back to HELD when the provider fails', async () => {
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
      escrow.releaseFunds.mockRejectedValue(new Error('provider unavailable'));

      const count = await service.processAutoReleases();

      expect(count).toBe(0);
      expect(txManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ escrowStatus: EscrowStatus.RELEASING }),
      );
      expect(txManager.save).toHaveBeenCalledWith(
        expect.objectContaining({ escrowStatus: EscrowStatus.HELD }),
      );
      expect(emitter.emit).not.toHaveBeenCalledWith(
        'payment.released',
        expect.anything(),
      );
    });
  });

  describe('findForAdmin', () => {
    function makeQb(rows: Partial<Payment>[], total: number) {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
      };
      paymentsRepo.createQueryBuilder.mockReturnValue(qb as never);
      return qb;
    }

    it('returns paginated items with payer + seller flattened', async () => {
      const row = {
        id: 'pay-1',
        orderId: 'order-1',
        amount: 1000,
        commissionAmount: 50,
        sellerAmount: 950,
        currency: Currency.SAR,
        escrowStatus: EscrowStatus.HELD,
        payerId: 'buyer-1',
        payer: { fullName: 'Khalid' },
        order: { sellerId: 'seller-1', seller: { fullName: 'Tarek' } },
        releasedAt: null,
        refundedAt: null,
        createdAt: new Date(),
      } as unknown as Payment;
      makeQb([row], 1);

      const result = await service.findForAdmin({});

      expect(result.items[0]).toMatchObject({
        id: 'pay-1',
        payerName: 'Khalid',
        sellerName: 'Tarek',
        sellerId: 'seller-1',
      });
      expect(result.total).toBe(1);
    });

    it('filters by escrowStatus, method, and date range', async () => {
      const qb = makeQb([], 0);
      await service.findForAdmin({
        escrowStatus: EscrowStatus.HELD,
        from: '2026-01-01',
        to: '2026-02-01',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'payment.escrowStatus = :escrow',
        { escrow: EscrowStatus.HELD },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('payment.createdAt >= :from', {
        from: '2026-01-01',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('payment.createdAt < :to', {
        to: '2026-02-01',
      });
    });

    it('skips escrow filter when "all"', async () => {
      const qb = makeQb([], 0);
      await service.findForAdmin({ escrowStatus: 'all' });
      expect(qb.andWhere).not.toHaveBeenCalledWith(
        'payment.escrowStatus = :escrow',
        expect.anything(),
      );
    });

    it('caps pageSize at 100', async () => {
      const qb = makeQb([], 0);
      await service.findForAdmin({ pageSize: 500 });
      expect(qb.take).toHaveBeenCalledWith(100);
    });
  });

  describe('getRevenueSummary', () => {
    function makeRawQb(
      rows: Array<{
        currency: string;
        escrow_status: EscrowStatus;
        count: string;
        commission: string | null;
      }>,
    ) {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rows),
      };
      paymentsRepo.createQueryBuilder.mockReturnValue(qb as never);
      return qb;
    }

    it('aggregates commission by currency × escrow status', async () => {
      makeRawQb([
        {
          currency: 'SAR',
          escrow_status: EscrowStatus.HELD,
          count: '12',
          commission: '6420',
        },
        {
          currency: 'SAR',
          escrow_status: EscrowStatus.RELEASED,
          count: '8',
          commission: '3200',
        },
        {
          currency: 'SAR',
          escrow_status: EscrowStatus.REFUNDED,
          count: '2',
          commission: '700',
        },
        {
          currency: 'AED',
          escrow_status: EscrowStatus.HELD,
          count: '3',
          commission: '900',
        },
      ]);

      const result = await service.getRevenueSummary({});

      expect(result.byCurrency).toHaveLength(2);
      const sar = result.byCurrency.find((c) => c.currency === 'SAR')!;
      expect(sar.held).toEqual({ count: 12, commission: 6420 });
      expect(sar.released).toEqual({ count: 8, commission: 3200 });
      expect(sar.refunded).toEqual({ count: 2, commission: 700 });
      const aed = result.byCurrency.find((c) => c.currency === 'AED')!;
      expect(aed.held).toEqual({ count: 3, commission: 900 });
    });

    it('counts in-progress escrow operation states as held in summaries', async () => {
      makeRawQb([
        {
          currency: 'SAR',
          escrow_status: EscrowStatus.RELEASING,
          count: '1',
          commission: '100',
        },
        {
          currency: 'SAR',
          escrow_status: EscrowStatus.REFUNDING,
          count: '2',
          commission: '200',
        },
      ]);

      const result = await service.getRevenueSummary({});

      expect(result.byCurrency[0].held).toEqual({ count: 3, commission: 300 });
      expect(result.byCurrency[0].released).toEqual({ count: 0, commission: 0 });
      expect(result.byCurrency[0].refunded).toEqual({ count: 0, commission: 0 });
    });

    it('treats null commission sum as 0', async () => {
      makeRawQb([
        {
          currency: 'SAR',
          escrow_status: EscrowStatus.HELD,
          count: '0',
          commission: null,
        },
      ]);

      const result = await service.getRevenueSummary({});

      expect(result.byCurrency[0].held).toEqual({ count: 0, commission: 0 });
    });

    it('applies date range filters when provided', async () => {
      const qb = makeRawQb([]);
      await service.getRevenueSummary({
        from: '2026-01-01',
        to: '2026-02-01',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('payment.createdAt >= :from', {
        from: '2026-01-01',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('payment.createdAt < :to', {
        to: '2026-02-01',
      });
    });
  });
});
