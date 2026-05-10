import { Module } from '@nestjs/common';
import { CertificatesModule } from '../certificates/certificates.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [CertificatesModule],
  controllers: [AdminController],
})
export class AdminModule {}
