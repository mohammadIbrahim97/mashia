import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { Listing } from '../listings/listing.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListingStatus, OrderStatus } from '@shared/enums';

const DEFAULT_COMMISSION_RATE = 5.0;

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
  ) {}

  async create(buyerId: string, dto: CreateOrderDto): Promise<Order> {
    const listing = await this.listingsRepository.findOne({
      where: { id: dto.listingId },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.status !== ListingStatus.ACTIVE) {
      throw new BadRequestException('Listing is not available for orders');
    }
    if (listing.sellerId === buyerId) {
      throw new ForbiddenException('Cannot order your own listing');
    }

    const commissionRate = DEFAULT_COMMISSION_RATE;
    const totalPrice = Math.round(dto.quantity * dto.unitPrice * 100) / 100;
    const commissionAmount = Math.round(totalPrice * commissionRate) / 100;

    const order = this.ordersRepository.create({
      listingId: dto.listingId,
      buyerId,
      sellerId: listing.sellerId,
      brokerId: null,
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      currency: listing.currency,
      totalPrice,
      commissionRate,
      commissionAmount,
      status: OrderStatus.PENDING,
      deliveryCountry: dto.deliveryCountry,
      deliveryCity: dto.deliveryCity,
      deliveryAddress: dto.deliveryAddress,
    });
    return this.ordersRepository.save(order);
  }
}
