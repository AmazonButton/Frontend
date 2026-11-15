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
export function isValidPodEvidence(url: unknown, storeId?: string): boolean {
  if (typeof url !== 'string') return false;
  const clean = url.trim();
  if (clean.startsWith('stores/')) {
    return Boolean(storeId ? clean.startsWith(`stores/${storeId}/pod/`) : /^stores\/\d+\/pod\//.test(clean));
  }
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (parsed.hostname === 'cloudinary.com' || parsed.hostname.endsWith('.cloudinary.com')) {
      const imagePath = parsed.pathname.split('/image/upload/')[1]?.replace(/^v\d+\//, '');
      return Boolean(imagePath && (storeId ? imagePath.startsWith(`stores/${storeId}/pod/`) : /^stores\/\d+\/pod\//.test(imagePath)));
    }
    if (parsed.hostname.includes('r2.cloudflarestorage.com') || parsed.hostname.includes('s3.') || parsed.hostname.includes('amazonaws.com')) {
      const path = parsed.pathname.replace(/^\/+/, '');
      return Boolean(storeId ? path.includes(`stores/${storeId}/pod/`) : /stores\/\d+\/pod\//.test(path));
    }
    return true;
  } catch { return false; }
}

export function cloudinaryEvidenceUrl(url: unknown, storeId?: string): boolean {
  return isValidPodEvidence(url, storeId);
}

export function validateDeliveryPayload(data: any) {
  if (data?.status !== 'DELIVERED' || !['COD', 'VIETQR', 'PAYOS'].includes(data?.paymentMethod)) throw new Error('Thông tin xác nhận giao hàng chưa hợp lệ.');
  if (!isValidPodEvidence(data?.podImageUrl || data?.podObjectKey)) throw new Error('Vui lòng tải ảnh giao hàng lên trước khi xác nhận.');
  if (data.paymentMethod === 'COD' && (!Number.isFinite(data.collectedAmount) || data.collectedAmount < 0)) throw new Error('Nhập số tiền mặt thực tế đã thu.');
}

export function validateFailurePayload(data: any) {
  if (!failureReasons.some(reason => reason.value === data?.failureReasonCode)) throw new Error('Chọn lý do chưa giao được hàng.');
  if (!isValidPodEvidence(data?.evidenceImageUrl)) throw new Error('Vui lòng tải ảnh bằng chứng lên trước khi xác nhận.');
}

export function buildDeliveryPayload(
  order: any,
  imageUrl: string,
  collected: string,
  moneyConfirmed: boolean,
  gps?: { latitude: number; longitude: number } | null,
) {
  const paymentMethod = deliveryPaymentMethod(order);
  const collectedAmount = Number(collected);
  if (!paymentMethod) throw new Error('Phương thức thanh toán chưa được hỗ trợ. Liên hệ quản lý cửa hàng.');
  if (paymentMethod !== 'COD' && String(order.paymentStatus).toUpperCase() !== 'PAID') throw new Error('Chưa xác nhận được thanh toán chuyển khoản. Tải lại đơn để kiểm tra trước khi giao.');
  if (paymentMethod === 'COD' && (!moneyConfirmed || !collected.trim() || !Number.isFinite(collectedAmount) || Math.abs(collectedAmount - Number(order.totalAmount)) > 0.01)) throw new Error('Xác nhận đã thu đủ số tiền mặt của đơn hàng.');
  
  const isObjectKey = imageUrl.startsWith('stores/');
  const data: any = {
    status: 'DELIVERED' as const,
    paymentMethod,
    ...(isObjectKey ? { podObjectKey: imageUrl, podImageUrl: imageUrl } : { podImageUrl: imageUrl }),
    ...(paymentMethod === 'COD' ? { collectedAmount } : {}),
    ...(gps ? { driverLatitude: gps.latitude, driverLongitude: gps.longitude } : {}),
    deliveredAt: new Date().toISOString(),
  };
  validateDeliveryPayload(data);
  return data;
}

/**
 * Nén ảnh sang định dạng WebP trực tiếp trên trình duyệt (giảm dung lượng < 350KB)
 */
export async function compressImageToWebP(
  file: File,
  maxDimension: number = 1200,
  quality: number = 0.8,
): Promise<{ blob: Blob; fileName: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp hình ảnh.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Định dạng hình ảnh không hợp lệ.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Không thể khởi tạo bộ xử lý đồ họa (Canvas).'));
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Nén ảnh thất bại.'));
            }
            const cleanBase = file.name.replace(/\.[^/.]+$/, '');
            resolve({ blob, fileName: `${cleanBase}.webp` });
          },
          'image/webp',
          quality,
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Lấy tọa độ GPS thiết bị hiện tại của tài xế
 */
export async function getDriverCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return null;
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 },
    );
  });
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
