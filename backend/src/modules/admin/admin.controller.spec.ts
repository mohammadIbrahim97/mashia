import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { CertificatesService } from '../certificates/certificates.service';
import { CertificateStatus, CertificateType } from '@shared/enums';

describe('AdminController', () => {
  let controller: AdminController;
  let certificatesService: jest.Mocked<CertificatesService>;

  beforeEach(async () => {
    certificatesService = {
      findForAdmin: jest.fn(),
    } as unknown as jest.Mocked<CertificatesService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: CertificatesService, useValue: certificatesService },
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
});
