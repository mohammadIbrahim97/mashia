import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { UserRole } from '@shared/enums';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentResponse } from './dto/payment.response';

interface AuthedRequest extends Request {
  user: { id: string; role: string };
}

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  async initiate(
    @Req() req: AuthedRequest,
    @Body() dto: InitiatePaymentDto,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsService.initiate(req.user.id, dto);
    return PaymentResponse.fromPayment(payment);
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  async release(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsService.release(req.user.id, id);
    return PaymentResponse.fromPayment(payment);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async refund(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() _dto: RefundPaymentDto,
  ): Promise<PaymentResponse> {
    const payment = await this.paymentsService.refund(req.user.id, id);
    return PaymentResponse.fromPayment(payment);
  }
}
