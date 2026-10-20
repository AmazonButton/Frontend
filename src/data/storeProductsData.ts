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

export const STORE_CATALOG_PRODUCTS: StoreCatalogItem[] = [
  // ==========================================
  // NHÓM 1: NƯỚC MẮM (ĐẶC BIỆT YÊU CẦU THEO PROMPT)
  // ==========================================
  {
    id: 'prod-nm-khaihoan-520ml',
    sku: 'NM-KHAIHOAN-40N-520ML',
    name: 'Nước Mắm Khải Hoàn Phú Quốc 40 Độ Đạm',
    brand: 'Khải Hoàn Phú Quốc',
    category: 'Nước mắm',
    unit: 'Chai thủy tinh 520ml',
    price: 135000,
    stock: 120,
    minStockAlert: 15,
    imageUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80',
    description: 'Nước mắm truyền thống cốt nhĩ Phú Quốc 40N nguyên chất từ cá cơm than ủ thùng gỗ bời lời, hương vị đậm đà hậu ngọt tự nhiên.',
    badge: 'Đặc sản truyền thống',
    rating: 4.9,
  },
  {
    id: 'prod-nm-chinsu-cahoi-500ml',
    sku: 'NM-CHINSU-CAHOI-500ML',
    name: 'Nước Mắm Chinsu Cá Hồi Đậm Đà',
    brand: 'Chinsu (Masan)',
    category: 'Nước mắm',
    unit: 'Chai 500ml',
    price: 49000,
    stock: 250,
    minStockAlert: 30,
    imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
    description: 'Nước mắm Chinsu hương cá hồi hảo hạng, vị mặn dịu thơm ngon, phù hợp mọi bữa cơm gia đình hiện đại.',
    badge: 'Bán chạy nhất',
    rating: 4.8,
  },
  {
    id: 'prod-nm-namngu-denhy-900ml',
    sku: 'NM-NAMNGU-DENHY-900ML',
    name: 'Nước Mắm Nam Ngư Đệ Nhị Thơm Ngon',
    brand: 'Nam Ngư (Masan)',
    category: 'Nước mắm',
    unit: 'Chai tiết kiệm 900ml',
    price: 36000,
    stock: 310,
    minStockAlert: 40,
    imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=600&q=80',
    description: 'Nước mắm Nam Ngư Đệ Nhị đóng chai 900ml dung tích lớn tiết kiệm, vị ngon vừa miệng cả nhà.',
    badge: 'Tiết kiệm',
    rating: 4.7,
  },
  {
    id: 'prod-nm-thanhha-40n-500ml',
    sku: 'NM-THANHHA-40N-500ML',
    name: 'Nước Mắm Thanh Hà Phú Quốc 40N Cốt Nhĩ',
    brand: 'Thanh Hà',
    category: 'Nước mắm',
    unit: 'Chai 500ml',
    price: 110000,
    stock: 85,
    minStockAlert: 10,
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80',
    description: 'Nước mắm cốt cá cơm Thanh Hà chuẩn chỉ dẫn địa lý Phú Quốc, không phẩm màu, không chất bảo quản.',
    badge: 'Chuẩn OCOP 4*',
    rating: 4.9,
  },
  {
    id: 'prod-nm-phanthiet-can2l',
    sku: 'NM-PHANTHIET-30N-2L',
    name: 'Nước Mắm Phan Thiết Mũi Né 30N',
    brand: 'Phan Thiết Mũi Né',
    category: 'Nước mắm',
    unit: 'Can 2 Lít gia đình',
    price: 165000,
    stock: 65,
    minStockAlert: 10,
    imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
    description: 'Nước mắm cá nục Phan Thiết đậm đà thơm béo, quy cách can 2 lít tiện lợi cho hộ gia đình nấu ăn thường xuyên.',
    badge: 'Dung tích lớn',
    rating: 4.8,
  },
  {
    id: 'prod-nm-balang-500ml',
    sku: 'NM-BALANG-COTNHI-500ML',
    name: 'Nước Mắm Ba Làng Cốt Nhĩ Đặc Biệt',
    brand: 'Ba Làng Xứ Thanh',
    category: 'Nước mắm',
    unit: 'Chai 500ml',
    price: 88000,
    stock: 90,
    minStockAlert: 12,
    imageUrl: 'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=600&q=80',
    description: 'Làng nghề nước mắm truyền thống Ba Làng Thanh Hóa, ủ chượp tự nhiên từ cá cơm rạm tươi rói.',
    badge: 'Gia truyền',
    rating: 4.8,
  },

  // ==========================================
  // NHÓM 2: NƯỚC UỐNG ĐÓNG BÌNH & CHAI
  // ==========================================
  {
    id: 'prod-wtr-lavie-20l',
    sku: 'WTR-LAV-20L',
    name: 'Nước Khoáng Thiên Nhiên La Vie 20L',
    brand: 'La Vie (Nestlé Waters)',
    category: 'Nước uống',
    unit: 'Bình úp 20L',
    price: 68000,
    stock: 180,
    minStockAlert: 20,
    imageUrl: 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=600&q=80',
    description: 'Nước khoáng thiên nhiên đóng bình tại nguồn La Vie 20L bổ sung 6 khoáng chất thiết yếu mỗi ngày cho cư dân.',
    badge: 'Nhu yếu phẩm số 1',
    rating: 5.0,
  },
  {
    id: 'prod-wtr-vinhhao-20l',
    sku: 'WTR-VINH-20L',
    name: 'Nước Khoáng Vĩnh Hảo 20L Có Vòi',
    brand: 'Vĩnh Hảo (Masan)',
    category: 'Nước uống',
    unit: 'Bình có vòi 20L',
    price: 72000,
    stock: 140,
    minStockAlert: 15,
    imageUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80',
    description: 'Nước khoáng thiên nhiên Vĩnh Hảo đóng bình tiện lợi có sẵn vòi xả trực tiếp, tiện dụng cho gia đình không có cây nóng lạnh.',
    badge: 'Có vòi tiện lợi',
    rating: 4.9,
  },
  {
    id: 'prod-wtr-ionlife-19l',
    sku: 'WTR-ION-19L',
    name: 'Nước Ion Kiềm i-on Life 19L',
    brand: 'i-on Life',
    category: 'Nước uống',
    unit: 'Bình 19L',
    price: 78000,
    stock: 95,
    minStockAlert: 15,
    imageUrl: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?auto=format&fit=crop&w=600&q=80',
    description: 'Nước uống ion kiềm công nghệ điện phân Nhật Bản pH 8.5-9.5 giúp thanh lọc cơ thể và hỗ trợ tiêu hóa.',
    badge: 'Công nghệ Nhật',
    rating: 4.9,
  },

  // ==========================================
  // NHÓM 3: BÌNH GAS GIA ĐÌNH & AN TOÀN
  // ==========================================
  {
    id: 'prod-gas-petro-12kg',
    sku: 'GAS-PET-12KG',
    name: 'Bình Gas Petrolimex 12kg Van Ngang',
    brand: 'Petrolimex Gas',
    category: 'Gas',
    unit: 'Bình 12kg (Van ngang an toàn)',
    price: 435000,
    stock: 48,
    minStockAlert: 8,
    imageUrl: 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?auto=format&fit=crop&w=600&q=80',
    description: 'Bình gas Petrolimex chính hãng có niêm phong màng co nhiệt, kiểm định an toàn áp suất nghiêm ngặt, giao và lắp đặt miễn phí tại căn hộ.',
    badge: 'An toàn kiểm định',
    rating: 5.0,
  },
  {
    id: 'prod-gas-saigonpetro-12kg',
    sku: 'GAS-SP-12KG',
    name: 'Bình Gas Saigon Petro SP 12kg Xám',
    brand: 'Saigon Petro',
    category: 'Gas',
    unit: 'Bình 12kg',
    price: 420000,
    stock: 35,
    minStockAlert: 6,
    imageUrl: 'https://images.unsplash.com/photo-1520038410233-7141be7e6f97?auto=format&fit=crop&w=600&q=80',
    description: 'Bình gas Saigon Petro vỏ xám van tiêu chuẩn chống rò rỉ khí gas, kiểm định tem chống hàng giả SMS.',
    badge: 'Giao nhanh 15p',
    rating: 4.8,
  },

  // ==========================================
  // NHÓM 4: GẠO ĐẶC SẢN VIỆT NAM
  // ==========================================
  {
    id: 'prod-ric-st25-5kg',
    sku: 'RIC-ST25-5KG',
    name: 'Gạo Đặc Sản ST25 Ông Cua Túi 5kg',
    brand: 'Gạo ST25 Ông Cua Sóc Trăng',
    category: 'Gạo',
    unit: 'Túi hút chân không 5kg',
    price: 195000,
    stock: 110,
    minStockAlert: 20,
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80',
    description: 'Gạo Ngon Nhất Thế Giới ST25 chính hãng DNTN Hồ Quang Trí, hạt thon dài, dẻo mềm, thơm mùi lá dứa tự nhiên dù để nguội.',
    badge: 'Gạo ngon thế giới',
    rating: 5.0,
  },
  {
    id: 'prod-ric-nanghoa-5kg',
    sku: 'RIC-NANGHOA-5KG',
    name: 'Gạo Nàng Hoa Thơm Dẻo Túi 5kg',
    brand: 'Nàng Hoa Chợ Đào',
    category: 'Gạo',
    unit: 'Túi 5kg',
    price: 145000,
    stock: 75,
    minStockAlert: 15,
    imageUrl: 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?auto=format&fit=crop&w=600&q=80',
    description: 'Gạo Nàng Hoa vụ mùa mới, cơm mềm thơm đậm đà, thích hợp cho bữa cơm ấm cúng gia đình.',
    badge: 'Vụ mùa mới',
    rating: 4.8,
  },

  // ==========================================
  // NHÓM 5: DẦU ĂN & GIA VỊ THIẾT YẾU
  // ==========================================
  {
    id: 'prod-oil-simply-5l',
    sku: 'OIL-SMP-5L',
    name: 'Dầu Đậu Nành Nguyên Chất Simply Can 5L',
    brand: 'Simply Pure',
    category: 'Dầu ăn & Gia vị',
    unit: 'Can tiết kiệm 5 Lít',
    price: 275000,
    stock: 55,
    minStockAlert: 10,
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=80',
    description: 'Dầu đậu nành nguyên chất Simply giàu Omega 3-6-9 tốt cho tim mạch, dung tích 5 lít dùng bền bỉ.',
    badge: 'Tốt cho tim mạch',
    rating: 4.9,
  },
  {
    id: 'prod-knorr-900g',
    sku: 'SPICE-KNORR-900G',
    name: 'Hạt Nêm Knorr Từ Thịt Thăn & Xương Ống 900g',
    brand: 'Knorr (Unilever)',
    category: 'Dầu ăn & Gia vị',
    unit: 'Gói 900g',
    price: 48000,
    stock: 130,
    minStockAlert: 20,
    imageUrl: 'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=600&q=80',
    description: 'Hạt nêm Knorr chiết xuất từ thịt thăn và tủy xương ống hầm nhiều giờ giúp canh ngọt đậm đà.',
    badge: 'Gia vị quốc dân',
    rating: 4.9,
  },
  {
    id: 'prod-sunlight-3kg6',
    sku: 'CLN-SUNLIGHT-3KG6',
    name: 'Nước Rửa Chén Sunlight Thiên Nhiên Can 3.6kg',
    brand: 'Sunlight',
    category: 'Nhu yếu phẩm',
    unit: 'Can 3.6kg',
    price: 115000,
    stock: 60,
    minStockAlert: 10,
    imageUrl: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=600&q=80',
    description: 'Nước rửa chén Sunlight chiết xuất lô hội và muối khoáng, diệt dầu mỡ tức thì và dịu nhẹ với da tay.',
    badge: 'Chăm sóc nhà cửa',
    rating: 4.8,
  },
];

// Load store catalog with localStorage persistence
export const getStoreCatalog = (): StoreCatalogItem[] => {
  try {
    const saved = localStorage.getItem('sob_store_inventory_v2');
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

// Save store catalog to localStorage
export const saveStoreCatalog = (items: StoreCatalogItem[]): void => {
  try {
    localStorage.setItem('sob_store_inventory_v2', JSON.stringify(items));
    window.dispatchEvent(new Event('sob_store_inventory_updated'));
  } catch (e) {
    console.error('Could not save store inventory:', e);
  }
};
