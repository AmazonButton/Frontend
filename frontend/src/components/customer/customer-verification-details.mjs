export async function readCustomerVerificationDetails(client, sessionId, userId) {
  const id = String(sessionId || '');
  if (!/^[1-9]\d*$/.test(id) || !/^[1-9]\d*$/.test(String(userId || ''))) throw new Error('Chưa có thông tin hồ sơ để xem.');
  const response = await client.get(`/identity-verifications/sessions/${encodeURIComponent(id)}`);
  if (response.data?.success !== true) throw new Error(response.data?.message || 'Chưa thể tải hồ sơ xác minh.');
  const session = response.data?.data;
  if (String(session?.sessionId || '') !== id || String(session?.userId || '') !== String(userId)) throw new Error('Hồ sơ trả về không khớp với tài khoản hiện tại.');
  return session;
}
