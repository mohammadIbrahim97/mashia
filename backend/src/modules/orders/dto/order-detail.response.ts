import { Order } from '../order.entity';
import { Breed, Currency, OrderStatus } from '@shared/enums';
import { OrderRole } from './order-list-item.response';

export class OrderDetailResponse {
  id: string;
  status: OrderStatus;
  quantity: number;
  unitPrice: number;
  currency: Currency;
  totalPrice: number;
  commissionRate: number;
  commissionAmount: number;
  deliveryCountry: string;
  deliveryCity: string;
  deliveryAddress: string;
  createdAt: Date;
  updatedAt: Date;
  myRole: OrderRole;

  listing:
    | {
        id: string;
        title: string;
        images: string[];
        pricePerHead: number;
        breed: Breed;
      }
    | null;

  buyer: { id: string; fullName: string; phone: string };
  seller: { id: string; fullName: string; phone: string };
  broker: { id: string; fullName: string } | null;

  static fromOrder(order: Order, userId: string): OrderDetailResponse {
    const myRole: OrderRole =
      order.buyerId === userId
        ? 'buyer'
        : order.sellerId === userId
          ? 'seller'
          : 'broker';

    return {
      id: order.id,
      status: order.status,
      quantity: order.quantity,
      unitPrice: Number(order.unitPrice),
      currency: order.currency,
      totalPrice: Number(order.totalPrice),
      commissionRate: Number(order.commissionRate),
      commissionAmount: Number(order.commissionAmount),
      deliveryCountry: order.deliveryCountry,
      deliveryCity: order.deliveryCity,
      deliveryAddress: order.deliveryAddress,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      myRole,
      listing: order.listing
        ? {
            id: order.listing.id,
            title: order.listing.title,
            images: order.listing.images ?? [],
            pricePerHead: Number(order.listing.pricePerHead),
            breed: order.listing.breed,
          }
        : null,
      buyer: {
        id: order.buyer.id,
        fullName: order.buyer.fullName,
        phone: order.buyer.phone,
      },
      seller: {
        id: order.seller.id,
        fullName: order.seller.fullName,
        phone: order.seller.phone,
      },
      broker: order.broker
        ? { id: order.broker.id, fullName: order.broker.fullName }
        : null,
    };
  }
}
