const storageKey = 'smart_order_api_retry_after';
export const API_BACKOFF_EVENT = 'smart-order:api-backoff';
let retryUntil = 0;

export function getApiRetryUntil(): number {
  try { const saved = Number(localStorage.getItem(storageKey)); if (Number.isFinite(saved)) retryUntil = Math.max(retryUntil, saved); } catch { /* Memory fallback. */ }
  return retryUntil > Date.now() ? retryUntil : 0;
}

export function deferApiRequests(delayMs: number): number {
  retryUntil = Math.max(getApiRetryUntil(), Date.now() + Math.max(1000, delayMs));
  try { localStorage.setItem(storageKey, String(retryUntil)); } catch { /* Memory fallback. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(API_BACKOFF_EVENT));
  return retryUntil;
}

export function clearApiCooldown(): void {
  retryUntil = 0;
  try { localStorage.removeItem(storageKey); } catch { /* Memory fallback. */ }
}

export function isUpstreamInfra429(error: any): boolean {
  if (error?.response?.status !== 429) return false;
  const headers = error?.response?.headers;
  const read = (name: string) =>
    String(headers?.get?.(name) ?? headers?.[name] ?? headers?.[name.toLowerCase()] ?? '').toLowerCase();
  const renderRouting = read('x-render-routing');
  const cfMitigated = read('cf-mitigated');
  const contentType = read('content-type');
  if (renderRouting.includes('hibernate') || renderRouting.includes('rate-limited')) return true;
  if (cfMitigated.includes('challenge')) return true;
  if ((contentType.includes('text/plain') || contentType.includes('text/html')) && typeof error?.response?.data === 'string') return true;
  return false;
}

export function recordRateLimit(error: any): number {
  if (isUpstreamInfra429(error)) return 0;
  const headers = error?.response?.headers;
  const read = (name: string) => headers?.get?.(name) ?? headers?.[name] ?? headers?.[name.toLowerCase()];
  const retryAfter = read('retry-after');
  let delay = 5000;
  if (retryAfter != null && String(retryAfter).trim()) {
    const seconds = Number(retryAfter);
    const date = Date.parse(String(retryAfter));
    if (Number.isFinite(seconds)) delay = Math.min(15000, Math.max(1000, seconds * 1000));
    else if (Number.isFinite(date)) delay = Math.min(15000, Math.max(1000, date - Date.now()));
  } else {
    const reset = Number(read('ratelimit-reset'));
    if (Number.isFinite(reset) && reset > 0) {
      const raw = reset > Date.now() / 1000 ? (reset * 1000 - Date.now()) : reset * 1000;
      delay = Math.min(15000, Math.max(1000, raw));
    }
  }
  return deferApiRequests(delay);
}

export function apiCooldownError(config?: any): any {
  const seconds = Math.max(1, Math.ceil((getApiRetryUntil() - Date.now()) / 1000));
  const message = `Máy chủ đang giới hạn yêu cầu. Vui lòng thử lại sau ${seconds} giây.`;
  const error: any = new Error(message);
  error.code = 'API_COOLDOWN';
  error.isLocalCooldown = true;
  error.retryAt = getApiRetryUntil();
  error.config = config;
  error.response = { status: 429, data: { success: false, code: 'API_COOLDOWN', message }, headers: {} };
  return error;
}

export function throwIfApiCoolingDown(config?: any) {
  const url = String(config?.url || '');
  // Không để lỗi 429 từ request nền (như /discounts) khóa các thao tác chính của người dùng
  if (
    url.includes('/devices/') ||
    url.includes('/provisioning/') ||
    url.includes('/auth/') ||
    url.includes('/orders') ||
    url.includes('/payments')
  ) {
    return;
  }
  if (getApiRetryUntil()) throw apiCooldownError(config);
}
