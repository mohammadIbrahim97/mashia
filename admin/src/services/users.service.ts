import { api, unwrap } from './api';

export type Role = 'seller' | 'buyer' | 'broker' | 'admin';
export type KycStatus = 'pending' | 'verified' | 'rejected';

export type AdminUserListItem = {
  id: string;
  role: Role;
  fullName: string;
  phone: string;
  email: string | null;
  country: string;
  city: string;
  kycStatus: KycStatus;
  suspended: boolean;
  createdAt: string;
};

export type AdminUserList = {
  items: AdminUserListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminUserDetail = AdminUserListItem & {
  kycDocuments: Record<string, string> | null;
  kycDocumentUrls: Record<string, string> | null;
  kycRejectionReason: string | null;
  kycReviewedAt: string | null;
  kycReviewedById: string | null;
  updatedAt: string;
};

export type ListQuery = {
  role?: Role;
  kycStatus?: KycStatus;
  q?: string;
  page?: number;
  pageSize?: number;
};

export const usersService = {
  async list(query: ListQuery = {}): Promise<AdminUserList> {
    const res = await api.get('/admin/users', { params: query });
    return unwrap<AdminUserList>(res);
  },

  async getById(id: string): Promise<AdminUserDetail> {
    const res = await api.get(`/admin/users/${id}`);
    return unwrap<AdminUserDetail>(res);
  },

  async reviewKyc(
    id: string,
    body:
      | { decision: 'verified' }
      | { decision: 'rejected'; rejectionReason: string },
  ): Promise<AdminUserDetail> {
    const res = await api.patch(`/admin/users/${id}/kyc`, body);
    return unwrap<AdminUserDetail>(res);
  },

  async suspend(id: string): Promise<AdminUserDetail> {
    const res = await api.patch(`/admin/users/${id}/suspend`, {});
    return unwrap<AdminUserDetail>(res);
  },

  async unsuspend(id: string): Promise<AdminUserDetail> {
    const res = await api.patch(`/admin/users/${id}/unsuspend`, {});
    return unwrap<AdminUserDetail>(res);
  },
};
