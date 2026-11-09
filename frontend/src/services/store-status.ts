export function isStoreSuspended(user: any): boolean {
  if (!user) return false;
  if (user.status === 'SUSPENDED') return true;
  if (user.store?.status === 'SUSPENDED') return true;
  if (Array.isArray(user.ownedStores) && user.ownedStores.some((s: any) => s?.status === 'SUSPENDED')) return true;
  return false;
}

export function getStoreSuspendedNotice(user: any): { isSuspended: boolean; storeName: string; reason: string } {
  if (!user || !isStoreSuspended(user)) {
    return { isSuspended: false, storeName: '', reason: '' };
  }
  const store = user.store || (Array.isArray(user.ownedStores) ? user.ownedStores[0] : null);
  const storeName = store?.name || store?.storeName || 'Cửa hàng';
  const reason = store?.rejectionReason || store?.suspendReason || 'Tài khoản của bạn đã bị ngừng hoạt động theo quyết định của quản trị viên.';
  return {
    isSuspended: true,
    storeName,
    reason,
  };
}

