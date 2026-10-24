import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  X,
  Check,
  Copy,
  RotateCcw,
  QrCode,
  CreditCard,
  Banknote,
  ExternalLink,
  RefreshCw,
  ShoppingBag,
  Clock,
} from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { paymentsService, PayosPaymentLinkResponse } from '../../services/payments.service';

export interface OrderSuccessModalProps {
  isOpen: boolean;
  order: any;
  secondsRemaining: number;
  onClose: () => void;
  onCancelOrder: (orderId: string, orderNumber: string) => void;
  onCancelledClosed?: (orderNumber: string) => void;
  onReorder?: (deviceId?: string) => void;
}

type PaymentTab = 'PAYOS' | 'COD';

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  isOpen,
  order,
  secondsRemaining,
  onClose,
  onCancelOrder,
  onCancelledClosed,
  onReorder,
}) => {
  useBodyScrollLock(isOpen);

  const [activeTab, setActiveTab] = useState<PaymentTab>('PAYOS');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'PAYOS' | 'CASH_ON_DELIVERY'>('PAYOS');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentData, setPaymentData] = useState<PayosPaymentLinkResponse | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [payosError, setPayosError] = useState<string | null>(null);
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const orderNumber = order?.orderNumber || order?.id?.slice(0, 8) || 'ORD-20261020-4479';
  const totalAmount = order?.totalAmount || 68000;

  const formatPrice = (amount: number) => {
    return `${amount.toLocaleString('vi-VN')} ₫`;
  };

  useEffect(() => {
    if (!isOpen || !order) return;

    setIsCancelled(false);
    setIsPaid(order.paymentStatus === 'PAID');
    setSelectedPaymentMethod(order.paymentMethod === 'CASH_ON_DELIVERY' ? 'CASH_ON_DELIVERY' : 'PAYOS');
    setActiveTab(order.paymentMethod === 'CASH_ON_DELIVERY' ? 'COD' : 'PAYOS');
    setPaymentData(null);
    setPaymentFeedback(null);

    let isMounted = true;
    const initPaymentLink = async () => {
      setLoadingPayment(true);
      setPayosError(null);
      try {
        const res = await paymentsService.createPayosLink({
          orderId: order.id || order.orderNumber,
          amount: totalAmount,
          description: `SOB ${orderNumber}`,
          buyerName: order.customerName,
          buyerPhone: order.customerPhone,
        });

        if (isMounted && res.success && res.data) {
          setPaymentData(res.data);
          if (res.data.status === 'PAID') {
            setIsPaid(true);
          }
        }
      } catch (err: any) {
        // Payment link error is shown via setPayosError below
        if (isMounted) {
          setPayosError(err.response?.data?.message || 'Không thể tạo liên kết thanh toán PayOS');
        }
      } finally {
        if (isMounted) setLoadingPayment(false);
      }
    };

    if (order.paymentMethod !== 'CASH_ON_DELIVERY' && order.paymentStatus !== 'PAID' && order.paymentStatus !== 'REFUND_PENDING') initPaymentLink();

    return () => {
      isMounted = false;
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, [isOpen, order?.id, order?.orderNumber]);

  useEffect(() => {
    if (!order || !isOpen || isPaid || !paymentData?.orderCode || selectedPaymentMethod !== 'PAYOS') return;

    const timer = setInterval(async () => {
      try {
        const res = await paymentsService.getPaymentLinkInfo(paymentData.orderCode);
        if (res.data?.status === 'PAID') setIsPaid(true);
      } catch {
        // A transient status lookup error should not change the order's payment state.
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [order?.id, isOpen, isPaid, paymentData?.orderCode, selectedPaymentMethod]);

  if (!order) return null;

  const totalCancelWindow = (order as any).cancelWindowSeconds || 60;
  const progressPercent = Math.max(0, Math.min(100, (secondsRemaining / totalCancelWindow) * 100));
  const deliveryAddress = order.deliveryAddress || order.address || 'S5.03 VinhomeGrandPark, TP. Thủ Đức, TP. HCM';

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCancelClick = () => {
    if (isCancelled) return;
    setIsCancelled(true);
    onCancelOrder(order.id, orderNumber);

    autoCloseTimerRef.current = setTimeout(() => {
      onClose();
      if (onCancelledClosed) {
        onCancelledClosed(orderNumber);
      }
    }, 2000);
  };

  const handleCloseClick = () => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    onClose();
    if (isCancelled && onCancelledClosed) {
      onCancelledClosed(orderNumber);
    }
  };

  const handleReorderClick = () => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    onClose();
    const devId = order.deviceId || order.items?.[0]?.deviceId;
    if (onReorder) {
      onReorder(devId);
    }
  };

  const checkPayosPayment = async () => {
    if (!paymentData?.orderCode) return;
    setIsPaying(true);
    try {
      const res = await paymentsService.getPaymentLinkInfo(paymentData.orderCode);
      if (res.data?.status === 'PAID') {
        setIsPaid(true);
        setPaymentFeedback('PayOS đã xác nhận thanh toán.');
      } else {
        setPaymentFeedback('PayOS chưa ghi nhận thanh toán. Trạng thái sẽ tự cập nhật khi giao dịch hoàn tất.');
      }
    } catch (e: any) {
      setPaymentFeedback(e.response?.data?.message || 'Chưa lấy được trạng thái thanh toán từ PayOS.');
    } finally {
      setIsPaying(false);
    }
  };

  const handleSelectCashOnDelivery = async () => {
    setIsPaying(true);
    try {
      await paymentsService.selectOrderPaymentMethod(order.id, 'CASH_ON_DELIVERY');
      setSelectedPaymentMethod('CASH_ON_DELIVERY');
      setPaymentData(null);
      setPaymentFeedback('Đã chọn thanh toán tiền mặt khi nhận hàng. Cửa hàng sẽ thu tiền lúc giao.');
    } catch (e: any) {
      setPaymentFeedback(e.response?.data?.message || 'Không thể lưu phương thức thanh toán.');
    } finally {
      setIsPaying(false);
    }
  };

  const handleSelectPayOS = async () => {
    setActiveTab('PAYOS');
    if (selectedPaymentMethod === 'PAYOS') return;
    setIsPaying(true);
    try {
      await paymentsService.selectOrderPaymentMethod(order.id, 'PAYOS');
      setSelectedPaymentMethod('PAYOS');
      if (paymentData) return;
      const res = await paymentsService.createPayosLink({
        orderId: order.id || order.orderNumber,
        amount: totalAmount,
        description: `SOB ${orderNumber}`,
        buyerName: order.customerName,
        buyerPhone: order.customerPhone,
      });
      if (res.success && res.data) setPaymentData(res.data);
    } catch (err: any) {
      setPayosError(err.response?.data?.message || 'Không thể tạo liên kết thanh toán PayOS');
    } finally {
      setIsPaying(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="checkout-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-900/40 backdrop-blur-xs overscroll-contain overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseClick();
          }}
        >
          {/* Main Modal Container: #FFFFFF with 20px rounded corners & soft deep elevation */}
          <motion.div
            layout
            key="checkout-card"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 360,
              mass: 0.8,
              layout: { duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] },
            }}
            className="w-full max-w-[480px] bg-[#FFFFFF] rounded-[20px] shadow-[0_20px_50px_rgba(15,23,42,0.08),0_1px_3px_rgba(15,23,42,0.05)] border border-slate-100 p-6 sm:p-7 relative my-auto space-y-5"
          >
            {/* Top Close Button */}
            <button
              onClick={handleCloseClick}
              className="absolute top-5 right-5 p-1.5 rounded-full text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>

            {/* ── 2. Header & Order Status: Streamlined Meta Row Above Title ── */}
            <div className="space-y-1.5 pr-8">
              {/* Meta row: Order ID + Status badge */}
              <div className="flex items-center gap-2 text-xs text-[#64748B]">
                <div className="inline-flex items-center gap-1.5 font-medium tabular-nums">
                  <span>#{orderNumber}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(orderNumber, 'orderNum')}
                    className="text-slate-400 hover:text-[#0F172A] transition-colors cursor-pointer"
                    title="Sao chép mã đơn"
                  >
                    {copiedField === 'orderNum' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2} />
                    ) : (
                      <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                    )}
                  </button>
                </div>
                <span className="text-slate-300">·</span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                    isCancelled
                      ? 'bg-slate-100 text-slate-600'
                      : isPaid
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isCancelled ? 'bg-slate-400' : isPaid ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                    }`}
                  />
                  {isCancelled ? 'Đã hủy đơn' : isPaid ? 'Đã thanh toán' : 'Chờ thanh toán'}
                </span>
              </div>

              {/* Main Title */}
              <h2 className="text-xl font-bold tracking-tight text-[#0F172A]">
                {isCancelled
                  ? 'Đơn hàng đã được hủy'
                  : isPaid
                  ? 'Thanh toán thành công'
                  : 'Đặt hàng & Thanh toán'}
              </h2>
            </div>

            {/* ── 3. Floating Segmented Tabs (PayOS, COD) with Smooth Sliding Indicator ── */}
            {!isCancelled && !isPaid && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#F1F5F9] rounded-xl text-xs relative">
                  <button
                    type="button"
                    onClick={handleSelectPayOS}
                    className="relative py-2.5 px-3 rounded-lg font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {activeTab === 'PAYOS' && (
                      <motion.div
                        layoutId="activePaymentTabIndicator"
                        className="absolute inset-0 bg-white rounded-lg shadow-xs"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                    <span
                      className={`relative z-10 flex items-center gap-1.5 transition-colors duration-150 ${
                        activeTab === 'PAYOS'
                          ? 'text-[#0E6BA8] font-semibold'
                          : 'text-[#64748B] hover:text-[#0E6BA8]'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                      <span>Cổng PayOS</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('COD')}
                    className="relative py-2.5 px-3 rounded-lg font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {activeTab === 'COD' && (
                      <motion.div
                        layoutId="activePaymentTabIndicator"
                        className="absolute inset-0 bg-white rounded-lg shadow-xs"
                        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                      />
                    )}
                    <span
                      className={`relative z-10 flex items-center gap-1.5 transition-colors duration-150 ${
                        activeTab === 'COD'
                          ? 'text-[#0E6BA8] font-semibold'
                          : 'text-[#64748B] hover:text-[#0E6BA8]'
                      }`}
                    >
                      <Banknote className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                      <span>Tiền mặt (COD)</span>
                    </span>
                  </button>
                </div>

                {/* ── Animated Tab Content Panels ── */}
                <div className="relative">
                  <AnimatePresence mode="wait" initial={false}>
                    {activeTab === 'PAYOS' && (
                      <motion.div
                        key="tab-panel-payos"
                        initial={{ opacity: 0, y: 8, scale: 0.995 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.995 }}
                        transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="space-y-4"
                      >
                        {/* PayOS Gateway Introduction Card */}
                        <div className="flex items-start gap-3.5 text-xs text-[#64748B] leading-relaxed bg-[#F8FAFC] p-4 rounded-xl border border-slate-100">
                          <div className="w-10 h-10 rounded-full bg-[#0E6BA8]/10 text-[#0E6BA8] flex items-center justify-center shrink-0 mt-0.5">
                            <CreditCard className="w-5 h-5" strokeWidth={1.75} />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-[#0F172A]">Cổng thanh toán PayOS</p>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                Trực tuyến
                              </span>
                            </div>
                            <p>
                              Hỗ trợ thanh toán bảo mật tức thì qua thẻ ATM nội địa Napas 24/7, thẻ quốc tế Visa & Mastercard hoặc quét mã tại cổng PayOS.
                            </p>
                          </div>
                        </div>

                        {/* PayOS Details */}
                        <div className="divide-y divide-slate-100 text-xs">
                          <div className="flex items-center justify-between py-2">
                            <span className="text-[#64748B]">Mã đơn hàng</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-semibold text-[#0F172A] tabular-nums">
                                #{orderNumber}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(orderNumber, 'payosOrder')}
                                className="p-1 rounded text-slate-400 hover:text-[#0E6BA8] transition-colors cursor-pointer"
                                title="Sao chép mã đơn"
                              >
                                {copiedField === 'payosOrder' ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2} />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between py-2">
                            <span className="text-[#64748B]">Tổng tiền thanh toán</span>
                            <span className="text-sm font-bold text-[#0E6BA8] tabular-nums">
                              {formatPrice(totalAmount)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between py-2">
                            <span className="text-[#64748B]">Kênh xử lý</span>
                            <span className="font-medium text-[#0F172A]">API PayOS Gateway</span>
                          </div>
                        </div>

                        {/* PayOS Action Buttons */}
                        <div className="pt-1 space-y-2">
                          {loadingPayment ? (
                            <div className="w-full h-11 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                              <RefreshCw className="w-4 h-4 animate-spin text-slate-400" strokeWidth={1.75} />
                              <span>Đang kết nối API PayOS...</span>
                            </div>
                          ) : paymentData?.checkoutUrl ? (
                            <a
                              href={paymentData.checkoutUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full h-11 bg-[#0E6BA8] hover:bg-[#0B5586] text-white rounded-xl text-xs font-semibold shadow-xs transition-all duration-150 cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
                            >
                              <span>Chuyển tới cổng thanh toán PayOS</span>
                              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </a>
                          ) : payosError ? (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/60 text-amber-800 text-[11px] leading-relaxed">
                              {payosError}
                            </div>
                          ) : null}

                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            disabled={isPaying}
                            onClick={checkPayosPayment}
                            className={`w-full h-10 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 ${
                              paymentData?.checkoutUrl
                                ? 'border border-slate-200 text-[#0F172A] hover:bg-slate-50'
                                : 'bg-[#0E6BA8] hover:bg-[#0B5586] text-white shadow-xs'
                            }`}
                          >
                            {isPaying ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
                                <span>Đang kiểm tra...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
                                <span>Kiểm tra trạng thái thanh toán</span>
                              </>
                            )}
                          </motion.button>
                          {paymentFeedback && <p className="text-center text-[11px] text-slate-500">{paymentFeedback}</p>}
                        </div>
                      </motion.div>
                    )}

                    {activeTab === 'COD' && (
                      <motion.div
                        key="tab-panel-cod"
                        initial={{ opacity: 0, y: 8, scale: 0.995 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.995 }}
                        transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className="space-y-4 pt-1"
                      >
                        <div className="flex items-start gap-3.5 text-xs text-[#64748B] leading-relaxed bg-[#F8FAFC] p-4 rounded-xl border border-slate-100">
                          <div className="w-9 h-9 rounded-full bg-[#0E6BA8]/10 text-[#0E6BA8] flex items-center justify-center shrink-0 mt-0.5">
                            <Banknote className="w-4 h-4" strokeWidth={1.75} />
                          </div>
                          <div className="space-y-1">
                            <p className="font-semibold text-[#0F172A]">Thanh toán tiền mặt khi nhận hàng (COD)</p>
                            <p>
                              Quý khách vui lòng chuẩn bị số tiền{' '}
                              <strong className="text-[#0E6BA8] tabular-nums">{formatPrice(totalAmount)}</strong>{' '}
                              khi nhân viên giao hàng tới căn hộ.
                            </p>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-100 text-xs">
                          <div className="flex items-center justify-between py-2">
                            <span className="text-[#64748B]">Hình thức thanh toán</span>
                            <span className="font-semibold text-[#0F172A]">Tiền mặt trực tiếp (COD)</span>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-[#64748B]">Số tiền thu hộ</span>
                            <span className="text-sm font-bold text-[#0E6BA8] tabular-nums">
                              {formatPrice(totalAmount)}
                            </span>
                          </div>
                        </div>

                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          disabled={isPaying}
                          onClick={handleSelectCashOnDelivery}
                          className="w-full h-11 bg-[#0E6BA8] hover:bg-[#0B5586] text-white rounded-xl text-xs font-semibold shadow-xs transition-all duration-150 cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
                        >
                          {isPaying ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.75} />
                              <span>Đang xác nhận...</span>
                            </>
                          ) : (
                            <span>{selectedPaymentMethod === 'CASH_ON_DELIVERY' ? 'Đã chọn tiền mặt khi nhận hàng' : 'Chọn thanh toán tiền mặt khi nhận hàng'}</span>
                          )}
                        </motion.button>
                        {paymentFeedback && <p className="text-center text-[11px] text-slate-500">{paymentFeedback}</p>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Paid State View */}
            {isPaid && !isCancelled && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-4 text-center space-y-1.5"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <Check className="w-5 h-5 stroke-[2.2]" />
                </div>
                <h3 className="text-sm font-semibold text-[#0F172A]">
                  Đã xác nhận thanh toán
                </h3>
                <p className="text-xs text-[#64748B] max-w-xs mx-auto leading-relaxed">
                  {order.paymentMethod === 'CASH_ON_DELIVERY'
                    ? 'Đơn COD đã được xác nhận đã thu tiền khi giao hàng.'
                    : 'PayOS đã xác nhận giao dịch. Cửa hàng sẽ tiếp nhận và chuẩn bị đơn hàng.'}
                </p>
              </motion.div>
            )}

            {/* ── 6. Order Summary Container: Soft background container (#F8FAFC) ── */}
            <div
              className={`bg-[#F8FAFC] rounded-2xl p-4 space-y-3 transition-opacity duration-200 ${
                isCancelled ? 'opacity-50' : 'opacity-100'
              }`}
            >
              {/* Product items */}
              <div className="space-y-1.5 text-xs">
                {order.items && order.items.length > 0 ? (
                  order.items.map((it: any, idx: number) => (
                    <div
                      key={it.id || it.productName || idx}
                      className="flex justify-between items-center text-[#64748B]"
                    >
                      <span className="truncate pr-3">
                        {it.quantity}× {it.productName}
                      </span>
                      <span
                        className={`tabular-nums font-semibold shrink-0 ${
                          isCancelled ? 'line-through text-slate-400' : 'text-[#0F172A]'
                        }`}
                      >
                        {formatPrice(it.totalPrice || it.price * it.quantity || 0)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between items-center text-xs text-[#64748B]">
                    <span>1× Nhu yếu phẩm nút bấm</span>
                    <span
                      className={`tabular-nums font-semibold shrink-0 ${
                        isCancelled ? 'line-through text-slate-400' : 'text-[#0F172A]'
                      }`}
                    >
                      {formatPrice(order.totalAmount || 0)}
                    </span>
                  </div>
                )}
              </div>

              {/* Delivery Address */}
              <div className="pt-2 border-t border-slate-200/50 flex items-start gap-2 text-[11px] text-[#64748B]">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" strokeWidth={1.75} />
                <span className="leading-relaxed truncate">{deliveryAddress}</span>
              </div>

              {/* Total Calculation */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/50 text-xs">
                <span className="font-medium text-[#64748B]">Tổng thanh toán</span>
                <span
                  className={`tabular-nums font-bold text-sm ${
                    isCancelled ? 'line-through text-slate-400' : 'text-[#0E6BA8]'
                  }`}
                >
                  {formatPrice(order.totalAmount || 0)}
                </span>
              </div>
            </div>

            {/* ── 6. Footer: Free cancellation countdown timer & action button ── */}
            <div className="space-y-3 pt-1">
              {/* Free cancellation countdown timer */}
              {!isCancelled && !isPaid && secondsRemaining > 0 && order?.status === 'PENDING' && (
                <div className="flex items-center justify-between text-xs text-[#64748B] pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                    <span className="text-[11px] tabular-nums">
                      Hủy miễn phí trong <strong className="text-[#0F172A]">{secondsRemaining}s</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelClick}
                    className="text-xs text-rose-500 hover:text-rose-600 hover:underline cursor-pointer transition-colors"
                  >
                    Hủy đơn hàng
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              {isCancelled ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleCloseClick}
                    className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0F172A] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={handleReorderClick}
                    className="h-10 rounded-xl bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>Đặt lại đơn</span>
                  </button>
                </div>
              ) : isPaid ? (
                <button
                  type="button"
                  onClick={handleCloseClick}
                  className="w-full h-10 rounded-xl bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Hoàn tất & Về trang chủ
                </button>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
