import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
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
import { EscrowStatus, OrderStatus, UserRole } from '@shared/enums';

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
    if (payment.escrowStatus !== EscrowStatus.HELD) {
      throw new BadRequestException(
        `Payment must be HELD to release (current: ${payment.escrowStatus})`,
      );
    }
    const order = await this.ordersRepository.findOne({
      where: { id: payment.orderId },
    });
    if (!order || order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        `Order must be DELIVERED to release payment (current: ${order?.status ?? 'missing'})`,
      );
    }
    return this._doRelease(payment, order.sellerId);
  }

  async forceReleaseByAdmin(paymentId: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.escrowStatus !== EscrowStatus.HELD) {
      throw new BadRequestException(
        `Payment must be HELD to force-release (current: ${payment.escrowStatus})`,
      );
    }
    const order = await this.ordersRepository.findOne({
      where: { id: payment.orderId },
    });
    if (!order || order.status !== OrderStatus.DISPUTED) {
      throw new BadRequestException(
        `Order must be DISPUTED to force-release (current: ${order?.status ?? 'missing'})`,
      );
    }
    return this._doRelease(payment, order.sellerId);
  }

  async refund(paymentId: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.escrowStatus !== EscrowStatus.HELD) {
      throw new BadRequestException(
        `Payment must be HELD to refund (current: ${payment.escrowStatus})`,
      );
    }
    const order = await this.ordersRepository.findOne({
      where: { id: payment.orderId },
    });
    if (!order || order.status !== OrderStatus.DISPUTED) {
      throw new BadRequestException(
        `Order must be DISPUTED to refund payment (current: ${order?.status ?? 'missing'})`,
      );
    }

    await this.escrow.refundFunds(payment.transactionRef);
    payment.escrowStatus = EscrowStatus.REFUNDED;
    payment.refundedAt = new Date();
    const saved = await this.paymentsRepository.save(payment);

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
    await this.escrow.releaseFunds(payment.transactionRef);
    payment.escrowStatus = EscrowStatus.RELEASED;
    payment.releasedAt = new Date();
    const saved = await this.paymentsRepository.save(payment);

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
        const sellerId = raw[i].order_seller_id as string;
        try {
          await this.escrow.releaseFunds(payment.transactionRef);
          payment.escrowStatus = EscrowStatus.RELEASED;
          payment.releasedAt = new Date();
          await manager.save(payment);
          releasedEvents.push(
            new PaymentReleasedEvent(
              payment.id,
              payment.orderId,
              sellerId,
              Number(payment.sellerAmount),
              payment.currency,
            ),
          );
        } catch (err) {
          this.logger.error(
            `Auto-release failed for payment ${payment.id}`,
            err instanceof Error ? err.stack : undefined,
          );
        }
      }
    });

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
}
