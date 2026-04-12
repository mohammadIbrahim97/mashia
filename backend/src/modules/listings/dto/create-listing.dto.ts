import {
  IsString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUrl,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Length,
  Min,
} from 'class-validator';
import { Breed, Currency } from '@shared/enums';

export class CreateListingDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsEnum(Breed)
  breed: Breed;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsInt()
  @Min(0)
  ageMonths: number;

  @IsNumber()
  @Min(0)
  weightKg: number;

  @IsNumber()
  @Min(0)
  pricePerHead: number;

  @IsEnum(Currency)
  currency: Currency;

  @IsString()
  @Length(1, 100)
  originCountry: string;

  @IsString()
  @Length(1, 100)
  originCity: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  images: string[];

  @IsOptional()
  @IsUrl()
  videoUrl?: string;
}
