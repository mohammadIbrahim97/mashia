import { Currency } from '@shared/enums';

/**
 * LISTENER CONTRACT
 *
 * Any `@OnEvent` handler for this event in the codebase MUST:
 * 1. Wrap its handler body in try/catch
 * 2. Log errors via the structured logger
 * 3. NEVER throw
 *
 * Emitters use synchronous `emit()` and do NOT catch listener errors.
 */
export class PaymentHeldEvent {
  static readonly EVENT_NAME = 'payment.held';

  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly sellerId: string,
    public readonly sellerAmount: number,
    public readonly commissionAmount: number,
    public readonly currency: Currency,
  ) {}
}
