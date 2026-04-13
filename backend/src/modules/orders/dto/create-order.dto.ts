import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  @IsNotEmpty()
  listingId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0.01)
  unitPrice: number;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  deliveryCountry: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  deliveryCity: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  deliveryAddress: string;
}
