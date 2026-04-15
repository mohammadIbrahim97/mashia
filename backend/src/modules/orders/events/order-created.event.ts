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
 * A thrown listener will crash the HTTP request that triggered the emission,
 * even though the underlying DB transaction already committed.
 *
 * If you are building a listener: your code is responsible for its own
 * retry/reconciliation. The order has already been saved; your failure
 * must not surface to the end user.
 */
export class OrderCreatedEvent {
  static readonly EVENT_NAME = 'order.created';

  constructor(
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly sellerId: string,
    public readonly totalPrice: number,
    public readonly currency: Currency,
  ) {}
}
