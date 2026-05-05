import { api, unwrap } from './api';

export type Order = {
  id: string;
  listingId: string | null;
  buyerId: string;
  sellerId: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  totalPrice: number;
  commissionRate: number;
  commissionAmount: number;
  status: string;
  deliveryAddress: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderParty = {
  id: string;
  fullName: string;
  phone: string;
  country: string;
  city: string;
};

export type OrderDetail = Order & {
  listing: { id: string; title: string; breed: string; images: string[] } | null;
  buyer: OrderParty;
  seller: OrderParty;
  payment: {
    id: string;
    method: string;
    escrowStatus: string;
    amount: number;
    currency: string;
  } | null;
};

export type CreateOrderPayload = {
  listingId: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  deliveryAddress: string;
  notes?: string;
};

export const ordersService = {
  async create(payload: CreateOrderPayload): Promise<Order> {
    const res = await api.post('/orders', payload);
    return unwrap<Order>(res);
  },

  async list(page = 1, limit = 20): Promise<{ data: Order[]; total: number; page: number }> {
    const res = await api.get('/orders', { params: { page, limit } });
    return unwrap(res);
  },

  async getById(id: string): Promise<OrderDetail> {
    const res = await api.get(`/orders/${id}`);
    return unwrap<OrderDetail>(res);
  },

  async updateStatus(id: string, status: string): Promise<Order> {
    const res = await api.patch(`/orders/${id}/status`, { status });
    return unwrap<Order>(res);
  },
};
