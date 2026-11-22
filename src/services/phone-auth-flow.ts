import { getRoleHomePath, normalizeAuthUser } from '../utils/authority';

export function normalizePhoneNumber(raw: string) {
  let phone = raw.trim().replace(/[\s().-]/g, '');
  if (/^0\d{9}$/.test(phone)) phone = `+84${phone.slice(1)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Nhập số điện thoại hợp lệ, ví dụ 0912345678 hoặc +84912345678.');
  return phone;
}

export function roleHome(role?: string) {
  return getRoleHomePath(role);
}

export async function exchangePhoneCredential(transport: { post: (path: string, body: any) => Promise<any> }, mode: 'login' | 'register' | 'verify', firebaseIdToken: string, profile?: { fullName: string; email?: string }) {
  if (!firebaseIdToken || firebaseIdToken.length < 100) throw new Error('Phiên xác minh chưa hợp lệ. Vui lòng gửi lại mã.');
  const body: Record<string, string> = { firebaseIdToken };
  if (mode === 'register') {
    const fullName = profile?.fullName.trim() || '';
    if (fullName.length < 2 || fullName.length > 100) throw new Error('Họ tên cần từ 2 đến 100 ký tự.');
    body.fullName = fullName;
    body.role = 'CUSTOMER';
    if (profile?.email?.trim()) body.email = profile.email.trim();
  }
  const response = await transport.post(mode === 'verify' ? '/auth/phone/verify' : `/auth/${mode}-by-phone`, body);
  const envelope = response.data;
  if (envelope?.success !== true) throw new Error(envelope?.message || 'Chưa xác nhận được tài khoản.');
  if (mode === 'verify') return { verified: true };
  const token = envelope.accessToken || envelope.data?.accessToken || envelope.token;
  const refreshToken = envelope.refreshToken || envelope.data?.refreshToken;
  const rawUser = envelope.user || envelope.data?.user;
  const user = rawUser ? normalizeAuthUser(rawUser) : null;
  if (!token || !user?.id || !user?.role) throw new Error('Phản hồi đăng nhập chưa đầy đủ. Vui lòng thử lại.');
  return { token, refreshToken, user };
}
