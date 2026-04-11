import { KycStatus } from '@shared/enums';

export class KycStatusResponseDto {
  kycStatus: KycStatus;
  submitted: boolean;
  documents: {
    nationalId: boolean;
    selfie: boolean;
    businessLicense: boolean;
  };
  submittedAt: Date | null;
}
