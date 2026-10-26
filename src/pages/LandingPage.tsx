import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, ArrowRight, ShieldCheck, Zap, Battery, CheckCircle2, ShoppingCart, Droplets, Star, Shield, Check, Sparkles, MousePointerClick, SearchX, Cog, Truck, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { InteractiveHeroBackground } from '../components/InteractiveHeroBackground';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { toast } from '../context/ToastContext';

/**
 * Store owners can upload PNG cut-outs with a large transparent canvas around
 * the product. `object-cover` then crops the actual product out of the card.
 * Trim transparent borders in the browser before displaying data-URL images.
 */
const StorefrontProductImage: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className = 'w-full h-full object-cover transition-all duration-500 ease-out group-hover:scale-105' }) => {
  const [displaySrc, setDisplaySrc] = useState(src);
  const processedSourceRef = useRef<string | null>(null);

  useEffect(() => {
    setDisplaySrc(src);
    processedSourceRef.current = null;
  }, [src]);

  const trimTransparentCanvas = (event: React.SyntheticEvent<HTMLImageElement>) => {
    if (!src.startsWith('data:image/') || processedSourceRef.current === src) return;
    processedSourceRef.current = src;

    try {
      const image = event.currentTarget;
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      if (!width || !height) return;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, width, height).data;
      let left = width;
      let top = height;
      let right = -1;
      let bottom = -1;

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (pixels[(y * width + x) * 4 + 3] > 8) {
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
          }
        }
      }

      if (right < left || bottom < top) return;
      const padding = Math.max(4, Math.ceil(Math.max(right - left + 1, bottom - top + 1) * 0.06));
      const cropLeft = Math.max(0, left - padding);
      const cropTop = Math.max(0, top - padding);
      const cropRight = Math.min(width, right + padding + 1);
      const cropBottom = Math.min(height, bottom + padding + 1);

      // Avoid a needless re-encode for images that already fill their canvas.
      if (cropLeft === 0 && cropTop === 0 && cropRight === width && cropBottom === height) return;

      const cropped = document.createElement('canvas');
      cropped.width = cropRight - cropLeft;
      cropped.height = cropBottom - cropTop;
      cropped.getContext('2d')?.drawImage(canvas, cropLeft, cropTop, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
      setDisplaySrc(cropped.toDataURL('image/png'));
    } catch {
      // Keep the original image if the browser cannot read the canvas.
    }
  };

  return <img src={displaySrc} alt={alt} onLoad={trimTransparentCanvas} className={className} loading="lazy" />;
};

const PARTNER_BRANDS = [
  {
    name: 'LaVie',
    logo: '/assets/brands/lavie.png',
    alt: 'LaVie Mineral Water',
  },
  {
    name: 'Gas South',
    logo: '/assets/brands/gas-south.png',
    alt: 'Gas South Natural Energy',
  },
  {
    name: 'Saigon Petro',
    logo: '/assets/brands/saigon-petro.png',
    alt: 'Saigon Petro',
  },
  {
    name: 'Gạo ST25 Ông Cua',
    logo: '/assets/brands/gao-st25.png',
    alt: 'Gạo Đặc Sản ST25 Ông Cua',
  },
  {
    name: 'Vinamilk',
    logo: '/assets/brands/vinamilk.png',
    alt: 'Vinamilk',
  },
  {
    name: 'Nestlé',
    logo: '/assets/brands/nestle.png',
    alt: 'Nestlé',
  },
];

const FEATURED_PRODUCTS = [
  {
    id: 'lavie-20l',
    title: 'Nước Khoáng 20L',
    price: '68.000 ₫',
    badge: 'Phổ biến nhất',
    badgeStyle: 'bg-sky-50/95 dark:bg-sky-950/90 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/80',
    BadgeIcon: Droplets,
    badgeIconColor: 'text-sky-600 dark:text-sky-400',
    description: 'Bình úp máy nóng lạnh & bình vòi. Đổi vỏ bình tận cửa trong 15 phút.',
    image: '/assets/products/lavie-lifestyle.jpg',
  },
  {
    id: 'gas-petrolimex',
    title: 'Bình Gas An Toàn',
    price: '385.000 ₫',
    badge: 'Kiểm định 100%',
    badgeStyle: 'bg-emerald-50/95 dark:bg-emerald-950/90 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80',
    BadgeIcon: ShieldCheck,
    badgeIconColor: 'text-emerald-600 dark:text-emerald-400',
    description: 'Bình gas 12kg chính hãng có tem chống giả, van ngắt tự động và cân đủ.',
    image: '/assets/products/gas-lifestyle.jpg',
  },
  {
    id: 'rice-st25',
    title: 'Gạo Đặc Sản ST25',
    price: '195.000 ₫',
    badge: 'Gạo ngon thế giới',
    badgeStyle: 'bg-amber-50/95 dark:bg-amber-950/90 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/80',
    BadgeIcon: Star,
    badgeIconColor: 'text-amber-500 fill-amber-400',
    description: 'Bao 5kg - 10kg hạt thơm dài, dẻo thơm thượng hạng, thu hoạch vụ mùa mới.',
    image: '/assets/products/rice-lifestyle.jpg',
  },
  {
    id: 'toilet-paper-pack',
    title: 'Giấy Vệ Sinh Cao Cấp',
    price: '68.000 ₫',
    badge: 'Định kỳ mỗi tuần',
    badgeStyle: 'bg-purple-50/95 dark:bg-purple-950/90 text-purple-700 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/80',
    BadgeIcon: Shield,
    badgeIconColor: 'text-purple-600 dark:text-purple-400',
    description: 'Lốc 6 cuộn 3 lớp siêu mềm mịn, 100% bột giấy tự nhiên, an toàn cho làn da gia đình.',
    image: '/assets/products/smart-button-wall.jpg',
    hoverImage: '/assets/products/toilet-paper-lifestyle.jpg',
  },
];

export const LandingPage: React.FC = () => {
  // Video player controls state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const [storefrontProducts, setStorefrontProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [cartPulse, setCartPulse] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const brandScrollRef = useRef<HTMLDivElement>(null);

  const fetchStorefrontProducts = () => {
    api.get('/products/storefront/catalog')
      .then(({ data }) => {
        const list = (data.data || []).map((p: any) => ({
          ...p,
          category: typeof p.category === 'object' && p.category !== null
            ? (p.category.categoryName || p.category.name || 'Nhu yếu phẩm')
            : (typeof p.category === 'string' ? p.category : 'Nhu yếu phẩm'),
        }));
        setStorefrontProducts(list);
      })
      .catch(() => { setStorefrontProducts([]); })
      .finally(() => { setProductsLoading(false); });
  };

  useEffect(() => {
    fetchStorefrontProducts();

    try {
      const saved = JSON.parse(localStorage.getItem('sob_storefront_cart_v1') || '[]');
      setCartCount(saved.reduce((sum: number, line: any) => sum + Number(line.quantity || 0), 0));
    } catch { setCartCount(0); }

    const socket = getSocket();
    const handleProductChange = () => {
      fetchStorefrontProducts();
    };

    socket.on('PRODUCT_CREATED', handleProductChange);
    socket.on('PRODUCT_UPDATED', handleProductChange);
    socket.on('PRODUCT_DELETED', handleProductChange);
    socket.on('PRODUCT_STOCK_CHANGED', handleProductChange);
    socket.on('CATALOG_UPDATED', handleProductChange);

    return () => {
      socket.off('PRODUCT_CREATED', handleProductChange);
      socket.off('PRODUCT_UPDATED', handleProductChange);
      socket.off('PRODUCT_DELETED', handleProductChange);
      socket.off('PRODUCT_STOCK_CHANGED', handleProductChange);
      socket.off('CATALOG_UPDATED', handleProductChange);
    };
  }, []);

  const addProductToCart = (product: any) => {
    try {
      const saved = JSON.parse(localStorage.getItem('sob_storefront_cart_v1') || '[]');
      if (saved[0]?.product?.storeId && saved[0].product.storeId !== product.storeId) {
        toast.warning('Mỗi đơn hàng chỉ có thể chứa sản phẩm của cùng một cửa hàng.', {
          title: 'Lưu ý giỏ hàng',
        });
        return;
      }
      const existing = saved.find((line: any) => line.product?.id === product.id);
      const next = existing
        ? saved.map((line: any) => line.product?.id === product.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...saved, { product, quantity: 1 }];
      localStorage.setItem('sob_storefront_cart_v1', JSON.stringify(next));
      setCartCount(next.reduce((sum: number, line: any) => sum + Number(line.quantity || 0), 0));
      setCartPulse(true);
      window.setTimeout(() => setCartPulse(false), 650);

      setAddedProductId(product.id);
      window.setTimeout(() => setAddedProductId(null), 2000);

      toast.success(`Đã thêm "${product.name}" vào giỏ hàng thành công.`, {
        title: 'Thêm vào giỏ hàng',
      });
    } catch {
      toast.error('Có lỗi xảy ra khi cập nhật giỏ hàng. Vui lòng thử lại.', {
        title: 'Không thể thêm vào giỏ',
      });
    }
  };

  const scrollBrandsLeft = () => {
    if (brandScrollRef.current) {
      brandScrollRef.current.scrollBy({ left: -260, behavior: 'smooth' });
    }
  };

  const scrollBrandsRight = () => {
    if (brandScrollRef.current) {
      brandScrollRef.current.scrollBy({ left: 260, behavior: 'smooth' });
    }
  };


  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100 selection:bg-[#0F172A] selection:text-white font-sans antialiased relative">

      {/* ========================================================================= */}
      {/* 2. HERO SECTION (SIDE-BY-SIDE SPLIT - No wasted vertical space)           */}
      {/* ========================================================================= */}
      <section
        id="features"
        className="w-full min-h-[calc(100vh-4rem)] flex flex-col justify-center pt-24 pb-14 sm:pt-28 sm:pb-16 lg:pt-28 lg:pb-16 relative overflow-hidden scroll-mt-20"
      >
        {/* 3D Parallax Interactive Background */}
        <InteractiveHeroBackground />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full my-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

            {/* Left Column (Text & CTA) */}
            <div className="lg:col-span-6 space-y-6 text-left">
              {/* Refined Deliberate Two-Line Headline */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[56px] font-bold tracking-tight leading-[1.08] lg:leading-[1.05] max-w-[620px]">
                <span className="block text-[#172234] dark:text-white">
                  Một nút bấm vật lý.
                </span>
                <span className="block mt-2 sm:mt-2.5 text-[#287DA8] dark:text-sky-400">
                  Đặt đúng thứ bạn cần.
                </span>
              </h1>

              {/* Concise Supporting Description */}
              <p className="text-base sm:text-[17px] lg:text-[18px] leading-[1.6] text-[#687586] dark:text-slate-300 max-w-[540px] font-normal">
                Nước uống, gas, gạo và nhu yếu phẩm gia đình — đặt hàng chỉ bằng một lần nhấn.
              </p>

              {/* Two CTA Buttons */}
              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <Link
                  to="/quick-setup"
                  className="inline-flex items-center justify-center h-12 px-7 rounded-xl bg-[#287DA8] hover:bg-[#206588] text-white font-semibold text-sm transition-all shadow-[0_4px_16px_rgba(40,125,168,0.25)] hover:shadow-[0_6px_20px_rgba(40,125,168,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] focus-visible:ring-offset-2 active:scale-[0.98]"
                >
                  Đặt thử ngay
                </Link>
                <a
                  href="#categories"
                  className="inline-flex items-center justify-center h-12 px-6 rounded-xl bg-white/80 dark:bg-zinc-900/80 hover:bg-slate-50 dark:hover:bg-zinc-800 text-[#172234] dark:text-white hover:text-[#287DA8] dark:hover:text-sky-400 font-semibold text-sm border border-slate-300/80 dark:border-zinc-700/80 hover:border-[#287DA8]/40 backdrop-blur-md transition-all shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8]/50 focus-visible:ring-offset-2 active:scale-[0.98]"
                >
                  Khám phá
                </a>
              </div>

              {/* Supporting Benefits (Semantic Designer Icons) */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs sm:text-[13px] text-[#687586] dark:text-slate-400 font-medium">
                <span className="inline-flex items-center gap-2">
                  <SearchX className="w-4 h-4 text-[#4AA785] stroke-[2.2]" />
                  <span>Không cần tìm kiếm</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <MousePointerClick className="w-4 h-4 text-[#4AA785] stroke-[2.2]" />
                  <span>Một lần nhấn để đặt</span>
                </span>
              </div>
            </div>

            {/* Right Column (Visual - Crisp 16:9 Video Player UI aligned with Left Text) */}
            <div className="lg:col-span-6 w-full flex items-center justify-center">
              <div className="w-full max-w-[560px] mx-auto">
                <div
                  onClick={togglePlay}
                  className="relative group cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-slate-950 shadow-[0_16px_40px_rgba(15,23,42,0.12)] transition-all duration-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.18)]"
                >
                  <video
                    ref={videoRef}
                    src="/assets/TIKTOK.mp4"
                    autoPlay
                    loop
                    muted={isMuted}
                    playsInline
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    className="w-full aspect-[16/9] object-cover block rounded-2xl"
                  />

                  {/* Dark Glass Center Play Button when Paused */}
                  {!isPlaying && (
                    <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center transition-all duration-300">
                      <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-[#0F172A]/80 hover:bg-[#0F172A] border border-white/20 text-white flex items-center justify-center shadow-2xl transform transition-transform duration-200 group-hover:scale-110">
                        <Play className="w-7 h-7 fill-white translate-x-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Audio Toggle in bottom corner */}
                  <div className="absolute bottom-3.5 right-3.5 flex items-center gap-2 opacity-90 transition-opacity">
                    <button
                      type="button"
                      onClick={toggleMute}
                      title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                      className="p-2.5 rounded-full backdrop-blur-md bg-black/50 hover:bg-black/70 text-white border border-white/20 transition-all active:scale-95 shadow-md"
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4 text-white/90" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Restrained Center Caption (Removed 15-minute claim) */}
                <div className="flex items-center justify-center mt-3 px-1 text-xs text-[#687586] dark:text-slate-400">
                  <span className="font-medium tracking-wide">Trải nghiệm đặt hàng thực tế</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Chi tiết ${selectedProduct.name}`}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }} transition={{ type: 'spring', damping: 28, stiffness: 300 }} className="relative mx-auto flex min-h-full max-w-4xl items-center">
              <div className="relative my-auto grid w-full overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-2">
                <button type="button" onClick={() => setSelectedProduct(null)} className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-900" aria-label="Đóng chi tiết sản phẩm"><X size={19}/></button>
                <div className="flex min-h-[300px] items-center justify-center bg-slate-50 p-8 sm:min-h-[440px] sm:p-12">
                  {selectedProduct.imageUrl ? <StorefrontProductImage src={selectedProduct.imageUrl} alt={selectedProduct.name} className="max-h-[380px] w-full object-contain" /> : <span className="text-7xl">🛍️</span>}
                </div>
                <div className="flex flex-col p-6 sm:p-9">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#1976D2]"><ShoppingCart className="h-4 w-4"/>{selectedProduct.store?.name || 'Cửa hàng đối tác'}</div>
                  <p className="mt-5 text-sm font-medium text-slate-500">{selectedProduct.category}{selectedProduct.brand ? ` · ${selectedProduct.brand}` : ''}</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{selectedProduct.name}</h2>
                  <p className="mt-4 text-3xl font-bold text-[#1976D2]">{Number(selectedProduct.price).toLocaleString('vi-VN')} ₫</p>
                  <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600"><p>Đơn vị: <strong className="text-slate-800">{selectedProduct.unit || 'Sản phẩm'}</strong></p><p className="mt-1">Sản phẩm được cập nhật giá và tồn kho trực tiếp từ cửa hàng.</p></div>
                  <p className="mt-4 text-sm font-medium text-emerald-700">{Math.max(0, Number(selectedProduct.stock || 0) - Number(selectedProduct.reservedStock || 0)) > 0 ? `Còn hàng · ${Math.max(0, Number(selectedProduct.stock || 0) - Number(selectedProduct.reservedStock || 0))} sản phẩm` : 'Tạm hết hàng'}</p>
                  <div className="mt-auto grid gap-3 pt-8 sm:grid-cols-2">
                    <button type="button" disabled={Math.max(0, Number(selectedProduct.stock || 0) - Number(selectedProduct.reservedStock || 0)) <= 0} onClick={() => addProductToCart(selectedProduct)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#1976D2] py-3 font-semibold text-[#1976D2] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"><ShoppingCart className="h-4 w-4"/>Thêm vào giỏ</button>
                    <Link to="/shop?cart=open" onClick={() => addProductToCart(selectedProduct)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#287DA8] py-3 font-semibold text-white shadow-sm transition hover:bg-[#206588]">Mua ngay <ArrowRight className="h-4 w-4"/></Link>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 3. PARTNER BRANDS SECTION (100% Matching Image Mockup)                    */}
      {/* ========================================================================= */}
      <section
        id="partners"
        className="py-16 sm:py-20 bg-white/70 dark:bg-zinc-950/40 relative overflow-hidden select-none border-b border-slate-100 dark:border-zinc-800/80 scroll-mt-20"
      >
        {/* Soft Decorative Ambient Blue Curves */}
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 rounded-full bg-sky-100/50 dark:bg-sky-950/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 rounded-full bg-sky-100/50 dark:bg-sky-950/20 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">

          {/* Section Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-3"
          >
            <span className="w-8 h-[2.5px] bg-[#2E9B66] rounded-full inline-block" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#556987] dark:text-slate-400 font-mono">
              ĐỐI TÁC ĐỒNG HÀNH
            </span>
          </motion.div>

          {/* Section Main Title */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="text-2xl sm:text-3xl lg:text-[2.35rem] font-extrabold tracking-tight text-[#172234] dark:text-white leading-[1.28]"
          >
            Cùng các thương hiệu uy tín<br />
            <span className="text-[#1B84D4] dark:text-sky-400">đưa nhu yếu phẩm đến mọi nhà.</span>
          </motion.h2>

          {/* Subtitle Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-3 max-w-2xl mx-auto leading-relaxed"
          >
            Smart Order Button hợp tác với các nhà cung cấp và đơn vị phân phối uy tín, đảm bảo nguồn hàng chất lượng, minh bạch và ổn định.
          </motion.p>

          {/* Logo Cards Slider with Interactive Arrows */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 sm:mt-12 flex items-center justify-center gap-3 sm:gap-4 relative"
          >
            {/* Left Nav Arrow Button */}
            <button
              type="button"
              onClick={scrollBrandsLeft}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white dark:bg-zinc-800 border border-slate-200/90 dark:border-zinc-700 shadow-sm flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-[#1B84D4] hover:border-[#1B84D4]/40 dark:hover:border-sky-500 transition-all shrink-0 active:scale-95"
              aria-label="Đối tác trước"
            >
              <ChevronLeft className="w-5 h-5 -translate-x-0.5" />
            </button>

            {/* Logo Cards Container */}
            <div
              ref={brandScrollRef}
              className="flex-1 overflow-x-auto no-scrollbar scroll-smooth py-2"
            >
              <div className="grid grid-flow-col auto-cols-[180px] sm:auto-cols-[200px] lg:grid-flow-row lg:grid-cols-6 gap-4 sm:gap-5 justify-center items-center min-w-max lg:min-w-0 mx-auto">
                {PARTNER_BRANDS.map((brand, i) => (
                  <motion.div
                    key={brand.name}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: 0.1 + i * 0.08 }}
                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                    className="w-full h-32 sm:h-36 rounded-2xl bg-white border border-slate-200/90 dark:border-zinc-700/80 p-3 sm:p-4 flex items-center justify-center shadow-xs hover:shadow-lg hover:border-slate-300 dark:hover:border-zinc-600 transition-all duration-300 group cursor-default"
                  >
                    <img
                      src={brand.logo}
                      alt={brand.alt}
                      className="max-h-20 sm:max-h-24 w-auto max-w-[92%] object-contain filter group-hover:scale-108 transition-transform duration-300"
                      loading="lazy"
                    />
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right Nav Arrow Button */}
            <button
              type="button"
              onClick={scrollBrandsRight}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white dark:bg-zinc-800 border border-slate-200/90 dark:border-zinc-700 shadow-sm flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-[#1B84D4] hover:border-[#1B84D4]/40 dark:hover:border-sky-500 transition-all shrink-0 active:scale-95"
              aria-label="Đối tác tiếp theo"
            >
              <ChevronRight className="w-5 h-5 translate-x-0.5" />
            </button>
          </motion.div>

          {/* Bottom Trust Badge */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-8 sm:mt-9 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs sm:text-[13px] font-medium text-slate-500 dark:text-slate-400"
          >
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Hàng hóa chính hãng</span>
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-zinc-700 hidden sm:inline-block" />
            <span>Nguồn cung ổn định</span>
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-zinc-700 hidden sm:inline-block" />
            <span>Dịch vụ chuyên nghiệp</span>
          </motion.div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. PRODUCT CATEGORIES (4-COLUMN GRID)                                     */}
      {/* ========================================================================= */}
      <section id="categories" className="py-16 sm:py-24 bg-white/70 dark:bg-zinc-950/60 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800 relative scroll-mt-20">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 sm:mb-12 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="space-y-3"
            >
              {/* Badge "— SẢN PHẨM NỔI BẬT" */}
              <div className="flex items-center gap-2">
                <span className="w-5 sm:w-6 h-[2.5px] bg-emerald-500 rounded-full inline-block" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-mono">
                  SẢN PHẨM NỔI BẬT
                </span>
              </div>

              {/* Title with vertical left blue border */}
              <div className="border-l-[3.5px] border-[#1E88E5] pl-4 sm:pl-5">
                <h2 className="text-2xl sm:text-3xl lg:text-[2.2rem] font-extrabold tracking-tight text-[#0F172A] dark:text-white leading-[1.25]">
                  Những thứ gia đình bạn cần mỗi ngày,<br className="hidden sm:inline" />
                  chỉ cách đúng <span className="text-[#1976D2] dark:text-sky-400 font-black">một nút bấm</span>.
                </h2>
                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-2 font-normal">
                  Không cần điện thoại, không cần tìm kiếm — Chạm là giao tới cửa nhà.
                </p>
              </div>
            </motion.div>

            {/* "Xem tất cả sản phẩm →" link */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="shrink-0"
            >
              <Link
                to="/shop"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[#1976D2] hover:text-blue-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors"
              >
                <span>Xem tất cả sản phẩm</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1.5 duration-200" />
              </Link>
            </motion.div>
          </div>

          {/* Sản phẩm thật từ cửa hàng */}
          {productsLoading && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-7">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-96 animate-pulse rounded-2xl bg-slate-100 dark:bg-zinc-900" />)}
          </div>}
          {!productsLoading && storefrontProducts.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900">Hiện chưa có sản phẩm đang bán. Vui lòng thêm sản phẩm trong trang quản lý cửa hàng.</div>}
          {!productsLoading && storefrontProducts.length > 0 && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-7">
            {storefrontProducts.slice(0, 8).map((product, index) => {
              const isSelected = addedProductId === product.id;
              const stock = Math.max(0, Number(product.stock || 0) - Number(product.reservedStock || 0));

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 35 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -8 }}
                  className="group rounded-2xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/90 p-4 sm:p-4.5 flex flex-col justify-between shadow-xs hover:shadow-xl hover:shadow-slate-200/70 dark:hover:shadow-black/50 hover:border-slate-300 dark:hover:border-zinc-700 transition-all duration-300 relative"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(product)}
                    className="block w-full text-left group/link cursor-pointer focus:outline-none"
                    aria-label={`Xem chi tiết ${product.name}`}
                  >
                    {/* Image Area with 4:3 Aspect Ratio, Floating Badge, and Zoom on Hover */}
                    <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden mb-3.5 bg-slate-100 dark:bg-zinc-800">
                      {product.imageUrl ? <StorefrontProductImage src={product.imageUrl} alt={product.name} /> : <div className="grid h-full place-items-center text-5xl">🛍️</div>}

                      {/* Top-Left Floating Badge */}
                      <div className="absolute top-3 left-3 z-10">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-md border shadow-2xs ${product.badgeStyle}`}>
                          <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{product.store?.name || 'Đang bán'}</span>
                        </span>
                      </div>

                      {/* Subtle Dark Bottom Gradient for Image Contrast */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    </div>

                    {/* Title & Price on the Same Row */}
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <h3 className="text-base font-bold text-[#0F172A] dark:text-white tracking-tight group-hover:text-[#1976D2] dark:group-hover:text-sky-400 transition-colors">
                        {product.name}
                      </h3>
                      <span className="text-sm sm:text-base font-bold font-mono text-[#1976D2] dark:text-sky-400 shrink-0">
                        {Number(product.price).toLocaleString('vi-VN')} ₫
                      </span>
                    </div>

                    {/* Product Description */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed min-h-[36px] line-clamp-2">
                      {product.brand || product.unit || product.category}
                      <span className="mt-1 block text-[11px] text-slate-400">Còn {stock}</span>
                    </p>
                  </button>

                  {/* Card Button */}
                  <div className="pt-4 mt-2">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => addProductToCart(product)}
                      disabled={stock <= 0}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 shadow-xs hover:shadow-md ${
                        isSelected
                          ? 'bg-[#EAF4F9] text-[#287DA8] border border-[#287DA8]/30'
                          : 'bg-[#EAF4F9] text-[#287DA8] border border-[#287DA8]/30 hover:bg-[#D8EDF6]'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-4 h-4 animate-scale-in" />
                          <span>Đã thêm vào giỏ</span>
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" />
                          <span>{stock > 0 ? 'Thêm vào giỏ' : 'Hết hàng'}</span>
                        </>
                      )}
                    </motion.button>
                    <Link
                      to="/shop?cart=open"
                      onClick={() => {
                        addProductToCart(product);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#287DA8] py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#206588]"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Mua ngay
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>}

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. SMART ORDER BUTTON PARTNER CTA SECTION (EDITORIAL PRODUCT-LED B2B)    */}
      {/* ========================================================================= */}
      <section
        id="enterprise"
        className="py-20 sm:py-28 bg-[#F6F8FA] dark:bg-zinc-950 border-t border-[#E5EAF0] dark:border-zinc-800 relative overflow-hidden scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">

            {/* Left Column — Business proposition */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-5 space-y-6 text-left"
            >
              {/* Eyebrow */}
              <div className="flex items-center gap-2.5">
                <motion.span
                  initial={{ width: 0 }}
                  whileInView={{ width: 32 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="h-[3px] bg-[#4AA785] rounded-full inline-block"
                />
                <span className="text-xs font-bold uppercase tracking-wider text-[#687586] dark:text-slate-400 font-mono">
                  DÀNH CHO ĐẠI LÝ & DOANH NGHIỆP CUNG ỨNG
                </span>
              </div>

              {/* Main Headline */}
              <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-bold tracking-tight text-[#172234] dark:text-white leading-[1.2]">
                Biến đơn hàng lặp lại<br />
                thành lợi thế kinh doanh.
              </h2>

              {/* Supporting Text */}
              <p className="text-base text-[#687586] dark:text-slate-400 leading-relaxed max-w-xl font-normal">
                Kết nối khách hàng thân thiết với nút bấm đặt hàng vật lý. Tiếp nhận nhu cầu thường xuyên, quản lý đơn và phối hợp giao hàng trên một quy trình rõ ràng.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Link
                    to="/register"
                    className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#287DA8] hover:bg-[#206588] text-white font-semibold text-sm transition-all shadow-xs hover:shadow-md active:scale-[0.98] inline-flex items-center justify-center gap-2 group"
                  >
                    <span>Trở thành đối tác</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 duration-200" />
                  </Link>
                </motion.div>

                <Link
                  to="/login"
                  className="inline-flex items-center justify-center sm:justify-start gap-1.5 text-sm font-semibold text-[#287DA8] hover:text-[#172234] dark:text-sky-400 dark:hover:text-white transition-colors group py-2"
                >
                  <span>Cổng đại lý</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 duration-200" />
                </Link>
              </div>
            </motion.div>

            {/* Right Column — Real product context & Supporting process */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-7 flex flex-col space-y-6"
            >
              {/* Product Visual Showcase */}
              <div className="relative rounded-2xl overflow-hidden border border-[#E5EAF0] dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm group">
                <img
                  src="/assets/partner-cta-showcase.jpg"
                  alt="Hệ thống Smart Order Button và hộp giao hàng nhu yếu phẩm"
                  className="w-full aspect-[16/9] object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                  loading="lazy"
                />

                {/* Subtle Clean Product Tag */}
                <div className="absolute top-3.5 right-3.5 z-10 pointer-events-none">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-white/90 dark:bg-zinc-900/90 text-[#172234] dark:text-white border border-[#E5EAF0] dark:border-zinc-800 backdrop-blur-md shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4AA785]" />
                    <span>Hệ thống IoT thực tế</span>
                  </span>
                </div>
              </div>

              {/* Supporting Process (3 Steps) */}
              <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-[#E5EAF0] dark:border-zinc-800/90 p-4 sm:p-5 shadow-2xs">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-2">
                  
                  {/* Step 01 */}
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="flex items-center gap-3 w-full sm:w-auto group cursor-default"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#EAF4F9] dark:bg-sky-950/60 text-[#287DA8] dark:text-sky-400 border border-[#287DA8]/20 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                      <MousePointerClick className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#172234] dark:text-white">
                        Tiếp nhận đơn
                      </p>
                      <p className="text-[11px] text-[#687586] dark:text-slate-400">
                        Khách bấm nút tại nhà
                      </p>
                    </div>
                  </motion.div>

                  {/* Separator 1 */}
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="hidden sm:block flex-1 max-w-[50px] lg:max-w-[70px] h-px bg-[#E5EAF0] dark:bg-zinc-800 origin-left"
                  />

                  {/* Step 02 */}
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="flex items-center gap-3 w-full sm:w-auto group cursor-default"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#E9F7F2] dark:bg-emerald-950/60 text-[#4AA785] dark:text-emerald-400 border border-[#4AA785]/20 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                      <Cog className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#172234] dark:text-white">
                        Xử lý
                      </p>
                      <p className="text-[11px] text-[#687586] dark:text-slate-400">
                        Trạm phân phối chuẩn bị
                      </p>
                    </div>
                  </motion.div>

                  {/* Separator 2 */}
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="hidden sm:block flex-1 max-w-[50px] lg:max-w-[70px] h-px bg-[#E5EAF0] dark:bg-zinc-800 origin-left"
                  />

                  {/* Step 03 */}
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="flex items-center gap-3 w-full sm:w-auto group cursor-default"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#EAF4F9] dark:bg-sky-950/60 text-[#287DA8] dark:text-sky-400 border border-[#287DA8]/20 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#172234] dark:text-white">
                        Giao hàng
                      </p>
                      <p className="text-[11px] text-[#687586] dark:text-slate-400">
                        Giao tận cửa & đổi vỏ
                      </p>
                    </div>
                  </motion.div>

                </div>
              </div>

            </motion.div>

          </div>
        </div>
      </section>

    </div>
  );
};
