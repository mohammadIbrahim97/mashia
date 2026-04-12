# Livestock Listing Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement G1-US04 (Listing CRUD) + partial G1-US05 (search/filter/sort) for the Mashia backend — including a shared `UploadsModule` for presigned S3 URLs, a `Listing` entity with soft-delete, and 5 listing endpoints with ownership enforcement and KYC verification.

**Architecture:** A new `Listing` entity lives in the existing (empty) `ListingsModule`. Write operations (POST, PATCH, DELETE) require `JwtAuthGuard` + `RolesGuard(SELLER)` + `KycVerifiedGuard`. A new `UploadsModule` provides `POST /uploads/presigned-url` for direct S3 uploads. `S3Service` gains a `getSignedUploadUrl()` method. Ownership checks happen in the service (not guards) to avoid duplicate DB queries.

**Tech Stack:** NestJS 10, TypeORM (QueryBuilder for search), `@aws-sdk/s3-request-presigner` (presigned PUT URLs), `class-validator`/`class-transformer` (DTO validation), `@nestjs/mapped-types` (PartialType), `aws-sdk-client-mock` (tests).

**Preconditions:**
- US01-US03 complete (83 tests passing, AuthModule/UsersModule/KycModule live)
- S3Module (@Global) with S3Service (upload/delete/getSignedReadUrl/ensureBucketExists) working
- KycVerifiedGuard, JwtAuthGuard, RolesGuard, @Roles, @CurrentUser all available
- ListingsModule already imported in app.module.ts (empty `@Module({})` shell)
- All listing scaffold files exist but are empty (single blank line)

**Design spec:** `docs/superpowers/specs/2026-04-12-listing-creation-design.md`

**Test count after completion:** ~111 unit tests (83 existing + ~28 new).

---

## Task 1: Enums + Listing Entity + Module Wiring

**Files:**
- Modify: `backend/src/shared/enums/index.ts`
- Create: `backend/src/modules/listings/listing.entity.ts`
- Modify: `backend/src/modules/listings/listings.module.ts`

- [ ] **Step 1.1: Add 4 new enums to `backend/src/shared/enums/index.ts`**

Append to the end of the file (after `PreferredLanguage`):

```typescript
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
```

- [ ] **Step 1.2: Create `backend/src/modules/listings/listing.entity.ts`**

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
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

  @Column({ name: 'seller_id' })
  sellerId: string;

  @Column({ length: 200 })
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
```

- [ ] **Step 1.3: Update `backend/src/modules/listings/listings.module.ts`**

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

Note: `ListingsService` and `ListingsController` don't exist yet — they're created in Tasks 4-7. This module file will cause a compile error until then. That's expected; the entity + enums are the foundation.

- [ ] **Step 1.4: Create minimal stubs so module compiles**

Create `backend/src/modules/listings/listings.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Listing } from './listing.entity';

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
  ) {}
}
```

Create `backend/src/modules/listings/listings.controller.ts`:

```typescript
import { Controller } from '@nestjs/common';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}
}
```

- [ ] **Step 1.5: Run existing tests to verify no regressions**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest 2>&1 | tail -10
```

Expected: 83 passing tests. The new entity and enums don't break anything.

- [ ] **Step 1.6: Pause for user to commit**

```bash
git add backend/src/shared/enums/index.ts backend/src/modules/listings/
git commit -m "feat(listings): add enums, Listing entity with soft-delete, module wiring (#US04-01)"
```

---

## Task 2: S3Service.getSignedUploadUrl + Test

**Files:**
- Modify: `backend/src/shared/s3/s3.service.ts`
- Modify: `backend/src/shared/s3/s3.service.spec.ts`

- [ ] **Step 2.1: Add failing test to `backend/src/shared/s3/s3.service.spec.ts`**

Add this `describe` block at the end of the file, inside the top-level `describe('S3Service', ...)`:

```typescript
  describe('getSignedUploadUrl', () => {
    it('should return a presigned PUT URL with content type and SSE', async () => {
      const url = await service.getSignedUploadUrl(
        'listings/user1/img-abc.jpg',
        'image/jpeg',
        300,
      );

      expect(typeof url).toBe('string');
      expect(url).toMatch(/listings.*img-abc\.jpg/);
      expect(url).toContain('X-Amz-Signature');
    });
  });
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern s3.service.spec 2>&1 | tail -15
```

Expected: FAIL — `service.getSignedUploadUrl is not a function`.

- [ ] **Step 2.3: Implement `getSignedUploadUrl` in `backend/src/shared/s3/s3.service.ts`**

Add this method to the `S3Service` class, after `getSignedReadUrl`:

```typescript
  async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
```

- [ ] **Step 2.4: Run tests to verify all pass**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern s3.service.spec 2>&1 | tail -15
```

Expected: 6 tests pass (5 existing + 1 new).

- [ ] **Step 2.5: Pause for user to commit**

```bash
git add backend/src/shared/s3/
git commit -m "feat(s3): add getSignedUploadUrl for presigned PUT URLs (#US04-02)"
```

---

## Task 3: UploadsModule (presigned URL endpoint)

**Files:**
- Create: `backend/src/modules/uploads/dto/presigned-url.dto.ts`
- Create: `backend/src/modules/uploads/uploads.service.ts`
- Create: `backend/src/modules/uploads/uploads.controller.ts`
- Create: `backend/src/modules/uploads/uploads.module.ts`
- Create: `backend/src/modules/uploads/uploads.service.spec.ts`
- Create: `backend/src/modules/uploads/uploads.controller.spec.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 3.1: Create `backend/src/modules/uploads/dto/presigned-url.dto.ts`**

```typescript
import { IsIn, IsString, Length } from 'class-validator';

export class PresignedUrlDto {
  @IsIn(['listing', 'certificate'])
  purpose: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType: string;

  @IsString()
  @Length(1, 255)
  fileName: string;
}
```

- [ ] **Step 3.2: Create `backend/src/modules/uploads/uploads.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { S3Service } from '@shared/s3/s3.service';

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const PRESIGN_EXPIRY_SECONDS = 300;

@Injectable()
export class UploadsService {
  constructor(private readonly s3Service: S3Service) {}

  async generatePresignedUploadUrl(
    userId: string,
    purpose: string,
    contentType: string,
    fileName: string,
  ): Promise<{ uploadUrl: string; key: string; expiresIn: number }> {
    const ext = CONTENT_TYPE_TO_EXT[contentType] ?? this.extractExt(fileName);
    const key = `${purpose}s/${userId}/${randomUUID()}.${ext}`;
    const uploadUrl = await this.s3Service.getSignedUploadUrl(
      key,
      contentType,
      PRESIGN_EXPIRY_SECONDS,
    );
    return { uploadUrl, key, expiresIn: PRESIGN_EXPIRY_SECONDS };
  }

  private extractExt(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'bin';
  }
}
```

- [ ] **Step 3.3: Create `backend/src/modules/uploads/uploads.controller.ts`**

```typescript
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { User } from '../users/user.entity';

interface AuthenticatedRequest extends ExpressRequest {
  user: User;
}

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presigned-url')
  @UseGuards(JwtAuthGuard)
  async getPresignedUrl(
    @Body() dto: PresignedUrlDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.uploadsService.generatePresignedUploadUrl(
      req.user.id,
      dto.purpose,
      dto.contentType,
      dto.fileName,
    );
  }
}
```

- [ ] **Step 3.4: Create `backend/src/modules/uploads/uploads.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
```

Note: `S3Module` is `@Global()` so no import needed.

- [ ] **Step 3.5: Register `UploadsModule` in `backend/src/app.module.ts`**

Add import line after the KycModule import:

```typescript
import { UploadsModule } from './modules/uploads/uploads.module';
```

Add `UploadsModule,` to the imports array after `KycModule,`:

```typescript
    KycModule,
    UploadsModule,
    ListingsModule,
```

- [ ] **Step 3.6: Write `backend/src/modules/uploads/uploads.service.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UploadsService } from './uploads.service';
import { S3Service } from '@shared/s3/s3.service';

describe('UploadsService', () => {
  let service: UploadsService;
  let s3Service: jest.Mocked<S3Service>;

  beforeEach(async () => {
    s3Service = {
      getSignedUploadUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned'),
    } as unknown as jest.Mocked<S3Service>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: S3Service, useValue: s3Service },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
  });

  it('generates S3 key with listings/ prefix for listing purpose', async () => {
    const result = await service.generatePresignedUploadUrl(
      'user-123',
      'listing',
      'image/jpeg',
      'photo.jpg',
    );

    expect(result.key).toMatch(/^listings\/user-123\/[a-f0-9-]+\.jpg$/);
    expect(result.uploadUrl).toBe('https://s3.example.com/presigned');
    expect(result.expiresIn).toBe(300);
  });

  it('generates S3 key with certificates/ prefix for certificate purpose', async () => {
    const result = await service.generatePresignedUploadUrl(
      'user-123',
      'certificate',
      'image/png',
      'cert.png',
    );

    expect(result.key).toMatch(/^certificates\/user-123\/[a-f0-9-]+\.png$/);
  });

  it('calls S3Service.getSignedUploadUrl with correct params', async () => {
    await service.generatePresignedUploadUrl(
      'user-123',
      'listing',
      'image/webp',
      'photo.webp',
    );

    expect(s3Service.getSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^listings\/user-123\//),
      'image/webp',
      300,
    );
  });
});
```

- [ ] **Step 3.7: Write `backend/src/modules/uploads/uploads.controller.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { User } from '../users/user.entity';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';

describe('UploadsController', () => {
  let controller: UploadsController;
  let uploadsService: jest.Mocked<UploadsService>;

  const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    role: UserRole.SELLER,
    fullName: 'Ahmad Ali',
    phone: '+966501234567',
    email: null,
    country: 'SA',
    city: 'Riyadh',
    kycStatus: KycStatus.VERIFIED,
    kycDocuments: null,
    preferredLanguage: PreferredLanguage.AR,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockResponse = {
    uploadUrl: 'https://s3.example.com/presigned',
    key: 'listings/550e8400/img-abc.jpg',
    expiresIn: 300,
  };

  beforeEach(async () => {
    uploadsService = {
      generatePresignedUploadUrl: jest.fn().mockResolvedValue(mockResponse),
    } as unknown as jest.Mocked<UploadsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [{ provide: UploadsService, useValue: uploadsService }],
    }).compile();

    controller = module.get<UploadsController>(UploadsController);
  });

  it('returns presigned URL for listing upload', async () => {
    const result = await controller.getPresignedUrl(
      { purpose: 'listing', contentType: 'image/jpeg', fileName: 'photo.jpg' },
      { user: mockUser } as any,
    );

    expect(uploadsService.generatePresignedUploadUrl).toHaveBeenCalledWith(
      mockUser.id,
      'listing',
      'image/jpeg',
      'photo.jpg',
    );
    expect(result).toEqual(mockResponse);
  });

  it('returns presigned URL for certificate upload', async () => {
    await controller.getPresignedUrl(
      { purpose: 'certificate', contentType: 'image/png', fileName: 'cert.png' },
      { user: mockUser } as any,
    );

    expect(uploadsService.generatePresignedUploadUrl).toHaveBeenCalledWith(
      mockUser.id,
      'certificate',
      'image/png',
      'cert.png',
    );
  });

  it('propagates service errors to caller', async () => {
    uploadsService.generatePresignedUploadUrl.mockRejectedValue(new Error('s3 down'));

    await expect(
      controller.getPresignedUrl(
        { purpose: 'listing', contentType: 'image/jpeg', fileName: 'photo.jpg' },
        { user: mockUser } as any,
      ),
    ).rejects.toThrow('s3 down');
  });
});
```

- [ ] **Step 3.8: Run tests**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern uploads 2>&1 | tail -20
```

Expected: 6 tests pass (3 service + 3 controller).

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest 2>&1 | tail -10
```

Expected: 83 + 1 (s3) + 6 (uploads) = 90 passing tests.

- [ ] **Step 3.9: Pause for user to commit**

```bash
git add backend/src/modules/uploads/ backend/src/app.module.ts
git commit -m "feat(uploads): add shared presigned URL endpoint for S3 uploads (#US04-02)"
```

---

## Task 4: CreateListingDto + POST /listings

**Files:**
- Create: `backend/src/modules/listings/dto/create-listing.dto.ts`
- Modify: `backend/src/modules/listings/listings.service.ts`
- Modify: `backend/src/modules/listings/listings.controller.ts`
- Create: `backend/src/modules/listings/listings.service.spec.ts`

- [ ] **Step 4.1: Create `backend/src/modules/listings/dto/create-listing.dto.ts`**

```typescript
import {
  IsString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUrl,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Length,
  Min,
} from 'class-validator';
import { Breed, Currency } from '@shared/enums';

export class CreateListingDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsEnum(Breed)
  breed: Breed;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsInt()
  @Min(0)
  ageMonths: number;

  @IsNumber()
  @Min(0)
  weightKg: number;

  @IsNumber()
  @Min(0)
  pricePerHead: number;

  @IsEnum(Currency)
  currency: Currency;

  @IsString()
  @Length(1, 100)
  originCountry: string;

  @IsString()
  @Length(1, 100)
  originCity: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  images: string[];

  @IsOptional()
  @IsUrl()
  videoUrl?: string;
}
```

- [ ] **Step 4.2: Implement `create()` in `backend/src/modules/listings/listings.service.ts`**

Replace the file with:

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Listing } from './listing.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingStatus, HealthStatus } from '@shared/enums';

@Injectable()
export class ListingsService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
  ) {}

  async create(sellerId: string, dto: CreateListingDto): Promise<Listing> {
    const listing = this.listingsRepository.create({
      ...dto,
      sellerId,
      status: ListingStatus.ACTIVE,
      healthStatus: HealthStatus.UNCHECKED,
    });
    return this.listingsRepository.save(listing);
  }
}
```

- [ ] **Step 4.3: Add POST route to `backend/src/modules/listings/listings.controller.ts`**

Replace the file with:

```typescript
import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { KycVerifiedGuard } from '@shared/guards/kyc-verified.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { User } from '../users/user.entity';
import { UserRole } from '@shared/enums';
import { Listing } from './listing.entity';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, KycVerifiedGuard)
  @Roles(UserRole.SELLER)
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateListingDto,
  ): Promise<Listing> {
    return this.listingsService.create(user.id, dto);
  }
}
```

- [ ] **Step 4.4: Write initial service tests for `create` in `backend/src/modules/listings/listings.service.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { Listing } from './listing.entity';
import {
  Breed,
  Currency,
  ListingStatus,
  HealthStatus,
} from '@shared/enums';
import { CreateListingDto } from './dto/create-listing.dto';

describe('ListingsService', () => {
  let service: ListingsService;
  let repository: jest.Mocked<Repository<Listing>>;

  const sellerId = '550e8400-e29b-41d4-a716-446655440000';

  const createDto: CreateListingDto = {
    title: 'Awassi Sheep Lot',
    breed: Breed.AWASSI,
    quantity: 50,
    ageMonths: 12,
    weightKg: 45.5,
    pricePerHead: 1200,
    currency: Currency.SAR,
    originCountry: 'SY',
    originCity: 'Aleppo',
    description: 'Healthy flock, vaccinated',
    images: ['listings/user1/img1.jpg', 'listings/user1/img2.jpg'],
    videoUrl: 'https://youtube.com/watch?v=abc123',
  };

  const mockListing: Partial<Listing> = {
    id: 'listing-uuid-1',
    sellerId,
    ...createDto,
    status: ListingStatus.ACTIVE,
    healthStatus: HealthStatus.UNCHECKED,
    certificateId: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: getRepositoryToken(Listing), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
    repository = module.get(getRepositoryToken(Listing));
  });

  describe('create', () => {
    it('saves listing with sellerId, status=active, healthStatus=unchecked', async () => {
      repository.create.mockReturnValue(mockListing as Listing);
      repository.save.mockResolvedValue(mockListing as Listing);

      const result = await service.create(sellerId, createDto);

      expect(repository.create).toHaveBeenCalledWith({
        ...createDto,
        sellerId,
        status: ListingStatus.ACTIVE,
        healthStatus: HealthStatus.UNCHECKED,
      });
      expect(repository.save).toHaveBeenCalledWith(mockListing);
      expect(result.status).toBe(ListingStatus.ACTIVE);
      expect(result.healthStatus).toBe(HealthStatus.UNCHECKED);
    });

    it('preserves images array in the saved listing', async () => {
      repository.create.mockReturnValue(mockListing as Listing);
      repository.save.mockResolvedValue(mockListing as Listing);

      const result = await service.create(sellerId, createDto);

      expect(result.images).toEqual([
        'listings/user1/img1.jpg',
        'listings/user1/img2.jpg',
      ]);
    });
  });
});
```

- [ ] **Step 4.5: Run tests**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern listings.service.spec 2>&1 | tail -15
```

Expected: 2 tests pass.

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest 2>&1 | tail -10
```

Expected: 90 + 2 = 92 passing tests.

- [ ] **Step 4.6: Pause for user to commit**

```bash
git add backend/src/modules/listings/
git commit -m "feat(listings): POST /listings with CreateListingDto and KYC guard (#US04-02, #US04-03)"
```

---

## Task 5: Search Endpoint — GET /listings + GET /listings/:id

**Files:**
- Create: `backend/src/modules/listings/dto/search-listings.dto.ts`
- Modify: `backend/src/modules/listings/listings.service.ts`
- Modify: `backend/src/modules/listings/listings.controller.ts`
- Modify: `backend/src/modules/listings/listings.service.spec.ts`

- [ ] **Step 5.1: Create `backend/src/modules/listings/dto/search-listings.dto.ts`**

```typescript
import {
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  IsString,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Breed, HealthStatus } from '@shared/enums';

export class SearchListingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

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
  @Min(0)
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
  @IsIn(['newest', 'price_asc', 'price_desc'])
  sort?: string = 'newest';
}
```

- [ ] **Step 5.2: Add `findAll()` and `findById()` to `backend/src/modules/listings/listings.service.ts`**

Add these methods to the `ListingsService` class after `create()`:

```typescript
  async findAll(
    query: SearchListingsDto,
  ): Promise<{ data: Listing[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.listingsRepository
      .createQueryBuilder('listing')
      .where('listing.status = :status', { status: ListingStatus.ACTIVE });

    if (query.breed) {
      qb.andWhere('listing.breed = :breed', { breed: query.breed });
    }
    if (query.minPrice !== undefined) {
      qb.andWhere('listing.pricePerHead >= :minPrice', {
        minPrice: query.minPrice,
      });
    }
    if (query.maxPrice !== undefined) {
      qb.andWhere('listing.pricePerHead <= :maxPrice', {
        maxPrice: query.maxPrice,
      });
    }
    if (query.minQuantity !== undefined) {
      qb.andWhere('listing.quantity >= :minQuantity', {
        minQuantity: query.minQuantity,
      });
    }
    if (query.originCountry) {
      qb.andWhere('listing.originCountry = :originCountry', {
        originCountry: query.originCountry,
      });
    }
    if (query.healthStatus) {
      qb.andWhere('listing.healthStatus = :healthStatus', {
        healthStatus: query.healthStatus,
      });
    }

    switch (query.sort) {
      case 'price_asc':
        qb.orderBy('listing.pricePerHead', 'ASC');
        break;
      case 'price_desc':
        qb.orderBy('listing.pricePerHead', 'DESC');
        break;
      default:
        qb.orderBy('listing.createdAt', 'DESC');
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findById(id: string): Promise<Listing> {
    const listing = await this.listingsRepository.findOne({
      where: { id },
      relations: ['seller'],
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }
```

Also add the import for `SearchListingsDto` at the top:

```typescript
import { SearchListingsDto } from './dto/search-listings.dto';
```

- [ ] **Step 5.3: Add GET routes to `backend/src/modules/listings/listings.controller.ts`**

Add `Get`, `Param`, `Query` to the `@nestjs/common` import:

```typescript
import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
```

Add the imports for `SearchListingsDto` and `ParseUUIDPipe`:

```typescript
import { ParseUUIDPipe } from '@nestjs/common';
import { SearchListingsDto } from './dto/search-listings.dto';
```

Add the GET routes inside the controller class:

```typescript
  @Get()
  async findAll(@Query() query: SearchListingsDto) {
    return this.listingsService.findAll(query);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<Listing> {
    return this.listingsService.findById(id);
  }
```

- [ ] **Step 5.4: Add findAll + findById tests to `backend/src/modules/listings/listings.service.spec.ts`**

Add `SearchListingsDto` import at the top:

```typescript
import { SearchListingsDto } from './dto/search-listings.dto';
```

Add these `describe` blocks after the existing `describe('create', ...)`:

```typescript
  describe('findAll', () => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockListing], 1]),
    };

    beforeEach(() => {
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      // Reset all query builder mocks
      Object.values(mockQueryBuilder).forEach((fn) => (fn as jest.Mock).mockClear());
      mockQueryBuilder.where.mockReturnThis();
      mockQueryBuilder.andWhere.mockReturnThis();
      mockQueryBuilder.orderBy.mockReturnThis();
      mockQueryBuilder.skip.mockReturnThis();
      mockQueryBuilder.take.mockReturnThis();
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockListing], 1]);
    });

    it('returns paginated results with defaults (page=1, limit=20)', async () => {
      const result = await service.findAll({});

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'listing.status = :status',
        { status: ListingStatus.ACTIVE },
      );
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
      expect(result).toEqual({ data: [mockListing], total: 1, page: 1, limit: 20 });
    });

    it('filters by breed', async () => {
      await service.findAll({ breed: Breed.AWASSI });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'listing.breed = :breed',
        { breed: Breed.AWASSI },
      );
    });

    it('filters by price range', async () => {
      await service.findAll({ minPrice: 500, maxPrice: 2000 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'listing.pricePerHead >= :minPrice',
        { minPrice: 500 },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'listing.pricePerHead <= :maxPrice',
        { maxPrice: 2000 },
      );
    });

    it('filters by minQuantity', async () => {
      await service.findAll({ minQuantity: 10 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'listing.quantity >= :minQuantity',
        { minQuantity: 10 },
      );
    });

    it('filters by originCountry', async () => {
      await service.findAll({ originCountry: 'SY' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'listing.originCountry = :originCountry',
        { originCountry: 'SY' },
      );
    });

    it('filters by healthStatus', async () => {
      await service.findAll({ healthStatus: HealthStatus.CERTIFIED });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'listing.healthStatus = :healthStatus',
        { healthStatus: HealthStatus.CERTIFIED },
      );
    });

    it('sorts by newest (default), price_asc, price_desc', async () => {
      await service.findAll({});
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('listing.createdAt', 'DESC');

      mockQueryBuilder.orderBy.mockClear();
      await service.findAll({ sort: 'price_asc' });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('listing.pricePerHead', 'ASC');

      mockQueryBuilder.orderBy.mockClear();
      await service.findAll({ sort: 'price_desc' });
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('listing.pricePerHead', 'DESC');
    });

    it('only returns active listings', async () => {
      await service.findAll({});

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'listing.status = :status',
        { status: ListingStatus.ACTIVE },
      );
    });
  });

  describe('findById', () => {
    it('returns listing with seller relation', async () => {
      repository.findOne.mockResolvedValue(mockListing as Listing);

      const result = await service.findById('listing-uuid-1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'listing-uuid-1' },
        relations: ['seller'],
      });
      expect(result).toEqual(mockListing);
    });

    it('throws NotFoundException when listing not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
```

- [ ] **Step 5.5: Run tests**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern listings.service.spec 2>&1 | tail -25
```

Expected: 12 tests pass (2 create + 8 findAll + 2 findById).

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest 2>&1 | tail -10
```

Expected: 92 + 10 = 102 passing tests.

- [ ] **Step 5.6: Pause for user to commit**

```bash
git add backend/src/modules/listings/
git commit -m "feat(listings): GET /listings with filters/pagination/sort + GET /:id with seller join"
```

---

## Task 6: UpdateListingDto + PATCH /listings/:id

**Files:**
- Create: `backend/src/modules/listings/dto/update-listing.dto.ts`
- Modify: `backend/src/modules/listings/listings.service.ts`
- Modify: `backend/src/modules/listings/listings.controller.ts`
- Modify: `backend/src/modules/listings/listings.service.spec.ts`

- [ ] **Step 6.1: Create `backend/src/modules/listings/dto/update-listing.dto.ts`**

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsIn } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';
import { ListingStatus } from '@shared/enums';

export class UpdateListingDto extends PartialType(CreateListingDto) {
  @IsOptional()
  @IsIn([ListingStatus.ACTIVE, ListingStatus.SOLD])
  status?: ListingStatus;
}
```

- [ ] **Step 6.2: Add `update()` to `backend/src/modules/listings/listings.service.ts`**

Add the import for `UpdateListingDto`:

```typescript
import { UpdateListingDto } from './dto/update-listing.dto';
```

Add this method after `findById()`:

```typescript
  async update(
    id: string,
    sellerId: string,
    dto: UpdateListingDto,
  ): Promise<Listing> {
    const listing = await this.listingsRepository.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException('You can only update your own listings');
    }
    Object.assign(listing, dto);
    return this.listingsRepository.save(listing);
  }
```

- [ ] **Step 6.3: Add PATCH route to `backend/src/modules/listings/listings.controller.ts`**

Add `Patch` to the `@nestjs/common` import:

```typescript
import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
```

Add `UpdateListingDto` import:

```typescript
import { UpdateListingDto } from './dto/update-listing.dto';
```

Add the route inside the controller class:

```typescript
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, KycVerifiedGuard)
  @Roles(UserRole.SELLER)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateListingDto,
  ): Promise<Listing> {
    return this.listingsService.update(id, user.id, dto);
  }
```

- [ ] **Step 6.4: Add update tests to `backend/src/modules/listings/listings.service.spec.ts`**

Add `UpdateListingDto` import:

```typescript
import { UpdateListingDto } from './dto/update-listing.dto';
```

Add this `describe` block after `describe('findById', ...)`:

```typescript
  describe('update', () => {
    it('updates fields when caller is the owner', async () => {
      repository.findOne.mockResolvedValue({ ...mockListing, sellerId } as Listing);
      repository.save.mockResolvedValue({
        ...mockListing,
        title: 'Updated Title',
      } as Listing);

      const result = await service.update(
        'listing-uuid-1',
        sellerId,
        { title: 'Updated Title' },
      );

      expect(repository.save).toHaveBeenCalled();
      expect(result.title).toBe('Updated Title');
    });

    it('throws ForbiddenException when caller is not the owner', async () => {
      repository.findOne.mockResolvedValue({
        ...mockListing,
        sellerId: 'different-seller',
      } as Listing);

      await expect(
        service.update('listing-uuid-1', sellerId, { title: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.save).not.toHaveBeenCalled();
    });

    it('allows seller to set status to sold', async () => {
      repository.findOne.mockResolvedValue({ ...mockListing, sellerId } as Listing);
      repository.save.mockImplementation(async (entity) => entity as Listing);

      const result = await service.update(
        'listing-uuid-1',
        sellerId,
        { status: ListingStatus.SOLD },
      );

      expect(result.status).toBe(ListingStatus.SOLD);
    });

    it('throws NotFoundException when listing does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', sellerId, { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
```

- [ ] **Step 6.5: Run tests**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern listings.service.spec 2>&1 | tail -25
```

Expected: 16 tests pass (12 existing + 4 new update tests).

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest 2>&1 | tail -10
```

Expected: 102 + 4 = 106 passing tests.

- [ ] **Step 6.6: Pause for user to commit**

```bash
git add backend/src/modules/listings/
git commit -m "feat(listings): PATCH /listings/:id with ownership check (#US04-04)"
```

---

## Task 7: DELETE /listings/:id (soft delete)

**Files:**
- Modify: `backend/src/modules/listings/listings.service.ts`
- Modify: `backend/src/modules/listings/listings.controller.ts`
- Modify: `backend/src/modules/listings/listings.service.spec.ts`

- [ ] **Step 7.1: Add `remove()` to `backend/src/modules/listings/listings.service.ts`**

Add this method after `update()`:

```typescript
  async remove(id: string, sellerId: string): Promise<{ message: string }> {
    const listing = await this.listingsRepository.findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException('You can only delete your own listings');
    }
    await this.listingsRepository.softDelete(id);
    return { message: 'Listing deleted' };
  }
```

- [ ] **Step 7.2: Add DELETE route to `backend/src/modules/listings/listings.controller.ts`**

Add `Delete` to the `@nestjs/common` import:

```typescript
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
```

Add the route inside the controller class:

```typescript
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, KycVerifiedGuard)
  @Roles(UserRole.SELLER)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    return this.listingsService.remove(id, user.id);
  }
```

- [ ] **Step 7.3: Add remove tests to `backend/src/modules/listings/listings.service.spec.ts`**

Add this `describe` block after `describe('update', ...)`:

```typescript
  describe('remove', () => {
    it('soft-deletes when caller is the owner', async () => {
      repository.findOne.mockResolvedValue({ ...mockListing, sellerId } as Listing);
      repository.softDelete.mockResolvedValue({ affected: 1 } as any);

      const result = await service.remove('listing-uuid-1', sellerId);

      expect(repository.softDelete).toHaveBeenCalledWith('listing-uuid-1');
      expect(result).toEqual({ message: 'Listing deleted' });
    });

    it('throws ForbiddenException when caller is not the owner', async () => {
      repository.findOne.mockResolvedValue({
        ...mockListing,
        sellerId: 'different-seller',
      } as Listing);

      await expect(
        service.remove('listing-uuid-1', sellerId),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when listing does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.remove('nonexistent', sellerId),
      ).rejects.toThrow(NotFoundException);
    });
  });
```

- [ ] **Step 7.4: Run tests**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern listings.service.spec 2>&1 | tail -25
```

Expected: 19 tests pass (16 existing + 3 new remove tests).

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest 2>&1 | tail -10
```

Expected: 106 + 3 = 109 passing tests.

- [ ] **Step 7.5: Pause for user to commit**

```bash
git add backend/src/modules/listings/
git commit -m "feat(listings): DELETE /listings/:id with soft-delete and ownership check (#US04-05)"
```

---

## Task 8: Listings Controller Tests + Final Verification

**Files:**
- Create: `backend/src/modules/listings/listings.controller.spec.ts`

- [ ] **Step 8.1: Write `backend/src/modules/listings/listings.controller.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { User } from '../users/user.entity';
import { Listing } from './listing.entity';
import {
  UserRole,
  KycStatus,
  PreferredLanguage,
  Breed,
  Currency,
  ListingStatus,
  HealthStatus,
} from '@shared/enums';

describe('ListingsController', () => {
  let controller: ListingsController;
  let listingsService: jest.Mocked<ListingsService>;

  const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    role: UserRole.SELLER,
    fullName: 'Ahmad Ali',
    phone: '+966501234567',
    email: null,
    country: 'SA',
    city: 'Riyadh',
    kycStatus: KycStatus.VERIFIED,
    kycDocuments: null,
    preferredLanguage: PreferredLanguage.AR,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockListing: Partial<Listing> = {
    id: 'listing-uuid-1',
    sellerId: mockUser.id,
    title: 'Awassi Sheep',
    breed: Breed.AWASSI,
    quantity: 50,
    ageMonths: 12,
    weightKg: 45.5,
    pricePerHead: 1200,
    currency: Currency.SAR,
    originCountry: 'SY',
    originCity: 'Aleppo',
    images: ['listings/user1/img1.jpg', 'listings/user1/img2.jpg'],
    status: ListingStatus.ACTIVE,
    healthStatus: HealthStatus.UNCHECKED,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockPaginatedResult = {
    data: [mockListing as Listing],
    total: 1,
    page: 1,
    limit: 20,
  };

  beforeEach(async () => {
    listingsService = {
      create: jest.fn().mockResolvedValue(mockListing),
      findAll: jest.fn().mockResolvedValue(mockPaginatedResult),
      findById: jest.fn().mockResolvedValue(mockListing),
      update: jest.fn().mockResolvedValue(mockListing),
      remove: jest.fn().mockResolvedValue({ message: 'Listing deleted' }),
    } as unknown as jest.Mocked<ListingsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListingsController],
      providers: [{ provide: ListingsService, useValue: listingsService }],
    }).compile();

    controller = module.get<ListingsController>(ListingsController);
  });

  describe('create', () => {
    it('delegates to service.create with user.id and dto', async () => {
      const dto = {
        title: 'Awassi Sheep',
        breed: Breed.AWASSI,
        quantity: 50,
        ageMonths: 12,
        weightKg: 45.5,
        pricePerHead: 1200,
        currency: Currency.SAR,
        originCountry: 'SY',
        originCity: 'Aleppo',
        images: ['key1', 'key2'],
      };

      const result = await controller.create(mockUser, dto as any);

      expect(listingsService.create).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toEqual(mockListing);
    });
  });

  describe('findAll', () => {
    it('delegates to service.findAll with query params', async () => {
      const query = { breed: Breed.AWASSI, page: 2, limit: 10 };

      const result = await controller.findAll(query as any);

      expect(listingsService.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockPaginatedResult);
    });
  });

  describe('findById', () => {
    it('delegates to service.findById', async () => {
      const result = await controller.findById('listing-uuid-1');

      expect(listingsService.findById).toHaveBeenCalledWith('listing-uuid-1');
      expect(result).toEqual(mockListing);
    });
  });

  describe('update', () => {
    it('delegates to service.update with id, user.id, and dto', async () => {
      const result = await controller.update(
        'listing-uuid-1',
        mockUser,
        { title: 'Updated' } as any,
      );

      expect(listingsService.update).toHaveBeenCalledWith(
        'listing-uuid-1',
        mockUser.id,
        { title: 'Updated' },
      );
      expect(result).toEqual(mockListing);
    });
  });

  describe('remove', () => {
    it('delegates to service.remove with id and user.id', async () => {
      const result = await controller.remove('listing-uuid-1', mockUser);

      expect(listingsService.remove).toHaveBeenCalledWith(
        'listing-uuid-1',
        mockUser.id,
      );
      expect(result).toEqual({ message: 'Listing deleted' });
    });
  });
});
```

- [ ] **Step 8.2: Run the new test file**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern listings.controller.spec 2>&1 | tail -20
```

Expected: 5 tests pass.

- [ ] **Step 8.3: Run the full suite**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest 2>&1 | tail -15
```

Expected: 109 + 5 = **114 passing tests** across the whole project.

- [ ] **Step 8.4: Pause for user to commit and close issues**

```bash
git add backend/src/modules/listings/listings.controller.spec.ts
git commit -m "test(listings): add controller passthrough tests (#US04-06)"
```

After commit, close GitHub issues:
- US04-01 (Listing entity)
- US04-02 (POST /listings restricted to verified sellers)
- US04-03 (Image validation min 2, max 10)
- US04-04 (PATCH /listings/:id restricted to owner)
- US04-05 (DELETE /listings/:id restricted to owner)
- US04-06 (Unit tests)
- Parent US04 user story

---

## Post-Implementation Verification Checklist

After all 8 tasks are done, confirm:

- [ ] `npx jest` reports ~114 tests passing
- [ ] Enums `Breed`, `Currency`, `ListingStatus`, `HealthStatus` exist in `shared/enums/index.ts`
- [ ] `Listing` entity has `@DeleteDateColumn` for soft delete
- [ ] `POST /uploads/presigned-url` returns `{ uploadUrl, key, expiresIn }`
- [ ] `POST /listings` requires `JwtAuthGuard` + `RolesGuard(SELLER)` + `KycVerifiedGuard`
- [ ] `GET /listings` is public, returns `{ data, total, page, limit }`
- [ ] `GET /listings/:id` is public, returns listing with seller joined
- [ ] `PATCH /listings/:id` enforces ownership in service
- [ ] `DELETE /listings/:id` uses `softDelete`, enforces ownership
- [ ] `UpdateListingDto.status` restricted to `active` and `sold` only
- [ ] No changes to unrelated modules
- [ ] No commits by subagents — all commits are manual

## Known Deferred Items

- Batch presigned read URLs for image display → added when mobile integration begins
- Certificate FK linking (listing.certificateId) → US08
- Listing expiry cron → post-MVP
- Admin flagging → US10
- Cross-currency price filtering → post-MVP
- S3 cleanup on soft-delete → S3 lifecycle rules, not app logic
