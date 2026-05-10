import { api } from './api';

export type AdminUser = {
  id: string;
  role: 'admin';
  email: string | null;
  fullName: string;
};

export type LoginSuccess = {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
};

export type LoginRequiresTotp = {
  requiresTotp: true;
  ticket: string;
};

export type LoginResponse = LoginSuccess | LoginRequiresTotp;

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await api.post('/auth/admin/login', { email, password });
    return res.data as LoginResponse;
  },

  async verifyTotp(ticket: string, code: string): Promise<LoginSuccess> {
    const res = await api.post('/auth/admin/totp/verify', { ticket, code });
    return res.data as LoginSuccess;
  },
};

export function isLoginSuccess(r: LoginResponse): r is LoginSuccess {
  return 'accessToken' in r;
}
