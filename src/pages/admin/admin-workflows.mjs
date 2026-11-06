export function checkedData(response) {
  const body = response?.data;
  if (body?.success === false) throw new Error(body.message || 'Máy chủ chưa hoàn tất yêu cầu.');
  const value = body?.data ?? body;
  if (typeof value?.code === 'string' && value.code !== '00' && 'desc' in value) throw new Error(value.desc || 'Dịch vụ chi trả chưa chấp nhận yêu cầu.');
  return value;
}
export function workflowError(error, fallback = 'Không thể hoàn tất. Vui lòng thử lại.') {
  const message = error?.response?.data?.message || error?.message;
  return Array.isArray(message) ? message.join('. ') : (typeof message === 'string' && message ? message : fallback);
}
export function asItems(value) {
  if (Array.isArray(value)) return value;
  for (const key of ['payouts', 'items', 'transactions', 'data']) {
    if (Array.isArray(value?.[key])) return value[key];
    if (value?.[key] && typeof value[key] === 'object') { const nested = asItems(value[key]); if (nested.length) return nested; }
  }
  return [];
}
export const withdrawalId = item => String(item?.withdrawalId ?? item?.id ?? '');
export function payoutDestination(item) {
  return { toBin: String(item?.wallet?.bankBin || item?.bankCode || ''), toAccountNumber: String(item?.wallet?.bankAccount || item?.bankAccountNumber || '') };
}
export function canPayout(item) {
  const destination = payoutDestination(item);
  return item?.status === 'PENDING' && /^\d+$/.test(withdrawalId(item)) && Number.isSafeInteger(Number(item?.amount)) && Number(item.amount) >= 1000 && /^\d{6}$/.test(destination.toBin) && /^\d{4,30}$/.test(destination.toAccountNumber) && !!(item.providerReferenceId || item.withdrawalCode);
}
export function prepareWithdrawalBatch(items) {
  if (!items.length) throw new Error('Chọn ít nhất một yêu cầu rút tiền.');
  const ids = items.map(withdrawalId);
  if (new Set(ids).size !== ids.length) throw new Error('Danh sách có yêu cầu bị trùng.');
  if (!items.every(canPayout)) throw new Error('Chỉ chọn yêu cầu đang chờ và có đầy đủ tài khoản ngân hàng.');
  return { referenceId: `withdrawals-${[...ids].sort().join('-')}`, validateDestination: true, payouts: items.map(item => ({ referenceId: String(item.providerReferenceId || item.withdrawalCode), amount: Number(item.amount), description: (`Chi ho SOB ${item.withdrawalCode}`).slice(0, 25), ...payoutDestination(item) })) };
}
export async function performWithdrawalAction(client, item, action, fields = {}) {
  const id = withdrawalId(item);
  if (!/^\d+$/.test(id)) throw new Error('Mã yêu cầu rút tiền không hợp lệ.');
  if (!['transfer', 'reject', 'payout', 'sync-payout'].includes(action)) throw new Error('Thao tác không hợp lệ.');
  if (action !== 'sync-payout' && item.status !== 'PENDING') throw new Error('Yêu cầu đã được xử lý. Hãy tải lại danh sách.');
  if (action === 'payout' && !canPayout(item)) throw new Error('Yêu cầu chưa đủ thông tin chi trả.');
  let payload = {};
  if (action === 'reject') { if (!String(fields.reason || '').trim()) throw new Error('Nhập lý do từ chối.'); payload = { reason: String(fields.reason).trim() }; }
  if (action === 'transfer') {
    const evidence = String(fields.transferEvidenceUrl || '').trim(); let url;
    try { url = new URL(evidence); } catch { throw new Error('Nhập đường dẫn chứng từ hợp lệ.'); }
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Chứng từ cần sử dụng đường dẫn http hoặc https.');
    payload = { transferEvidenceUrl: evidence };
  }
  return checkedData(await client.post(`/admin/withdrawals/${encodeURIComponent(id)}/${action}`, payload));
}
export async function executeWithdrawalQueue(client, items, onProgress = (_results) => {}) {
  prepareWithdrawalBatch(items); const results = [];
  for (const item of items) {
    try { const data = await performWithdrawalAction(client, item, 'payout'); results.push({ id: withdrawalId(item), success: true, data }); }
    catch (error) { results.push({ id: withdrawalId(item), success: false, message: workflowError(error) }); }
    onProgress([...results]);
  }
  return results;
}
export async function loadAdminPayoutOverview(client, onSection = (_section, _value) => {}) {
  const paths = ['/admin/withdrawals', '/admin/payos/payouts', '/admin/payos/payout-balance'];
  const results = await Promise.allSettled(paths.map(async (path, section) => { const value = checkedData(await client.get(path)); onSection(section, value); return value; }));
  return { withdrawals: results[0].status === 'fulfilled' ? asItems(results[0].value) : undefined, payouts: results[1].status === 'fulfilled' ? asItems(results[1].value) : undefined, balance: results[2].status === 'fulfilled' ? results[2].value : undefined, errors: results.map((result, index) => result.status === 'rejected' ? ({ section: ['yêu cầu rút tiền', 'lịch sử PayOS', 'số dư PayOS'][index], message: workflowError(result.reason) }) : null).filter(Boolean) };
}
export function canManageIdentity(user) {
  const allowed = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'];
  return allowed.includes(user?.role) || (Array.isArray(user?.roles) && user.roles.some(r => allowed.includes(r)));
}
export async function loadIdentitySessions(client, page = 1) {
  if (!Number.isInteger(page) || page < 1) throw new Error('Trang không hợp lệ.');
  const response = await client.get('/identity-verifications/sessions', { params: { page, pageSize: 20 } });
  const data = checkedData(response);
  return { items: asItems(data), pagination: response.data?.pagination || {} };
}
export async function getIdentitySession(client, id) {
  if (!/^[1-9]\d*$/.test(String(id))) throw new Error('Mã phiên không hợp lệ.');
  return checkedData(await client.get(`/identity-verifications/sessions/${encodeURIComponent(id)}`));
}
export async function syncIdentitySession(client, id) {
  if (!/^[1-9]\d*$/.test(String(id))) throw new Error('Mã phiên không hợp lệ.');
  await client.get(`/identity-verifications/sessions/${encodeURIComponent(id)}/decision`).then(checkedData);
  return getIdentitySession(client, id);
}
export async function deleteIdentitySession(client, id) {
  if (!/^[1-9]\d*$/.test(String(id))) throw new Error('Mã phiên không hợp lệ.');
  return checkedData(await client.delete(`/identity-verifications/sessions/${encodeURIComponent(id)}`));
}
export function canActivateRental(user) {
  return ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(user?.role);
}
export async function activateRentalContract(client, id) {
  const cleanId = String(id).trim(); if (!/^[1-9]\d*$/.test(cleanId)) throw new Error('Nhập mã số hợp đồng hợp lệ.');
  const result = checkedData(await client.post(`/rentals/${encodeURIComponent(cleanId)}/activate`));
  if (result?.status !== 'ACTIVE') throw new Error('Máy chủ chưa xác nhận hợp đồng được kích hoạt. Hãy kiểm tra lại.');
  return result;
}
