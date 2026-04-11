import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { S3Service } from './s3.service';
import { S3_CLIENT } from './s3.constants';

describe('S3Service', () => {
  let service: S3Service;
  const s3Mock = mockClient(S3Client);
  const mockS3Client = new S3Client({
    region: 'me-south-1',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  });

  const configMock = {
    get: jest.fn((key: string) => {
      if (key === 's3.bucket') return 'mashia-files';
      if (key === 's3.region') return 'me-south-1';
      return undefined;
    }),
  };

  beforeEach(async () => {
    s3Mock.reset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        { provide: S3_CLIENT, useValue: mockS3Client },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
  });

  describe('upload', () => {
    it('should send PutObjectCommand with bucket, key, body, contentType, and SSE', async () => {
      s3Mock.on(PutObjectCommand).resolves({});
      const body = Buffer.from('fake-image-data');

      await service.upload('kyc/user1/nationalId.jpg', body, 'image/jpeg');

      const calls = s3Mock.commandCalls(PutObjectCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toMatchObject({
        Bucket: 'mashia-files',
        Key: 'kyc/user1/nationalId.jpg',
        Body: body,
        ContentType: 'image/jpeg',
        ServerSideEncryption: 'AES256',
      });
    });
  });

  describe('delete', () => {
    it('should send DeleteObjectCommand with bucket and key', async () => {
      s3Mock.on(DeleteObjectCommand).resolves({});

      await service.delete('kyc/user1/nationalId.jpg');

      const calls = s3Mock.commandCalls(DeleteObjectCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input).toMatchObject({
        Bucket: 'mashia-files',
        Key: 'kyc/user1/nationalId.jpg',
      });
    });
  });

  describe('getSignedReadUrl', () => {
    it('should return a signed URL string containing the key (URL-encoded)', async () => {
      const url = await service.getSignedReadUrl('kyc/user1/nationalId.jpg', 300);

      expect(typeof url).toBe('string');
      // aws-sdk presigner URL-encodes path separators
      expect(url).toMatch(/kyc.*nationalId\.jpg/);
      expect(url).toContain('X-Amz-Signature');
    });
  });

  describe('ensureBucketExists', () => {
    it('should create bucket when HeadBucket returns 404', async () => {
      s3Mock
        .on(HeadBucketCommand)
        .rejects({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });
      s3Mock.on(CreateBucketCommand).resolves({});

      await service.ensureBucketExists();

      const createCalls = s3Mock.commandCalls(CreateBucketCommand);
      expect(createCalls).toHaveLength(1);
      expect(createCalls[0].args[0].input).toMatchObject({ Bucket: 'mashia-files' });
    });

    it('should no-op when HeadBucket succeeds', async () => {
      s3Mock.on(HeadBucketCommand).resolves({});

      await service.ensureBucketExists();

      const createCalls = s3Mock.commandCalls(CreateBucketCommand);
      expect(createCalls).toHaveLength(0);
    });
  });
});
