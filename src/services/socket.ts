import { io, Socket } from 'socket.io-client';
import { API_URL, isTokenExpired, resolveApiUrl, getOrRefreshValidToken } from './api';

let socket: Socket | null = null;
let subscribedStoreId: string | null = typeof window !== 'undefined' ? localStorage.getItem('smart_order_sub_store') : null;
let subscribedCustomerId: string | null = typeof window !== 'undefined' ? localStorage.getItem('smart_order_sub_customer') : null;
let isRefreshingSocket = false;

const getStoredToken = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('smart_order_token') : null;
  // Never put an expired JWT into the Socket.IO handshake. Render then rejects
  // the polling request with a 400, which is unrelated to the current page.
  return token && !isTokenExpired(token) ? token : null;
};

/**
 * Tự động làm mới Token và kết nối lại Socket.IO ngay lập tức
 * khi token hết hạn hoặc kết nối bị từ chối (lỗi 401 / connect_error).
 */
export async function reconnectSocketWithFreshToken(): Promise<void> {
  if (isRefreshingSocket) return;
  isRefreshingSocket = true;
  try {
    const freshToken = await getOrRefreshValidToken();
    if (freshToken && socket) {
      (socket as any).auth = { token: `Bearer ${freshToken}` };
      if (!socket.connected) {
        socket.connect();
      } else {
        socket.emit('authenticate', { token: freshToken });
      }
    }
  } catch (err) {
    console.warn('Socket token auto-refresh failed:', err);
  } finally {
    isRefreshingSocket = false;
  }
}

export const reconnectSocket = reconnectSocketWithFreshToken;

const CLUSTER_WEBSOCKET_NODES = [
  'https://backend-fae8.onrender.com',
  'https://backend-node2-ukib.onrender.com',
];

export function resolveSocketUrl(): string {
  const envSocketUrl = (import.meta as any).env?.VITE_SOCKET_URL;
  if (envSocketUrl && typeof envSocketUrl === 'string' && envSocketUrl.startsWith('http')) {
    const clean = envSocketUrl.trim().replace(/\/+$/, '');
    // Cloudflare Workers (*.workers.dev) are HTTP reverse proxies and return 503 on WebSocket upgrades.
    // Route WebSocket connections directly to the upstream WebSocket cluster nodes.
    if (!clean.includes('workers.dev')) {
      return clean;
    }
  }

  const resolved = typeof resolveApiUrl === 'function' ? resolveApiUrl() : API_URL;
  if (resolved && typeof resolved === 'string' && resolved.startsWith('http') && !resolved.includes('workers.dev')) {
    return resolved.trim().replace(/\/+$/, '');
  }

  return CLUSTER_WEBSOCKET_NODES[0];
}

export function getSocket(): Socket {
  const targetUrl = resolveSocketUrl();
  const token = getStoredToken();

  if (!socket) {
    socket = io(targetUrl, {
      autoConnect: true,
      auth: async (cb) => {
        let t = getStoredToken();
        if (!t) {
          t = await getOrRefreshValidToken().catch(() => null);
        }
        cb({ token: t ? `Bearer ${t}` : undefined });
      },
      // Use direct WebSocket transport to bypass Render proxy sticky-session limitations
      // and completely eliminate polling 400 Bad Request errors.
      transports: ['websocket'],
      upgrade: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    let lastAuthRole: string | null = null;

    const resubscribe = () => {
      const storeId = subscribedStoreId || (typeof window !== 'undefined' ? localStorage.getItem('smart_order_sub_store') : null);
      if (storeId) {
        socket?.emit('subscribe:store', storeId);
      }
      const custId = subscribedCustomerId || (typeof window !== 'undefined' ? localStorage.getItem('smart_order_sub_customer') : null);
      if (custId) {
        socket?.emit('subscribe:customer', custId);
      }
    };

    socket.on('connect', () => {
      const activeToken = getStoredToken();
      if (activeToken) {
        socket?.emit('authenticate', { token: activeToken });
      }
      resubscribe();
    });

    socket.on('authenticated', (res: any) => {
      const role = res?.user?.role;
      if (role) {
        lastAuthRole = role;
      }
      resubscribe();
    });

    socket.on('disconnect', async (reason) => {
      if (reason === 'io server disconnect') {
        // Khi server ngắt kết nối do token hết hạn hoặc xác thực thất bại -> tự động refresh và kết nối lại
        await reconnectSocketWithFreshToken();
      }
      if (reason !== 'io client disconnect') {
        lastAuthRole = null;
      }
    });

    socket.on('connect_error', async (err: any) => {
      // Khi token hết hạn hoặc kết nối bị từ chối ( connect_error / 401 ),
      // hệ thống tự động gọi refresh token mới và reconnect() lại Socket ngay lập tức.
      const currentToken = getStoredToken();
      const msg = err?.message || '';
      if (!currentToken || /auth|unauthorized|jwt|token|401|403|forbidden/i.test(msg)) {
        await reconnectSocketWithFreshToken();
      }
    });

    socket.on('unauthorized', async () => {
      await reconnectSocketWithFreshToken();
    });

    // Cleanly disconnect when page enters Back-Forward Cache (bfcache)
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => {
        if (socket?.connected) {
          socket.disconnect();
        }
      });

      window.addEventListener('pageshow', (event) => {
        if (event.persisted && socket && !socket.connected) {
          socket.connect();
        }
      });
    }
  } else {
    socket.auth = { token: token ? `Bearer ${token}` : undefined };
  }
  return socket;
}

export function updateSocketAuth(token?: string | null) {
  const currentToken = token !== undefined ? token : getStoredToken();
  const validToken = currentToken && !isTokenExpired(currentToken) ? currentToken : null;
  const s = getSocket();
  if (s) {
    (s as any).auth = { token: validToken ? `Bearer ${validToken}` : undefined };
    if (s.connected) {
      if (validToken) {
        s.emit('authenticate', { token: validToken });
      } else {
        s.disconnect();
      }
    } else if (validToken) {
      s.connect();
    }
  }
}

export function subscribeToStore(storeId: string) {
  subscribedStoreId = storeId;
  if (typeof window !== 'undefined' && storeId) {
    localStorage.setItem('smart_order_sub_store', storeId);
  }
  const s = getSocket();
  const token = getStoredToken();
  if (token && s) {
    s.auth = { token: `Bearer ${token}` };
  }
  if (storeId && s.connected) {
    s.emit('subscribe:store', storeId);
  }
  if (s && !s.connected) {
    s.connect();
  }
}

export function subscribeToCustomer(customerId: string) {
  subscribedCustomerId = customerId;
  if (typeof window !== 'undefined' && customerId) {
    localStorage.setItem('smart_order_sub_customer', customerId);
  }
  const s = getSocket();
  const token = getStoredToken();
  if (token && s) {
    s.auth = { token: `Bearer ${token}` };
  }
  if (customerId && s.connected) {
    s.emit('subscribe:customer', customerId);
  }
  if (s && !s.connected) {
    s.connect();
  }
}

export function clearSocketSubscriptions() {
  subscribedStoreId = null;
  subscribedCustomerId = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('smart_order_sub_store');
      localStorage.removeItem('smart_order_sub_customer');
    } catch (_) {}
  }
}
