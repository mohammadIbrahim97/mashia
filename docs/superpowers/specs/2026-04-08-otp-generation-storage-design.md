# OTP Generation & Storage Design

**Issue:** #2 — G1-US01-01: SMS OTP generation and storage with 5-min expiry
**Scope:** Shared enums, User entity/service, Redis module, SMS interface, OTP service
**Date:** 2026-04-08

---

## Overview

Implements OTP generation and storage for phone-based authentication. Since the OTP service depends on the User entity and shared infrastructure, this design covers the full prerequisite chain: shared enums, User entity, UsersService (minimal), Redis module, SMS service interface, and the OTP service itself.

## Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| OTP storage | Redis with TTL | Already running via docker-compose, native TTL support, ephemeral data belongs here |
| Redis client | `ioredis` directly | Reused later by Socket.io Redis adapter; no need for wrapper packages |
| SMS sending (dev) | Interface + console stub | `SmsService` interface with `ConsoleSmsService` for dev; swap to real provider later by changing one line |
| Rate limiting | 5 sends per hour per phone | Prevents SMS spam; tracked via Redis counter with 1-hour TTL |
| OTP generation | `crypto.randomInt(100000, 999999)` | Cryptographically secure, not Math.random() |
| Prerequisite scope | Enums + User entity + UsersService (minimal) | OTP service can't function without these; no point implementing in isolation |

## 1. Shared Enums

**File:** `backend/src/shared/enums/index.ts`

Only the enums needed by the User entity. Other enums (Breed, Currency, OrderStatus) added when their modules are implemented.

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
```

## 2. User Entity

**File:** `backend/src/modules/users/user.entity.ts`

```typescript
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
  country: string;  // SY, SA, AE, KW, QA, BH, OM

  @Column()
  city: string;

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING, name: 'kyc_status' })
  kycStatus: KycStatus;

  @Column({ type: 'jsonb', nullable: true, name: 'kyc_documents' })
  kycDocuments: Record<string, string>;

  @Column({ type: 'enum', enum: PreferredLanguage, default: PreferredLanguage.AR, name: 'preferred_language' })
  preferredLanguage: PreferredLanguage;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

Key decisions:
- `phone` is unique — primary identifier for OTP login
- `kycStatus` defaults to `PENDING`
- `preferredLanguage` defaults to `AR` (Arabic primary market)
- `kycDocuments` is JSONB — flexible key-value for different doc types
- Snake_case column names in Postgres, camelCase in TypeScript

## 3. UsersService (minimal)

**File:** `backend/src/modules/users/users.service.ts`

Only the methods the auth module needs. Profile updates, KYC, etc. added when those issues are implemented.

```typescript
export class UsersService {
  async create(data: Partial<User>): Promise<User>
  async findByPhone(phone: string): Promise<User | null>
  async findById(id: string): Promise<User | null>
}
```

**File:** `backend/src/modules/users/users.module.ts`
- Imports `TypeOrmModule.forFeature([User])`
- Provides and exports `UsersService`

## 4. Redis Module

**New files:**
- `backend/src/shared/redis/redis.module.ts`
- `backend/src/shared/redis/redis.constants.ts`

```typescript
// redis.constants.ts
export const REDIS_CLIENT = 'REDIS_CLIENT';

// redis.module.ts
@Global()
@Module({...})
export class RedisModule {
  // Provides ioredis client using REDIS_HOST and REDIS_PORT from ConfigService
  // Global — available everywhere without re-importing
  // Graceful disconnect on app shutdown via onModuleDestroy
}
```

Inject via `@Inject(REDIS_CLIENT) private redis: Redis`.

**Package:** `ioredis` + `@types/ioredis`

## 5. SMS Interface + Console Stub

**New files:**
- `backend/src/shared/sms/sms.interface.ts`
- `backend/src/shared/sms/sms.module.ts`
- `backend/src/shared/sms/console-sms.service.ts`

```typescript
// sms.interface.ts
export interface SmsService {
  sendOtp(phone: string, code: string): Promise<void>;
}
export const SMS_SERVICE = 'SMS_SERVICE';

// console-sms.service.ts
export class ConsoleSmsService implements SmsService {
  async sendOtp(phone: string, code: string): Promise<void> {
    // Logs: [SMS] OTP for +963911234567: 123456
  }
}

// sms.module.ts
@Global()
@Module({
  providers: [{ provide: SMS_SERVICE, useClass: ConsoleSmsService }],
  exports: [SMS_SERVICE],
})
export class SmsModule {}
```

Swap `ConsoleSmsService` for a real provider by changing `useClass` in the module.

## 6. OTP Service

**File:** `backend/src/modules/auth/otp.service.ts`

```typescript
export class OtpService {
  constructor(
    @Inject(REDIS_CLIENT) private redis: Redis,
    @Inject(SMS_SERVICE) private smsService: SmsService,
  ) {}

  async generateAndSend(phone: string): Promise<void>
  async verify(phone: string, code: string): Promise<boolean>
}
```

**Redis key scheme:**
- `otp:code:{phone}` — the OTP code, 5-minute TTL (`EX 300`)
- `otp:attempts:{phone}` — send attempt counter, 1-hour TTL (`EX 3600`)

**`generateAndSend(phone)`:**
1. Check rate limit: `GET otp:attempts:{phone}` — if >= 5, throw `TooManyRequestsException`
2. Generate 6-digit code: `crypto.randomInt(100000, 999999)`
3. Store: `SET otp:code:{phone} {code} EX 300`
4. Increment: `INCR otp:attempts:{phone}`, `EXPIRE otp:attempts:{phone} 3600`
5. Send: `smsService.sendOtp(phone, code)`

**`verify(phone, code)`:**
1. `GET otp:code:{phone}` — if null, throw: OTP expired or not found
2. Compare codes — if mismatch, throw: Invalid OTP
3. `DEL otp:code:{phone}` — single-use
4. Return true

## 7. Auth Module (partial)

**File:** `backend/src/modules/auth/auth.module.ts`

Only registers the OTP service for now. AuthController, AuthService, JWT strategy added in issues #3-#7.

- Imports: `UsersModule`
- Providers: `OtpService`
- Exports: `OtpService`

## 8. app.module.ts Changes

Add two new global modules to imports:

```typescript
imports: [
  // ... existing
  RedisModule,   // NEW
  SmsModule,     // NEW
  // ... existing modules unchanged
]
```

## File Inventory

### Create new:
| File | Purpose |
|------|---------|
| `shared/redis/redis.module.ts` | Global ioredis provider |
| `shared/redis/redis.constants.ts` | REDIS_CLIENT token |
| `shared/sms/sms.interface.ts` | SmsService interface + token |
| `shared/sms/sms.module.ts` | Global SMS provider |
| `shared/sms/console-sms.service.ts` | Dev stub — logs OTP to console |

### Implement (exist but empty):
| File | Purpose |
|------|---------|
| `shared/enums/index.ts` | UserRole, KycStatus, PreferredLanguage |
| `modules/users/user.entity.ts` | User table definition |
| `modules/users/users.module.ts` | Users module registration |
| `modules/users/users.service.ts` | create, findByPhone, findById |
| `modules/auth/otp.service.ts` | OTP generation, storage, verification |
| `modules/auth/auth.module.ts` | Auth module (OtpService only for now) |

### Modify:
| File | Change |
|------|--------|
| `app.module.ts` | Add RedisModule, SmsModule to imports |

### Install:
| Package | Purpose |
|---------|---------|
| `ioredis` | Redis client |
| `@types/ioredis` | TypeScript types |

## Not in Scope

- AuthController, AuthService, JWT strategy, DTOs — issues #3-#8
- KYC uploads, guards — issues #9-#14
- Profile endpoints — issues #15-#19
- Guards, decorators, interceptors — implemented when first consumer needs them
