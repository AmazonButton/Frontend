import { normalizeOrderEvent } from './order-events.ts';

export const ORDER_NOTIFICATION_DURATION = 5000;

export function getOrderItemsSummary(order: any): string {
  return (order?.items || []).map((item: any) => `${item.quantity || 1}× ${item.productName || item.product?.name || 'Sản phẩm'}`).join(', ');
}

export function getOrderNotificationMessage(payload: any): string {
  const { order, reason } = normalizeOrderEvent(payload);
  const items = getOrderItemsSummary(order) || payload?.productName;
  const amount = order.totalAmount != null ? `${Number(order.totalAmount).toLocaleString('vi-VN')} ₫` : '';
  const recipient = [order.customerName, order.customerPhone, order.deliveryAddress].filter(Boolean).join(' · ');
  return [
    `Đơn #${order.orderNumber}`,
    items,
    amount ? `Tổng tiền: ${amount}` : '',
    recipient ? `Người nhận: ${recipient}` : '',
    reason ? `Lý do: ${reason}` : '',
  ].filter(Boolean).join('\n');
}
