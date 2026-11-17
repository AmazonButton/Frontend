import { api } from './api';

export interface ProductDiscount {
  discountId: string;
  productId: string;
  discountPercent: number | null;
  discountAmount: number | null;
  startAt: string;
  endAt: string;
  status: 'ACTIVE' | 'INACTIVE';
}
export type DiscountInput = Pick<ProductDiscount, 'startAt' | 'endAt' | 'status'> & {
  discountPercent?: number | null;
  discountAmount?: number | null;
};
export const productDiscounts = {
  async list(productId: string): Promise<ProductDiscount[]> {
    const response = await api.get(`/products/${productId}/discounts`);
    if (!Array.isArray(response.data?.data)) throw new Error('Không tải được ưu đãi sản phẩm.');
    return response.data.data;
  },
  async create(productId: string, input: DiscountInput) {
    return api.post(`/products/${productId}/discounts`, input);
  },
  async update(id: string, input: Partial<DiscountInput>) {
    return api.patch(`/discounts/${id}`, input);
  },
  async remove(id: string) { return api.delete(`/discounts/${id}`); },
};
export function discountedPrice(price: number, discounts: ProductDiscount[] = [], now = Date.now()) {
  const active = discounts.find(discount => discount.status === 'ACTIVE'
    && Date.parse(discount.startAt) <= now && Date.parse(discount.endAt) >= now);
  if (!active) return price;
  const reduction = active.discountPercent != null
    ? Math.round(price * Number(active.discountPercent) / 100)
    : Number(active.discountAmount || 0);
  return Number.isFinite(reduction) ? Math.max(0, price - reduction) : price;
}
