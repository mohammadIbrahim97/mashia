import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { Listing } from '../listings/listing.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { OrderListItemResponse } from './dto/order-list-item.response';
import { OrderDetailResponse } from './dto/order-detail.response';
import { OrderCreatedEvent } from './events/order-created.event';
import { OrderDeliveredEvent } from './events/order-delivered.event';
import { ListingStatus, OrderStatus } from '@shared/enums';

const DEFAULT_COMMISSION_RATE = 5.0;

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    private readonly eventEmitter: EventEmitter2,
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
    const saved = await this.ordersRepository.save(order);
    this.eventEmitter.emit(
      OrderCreatedEvent.EVENT_NAME,
      new OrderCreatedEvent(
        saved.id,
        saved.buyerId,
        saved.sellerId,
        Number(saved.totalPrice),
        saved.currency,
      ),
    );
    return saved;
  }

  async updateStatus(
    orderId: string,
    userId: string,
    newStatus: OrderStatus,
  ): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const isBuyer = order.buyerId === userId;
    const isSeller = order.sellerId === userId;
    if (!isBuyer && !isSeller) {
      throw new NotFoundException('Order not found');
    }

    switch (order.status) {
      case OrderStatus.PENDING:
        if (newStatus === OrderStatus.ACCEPTED && isSeller) break;
        if (newStatus === OrderStatus.CANCELLED) break;
        throw new BadRequestException(
          `Invalid transition from PENDING to ${newStatus}`,
        );

      case OrderStatus.PAID:
        if (newStatus === OrderStatus.IN_TRANSIT && isSeller) break;
        if (newStatus === OrderStatus.DISPUTED) break;
        throw new BadRequestException(
          `Invalid transition from PAID to ${newStatus}`,
        );

      case OrderStatus.IN_TRANSIT:
        if (newStatus === OrderStatus.DELIVERED && isBuyer) break;
        if (newStatus === OrderStatus.DISPUTED) break;
        throw new BadRequestException(
          `Invalid transition from IN_TRANSIT to ${newStatus}`,
        );

      case OrderStatus.DELIVERED:
        if (newStatus === OrderStatus.DISPUTED) break;
        throw new BadRequestException(
          `Invalid transition from DELIVERED to ${newStatus}`,
        );

      case OrderStatus.ACCEPTED:
      case OrderStatus.COMPLETED:
      case OrderStatus.CANCELLED:
      case OrderStatus.DISPUTED:
      default:
        throw new BadRequestException(
          `Cannot transition from ${order.status} via this endpoint`,
        );
    }

    order.status = newStatus;
    const saved = await this.ordersRepository.save(order);
    if (newStatus === OrderStatus.DELIVERED) {
      this.eventEmitter.emit(
        OrderDeliveredEvent.EVENT_NAME,
        new OrderDeliveredEvent(saved.id, saved.buyerId, saved.sellerId),
      );
    }
    return saved;
  }

  /**
   * Internal-only transition invoked by cross-module listeners (payments).
   * Bypasses the user-authorization check in updateStatus() because it runs
   * on behalf of the system, not an authenticated user.
   *
   * Allowed transitions:
   *   ACCEPTED  → PAID       (on payment.held)
   *   DELIVERED → COMPLETED  (on payment.released)
   *   DISPUTED  → CANCELLED  (on payment.refunded)
   *
   * @internal
   */
  async transitionFromPayment(
    orderId: string,
    target: OrderStatus,
  ): Promise<Order> {
    const order = await this.ordersRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const allowed =
      (order.status === OrderStatus.ACCEPTED && target === OrderStatus.PAID) ||
      (order.status === OrderStatus.DELIVERED && target === OrderStatus.COMPLETED) ||
      (order.status === OrderStatus.DISPUTED && target === OrderStatus.CANCELLED);

    if (!allowed) {
      throw new BadRequestException(
        `Invalid payment-driven transition from ${order.status} to ${target}`,
      );
    }

    order.status = target;
    return this.ordersRepository.save(order);
  }

  async findMyOrders(
    userId: string,
    query: ListOrdersQueryDto,
  ): Promise<{
    items: OrderListItemResponse[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const qb = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.listing', 'listing')
      .leftJoinAndSelect('order.buyer', 'buyer')
      .leftJoinAndSelect('order.seller', 'seller')
      .leftJoinAndSelect('order.broker', 'broker')
      .where(
        '(order.buyerId = :userId OR order.sellerId = :userId OR order.brokerId = :userId)',
        { userId },
      )
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.status && query.status.length > 0) {
      qb.andWhere('order.status IN (:...statuses)', {
        statuses: query.status,
      });
    }

    const [orders, total] = await qb.getManyAndCount();

    return {
      items: orders.map((o) => OrderListItemResponse.fromOrder(o, userId)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findOne(
    orderId: string,
    userId: string,
  ): Promise<OrderDetailResponse> {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['listing', 'buyer', 'seller', 'broker'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const isParty =
      order.buyerId === userId ||
      order.sellerId === userId ||
      order.brokerId === userId;

    if (!isParty) {
      throw new NotFoundException('Order not found');
    }

    return OrderDetailResponse.fromOrder(order, userId);
  }
}
