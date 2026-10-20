import { api } from './api';

export interface RegisterFcmTokenDto {
  token: string;
  deviceType?: 'WEB' | 'ANDROID' | 'IOS' | string;
  deviceModel?: string;
}

export const notificationsService = {
  /**
   * Đăng ký hoặc cập nhật FCM Token cho trình duyệt / thiết bị người dùng
   */
  async registerFcmToken(data: RegisterFcmTokenDto) {
    const res = await api.post('/notifications/fcm-token', data);
    return res.data;
  },

  /**
   * Hủy đăng ký FCM Token (gọi khi đăng xuất hoặc tắt thông báo)
   */
  async unregisterFcmToken(token: string) {
    const res = await api.delete('/notifications/fcm-token', {
      data: { token },
    });
    return res.data;
  },
};
