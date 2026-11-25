import { api } from './api';

export interface DbNotificationItem {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any> | null;
  idempotencyKey?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface RegisterFcmTokenDto {
  token: string;
  deviceType?: 'WEB' | 'ANDROID' | 'IOS' | string;
  deviceModel?: string;
}

export const notificationsService = {
  /**
   * Lấy danh sách thông báo DB của người dùng hiện tại (GET /api/v1/notifications)
   */
  async listNotifications(params: { page?: number; pageSize?: number } = {}): Promise<{
    items: DbNotificationItem[];
    unreadCount: number;
    pagination?: any;
  }> {
    const res = await api.get('/notifications', {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
      },
    });
    const body = res.data || {};
    const items = Array.isArray(body?.data) ? body.data : [];
    const unreadCount = Number(body?.unreadCount ?? items.filter((n: any) => !n?.readAt).length);
    return { items, unreadCount, pagination: body?.pagination };
  },

  /**
   * Lấy số lượng thông báo chưa đọc (GET /api/v1/notifications/unread-count)
   */
  async getUnreadCount(): Promise<number> {
    const res = await api.get('/notifications/unread-count');
    return Number(res.data?.data?.unreadCount ?? res.data?.unreadCount ?? 0);
  },

  /**
   * Đánh dấu 1 thông báo là đã đọc (PATCH /api/v1/notifications/:id/read)
   */
  async markAsRead(id: string | number) {
    const res = await api.patch(`/notifications/${encodeURIComponent(String(id))}/read`);
    return res.data;
  },

  /**
   * Đánh dấu tất cả thông báo là đã đọc (PATCH /api/v1/notifications/read-all)
   */
  async markAllAsRead() {
    const res = await api.patch('/notifications/read-all');
    return res.data;
  },

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
