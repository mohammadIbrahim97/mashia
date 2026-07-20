import axios from "axios";
import { api, unwrap } from "./api";
import { usersService } from "./users.service";
import { listingsService } from "./listings.service";
import { ordersService } from "./orders.service";
import { paymentsService } from "./payments.service";

export type DashboardKpis = {
  totalUsers: number;
  totalListings?: number;
  activeListings: number;
  activeOrders: number;
  totalRevenue?: number;
  revenueMtd: number;
  revenueCurrency: string;
  revenueByCurrency?: Array<{
    currency: string;
    totalRevenue: number;
    revenueMtd: number;
  }>;
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
  href?: "/users" | "/listings" | "/orders" | "/certificates";
  kind: "verified" | "pending" | "flagged" | "info" | "neutral";
};

export type DashboardResponse = {
  kpis: DashboardKpis;
  activity: DashboardActivityItem[];
};

export const adminService = {
  async getDashboard(): Promise<DashboardResponse> {
    try {
      const res = await api.get("/admin/dashboard");
      return unwrap<DashboardResponse>(res);
    } catch (err) {
      // Backward-compatible fallback for backends that don't implement
      // GET /admin/dashboard yet.
      if (!axios.isAxiosError(err) || err.response?.status !== 404) {
        throw err;
      }

      const [
        usersAll,
        usersPending,
        listingsActive,
        listingsFlagged,
        ordersAll,
        ordersDisputed,
        revenue,
      ] = await Promise.all([
        usersService.list({ page: 1, pageSize: 1 }),
        usersService.list({ kycStatus: "pending", page: 1, pageSize: 1 }),
        listingsService.list({ status: "active", page: 1, pageSize: 1 }),
        listingsService.list({ status: "flagged", page: 1, pageSize: 1 }),
        ordersService.list({ page: 1, pageSize: 1 }),
        ordersService.list({ status: ["disputed"], page: 1, pageSize: 1 }),
        paymentsService.revenue(),
      ]);

      const sarRevenue = revenue.byCurrency.find((r) => r.currency === "SAR");
      const revenueMtd = sarRevenue
        ? sarRevenue.held.commission + sarRevenue.released.commission
        : 0;
      const revenueByCurrency = revenue.byCurrency.map((r) => ({
        currency: r.currency,
        totalRevenue: r.held.commission + r.released.commission,
        revenueMtd: r.held.commission + r.released.commission,
      }));

      return {
        kpis: {
          totalUsers: usersAll.total ?? 0,
          activeListings: listingsActive.total ?? 0,
          activeOrders: ordersAll.total ?? 0,
          totalRevenue: revenueMtd,
          revenueMtd,
          revenueCurrency: "SAR",
          revenueByCurrency,
          usersPendingKyc: usersPending.total ?? 0,
          certsPending: 0,
          disputedOrders: ordersDisputed.total ?? 0,
          flaggedListings: listingsFlagged.total ?? 0,
          avgReleaseDays: 0,
        },
        activity: [],
      };
    }
  },

  async getRecentActivity(limit = 10): Promise<DashboardActivityItem[]> {
    try {
      const res = await api.get("/admin/dashboard/activity", {
        params: { limit },
      });
      return unwrap<DashboardActivityItem[]>(res);
    } catch (err) {
      // Older backends may not implement this endpoint yet.
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return [];
      }
      throw err;
    }
  },
};
