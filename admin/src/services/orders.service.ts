import { api, unwrap } from "./api";

export type OrderStatus =
  | "pending"
  | "accepted"
  | "paid"
  | "in_transit"
  | "delivered"
  | "completed"
  | "disputed"
  | "cancelled";

export type EscrowStatus = "held" | "released" | "refunded";

export type AdminOrderListItem = {
  id: string;
  buyerId: string;
  buyerName: string | null;
  sellerId: string;
  sellerName: string | null;
  listingId: string | null;
  listingTitle: string | null;
  quantity: number;
  totalPrice: number;
  currency: string;
  status: OrderStatus;
  createdAt: string;
};

export type AdminOrderList = {
  items: AdminOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type AdminOrderDetail = {
  order: {
    id: string;
    listingId: string | null;
    listing: { id: string; title: string } | null;
    buyerId: string;
    buyer: { id: string; fullName: string; phone: string } | null;
    sellerId: string;
    seller: { id: string; fullName: string; phone: string } | null;
    brokerId: string | null;
    quantity: number;
    unitPrice: number;
    currency: string;
    totalPrice: number;
    commissionRate: number;
    commissionAmount: number;
    status: OrderStatus;
    deliveryCountry: string;
    deliveryCity: string;
    deliveryAddress: string;
    createdAt: string;
    updatedAt: string;
  };
  payment: {
    id: string;
    amount: number;
    sellerAmount: number;
    commissionAmount: number;
    currency: string;
    method: string;
    escrowStatus: EscrowStatus;
    releasedAt: string | null;
    refundedAt: string | null;
    autoReleaseAt: string | null;
    createdAt: string;
  } | null;
};

export type ListQuery = {
  status?: OrderStatus[];
  page?: number;
  pageSize?: number;
};

export const ordersService = {
  async list(query: ListQuery = {}): Promise<AdminOrderList> {
    const res = await api.get("/admin/orders", { params: query });
    return unwrap<AdminOrderList>(res);
  },

  async getById(id: string): Promise<AdminOrderDetail> {
    const res = await api.get(`/admin/orders/${id}`);
    return unwrap<AdminOrderDetail>(res);
  },

  async release(id: string): Promise<AdminOrderDetail> {
    const res = await api.post(`/admin/orders/${id}/release`, {});
    return unwrap<AdminOrderDetail>(res);
  },

  async refund(id: string): Promise<AdminOrderDetail> {
    const res = await api.post(`/admin/orders/${id}/refund`, {});
    return unwrap<AdminOrderDetail>(res);
  },
};
