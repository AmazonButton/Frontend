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
   * Xin URL ký sẵn (Presigned URL) để upload POD trực tiếp lên Cloudflare R2 / AWS S3
   */
  async getPodPresignedUpload(orderId: string | number, contentType: string = 'image/webp') {
    const res = await api.post('/media/pod/presigned-upload', {
      orderId: orderId.toString(),
      contentType,
    });
    return res.data;
  },

  /**
   * Tải trực tiếp tệp nhị phân lên Object Storage bằng Presigned PUT URL
   */
  async uploadDirectToStorage(uploadUrl: string, file: Blob | File, contentType: string = 'image/webp') {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: file,
    });
    if (!response.ok) {
      throw new Error(`Tải ảnh trực tiếp lên Cloud Storage thất bại (HTTP ${response.status})`);
    }
    return true;
  },

  /**
   * Lấy URL xem ảnh bằng chứng giao hàng bảo mật (hết hạn sau 15 phút)
   */
  async getPodView(orderId: string | number) {
    const res = await api.get(`/orders/${orderId}/pod-view`);
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
