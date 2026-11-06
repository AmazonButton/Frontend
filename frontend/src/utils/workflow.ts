export function workflowError(error: any, fallback = 'Chưa thể thực hiện. Vui lòng thử lại.') {
  const message = error?.response?.data?.message || error?.message;
  return Array.isArray(message) ? message.join('. ') : typeof message === 'string' ? message : fallback;
}

export function workflowData<T = any>(response: any): T {
  const envelope = response?.data ?? response;
  if (envelope?.success === false) throw new Error(envelope.message || 'Yêu cầu chưa được thực hiện.');
  return (envelope?.data ?? envelope) as T;
}

export const formatMoney = (value: unknown) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value) || 0);

export function safeWebUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; }
}
