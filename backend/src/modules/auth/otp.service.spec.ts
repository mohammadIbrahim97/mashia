import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TooManyRequestsException } from '@shared/exceptions/too-many-requests.exception';
import { OtpService } from './otp.service';
import { REDIS_CLIENT } from '@shared/redis/redis.constants';
import { SMS_SERVICE } from '@shared/sms/sms.interface';

describe('OtpService', () => {
  let service: OtpService;
  let mockRedis: Record<string, jest.Mock>;
  let mockSmsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(300),
    };

    mockSmsService = {
      sendOtp: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
        { provide: SMS_SERVICE, useValue: mockSmsService },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  describe('generateAndSend', () => {
    it('should generate a 6-digit OTP and store it in Redis with 5-min TTL', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.generateAndSend('+966501234567');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'otp:code:+966501234567',
        expect.stringMatching(/^\d{6}$/),
        'EX',
        300,
      );
    });

    it('should send the OTP via SMS service', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.generateAndSend('+966501234567');

      expect(mockSmsService.sendOtp).toHaveBeenCalledWith(
        '+966501234567',
        expect.stringMatching(/^\d{6}$/),
      );
    });

    it('should increment the attempt counter with 1-hour TTL', async () => {
      mockRedis.get.mockResolvedValue(null);

      await service.generateAndSend('+966501234567');

      expect(mockRedis.incr).toHaveBeenCalledWith('otp:attempts:+966501234567');
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'otp:attempts:+966501234567',
        3600,
      );
    });

    it('should throw TooManyRequestsException after 5 attempts', async () => {
      mockRedis.get.mockResolvedValue('5');

      await expect(service.generateAndSend('+966501234567')).rejects.toThrow(
        TooManyRequestsException,
      );
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockSmsService.sendOtp).not.toHaveBeenCalled();
    });

    it('should allow up to 5 attempts', async () => {
      mockRedis.get.mockResolvedValue('4');

      await service.generateAndSend('+966501234567');

      expect(mockRedis.set).toHaveBeenCalled();
      expect(mockSmsService.sendOtp).toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('should return true for a valid OTP', async () => {
      mockRedis.get.mockResolvedValue('123456');

      const result = await service.verify('+966501234567', '123456');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith(
        'otp:code:+966501234567',
        'otp:verify:attempts:+966501234567',
      );
    });

    it('should throw BadRequestException for expired or non-existent OTP', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.verify('+966501234567', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for incorrect OTP', async () => {
      mockRedis.get.mockResolvedValue('123456');
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.ttl.mockResolvedValue(240);

      await expect(service.verify('+966501234567', '999999')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRedis.incr).toHaveBeenCalledWith(
        'otp:verify:attempts:+966501234567',
      );
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'otp:verify:attempts:+966501234567',
        240,
      );
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should invalidate OTP after max failed verification attempts', async () => {
      mockRedis.get.mockResolvedValue('123456');
      mockRedis.incr.mockResolvedValue(5);
      mockRedis.ttl.mockResolvedValue(120);

      await expect(service.verify('+966501234567', '999999')).rejects.toThrow(
        new BadRequestException('OTP expired or not found.'),
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        'otp:code:+966501234567',
        'otp:verify:attempts:+966501234567',
      );
    });
  });

  describe('peek', () => {
    it('returns true for a valid OTP without consuming it', async () => {
      mockRedis.get.mockResolvedValue('123456');

      const result = await service.peek('+966501234567', '123456');

      expect(result).toBe(true);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for expired or non-existent OTP', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.peek('+966501234567', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for incorrect OTP and does not consume', async () => {
      mockRedis.get.mockResolvedValue('123456');

      await expect(service.peek('+966501234567', '999999')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
