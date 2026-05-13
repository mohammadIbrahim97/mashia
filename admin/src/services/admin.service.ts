import { api, unwrap } from './api';

export type DashboardKpis = {
  totalUsers: number;
  activeListings: number;
  activeOrders: number;
  revenueMtd: number;
  revenueCurrency: string;
  usersPendingKyc: number;
  certsPending: number;
  disputedOrders: number;
  flaggedListings: number;
  avgReleaseDays: number;
};

export type DashboardActivityItem = {
  id: string;
  timestamp: string;
  tag: string;
  text: string;
  href?: '/users' | '/listings' | '/orders' | '/certificates';
  kind: 'verified' | 'pending' | 'flagged' | 'info' | 'neutral';
};

export type DashboardResponse = {
  kpis: DashboardKpis;
  activity: DashboardActivityItem[];
};

export const adminService = {
  async getDashboard(): Promise<DashboardResponse> {
    const res = await api.get('/admin/dashboard');
    return unwrap<DashboardResponse>(res);
  },

  async getRecentActivity(limit = 10): Promise<DashboardActivityItem[]> {
    const res = await api.get('/admin/dashboard/activity', { params: { limit } });
    return unwrap<DashboardActivityItem[]>(res);
  },
};
