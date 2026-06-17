import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';
import { Currency, OrderStatus } from '@shared/enums';

@Entity('orders')
export class Order {
  // --- Identity ---
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --- Relations ---
  @ManyToOne(() => Listing, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'listing_id' })
  listing: Listing | null;

  @Column({ type: 'uuid', nullable: true, name: 'listing_id' })
  listingId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  @Column({ name: 'buyer_id' })
  buyerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @Column({ name: 'seller_id' })
  sellerId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'broker_id' })
  broker: User | null;

  @Column({ type: 'uuid', nullable: true, name: 'broker_id' })
  brokerId: string | null;

  // --- Order Details ---
  @Column({ type: 'int' })
  quantity: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  // --- Pricing & Commission ---
  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'unit_price' })
  unitPrice: number;

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'total_price' })
  totalPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5.0, name: 'commission_rate' })
  commissionRate: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'commission_amount' })
  commissionAmount: number;

  // --- Delivery Details ---
  @Column({ name: 'delivery_country' })
  deliveryCountry: string;

  @Column({ name: 'delivery_city' })
  deliveryCity: string;

  @Column({ type: 'text', name: 'delivery_address' })
  deliveryAddress: string;

  // --- Timestamps ---
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
