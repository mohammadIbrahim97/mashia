import { IsEnum, IsOptional, IsString, Length, ValidateIf } from 'class-validator';
import { KycStatus } from '@shared/enums';

export class AdminKycDecisionDto {
  /** Only `verified` or `rejected` allowed — `pending` is the implicit default. */
  @IsEnum(KycStatus)
  decision: KycStatus;

  @ValidateIf((o) => o.decision === KycStatus.REJECTED)
  @IsString()
  @Length(1, 500)
  @IsOptional()
  rejectionReason?: string;
}
