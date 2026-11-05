// @refresh reset
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Clock3,
  Calendar,
  ArrowRight,
  Check,
  Sparkles,
  RefreshCw,
  Layers,
  Truck,
  HelpCircle,
  ChevronRight,
  X,
  CreditCard,
  QrCode,
  MapPin,
  Phone,
  User,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Banknote,
  Zap,
  Plus,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../context/ToastContext';
import {
  rentalsService,
  RentalPackageItem,
  CustomerRentalContract,
} from '../../services/rentals.service';
import { subscribeRentalChannelEvents } from '../../services/rental-notifications';

export const CustomerRentalsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Tab: 'PACKAGES' | 'MY_RENTALS'
  const [activeTab, setActiveTab] = useState<'PACKAGES' | 'MY_RENTALS'>('PACKAGES');

  // Data states
  const [packages, setPackages] = useState<RentalPackageItem[]>([]);
  const [myRentals, setMyRentals] = useState<CustomerRentalContract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal checkout state
  const [selectedPackage, setSelectedPackage] = useState<RentalPackageItem | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [monthsRented, setMonthsRented] = useState<number>(3);
  const [deliveryAddress, setDeliveryAddress] = useState((user as any)?.address || '');
  const [recipientName, setRecipientName] = useState(user?.fullName || '');
  const [recipientPhone, setRecipientPhone] = useState(user?.phone || '');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'PAYOS' | 'COD'>('PAYOS');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment confirmation modal for pending contracts
  const [payingContract, setPayingContract] = useState<CustomerRentalContract | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Fetch packages and my rentals
  const fetchData = useCallback(async () => {
    try {
      const isCust = user?.role === 'CUSTOMER' || Boolean(user?.customerProfileId);
      const [pkgs, rentals] = await Promise.all([
        rentalsService.listPackages().catch(() => []),
        isCust ? rentalsService.getMyRentals().catch(() => []) : Promise.resolve([]),
      ]);
      setPackages(pkgs || []);
      setMyRentals(rentals || []);
    } catch (e) {
      console.warn('Error loading rental data:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.role, user?.customerProfileId]);

  useEffect(() => {
    fetchData();

    const unsub = subscribeRentalChannelEvents({
      onRentalPackageCreated: (_data) => {
        fetchData();
      },
    });

    return () => {
      unsub();
    };
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
  };

  // Sound chime helper
  const playSuccessChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (_) {}
  };

  // Open checkout modal
  const handleOpenCheckout = (pkg: RentalPackageItem) => {
    setSelectedPackage(pkg);
    setMonthsRented(3);
    setDeliveryAddress((user as any)?.address || '');
    setRecipientName(user?.fullName || '');
    setRecipientPhone(user?.phone || '');
    setNote('');
    setIsCheckoutOpen(true);
  };

  // Calculate pricing breakdown
  const pricingDetails = useMemo(() => {
    if (!selectedPackage) return { monthly: 0, deposit: 0, baseRent: 0, totalRent: 0, discount: 0, finalTotal: 0 };
    const monthly = Number(selectedPackage.monthlyPrice || selectedPackage.monthlyFee || 0);
    const deposit = Number(selectedPackage.depositFee || 0);

    let discountPercent = 0;
    if (monthsRented >= 12) discountPercent = 0.15;
    else if (monthsRented >= 6) discountPercent = 0.1;

    const baseRent = monthly * monthsRented;
    const discount = Math.round(baseRent * discountPercent);
    const totalRent = baseRent - discount;
    const finalTotal = totalRent + deposit;

    return {
      monthly,
      deposit,
      baseRent,
      discount,
      totalRent,
      finalTotal,
    };
  }, [selectedPackage, monthsRented]);

  // Submit rental contract
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) return;

    if (!deliveryAddress.trim()) {
      toast.error('Vui lòng nhập địa chỉ nhận nút bấm.');
      return;
    }
    if (!recipientPhone.trim()) {
      toast.error('Vui lòng nhập số điện thoại người nhận.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await rentalsService.createRentalOrder({
        packageId: selectedPackage.packageId || (selectedPackage as any).id,
        monthsRented,
        deliveryAddress: deliveryAddress.trim(),
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        note: note.trim(),
        packageName: selectedPackage.packageName || selectedPackage.name,
        buttonQuantity: selectedPackage.buttonQuantity || 1,
        totalAmount: pricingDetails.finalTotal,
        depositFee: pricingDetails.deposit,
      });

      playSuccessChime();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#0E6BA8', '#10B981', '#38BDF8'],
        });
      } catch (_) {}

      toast.success('Đăng ký thuê nút thành công! Hợp đồng đã được tạo.');
      setIsCheckoutOpen(false);

      // If created contract returned and user chose PayOS, open instant payment
      const createdContract = res?.data;
      await fetchData();
      setActiveTab('MY_RENTALS');

      if (createdContract && paymentMethod === 'PAYOS') {
        setPayingContract(createdContract);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Không thể tạo hợp đồng thuê nút.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm payment for pending contract
  const handleConfirmPayment = async (contract: CustomerRentalContract) => {
    setIsProcessingPayment(true);
    try {
      await rentalsService.payRental(contract.rentalId, 'PAYOS');
      playSuccessChime();
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch (_) {}
      toast.success('Thanh toán thành công! Hợp đồng đã được kích hoạt.');
      setPayingContract(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Thanh toán chưa thành công.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50/60 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 pb-16 ${user?.role === 'CUSTOMER' ? 'customer-ui customer-rentals' : ''}`}>
      {/* Top Breadcrumb & Page Banner */}
      <div className="rental-header bg-white dark:bg-zinc-900 border-b border-slate-200/80 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-1.5 font-medium">
                <span
                  className="hover:text-[#0E6BA8] cursor-pointer"
                  onClick={() => navigate(user?.role === 'CUSTOMER' ? '/customer/home' : '/store/dashboard')}
                >
                  {user?.role === 'CUSTOMER' ? 'Khách hàng' : 'Cửa hàng'}
                </span>
                <span>/</span>
                <span className="text-slate-800 dark:text-zinc-200 font-semibold">Gói thuê nút bấm IoT</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                <Cpu className="w-6 h-6 text-[#0E6BA8] dark:text-[#38a5da]" />
                <span>
                  {user?.role === 'CUSTOMER'
                    ? 'Dịch Vụ Thuê Nút Bấm Đặt Hàng Thông Minh'
                    : 'Danh Mục Gói Thuê Nút Bấm IoT'}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                {user?.role === 'CUSTOMER'
                  ? 'Trải nghiệm tiện ích đặt nước, gas & nhu yếu phẩm chỉ bằng 1-chạm. Không cần chi phí mua đứt thiết bị, đổi mới miễn phí trọn đời, hỗ trợ giao và lắp đặt tận nhà.'
                  : 'Bảng cước thuê và thông số các gói nút bấm IoT được phát hành trên hệ thống để khách hàng đăng ký sử dụng.'}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </button>
              {user?.role === 'CUSTOMER' ? (
                <button
                  type="button"
                  onClick={() => navigate('/customer/home')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#0E6BA8] hover:bg-[#0c598c] text-white transition-colors cursor-pointer shadow-xs"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Nút của tôi</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/store/devices')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#0E6BA8] hover:bg-[#0c598c] text-white transition-colors cursor-pointer shadow-xs"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Kho thiết bị</span>
                </button>
              )}
              {['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(user?.role || '') && (
                <button
                  type="button"
                  onClick={() => navigate('/admin/dashboard?section=RENTALS')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Quản lý / Thêm gói thuê</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="rental-tabs flex items-center gap-2 mt-6 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
            <button
              type="button"
              onClick={() => setActiveTab('PACKAGES')}
              aria-pressed={activeTab === 'PACKAGES'}
              className={`relative px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'PACKAGES'
                  ? 'bg-[#0E6BA8] text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Gói Thuê Nút Bấm</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-mono font-bold">
                {packages.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('MY_RENTALS')}
              aria-pressed={activeTab === 'MY_RENTALS'}
              className={`relative px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'MY_RENTALS'
                  ? 'bg-[#0E6BA8] text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Clock3 className="w-4 h-4" />
              <span>Hợp Đồng Của Tôi</span>
              {myRentals.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTab === 'MY_RENTALS' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {myRentals.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="rental-content max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: BROWSE PACKAGES & RENT                                            */}
        {/* ========================================================================= */}
        {activeTab === 'PACKAGES' && (
          <div className="rental-package-section space-y-6">
            {/* Feature Perks Highlights */}
            <div className="rental-benefits grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 flex items-start gap-3.5 shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Bảo Hành Đổi Mới 1-1</h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    Hỏng là đổi ngay nút mới không mất phí trong suốt thời gian duy trì hợp đồng thuê.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 flex items-start gap-3.5 shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Giao & Cài Đặt Miễn Phí</h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    Giao tận nhà trong 2 giờ, kỹ thuật viên hướng dẫn dán tường và kết nối Wi-Fi gia đình.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 flex items-start gap-3.5 shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Hoàn Cọc 100%</h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                    Khi không còn nhu cầu sử dụng, bạn chỉ cần gửi trả nút để nhận lại 100% tiền cọc ban đầu.
                  </p>
                </div>
              </div>
            </div>

            {/* Packages Grid */}
            {packages.length === 0 ? (
              <div className="py-16 px-6 text-center rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-[#0E6BA8] dark:text-[#38a5da] mx-auto flex items-center justify-center">
                  <Cpu className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Chưa có gói thuê nút bấm nào đang mở
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                  Quản trị viên hệ thống sẽ sớm cập nhật các gói thuê thiết bị IoT mới từ trung tâm điều hành. Bạn có thể bấm nút làm mới bên dưới để kiểm tra lại dữ liệu thật.
                </p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0E6BA8] text-white text-xs font-semibold hover:bg-[#0c598c] transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Kiểm tra lại dữ liệu</span>
                </button>
              </div>
            ) : (
              <div className="rental-packages grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {packages.map((pkg, idx) => {
                const monthlyPrice = Number(pkg.monthlyPrice || pkg.monthlyFee || 0);
                const depositFee = Number(pkg.depositFee || 0);
                const isHighlight = pkg.buttonQuantity === 2 || idx === 1;

                return (
                  <motion.div
                    key={pkg.packageId || pkg.packageCode}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`rental-package relative rounded-3xl p-6 flex flex-col justify-between transition-all bg-white dark:bg-zinc-900 border shadow-sm ${
                      isHighlight
                        ? 'border-[#0E6BA8] ring-2 ring-[#0E6BA8]/20 dark:ring-[#38a5da]/20 shadow-md scale-[1.02]'
                        : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    {/* Highlight Badge */}
                    {isHighlight && (
                      <div className="rental-recommendation absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-[#0E6BA8] to-sky-600 text-white text-[10px] font-bold tracking-wider uppercase shadow-xs flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Khuyên Dùng Cho Gia Đình</span>
                      </div>
                    )}

                    <div>
                      {/* Header */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-[#0E6BA8] dark:text-[#38a5da] flex items-center justify-center font-bold font-mono">
                          {pkg.buttonQuantity}x
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 font-semibold">
                          {pkg.packageCode}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {pkg.packageName || pkg.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 min-h-[36px] line-clamp-2 leading-relaxed">
                        {pkg.description}
                      </p>

                      {/* Pricing */}
                      <div className="rental-pricing my-5 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 space-y-1.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-extrabold text-[#0E6BA8] dark:text-[#38a5da] tracking-tight">
                            {monthlyPrice.toLocaleString('vi-VN')}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">₫ / tháng</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 pt-1 border-t border-slate-200/60 dark:border-zinc-700/60">
                          <span>Tiền cọc thiết bị:</span>
                          <strong className="text-slate-800 dark:text-zinc-200">
                            {depositFee > 0 ? `${depositFee.toLocaleString('vi-VN')} ₫` : 'Miễn cọc'}
                          </strong>
                        </div>
                      </div>

                      {/* Perks list */}
                      <div className="space-y-2.5 mb-6">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
                          QUYỀN LỢI GÓI THUÊ:
                        </p>
                        {(pkg.features || [
                          `${pkg.buttonQuantity} nút bấm thông minh Pearl White`,
                          'Đổi mới 1-1 miễn phí trọn đời hợp đồng',
                          'Giao hàng & hướng dẫn cài đặt tận nhà',
                          'Tự động tích hợp đại lý nước/gas gần nhất',
                        ]).map((f, fIdx) => (
                          <div key={fIdx} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-zinc-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rent CTA */}
                    <button
                      type="button"
                      onClick={() => handleOpenCheckout(pkg)}
                      className={`w-full py-3 px-4 rounded-2xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isHighlight
                          ? 'bg-[#0E6BA8] hover:bg-[#0c598c] text-white shadow-sm hover:scale-[0.99]'
                          : 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900'
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      <span>Đăng Ký Thuê Gói Này</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                );
              })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MY RENTALS CONTRACTS                                              */}
        {/* ========================================================================= */}
        {activeTab === 'MY_RENTALS' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="p-12 text-center text-slate-500 dark:text-zinc-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#0E6BA8]" />
                <p className="text-xs font-medium">Đang tải danh sách hợp đồng thuê nút...</p>
              </div>
            ) : myRentals.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 flex items-center justify-center mx-auto">
                  <Cpu className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Bạn chưa có hợp đồng thuê nút bấm nào
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                    Đăng ký gói thuê nút bấm thông minh chỉ từ 30.000 đ/tháng để trải nghiệm tự động hóa mua sắm 1-chạm cho cả gia đình.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('PACKAGES')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#0E6BA8] hover:bg-[#0c598c] text-white text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <Layers className="w-4 h-4" />
                  <span>Xem Các Gói Thuê Nút</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myRentals.map((contract) => {
                  const isPending = contract.status === 'PENDING_PAYMENT';
                  const isActive = contract.status === 'ACTIVE';
                  const isPaid = contract.status === 'PAID';

                  return (
                    <div
                      key={contract.rentalId || contract.rentalCode}
                      className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-4 shadow-2xs hover:shadow-xs transition-shadow"
                    >
                      {/* Contract Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                              #{contract.rentalCode}
                            </span>
                            <span className="text-slate-300 dark:text-zinc-600">•</span>
                            <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                              {contract.monthsRented} tháng
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mt-1">
                            {contract.package?.packageName || contract.package?.name || 'Gói Thuê Nút IoT'}
                          </h4>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                              : isPending
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 animate-pulse'
                              : isPaid
                              ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                              : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}
                        >
                          {isActive
                            ? 'ĐANG HOẠT ĐỘNG'
                            : isPending
                            ? 'CHỜ THANH TOÁN'
                            : isPaid
                            ? 'ĐÃ THANH TOÁN'
                            : contract.status}
                        </span>
                      </div>

                      {/* Detail fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800">
                        <div>
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500 block">Thời hạn hợp đồng</span>
                          <span className="font-semibold text-slate-800 dark:text-zinc-200 text-xs">
                            {contract.startDate ? new Date(contract.startDate).toLocaleDateString('vi-VN') : '—'} →{' '}
                            {contract.endDate ? new Date(contract.endDate).toLocaleDateString('vi-VN') : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500 block">Tổng thanh toán</span>
                          <span className="font-bold text-[#0E6BA8] dark:text-[#38a5da] text-xs">
                            {Number(contract.totalRentAmount || 0).toLocaleString('vi-VN')} ₫
                          </span>
                        </div>
                      </div>

                      {/* Assigned Devices (if any) */}
                      {contract.buttons && contract.buttons.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                            Nút bấm đã cấp phát ({contract.buttons.length}):
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {contract.buttons.map((btn: any) => (
                              <span
                                key={btn.buttonId || btn.deviceId}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-zinc-800 font-mono text-[11px] font-semibold text-slate-700 dark:text-zinc-300"
                              >
                                <Smartphone className="w-3 h-3 text-[#0E6BA8]" />
                                <span>{btn.deviceId || btn.code || `BTN-${btn.buttonId}`}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => setPayingContract(contract)}
                            className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Thanh Toán Ngay ({Number(contract.totalRentAmount || 0).toLocaleString('vi-VN')} ₫)</span>
                          </button>
                        )}

                        {isActive && (
                          <button
                            type="button"
                            onClick={() => navigate('/customer/home')}
                            className="flex-1 py-2 px-3 rounded-xl bg-[#0E6BA8] hover:bg-[#0c598c] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Xem Nút Tại Trang Chủ</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CHECKOUT MODAL: ĐĂNG KÝ GÓI THUÊ                                         */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isCheckoutOpen && selectedPackage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overscroll-contain responsive-modal overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCheckoutOpen(false)}
              className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md cursor-pointer"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative z-10 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-5 sm:p-7 space-y-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#0E6BA8]/10 text-[#0E6BA8] flex items-center justify-center font-bold">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      Đăng Ký Thuê Nút Bấm IoT
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      {selectedPackage.packageName || selectedPackage.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-400 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmitOrder} className="space-y-4">
                {/* 1. Chọn thời hạn thuê */}
                <div>
                  <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200 mb-1.5 flex items-center justify-between">
                    <span>Thời hạn hợp đồng thuê</span>
                    <span className="text-[10px] text-[#0E6BA8] font-bold">
                      {monthsRented >= 12 ? 'Giảm 15%' : monthsRented >= 6 ? 'Giảm 10%' : 'Chuẩn'}
                    </span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { m: 1, label: '1 tháng', desc: 'Linh hoạt' },
                      { m: 3, label: '3 tháng', desc: 'Phổ biến' },
                      { m: 6, label: '6 tháng', desc: '-10% phí' },
                      { m: 12, label: '12 tháng', desc: '-15% phí' },
                    ].map((item) => (
                      <button
                        key={item.m}
                        type="button"
                        onClick={() => setMonthsRented(item.m)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          monthsRented === item.m
                            ? 'border-[#0E6BA8] bg-[#0E6BA8]/10 text-[#0E6BA8] dark:border-[#38a5da] dark:text-[#38a5da] font-bold'
                            : 'border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                        }`}
                      >
                        <span className="block text-xs">{item.label}</span>
                        <span className="block text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                          {item.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Thông tin nhận hàng */}
                <div className="space-y-3 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
                    ĐỊA CHỈ GIAO NÚT BẤM VÀ LẮP ĐẶT:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 dark:text-zinc-300 mb-1">
                        Họ và tên người nhận *
                      </label>
                      <input
                        type="text"
                        required
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="VD: Nguyễn Văn A"
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white outline-none focus:border-[#0E6BA8]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 dark:text-zinc-300 mb-1">
                        Số điện thoại *
                      </label>
                      <input
                        type="tel"
                        required
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        placeholder="VD: 0901234567"
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white outline-none focus:border-[#0E6BA8]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Địa chỉ nhận nút tận nhà *
                    </label>
                    <input
                      type="text"
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white outline-none focus:border-[#0E6BA8]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-zinc-300 mb-1">
                      Ghi chú thêm (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="VD: Giao giờ hành chính, gọi trước khi đến..."
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white outline-none focus:border-[#0E6BA8]"
                    />
                  </div>
                </div>

                {/* 3. Phương thức thanh toán */}
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-mono">
                    HÌNH THỨC THANH TOÁN:
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('PAYOS')}
                      className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        paymentMethod === 'PAYOS'
                          ? 'border-[#0E6BA8] bg-[#0E6BA8]/10 text-slate-900 dark:text-white font-semibold'
                          : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      <QrCode className="w-4 h-4 text-[#0E6BA8] shrink-0 mt-0.5" />
                      <div>
                        <span className="block text-xs font-bold">Chuyển khoản QR</span>
                        <span className="block text-[10px] text-slate-400">VietQR / PayOS tự động</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('COD')}
                      className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        paymentMethod === 'COD'
                          ? 'border-[#0E6BA8] bg-[#0E6BA8]/10 text-slate-900 dark:text-white font-semibold'
                          : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                      }`}
                    >
                      <Banknote className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="block text-xs font-bold">Thanh toán khi nhận</span>
                        <span className="block text-[10px] text-slate-400">COD khi kỹ thuật viên giao</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 4. Tóm tắt chi phí thanh toán */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/70 border border-slate-200 dark:border-zinc-700/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                    <span>
                      Tiền thuê ({pricingDetails.monthly.toLocaleString('vi-VN')} ₫ x {monthsRented} tháng):
                    </span>
                    <span>{pricingDetails.baseRent.toLocaleString('vi-VN')} ₫</span>
                  </div>
                  {pricingDetails.discount > 0 && (
                    <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span>Ưu đãi thời hạn ({monthsRented >= 12 ? '15%' : '10%'}):</span>
                      <span>-{pricingDetails.discount.toLocaleString('vi-VN')} ₫</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
                    <span>Tiền cọc thiết bị (Hoàn lại khi trả nút):</span>
                    <span>{pricingDetails.deposit.toLocaleString('vi-VN')} ₫</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-zinc-700 font-bold text-sm text-slate-900 dark:text-white">
                    <span>Tổng thanh toán ban đầu:</span>
                    <span className="text-[#0E6BA8] dark:text-[#38a5da] text-base">
                      {pricingDetails.finalTotal.toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#0E6BA8] hover:bg-[#0c598c] disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang tạo hợp đồng thuê nút...</span>
                    </>
                  ) : (
                    <>
                      <span>Xác Nhận Đăng Ký Thuê Nút</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* INSTANT PAYMENT MODAL: THANH TOÁN QR PAYOS / VIETQR                       */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {payingContract && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 overscroll-contain responsive-modal overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPayingContract(null)}
              className="fixed inset-0 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md cursor-pointer"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative z-10 w-full sm:max-w-md bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-7 space-y-5 text-center"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#0E6BA8]" />
                  <span>Thanh Toán Hợp Đồng #{payingContract.rentalCode}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setPayingContract(null)}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-500 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* VietQR Mock Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 dark:from-zinc-800 dark:to-zinc-850 border border-slate-200 dark:border-zinc-700 space-y-3">
                <div className="w-40 h-40 mx-auto bg-white p-2.5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-center">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                      `2.00.01021200000000000000000000000000${payingContract.rentalCode}`
                    )}`}
                    alt="VietQR Payment"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Số tiền thanh toán:</p>
                  <p className="text-xl font-bold text-[#0E6BA8] dark:text-[#38a5da]">
                    {Number(payingContract.totalRentAmount || 0).toLocaleString('vi-VN')} ₫
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 mt-1">
                    Nội dung: <strong>{payingContract.rentalCode}</strong>
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isProcessingPayment}
                  onClick={() => handleConfirmPayment(payingContract)}
                  className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isProcessingPayment ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang xác nhận thanh toán...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Xác Nhận Đã Thanh Toán Thành Công</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPayingContract(null)}
                  className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer"
                >
                  Thanh toán sau (Lưu ở danh sách hợp đồng)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
