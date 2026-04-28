import { Currency } from '@shared/enums';

/**
 * LISTENER CONTRACT — see payment-held.event.ts for full contract.
 * Handlers MUST try/catch, log, never throw.
 */
export class PaymentReleasedEvent {
  static readonly EVENT_NAME = 'payment.released';

  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly sellerId: string,
    public readonly sellerAmount: number,
    public readonly currency: Currency,
  ) {}
}
