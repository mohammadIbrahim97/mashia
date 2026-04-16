import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
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
}
