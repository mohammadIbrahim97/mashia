import { IsEnum, IsUUID } from 'class-validator';
import { PaymentMethod } from '@shared/enums';

export class InitiatePaymentDto {
  @IsUUID()
  orderId: string;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}
