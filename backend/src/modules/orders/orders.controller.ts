import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { KycVerifiedGuard } from '@shared/guards/kyc-verified.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { UserRole } from '@shared/enums';
import { User } from '../users/user.entity';
import { Order } from './order.entity';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, KycVerifiedGuard)
  @Roles(UserRole.BUYER)
  async create(
    @CurrentUser() user: User,
    @Body() dto: CreateOrderDto,
  ): Promise<Order> {
    return this.ordersService.create(user.id, dto);
  }
}
