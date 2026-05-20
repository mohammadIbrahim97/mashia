import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CertificatesService } from '../certificates/certificates.service';
import { UsersService } from '../users/users.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { ListingsService } from '../listings/listings.service';
import {
  CertificateStatus,
  CertificateType,
  Currency,
  KycStatus,
  ListingStatus,
  OrderStatus,
  UserRole,
} from '@shared/enums';
import { User } from '../users/user.entity';
import { Payment } from '../payments/payment.entity';
import { Listing } from '../listings/listing.entity';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: jest.Mocked<AdminService>;
  let certificatesService: jest.Mocked<CertificatesService>;
  let usersService: jest.Mocked<UsersService>;
  let ordersService: jest.Mocked<OrdersService>;
  let paymentsService: jest.Mocked<PaymentsService>;
  let listingsService: jest.Mocked<ListingsService>;

  const adminUser = { id: 'admin-1', role: UserRole.ADMIN } as User;

  beforeEach(async () => {
    adminService = {
      getDashboard: jest.fn(),
    } as unknown as jest.Mocked<AdminService>;

    certificatesService = {
      findForAdmin: jest.fn(),
    } as unknown as jest.Mocked<CertificatesService>;

    usersService = {
      findForAdmin: jest.fn(),
      findByIdForAdmin: jest.fn(),
      reviewKyc: jest.fn(),
      setSuspended: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    ordersService = {
      findForAdmin: jest.fn(),
      findOneForAdmin: jest.fn(),
    } as unknown as jest.Mocked<OrdersService>;

    paymentsService = {
      findByOrderForAdmin: jest.fn(),
      forceReleaseByOrder: jest.fn(),
      refundByOrder: jest.fn(),
      findForAdmin: jest.fn(),
      getRevenueSummary: jest.fn(),
    } as unknown as jest.Mocked<PaymentsService>;

    listingsService = {
      findForAdmin: jest.fn(),
      findByIdForAdmin: jest.fn(),
      setFlag: jest.fn(),
      removeByAdmin: jest.fn(),
    } as unknown as jest.Mocked<ListingsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: adminService },
        { provide: CertificatesService, useValue: certificatesService },
        { provide: UsersService, useValue: usersService },
        { provide: OrdersService, useValue: ordersService },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: ListingsService, useValue: listingsService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  describe('getDashboard', () => {
    it('delegates to adminService.getDashboard', async () => {
      const stub = {
        kpis: {
          totalUsers: 10,
          totalListings: 9,
          activeListings: 7,
          activeOrders: 5,
          totalRevenue: 123.45,
          revenueMtd: 67.89,
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
      };
      adminService.getDashboard.mockResolvedValue(stub);

      const result = await controller.getDashboard();

      expect(adminService.getDashboard).toHaveBeenCalledTimes(1);
      expect(result).toBe(stub);
    });
  });

  describe('listCertificates', () => {
    it('delegates to certificatesService.findForAdmin with the query', async () => {
      const stubResult = {
        items: [
          {
            id: 'cert-1',
            type: CertificateType.HEALTH,
            issuingAuthority: 'SVA',
            issueDate: '2026-01-01',
            expiryDate: '2027-01-01',
            status: CertificateStatus.PENDING,
            fileUrl: 'https://s3.example.com/c.png',
            sellerId: 'seller-1',
            listingId: 'listing-1',
            createdAt: new Date(),
            sellerName: 'Ahmad Ali',
            listingTitle: 'Awassi flock',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      certificatesService.findForAdmin.mockResolvedValue(stubResult);

      const result = await controller.listCertificates({
        status: CertificateStatus.PENDING,
        page: 1,
        pageSize: 20,
      });

      expect(certificatesService.findForAdmin).toHaveBeenCalledWith({
        status: CertificateStatus.PENDING,
        page: 1,
        pageSize: 20,
      });
      expect(result).toBe(stubResult);
    });

    it('passes through empty query for default behavior', async () => {
      certificatesService.findForAdmin.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });

      await controller.listCertificates({});

      expect(certificatesService.findForAdmin).toHaveBeenCalledWith({});
    });
  });

  describe('listUsers', () => {
    it('delegates to usersService.findForAdmin with the query', async () => {
      const stubResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      };
      usersService.findForAdmin.mockResolvedValue(stubResult);

      const result = await controller.listUsers({
        role: UserRole.SELLER,
        kycStatus: KycStatus.PENDING,
      });

      expect(usersService.findForAdmin).toHaveBeenCalledWith({
        role: UserRole.SELLER,
        kycStatus: KycStatus.PENDING,
      });
      expect(result).toBe(stubResult);
    });
  });

  describe('getUser', () => {
    it('delegates to usersService.findByIdForAdmin', async () => {
      const stub = { id: 'user-1' } as never;
      usersService.findByIdForAdmin.mockResolvedValue(stub);

      const result = await controller.getUser('user-1');

      expect(usersService.findByIdForAdmin).toHaveBeenCalledWith('user-1');
      expect(result).toBe(stub);
    });
  });

  describe('reviewKyc', () => {
    it('delegates to usersService.reviewKyc with admin.id, user.id, decision, reason', async () => {
      const stub = { id: 'user-1' } as User;
      usersService.reviewKyc.mockResolvedValue(stub);

      await controller.reviewKyc(adminUser, 'user-1', {
        decision: KycStatus.VERIFIED,
      });

      expect(usersService.reviewKyc).toHaveBeenCalledWith('admin-1', 'user-1', {
        decision: KycStatus.VERIFIED,
        rejectionReason: undefined,
      });
    });

    it('passes rejectionReason through for rejected decision', async () => {
      const stub = { id: 'user-1' } as User;
      usersService.reviewKyc.mockResolvedValue(stub);

      await controller.reviewKyc(adminUser, 'user-1', {
        decision: KycStatus.REJECTED,
        rejectionReason: 'illegible scan',
      });

      expect(usersService.reviewKyc).toHaveBeenCalledWith('admin-1', 'user-1', {
        decision: KycStatus.REJECTED,
        rejectionReason: 'illegible scan',
      });
    });
  });

  describe('suspend / unsuspend', () => {
    it('suspend sets suspended=true', async () => {
      usersService.setSuspended.mockResolvedValue({ id: 'user-1' } as User);

      await controller.suspend('user-1');

      expect(usersService.setSuspended).toHaveBeenCalledWith('user-1', true);
    });

    it('unsuspend sets suspended=false', async () => {
      usersService.setSuspended.mockResolvedValue({ id: 'user-1' } as User);

      await controller.unsuspend('user-1');

      expect(usersService.setSuspended).toHaveBeenCalledWith('user-1', false);
    });
  });

  describe('listOrders', () => {
    it('delegates to ordersService.findForAdmin with the query', async () => {
      const stubResult = {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0,
      };
      ordersService.findForAdmin.mockResolvedValue(stubResult);

      const result = await controller.listOrders({
        status: [OrderStatus.DISPUTED],
      });

      expect(ordersService.findForAdmin).toHaveBeenCalledWith({
        status: [OrderStatus.DISPUTED],
      });
      expect(result).toBe(stubResult);
    });
  });

  describe('getOrder', () => {
    it('returns order + linked payment (or null) and parallelizes both lookups', async () => {
      const order = { id: 'order-1' } as never;
      const payment = { id: 'pay-1' } as Payment;
      ordersService.findOneForAdmin.mockResolvedValue(order);
      paymentsService.findByOrderForAdmin.mockResolvedValue(payment);

      const result = await controller.getOrder('order-1');

      expect(result).toEqual({ order, payment });
    });
  });

  describe('forceRelease', () => {
    it('delegates to forceReleaseByOrder and returns refreshed order + payment', async () => {
      const order = { id: 'order-1' } as never;
      const payment = { id: 'pay-1' } as Payment;
      paymentsService.forceReleaseByOrder.mockResolvedValue(payment);
      ordersService.findOneForAdmin.mockResolvedValue(order);

      const result = await controller.forceRelease('order-1');

      expect(paymentsService.forceReleaseByOrder).toHaveBeenCalledWith(
        'order-1',
      );
      expect(result).toEqual({ order, payment });
    });
  });

  describe('refund', () => {
    it('delegates to refundByOrder and returns refreshed order + payment', async () => {
      const order = { id: 'order-1' } as never;
      const payment = { id: 'pay-1' } as Payment;
      paymentsService.refundByOrder.mockResolvedValue(payment);
      ordersService.findOneForAdmin.mockResolvedValue(order);

      const result = await controller.refund('order-1');

      expect(paymentsService.refundByOrder).toHaveBeenCalledWith('order-1');
      expect(result).toEqual({ order, payment });
    });
  });

  describe('listListings', () => {
    it('delegates to listingsService.findForAdmin with the query', async () => {
      const stub = { items: [], total: 0, page: 1, pageSize: 20 };
      listingsService.findForAdmin.mockResolvedValue(stub as never);

      const result = await controller.listListings({
        status: ListingStatus.FLAGGED,
      });

      expect(listingsService.findForAdmin).toHaveBeenCalledWith({
        status: ListingStatus.FLAGGED,
      });
      expect(result).toBe(stub);
    });
  });

  describe('getListing', () => {
    it('delegates to listingsService.findByIdForAdmin', async () => {
      const stub = { id: 'listing-1' } as Listing;
      listingsService.findByIdForAdmin.mockResolvedValue(stub);

      const result = await controller.getListing('listing-1');

      expect(listingsService.findByIdForAdmin).toHaveBeenCalledWith('listing-1');
      expect(result).toBe(stub);
    });
  });

  describe('flagListing / unflagListing', () => {
    it('flag delegates to setFlag(id, true)', async () => {
      listingsService.setFlag.mockResolvedValue({ id: 'listing-1' } as Listing);
      await controller.flagListing('listing-1');
      expect(listingsService.setFlag).toHaveBeenCalledWith('listing-1', true);
    });

    it('unflag delegates to setFlag(id, false)', async () => {
      listingsService.setFlag.mockResolvedValue({ id: 'listing-1' } as Listing);
      await controller.unflagListing('listing-1');
      expect(listingsService.setFlag).toHaveBeenCalledWith('listing-1', false);
    });
  });

  describe('removeListing', () => {
    it('delegates to listingsService.removeByAdmin', async () => {
      listingsService.removeByAdmin.mockResolvedValue({ message: 'Listing removed' });
      await controller.removeListing('listing-1');
      expect(listingsService.removeByAdmin).toHaveBeenCalledWith('listing-1');
    });
  });

  describe('listPayments', () => {
    it('delegates to paymentsService.findForAdmin with the query', async () => {
      const stub = { items: [], total: 0, page: 1, pageSize: 20 };
      paymentsService.findForAdmin.mockResolvedValue(stub as never);

      const result = await controller.listPayments({ method: undefined });

      expect(paymentsService.findForAdmin).toHaveBeenCalledWith({
        method: undefined,
      });
      expect(result).toBe(stub);
    });
  });

  describe('getRevenue', () => {
    it('delegates to paymentsService.getRevenueSummary with the query', async () => {
      const stub = { from: null, to: null, byCurrency: [] };
      paymentsService.getRevenueSummary.mockResolvedValue(stub);

      const result = await controller.getRevenue({});

      expect(paymentsService.getRevenueSummary).toHaveBeenCalledWith({});
      expect(result).toBe(stub);
    });
  });
});
