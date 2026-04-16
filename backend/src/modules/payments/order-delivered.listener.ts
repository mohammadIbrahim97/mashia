import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './payment.entity';
import { OrderDeliveredEvent } from '../orders/events/order-delivered.event';
import { EscrowStatus } from '@shared/enums';

const AUTO_RELEASE_DAYS = 7;

@Injectable()
export class OrderDeliveredListener {
  private readonly logger = new Logger(OrderDeliveredListener.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
  ) {}

  @OnEvent(OrderDeliveredEvent.EVENT_NAME)
  async onOrderDelivered(event: OrderDeliveredEvent): Promise<void> {
    try {
      const payment = await this.paymentsRepository.findOne({
        where: { orderId: event.orderId, escrowStatus: EscrowStatus.HELD },
      });
      if (!payment) {
        this.logger.warn(
          `order.delivered for ${event.orderId} but no HELD payment found`,
        );
        return;
      }
      const autoReleaseAt = new Date();
      autoReleaseAt.setDate(autoReleaseAt.getDate() + AUTO_RELEASE_DAYS);
      payment.autoReleaseAt = autoReleaseAt;
      await this.paymentsRepository.save(payment);
    } catch (err) {
      this.logger.error(
        `Failed to set autoReleaseAt for order ${event.orderId}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }
}
