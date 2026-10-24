import { api } from './api';

export interface CreatePayosLinkDto {
  orderId?: string | number;
  amount: number;
  description: string;
  returnUrl?: string;
  cancelUrl?: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
}

export interface PayosPaymentLinkResponse {
  bin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
  orderCode: number;
  currency: string;
  paymentLinkId: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  checkoutUrl: string;
  qrCode: string;
  orderNumber?: string;
  items?: any[];
}

export const paymentsService = {
  /**
   * Tạo link thanh toán trực tuyến qua cổng PayOS (QR VietQR, Chuyển khoản)
   */
  async createPayosLink(data: CreatePayosLinkDto) {
    const res = await api.post('/payments/payos/create-link', data);
    return res.data;
  },

  /**
   * Lấy thông tin trạng thái link thanh toán theo Payment Request ID
   */
  async getPaymentLinkInfo(paymentRequestId: string | number) {
    const res = await api.get(`/payments/payos/payment-requests/${paymentRequestId}`);
    return res.data;
  },

  /**
   * Hủy link thanh toán PayOS
   */
  async cancelPaymentLink(paymentRequestId: string | number, reason?: string) {
    const res = await api.post(`/payments/payos/payment-requests/${paymentRequestId}/cancel`, {
      cancellationReason: reason || 'Người dùng hủy thanh toán',
    });
    return res.data;
  },

  async selectOrderPaymentMethod(orderId: string, paymentMethod: 'PAYOS' | 'CASH_ON_DELIVERY' | 'COD') {
    const normalized = paymentMethod === 'CASH_ON_DELIVERY' ? 'COD' : paymentMethod;
    const res = await api.post(`/payments/orders/${orderId}/payment-method`, { paymentMethod: normalized });
    return res.data;
  },

  /**
   * Lấy chi tiết giao dịch thanh toán
   */
  async getTransaction(transactionId: string | number) {
    const res = await api.get(`/payments/${transactionId}`);
    return res.data;
  },
};
