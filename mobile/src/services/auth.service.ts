import { api, setAccessToken } from './api';

export type Role = 'buyer' | 'seller' | 'broker' | 'admin';

export type AuthUser = {
  id: string;
  phone: string;
  role: Role;
  fullName: string | null;
  country: string | null;
  city: string | null;
};

type AuthEnvelope = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export const authService = {
  async sendOtp(phone: string): Promise<void> {
    await api.post('/auth/otp/send', { phone });
  },

  async verifyOtp(phone: string, code: string): Promise<AuthEnvelope> {
    const res = await api.post<{ data: AuthEnvelope }>('/auth/otp/verify', {
      phone,
      code,
    });
    const env = res.data.data;
    await setAccessToken(env.accessToken);
    return env;
  },

  async signOut(): Promise<void> {
    await setAccessToken(null);
  },
};
