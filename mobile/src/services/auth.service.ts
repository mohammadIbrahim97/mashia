import { api, setTokens, unwrap } from './api';

export type Role = 'buyer' | 'seller' | 'broker' | 'admin';
export type KycStatus = 'pending' | 'verified' | 'rejected';
export type PreferredLanguage = 'en' | 'ar' | 'tr';

export type AuthUser = {
  id: string;
  role: Role;
  fullName: string;
  phone: string;
  email: string | null;
  country: string;
  city: string;
  kycStatus: KycStatus;
  preferredLanguage: PreferredLanguage;
};

type AuthEnvelope = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

type VerifyResult = { verified: boolean; userExists: boolean };

export type RegisterPayload = {
  phone: string;
  code: string;
  role: Exclude<Role, 'admin'>;
  fullName: string;
  country: string;
  city: string;
  email?: string;
  preferredLanguage?: PreferredLanguage;
};

export const authService = {
  async sendOtp(phone: string): Promise<void> {
    await api.post('/auth/otp/send', { phone });
  },

  async verifyOtp(phone: string, code: string): Promise<VerifyResult> {
    const res = await api.post('/auth/otp/verify', { phone, code });
    return unwrap<VerifyResult>(res);
  },

  async login(phone: string, code: string): Promise<AuthEnvelope> {
    const res = await api.post('/auth/login', { phone, code });
    const env = unwrap<AuthEnvelope>(res);
    await setTokens({
      accessToken: env.accessToken,
      refreshToken: env.refreshToken,
    });
    return env;
  },

  async register(payload: RegisterPayload): Promise<AuthEnvelope> {
    const res = await api.post('/auth/register', payload);
    const env = unwrap<AuthEnvelope>(res);
    await setTokens({
      accessToken: env.accessToken,
      refreshToken: env.refreshToken,
    });
    return env;
  },

  async signOut(): Promise<void> {
    await setTokens(null);
  },

  async fetchMe(): Promise<AuthUser> {
    const res = await api.get('/users/me');
    return unwrap<AuthUser>(res);
  },
};
