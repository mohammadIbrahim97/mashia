import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { UsersService } from '../users/users.service';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';

describe('AuthService', () => {
  let authService: AuthService;
  let otpService: jest.Mocked<OtpService>;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    otpService = {
      generateAndSend: jest.fn().mockResolvedValue(undefined),
      verify: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<OtpService>;

    usersService = {
      findByPhone: jest.fn().mockResolvedValue(null),
    } as unknown as jest.Mocked<UsersService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: OtpService, useValue: otpService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('sendOtp', () => {
    it('should call otpService.generateAndSend with the phone number', async () => {
      await authService.sendOtp('+966501234567');

      expect(otpService.generateAndSend).toHaveBeenCalledWith('+966501234567');
    });

    it('should propagate errors from otpService', async () => {
      otpService.generateAndSend.mockRejectedValue(new Error('Rate limited'));

      await expect(authService.sendOtp('+966501234567')).rejects.toThrow('Rate limited');
    });
  });

  describe('verifyOtp', () => {
    it('should return verified true and userExists false for new phone', async () => {
      usersService.findByPhone.mockResolvedValue(null);

      const result = await authService.verifyOtp('+966501234567', '123456');

      expect(otpService.verify).toHaveBeenCalledWith('+966501234567', '123456');
      expect(usersService.findByPhone).toHaveBeenCalledWith('+966501234567');
      expect(result).toEqual({ verified: true, userExists: false });
    });

    it('should return verified true and userExists true for existing user', async () => {
      usersService.findByPhone.mockResolvedValue({
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
      } as any);

      const result = await authService.verifyOtp('+966501234567', '123456');

      expect(result).toEqual({ verified: true, userExists: true });
    });

    it('should propagate errors from otpService.verify', async () => {
      otpService.verify.mockRejectedValue(new Error('OTP expired'));

      await expect(authService.verifyOtp('+966501234567', '123456')).rejects.toThrow('OTP expired');
      expect(usersService.findByPhone).not.toHaveBeenCalled();
    });
  });
});
