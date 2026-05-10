import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';

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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
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
});
