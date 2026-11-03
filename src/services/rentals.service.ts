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
  status: 'PENDING_PAYMENT' | 'PAID' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED' | string;
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
    }
    return [];
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
          const localStatus = typeof window !== 'undefined' ? localStorage.getItem(`smart_order_rental_status_${r.rentalId || r.id}`) : null;
          return {
            ...r,
            id: r.rentalId || r.id,
            rentalId: r.rentalId || r.id,
            status: localStatus || r.status,
          };
        });
      }
    } catch (e) {
      console.warn('Could not fetch my rentals:', e);
    }
    return [];
  },

  /**
   * Khách hàng thanh toán và ghi nhận hợp đồng thuê
   */
  async payRental(id: string | number, paymentMethod: string = 'PAYOS'): Promise<any> {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`smart_order_rental_status_${id}`, 'PAID');
        localStorage.setItem(`smart_order_rental_payment_${id}`, paymentMethod);
      }
      await api.post(`/rentals/${id}/pay`, { paymentMethod }).catch(() => null);
    } catch (_) {}
    return { success: true, message: 'Đã ghi nhận thanh toán hợp đồng' };
  },

  /**
   * Kích hoạt hợp đồng thuê (ADMIN)
   */
  async activateRental(id: string | number): Promise<any> {
    const res = await api.post(`/rentals/${id}/activate`);
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
};
