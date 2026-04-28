import { Test } from '@nestjs/testing';
import { PaymentStatusListener } from './payment-status.listener';
import { OrdersService } from './orders.service';
import { PaymentHeldEvent } from '@shared/events/payment-held.event';
import { PaymentReleasedEvent } from '@shared/events/payment-released.event';
import { PaymentRefundedEvent } from '@shared/events/payment-refunded.event';
import { Currency, OrderStatus } from '@shared/enums';

describe('PaymentStatusListener', () => {
  let listener: PaymentStatusListener;
  let ordersService: { transitionFromPayment: jest.Mock };

  beforeEach(async () => {
    ordersService = { transitionFromPayment: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        PaymentStatusListener,
        { provide: OrdersService, useValue: ordersService },
      ],
    }).compile();
    listener = module.get(PaymentStatusListener);
  });

  it('transitions ACCEPTED → PAID on payment.held', async () => {
    const event = new PaymentHeldEvent(
      'p1', 'o1', 'buyer', 'seller', 950, 50, Currency.SAR,
    );
    await listener.onPaymentHeld(event);
    expect(ordersService.transitionFromPayment).toHaveBeenCalledWith(
      'o1',
      OrderStatus.PAID,
    );
  });

  it('transitions DELIVERED → COMPLETED on payment.released', async () => {
    const event = new PaymentReleasedEvent(
      'p1', 'o1', 'seller', 950, Currency.SAR,
    );
    await listener.onPaymentReleased(event);
    expect(ordersService.transitionFromPayment).toHaveBeenCalledWith(
      'o1',
      OrderStatus.COMPLETED,
    );
  });

  it('transitions DISPUTED → CANCELLED on payment.refunded', async () => {
    const event = new PaymentRefundedEvent(
      'p1', 'o1', 'buyer', 1000, Currency.SAR,
    );
    await listener.onPaymentRefunded(event);
    expect(ordersService.transitionFromPayment).toHaveBeenCalledWith(
      'o1',
      OrderStatus.CANCELLED,
    );
  });

  it('swallows errors thrown by ordersService (listener contract)', async () => {
    ordersService.transitionFromPayment.mockRejectedValueOnce(
      new Error('boom'),
    );
    const event = new PaymentHeldEvent(
      'p1', 'o1', 'buyer', 'seller', 950, 50, Currency.SAR,
    );
    await expect(listener.onPaymentHeld(event)).resolves.toBeUndefined();
  });
});
