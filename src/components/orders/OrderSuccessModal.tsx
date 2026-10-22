import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X, Check, Copy, RotateCcw } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export interface OrderSuccessModalProps {
  isOpen: boolean;
  order: any;
  secondsRemaining: number;
  onClose: () => void;
  onCancelOrder: (orderId: string, orderNumber: string) => void;
  onCancelledClosed?: (orderNumber: string) => void;
  onReorder?: (deviceId?: string) => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  isOpen,
  order,
  secondsRemaining,
  onClose,
  onCancelOrder,
  onCancelledClosed,
  onReorder,
}) => {
  // Lock background body scroll whenever modal is open
  useBodyScrollLock(isOpen);

  const [copied, setCopied] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset cancellation state when a new order is opened
  useEffect(() => {
    if (isOpen) {
      setIsCancelled(false);
    } else {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    }
  }, [isOpen, order?.id]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, []);

  if (!order) return null;

  const totalCancelWindow = (order as any).cancelWindowSeconds || 60;
  const progressPercent = Math.max(0, Math.min(100, (secondsRemaining / totalCancelWindow) * 100));

  const defaultAddress = 'Căn hộ 1204, Tháp Sapphire, Sunwah Pearl, 90 Nguyễn Hữu Cảnh, P. 22, Bình Thạnh';
  const deliveryAddress = order.deliveryAddress || order.address || defaultAddress;

  const formatPrice = (amount?: number | null) => {
    return `${Number(amount || 0).toLocaleString('vi-VN')} đ`;
  };

  const orderNumber = order.orderNumber || order.id?.slice(0, 8);

  const handleCopy = () => {
    if (orderNumber) {
      navigator.clipboard.writeText(orderNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Optimistic cancellation flow
  const handleCancelClick = () => {
    if (isCancelled) return;
    setIsCancelled(true);
    onCancelOrder(order.id, orderNumber);

    // Auto-close after 2 seconds
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

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="order-success-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseClick();
          }}
        >
          {/* Modal Card */}
          <motion.div
            key="order-success-card"
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 14 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320, mass: 0.8 }}
            className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl p-6 sm:p-7 relative border border-slate-100"
          >
            {/* Top Close Button */}
            <button
              onClick={handleCloseClick}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header: Checkmark or Cancelled State */}
            <div className="flex flex-col items-center text-center pt-1">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors duration-200 ${
                  isCancelled
                    ? 'bg-slate-100 text-slate-600'
                    : 'bg-emerald-50 border border-emerald-100 text-emerald-500'
                }`}
              >
                {isCancelled ? (
                  <RotateCcw className="w-5 h-5 text-slate-600" />
                ) : (
                  <Check className="w-6 h-6 text-emerald-500 stroke-[2.5]" />
                )}
              </div>

              <h3 className="text-xl font-bold tracking-tight text-slate-900 transition-all duration-200">
                {isCancelled ? 'Đã hủy đơn hàng' : 'Đặt hàng thành công'}
              </h3>

              {/* Order Number with Copy Icon */}
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mt-1 cursor-pointer group"
                title="Sao chép mã đơn hàng"
              >
                <span className="tabular-nums font-normal">#{orderNumber}</span>
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
                )}
              </button>
            </div>

            {/* Digital Receipt Container */}
            <div
              className={`bg-[#F8FAFC] rounded-xl p-4 space-y-2.5 mt-5 transition-opacity duration-200 ${
                isCancelled ? 'opacity-50' : 'opacity-100'
              }`}
            >
              {/* Order Items */}
              {order.items && order.items.length > 0 ? (
                order.items.map((it: any, idx: number) => (
                  <div
                    key={it.id || it.productName || idx}
                    className="flex justify-between items-center text-xs"
                  >
                    <span className="text-slate-600 font-normal truncate pr-3">
                      {it.quantity}x {it.productName}
                    </span>
                    <span
                      className={`tabular-nums font-semibold shrink-0 ${
                        isCancelled
                          ? 'line-through text-slate-400'
                          : 'text-slate-900'
                      }`}
                    >
                      {formatPrice(it.totalPrice || it.price * it.quantity || 0)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-normal">1x Đơn hàng Nút bấm</span>
                  <span
                    className={`tabular-nums font-semibold shrink-0 ${
                      isCancelled
                        ? 'line-through text-slate-400'
                        : 'text-slate-900'
                    }`}
                  >
                    {formatPrice(order.totalAmount || 0)}
                  </span>
                </div>
              )}

              {/* Total Payment */}
              <div className="flex justify-between items-center pt-1 text-xs">
                <span className="font-semibold text-slate-900">Tổng thanh toán</span>
                <span
                  className={`tabular-nums font-bold ${
                    isCancelled
                      ? 'line-through text-slate-400'
                      : 'text-slate-900'
                  }`}
                >
                  {formatPrice(order.totalAmount || 0)}
                </span>
              </div>

              {/* Delivery Address */}
              <div className="pt-2.5 border-t border-slate-200/60 flex items-start gap-2 text-[11px] text-slate-500">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  {deliveryAddress}
                </span>
              </div>
            </div>

            {/* Cancellation Grace Period (Hidden when cancelled) */}
            {!isCancelled && secondsRemaining > 0 && (
              <div className="space-y-2 mt-4">
                {/* Thin shrinking progress bar */}
                <div className="w-full bg-slate-100 h-[2px] rounded-full overflow-hidden">
                  <div
                    className="bg-[#E15241] h-full transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Grace text & inline cancel link */}
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-slate-500 tabular-nums">
                    Bạn có thể hủy đơn trong vòng {secondsRemaining} giây tới
                  </span>
                  <button
                    type="button"
                    onClick={handleCancelClick}
                    className="text-[#E15241] font-medium hover:underline cursor-pointer border-b border-dashed border-[#E15241]/50 hover:border-solid text-xs transition-colors"
                  >
                    Hủy đơn hàng
                  </button>
                </div>
              </div>
            )}

            {/* Actions: Single button or 2-column actions if cancelled */}
            {isCancelled ? (
              <div className="grid grid-cols-2 gap-3 mt-5">
                <button
                  type="button"
                  onClick={handleCloseClick}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition-all duration-150 active:scale-[0.97] cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleReorderClick}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-xs sm:text-sm font-semibold transition-all duration-150 active:scale-[0.97] hover:shadow-md cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Đặt lại</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCloseClick}
                className="w-full py-3 px-4 rounded-xl bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-xs sm:text-sm font-semibold transition-all duration-150 ease-out active:scale-[0.98] hover:shadow-md cursor-pointer shadow-xs mt-4"
              >
                Đã hiểu & Theo dõi đơn hàng
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
