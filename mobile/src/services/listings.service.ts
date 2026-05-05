import { api, unwrap } from './api';

export type ListingSeller = {
  id: string;
  fullName: string;
  country: string;
  city: string;
  kycStatus: string;
};

export type Listing = {
  id: string;
  sellerId: string;
  seller: ListingSeller;
  title: string;
  breed: string;
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
  healthStatus: string;
  status: string;
  certificateId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListingsPage = {
  data: Listing[];
  total: number;
  page: number;
  limit: number;
};

export type SearchParams = {
  page?: number;
  limit?: number;
  breed?: string;
  minPrice?: number;
  maxPrice?: number;
  minQuantity?: number;
  originCountry?: string;
  healthStatus?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc';
};

export type CreateListingPayload = {
  title: string;
  breed: string;
  quantity: number;
  ageMonths: number;
  weightKg: number;
  pricePerHead: number;
  currency: string;
  originCountry: string;
  originCity: string;
  description?: string;
  images: string[];
  videoUrl?: string;
};

export const listingsService = {
  async search(params: SearchParams = {}): Promise<ListingsPage> {
    const res = await api.get('/listings', { params });
    const body = res.data;
    if (body && typeof body === 'object' && 'data' in body) return body as ListingsPage;
    return body as ListingsPage;
  },

  async getById(id: string): Promise<Listing> {
    const res = await api.get(`/listings/${id}`);
    return unwrap<Listing>(res);
  },

  async create(payload: CreateListingPayload): Promise<Listing> {
    const res = await api.post('/listings', payload);
    return unwrap<Listing>(res);
  },

  async update(id: string, payload: Partial<CreateListingPayload>): Promise<Listing> {
    const res = await api.patch(`/listings/${id}`, payload);
    return unwrap<Listing>(res);
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/listings/${id}`);
  },

  async myListings(page = 1, limit = 20): Promise<ListingsPage> {
    const res = await api.get('/listings/mine', { params: { page, limit } });
    const body = res.data;
    if (body && typeof body === 'object' && 'data' in body) return body as ListingsPage;
    return body as ListingsPage;
  },
};
