import { Module } from '@nestjs/common';
import { CertificatesModule } from '../certificates/certificates.module';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [CertificatesModule, UsersModule, OrdersModule, PaymentsModule],
  controllers: [AdminController],
})
export class AdminModule {}
