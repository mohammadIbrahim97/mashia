import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificate } from './certificate.entity';
import { Listing } from '../listings/listing.entity';
import { UploadCertificateDto } from './dto/upload-certificate.dto';
import { VerifyCertificateDto } from './dto/verify-certificate.dto';
import { CertificateStatus, HealthStatus, UserRole } from '@shared/enums';

export type AdminCertificateListQuery = {
  status?: CertificateStatus | 'all';
  page?: number;
  pageSize?: number;
};

@Injectable()
export class CertificatesService {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificatesRepository: Repository<Certificate>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
  ) {}

  async create(
    sellerId: string,
    dto: UploadCertificateDto,
  ): Promise<Certificate> {
    if (new Date(dto.expiryDate) < new Date(dto.issueDate)) {
      throw new BadRequestException('expiryDate must be on or after issueDate');
    }

    let listingId: string | null = null;
    if (dto.listingId) {
      const listing = await this.listingsRepository.findOne({
        where: { id: dto.listingId },
      });
      if (!listing) {
        throw new NotFoundException('Listing not found');
      }
      if (listing.sellerId !== sellerId) {
        throw new ForbiddenException('Cannot attach certificate to another seller\'s listing');
      }
      listingId = listing.id;
    }

    const certificate = this.certificatesRepository.create({
      sellerId,
      listingId,
      type: dto.type,
      issuingAuthority: dto.issuingAuthority,
      issueDate: dto.issueDate,
      expiryDate: dto.expiryDate,
      fileUrl: dto.fileUrl,
      status: CertificateStatus.PENDING,
    });
    const saved = await this.certificatesRepository.save(certificate);

    if (listingId) {
      await this.listingsRepository.update(listingId, {
        certificateId: saved.id,
        healthStatus: HealthStatus.PENDING,
      });
    }

    return saved;
  }

  async findById(id: string, requester: { id: string; role: UserRole }): Promise<Certificate> {
    const certificate = await this.certificatesRepository.findOne({
      where: { id },
    });
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    const canAccess =
      requester.role === UserRole.ADMIN || certificate.sellerId === requester.id;

    if (!canAccess) {
      throw new ForbiddenException('Not authorized to access this certificate');
    }

    return certificate;
  }

  async findForAdmin(query: AdminCertificateListQuery): Promise<{
    items: Array<
      Pick<
        Certificate,
        | 'id'
        | 'type'
        | 'issuingAuthority'
        | 'issueDate'
        | 'expiryDate'
        | 'status'
        | 'fileUrl'
        | 'sellerId'
        | 'listingId'
        | 'createdAt'
      > & {
        sellerName: string | null;
        listingTitle: string | null;
      }
    >;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);

    const qb = this.certificatesRepository
      .createQueryBuilder('cert')
      .leftJoin('cert.seller', 'seller')
      .leftJoin('cert.listing', 'listing')
      .addSelect(['seller.fullName', 'listing.title'])
      .orderBy('cert.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.status && query.status !== 'all') {
      qb.where('cert.status = :status', { status: query.status });
    }

    const [rows, total] = await qb.getManyAndCount();

    const items = rows.map((c) => ({
      id: c.id,
      type: c.type,
      issuingAuthority: c.issuingAuthority,
      issueDate: c.issueDate,
      expiryDate: c.expiryDate,
      status: c.status,
      fileUrl: c.fileUrl,
      sellerId: c.sellerId,
      listingId: c.listingId,
      createdAt: c.createdAt,
      sellerName: c.seller?.fullName ?? null,
      listingTitle: c.listing?.title ?? null,
    }));

    return { items, total, page, pageSize };
  }

  async verify(
    adminId: string,
    id: string,
    dto: VerifyCertificateDto,
  ): Promise<Certificate> {
    if (dto.status === CertificateStatus.PENDING) {
      throw new BadRequestException('Cannot transition to pending');
    }
    if (dto.status === CertificateStatus.REJECTED && !dto.rejectionReason) {
      throw new BadRequestException('rejectionReason is required when rejecting');
    }

    const certificate = await this.certificatesRepository.findOne({ where: { id } });
    if (!certificate) {
      throw new NotFoundException('Certificate not found');
    }

    certificate.status = dto.status;
    certificate.verifiedById = adminId;
    certificate.verifiedAt = new Date();
    certificate.rejectionReason =
      dto.status === CertificateStatus.REJECTED ? dto.rejectionReason ?? null : null;
    const saved = await this.certificatesRepository.save(certificate);

    if (saved.listingId) {
      const newHealth =
        saved.status === CertificateStatus.VERIFIED
          ? HealthStatus.CERTIFIED
          : HealthStatus.UNCHECKED;
      await this.listingsRepository.update(saved.listingId, {
        healthStatus: newHealth,
      });
    }

    return saved;
  }
}
