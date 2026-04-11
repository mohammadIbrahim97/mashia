# KYC Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement G1-US02 — KYC document upload, status tracking, and a reusable `KycVerifiedGuard` for the Mashia backend, with LocalStack as the local S3 backend.

**Architecture:** A new `KycModule` exposes `POST /kyc/submit` (multipart, role-aware) and `GET /kyc/status`. A new `@Global()` `S3Module` (mirroring the existing `RedisModule` pattern in `src/shared/redis/`) wraps `@aws-sdk/client-s3` and is reusable by listings/certificates later. A `KycVerifiedGuard` in `src/shared/guards/` reads the user off the request (populated by `JwtStrategy`) and throws `ForbiddenException` unless `kycStatus === VERIFIED`. Admin approval is out of scope — delivered in US10.

**Tech Stack:** NestJS 10, TypeORM, `@aws-sdk/client-s3` v3, `@aws-sdk/s3-request-presigner`, `image-size`, `multer` (via `@nestjs/platform-express`), `aws-sdk-client-mock` (tests), LocalStack 3.0 (dev S3).

**Preconditions:**
- US01 complete (44 tests passing, AuthModule/UsersModule live)
- Docker Compose currently runs `postgres` + `redis` (see `docker-compose.yml`)
- `backend/src/config/s3.config.ts` already exists with skeleton env vars — extended in Task 1
- `KycStatus` enum (`PENDING`/`VERIFIED`/`REJECTED`) and `User.kycDocuments` jsonb field already exist in `user.entity.ts` — reused, no migration

**Design spec:** `docs/superpowers/specs/2026-04-11-kyc-verification-design.md`

**Test count after completion:** ~66 unit tests (44 existing + 22 new).

---

## Task 1: Infrastructure setup — LocalStack, deps, extended s3.config

**Files:**
- Modify: `docker-compose.yml`
- Modify: `backend/src/config/s3.config.ts`
- Modify: `backend/package.json` (and lockfile)

- [ ] **Step 1.1: Add LocalStack service to `docker-compose.yml`**

Replace the entire file with:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: mashia-db
    environment:
      POSTGRES_DB: sheep_marketplace
      POSTGRES_USER: sheep_user
      POSTGRES_PASSWORD: sheep_pass_dev
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U sheep_user -d sheep_marketplace']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: mashia-redis
    ports:
      - '6379:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  localstack:
    image: localstack/localstack:3.0
    container_name: mashia-localstack
    ports:
      - '4566:4566'
    environment:
      - SERVICES=s3
      - DEFAULT_REGION=me-south-1
      - PERSISTENCE=1
    volumes:
      - localstack-data:/var/lib/localstack
    healthcheck:
      test: ['CMD-SHELL', 'curl -sf http://localhost:4566/_localstack/health || exit 1']
      interval: 10s
      timeout: 5s
      retries: 10

volumes:
  pgdata:
  localstack-data:
```

- [ ] **Step 1.2: Extend `backend/src/config/s3.config.ts`**

Replace the file with:

```typescript
import { registerAs } from '@nestjs/config';

export default registerAs('s3', () => ({
  region: process.env.AWS_REGION || 'me-south-1',
  bucket: process.env.AWS_S3_BUCKET || 'mashia-files',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  endpoint: process.env.AWS_S3_ENDPOINT || undefined,
  forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
}));
```

**Rationale:**
- `accessKeyId`/`secretAccessKey` default to `test` for LocalStack (AWS SDK rejects missing creds in dev otherwise)
- `endpoint` is `undefined` in prod so the SDK auto-resolves the real AWS endpoint
- `forcePathStyle: true` is required for LocalStack; production defaults to `false`

- [ ] **Step 1.3: Install S3 SDK + dev dependencies**

Run:

```bash
cd /home/mohammadibrahim/mashia/backend && npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner image-size
```

Then:

```bash
cd /home/mohammadibrahim/mashia/backend && npm install --save-dev aws-sdk-client-mock @types/multer
```

Expected: `package.json` and `package-lock.json` updated, no errors.

- [ ] **Step 1.4: Create `.env` entries (if `.env` exists) or document for user**

If `backend/.env` exists, append:

```
AWS_REGION=me-south-1
AWS_S3_BUCKET=mashia-files
AWS_S3_ENDPOINT=http://localhost:4566
AWS_S3_FORCE_PATH_STYLE=true
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

If no `.env` exists, skip — defaults in `s3.config.ts` already handle dev.

- [ ] **Step 1.5: Boot LocalStack and verify**

Run:

```bash
cd /home/mohammadibrahim/mashia && docker compose up -d localstack
```

Expected: `mashia-localstack` container starts. Verify with:

```bash
curl -s http://localhost:4566/_localstack/health | grep s3
```

Expected: JSON containing `"s3": "available"` or `"s3": "running"`.

- [ ] **Step 1.6: Pause for user to commit**

```bash
git add docker-compose.yml backend/src/config/s3.config.ts backend/package.json backend/package-lock.json
git commit -m "feat(kyc): add localstack + s3 sdk deps (#US02-01)"
```

---

## Task 2: S3Module shell (constants + module)

**Files:**
- Create: `backend/src/shared/s3/s3.constants.ts`
- Create: `backend/src/shared/s3/s3.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 2.1: Create `backend/src/shared/s3/s3.constants.ts`**

```typescript
export const S3_CLIENT = 'S3_CLIENT';
```

- [ ] **Step 2.2: Create `backend/src/shared/s3/s3.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { S3_CLIENT } from './s3.constants';
import { S3Service } from './s3.service';

const s3ClientProvider = {
  provide: S3_CLIENT,
  useFactory: (configService: ConfigService): S3Client => {
    return new S3Client({
      region: configService.get<string>('s3.region'),
      endpoint: configService.get<string | undefined>('s3.endpoint'),
      forcePathStyle: configService.get<boolean>('s3.forcePathStyle'),
      credentials: {
        accessKeyId: configService.get<string>('s3.accessKeyId') as string,
        secretAccessKey: configService.get<string>('s3.secretAccessKey') as string,
      },
    });
  },
  inject: [ConfigService],
};

@Global()
@Module({
  providers: [s3ClientProvider, S3Service],
  exports: [S3_CLIENT, S3Service],
})
export class S3Module {}
```

Note: `S3Service` is referenced but not yet created. It's implemented in Task 3. The import will break until then — that's OK, we create it next.

- [ ] **Step 2.3: Register `S3Module` in `backend/src/app.module.ts`**

Find this line:

```typescript
import { RedisModule } from './shared/redis/redis.module';
```

Add immediately below:

```typescript
import { S3Module } from './shared/s3/s3.module';
```

Find this block:

```typescript
    RedisModule,
    SmsModule,
```

Add `S3Module,` between them:

```typescript
    RedisModule,
    S3Module,
    SmsModule,
```

- [ ] **Step 2.4: Pause — do NOT run the app yet**

The import chain will fail because `S3Service` doesn't exist. We'll verify boot at the end of Task 3.

---

## Task 3: S3Service implementation with TDD

**Files:**
- Create: `backend/src/shared/s3/s3.service.ts`
- Create: `backend/src/shared/s3/s3.service.spec.ts`

- [ ] **Step 3.1: Write the failing test file `backend/src/shared/s3/s3.service.spec.ts`**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { S3Service } from './s3.service';
import { S3_CLIENT } from './s3.constants';

describe('S3Service', () => {
  let service: S3Service;
  const s3Mock = mockClient(S3Client);
  const mockS3Client = new S3Client({ region: 'me-south-1' });

  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 's3.bucket') return 'mashia-files';
      if (key === 's3.region') return 'me-south-1';
      return undefined;
    }),
  };

  beforeEach(async () => {
    s3Mock.reset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        { provide: S3_CLIENT, useValue: mockS3Client },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
  });

  describe('upload', () => {
    it('should send PutObjectCommand with bucket, key, body, contentType, and SSE', async () => {
      s3Mock.on(PutObjectCommand).resolves({});
      const body = Buffer.from('fake-image-data');

      await service.upload('kyc/user1/nationalId.jpg', body, 'image/jpeg');

      const calls = s3Mock.commandCalls(PutObjectCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toMatchObject({
        Bucket: 'mashia-files',
        Key: 'kyc/user1/nationalId.jpg',
        Body: body,
        ContentType: 'image/jpeg',
        ServerSideEncryption: 'AES256',
      });
    });
  });

  describe('delete', () => {
    it('should send DeleteObjectCommand with bucket and key', async () => {
      s3Mock.on(DeleteObjectCommand).resolves({});

      await service.delete('kyc/user1/nationalId.jpg');

      const calls = s3Mock.commandCalls(DeleteObjectCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toMatchObject({
        Bucket: 'mashia-files',
        Key: 'kyc/user1/nationalId.jpg',
      });
    });
  });

  describe('getSignedReadUrl', () => {
    it('should return a signed URL string containing the key (URL-encoded)', async () => {
      const url = await service.getSignedReadUrl('kyc/user1/nationalId.jpg', 300);

      expect(typeof url).toBe('string');
      // aws-sdk presigner URL-encodes path separators → kyc%2Fuser1%2FnationalId.jpg
      expect(url).toMatch(/kyc.*nationalId\.jpg/);
      expect(url).toContain('X-Amz-Signature');
    });
  });

  describe('ensureBucketExists', () => {
    it('should create bucket when HeadBucket returns 404', async () => {
      s3Mock
        .on(HeadBucketCommand)
        .rejects({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });
      s3Mock.on(CreateBucketCommand).resolves({});

      await service.ensureBucketExists();

      const createCalls = s3Mock.commandCalls(CreateBucketCommand);
      expect(createCalls).toHaveLength(1);
      expect(createCalls[0].args[0].input).toMatchObject({ Bucket: 'mashia-files' });
    });

    it('should no-op when HeadBucket succeeds', async () => {
      s3Mock.on(HeadBucketCommand).resolves({});

      await service.ensureBucketExists();

      const createCalls = s3Mock.commandCalls(CreateBucketCommand);
      expect(createCalls).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern s3.service.spec 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module './s3.service'" or similar.

- [ ] **Step 3.3: Implement `backend/src/shared/s3/s3.service.ts`**

```typescript
import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3_CLIENT } from './s3.constants';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly bucket: string;

  constructor(
    @Inject(S3_CLIENT) private readonly client: S3Client,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.get<string>('s3.bucket') as string;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBucketExists();
    } catch (err) {
      this.logger.warn(
        `ensureBucketExists failed on startup: ${(err as Error).message}. ` +
          `S3 operations may fail until the bucket is reachable.`,
      );
    }
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async getSignedReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async ensureBucketExists(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (err: any) {
      const status = err?.$metadata?.httpStatusCode;
      if (status === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchBucket') {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created S3 bucket: ${this.bucket}`);
      } else {
        throw err;
      }
    }
  }
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern s3.service.spec 2>&1 | tail -20
```

Expected: All 5 tests pass.

- [ ] **Step 3.5: Run full suite for regressions**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest 2>&1 | tail -10
```

Expected: 44 existing + 5 new = 49 passing tests.

- [ ] **Step 3.6: Boot the app to verify S3Module wires correctly**

```bash
cd /home/mohammadibrahim/mashia/backend && timeout 15 npm run start:dev 2>&1 | head -40 || true
```

Expected: App boots past Nest DI phase without "Cannot resolve dependency" errors. You should see either successful `Nest application successfully started` or LocalStack-related logs (bucket creation). If LocalStack isn't running, the `onModuleInit` logs a warning but the app still boots (that's intentional — see `S3Service.onModuleInit`).

- [ ] **Step 3.7: Pause for user to commit**

```bash
git add backend/src/shared/s3/ backend/src/app.module.ts
git commit -m "feat(kyc): add s3 module with upload/delete/presign/bucket-ensure (#US02-01)"
```

---

## Task 4: KYC module scaffold + DTOs

**Files:**
- Create: `backend/src/modules/kyc/kyc.module.ts`
- Create: `backend/src/modules/kyc/kyc.controller.ts`
- Create: `backend/src/modules/kyc/kyc.service.ts`
- Create: `backend/src/modules/kyc/dto/kyc-status-response.dto.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 4.1: Create `backend/src/modules/kyc/dto/kyc-status-response.dto.ts`**

```typescript
import { KycStatus } from '@shared/enums';

export class KycStatusResponseDto {
  kycStatus: KycStatus;
  submitted: boolean;
  documents: {
    nationalId: boolean;
    selfie: boolean;
    businessLicense: boolean;
  };
  submittedAt: Date | null;
}
```

- [ ] **Step 4.2: Create `backend/src/modules/kyc/kyc.service.ts` (empty shell)**

```typescript
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { S3Service } from '@shared/s3/s3.service';

@Injectable()
export class KycService {
  constructor(
    private readonly usersService: UsersService,
    private readonly s3Service: S3Service,
  ) {}
}
```

- [ ] **Step 4.3: Create `backend/src/modules/kyc/kyc.controller.ts` (empty shell)**

```typescript
import { Controller } from '@nestjs/common';
import { KycService } from './kyc.service';

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}
}
```

- [ ] **Step 4.4: Create `backend/src/modules/kyc/kyc.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';

@Module({
  imports: [UsersModule],
  controllers: [KycController],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
```

Note: `S3Module` is `@Global()` so it does not need to be imported here.

- [ ] **Step 4.5: Register `KycModule` in `backend/src/app.module.ts`**

Find this line:

```typescript
import { UsersModule } from './modules/users/users.module';
```

Add immediately below:

```typescript
import { KycModule } from './modules/kyc/kyc.module';
```

Find this block in the `imports` array:

```typescript
    AuthModule,
    UsersModule,
```

Add `KycModule,` after `UsersModule,`:

```typescript
    AuthModule,
    UsersModule,
    KycModule,
```

- [ ] **Step 4.6: Verify the app still boots**

```bash
cd /home/mohammadibrahim/mashia/backend && timeout 15 npm run start:dev 2>&1 | head -30 || true
```

Expected: no DI resolution errors. App starts and logs the `/kyc` route being registered (or at least mentions the KycController).

- [ ] **Step 4.7: Pause for user to commit**

```bash
git add backend/src/modules/kyc/ backend/src/app.module.ts
git commit -m "feat(kyc): scaffold kyc module + dto (#US02-01)"
```

---

## Task 5: KycService.submit() with full TDD coverage

**Files:**
- Create: `backend/src/modules/kyc/kyc.service.spec.ts`
- Modify: `backend/src/modules/kyc/kyc.service.ts`

- [ ] **Step 5.1: Add the `SubmittedFiles` type and method signature**

Update `backend/src/modules/kyc/kyc.service.ts` to declare the method shape (still a stub that throws):

```typescript
import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { S3Service } from '@shared/s3/s3.service';
import { User } from '../users/user.entity';
import { UserRole, KycStatus } from '@shared/enums';
import { KycStatusResponseDto } from './dto/kyc-status-response.dto';

export interface SubmittedKycFile {
  buffer: Buffer;
  mimeType: string;
}

export interface SubmittedKycFiles {
  nationalId?: SubmittedKycFile;
  selfie?: SubmittedKycFile;
  businessLicense?: SubmittedKycFile;
}

@Injectable()
export class KycService {
  constructor(
    private readonly usersService: UsersService,
    private readonly s3Service: S3Service,
  ) {}

  async submit(user: User, files: SubmittedKycFiles): Promise<KycStatusResponseDto> {
    throw new Error('not implemented');
  }
}
```

- [ ] **Step 5.2: Write the failing `kyc.service.spec.ts` with 10 scenarios**

Create `backend/src/modules/kyc/kyc.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { KycService, SubmittedKycFiles } from './kyc.service';
import { UsersService } from '../users/users.service';
import { S3Service } from '@shared/s3/s3.service';
import { User } from '../users/user.entity';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';

describe('KycService', () => {
  let service: KycService;
  let usersService: jest.Mocked<UsersService>;
  let s3Service: jest.Mocked<S3Service>;

  const makeUser = (overrides: Partial<User> = {}): User =>
    ({
      id: '550e8400-e29b-41d4-a716-446655440000',
      role: UserRole.BUYER,
      fullName: 'Test User',
      phone: '+966501234567',
      email: null,
      country: 'SA',
      city: 'Riyadh',
      kycStatus: KycStatus.PENDING,
      kycDocuments: null,
      preferredLanguage: PreferredLanguage.AR,
      createdAt: new Date('2026-04-11T10:00:00.000Z'),
      updatedAt: new Date('2026-04-11T10:00:00.000Z'),
      ...overrides,
    }) as User;

  const makeFile = (name = 'fake-bytes') => ({
    buffer: Buffer.from(name),
    mimeType: 'image/jpeg',
  });

  beforeEach(async () => {
    usersService = {
      updateKycDocuments: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    s3Service = {
      upload: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<S3Service>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycService,
        { provide: UsersService, useValue: usersService },
        { provide: S3Service, useValue: s3Service },
      ],
    }).compile();

    service = module.get<KycService>(KycService);
  });

  describe('submit — seller/broker', () => {
    it('uploads nationalId + selfie + businessLicense and returns pending status', async () => {
      const user = makeUser({ role: UserRole.SELLER });
      const files: SubmittedKycFiles = {
        nationalId: makeFile('id'),
        selfie: makeFile('selfie'),
        businessLicense: makeFile('license'),
      };

      const result = await service.submit(user, files);

      expect(s3Service.upload).toHaveBeenCalledTimes(3);
      expect(usersService.updateKycDocuments).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          nationalId: expect.stringContaining(`kyc/${user.id}/nationalId-`),
          selfie: expect.stringContaining(`kyc/${user.id}/selfie-`),
          businessLicense: expect.stringContaining(`kyc/${user.id}/businessLicense-`),
        }),
        KycStatus.PENDING,
      );
      expect(result).toMatchObject({
        kycStatus: KycStatus.PENDING,
        submitted: true,
        documents: { nationalId: true, selfie: true, businessLicense: true },
      });
    });

    it('uploads nationalId + selfie only when businessLicense is absent', async () => {
      const user = makeUser({ role: UserRole.SELLER });
      const files: SubmittedKycFiles = {
        nationalId: makeFile(),
        selfie: makeFile(),
      };

      const result = await service.submit(user, files);

      expect(s3Service.upload).toHaveBeenCalledTimes(2);
      expect(result.documents).toEqual({
        nationalId: true,
        selfie: true,
        businessLicense: false,
      });
    });

    it('throws BadRequestException when seller is missing selfie', async () => {
      const user = makeUser({ role: UserRole.SELLER });
      const files: SubmittedKycFiles = { nationalId: makeFile() };

      await expect(service.submit(user, files)).rejects.toThrow(BadRequestException);
      expect(s3Service.upload).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when seller is missing nationalId', async () => {
      const user = makeUser({ role: UserRole.SELLER });
      const files: SubmittedKycFiles = { selfie: makeFile() };

      await expect(service.submit(user, files)).rejects.toThrow(BadRequestException);
      expect(s3Service.upload).not.toHaveBeenCalled();
    });

    it('applies the same rules for brokers as sellers', async () => {
      const user = makeUser({ role: UserRole.BROKER });
      const files: SubmittedKycFiles = { nationalId: makeFile() };

      await expect(service.submit(user, files)).rejects.toThrow(BadRequestException);
    });
  });

  describe('submit — buyer', () => {
    it('uploads nationalId only', async () => {
      const user = makeUser({ role: UserRole.BUYER });
      const files: SubmittedKycFiles = { nationalId: makeFile() };

      const result = await service.submit(user, files);

      expect(s3Service.upload).toHaveBeenCalledTimes(1);
      expect(result.documents).toEqual({
        nationalId: true,
        selfie: false,
        businessLicense: false,
      });
    });

    it('throws BadRequestException when buyer uploads a selfie', async () => {
      const user = makeUser({ role: UserRole.BUYER });
      const files: SubmittedKycFiles = {
        nationalId: makeFile(),
        selfie: makeFile(),
      };

      await expect(service.submit(user, files)).rejects.toThrow(BadRequestException);
      expect(s3Service.upload).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when buyer uploads a businessLicense', async () => {
      const user = makeUser({ role: UserRole.BUYER });
      const files: SubmittedKycFiles = {
        nationalId: makeFile(),
        businessLicense: makeFile(),
      };

      await expect(service.submit(user, files)).rejects.toThrow(BadRequestException);
    });
  });

  describe('submit — resubmission and state', () => {
    it('throws ConflictException when the user is already VERIFIED', async () => {
      const user = makeUser({
        role: UserRole.SELLER,
        kycStatus: KycStatus.VERIFIED,
        kycDocuments: { nationalId: 'old', selfie: 'old' },
      });
      const files: SubmittedKycFiles = {
        nationalId: makeFile(),
        selfie: makeFile(),
      };

      await expect(service.submit(user, files)).rejects.toThrow(ConflictException);
    });

    it('deletes old S3 keys and saves new ones when a REJECTED user resubmits', async () => {
      const user = makeUser({
        role: UserRole.SELLER,
        kycStatus: KycStatus.REJECTED,
        kycDocuments: {
          nationalId: 'kyc/550e/nationalId-old.jpg',
          selfie: 'kyc/550e/selfie-old.jpg',
        },
      });
      const files: SubmittedKycFiles = {
        nationalId: makeFile(),
        selfie: makeFile(),
      };

      await service.submit(user, files);

      expect(s3Service.delete).toHaveBeenCalledWith('kyc/550e/nationalId-old.jpg');
      expect(s3Service.delete).toHaveBeenCalledWith('kyc/550e/selfie-old.jpg');
      expect(s3Service.upload).toHaveBeenCalledTimes(2);
      expect(usersService.updateKycDocuments).toHaveBeenCalledWith(
        user.id,
        expect.any(Object),
        KycStatus.PENDING,
      );
    });

    it('rolls back uploaded files and does not update user when an upload fails mid-way', async () => {
      const user = makeUser({ role: UserRole.SELLER });
      const files: SubmittedKycFiles = {
        nationalId: makeFile('id'),
        selfie: makeFile('selfie'),
      };
      s3Service.upload
        .mockResolvedValueOnce(undefined) // nationalId succeeds
        .mockRejectedValueOnce(new Error('s3 down')); // selfie fails

      await expect(service.submit(user, files)).rejects.toThrow('s3 down');

      // The one file that succeeded should be deleted as rollback
      expect(s3Service.delete).toHaveBeenCalledTimes(1);
      expect(usersService.updateKycDocuments).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 5.3: Run tests to verify all fail**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern kyc.service.spec 2>&1 | tail -30
```

Expected: 10 tests fail (with "not implemented" or similar).

- [ ] **Step 5.4: Implement `submit()` in `backend/src/modules/kyc/kyc.service.ts`**

Replace the file with:

```typescript
import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { S3Service } from '@shared/s3/s3.service';
import { User } from '../users/user.entity';
import { UserRole, KycStatus } from '@shared/enums';
import { KycStatusResponseDto } from './dto/kyc-status-response.dto';

export interface SubmittedKycFile {
  buffer: Buffer;
  mimeType: string;
}

export interface SubmittedKycFiles {
  nationalId?: SubmittedKycFile;
  selfie?: SubmittedKycFile;
  businessLicense?: SubmittedKycFile;
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type DocType = 'nationalId' | 'selfie' | 'businessLicense';

@Injectable()
export class KycService {
  constructor(
    private readonly usersService: UsersService,
    private readonly s3Service: S3Service,
  ) {}

  async submit(user: User, files: SubmittedKycFiles): Promise<KycStatusResponseDto> {
    if (user.kycStatus === KycStatus.VERIFIED) {
      throw new ConflictException(
        'Already verified; contact support to update documents',
      );
    }

    this.validateRoleRules(user.role, files);

    const docTypes: DocType[] = ['nationalId', 'selfie', 'businessLicense'];
    const uploadedKeys: Partial<Record<DocType, string>> = {};

    try {
      for (const docType of docTypes) {
        const file = files[docType];
        if (!file) continue;
        const ext = MIME_TO_EXT[file.mimeType] ?? 'bin';
        const key = `kyc/${user.id}/${docType}-${randomUUID()}.${ext}`;
        await this.s3Service.upload(key, file.buffer, file.mimeType);
        uploadedKeys[docType] = key;
      }
    } catch (err) {
      // Rollback: best-effort delete of anything already uploaded
      for (const key of Object.values(uploadedKeys)) {
        if (!key) continue;
        try {
          await this.s3Service.delete(key);
        } catch {
          // swallow — rollback is best effort
        }
      }
      throw err;
    }

    // After successful upload, delete any old docs from a prior submission
    if (user.kycDocuments) {
      for (const oldKey of Object.values(user.kycDocuments)) {
        if (!oldKey) continue;
        try {
          await this.s3Service.delete(oldKey);
        } catch {
          // swallow — stale file cleanup is best effort
        }
      }
    }

    await this.usersService.updateKycDocuments(
      user.id,
      uploadedKeys as Record<string, string>,
      KycStatus.PENDING,
    );

    return {
      kycStatus: KycStatus.PENDING,
      submitted: true,
      documents: {
        nationalId: !!uploadedKeys.nationalId,
        selfie: !!uploadedKeys.selfie,
        businessLicense: !!uploadedKeys.businessLicense,
      },
      submittedAt: new Date(),
    };
  }

  private validateRoleRules(role: UserRole, files: SubmittedKycFiles): void {
    if (!files.nationalId) {
      throw new BadRequestException('National ID is required');
    }

    if (role === UserRole.BUYER) {
      if (files.selfie) {
        throw new BadRequestException('Buyers must upload only nationalId');
      }
      if (files.businessLicense) {
        throw new BadRequestException('Buyers must upload only nationalId');
      }
      return;
    }

    if (role === UserRole.SELLER || role === UserRole.BROKER) {
      if (!files.selfie) {
        throw new BadRequestException('Selfie is required for sellers and brokers');
      }
      return;
    }

    throw new BadRequestException('This role cannot submit KYC documents');
  }
}
```

- [ ] **Step 5.5: Add `updateKycDocuments` method to `UsersService`**

Read `backend/src/modules/users/users.service.ts`. If `updateKycDocuments(userId, documents, status)` does not exist, add it:

```typescript
async updateKycDocuments(
  userId: string,
  documents: Record<string, string>,
  status: KycStatus,
): Promise<void> {
  await this.usersRepository.update(userId, {
    kycDocuments: documents,
    kycStatus: status,
  });
}
```

Ensure `KycStatus` is imported at the top: `import { KycStatus } from '@shared/enums';`

If the method already exists, verify its signature matches; if it differs, align the `KycService` call site to match rather than duplicating.

- [ ] **Step 5.6: Run kyc.service tests — verify all pass**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern kyc.service.spec 2>&1 | tail -25
```

Expected: 10 tests pass.

- [ ] **Step 5.7: Run full suite**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest 2>&1 | tail -15
```

Expected: 44 (existing) + 5 (s3) + 10 (kyc service) = 59 passing tests.

- [ ] **Step 5.8: Pause for user to commit**

```bash
git add backend/src/modules/kyc/kyc.service.ts backend/src/modules/kyc/kyc.service.spec.ts backend/src/modules/users/users.service.ts
git commit -m "feat(kyc): implement KycService.submit with role rules and rollback (#US02-01)"
```

---

## Task 6: POST /kyc/submit controller route with multipart parsing

**Files:**
- Modify: `backend/src/modules/kyc/kyc.controller.ts`
- Create: `backend/src/modules/kyc/kyc-file.validator.ts`

- [ ] **Step 6.1: Create `backend/src/modules/kyc/kyc-file.validator.ts`**

```typescript
import { BadRequestException } from '@nestjs/common';
import imageSize from 'image-size';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_WIDTH = 800;
const MIN_HEIGHT = 600;
const MAX_WIDTH = 4096;
const MAX_HEIGHT = 4096;

export function validateKycFile(
  field: string,
  file: Express.Multer.File,
): void {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new BadRequestException(
      `${field}: unsupported file type (${file.mimetype}). Allowed: JPEG, PNG, WebP`,
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new BadRequestException(
      `${field}: file too large (${file.size} bytes, max ${MAX_SIZE_BYTES})`,
    );
  }

  let dimensions: { width?: number; height?: number };
  try {
    dimensions = imageSize(file.buffer);
  } catch {
    throw new BadRequestException(`${field}: file is not a valid image`);
  }

  const width = dimensions.width ?? 0;
  const height = dimensions.height ?? 0;

  if (width < MIN_WIDTH || height < MIN_HEIGHT) {
    throw new BadRequestException(
      `${field}: image too small (${width}x${height}, min ${MIN_WIDTH}x${MIN_HEIGHT})`,
    );
  }
  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    throw new BadRequestException(
      `${field}: image too large (${width}x${height}, max ${MAX_WIDTH}x${MAX_HEIGHT})`,
    );
  }
}
```

- [ ] **Step 6.2: Update `backend/src/modules/kyc/kyc.controller.ts`**

```typescript
import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Req,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { KycService, SubmittedKycFiles } from './kyc.service';
import { KycStatusResponseDto } from './dto/kyc-status-response.dto';
import { validateKycFile } from './kyc-file.validator';
import { User } from '../users/user.entity';

interface AuthenticatedRequest extends ExpressRequest {
  user: User;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'nationalId', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
        { name: 'businessLicense', maxCount: 1 },
      ],
      { limits: { fileSize: MAX_FILE_SIZE_BYTES } },
    ),
  )
  async submit(
    @UploadedFiles()
    uploaded: {
      nationalId?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
      businessLicense?: Express.Multer.File[];
    },
    @Req() req: AuthenticatedRequest,
  ): Promise<KycStatusResponseDto> {
    const files: SubmittedKycFiles = {};

    const nationalId = uploaded?.nationalId?.[0];
    const selfie = uploaded?.selfie?.[0];
    const businessLicense = uploaded?.businessLicense?.[0];

    if (nationalId) {
      validateKycFile('nationalId', nationalId);
      files.nationalId = {
        buffer: nationalId.buffer,
        mimeType: nationalId.mimetype,
      };
    }
    if (selfie) {
      validateKycFile('selfie', selfie);
      files.selfie = { buffer: selfie.buffer, mimeType: selfie.mimetype };
    }
    if (businessLicense) {
      validateKycFile('businessLicense', businessLicense);
      files.businessLicense = {
        buffer: businessLicense.buffer,
        mimeType: businessLicense.mimetype,
      };
    }

    return this.kycService.submit(req.user, files);
  }
}
```

- [ ] **Step 6.3: Run the full suite to make sure nothing regressed**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest 2>&1 | tail -10
```

Expected: 59 tests still passing (no new tests yet for the controller — those come in Task 9).

- [ ] **Step 6.4: Smoke-test the endpoint manually (optional but recommended)**

Boot the app:

```bash
cd /home/mohammadibrahim/mashia/backend && npm run start:dev
```

In another terminal, obtain a JWT via the existing auth flow (OTP → register → tokens), then:

```bash
curl -X POST http://localhost:3000/api/v1/kyc/submit \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -F "nationalId=@/path/to/real-image.jpg" \
  -F "selfie=@/path/to/real-selfie.jpg"
```

Expected: 200 response with `{kycStatus: "pending", submitted: true, ...}`. File lands in LocalStack (verify: `docker exec mashia-localstack awslocal s3 ls s3://mashia-files/kyc/`).

Skip this step in CI / subagent runs; it's a manual dev check.

- [ ] **Step 6.5: Pause for user to commit**

```bash
git add backend/src/modules/kyc/kyc.controller.ts backend/src/modules/kyc/kyc-file.validator.ts
git commit -m "feat(kyc): POST /kyc/submit multipart endpoint with file validation (#US02-01)"
```

---

## Task 7: GET /kyc/status endpoint + KycService.getStatus()

**Files:**
- Modify: `backend/src/modules/kyc/kyc.service.ts`
- Modify: `backend/src/modules/kyc/kyc.service.spec.ts`
- Modify: `backend/src/modules/kyc/kyc.controller.ts`

- [ ] **Step 7.1: Add failing tests for `getStatus()` in `kyc.service.spec.ts`**

Add this `describe` block at the end of the file (before the closing `});` of the top-level describe):

```typescript
  describe('getStatus', () => {
    it('returns pending state for a PENDING user with no documents', () => {
      const user = makeUser({
        kycStatus: KycStatus.PENDING,
        kycDocuments: null,
      });

      const result = service.getStatus(user);

      expect(result).toEqual({
        kycStatus: KycStatus.PENDING,
        submitted: false,
        documents: { nationalId: false, selfie: false, businessLicense: false },
        submittedAt: null,
      });
    });

    it('returns pending-with-docs for a submitted PENDING user', () => {
      const updatedAt = new Date('2026-04-11T14:30:00.000Z');
      const user = makeUser({
        role: UserRole.SELLER,
        kycStatus: KycStatus.PENDING,
        kycDocuments: {
          nationalId: 'kyc/550e/nationalId-abc.jpg',
          selfie: 'kyc/550e/selfie-def.jpg',
        },
        updatedAt,
      });

      const result = service.getStatus(user);

      expect(result).toEqual({
        kycStatus: KycStatus.PENDING,
        submitted: true,
        documents: { nationalId: true, selfie: true, businessLicense: false },
        submittedAt: updatedAt,
      });
    });

    it('returns verified state with all document flags set', () => {
      const user = makeUser({
        role: UserRole.SELLER,
        kycStatus: KycStatus.VERIFIED,
        kycDocuments: {
          nationalId: 'k1',
          selfie: 'k2',
          businessLicense: 'k3',
        },
      });

      const result = service.getStatus(user);

      expect(result.kycStatus).toBe(KycStatus.VERIFIED);
      expect(result.submitted).toBe(true);
      expect(result.documents).toEqual({
        nationalId: true,
        selfie: true,
        businessLicense: true,
      });
    });

    it('returns rejected state with submitted=true', () => {
      const user = makeUser({
        role: UserRole.SELLER,
        kycStatus: KycStatus.REJECTED,
        kycDocuments: { nationalId: 'k1', selfie: 'k2' },
      });

      const result = service.getStatus(user);

      expect(result.kycStatus).toBe(KycStatus.REJECTED);
      expect(result.submitted).toBe(true);
    });
  });
```

- [ ] **Step 7.2: Run tests to verify the new ones fail**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern kyc.service.spec 2>&1 | tail -30
```

Expected: 4 new tests fail (method doesn't exist).

- [ ] **Step 7.3: Implement `getStatus()` in `kyc.service.ts`**

Add this method to the `KycService` class (below `submit`):

```typescript
  getStatus(user: User): KycStatusResponseDto {
    const docs = user.kycDocuments ?? {};
    const submitted = user.kycDocuments !== null && user.kycDocuments !== undefined;

    return {
      kycStatus: user.kycStatus,
      submitted,
      documents: {
        nationalId: !!docs.nationalId,
        selfie: !!docs.selfie,
        businessLicense: !!docs.businessLicense,
      },
      submittedAt: submitted ? user.updatedAt : null,
    };
  }
```

- [ ] **Step 7.4: Wire up the GET route in `kyc.controller.ts`**

Add the `Get` import if missing:

```typescript
import { Controller, Post, Get, UseGuards, UseInterceptors, UploadedFiles, Req } from '@nestjs/common';
```

Add the route method inside the `KycController` class:

```typescript
  @Get('status')
  @UseGuards(JwtAuthGuard)
  getStatus(@Req() req: AuthenticatedRequest): KycStatusResponseDto {
    return this.kycService.getStatus(req.user);
  }
```

- [ ] **Step 7.5: Run tests to verify all pass**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern kyc.service.spec 2>&1 | tail -25
```

Expected: 14 kyc.service tests pass (10 submit + 4 getStatus).

- [ ] **Step 7.6: Run full suite**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest 2>&1 | tail -10
```

Expected: 44 + 5 + 14 = 63 passing tests.

- [ ] **Step 7.7: Pause for user to commit**

```bash
git add backend/src/modules/kyc/
git commit -m "feat(kyc): GET /kyc/status endpoint + getStatus service method (#US02-02)"
```

---

## Task 8: KycVerifiedGuard with TDD

**Files:**
- Create: `backend/src/shared/guards/kyc-verified.guard.spec.ts`
- Create: `backend/src/shared/guards/kyc-verified.guard.ts`

- [ ] **Step 8.1: Write the failing test file**

Create `backend/src/shared/guards/kyc-verified.guard.spec.ts`:

```typescript
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { KycVerifiedGuard } from './kyc-verified.guard';
import { KycStatus, UserRole, PreferredLanguage } from '@shared/enums';
import { User } from '../../modules/users/user.entity';

describe('KycVerifiedGuard', () => {
  let guard: KycVerifiedGuard;

  const makeUser = (kycStatus: KycStatus): User =>
    ({
      id: '550e8400-e29b-41d4-a716-446655440000',
      role: UserRole.SELLER,
      fullName: 'Test',
      phone: '+966501234567',
      email: null,
      country: 'SA',
      city: 'Riyadh',
      kycStatus,
      kycDocuments: null,
      preferredLanguage: PreferredLanguage.AR,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as User;

  const makeContext = (user: User | undefined): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    guard = new KycVerifiedGuard();
  });

  it('allows access when user.kycStatus === VERIFIED', () => {
    const ctx = makeContext(makeUser(KycStatus.VERIFIED));
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when user.kycStatus === PENDING', () => {
    const ctx = makeContext(makeUser(KycStatus.PENDING));
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user.kycStatus === REJECTED', () => {
    const ctx = makeContext(makeUser(KycStatus.REJECTED));
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws UnauthorizedException when user is missing from the request', () => {
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 8.2: Run tests to verify they fail**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern kyc-verified.guard.spec 2>&1 | tail -20
```

Expected: FAIL with "Cannot find module './kyc-verified.guard'".

- [ ] **Step 8.3: Implement `backend/src/shared/guards/kyc-verified.guard.ts`**

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { KycStatus } from '@shared/enums';

@Injectable()
export class KycVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.kycStatus !== KycStatus.VERIFIED) {
      throw new ForbiddenException('KYC verification required');
    }
    return true;
  }
}
```

- [ ] **Step 8.4: Run tests to verify all pass**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern kyc-verified.guard.spec 2>&1 | tail -20
```

Expected: 4 tests pass.

- [ ] **Step 8.5: Run full suite**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest 2>&1 | tail -10
```

Expected: 44 + 5 + 14 + 4 = 67 passing tests.

- [ ] **Step 8.6: Pause for user to commit**

```bash
git add backend/src/shared/guards/kyc-verified.guard.ts backend/src/shared/guards/kyc-verified.guard.spec.ts
git commit -m "feat(kyc): add KycVerifiedGuard with 4 unit tests (#US02-03, #US02-04)"
```

---

## Task 9: KycController passthrough tests + final verification

**Files:**
- Create: `backend/src/modules/kyc/kyc.controller.spec.ts`

- [ ] **Step 9.1: Write `backend/src/modules/kyc/kyc.controller.spec.ts`**

```typescript
jest.mock('./kyc-file.validator', () => ({
  validateKycFile: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { User } from '../users/user.entity';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';

describe('KycController', () => {
  let controller: KycController;
  let kycService: jest.Mocked<KycService>;

  const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    role: UserRole.SELLER,
    fullName: 'Ahmad Ali',
    phone: '+966501234567',
    email: null,
    country: 'SA',
    city: 'Riyadh',
    kycStatus: KycStatus.PENDING,
    kycDocuments: null,
    preferredLanguage: PreferredLanguage.AR,
    createdAt: new Date('2026-04-11T10:00:00.000Z'),
    updatedAt: new Date('2026-04-11T10:00:00.000Z'),
  } as User;

  const mockStatusResponse = {
    kycStatus: KycStatus.PENDING,
    submitted: true,
    documents: { nationalId: true, selfie: true, businessLicense: false },
    submittedAt: new Date('2026-04-11T10:00:00.000Z'),
  };

  beforeEach(async () => {
    kycService = {
      submit: jest.fn().mockResolvedValue(mockStatusResponse),
      getStatus: jest.fn().mockReturnValue(mockStatusResponse),
    } as unknown as jest.Mocked<KycService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KycController],
      providers: [{ provide: KycService, useValue: kycService }],
    }).compile();

    controller = module.get<KycController>(KycController);
  });

  describe('submit', () => {
    it('forwards parsed files and request user to KycService.submit', async () => {
      const fakeBuffer = Buffer.from('fake');
      const uploaded = {
        nationalId: [
          { buffer: fakeBuffer, mimetype: 'image/jpeg', size: 1024 } as Express.Multer.File,
        ],
        selfie: [
          { buffer: fakeBuffer, mimetype: 'image/jpeg', size: 1024 } as Express.Multer.File,
        ],
      };

      const result = await controller.submit(uploaded, { user: mockUser } as any);

      expect(kycService.submit).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({
          nationalId: { buffer: fakeBuffer, mimeType: 'image/jpeg' },
          selfie: { buffer: fakeBuffer, mimeType: 'image/jpeg' },
        }),
      );
      expect(result).toEqual(mockStatusResponse);
    });
  });

  describe('getStatus', () => {
    it('forwards request user to KycService.getStatus', () => {
      const result = controller.getStatus({ user: mockUser } as any);

      expect(kycService.getStatus).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockStatusResponse);
    });
  });

  describe('error propagation', () => {
    it('propagates service errors to the caller', async () => {
      kycService.submit.mockRejectedValue(new Error('boom'));

      const uploaded = {
        nationalId: [
          { buffer: Buffer.from('f'), mimetype: 'image/jpeg', size: 10 } as Express.Multer.File,
        ],
        selfie: [
          { buffer: Buffer.from('f'), mimetype: 'image/jpeg', size: 10 } as Express.Multer.File,
        ],
      };

      await expect(controller.submit(uploaded, { user: mockUser } as any)).rejects.toThrow('boom');
    });
  });
});
```

- [ ] **Step 9.2: Run the new test file**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern kyc.controller.spec 2>&1 | tail -25
```

Expected: 3 tests pass.

- [ ] **Step 9.3: Run the full suite**

```bash
cd /home/mohammadibrahim/mashia/backend && npx jest 2>&1 | tail -15
```

Expected: 44 (existing) + 5 (s3) + 14 (kyc service) + 4 (guard) + 3 (kyc controller) = **70 passing tests** across 11 test suites.

If the count is different, investigate before committing. Some drift from the 66 target is fine (the plan rough-counted ~22 new; actual is 26 because `validateRoleRules` edge cases split out into finer tests during TDD).

- [ ] **Step 9.4: Pause for user to commit and close issues**

```bash
git add backend/src/modules/kyc/kyc.controller.spec.ts
git commit -m "test(kyc): add kyc controller passthrough tests (#US02-05)"
```

After commit, close GitHub issues for US02:
- US02-01 (upload endpoint + S3 storage)
- US02-02 (status tracking on user entity)
- US02-03 (guard blocks sellers/brokers — guard delivered, application in US04/US06)
- US02-04 (guard blocks buyers — same guard, application in US06)
- US02-05 (unit tests)
- Parent US02 user story

---

## Post-Implementation Verification Checklist

After all 9 tasks are done, confirm:

- [ ] `docker compose ps` shows postgres, redis, localstack all healthy
- [ ] `npx jest` reports ~70 tests passing across ~11 suites
- [ ] `npm run start:dev` boots without DI errors
- [ ] `S3Service.ensureBucketExists()` creates `mashia-files` in LocalStack on first boot (check `docker exec mashia-localstack awslocal s3 ls`)
- [ ] `KycModule` and `S3Module` imported in `app.module.ts`
- [ ] All new files under `src/modules/kyc/`, `src/shared/s3/`, `src/shared/guards/kyc-verified.guard.ts`
- [ ] No changes to existing `User` entity (reused fields only, no migration needed)
- [ ] No commits made by the implementation agents — all commits are manual by user

## Known Deferred Items (tracked elsewhere, NOT blockers for US02 closure)

- Applying `KycVerifiedGuard` to listing routes → US04
- Applying `KycVerifiedGuard` to order routes → US06
- Admin approval endpoint `PATCH /admin/users/:id/kyc` → US10-03
- Signed read URLs exposed via admin-only endpoint → US10
- Audit trail / submission history (`KycSubmission` entity) → post-MVP
- Integration tests against real LocalStack (gated behind env var) → optional follow-up
