import { Module } from '@nestjs/common';
import { CertificatesModule } from '../certificates/certificates.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [CertificatesModule, UsersModule],
  controllers: [AdminController],
})
export class AdminModule {}
