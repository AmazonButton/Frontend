export const failureReasons = [
  { value: 'CUSTOMER_UNREACHABLE', label: 'Không liên lạc được với khách' },
  { value: 'WRONG_ADDRESS', label: 'Địa chỉ giao hàng chưa đúng' },
  { value: 'CUSTOMER_REJECTED', label: 'Khách từ chối nhận hàng' },
  { value: 'GOODS_DAMAGED_IN_TRANSIT', label: 'Hàng bị hư hỏng khi vận chuyển' },
] as const;
export const money = (amount: unknown) => `${Number(amount || 0).toLocaleString('vi-VN')} ₫`;
export const driverError = (error: any, fallback = 'Không thể hoàn tất. Vui lòng thử lại.') => {
  const message = error?.response?.data?.message || error?.message;
  return Array.isArray(message) ? message.join('. ') : typeof message === 'string' ? message : fallback;
};
export function deliveryPaymentMethod(order: any): 'COD' | 'VIETQR' | 'PAYOS' | null {
  const value = String(order?.paymentMethod || '').toUpperCase();
  if (value === 'COD' || value === 'CASH_ON_DELIVERY') return 'COD';
  return value === 'VIETQR' || value === 'PAYOS' ? value : null;
}
export function canClaimDelivery(order: any, duty: any, shift: any, storeId: string): boolean {
  return Boolean(storeId && String(order?.storeId) === storeId && order?.status === 'READY_FOR_DELIVERY' && !order?.assignedDriverId && duty?.status === 'ONLINE' && shift?.status === 'OPEN');
}
export function canRecordDelivery(order: any, userId: string, role: string): boolean {
  if (!['STAFF_DELIVERY', 'STORE_OWNER', 'STORE_MANAGER', 'STAFF_ORDER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(role) || order?.status !== 'SHIPPING') return false;
  return role !== 'STAFF_DELIVERY' || String(order?.assignedDriverId || '') === userId;
}
export function evidenceFileError(file: { size: number; type: string } | null): string {
  if (!file) return 'Vui lòng chọn ảnh giao hàng.';
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) return 'Chọn ảnh JPG, PNG, WEBP hoặc GIF.';
  return file.size > Math.floor(1.5 * 1024 * 1024) ? 'Ảnh tối đa 1,5 MB. Vui lòng chọn ảnh có dung lượng nhỏ hơn.' : '';
}
export function cloudinaryEvidenceUrl(url: unknown, storeId?: string): boolean {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !(parsed.hostname === 'cloudinary.com' || parsed.hostname.endsWith('.cloudinary.com'))) return false;
    const imagePath = parsed.pathname.split('/image/upload/')[1]?.replace(/^v\d+\//, '');
    return Boolean(imagePath && (storeId ? imagePath.startsWith(`stores/${storeId}/pod/`) : /^stores\/\d+\/pod\//.test(imagePath)));
  } catch { return false; }
}
export function validateDeliveryPayload(data: any) {
  if (data?.status !== 'DELIVERED' || !['COD', 'VIETQR', 'PAYOS'].includes(data?.paymentMethod)) throw new Error('Thông tin xác nhận giao hàng chưa hợp lệ.');
  if (!cloudinaryEvidenceUrl(data?.podImageUrl)) throw new Error('Vui lòng tải ảnh giao hàng lên trước khi xác nhận.');
  if (data.paymentMethod === 'COD' && (!Number.isFinite(data.collectedAmount) || data.collectedAmount < 0)) throw new Error('Nhập số tiền mặt thực tế đã thu.');
}
export function validateFailurePayload(data: any) {
  if (!failureReasons.some(reason => reason.value === data?.failureReasonCode)) throw new Error('Chọn lý do chưa giao được hàng.');
  if (!cloudinaryEvidenceUrl(data?.evidenceImageUrl)) throw new Error('Vui lòng tải ảnh bằng chứng lên trước khi xác nhận.');
}
export function buildDeliveryPayload(order: any, imageUrl: string, collected: string, moneyConfirmed: boolean) {
  const paymentMethod = deliveryPaymentMethod(order);
  const collectedAmount = Number(collected);
  if (!paymentMethod) throw new Error('Phương thức thanh toán chưa được hỗ trợ. Liên hệ quản lý cửa hàng.');
  if (paymentMethod !== 'COD' && String(order.paymentStatus).toUpperCase() !== 'PAID') throw new Error('Chưa xác nhận được thanh toán chuyển khoản. Tải lại đơn để kiểm tra trước khi giao.');
  if (paymentMethod === 'COD' && (!moneyConfirmed || !collected.trim() || !Number.isFinite(collectedAmount) || Math.abs(collectedAmount - Number(order.totalAmount)) > 0.01)) throw new Error('Xác nhận đã thu đủ số tiền mặt của đơn hàng.');
  const data = { status: 'DELIVERED' as const, paymentMethod, podImageUrl: imageUrl, ...(paymentMethod === 'COD' ? { collectedAmount } : {}) };
  validateDeliveryPayload(data);
  return data;
}
export const handoverRoles = ['STORE_OWNER', 'STORE_MANAGER', 'STAFF_ORDER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
export function canConfirmHandover(shift: any, role: string) {
  return handoverRoles.includes(role) && shift?.status === 'CLOSED' && /^\d+$/.test(String(shift?.shiftId || ''));
}
export function assertShiftCanClose(expectedId: string, current: any, assigned: any) {
  if (String(current?.data?.shiftId || '') !== expectedId || current?.data?.status !== 'OPEN') throw new Error('Ca làm đã thay đổi. Vui lòng tải lại để kiểm tra.');
  const count = Number(assigned?.pagination?.total);
  if (!Number.isFinite(count)) throw new Error('Chưa kiểm tra được các đơn đang giao. Vui lòng tải lại.');
  if (count > 0) throw new Error('Bạn còn đơn đang giao. Hoàn tất các đơn trước khi kết thúc ca.');
}
