# JWT Passport Strategy for Protected Routes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add JWT authentication strategy, auth guard, roles guard, and roles decorator so any route can be protected with `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles(...)`.

**Architecture:** JwtStrategy validates Bearer tokens and attaches the User entity to `request.user`. JwtAuthGuard triggers the strategy. RolesGuard reads `@Roles()` metadata and checks the user's role. All pieces are independently testable.

**Tech Stack:** NestJS 10, @nestjs/passport, passport-jwt, Jest

---

### Task 1: Create @Roles() decorator and JwtAuthGuard

**Files:**
- Create: `src/shared/decorators/roles.decorator.ts`
- Implement: `src/shared/guards/jwt-auth.guard.ts` (currently empty scaffold)

- [ ] **Step 1: Create the roles decorator**

```typescript
// src/shared/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@shared/enums';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
```

- [ ] **Step 2: Implement JwtAuthGuard**

```typescript
// src/shared/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/decorators/roles.decorator.ts src/shared/guards/jwt-auth.guard.ts
git commit -m "feat(auth): add @Roles() decorator and JwtAuthGuard for #7"
```

---

### Task 2: Write failing tests for RolesGuard

**Files:**
- Create: `src/shared/guards/roles.guard.spec.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/shared/guards/roles.guard.spec.ts
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { UserRole } from '@shared/enums';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  const mockExecutionContext = (role: UserRole): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { role } }),
      }),
    }) as unknown as ExecutionContext;

  it('should allow access when no @Roles metadata is set', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = mockExecutionContext(UserRole.BUYER);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user role matches required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.SELLER, UserRole.ADMIN]);
    const context = mockExecutionContext(UserRole.SELLER);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when user role does not match', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const context = mockExecutionContext(UserRole.BUYER);

    expect(guard.canActivate(context)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern roles.guard.spec --verbose 2>&1 | tail -15`
Expected: 3 failures (RolesGuard is empty, no exports).

- [ ] **Step 3: Commit**

```bash
git add src/shared/guards/roles.guard.spec.ts
git commit -m "test(auth): add failing RolesGuard tests for #7"
```

---

### Task 3: Implement RolesGuard and make tests pass

**Files:**
- Implement: `src/shared/guards/roles.guard.ts` (currently empty scaffold)

- [ ] **Step 1: Implement RolesGuard**

```typescript
// src/shared/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@shared/enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern roles.guard.spec --verbose 2>&1 | tail -15`
Expected: All 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/shared/guards/roles.guard.ts
git commit -m "feat(auth): implement RolesGuard for #7"
```

---

### Task 4: Write failing tests for JwtStrategy

**Files:**
- Create: `src/modules/auth/jwt.strategy.spec.ts`

The strategy's `validate()` method is what we test. It receives a decoded JWT payload and looks up the user.

- [ ] **Step 1: Create the test file**

```typescript
// src/modules/auth/jwt.strategy.spec.ts
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';
import { User } from '../users/user.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersService: jest.Mocked<UsersService>;

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

  beforeEach(() => {
    usersService = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    const configService = {
      get: jest.fn().mockReturnValue('test-jwt-secret'),
    } as unknown as ConfigService;

    strategy = new JwtStrategy(configService, usersService);
  });

  it('should return user when valid payload with existing user ID', async () => {
    usersService.findById.mockResolvedValue(mockUser);

    const result = await strategy.validate({
      sub: '550e8400-e29b-41d4-a716-446655440000',
      phone: '+966501234567',
      role: 'buyer',
    });

    expect(usersService.findById).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
    );
    expect(result).toEqual(mockUser);
  });

  it('should throw UnauthorizedException when user not found', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(
      strategy.validate({
        sub: 'nonexistent-id',
        phone: '+966501234567',
        role: 'buyer',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern jwt.strategy.spec --verbose 2>&1 | tail -15`
Expected: 2 failures (JwtStrategy is empty, no exports).

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/jwt.strategy.spec.ts
git commit -m "test(auth): add failing JwtStrategy tests for #7"
```

---

### Task 5: Implement JwtStrategy and update AuthModule

**Files:**
- Implement: `src/modules/auth/jwt.strategy.ts` (currently empty scaffold)
- Modify: `src/modules/auth/auth.module.ts`

- [ ] **Step 1: Implement JwtStrategy**

```typescript
// src/modules/auth/jwt.strategy.ts
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

- [ ] **Step 2: Update AuthModule**

Replace the entire contents of `src/modules/auth/auth.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [UsersModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, OtpService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 3: Run JwtStrategy tests to verify they pass**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --testPathPattern jwt.strategy.spec --verbose 2>&1 | tail -15`
Expected: All 2 tests pass.

- [ ] **Step 4: Run full test suite**

Run: `cd /home/mohammadibrahim/mashia/backend && npx jest --verbose 2>&1 | tail -15`
Expected: All 38 tests pass (33 existing + 2 JwtStrategy + 3 RolesGuard).

- [ ] **Step 5: Verify TypeScript compilation**

Run: `cd /home/mohammadibrahim/mashia/backend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/modules/auth/jwt.strategy.ts src/modules/auth/auth.module.ts
git commit -m "feat(auth): implement JwtStrategy and wire up PassportModule for #7"
```

---

### Task 6: E2E smoke test

**Files:** None (manual verification only)

Verify that protected routes work by applying the guard to an existing endpoint temporarily, or by starting the server and confirming everything boots cleanly.

- [ ] **Step 1: Ensure Docker containers are running**

Run: `cd /home/mohammadibrahim/mashia && docker compose ps`
Expected: `mashia-db` and `mashia-redis` both healthy. If not, run `docker compose up -d`.

- [ ] **Step 2: Start the NestJS server**

Run: `cd /home/mohammadibrahim/mashia/backend && npx nest start 2>&1 &`
Wait a few seconds for startup. Confirm all routes are mapped including the existing auth routes.

- [ ] **Step 3: Test that unprotected routes still work**

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/otp/send \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+966501119999"}' | jq .
```
Expected: `{ "success": true, "data": { "message": "OTP sent" } }`

- [ ] **Step 4: Register a user and get a token**

Get OTP from Redis, then register:
```bash
OTP=$(docker exec mashia-redis redis-cli get "otp:code:+966501119999")
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"+966501119999\",\"code\":\"$OTP\",\"role\":\"buyer\",\"fullName\":\"Guard Test\",\"country\":\"SA\",\"city\":\"Riyadh\"}" | jq -r '.data.accessToken'
```
Expected: A JWT access token string. Save it for Step 5.

- [ ] **Step 5: Verify JWT is valid by decoding it**

```bash
echo "<TOKEN>" | cut -d. -f2 | base64 -d 2>/dev/null | jq .
```
Expected: Payload with `sub`, `phone`, `role` fields — confirms the token is correctly formed and the strategy will be able to parse it.

- [ ] **Step 6: Kill the server**

Run: `kill $(lsof -t -i:3000) 2>/dev/null`
