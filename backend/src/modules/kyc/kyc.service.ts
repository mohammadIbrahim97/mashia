import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { S3Service } from '@shared/s3/s3.service';
import { User } from '../users/user.entity';
import { UserRole, KycStatus } from '@shared/enums';
import { KycStatusResponseDto } from './dto/kyc-status-response.dto';

export interface SubmittedKycFile {
  buffer: Buffer;
  mimeType: string;
}

export interface SubmittedKycFiles {
  nationalId?: SubmittedKycFile;
  selfie?: SubmittedKycFile;
  businessLicense?: SubmittedKycFile;
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type DocType = 'nationalId' | 'selfie' | 'businessLicense';

@Injectable()
export class KycService {
  constructor(
    private readonly usersService: UsersService,
    private readonly s3Service: S3Service,
  ) {}

  async submit(user: User, files: SubmittedKycFiles): Promise<KycStatusResponseDto> {
    if (user.kycStatus === KycStatus.VERIFIED) {
      throw new ConflictException(
        'Already verified; contact support to update documents',
      );
    }

    this.validateRoleRules(user.role, files);

    const docTypes: DocType[] = ['nationalId', 'selfie', 'businessLicense'];
    const uploadedKeys: Partial<Record<DocType, string>> = {};

    try {
      for (const docType of docTypes) {
        const file = files[docType];
        if (!file) continue;
        const ext = MIME_TO_EXT[file.mimeType] ?? 'bin';
        const key = `kyc/${user.id}/${docType}-${randomUUID()}.${ext}`;
        await this.s3Service.upload(key, file.buffer, file.mimeType);
        uploadedKeys[docType] = key;
      }
    } catch (err) {
      // Rollback: best-effort delete of anything already uploaded
      await Promise.allSettled(
        Object.values(uploadedKeys)
          .filter((key) => !!key)
          .map((key) => this.s3Service.delete(key))
      );
      throw err;
    }

    // After successful upload, delete any old docs from a prior submission
    if (user.kycDocuments) {
      await Promise.allSettled(
        Object.values(user.kycDocuments)
          .filter((oldKey) => !!oldKey)
          .map((oldKey) => this.s3Service.delete(oldKey))
      );
    }

    await this.usersService.updateKycDocuments(
      user.id,
      uploadedKeys as Record<string, string>,
      KycStatus.PENDING,
    );

    return {
      kycStatus: KycStatus.PENDING,
      submitted: true,
      documents: {
        nationalId: !!uploadedKeys.nationalId,
        selfie: !!uploadedKeys.selfie,
        businessLicense: !!uploadedKeys.businessLicense,
      },
      submittedAt: new Date(),
    };
  }

  getStatus(user: User): KycStatusResponseDto {
    const docs = user.kycDocuments ?? {};
    const submitted = user.kycDocuments !== null && user.kycDocuments !== undefined;

    return {
      kycStatus: user.kycStatus,
      submitted,
      documents: {
        nationalId: !!docs.nationalId,
        selfie: !!docs.selfie,
        businessLicense: !!docs.businessLicense,
      },
      submittedAt: submitted ? user.updatedAt : null,
    };
  }

  private validateRoleRules(role: UserRole, files: SubmittedKycFiles): void {
    if (!files.nationalId) {
      throw new BadRequestException('National ID is required');
    }

    if (role === UserRole.BUYER) {
      if (files.selfie) {
        throw new BadRequestException('Buyers must upload only nationalId');
      }
      if (files.businessLicense) {
        throw new BadRequestException('Buyers must upload only nationalId');
      }
      return;
    }

    if (role === UserRole.SELLER || role === UserRole.BROKER) {
      if (!files.selfie) {
        throw new BadRequestException('Selfie is required for sellers and brokers');
      }
      return;
    }

    throw new BadRequestException('This role cannot submit KYC documents');
  }
}
