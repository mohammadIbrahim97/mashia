import { Payment } from '../payment.entity';
import { Currency, EscrowStatus, PaymentMethod } from '@shared/enums';

export class PaymentResponse {
  id: string;
  orderId: string;
  payerId: string;
  amount: number;
  sellerAmount: number;
  commissionAmount: number;
  currency: Currency;
  method: PaymentMethod;
  escrowStatus: EscrowStatus;
  transactionRef: string;
  autoReleaseAt: Date | null;
  paidAt: Date;
  releasedAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;

  static fromPayment(p: Payment): PaymentResponse {
    return {
      id: p.id,
      orderId: p.orderId,
      payerId: p.payerId,
      amount: Number(p.amount),
      sellerAmount: Number(p.sellerAmount),
      commissionAmount: Number(p.commissionAmount),
      currency: p.currency,
      method: p.method,
      escrowStatus: p.escrowStatus,
      transactionRef: p.transactionRef,
      autoReleaseAt: p.autoReleaseAt,
      paidAt: p.paidAt,
      releasedAt: p.releasedAt,
      refundedAt: p.refundedAt,
      createdAt: p.createdAt,
    };
  }
}
