import { Currency } from '@shared/enums';

/**
 * LISTENER CONTRACT — see payment-held.event.ts for full contract.
 * Handlers MUST try/catch, log, never throw.
 */
export class PaymentRefundedEvent {
  static readonly EVENT_NAME = 'payment.refunded';

  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly amount: number,
    public readonly currency: Currency,
  ) {}
}
