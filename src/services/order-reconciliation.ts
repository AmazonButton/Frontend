import { normalizeOrder } from './order-events.ts';
import type { OrderEventType } from './order-events.ts';
import type { Order } from '../types';

export function getUserStoreId(user: any): string | null {
  const id = user?.storeId || user?.store?.storeId || user?.store?.id;
  return id == null ? null : String(id);
}

function orderState(order: Order) {
  const method = String(order.paymentMethod || '').toUpperCase();
  return [order.status, method === 'CASH_ON_DELIVERY' ? 'COD' : method, String(order.paymentStatus || '').toUpperCase()];
}

function readState(value: string) {
  try {
    const state = JSON.parse(value);
    if (Array.isArray(state) && state.length === 3 && state.every((part) => typeof part === 'string')) return state as string[];
  } catch { /* Older sessions stored only the order status. */ }
  return [value, null, null];
}

export function reconcileOrders(previous: Map<string, string> | null, rows: unknown[]) {
  const snapshot = new Map<string, string>();
  const events: Array<{ type: OrderEventType; payload: { order: Order } }> = [];
  for (const raw of rows) {
    const order = normalizeOrder(raw);
    if (!order.id) continue;
    const current = orderState(order);
    snapshot.set(order.id, JSON.stringify(current));
    if (!previous) continue;
    const before = previous.get(order.id);
    const previousState = before === undefined ? null : readState(before);
    let type: OrderEventType;
    if (!previousState || previousState[0] !== current[0]) {
      type = ['CANCELLED', 'REJECTED'].includes(order.status)
        ? 'ORDER_CANCELLED'
        : previousState ? 'ORDER_STATUS_CHANGED' : 'ORDER_CREATED';
    } else if ((previousState[1] !== null && previousState[1] !== current[1]) || (previousState[2] !== null && previousState[2] !== current[2])) {
      type = 'ORDER_PAYMENT_CHANGED';
    } else continue;
    events.push({ type, payload: { order } });
  }
  return { snapshot, events };
}
