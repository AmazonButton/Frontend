import { io, Socket } from 'socket.io-client';
import { API_URL, resolveApiUrl } from './api';

let socket: Socket | null = null;
let subscribedStoreId: string | null = null;
let subscribedCustomerId: string | null = null;

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
      if (subscribedStoreId) {
        socket?.emit('subscribe:store', subscribedStoreId);
        console.log(`🔌 [Socket.io Client] Re-subscribed to store_${subscribedStoreId}`);
      }
      if (subscribedCustomerId) {
        socket?.emit('subscribe:customer', subscribedCustomerId);
        console.log(`🔌 [Socket.io Client] Re-subscribed to customer_${subscribedCustomerId}`);
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
  const s = getSocket();
  const token = getStoredToken();
  if (token && s) {
    s.auth = { token: `Bearer ${token}` };
  }
  if (storeId && s.connected) {
    s.emit('subscribe:store', storeId);
  } else if (s && !s.connected) {
    s.connect();
  }
}

export function subscribeToCustomer(customerId: string) {
  subscribedCustomerId = customerId;
  const s = getSocket();
  const token = getStoredToken();
  if (token && s) {
    s.auth = { token: `Bearer ${token}` };
  }
  if (customerId && s.connected) {
    s.emit('subscribe:customer', customerId);
  } else if (s && !s.connected) {
    s.connect();
  }
}

