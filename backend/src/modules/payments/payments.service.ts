import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Payment } from './payment.entity';
import { Order } from '../orders/order.entity';
import { EscrowService } from './escrow.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentHeldEvent } from '@shared/events/payment-held.event';
import { PaymentReleasedEvent } from '@shared/events/payment-released.event';
import { PaymentRefundedEvent } from '@shared/events/payment-refunded.event';
import { EscrowStatus, OrderStatus, PaymentMethod, UserRole } from '@shared/enums';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly escrow: EscrowService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
  ) {}

  async initiate(buyerId: string, dto: InitiatePaymentDto): Promise<Payment> {
    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Payment initiation is unavailable until escrow integration is configured',
      );
    }
    const order = await this.ordersRepository.findOne({
      where: { id: dto.orderId },
    });
    if (!order || order.buyerId !== buyerId) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.ACCEPTED) {
      throw new BadRequestException(
        `Order must be ACCEPTED to initiate payment (current: ${order.status})`,
      );
    }

    const amount = Number(order.totalPrice);
    const commissionAmount = Number(order.commissionAmount);
    const sellerAmount = Math.round((amount - commissionAmount) * 100) / 100;

    const { transactionRef } = await this.escrow.holdFunds(
      amount,
      order.currency,
      dto.method,
    );

    const now = new Date();
    const payment = this.paymentsRepository.create({
      orderId: order.id,
      payerId: buyerId,
      amount,
      commissionAmount,
      sellerAmount,
      currency: order.currency,
      method: dto.method,
      escrowStatus: EscrowStatus.HELD,
      transactionRef,
      autoReleaseAt: null,
      paidAt: now,
      releasedAt: null,
      refundedAt: null,
    });

    let saved: Payment;
    try {
      saved = await this.paymentsRepository.save(payment);
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('Payment already exists for this order');
      }
      throw err;
    }

    this.eventEmitter.emit(
      PaymentHeldEvent.EVENT_NAME,
      new PaymentHeldEvent(
        saved.id,
        saved.orderId,
        saved.payerId,
        order.sellerId,
        Number(saved.sellerAmount),
        Number(saved.commissionAmount),
        saved.currency,
      ),
    );

    return saved;
  }

  async release(userId: string, paymentId: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment || payment.payerId !== userId) {
      throw new NotFoundException('Payment not found');
    }
    const order = await this.assertHeldAndOrderStatus(
      payment,
      OrderStatus.DELIVERED,
      'release',
    );
    return this._doRelease(payment, order.sellerId);
  }

  async forceReleaseByOrder(orderId: string): Promise<Payment> {
    const { payment, order } = await this.loadHeldByOrder(
      orderId,
      OrderStatus.DISPUTED,
      'force-release',
    );
    return this._doRelease(payment, order.sellerId);
  }

  async refundByOrder(orderId: string): Promise<Payment> {
    const { payment } = await this.loadHeldByOrder(
      orderId,
      OrderStatus.DISPUTED,
      'refund',
    );
    return this._doRefund(payment);
  }

  async refund(paymentId: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    await this.assertHeldAndOrderStatus(
      payment,
      OrderStatus.DISPUTED,
      'refund',
    );
    return this._doRefund(payment);
  }

  private async loadHeldByOrder(
    orderId: string,
    requiredOrderStatus: OrderStatus,
    action: string,
  ): Promise<{ payment: Payment; order: Order }> {
    const payment = await this.paymentsRepository.findOne({
      where: { orderId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    const order = await this.assertHeldAndOrderStatus(
      payment,
      requiredOrderStatus,
      action,
    );
    return { payment, order };
  }

  private async assertHeldAndOrderStatus(
    payment: Payment,
    requiredOrderStatus: OrderStatus,
    action: string,
  ): Promise<Order> {
    if (payment.escrowStatus !== EscrowStatus.HELD) {
      throw new BadRequestException(
        `Payment must be HELD to ${action} (current: ${payment.escrowStatus})`,
      );
    }
    const order = await this.ordersRepository.findOne({
      where: { id: payment.orderId },
    });
    if (!order || order.status !== requiredOrderStatus) {
      throw new BadRequestException(
        `Order must be ${requiredOrderStatus} to ${action} (current: ${order?.status ?? 'missing'})`,
      );
    }
    return order;
  }

  private async claimEscrowOperation(
    paymentId: string,
    claimStatus: EscrowStatus.RELEASING | EscrowStatus.REFUNDING,
    action: string,
  ): Promise<Payment> {
    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(Payment, {
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.escrowStatus !== EscrowStatus.HELD) {
        throw new BadRequestException(
          `Payment must be HELD to ${action} (current: ${locked?.escrowStatus ?? 'missing'})`,
        );
      }

      locked.escrowStatus = claimStatus;
      return manager.save(locked);
    });
  }

  private async finalizeClaimedEscrowOperation(
    paymentId: string,
    claimStatus: EscrowStatus.RELEASING | EscrowStatus.REFUNDING,
    finalStatus: EscrowStatus.RELEASED | EscrowStatus.REFUNDED,
  ): Promise<Payment> {
    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(Payment, {
        where: { id: paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.escrowStatus !== claimStatus) {
        throw new BadRequestException(
          `Payment must be ${claimStatus} to finalize escrow operation (current: ${locked?.escrowStatus ?? 'missing'})`,
        );
      }

      locked.escrowStatus = finalStatus;
      if (finalStatus === EscrowStatus.RELEASED) {
        locked.releasedAt = new Date();
      } else {
        locked.refundedAt = new Date();
      }
      return manager.save(locked);
    });
  }

  private async _doRefund(payment: Payment): Promise<Payment> {
    const claimed = await this.claimEscrowOperation(
      payment.id,
      EscrowStatus.REFUNDING,
      'refund',
    );
    await this.escrow.refundFunds(claimed.transactionRef);
    const saved = await this.finalizeClaimedEscrowOperation(
      claimed.id,
      EscrowStatus.REFUNDING,
      EscrowStatus.REFUNDED,
    );

    this.eventEmitter.emit(
      PaymentRefundedEvent.EVENT_NAME,
      new PaymentRefundedEvent(
        saved.id,
        saved.orderId,
        saved.payerId,
        Number(saved.amount),
        saved.currency,
      ),
    );

    return saved;
  }

  private async _doRelease(
    payment: Payment,
    sellerId: string,
  ): Promise<Payment> {
    const claimed = await this.claimEscrowOperation(
      payment.id,
      EscrowStatus.RELEASING,
      'release',
    );
    await this.escrow.releaseFunds(claimed.transactionRef);
    const saved = await this.finalizeClaimedEscrowOperation(
      claimed.id,
      EscrowStatus.RELEASING,
      EscrowStatus.RELEASED,
    );

    this.eventEmitter.emit(
      PaymentReleasedEvent.EVENT_NAME,
      new PaymentReleasedEvent(
        saved.id,
        saved.orderId,
        sellerId,
        Number(saved.sellerAmount),
        saved.currency,
      ),
    );

    return saved;
  }

  @Cron('0 */15 * * * *')
  async processAutoReleases(): Promise<number> {
    const releasedEvents: PaymentReleasedEvent[] = [];
    const rows: Array<{ payment: Payment; sellerId: string }> = [];

    await this.dataSource.transaction(async (manager) => {
      const { entities, raw } = await manager
        .createQueryBuilder(Payment, 'payment')
        .innerJoin('orders', 'order', 'order.id = payment.order_id')
        .where('payment.escrow_status = :held', { held: EscrowStatus.HELD })
        .andWhere('payment.auto_release_at IS NOT NULL')
        .andWhere('payment.auto_release_at <= NOW()')
        .andWhere('order.status = :delivered', { delivered: OrderStatus.DELIVERED })
        .addSelect('order.seller_id', 'order_seller_id')
        .setLock('pessimistic_write', undefined, ['payment'])
        .setOnLocked('skip_locked')
        .getRawAndEntities();

      for (let i = 0; i < entities.length; i++) {
        const payment = entities[i];
        payment.escrowStatus = EscrowStatus.RELEASING;
        const claimed = await manager.save(payment);
        rows.push({
          payment: claimed,
          sellerId: raw[i].order_seller_id as string,
        });
      }
    });

    const promises = rows.map(async ({ payment, sellerId }) => {
      try {
        await this.escrow.releaseFunds(payment.transactionRef);
        const saved = await this.finalizeClaimedEscrowOperation(
          payment.id,
          EscrowStatus.RELEASING,
          EscrowStatus.RELEASED,
        );
        return new PaymentReleasedEvent(
          saved.id,
          saved.orderId,
          sellerId,
          Number(saved.sellerAmount),
          saved.currency,
        );
      } catch (err) {
        this.logger.error(
          `Auto-release failed for payment ${payment.id}`,
          err instanceof Error ? err.stack : undefined,
        );
        throw err; // Re-throw to be caught by allSettled
      }
    });

    const results = await Promise.allSettled(promises);
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        releasedEvents.push(result.value);
      }
    }

    for (const event of releasedEvents) {
      this.eventEmitter.emit(PaymentReleasedEvent.EVENT_NAME, event);
    }

    if (releasedEvents.length > 0) {
      this.logger.log(`Auto-released ${releasedEvents.length} payment(s)`);
    }
    return releasedEvents.length;
  }

  async findOne(
    userId: string,
    userRole: string,
    paymentId: string,
  ): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    const order = await this.ordersRepository.findOne({
      where: { id: payment.orderId },
    });
    const isPayer = payment.payerId === userId;
    const isSeller = order?.sellerId === userId;
    const isAdmin = userRole === UserRole.ADMIN;
    if (!isPayer && !isSeller && !isAdmin) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async findByOrderForAdmin(orderId: string): Promise<Payment | null> {
    return this.paymentsRepository.findOne({ where: { orderId } });
  }

  async findByOrder(userId: string, orderId: string): Promise<Payment> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    const isParty =
      order.buyerId === userId ||
      order.sellerId === userId ||
      order.brokerId === userId;
    if (!isParty) {
      throw new NotFoundException('Order not found');
    }
    const payment = await this.paymentsRepository.findOne({
      where: { orderId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found for this order');
    }
    return payment;
  }

  // ----- Admin-only views -----

  async findForAdmin(query: {
    escrowStatus?: EscrowStatus | 'all';
    method?: PaymentMethod;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: Array<{
      id: string;
      orderId: string;
      amount: number;
      commissionAmount: number;
      sellerAmount: number;
      currency: string;
      method: PaymentMethod;
      escrowStatus: EscrowStatus;
      payerId: string;
      payerName: string | null;
      sellerId: string | null;
      sellerName: string | null;
      releasedAt: Date | null;
      refundedAt: Date | null;
      createdAt: Date;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);

    const qb = this.paymentsRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.payer', 'payer')
      .leftJoinAndSelect('payment.order', 'order')
      .leftJoinAndSelect('order.seller', 'seller')
      .orderBy('payment.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.escrowStatus && query.escrowStatus !== 'all') {
      qb.andWhere('payment.escrowStatus = :escrow', {
        escrow: query.escrowStatus,
      });
    }
    if (query.method) {
      qb.andWhere('payment.method = :method', { method: query.method });
    }
    if (query.from) {
      qb.andWhere('payment.createdAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('payment.createdAt < :to', { to: query.to });
    }

    const [rows, total] = await qb.getManyAndCount();

    const items = rows.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      amount: Number(p.amount),
      commissionAmount: Number(p.commissionAmount),
      sellerAmount: Number(p.sellerAmount),
      currency: p.currency,
      method: p.method,
      escrowStatus: p.escrowStatus,
      payerId: p.payerId,
      payerName: p.payer?.fullName ?? null,
      sellerId: p.order?.sellerId ?? null,
      sellerName: p.order?.seller?.fullName ?? null,
      releasedAt: p.releasedAt,
      refundedAt: p.refundedAt,
      createdAt: p.createdAt,
    }));

    return { items, total, page, pageSize };
  }

  async getRevenueSummary(query: {
    from?: string;
    to?: string;
  }): Promise<{
    from: string | null;
    to: string | null;
    byCurrency: Array<{
      currency: string;
      held: { count: number; commission: number };
      released: { count: number; commission: number };
      refunded: { count: number; commission: number };
    }>;
  }> {
    const qb = this.paymentsRepository
      .createQueryBuilder('payment')
      .select('payment.currency', 'currency')
      .addSelect('payment.escrow_status', 'escrow_status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(payment.commission_amount)', 'commission')
      .groupBy('payment.currency')
      .addGroupBy('payment.escrow_status');

    if (query.from) qb.andWhere('payment.createdAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('payment.createdAt < :to', { to: query.to });

    const rows = (await qb.getRawMany()) as Array<{
      currency: string;
      escrow_status: EscrowStatus;
      count: string;
      commission: string | null;
    }>;

    const empty = () => ({ count: 0, commission: 0 });
    const byCurrencyMap = new Map<
      string,
      {
        currency: string;
        held: { count: number; commission: number };
        released: { count: number; commission: number };
        refunded: { count: number; commission: number };
      }
    >();
    for (const row of rows) {
      let entry = byCurrencyMap.get(row.currency);
      if (!entry) {
        entry = {
          currency: row.currency,
          held: empty(),
          released: empty(),
          refunded: empty(),
        };
        byCurrencyMap.set(row.currency, entry);
      }
      const bucket =
        row.escrow_status === EscrowStatus.RELEASED
          ? entry.released
          : row.escrow_status === EscrowStatus.REFUNDED
            ? entry.refunded
            : entry.held;
      bucket.count += Number(row.count);
      bucket.commission += Number(row.commission ?? 0);
    }

    return {
      from: query.from ?? null,
      to: query.to ?? null,
      byCurrency: [...byCurrencyMap.values()].sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
    };
  }
}
