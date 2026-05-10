import { Test, TestingModule } from '@nestjs/testing';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { User } from '../users/user.entity';
import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';

describe('UploadsController', () => {
  let controller: UploadsController;
  let uploadsService: jest.Mocked<UploadsService>;

  const mockUser: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    role: UserRole.SELLER,
    fullName: 'Ahmad Ali',
    phone: '+966501234567',
    email: null,
    country: 'SA',
    city: 'Riyadh',
    kycStatus: KycStatus.VERIFIED,
    kycDocuments: null,
    preferredLanguage: PreferredLanguage.AR,
    passwordHash: null,
    totpSecret: null,
    totpEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const mockResponse = {
    uploadUrl: 'https://s3.example.com/presigned',
    key: 'listings/550e8400/img-abc.jpg',
    expiresIn: 300,
  };

  beforeEach(async () => {
    uploadsService = {
      generatePresignedUploadUrl: jest.fn().mockResolvedValue(mockResponse),
    } as unknown as jest.Mocked<UploadsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [{ provide: UploadsService, useValue: uploadsService }],
    }).compile();

    controller = module.get<UploadsController>(UploadsController);
  });

  it('returns presigned URL for listing upload', async () => {
    const result = await controller.getPresignedUrl(
      { purpose: 'listing', contentType: 'image/jpeg', fileName: 'photo.jpg' },
      { user: mockUser } as any,
    );

    expect(uploadsService.generatePresignedUploadUrl).toHaveBeenCalledWith(
      mockUser.id,
      'listing',
      'image/jpeg',
      'photo.jpg',
    );
    expect(result).toEqual(mockResponse);
  });

  it('returns presigned URL for certificate upload', async () => {
    await controller.getPresignedUrl(
      { purpose: 'certificate', contentType: 'image/png', fileName: 'cert.png' },
      { user: mockUser } as any,
    );

    expect(uploadsService.generatePresignedUploadUrl).toHaveBeenCalledWith(
      mockUser.id,
      'certificate',
      'image/png',
      'cert.png',
    );
  });

  it('propagates service errors to caller', async () => {
    uploadsService.generatePresignedUploadUrl.mockRejectedValue(new Error('s3 down'));

    await expect(
      controller.getPresignedUrl(
        { purpose: 'listing', contentType: 'image/jpeg', fileName: 'photo.jpg' },
        { user: mockUser } as any,
      ),
    ).rejects.toThrow('s3 down');
  });
});
