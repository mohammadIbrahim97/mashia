import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsIn } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';
import { ListingStatus } from '@shared/enums';

export class UpdateListingDto extends PartialType(CreateListingDto) {
  @IsOptional()
  @IsIn([ListingStatus.ACTIVE, ListingStatus.SOLD])
  status?: ListingStatus;
}
