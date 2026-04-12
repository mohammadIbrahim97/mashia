export enum UserRole {
  SELLER = 'seller',
  BUYER = 'buyer',
  BROKER = 'broker',
  ADMIN = 'admin',
}

export enum KycStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum PreferredLanguage {
  AR = 'ar',
  TR = 'tr',
  EN = 'en',
}

export enum Breed {
  AWASSI = 'awassi',
  NAJDI = 'najdi',
  ARABI = 'arabi',
  SHAMI = 'shami',
  OTHER = 'other',
}

export enum Currency {
  SYP = 'SYP',
  SAR = 'SAR',
  AED = 'AED',
  USD = 'USD',
}

export enum ListingStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  EXPIRED = 'expired',
  FLAGGED = 'flagged',
}

export enum HealthStatus {
  CERTIFIED = 'certified',
  PENDING = 'pending',
  UNCHECKED = 'unchecked',
}
