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
import { CertificateStatus, CertificateType } from '@shared/enums';

@Entity('certificates')
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @Column({ name: 'seller_id' })
  sellerId: string;

  @ManyToOne(() => Listing, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'listing_id' })
  listing: Listing | null;

  @Column({ type: 'uuid', nullable: true, name: 'listing_id' })
  listingId: string | null;

  @Column({ type: 'enum', enum: CertificateType })
  type: CertificateType;

  @Column({ length: 200, name: 'issuing_authority' })
  issuingAuthority: string;

  @Column({ type: 'date', name: 'issue_date' })
  issueDate: string;

  @Column({ type: 'date', name: 'expiry_date' })
  expiryDate: string;

  @Column({ type: 'varchar', name: 'file_url' })
  fileUrl: string;

  @Column({
    type: 'enum',
    enum: CertificateStatus,
    default: CertificateStatus.PENDING,
  })
  status: CertificateStatus;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'verified_by_id' })
  verifiedBy: User | null;

  @Column({ type: 'uuid', nullable: true, name: 'verified_by_id' })
  verifiedById: string | null;

  @Column({ type: 'timestamp with time zone', nullable: true, name: 'verified_at' })
  verifiedAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'rejection_reason' })
  rejectionReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
