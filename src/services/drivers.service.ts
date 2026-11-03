import { api } from './api';

export interface DriverDutyStatus {
  status: 'ON_DUTY' | 'OFF_DUTY' | 'BUSY';
  latitude?: number;
  longitude?: number;
  lastActiveAt?: string;
}

export interface DeliverOrderDto {
  podImageUrl?: string;
  recipientName?: string;
  recipientPhone?: string;
  note?: string;
}

export interface DeliveryFailureDto {
  failureReason: string;
  notes?: string;
  podImageUrl?: string;
}

export const driversService = {
  /**
   * Lấy trạng thái trực hiện tại của tài xế
   */
  async getMyDuty() {
    const res = await api.get('/drivers/me/duty');
    return res.data;
  },

  /**
   * Cập nhật trạng thái trực: ON_DUTY, OFF_DUTY, BUSY
   */
  async updateDuty(status: 'ON_DUTY' | 'OFF_DUTY' | 'BUSY', location?: { latitude?: number; longitude?: number }) {
    const res = await api.patch('/drivers/me/duty', {
      status,
      ...location,
    });
    return res.data;
  },

  /**
   * Cửa hàng xem danh sách tài xế đang trực online
   */
  async getOnlineDrivers(storeId: string | number) {
    const res = await api.get(`/drivers/store/${storeId}/online`);
    return res.data;
  },

  /**
   * Danh sách đơn hàng được gán cho tài xế
   */
  async getMyOrders(params?: { status?: string; page?: number; limit?: number }) {
    const res = await api.get('/orders/driver/my-orders', { params });
    return res.data;
  },

  /**
   * Tài xế nhận đơn hàng (atomic claim)
   */
  async claimOrder(orderId: string | number) {
    const res = await api.post(`/orders/${orderId}/claim`);
    return res.data;
  },

  /**
   * Hoàn tất giao hàng thành công (kèm ảnh POD)
   */
  async completeDelivery(orderId: string | number, data: DeliverOrderDto) {
    const res = await api.post(`/orders/${orderId}/deliver`, data);
    return res.data;
  },

  /**
   * Ghi nhận giao hàng thất bại
   */
  async failDelivery(orderId: string | number, data: DeliveryFailureDto) {
    const res = await api.post(`/orders/${orderId}/fail`, data);
    return res.data;
  },
};
