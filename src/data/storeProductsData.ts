/** Product records are served by the backend. This module retains shared UI types and robust offline fallbacks. */
export interface StoreCatalogItem {
  id: string;
  name: string;
  brand: string;
  category: 'Nước mắm' | 'Nước uống' | 'Gas' | 'Gạo' | 'Dầu ăn & Gia vị' | 'Nhu yếu phẩm' | 'Khác' | string;
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

/** Standard catalog products used as immediate default & resilient offline fallback */
export const STORE_CATALOG_PRODUCTS: StoreCatalogItem[] = [
  {
    id: '1',
    sku: 'WAT-VINHHAO-20L',
    name: 'Nước Khoáng Vĩnh Hảo 20L (Bình Úp)',
    brand: 'Vĩnh Hảo',
    category: 'Nước uống',
    unit: 'Bình 20L',
    price: 68000,
    stock: 85,
    minStockAlert: 10,
    imageUrl: '/assets/products/vinhhao.png',
    description: 'Nước khoáng thiên nhiên Vĩnh Hảo bổ sung khoáng chất canxi, magie tự nhiên, quy cách bình úp 20 lít cho máy nóng lạnh.',
    badge: 'Bán chạy nhất',
    rating: 4.9,
  },
  {
    id: '2',
    sku: 'WAT-LAVIE-19L',
    name: 'Nước Khoáng Thiên Nhiên La Vie 19L (Bình Vòi)',
    brand: 'La Vie (Nestlé Waters)',
    category: 'Nước uống',
    unit: 'Bình 19L',
    price: 72000,
    stock: 95,
    minStockAlert: 15,
    imageUrl: '/assets/products/vinhhao.png',
    description: 'Nước khoáng thiên nhiên La Vie được đóng chai tại nguồn với công nghệ tiên tiến của Nestlé Waters, giữ trọn 6 khoáng chất thiết yếu.',
    badge: 'Chính hãng Nestlé',
    rating: 5.0,
  },
  {
    id: '3',
    sku: 'WAT-SATORI-20L',
    name: 'Nước Tinh Khiết Satori Hoàn Lưu Khoáng 20L',
    brand: 'Satori',
    category: 'Nước uống',
    unit: 'Bình 20L',
    price: 65000,
    stock: 60,
    minStockAlert: 10,
    imageUrl: '/assets/products/vinhhao.png',
    description: 'Công nghệ lọc RO kết hợp màng vi lọc sRO và hoàn lưu khoáng của Nhật Bản, mang lại vị ngọt thanh mát tự nhiên.',
    badge: 'Công nghệ Nhật Bản',
    rating: 4.8,
  },
  {
    id: '4',
    sku: 'WAT-AQUA-500ML',
    name: 'Nước Tinh Khiết Aquafina 500ml (Thùng 24 Chai)',
    brand: 'Aquafina (Suntory PepsiCo)',
    category: 'Nước uống',
    unit: 'Thùng 24 chai',
    price: 98000,
    stock: 110,
    minStockAlert: 15,
    imageUrl: '/assets/products/vinhhao.png',
    description: 'Nước tinh khiết đóng chai Aquafina xử lý qua hệ thống lọc thẩm thấu ngược Hydro-7 độc quyền.',
    badge: 'Tiện lợi',
    rating: 4.8,
  },
  {
    id: '5',
    sku: 'GAS-PETRO-12KG',
    name: 'Bình Gas Petrolimex 12kg Chính Hãng (Van Ngang)',
    brand: 'Petrolimex Gas',
    category: 'Gas',
    unit: 'Bình 12kg',
    price: 435000,
    stock: 45,
    minStockAlert: 8,
    imageUrl: '/assets/products/Petrolimex.png',
    description: 'Bình gas Petrolimex vỏ xanh van ngang an toàn tuyệt đối, màng co niêm phong chống hàng giả, giao và lắp đặt miễn phí.',
    badge: 'An toàn kiểm định',
    rating: 5.0,
  },
  {
    id: '6',
    sku: 'RIC-ST25-5KG',
    name: 'Gạo Đặc Sản ST25 Ông Cua Túi 5kg',
    brand: 'Gạo ST25 Ông Cua Sóc Trăng',
    category: 'Gạo',
    unit: 'Túi hút chân không 5kg',
    price: 195000,
    stock: 120,
    minStockAlert: 20,
    imageUrl: '/assets/products/rice-st25.png',
    description: 'Gạo Ngon Nhất Thế Giới ST25 chính hãng DNTN Hồ Quang Trí, hạt thon dài, dẻo mềm, thơm mùi lá dứa tự nhiên.',
    badge: 'Gạo ngon thế giới',
    rating: 5.0,
  },
  {
    id: '7',
    sku: 'NM-CHINSU-CAHOI-500ML',
    name: 'Nước Mắm Chinsu Cá Hồi Đậm Đà 500ml',
    brand: 'Chinsu (Masan)',
    category: 'Nhu yếu phẩm',
    unit: 'Chai 500ml',
    price: 49000,
    stock: 250,
    minStockAlert: 30,
    imageUrl: '/assets/products/vinhhao.png',
    description: 'Nước mắm Chinsu hương cá hồi hảo hạng, vị mặn ngọt hài hòa, phù hợp cho mọi món ăn gia đình.',
    badge: 'Bán chạy nhất',
    rating: 4.8,
  },
];

/** Get catalog with localStorage persistence and default fallback */
export const getStoreCatalog = (): StoreCatalogItem[] => {
  try {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('sob_store_inventory_v2') : null;
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not read store inventory from storage:', e);
  }
  return STORE_CATALOG_PRODUCTS;
};

/** Save store catalog to localStorage */
export const saveStoreCatalog = (items?: any): void => {
  try {
    if (typeof window !== 'undefined' && Array.isArray(items)) {
      localStorage.setItem('sob_store_inventory_v2', JSON.stringify(items));
      window.dispatchEvent(new Event('sob_store_inventory_updated'));
    }
  } catch (e) {
    console.error('Could not save store inventory:', e);
  }
};
