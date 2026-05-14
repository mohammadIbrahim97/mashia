import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { UsersService } from '../users/users.service';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';
import { User } from '../users/user.entity';
import { REDIS_CLIENT } from '@shared/redis/redis.constants';

describe('AuthService', () => {
  let authService: AuthService;
  let otpService: jest.Mocked<OtpService>;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let mockRedis: Record<string, jest.Mock>;

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

  beforeEach(async () => {
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };

    otpService = {
      generateAndSend: jest.fn().mockResolvedValue(undefined),
      verify: jest.fn().mockResolvedValue(true),
      peek: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<OtpService>;

    usersService = {
      findByPhone: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(null),
      findAdminByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockUser),
      updateAuthFields: jest.fn().mockResolvedValue(undefined),
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
        { provide: REDIS_CLIENT, useValue: mockRedis },
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
    it('should peek (not consume) the OTP and return userExists false for new phone', async () => {
      usersService.findByPhone.mockResolvedValue(null);
      const result = await authService.verifyOtp('+966501234567', '123456');
      expect(otpService.peek).toHaveBeenCalledWith('+966501234567', '123456');
      expect(otpService.verify).not.toHaveBeenCalled();
      expect(usersService.findByPhone).toHaveBeenCalledWith('+966501234567');
      expect(result).toEqual({ verified: true, userExists: false });
    });

    it('should return verified true and userExists true for existing user', async () => {
      usersService.findByPhone.mockResolvedValue(mockUser);
      const result = await authService.verifyOtp('+966501234567', '123456');
      expect(result).toEqual({ verified: true, userExists: true });
    });

    it('should propagate errors from otpService.peek', async () => {
      otpService.peek.mockRejectedValue(new Error('OTP expired'));
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
        { sub: mockUser.id, phone: mockUser.phone, role: mockUser.role, jti: expect.any(String) },
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

  describe('login', () => {
    it('should verify OTP, find existing user, and return tokens', async () => {
      usersService.findByPhone.mockResolvedValue(mockUser);
      jwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await authService.login('+966501234567', '123456');

      expect(otpService.verify).toHaveBeenCalledWith('+966501234567', '123456');
      expect(usersService.findByPhone).toHaveBeenCalledWith('+966501234567');
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).toEqual(mockUser);
    });

    it('should throw NotFoundException when phone not registered', async () => {
      usersService.findByPhone.mockResolvedValue(null);

      await expect(authService.login('+966501234567', '123456')).rejects.toThrow(
        NotFoundException,
      );
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should propagate OTP errors before user lookup', async () => {
      otpService.verify.mockRejectedValue(new Error('OTP expired'));

      await expect(authService.login('+966501234567', '123456')).rejects.toThrow(
        'OTP expired',
      );
      expect(usersService.findByPhone).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const validPayload = {
      sub: '550e8400-e29b-41d4-a716-446655440000',
      phone: '+966501234567',
      role: 'buyer',
      jti: 'test-jti-uuid',
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    it('should verify token, blacklist old jti, and return new tokens', async () => {
      jwtService.verify = jest.fn().mockReturnValue(validPayload);
      mockRedis.get.mockResolvedValue(null); // not blacklisted
      usersService.findById.mockResolvedValue(mockUser);
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await authService.refresh('old-refresh-token');

      expect(jwtService.verify).toHaveBeenCalledWith('old-refresh-token', {
        secret: 'test-refresh-secret',
      });
      expect(mockRedis.get).toHaveBeenCalledWith('rt_blacklist:test-jti-uuid');
      expect(usersService.findById).toHaveBeenCalledWith(validPayload.sub);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'rt_blacklist:test-jti-uuid',
        '1',
        'EX',
        expect.any(Number),
      );
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';
      jwtService.verify = jest.fn().mockImplementation(() => { throw error; });

      await expect(authService.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for malformed token', async () => {
      const error = new Error('jwt malformed');
      error.name = 'JsonWebTokenError';
      jwtService.verify = jest.fn().mockImplementation(() => { throw error; });

      await expect(authService.refresh('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for blacklisted token', async () => {
      jwtService.verify = jest.fn().mockReturnValue(validPayload);
      mockRedis.get.mockResolvedValue('1'); // blacklisted

      await expect(authService.refresh('used-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.findById).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when user no longer exists', async () => {
      jwtService.verify = jest.fn().mockReturnValue(validPayload);
      mockRedis.get.mockResolvedValue(null);
      usersService.findById.mockResolvedValue(null);

      await expect(authService.refresh('orphan-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should set blacklist TTL to remaining seconds until token expiry', async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const payloadWithKnownExp = { ...validPayload, exp: nowSec + 5000 };
      jwtService.verify = jest.fn().mockReturnValue(payloadWithKnownExp);
      mockRedis.get.mockResolvedValue(null);
      usersService.findById.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('token');

      await authService.refresh('some-token');

      const setCall = mockRedis.set.mock.calls[0];
      const ttl = setCall[3]; // 4th arg is the TTL
      // TTL should be approximately 5000 (±2 sec for test execution)
      expect(ttl).toBeGreaterThanOrEqual(4998);
      expect(ttl).toBeLessThanOrEqual(5000);
    });
  });

  describe('admin auth', () => {
    const adminEmail = 'admin@mashia.com';
    const adminPassword = 'CorrectHorseBattery1!';
    const totpSecret = authenticator.generateSecret();

    const adminUserNoTotp: User = {
      ...mockUser,
      role: UserRole.ADMIN,
      email: adminEmail,
    } as User;

    const adminUserWithTotp: User = {
      ...adminUserNoTotp,
      totpEnabled: true,
      totpSecret,
    } as User;

    describe('adminLogin', () => {
      it('returns tokens directly when TOTP is not enabled', async () => {
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        usersService.findAdminByEmail.mockResolvedValue({
          ...adminUserNoTotp,
          passwordHash,
        } as User);
        jwtService.sign
          .mockReturnValueOnce('access-token')
          .mockReturnValueOnce('refresh-token');

        const result = await authService.adminLogin(adminEmail, adminPassword);

        expect('accessToken' in result).toBe(true);
        if ('accessToken' in result) {
          expect(result.accessToken).toBe('access-token');
          expect(result.user.role).toBe(UserRole.ADMIN);
        }
        expect(mockRedis.set).not.toHaveBeenCalled();
      });

      it('returns a ticket when TOTP is enabled', async () => {
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        usersService.findAdminByEmail.mockResolvedValue({
          ...adminUserWithTotp,
          passwordHash,
        } as User);

        const result = await authService.adminLogin(adminEmail, adminPassword);

        expect(result).toHaveProperty('requiresTotp', true);
        expect(result).toHaveProperty('ticket');
        expect(mockRedis.set).toHaveBeenCalledWith(
          expect.stringMatching(/^admin_totp_ticket:/),
          adminUserWithTotp.id,
          'EX',
          expect.any(Number),
        );
      });

      it('throws UnauthorizedException for wrong password', async () => {
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        usersService.findAdminByEmail.mockResolvedValue({
          ...adminUserNoTotp,
          passwordHash,
        } as User);

        await expect(
          authService.adminLogin(adminEmail, 'wrong-password'),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('throws UnauthorizedException when admin not found', async () => {
        usersService.findAdminByEmail.mockResolvedValue(null);

        await expect(
          authService.adminLogin('nobody@nowhere.com', adminPassword),
        ).rejects.toThrow(UnauthorizedException);
      });
    });

    describe('verifyAdminTotp', () => {
      it('exchanges valid ticket + code for tokens', async () => {
        mockRedis.get.mockResolvedValue(adminUserWithTotp.id);
        usersService.findById.mockResolvedValue(adminUserWithTotp);
        const code = authenticator.generate(totpSecret);
        jwtService.sign
          .mockReturnValueOnce('access-token')
          .mockReturnValueOnce('refresh-token');

        const result = await authService.verifyAdminTotp('valid-ticket', code);

        expect(result.accessToken).toBe('access-token');
        expect(mockRedis.del).toHaveBeenCalledWith(
          'admin_totp_ticket:valid-ticket',
          'admin_totp_ticket_attempts:valid-ticket',
        );
      });

      it('throws UnauthorizedException for expired ticket', async () => {
        mockRedis.get.mockResolvedValue(null);

        await expect(
          authService.verifyAdminTotp('expired', '000000'),
        ).rejects.toThrow(UnauthorizedException);
      });

      it('throws UnauthorizedException for wrong TOTP code', async () => {
        mockRedis.get.mockResolvedValue(adminUserWithTotp.id);
        usersService.findById.mockResolvedValue(adminUserWithTotp);
        mockRedis.incr.mockResolvedValue(1);

        await expect(
          authService.verifyAdminTotp('valid-ticket', '000000'),
        ).rejects.toThrow(UnauthorizedException);
        expect(mockRedis.incr).toHaveBeenCalledWith(
          'admin_totp_ticket_attempts:valid-ticket',
        );
        expect(mockRedis.expire).toHaveBeenCalledWith(
          'admin_totp_ticket_attempts:valid-ticket',
          expect.any(Number),
        );
        expect(mockRedis.del).not.toHaveBeenCalled();
      });

      it('invalidates ticket when max failed attempts are reached', async () => {
        mockRedis.get.mockResolvedValue(adminUserWithTotp.id);
        usersService.findById.mockResolvedValue(adminUserWithTotp);
        mockRedis.incr.mockResolvedValue(5);

        await expect(
          authService.verifyAdminTotp('valid-ticket', '000000'),
        ).rejects.toThrow('Ticket expired or invalid');
        expect(mockRedis.del).toHaveBeenCalledWith(
          'admin_totp_ticket:valid-ticket',
          'admin_totp_ticket_attempts:valid-ticket',
        );
      });

      it('throws when user no longer has TOTP enabled', async () => {
        mockRedis.get.mockResolvedValue(adminUserNoTotp.id);
        usersService.findById.mockResolvedValue(adminUserNoTotp);

        await expect(
          authService.verifyAdminTotp('valid-ticket', '123456'),
        ).rejects.toThrow(UnauthorizedException);
      });
    });

    describe('setupAdminTotp', () => {
      it('generates a secret, persists it, and returns otpauth URL', async () => {
        const result = await authService.setupAdminTotp(adminUserNoTotp);

        expect(result.secret).toEqual(expect.any(String));
        expect(result.otpauthUrl).toContain('otpauth://totp/');
        expect(result.otpauthUrl).toContain(encodeURIComponent('Mashia Admin'));
        expect(usersService.updateAuthFields).toHaveBeenCalledWith(
          adminUserNoTotp.id,
          { totpSecret: result.secret, totpEnabled: false },
        );
      });
    });

    describe('enableAdminTotp', () => {
      it('flips totpEnabled when code is valid', async () => {
        const code = authenticator.generate(totpSecret);
        const userWithSecret = { ...adminUserNoTotp, totpSecret } as User;

        const result = await authService.enableAdminTotp(userWithSecret, code);

        expect(result).toEqual({ enabled: true });
        expect(usersService.updateAuthFields).toHaveBeenCalledWith(
          userWithSecret.id,
          { totpEnabled: true },
        );
      });

      it('throws BadRequestException when no secret on file', async () => {
        await expect(
          authService.enableAdminTotp(adminUserNoTotp, '123456'),
        ).rejects.toThrow(BadRequestException);
      });

      it('throws UnauthorizedException for invalid code', async () => {
        const userWithSecret = { ...adminUserNoTotp, totpSecret } as User;

        await expect(
          authService.enableAdminTotp(userWithSecret, '000000'),
        ).rejects.toThrow(UnauthorizedException);
        expect(usersService.updateAuthFields).not.toHaveBeenCalled();
      });
    });
  });
});
