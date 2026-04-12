import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { S3Service } from '@shared/s3/s3.service';

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const PRESIGN_EXPIRY_SECONDS = 300;

@Injectable()
export class UploadsService {
  constructor(private readonly s3Service: S3Service) {}

  async generatePresignedUploadUrl(
    userId: string,
    purpose: string,
    contentType: string,
    fileName: string,
  ): Promise<{ uploadUrl: string; key: string; expiresIn: number }> {
    const ext = CONTENT_TYPE_TO_EXT[contentType] ?? this.extractExt(fileName);
    const key = `${purpose}s/${userId}/${randomUUID()}.${ext}`;
    const uploadUrl = await this.s3Service.getSignedUploadUrl(
      key,
      contentType,
      PRESIGN_EXPIRY_SECONDS,
    );
    return { uploadUrl, key, expiresIn: PRESIGN_EXPIRY_SECONDS };
  }

  private extractExt(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'bin';
  }
}
