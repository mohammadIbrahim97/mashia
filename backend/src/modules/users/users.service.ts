import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { KycStatus, UserRole } from '@shared/enums';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { S3Service } from '@shared/s3/s3.service';

const KYC_DOC_URL_TTL_SECONDS = 15 * 60;

export type AdminUsersQuery = {
  role?: UserRole;
  kycStatus?: KycStatus;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type AdminUserListItem = {
  id: string;
  role: UserRole;
  fullName: string;
  phone: string;
  email: string | null;
  country: string;
  city: string;
  kycStatus: KycStatus;
  suspended: boolean;
  createdAt: Date;
};

export type AdminUserDetail = AdminUserListItem & {
  kycDocumentUrls: Record<string, string> | null;
  kycRejectionReason: string | null;
  kycReviewedAt: Date | null;
  kycReviewedById: string | null;
  updatedAt: Date;
};

export type ReviewKycInput = {
  decision: KycStatus;
  rejectionReason?: string;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly s3Service: S3Service,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { phone } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findAdminByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email, role: UserRole.ADMIN },
    });
  }

  async updateAuthFields(
    userId: string,
    fields: Partial<
      Pick<User, 'passwordHash' | 'totpSecret' | 'totpEnabled'>
    >,
  ): Promise<void> {
    await this.usersRepository.update(userId, fields);
  }

  async updateKycDocuments(
    userId: string,
    documents: Record<string, string>,
    status: KycStatus,
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      kycDocuments: documents,
      kycStatus: status,
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
    await this.usersRepository.update(userId, dto);
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ----- Admin-only views and actions -----

  async findForAdmin(query: AdminUsersQuery): Promise<{
    items: AdminUserListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, 100);

    const qb = this.usersRepository
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }
    if (query.kycStatus) {
      qb.andWhere('user.kycStatus = :kycStatus', {
        kycStatus: query.kycStatus,
      });
    }
    if (query.q && query.q.trim()) {
      qb.andWhere(
        '(user.fullName ILIKE :q OR user.phone ILIKE :q OR user.email ILIKE :q)',
        { q: `%${query.q.trim()}%` },
      );
    }

    const [rows, total] = await qb.getManyAndCount();
    const items: AdminUserListItem[] = rows.map((u) => ({
      id: u.id,
      role: u.role,
      fullName: u.fullName,
      phone: u.phone,
      email: u.email,
      country: u.country,
      city: u.city,
      kycStatus: u.kycStatus,
      suspended: u.suspended,
      createdAt: u.createdAt,
    }));
    return { items, total, page, pageSize };
  }

  async findByIdForAdmin(id: string): Promise<AdminUserDetail> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    let kycDocumentUrls: Record<string, string> | null = null;
    if (user.kycDocuments) {
      kycDocumentUrls = {};
      const entries = Object.entries(user.kycDocuments).filter(
        ([, key]) => !!key,
      );
      const urls = await Promise.all(
        entries.map(([, key]) =>
          this.s3Service.getSignedReadUrl(key, KYC_DOC_URL_TTL_SECONDS),
        ),
      );
      entries.forEach(([docType], index) => {
        kycDocumentUrls![docType] = urls[index];
      });
    }

    return {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      country: user.country,
      city: user.city,
      kycStatus: user.kycStatus,
      suspended: user.suspended,
      kycRejectionReason: user.kycRejectionReason,
      kycReviewedAt: user.kycReviewedAt,
      kycReviewedById: user.kycReviewedById,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      kycDocumentUrls,
    };
  }

  async reviewKyc(
    adminId: string,
    userId: string,
    input: ReviewKycInput,
  ): Promise<User> {
    const { decision, rejectionReason } = input;
    if (decision === KycStatus.PENDING) {
      throw new BadRequestException('Cannot transition KYC to pending');
    }
    if (decision === KycStatus.REJECTED && !rejectionReason) {
      throw new BadRequestException(
        'rejectionReason is required when rejecting',
      );
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    user.kycStatus = decision;
    user.kycReviewedById = adminId;
    user.kycReviewedAt = new Date();
    user.kycRejectionReason =
      decision === KycStatus.REJECTED ? rejectionReason ?? null : null;
    return this.usersRepository.save(user);
  }

  async setSuspended(userId: string, suspended: boolean): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.suspended = suspended;
    return this.usersRepository.save(user);
  }
}
