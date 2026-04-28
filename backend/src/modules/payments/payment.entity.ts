import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { Currency, EscrowStatus, PaymentMethod } from '@shared/enums';

@Entity('payments')
@Index('idx_payments_auto_release_held', ['autoReleaseAt'], {
  where: "escrow_status = 'held'",
})
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'order_id' })
  orderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payer_id' })
  payer: User;

  @Column({ type: 'uuid', name: 'payer_id' })
  payerId: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'commission_amount' })
  commissionAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'seller_amount' })
  sellerAmount: number;

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({
    type: 'enum',
    enum: EscrowStatus,
    name: 'escrow_status',
    default: EscrowStatus.HELD,
  })
  escrowStatus: EscrowStatus;

  @Column({ type: 'text', name: 'transaction_ref' })
  transactionRef: string;

  @Column({ type: 'timestamptz', name: 'auto_release_at', nullable: true })
  autoReleaseAt: Date | null;

  @Column({ type: 'timestamptz', name: 'paid_at' })
  paidAt: Date;

  @Column({ type: 'timestamptz', name: 'released_at', nullable: true })
  releasedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'refunded_at', nullable: true })
  refundedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
