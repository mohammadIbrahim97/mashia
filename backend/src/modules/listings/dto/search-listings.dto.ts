import {
  IsOptional,
  IsEnum,
  IsNumber,
  IsInt,
  IsString,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Breed, HealthStatus } from '@shared/enums';

export class SearchListingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(Breed)
  breed?: Breed;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minQuantity?: number;

  @IsOptional()
  @IsString()
  originCountry?: string;

  @IsOptional()
  @IsEnum(HealthStatus)
  healthStatus?: HealthStatus;

  @IsOptional()
  @IsIn(['newest', 'price_asc', 'price_desc'])
  sort?: string = 'newest';
}
