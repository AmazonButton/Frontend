import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from 'framer-motion';
import { Play, Pause, Volume2, VolumeX, ArrowRight, ShieldCheck, Zap, Battery, CheckCircle2, ShoppingCart, Search, Droplets, Star, Shield, Check, Sparkles, MousePointerClick, SearchX, Cog, Truck, ChevronLeft, ChevronRight, X } from 'lucide-react';
import './landing-ui.css';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { subscribeCatalogChanges } from '../services/catalog-sync';
import { toast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

/**
 * Store owners can upload PNG cut-outs with a large transparent canvas around
 * the product. `object-cover` then crops the actual product out of the card.
 * Trim transparent borders in the browser before displaying data-URL images.
 */
const StorefrontProductImage: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className = 'w-full h-full object-contain' }) => {
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

const getInitialStorefrontCatalog = (): any[] => {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem('sob_cached_catalog_v1') || window.localStorage?.getItem?.('sob_cached_catalog_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch {}
  return [];
};

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  // Video player controls state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [addedProductId, setAddedProductId] = useState<string | null>(null);
  const cachedCatalog = getInitialStorefrontCatalog();
  const [storefrontProducts, setStorefrontProducts] = useState<any[]>(cachedCatalog);
  const [productsLoading, setProductsLoading] = useState(cachedCatalog.length === 0);
  const [cartCount, setCartCount] = useState(0);
  const [cartPulse, setCartPulse] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const brandScrollRef = useRef<HTMLDivElement>(null);
  const catalogRequest = useRef(0);

  const fetchStorefrontProducts = () => {
    const request = ++catalogRequest.current;
    api.get('/products/storefront/catalog')
      .then(({ data }) => {
        if (request !== catalogRequest.current) return;
        const list = (data.data || []).map((p: any) => ({
          ...p,
          category: typeof p.category === 'object' && p.category !== null
            ? (p.category.categoryName || p.category.name || 'Nhu yếu phẩm')
            : (typeof p.category === 'string' ? p.category : 'Nhu yếu phẩm'),
        }));
        setStorefrontProducts(list);
        try {
          if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.setItem('sob_cached_catalog_v1', JSON.stringify(list));
            window.localStorage?.setItem?.('sob_cached_catalog_v1', JSON.stringify(list));
          }
        } catch {}
      })
      .catch(() => { /* Keep the last loaded catalog during a transient failure. */ })
      .finally(() => { if (request === catalogRequest.current) setProductsLoading(false); });
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

    return subscribeCatalogChanges(socket, handleProductChange);
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
      brandScrollRef.current.scrollBy({ left: -260, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  };

  const scrollBrandsRight = () => {
    if (brandScrollRef.current) {
      brandScrollRef.current.scrollBy({ left: 260, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
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

  const submitProductSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = productSearch.trim();
    navigate(query ? `/shop?search=${encodeURIComponent(query)}` : '/shop');
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="landing-home min-h-screen bg-transparent text-slate-900 dark:text-slate-100 selection:bg-[#0F172A] selection:text-white font-sans antialiased relative">

      {/* ========================================================================= */}
      {/* 2. HERO SECTION (SIDE-BY-SIDE SPLIT - No wasted vertical space)           */}
      {/* ========================================================================= */}
      <section
        id="features"
        className="landing-hero w-full pt-20 pb-8 sm:pt-24 sm:pb-12 lg:pt-28 lg:pb-16 relative scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-center">

            {/* Left Column (Text & CTA) */}
            <div className="lg:col-span-6 space-y-4 sm:space-y-6 text-left">
              {/* Refined Deliberate Two-Line Headline */}
              <motion.h1 initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }} className="text-[2.3rem] sm:text-5xl lg:text-[3.1rem] xl:text-[3.55rem] font-bold tracking-tight leading-[1.1] max-w-[620px]">
                <span className="block text-[#172234] dark:text-white">
                  Một nút bấm vật lý.
                </span>
                <span className="block mt-2 sm:mt-2.5 text-[#287DA8] dark:text-sky-400">
                  Đặt đúng thứ bạn cần.
                </span>
              </motion.h1>

              {/* Concise Supporting Description */}
              <motion.p initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.07, ease: [0.22, 1, 0.36, 1] }} className="text-[15px] sm:text-base lg:text-[17px] leading-[1.65] text-[#687586] dark:text-slate-300 max-w-[510px] font-normal">
                Nước uống, gas, gạo và nhu yếu phẩm gia đình — đặt hàng chỉ bằng một lần nhấn.
                <span className="mt-2 block text-sm leading-relaxed text-slate-600 dark:text-slate-300">Mua trực tiếp trên website hoặc đặt lại hàng nhanh bằng nút bấm thông minh.</span>
              </motion.p>

              {/* Two CTA Buttons */}
              <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.14, ease: [0.22, 1, 0.36, 1] }} className="flex flex-wrap items-center gap-3.5 pt-1">
                <Link
                  to={user ? '/quick-setup' : '/login'}
                  state={user ? undefined : { message: 'Vui lòng đăng nhập để bắt đầu đặt hàng.' }}
                  className="inline-flex min-h-12 items-center justify-center px-7 rounded-lg bg-[#287DA8] hover:bg-[#206588] text-white font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] focus-visible:ring-offset-2"
                >
                  Đặt thử ngay
                </Link>
                <a
                  href="#categories"
                  className="inline-flex min-h-12 items-center justify-center px-6 rounded-lg bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-[#172234] dark:text-white hover:text-[#287DA8] dark:hover:text-sky-400 font-semibold text-sm border border-slate-300 dark:border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8]/50 focus-visible:ring-offset-2"
                >
                  Khám phá
                </a>
              </motion.div>

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
            <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }} className="lg:col-span-6 w-full flex items-center justify-center">
              <div className="w-full max-w-[560px] mx-auto">
                <div
                  onClick={togglePlay}
                  className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-950 shadow-[0_12px_28px_rgba(15,23,42,0.12)]"
                >
                  <video
                    ref={videoRef}
                    role="button"
                    tabIndex={0}
                    aria-label={isPlaying ? 'Tạm dừng video' : 'Phát video'}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        togglePlay();
                      }
                    }}
                    src="/assets/TIKTOK.mp4"
                    autoPlay
                    loop
                    muted={isMuted}
                    playsInline
                    preload="metadata"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    className="w-full aspect-[16/9] object-cover block"
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
                      className="grid min-h-11 min-w-11 place-items-center p-2.5 rounded-full backdrop-blur-md bg-black/50 hover:bg-black/70 text-white border border-white/20 transition-colors active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
                <div className="flex items-center justify-start mt-3 px-1 text-xs text-[#687586] dark:text-slate-400">
                  <span className="font-medium tracking-wide">Trải nghiệm đặt hàng thực tế</span>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] overflow-y-auto p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Chi tiết ${selectedProduct.name}`}>
            <motion.div initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={prefersReducedMotion ? undefined : { opacity: 0 }} className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
            <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }} transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }} className="relative mx-auto flex min-h-full max-w-4xl items-center">
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

      <section id="how-it-works" className="landing-how scroll-mt-20 border-y border-slate-200/80 bg-white/75 py-12 dark:border-zinc-800 dark:bg-zinc-950/50 sm:py-14" aria-labelledby="landing-how-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6 flex flex-col gap-2 sm:mb-7"
          >
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#287DA8] dark:text-sky-400">Cách hoạt động</p>
            <h2 id="landing-how-heading" className="text-2xl font-bold tracking-tight text-[#172234] dark:text-white sm:text-[1.8rem]">Một lần nhấn, đơn hàng theo đúng quy trình</h2>
          </motion.div>
          <ol aria-label="Ba bước hoạt động của SmartOrderButton" className="landing-how-timeline relative grid gap-0 md:grid-cols-3">
            <motion.li
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              className="landing-how-step relative grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-x-4 pb-6 last:pb-0 md:grid-cols-1 md:justify-items-center md:gap-x-0 md:pb-0 md:text-center"
            >
              <span className="landing-how-step-number relative z-10 grid h-12 w-12 place-items-center rounded-full border border-[#287DA8]/30 bg-white font-mono text-sm font-bold text-[#287DA8] dark:border-sky-400/30 dark:bg-zinc-900 dark:text-sky-400">01</span>
              <div className="pt-1 md:pt-0">
                <h3 className="flex min-h-7 items-center gap-2 text-[17px] font-semibold leading-snug text-[#172234] dark:text-white md:mt-4 md:justify-center md:text-lg"><MousePointerClick aria-hidden="true" className="h-6 w-6 shrink-0 text-[#287DA8] dark:text-sky-400" /><span>Tiếp nhận đơn</span></h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#687586] dark:text-slate-400 md:text-base">Khách bấm nút tại nhà</p>
              </div>
            </motion.li>
            <motion.li
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.36, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="landing-how-step relative grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-x-4 pb-6 last:pb-0 md:grid-cols-1 md:justify-items-center md:gap-x-0 md:pb-0 md:text-center"
            >
              <span className="landing-how-step-number relative z-10 grid h-12 w-12 place-items-center rounded-full border border-slate-300 bg-white font-mono text-sm font-bold text-slate-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-slate-300">02</span>
              <div className="pt-1 md:pt-0">
                <h3 className="flex min-h-7 items-center gap-2 text-[17px] font-semibold leading-snug text-[#172234] dark:text-white md:mt-4 md:justify-center md:text-lg"><Cog aria-hidden="true" className="h-6 w-6 shrink-0 text-[#287DA8] dark:text-sky-400" /><span>Xử lý</span></h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#687586] dark:text-slate-400 md:text-base">Trạm phân phối chuẩn bị</p>
              </div>
            </motion.li>
            <motion.li
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.36, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="landing-how-step relative grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-x-4 pb-6 last:pb-0 md:grid-cols-1 md:justify-items-center md:gap-x-0 md:pb-0 md:text-center"
            >
              <span className="landing-how-step-number relative z-10 grid h-12 w-12 place-items-center rounded-full border border-slate-300 bg-white font-mono text-sm font-bold text-slate-600 dark:border-zinc-600 dark:bg-zinc-900 dark:text-slate-300">03</span>
              <div className="pt-1 md:pt-0">
                <h3 className="flex min-h-7 items-center gap-2 text-[17px] font-semibold leading-snug text-[#172234] dark:text-white md:mt-4 md:justify-center md:text-lg"><Truck aria-hidden="true" className="h-6 w-6 shrink-0 text-[#287DA8] dark:text-sky-400" /><span>Giao hàng</span></h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#687586] dark:text-slate-400 md:text-base">Giao tận cửa & đổi vỏ</p>
              </div>
            </motion.li>
          </ol>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. SMART ORDER BUTTON PARTNER CTA SECTION (EDITORIAL PRODUCT-LED B2B)    */}
      {/* ========================================================================= */}
      <section id="partners" className="landing-partners scroll-mt-20 border-b border-slate-200/80 bg-white py-12 dark:border-zinc-800 dark:bg-zinc-950/40 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#287DA8] dark:text-sky-400">ĐỐI TÁC ĐỒNG HÀNH</p>
          <h2 className="mt-2 max-w-4xl text-2xl font-bold leading-tight tracking-tight text-[#172234] dark:text-white sm:text-[1.8rem]">
            Cùng các thương hiệu uy tín <span className="text-[#1B84D4] dark:text-sky-400">đưa nhu yếu phẩm đến mọi nhà.</span>
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-base">
            Smart Order Button hợp tác với các nhà cung cấp và đơn vị phân phối uy tín, đảm bảo nguồn hàng chất lượng, minh bạch và ổn định.
          </p>

          <div className="landing-partner-carousel mt-5 flex min-w-0 items-center gap-2 sm:mt-6 sm:gap-3">
            <button type="button" onClick={scrollBrandsLeft} aria-controls="partner-logo-carousel" aria-label="Cuộn danh sách đối tác sang trái" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-[#287DA8] hover:bg-slate-50 hover:text-[#287DA8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#287DA8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-300 dark:hover:bg-zinc-800">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div id="partner-logo-carousel" ref={brandScrollRef} role="list" aria-label="Logo các đối tác" className="min-w-0 flex-1 overflow-x-auto no-scrollbar scroll-smooth py-1">
              <div className="flex w-max items-center gap-5 sm:gap-7">
                {PARTNER_BRANDS.map((brand) => (
                  <div key={brand.name} role="listitem" className="grid h-20 w-[132px] shrink-0 place-items-center px-2 sm:h-24 sm:w-[160px] sm:px-3">
                    <img src={brand.logo} alt={brand.alt} className="max-h-12 max-w-full object-contain sm:max-h-14" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
            <button type="button" onClick={scrollBrandsRight} aria-controls="partner-logo-carousel" aria-label="Cuộn danh sách đối tác sang phải" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-[#287DA8] hover:bg-slate-50 hover:text-[#287DA8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#287DA8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-300 dark:hover:bg-zinc-800">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-sm font-medium leading-5 text-slate-600 dark:text-slate-300 sm:mt-5">
            <span className="inline-flex items-center gap-2"><CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />Hàng hóa chính hãng</span>
            <span className="inline-flex items-center gap-2"><CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />Nguồn cung ổn định</span>
            <span className="inline-flex items-center gap-2"><CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />Dịch vụ chuyên nghiệp</span>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. PRODUCT CATEGORIES (4-COLUMN GRID)                                     */}
      {/* ========================================================================= */}
      <section id="categories" className="landing-products border-b border-slate-200/80 bg-[#F6F8FA] py-14 dark:border-zinc-800 dark:bg-zinc-950/60 sm:py-20 scroll-mt-20">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-5 sm:mb-7">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
              className="space-y-2"
            >
              <div>
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#287DA8] dark:text-sky-400">
                  SẢN PHẨM NỔI BẬT
                </span>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl lg:text-[2rem] font-bold tracking-tight text-[#0F172A] dark:text-white leading-[1.25]">
                  Những thứ gia đình bạn cần mỗi ngày,<br className="hidden sm:inline" />
                  chỉ cách đúng <span className="text-[#1976D2] dark:text-sky-400">một nút bấm</span>.
                </h2>
                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-2 font-normal">
                  Không cần điện thoại, không cần tìm kiếm — Chạm là giao tới cửa nhà.
                </p>
              </div>
            </motion.div>

            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <Link
                to="/shop"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="group inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#1976D2] transition-colors hover:bg-white hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#287DA8] dark:text-sky-400 dark:hover:bg-zinc-900 dark:hover:text-sky-300"
              >
                <span>Xem tất cả sản phẩm</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/shop?cart=open" className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-[#172234] transition-colors hover:border-[#287DA8] hover:text-[#287DA8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#287DA8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white ${cartPulse ? 'landing-cart-pulse' : ''}`}>
                <ShoppingCart aria-hidden="true" className="h-4 w-4" />Giỏ hàng ({cartCount})
              </Link>
            </div>
          </div>

          <div className="landing-product-tools mb-6 flex flex-col gap-2 sm:mb-7">
            <form onSubmit={submitProductSearch} role="search" aria-label="Tìm sản phẩm trong cửa hàng" className="flex min-h-12 w-full max-w-[34rem] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 transition-colors focus-within:border-[#287DA8] focus-within:ring-2 focus-within:ring-[#287DA8]/15 dark:border-zinc-700 dark:bg-zinc-900">
              <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" />
              <label className="sr-only" htmlFor="landing-product-search">Tìm sản phẩm</label>
              <input id="landing-product-search" name="search" type="search" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} aria-describedby="landing-search-help" placeholder="Tìm sản phẩm bạn cần..." className="min-h-11 min-w-0 flex-1 border-0 bg-transparent py-2 text-base text-slate-900 outline-none placeholder:text-slate-500 focus:ring-0 dark:text-white dark:placeholder:text-slate-400" />
              <button type="submit" className="inline-flex min-h-11 min-w-14 shrink-0 items-center justify-center rounded-md bg-[#287DA8] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#206588] active:bg-[#206588] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287DA8]">Tìm</button>
            </form>
            <p id="landing-search-help" className="text-[13px] leading-5 text-slate-600 dark:text-slate-400">Xem kết quả và chọn danh mục tại <Link to="/shop" className="font-semibold text-[#287DA8] underline underline-offset-2 hover:text-[#206588] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287DA8] dark:text-sky-400">Mua sắm</Link>.</p>
          </div>

          {/* Sản phẩm thật từ cửa hàng */}
          {productsLoading && <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-80 animate-pulse rounded-xl bg-slate-200/70 dark:bg-zinc-900" />)}
          </div>}
          {!productsLoading && storefrontProducts.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900">Hiện chưa có sản phẩm đang bán. Vui lòng thêm sản phẩm trong trang quản lý cửa hàng.</div>}
          {!productsLoading && storefrontProducts.length > 0 && <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {storefrontProducts.slice(0, 8).map((product) => {
              const isSelected = addedProductId === product.id;
              const stock = Math.max(0, Number(product.stock || 0) - Number(product.reservedStock || 0));

              return (
                <div
                  key={product.id}
                  className="landing-product-card group flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(product)}
                    className="flex w-full min-w-0 flex-1 flex-col text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#287DA8]"
                    aria-label={`Xem chi tiết ${product.name}`}
                  >
                    <div className="grid w-full aspect-[4/3] place-items-center overflow-hidden bg-slate-50 p-4 dark:bg-zinc-800/70">
                      {product.imageUrl ? <StorefrontProductImage src={product.imageUrl} alt={product.name} /> : <div className="grid h-full place-items-center text-5xl">🛍️</div>}
                    </div>
                    <div className="flex w-full min-w-0 flex-1 flex-col p-4 pb-2">
                      <h3 className="min-h-12 text-[15px] font-semibold leading-6 text-[#0F172A] dark:text-white">
                        {product.name}
                      </h3>
                      <span className="mt-1 text-lg font-bold tabular-nums text-[#1976D2] dark:text-sky-400">
                        {Number(product.price).toLocaleString('vi-VN')} ₫
                      </span>
                      <p className="mt-2 break-words text-[13px] leading-5 text-slate-600 dark:text-slate-300">{product.store?.name || 'Đang bán'}</p>
                      <p className="mt-1 break-words text-[13px] leading-5 text-slate-600 dark:text-slate-400">
                        {product.brand || product.unit || product.category}
                      </p>
                      <span className="mt-2 text-[13px] leading-5 text-slate-600 dark:text-slate-400">Còn {stock}</span>
                    </div>
                  </button>

                  <div className="grid gap-2 p-4 pt-2">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => addProductToCart(product)}
                      disabled={stock <= 0}
                      className={`min-h-11 w-full px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#287DA8] disabled:cursor-not-allowed disabled:opacity-50 ${
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
                          <ShoppingCart className="w-4 h-4" />
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
                      className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-[#287DA8] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#206588] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287DA8]"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Mua ngay
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>}

        </div>
      </section>

      <section
        id="enterprise"
        className="landing-business bg-[#F6F8FA] py-14 dark:bg-zinc-950 sm:py-20 scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

            {/* Left Column — Business proposition */}
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-5 space-y-5 text-left"
            >
              {/* Eyebrow */}
              <div className="flex items-center gap-2.5">
                <span className="h-[3px] w-8 bg-[#4AA785] rounded-full inline-block" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#687586] dark:text-slate-400 font-mono">
                  DÀNH CHO ĐẠI LÝ & DOANH NGHIỆP CUNG ỨNG
                </span>
              </div>

              {/* Main Headline */}
              <h2 className="text-[1.8rem] sm:text-3xl lg:text-[2.25rem] font-bold tracking-tight text-[#172234] dark:text-white leading-[1.2]">
                Biến đơn hàng lặp lại<br />
                thành lợi thế kinh doanh.
              </h2>

              {/* Supporting Text */}
              <p className="text-base text-[#687586] dark:text-slate-400 leading-relaxed max-w-xl font-normal">
                Kết nối khách hàng thân thiết với nút bấm đặt hàng vật lý. Tiếp nhận nhu cầu thường xuyên, quản lý đơn và phối hợp giao hàng trên một quy trình rõ ràng.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-5">
                <div>
                  <Link
                    to="/register"
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#287DA8] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#206588] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287DA8] sm:w-auto group"
                  >
                    <span>Trở thành đối tác</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 duration-200" />
                  </Link>
                </div>

                <Link
                  to="/login"
                  className="inline-flex min-h-12 items-center justify-center sm:justify-start gap-1.5 text-sm font-semibold text-[#287DA8] hover:text-[#172234] dark:text-sky-400 dark:hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#287DA8] group"
                >
                  <span>Cổng đại lý</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1 duration-200" />
                </Link>
              </div>
            </motion.div>

            {/* Right Column — Existing product image */}
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
              whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-7"
            >
              {/* Product Visual Showcase */}
              <div className="relative overflow-hidden rounded-xl border border-[#E5EAF0] bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <img
                  src="/assets/partner-cta-showcase.jpg"
                  alt="Hệ thống Smart Order Button và hộp giao hàng nhu yếu phẩm"
                  className="w-full aspect-[16/9] object-cover"
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

            </motion.div>

          </div>
        </div>
      </section>

    </div>
    </MotionConfig>
  );
};
