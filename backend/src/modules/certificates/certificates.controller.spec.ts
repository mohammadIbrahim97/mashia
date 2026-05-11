import { Test, TestingModule } from '@nestjs/testing';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { Certificate } from './certificate.entity';
import { User } from '../users/user.entity';
import {
  CertificateStatus,
  CertificateType,
  KycStatus,
  PreferredLanguage,
  UserRole,
} from '@shared/enums';
import { UploadCertificateDto } from './dto/upload-certificate.dto';
import { VerifyCertificateDto } from './dto/verify-certificate.dto';

describe('CertificatesController', () => {
  let controller: CertificatesController;
  let service: jest.Mocked<CertificatesService>;

  const seller: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    role: UserRole.SELLER,
    fullName: 'Ahmad Ali',
    phone: '+966501234567',
    email: null,
    country: 'SA',
    city: 'Riyadh',
    kycStatus: KycStatus.VERIFIED,
    kycDocuments: null,
    preferredLanguage: PreferredLanguage.AR,
    passwordHash: null,
    totpSecret: null,
    totpEnabled: false,
    suspended: false,
    kycRejectionReason: null,
    kycReviewedAt: null,
    kycReviewedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const admin: User = { ...seller, id: 'admin-id', role: UserRole.ADMIN } as User;

  const mockCert: Partial<Certificate> = {
    id: 'cert-1',
    sellerId: seller.id,
    listingId: null,
    type: CertificateType.HEALTH,
    issuingAuthority: 'SVA',
    issueDate: '2026-01-01',
    expiryDate: '2027-01-01',
    fileUrl: 'https://s3.example.com/c.png',
    status: CertificateStatus.PENDING,
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockCert),
      findById: jest.fn().mockResolvedValue(mockCert),
      verify: jest.fn().mockResolvedValue({
        ...mockCert,
        status: CertificateStatus.VERIFIED,
      }),
    } as unknown as jest.Mocked<CertificatesService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CertificatesController],
      providers: [{ provide: CertificatesService, useValue: service }],
    }).compile();

    controller = module.get<CertificatesController>(CertificatesController);
  });

  describe('create', () => {
    it('delegates to service.create with user.id and dto', async () => {
      const dto: UploadCertificateDto = {
        type: CertificateType.HEALTH,
        issuingAuthority: 'SVA',
        issueDate: '2026-01-01',
        expiryDate: '2027-01-01',
        fileUrl: 'https://s3.example.com/c.png',
      };

      const result = await controller.create(seller, dto);

      expect(service.create).toHaveBeenCalledWith(seller.id, dto);
      expect(result).toEqual(mockCert);
    });
  });

  describe('findOne', () => {
    it('delegates to service.findById', async () => {
      const result = await controller.findOne('cert-1');

      expect(service.findById).toHaveBeenCalledWith('cert-1');
      expect(result).toEqual(mockCert);
    });
  });

  describe('verify', () => {
    it('delegates to service.verify with admin.id, id, dto', async () => {
      const dto: VerifyCertificateDto = { status: CertificateStatus.VERIFIED };

      const result = await controller.verify(admin, 'cert-1', dto);

      expect(service.verify).toHaveBeenCalledWith(admin.id, 'cert-1', dto);
      expect(result.status).toBe(CertificateStatus.VERIFIED);
    });
  });
});
