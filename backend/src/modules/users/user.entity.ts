import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ unique: true })
  phone: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column()
  country: string;

  @Column()
  city: string;

  @Column({
    type: 'enum',
    enum: KycStatus,
    default: KycStatus.PENDING,
    name: 'kyc_status',
  })
  kycStatus: KycStatus;

  @Column({ type: 'jsonb', nullable: true, name: 'kyc_documents' })
  kycDocuments: Record<string, string> | null;

  @Column({
    type: 'enum',
    enum: PreferredLanguage,
    default: PreferredLanguage.AR,
    name: 'preferred_language',
  })
  preferredLanguage: PreferredLanguage;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
