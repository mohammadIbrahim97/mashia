import { Inject, Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3_CLIENT } from './s3.constants';

@Injectable()
export class S3Service implements OnModuleInit {
  private readonly logger = new Logger(S3Service.name);
  private readonly bucket: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private readonly forcePathStyle: boolean;

  constructor(
    @Inject(S3_CLIENT) private readonly client: S3Client,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.get<string>('s3.bucket') as string;
    this.region = this.configService.get<string>('s3.region') as string;
    this.endpoint = this.configService.get<string | undefined>('s3.endpoint');
    this.forcePathStyle = this.configService.get<boolean>('s3.forcePathStyle') ?? false;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.withTimeout(this.ensureBucketExists(), 5000);
    } catch (err) {
      this.logger.warn(
        `ensureBucketExists failed on startup: ${(err as Error).message}. ` +
          `S3 operations may fail until the bucket is reachable.`,
      );
    }
  }

  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`S3 operation timed out after ${ms}ms`)),
          ms,
        ).unref(),
      ),
    ]);
  }

  isTrustedObjectUrl(url: string, keyPrefix: string): boolean {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    const normalizedPrefix = keyPrefix.endsWith('/') ? keyPrefix : `${keyPrefix}/`;
    const pathname = parsed.pathname;
    const pathStylePath = `/${this.bucket}/${normalizedPrefix}`;
    const virtualHostedPath = `/${normalizedPrefix}`;

    if (this.endpoint) {
      const endpointUrl = new URL(this.endpoint);
      if (parsed.origin === endpointUrl.origin) {
        return pathname.startsWith(pathStylePath);
      }

      if (!this.forcePathStyle) {
        const virtualHostedEndpoint = new URL(this.endpoint);
        virtualHostedEndpoint.hostname =
          `${this.bucket}.${virtualHostedEndpoint.hostname}`;
        return (
          parsed.origin === virtualHostedEndpoint.origin &&
          pathname.startsWith(virtualHostedPath)
        );
      }

      return false;
    }

    const awsVirtualHostedOrigins = new Set([
      `https://${this.bucket}.s3.${this.region}.amazonaws.com`,
      `https://${this.bucket}.s3.amazonaws.com`,
    ]);
    const awsPathStyleOrigins = new Set([
      `https://s3.${this.region}.amazonaws.com`,
      'https://s3.amazonaws.com',
    ]);

    return (
      (awsVirtualHostedOrigins.has(parsed.origin) &&
        pathname.startsWith(virtualHostedPath)) ||
      (awsPathStyleOrigins.has(parsed.origin) && pathname.startsWith(pathStylePath))
    );
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async getSignedReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async getSignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async ensureBucketExists(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (err: any) {
      const status = err?.$metadata?.httpStatusCode;
      if (status === 404 || err?.name === 'NotFound' || err?.name === 'NoSuchBucket') {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created S3 bucket: ${this.bucket}`);
      } else {
        throw err;
      }
    }
  }
}
