import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, QrCode, X } from 'lucide-react';
import { Order } from '../../types';
import { ShippingContact } from './ShippingContact';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export const StorefrontReceipt: React.FC<{
  order: Order;
  onClose: () => void;
  loggedIn: boolean;
  paymentError?: string;
  onPayAhead?: (order: Order) => void;
}> = ({ order, onClose, loggedIn, paymentError, onPayAhead }) => {
  useBodyScrollLock(true);
  const isPaid = ['PAID', 'COMPLETED', 'SUCCESS', 'SUCCEEDED'].includes(String(order.paymentStatus || '').toUpperCase());
  const awaitingPayment = order.paymentMethod === 'PAYOS' && !isPaid;
  const isUnpaidCod = order.paymentMethod === 'CASH_ON_DELIVERY' && !isPaid;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 responsive-modal overflow-y-auto">
      <section role="dialog" aria-modal="true" aria-labelledby="receipt-title" className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <button type="button" aria-label="Đóng xác nhận đơn hàng" onClick={onClose} className="absolute right-4 top-4 p-2 text-slate-500"><X className="h-5 w-5" /></button>
        <CheckCircle2 className="mb-3 h-9 w-9 text-emerald-600" />
        <h2 id="receipt-title" className="pr-8 text-xl font-bold">{awaitingPayment ? 'Đơn hàng chờ thanh toán' : isPaid ? 'Đơn hàng thanh toán thành công' : 'Đặt hàng thành công'}</h2>
        <p className="mt-2 break-words text-sm text-slate-500">Mã đơn: <strong>{order.orderNumber}</strong></p>
        {paymentError && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{paymentError}</p>}
        <h3 className="mb-3 mt-5 font-semibold">Thông tin nhận hàng đã gửi đến cửa hàng</h3>
        <ShippingContact order={order} />
        <div className="my-4 space-y-2 border-y border-slate-200 py-4 text-sm dark:border-zinc-700">
          {order.items.map((item, index) => <p key={item.id || index}>{item.quantity} × {item.productName}</p>)}
          <p className="font-bold">Tổng tiền: {Number(order.totalAmount).toLocaleString('vi-VN')} ₫</p>
          <div className="pt-1">
            {awaitingPayment ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                Chờ thanh toán PayOS
              </span>
            ) : isPaid ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                ✓ Đã thanh toán thành công (PayOS)
              </span>
            ) : (
              <span className="text-slate-600 dark:text-zinc-400">
                Thanh toán tiền mặt khi nhận hàng (COD).
              </span>
            )}
          </div>
          {onPayAhead && loggedIn && (isUnpaidCod || awaitingPayment) && (
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/80 p-3 dark:border-sky-900/60 dark:bg-sky-950/30">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-sky-900 dark:text-sky-200">
                  {isUnpaidCod ? 'Thanh toán trước không cần tiền mặt?' : 'Quét mã VietQR để thanh toán'}
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-sky-200/70 px-1.5 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-900 dark:text-sky-300">
                  <QrCode className="h-3 w-3" /> VietQR
                </span>
              </div>
              <button
                type="button"
                onClick={() => onPayAhead(order)}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#287DA8] px-3 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#206588] transition cursor-pointer"
              >
                <QrCode className="h-4 w-4" /> Quét mã QR PayOS trả trước ngay
              </button>
            </div>
          )}
        </div>
        {loggedIn ? <Link to="/customer/orders" onClick={onClose} className="block rounded-xl bg-[#287DA8] px-4 py-3 text-center font-semibold text-white">Theo dõi và quản lý đơn hàng</Link> : <p className="text-sm text-slate-500">Vui lòng giữ mã đơn và liên hệ cửa hàng khi cần thay đổi hoặc hủy đơn.</p>}
        <button type="button" onClick={onClose} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">Tiếp tục mua sắm</button>
      </section>
    </div>
  );
};
