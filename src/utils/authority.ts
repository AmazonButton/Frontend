import type { RoleCapabilities, User, UserRole } from '../types';

export const ADMIN_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'] as const;
export const ACTIVE_PLATFORM_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'SYSTEM_STAFF'] as const;
export const ACTIVE_ROLES: readonly UserRole[] = [
  'SUPER_ADMIN',
  'SYSTEM_ADMIN',
  'ADMIN',
  'SYSTEM_STAFF',
  'STORE_OWNER',
  'CUSTOMER',
];

export const ROLE_BADGE_META: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: {
    label: 'Quản trị',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  SYSTEM_ADMIN: {
    label: 'Quản trị hệ thống',
    color: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
  },
  ADMIN: {
    label: 'Quản trị viên',
    color: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
  },
  SYSTEM_STAFF: {
    label: 'Kỹ thuật hệ thống',
    color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  STORE_OWNER: {
    label: 'Chủ Cửa Hàng',
    color: 'bg-[#287DA8]/10 text-[#287DA8] dark:text-[#38a5da] border-[#287DA8]/25',
  },
  CUSTOMER: {
    label: 'Khách Hàng',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
};

export function isActiveRole(role?: string | null): role is UserRole {
  return Boolean(role && (ACTIVE_ROLES as readonly string[]).includes(role));
}

export function isAdminRole(role?: string | null): boolean {
  return Boolean(role && (ADMIN_ROLES as readonly string[]).includes(role));
}

export function isSystemStaffRole(role?: string | null): boolean {
  return role === 'SYSTEM_STAFF';
}

export function isStoreOwnerRole(role?: string | null): boolean {
  return role === 'STORE_OWNER';
}

export function getRoleHomePath(role?: string | null): string {
  if (isAdminRole(role)) return '/admin/dashboard';
  if (isSystemStaffRole(role)) return '/system-staff/devices';
  if (isStoreOwnerRole(role)) return '/store/dashboard';
  if (role === 'CUSTOMER') return '/shop';
  return '/';
}

export function resolvePostLoginRedirect(
  role?: string | null,
  fromLocation?: { pathname?: string; search?: string; hash?: string } | null,
): string {
  const fallback = getRoleHomePath(role);
  const pathname = fromLocation?.pathname || '';
  if (!pathname || !pathname.startsWith('/')) return fallback;
  const authPaths = ['/login', '/register', '/phone-auth', '/forgot-password', '/reset-password', '/verify-email', '/403'];
  if (authPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return fallback;
  if (pathname.startsWith('/admin') && !isAdminRole(role)) return fallback;
  if (pathname.startsWith('/system-staff') && !isSystemStaffRole(role)) return fallback;
  if (pathname.startsWith('/store') && !isStoreOwnerRole(role)) return fallback;
  if (pathname.startsWith('/driver') && !(isStoreOwnerRole(role) || role === 'SUPER_ADMIN' || role === 'SYSTEM_ADMIN')) return fallback;
  if (pathname.startsWith('/customer') && role !== 'CUSTOMER') return fallback;
  return `${pathname}${fromLocation?.search || ''}${fromLocation?.hash || ''}`;
}

export function getDefaultCapabilities(role?: string | null): RoleCapabilities {
  const isSuper = role === 'SUPER_ADMIN';
  const isAdmin = isAdminRole(role);
  const isSystemStaff = isSystemStaffRole(role);
  const isStoreOwner = isStoreOwnerRole(role);

  return {
    managePlatformDevices: isAdmin || isSystemStaff,
    manageWarrantyTickets: isAdmin || isSystemStaff,
    approveFinancialRefunds: isAdmin,
    managePayoutsAndWithdrawals: isSuper,
    manageUsersAndRoles: isSuper,
    manageOwnStoreSalesAndDelivery: isStoreOwner,
    manageOwnStoreWallet: isStoreOwner,
  };
}

export function hasCapability(user: User | null | undefined, cap: keyof RoleCapabilities): boolean {
  if (!user) return false;
  const resolved = user.capabilities?.[cap];
  if (typeof resolved === 'boolean') return resolved;
  return getDefaultCapabilities(user.role)[cap];
}

export function normalizeAuthUser(rawUser: any): User {
  const rawStore =
    rawUser?.store ||
    (Array.isArray(rawUser?.ownedStores) ? rawUser.ownedStores[0] : null);
  const resolvedStoreId =
    rawUser?.storeId != null
      ? String(rawUser.storeId)
      : rawStore
        ? String(rawStore.storeId || rawStore.id || '')
        : null;
  const role = rawUser?.role as UserRole;
  const defaultCaps = getDefaultCapabilities(role);
  const incomingCaps = rawUser?.capabilities && typeof rawUser.capabilities === 'object'
    ? rawUser.capabilities
    : {};

  return {
    ...rawUser,
    id: String(rawUser?.id || rawUser?.userId || ''),
    userId: rawUser?.userId != null ? String(rawUser.userId) : String(rawUser?.id || ''),
    role,
    platformRole:
      rawUser?.platformRole !== undefined
        ? rawUser.platformRole
        : (ACTIVE_PLATFORM_ROLES as readonly string[]).includes(role || '')
          ? role
          : null,
    capabilities: { ...defaultCaps, ...incomingCaps },
    platformMemberships: Array.isArray(rawUser?.platformMemberships)
      ? rawUser.platformMemberships
      : undefined,
    storeId: resolvedStoreId || null,
    kycStatus: rawUser?.kycStatus || 'UNVERIFIED',
    verifiedLegalName: rawUser?.verifiedLegalName || null,
    verifiedDocumentMasked: rawUser?.verifiedDocumentMasked || null,
    kycVerifiedAt: rawUser?.kycVerifiedAt || null,
    avatarUrl: rawUser?.avatarUrl || rawUser?.avatar || rawUser?.picture || null,
    avatar: rawUser?.avatarUrl || rawUser?.avatar || rawUser?.picture || null,
    customerProfileId:
      rawUser?.customerProfileId ||
      rawUser?.customerProfile?.customerId ||
      rawUser?.customerProfile?.id ||
      null,
    store: rawStore
      ? {
          ...rawStore,
          id: String(rawStore.storeId || rawStore.id || ''),
          storeId: String(rawStore.storeId || rawStore.id || ''),
          status: String(rawStore.status || 'ACTIVE'),
          logoUrl: rawStore.logoUrl || rawStore.logo || null,
        }
      : null,
  };
}
