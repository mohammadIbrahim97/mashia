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
