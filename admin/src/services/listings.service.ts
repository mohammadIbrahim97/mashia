import { api, unwrap } from './api';

export type ListingStatus = 'active' | 'sold' | 'expired' | 'flagged';
export type HealthStatus = 'certified' | 'pending' | 'unchecked';
export type Breed = 'awassi' | 'najdi' | 'arabi' | 'shami' | 'other';

export type AdminListingListItem = {
  id: string;
  title: string;
  breed: Breed;
  quantity: number;
  pricePerHead: number;
  currency: string;
  originCountry: string;
  originCity: string;
  status: ListingStatus;
  healthStatus: HealthStatus;
  sellerId: string;
  sellerName: string | null;
  createdAt: string;
  deletedAt: string | null;
};

export type AdminListingList = {
  items: AdminListingListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdminListingDetail = {
  id: string;
  sellerId: string;
  seller: {
    id: string;
    fullName: string;
    phone: string;
    country: string;
    city: string;
    kycStatus: string;
  } | null;
  title: string;
  breed: Breed;
  quantity: number;
  ageMonths: number;
  weightKg: number;
  pricePerHead: number;
  currency: string;
  originCountry: string;
  originCity: string;
  description: string | null;
  images: string[];
  videoUrl: string | null;
  healthStatus: HealthStatus;
  certificateId: string | null;
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ListQuery = {
  status?: ListingStatus | 'all';
  breed?: Breed;
  q?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
};

export const listingsService = {
  async list(query: ListQuery = {}): Promise<AdminListingList> {
    const res = await api.get('/admin/listings', { params: query });
    return unwrap<AdminListingList>(res);
  },

  async getById(id: string): Promise<AdminListingDetail> {
    const res = await api.get(`/admin/listings/${id}`);
    return unwrap<AdminListingDetail>(res);
  },

  async flag(id: string): Promise<AdminListingDetail> {
    const res = await api.patch(`/admin/listings/${id}/flag`, {});
    return unwrap<AdminListingDetail>(res);
  },

  async unflag(id: string): Promise<AdminListingDetail> {
    const res = await api.patch(`/admin/listings/${id}/unflag`, {});
    return unwrap<AdminListingDetail>(res);
  },

  async remove(id: string): Promise<{ message: string }> {
    const res = await api.delete(`/admin/listings/${id}`);
    return unwrap<{ message: string }>(res);
  },
};
