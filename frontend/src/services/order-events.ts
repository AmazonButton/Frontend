import type { Order } from '../types';
import { readDeliveryLocation } from './delivery-location.ts';

export const ORDER_EVENT = 'smart-order:order-event';
export type OrderEventType = 'ORDER_CREATED' | 'ORDER_CANCELLED' | 'ORDER_STATUS_CHANGED' | 'ORDER_PAYMENT_CHANGED';

const firstContactText = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

// The recipient saved on this order may differ from the account holder.
// Keep that snapshot ahead of profile fallbacks on every role's order view.
export function getOrderRecipient(raw: any) {
  return {
    customerName: firstContactText(raw?.shippingRecipientName, raw?.shipping_recipient_name, raw?.customerName, raw?.customer?.fullName, raw?.customer?.user?.fullName),
    customerPhone: firstContactText(raw?.shippingPhone, raw?.shipping_phone, raw?.recipientPhone, raw?.customerPhone, raw?.customer?.phoneNumber, raw?.customer?.phone, raw?.customer?.user?.phone),
    deliveryAddress: firstContactText(raw?.shippingAddress, raw?.shipping_address, raw?.deliveryAddress),
  };
}

// Both the HTTP API and Socket.IO return orders; older events put fields at
// the top level, while current events wrap them in `order`.
export function normalizeOrder(raw: any): Order {
  const id = String(raw?.id ?? raw?.orderId ?? '');
  const point = readDeliveryLocation(raw?.shippingLatitude ?? raw?.shipping_latitude, raw?.shippingLongitude ?? raw?.shipping_longitude);
  return {
    ...raw,
    id,
    orderNumber: raw?.orderNumber || raw?.orderCode || id,
    status: raw?.status || raw?.orderStatus || 'PENDING',
    ...getOrderRecipient(raw),
    shippingLatitude: point?.lat ?? null,
    shippingLongitude: point?.lng ?? null,
    items: Array.isArray(raw?.items) ? raw.items : [],
  };
}

export function mergeOrderUpdate(current: Order, incoming: any): Order {
  const merged = { ...current, ...incoming };
  // A refreshed snapshot can use a different alias from the cached order.
  // Update the canonical fields together so an old camel-case value cannot
  // override the new recipientPhone or snake-case value after payment/status changes.
  const recipientName = firstContactText(incoming?.shippingRecipientName, incoming?.shipping_recipient_name);
  const recipientPhone = firstContactText(incoming?.shippingPhone, incoming?.shipping_phone, incoming?.recipientPhone);
  const point = readDeliveryLocation(incoming?.shippingLatitude ?? incoming?.shipping_latitude, incoming?.shippingLongitude ?? incoming?.shipping_longitude);
  const address = getOrderRecipient(incoming).deliveryAddress;
  // Clear legacy aliases so they cannot resurrect an invalidated pin.
  delete merged.shipping_latitude;
  delete merged.shipping_longitude;
  if (!point) {
    // Partial payment/status events must preserve the saved pin. A changed
    // address without coordinates must never keep the previous address's pin.
    merged.shippingLatitude = address && address !== current.deliveryAddress ? null : current.shippingLatitude;
    merged.shippingLongitude = address && address !== current.deliveryAddress ? null : current.shippingLongitude;
  } else {
    merged.shippingLatitude = point.lat;
    merged.shippingLongitude = point.lng;
  }
  // Status/payment events can omit contact details or normalize them to empty
  // strings. Such an event must not erase the recipient already shown.
  for (const field of ['customerName', 'customerPhone', 'deliveryAddress', 'shippingRecipientName', 'shippingPhone', 'recipientPhone', 'shippingAddress', 'shipping_recipient_name', 'shipping_phone', 'shipping_address']) {
    if (!firstContactText(incoming?.[field])) merged[field] = (current as any)[field];
  }
  if (recipientName) merged.shippingRecipientName = recipientName;
  if (recipientPhone) merged.shippingPhone = recipientPhone;
  if (address) merged.shippingAddress = address;
  return normalizeOrder({ ...merged, status: incoming?.status || incoming?.orderStatus || current.status });
}

export function normalizeOrderEvent(payload: any, type?: OrderEventType) {
  const order = normalizeOrder({ ...payload, ...(payload?.order || {}) });
  if (type === 'ORDER_CANCELLED' && !['CANCELLED', 'REJECTED'].includes(order.status)) order.status = 'CANCELLED';
  return {
    ...payload,
    order,
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    deliveryAddress: order.deliveryAddress,
    reason: payload?.reason || order.cancellationReason || payload?.cancellationReason,
  };
}

export function orderEventKey(type: string, payload: any): string {
  const { order } = normalizeOrderEvent(payload);
  const status = type === 'ORDER_CREATED' ? '' : order.status;
  return `${type}:${order.id}:${status}`;
}

export function publishOrderEvent(type: OrderEventType, payload: any) {
  window.dispatchEvent(new CustomEvent(ORDER_EVENT, { detail: { type, payload: normalizeOrderEvent(payload, type) } }));
}
