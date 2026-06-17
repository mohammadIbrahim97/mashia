import { Test, TestingModule } from '@nestjs/testing';
import { KycService } from './src/modules/kyc/kyc.service';
import { UsersService } from './src/modules/users/users.service';
import { S3Service } from './src/shared/s3/s3.service';
import { UserRole } from './src/shared/enums';
import { User } from './src/modules/users/user.entity';
import { SubmittedKycFiles } from './src/modules/kyc/kyc.service';

async function run() {
  const mockUsersService = {
    updateKycDocuments: async () => undefined,
  };

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const mockS3Service = {
    upload: async () => {
      await delay(100); // Simulate network latency
    },
    delete: async () => undefined,
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      KycService,
      { provide: UsersService, useValue: mockUsersService },
      { provide: S3Service, useValue: mockS3Service },
    ],
  }).compile();

  const service = module.get<KycService>(KycService);

  const user = {
    id: 'user-1',
    role: UserRole.SELLER,
    kycStatus: 'none',
  } as unknown as User;

  const files: SubmittedKycFiles = {
    nationalId: { buffer: Buffer.from('id'), mimeType: 'image/jpeg' },
    selfie: { buffer: Buffer.from('selfie'), mimeType: 'image/jpeg' },
    businessLicense: { buffer: Buffer.from('license'), mimeType: 'image/jpeg' },
  };

  const start = Date.now();
  await service.submit(user, files);
  const duration = Date.now() - start;

  console.log(`Baseline Sequential Duration: ${duration}ms`);
}

run().catch(console.error);
