import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { UsersService } from '../users/users.service';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';
import { User } from '../users/user.entity';

describe('AuthService', () => {
  let authService: AuthService;
  let otpService: jest.Mocked<OtpService>;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

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

  beforeEach(async () => {
    otpService = {
      generateAndSend: jest.fn().mockResolvedValue(undefined),
      verify: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<OtpService>;

    usersService = {
      findByPhone: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockUser),
    } as unknown as jest.Mocked<UsersService>;

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
    } as unknown as jest.Mocked<JwtService>;

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          JWT_SECRET: 'test-secret',
          JWT_EXPIRATION: '15m',
          JWT_REFRESH_SECRET: 'test-refresh-secret',
          JWT_REFRESH_EXPIRATION: '7d',
        };
        return config[key];
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: OtpService, useValue: otpService },
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
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
      usersService.findByPhone.mockResolvedValue(mockUser);
      const result = await authService.verifyOtp('+966501234567', '123456');
      expect(result).toEqual({ verified: true, userExists: true });
    });

    it('should propagate errors from otpService.verify', async () => {
      otpService.verify.mockRejectedValue(new Error('OTP expired'));
      await expect(authService.verifyOtp('+966501234567', '123456')).rejects.toThrow('OTP expired');
      expect(usersService.findByPhone).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    const registerDto = {
      phone: '+966501234567',
      code: '123456',
      role: UserRole.BUYER,
      fullName: 'Ahmad Ali',
      country: 'SA',
      city: 'Riyadh',
    };

    it('should verify OTP, create user, and return tokens', async () => {
      usersService.findByPhone.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await authService.register(registerDto);

      expect(otpService.verify).toHaveBeenCalledWith('+966501234567', '123456');
      expect(usersService.findByPhone).toHaveBeenCalledWith('+966501234567');
      expect(usersService.create).toHaveBeenCalledWith({
        phone: '+966501234567',
        role: UserRole.BUYER,
        fullName: 'Ahmad Ali',
        country: 'SA',
        city: 'Riyadh',
        email: undefined,
        preferredLanguage: undefined,
      });
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).toEqual(mockUser);
    });

    it('should sign access token with JWT_SECRET and 15m expiry', async () => {
      usersService.findByPhone.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);

      await authService.register(registerDto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, phone: mockUser.phone, role: mockUser.role },
        { secret: 'test-secret', expiresIn: '15m' },
      );
    });

    it('should sign refresh token with JWT_REFRESH_SECRET and 7d expiry', async () => {
      usersService.findByPhone.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);

      await authService.register(registerDto);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, phone: mockUser.phone, role: mockUser.role },
        { secret: 'test-refresh-secret', expiresIn: '7d' },
      );
    });

    it('should throw ConflictException if phone already registered', async () => {
      usersService.findByPhone.mockResolvedValue(mockUser);

      await expect(authService.register(registerDto)).rejects.toThrow(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should propagate OTP errors before creating user', async () => {
      otpService.verify.mockRejectedValue(new Error('OTP expired'));

      await expect(authService.register(registerDto)).rejects.toThrow('OTP expired');
      expect(usersService.findByPhone).not.toHaveBeenCalled();
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should pass optional email and preferredLanguage to create', async () => {
      usersService.findByPhone.mockResolvedValue(null);
      usersService.create.mockResolvedValue({
        ...mockUser,
        email: 'ahmad@example.com',
        preferredLanguage: PreferredLanguage.EN,
      });

      await authService.register({
        ...registerDto,
        email: 'ahmad@example.com',
        preferredLanguage: PreferredLanguage.EN,
      });

      expect(usersService.create).toHaveBeenCalledWith({
        phone: '+966501234567',
        role: UserRole.BUYER,
        fullName: 'Ahmad Ali',
        country: 'SA',
        city: 'Riyadh',
        email: 'ahmad@example.com',
        preferredLanguage: PreferredLanguage.EN,
      });
    });
  });
});
