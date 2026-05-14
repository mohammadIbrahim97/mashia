import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { Certificate } from './certificate.entity';
import { Listing } from '../listings/listing.entity';
import {
  CertificateStatus,
  CertificateType,
  HealthStatus,
  UserRole,
} from '@shared/enums';
import { UploadCertificateDto } from './dto/upload-certificate.dto';

describe('CertificatesService', () => {
  let service: CertificatesService;
  let certificates: jest.Mocked<Repository<Certificate>>;
  let listings: jest.Mocked<Repository<Listing>>;

  const sellerId = '550e8400-e29b-41d4-a716-446655440000';
  const adminId = '660e8400-e29b-41d4-a716-446655440000';
  const listingId = '770e8400-e29b-41d4-a716-446655440000';

  const baseDto: UploadCertificateDto = {
    type: CertificateType.HEALTH,
    issuingAuthority: 'Saudi Veterinary Authority',
    issueDate: '2026-01-01',
    expiryDate: '2027-01-01',
    fileUrl: 'https://s3.example.com/certificates/abc.png',
  };

  beforeEach(async () => {
    const certRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const listingRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CertificatesService,
        { provide: getRepositoryToken(Certificate), useValue: certRepo },
        { provide: getRepositoryToken(Listing), useValue: listingRepo },
      ],
    }).compile();

    service = module.get<CertificatesService>(CertificatesService);
    certificates = module.get(getRepositoryToken(Certificate));
    listings = module.get(getRepositoryToken(Listing));
  });

  describe('create', () => {
    it('saves certificate with status=pending and no listing link when listingId omitted', async () => {
      const stub = { id: 'cert-1', sellerId, listingId: null } as Certificate;
      certificates.create.mockReturnValue(stub);
      certificates.save.mockResolvedValue(stub);

      const result = await service.create(sellerId, baseDto);

      expect(certificates.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sellerId,
          listingId: null,
          status: CertificateStatus.PENDING,
        }),
      );
      expect(result).toBe(stub);
      expect(listings.update).not.toHaveBeenCalled();
    });

    it('links to listing and sets healthStatus=pending when listingId provided and seller owns it', async () => {
      const dto = { ...baseDto, listingId };
      const stub = { id: 'cert-1', sellerId, listingId } as Certificate;
      listings.findOne.mockResolvedValue({ id: listingId, sellerId } as Listing);
      certificates.create.mockReturnValue(stub);
      certificates.save.mockResolvedValue(stub);

      await service.create(sellerId, dto);

      expect(listings.update).toHaveBeenCalledWith(listingId, {
        certificateId: 'cert-1',
        healthStatus: HealthStatus.PENDING,
      });
    });

    it('throws ForbiddenException when seller does not own the listing', async () => {
      listings.findOne.mockResolvedValue({
        id: listingId,
        sellerId: 'other-seller',
      } as Listing);

      await expect(
        service.create(sellerId, { ...baseDto, listingId }),
      ).rejects.toThrow(ForbiddenException);
      expect(certificates.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when listing does not exist', async () => {
      listings.findOne.mockResolvedValue(null);

      await expect(
        service.create(sellerId, { ...baseDto, listingId }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when expiryDate < issueDate', async () => {
      await expect(
        service.create(sellerId, {
          ...baseDto,
          issueDate: '2027-01-01',
          expiryDate: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('returns certificate when found', async () => {
      const stub = { id: 'cert-1', sellerId } as Certificate;
      certificates.findOne.mockResolvedValue(stub);

      const result = await service.findById('cert-1', { id: sellerId, role: UserRole.SELLER });

      expect(result).toBe(stub);
    });

    it('throws NotFoundException when not found', async () => {
      certificates.findOne.mockResolvedValue(null);

      await expect(service.findById('missing', { id: sellerId, role: UserRole.SELLER })).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when requester is not admin or owner', async () => {
      certificates.findOne.mockResolvedValue({ id: 'cert-1', sellerId } as Certificate);

      await expect(
        service.findById('cert-1', { id: 'other', role: UserRole.BUYER }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('verify', () => {
    it('sets status=verified and listing.healthStatus=certified when linked', async () => {
      const cert = {
        id: 'cert-1',
        listingId,
        status: CertificateStatus.PENDING,
      } as Certificate;
      certificates.findOne.mockResolvedValue(cert);
      certificates.save.mockImplementation(async (c) => c as Certificate);

      const result = await service.verify(adminId, 'cert-1', {
        status: CertificateStatus.VERIFIED,
      });

      expect(result.status).toBe(CertificateStatus.VERIFIED);
      expect(result.verifiedById).toBe(adminId);
      expect(result.verifiedAt).toBeInstanceOf(Date);
      expect(listings.update).toHaveBeenCalledWith(listingId, {
        healthStatus: HealthStatus.CERTIFIED,
      });
    });

    it('sets status=rejected with reason and reverts listing healthStatus', async () => {
      const cert = {
        id: 'cert-1',
        listingId,
        status: CertificateStatus.PENDING,
      } as Certificate;
      certificates.findOne.mockResolvedValue(cert);
      certificates.save.mockImplementation(async (c) => c as Certificate);

      const result = await service.verify(adminId, 'cert-1', {
        status: CertificateStatus.REJECTED,
        rejectionReason: 'illegible scan',
      });

      expect(result.status).toBe(CertificateStatus.REJECTED);
      expect(result.rejectionReason).toBe('illegible scan');
      expect(listings.update).toHaveBeenCalledWith(listingId, {
        healthStatus: HealthStatus.UNCHECKED,
      });
    });

    it('does not touch listing when certificate is not linked', async () => {
      certificates.findOne.mockResolvedValue({
        id: 'cert-1',
        listingId: null,
        status: CertificateStatus.PENDING,
      } as Certificate);
      certificates.save.mockImplementation(async (c) => c as Certificate);

      await service.verify(adminId, 'cert-1', {
        status: CertificateStatus.VERIFIED,
      });

      expect(listings.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when transitioning to pending', async () => {
      await expect(
        service.verify(adminId, 'cert-1', { status: CertificateStatus.PENDING }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when rejecting without reason', async () => {
      await expect(
        service.verify(adminId, 'cert-1', { status: CertificateStatus.REJECTED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when certificate is missing', async () => {
      certificates.findOne.mockResolvedValue(null);

      await expect(
        service.verify(adminId, 'missing', { status: CertificateStatus.VERIFIED }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findForAdmin', () => {
    function makeQb(rows: Certificate[], total: number) {
      const qb = {
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
      };
      certificates.createQueryBuilder.mockReturnValue(qb as never);
      return qb;
    }

    it('returns paginated items with seller + listing info flattened', async () => {
      const row = {
        id: 'cert-1',
        type: CertificateType.HEALTH,
        issuingAuthority: 'SVA',
        issueDate: '2026-01-01',
        expiryDate: '2027-01-01',
        status: CertificateStatus.PENDING,
        fileUrl: 'https://s3.example.com/c.png',
        sellerId,
        listingId,
        createdAt: new Date('2026-04-01'),
        seller: { fullName: 'Ahmad Ali' },
        listing: { title: 'Awassi flock' },
      } as unknown as Certificate;
      makeQb([row], 1);

      const result = await service.findForAdmin({});

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.items[0]).toMatchObject({
        id: 'cert-1',
        sellerName: 'Ahmad Ali',
        listingTitle: 'Awassi flock',
      });
    });

    it('filters by status when provided (and not "all")', async () => {
      const qb = makeQb([], 0);

      await service.findForAdmin({ status: CertificateStatus.PENDING });

      expect(qb.where).toHaveBeenCalledWith('cert.status = :status', {
        status: CertificateStatus.PENDING,
      });
    });

    it('does not filter when status is "all"', async () => {
      const qb = makeQb([], 0);

      await service.findForAdmin({ status: 'all' });

      expect(qb.where).not.toHaveBeenCalled();
    });

    it('caps pageSize at 100', async () => {
      const qb = makeQb([], 0);

      await service.findForAdmin({ page: 1, pageSize: 500 });

      expect(qb.take).toHaveBeenCalledWith(100);
    });

    it('handles missing seller/listing relations as null', async () => {
      const row = {
        id: 'cert-1',
        type: CertificateType.HEALTH,
        issuingAuthority: 'SVA',
        issueDate: '2026-01-01',
        expiryDate: '2027-01-01',
        status: CertificateStatus.PENDING,
        fileUrl: 'https://s3.example.com/c.png',
        sellerId,
        listingId: null,
        createdAt: new Date(),
        seller: null,
        listing: null,
      } as unknown as Certificate;
      makeQb([row], 1);

      const result = await service.findForAdmin({});

      expect(result.items[0].sellerName).toBeNull();
      expect(result.items[0].listingTitle).toBeNull();
    });
  });
});
