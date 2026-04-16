import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { Order } from '../orders/order.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { EscrowService } from './escrow.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Order])],
  controllers: [PaymentsController],
  providers: [PaymentsService, EscrowService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
