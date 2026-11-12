// Device identity and ownership always come from the hardware and backend.
export const BLE_SERVICE = '0000fff0-0000-1000-8000-00805f9b34fb';
const BLE_INFO = '0000fff1-0000-1000-8000-00805f9b34fb';
const BLE_WIFI = '0000fff2-0000-1000-8000-00805f9b34fb';
export const DEVICE_SYNC_EVENT = 'sob_device_claimed_success';
export function deviceData(response: any): any {
  if (response?.data?.success === false) throw new Error(response.data.message || 'Máy chủ từ chối thao tác thiết bị.');
  const value = response?.data?.data ?? response?.data;
  if (!value || typeof value !== 'object') throw new Error('Chưa nhận được dữ liệu thiết bị từ máy chủ.');
  return value;
}
export function deviceId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(value)) throw new Error('Chưa đọc được mã thiết bị hợp lệ.');
  return value;
}
export function deviceProductIds(raw: any): string[] {
  const rows = Array.isArray(raw?.products) ? raw.products : Array.isArray(raw?.buttonProducts) ? raw.buttonProducts : [];
  return [...new Set<string>([raw?.productId, raw?.configuration?.productId, raw?.product?.productId, raw?.product?.id,
    ...rows.map((p: any) => p.productId || p.product?.productId || p.product?.id)].filter(Boolean).map(String))];
}
export function normalizeDevice(raw: any): any {
  const row = raw?.products?.[0] || raw?.buttonProducts?.[0];
  const productId = raw?.productId || raw?.configuration?.productId || row?.productId;
  const product = raw?.product || raw?.configuration?.product || (row && productId ? {
    ...row.product, id: String(productId), productId: String(productId), storeId: raw.storeId,
    name: row.productName || row.product?.productName || row.product?.name,
    price: row.price ?? row.product?.basePrice, sku: row.productCode || row.product?.productCode,
  } : null);
  return { ...raw, id: String(raw.id ?? raw.buttonId ?? ''), productId: productId ? String(productId) : null, product };
}
export function assertDeviceScope(raw: any, user: any): any {
  deviceId(raw?.deviceId);
  if (user?.role === 'CUSTOMER') {
    if (!user.customerProfileId || String(raw.customerId || '') !== String(user.customerProfileId)) throw new Error('Thiết bị chưa được ghép nối với tài khoản của bạn. Hãy dùng mã ghép nối do cửa hàng cấp.');
  } else if (['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF', 'STAFF_BUTTON'].includes(user?.role)) {
    const storeId = user.storeId || user.store?.storeId || user.store?.id || user.ownedStores?.[0]?.storeId;
    if (!storeId || String(raw.storeId || '') !== String(storeId)) throw new Error('Thiết bị không thuộc lô nút đã phân bổ cho cửa hàng này.');
  } else throw new Error('Tài khoản chưa có quyền kết nối thiết bị.');
  return normalizeDevice(raw);
}
export async function readScopedDevice(client: any, id: string, user: any) {
  const raw = deviceData(await client.get(`/devices/${encodeURIComponent(deviceId(id))}`));
  if (raw.deviceId !== id) throw new Error('Mã thiết bị từ máy chủ không khớp nút đang kết nối.');
  return assertDeviceScope(raw, user);
}
export async function bleService(server: any) {
  if (!server?.connected) throw new Error('Bluetooth đã ngắt. Hãy kết nối lại đúng nút bấm.');
  return server.getPrimaryService(BLE_SERVICE);
}
export async function readBleIdentity(server: any) {
  const service = await bleService(server);
  const characteristic = await service.getCharacteristic(BLE_INFO);
  const text = new TextDecoder().decode(await characteristic.readValue());
  let info: any;
  try { info = JSON.parse(text); } catch { throw new Error('Không đọc được danh tính nút từ Bluetooth. Không dùng tên Bluetooth thay mã thiết bị.'); }
  return { ...info, deviceId: deviceId(info?.deviceId) };
}
export async function connectBle(navigatorValue: any) {
  if (!navigatorValue?.bluetooth) throw new Error('Trình duyệt chưa hỗ trợ Web Bluetooth. Hãy dùng Chrome hoặc Edge có hỗ trợ Bluetooth.');
  const hardware = await navigatorValue.bluetooth.requestDevice({ filters: [{ namePrefix: 'BTN' }, { namePrefix: 'SmartOrder' }, { namePrefix: 'SmartButton' }, { namePrefix: 'ESP' }, { namePrefix: 'SOB' }], optionalServices: [BLE_SERVICE] });
  try {
    let server = hardware.gatt;
    if (!server?.connected) {
      try { server = await hardware.gatt.connect(); }
      catch (error) { if (hardware.gatt?.connected) server = hardware.gatt; else throw error; }
    }
    const info = await readBleIdentity(server);
    return { hardware, server, info };
  } catch (error) { if (hardware.gatt?.connected) hardware.gatt.disconnect(); throw error; }
}
export async function sendBleWifi(server: any, expectedDeviceId: string, ssid: string, password: string) {
  if (!ssid.trim() || /[:\r\n]/.test(ssid) || /[\r\n]/.test(password)) throw new Error('Tên Wi-Fi không được trống, chứa dấu hai chấm hoặc xuống dòng; mật khẩu không được xuống dòng.');
  const identity = await readBleIdentity(server);
  if (identity.deviceId !== expectedDeviceId) throw new Error('Nút Bluetooth khác nút đang cấu hình. Chưa gửi thông tin Wi-Fi.');
  const service = await bleService(server);
  const characteristic = await service.getCharacteristic(BLE_WIFI);
  // Firmware FFF2 splits at the first colon and saves the remaining bytes as
  // password. WIFI: and a trailing newline would corrupt those credentials.
  const payload = new TextEncoder().encode(`${ssid.trim()}:${password}`);
  if (typeof characteristic.writeValueWithResponse === 'function') await characteristic.writeValueWithResponse(payload);
  else if (typeof characteristic.writeValue === 'function') await characteristic.writeValue(payload);
  else throw new Error('Nút không hỗ trợ ghi cấu hình Wi-Fi có xác nhận.');
  return { deviceId: expectedDeviceId, status: 'CREDENTIALS_SENT' };
}
export async function saveDeviceProduct(client: any, id: string, productId: string, user: any, name: string, onSent = () => {}, canContinue = () => true) {
  const before = await readScopedDevice(client, id, user);
  if (!/^[1-9]\d*$/.test(productId)) throw new Error('Chọn sản phẩm hợp lệ.');
  const product = deviceData(await client.get(`/products/${encodeURIComponent(productId)}`));
  if (String(product.productId || product.id) !== productId || String(product.storeId || '') !== String(before.storeId) || product.status !== 'ACTIVE') throw new Error('Sản phẩm không thuộc cửa hàng của nút bấm hoặc đã ngừng bán.');
  if (!canContinue()) throw new Error('Trang hoặc tài khoản đã thay đổi; chưa gửi cấu hình nút.');
  onSent();
  const response = user?.role === 'CUSTOMER'
    ? await client.put(`/devices/${encodeURIComponent(id)}/customer-config`, { productId, buttonName: name.trim(), quantity: 1 })
    : await client.post(`/devices/${encodeURIComponent(id)}/assign-product`, { productId, customName: name.trim() || undefined, quantity: 1 });
  deviceData(response);
  const saved = await readScopedDevice(client, id, user);
  const mapped = deviceProductIds(saved);
  if (String(saved.storeId) !== String(before.storeId) || mapped.length !== 1 || mapped[0] !== productId || Number(saved.products?.[0]?.quantity) !== 1) throw new Error('Yêu cầu đã gửi nhưng chưa xác nhận được sản phẩm đã lưu. Hãy kiểm tra lại thiết bị trước khi gửi tiếp.');
  return saved;
}
export async function saveCustomerDeviceConfig(client: any, id: string, productId: string, quantity: number, name: string, user: any, canContinue = () => true) {
  if (user?.role !== 'CUSTOMER' || !Number.isSafeInteger(quantity) || quantity < 1 || !/^[1-9]\d*$/.test(productId)) throw new Error('Cấu hình nút hoặc số lượng chưa hợp lệ.');
  const before = await readScopedDevice(client, id, user);
  const product = deviceData(await client.get(`/products/${encodeURIComponent(productId)}`));
  if (String(product.productId || product.id) !== productId || String(product.storeId || '') !== String(before.storeId) || product.status !== 'ACTIVE') throw new Error('Chỉ chọn sản phẩm đang bán trong cửa hàng của nút.');
  if (!canContinue()) throw new Error('Trang hoặc tài khoản đã thay đổi; chưa gửi cấu hình nút.');
  deviceData(await client.put(`/devices/${encodeURIComponent(id)}/customer-config`, { buttonName: name.trim(), productId, quantity }));
  const saved = await readScopedDevice(client, id, user);
  const ids = deviceProductIds(saved);
  if (String(saved.storeId) !== String(before.storeId) || ids.length !== 1 || ids[0] !== productId || Number(saved.products?.[0]?.quantity) !== quantity) throw new Error('Yêu cầu đã gửi nhưng cấu hình đọc lại chưa khớp. Hãy tải lại nút trước khi gửi thêm.');
  return saved;
}
export function connectionDraftKey(user: any) { return `sob_device_connection:${user?.id || ''}:${user?.role || ''}:${user?.storeId || user?.customerProfileId || ''}`; }
export function saveConnectionDraft(storage: Storage, user: any, value: any) {
  storage.setItem(connectionDraftKey(user), JSON.stringify({ deviceId: deviceId(value.deviceId) }));
}
export function readConnectionDraft(storage: Storage, user: any): string | null {
  try { return deviceId(JSON.parse(storage.getItem(connectionDraftKey(user)) || 'null')?.deviceId); } catch { return null; }
}
export function rememberBleReceipt(storage: Storage, user: any, raw: any) {
  const current = assertDeviceScope(raw, user);
  storage.setItem(`${connectionDraftKey(user)}:receipt:${current.deviceId}`, JSON.stringify({ deviceId: current.deviceId, buttonId: current.id, storeId: current.storeId, seenAt: new Date().toISOString() }));
}
export function hasBleReceipt(storage: Storage, user: any, raw: any) {
  try { const current = assertDeviceScope(raw, user); const saved = JSON.parse(storage.getItem(`${connectionDraftKey(user)}:receipt:${current.deviceId}`) || 'null'); return saved?.deviceId === current.deviceId && String(saved.storeId) === String(current.storeId) && String(saved.buttonId) === String(current.id); } catch { return false; }
}
export function readDeviceCache(storage: Storage, user: any): any[] {
  try { const rows = JSON.parse(storage.getItem(`${connectionDraftKey(user)}:devices`) || '[]'); return Array.isArray(rows) ? rows.map(raw => assertDeviceScope(raw, user)) : []; } catch { return []; }
}
export function saveDeviceCache(storage: Storage, user: any, rows: any[]) {
  storage.setItem(`${connectionDraftKey(user)}:devices`, JSON.stringify(rows.map(raw => assertDeviceScope(raw, user))));
}
export function upsertScopedDevice(rows: any[], raw: any, user: any) {
  const saved = assertDeviceScope(raw, user);
  return [saved, ...rows.filter(row => row.deviceId !== saved.deviceId)];
}
export async function finishPairedProduct(client: any, raw: any, user: any, storeId: string, productId: string, name: string, canContinue = () => true) {
  const saved = assertDeviceScope(raw, user);
  if (String(saved.storeId) !== String(storeId)) throw new Error('Cửa hàng trả về không khớp với phiên ghép nối.');
  const ids = deviceProductIds(saved);
  // The secure confirmation endpoint upserts a mapping. The documented
  // role-specific mapping endpoint replaces it when an older mapping remains.
  return ids.length === 1 && ids[0] === productId && Number(saved.products?.[0]?.quantity) === 1 ? saved : saveDeviceProduct(client, saved.deviceId, productId, user, name, () => {}, canContinue);
}

// Each resource publishes as soon as it resolves. Concurrent refresh requests
// share a flight and schedule at most one follow-up; disposal blocks old sessions.
export function createDevicePageLoader() {
  let active = true;
  let flight: Promise<void> | null = null;
  let queued: null | Array<() => Promise<unknown>> = null;
  const valid = () => active;
  const run = (jobs: Array<() => Promise<unknown>>): Promise<void> => {
    if (!active) return Promise.resolve();
    if (flight) { queued = jobs; return flight; }
    flight = (async () => {
      let next: typeof jobs | null = jobs;
      while (next && active) { queued = null; await Promise.allSettled(next.map(job => Promise.resolve().then(() => active ? job() : undefined))); next = queued; }
    })().finally(() => { flight = null; });
    return flight;
  };
  return { run, valid, dispose() { active = false; queued = null; } };
}
