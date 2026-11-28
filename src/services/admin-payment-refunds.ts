import { api } from './api';

export interface PaymentRefundObligation {
  obligationId: string;
  orderId?: string | null;
  sourcePaymentTransactionId?: string | null;
  receiptId?: string | null;
  obligationType:
    | 'ORDER_REFUND'
    | 'ORDER_CANCELLATION'
    | 'EXCESS_PAYMENT'
    | 'EXCESS_DUPLICATE'
    | 'LATE_CANCELLED_OR_COD'
    | 'LEGACY_UNCLASSIFIED'
    | 'STORE_PENNY_VERIFICATION'
    | 'CUSTOMER_PENNY_VERIFICATION'
    | 'RENTAL_DEPOSIT_REFUND'
    | string;
  refundAmount: number;
  currency: string;
  status: 'PENDING' | 'DISPATCHING' | 'SETTLED' | 'FAILED' | 'PENDING_RECONCILIATION' | 'REJECTED' | string;
  recipientVerificationStatus?: string;
  verificationNote?: string | null;
  customerBankAccountId?: string | null;
  targetBankBin?: string | null;
  targetAccountMasked?: string | null;
  targetAccountName?: string | null;
  snapshotLockedAt?: string | null;
  activePayoutAttemptId?: string | null;
  settledAttemptId?: string | null;
  failureReason?: string | null;
  refundedAt?: string | null;
  createdAt?: string;
  receipt?: {
    receiptId?: string;
    provider?: string;
    channel?: string;
    providerTransactionRef?: string;
    amount?: number;
    classification?: string;
    sourceBankBin?: string;
    sourceAccountMasked?: string;
    sourceEvidenceStatus?: string;
    receivedAt?: string;
  } | null;
  order?: {
    orderId?: string;
    orderCode?: string;
    orderStatus?: string;
    paymentStatus?: string;
    isGuestOrder?: boolean;
    storeId?: string;
  } | null;
  payoutAttempts?: any[];
}

export interface PaymentRefundObligationsResponse {
  items: PaymentRefundObligation[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InitiatePaymentRefundPayoutPayload {
  customerBankAccountId?: string;
  note?: string;
}

export interface BillingOverpaymentObligation {
  obligationId: string;
  receiptId: string;
  amount: number;
  status: 'OPEN' | 'RESOLVED' | 'REFUNDED' | 'WRITTEN_OFF' | string;
  receiptClassification?: string;
  createdAt?: string;
  resolvedAt?: string | null;
  resolvedByUserId?: string | null;
  resolutionNote?: string | null;
  receipt?: {
    id?: string;
    chargeId?: string;
    provider?: string;
    channel?: string;
    providerTransactionRef?: string;
    amount?: number;
    currency?: string;
    classification?: string;
    receivedAt?: string;
  } | null;
}

export const adminPaymentRefundsService = {
  async listObligations(query: {
    page?: number;
    pageSize?: number;
    status?: string;
    orderId?: string;
  } = {}): Promise<PaymentRefundObligationsResponse> {
    const params: Record<string, any> = {};
    if (query.page) params.page = query.page;
    if (query.pageSize) params.pageSize = query.pageSize;
    if (query.status && query.status !== 'ALL') params.status = query.status;
    if (query.orderId) params.orderId = query.orderId;

    const res = await api.get('/admin/payment-refunds/obligations', { params });
    const body = res.data;
    const items: PaymentRefundObligation[] = Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.items)
        ? body.items
        : [];
    const total: number = Number(body?.pagination?.totalItems ?? body?.total ?? items.length);
    const page: number = Number(body?.pagination?.page ?? body?.page ?? 1);
    const pageSize: number = Number(body?.pagination?.pageSize ?? body?.pageSize ?? 20);

    return { items, total, page, pageSize };
  },

  async getObligationById(id: string): Promise<PaymentRefundObligation> {
    const res = await api.get(`/admin/payment-refunds/obligations/${encodeURIComponent(id)}`);
    return res.data?.data || res.data;
  },

  async initiatePayout(id: string, payload: InitiatePaymentRefundPayoutPayload = {}): Promise<any> {
    const res = await api.post(`/admin/payment-refunds/obligations/${encodeURIComponent(id)}/payout`, payload);
    return res.data;
  },

  async syncObligation(id: string): Promise<any> {
    const res = await api.post(`/admin/payment-refunds/obligations/${encodeURIComponent(id)}/sync`);
    return res.data;
  },

  async listBillingOverpayments(query: { page?: number; pageSize?: number; status?: string } = {}): Promise<{
    items: BillingOverpaymentObligation[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const res = await api.get('/admin/billing-overpayments', { params: query });
    const body = res.data;
    const items = Array.isArray(body?.data) ? body.data : Array.isArray(body?.items) ? body.items : [];
    const total = Number(body?.pagination?.total ?? body?.total ?? items.length);
    const page = Number(body?.pagination?.page ?? body?.page ?? 1);
    const pageSize = Number(body?.pagination?.pageSize ?? body?.pageSize ?? 20);
    return { items, total, page, pageSize };
  },

  async resolveBillingOverpayment(
    id: string,
    payload: { status?: 'RESOLVED' | 'REFUNDED' | 'WRITTEN_OFF'; resolutionNote: string },
  ): Promise<any> {
    const res = await api.post(`/admin/billing-overpayments/${encodeURIComponent(id)}/resolve`, payload);
    return res.data;
  },

  async refundExcessTransaction(transactionId: string, payload: { note?: string } = {}): Promise<any> {
    const res = await api.post(`/payments/transactions/${encodeURIComponent(transactionId)}/refund-excess`, payload);
    return res.data;
  },
};
