import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { PaymentHeldEvent } from '@shared/events/payment-held.event';
import { PaymentReleasedEvent } from '@shared/events/payment-released.event';
import { PaymentRefundedEvent } from '@shared/events/payment-refunded.event';
import { OrderStatus } from '@shared/enums';

@Injectable()
export class PaymentStatusListener {
  private readonly logger = new Logger(PaymentStatusListener.name);

  constructor(private readonly ordersService: OrdersService) {}

  @OnEvent(PaymentHeldEvent.EVENT_NAME)
  async onPaymentHeld(event: PaymentHeldEvent): Promise<void> {
    try {
      await this.ordersService.transitionFromPayment(
        event.orderId,
        OrderStatus.PAID,
      );
    } catch (err) {
      this.logger.error(
        `Failed to transition order ${event.orderId} to PAID after payment.held (paymentId=${event.paymentId})`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  @OnEvent(PaymentReleasedEvent.EVENT_NAME)
  async onPaymentReleased(event: PaymentReleasedEvent): Promise<void> {
    try {
      await this.ordersService.transitionFromPayment(
        event.orderId,
        OrderStatus.COMPLETED,
      );
    } catch (err) {
      this.logger.error(
        `Failed to transition order ${event.orderId} to COMPLETED after payment.released (paymentId=${event.paymentId})`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  @OnEvent(PaymentRefundedEvent.EVENT_NAME)
  async onPaymentRefunded(event: PaymentRefundedEvent): Promise<void> {
    try {
      await this.ordersService.transitionFromPayment(
        event.orderId,
        OrderStatus.CANCELLED,
      );
    } catch (err) {
      this.logger.error(
        `Failed to transition order ${event.orderId} to CANCELLED after payment.refunded (paymentId=${event.paymentId})`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }
}
