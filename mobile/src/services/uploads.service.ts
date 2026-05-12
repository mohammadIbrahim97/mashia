import { api, unwrap } from './api';
import axios from 'axios';

export type PresignedUrlResponse = {
  uploadUrl: string;
  fileUrl: string;
  key: string;
};

export type UploadPurpose = 'listing' | 'chat_image' | 'certificate';

export const uploadsService = {
  async getPresignedUrl(
    purpose: UploadPurpose,
    contentType: string,
    fileName: string,
  ): Promise<PresignedUrlResponse> {
    const res = await api.post('/uploads/presigned-url', {
      purpose,
      contentType,
      fileName,
    });
    return unwrap<PresignedUrlResponse>(res);
  },

  async uploadToS3(
    uploadUrl: string,
    uri: string,
    contentType: string,
  ): Promise<void> {
    const response = await fetch(uri);
    const blob = await response.blob();
    await axios.put(uploadUrl, blob, {
      headers: { 'Content-Type': contentType },
    });
  },
};
