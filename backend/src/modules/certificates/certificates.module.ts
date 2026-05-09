import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Certificate } from './certificate.entity';
import { Listing } from '../listings/listing.entity';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';

@Module({
  imports: [TypeOrmModule.forFeature([Certificate, Listing])],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
