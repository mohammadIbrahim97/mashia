import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { CertificatesService } from '../certificates/certificates.service';
import { UsersService } from '../users/users.service';
import {
  CertificateStatus,
  CertificateType,
  KycStatus,
  UserRole,
} from '@shared/enums';
import { User } from '../users/user.entity';

describe('AdminController', () => {
  let controller: AdminController;
  let certificatesService: jest.Mocked<CertificatesService>;
  let usersService: jest.Mocked<UsersService>;

  const adminUser = { id: 'admin-1', role: UserRole.ADMIN } as User;

  beforeEach(async () => {
    certificatesService = {
      findForAdmin: jest.fn(),
    } as unknown as jest.Mocked<CertificatesService>;

    usersService = {
      findForAdmin: jest.fn(),
      findByIdForAdmin: jest.fn(),
      reviewKyc: jest.fn(),
      setSuspended: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: CertificatesService, useValue: certificatesService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
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

      expect(usersService.reviewKyc).toHaveBeenCalledWith(
        'admin-1',
        'user-1',
        KycStatus.VERIFIED,
        undefined,
      );
    });

    it('passes rejectionReason through for rejected decision', async () => {
      const stub = { id: 'user-1' } as User;
      usersService.reviewKyc.mockResolvedValue(stub);

      await controller.reviewKyc(adminUser, 'user-1', {
        decision: KycStatus.REJECTED,
        rejectionReason: 'illegible scan',
      });

      expect(usersService.reviewKyc).toHaveBeenCalledWith(
        'admin-1',
        'user-1',
        KycStatus.REJECTED,
        'illegible scan',
      );
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
});
