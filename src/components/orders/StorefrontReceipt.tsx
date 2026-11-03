import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import { Order } from '../../types';
import { ShippingContact } from './ShippingContact';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export const StorefrontReceipt: React.FC<{ order: Order; onClose: () => void; loggedIn: boolean; paymentError?: string }> = ({ order, onClose, loggedIn, paymentError }) => {
  useBodyScrollLock(true);
  const awaitingPayment = order.paymentMethod === 'PAYOS' && order.paymentStatus !== 'PAID';
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="receipt-title" className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <button type="button" aria-label="Đóng xác nhận đơn hàng" onClick={onClose} className="absolute right-4 top-4 p-2 text-slate-500"><X className="h-5 w-5" /></button>
        <CheckCircle2 className="mb-3 h-9 w-9 text-emerald-600" />
        <h2 id="receipt-title" className="pr-8 text-xl font-bold">{awaitingPayment ? 'Đơn hàng chờ thanh toán' : 'Đặt hàng thành công'}</h2>
        <p className="mt-2 break-words text-sm text-slate-500">Mã đơn: <strong>{order.orderNumber}</strong></p>
        {paymentError && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{paymentError}</p>}
        <h3 className="mb-3 mt-5 font-semibold">Thông tin nhận hàng đã gửi đến cửa hàng</h3>
        <ShippingContact order={order} />
        <div className="my-4 space-y-2 border-y border-slate-200 py-4 text-sm dark:border-zinc-700">
          {order.items.map((item, index) => <p key={item.id || index}>{item.quantity} × {item.productName}</p>)}
          <p className="font-bold">Tổng tiền: {Number(order.totalAmount).toLocaleString('vi-VN')} ₫</p>
          <p>{awaitingPayment ? 'Vui lòng hoàn tất thanh toán PayOS trong lịch sử đơn hàng.' : order.paymentStatus === 'PAID' ? 'Đã thanh toán.' : 'Thanh toán tiền mặt khi nhận hàng (COD).'}</p>
        </div>
        {loggedIn ? <Link to="/customer/orders" onClick={onClose} className="block rounded-xl bg-[#287DA8] px-4 py-3 text-center font-semibold text-white">Theo dõi và quản lý đơn hàng</Link> : <p className="text-sm text-slate-500">Vui lòng giữ mã đơn và liên hệ cửa hàng khi cần thay đổi hoặc hủy đơn.</p>}
        <button type="button" onClick={onClose} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">Tiếp tục mua sắm</button>
      </section>
    </div>
  );
};
