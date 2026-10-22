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
      auth: {
        token: token ? `Bearer ${token}` : undefined,
      },
      query: {
        token: token ? `Bearer ${token}` : undefined,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('⚡ [Socket.io Client] Connected to backend server:', socket?.id);
      const activeToken = getStoredToken();
      if (activeToken && socket) {
        socket.auth = { token: `Bearer ${activeToken}` };
      }
      const storeId = subscribedStoreId || (typeof window !== 'undefined' ? localStorage.getItem('smart_order_sub_store') : null);
      if (storeId) {
        socket?.emit('subscribe:store', storeId);
        console.log(`🔌 [Socket.io Client] Subscribed to store_${storeId}`);
      }
      const custId = subscribedCustomerId || (typeof window !== 'undefined' ? localStorage.getItem('smart_order_sub_customer') : null);
      if (custId) {
        socket?.emit('subscribe:customer', custId);
        console.log(`🔌 [Socket.io Client] Subscribed to customer_${custId}`);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ [Socket.io Client] Disconnected from server:', reason);
    });
  } else {
    // If token exists and socket auth is missing, update auth
    if (token && socket.auth && (socket.auth as any).token !== `Bearer ${token}`) {
      socket.auth = { token: `Bearer ${token}` };
    }
  }
  return socket;
}

export function updateSocketAuth(newToken?: string | null) {
  const token = newToken !== undefined ? newToken : getStoredToken();
  if (socket) {
    socket.auth = { token: token ? `Bearer ${token}` : undefined };
    if (socket.connected) {
      socket.disconnect().connect();
    } else {
      socket.connect();
    }
  } else {
    getSocket();
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
  if (storeId) {
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
  if (customerId) {
    s.emit('subscribe:customer', customerId);
  }
  if (s && !s.connected) {
    s.connect();
  }
}

