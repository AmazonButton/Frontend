import { io, Socket } from 'socket.io-client';
import { API_URL, resolveApiUrl } from './api';

let socket: Socket | null = null;
let subscribedStoreId: string | null = typeof window !== 'undefined' ? localStorage.getItem('smart_order_sub_store') : null;
let subscribedCustomerId: string | null = typeof window !== 'undefined' ? localStorage.getItem('smart_order_sub_customer') : null;

const getStoredToken = () => {
  return typeof window !== 'undefined' ? localStorage.getItem('smart_order_token') : null;
};

export function getSocket(): Socket {
  const targetUrl = typeof resolveApiUrl === 'function' ? resolveApiUrl() : API_URL;
  const token = getStoredToken();

  if (!socket) {
    socket = io(targetUrl, {
      autoConnect: true,
      auth: (cb) => {
        const t = getStoredToken();
        cb({ token: t ? `Bearer ${t}` : undefined });
      },
      query: {
        token: token ? `Bearer ${token}` : undefined,
      },
      // Start with HTTP polling so a backend that is still starting does not
      // produce a noisy browser-level WebSocket refusal. Socket.IO upgrades to
      // WebSocket automatically as soon as the server accepts it.
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 8000,
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
      if (role && role !== lastAuthRole) {
        lastAuthRole = role;
        console.log('⚡ [Socket.io] Authenticated as:', role);
      }
      resubscribe();
    });

    socket.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') {
        lastAuthRole = null;
      }
    });

    socket.on('connect_error', () => {
      // Quietly handle transient connection errors without noisy unhandled exceptions
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
    // If token exists and socket auth is missing, update auth
    if (token && socket.auth && (socket.auth as any).token !== `Bearer ${token}`) {
      socket.auth = { token: `Bearer ${token}` };
    }
  }
  return socket;
}

export function updateSocketAuth(token?: string | null) {
  const currentToken = token !== undefined ? token : getStoredToken();
  const s = getSocket();
  if (s) {
    (s as any).auth = { token: currentToken ? `Bearer ${currentToken}` : undefined };
    if (s.connected) {
      if (currentToken) {
        s.emit('authenticate', { token: currentToken });
      }
    } else {
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

