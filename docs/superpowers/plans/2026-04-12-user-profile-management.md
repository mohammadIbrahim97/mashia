# US03: User Profile Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement GET /users/me and PATCH /users/me endpoints so authenticated users can view and update their profiles.

**Architecture:** Two new routes on the existing UsersController, delegating to UsersService. A new @CurrentUser() decorator extracts the authenticated user. UpdateProfileDto validates the 4 updatable fields. ProfileResponseDto strips kycDocuments from responses. Global ValidationPipe (whitelist + forbidNonWhitelisted) already prevents injection of protected fields.

**Tech Stack:** NestJS, TypeORM, class-validator, Jest

**Spec:** `docs/superpowers/specs/2026-04-12-user-profile-management-design.md`

---

## File Map

```
backend/src/
├── shared/
│   └── decorators/
│       └── current-user.decorator.ts          → NEW: @CurrentUser() param decorator
├── modules/
│   └── users/
│       ├── users.module.ts                    → MODIFY: add UsersController to controllers
│       ├── users.controller.ts                → MODIFY: add GET /me and PATCH /me routes
│       ├── users.service.ts                   → MODIFY: add updateProfile method
│       ├── users.service.spec.ts              → MODIFY: add updateProfile tests
│       ├── users.controller.spec.ts           → NEW: controller unit tests
│       └── dto/
│           ├── update-profile.dto.ts          → NEW: PATCH body validation
│           └── profile-response.dto.ts        → NEW: response shape (User minus kycDocuments)
```

---

### Task 1: @CurrentUser() Decorator + DTOs

**Files:**
- Create: `backend/src/shared/decorators/current-user.decorator.ts`
- Create: `backend/src/modules/users/dto/profile-response.dto.ts`
- Create: `backend/src/modules/users/dto/update-profile.dto.ts`

These are pure declarations with no logic to TDD against. Create them all upfront.

- [ ] **Step 1: Create @CurrentUser() decorator**

```typescript
// backend/src/shared/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().user;
  },
);
```

- [ ] **Step 2: Create ProfileResponseDto**

```typescript
// backend/src/modules/users/dto/profile-response.dto.ts
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';
import { User } from '../user.entity';

export class ProfileResponseDto {
  id: string;
  role: UserRole;
  fullName: string;
  phone: string;
  email: string | null;
  country: string;
  city: string;
  kycStatus: KycStatus;
  preferredLanguage: PreferredLanguage;
  createdAt: Date;
  updatedAt: Date;

  static fromUser(user: User): ProfileResponseDto {
    const dto = new ProfileResponseDto();
    dto.id = user.id;
    dto.role = user.role;
    dto.fullName = user.fullName;
    dto.phone = user.phone;
    dto.email = user.email;
    dto.country = user.country;
    dto.city = user.city;
    dto.kycStatus = user.kycStatus;
    dto.preferredLanguage = user.preferredLanguage;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
```

- [ ] **Step 3: Create UpdateProfileDto**

```typescript
// backend/src/modules/users/dto/update-profile.dto.ts
import { IsOptional, IsString, IsEmail, IsEnum, Length } from 'class-validator';
import { PreferredLanguage } from '@shared/enums';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  city?: string;

  @IsOptional()
  @IsEnum(PreferredLanguage)
  preferredLanguage?: PreferredLanguage;
}
```

- [ ] **Step 4: Verify files compile**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit`
Expected: No errors

---

### Task 2: UsersService.updateProfile (TDD)

**Files:**
- Modify: `backend/src/modules/users/users.service.spec.ts`
- Modify: `backend/src/modules/users/users.service.ts`

- [ ] **Step 1: Write failing tests for updateProfile**

Add to the existing `users.service.spec.ts`, inside the top-level `describe('UsersService')` block. The existing `beforeEach` already sets up a mock repository with `create`, `save`, and `findOne` — you need to add `update` to that mock.

Update the mock repository in `beforeEach` to include `update`:

```typescript
const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
};
```

Then add this new `describe` block after the existing `describe('findById')` block:

```typescript
describe('updateProfile', () => {
  it('should update fields and return updated user', async () => {
    const updatedUser = {
      ...mockUser,
      fullName: 'Ahmad Updated',
      city: 'Jeddah',
    };
    repository.update.mockResolvedValue(undefined);
    repository.findOne.mockResolvedValue(updatedUser as User);

    const result = await service.updateProfile(
      '550e8400-e29b-41d4-a716-446655440000',
      { fullName: 'Ahmad Updated', city: 'Jeddah' },
    );

    expect(repository.update).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      { fullName: 'Ahmad Updated', city: 'Jeddah' },
    );
    expect(result).toEqual(updatedUser);
  });

  it('should handle empty dto as no-op and return current user', async () => {
    repository.update.mockResolvedValue(undefined);
    repository.findOne.mockResolvedValue(mockUser as User);

    const result = await service.updateProfile(
      '550e8400-e29b-41d4-a716-446655440000',
      {},
    );

    expect(repository.update).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      {},
    );
    expect(result).toEqual(mockUser);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest users.service.spec.ts --verbose`
Expected: 2 new tests FAIL with "service.updateProfile is not a function"

- [ ] **Step 3: Implement updateProfile in UsersService**

Add this method to `backend/src/modules/users/users.service.ts` after the existing `updateKycDocuments` method. You also need to import `UpdateProfileDto` at the top of the file.

Add import at top:

```typescript
import { UpdateProfileDto } from './dto/update-profile.dto';
```

Add method to the class:

```typescript
async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
  await this.usersRepository.update(userId, dto);
  return this.findById(userId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest users.service.spec.ts --verbose`
Expected: All 7 tests PASS (5 existing + 2 new)

---

### Task 3: UsersController + Module Registration

**Files:**
- Modify: `backend/src/modules/users/users.controller.ts`
- Modify: `backend/src/modules/users/users.module.ts`

- [ ] **Step 1: Implement UsersController**

Replace the empty `backend/src/modules/users/users.controller.ts` with:

```typescript
import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { User } from './user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: User): Promise<ProfileResponseDto> {
    return ProfileResponseDto.fromUser(user);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    const updated = await this.usersService.updateProfile(user.id, dto);
    return ProfileResponseDto.fromUser(updated);
  }
}
```

- [ ] **Step 2: Register UsersController in UsersModule**

In `backend/src/modules/users/users.module.ts`, add the controller import and register it:

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

- [ ] **Step 3: Verify files compile**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit`
Expected: No errors

---

### Task 4: UsersController Unit Tests

**Files:**
- Create: `backend/src/modules/users/users.controller.spec.ts`

- [ ] **Step 1: Write controller tests**

```typescript
// backend/src/modules/users/users.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';
import { ProfileResponseDto } from './dto/profile-response.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<Partial<UsersService>>;

  const mockUser: User = {
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
    createdAt: new Date('2026-04-12T00:00:00Z'),
    updatedAt: new Date('2026-04-12T00:00:00Z'),
  };

  beforeEach(async () => {
    usersService = {
      updateProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('getProfile', () => {
    it('should return profile without kycDocuments', async () => {
      const result = await controller.getProfile(mockUser);

      expect(result).toBeInstanceOf(ProfileResponseDto);
      expect(result.id).toBe(mockUser.id);
      expect(result.fullName).toBe(mockUser.fullName);
      expect(result.kycStatus).toBe(KycStatus.PENDING);
      expect(result).not.toHaveProperty('kycDocuments');
    });
  });

  describe('updateProfile', () => {
    it('should call service.updateProfile and return updated profile', async () => {
      const updatedUser = { ...mockUser, fullName: 'Ahmad Updated', city: 'Jeddah' };
      usersService.updateProfile.mockResolvedValue(updatedUser as User);

      const result = await controller.updateProfile(mockUser, {
        fullName: 'Ahmad Updated',
        city: 'Jeddah',
      });

      expect(usersService.updateProfile).toHaveBeenCalledWith(
        mockUser.id,
        { fullName: 'Ahmad Updated', city: 'Jeddah' },
      );
      expect(result).toBeInstanceOf(ProfileResponseDto);
      expect(result.fullName).toBe('Ahmad Updated');
      expect(result.city).toBe('Jeddah');
      expect(result).not.toHaveProperty('kycDocuments');
    });
  });
});
```

- [ ] **Step 2: Run controller tests**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest users.controller.spec.ts --verbose`
Expected: 2 tests PASS

- [ ] **Step 3: Run full test suite**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --verbose`
Expected: All 76 tests PASS (71 existing + 2 service + 2 controller + 1 guard already counted in 71)

---
