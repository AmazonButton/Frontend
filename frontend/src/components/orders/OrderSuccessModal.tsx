import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X } from 'lucide-react';

export interface OrderSuccessModalProps {
  isOpen: boolean;
  order: any;
  secondsRemaining: number;
  onClose: () => void;
  onCancelOrder: (orderId: string) => void;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  isOpen,
  order,
  secondsRemaining,
  onClose,
  onCancelOrder,
}) => {
  if (!order) return null;

  const totalCancelWindow = (order as any).cancelWindowSeconds || 60;
  const progressPercent = Math.max(0, Math.min(100, (secondsRemaining / totalCancelWindow) * 100));

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="order-success-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-md"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Modal Card - Single, continuous pure white canvas */}
          <motion.div
            key="order-success-card"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-zinc-100/80 p-6 space-y-6 relative"
          >
            {/* Top Close Button (Subtle Ghost) */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>

            {/* PART 2: Success Header (Minimalist & Animated Delight) */}
            <div className="flex flex-col items-center text-center pt-1">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [0.8, 1.06, 1], opacity: 1 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100/80 flex items-center justify-center mb-3 shadow-inner"
              >
                <svg
                  className="w-8 h-8 text-emerald-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <motion.path
                    d="M20 6L9 17L4 12"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
                  />
                </svg>
              </motion.div>

              <h3 className="text-2xl font-bold tracking-tight text-zinc-900">
                Đặt hàng thành công
              </h3>
              <p className="font-mono text-zinc-500 text-sm mt-0.5">
                #{order.orderNumber || order.id?.slice(0, 8)}
              </p>
            </div>

            {/* PART 3: Digital Receipt Layout */}
            <div className="bg-zinc-50/50 border border-zinc-100 rounded-2xl p-4 space-y-3">
              {/* Order Items */}
              <div className="space-y-2">
                {order.items && order.items.length > 0 ? (
                  order.items.map((it: any, idx: number) => (
                    <div
                      key={it.id || it.productName || idx}
                      className="flex justify-between items-center text-sm"
                    >
                      <span className="text-zinc-600 font-medium truncate pr-3">
                        {it.quantity}× {it.productName}
                      </span>
                      <span className="font-mono font-semibold text-zinc-900 shrink-0">
                        {(it.totalPrice || it.price * it.quantity)?.toLocaleString('vi-VN')} ₫
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-600 font-medium">1× Đơn hàng Nút bấm</span>
                    <span className="font-mono font-semibold text-zinc-900 shrink-0">
                      {order.totalAmount?.toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                )}

                {/* Total */}
                <div className="flex justify-between items-center pt-2.5 border-t border-zinc-200/60 text-sm">
                  <span className="font-medium text-zinc-900">Tổng thanh toán</span>
                  <span className="font-mono font-bold text-base text-zinc-900">
                    {order.totalAmount?.toLocaleString('vi-VN')} ₫
                  </span>
                </div>
              </div>

              {/* Delivery Address */}
              {order.deliveryAddress && (
                <div className="pt-2.5 border-t border-zinc-200/50 flex items-start gap-2 text-xs text-zinc-500">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                  <span className="line-clamp-2 leading-relaxed">
                    {order.deliveryAddress}
                  </span>
                </div>
              )}
            </div>

            {/* PART 4: 60s Cancel UX & Actions */}
            <div className="space-y-3 pt-1">
              {secondsRemaining > 0 && (
                <div className="space-y-2.5">
                  {/* Sleek 2px progress bar shrinking over 60s */}
                  <div className="w-full bg-zinc-100 h-[2px] rounded-full overflow-hidden">
                    <motion.div
                      className="bg-rose-500 h-full rounded-full origin-left"
                      style={{ width: `${progressPercent}%` }}
                      transition={{ duration: 1, ease: 'linear' }}
                    />
                  </div>

                  {/* Subtle Ghost Cancel Button */}
                  <button
                    onClick={() => {
                      onCancelOrder(order.id);
                      onClose();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Hủy đơn hàng ({secondsRemaining}s)</span>
                  </button>
                </div>
              )}

              {/* Primary Action Button */}
              <button
                onClick={onClose}
                className="w-full py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold transition-all shadow-sm active:scale-[0.99] cursor-pointer"
              >
                Đã hiểu — Theo dõi đơn hàng
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
