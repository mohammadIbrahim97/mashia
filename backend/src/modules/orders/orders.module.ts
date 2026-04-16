import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { Listing } from '../listings/listing.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PaymentStatusListener } from './payment-status.listener';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Listing])],
  controllers: [OrdersController],
  providers: [OrdersService, PaymentStatusListener],
  exports: [OrdersService],
})
export class OrdersModule {}
