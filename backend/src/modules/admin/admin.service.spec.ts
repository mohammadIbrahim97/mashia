import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminService } from './admin.service';
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

type RevenueAggregateRaw = {
  currency?: Currency | null;
  total_revenue?: string | number | null;
  revenue_mtd?: string | number | null;
};

describe('AdminService', () => {
  let service: AdminService;
  let usersRepository: jest.Mocked<Repository<User>>;
  let listingsRepository: jest.Mocked<Repository<Listing>>;
  let ordersRepository: jest.Mocked<Repository<Order>>;
  let paymentsRepository: jest.Mocked<Repository<Payment>>;
  let certificatesRepository: jest.Mocked<Repository<Certificate>>;
  let configService: { get: jest.Mock };

  const createRepositoryMock = () => ({
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  const createRevenueQueryBuilder = (raw: RevenueAggregateRaw[]) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(raw),
  });

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-31T23:30:00.000Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useValue: createRepositoryMock() },
        {
          provide: getRepositoryToken(Listing),
          useValue: createRepositoryMock(),
        },
        { provide: getRepositoryToken(Order), useValue: createRepositoryMock() },
        {
          provide: getRepositoryToken(Payment),
          useValue: createRepositoryMock(),
        },
        {
          provide: getRepositoryToken(Certificate),
          useValue: createRepositoryMock(),
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    usersRepository = module.get(getRepositoryToken(User));
    listingsRepository = module.get(getRepositoryToken(Listing));
    ordersRepository = module.get(getRepositoryToken(Order));
    paymentsRepository = module.get(getRepositoryToken(Payment));
    certificatesRepository = module.get(getRepositoryToken(Certificate));
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getDashboard', () => {
    it('returns dashboard KPIs from repository counts and revenue aggregates', async () => {
      const revenueQb = createRevenueQueryBuilder([
        {
          currency: Currency.SAR,
          total_revenue: '1234.56',
          revenue_mtd: '789.01',
        },
        {
          currency: Currency.USD,
          total_revenue: '999.99',
          revenue_mtd: '88.88',
        },
      ]);
      usersRepository.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2);
      listingsRepository.count
        .mockResolvedValueOnce(9)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(4);
      ordersRepository.count.mockResolvedValueOnce(5).mockResolvedValueOnce(1);
      certificatesRepository.count.mockResolvedValueOnce(3);
      paymentsRepository.createQueryBuilder.mockReturnValue(revenueQb as never);

      const result = await service.getDashboard();

      expect(usersRepository.count.mock.calls[0]).toEqual([]);
      expect(usersRepository.count).toHaveBeenNthCalledWith(2, {
        where: { kycStatus: KycStatus.PENDING },
      });
      expect(listingsRepository.count.mock.calls[0]).toEqual([]);
      expect(listingsRepository.count).toHaveBeenNthCalledWith(2, {
        where: { status: ListingStatus.ACTIVE },
      });
      expect(listingsRepository.count).toHaveBeenNthCalledWith(3, {
        where: { status: ListingStatus.FLAGGED },
      });
      expect(ordersRepository.count.mock.calls[0][0]).toEqual({
        where: { status: expect.any(Object) },
      });
      expect(ordersRepository.count).toHaveBeenNthCalledWith(2, {
        where: { status: OrderStatus.DISPUTED },
      });
      expect(certificatesRepository.count).toHaveBeenCalledWith({
        where: { status: CertificateStatus.PENDING },
      });

      expect(revenueQb.select).toHaveBeenCalledWith(
        'payment.currency',
        'currency',
      );
      expect(revenueQb.addSelect).toHaveBeenCalledWith(
        'COALESCE(SUM(payment.commission_amount), 0)',
        'total_revenue',
      );
      expect(revenueQb.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('payment.paid_at >= :monthStart'),
        'revenue_mtd',
      );
      expect(revenueQb.where).toHaveBeenCalledWith(
        'payment.escrow_status IN (:...revenueStatuses)',
        {
          revenueStatuses: [
            EscrowStatus.HELD,
            EscrowStatus.RELEASING,
            EscrowStatus.RELEASED,
            EscrowStatus.REFUNDING,
          ],
        },
      );
      expect(revenueQb.groupBy).toHaveBeenCalledWith('payment.currency');
      expect(revenueQb.setParameter).toHaveBeenCalledWith(
        'monthStart',
        new Date('2026-05-01T00:00:00.000Z'),
      );

      expect(result).toEqual({
        kpis: {
          totalUsers: 10,
          totalListings: 9,
          activeListings: 7,
          activeOrders: 5,
          totalRevenue: 1234.56,
          revenueMtd: 789.01,
          revenueCurrency: Currency.SAR,
          revenueByCurrency: [
            {
              currency: Currency.SAR,
              totalRevenue: 1234.56,
              revenueMtd: 789.01,
            },
            {
              currency: Currency.USD,
              totalRevenue: 999.99,
              revenueMtd: 88.88,
            },
          ],
          pendingKyc: 2,
          usersPendingKyc: 2,
          pendingCertificates: 3,
          certsPending: 3,
          openDisputes: 1,
          disputedOrders: 1,
          flaggedListings: 4,
          avgReleaseDays: 0,
        },
        activity: [],
      });
    });

    it('uses configured admin dashboard revenue currency when valid', async () => {
      configService.get.mockReturnValue(Currency.USD);
      usersRepository.count.mockResolvedValue(0);
      listingsRepository.count.mockResolvedValue(0);
      ordersRepository.count.mockResolvedValue(0);
      certificatesRepository.count.mockResolvedValue(0);
      paymentsRepository.createQueryBuilder.mockReturnValue(
        createRevenueQueryBuilder([
          {
            currency: Currency.USD,
            total_revenue: '45',
            revenue_mtd: '12',
          },
        ]) as never,
      );

      const result = await service.getDashboard();

      expect(result.kpis.revenueCurrency).toBe(Currency.USD);
      expect(result.kpis.totalRevenue).toBe(45);
      expect(result.kpis.revenueMtd).toBe(12);
    });

    it('normalizes missing revenue aggregate values to zero', async () => {
      usersRepository.count.mockResolvedValue(0);
      listingsRepository.count.mockResolvedValue(0);
      ordersRepository.count.mockResolvedValue(0);
      certificatesRepository.count.mockResolvedValue(0);
      paymentsRepository.createQueryBuilder.mockReturnValue(
        createRevenueQueryBuilder([]) as never,
      );

      const result = await service.getDashboard();

      expect(result.kpis.totalRevenue).toBe(0);
      expect(result.kpis.revenueMtd).toBe(0);
      expect(result.kpis.revenueByCurrency).toEqual([]);
    });
  });
});
