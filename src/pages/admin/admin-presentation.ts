// Display labels only. API values, filter keys and event names stay unchanged.
export const ADMIN_SECTIONS: Record<string, { title: string; description: string }> = {
  OVERVIEW: { title: 'Tổng quan hệ thống', description: 'Theo dõi cửa hàng, thiết bị và các công việc quản trị cần xử lý.' },
  STORES: { title: 'Quản lý cửa hàng', description: 'Xét duyệt đăng ký và quản lý các cửa hàng trong hệ thống.' },
  PLANS: { title: 'Gói dịch vụ', description: 'Quản lý chi phí, thời hạn và trạng thái các gói dành cho cửa hàng.' },
  RENTALS: { title: 'Gói thuê nút bấm', description: 'Quản lý gói thuê, số lượng nút và chi phí đặt cọc.' },
  DEVICES: { title: 'Kho nút bấm', description: 'Tạo lô thiết bị, phân bổ cho cửa hàng và quản lý mã ghép nối.' },
  RBAC: { title: 'Tài khoản & phân quyền', description: 'Tìm tài khoản, quản lý vai trò và trạng thái truy cập.' },
  ANALYTICS: { title: 'Báo cáo & doanh thu', description: 'Xem các chỉ số vận hành và xuất báo cáo hiện có.' },
  NOTIFICATIONS: { title: 'Cài đặt thông báo', description: 'Quản lý nội dung thông báo tự động và cấu hình kết nối nâng cao.' },
};

const actionLabels: Record<string, string> = {
  DEVICE_BATTERY_UPDATED: 'Cập nhật pin',
  DEVICE_WARRANTY_EXTENDED: 'Gia hạn bảo hành',
  DEVICES_ALLOCATED_TO_STORE: 'Phân bổ thiết bị',
  BATCH_DEVICES_GENERATED: 'Tạo lô thiết bị',
  DEVICE_CONFIGURED: 'Cấu hình thiết bị',
  STORE_APPROVED: 'Duyệt cửa hàng',
  FCM_BROADCAST_SENT: 'Gửi thông báo',
  ROLE_PERMISSION_UPDATED: 'Cập nhật quyền',
};
const entityLabels: Record<string, string> = {
  Device: 'Thiết bị', Batch: 'Lô thiết bị', Store: 'Cửa hàng', Notification: 'Thông báo', User: 'Tài khoản',
};
const triggerLabels: Record<string, string> = {
  BUTTON_PRESSED_ORDER_CREATED: 'Khi có đơn hàng mới',
  ORDER_EMERGENCY_CANCELLED: 'Khi đơn hàng bị hủy',
  ORDER_SHIPPED: 'Khi bắt đầu giao hàng',
  LOW_BATTERY_WARNING: 'Khi thiết bị sắp hết pin',
};

export const adminActionLabel = (value: string) => actionLabels[value] || value;
export const adminEntityLabel = (value: string) => entityLabels[value] || value;
export const adminTriggerLabel = (value: string) => triggerLabels[value] || value;
