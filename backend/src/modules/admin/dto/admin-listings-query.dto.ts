import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Breed, ListingStatus } from '@shared/enums';

export class AdminListingsQueryDto {
  @IsOptional()
  @IsEnum({ ...ListingStatus, ALL: 'all' })
  status?: ListingStatus | 'all';

  @IsOptional()
  @IsEnum(Breed)
  breed?: Breed;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
