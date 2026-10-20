import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';

let socket: Socket | null = null;
let subscribedStoreId: string | null = null;
let subscribedCustomerId: string | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('⚡ [Socket.io Client] Connected to backend server:', socket?.id);
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
  }
  return socket;
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

