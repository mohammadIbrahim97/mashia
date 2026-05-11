import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';
import { S3Service } from '@shared/s3/s3.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<User>>;

  const mockUser: Partial<User> = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    role: UserRole.BUYER,
    fullName: 'Ahmad Ali',
    phone: '+966501234567',
    email: null,
    country: 'SA',
    city: 'Riyadh',
    kycStatus: KycStatus.PENDING,
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
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: S3Service,
          useValue: {
            getSignedReadUrl: jest
              .fn()
              .mockResolvedValue('https://s3.example.com/signed'),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(getRepositoryToken(User));
  });

  describe('create', () => {
    it('should create and save a user', async () => {
      repository.create.mockReturnValue(mockUser as User);
      repository.save.mockResolvedValue(mockUser as User);

      const result = await service.create({
        role: UserRole.BUYER,
        fullName: 'Ahmad Ali',
        phone: '+966501234567',
        country: 'SA',
        city: 'Riyadh',
      });

      expect(repository.create).toHaveBeenCalledWith({
        role: UserRole.BUYER,
        fullName: 'Ahmad Ali',
        phone: '+966501234567',
        country: 'SA',
        city: 'Riyadh',
      });
      expect(repository.save).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockUser);
    });
  });

  describe('findByPhone', () => {
    it('should return a user when found', async () => {
      repository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.findByPhone('+966501234567');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { phone: '+966501234567' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findByPhone('+000000000000');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a user when found', async () => {
      repository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.findById('550e8400-e29b-41d4-a716-446655440000');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update fields and return updated user', async () => {
      const updatedUser = {
        ...mockUser,
        fullName: 'Ahmad Updated',
        city: 'Jeddah',
      };
      repository.update.mockResolvedValue({ affected: 1 } as any);
      repository.findOne.mockResolvedValue(updatedUser as User);

      const result = await service.updateProfile(
        '550e8400-e29b-41d4-a716-446655440000',
        { fullName: 'Ahmad Updated', city: 'Jeddah' },
      );

      expect(repository.update).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        { fullName: 'Ahmad Updated', city: 'Jeddah' },
      );
      expect(result).toEqual(updatedUser);
    });

    it('should handle empty dto as no-op and return current user', async () => {
      repository.update.mockResolvedValue({ affected: 0 } as any);
      repository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.updateProfile(
        '550e8400-e29b-41d4-a716-446655440000',
        {},
      );

      expect(repository.update).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        {},
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found after update', async () => {
      repository.update.mockResolvedValue({ affected: 1 } as any);
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('nonexistent-id', { fullName: 'Ghost' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update preferredLanguage', async () => {
      const updatedUser = {
        ...mockUser,
        preferredLanguage: PreferredLanguage.TR,
      };
      repository.update.mockResolvedValue({ affected: 1 } as any);
      repository.findOne.mockResolvedValue(updatedUser as User);

      const result = await service.updateProfile(
        '550e8400-e29b-41d4-a716-446655440000',
        { preferredLanguage: PreferredLanguage.TR },
      );

      expect(repository.update).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        { preferredLanguage: PreferredLanguage.TR },
      );
      expect(result.preferredLanguage).toBe(PreferredLanguage.TR);
    });

    it('should update email', async () => {
      const updatedUser = {
        ...mockUser,
        email: 'ahmad@example.com',
      };
      repository.update.mockResolvedValue({ affected: 1 } as any);
      repository.findOne.mockResolvedValue(updatedUser as User);

      const result = await service.updateProfile(
        '550e8400-e29b-41d4-a716-446655440000',
        { email: 'ahmad@example.com' },
      );

      expect(result.email).toBe('ahmad@example.com');
    });
  });

  describe('findForAdmin', () => {
    function makeQb(rows: Partial<User>[], total: number) {
      const qb = {
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([rows, total]),
      };
      repository.createQueryBuilder.mockReturnValue(qb as never);
      return qb;
    }

    it('returns paginated items with default page/pageSize', async () => {
      const qb = makeQb([mockUser as User], 1);

      const result = await service.findForAdmin({});

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(result.total).toBe(1);
      expect(result.items[0].id).toBe(mockUser.id);
    });

    it('filters by role and kycStatus', async () => {
      const qb = makeQb([], 0);

      await service.findForAdmin({
        role: UserRole.SELLER,
        kycStatus: KycStatus.PENDING,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('user.role = :role', {
        role: UserRole.SELLER,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'user.kycStatus = :kycStatus',
        { kycStatus: KycStatus.PENDING },
      );
    });

    it('applies free-text search across name/phone/email when q is set', async () => {
      const qb = makeQb([], 0);

      await service.findForAdmin({ q: 'Tarek' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(user.fullName ILIKE :q OR user.phone ILIKE :q OR user.email ILIKE :q)',
        { q: '%Tarek%' },
      );
    });

    it('caps pageSize at 100', async () => {
      const qb = makeQb([], 0);

      await service.findForAdmin({ pageSize: 500 });

      expect(qb.take).toHaveBeenCalledWith(100);
    });
  });

  describe('findByIdForAdmin', () => {
    it('returns user with presigned KYC doc URLs when documents exist', async () => {
      repository.findOne.mockResolvedValue({
        ...mockUser,
        kycDocuments: {
          nationalId: 'kyc/u1/national.jpg',
          selfie: 'kyc/u1/selfie.jpg',
        },
      } as User);

      const result = await service.findByIdForAdmin(mockUser.id!);

      expect(result.kycDocumentUrls).toEqual({
        nationalId: 'https://s3.example.com/signed',
        selfie: 'https://s3.example.com/signed',
      });
    });

    it('returns null kycDocumentUrls when documents are null', async () => {
      repository.findOne.mockResolvedValue({
        ...mockUser,
        kycDocuments: null,
      } as User);

      const result = await service.findByIdForAdmin(mockUser.id!);

      expect(result.kycDocumentUrls).toBeNull();
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findByIdForAdmin('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reviewKyc', () => {
    it('sets verified, records reviewer, and clears rejection reason', async () => {
      repository.findOne.mockResolvedValue({
        ...mockUser,
        kycStatus: KycStatus.PENDING,
      } as User);
      repository.save.mockImplementation(async (u) => u as User);

      const result = await service.reviewKyc(
        'admin-1',
        mockUser.id!,
        KycStatus.VERIFIED,
        undefined,
      );

      expect(result.kycStatus).toBe(KycStatus.VERIFIED);
      expect(result.kycReviewedById).toBe('admin-1');
      expect(result.kycReviewedAt).toBeInstanceOf(Date);
      expect(result.kycRejectionReason).toBeNull();
    });

    it('sets rejected and stores the reason', async () => {
      repository.findOne.mockResolvedValue({
        ...mockUser,
        kycStatus: KycStatus.PENDING,
      } as User);
      repository.save.mockImplementation(async (u) => u as User);

      const result = await service.reviewKyc(
        'admin-1',
        mockUser.id!,
        KycStatus.REJECTED,
        'illegible scan',
      );

      expect(result.kycStatus).toBe(KycStatus.REJECTED);
      expect(result.kycRejectionReason).toBe('illegible scan');
    });

    it('rejects transition to pending', async () => {
      await expect(
        service.reviewKyc('admin-1', mockUser.id!, KycStatus.PENDING, undefined),
      ).rejects.toThrow();
    });

    it('rejects rejection without a reason', async () => {
      await expect(
        service.reviewKyc('admin-1', mockUser.id!, KycStatus.REJECTED, undefined),
      ).rejects.toThrow();
    });

    it('throws when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.reviewKyc('admin-1', 'missing', KycStatus.VERIFIED, undefined),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setSuspended', () => {
    it('toggles suspended flag and saves', async () => {
      repository.findOne.mockResolvedValue({
        ...mockUser,
        suspended: false,
      } as User);
      repository.save.mockImplementation(async (u) => u as User);

      const result = await service.setSuspended(mockUser.id!, true);

      expect(result.suspended).toBe(true);
    });

    it('throws when user not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.setSuspended('missing', true)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
