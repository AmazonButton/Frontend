import { api } from './api';

export interface ProductImageItem {
  id?: string | number;
  imageUrl: string;
  isPrimary?: boolean;
  displayOrder?: number;
}

export interface ProductItem {
  id: string | number;
  productId?: string | number;
  storeId?: string | number;
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  originalPrice?: number;
  description?: string;
  imageUrl?: string;
  images?: ProductImageItem[];
  category?: string;
  stock?: number;
  availableStock?: number;
  lowStockThreshold?: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductQueryParams {
  storeId?: string | number;
  page?: number;
  pageSize?: number;
  limit?: number;
  category?: string;
  search?: string;
  isActive?: boolean;
}

export interface CreateProductDto {
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  originalPrice?: number;
  description?: string;
  imageUrl?: string;
  images?: Array<{ imageUrl: string; isPrimary?: boolean; displayOrder?: number }>;
  category?: string;
  availableStock?: number;
  lowStockThreshold?: number;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

export interface UpdateStockDto {
  availableStock: number;
  lowStockThreshold?: number;
}

export const productsService = {
  /**
   * Lấy danh sách sản phẩm và tồn kho (hỗ trợ phân trang, lọc theo Store)
   */
  async list(params?: ProductQueryParams) {
    const res = await api.get('/products', { params });
    return res.data;
  },

  /**
   * Xem chi tiết 1 sản phẩm và danh sách ảnh chuẩn hợp đồng Cloudinary
   */
  async getById(id: string | number) {
    const res = await api.get(`/products/${id}`);
    return res.data;
  },

  /**
   * Tạo sản phẩm mới (STORE_OWNER, SYSTEM_ADMIN)
   */
  async create(data: CreateProductDto) {
    const res = await api.post('/products', data);
    return res.data;
  },

  /**
   * Cập nhật thông tin và giá sản phẩm (STORE_OWNER, SYSTEM_ADMIN)
   */
  async update(id: string | number, data: UpdateProductDto) {
    const res = await api.put(`/products/${id}`, data);
    return res.data;
  },

  /**
   * Cập nhật tồn kho chuyên biệt (STAFF_INVENTORY hoặc STORE_OWNER)
   */
  async updateStock(id: string | number, data: UpdateStockDto) {
    const res = await api.patch(`/products/${id}/inventory`, data);
    return res.data;
  },

  /**
   * Cập nhật trạng thái sản phẩm (ACTIVE | INACTIVE)
   */
  async setStatus(id: string | number, status: 'ACTIVE' | 'INACTIVE') {
    const res = await api.put(`/products/${id}`, { status });
    return res.data;
  },

  /**
   * Vô hiệu hóa (ngừng kinh doanh) sản phẩm - Soft disable thay vì xóa cứng
   */
  async disable(id: string | number) {
    const res = await api.put(`/products/${id}`, { status: 'INACTIVE' });
    return res.data;
  },

  /**
   * Kích hoạt lại sản phẩm để tiếp tục kinh doanh
   */
  async activate(id: string | number) {
    const res = await api.put(`/products/${id}`, { status: 'ACTIVE' });
    return res.data;
  },

  /**
   * Xóa / Vô hiệu hóa sản phẩm (tương thích ngược: chuyển trạng thái INACTIVE)
   */
  async delete(id: string | number) {
    const res = await api.put(`/products/${id}`, { status: 'INACTIVE' });
    return res.data;
  },
};

