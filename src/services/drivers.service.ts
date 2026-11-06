import { api } from './api';
import { normalizeOrder, publishOrderEvent } from './order-events';
import { validateDeliveryPayload, validateFailurePayload } from './driver-workflow';

export interface DriverDutyStatus {
  driverId: string;
  storeId: string | null;
  status: 'ONLINE' | 'OFFLINE';
  fullName?: string;
  phone?: string | null;
  lastSeenAt?: string | null;
}
export interface DeliverOrderDto {
  status: 'DELIVERED';
  paymentMethod: 'COD' | 'VIETQR' | 'PAYOS';
  collectedAmount?: number;
  podImageUrl: string;
}
export type DeliveryFailureCode = 'CUSTOMER_UNREACHABLE' | 'WRONG_ADDRESS' | 'CUSTOMER_REJECTED' | 'GOODS_DAMAGED_IN_TRANSIT';
export interface DeliveryFailureDto {
  failureReasonCode: DeliveryFailureCode;
  failureNote?: string;
  evidenceImageUrl: string;
}
export interface DriverShift {
  shiftId: string;
  driverId: string;
  storeId: string;
  status: 'OPEN' | 'CLOSED' | 'HANDED_OVER';
  startedAt: string;
  endedAt?: string | null;
  handedOverAt?: string | null;
  handoverCode?: string;
  handoverNote?: string | null;
  totalOrdersDelivered: number;
  totalOrdersFailed: number;
  totalCodCollected: number;
  totalVietqrCollected: number;
}
const checked = (body: any) => {
  if (!body || typeof body !== 'object') throw new Error('Chưa nhận được phản hồi hợp lệ. Vui lòng tải lại.');
  if (body?.success === false) throw new Error(body.message || 'Thao tác chưa hoàn tất.');
  return body;
};
const idPath = (id: string | number) => {
  const value = String(id);
  if (!/^\d+$/.test(value)) throw new Error('Mã dữ liệu không hợp lệ.');
  return value;
};
const changedOrder = (body: any, expectedStatus: string) => {
  checked(body);
  if (!body?.data?.id && !body?.data?.orderId) throw new Error('Máy chủ chưa trả lại đơn hàng. Vui lòng tải lại trước khi thử tiếp.');
  const order = normalizeOrder(body.data);
  if (order.status !== expectedStatus) throw new Error('Trạng thái đơn chưa được xác nhận. Vui lòng tải lại trước khi thử tiếp.');
  if (typeof window !== 'undefined') publishOrderEvent('ORDER_STATUS_CHANGED', { order });
  return { ...body, data: order };
};
const changedShift = (body: any, expectedStatus: DriverShift['status']) => {
  checked(body);
  if (!body?.data?.shiftId || body.data.status !== expectedStatus) throw new Error('Trạng thái ca chưa được xác nhận. Vui lòng tải lại trước khi thử tiếp.');
  return body;
};
export const driversService = {
  async getMyDuty(signal?: AbortSignal) {
    const body = checked((await api.get('/drivers/me/duty', { signal })).data);
    if (!['ONLINE', 'OFFLINE'].includes(body?.data?.status)) throw new Error('Chưa xác nhận được trạng thái nhận đơn.');
    return body;
  },
  async updateDuty(status: 'ONLINE' | 'OFFLINE') {
    if (!['ONLINE', 'OFFLINE'].includes(status)) throw new Error('Trạng thái trực không hợp lệ.');
    const body = checked((await api.patch('/drivers/me/duty', { status })).data);
    if (body?.data?.status !== status) throw new Error('Chưa xác nhận được trạng thái nhận đơn. Vui lòng tải lại.');
    return body;
  },
  async getOnlineDrivers(storeId: string | number, signal?: AbortSignal) {
    const body = checked((await api.get(`/drivers/store/${idPath(storeId)}/online`, { signal })).data);
    if (!Array.isArray(body?.data)) throw new Error('Không thể đọc danh sách nhân viên đang trực.');
    return body;
  },
  async getMyOrders(params?: { status?: string; dateRange?: 'today' | 'yesterday' | 'last7days' | 'all'; page?: number; limit?: number }, signal?: AbortSignal) {
    const body = checked((await api.get('/orders/driver/my-orders', { params, signal })).data);
    if (!Array.isArray(body?.orders) || !Number.isFinite(Number(body?.pagination?.total))) throw new Error('Không thể đọc danh sách đơn giao hàng. Vui lòng tải lại.');
    return { ...body, orders: body.orders.map(normalizeOrder) };
  },
  async getReadyOrders(signal?: AbortSignal) {
    const body = checked((await api.get('/orders', { params: { status: 'READY_FOR_DELIVERY' }, signal })).data);
    if (!Array.isArray(body?.data)) throw new Error('Không thể đọc danh sách đơn chờ nhận.');
    return body.data.map(normalizeOrder).filter((order: any) => !order.assignedDriverId && order.status === 'READY_FOR_DELIVERY');
  },
  async claimOrder(orderId: string | number) {
    return changedOrder((await api.post(`/orders/${idPath(orderId)}/claim`)).data, 'SHIPPING');
  },
  async getOrder(orderId: string | number) {
    const body = checked((await api.get(`/orders/${idPath(orderId)}`)).data);
    if (!body?.data?.id && !body?.data?.orderId) throw new Error('Không thể đọc thông tin đơn hàng.');
    return normalizeOrder(body.data);
  },
  async completeDelivery(orderId: string | number, data: DeliverOrderDto) {
    validateDeliveryPayload(data);
    return changedOrder((await api.post(`/orders/${idPath(orderId)}/deliver`, data)).data, 'DELIVERED');
  },
  async failDelivery(orderId: string | number, data: DeliveryFailureDto) {
    validateFailurePayload(data);
    return changedOrder((await api.post(`/orders/${idPath(orderId)}/fail`, data)).data, 'DELIVERY_FAILED');
  },
  async getCurrentShift(signal?: AbortSignal) {
    const body = checked((await api.get('/driver-shifts/current', { signal })).data);
    if (!Object.prototype.hasOwnProperty.call(body, 'data')) throw new Error('Không thể đọc ca làm hiện tại.');
    return body;
  },
  async getShiftHistory(page = 1, signal?: AbortSignal) {
    const body = checked((await api.get('/driver-shifts/history', { params: { page, limit: 10 }, signal })).data);
    if (!Array.isArray(body?.shifts)) throw new Error('Không thể đọc lịch sử ca làm.');
    return body;
  },
  async startShift() {
    return changedShift((await api.post('/driver-shifts/start')).data, 'OPEN');
  },
  async closeShift(shiftId: string | number) {
    return changedShift((await api.post(`/driver-shifts/${idPath(shiftId)}/close`)).data, 'CLOSED');
  },
  async confirmHandover(shiftId: string | number, note?: string) {
    return changedShift((await api.post(`/driver-shifts/${idPath(shiftId)}/confirm-handover`, { note: note?.trim() || undefined })).data, 'HANDED_OVER');
  },
};
