# OTP Generation & Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement OTP generation and storage with Redis TTL, including all prerequisites (shared enums, User entity, UsersService, Redis module, SMS interface).

**Architecture:** OTP codes stored in Redis with 5-min TTL. Rate limiting via Redis counter (5 sends/hour). SMS sending abstracted behind an interface with a console stub for dev. User entity in PostgreSQL via TypeORM with auto-sync.

**Tech Stack:** NestJS 10, TypeORM, PostgreSQL 16, Redis 7 (ioredis), Jest + ts-jest

**Spec:** `docs/superpowers/specs/2026-04-08-otp-generation-storage-design.md`

---

## File Structure

### New files to create:
| File | Responsibility |
|------|---------------|
| `src/shared/redis/redis.constants.ts` | REDIS_CLIENT injection token |
| `src/shared/redis/redis.module.ts` | Global module providing ioredis client |
| `src/shared/sms/sms.interface.ts` | SmsService interface + SMS_SERVICE token |
| `src/shared/sms/console-sms.service.ts` | Dev stub that logs OTP to console |
| `src/shared/sms/sms.module.ts` | Global module providing SMS_SERVICE |
| `src/modules/users/users.service.spec.ts` | Unit tests for UsersService |
| `src/modules/auth/otp.service.spec.ts` | Unit tests for OtpService |

### Existing empty files to implement:
| File | Responsibility |
|------|---------------|
| `src/shared/enums/index.ts` | UserRole, KycStatus, PreferredLanguage |
| `src/shared/interceptors/transform.interceptor.ts` | Standard API response wrapper |
| `src/modules/users/user.entity.ts` | User table definition |
| `src/modules/users/users.module.ts` | Users module registration |
| `src/modules/users/users.service.ts` | create, findByPhone, findById |
| `src/modules/auth/otp.service.ts` | OTP generation, Redis storage, verification |
| `src/modules/auth/auth.module.ts` | Auth module (OtpService only for now) |
| `src/modules/listings/listings.module.ts` | Empty stub (needed for app to boot) |
| `src/modules/orders/orders.module.ts` | Empty stub |
| `src/modules/payments/payments.module.ts` | Empty stub |
| `src/modules/messaging/messaging.module.ts` | Empty stub |
| `src/modules/certificates/certificates.module.ts` | Empty stub |
| `src/modules/admin/admin.module.ts` | Empty stub |

### Existing files to modify:
| File | Change |
|------|--------|
| `src/app.module.ts` | Add RedisModule, SmsModule imports |

---

## Task 1: Make the App Bootable

The app currently can't start — `app.module.ts` imports 6 empty modules and an empty interceptor. We need minimal stubs so the app boots before we build anything real.

**Files:**
- Implement: `src/shared/interceptors/transform.interceptor.ts`
- Implement: `src/modules/listings/listings.module.ts`
- Implement: `src/modules/orders/orders.module.ts`
- Implement: `src/modules/payments/payments.module.ts`
- Implement: `src/modules/messaging/messaging.module.ts`
- Implement: `src/modules/certificates/certificates.module.ts`
- Implement: `src/modules/admin/admin.module.ts`

- [ ] **Step 1: Install dependencies**

Run: `cd /home/mohammadibrahim/mashia/backend && npm install`
Expected: `added X packages` (no errors)

- [ ] **Step 2: Create .env from .env.example**

Run: `cp /home/mohammadibrahim/mashia/.env.example /home/mohammadibrahim/mashia/backend/.env`

- [ ] **Step 3: Implement TransformInterceptor**

```typescript
// src/shared/interceptors/transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
      })),
    );
  }
}
```

- [ ] **Step 4: Stub all empty modules**

Each module gets the same minimal structure:

```typescript
// src/modules/listings/listings.module.ts
import { Module } from '@nestjs/common';

@Module({})
export class ListingsModule {}
```

```typescript
// src/modules/orders/orders.module.ts
import { Module } from '@nestjs/common';

@Module({})
export class OrdersModule {}
```

```typescript
// src/modules/payments/payments.module.ts
import { Module } from '@nestjs/common';

@Module({})
export class PaymentsModule {}
```

```typescript
// src/modules/messaging/messaging.module.ts
import { Module } from '@nestjs/common';

@Module({})
export class MessagingModule {}
```

```typescript
// src/modules/certificates/certificates.module.ts
import { Module } from '@nestjs/common';

@Module({})
export class CertificatesModule {}
```

```typescript
// src/modules/admin/admin.module.ts
import { Module } from '@nestjs/common';

@Module({})
export class AdminModule {}
```

- [ ] **Step 5: Stub UsersModule and AuthModule (minimal, so app.module.ts resolves)**

```typescript
// src/modules/users/users.module.ts
import { Module } from '@nestjs/common';

@Module({})
export class UsersModule {}
```

```typescript
// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';

@Module({})
export class AuthModule {}
```

- [ ] **Step 6: Verify the app starts**

Run: `cd /home/mohammadibrahim/mashia/backend && npx nest start 2>&1 | head -5`
Expected: `Mashia API running on port 3000` (no import errors)

Then kill the process (Ctrl+C or kill).

- [ ] **Step 7: Commit**

```bash
cd /home/mohammadibrahim/mashia
git add backend/src/shared/interceptors/transform.interceptor.ts \
  backend/src/modules/listings/listings.module.ts \
  backend/src/modules/orders/orders.module.ts \
  backend/src/modules/payments/payments.module.ts \
  backend/src/modules/messaging/messaging.module.ts \
  backend/src/modules/certificates/certificates.module.ts \
  backend/src/modules/admin/admin.module.ts \
  backend/src/modules/users/users.module.ts \
  backend/src/modules/auth/auth.module.ts \
  backend/.env
git commit -m "chore: stub empty modules and interceptor so app boots"
```

---

## Task 2: Shared Enums

**Files:**
- Implement: `src/shared/enums/index.ts`

- [ ] **Step 1: Implement enums**

```typescript
// src/shared/enums/index.ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit src/shared/enums/index.ts`
Expected: No output (clean compile)

- [ ] **Step 3: Commit**

```bash
cd /home/mohammadibrahim/mashia
git add backend/src/shared/enums/index.ts
git commit -m "feat: add UserRole, KycStatus, PreferredLanguage enums"
```

---

## Task 3: Redis Module

**Files:**
- Create: `src/shared/redis/redis.constants.ts`
- Create: `src/shared/redis/redis.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Install ioredis**

Run: `cd /home/mohammadibrahim/mashia/backend && npm install ioredis && npm install -D @types/ioredis`
Expected: `added X packages`

Note: Check if `@types/ioredis` is needed — newer ioredis versions bundle their own types. If install warns "deprecated" or "not found", skip it — ioredis ships types since v5.

- [ ] **Step 2: Create redis constants**

```typescript
// src/shared/redis/redis.constants.ts
export const REDIS_CLIENT = 'REDIS_CLIENT';
```

- [ ] **Step 3: Create RedisModule**

```typescript
// src/shared/redis/redis.module.ts
import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService): Redis => {
        return new Redis({
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleDestroy {
  constructor(private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
```

Wait — the `onModuleDestroy` approach above won't work because the module class itself doesn't get the Redis instance injected that way. Here's the correct approach using `ModuleRef`:

```typescript
// src/shared/redis/redis.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

const redisProvider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService): Redis => {
    return new Redis({
      host: configService.get<string>('redis.host'),
      port: configService.get<number>('redis.port'),
    });
  },
  inject: [ConfigService],
};

@Global()
@Module({
  providers: [redisProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
```

Cleanup is handled by ioredis internally when the Node process exits. For explicit cleanup in tests, inject REDIS_CLIENT and call `quit()`.

- [ ] **Step 4: Add RedisModule to app.module.ts**

In `src/app.module.ts`, add the import and add `RedisModule` to the imports array:

```typescript
// Add to top imports:
import { RedisModule } from './shared/redis/redis.module';

// Add to @Module imports array, after EventEmitterModule.forRoot():
RedisModule,
```

- [ ] **Step 5: Verify app starts with Redis connected**

Make sure Docker containers are running: `docker compose -f /home/mohammadibrahim/mashia/docker-compose.yml ps`

Run: `cd /home/mohammadibrahim/mashia/backend && timeout 10 npx nest start 2>&1 || true`
Expected: `Mashia API running on port 3000` (no Redis connection errors)

- [ ] **Step 6: Commit**

```bash
cd /home/mohammadibrahim/mashia
git add backend/src/shared/redis/redis.constants.ts \
  backend/src/shared/redis/redis.module.ts \
  backend/src/app.module.ts \
  backend/package.json backend/package-lock.json
git commit -m "feat: add global Redis module with ioredis"
```

---

## Task 4: SMS Interface + Console Stub

**Files:**
- Create: `src/shared/sms/sms.interface.ts`
- Create: `src/shared/sms/console-sms.service.ts`
- Create: `src/shared/sms/sms.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Create SMS interface and token**

```typescript
// src/shared/sms/sms.interface.ts
export interface SmsService {
  sendOtp(phone: string, code: string): Promise<void>;
}

export const SMS_SERVICE = 'SMS_SERVICE';
```

- [ ] **Step 2: Create ConsoleSmsService**

```typescript
// src/shared/sms/console-sms.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SmsService } from './sms.interface';

@Injectable()
export class ConsoleSmsService implements SmsService {
  private readonly logger = new Logger('SmsService');

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(`[SMS] OTP for ${phone}: ${code}`);
  }
}
```

- [ ] **Step 3: Create SmsModule**

```typescript
// src/shared/sms/sms.module.ts
import { Global, Module } from '@nestjs/common';
import { SMS_SERVICE } from './sms.interface';
import { ConsoleSmsService } from './console-sms.service';

@Global()
@Module({
  providers: [{ provide: SMS_SERVICE, useClass: ConsoleSmsService }],
  exports: [SMS_SERVICE],
})
export class SmsModule {}
```

- [ ] **Step 4: Add SmsModule to app.module.ts**

In `src/app.module.ts`, add the import and add `SmsModule` to the imports array:

```typescript
// Add to top imports:
import { SmsModule } from './shared/sms/sms.module';

// Add to @Module imports array, after RedisModule:
SmsModule,
```

- [ ] **Step 5: Commit**

```bash
cd /home/mohammadibrahim/mashia
git add backend/src/shared/sms/sms.interface.ts \
  backend/src/shared/sms/console-sms.service.ts \
  backend/src/shared/sms/sms.module.ts \
  backend/src/app.module.ts
git commit -m "feat: add SMS interface with console stub for dev"
```

---

## Task 5: User Entity & UsersService (TDD)

**Files:**
- Implement: `src/modules/users/user.entity.ts`
- Implement: `src/modules/users/users.service.ts`
- Implement: `src/modules/users/users.module.ts` (replace stub)
- Create: `src/modules/users/users.service.spec.ts`

- [ ] **Step 1: Write failing tests for UsersService**

```typescript
// src/modules/users/users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<User>>;

  const mockUser: Partial<User> = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    role: UserRole.BUYER,
    fullName: 'Ahmad Ali',
    phone: '+966501234567',
    email: null,
    country: 'SA',
    city: 'Riyadh',
    kycStatus: KycStatus.PENDING,
    kycDocuments: null,
    preferredLanguage: PreferredLanguage.AR,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get(getRepositoryToken(User));
  });

  describe('create', () => {
    it('should create and save a user', async () => {
      repository.create.mockReturnValue(mockUser as User);
      repository.save.mockResolvedValue(mockUser as User);

      const result = await service.create({
        role: UserRole.BUYER,
        fullName: 'Ahmad Ali',
        phone: '+966501234567',
        country: 'SA',
        city: 'Riyadh',
      });

      expect(repository.create).toHaveBeenCalledWith({
        role: UserRole.BUYER,
        fullName: 'Ahmad Ali',
        phone: '+966501234567',
        country: 'SA',
        city: 'Riyadh',
      });
      expect(repository.save).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockUser);
    });
  });

  describe('findByPhone', () => {
    it('should return a user when found', async () => {
      repository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.findByPhone('+966501234567');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { phone: '+966501234567' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findByPhone('+000000000000');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return a user when found', async () => {
      repository.findOne.mockResolvedValue(mockUser as User);

      const result = await service.findById('550e8400-e29b-41d4-a716-446655440000');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/users/users.service.spec.ts --verbose 2>&1`
Expected: FAIL — `Cannot find module './users.service'` or `Cannot find module './user.entity'`

- [ ] **Step 3: Implement User entity**

```typescript
// src/modules/users/user.entity.ts
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

  @Column({ nullable: true })
  email: string;

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

- [ ] **Step 4: Implement UsersService**

```typescript
// src/modules/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { phone } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }
}
```

- [ ] **Step 5: Update UsersModule (replace stub)**

```typescript
// src/modules/users/users.module.ts
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

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/users/users.service.spec.ts --verbose 2>&1`
Expected: PASS — 4 tests pass (create, findByPhone found, findByPhone null, findById found, findById null)

- [ ] **Step 7: Commit**

```bash
cd /home/mohammadibrahim/mashia
git add backend/src/modules/users/user.entity.ts \
  backend/src/modules/users/users.service.ts \
  backend/src/modules/users/users.module.ts \
  backend/src/modules/users/users.service.spec.ts
git commit -m "feat: implement User entity and UsersService with tests"
```

---

## Task 6: OTP Service (TDD)

**Files:**
- Implement: `src/modules/auth/otp.service.ts`
- Create: `src/modules/auth/otp.service.spec.ts`

- [ ] **Step 1: Write failing tests for OtpService**

```typescript
// src/modules/auth/otp.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TooManyRequestsException, BadRequestException } from '@nestjs/common';
import { OtpService } from './otp.service';
import { REDIS_CLIENT } from '@shared/redis/redis.constants';
import { SMS_SERVICE } from '@shared/sms/sms.interface';

describe('OtpService', () => {
  let service: OtpService;
  let mockRedis: Record<string, jest.Mock>;
  let mockSmsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };

    mockSmsService = {
      sendOtp: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
        { provide: SMS_SERVICE, useValue: mockSmsService },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  describe('generateAndSend', () => {
    it('should generate a 6-digit OTP and store it in Redis with 5-min TTL', async () => {
      mockRedis.get.mockResolvedValue(null); // no prior attempts

      await service.generateAndSend('+966501234567');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'otp:code:+966501234567',
        expect.stringMatching(/^\d{6}$/),
        'EX',
        300,
      );
    });

    it('should send the OTP via SMS service', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.generateAndSend('+966501234567');

      expect(mockSmsService.sendOtp).toHaveBeenCalledWith(
        '+966501234567',
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('should increment the attempt counter with 1-hour TTL', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.generateAndSend('+966501234567');

      expect(mockRedis.incr).toHaveBeenCalledWith('otp:attempts:+966501234567');
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'otp:attempts:+966501234567',
        3600,
      );
    });

    it('should throw TooManyRequestsException after 5 attempts', async () => {
      mockRedis.get.mockResolvedValue('5'); // already at limit

      await expect(service.generateAndSend('+966501234567')).rejects.toThrow(
        TooManyRequestsException,
      );
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockSmsService.sendOtp).not.toHaveBeenCalled();
    });

    it('should allow up to 5 attempts', async () => {
      mockRedis.get.mockResolvedValue('4'); // 4th attempt, one more allowed

      await service.generateAndSend('+966501234567');

      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockSmsService.sendOtp).toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('should return true for a valid OTP', async () => {
      mockRedis.get.mockResolvedValue('123456');

      const result = await service.verify('+966501234567', '123456');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('otp:code:+966501234567');
    });

    it('should throw BadRequestException for expired or non-existent OTP', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.verify('+966501234567', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for incorrect OTP', async () => {
      mockRedis.get.mockResolvedValue('123456');

      await expect(service.verify('+966501234567', '999999')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/auth/otp.service.spec.ts --verbose 2>&1`
Expected: FAIL — `Cannot find module './otp.service'`

- [ ] **Step 3: Implement OtpService**

```typescript
// src/modules/auth/otp.service.ts
import {
  Injectable,
  Inject,
  TooManyRequestsException,
  BadRequestException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@shared/redis/redis.constants';
import { SMS_SERVICE, SmsService } from '@shared/sms/sms.interface';

@Injectable()
export class OtpService {
  private static readonly OTP_TTL = 300; // 5 minutes
  private static readonly ATTEMPTS_TTL = 3600; // 1 hour
  private static readonly MAX_ATTEMPTS = 5;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(SMS_SERVICE) private readonly smsService: SmsService,
  ) {}

  async generateAndSend(phone: string): Promise<void> {
    const attemptsKey = `otp:attempts:${phone}`;
    const attempts = await this.redis.get(attemptsKey);

    if (attempts && parseInt(attempts, 10) >= OtpService.MAX_ATTEMPTS) {
      throw new TooManyRequestsException(
        'Too many OTP requests. Try again later.',
      );
    }

    const code = randomInt(100000, 999999).toString();

    await this.redis.set(`otp:code:${phone}`, code, 'EX', OtpService.OTP_TTL);
    await this.redis.incr(attemptsKey);
    await this.redis.expire(attemptsKey, OtpService.ATTEMPTS_TTL);

    await this.smsService.sendOtp(phone, code);
  }

  async verify(phone: string, code: string): Promise<boolean> {
    const codeKey = `otp:code:${phone}`;
    const storedCode = await this.redis.get(codeKey);

    if (!storedCode) {
      throw new BadRequestException('OTP expired or not found.');
    }

    if (storedCode !== code) {
      throw new BadRequestException('Invalid OTP.');
    }

    await this.redis.del(codeKey);
    return true;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest src/modules/auth/otp.service.spec.ts --verbose 2>&1`
Expected: PASS — all 7 tests pass

- [ ] **Step 5: Commit**

```bash
cd /home/mohammadibrahim/mashia
git add backend/src/modules/auth/otp.service.ts \
  backend/src/modules/auth/otp.service.spec.ts
git commit -m "feat: implement OTP service with Redis storage and rate limiting"
```

---

## Task 7: Wire Auth Module + Update app.module.ts

**Files:**
- Implement: `src/modules/auth/auth.module.ts` (replace stub)

- [ ] **Step 1: Update AuthModule to register OtpService**

```typescript
// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { OtpService } from './otp.service';

@Module({
  imports: [UsersModule],
  providers: [OtpService],
  exports: [OtpService],
})
export class AuthModule {}
```

- [ ] **Step 2: Verify all tests pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --verbose 2>&1`
Expected: PASS — all tests across all spec files

- [ ] **Step 3: Verify app starts and creates the users table**

Run: `cd /home/mohammadibrahim/mashia/backend && timeout 15 npx nest start 2>&1 || true`
Expected: `Mashia API running on port 3000` (no errors)

Then verify the users table was created by TypeORM synchronize:

Run: `docker exec mashia-db psql -U sheep_user -d sheep_marketplace -c '\dt'`
Expected: Should show `users` table in the list

Run: `docker exec mashia-db psql -U sheep_user -d sheep_marketplace -c '\d users'`
Expected: Should show all columns (id, role, full_name, phone, email, country, city, kyc_status, kyc_documents, preferred_language, created_at, updated_at)

- [ ] **Step 4: Verify Redis connection works**

Run: `docker exec mashia-redis redis-cli ping`
Expected: `PONG`

- [ ] **Step 5: Commit**

```bash
cd /home/mohammadibrahim/mashia
git add backend/src/modules/auth/auth.module.ts
git commit -m "feat: wire AuthModule with OtpService and UsersModule"
```

---

## Task 8: Final Verification & Cleanup

- [ ] **Step 1: Run full test suite**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --verbose --coverage 2>&1`
Expected: All tests pass, coverage report shows otp.service.ts and users.service.ts covered

- [ ] **Step 2: Run linter**

Run: `cd /home/mohammadibrahim/mashia/backend && npx eslint "src/**/*.ts" 2>&1`
Expected: No errors (warnings acceptable)

- [ ] **Step 3: Verify app starts end-to-end**

Run: `cd /home/mohammadibrahim/mashia/backend && timeout 15 npx nest start 2>&1 || true`
Expected: `Mashia API running on port 3000`, no errors about Redis, TypeORM, or missing modules

- [ ] **Step 4: Final commit if any fixes were needed**

Only if steps 1-3 required fixes:

```bash
cd /home/mohammadibrahim/mashia
git add -A
git commit -m "fix: resolve linter/test issues from OTP implementation"
```

- [ ] **Step 5: Push to remote**

```bash
cd /home/mohammadibrahim/mashia
git push origin main
```
