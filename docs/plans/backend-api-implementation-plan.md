# Sheep Marketplace — Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the NestJS modular monolith backend API that powers both the mobile app and admin dashboard for the sheep marketplace platform.

**Architecture:** Modular monolith with strict module boundaries. Each module owns its tables, communicates through service interfaces, and emits events via NestJS EventEmitter (swappable to RabbitMQ/SQS later). PostgreSQL via TypeORM, Redis for caching/sessions, S3 for file storage, Socket.io for real-time messaging.

**Tech Stack:** NestJS, TypeScript, TypeORM, PostgreSQL, Redis, Socket.io, AWS S3, JWT, class-validator, Docker, Jest

**Spec:** `docs/superpowers/specs/2026-04-06-sheep-marketplace-design.md`

---

## File Map

```
sheep-marketplace/
├── docker-compose.yml                          → PostgreSQL + Redis for local dev
├── .env.example                                → environment variable template
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── Dockerfile
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── config/
│   │   │   ├── database.config.ts              → TypeORM config from env
│   │   │   ├── redis.config.ts                 → Redis connection config
│   │   │   ├── s3.config.ts                    → AWS S3 config
│   │   │   └── app.config.ts                   → general app config (port, cors, etc.)
│   │   ├── shared/
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts           → JWT authentication guard
│   │   │   │   └── roles.guard.ts              → RBAC role guard
│   │   │   ├── decorators/
│   │   │   │   ├── roles.decorator.ts          → @Roles() decorator
│   │   │   │   └── current-user.decorator.ts   → @CurrentUser() decorator
│   │   │   ├── interceptors/
│   │   │   │   └── transform.interceptor.ts    → standard response wrapper
│   │   │   ├── enums/
│   │   │   │   └── index.ts                    → UserRole, KycStatus, etc.
│   │   │   └── interfaces/
│   │   │       └── module-events.ts            → cross-module event contracts
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── otp.service.ts
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── send-otp.dto.ts
│   │   │   │   │   ├── verify-otp.dto.ts
│   │   │   │   │   └── register.dto.ts
│   │   │   │   └── auth.controller.spec.ts
│   │   │   ├── users/
│   │   │   │   ├── users.module.ts
│   │   │   │   ├── users.controller.ts
│   │   │   │   ├── users.service.ts
│   │   │   │   ├── user.entity.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── update-profile.dto.ts
│   │   │   │   │   └── kyc-upload.dto.ts
│   │   │   │   └── users.controller.spec.ts
│   │   │   ├── listings/
│   │   │   │   ├── listings.module.ts
│   │   │   │   ├── listings.controller.ts
│   │   │   │   ├── listings.service.ts
│   │   │   │   ├── listing.entity.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── create-listing.dto.ts
│   │   │   │   │   ├── update-listing.dto.ts
│   │   │   │   │   └── search-listings.dto.ts
│   │   │   │   └── listings.controller.spec.ts
│   │   │   ├── orders/
│   │   │   │   ├── orders.module.ts
│   │   │   │   ├── orders.controller.ts
│   │   │   │   ├── orders.service.ts
│   │   │   │   ├── order.entity.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── create-order.dto.ts
│   │   │   │   │   └── update-order-status.dto.ts
│   │   │   │   └── orders.controller.spec.ts
│   │   │   ├── payments/
│   │   │   │   ├── payments.module.ts
│   │   │   │   ├── payments.controller.ts
│   │   │   │   ├── payments.service.ts
│   │   │   │   ├── escrow.service.ts
│   │   │   │   ├── payment.entity.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── initiate-payment.dto.ts
│   │   │   │   │   └── release-payment.dto.ts
│   │   │   │   └── payments.controller.spec.ts
│   │   │   ├── messaging/
│   │   │   │   ├── messaging.module.ts
│   │   │   │   ├── messaging.controller.ts
│   │   │   │   ├── messaging.service.ts
│   │   │   │   ├── messaging.gateway.ts         → Socket.io gateway
│   │   │   │   ├── conversation.entity.ts
│   │   │   │   ├── message.entity.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── create-conversation.dto.ts
│   │   │   │   │   └── send-message.dto.ts
│   │   │   │   └── messaging.gateway.spec.ts
│   │   │   ├── certificates/
│   │   │   │   ├── certificates.module.ts
│   │   │   │   ├── certificates.controller.ts
│   │   │   │   ├── certificates.service.ts
│   │   │   │   ├── certificate.entity.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── upload-certificate.dto.ts
│   │   │   │   │   └── verify-certificate.dto.ts
│   │   │   │   └── certificates.controller.spec.ts
│   │   │   └── admin/
│   │   │       ├── admin.module.ts
│   │   │       ├── admin.controller.ts
│   │   │       ├── admin.service.ts
│   │   │       ├── dto/
│   │   │       │   └── admin-query.dto.ts
│   │   │       └── admin.controller.spec.ts
│   │   └── test/
│   │       └── app.e2e-spec.ts
│   └── test/
│       └── jest-e2e.json
```

---

### Task 1: Project Scaffolding & Docker Setup

**Files:**
- Create: `sheep-marketplace/docker-compose.yml`
- Create: `sheep-marketplace/.env.example`
- Create: `sheep-marketplace/.gitignore`
- Create: `sheep-marketplace/backend/` (NestJS scaffold)

- [ ] **Step 1: Create project root and initialize git**

```bash
mkdir -p sheep-marketplace && cd sheep-marketplace
git init
```

- [ ] **Step 2: Create .gitignore**

Create `sheep-marketplace/.gitignore`:

```gitignore
node_modules/
dist/
.env
*.log
.DS_Store
coverage/
```

- [ ] **Step 3: Create docker-compose.yml**

Create `sheep-marketplace/docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: sheep-marketplace-db
    environment:
      POSTGRES_DB: sheep_marketplace
      POSTGRES_USER: sheep_user
      POSTGRES_PASSWORD: sheep_pass_dev
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: sheep-marketplace-redis
    ports:
      - '6379:6379'

volumes:
  pgdata:
```

- [ ] **Step 4: Create .env.example**

Create `sheep-marketplace/.env.example`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=sheep_user
DB_PASSWORD=sheep_pass_dev
DB_NAME=sheep_marketplace

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-jwt-secret-change-in-production
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=your-refresh-secret-change-in-production
JWT_REFRESH_EXPIRATION=7d

# OTP
OTP_EXPIRATION_MINUTES=5

# AWS S3
AWS_REGION=me-south-1
AWS_S3_BUCKET=sheep-marketplace-files
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# App
PORT=3000
NODE_ENV=development
```

- [ ] **Step 5: Scaffold NestJS backend**

```bash
cd sheep-marketplace
npx @nestjs/cli new backend --package-manager npm --skip-git
```

- [ ] **Step 6: Install core dependencies**

```bash
cd sheep-marketplace/backend
npm install @nestjs/typeorm typeorm pg @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt class-validator class-transformer @nestjs/event-emitter
npm install -D @types/passport-jwt
```

- [ ] **Step 7: Start Docker services and verify**

```bash
cd sheep-marketplace
cp .env.example .env
docker compose up -d
docker compose ps
```

Expected: Both `sheep-marketplace-db` and `sheep-marketplace-redis` running.

- [ ] **Step 8: Verify NestJS starts**

```bash
cd sheep-marketplace/backend
npm run start:dev
```

Expected: `Nest application successfully started` on port 3000.

- [ ] **Step 9: Commit**

```bash
cd sheep-marketplace
git add .
git commit -m "chore: scaffold project with NestJS, Docker (PostgreSQL + Redis)"
```

---

### Task 2: Configuration & Database Setup

**Files:**
- Create: `backend/src/config/database.config.ts`
- Create: `backend/src/config/redis.config.ts`
- Create: `backend/src/config/s3.config.ts`
- Create: `backend/src/config/app.config.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create app config**

Create `backend/src/config/app.config.ts`:

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
}));
```

- [ ] **Step 2: Create database config**

Create `backend/src/config/database.config.ts`:

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'sheep_user',
  password: process.env.DB_PASSWORD || 'sheep_pass_dev',
  database: process.env.DB_NAME || 'sheep_marketplace',
  autoLoadEntities: true,
  synchronize: process.env.NODE_ENV !== 'production',
}));
```

- [ ] **Step 3: Create Redis config**

Create `backend/src/config/redis.config.ts`:

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
}));
```

- [ ] **Step 4: Create S3 config**

Create `backend/src/config/s3.config.ts`:

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('s3', () => ({
  region: process.env.AWS_REGION || 'me-south-1',
  bucket: process.env.AWS_S3_BUCKET || 'sheep-marketplace-files',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
}));
```

- [ ] **Step 5: Update app.module.ts with config and TypeORM**

Replace `backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import s3Config from './config/s3.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, s3Config],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.database'),
        autoLoadEntities: true,
        synchronize: config.get('database.synchronize'),
      }),
    }),
    EventEmitterModule.forRoot(),
  ],
})
export class AppModule {}
```

- [ ] **Step 6: Copy .env.example to backend/.env**

```bash
cp sheep-marketplace/.env.example sheep-marketplace/backend/.env
```

- [ ] **Step 7: Verify app starts with database connection**

```bash
cd sheep-marketplace/backend
npm run start:dev
```

Expected: App starts, connects to PostgreSQL without errors.

- [ ] **Step 8: Commit**

```bash
cd sheep-marketplace
git add .
git commit -m "feat: add configuration modules for database, redis, s3"
```

---

### Task 3: Shared Enums, Guards & Decorators

**Files:**
- Create: `backend/src/shared/enums/index.ts`
- Create: `backend/src/shared/decorators/roles.decorator.ts`
- Create: `backend/src/shared/decorators/current-user.decorator.ts`
- Create: `backend/src/shared/guards/jwt-auth.guard.ts`
- Create: `backend/src/shared/guards/roles.guard.ts`
- Create: `backend/src/shared/interceptors/transform.interceptor.ts`
- Create: `backend/src/shared/interfaces/module-events.ts`

- [ ] **Step 1: Create shared enums**

Create `backend/src/shared/enums/index.ts`:

```typescript
export enum UserRole {
  SELLER = 'seller',
  BUYER = 'buyer',
  BROKER = 'broker',
  ADMIN = 'admin',
}

export enum KycStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum PreferredLanguage {
  AR = 'ar',
  TR = 'tr',
  EN = 'en',
}

export enum Breed {
  AWASSI = 'awassi',
  NAJDI = 'najdi',
  ARABI = 'arabi',
  SHAMI = 'shami',
  OTHER = 'other',
}

export enum Currency {
  SYP = 'SYP',
  SAR = 'SAR',
  AED = 'AED',
  USD = 'USD',
}

export enum ListingStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  EXPIRED = 'expired',
  FLAGGED = 'flagged',
}

export enum HealthStatus {
  CERTIFIED = 'certified',
  PENDING = 'pending',
  UNCHECKED = 'unchecked',
}

export enum OrderStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  PAID = 'paid',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  STC_PAY = 'stc_pay',
  MADA = 'mada',
  BANK_TRANSFER = 'bank_transfer',
}

export enum EscrowStatus {
  HELD = 'held',
  RELEASED = 'released',
  REFUNDED = 'refunded',
}

export enum CertificateType {
  HEALTH = 'health',
  EXPORT = 'export',
  IMPORT = 'import',
  HALAL = 'halal',
}

export enum VerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  CERTIFICATE = 'certificate',
  OFFER = 'offer',
}
```

- [ ] **Step 2: Create Roles decorator**

Create `backend/src/shared/decorators/roles.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 3: Create CurrentUser decorator**

Create `backend/src/shared/decorators/current-user.decorator.ts`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
```

- [ ] **Step 4: Create JWT auth guard**

Create `backend/src/shared/guards/jwt-auth.guard.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 5: Create Roles guard**

Create `backend/src/shared/guards/roles.guard.ts`:

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../enums';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
```

- [ ] **Step 6: Create transform interceptor**

Create `backend/src/shared/interceptors/transform.interceptor.ts`:

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

- [ ] **Step 7: Create module event interfaces**

Create `backend/src/shared/interfaces/module-events.ts`:

```typescript
export interface UserVerifiedEvent {
  userId: string;
  role: string;
}

export interface OrderCreatedEvent {
  orderId: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  totalPrice: number;
}

export interface PaymentCompletedEvent {
  paymentId: string;
  orderId: string;
  amount: number;
}

export interface OrderDeliveredEvent {
  orderId: string;
  buyerId: string;
  sellerId: string;
}

export interface CertificateVerifiedEvent {
  certificateId: string;
  listingId: string;
}
```

- [ ] **Step 8: Commit**

```bash
cd sheep-marketplace
git add .
git commit -m "feat: add shared enums, guards, decorators, interceptors"
```

---

### Task 4: Users Module — Entity & Service

**Files:**
- Create: `backend/src/modules/users/user.entity.ts`
- Create: `backend/src/modules/users/users.service.ts`
- Create: `backend/src/modules/users/users.module.ts`
- Create: `backend/src/modules/users/dto/update-profile.dto.ts`
- Create: `backend/src/modules/users/dto/kyc-upload.dto.ts`
- Test: `backend/src/modules/users/users.service.spec.ts`

- [ ] **Step 1: Write the User entity**

Create `backend/src/modules/users/user.entity.ts`:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole, KycStatus, PreferredLanguage } from '../../shared/enums';

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

  @Column({ nullable: true })
  email: string;

  @Column()
  country: string;

  @Column()
  city: string;

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING, name: 'kyc_status' })
  kycStatus: KycStatus;

  @Column({ type: 'jsonb', nullable: true, name: 'kyc_documents' })
  kycDocuments: Record<string, string>;

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
```

- [ ] **Step 2: Create DTOs**

Create `backend/src/modules/users/dto/update-profile.dto.ts`:

```typescript
import { IsOptional, IsString, IsEmail, IsEnum } from 'class-validator';
import { PreferredLanguage } from '../../../shared/enums';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsEnum(PreferredLanguage)
  preferredLanguage?: PreferredLanguage;
}
```

Create `backend/src/modules/users/dto/kyc-upload.dto.ts`:

```typescript
import { IsNotEmpty, IsString } from 'class-validator';

export class KycUploadDto {
  @IsNotEmpty()
  @IsString()
  documentType: string;

  @IsNotEmpty()
  @IsString()
  documentUrl: string;
}
```

- [ ] **Step 3: Write the failing test for UsersService**

Create `backend/src/modules/users/users.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { UserRole, KycStatus } from '../../shared/enums';

describe('UsersService', () => {
  let service: UsersService;
  let repository: Repository<User>;

  const mockUser: Partial<User> = {
    id: 'test-uuid',
    role: UserRole.SELLER,
    fullName: 'Ahmad Ali',
    phone: '+963911234567',
    country: 'SY',
    city: 'Damascus',
    kycStatus: KycStatus.PENDING,
  };

  const mockRepository = {
    create: jest.fn().mockReturnValue(mockUser),
    save: jest.fn().mockResolvedValue(mockUser),
    findOne: jest.fn().mockResolvedValue(mockUser),
    findOneBy: jest.fn().mockResolvedValue(mockUser),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('should create and return a user', async () => {
      const result = await service.createUser({
        role: UserRole.SELLER,
        fullName: 'Ahmad Ali',
        phone: '+963911234567',
        country: 'SY',
        city: 'Damascus',
      });
      expect(result).toEqual(mockUser);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('findByPhone', () => {
    it('should return a user by phone number', async () => {
      const result = await service.findByPhone('+963911234567');
      expect(result).toEqual(mockUser);
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ phone: '+963911234567' });
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      const result = await service.findById('test-uuid');
      expect(result).toEqual(mockUser);
      expect(mockRepository.findOneBy).toHaveBeenCalledWith({ id: 'test-uuid' });
    });
  });

  describe('updateProfile', () => {
    it('should update user profile fields', async () => {
      const result = await service.updateProfile('test-uuid', { fullName: 'Ahmad Updated' });
      expect(mockRepository.update).toHaveBeenCalledWith('test-uuid', { fullName: 'Ahmad Updated' });
    });
  });

  describe('updateKycStatus', () => {
    it('should update KYC status', async () => {
      await service.updateKycStatus('test-uuid', KycStatus.VERIFIED);
      expect(mockRepository.update).toHaveBeenCalledWith('test-uuid', { kycStatus: KycStatus.VERIFIED });
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd sheep-marketplace/backend
npx jest src/modules/users/users.service.spec.ts --verbose
```

Expected: FAIL — `Cannot find module './users.service'`

- [ ] **Step 5: Implement UsersService**

Create `backend/src/modules/users/users.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { KycStatus } from '../../shared/enums';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createUser(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOneBy({ phone });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOneBy({ id });
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<void> {
    await this.userRepository.update(id, dto);
  }

  async updateKycStatus(id: string, status: KycStatus): Promise<void> {
    await this.userRepository.update(id, { kycStatus: status });
  }

  async updateKycDocuments(id: string, documents: Record<string, string>): Promise<void> {
    await this.userRepository.update(id, { kycDocuments: documents });
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd sheep-marketplace/backend
npx jest src/modules/users/users.service.spec.ts --verbose
```

Expected: All 5 tests PASS.

- [ ] **Step 7: Create UsersModule**

Create `backend/src/modules/users/users.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 8: Commit**

```bash
cd sheep-marketplace
git add .
git commit -m "feat: add users module with entity, service, and tests"
```

---

### Task 5: Auth Module — OTP, JWT & Registration

**Files:**
- Create: `backend/src/modules/auth/auth.module.ts`
- Create: `backend/src/modules/auth/auth.controller.ts`
- Create: `backend/src/modules/auth/auth.service.ts`
- Create: `backend/src/modules/auth/otp.service.ts`
- Create: `backend/src/modules/auth/jwt.strategy.ts`
- Create: `backend/src/modules/auth/dto/send-otp.dto.ts`
- Create: `backend/src/modules/auth/dto/verify-otp.dto.ts`
- Create: `backend/src/modules/auth/dto/register.dto.ts`
- Test: `backend/src/modules/auth/auth.controller.spec.ts`

- [ ] **Step 1: Create auth DTOs**

Create `backend/src/modules/auth/dto/send-otp.dto.ts`:

```typescript
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'Phone must be in E.164 format (e.g., +963911234567)' })
  phone: string;
}
```

Create `backend/src/modules/auth/dto/verify-otp.dto.ts`:

```typescript
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  code: string;
}
```

Create `backend/src/modules/auth/dto/register.dto.ts`:

```typescript
import { IsNotEmpty, IsString, IsEnum, IsOptional, IsEmail, Matches } from 'class-validator';
import { UserRole, PreferredLanguage } from '../../../shared/enums';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/)
  phone: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  code: string;

  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;

  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  country: string;

  @IsNotEmpty()
  @IsString()
  city: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(PreferredLanguage)
  preferredLanguage?: PreferredLanguage;
}
```

- [ ] **Step 2: Implement OTP service (Redis-backed)**

Create `backend/src/modules/auth/otp.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OtpService {
  private otpStore = new Map<string, { code: string; expiresAt: number; attempts: number }>();
  private readonly expirationMinutes: number;
  private readonly maxAttempts = 5;

  constructor(private configService: ConfigService) {
    this.expirationMinutes = parseInt(
      this.configService.get<string>('OTP_EXPIRATION_MINUTES', '5'),
      10,
    );
  }

  generateOtp(phone: string): string {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.otpStore.set(phone, {
      code,
      expiresAt: Date.now() + this.expirationMinutes * 60 * 1000,
      attempts: 0,
    });
    // In production: send via Unifonic SMS API
    return code;
  }

  verifyOtp(phone: string, code: string): boolean {
    const stored = this.otpStore.get(phone);
    if (!stored) return false;
    if (Date.now() > stored.expiresAt) {
      this.otpStore.delete(phone);
      return false;
    }
    if (stored.attempts >= this.maxAttempts) {
      this.otpStore.delete(phone);
      return false;
    }
    stored.attempts++;
    if (stored.code !== code) return false;
    this.otpStore.delete(phone);
    return true;
  }
}
```

- [ ] **Step 3: Implement JWT strategy**

Create `backend/src/modules/auth/jwt.strategy.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

interface JwtPayload {
  sub: string;
  phone: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
```

- [ ] **Step 4: Write the failing test for AuthController**

Create `backend/src/modules/auth/auth.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole } from '../../shared/enums';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    sendOtp: jest.fn().mockResolvedValue({ message: 'OTP sent' }),
    register: jest.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: { id: 'test-uuid', phone: '+963911234567', role: UserRole.SELLER },
    }),
    login: jest.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      user: { id: 'test-uuid', phone: '+963911234567', role: UserRole.SELLER },
    }),
    refreshTokens: jest.fn().mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /auth/otp/send', () => {
    it('should send OTP to phone number', async () => {
      const result = await controller.sendOtp({ phone: '+963911234567' });
      expect(result).toEqual({ message: 'OTP sent' });
      expect(mockAuthService.sendOtp).toHaveBeenCalledWith('+963911234567');
    });
  });

  describe('POST /auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const dto = {
        phone: '+963911234567',
        code: '123456',
        role: UserRole.SELLER,
        fullName: 'Ahmad Ali',
        country: 'SY',
        city: 'Damascus',
      };
      const result = await controller.register(dto);
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.role).toBe(UserRole.SELLER);
    });
  });

  describe('POST /auth/login', () => {
    it('should verify OTP and return tokens for existing user', async () => {
      const result = await controller.login({ phone: '+963911234567', code: '123456' });
      expect(result.accessToken).toBe('mock-access-token');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return new token pair', async () => {
      const result = await controller.refreshTokens({ refreshToken: 'old-refresh-token' });
      expect(result.accessToken).toBe('new-access-token');
    });
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

```bash
cd sheep-marketplace/backend
npx jest src/modules/auth/auth.controller.spec.ts --verbose
```

Expected: FAIL — `Cannot find module './auth.controller'`

- [ ] **Step 6: Implement AuthService**

Create `backend/src/modules/auth/auth.service.ts`:

```typescript
import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { OtpService } from './otp.service';
import { RegisterDto } from './dto/register.dto';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private otpService: OtpService,
    private configService: ConfigService,
  ) {}

  async sendOtp(phone: string): Promise<{ message: string }> {
    this.otpService.generateOtp(phone);
    return { message: 'OTP sent' };
  }

  async register(dto: RegisterDto) {
    const isValid = this.otpService.verifyOtp(dto.phone, dto.code);
    if (!isValid) throw new BadRequestException('Invalid or expired OTP');

    const existingUser = await this.usersService.findByPhone(dto.phone);
    if (existingUser) throw new BadRequestException('Phone number already registered');

    const user = await this.usersService.createUser({
      phone: dto.phone,
      role: dto.role,
      fullName: dto.fullName,
      country: dto.country,
      city: dto.city,
      email: dto.email,
      preferredLanguage: dto.preferredLanguage,
    });

    const tokens = await this.generateTokens(user);
    return { ...tokens, user: { id: user.id, phone: user.phone, role: user.role } };
  }

  async login(phone: string, code: string) {
    const isValid = this.otpService.verifyOtp(phone, code);
    if (!isValid) throw new UnauthorizedException('Invalid or expired OTP');

    const user = await this.usersService.findByPhone(phone);
    if (!user) throw new UnauthorizedException('User not found');

    const tokens = await this.generateTokens(user);
    return { ...tokens, user: { id: user.id, phone: user.phone, role: user.role } };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      const user = await this.usersService.findById(payload.sub);
      if (!user) throw new UnauthorizedException();
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(user: User) {
    const payload = { sub: user.id, phone: user.phone, role: user.role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRATION', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
```

- [ ] **Step 7: Implement AuthController**

Create `backend/src/modules/auth/auth.controller.ts`:

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('otp/send')
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.phone);
  }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: VerifyOtpDto) {
    return this.authService.login(dto.phone, dto.code);
  }

  @Post('refresh')
  async refreshTokens(@Body() body: { refreshToken: string }) {
    return this.authService.refreshTokens(body.refreshToken);
  }
}
```

- [ ] **Step 8: Create AuthModule**

Create `backend/src/modules/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
cd sheep-marketplace/backend
npx jest src/modules/auth/auth.controller.spec.ts --verbose
```

Expected: All 4 tests PASS.

- [ ] **Step 10: Register AuthModule in AppModule**

Update `backend/src/app.module.ts` imports array — add:

```typescript
import { AuthModule } from './modules/auth/auth.module';

// In @Module imports array, add:
AuthModule,
```

- [ ] **Step 11: Commit**

```bash
cd sheep-marketplace
git add .
git commit -m "feat: add auth module with OTP, JWT, registration, and login"
```

---

### Task 6: Users Module — Controller & KYC Endpoints

**Files:**
- Create: `backend/src/modules/users/users.controller.ts`
- Modify: `backend/src/modules/users/users.module.ts`
- Test: `backend/src/modules/users/users.controller.spec.ts`

- [ ] **Step 1: Write the failing test for UsersController**

Create `backend/src/modules/users/users.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserRole, KycStatus } from '../../shared/enums';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUser = {
    id: 'test-uuid',
    role: UserRole.SELLER,
    fullName: 'Ahmad Ali',
    phone: '+963911234567',
    country: 'SY',
    city: 'Damascus',
    kycStatus: KycStatus.PENDING,
  };

  const mockUsersService = {
    findById: jest.fn().mockResolvedValue(mockUser),
    updateProfile: jest.fn().mockResolvedValue(undefined),
    updateKycDocuments: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('GET /users/me', () => {
    it('should return the current user profile', async () => {
      const result = await controller.getProfile(mockUser as any);
      expect(result).toEqual(mockUser);
    });
  });

  describe('PATCH /users/me', () => {
    it('should update the current user profile', async () => {
      await controller.updateProfile(mockUser as any, { fullName: 'Ahmad Updated' });
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith('test-uuid', {
        fullName: 'Ahmad Updated',
      });
    });
  });

  describe('POST /users/me/kyc', () => {
    it('should upload KYC documents', async () => {
      const dto = { documentType: 'national_id', documentUrl: 'https://s3.../doc.pdf' };
      await controller.uploadKyc(mockUser as any, dto);
      expect(mockUsersService.updateKycDocuments).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd sheep-marketplace/backend
npx jest src/modules/users/users.controller.spec.ts --verbose
```

Expected: FAIL — `Cannot find module './users.controller'`

- [ ] **Step 3: Implement UsersController**

Create `backend/src/modules/users/users.controller.ts`:

```typescript
import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { User } from './user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { KycUploadDto } from './dto/kyc-upload.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getProfile(@CurrentUser() user: User) {
    return this.usersService.findById(user.id);
  }

  @Patch('me')
  async updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    await this.usersService.updateProfile(user.id, dto);
    return this.usersService.findById(user.id);
  }

  @Post('me/kyc')
  async uploadKyc(@CurrentUser() user: User, @Body() dto: KycUploadDto) {
    const currentUser = await this.usersService.findById(user.id);
    const documents = { ...currentUser.kycDocuments, [dto.documentType]: dto.documentUrl };
    await this.usersService.updateKycDocuments(user.id, documents);
    return { message: 'KYC document uploaded, pending verification' };
  }
}
```

- [ ] **Step 4: Update UsersModule to include controller**

Update `backend/src/modules/users/users.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd sheep-marketplace/backend
npx jest src/modules/users/users.controller.spec.ts --verbose
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
cd sheep-marketplace
git add .
git commit -m "feat: add users controller with profile and KYC endpoints"
```

---

### Task 7: Listings Module

**Files:**
- Create: `backend/src/modules/listings/listing.entity.ts`
- Create: `backend/src/modules/listings/listings.service.ts`
- Create: `backend/src/modules/listings/listings.controller.ts`
- Create: `backend/src/modules/listings/listings.module.ts`
- Create: `backend/src/modules/listings/dto/create-listing.dto.ts`
- Create: `backend/src/modules/listings/dto/update-listing.dto.ts`
- Create: `backend/src/modules/listings/dto/search-listings.dto.ts`
- Test: `backend/src/modules/listings/listings.controller.spec.ts`

- [ ] **Step 1: Create Listing entity**

Create `backend/src/modules/listings/listing.entity.ts`:

```typescript
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
import { Breed, Currency, ListingStatus, HealthStatus } from '../../shared/enums';

@Entity('listings')
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'seller_id' })
  sellerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @Column()
  title: string;

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

  @Column({ name: 'origin_country' })
  originCountry: string;

  @Column({ name: 'origin_city' })
  originCity: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', default: [] })
  images: string[];

  @Column({ nullable: true, name: 'video_url' })
  videoUrl: string;

  @Column({ type: 'enum', enum: HealthStatus, default: HealthStatus.UNCHECKED, name: 'health_status' })
  healthStatus: HealthStatus;

  @Column({ nullable: true, name: 'certificate_id' })
  certificateId: string;

  @Column({ type: 'enum', enum: ListingStatus, default: ListingStatus.ACTIVE })
  status: ListingStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Create listing DTOs**

Create `backend/src/modules/listings/dto/create-listing.dto.ts`:

```typescript
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Breed, Currency } from '../../../shared/enums';

export class CreateListingDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsEnum(Breed)
  breed: Breed;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsInt()
  @Min(1)
  ageMonths: number;

  @IsNumber()
  @Min(0.1)
  weightKg: number;

  @IsNumber()
  @Min(0.01)
  pricePerHead: number;

  @IsNotEmpty()
  @IsEnum(Currency)
  currency: Currency;

  @IsNotEmpty()
  @IsString()
  originCountry: string;

  @IsNotEmpty()
  @IsString()
  originCity: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  images: string[];

  @IsOptional()
  @IsString()
  videoUrl?: string;
}
```

Create `backend/src/modules/listings/dto/update-listing.dto.ts`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateListingDto } from './create-listing.dto';

export class UpdateListingDto extends PartialType(CreateListingDto) {}
```

Create `backend/src/modules/listings/dto/search-listings.dto.ts`:

```typescript
import { IsOptional, IsEnum, IsNumber, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Breed, HealthStatus } from '../../../shared/enums';

export class SearchListingsDto {
  @IsOptional()
  @IsEnum(Breed)
  breed?: Breed;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minQuantity?: number;

  @IsOptional()
  @IsString()
  originCountry?: string;

  @IsOptional()
  @IsEnum(HealthStatus)
  healthStatus?: HealthStatus;

  @IsOptional()
  @IsString()
  sortBy?: 'newest' | 'price_asc' | 'price_desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
```

- [ ] **Step 3: Write the failing test for ListingsController**

Create `backend/src/modules/listings/listings.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { Breed, Currency, ListingStatus, UserRole, KycStatus } from '../../shared/enums';

describe('ListingsController', () => {
  let controller: ListingsController;

  const mockSeller = {
    id: 'seller-uuid',
    role: UserRole.SELLER,
    kycStatus: KycStatus.VERIFIED,
  };

  const mockListing = {
    id: 'listing-uuid',
    sellerId: 'seller-uuid',
    title: 'Awassi Sheep from Damascus',
    breed: Breed.AWASSI,
    quantity: 50,
    ageMonths: 12,
    weightKg: 45,
    pricePerHead: 200,
    currency: Currency.USD,
    originCountry: 'SY',
    originCity: 'Damascus',
    images: ['img1.jpg', 'img2.jpg'],
    status: ListingStatus.ACTIVE,
  };

  const mockListingsService = {
    create: jest.fn().mockResolvedValue(mockListing),
    findAll: jest.fn().mockResolvedValue({ items: [mockListing], total: 1 }),
    findById: jest.fn().mockResolvedValue(mockListing),
    update: jest.fn().mockResolvedValue({ ...mockListing, title: 'Updated Title' }),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListingsController],
      providers: [{ provide: ListingsService, useValue: mockListingsService }],
    }).compile();

    controller = module.get<ListingsController>(ListingsController);
  });

  describe('POST /listings', () => {
    it('should create a listing for verified seller', async () => {
      const dto = {
        title: 'Awassi Sheep from Damascus',
        breed: Breed.AWASSI,
        quantity: 50,
        ageMonths: 12,
        weightKg: 45,
        pricePerHead: 200,
        currency: Currency.USD,
        originCountry: 'SY',
        originCity: 'Damascus',
        images: ['img1.jpg', 'img2.jpg'],
      };
      const result = await controller.create(mockSeller as any, dto);
      expect(result.breed).toBe(Breed.AWASSI);
      expect(mockListingsService.create).toHaveBeenCalledWith('seller-uuid', dto);
    });
  });

  describe('GET /listings', () => {
    it('should return paginated listings', async () => {
      const result = await controller.findAll({});
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('GET /listings/:id', () => {
    it('should return a single listing', async () => {
      const result = await controller.findOne('listing-uuid');
      expect(result.id).toBe('listing-uuid');
    });
  });

  describe('PATCH /listings/:id', () => {
    it('should update a listing', async () => {
      const result = await controller.update(mockSeller as any, 'listing-uuid', { title: 'Updated Title' });
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('DELETE /listings/:id', () => {
    it('should delete a listing', async () => {
      await controller.remove(mockSeller as any, 'listing-uuid');
      expect(mockListingsService.remove).toHaveBeenCalledWith('listing-uuid', 'seller-uuid');
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd sheep-marketplace/backend
npx jest src/modules/listings/listings.controller.spec.ts --verbose
```

Expected: FAIL — `Cannot find module './listings.controller'`

- [ ] **Step 5: Implement ListingsService**

Create `backend/src/modules/listings/listings.service.ts`:

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Listing } from './listing.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';
import { ListingStatus } from '../../shared/enums';

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingRepository: Repository<Listing>,
  ) {}

  async create(sellerId: string, dto: CreateListingDto): Promise<Listing> {
    const listing = this.listingRepository.create({ ...dto, sellerId });
    return this.listingRepository.save(listing);
  }

  async findAll(query: SearchListingsDto): Promise<{ items: Listing[]; total: number }> {
    const qb: SelectQueryBuilder<Listing> = this.listingRepository
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.seller', 'seller')
      .where('listing.status = :status', { status: ListingStatus.ACTIVE });

    if (query.breed) qb.andWhere('listing.breed = :breed', { breed: query.breed });
    if (query.minPrice) qb.andWhere('listing.price_per_head >= :minPrice', { minPrice: query.minPrice });
    if (query.maxPrice) qb.andWhere('listing.price_per_head <= :maxPrice', { maxPrice: query.maxPrice });
    if (query.minQuantity) qb.andWhere('listing.quantity >= :minQuantity', { minQuantity: query.minQuantity });
    if (query.originCountry) qb.andWhere('listing.origin_country = :origin', { origin: query.originCountry });
    if (query.healthStatus) qb.andWhere('listing.health_status = :hs', { hs: query.healthStatus });

    switch (query.sortBy) {
      case 'price_asc':
        qb.orderBy('listing.price_per_head', 'ASC');
        break;
      case 'price_desc':
        qb.orderBy('listing.price_per_head', 'DESC');
        break;
      default:
        qb.orderBy('listing.created_at', 'DESC');
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findById(id: string): Promise<Listing> {
    const listing = await this.listingRepository.findOne({
      where: { id },
      relations: ['seller'],
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async update(id: string, sellerId: string, dto: UpdateListingDto): Promise<Listing> {
    const listing = await this.findById(id);
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Not your listing');
    Object.assign(listing, dto);
    return this.listingRepository.save(listing);
  }

  async remove(id: string, sellerId: string): Promise<void> {
    const listing = await this.findById(id);
    if (listing.sellerId !== sellerId) throw new ForbiddenException('Not your listing');
    await this.listingRepository.remove(listing);
  }
}
```

- [ ] **Step 6: Implement ListingsController**

Create `backend/src/modules/listings/listings.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '../../shared/enums';
import { User } from '../users/user.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';

@Controller('listings')
export class ListingsController {
  constructor(private listingsService: ListingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async create(@CurrentUser() user: User, @Body() dto: CreateListingDto) {
    return this.listingsService.create(user.id, dto);
  }

  @Get()
  async findAll(@Query() query: SearchListingsDto) {
    return this.listingsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.listingsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateListingDto) {
    return this.listingsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.listingsService.remove(id, user.id);
  }
}
```

- [ ] **Step 7: Create ListingsModule**

Create `backend/src/modules/listings/listings.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from './listing.entity';
import { ListingsService } from './listings.service';
import { ListingsController } from './listings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
```

- [ ] **Step 8: Register ListingsModule in AppModule**

Add to `backend/src/app.module.ts` imports:

```typescript
import { ListingsModule } from './modules/listings/listings.module';
// Add ListingsModule to imports array
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
cd sheep-marketplace/backend
npx jest src/modules/listings/listings.controller.spec.ts --verbose
```

Expected: All 5 tests PASS.

- [ ] **Step 10: Commit**

```bash
cd sheep-marketplace
git add .
git commit -m "feat: add listings module with CRUD, search, filtering, and pagination"
```

---

### Task 8: Orders Module

**Files:**
- Create: `backend/src/modules/orders/order.entity.ts`
- Create: `backend/src/modules/orders/orders.service.ts`
- Create: `backend/src/modules/orders/orders.controller.ts`
- Create: `backend/src/modules/orders/orders.module.ts`
- Create: `backend/src/modules/orders/dto/create-order.dto.ts`
- Create: `backend/src/modules/orders/dto/update-order-status.dto.ts`
- Test: `backend/src/modules/orders/orders.controller.spec.ts`

- [ ] **Step 1: Create Order entity**

Create `backend/src/modules/orders/order.entity.ts`:

```typescript
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
import { OrderStatus } from '../../shared/enums';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'listing_id' })
  listingId: string;

  @ManyToOne(() => Listing)
  @JoinColumn({ name: 'listing_id' })
  listing: Listing;

  @Column({ name: 'buyer_id' })
  buyerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  @Column({ name: 'seller_id' })
  sellerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @Column({ nullable: true, name: 'broker_id' })
  brokerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'broker_id' })
  broker: User;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'unit_price' })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'total_price' })
  totalPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5.0, name: 'commission_rate' })
  commissionRate: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0, name: 'commission_amount' })
  commissionAmount: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ name: 'delivery_country' })
  deliveryCountry: string;

  @Column({ name: 'delivery_city' })
  deliveryCity: string;

  @Column({ type: 'text', name: 'delivery_address' })
  deliveryAddress: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Create order DTOs**

Create `backend/src/modules/orders/dto/create-order.dto.ts`:

```typescript
import { IsNotEmpty, IsString, IsInt, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateOrderDto {
  @IsNotEmpty()
  @IsUUID()
  listingId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0.01)
  unitPrice: number;

  @IsNotEmpty()
  @IsString()
  deliveryCountry: string;

  @IsNotEmpty()
  @IsString()
  deliveryCity: string;

  @IsNotEmpty()
  @IsString()
  deliveryAddress: string;

  @IsOptional()
  @IsUUID()
  brokerId?: string;
}
```

Create `backend/src/modules/orders/dto/update-order-status.dto.ts`:

```typescript
import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../../shared/enums';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
```

- [ ] **Step 3: Write the failing test for OrdersController**

Create `backend/src/modules/orders/orders.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderStatus, UserRole, KycStatus } from '../../shared/enums';

describe('OrdersController', () => {
  let controller: OrdersController;

  const mockBuyer = { id: 'buyer-uuid', role: UserRole.BUYER, kycStatus: KycStatus.VERIFIED };
  const mockSeller = { id: 'seller-uuid', role: UserRole.SELLER, kycStatus: KycStatus.VERIFIED };

  const mockOrder = {
    id: 'order-uuid',
    listingId: 'listing-uuid',
    buyerId: 'buyer-uuid',
    sellerId: 'seller-uuid',
    quantity: 10,
    unitPrice: 200,
    totalPrice: 2000,
    commissionRate: 5.0,
    commissionAmount: 100,
    status: OrderStatus.PENDING,
    deliveryCountry: 'SA',
    deliveryCity: 'Riyadh',
    deliveryAddress: '123 Main St',
  };

  const mockOrdersService = {
    create: jest.fn().mockResolvedValue(mockOrder),
    findByUser: jest.fn().mockResolvedValue([mockOrder]),
    findById: jest.fn().mockResolvedValue(mockOrder),
    updateStatus: jest.fn().mockResolvedValue({ ...mockOrder, status: OrderStatus.ACCEPTED }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  describe('POST /orders', () => {
    it('should create an order', async () => {
      const dto = {
        listingId: 'listing-uuid',
        quantity: 10,
        unitPrice: 200,
        deliveryCountry: 'SA',
        deliveryCity: 'Riyadh',
        deliveryAddress: '123 Main St',
      };
      const result = await controller.create(mockBuyer as any, dto);
      expect(result.status).toBe(OrderStatus.PENDING);
      expect(mockOrdersService.create).toHaveBeenCalledWith('buyer-uuid', dto);
    });
  });

  describe('GET /orders', () => {
    it('should return orders for current user', async () => {
      const result = await controller.findMyOrders(mockBuyer as any);
      expect(result).toHaveLength(1);
    });
  });

  describe('GET /orders/:id', () => {
    it('should return a single order', async () => {
      const result = await controller.findOne(mockBuyer as any, 'order-uuid');
      expect(result.id).toBe('order-uuid');
    });
  });

  describe('PATCH /orders/:id/status', () => {
    it('should update order status', async () => {
      const result = await controller.updateStatus(
        mockSeller as any,
        'order-uuid',
        { status: OrderStatus.ACCEPTED },
      );
      expect(result.status).toBe(OrderStatus.ACCEPTED);
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd sheep-marketplace/backend
npx jest src/modules/orders/orders.controller.spec.ts --verbose
```

Expected: FAIL — `Cannot find module './orders.controller'`

- [ ] **Step 5: Implement OrdersService**

Create `backend/src/modules/orders/orders.service.ts`:

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Order } from './order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus } from '../../shared/enums';
import { OrderCreatedEvent } from '../../shared/interfaces/module-events';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(buyerId: string, dto: CreateOrderDto): Promise<Order> {
    const totalPrice = dto.quantity * dto.unitPrice;
    const commissionRate = 5.0;
    const commissionAmount = totalPrice * (commissionRate / 100);

    const order = this.orderRepository.create({
      ...dto,
      buyerId,
      sellerId: '', // Will be set from listing
      totalPrice,
      commissionRate,
      commissionAmount,
    });

    const saved = await this.orderRepository.save(order);

    this.eventEmitter.emit('order.created', {
      orderId: saved.id,
      buyerId: saved.buyerId,
      sellerId: saved.sellerId,
      listingId: saved.listingId,
      totalPrice: saved.totalPrice,
    } as OrderCreatedEvent);

    return saved;
  }

  async findByUser(userId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: [{ buyerId: userId }, { sellerId: userId }, { brokerId: userId }],
      relations: ['listing', 'buyer', 'seller'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['listing', 'buyer', 'seller'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async updateStatus(id: string, userId: string, status: OrderStatus): Promise<Order> {
    const order = await this.findById(id);
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('Not authorized to update this order');
    }
    order.status = status;

    if (status === OrderStatus.DELIVERED) {
      this.eventEmitter.emit('order.delivered', {
        orderId: order.id,
        buyerId: order.buyerId,
        sellerId: order.sellerId,
      });
    }

    return this.orderRepository.save(order);
  }
}
```

- [ ] **Step 6: Implement OrdersController**

Create `backend/src/modules/orders/orders.controller.ts`:

```typescript
import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.id, dto);
  }

  @Get()
  async findMyOrders(@CurrentUser() user: User) {
    return this.ordersService.findByUser(user.id);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.ordersService.findById(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, user.id, dto.status);
  }
}
```

- [ ] **Step 7: Create OrdersModule and register in AppModule**

Create `backend/src/modules/orders/orders.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
```

Add to `backend/src/app.module.ts`:

```typescript
import { OrdersModule } from './modules/orders/orders.module';
// Add OrdersModule to imports array
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd sheep-marketplace/backend
npx jest src/modules/orders/orders.controller.spec.ts --verbose
```

Expected: All 4 tests PASS.

- [ ] **Step 9: Commit**

```bash
cd sheep-marketplace
git add .
git commit -m "feat: add orders module with order lifecycle and event emission"
```

---

### Task 9: Payments Module — Escrow System

**Files:**
- Create: `backend/src/modules/payments/payment.entity.ts`
- Create: `backend/src/modules/payments/payments.service.ts`
- Create: `backend/src/modules/payments/escrow.service.ts`
- Create: `backend/src/modules/payments/payments.controller.ts`
- Create: `backend/src/modules/payments/payments.module.ts`
- Create: `backend/src/modules/payments/dto/initiate-payment.dto.ts`
- Create: `backend/src/modules/payments/dto/release-payment.dto.ts`
- Test: `backend/src/modules/payments/payments.controller.spec.ts`

- [ ] **Step 1: Create Payment entity**

Create `backend/src/modules/payments/payment.entity.ts`:

```typescript
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
import { Order } from '../orders/order.entity';
import { PaymentMethod, EscrowStatus } from '../../shared/enums';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'payer_id' })
  payerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'payer_id' })
  payer: User;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'seller_amount' })
  sellerAmount: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'commission_amount' })
  commissionAmount: number;

  @Column({ type: 'enum', enum: PaymentMethod })
  method: PaymentMethod;

  @Column({ type: 'enum', enum: EscrowStatus, default: EscrowStatus.HELD, name: 'escrow_status' })
  escrowStatus: EscrowStatus;

  @Column({ nullable: true, name: 'transaction_ref' })
  transactionRef: string;

  @Column({ type: 'timestamp', nullable: true, name: 'paid_at' })
  paidAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'released_at' })
  releasedAt: Date;

  @CreateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Create payment DTOs**

Create `backend/src/modules/payments/dto/initiate-payment.dto.ts`:

```typescript
import { IsNotEmpty, IsUUID, IsEnum } from 'class-validator';
import { PaymentMethod } from '../../../shared/enums';

export class InitiatePaymentDto {
  @IsNotEmpty()
  @IsUUID()
  orderId: string;

  @IsNotEmpty()
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
```

Create `backend/src/modules/payments/dto/release-payment.dto.ts`:

```typescript
import { IsNotEmpty, IsUUID } from 'class-validator';

export class ReleasePaymentDto {
  @IsNotEmpty()
  @IsUUID()
  paymentId: string;
}
```

- [ ] **Step 3: Write the failing test**

Create `backend/src/modules/payments/payments.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { EscrowStatus, PaymentMethod, UserRole } from '../../shared/enums';

describe('PaymentsController', () => {
  let controller: PaymentsController;

  const mockBuyer = { id: 'buyer-uuid', role: UserRole.BUYER };

  const mockPayment = {
    id: 'payment-uuid',
    orderId: 'order-uuid',
    payerId: 'buyer-uuid',
    amount: 2000,
    sellerAmount: 1900,
    commissionAmount: 100,
    method: PaymentMethod.MADA,
    escrowStatus: EscrowStatus.HELD,
    transactionRef: 'TXN-12345',
    paidAt: new Date(),
  };

  const mockPaymentsService = {
    initiatePayment: jest.fn().mockResolvedValue(mockPayment),
    releasePayment: jest.fn().mockResolvedValue({ ...mockPayment, escrowStatus: EscrowStatus.RELEASED }),
    refundPayment: jest.fn().mockResolvedValue({ ...mockPayment, escrowStatus: EscrowStatus.REFUNDED }),
    findByOrder: jest.fn().mockResolvedValue(mockPayment),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: mockPaymentsService }],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  describe('POST /payments/initiate', () => {
    it('should initiate payment and hold in escrow', async () => {
      const result = await controller.initiate(mockBuyer as any, {
        orderId: 'order-uuid',
        method: PaymentMethod.MADA,
      });
      expect(result.escrowStatus).toBe(EscrowStatus.HELD);
      expect(result.amount).toBe(2000);
    });
  });

  describe('POST /payments/release', () => {
    it('should release escrow to seller', async () => {
      const result = await controller.release({ paymentId: 'payment-uuid' });
      expect(result.escrowStatus).toBe(EscrowStatus.RELEASED);
    });
  });

  describe('GET /payments/order/:orderId', () => {
    it('should return payment for an order', async () => {
      const result = await controller.findByOrder('order-uuid');
      expect(result.orderId).toBe('order-uuid');
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd sheep-marketplace/backend
npx jest src/modules/payments/payments.controller.spec.ts --verbose
```

Expected: FAIL — `Cannot find module './payments.controller'`

- [ ] **Step 5: Implement EscrowService**

Create `backend/src/modules/payments/escrow.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '../../shared/enums';

export interface EscrowResult {
  transactionRef: string;
  success: boolean;
}

@Injectable()
export class EscrowService {
  async holdFunds(amount: number, method: PaymentMethod): Promise<EscrowResult> {
    // In production: call STC Pay / Mada / bank transfer API
    const transactionRef = `TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    return { transactionRef, success: true };
  }

  async releaseFunds(transactionRef: string, sellerAmount: number): Promise<boolean> {
    // In production: release funds to seller's account
    return true;
  }

  async refundFunds(transactionRef: string, amount: number): Promise<boolean> {
    // In production: refund to buyer's payment method
    return true;
  }
}
```

- [ ] **Step 6: Implement PaymentsService**

Create `backend/src/modules/payments/payments.service.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Payment } from './payment.entity';
import { EscrowService } from './escrow.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { EscrowStatus } from '../../shared/enums';
import { PaymentCompletedEvent } from '../../shared/interfaces/module-events';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private escrowService: EscrowService,
    private eventEmitter: EventEmitter2,
  ) {}

  async initiatePayment(payerId: string, dto: InitiatePaymentDto, orderAmount: number, commissionAmount: number): Promise<Payment> {
    const escrowResult = await this.escrowService.holdFunds(orderAmount, dto.method);
    if (!escrowResult.success) throw new BadRequestException('Payment failed');

    const payment = this.paymentRepository.create({
      orderId: dto.orderId,
      payerId,
      amount: orderAmount,
      sellerAmount: orderAmount - commissionAmount,
      commissionAmount,
      method: dto.method,
      escrowStatus: EscrowStatus.HELD,
      transactionRef: escrowResult.transactionRef,
      paidAt: new Date(),
    });

    const saved = await this.paymentRepository.save(payment);

    this.eventEmitter.emit('payment.completed', {
      paymentId: saved.id,
      orderId: saved.orderId,
      amount: saved.amount,
    } as PaymentCompletedEvent);

    return saved;
  }

  async releasePayment(paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOneBy({ id: paymentId });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.escrowStatus !== EscrowStatus.HELD) {
      throw new BadRequestException('Payment is not in held status');
    }

    await this.escrowService.releaseFunds(payment.transactionRef, Number(payment.sellerAmount));
    payment.escrowStatus = EscrowStatus.RELEASED;
    payment.releasedAt = new Date();
    return this.paymentRepository.save(payment);
  }

  async refundPayment(paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOneBy({ id: paymentId });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.escrowStatus !== EscrowStatus.HELD) {
      throw new BadRequestException('Payment is not in held status');
    }

    await this.escrowService.refundFunds(payment.transactionRef, Number(payment.amount));
    payment.escrowStatus = EscrowStatus.REFUNDED;
    return this.paymentRepository.save(payment);
  }

  async findByOrder(orderId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOneBy({ orderId });
    if (!payment) throw new NotFoundException('Payment not found for this order');
    return payment;
  }
}
```

- [ ] **Step 7: Implement PaymentsController**

Create `backend/src/modules/payments/payments.controller.ts`:

```typescript
import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ReleasePaymentDto } from './dto/release-payment.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post('initiate')
  async initiate(@CurrentUser() user: User, @Body() dto: InitiatePaymentDto) {
    // In real flow: fetch order to get amount and commission
    return this.paymentsService.initiatePayment(user.id, dto, 0, 0);
  }

  @Post('release')
  async release(@Body() dto: ReleasePaymentDto) {
    return this.paymentsService.releasePayment(dto.paymentId);
  }

  @Get('order/:orderId')
  async findByOrder(@Param('orderId') orderId: string) {
    return this.paymentsService.findByOrder(orderId);
  }
}
```

- [ ] **Step 8: Create PaymentsModule and register in AppModule**

Create `backend/src/modules/payments/payments.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { EscrowService } from './escrow.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment])],
  controllers: [PaymentsController],
  providers: [PaymentsService, EscrowService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
```

Add `PaymentsModule` to `backend/src/app.module.ts` imports.

- [ ] **Step 9: Run tests to verify they pass**

```bash
cd sheep-marketplace/backend
npx jest src/modules/payments/payments.controller.spec.ts --verbose
```

Expected: All 3 tests PASS.

- [ ] **Step 10: Commit**

```bash
cd sheep-marketplace
git add .
git commit -m "feat: add payments module with escrow hold, release, and refund"
```

---

### Task 10: Certificates Module

**Files:**
- Create: `backend/src/modules/certificates/certificate.entity.ts`
- Create: `backend/src/modules/certificates/certificates.service.ts`
- Create: `backend/src/modules/certificates/certificates.controller.ts`
- Create: `backend/src/modules/certificates/certificates.module.ts`
- Create: `backend/src/modules/certificates/dto/upload-certificate.dto.ts`
- Create: `backend/src/modules/certificates/dto/verify-certificate.dto.ts`
- Test: `backend/src/modules/certificates/certificates.controller.spec.ts`

- [ ] **Step 1: Create Certificate entity**

Create `backend/src/modules/certificates/certificate.entity.ts`:

```typescript
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
import { CertificateType, VerificationStatus } from '../../shared/enums';

@Entity('certificates')
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'listing_id' })
  listingId: string;

  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User;

  @Column({ type: 'enum', enum: CertificateType })
  type: CertificateType;

  @Column({ name: 'file_url' })
  fileUrl: string;

  @Column({ name: 'issuing_authority' })
  issuingAuthority: string;

  @Column({ type: 'date', name: 'issue_date' })
  issueDate: Date;

  @Column({ type: 'date', name: 'expiry_date' })
  expiryDate: Date;

  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
    name: 'verification_status',
  })
  verificationStatus: VerificationStatus;

  @Column({ nullable: true, name: 'verified_by' })
  verifiedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'verified_by' })
  verifier: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Create certificate DTOs**

Create `backend/src/modules/certificates/dto/upload-certificate.dto.ts`:

```typescript
import { IsNotEmpty, IsString, IsEnum, IsUUID, IsDateString } from 'class-validator';
import { CertificateType } from '../../../shared/enums';

export class UploadCertificateDto {
  @IsNotEmpty()
  @IsUUID()
  listingId: string;

  @IsNotEmpty()
  @IsEnum(CertificateType)
  type: CertificateType;

  @IsNotEmpty()
  @IsString()
  fileUrl: string;

  @IsNotEmpty()
  @IsString()
  issuingAuthority: string;

  @IsNotEmpty()
  @IsDateString()
  issueDate: string;

  @IsNotEmpty()
  @IsDateString()
  expiryDate: string;
}
```

Create `backend/src/modules/certificates/dto/verify-certificate.dto.ts`:

```typescript
import { IsEnum } from 'class-validator';
import { VerificationStatus } from '../../../shared/enums';

export class VerifyCertificateDto {
  @IsEnum(VerificationStatus)
  status: VerificationStatus;
}
```

- [ ] **Step 3: Write the failing test**

Create `backend/src/modules/certificates/certificates.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { CertificateType, VerificationStatus, UserRole } from '../../shared/enums';

describe('CertificatesController', () => {
  let controller: CertificatesController;

  const mockSeller = { id: 'seller-uuid', role: UserRole.SELLER };
  const mockAdmin = { id: 'admin-uuid', role: UserRole.ADMIN };

  const mockCertificate = {
    id: 'cert-uuid',
    listingId: 'listing-uuid',
    uploadedBy: 'seller-uuid',
    type: CertificateType.HEALTH,
    fileUrl: 'https://s3.../cert.pdf',
    issuingAuthority: 'Syrian Veterinary Authority',
    issueDate: '2026-03-01',
    expiryDate: '2027-03-01',
    verificationStatus: VerificationStatus.PENDING,
  };

  const mockService = {
    upload: jest.fn().mockResolvedValue(mockCertificate),
    findByListing: jest.fn().mockResolvedValue([mockCertificate]),
    verify: jest.fn().mockResolvedValue({
      ...mockCertificate,
      verificationStatus: VerificationStatus.VERIFIED,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CertificatesController],
      providers: [{ provide: CertificatesService, useValue: mockService }],
    }).compile();

    controller = module.get<CertificatesController>(CertificatesController);
  });

  describe('POST /certificates', () => {
    it('should upload a certificate', async () => {
      const dto = {
        listingId: 'listing-uuid',
        type: CertificateType.HEALTH,
        fileUrl: 'https://s3.../cert.pdf',
        issuingAuthority: 'Syrian Veterinary Authority',
        issueDate: '2026-03-01',
        expiryDate: '2027-03-01',
      };
      const result = await controller.upload(mockSeller as any, dto);
      expect(result.verificationStatus).toBe(VerificationStatus.PENDING);
    });
  });

  describe('GET /certificates/listing/:listingId', () => {
    it('should return certificates for a listing', async () => {
      const result = await controller.findByListing('listing-uuid');
      expect(result).toHaveLength(1);
    });
  });

  describe('PATCH /certificates/:id/verify', () => {
    it('should verify a certificate (admin only)', async () => {
      const result = await controller.verify(
        mockAdmin as any,
        'cert-uuid',
        { status: VerificationStatus.VERIFIED },
      );
      expect(result.verificationStatus).toBe(VerificationStatus.VERIFIED);
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
cd sheep-marketplace/backend
npx jest src/modules/certificates/certificates.controller.spec.ts --verbose
```

Expected: FAIL — `Cannot find module './certificates.controller'`

- [ ] **Step 5: Implement CertificatesService**

Create `backend/src/modules/certificates/certificates.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Certificate } from './certificate.entity';
import { UploadCertificateDto } from './dto/upload-certificate.dto';
import { VerificationStatus } from '../../shared/enums';
import { CertificateVerifiedEvent } from '../../shared/interfaces/module-events';

@Injectable()
export class CertificatesService {
  constructor(
    @InjectRepository(Certificate)
    private readonly certificateRepository: Repository<Certificate>,
    private eventEmitter: EventEmitter2,
  ) {}

  async upload(userId: string, dto: UploadCertificateDto): Promise<Certificate> {
    const certificate = this.certificateRepository.create({
      ...dto,
      uploadedBy: userId,
    });
    return this.certificateRepository.save(certificate);
  }

  async findByListing(listingId: string): Promise<Certificate[]> {
    return this.certificateRepository.find({
      where: { listingId },
      order: { createdAt: 'DESC' },
    });
  }

  async verify(certificateId: string, adminId: string, status: VerificationStatus): Promise<Certificate> {
    const certificate = await this.certificateRepository.findOneBy({ id: certificateId });
    if (!certificate) throw new NotFoundException('Certificate not found');

    certificate.verificationStatus = status;
    certificate.verifiedBy = adminId;
    const saved = await this.certificateRepository.save(certificate);

    if (status === VerificationStatus.VERIFIED) {
      this.eventEmitter.emit('certificate.verified', {
        certificateId: saved.id,
        listingId: saved.listingId,
      } as CertificateVerifiedEvent);
    }

    return saved;
  }
}
```

- [ ] **Step 6: Implement CertificatesController**

Create `backend/src/modules/certificates/certificates.controller.ts`:

```typescript
import { Controller, Post, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { CertificatesService } from './certificates.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { UserRole } from '../../shared/enums';
import { User } from '../users/user.entity';
import { UploadCertificateDto } from './dto/upload-certificate.dto';
import { VerifyCertificateDto } from './dto/verify-certificate.dto';

@Controller('certificates')
export class CertificatesController {
  constructor(private certificatesService: CertificatesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async upload(@CurrentUser() user: User, @Body() dto: UploadCertificateDto) {
    return this.certificatesService.upload(user.id, dto);
  }

  @Get('listing/:listingId')
  async findByListing(@Param('listingId') listingId: string) {
    return this.certificatesService.findByListing(listingId);
  }

  @Patch(':id/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async verify(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: VerifyCertificateDto,
  ) {
    return this.certificatesService.verify(id, user.id, dto.status);
  }
}
```

- [ ] **Step 7: Create CertificatesModule and register in AppModule**

Create `backend/src/modules/certificates/certificates.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Certificate } from './certificate.entity';
import { CertificatesService } from './certificates.service';
import { CertificatesController } from './certificates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Certificate])],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
```

Add `CertificatesModule` to `backend/src/app.module.ts` imports.

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd sheep-marketplace/backend
npx jest src/modules/certificates/certificates.controller.spec.ts --verbose
```

Expected: All 3 tests PASS.

- [ ] **Step 9: Commit**

```bash
cd sheep-marketplace
git add .
git commit -m "feat: add certificates module with upload and admin verification"
```

---

### Task 11: Messaging Module — Real-Time Chat

**Files:**
- Create: `backend/src/modules/messaging/conversation.entity.ts`
- Create: `backend/src/modules/messaging/message.entity.ts`
- Create: `backend/src/modules/messaging/messaging.service.ts`
- Create: `backend/src/modules/messaging/messaging.gateway.ts`
- Create: `backend/src/modules/messaging/messaging.controller.ts`
- Create: `backend/src/modules/messaging/messaging.module.ts`
- Create: `backend/src/modules/messaging/dto/create-conversation.dto.ts`
- Create: `backend/src/modules/messaging/dto/send-message.dto.ts`
- Test: `backend/src/modules/messaging/messaging.gateway.spec.ts`

- [ ] **Step 1: Install Socket.io dependencies**

```bash
cd sheep-marketplace/backend
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io
```

- [ ] **Step 2: Create Conversation and Message entities**

Create `backend/src/modules/messaging/conversation.entity.ts`:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Message } from './message.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { array: true, name: 'participant_ids' })
  participantIds: string[];

  @Column({ nullable: true, name: 'listing_id' })
  listingId: string;

  @Column({ nullable: true, name: 'order_id' })
  orderId: string;

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

Create `backend/src/modules/messaging/message.entity.ts`:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { MessageType } from '../../shared/enums';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.messages)
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Column({ type: 'timestamp', nullable: true, name: 'read_at' })
  readAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

- [ ] **Step 3: Create messaging DTOs**

Create `backend/src/modules/messaging/dto/create-conversation.dto.ts`:

```typescript
import { IsNotEmpty, IsUUID, IsOptional, IsArray, ArrayMinSize } from 'class-validator';

export class CreateConversationDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(2)
  participantIds: string[];

  @IsOptional()
  @IsUUID()
  listingId?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}
```

Create `backend/src/modules/messaging/dto/send-message.dto.ts`:

```typescript
import { IsNotEmpty, IsString, IsUUID, IsEnum, IsOptional } from 'class-validator';
import { MessageType } from '../../../shared/enums';

export class SendMessageDto {
  @IsNotEmpty()
  @IsUUID()
  conversationId: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType = MessageType.TEXT;
}
```

- [ ] **Step 4: Implement MessagingService**

Create `backend/src/modules/messaging/messaging.service.ts`:

```typescript
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
  ) {}

  async createConversation(dto: CreateConversationDto): Promise<Conversation> {
    const existing = await this.conversationRepository
      .createQueryBuilder('c')
      .where('c.participant_ids @> :ids AND c.participant_ids <@ :ids', {
        ids: dto.participantIds,
      })
      .andWhere(dto.listingId ? 'c.listing_id = :listingId' : '1=1', { listingId: dto.listingId })
      .getOne();

    if (existing) return existing;

    const conversation = this.conversationRepository.create(dto);
    return this.conversationRepository.save(conversation);
  }

  async sendMessage(senderId: string, dto: SendMessageDto): Promise<Message> {
    const conversation = await this.conversationRepository.findOneBy({ id: dto.conversationId });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (!conversation.participantIds.includes(senderId)) {
      throw new ForbiddenException('Not a participant in this conversation');
    }

    const message = this.messageRepository.create({
      conversationId: dto.conversationId,
      senderId,
      content: dto.content,
      type: dto.type,
    });
    return this.messageRepository.save(message);
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    return this.conversationRepository
      .createQueryBuilder('c')
      .where(':userId = ANY(c.participant_ids)', { userId })
      .orderBy('c.created_at', 'DESC')
      .getMany();
  }

  async getMessages(conversationId: string, userId: string): Promise<Message[]> {
    const conversation = await this.conversationRepository.findOneBy({ id: conversationId });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (!conversation.participantIds.includes(userId)) {
      throw new ForbiddenException('Not a participant');
    }

    return this.messageRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    await this.messageRepository
      .createQueryBuilder()
      .update(Message)
      .set({ readAt: new Date() })
      .where('conversation_id = :conversationId', { conversationId })
      .andWhere('sender_id != :userId', { userId })
      .andWhere('read_at IS NULL')
      .execute();
  }
}
```

- [ ] **Step 5: Write the failing test for MessagingGateway**

Create `backend/src/modules/messaging/messaging.gateway.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MessagingGateway } from './messaging.gateway';
import { MessagingService } from './messaging.service';
import { MessageType } from '../../shared/enums';

describe('MessagingGateway', () => {
  let gateway: MessagingGateway;

  const mockMessage = {
    id: 'msg-uuid',
    conversationId: 'conv-uuid',
    senderId: 'user-uuid',
    content: 'Hello, I want to buy your sheep',
    type: MessageType.TEXT,
    createdAt: new Date(),
  };

  const mockMessagingService = {
    sendMessage: jest.fn().mockResolvedValue(mockMessage),
    markAsRead: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagingGateway,
        { provide: MessagingService, useValue: mockMessagingService },
      ],
    }).compile();

    gateway = module.get<MessagingGateway>(MessagingGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleSendMessage', () => {
    it('should send a message and return it', async () => {
      const client = { data: { userId: 'user-uuid' }, to: jest.fn().mockReturnThis(), emit: jest.fn() };
      const result = await gateway.handleSendMessage(client as any, {
        conversationId: 'conv-uuid',
        content: 'Hello, I want to buy your sheep',
        type: MessageType.TEXT,
      });
      expect(result).toEqual(mockMessage);
      expect(mockMessagingService.sendMessage).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
cd sheep-marketplace/backend
npx jest src/modules/messaging/messaging.gateway.spec.ts --verbose
```

Expected: FAIL — `Cannot find module './messaging.gateway'`

- [ ] **Step 7: Implement MessagingGateway (Socket.io)**

Create `backend/src/modules/messaging/messaging.gateway.ts`:

```typescript
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagingService } from './messaging.service';
import { SendMessageDto } from './dto/send-message.dto';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/chat' })
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private messagingService: MessagingService) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.data.userId = userId;
      client.join(`user:${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    // Cleanup handled automatically by Socket.io
  }

  @SubscribeMessage('joinConversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.join(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const message = await this.messagingService.sendMessage(client.data.userId, dto);
    this.server.to(`conversation:${dto.conversationId}`).emit('newMessage', message);
    return message;
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    await this.messagingService.markAsRead(data.conversationId, client.data.userId);
    this.server.to(`conversation:${data.conversationId}`).emit('messagesRead', {
      conversationId: data.conversationId,
      readBy: client.data.userId,
    });
  }
}
```

- [ ] **Step 8: Implement MessagingController (REST endpoints for history)**

Create `backend/src/modules/messaging/messaging.controller.ts`:

```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Controller('messaging')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private messagingService: MessagingService) {}

  @Post('conversations')
  async createConversation(@Body() dto: CreateConversationDto) {
    return this.messagingService.createConversation(dto);
  }

  @Get('conversations')
  async getConversations(@CurrentUser() user: User) {
    return this.messagingService.getConversations(user.id);
  }

  @Get('conversations/:id/messages')
  async getMessages(@CurrentUser() user: User, @Param('id') id: string) {
    return this.messagingService.getMessages(id, user.id);
  }
}
```

- [ ] **Step 9: Create MessagingModule and register in AppModule**

Create `backend/src/modules/messaging/messaging.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { MessagingGateway } from './messaging.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message])],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingGateway],
  exports: [MessagingService],
})
export class MessagingModule {}
```

Add `MessagingModule` to `backend/src/app.module.ts` imports.

- [ ] **Step 10: Run tests to verify they pass**

```bash
cd sheep-marketplace/backend
npx jest src/modules/messaging/messaging.gateway.spec.ts --verbose
```

Expected: All 2 tests PASS.

- [ ] **Step 11: Commit**

```bash
cd sheep-marketplace
git add .
git commit -m "feat: add messaging module with Socket.io real-time chat and REST history"
```

---

### Task 12: Admin Module

**Files:**
- Create: `backend/src/modules/admin/admin.service.ts`
- Create: `backend/src/modules/admin/admin.controller.ts`
- Create: `backend/src/modules/admin/admin.module.ts`
- Create: `backend/src/modules/admin/dto/admin-query.dto.ts`
- Test: `backend/src/modules/admin/admin.controller.spec.ts`

- [ ] **Step 1: Create admin DTO**

Create `backend/src/modules/admin/dto/admin-query.dto.ts`:

```typescript
import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, KycStatus, OrderStatus } from '../../../shared/enums';

export class AdminUserQueryDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(KycStatus)
  kycStatus?: KycStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class AdminOrderQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
```

- [ ] **Step 2: Write the failing test**

Create `backend/src/modules/admin/admin.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserRole, KycStatus } from '../../shared/enums';

describe('AdminController', () => {
  let controller: AdminController;

  const mockDashboard = {
    totalUsers: 150,
    totalListings: 45,
    activeOrders: 12,
    totalRevenue: 5000,
    pendingKyc: 8,
    pendingCertificates: 3,
    openDisputes: 2,
  };

  const mockAdminService = {
    getDashboardKpis: jest.fn().mockResolvedValue(mockDashboard),
    getUsers: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    updateUserKyc: jest.fn().mockResolvedValue({ id: 'user-uuid', kycStatus: KycStatus.VERIFIED }),
    suspendUser: jest.fn().mockResolvedValue(undefined),
    getOrders: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    flagListing: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: mockAdminService }],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  describe('GET /admin/dashboard', () => {
    it('should return dashboard KPIs', async () => {
      const result = await controller.getDashboard();
      expect(result.totalUsers).toBe(150);
      expect(result.openDisputes).toBe(2);
    });
  });

  describe('GET /admin/users', () => {
    it('should return paginated users', async () => {
      const result = await controller.getUsers({});
      expect(result.items).toEqual([]);
    });
  });

  describe('PATCH /admin/users/:id/kyc', () => {
    it('should update user KYC status', async () => {
      const result = await controller.updateUserKyc('user-uuid', { status: KycStatus.VERIFIED });
      expect(result.kycStatus).toBe(KycStatus.VERIFIED);
    });
  });

  describe('PATCH /admin/listings/:id/flag', () => {
    it('should flag a listing', async () => {
      await controller.flagListing('listing-uuid');
      expect(mockAdminService.flagListing).toHaveBeenCalledWith('listing-uuid');
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd sheep-marketplace/backend
npx jest src/modules/admin/admin.controller.spec.ts --verbose
```

Expected: FAIL — `Cannot find module './admin.controller'`

- [ ] **Step 4: Implement AdminService**

Create `backend/src/modules/admin/admin.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';
import { Order } from '../orders/order.entity';
import { Payment } from '../payments/payment.entity';
import { Certificate } from '../certificates/certificate.entity';
import {
  KycStatus,
  ListingStatus,
  OrderStatus,
  EscrowStatus,
  VerificationStatus,
} from '../../shared/enums';
import { AdminUserQueryDto, AdminOrderQueryDto } from './dto/admin-query.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Listing) private listingRepo: Repository<Listing>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(Certificate) private certRepo: Repository<Certificate>,
  ) {}

  async getDashboardKpis() {
    const [totalUsers, totalListings, activeOrders, pendingKyc, pendingCertificates, openDisputes] =
      await Promise.all([
        this.userRepo.count(),
        this.listingRepo.count({ where: { status: ListingStatus.ACTIVE } }),
        this.orderRepo.count({
          where: [
            { status: OrderStatus.PENDING },
            { status: OrderStatus.ACCEPTED },
            { status: OrderStatus.PAID },
            { status: OrderStatus.IN_TRANSIT },
          ],
        }),
        this.userRepo.count({ where: { kycStatus: KycStatus.PENDING } }),
        this.certRepo.count({ where: { verificationStatus: VerificationStatus.PENDING } }),
        this.orderRepo.count({ where: { status: OrderStatus.DISPUTED } }),
      ]);

    const revenueResult = await this.paymentRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.commission_amount), 0)', 'total')
      .where('p.escrow_status = :status', { status: EscrowStatus.RELEASED })
      .getRawOne();

    return {
      totalUsers,
      totalListings,
      activeOrders,
      totalRevenue: parseFloat(revenueResult.total),
      pendingKyc,
      pendingCertificates,
      openDisputes,
    };
  }

  async getUsers(query: AdminUserQueryDto) {
    const qb = this.userRepo.createQueryBuilder('u');
    if (query.role) qb.andWhere('u.role = :role', { role: query.role });
    if (query.kycStatus) qb.andWhere('u.kyc_status = :kycStatus', { kycStatus: query.kycStatus });

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit).take(limit).orderBy('u.created_at', 'DESC');

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async updateUserKyc(userId: string, status: KycStatus) {
    await this.userRepo.update(userId, { kycStatus: status });
    return this.userRepo.findOneBy({ id: userId });
  }

  async suspendUser(userId: string) {
    // Set KYC to rejected effectively suspends trading ability
    await this.userRepo.update(userId, { kycStatus: KycStatus.REJECTED });
  }

  async getOrders(query: AdminOrderQueryDto) {
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.buyer', 'buyer')
      .leftJoinAndSelect('o.seller', 'seller')
      .leftJoinAndSelect('o.listing', 'listing');

    if (query.status) qb.andWhere('o.status = :status', { status: query.status });

    const page = query.page || 1;
    const limit = query.limit || 20;
    qb.skip((page - 1) * limit).take(limit).orderBy('o.created_at', 'DESC');

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async flagListing(listingId: string) {
    await this.listingRepo.update(listingId, { status: ListingStatus.FLAGGED });
  }
}
```

- [ ] **Step 5: Implement AdminController**

Create `backend/src/modules/admin/admin.controller.ts`:

```typescript
import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { UserRole, KycStatus } from '../../shared/enums';
import { AdminUserQueryDto, AdminOrderQueryDto } from './dto/admin-query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboardKpis();
  }

  @Get('users')
  async getUsers(@Query() query: AdminUserQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Patch('users/:id/kyc')
  async updateUserKyc(@Param('id') id: string, @Body() body: { status: KycStatus }) {
    return this.adminService.updateUserKyc(id, body.status);
  }

  @Patch('users/:id/suspend')
  async suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @Get('orders')
  async getOrders(@Query() query: AdminOrderQueryDto) {
    return this.adminService.getOrders(query);
  }

  @Patch('listings/:id/flag')
  async flagListing(@Param('id') id: string) {
    return this.adminService.flagListing(id);
  }
}
```

- [ ] **Step 6: Create AdminModule and register in AppModule**

Create `backend/src/modules/admin/admin.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';
import { Order } from '../orders/order.entity';
import { Payment } from '../payments/payment.entity';
import { Certificate } from '../certificates/certificate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Listing, Order, Payment, Certificate])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
```

Add `AdminModule` to `backend/src/app.module.ts` imports.

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd sheep-marketplace/backend
npx jest src/modules/admin/admin.controller.spec.ts --verbose
```

Expected: All 4 tests PASS.

- [ ] **Step 8: Commit**

```bash
cd sheep-marketplace
git add .
git commit -m "feat: add admin module with dashboard KPIs, user/order management, listing moderation"
```

---

### Task 13: Final AppModule Integration & Validation Pipe

**Files:**
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/main.ts`

- [ ] **Step 1: Update main.ts with global validation pipe and interceptor**

Replace `backend/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());

  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:8081'], // Admin dashboard + React Native dev
    credentials: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
  console.log(`Sheep Marketplace API running on port ${port}`);
}
bootstrap();
```

- [ ] **Step 2: Ensure final app.module.ts has all modules**

Replace `backend/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import s3Config from './config/s3.config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ListingsModule } from './modules/listings/listings.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, s3Config],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.database'),
        autoLoadEntities: true,
        synchronize: config.get('database.synchronize'),
      }),
    }),
    EventEmitterModule.forRoot(),
    AuthModule,
    UsersModule,
    ListingsModule,
    OrdersModule,
    PaymentsModule,
    MessagingModule,
    CertificatesModule,
    AdminModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 3: Run all tests**

```bash
cd sheep-marketplace/backend
npx jest --verbose
```

Expected: All tests across all modules PASS.

- [ ] **Step 4: Verify the app starts end-to-end**

```bash
cd sheep-marketplace
docker compose up -d
cd backend
npm run start:dev
```

Expected: App starts, connects to PostgreSQL, all routes registered (check console output for route mapping).

- [ ] **Step 5: Create Dockerfile for backend**

Create `backend/Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

- [ ] **Step 6: Commit**

```bash
cd sheep-marketplace
git add .
git commit -m "feat: finalize backend with all modules, global pipes, CORS, and Dockerfile"
```

---

## Summary

| Task | Module | Tests |
|---|---|---|
| 1 | Project scaffolding + Docker | — |
| 2 | Config (DB, Redis, S3) | — |
| 3 | Shared enums, guards, decorators | — |
| 4 | Users entity + service | 5 tests |
| 5 | Auth (OTP, JWT, register, login) | 4 tests |
| 6 | Users controller + KYC | 3 tests |
| 7 | Listings (CRUD, search, filter) | 5 tests |
| 8 | Orders (lifecycle, events) | 4 tests |
| 9 | Payments (escrow) | 3 tests |
| 10 | Certificates (upload, verify) | 3 tests |
| 11 | Messaging (Socket.io + REST) | 2 tests |
| 12 | Admin (dashboard, moderation) | 4 tests |
| 13 | Final integration + Dockerfile | full suite |

**Total: 13 tasks, 33+ unit tests**

## Next Plans

After this backend plan is implemented:
- **Plan 2:** React Native mobile app (all screens, navigation, i18n, RTL)
- **Plan 3:** Next.js admin dashboard (pages, charts, i18n)
