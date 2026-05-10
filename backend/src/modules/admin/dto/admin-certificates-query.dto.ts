import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CertificateStatus } from '@shared/enums';

export class AdminCertificatesQueryDto {
  @IsOptional()
  @IsEnum({ ...CertificateStatus, ALL: 'all' })
  status?: CertificateStatus | 'all';

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
