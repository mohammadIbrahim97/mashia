import { Injectable } from '@nestjs/common';
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
  totalRevenue: number;
  revenueMtd: number;
  revenueCurrency: Currency;
  pendingKyc: number;
  usersPendingKyc: number;
  pendingCertificates: number;
  certsPending: number;
  openDisputes: number;
  disputedOrders: number;
  flaggedListings: number;
  avgReleaseDays: number;
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
  total_revenue?: string | number | null;
  revenue_mtd?: string | number | null;
};

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
  ) {}

  async getDashboard(): Promise<AdminDashboardResponse> {
    const monthStart = this.getMonthStart();

    const [
      totalUsers,
      totalListings,
      activeListings,
      activeOrders,
      usersPendingKyc,
      certsPending,
      disputedOrders,
      flaggedListings,
      revenue,
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
      this.getRevenueAggregate(monthStart),
    ]);

    return {
      kpis: {
        totalUsers,
        totalListings,
        activeListings,
        activeOrders,
        totalRevenue: revenue.totalRevenue,
        revenueMtd: revenue.revenueMtd,
        revenueCurrency: Currency.SAR,
        pendingKyc: usersPendingKyc,
        usersPendingKyc,
        pendingCertificates: certsPending,
        certsPending,
        openDisputes: disputedOrders,
        disputedOrders,
        flaggedListings,
        avgReleaseDays: 0,
      },
      activity: [],
    };
  }

  private async getRevenueAggregate(
    monthStart: Date,
  ): Promise<{ totalRevenue: number; revenueMtd: number }> {
    const raw = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.commission_amount), 0)', 'total_revenue')
      .addSelect(
        'COALESCE(SUM(CASE WHEN payment.paid_at >= :monthStart THEN payment.commission_amount ELSE 0 END), 0)',
        'revenue_mtd',
      )
      .where('payment.escrow_status IN (:...revenueStatuses)', {
        revenueStatuses: [EscrowStatus.HELD, EscrowStatus.RELEASED],
      })
      .setParameter('monthStart', monthStart)
      .getRawOne<RevenueAggregateRaw>();

    return {
      totalRevenue: this.toNumber(raw?.total_revenue),
      revenueMtd: this.toNumber(raw?.revenue_mtd),
    };
  }

  private getMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private toNumber(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
