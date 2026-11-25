import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import type { MarketplaceCheckoutResult } from '../../services/marketplace-checkout';
import { STORE_ORDER_BLOCKED_CODES } from '../../services/marketplace-checkout';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export function MarketplaceReceipt({
  result,
  onClose,
  onPayOrder,
  onRemoveStore,
}: {
  result: MarketplaceCheckoutResult;
  onClose: () => void;
  onPayOrder?: (order: any) => void;
  onRemoveStore?: (storeId: string) => void;
}) {
  useBodyScrollLock(true);
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-900/50 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="marketplace-receipt-title" className="relative my-auto max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <button type="button" onClick={onClose} aria-label="Đóng kết quả đặt hàng" className="absolute right-4 top-4 p-2 text-slate-500"><X size={20} /></button>
        <CheckCircle2 className="mb-3 text-emerald-600" size={36} />
        <h2 id="marketplace-receipt-title" className="pr-8 text-xl font-bold">{result.placed.length ? `Đã tạo ${result.placed.length} đơn hàng` : 'Chưa xác nhận được đơn hàng'}</h2>
        <p className="mt-2 text-sm text-slate-600">Mỗi cửa hàng nhận và xử lý đơn của mình. Bạn có thể theo dõi, thanh toán hoặc hủy từng đơn trong lịch sử đơn hàng.</p>
        <div className="my-5 space-y-3">
          {result.placed.map(({ storeId, storeName, order }) => (
            <div key={storeId} className="rounded-xl border border-slate-200 p-4 text-sm">
              <p className="font-semibold">{storeName}</p>
              <p className="mt-1 text-slate-500">Mã đơn: {order.orderNumber || order.orderCode || order.id || order.orderId}</p>
              <p className="mt-2 font-bold text-[#287DA8]">{Number(order.totalAmount).toLocaleString('vi-VN')} ₫</p>
              <p className="mt-1 text-slate-600">{order.paymentMethod === 'PAYOS' ? 'Chờ thanh toán PayOS riêng cho đơn này.' : 'Thanh toán khi nhận hàng (COD).'}</p>
              {order.paymentMethod === 'PAYOS' && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {onPayOrder && (
                    <button
                      type="button"
                      onClick={() => onPayOrder(order)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#287DA8] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#206588]"
                    >
                      Quét mã QR PayOS
                    </button>
                  )}
                  <Link
                    to={`/customer/orders?orderId=${encodeURIComponent(order.id || order.orderId)}`}
                    onClick={onClose}
                    className="inline-block text-xs font-semibold text-[#287DA8] underline"
                  >
                    Xem chi tiết trong lịch sử đơn
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
        {result.failed.length > 0 && <div role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{result.failed.length} cửa hàng chưa xác nhận đặt hàng</p>
          <div className="mt-2 space-y-2.5">
            {result.failed.map((failure) => {
              const isBlockedOrExpired = Boolean(failure.errorCode && STORE_ORDER_BLOCKED_CODES.has(failure.errorCode));
              return (
                <div key={failure.storeId} className="rounded-lg border border-amber-200/80 bg-white/80 p-3">
                  <p className="font-semibold text-amber-950">{failure.storeName}</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900">{failure.message}</p>
                  {isBlockedOrExpired && onRemoveStore && (
                    <button
                      type="button"
                      onClick={() => onRemoveStore(failure.storeId)}
                      className="mt-2 inline-flex items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Xóa sản phẩm của cửa hàng khỏi giỏ
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 text-xs">Các sản phẩm chưa đặt được vẫn đang nằm trong giỏ. Nếu cửa hàng đã ngừng bán hoặc hết hạn gói, hãy bấm xóa nhanh khỏi giỏ hàng.</p>
        </div>}
        <Link to="/customer/orders" onClick={onClose} className="block rounded-xl bg-[#287DA8] px-4 py-3 text-center font-semibold text-white">Theo dõi và thanh toán các đơn</Link>
        <button type="button" onClick={onClose} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm">{result.failed.length ? 'Quay lại giỏ hàng' : 'Tiếp tục mua sắm'}</button>
      </section>
    </div>
  );
}
