import { api } from './api';

export interface RentalPackageItem {
  id: string | number;
  packageCode?: string;
  name: string;
  description?: string;
  monthlyFee: number;
  depositFee: number;
  deviceModel?: string;
  features?: string[];
  isActive?: boolean;
}

export interface CreateRentalOrderDto {
  packageId: string | number;
  deliveryAddress: string;
  recipientName?: string;
  recipientPhone?: string;
  rentalMonths?: number;
  note?: string;
}

export interface CustomerRentalContract {
  id: string | number;
  contractCode: string;
  status: 'PENDING_PAYMENT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | string;
  package?: RentalPackageItem;
  deviceId?: string;
  startDate?: string;
  endDate?: string;
  monthlyFee: number;
  depositFee: number;
}

export const rentalsService = {
  /**
   * Lấy danh sách các gói thuê nút bấm IoT thông minh
   */
  async listPackages() {
    const res = await api.get('/rentals/packages');
    return res.data;
  },

  /**
   * Khách hàng đăng ký gói thuê nút mới
   */
  async createRentalOrder(data: CreateRentalOrderDto) {
    const res = await api.post('/rentals/order', data);
    return res.data;
  },

  /**
   * Danh sách các nút/hợp đồng thuê của tài khoản hiện tại
   */
  async getMyRentals() {
    const res = await api.get('/rentals/my-rentals');
    return res.data;
  },

  /**
   * Kích hoạt hợp đồng thuê (ADMIN)
   */
  async activateRental(id: string | number) {
    const res = await api.post(`/rentals/${id}/activate`);
    return res.data;
  },
};
