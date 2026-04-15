import { Order } from '../order.entity';
import { Currency, OrderStatus } from '@shared/enums';

export type OrderRole = 'buyer' | 'seller' | 'broker';

export class OrderListItemResponse {
  id: string;
  status: OrderStatus;
  quantity: number;
  unitPrice: number;
  currency: Currency;
  totalPrice: number;
  createdAt: Date;
  myRole: OrderRole;
  listing: { id: string; title: string; primaryImage: string | null } | null;
  counterparty: { id: string; fullName: string };

  static fromOrder(order: Order, userId: string): OrderListItemResponse {
    const myRole: OrderRole =
      order.buyerId === userId
        ? 'buyer'
        : order.sellerId === userId
          ? 'seller'
          : 'broker';

    const counterpartyUser =
      myRole === 'buyer' ? order.seller : order.buyer;

    const primaryImage =
      order.listing?.images && order.listing.images.length > 0
        ? order.listing.images[0]
        : null;

    return {
      id: order.id,
      status: order.status,
      quantity: order.quantity,
      unitPrice: Number(order.unitPrice),
      currency: order.currency,
      totalPrice: Number(order.totalPrice),
      createdAt: order.createdAt,
      myRole,
      listing: order.listing
        ? {
            id: order.listing.id,
            title: order.listing.title,
            primaryImage,
          }
        : null,
      counterparty: {
        id: counterpartyUser.id,
        fullName: counterpartyUser.fullName,
      },
    };
  }
}
