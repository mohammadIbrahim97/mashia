import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { S3_CLIENT } from './s3.constants';
import { S3Service } from './s3.service';

const s3ClientProvider = {
  provide: S3_CLIENT,
  useFactory: (configService: ConfigService): S3Client => {
    return new S3Client({
      region: configService.get<string>('s3.region'),
      endpoint: configService.get<string | undefined>('s3.endpoint'),
      forcePathStyle: configService.get<boolean>('s3.forcePathStyle'),
      credentials: {
        accessKeyId: configService.get<string>('s3.accessKeyId') as string,
        secretAccessKey: configService.get<string>('s3.secretAccessKey') as string,
      },
    });
  },
  inject: [ConfigService],
};

@Global()
@Module({
  providers: [s3ClientProvider, S3Service],
  exports: [S3_CLIENT, S3Service],
})
export class S3Module {}
