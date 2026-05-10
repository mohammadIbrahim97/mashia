import { Test, TestingModule } from '@nestjs/testing';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { User } from '../users/user.entity';
import { Listing } from './listing.entity';
import {
  UserRole,
  KycStatus,
  PreferredLanguage,
  Breed,
  Currency,
  ListingStatus,
  HealthStatus,
} from '@shared/enums';

describe('ListingsController', () => {
  let controller: ListingsController;
  let listingsService: jest.Mocked<ListingsService>;

  const mockUser: User = {
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
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockListing: Partial<Listing> = {
    id: 'listing-uuid-1',
    sellerId: mockUser.id,
    title: 'Awassi Sheep',
    breed: Breed.AWASSI,
    quantity: 50,
    ageMonths: 12,
    weightKg: 45.5,
    pricePerHead: 1200,
    currency: Currency.SAR,
    originCountry: 'SY',
    originCity: 'Aleppo',
    images: ['listings/user1/img1.jpg', 'listings/user1/img2.jpg'],
    status: ListingStatus.ACTIVE,
    healthStatus: HealthStatus.UNCHECKED,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockPaginatedResult = {
    data: [mockListing as Listing],
    total: 1,
    page: 1,
    limit: 20,
  };

  beforeEach(async () => {
    listingsService = {
      create: jest.fn().mockResolvedValue(mockListing),
      findAll: jest.fn().mockResolvedValue(mockPaginatedResult),
      findById: jest.fn().mockResolvedValue(mockListing),
      update: jest.fn().mockResolvedValue(mockListing),
      remove: jest.fn().mockResolvedValue({ message: 'Listing deleted' }),
    } as unknown as jest.Mocked<ListingsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListingsController],
      providers: [{ provide: ListingsService, useValue: listingsService }],
    }).compile();

    controller = module.get<ListingsController>(ListingsController);
  });

  describe('create', () => {
    it('delegates to service.create with user.id and dto', async () => {
      const dto = {
        title: 'Awassi Sheep',
        breed: Breed.AWASSI,
        quantity: 50,
        ageMonths: 12,
        weightKg: 45.5,
        pricePerHead: 1200,
        currency: Currency.SAR,
        originCountry: 'SY',
        originCity: 'Aleppo',
        images: ['key1', 'key2'],
      };

      const result = await controller.create(mockUser, dto as any);

      expect(listingsService.create).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toEqual(mockListing);
    });
  });

  describe('findAll', () => {
    it('delegates to service.findAll with query params', async () => {
      const query = { breed: Breed.AWASSI, page: 2, limit: 10 };

      const result = await controller.findAll(query as any);

      expect(listingsService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockPaginatedResult);
    });
  });

  describe('findById', () => {
    it('delegates to service.findById', async () => {
      const result = await controller.findById('listing-uuid-1');

      expect(listingsService.findById).toHaveBeenCalledWith('listing-uuid-1');
      expect(result).toEqual(mockListing);
    });
  });

  describe('update', () => {
    it('delegates to service.update with id, user.id, and dto', async () => {
      const result = await controller.update(
        'listing-uuid-1',
        mockUser,
        { title: 'Updated' } as any,
      );

      expect(listingsService.update).toHaveBeenCalledWith(
        'listing-uuid-1',
        mockUser.id,
        { title: 'Updated' },
      );
      expect(result).toEqual(mockListing);
    });
  });

  describe('remove', () => {
    it('delegates to service.remove with id and user.id', async () => {
      const result = await controller.remove('listing-uuid-1', mockUser);

      expect(listingsService.remove).toHaveBeenCalledWith(
        'listing-uuid-1',
        mockUser.id,
      );
      expect(result).toEqual({ message: 'Listing deleted' });
    });
  });
});
