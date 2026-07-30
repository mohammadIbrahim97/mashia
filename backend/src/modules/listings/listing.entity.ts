import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Breed, Currency, ListingStatus, HealthStatus } from '@shared/enums';

@Entity('listings')
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  // ⚡ Bolt: Adding database indexes on frequently filtered fields (sellerId, breed, status) to optimize listing search and dashboard queries.
  @Index()
  @Column({ name: 'seller_id' })
  sellerId: string;

  @Column({ length: 200 })
  title: string;

  @Index()
  @Column({ type: 'enum', enum: Breed })
  breed: Breed;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'int', name: 'age_months' })
  ageMonths: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'weight_kg' })
  weightKg: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'price_per_head' })
  pricePerHead: number;

  @Column({ type: 'enum', enum: Currency })
  currency: Currency;

  @Column({ length: 100, name: 'origin_country' })
  originCountry: string;

  @Column({ length: 100, name: 'origin_city' })
  originCity: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb' })
  images: string[];

  @Column({ type: 'varchar', nullable: true, name: 'video_url' })
  videoUrl: string | null;

  @Column({
    type: 'enum',
    enum: HealthStatus,
    default: HealthStatus.UNCHECKED,
    name: 'health_status',
  })
  healthStatus: HealthStatus;

  @Column({ type: 'uuid', nullable: true, name: 'certificate_id' })
  certificateId: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: ListingStatus,
    default: ListingStatus.ACTIVE,
  })
  status: ListingStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
