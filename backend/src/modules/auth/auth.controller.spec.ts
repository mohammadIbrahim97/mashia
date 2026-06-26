import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';
import { User } from '../users/user.entity';
import { ProfileResponseDto } from '../users/dto/profile-response.dto';
import { TooManyRequestsException } from '@shared/exceptions/too-many-requests.exception';
import { ThrottlerStorage, getOptionsToken } from '@nestjs/throttler';

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
    passwordHash: null,
    totpSecret: null,
    totpEnabled: false,
    suspended: false,
    kycRejectionReason: null,
    kycReviewedAt: null,
    kycReviewedById: null,
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
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ThrottlerStorage, useValue: {} },
        { provide: getOptionsToken(), useValue: {} }
      ],
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
      expect(result).toEqual({ ...mockTokens, user: ProfileResponseDto.fromUser(mockUser) });
    });
  });

  describe('login', () => {
    it('should call authService.login with phone and code, return tokens + user', async () => {
      const result = await controller.login({
        phone: '+966501234567',
        code: '123456',
      });

      expect(authService.login).toHaveBeenCalledWith('+966501234567', '123456');
      expect(result).toEqual({ ...mockTokens, user: ProfileResponseDto.fromUser(mockUser) });
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
