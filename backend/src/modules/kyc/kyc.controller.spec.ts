jest.mock('./kyc-file.validator', () => ({
  validateKycFile: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { KycController } from './kyc.controller';
import { KycService } from './kyc.service';
import { User } from '../users/user.entity';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';

describe('KycController', () => {
  let controller: KycController;
  let kycService: jest.Mocked<KycService>;

  const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    role: UserRole.SELLER,
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
    createdAt: new Date('2026-04-11T10:00:00.000Z'),
    updatedAt: new Date('2026-04-11T10:00:00.000Z'),
  } as User;

  const mockStatusResponse = {
    kycStatus: KycStatus.PENDING,
    submitted: true,
    documents: { nationalId: true, selfie: true, businessLicense: false },
    submittedAt: new Date('2026-04-11T10:00:00.000Z'),
  };

  beforeEach(async () => {
    kycService = {
      submit: jest.fn().mockResolvedValue(mockStatusResponse),
      getStatus: jest.fn().mockReturnValue(mockStatusResponse),
    } as unknown as jest.Mocked<KycService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KycController],
      providers: [{ provide: KycService, useValue: kycService }],
    }).compile();

    controller = module.get<KycController>(KycController);
  });

  describe('submit', () => {
    it('forwards parsed files and request user to KycService.submit', async () => {
      const fakeBuffer = Buffer.from('fake');
      const uploaded = {
        nationalId: [
          { buffer: fakeBuffer, mimetype: 'image/jpeg', size: 1024 } as Express.Multer.File,
        ],
        selfie: [
          { buffer: fakeBuffer, mimetype: 'image/jpeg', size: 1024 } as Express.Multer.File,
        ],
      };

      const result = await controller.submit(uploaded, { user: mockUser } as any);

      expect(kycService.submit).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({
          nationalId: { buffer: fakeBuffer, mimeType: 'image/jpeg' },
          selfie: { buffer: fakeBuffer, mimeType: 'image/jpeg' },
        }),
      );
      expect(result).toEqual(mockStatusResponse);
    });
  });

  describe('getStatus', () => {
    it('forwards request user to KycService.getStatus', () => {
      const result = controller.getStatus({ user: mockUser } as any);

      expect(kycService.getStatus).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockStatusResponse);
    });
  });

  describe('error propagation', () => {
    it('propagates service errors to the caller', async () => {
      kycService.submit.mockRejectedValue(new Error('boom'));

      const uploaded = {
        nationalId: [
          { buffer: Buffer.from('f'), mimetype: 'image/jpeg', size: 10 } as Express.Multer.File,
        ],
        selfie: [
          { buffer: Buffer.from('f'), mimetype: 'image/jpeg', size: 10 } as Express.Multer.File,
        ],
      };

      await expect(controller.submit(uploaded, { user: mockUser } as any)).rejects.toThrow('boom');
    });
  });
});
