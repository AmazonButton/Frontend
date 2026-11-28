import { api } from './api';
import {
  publishRentalPurchased,
  publishRentalPackageCreated,
} from './rental-notifications';

export interface RentalPackageItem {
  id?: string | number;
  packageId: string | number;
  packageCode: string;
  packageName: string;
  name?: string;
  description?: string;
  buttonQuantity: number;
  monthlyPrice: number | string;
  monthlyFee?: number;
  depositFee: number | string;
  features?: string[];
  isActive?: boolean;
}

export interface CreateRentalOrderDto {
  packageId: string | number;
  monthsRented: number;
  deliveryAddress?: string;
  recipientName?: string;
  recipientPhone?: string;
  note?: string;
  packageName?: string;
  buttonQuantity?: number;
  totalAmount?: number;
  depositFee?: number;
}

export interface CustomerRentalContract {
  id?: string | number;
  rentalId: string | number;
  rentalCode: string;
  customerId?: string | number;
  packageId: string | number;
  monthsRented: number;
  totalRentAmount: number | string;
  depositAmount: number | string;
  startDate: string;
  endDate: string;
  status: 'PENDING_PAYMENT' | 'PAID' | 'PENDING_HANDOVER' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | 'CANCELLED' | string;
  createdAt?: string;
  package?: RentalPackageItem;
  buttons?: any[];
}

export const rentalsService = {
  /**
   * Lấy danh sách các gói thuê nút bấm IoT thông minh từ Backend (Dữ liệu thật 100%)
   */
  async listPackages(): Promise<RentalPackageItem[]> {
    try {
      const res = await api.get('/rentals/packages');
      const data = res.data?.data || res.data;
      if (Array.isArray(data)) {
        return data.map((p: any) => ({
          ...p,
          id: p.packageId || p.id,
          packageId: p.packageId || p.id,
          packageName: p.packageName || p.name || 'Gói thuê nút IoT',
          name: p.packageName || p.name || 'Gói thuê nút IoT',
          description: p.description || '',
          buttonQuantity: Number(p.buttonQuantity || 1),
          monthlyPrice: Number(p.monthlyPrice || p.monthlyFee || 0),
          monthlyFee: Number(p.monthlyPrice || p.monthlyFee || 0),
          depositFee: Number(p.depositFee || 0),
          isActive: p.isActive !== false,
          features: Array.isArray(p.features) && p.features.length > 0 ? p.features : [
            `${p.buttonQuantity || 1} Nút bấm IoT thông minh chính hãng`,
            'Đổi mới 1-1 miễn phí trọn đời hợp đồng',
            'Hỗ trợ cài đặt & tích hợp đại lý tận nơi',
            'Hoàn cọc 100% khi kết thúc hợp đồng',
          ],
        }));
      }
    } catch (e) {
      console.warn('Could not fetch packages from API:', e);
      throw e;
    }
    throw new Error('Dữ liệu danh mục gói thuê không hợp lệ.');
  },

  /**
   * Khách hàng đăng ký gói thuê nút mới (tuân thủ nguyên bản backend CreateRentalOrderDto)
   */
  async createRentalOrder(data: CreateRentalOrderDto): Promise<any> {
    // Backend CreateRentalOrderDto chỉ chấp nhận { packageId, monthsRented }
    const payload = {
      packageId: Number(data.packageId) || data.packageId,
      monthsRented: Number(data.monthsRented) || 1,
    };
    const res = await api.post('/rentals/order', payload);
    const contract = res?.data?.data || res?.data;

    if (contract?.rentalCode) {
      try {
        const code = contract.rentalCode;
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            `smart_order_rental_shipping_${code}`,
            JSON.stringify({
              deliveryAddress: data.deliveryAddress,
              recipientName: data.recipientName,
              recipientPhone: data.recipientPhone,
              note: data.note,
            })
          );
        }
      } catch (_) {}
    }

    // Thông báo realtime đến role chủ cửa hàng (Store Owner / Manager)
    try {
      publishRentalPurchased({
        rentalCode: contract?.rentalCode || `RNT-${Date.now()}`,
        customerName: data.recipientName || 'Khách hàng',
        customerPhone: data.recipientPhone,
        deliveryAddress: data.deliveryAddress,
        packageName: data.packageName || 'Gói thuê nút IoT',
        buttonQuantity: data.buttonQuantity || 1,
        monthsRented: Number(data.monthsRented) || 1,
        totalAmount: Number(contract?.totalRentAmount || data.totalAmount || 0),
        depositAmount: Number(contract?.depositAmount || data.depositFee || 0),
        timestamp: new Date().toISOString(),
      });
    } catch (_) {}

    return res.data;
  },

  /**
   * Danh sách các nút/hợp đồng thuê của tài khoản khách hàng hiện tại
   */
  async getMyRentals(): Promise<CustomerRentalContract[]> {
    try {
      const res = await api.get('/rentals/my-rentals');
      if (res.data?.success && Array.isArray(res.data.data)) {
        return res.data.data.map((r: any) => {
          return {
            ...r,
            id: r.rentalId || r.id,
            rentalId: r.rentalId || r.id,
            status: r.status,
          };
        });
      }
    } catch (e) {
      console.warn('Could not fetch my rentals:', e);
      throw e;
    }
    throw new Error('Dữ liệu hợp đồng thuê không hợp lệ.');
  },

  /**
   * Khách hàng thanh toán và ghi nhận hợp đồng thuê
   */
  async payRental(id: string | number, paymentMethod: string = 'PAYOS'): Promise<any> {
    const response = await api.post(`/rentals/${id}/pay`, { paymentMethod });
    if (response.data?.success !== true) throw new Error(response.data?.message || 'Hệ thống chưa xác nhận thanh toán hợp đồng.');
    const latest = await api.get('/rentals/my-rentals');
    const contract = Array.isArray(latest.data?.data) ? latest.data.data.find((item: any) => String(item.rentalId || item.id) === String(id)) : null;
    if (latest.data?.success !== true || !contract || !['PAID', 'ACTIVE'].includes(contract.status)) {
      throw new Error('Đã gửi yêu cầu nhưng chưa xác nhận được trạng thái hợp đồng. Vui lòng tải lại, không thanh toán lại.');
    }
    return { success: true, data: contract };
  },

  /**
   * Kích hoạt hợp đồng thuê (ADMIN)
   */
  async activateRental(id: string | number): Promise<any> {
    const res = await api.post(`/rentals/${id}/activate`);
    return res.data;
  },

  /**
   * Hủy hợp đồng thuê trước khi bàn giao thiết bị & hoàn 100% tiền cọc (POST /api/v1/rentals/:id/cancel)
   */
  async cancelRental(id: string | number, reason?: string): Promise<any> {
    const res = await api.post(`/rentals/${encodeURIComponent(String(id))}/cancel`, {
      ...(reason && reason.trim() ? { reason: reason.trim() } : {}),
    });
    return res.data;
  },

  /**
   * Khách hàng gửi yêu cầu trả nút bấm (chỉ khi nút đang ở IN_CUSTOMER_CUSTODY)
   */
  async requestReturn(id: string | number, buttonId: string | number): Promise<any> {
    const res = await api.post(`/rentals/${encodeURIComponent(String(id))}/return-requests`, {
      buttonId: String(buttonId),
    });
    return res.data;
  },

  // ========================================================
  // ADMIN QUẢN LÝ GÓI THUÊ NÚT BẤM (API DỮ LIỆU THẬT)
  // ========================================================

  /**
   * Danh sách tất cả các gói thuê nút bấm cho Admin (GET /api/v1/admin/rentals/packages)
   */
  async adminListPackages(): Promise<RentalPackageItem[]> {
    try {
      const res = await api.get('/admin/rentals/packages');
      const data = res.data?.data || res.data;
      if (Array.isArray(data)) {
        return data.map((p: any) => ({
          ...p,
          id: p.packageId || p.id,
          packageId: p.packageId || p.id,
          packageName: p.packageName || p.name,
          name: p.packageName || p.name,
          description: p.description || '',
          buttonQuantity: Number(p.buttonQuantity || 1),
          monthlyPrice: Number(p.monthlyPrice || p.monthlyFee || 0),
          monthlyFee: Number(p.monthlyPrice || p.monthlyFee || 0),
          depositFee: Number(p.depositFee || 0),
          isActive: p.isActive !== false,
        }));
      }
    } catch (e) {
      console.warn('Could not fetch admin rental packages:', e);
    }
    return [];
  },

  /**
   * Admin tạo gói thuê nút bấm mới (POST /api/v1/admin/rentals/packages)
   */
  async adminCreatePackage(payload: {
    packageCode: string;
    packageName: string;
    description?: string;
    buttonQuantity: number;
    monthlyPrice: number;
    depositFee?: number;
  }): Promise<any> {
    const body = {
      packageCode: payload.packageCode.trim().toUpperCase(),
      packageName: payload.packageName.trim(),
      description: payload.description?.trim() || undefined,
      buttonQuantity: Number(payload.buttonQuantity) || 1,
      monthlyPrice: Number(payload.monthlyPrice) || 0,
      depositFee: Number(payload.depositFee) || 0,
    };
    const res = await api.post('/admin/rentals/packages', body);
    const created = res.data?.data || res.data;

    // Thông báo realtime đến role khách hàng: Đã có thêm gói thuê mới
    try {
      publishRentalPackageCreated({
        packageId: created?.packageId || created?.id,
        packageCode: body.packageCode,
        packageName: body.packageName,
        buttonQuantity: body.buttonQuantity,
        monthlyPrice: body.monthlyPrice,
        depositFee: body.depositFee,
        description: body.description,
        timestamp: new Date().toISOString(),
      });
    } catch (_) {}

    return res.data;
  },

  /**
   * Admin cập nhật / bật tắt gói thuê nút (PUT /api/v1/admin/rentals/packages/:id)
   */
  async adminUpdatePackage(
    id: string | number,
    payload: {
      packageName?: string;
      description?: string;
      buttonQuantity?: number;
      monthlyPrice?: number;
      depositFee?: number;
      isActive?: boolean;
    }
  ): Promise<any> {
    const body: any = {};
    if (payload.packageName !== undefined) body.packageName = payload.packageName;
    if (payload.description !== undefined) body.description = payload.description;
    if (payload.buttonQuantity !== undefined) body.buttonQuantity = Number(payload.buttonQuantity);
    if (payload.monthlyPrice !== undefined) body.monthlyPrice = Number(payload.monthlyPrice);
    if (payload.depositFee !== undefined) body.depositFee = Number(payload.depositFee);
    if (payload.isActive !== undefined) body.isActive = Boolean(payload.isActive);

    const res = await api.put(`/admin/rentals/packages/${id}`, body);
    return res.data;
  },

  // ========================================================
  // CỤM 8: CASH VOUCHER, GIA HẠN, PHÂN CÔNG, BÀN GIAO & HOÀN CỌC
  // ========================================================

  async getRentalDetail(id: string | number): Promise<any> {
    const res = await api.get(`/rentals/${encodeURIComponent(String(id))}`);
    return res.data?.data || res.data;
  },

  async issueCashVoucher(rentalId: string | number, payload: { chargeId: string; collectingStoreId: string }): Promise<any> {
    const res = await api.post(`/rentals/${encodeURIComponent(String(rentalId))}/cash-vouchers`, payload);
    return res.data?.data || res.data;
  },

  async getHandoverPreview(storeId: string | number, rentalId: string | number): Promise<any> {
    const res = await api.get(`/stores/${encodeURIComponent(String(storeId))}/rentals/${encodeURIComponent(String(rentalId))}/handover-preview`);
    return res.data?.data || res.data;
  },

  async confirmCashCollection(
    storeId: string | number,
    rentalId: string | number,
    payload: { chargeId: string; voucherToken: string; handover: 'IMMEDIATE'; buttonIds: string[] } | { chargeId: string; voucherToken: string; handover: 'DEFERRED' },
  ): Promise<any> {
    const idempotencyKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `cash-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await api.post(
      `/stores/${encodeURIComponent(String(storeId))}/rentals/${encodeURIComponent(String(rentalId))}/confirm-cash-collection`,
      payload,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return res.data?.data || res.data;
  },

  async getCashReceipt(storeId: string | number, receiptId: string | number): Promise<any> {
    const res = await api.get(`/stores/${encodeURIComponent(String(storeId))}/cash-receipts/${encodeURIComponent(String(receiptId))}`);
    return res.data?.data || res.data;
  },

  async extendRental(rentalId: string | number, additionalMonths: number): Promise<any> {
    const idempotencyKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `ext-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await api.post(
      `/rentals/${encodeURIComponent(String(rentalId))}/extensions`,
      { additionalMonths: Number(additionalMonths) },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
    return res.data?.data || res.data;
  },

  async adminListRentals(query: { page?: number; pageSize?: number; status?: string; pricingReviewRequired?: boolean } = {}): Promise<{ items: any[]; total: number; page: number; pageSize: number }> {
    const res = await api.get('/admin/rentals', { params: query });
    const body = res.data;
    const items = Array.isArray(body?.data) ? body.data : Array.isArray(body?.items) ? body.items : [];
    const total = Number(body?.pagination?.totalItems ?? body?.pagination?.total ?? body?.total ?? items.length);
    const page = Number(body?.pagination?.page ?? body?.page ?? 1);
    const pageSize = Number(body?.pagination?.pageSize ?? body?.pageSize ?? 20);
    return { items, total, page, pageSize };
  },

  async adminAssignFulfillment(rentalId: string | number, payload: { fulfillmentStoreId: string; buttonIds: string[]; notes?: string }): Promise<any> {
    const res = await api.post(`/admin/rentals/${encodeURIComponent(String(rentalId))}/assign-fulfillment`, payload);
    return res.data?.data || res.data;
  },

  async adminHandoverRental(rentalId: string | number): Promise<any> {
    const res = await api.post(`/admin/rentals/${encodeURIComponent(String(rentalId))}/handover`);
    return res.data?.data || res.data;
  },

  async adminAdjustDuration(rentalId: string | number, payload: { additionalDays: number; reason: string }): Promise<any> {
    const res = await api.post(`/admin/rentals/${encodeURIComponent(String(rentalId))}/adjust-duration`, payload);
    return res.data?.data || res.data;
  },

  async approveDepositRefund(refundId: string | number): Promise<any> {
    const res = await api.post(`/rentals/refunds/${encodeURIComponent(String(refundId))}/approve`);
    return res.data?.data || res.data;
  },

  async adminConfirmDepositRefundPayout(refundId: string | number, providerReferenceId?: string): Promise<any> {
    const res = await api.post(`/admin/rentals/refunds/${encodeURIComponent(String(refundId))}/confirm-payout`, {
      ...(providerReferenceId?.trim() ? { providerReferenceId: providerReferenceId.trim() } : {}),
    });
    return res.data?.data || res.data;
  },
};
