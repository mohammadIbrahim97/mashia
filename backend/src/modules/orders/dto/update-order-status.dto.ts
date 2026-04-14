import { IsEnum } from 'class-validator';
import { OrderStatus } from '@shared/enums';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
