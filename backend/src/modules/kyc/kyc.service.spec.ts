import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { KycService, SubmittedKycFiles } from './kyc.service';
import { UsersService } from '../users/users.service';
import { S3Service } from '@shared/s3/s3.service';
import { User } from '../users/user.entity';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';

describe('KycService', () => {
  let service: KycService;
  let usersService: jest.Mocked<UsersService>;
  let s3Service: jest.Mocked<S3Service>;

  const makeUser = (overrides: Partial<User> = {}): User =>
    ({
      id: '550e8400-e29b-41d4-a716-446655440000',
      role: UserRole.BUYER,
      fullName: 'Test User',
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
      createdAt: new Date('2026-04-11T10:00:00.000Z'),
      updatedAt: new Date('2026-04-11T10:00:00.000Z'),
      ...overrides,
    }) as User;

  const makeFile = (name = 'fake-bytes') => ({
    buffer: Buffer.from(name),
    mimeType: 'image/jpeg',
  });

  beforeEach(async () => {
    usersService = {
      updateKycDocuments: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    s3Service = {
      upload: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<S3Service>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: UsersService, useValue: usersService },
        { provide: S3Service, useValue: s3Service },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
  });

  describe('submit — seller/broker', () => {
    it('uploads nationalId + selfie + businessLicense and returns pending status', async () => {
      const user = makeUser({ role: UserRole.SELLER });
      const files: SubmittedKycFiles = {
        nationalId: makeFile('id'),
        selfie: makeFile('selfie'),
        businessLicense: makeFile('license'),
      };

      const result = await service.submit(user, files);

      expect(s3Service.upload).toHaveBeenCalledTimes(3);
      expect(usersService.updateKycDocuments).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          nationalId: expect.stringContaining(`kyc/${user.id}/nationalId-`),
          selfie: expect.stringContaining(`kyc/${user.id}/selfie-`),
          businessLicense: expect.stringContaining(`kyc/${user.id}/businessLicense-`),
        }),
        KycStatus.PENDING,
      );
      expect(result).toMatchObject({
        kycStatus: KycStatus.PENDING,
        submitted: true,
        documents: { nationalId: true, selfie: true, businessLicense: true },
      });
    });

    it('uploads nationalId + selfie only when businessLicense is absent', async () => {
      const user = makeUser({ role: UserRole.SELLER });
      const files: SubmittedKycFiles = {
        nationalId: makeFile(),
        selfie: makeFile(),
      };

      const result = await service.submit(user, files);

      expect(s3Service.upload).toHaveBeenCalledTimes(2);
      expect(result.documents).toEqual({
        nationalId: true,
        selfie: true,
        businessLicense: false,
      });
    });

    it('throws BadRequestException when seller is missing selfie', async () => {
      const user = makeUser({ role: UserRole.SELLER });
      const files: SubmittedKycFiles = { nationalId: makeFile() };

      await expect(service.submit(user, files)).rejects.toThrow(BadRequestException);
      expect(s3Service.upload).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when seller is missing nationalId', async () => {
      const user = makeUser({ role: UserRole.SELLER });
      const files: SubmittedKycFiles = { selfie: makeFile() };

      await expect(service.submit(user, files)).rejects.toThrow(BadRequestException);
      expect(s3Service.upload).not.toHaveBeenCalled();
    });

    it('applies the same rules for brokers as sellers', async () => {
      const user = makeUser({ role: UserRole.BROKER });
      const files: SubmittedKycFiles = { nationalId: makeFile() };

      await expect(service.submit(user, files)).rejects.toThrow(BadRequestException);
    });
  });

  describe('submit — buyer', () => {
    it('uploads nationalId only', async () => {
      const user = makeUser({ role: UserRole.BUYER });
      const files: SubmittedKycFiles = { nationalId: makeFile() };

      const result = await service.submit(user, files);

      expect(s3Service.upload).toHaveBeenCalledTimes(1);
      expect(result.documents).toEqual({
        nationalId: true,
        selfie: false,
        businessLicense: false,
      });
    });

    it('throws BadRequestException when buyer uploads a selfie', async () => {
      const user = makeUser({ role: UserRole.BUYER });
      const files: SubmittedKycFiles = {
        nationalId: makeFile(),
        selfie: makeFile(),
      };

      await expect(service.submit(user, files)).rejects.toThrow(BadRequestException);
      expect(s3Service.upload).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when buyer uploads a businessLicense', async () => {
      const user = makeUser({ role: UserRole.BUYER });
      const files: SubmittedKycFiles = {
        nationalId: makeFile(),
        businessLicense: makeFile(),
      };

      await expect(service.submit(user, files)).rejects.toThrow(BadRequestException);
    });
  });

  describe('submit — resubmission and state', () => {
    it('throws ConflictException when the user is already VERIFIED', async () => {
      const user = makeUser({
        role: UserRole.SELLER,
        kycStatus: KycStatus.VERIFIED,
        kycDocuments: { nationalId: 'old', selfie: 'old' },
      });
      const files: SubmittedKycFiles = {
        nationalId: makeFile(),
        selfie: makeFile(),
      };

      await expect(service.submit(user, files)).rejects.toThrow(ConflictException);
    });

    it('deletes old S3 keys and saves new ones when a REJECTED user resubmits', async () => {
      const user = makeUser({
        role: UserRole.SELLER,
        kycStatus: KycStatus.REJECTED,
        kycDocuments: {
          nationalId: 'kyc/550e/nationalId-old.jpg',
          selfie: 'kyc/550e/selfie-old.jpg',
        },
      });
      const files: SubmittedKycFiles = {
        nationalId: makeFile(),
        selfie: makeFile(),
      };

      await service.submit(user, files);

      expect(s3Service.delete).toHaveBeenCalledWith('kyc/550e/nationalId-old.jpg');
      expect(s3Service.delete).toHaveBeenCalledWith('kyc/550e/selfie-old.jpg');
      expect(s3Service.upload).toHaveBeenCalledTimes(2);
      expect(usersService.updateKycDocuments).toHaveBeenCalledWith(
        user.id,
        expect.any(Object),
        KycStatus.PENDING,
      );
    });

    it('rolls back uploaded files and does not update user when an upload fails mid-way', async () => {
      const user = makeUser({ role: UserRole.SELLER });
      const files: SubmittedKycFiles = {
        nationalId: makeFile('id'),
        selfie: makeFile('selfie'),
      };
      s3Service.upload
        .mockResolvedValueOnce(undefined) // nationalId succeeds
        .mockRejectedValueOnce(new Error('s3 down')); // selfie fails

      await expect(service.submit(user, files)).rejects.toThrow('s3 down');

      // The one file that succeeded should be deleted as rollback
      expect(s3Service.delete).toHaveBeenCalledTimes(1);
      expect(usersService.updateKycDocuments).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('returns pending state for a PENDING user with no documents', () => {
      const user = makeUser({
        kycStatus: KycStatus.PENDING,
        kycDocuments: null,
      });

      const result = service.getStatus(user);

      expect(result).toEqual({
        kycStatus: KycStatus.PENDING,
        submitted: false,
        documents: { nationalId: false, selfie: false, businessLicense: false },
        submittedAt: null,
      });
    });

    it('returns pending-with-docs for a submitted PENDING user', () => {
      const updatedAt = new Date('2026-04-11T14:30:00.000Z');
      const user = makeUser({
        role: UserRole.SELLER,
        kycStatus: KycStatus.PENDING,
        kycDocuments: {
          nationalId: 'kyc/550e/nationalId-abc.jpg',
          selfie: 'kyc/550e/selfie-def.jpg',
        },
        updatedAt,
      });

      const result = service.getStatus(user);

      expect(result).toEqual({
        kycStatus: KycStatus.PENDING,
        submitted: true,
        documents: { nationalId: true, selfie: true, businessLicense: false },
        submittedAt: updatedAt,
      });
    });

    it('returns verified state with all document flags set', () => {
      const user = makeUser({
        role: UserRole.SELLER,
        kycStatus: KycStatus.VERIFIED,
        kycDocuments: {
          nationalId: 'k1',
          selfie: 'k2',
          businessLicense: 'k3',
        },
      });

      const result = service.getStatus(user);

      expect(result.kycStatus).toBe(KycStatus.VERIFIED);
      expect(result.submitted).toBe(true);
      expect(result.documents).toEqual({
        nationalId: true,
        selfie: true,
        businessLicense: true,
      });
    });

    it('returns rejected state with submitted=true', () => {
      const user = makeUser({
        role: UserRole.SELLER,
        kycStatus: KycStatus.REJECTED,
        kycDocuments: { nationalId: 'k1', selfie: 'k2' },
      });

      const result = service.getStatus(user);

      expect(result.kycStatus).toBe(KycStatus.REJECTED);
      expect(result.submitted).toBe(true);
    });
  });
});
