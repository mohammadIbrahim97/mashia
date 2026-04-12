import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { Listing } from './listing.entity';
import {
  Breed,
  Currency,
  ListingStatus,
  HealthStatus,
} from '@shared/enums';
import { CreateListingDto } from './dto/create-listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';

describe('ListingsService', () => {
  let service: ListingsService;
  let repository: jest.Mocked<Repository<Listing>>;

  const sellerId = '550e8400-e29b-41d4-a716-446655440000';

  const createDto: CreateListingDto = {
    title: 'Awassi Sheep Lot',
    breed: Breed.AWASSI,
    quantity: 50,
    ageMonths: 12,
    weightKg: 45.5,
    pricePerHead: 1200,
    currency: Currency.SAR,
    originCountry: 'SY',
    originCity: 'Aleppo',
    description: 'Healthy flock, vaccinated',
    images: ['listings/user1/img1.jpg', 'listings/user1/img2.jpg'],
    videoUrl: 'https://youtube.com/watch?v=abc123',
  };

  const mockListing: Partial<Listing> = {
    id: 'listing-uuid-1',
    sellerId,
    ...createDto,
    status: ListingStatus.ACTIVE,
    healthStatus: HealthStatus.UNCHECKED,
    certificateId: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: getRepositoryToken(Listing), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
    repository = module.get(getRepositoryToken(Listing));
  });

  describe('create', () => {
    it('saves listing with sellerId, status=active, healthStatus=unchecked', async () => {
      repository.create.mockReturnValue(mockListing as Listing);
      repository.save.mockResolvedValue(mockListing as Listing);

      const result = await service.create(sellerId, createDto);

      expect(repository.create).toHaveBeenCalledWith({
        ...createDto,
        sellerId,
        status: ListingStatus.ACTIVE,
        healthStatus: HealthStatus.UNCHECKED,
      });
      expect(repository.save).toHaveBeenCalledWith(mockListing);
      expect(result.status).toBe(ListingStatus.ACTIVE);
      expect(result.healthStatus).toBe(HealthStatus.UNCHECKED);
    });

    it('preserves images array in the saved listing', async () => {
      repository.create.mockReturnValue(mockListing as Listing);
      repository.save.mockResolvedValue(mockListing as Listing);

      const result = await service.create(sellerId, createDto);

      expect(result.images).toEqual([
        'listings/user1/img1.jpg',
        'listings/user1/img2.jpg',
      ]);
    });
  });

  describe('findAll', () => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockListing], 1]),
    };

    beforeEach(() => {
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      Object.values(mockQueryBuilder).forEach((fn) => (fn as jest.Mock).mockClear());
      mockQueryBuilder.where.mockReturnThis();
      mockQueryBuilder.andWhere.mockReturnThis();
      mockQueryBuilder.orderBy.mockReturnThis();
      mockQueryBuilder.skip.mockReturnThis();
      mockQueryBuilder.take.mockReturnThis();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockListing], 1]);
    });

    it('returns paginated results with defaults (page=1, limit=20)', async () => {
      const result = await service.findAll({});

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'listing.status = :status',
        { status: ListingStatus.ACTIVE },
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(result).toEqual({ data: [mockListing], total: 1, page: 1, limit: 20 });
    });

    it('filters by breed', async () => {
      await service.findAll({ breed: Breed.AWASSI });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'listing.breed = :breed',
        { breed: Breed.AWASSI },
      );
    });

    it('filters by price range', async () => {
      await service.findAll({ minPrice: 500, maxPrice: 2000 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'listing.pricePerHead >= :minPrice',
        { minPrice: 500 },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'listing.pricePerHead <= :maxPrice',
        { maxPrice: 2000 },
      );
    });

    it('filters by minQuantity', async () => {
      await service.findAll({ minQuantity: 10 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'listing.quantity >= :minQuantity',
        { minQuantity: 10 },
      );
    });

    it('filters by originCountry', async () => {
      await service.findAll({ originCountry: 'SY' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'listing.originCountry = :originCountry',
        { originCountry: 'SY' },
      );
    });

    it('filters by healthStatus', async () => {
      await service.findAll({ healthStatus: HealthStatus.CERTIFIED });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'listing.healthStatus = :healthStatus',
        { healthStatus: HealthStatus.CERTIFIED },
      );
    });

    it('sorts by newest (default), price_asc, price_desc', async () => {
      await service.findAll({});
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('listing.createdAt', 'DESC');

      mockQueryBuilder.orderBy.mockClear();
      await service.findAll({ sort: 'price_asc' });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('listing.pricePerHead', 'ASC');

      mockQueryBuilder.orderBy.mockClear();
      await service.findAll({ sort: 'price_desc' });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('listing.pricePerHead', 'DESC');
    });

    it('only returns active listings', async () => {
      await service.findAll({});

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'listing.status = :status',
        { status: ListingStatus.ACTIVE },
      );
    });
  });

  describe('findById', () => {
    it('returns listing with seller relation', async () => {
      repository.findOne.mockResolvedValue(mockListing as Listing);

      const result = await service.findById('listing-uuid-1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'listing-uuid-1' },
        relations: ['seller'],
      });
      expect(result).toEqual(mockListing);
    });

    it('throws NotFoundException when listing not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates fields when caller is the owner', async () => {
      repository.findOne.mockResolvedValue({ ...mockListing, sellerId } as Listing);
      repository.save.mockResolvedValue({
        ...mockListing,
        title: 'Updated Title',
      } as Listing);

      const result = await service.update(
        'listing-uuid-1',
        sellerId,
        { title: 'Updated Title' },
      );

      expect(repository.save).toHaveBeenCalled();
      expect(result.title).toBe('Updated Title');
    });

    it('throws ForbiddenException when caller is not the owner', async () => {
      repository.findOne.mockResolvedValue({
        ...mockListing,
        sellerId: 'different-seller',
      } as Listing);

      await expect(
        service.update('listing-uuid-1', sellerId, { title: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('allows seller to set status to sold', async () => {
      repository.findOne.mockResolvedValue({ ...mockListing, sellerId } as Listing);
      repository.save.mockImplementation(async (entity) => entity as Listing);

      const result = await service.update(
        'listing-uuid-1',
        sellerId,
        { status: ListingStatus.SOLD },
      );

      expect(result.status).toBe(ListingStatus.SOLD);
    });

    it('throws NotFoundException when listing does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', sellerId, { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deletes when caller is the owner', async () => {
      repository.findOne.mockResolvedValue({ ...mockListing, sellerId } as Listing);
      repository.softDelete.mockResolvedValue({ affected: 1 } as any);

      const result = await service.remove('listing-uuid-1', sellerId);

      expect(repository.softDelete).toHaveBeenCalledWith('listing-uuid-1');
      expect(result).toEqual({ message: 'Listing deleted' });
    });

    it('throws ForbiddenException when caller is not the owner', async () => {
      repository.findOne.mockResolvedValue({
        ...mockListing,
        sellerId: 'different-seller',
      } as Listing);

      await expect(
        service.remove('listing-uuid-1', sellerId),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when listing does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.remove('nonexistent', sellerId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
