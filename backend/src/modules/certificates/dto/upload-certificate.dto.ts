import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Length,
} from 'class-validator';
import { CertificateType } from '@shared/enums';

export class UploadCertificateDto {
  @IsEnum(CertificateType)
  type: CertificateType;

  @IsString()
  @Length(1, 200)
  issuingAuthority: string;

  @IsDateString()
  issueDate: string;

  @IsDateString()
  expiryDate: string;

  @IsUrl({ require_tld: false })
  fileUrl: string;

  @IsOptional()
  @IsUUID()
  listingId?: string;
}
