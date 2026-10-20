import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, Minus, Plus, Search, ShoppingBag, ShoppingCart, Store, Trash2, Truck, X } from 'lucide-react';
import { api } from '../../services/api';

const deliveryHeroBackground = '/assets/products/delivery-hero-pastel.png';

type Product = { id: string; storeId: string; name: string; brand: string; category: string; unit: string; price: number; stock: number; reservedStock: number; imageUrl?: string; store: { id: string; name: string } };
type CartLine = { product: Product; quantity: number };
const CART_KEY = 'sob_storefront_cart_v1';
const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);

export const ShopPage: React.FC = () => {
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>(() => { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; } });
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('search') || '';
    }
    return '';
  });
  const [category, setCategory] = useState('Tất cả');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [flyingProduct, setFlyingProduct] = useState<{ product: Product; x: number; y: number } | null>(null);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', deliveryAddress: '', paymentMethod: 'PAYOS' });
  const [cartBump, setCartBump] = useState(false);

  useEffect(() => { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }, [cart]);

  const scrollToCatalog = () => {
    const catalogElement = document.getElementById('storefront-catalog');
    if (!catalogElement) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const headerOffset = 76;
    const elementPosition = catalogElement.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
    window.scrollTo({
      top: offsetPosition,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get('search');
    if (searchParam !== null) {
      setSearch(searchParam);
      const timer = setTimeout(() => {
        scrollToCatalog();
      }, 150);
      return () => clearTimeout(timer);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    const status = params.get('payos_status');
    if (params.get('cart') === 'open') setCartOpen(true);
    if (status === 'success') setNotice('PayOS đã chuyển bạn trở lại. Trạng thái thanh toán đang được xác nhận từ PayOS.');
    if (status === 'cancelled') setNotice('Bạn đã hủy thanh toán PayOS. Bạn có thể thử lại hoặc chọn thanh toán khi nhận hàng.');
  }, [location.search]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get('/products/storefront/catalog', { params: { search: search.trim() || undefined } })
      .then(({ data }) => { if (active) setProducts(data.data || []); })
      .catch(() => { if (active) setError('Không tải được sản phẩm. Vui lòng thử lại sau.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search]);

  const categories = useMemo(() => ['Tất cả', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))], [products]);
  const shownProducts = products.filter((p) => category === 'Tất cả' || p.category === category);
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const total = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const cartStore = cart[0]?.product.storeId;
  const changeQuantity = (product: Product, delta: number) => setCart((old) => {
    const line = old.find((item) => item.product.id === product.id);
    if (!line && delta > 0) return [...old, { product, quantity: 1 }];
    return old.map((item) => item.product.id === product.id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter((item) => item.quantity > 0);
  });
  const removeCartItem = (productId: string) => setCart((old) => old.filter((item) => item.product.id !== productId));
  const buyNow = (product: Product) => {
    changeQuantity(product, 1);
    setCartOpen(true);
  };
  const addWithAnimation = (product: Product, event: React.MouseEvent<HTMLButtonElement>) => {
    changeQuantity(product, 1);
    setFlyingProduct({ product, x: event.clientX, y: event.clientY });
    setCartBump(true);
    setTimeout(() => setCartBump(false), 400);
  };

  const checkout = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cart.length) return;
    if (cart.some((line) => line.product.storeId !== cartStore)) { setNotice('Mỗi đơn hàng chỉ gồm sản phẩm của một cửa hàng.'); return; }
    setBusy(true); setNotice('');
    try {
      const response = await api.post('/storefront/orders', {
        storeId: cartStore, items: cart.map(({ product, quantity }) => ({ productId: product.id, quantity })), ...form,
      });
      const order = response.data.data;
      if (form.paymentMethod === 'PAYOS') {
        const payment = await api.post('/payments/payos/create-link', { orderId: order.id, amount: order.totalAmount, buyerName: form.customerName, buyerPhone: form.customerPhone, returnUrl: `${window.location.origin}/shop?payos_status=success&orderId=${encodeURIComponent(order.id)}`, cancelUrl: `${window.location.origin}/shop?payos_status=cancelled&orderId=${encodeURIComponent(order.id)}` });
        const checkoutUrl = payment.data?.data?.checkoutUrl;
        if (checkoutUrl) { localStorage.removeItem(CART_KEY); window.location.assign(checkoutUrl); return; }
        throw new Error('PayOS chưa trả về liên kết thanh toán.');
      }
      setCart([]); setCheckoutOpen(false); setCartOpen(false);
      setNotice(`Đặt hàng thành công! Mã đơn ${order.orderNumber}. Thanh toán tiền mặt khi nhận hàng.`);
    } catch (e: any) {
      setNotice(e?.response?.data?.message || e?.message || 'Đặt hàng chưa thành công. Vui lòng thử lại.');
    } finally { setBusy(false); }
  };

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="min-h-screen bg-[#f7f8fa] text-slate-900"
    >
    {flyingProduct && <motion.div
      key={`${flyingProduct.product.id}-${flyingProduct.x}-${flyingProduct.y}`}
      initial={{ left: flyingProduct.x - 24, top: flyingProduct.y - 24, opacity: 1, scale: 1 }}
      animate={{ left: 'calc(100% - 64px)', top: 22, opacity: 0.15, scale: 0.25, rotate: 360 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => setFlyingProduct(null)}
      className="pointer-events-none fixed z-[100] h-12 w-12 overflow-hidden rounded-xl border-2 border-[#287DA8] bg-white shadow-xl"
    >
      {flyingProduct.product.imageUrl ? <img src={flyingProduct.product.imageUrl} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-xl">🛍️</span>}
    </motion.div>}
    {/* Full-Bleed / Edge-to-Edge Hero Banner */}
    <section
      className="relative w-full overflow-hidden border-b border-sky-100/70 bg-[#eaf7f8] bg-cover bg-[center_right] sm:bg-center bg-no-repeat"
      style={{ backgroundImage: `url("${deliveryHeroBackground}")` }}
    >
      {/* Subtle Gradient Overlay: Soft pastel-tinted on left, smoothly transparent on right to reveal illustration */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#eaf7f8]/98 via-[#eaf7f8]/85 to-transparent sm:from-[#eaf7f8]/95 sm:via-[#eaf7f8]/75 sm:to-transparent lg:w-[68%]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative z-10 flex min-h-[340px] items-center py-10 sm:min-h-[380px] sm:py-14 lg:min-h-[420px] lg:py-16">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.1, delayChildren: 0.05 },
              },
            }}
            className="max-w-[580px]"
          >
            {/* Label */}
            <motion.p
              variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } }}
              className="mb-3 flex items-center gap-2 text-xs font-bold tracking-[0.15em] text-[#0E6BA8] uppercase"
            >
              <ShoppingBag size={15} className="shrink-0" />
              <span>CỬA HÀNG TRỰC TUYẾN</span>
            </motion.p>

            {/* Headline */}
            <motion.h1
              variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
              className="text-3xl font-bold tracking-tight text-[#0c2340] sm:text-4xl lg:text-[44px] leading-[1.15] sm:leading-[1.18]"
            >
              Mua sắm dễ dàng, giao tận nhà
            </motion.h1>

            {/* Description */}
            <motion.p
              variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }}
              className="mt-3 text-base leading-relaxed text-slate-600 sm:mt-4 sm:text-lg sm:leading-relaxed"
            >
              Hàng thiết yếu từ các cửa hàng đối tác, đặt mua nhanh chóng chỉ trong vài bước.
            </motion.p>

            {/* Actions: Primary CTA + Secondary Benefit */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }}
              className="mt-6 flex flex-wrap items-center gap-4 sm:mt-8 sm:gap-6"
            >
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={scrollToCatalog}
                className="group inline-flex items-center gap-2 rounded-xl bg-[#287DA8] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#1e688e] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#287DA8]/50 focus:ring-offset-2 sm:px-6 sm:py-3.5 sm:text-base"
              >
                <span>Khám phá sản phẩm</span>
                <ArrowRight
                  size={18}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </motion.button>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex items-center gap-2 text-xs font-medium text-slate-600 sm:text-sm"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-100/90 text-[#287DA8]">
                  <Truck size={16} />
                </span>
                <span>Giao hàng tận nơi</span>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>

    <section id="storefront-catalog" className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Sản phẩm dành cho bạn</h2>
          <p className="mt-1 text-sm text-slate-500">Giá và tình trạng hàng được cập nhật từ cửa hàng.</p>
        </div>
        <div className="flex gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition focus-within:border-[#287DA8] focus-within:ring-2 focus-within:ring-[#287DA8]/10 sm:w-72">
            <Search size={18} className="shrink-0 text-slate-400"/>
            <input
              aria-label="Tìm sản phẩm"
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Tìm sản phẩm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Xóa bộ lọc tìm kiếm"
              >
                <X size={16} />
              </button>
            )}
          </label>
          <motion.button
            animate={cartBump ? { scale: [1, 1.15, 0.95, 1.05, 1] } : {}}
            transition={{ duration: 0.35 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCartOpen(true)}
            className="relative flex shrink-0 items-center gap-2 rounded-xl bg-[#287DA8] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#206588]"
          >
            <ShoppingCart size={18}/>
            <span>Giỏ hàng</span>
            {cartCount > 0 && (
              <motion.span
                key={cartCount}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[#E53E3E] px-1 text-[11px] font-bold text-white shadow-xs"
              >
                {cartCount}
              </motion.span>
            )}
          </motion.button>
        </div>
      </div>

      <div className="mb-5 flex gap-2 overflow-auto pb-1">
        {categories.map((item) => (
          <motion.button
            key={item}
            layout
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onClick={() => setCategory(item)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              category === item
                ? 'bg-[#287DA8] text-white shadow-xs'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-[#287DA8] hover:ring-sky-300'
            }`}
          >
            {item}
          </motion.button>
        ))}
      </div>
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mb-5 flex items-start justify-between gap-3 overflow-hidden rounded-xl border border-teal-200 bg-[#EAF4F9] p-4 text-sm text-teal-900"
          >
            <span>{notice}</span>
            <button onClick={() => setNotice('')} aria-label="Đóng thông báo" className="text-teal-700 hover:text-teal-900">
              <X size={17}/>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {error && <div className="rounded-2xl bg-white p-10 text-center text-sm text-rose-600">{error}</div>}
      {loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-white/80 border border-slate-100 shadow-xs" />
          ))}
        </div>
      )}
      {!loading && !error && shownProducts.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl bg-white p-12 text-center text-slate-500 shadow-xs border border-slate-100"
        >
          <span className="text-4xl block mb-2">🔍</span>
          Chưa có sản phẩm phù hợp.
        </motion.div>
      )}
      {!loading && shownProducts.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{shownProducts.map((product) => {
        const line = cart.find((item) => item.product.id === product.id);
        const stock = Math.max(0, product.stock - product.reservedStock);
        return <article key={product.id} className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="relative aspect-square bg-slate-50">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover transition group-hover:scale-[1.03]"/> : <div className="grid h-full place-items-center text-5xl">🛍️</div>}<span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600"><Store className="mr-1 inline" size={12}/>{product.store.name}</span></div>
          <div className="p-3 sm:p-4"><p className="truncate text-[11px] font-semibold uppercase tracking-wide text-teal-700">{product.category}</p><h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold">{product.name}</h3><p className="mt-1 truncate text-xs text-slate-500">{product.brand || product.unit}</p><div className="mt-3 flex items-end justify-between gap-2"><div><p className="text-base font-bold text-[#287DA8]">{money(product.price)}</p><p className="text-[11px] text-slate-400">Còn {stock} {product.unit || 'sản phẩm'}</p></div><button type="button" onClick={() => buyNow(product)} disabled={!stock} className="mt-2 w-auto shrink-0 rounded-lg border bg-[#287DA8] px-2 py-1.5 text-xs font-semibold text-white hover:bg-[#206588] disabled:cursor-not-allowed disabled:opacity-40">Mua ngay</button>{line ? <div className="flex items-center gap-2 rounded-lg bg-[#EAF4F9] p-1"><button onClick={() => changeQuantity(product,-1)} className="grid h-7 w-7 place-items-center rounded-md text-[#287DA8] hover:bg-white"><Minus size={15}/></button><span className="min-w-4 text-center text-sm font-semibold">{line.quantity}</span><button disabled={line.quantity >= stock} onClick={() => changeQuantity(product,1)} className="grid h-7 w-7 place-items-center rounded-md text-[#287DA8] hover:bg-white disabled:opacity-40"><Plus size={15}/></button></div> : <button disabled={!stock || (!!cartStore && cartStore !== product.storeId)} title={cartStore && cartStore !== product.storeId ? 'Hoàn tất giỏ hiện tại trước khi chọn cửa hàng khác' : ''} onClick={(event) => addWithAnimation(product, event)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#287DA8] text-white hover:bg-[#206588] disabled:cursor-not-allowed disabled:bg-slate-300"><Plus size={18}/></button>}</div></div>
        </article>;
      })}</div>}
      <p className="mt-8 text-center text-xs text-slate-400">Bạn có thể xem sản phẩm mà không cần tài khoản. Đơn hàng trực tuyến sẽ được gửi trực tiếp đến cửa hàng bán sản phẩm.</p>
    </section>

    {/* Cart Drawer */}
    <AnimatePresence>
      {cartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            onClick={() => setCartOpen(false)}
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-lg font-bold">Giỏ hàng</h2>
                <p className="text-xs text-slate-500">{cartCount} sản phẩm</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.2 }}
                onClick={() => setCartOpen(false)}
                aria-label="Đóng giỏ hàng"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </motion.button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              {cart.length === 0 ? (
                <div className="py-16 text-center">
                  <span className="text-5xl">🛍️</span>
                  <p className="mt-3 text-sm text-slate-500">Giỏ hàng của bạn đang trống.</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {cart.map(({ product, quantity }) => (
                    <motion.div
                      layout
                      key={product.id}
                      initial={{ opacity: 0, height: 0, y: 15 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, x: -30 }}
                      transition={{ duration: 0.25 }}
                      className="flex gap-3 border-b py-4"
                    >
                      <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-50 border border-slate-100">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          '🛍️'
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.store.name}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <b className="text-sm text-[#287DA8]">{money(product.price * quantity)}</b>
                          <div className="flex items-center gap-2">
                            <motion.button
                              whileTap={{ scale: 0.8 }}
                              onClick={() => changeQuantity(product, -1)}
                              className="grid h-6 w-6 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
                            >
                              <Minus size={14} />
                            </motion.button>
                            <span className="text-sm font-medium min-w-4 text-center">{quantity}</span>
                            <motion.button
                              whileTap={{ scale: 0.8 }}
                              onClick={() => changeQuantity(product, 1)}
                              className="grid h-6 w-6 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
                            >
                              <Plus size={14} />
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.8 }}
                              onClick={() => removeCartItem(product.id)}
                              aria-label={`Xóa ${product.name}`}
                              title="Xóa sản phẩm"
                              className="ml-1 grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 size={15} />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            <div className="border-t p-5 bg-slate-50/50">
              <div className="mb-4 flex justify-between text-sm">
                <span className="text-slate-600">Tổng cộng</span>
                <b className="text-lg text-[#287DA8]">{money(total)}</b>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={!cart.length}
                onClick={() => setCheckoutOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#287DA8] py-3 font-semibold text-white shadow-sm transition hover:bg-[#206588] disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                Tiến hành đặt hàng <ArrowRight size={17} />
              </motion.button>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="mt-3 w-full text-center text-xs text-slate-400 hover:text-rose-600 transition-colors"
                >
                  Xóa toàn bộ giỏ
                </button>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>

    {/* Checkout Modal */}
    <AnimatePresence>
      {checkoutOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center overflow-auto p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => !busy && setCheckoutOpen(false)}
          />

          <motion.form
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            onSubmit={checkout}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 my-auto w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-7 border border-slate-100"
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Thông tin giao hàng</h2>
                <p className="mt-1 text-sm text-slate-500">Đơn hàng từ {cart[0]?.product.store.name}</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.2 }}
                type="button"
                onClick={() => setCheckoutOpen(false)}
                aria-label="Đóng"
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </motion.button>
            </div>

            <div className="space-y-3">
              <input
                required
                maxLength={100}
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                placeholder="Họ và tên người nhận"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
              />
              <input
                required
                type="tel"
                maxLength={20}
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                placeholder="Số điện thoại"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
              />
              <textarea
                required
                maxLength={500}
                value={form.deliveryAddress}
                onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
                placeholder="Địa chỉ nhận hàng"
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10"
              />
            </div>

            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-slate-800">Phương thức thanh toán</p>
              <motion.label
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`mb-2 flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                  form.paymentMethod === 'PAYOS' ? 'border-teal-600 bg-[#EAF4F9]' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={form.paymentMethod === 'PAYOS'}
                  onChange={() => setForm({ ...form, paymentMethod: 'PAYOS' })}
                  className="accent-[#287DA8]"
                />
                <span>
                  <b className="block text-sm text-slate-900">Thanh toán trực tuyến PayOS</b>
                  <small className="text-slate-500">Chuyển đến cổng thanh toán bảo mật</small>
                </span>
              </motion.label>
              <motion.label
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                  form.paymentMethod === 'CASH_ON_DELIVERY' ? 'border-teal-600 bg-[#EAF4F9]' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={form.paymentMethod === 'CASH_ON_DELIVERY'}
                  onChange={() => setForm({ ...form, paymentMethod: 'CASH_ON_DELIVERY' })}
                  className="accent-[#287DA8]"
                />
                <span>
                  <b className="block text-sm text-slate-900">Tiền mặt khi nhận hàng</b>
                  <small className="text-slate-500">Thanh toán cho shipper khi giao hàng</small>
                </span>
              </motion.label>
            </div>

            <div className="mt-5 flex justify-between border-t pt-4 text-sm">
              <span className="text-slate-600">Tổng thanh toán</span>
              <b className="text-lg text-[#287DA8]">{money(total)}</b>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={busy}
              className="mt-4 w-full rounded-xl bg-[#287DA8] py-3 font-bold text-white shadow-sm transition hover:bg-[#206588] disabled:opacity-60"
            >
              {busy ? 'Đang xử lý...' : 'Xác nhận đặt hàng'}
            </motion.button>
            <p className="mt-3 flex items-center justify-center gap-1 text-center text-[11px] text-slate-400">
              <CheckCircle2 size={13} className="text-teal-600" />
              Thông tin đơn hàng được gửi an toàn đến cửa hàng
            </p>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  </motion.main>
  );
};
