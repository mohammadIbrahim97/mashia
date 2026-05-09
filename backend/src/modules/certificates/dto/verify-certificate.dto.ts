import { IsEnum, IsString, Length, ValidateIf } from 'class-validator';
import { CertificateStatus } from '@shared/enums';

export class VerifyCertificateDto {
  @IsEnum(CertificateStatus)
  status: CertificateStatus;

  @ValidateIf((o) => o.status === CertificateStatus.REJECTED)
  @IsString()
  @Length(1, 500)
  rejectionReason?: string;
}
