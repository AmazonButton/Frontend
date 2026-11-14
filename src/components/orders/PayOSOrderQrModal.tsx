import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  ShieldAlert,
  Trash2,
  X,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { publishOrderEvent } from '../../services/order-events';
import { useSound } from '../../context/OrderSoundContext';
import { toast } from '../../context/ToastContext';

export interface PayOSOrderQrModalProps {
  isOpen: boolean;
  orderId: string | number;
  orderNumber?: string;
  amount: number;
  qrCode?: string;
  checkoutUrl?: string;
  paymentLinkId?: string;
  onClose: () => void;
  onSuccess: () => void;
  onCancelled: (orderId: string | number) => void;
}

const DEFAULT_TIMEOUT_SECONDS = 15 * 60; // 15 phút

const formatMoney = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);

const formatCountdown = (totalSeconds: number) => {
  const mins = Math.floor(Math.max(0, totalSeconds) / 60);
  const secs = Math.max(0, totalSeconds) % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const PayOSOrderQrModal: React.FC<PayOSOrderQrModalProps> = ({
  isOpen,
  orderId,
  orderNumber,
  amount,
  qrCode,
  checkoutUrl,
  paymentLinkId,
  onClose,
  onSuccess,
  onCancelled,
}) => {
  useBodyScrollLock(isOpen);
  const { playOrderChime } = useSound();

  const [secondsRemaining, setSecondsRemaining] = useState<number>(DEFAULT_TIMEOUT_SECONDS);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const isCheckingRef = useRef(false);
  const isPaidRef = useRef(false);

  const displayOrderCode = orderNumber || (orderId ? `DH${orderId}` : '---');

  // Đếm ngược 15 phút
  useEffect(() => {
    if (!isOpen || isPaid) return;
    setSecondsRemaining(DEFAULT_TIMEOUT_SECONDS);
    setShowConfirmCancel(false);
    setIsPaid(false);
    isPaidRef.current = false;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isPaid]);

  // Kiểm tra trạng thái đơn hàng (Polling và WebSocket)
  const verifyOrderPaid = useCallback(async () => {
    if (!orderId || isCheckingRef.current || isPaidRef.current) return;
    isCheckingRef.current = true;
    try {
      const res = await api.get(`/orders/${orderId}`);
      const orderData = res.data?.data || res.data;
      const status = orderData?.orderStatus || orderData?.status;
      const paymentStatus = orderData?.paymentStatus;

      if (paymentStatus === 'PAID' || ['CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED', 'COMPLETED'].includes(status)) {
        isPaidRef.current = true;
        setIsPaid(true);
        try { playOrderChime(); } catch {}
        toast.success(`Thanh toán đơn hàng #${displayOrderCode} thành công!`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1800);
      }
    } catch {
      // Ignored during polling
    } finally {
      isCheckingRef.current = false;
    }
  }, [orderId, displayOrderCode, onSuccess, onClose]);

  // Lắng nghe WebSocket sự kiện thanh toán
  useEffect(() => {
    if (!isOpen || isPaid) return;

    const socket = getSocket();

    const handlePaymentConfirmed = (payload: any) => {
      const pId = String(payload?.orderId || payload?.id || '');
      const pCode = String(payload?.orderNumber || payload?.orderCode || '');
      if (pId === String(orderId) || (displayOrderCode && pCode === displayOrderCode)) {
        isPaidRef.current = true;
        setIsPaid(true);
        try { playOrderChime(); } catch {}
        toast.success(`Thanh toán đơn hàng #${displayOrderCode} thành công!`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1800);
      }
    };

    socket.on('ORDER_PAYMENT_CONFIRMED', handlePaymentConfirmed);
    socket.on('ORDER_STATUS_CHANGED', handlePaymentConfirmed);

    // Polling dự phòng mỗi 2.5s
    const pollTimer = setInterval(() => {
      if (!isPaidRef.current && document.visibilityState === 'visible') {
        verifyOrderPaid();
      }
    }, 2500);

    return () => {
      socket.off('ORDER_PAYMENT_CONFIRMED', handlePaymentConfirmed);
      socket.off('ORDER_STATUS_CHANGED', handlePaymentConfirmed);
      clearInterval(pollTimer);
    };
  }, [isOpen, isPaid, orderId, displayOrderCode, verifyOrderPaid, onSuccess, onClose]);

  // Copy helper
  const handleCopy = (text: string, field: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.info(`Đã sao chép ${field}!`);
    } catch {
      toast.error('Không thể sao chép, vui lòng thử lại.');
    }
  };

  // Hủy thanh toán và hủy đơn hàng
  const handleCancelOrder = async () => {
    if (!orderId || isCancelling) return;
    setIsCancelling(true);
    try {
      await api.post(`/orders/${orderId}/cancel`, {
        reason: 'Khách hàng hủy thanh toán PayOS',
      });

      publishOrderEvent('ORDER_CANCELLED', {
        order: { id: orderId, orderNumber: displayOrderCode, status: 'CANCELLED' },
        reason: 'Khách hàng hủy thanh toán PayOS',
      });

      // Thử hủy liên kết PayOS nếu có paymentLinkId
      if (paymentLinkId) {
        try {
          await api.post(`/payments/payos/payment-requests/${paymentLinkId}/cancel`, {
            cancellationReason: 'Khách hàng hủy thanh toán trên web',
          });
        } catch {
          // Bỏ qua lỗi hủy link nếu link đã hết hạn hoặc không khả dụng
        }
      }

      toast.info(`Đã hủy đơn hàng #${displayOrderCode}. Cửa hàng đã được thông báo đơn hàng đã hủy.`);
      onCancelled(orderId);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể hủy đơn hàng lúc này. Vui lòng liên hệ cửa hàng.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="payos-qr-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
        onClick={() => {
          if (!isCancelling && !isPaid) {
            toast.info('Đơn hàng vẫn đang chờ thanh toán. Bạn có thể mở lại để thanh toán bất cứ lúc nào.');
            onClose();
          }
        }}
      >
        <motion.div
          key="payos-qr-card"
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', damping: 28, stiffness: 340 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100 dark:border-zinc-800 dark:bg-zinc-900"
        >
          {/* Header */}
          <div className="relative border-b border-sky-100 bg-gradient-to-r from-sky-50 via-blue-50/50 to-white px-5 py-4 dark:border-sky-950/40 dark:from-sky-950/30 dark:via-zinc-900 dark:to-zinc-900">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0E6BA8] text-white shadow-xs">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Quét mã QR PayOS
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Đơn hàng #{displayOrderCode}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isCancelling}
                onClick={() => {
                  toast.info('Đơn hàng vẫn đang ở trạng thái Chờ thanh toán.');
                  onClose();
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 space-y-5">
            {isPaid ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 animate-bounce dark:bg-emerald-950/50 dark:text-emerald-400">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Thanh toán thành công!
                </h3>
                <p className="text-sm text-slate-600 dark:text-zinc-300 max-w-xs">
                  Hệ thống đã xác nhận thanh toán cho đơn hàng #{displayOrderCode}. Đang làm mới trang...
                </p>
              </div>
            ) : (
              <>
                {/* Countdown & Amount */}
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 border border-slate-100 dark:bg-zinc-800/50 dark:border-zinc-800">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-zinc-400">Tổng thanh toán</span>
                    <p className="text-lg font-extrabold text-[#0E6BA8] dark:text-sky-400">
                      {formatMoney(amount)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200/70 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-300">
                    <Clock className="w-3.5 h-3.5 animate-pulse" />
                    <span>Hết hạn trong {formatCountdown(secondsRemaining)}</span>
                  </div>
                </div>

                {/* QR Code Frame */}
                <div className="flex flex-col items-center justify-center">
                  <div className="p-3.5 rounded-2xl bg-white border-2 border-dashed border-[#0E6BA8]/30 shadow-md dark:bg-white dark:border-sky-500/40">
                    {qrCode ? (
                      <QRCodeSVG
                        value={qrCode}
                        size={210}
                        level="M"
                        includeMargin={false}
                      />
                    ) : (
                      <div className="w-[210px] h-[210px] flex flex-col items-center justify-center text-slate-400 text-xs">
                        <Loader2 className="w-8 h-8 animate-spin text-[#0E6BA8] mb-2" />
                        <span>Đang tải mã QR PayOS...</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 font-medium">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Mở ứng dụng Ngân hàng hoặc Ví để quét mã VietQR</span>
                  </div>
                </div>

                {/* Transfer Info */}
                <div className="space-y-2 rounded-xl bg-slate-50/70 p-3.5 border border-slate-100 text-xs text-slate-600 dark:bg-zinc-800/40 dark:border-zinc-800 dark:text-zinc-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-zinc-400">Nội dung chuyển khoản:</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(displayOrderCode, 'nội dung chuyển khoản')}
                      className="inline-flex items-center gap-1 font-semibold text-slate-800 hover:text-[#0E6BA8] transition dark:text-zinc-200"
                    >
                      <span>{displayOrderCode}</span>
                      {copiedField === 'nội dung chuyển khoản' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-zinc-400">Số tiền:</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(String(amount), 'số tiền')}
                      className="inline-flex items-center gap-1 font-semibold text-slate-800 hover:text-[#0E6BA8] transition dark:text-zinc-200"
                    >
                      <span>{formatMoney(amount)}</span>
                      {copiedField === 'số tiền' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Cancel Confirmation View */}
                {showConfirmCancel ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 space-y-3 dark:border-rose-900/60 dark:bg-rose-950/30">
                    <div className="flex items-start gap-2 text-rose-800 dark:text-rose-300">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p className="text-xs leading-5">
                        Bạn có chắc chắn muốn hủy đơn hàng <strong>#{displayOrderCode}</strong>? Hệ thống sẽ hủy đơn thật sự và thông báo ngay về cho các cửa hàng.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        disabled={isCancelling}
                        onClick={() => setShowConfirmCancel(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        Quay lại thanh toán
                      </button>
                      <button
                        type="button"
                        disabled={isCancelling}
                        onClick={handleCancelOrder}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-xs transition disabled:opacity-50"
                      >
                        {isCancelling ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        Xác nhận hủy đơn
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Action Buttons */
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowConfirmCancel(true)}
                      disabled={isCancelling}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl border border-rose-200 bg-white text-xs font-semibold text-rose-600 transition hover:bg-rose-50 hover:border-rose-300 dark:bg-zinc-900 dark:border-rose-900/70 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="w-4 h-4" />
                      Hủy thanh toán & Hủy đơn hàng
                    </button>

                    {checkoutUrl && (
                      <div className="flex items-center justify-between pt-1">
                        <a
                          href={checkoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#0E6BA8] hover:underline dark:text-sky-400"
                        >
                          <span>Mở trang PayOS trong tab mới</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <span className="text-[11px] text-slate-400">Tự động nhận diện sau khi chuyển</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
