const cancellations = new Map();

export function paymentToolError(error) {
  const message = error?.response?.data?.message || error?.message;
  return Array.isArray(message) ? message.join('. ') : (typeof message === 'string' && message ? message : 'Chưa hoàn tất thao tác. Vui lòng kiểm tra lại.');
}
export function paymentToolData(response) {
  if (response?.success === false) throw new Error(response.message || 'Máy chủ chưa chấp nhận yêu cầu.');
  const value = response?.data ?? response;
  if (typeof value?.code === 'string' && value.code !== '00') throw new Error(value.desc || 'Cổng thanh toán chưa chấp nhận yêu cầu.');
  return value;
}
export function validPaymentOrderCode(value) {
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
}
export async function readProviderLink(service, orderCode) {
  if (!validPaymentOrderCode(orderCode)) throw new Error('Không xác định được liên kết thanh toán.');
  const link = paymentToolData(await service.getPaymentLinkInfo(orderCode));
  if (!link || typeof link.status !== 'string') throw new Error('Cổng thanh toán chưa trả trạng thái hợp lệ.');
  if (link.orderCode !== undefined && String(link.orderCode) !== String(orderCode)) throw new Error('Thông tin liên kết trả về không khớp. Vui lòng tải lại.');
  return link;
}
export function cancelPendingPaymentLink(service, orderCode, reason) {
  const key = String(orderCode);
  if (cancellations.has(key)) return cancellations.get(key);
  const request = (async () => {
    const current = await readProviderLink(service, orderCode);
    if (current.status === 'PAID') throw new Error('Liên kết đã được thanh toán nên không thể hủy.');
    if (current.status === 'CANCELLED') return { alreadyCancelled: true, link: current };
    if (current.status !== 'PENDING') throw new Error('Liên kết hiện không còn ở trạng thái chờ thanh toán.');
    const result = paymentToolData(await service.cancelPaymentLink(orderCode, String(reason || '').trim() || 'Khách hàng yêu cầu hủy liên kết thanh toán'));
    if (result?.status !== 'CANCELLED') throw new Error('Cổng thanh toán chưa xác nhận hủy liên kết. Hãy kiểm tra trạng thái trước khi thử lại.');
    if (result.orderCode !== undefined && String(result.orderCode) !== key) throw new Error('Kết quả hủy không khớp với liên kết hiện tại.');
    return { alreadyCancelled: false, link: result };
  })();
  cancellations.set(key, request);
  request.finally(() => { if (cancellations.get(key) === request) cancellations.delete(key); }).catch(() => {});
  return request;
}
export async function readCanonicalPaymentOrder(client, orderId) {
  if (!/^[1-9]\d*$/.test(String(orderId))) throw new Error('Không xác định được đơn hàng để cập nhật.');
  const response = await client.get(`/orders/${encodeURIComponent(orderId)}`);
  const order = paymentToolData(response.data);
  if (String(order?.id ?? order?.orderId ?? '') !== String(orderId)) throw new Error('Thông tin đơn hàng trả về không khớp.');
  return order;
}
export async function refreshPaymentRecords(service, client, orderCode, orderId) {
  const result = await Promise.allSettled([readProviderLink(service, orderCode), readCanonicalPaymentOrder(client, orderId)]);
  return { provider: result[0].status === 'fulfilled' ? result[0].value : null, order: result[1].status === 'fulfilled' ? result[1].value : null, warnings: result.flatMap((item, index) => item.status === 'rejected' ? [`Chưa cập nhật được ${index === 0 ? 'kết quả cổng thanh toán' : 'đơn hàng'}: ${paymentToolError(item.reason)}`] : []) };
}
export async function readKnownPaymentTransaction(service, transactionId, orderId) {
  if (!/^[1-9]\d*$/.test(String(transactionId))) throw new Error('Chưa có mã giao dịch từ hệ thống.');
  const transaction = paymentToolData(await service.getTransaction(transactionId));
  if (String(transaction?.paymentTransactionId || '') !== String(transactionId) || String(transaction?.orderId || '') !== String(orderId)) throw new Error('Giao dịch không khớp với đơn hàng đang xem.');
  return transaction;
}
