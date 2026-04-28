import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Payment } from './payment.entity';
import { Order } from '../orders/order.entity';
import { EscrowService } from './escrow.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentHeldEvent } from './events/payment-held.event';
import { PaymentReleasedEvent } from './events/payment-released.event';
import { PaymentRefundedEvent } from './events/payment-refunded.event';
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

  async refund(adminId: string, paymentId: string): Promise<Payment> {
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

    this.logger.log(
      `Refunded payment ${saved.id} for order ${saved.orderId} by admin ${adminId}`,
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
    const rows = await this.paymentsRepository
      .createQueryBuilder('payment')
      .innerJoin(
        'orders',
        'order',
        'order.id = payment.order_id',
      )
      .where('payment.escrow_status = :held', { held: EscrowStatus.HELD })
      .andWhere('payment.auto_release_at IS NOT NULL')
      .andWhere('payment.auto_release_at <= NOW()')
      .andWhere('order.status = :delivered', { delivered: OrderStatus.DELIVERED })
      .select('payment.id', 'payment_id')
      .addSelect('order.seller_id', 'order_seller_id')
      .getRawMany<{ payment_id: string; order_seller_id: string }>();

    let released = 0;
    for (const row of rows) {
      try {
        const payment = await this.paymentsRepository.findOne({
          where: { id: row.payment_id },
        });
        if (!payment || payment.escrowStatus !== EscrowStatus.HELD) continue;
        await this._doRelease(payment, row.order_seller_id);
        released += 1;
      } catch (err) {
        this.logger.error(
          `Auto-release failed for payment ${row.payment_id}`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }

    if (released > 0) {
      this.logger.log(`Auto-released ${released} payment(s)`);
    }
    return released;
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
