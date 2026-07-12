import { api, unwrap } from "./api";

export type CertificateType = "vaccination" | "health" | "origin";
export type CertificateStatus = "pending" | "verified" | "rejected";

export type AdminCertificateListItem = {
  id: string;
  type: CertificateType;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  status: CertificateStatus;
  fileUrl: string;
  sellerId: string;
  sellerName: string | null;
  listingId: string | null;
  listingTitle: string | null;
  createdAt: string;
};

export type AdminCertificateList = {
  items: AdminCertificateListItem[];
  total: number;
  page: number;
  pageSize: number;
};

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

export type ListQuery = {
  status?: CertificateStatus | "all";
  page?: number;
  pageSize?: number;
};

export const certificatesService = {
  async list(query: ListQuery = {}): Promise<AdminCertificateList> {
    const res = await api.get("/admin/certificates", { params: query });
    return unwrap<AdminCertificateList>(res);
  },

  async getById(id: string): Promise<Certificate> {
    const res = await api.get(`/certificates/${id}`);
    return unwrap<Certificate>(res);
  },

  async verify(
    id: string,
    body:
      | { status: "verified" }
      | { status: "rejected"; rejectionReason: string },
  ): Promise<Certificate> {
    const res = await api.patch(`/certificates/${id}/verify`, body);
    return unwrap<Certificate>(res);
  },
};
