import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Certificate } from '../certificates/certificate.entity';
import { Listing } from '../listings/listing.entity';
import { Order } from '../orders/order.entity';
import { Payment } from '../payments/payment.entity';
import { User } from '../users/user.entity';
import {
  CertificateStatus,
  Currency,
  EscrowStatus,
  KycStatus,
  ListingStatus,
  OrderStatus,
} from '@shared/enums';

export type AdminDashboardKpis = {
  totalUsers: number;
  totalListings: number;
  activeListings: number;
  activeOrders: number;
  /**
   * Display-currency total for revenueCurrency only. Do not use this as a
   * cross-currency financial total; use revenueByCurrency for reporting.
   */
  totalRevenue: number;
  /**
   * Display-currency month-to-date total for revenueCurrency only.
   */
  revenueMtd: number;
  /**
   * Currency used for headline dashboard revenue KPIs.
   */
  revenueCurrency: Currency;
  /**
   * Canonical multi-currency revenue totals, grouped by payment currency.
   */
  revenueByCurrency: AdminDashboardRevenueByCurrency[];
  pendingKyc: number;
  usersPendingKyc: number;
  pendingCertificates: number;
  certsPending: number;
  openDisputes: number;
  disputedOrders: number;
  flaggedListings: number;
  avgReleaseDays: number;
};

export type AdminDashboardRevenueByCurrency = {
  currency: Currency;
  totalRevenue: number;
  revenueMtd: number;
};

export type AdminDashboardActivityItem = {
  id: string;
  timestamp: string;
  tag: string;
  text: string;
  href?: '/users' | '/listings' | '/orders' | '/certificates';
  kind: 'verified' | 'pending' | 'flagged' | 'info' | 'neutral';
};

export type AdminDashboardResponse = {
  kpis: AdminDashboardKpis;
  activity: AdminDashboardActivityItem[];
};

type RevenueAggregateRaw = {
  currency?: Currency | null;
  total_revenue?: string | number | null;
  revenue_mtd?: string | number | null;
};

const DEFAULT_PRIMARY_ADMIN_REVENUE_CURRENCY = Currency.SAR;

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(Certificate)
    private readonly certificatesRepository: Repository<Certificate>,
    private readonly configService: ConfigService,
  ) {}

  async getDashboard(): Promise<AdminDashboardResponse> {
    const monthStart = this.getUtcMonthStart();
    const revenueCurrency = this.getPrimaryRevenueCurrency();

    const [counts, revenue] = await Promise.all([
      this.getDashboardCounts(),
      this.getRevenueByCurrency(monthStart),
    ]);

    const displayRevenue = this.getCurrencyRevenue(revenue, revenueCurrency);

    return {
      kpis: {
        totalUsers: counts.totalUsers,
        totalListings: counts.totalListings,
        activeListings: counts.activeListings,
        activeOrders: counts.activeOrders,
        totalRevenue: displayRevenue.totalRevenue,
        revenueMtd: displayRevenue.revenueMtd,
        revenueCurrency,
        revenueByCurrency: revenue,
        // Legacy aliases kept for backward compatibility with existing clients.
        pendingKyc: counts.usersPendingKyc,
        usersPendingKyc: counts.usersPendingKyc,
        pendingCertificates: counts.certsPending,
        certsPending: counts.certsPending,
        openDisputes: counts.disputedOrders,
        disputedOrders: counts.disputedOrders,
        flaggedListings: counts.flaggedListings,
        avgReleaseDays: 0,
      },
      activity: [],
    };
  }

  private async getDashboardCounts() {
    const [
      totalUsers,
      totalListings,
      activeListings,
      activeOrders,
      usersPendingKyc,
      certsPending,
      disputedOrders,
      flaggedListings,
    ] = await Promise.all([
      this.usersRepository.count(),
      this.listingsRepository.count(),
      this.listingsRepository.count({
        where: { status: ListingStatus.ACTIVE },
      }),
      this.ordersRepository.count({
        where: {
          status: Not(In([OrderStatus.COMPLETED, OrderStatus.CANCELLED])),
        },
      }),
      this.usersRepository.count({
        where: { kycStatus: KycStatus.PENDING },
      }),
      this.certificatesRepository.count({
        where: { status: CertificateStatus.PENDING },
      }),
      this.ordersRepository.count({
        where: { status: OrderStatus.DISPUTED },
      }),
      this.listingsRepository.count({
        where: { status: ListingStatus.FLAGGED },
      }),
    ]);

    return {
      totalUsers,
      totalListings,
      activeListings,
      activeOrders,
      usersPendingKyc,
      certsPending,
      disputedOrders,
      flaggedListings,
    };
  }

  private async getRevenueByCurrency(
    monthStart: Date,
  ): Promise<AdminDashboardRevenueByCurrency[]> {
    const rows = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select('payment.currency', 'currency')
      .addSelect('COALESCE(SUM(payment.commission_amount), 0)', 'total_revenue')
      .addSelect(
        'COALESCE(SUM(CASE WHEN payment.paid_at >= :monthStart THEN payment.commission_amount ELSE 0 END), 0)',
        'revenue_mtd',
      )
      .where('payment.escrow_status IN (:...revenueStatuses)', {
        revenueStatuses: [
          EscrowStatus.HELD,
          EscrowStatus.RELEASING,
          EscrowStatus.RELEASED,
          EscrowStatus.REFUNDING,
        ],
      })
      .groupBy('payment.currency')
      .setParameter('monthStart', monthStart)
      .getRawMany<RevenueAggregateRaw>();

    return rows
      .map((row) => ({
        currency: row.currency,
        totalRevenue: this.toNumber(row.total_revenue),
        revenueMtd: this.toNumber(row.revenue_mtd),
      }))
      .filter(
        (
          row,
        ): row is AdminDashboardRevenueByCurrency =>
          row.currency !== null && row.currency !== undefined,
      )
      .sort((a, b) => a.currency.localeCompare(b.currency));
  }

  private getCurrencyRevenue(
    revenue: AdminDashboardRevenueByCurrency[],
    currency: Currency,
  ): AdminDashboardRevenueByCurrency {
    const match = revenue.find((item) => item.currency === currency);
    if (match) return match;
    return {
      currency,
      totalRevenue: 0,
      revenueMtd: 0,
    };
  }

  private getUtcMonthStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  private getPrimaryRevenueCurrency(): Currency {
    const configured = this.configService.get<string>(
      'ADMIN_DASHBOARD_REVENUE_CURRENCY',
    );
    const currencies = Object.values(Currency) as string[];
    if (configured && currencies.includes(configured)) {
      return configured as Currency;
    }
    return DEFAULT_PRIMARY_ADMIN_REVENUE_CURRENCY;
  }

  private toNumber(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
