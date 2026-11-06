export interface ProductRemovalDevice {
  id?: string;
  deviceId: string;
  productId?: string | null;
  product?: unknown;
  products?: unknown[];
  configuration?: { productId?: string; product?: unknown } | null;
}

export function canRemoveDeviceProducts(role: string) {
  return ['STORE_OWNER', 'STORE_MANAGER', 'SUPER_ADMIN'].includes(role);
}

export function hasDeviceProducts(device: ProductRemovalDevice) {
  return Boolean(device.productId || device.product || device.configuration?.productId || device.configuration?.product || device.products?.length);
}

// The selected identifier is captured when opening the confirmation. After a
// successful DELETE, retries only read fresh data; they never delete again.
export function createDeviceProductRemoval(transport: { delete: (path: string) => Promise<any>; get: (path: string) => Promise<any> }, device: ProductRemovalDevice, role: string) {
  const identifier = String(device.id || device.deviceId || '').trim();
  const path = `/devices/${encodeURIComponent(identifier)}`;
  let busy = false;
  let removed = false;
  return {
    get removed() { return removed; },
    async run(refresh: () => Promise<unknown>) {
      if (busy) return false;
      if (!identifier || !canRemoveDeviceProducts(role)) throw new Error('Bạn không có quyền gỡ sản phẩm khỏi thiết bị này.');
      busy = true;
      try {
        if (!removed) {
          const response = await transport.delete(`${path}/product`);
          if (response?.data?.success !== true) throw new Error(response?.data?.message || 'Chưa thể gỡ sản phẩm. Vui lòng thử lại.');
          removed = true;
        }
        const response = await transport.get(path);
        if (response?.data?.success !== true || !response.data.data || !Array.isArray(response.data.data.products)) {
          throw new Error('Đã gửi lệnh gỡ nhưng chưa kiểm tra được dữ liệu mới. Hãy tải lại dữ liệu.');
        }
        if (hasDeviceProducts(response.data.data)) throw new Error('Thiết bị hiện vẫn có sản phẩm được gán. Hãy tải lại danh sách để kiểm tra thay đổi mới nhất.');
        await refresh();
        return true;
      } finally { busy = false; }
    },
  };
}
