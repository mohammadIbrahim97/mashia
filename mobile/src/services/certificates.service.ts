import { api, unwrap } from './api';

export type CertificateType = 'vaccination' | 'health' | 'origin';
export type CertificateStatus = 'pending' | 'verified' | 'rejected';

export type Certificate = {
  id: string;
  sellerId: string;
  listingId: string | null;
  type: CertificateType;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  fileUrl: string;
  status: CertificateStatus;
  verifiedById: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCertificatePayload = {
  type: CertificateType;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  fileUrl: string;
  listingId?: string;
};

export const certificatesService = {
  async create(payload: CreateCertificatePayload): Promise<Certificate> {
    const res = await api.post('/certificates', payload);
    return unwrap<Certificate>(res);
  },

  async getById(id: string): Promise<Certificate> {
    const res = await api.get(`/certificates/${id}`);
    return unwrap<Certificate>(res);
  },
};
