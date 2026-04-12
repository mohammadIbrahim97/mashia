import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Listing } from './listing.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingStatus, HealthStatus } from '@shared/enums';

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
  ) {}

  async create(sellerId: string, dto: CreateListingDto): Promise<Listing> {
    const listing = this.listingsRepository.create({
      ...dto,
      sellerId,
      status: ListingStatus.ACTIVE,
      healthStatus: HealthStatus.UNCHECKED,
    });
    return this.listingsRepository.save(listing);
  }

  async findAll(
    query: SearchListingsDto,
  ): Promise<{ data: Listing[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.listingsRepository
      .createQueryBuilder('listing')
      .where('listing.status = :status', { status: ListingStatus.ACTIVE });

    if (query.breed) {
      qb.andWhere('listing.breed = :breed', { breed: query.breed });
    }
    if (query.minPrice !== undefined) {
      qb.andWhere('listing.pricePerHead >= :minPrice', {
        minPrice: query.minPrice,
      });
    }
    if (query.maxPrice !== undefined) {
      qb.andWhere('listing.pricePerHead <= :maxPrice', {
        maxPrice: query.maxPrice,
      });
    }
    if (query.minQuantity !== undefined) {
      qb.andWhere('listing.quantity >= :minQuantity', {
        minQuantity: query.minQuantity,
      });
    }
    if (query.originCountry) {
      qb.andWhere('listing.originCountry = :originCountry', {
        originCountry: query.originCountry,
      });
    }
    if (query.healthStatus) {
      qb.andWhere('listing.healthStatus = :healthStatus', {
        healthStatus: query.healthStatus,
      });
    }

    switch (query.sort) {
      case 'price_asc':
        qb.orderBy('listing.pricePerHead', 'ASC');
        break;
      case 'price_desc':
        qb.orderBy('listing.pricePerHead', 'DESC');
        break;
      default:
        qb.orderBy('listing.createdAt', 'DESC');
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Listing> {
    const listing = await this.listingsRepository.findOne({
      where: { id },
      relations: ['seller'],
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async update(
    id: string,
    sellerId: string,
    dto: UpdateListingDto,
  ): Promise<Listing> {
    const listing = await this.listingsRepository.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException('You can only update your own listings');
    }
    Object.assign(listing, dto);
    return this.listingsRepository.save(listing);
  }

  async remove(id: string, sellerId: string): Promise<{ message: string }> {
    const listing = await this.listingsRepository.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException('You can only delete your own listings');
    }
    await this.listingsRepository.softDelete(id);
    return { message: 'Listing deleted' };
  }
}
