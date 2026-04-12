import { UserRole, KycStatus, PreferredLanguage } from '@shared/enums';
import { User } from '../user.entity';

export class ProfileResponseDto {
  id: string;
  role: UserRole;
  fullName: string;
  phone: string;
  email: string | null;
  country: string;
  city: string;
  kycStatus: KycStatus;
  preferredLanguage: PreferredLanguage;
  createdAt: Date;
  updatedAt: Date;

  static fromUser(user: User): ProfileResponseDto {
    const dto = new ProfileResponseDto();
    dto.id = user.id;
    dto.role = user.role;
    dto.fullName = user.fullName;
    dto.phone = user.phone;
    dto.email = user.email;
    dto.country = user.country;
    dto.city = user.city;
    dto.kycStatus = user.kycStatus;
    dto.preferredLanguage = user.preferredLanguage;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }
}
