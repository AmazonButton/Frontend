import { io, Socket } from 'socket.io-client';
import { API_URL, resolveApiUrl } from './api';

let socket: Socket | null = null;
let subscribedStoreId: string | null = null;
let subscribedCustomerId: string | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const targetUrl = typeof resolveApiUrl === 'function' ? resolveApiUrl() : API_URL;
    socket = io(targetUrl, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      auth: (cb) => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('smart_order_token') : null;
        cb({ token });
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 8000,
    });

    let lastAuthRole: string | null = null;

    const resubscribe = () => {
      if (subscribedStoreId) {
        socket?.emit('subscribe:store', subscribedStoreId);
      }
      if (subscribedCustomerId) {
        socket?.emit('subscribe:customer', subscribedCustomerId);
      }
    };

    socket.on('connect', () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('smart_order_token') : null;
      if (token) {
        socket?.emit('authenticate', { token });
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
  }
  return socket;
}

export function updateSocketAuth(token?: string | null) {
  const currentToken = token !== undefined ? token : (typeof window !== 'undefined' ? localStorage.getItem('smart_order_token') : null);
  const s = getSocket();
  if (s) {
    (s as any).auth = { token: currentToken };
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
  const s = getSocket();
  if (storeId && s.connected) {
    s.emit('subscribe:store', storeId);
  }
}

export function subscribeToCustomer(customerId: string) {
  subscribedCustomerId = customerId;
  const s = getSocket();
  if (customerId && s.connected) {
    s.emit('subscribe:customer', customerId);
  }
}
