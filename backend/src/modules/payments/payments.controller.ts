import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { UserRole } from '@shared/enums';
import { User } from '../users/user.entity';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentResponse } from './dto/payment.response';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  async initiate(
    @CurrentUser() user: User,
    @Body() dto: InitiatePaymentDto,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsService.initiate(user.id, dto);
    return PaymentResponse.fromPayment(payment);
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  async release(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsService.release(user.id, id);
    return PaymentResponse.fromPayment(payment);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async refund(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsService.refund(id);
    return PaymentResponse.fromPayment(payment);
  }

  @Get('by-order/:orderId')
  async findByOrder(
    @CurrentUser() user: User,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsService.findByOrder(
      user.id,
      orderId,
    );
    return PaymentResponse.fromPayment(payment);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsService.findOne(
      user.id,
      user.role,
      id,
    );
    return PaymentResponse.fromPayment(payment);
  }
}
