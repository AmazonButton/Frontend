import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  CreditCard,
  Package,
  RefreshCw,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { paymentsService } from '../../services/payments.service';
import { api } from '../../services/api';
import { toast } from '../../context/ToastContext';

export interface PayOSRecoveryOrder {
  orderId: string | number;
  orderNumber?: string;
  totalAmount?: number;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  items?: Array<{ productName: string; quantity: number; price?: number }>;
  createdAt?: string | number | Date;
}

export interface PayOSCancelRecoveryModalProps {
  isOpen: boolean;
  order: PayOSRecoveryOrder | null;
  onClose: () => void;
  onSwitchedToCod?: (orderId: string | number) => void;
  onCancelled?: (orderId: string | number, reason?: string) => void;
}

const DEFAULT_TIMEOUT_SECONDS = 15 * 60; // 15 phút

const formatMoney = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);

const formatCountdown = (totalSeconds: number) => {
  const mins = Math.floor(Math.max(0, totalSeconds) / 60);
  const secs = Math.max(0, totalSeconds) % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const PayOSCancelRecoveryModal: React.FC<PayOSCancelRecoveryModalProps> = ({
  isOpen,
  order,
  onClose,
  onSwitchedToCod,
  onCancelled,
}) => {
  useBodyScrollLock(isOpen);

  const [busyAction, setBusyAction] = useState<'retry' | 'cod' | 'cancel' | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(DEFAULT_TIMEOUT_SECONDS);
  const autoCancelTriggeredRef = useRef(false);

  const orderId = order?.orderId ? String(order.orderId) : '';
  const orderNumber = order?.orderNumber || (orderId ? `DH${orderId}` : '---');
  const totalAmount = Number(order?.totalAmount || 0);

  // Khởi tạo thời gian đếm ngược dựa theo createdAt của đơn hàng
  useEffect(() => {
    if (!isOpen || !order) return;
    autoCancelTriggeredRef.current = false;

    if (order.createdAt) {
      const createdTime = new Date(order.createdAt).getTime();
      const elapsed = Math.floor((Date.now() - createdTime) / 1000);
      const remaining = Math.max(0, DEFAULT_TIMEOUT_SECONDS - elapsed);
      setSecondsRemaining(remaining);
    } else {
      setSecondsRemaining(DEFAULT_TIMEOUT_SECONDS);
    }
  }, [isOpen, order]);

  // Bộ đếm ngược 15 phút - Tự động hủy đơn khi hết hạn
  useEffect(() => {
    if (!isOpen || !order || busyAction) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Hết hạn 15 phút: Kích hoạt tự động hủy
          if (!autoCancelTriggeredRef.current) {
            autoCancelTriggeredRef.current = true;
            handleAutoCancel();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, order, busyAction]);

  const handleAutoCancel = useCallback(async () => {
    if (!orderId) return;
    try {
      await api.post(`/orders/${orderId}/cancel`, {
        reason: 'Hết thời gian chờ thanh toán trực tuyến PayOS (15 phút)',
      });
      toast.info(`Đơn hàng #${orderNumber} đã tự động hủy do hết hạn 15 phút chờ thanh toán.`);
      if (onCancelled) onCancelled(orderId, 'Hết hạn thanh toán');
      onClose();
    } catch {
      // Bỏ qua lỗi nếu đơn đã được xử lý ở backend
      onClose();
    }
  }, [orderId, orderNumber, onCancelled, onClose]);

  // 1. Thao tác Thanh toán lại qua PayOS
  const handleRetryPayment = async () => {
    if (!orderId) return;
    setBusyAction('retry');
    try {
      toast.info('Đang mở lại cổng thanh toán PayOS...');
      const isAllowedDomain =
        window.location.hostname === 'smartorder.vn' ||
        window.location.hostname.endsWith('.smartorder.vn');

      const payload: any = {
        orderId,
        amount: totalAmount,
        buyerName: order?.customerName,
        buyerPhone: order?.customerPhone,
      };

      if (isAllowedDomain) {
        payload.returnUrl = `${window.location.origin}/shop?payos_status=success&orderId=${encodeURIComponent(orderId)}`;
        payload.cancelUrl = `${window.location.origin}/shop?payos_status=cancelled&orderId=${encodeURIComponent(orderId)}`;
      }

      const response = await api.post('/payments/payos/create-link', payload);

      const checkoutUrl = response.data?.data?.checkoutUrl || response.data?.checkoutUrl;
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      throw new Error('PayOS chưa trả về đường dẫn thanh toán.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Không thể mở lại liên kết PayOS. Vui lòng thử lại.');
      setBusyAction(null);
    }
  };

  // 2. Thao tác Chuyển sang trả Tiền mặt khi nhận hàng (COD)
  const handleSwitchToCod = async () => {
    if (!orderId) return;
    setBusyAction('cod');
    try {
      await paymentsService.selectOrderPaymentMethod(orderId, 'COD');
      toast.success(
        `Đã chuyển đơn hàng #${orderNumber} sang hình thức Tiền mặt (COD)! Cửa hàng sẽ sớm chuẩn bị và giao hàng.`,
        { duration: 5000 }
      );
      if (onSwitchedToCod) onSwitchedToCod(orderId);
      onClose();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || 'Không thể chuyển sang hình thức tiền mặt lúc này. Vui lòng thử lại.'
      );
      setBusyAction(null);
    }
  };

  // 3. Thao tác Hủy đơn hàng chủ động
  const handleManualCancel = async () => {
    if (!orderId) return;
    const confirmCancel = window.confirm(
      `Bạn có chắc chắn muốn hủy đơn hàng #${orderNumber}? Các sản phẩm sẽ được hoàn lại kho ngay lập tức.`
    );
    if (!confirmCancel) return;

    setBusyAction('cancel');
    try {
      await api.post(`/orders/${orderId}/cancel`, {
        reason: 'Khách hàng hủy thanh toán trực tuyến PayOS',
      });
      toast.info(`Đã hủy đơn hàng #${orderNumber}. Sản phẩm đã được hoàn lại kho.`);
      if (onCancelled) onCancelled(orderId, 'Khách hàng hủy');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể hủy đơn hàng lúc này. Vui lòng liên hệ cửa hàng.');
      setBusyAction(null);
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && order && (
        <motion.div
          key="payos-cancel-recovery-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          onClick={() => {
            if (!busyAction) {
              toast.info('Đơn hàng vẫn đang ở trạng thái Chờ thanh toán. Bạn có thể mở lại trong mục Đơn hàng.');
              onClose();
            }
          }}
        >
          <motion.div
            key="payos-cancel-recovery-card"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payos-recovery-title"
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {/* Header với dải màu ấm amber/warning */}
            <div className="relative border-b border-amber-100/90 bg-gradient-to-r from-amber-50 via-orange-50/40 to-white px-5 py-5 sm:px-6 dark:border-amber-950/40 dark:from-amber-950/30 dark:via-zinc-900 dark:to-zinc-900">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200/80 shadow-xs dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-800/40">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 id="payos-recovery-title" className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                      Thanh toán PayOS chưa hoàn tất
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                      Bạn vừa rời cổng quét mã. Đơn hàng đang được giữ an toàn.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={() => {
                    toast.info('Đơn hàng vẫn đang ở trạng thái Chờ thanh toán. Bạn có thể mở lại trong mục Đơn hàng.');
                    onClose();
                  }}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  aria-label="Đóng"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Thân hộp thoại */}
            <div className="p-5 sm:p-6 space-y-4">
              {/* Thẻ tóm tắt đơn hàng & Bộ đếm ngược tự động hủy */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-800/50">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5 dark:border-zinc-700/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      Mã đơn
                    </span>
                    <span className="font-bold text-sm text-slate-800 dark:text-zinc-100">
                      #{orderNumber}
                    </span>
                  </div>

                  {/* Countdown Badge */}
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition ${
                      secondsRemaining <= 180
                        ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/50 dark:text-rose-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300'
                    }`}
                    title="Đơn hàng sẽ tự động hủy nếu không thanh toán hoặc chọn phương thức khác"
                  >
                    <Clock className="w-3.5 h-3.5 animate-pulse" />
                    <span>Tự hủy sau: <strong>{formatCountdown(secondsRemaining)}</strong></span>
                  </div>
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-xs text-slate-600 dark:text-zinc-400">Tổng thanh toán:</span>
                  <span className="text-lg font-black text-[#0E6BA8] dark:text-sky-400 tabular-nums">
                    {formatMoney(totalAmount)}
                  </span>
                </div>

                {order?.items && order.items.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500 dark:text-zinc-400 truncate">
                    Sản phẩm:{' '}
                    {order.items
                      .slice(0, 2)
                      .map((it) => `${it.quantity}× ${it.productName}`)
                      .join(', ')}
                    {order.items.length > 2 ? ` và ${order.items.length - 2} mặt hàng khác` : ''}
                  </div>
                )}
              </div>

              {/* Lời gợi ý hành động */}
              <p className="text-xs text-slate-600 dark:text-zinc-400">
                Để tránh lỡ đơn hàng của bạn, vui lòng chọn một trong các phương án dưới đây:
              </p>

              {/* Nhóm 3 nút lựa chọn theo chuẩn Shopee/Grab */}
              <div className="space-y-2.5">
                {/* Lựa chọn 1: Thanh toán lại qua PayOS */}
                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={handleRetryPayment}
                  className="group relative flex w-full items-center justify-between rounded-xl bg-[#0E6BA8] p-3.5 text-left text-white shadow-sm transition hover:bg-[#0B5586] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                      {busyAction === 'retry' ? (
                        <RefreshCw className="h-4 w-4 animate-spin text-white" />
                      ) : (
                        <RefreshCw className="h-4 w-4 text-white transition-transform duration-300 group-hover:rotate-180" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold">Thanh toán lại qua PayOS</div>
                      <div className="text-[11px] text-sky-100">
                        Mở lại mã VietQR để quét lại bằng ứng dụng ngân hàng
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-sky-200 transition-transform group-hover:translate-x-1" />
                </button>

                {/* Lựa chọn 2: Chuyển sang trả Tiền mặt khi nhận hàng (COD) */}
                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={handleSwitchToCod}
                  className="group relative flex w-full items-center justify-between rounded-xl border-2 border-emerald-500 bg-emerald-50/80 p-3.5 text-left transition hover:bg-emerald-100/90 hover:border-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-950/30 dark:border-emerald-700/60 dark:hover:bg-emerald-950/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-xs">
                      {busyAction === 'cod' ? (
                        <RefreshCw className="h-4 w-4 animate-spin text-white" />
                      ) : (
                        <Banknote className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-300 flex items-center gap-1.5">
                        <span>Đổi sang Tiền mặt khi nhận hàng (COD)</span>
                        <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                          Tiện lợi
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        Không cần quét mã, shipper giao đến tận nơi rồi mới thu tiền
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400 transition-transform group-hover:translate-x-1" />
                </button>

                {/* Lựa chọn 3: Hủy đơn hàng */}
                <div className="pt-1 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={!!busyAction}
                    onClick={handleManualCancel}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
                  >
                    {busyAction === 'cancel' ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    <span>Hủy đơn hàng này</span>
                  </button>

                  <button
                    type="button"
                    disabled={!!busyAction}
                    onClick={() => {
                      toast.info('Bạn có thể xem lại và thanh toán đơn hàng này trong mục "Đơn hàng của tôi".');
                      onClose();
                    }}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  >
                    Để tôi quyết định sau
                  </button>
                </div>
              </div>
            </div>

            {/* Footer chân hộp thoại với cam kết an toàn */}
            <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-center text-[11px] text-slate-400 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-500">
              Sản phẩm được tạm giữ để đảm bảo không bị người khác mua mất trong lúc chờ bạn quyết định.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
