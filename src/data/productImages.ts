/**
 * PRODUCT IMAGES CONFIGURATION & ASSET REGISTRY
 * -------------------------------------------------------------
 * File này dùng để quản lý toàn bộ hình ảnh sản phẩm tập trung.
 * Khi cần thay đổi hình ảnh (dùng ảnh local hoặc link online),
 * bạn chỉ cần sửa đường dẫn ở file này mà không cần động vào giao diện.
 *
 * MẸO SỬ DỤNG ẢNH CỦA BẠN:
 * 1. Đặt file ảnh của bạn vào thư mục: frontend/public/assets/products/
 *    (VD: frontend/public/assets/products/water-lavie.jpg)
 * 2. Thay đường dẫn bên dưới thành: '/assets/products/water-lavie.jpg'
 */

export interface ProductImageConfig {
  id: string;
  name: string;
  category: string;
  /** Đường dẫn ảnh chính (có thể là đường dẫn trong public/assets/ hoặc link CDN) */
  primaryUrl: string;
  /** Ảnh dự phòng nếu ảnh chính lỗi */
  fallbackUrl: string;
  altText: string;
}

export const PRODUCT_IMAGES: Record<string, ProductImageConfig> = {
  // 1. Nước khoáng 20L
  water: {
    id: 'water',
    name: 'Nước Khoáng & Tinh Khiết 20L',
    category: 'Nước uống',
    primaryUrl: '/assets/products/lavie.jpg',
    fallbackUrl: '/assets/products/khoangtinhkhiet.jpg',
    altText: 'Bình nước khoáng 20L chính hãng'
  },
  water_lavie: {
    id: 'water_lavie',
    name: 'La Vie 19L (Bình Úp)',
    category: 'Nước uống',
    primaryUrl: '/assets/products/lavie.jpg',
    fallbackUrl: '/assets/products/khoangtinhkhiet.jpg',
    altText: 'Bình nước khoáng La Vie 19L'
  },
  water_vinhhao: {
    id: 'water_vinhhao',
    name: 'Vĩnh Hảo 20L (Có Vòi)',
    category: 'Nước uống',
    primaryUrl: '/assets/products/vinhhao.png',
    fallbackUrl: '/assets/products/khoangtinhkhiet.jpg',
    altText: 'Bình nước khoáng Vĩnh Hảo 20L có vòi'
  },
  water_ionlife: {
    id: 'water_ionlife',
    name: 'i-on Life Nước Kiềm 19L',
    category: 'Nước uống',
    primaryUrl: '/assets/products/ionlife.jpg',
    fallbackUrl: '/assets/products/khoangtinhkhiet.jpg',
    altText: 'Bình nước kiềm ion Life 19L'
  },
  water_satori: {
    id: 'water_satori',
    name: 'Nước Tinh Khiết Satori',
    category: 'Nước uống',
    primaryUrl: '/assets/products/Satory.jpg',
    fallbackUrl: '/assets/products/khoangtinhkhiet.jpg',
    altText: 'Thùng nước tinh khiết Satori'
  },

  // 2. Bình Gas An Toàn
  gas: {
    id: 'gas',
    name: 'Bình Gas An Toàn 12kg - 45kg',
    category: 'Gas',
    primaryUrl: '/assets/products/Petrolimex.png',
    fallbackUrl: 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?auto=format&fit=crop&w=1200&q=80',
    altText: 'Bình gas gia đình van an toàn'
  },
  gas_petrolimex: {
    id: 'gas_petrolimex',
    name: 'Petrolimex 12kg Van Ngang',
    category: 'Gas',
    primaryUrl: '/assets/products/Petrolimex.png',
    fallbackUrl: 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?auto=format&fit=crop&w=1200&q=80',
    altText: 'Bình gas Petrolimex 12kg van ngang'
  },
  gas_saigonpetro: {
    id: 'gas_saigonpetro',
    name: 'Saigon Petro 12kg Xám',
    category: 'Gas',
    primaryUrl: '/assets/products/SaigonPetro.png',
    fallbackUrl: 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?auto=format&fit=crop&w=1200&q=80',
    altText: 'Bình gas Saigon Petro 12kg xám'
  },
  gas_totalgas: {
    id: 'gas_totalgas',
    name: 'Total Gas An Toàn (Bình 12kg)',
    category: 'Gas',
    primaryUrl: '/assets/products/Totalgas.png',
    fallbackUrl: 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?auto=format&fit=crop&w=1200&q=80',
    altText: 'Bình gas Total Gas 12kg'
  },
  gas_congnghiep: {
    id: 'gas_congnghiep',
    name: 'Gas Công Nghiệp 45kg',
    category: 'Gas',
    primaryUrl: '/assets/products/GasCN.png',
    fallbackUrl: 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?auto=format&fit=crop&w=1200&q=80',
    altText: 'Bình gas công nghiệp 45kg'
  },

  // 3. Gạo Đặc Sản
  rice: {
    id: 'rice',
    name: 'Gạo Đặc Sản ST25 & Gạo Lứt',
    category: 'Gạo',
    // Nếu bạn có file ảnh thật, đổi thành: '/assets/products/rice-st25.jpg'
    primaryUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1200&q=80',
    fallbackUrl: '/assets/products/rice.jpg',
    altText: 'Túi gạo đặc sản hút chân không'
  },

  // 4. Nhu Yếu Phẩm & Bếp
  essentials: {
    id: 'essentials',
    name: 'Dầu Ăn & Nhu Yếu Phẩm Bếp',
    category: 'Nhu yếu phẩm',
    // Nếu bạn có file ảnh thật, đổi thành: '/assets/products/pantry-kit.jpg'
    primaryUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=1200&q=80',
    fallbackUrl: '/assets/products/essentials.jpg',
    altText: 'Combo nhu yếu phẩm và gia vị gia đình'
  },

  // 5. Nước mắm truyền thống Phú Quốc
  fishSauce: {
    id: 'fishSauce',
    name: 'Nước Mắm Phú Quốc Cốt Nhĩ',
    category: 'Nước mắm',
    primaryUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=1200&q=80',
    fallbackUrl: '/assets/products/fish-sauce.jpg',
    altText: 'Chai nước mắm truyền thống Phú Quốc'
  }
};

/**
 * Helper lấy URL hình ảnh theo key, tự động fallback nếu không tìm thấy
 */
export const getProductImage = (key: string): string => {
  return PRODUCT_IMAGES[key]?.primaryUrl || 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=1200&q=80';
};
