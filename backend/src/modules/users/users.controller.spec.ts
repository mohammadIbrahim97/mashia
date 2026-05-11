import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';
import { ProfileResponseDto } from './dto/profile-response.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockUser: User = {
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
    createdAt: new Date('2026-04-12T00:00:00Z'),
    updatedAt: new Date('2026-04-12T00:00:00Z'),
  };

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
      findByPhone: jest.fn(),
      findById: jest.fn(),
      updateKycDocuments: jest.fn(),
      updateProfile: jest.fn(),
      usersRepository: {},
    } as unknown as jest.Mocked<UsersService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('getProfile', () => {
    it('should return profile without kycDocuments', async () => {
      const result = await controller.getProfile(mockUser);

      expect(result).toBeInstanceOf(ProfileResponseDto);
      expect(result.id).toBe(mockUser.id);
      expect(result.fullName).toBe(mockUser.fullName);
      expect(result.kycStatus).toBe(KycStatus.PENDING);
      expect(result).not.toHaveProperty('kycDocuments');
    });

    it('should return all expected profile fields', async () => {
      const result = await controller.getProfile(mockUser);

      expect(result.id).toBe(mockUser.id);
      expect(result.role).toBe(UserRole.BUYER);
      expect(result.fullName).toBe('Ahmad Ali');
      expect(result.phone).toBe('+966501234567');
      expect(result.email).toBeNull();
      expect(result.country).toBe('SA');
      expect(result.city).toBe('Riyadh');
      expect(result.kycStatus).toBe(KycStatus.PENDING);
      expect(result.preferredLanguage).toBe(PreferredLanguage.AR);
      expect(result.createdAt).toEqual(mockUser.createdAt);
      expect(result.updatedAt).toEqual(mockUser.updatedAt);
    });

    it('should exclude kycDocuments even when user has documents', async () => {
      const userWithDocs: User = {
        ...mockUser,
        kycDocuments: {
          nationalId: 'kyc/550e/nationalId-abc.jpg',
          selfie: 'kyc/550e/selfie-def.jpg',
        },
      };

      const result = await controller.getProfile(userWithDocs);

      expect(result).not.toHaveProperty('kycDocuments');
      expect(result.kycStatus).toBe(KycStatus.PENDING);
    });
  });

  describe('updateProfile', () => {
    it('should call service.updateProfile and return updated profile', async () => {
      const updatedUser = { ...mockUser, fullName: 'Ahmad Updated', city: 'Jeddah' };
      usersService.updateProfile.mockResolvedValue(updatedUser as User);

      const result = await controller.updateProfile(mockUser, {
        fullName: 'Ahmad Updated',
        city: 'Jeddah',
      });

      expect(usersService.updateProfile).toHaveBeenCalledWith(
        mockUser.id,
        { fullName: 'Ahmad Updated', city: 'Jeddah' },
      );
      expect(result).toBeInstanceOf(ProfileResponseDto);
      expect(result.fullName).toBe('Ahmad Updated');
      expect(result.city).toBe('Jeddah');
      expect(result).not.toHaveProperty('kycDocuments');
    });

    it('should update language preference', async () => {
      const updatedUser = { ...mockUser, preferredLanguage: PreferredLanguage.EN };
      usersService.updateProfile.mockResolvedValue(updatedUser as User);

      const result = await controller.updateProfile(mockUser, {
        preferredLanguage: PreferredLanguage.EN,
      });

      expect(usersService.updateProfile).toHaveBeenCalledWith(
        mockUser.id,
        { preferredLanguage: PreferredLanguage.EN },
      );
      expect(result.preferredLanguage).toBe(PreferredLanguage.EN);
    });

    it('should update email', async () => {
      const updatedUser = { ...mockUser, email: 'ahmad@example.com' };
      usersService.updateProfile.mockResolvedValue(updatedUser as User);

      const result = await controller.updateProfile(mockUser, {
        email: 'ahmad@example.com',
      });

      expect(usersService.updateProfile).toHaveBeenCalledWith(
        mockUser.id,
        { email: 'ahmad@example.com' },
      );
      expect(result.email).toBe('ahmad@example.com');
    });

    it('should propagate service errors to caller', async () => {
      usersService.updateProfile.mockRejectedValue(new Error('db error'));

      await expect(
        controller.updateProfile(mockUser, { city: 'Jeddah' }),
      ).rejects.toThrow('db error');
    });
  });
});
