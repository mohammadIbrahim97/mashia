# Auth Controller Unit Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write unit tests for all 5 `AuthController` endpoints plus error propagation.

**Architecture:** Mock `AuthService` entirely. Each test verifies the controller calls the correct service method with the correct arguments and returns the expected result. No NestJS HTTP layer — just direct method calls on the controller instance.

**Tech Stack:** Jest, @nestjs/testing

---

### Task 1: Write all AuthController tests

**Files:**
- Implement: `src/modules/auth/auth.controller.spec.ts` (currently empty scaffold)

- [ ] **Step 1: Write the complete test file**

```typescript
// src/modules/auth/auth.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';
import { User } from '../users/user.entity';
import { TooManyRequestsException } from '@shared/exceptions/too-many-requests.exception';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  };

  beforeEach(async () => {
    authService = {
      sendOtp: jest.fn().mockResolvedValue(undefined),
      verifyOtp: jest.fn().mockResolvedValue({ verified: true, userExists: false }),
      register: jest.fn().mockResolvedValue({ ...mockTokens, user: mockUser }),
      login: jest.fn().mockResolvedValue({ ...mockTokens, user: mockUser }),
      refresh: jest.fn().mockResolvedValue(mockTokens),
    } as unknown as jest.Mocked<AuthService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('sendOtp', () => {
    it('should call authService.sendOtp and return success message', async () => {
      const result = await controller.sendOtp({ phone: '+966501234567' });

      expect(authService.sendOtp).toHaveBeenCalledWith('+966501234567');
      expect(result).toEqual({ message: 'OTP sent' });
    });
  });

  describe('verifyOtp', () => {
    it('should call authService.verifyOtp and return result', async () => {
      const result = await controller.verifyOtp({
        phone: '+966501234567',
        code: '123456',
      });

      expect(authService.verifyOtp).toHaveBeenCalledWith('+966501234567', '123456');
      expect(result).toEqual({ verified: true, userExists: false });
    });
  });

  describe('register', () => {
    it('should call authService.register with DTO and return tokens + user', async () => {
      const dto = {
        phone: '+966501234567',
        code: '123456',
        role: UserRole.BUYER,
        fullName: 'Ahmad Ali',
        country: 'SA',
        city: 'Riyadh',
      };

      const result = await controller.register(dto as any);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ ...mockTokens, user: mockUser });
    });
  });

  describe('login', () => {
    it('should call authService.login with phone and code, return tokens + user', async () => {
      const result = await controller.login({
        phone: '+966501234567',
        code: '123456',
      });

      expect(authService.login).toHaveBeenCalledWith('+966501234567', '123456');
      expect(result).toEqual({ ...mockTokens, user: mockUser });
    });
  });

  describe('refresh', () => {
    it('should call authService.refresh with refreshToken and return new pair', async () => {
      const result = await controller.refresh({
        refreshToken: 'old-refresh-token',
      });

      expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
      expect(result).toEqual(mockTokens);
    });
  });

  describe('error propagation', () => {
    it('should propagate service errors to caller', async () => {
      authService.sendOtp.mockRejectedValue(
        new TooManyRequestsException('Too many OTP requests. Try again later.'),
      );

      await expect(
        controller.sendOtp({ phone: '+966501234567' }),
      ).rejects.toThrow(TooManyRequestsException);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern auth.controller.spec --verbose 2>&1 | tail -20`
Expected: All 6 tests pass.

- [ ] **Step 3: Run full test suite to check for regressions**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --verbose 2>&1 | tail -15`
Expected: All 44 tests pass (38 existing + 6 new controller tests). The 7 remaining empty scaffold spec files still "fail" (pre-existing, no tests).

- [ ] **Step 4: Commit**

```bash
git add src/modules/auth/auth.controller.spec.ts
git commit -m "test(auth): add controller unit tests for all 5 endpoints (#8)"
```
