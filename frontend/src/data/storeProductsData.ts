/** Product records are served by the backend. This module only retains the shared UI type. */
export interface StoreCatalogItem {
  id: string;
  name: string;
  brand: string;
  category: 'Nước mắm' | 'Nước uống' | 'Gas' | 'Gạo' | 'Dầu ăn & Gia vị' | 'Nhu yếu phẩm';
  unit: string;
  price: number;
  stock: number;
  minStockAlert: number;
  imageUrl: string;
  description: string;
  sku: string;
  badge?: string;
  rating?: number;
}

/** @deprecated Read products from GET /api/v1/products. */
export const STORE_CATALOG_PRODUCTS: StoreCatalogItem[] = [];

/** @deprecated Product data must come from the backend. */
export const getStoreCatalog = (): StoreCatalogItem[] => [];

/** @deprecated Product mutations must use the products API. */
export const saveStoreCatalog = (_items?: any): void => undefined;
