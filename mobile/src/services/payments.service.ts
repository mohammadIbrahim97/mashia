import { api, unwrap } from './api';

export type Payment = {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  method: string;
  escrowStatus: string;
  paymentRef: string | null;
  createdAt: string;
};

export type InitiatePaymentPayload = {
  orderId: string;
  method: string;
};

export const paymentsService = {
  async initiate(payload: InitiatePaymentPayload): Promise<Payment> {
    const res = await api.post('/payments/initiate', payload);
    return unwrap<Payment>(res);
  },

  async getByOrder(orderId: string): Promise<Payment> {
    const res = await api.get(`/payments/by-order/${orderId}`);
    return unwrap<Payment>(res);
  },

  async release(paymentId: string): Promise<Payment> {
    const res = await api.post(`/payments/${paymentId}/release`);
    return unwrap<Payment>(res);
  },
};
