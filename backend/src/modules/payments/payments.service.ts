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
import { Payment } from './payment.entity';
import { Order } from '../orders/order.entity';
import { EscrowService } from './escrow.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentHeldEvent } from './events/payment-held.event';
import { EscrowStatus, OrderStatus } from '@shared/enums';

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
    const commissionRate = Number(order.commissionRate);
    const commissionAmount = Math.round(amount * commissionRate) / 100;
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
}
