import { api } from './api';

export interface CloudinarySignatureResponse {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

export interface UploadMediaResponse {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  width?: number;
  height?: number;
  bytes?: number;
}

export const mediaService = {
  /**
   * Lấy chữ ký số Cloudinary (Presigned Signature) để upload trực tiếp từ Frontend
   */
  async getSignature(folder?: string) {
    const res = await api.get('/media/signature', {
      params: folder ? { folder } : undefined,
    });
    return res.data;
  },

  /**
   * Tải ảnh trực tiếp lên Cloudinary thông qua Server Backend
   */
  async uploadImage(file: File, folder?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (folder) {
      formData.append('folder', folder);
    }

    const res = await api.post('/media/upload', formData, {
      headers: {
        'Content-Type': undefined,
      },
    });
    return res.data;
  },

  /**
   * Tải ảnh bằng chứng giao hàng (POD) dành cho tài xế/cửa hàng
   */
  async uploadPodImage(file: File, orderId?: string | number) {
    const formData = new FormData();
    formData.append('file', file);
    if (orderId) {
      formData.append('orderId', orderId.toString());
    }

    const res = await api.post('/media/upload-pod', formData, {
      headers: {
        'Content-Type': undefined,
      },
    });
    return res.data;
  },

  /**
   * Xóa ảnh trên Cloudinary khi hủy hoặc thay thế ảnh
   */
  async destroyAsset(publicId: string) {
    const res = await api.post('/media/destroy', { publicId });
    return res.data;
  },
};
