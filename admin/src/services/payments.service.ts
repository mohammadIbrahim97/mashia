import { api, unwrap } from './api';
import type { EscrowStatus } from '@/lib/format';

export type PaymentMethod = 'stc_pay' | 'mada' | 'bank_transfer';

export type AdminPaymentListItem = {
  id: string;
  orderId: string;
  amount: number;
  commissionAmount: number;
  sellerAmount: number;
  currency: string;
  method: PaymentMethod;
  escrowStatus: EscrowStatus;
  payerId: string;
  payerName: string | null;
  sellerId: string | null;
  sellerName: string | null;
  releasedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
};

export type AdminPaymentList = {
  items: AdminPaymentListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type RevenueSummary = {
  from: string | null;
  to: string | null;
  byCurrency: Array<{
    currency: string;
    held: { count: number; commission: number };
    released: { count: number; commission: number };
    refunded: { count: number; commission: number };
  }>;
};

export type ListQuery = {
  escrowStatus?: EscrowStatus | 'all';
  method?: PaymentMethod;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export const paymentsService = {
  async list(query: ListQuery = {}): Promise<AdminPaymentList> {
    const res = await api.get('/admin/payments', { params: query });
    return unwrap<AdminPaymentList>(res);
  },

  async revenue(from?: string, to?: string): Promise<RevenueSummary> {
    const res = await api.get('/admin/revenue', {
      params: { from, to },
    });
    return unwrap<RevenueSummary>(res);
  },
};
