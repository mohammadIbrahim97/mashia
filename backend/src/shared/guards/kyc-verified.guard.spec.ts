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
