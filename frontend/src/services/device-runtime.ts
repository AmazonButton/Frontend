// Activation, ownership and order permission remain server controlled.
// A BLE connection or a successful Wi-Fi write is never an Internet heartbeat.
export const DEVICE_HEARTBEAT_TTL_MS = 25_000;

export function deviceRuntime(device: any, now = Date.now()) {
  const result = (label: string, hint: string, running = false, canOrder = false) => ({ label, hint, running, canOrder });
  if (device?.status === 'DISABLED') return result('Tạm ngưng', device.canOrderReason || 'Nút đang bị tạm ngưng trên hệ thống.');
  if (device?.status !== 'ACTIVE') return result('Chưa kích hoạt', device?.canOrderReason || 'Kết nối Bluetooth chỉ nhận diện ID, chưa kích hoạt nút.');
  if (!device.customerId) return result('Chờ khách cấu hình', 'Đã có trong kho; khách hàng ghép nối nút, chọn sản phẩm và cấu hình Wi-Fi tại nhà.');
  if (!device.storeId || !(device.productId || device.product?.id || device.configuration?.productId || device.products?.length || device.buttonProducts?.length)) {
    return result('Chưa cấu hình xong', 'Chọn sản phẩm của cửa hàng cấp nút để hoàn tất cấu hình.');
  }
  const expiry = device.rental?.effectiveExpiresAt;
  const expired = expiry && Number.isFinite(Date.parse(expiry)) && Date.parse(expiry) <= now;
  if (device.canOrder === false || device.inventoryState === 'RETURN_IN_TRANSIT' || expired || (device.rentalStatus && device.rentalStatus !== 'ACTIVE')) {
    return result('Chưa thể đặt hàng', device.canOrderReason || 'Quyền đặt hàng hoặc hợp đồng của nút chưa sẵn sàng.');
  }
  if (device.canOrder !== true) return result('Chờ xác nhận', 'Chưa có xác nhận quyền đặt hàng từ máy chủ. Tải lại để kiểm tra.');
  const seen = Date.parse(device.lastSeenAt || '');
  const recent = Number.isFinite(seen) && seen <= now && now - seen < DEVICE_HEARTBEAT_TTL_MS;
  if (!recent) return result('Chờ kết nối', 'Chưa nhận được tín hiệu Internet gần đây. Kiểm tra nguồn và Wi-Fi của nút.', false, true);
  return result('Đang hoạt động', '', true, true);
}

// REST currently may omit lastSeenAt. Keep observed heartbeat data across GETs,
// while retaining fresh server status, ownership and product configuration.
export function createDeviceTelemetry() {
  const readings = new Map<string, any>();
  return {
    record(payload: any, now = Date.now()) {
      const time = Date.parse(payload?.lastSeenAt || '');
      if (!payload?.deviceId || !Number.isFinite(time) || time > now) return;
      const previous = readings.get(payload.deviceId);
      if (previous && Date.parse(previous.lastSeenAt) >= time) return;
      const reading: any = { lastSeenAt: payload.lastSeenAt };
      if (typeof payload.batteryLevel === 'number' && payload.batteryLevel >= 0 && payload.batteryLevel <= 100) reading.batteryLevel = payload.batteryLevel;
      if (typeof payload.wifiRSSI === 'number' && Number.isFinite(payload.wifiRSSI)) reading.wifiRSSI = payload.wifiRSSI;
      readings.set(payload.deviceId, reading);
    },
    merge<T extends { deviceId: string; lastSeenAt?: string | null }>(rows: T[]): T[] {
      return rows.map(row => {
        const reading = readings.get(row.deviceId);
        const serverTime = Date.parse(row.lastSeenAt || '');
        return reading && (!Number.isFinite(serverTime) || Date.parse(reading.lastSeenAt) >= serverTime) ? { ...row, ...reading } : row;
      });
    },
  };
}
