import { api } from './api';

export type KycStatusResponse = {
  status: 'pending' | 'verified' | 'rejected';
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

export type KycDocuments = {
  nationalId?: { uri: string; type: string; name: string };
  selfie?: { uri: string; type: string; name: string };
  businessLicense?: { uri: string; type: string; name: string };
};

export const kycService = {
  async getStatus(): Promise<KycStatusResponse> {
    const res = await api.get('/kyc/status');
    const body = res.data;
    if (body && typeof body === 'object' && 'data' in body) return (body as { data: KycStatusResponse }).data;
    return body as KycStatusResponse;
  },

  async submit(docs: KycDocuments): Promise<KycStatusResponse> {
    const form = new FormData();
    if (docs.nationalId) {
      form.append('nationalId', {
        uri: docs.nationalId.uri,
        type: docs.nationalId.type,
        name: docs.nationalId.name,
      } as unknown as Blob);
    }
    if (docs.selfie) {
      form.append('selfie', {
        uri: docs.selfie.uri,
        type: docs.selfie.type,
        name: docs.selfie.name,
      } as unknown as Blob);
    }
    if (docs.businessLicense) {
      form.append('businessLicense', {
        uri: docs.businessLicense.uri,
        type: docs.businessLicense.type,
        name: docs.businessLicense.name,
      } as unknown as Blob);
    }
    const res = await api.post('/kyc/submit', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const body = res.data;
    if (body && typeof body === 'object' && 'data' in body) return (body as { data: KycStatusResponse }).data;
    return body as KycStatusResponse;
  },
};
