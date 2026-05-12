import { Module } from '@nestjs/common';
import { CertificatesModule } from '../certificates/certificates.module';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { ListingsModule } from '../listings/listings.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    CertificatesModule,
    UsersModule,
    OrdersModule,
    PaymentsModule,
    ListingsModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
