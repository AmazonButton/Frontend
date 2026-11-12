export function pairingData(response) {
  const body = response?.data;
  if (body?.success !== true || !body.data) throw new Error(body?.message || 'Máy chủ chưa xác nhận thao tác.');
  return body.data;
}
export function pairingError(error) {
  const message = error?.response?.data?.message || error?.message;
  return Array.isArray(message) ? message.join('. ') : (typeof message === 'string' && message ? message : 'Chưa hoàn tất ghép nối. Vui lòng kiểm tra lại.');
}
export function pairingCustomer(user) {
  if (user?.role !== 'CUSTOMER' || !/^[1-9]\d*$/.test(String(user.customerProfileId || ''))) throw new Error('Tài khoản cần có hồ sơ khách hàng để thêm nút bấm.');
  return String(user.customerProfileId);
}
export function pairingProgressKey(user) { return `sob_pairing_progress:${user?.id || ''}:${pairingCustomer(user)}`; }
export function savePairingProgress(storage, user, value) {
  const progress = { deviceId: String(value.deviceId || ''), session: value.session ? {
    sessionId: value.session.sessionId, deviceId: value.session.deviceId, storeId: String(value.session.storeId || ''),
    status: value.session.status, expiresAt: value.session.expiresAt,
  } : null, confirmationSent: value.confirmationSent === true, productId: String(value.productId || ''), buttonName: String(value.buttonName || '').slice(0, 100) };
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(progress.deviceId)) throw new Error('Mã nút cần khôi phục không hợp lệ.');
  storage.setItem(pairingProgressKey(user), JSON.stringify(progress));
}
export function readPairingProgress(storage, user) {
  try {
    const p = JSON.parse(storage.getItem(pairingProgressKey(user)) || 'null');
    if (!p || !/^[A-Za-z0-9._-]{1,100}$/.test(p.deviceId) || typeof p.confirmationSent !== 'boolean') return null;
    if (p.session && (!/^sess_[a-f0-9]{24}$/.test(p.session.sessionId) || p.session.deviceId !== p.deviceId || !/^[1-9]\d*$/.test(p.session.storeId) || !Number.isFinite(Date.parse(p.session.expiresAt)))) return null;
    if (p.confirmationSent && (!p.session || !/^[1-9]\d*$/.test(p.productId))) return null;
    return p;
  } catch { return null; }
}
export function clearPairingProgress(storage, user) { storage.removeItem(pairingProgressKey(user)); }
export function parsePairingInput({ qrPayload = '', deviceCode = '', token = '' } = {}) {
  let identifier = String(deviceCode || '').trim(); let secret = String(token || '').trim();
  const qr = String(qrPayload || '').trim();
  if (qr) {
    const idMatch = qr.match(/\/device\/([^/?#\s]+)/i) || qr.match(/^SOBPAIR:\/\/([^/?#\s]+)/i);
    const tokenMatch = qr.match(/\/token\/([^/?#\s]+)/i) || qr.match(/[?&]token=([^&#\s]+)/i);
    if (!idMatch?.[1] || !tokenMatch?.[1]) throw new Error('Mã QR cần có đầy đủ mã thiết bị và mã ghép nối. Hãy dùng mã QR mới do cửa hàng cung cấp.');
    try { identifier = decodeURIComponent(idMatch[1]); secret = decodeURIComponent(tokenMatch[1]); } catch { throw new Error('Nội dung mã QR không hợp lệ.'); }
  }
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(identifier)) throw new Error('Nhập đúng mã thiết bị trên nút bấm.');
  if (!secret || secret.length > 500 || /\s/.test(secret)) throw new Error('Nhập mã ghép nối do cửa hàng cung cấp.');
  return { deviceId: identifier.toUpperCase(), token: secret };
}
export async function lookupPairingDevice(client, deviceId) {
  const value = pairingData(await client.post('/devices/lookup-code', { code: deviceId }));
  if (typeof value.deviceId !== 'string' || !/^[A-Za-z0-9._-]{1,100}$/.test(value.deviceId) || typeof value.isClaimed !== 'boolean') throw new Error('Chưa nhận được thông tin thiết bị hợp lệ.');
  return value;
}
/** @param {any} session @param {any} [expected] @param {number} [now] */
export function validatePairingSession(session, expected = null, now = Date.now()) {
  if (!/^sess_[a-f0-9]{24}$/.test(String(session?.sessionId || '')) || !/^[A-Za-z0-9._-]{1,100}$/.test(String(session?.deviceId || ''))) throw new Error('Máy chủ chưa trả phiên ghép nối hợp lệ.');
  if (session.status !== 'ACTIVE') throw new Error('Phiên ghép nối không còn hoạt động.');
  if (!session.expiresAt || !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= now) throw new Error('Phiên ghép nối đã hết hạn. Vui lòng yêu cầu mã ghép nối mới từ cửa hàng.');
  if (expected && (session.sessionId !== expected.sessionId || session.deviceId !== expected.deviceId || String(session.storeId || '') !== String(expected.storeId || ''))) throw new Error('Thông tin phiên đã thay đổi. Không thể tiếp tục ghép nối.');
  return session;
}
export async function createPairingSession(client, parsed, onSent = () => {}) {
  onSent();
  const session = pairingData(await client.post('/provisioning/session', { deviceId: parsed.deviceId, token: parsed.token }));
  validatePairingSession(session);
  if (String(session.deviceId).toUpperCase() !== parsed.deviceId.toUpperCase()) throw new Error('Thiết bị trả về không khớp mã đã nhập.');
  return session;
}
export async function verifyPairingSession(client, session) {
  validatePairingSession(session);
  const response = await client.post('/provisioning/verify', { sessionId: session.sessionId });
  if (response?.data?.valid !== true) throw new Error('Phiên ghép nối chưa được xác nhận hoặc đã hết hạn.');
  return validatePairingSession(pairingData(response), session);
}
export async function loadPairingStore(client, session) {
  if (!/^[1-9]\d*$/.test(String(session?.storeId || ''))) throw new Error('Thiết bị chưa được phân bổ cho cửa hàng. Vui lòng nhờ cửa hàng hoàn tất phân bổ và cấp mã ghép nối mới.');
  const store = pairingData(await client.get(`/stores/${encodeURIComponent(session.storeId)}`));
  if (String(store.storeId || store.id || '') !== String(session.storeId) || store.status !== 'ACTIVE') throw new Error('Cửa hàng của thiết bị chưa sẵn sàng phục vụ.');
  return { ...store, products: Array.isArray(store.products) ? store.products.filter(product => product.status === 'ACTIVE' && /^[1-9]\d*$/.test(String(product.productId || product.id || ''))) : [] };
}
export function pairingConfirmationBody(session, selection) {
  validatePairingSession(session);
  const productId = String(selection?.productId || ''); const name = String(selection?.buttonName || '').trim();
  if (!/^[1-9]\d*$/.test(productId)) throw new Error('Chọn sản phẩm cho nút bấm.');
  if (!name || name.length > 100) throw new Error('Tên nút bấm cần có từ 1 đến 100 ký tự.');
  return { deviceId: session.deviceId, buttonName: name, productId };
}
export async function confirmAtomicPairing(client, session, user, selection, onSent = () => {}) {
  const customerId = pairingCustomer(user); const body = pairingConfirmationBody(session, selection);
  await verifyPairingSession(client, session);
  const lookup = await lookupPairingDevice(client, session.deviceId);
  if (lookup.deviceId !== session.deviceId) throw new Error('Thiết bị không khớp với phiên ghép nối.');
  if (lookup.isClaimed) throw new Error('Thiết bị đã được liên kết với tài khoản. Hãy kiểm tra danh sách nút bấm trước khi tiếp tục.');
  const product = pairingData(await client.get(`/products/${encodeURIComponent(body.productId)}`));
  if (String(product.productId || product.id || '') !== body.productId || String(product.storeId || '') !== String(session.storeId) || product.status !== 'ACTIVE') throw new Error('Sản phẩm không còn được cung cấp bởi cửa hàng của thiết bị.');
  onSent();
  const result = pairingData(await client.post(`/provisioning/sessions/${encodeURIComponent(session.sessionId)}/confirmation`, body));
  if (result.deviceId !== session.deviceId || String(result.customerId || '') !== customerId || String(result.storeId || '') !== String(session.storeId) || String(result.productId || '') !== body.productId || result.status !== 'ACTIVE') throw new Error('Kết quả ghép nối chưa khớp. Hãy kiểm tra thiết bị, không gửi lại yêu cầu xác nhận.');
  return result;
}
/** @param {any} client @param {string} deviceId @param {any} user @param {{storeId: string | number, productId: string | number} | null} [expected] */
export async function readOwnedPairedDevice(client, deviceId, user, expected = null) {
  const customerId = pairingCustomer(user);
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(String(deviceId || ''))) throw new Error('Mã thiết bị không hợp lệ.');
  const device = pairingData(await client.get(`/devices/${encodeURIComponent(deviceId)}`));
  if (device.deviceId !== deviceId || String(device.customerId || '') !== customerId) throw new Error('Máy chủ chưa xác nhận thiết bị thuộc tài khoản hiện tại.');
  if (expected && (device.status !== 'ACTIVE' || String(device.storeId || '') !== String(expected.storeId) || !device.products?.some(product => String(product.productId) === String(expected.productId)))) throw new Error('Cấu hình thiết bị chưa khớp với kết quả ghép nối. Vui lòng kiểm tra lại.');
  return device;
}
