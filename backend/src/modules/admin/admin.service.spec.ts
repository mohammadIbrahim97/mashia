import { Test, TestingModule } from '@nestjs/testing';
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

  const createRepositoryMock = () => ({
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  const createRevenueQueryBuilder = (raw: RevenueAggregateRaw | null) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(raw),
  });

  beforeEach(async () => {
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
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    usersRepository = module.get(getRepositoryToken(User));
    listingsRepository = module.get(getRepositoryToken(Listing));
    ordersRepository = module.get(getRepositoryToken(Order));
    paymentsRepository = module.get(getRepositoryToken(Payment));
    certificatesRepository = module.get(getRepositoryToken(Certificate));
  });

  describe('getDashboard', () => {
    it('returns dashboard KPIs from repository counts and revenue aggregates', async () => {
      const revenueQb = createRevenueQueryBuilder({
        total_revenue: '1234.56',
        revenue_mtd: '789.01',
      });
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
        'COALESCE(SUM(payment.commission_amount), 0)',
        'total_revenue',
      );
      expect(revenueQb.addSelect).toHaveBeenCalledWith(
        expect.stringContaining('payment.paid_at >= :monthStart'),
        'revenue_mtd',
      );
      expect(revenueQb.where).toHaveBeenCalledWith(
        'payment.escrow_status IN (:...revenueStatuses)',
        { revenueStatuses: [EscrowStatus.HELD, EscrowStatus.RELEASED] },
      );
      expect(revenueQb.setParameter).toHaveBeenCalledWith(
        'monthStart',
        expect.any(Date),
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

    it('normalizes missing revenue aggregate values to zero', async () => {
      usersRepository.count.mockResolvedValue(0);
      listingsRepository.count.mockResolvedValue(0);
      ordersRepository.count.mockResolvedValue(0);
      certificatesRepository.count.mockResolvedValue(0);
      paymentsRepository.createQueryBuilder.mockReturnValue(
        createRevenueQueryBuilder(null) as never,
      );

      const result = await service.getDashboard();

      expect(result.kpis.totalRevenue).toBe(0);
      expect(result.kpis.revenueMtd).toBe(0);
    });
  });
});
