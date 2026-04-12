import { Test, TestingModule } from '@nestjs/testing';
import { UploadsService } from './uploads.service';
import { S3Service } from '@shared/s3/s3.service';

describe('UploadsService', () => {
  let service: UploadsService;
  let s3Service: jest.Mocked<S3Service>;

  beforeEach(async () => {
    s3Service = {
      getSignedUploadUrl: jest.fn().mockResolvedValue('https://s3.example.com/presigned'),
    } as unknown as jest.Mocked<S3Service>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: S3Service, useValue: s3Service },
      ],
    }).compile();

    service = module.get<UploadsService>(UploadsService);
  });

  it('generates S3 key with listings/ prefix for listing purpose', async () => {
    const result = await service.generatePresignedUploadUrl(
      'user-123',
      'listing',
      'image/jpeg',
      'photo.jpg',
    );

    expect(result.key).toMatch(/^listings\/user-123\/[a-f0-9-]+\.jpg$/);
    expect(result.uploadUrl).toBe('https://s3.example.com/presigned');
    expect(result.expiresIn).toBe(300);
  });

  it('generates S3 key with certificates/ prefix for certificate purpose', async () => {
    const result = await service.generatePresignedUploadUrl(
      'user-123',
      'certificate',
      'image/png',
      'cert.png',
    );

    expect(result.key).toMatch(/^certificates\/user-123\/[a-f0-9-]+\.png$/);
  });

  it('calls S3Service.getSignedUploadUrl with correct params', async () => {
    await service.generatePresignedUploadUrl(
      'user-123',
      'listing',
      'image/webp',
      'photo.webp',
    );

    expect(s3Service.getSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^listings\/user-123\//),
      'image/webp',
      300,
    );
  });
});
