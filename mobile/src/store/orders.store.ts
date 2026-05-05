import { create } from 'zustand';
import { Order, OrderDetail, ordersService } from '../services/orders.service';

type OrdersState = {
  orders: Order[];
  ordersTotal: number;
  ordersPage: number;
  loading: boolean;
  loadOrders: (reset?: boolean) => Promise<void>;

  selected: OrderDetail | null;
  detailLoading: boolean;
  loadDetail: (id: string) => Promise<void>;

  updateStatus: (id: string, status: string) => Promise<void>;
};

export const useOrders = create<OrdersState>((set, get) => ({
  orders: [],
  ordersTotal: 0,
  ordersPage: 1,
  loading: false,

  async loadOrders(reset = false) {
    const { ordersPage, loading } = get();
    if (loading) return;
    const page = reset ? 1 : ordersPage;
    set({ loading: true });
    try {
      const result = await ordersService.list(page);
      set((s) => ({
        orders: reset ? result.data : [...s.orders, ...result.data],
        ordersTotal: result.total,
        ordersPage: page + 1,
        loading: false,
      }));
    } catch {
      set({ loading: false });
    }
  },

  selected: null,
  detailLoading: false,

  async loadDetail(id: string) {
    set({ detailLoading: true, selected: null });
    try {
      const detail = await ordersService.getById(id);
      set({ selected: detail, detailLoading: false });
    } catch {
      set({ detailLoading: false });
    }
  },

  async updateStatus(id: string, status: string) {
    const order = await ordersService.updateStatus(id, status);
    set((s) => ({
      orders: s.orders.map((o) => (o.id === id ? { ...o, status: order.status } : o)),
      selected:
        s.selected?.id === id ? { ...s.selected, status: order.status } : s.selected,
    }));
  },
}));
