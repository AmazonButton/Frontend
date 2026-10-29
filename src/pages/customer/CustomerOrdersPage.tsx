// @refresh reset
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Banknote,
  CreditCard,
  MapPin,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
} from 'lucide-react';
import { api } from '../../services/api';
import { paymentsService } from '../../services/payments.service';
import { toast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { getSocket, subscribeToCustomer } from '../../services/socket';
import { Order } from '../../types';
import { normalizeOrder, ORDER_EVENT, publishOrderEvent } from '../../services/order-events';
import { ShippingContact } from '../../components/orders/ShippingContact';

type OrderFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
const ORDERS_PER_PAGE = 8;

const statusMeta: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  PENDING: { label: 'Chờ xác nhận', badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock3 },
  CONFIRMED: { label: 'Đã tiếp nhận', badge: 'bg-sky-50 text-sky-700 border-sky-200', icon: PackageCheck },
  PREPARING: { label: 'Đang chuẩn bị', badge: 'bg-violet-50 text-violet-700 border-violet-200', icon: PackageCheck },
  OUT_FOR_DELIVERY: { label: 'Đang giao', badge: 'bg-blue-50 text-blue-700 border-blue-200', icon: Truck },
  SHIPPING: { label: 'Đang giao', badge: 'bg-blue-50 text-blue-700 border-blue-200', icon: Truck },
  COMPLETED: { label: 'Đã giao', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: PackageCheck },
  CANCELLED: { label: 'Đã hủy', badge: 'bg-rose-50 text-rose-700 border-rose-200', icon: CircleAlert },
  REJECTED: { label: 'Không thể xử lý', badge: 'bg-rose-50 text-rose-700 border-rose-200', icon: CircleAlert },
};

const isActiveOrder = (status: string) => ['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'SHIPPING'].includes(status);

const formatPrice = (value: number) => `${(value || 0).toLocaleString('vi-VN')} ₫`;

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export const CustomerOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderFilter>('ALL');
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSwitchingCod, setIsSwitchingCod] = useState<string | null>(null);
  const orderRequests = useRef({ generation: 0, flight: null as Promise<void> | null, queued: false });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('orderId')) setExpandedOrder(params.get('orderId'));
    if (params.get('order')) { setQuery(params.get('order') || ''); setFilter('ALL'); }
  }, [location.search]);

  const loadOrders = useCallback(async (initial = false) => {
    const requests = orderRequests.current;
    if (requests.flight) {
      requests.queued = true;
      return requests.flight;
    }
    const generation = requests.generation;
    if (initial) setIsLoading(true);
    else setIsRefreshing(true);

    const fetchLatest = async () => {
      do {
        requests.queued = false;
        try {
          const response = await api.get('/orders');
          const data = response.data?.data ?? response.data;
          if (!Array.isArray(data)) throw new Error('Invalid order list');
          if (requests.generation !== generation) return;
          setOrders(data.map(normalizeOrder));
          setError(null);
        } catch {
          if (requests.generation !== generation) return;
          setError(initial ? 'Không thể tải danh sách đơn hàng. Vui lòng thử lại.' : 'Chưa cập nhật được đơn hàng. Dữ liệu hiện có vẫn được giữ lại.');
          return;
        }
      } while (requests.queued && requests.generation === generation);
    };

    const flight = fetchLatest();
    requests.flight = flight;
    try {
      await flight;
    } finally {
      if (requests.generation === generation) {
        requests.flight = null;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadOrders(true);

    const customerId = user?.customerProfileId || (user?.role === 'CUSTOMER' ? user?.id : undefined);
    if (customerId) {
      subscribeToCustomer(customerId);
    }

    const socket = getSocket();

    const handleStatusChanged = (payload: any) => {
      loadOrders();
    };

    const handleOrderCreated = () => {
      loadOrders();
    };

    const handleOrderCancelled = () => {
      loadOrders();
    };

    const handlePaymentConfirmed = (payload: any) => {
      loadOrders();
      const orderNum = payload?.orderNumber || payload?.orderCode || '';
      if (orderNum) {
        toast.success(`Thanh toán đơn hàng #${orderNum} đã được xác nhận thành công!`);
      }
    };

    socket.on('ORDER_STATUS_CHANGED', handleStatusChanged);
    socket.on('ORDER_CREATED', handleOrderCreated);
    socket.on('ORDER_CANCELLED', handleOrderCancelled);
    socket.on('ORDER_PAYMENT_CONFIRMED', handlePaymentConfirmed);
    socket.on('ORDER_DELIVERED', handleStatusChanged);
    window.addEventListener(ORDER_EVENT, handleOrderCreated);
    window.addEventListener('focus', handleOrderCreated);

    return () => {
      orderRequests.current.generation += 1;
      orderRequests.current.flight = null;
      orderRequests.current.queued = false;
      socket.off('ORDER_STATUS_CHANGED', handleStatusChanged);
      socket.off('ORDER_CREATED', handleOrderCreated);
      socket.off('ORDER_CANCELLED', handleOrderCancelled);
      socket.off('ORDER_PAYMENT_CONFIRMED', handlePaymentConfirmed);
      socket.off('ORDER_DELIVERED', handleStatusChanged);
      window.removeEventListener(ORDER_EVENT, handleOrderCreated);
      window.removeEventListener('focus', handleOrderCreated);
    };
  }, [loadOrders, user?.id, user?.role, user?.customerProfileId]);

  const getOrderStatus = (o: any) => o?.status || o?.orderStatus || 'PENDING';

  const confirmCancellation = async () => {
    if (!orderToCancel) return;

    setIsCancelling(true);
    const targetId = orderToCancel.id || (orderToCancel as any).orderId;
    const targetCode = orderToCancel.orderNumber || (orderToCancel as any).orderCode || targetId;
    try {
      const response = await api.post(`/orders/${targetId}/cancel`, {
        reason: 'Khách hàng hủy đơn khi chưa hoàn tất thanh toán/tiếp nhận',
      });
      const updatedOrder = response.data?.data;
      publishOrderEvent('ORDER_CANCELLED', {
        order: updatedOrder || { ...orderToCancel, status: 'CANCELLED' },
        reason: 'Khách hàng hủy đơn khi chưa hoàn tất thanh toán/tiếp nhận',
      });
      setOrders((current) => current.map((order) => {
        const oId = order.id || (order as any).orderId;
        return oId === targetId
          ? { ...order, ...updatedOrder, status: 'CANCELLED', orderStatus: 'CANCELLED' }
          : order;
      }));
      setExpandedOrder(null);
      setOrderToCancel(null);
    } catch (requestError: any) {
      toast.error(requestError.response?.data?.message || 'Không thể hủy đơn hàng lúc này.');
      await loadOrders();
    } finally {
      setIsCancelling(false);
    }
  };

  const summary = useMemo(() => ({
    total: orders.length,
    active: orders.filter((order) => isActiveOrder(getOrderStatus(order))).length,
    completed: orders.filter((order) => getOrderStatus(order) === 'COMPLETED').length,
  }), [orders]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
    return orders.filter((order) => {
      const currentStatus = getOrderStatus(order);
      const filterMatches =
        filter === 'ALL' ||
        (filter === 'ACTIVE' && isActiveOrder(currentStatus)) ||
        (filter === 'COMPLETED' && currentStatus === 'COMPLETED') ||
        (filter === 'CANCELLED' && ['CANCELLED', 'REJECTED'].includes(currentStatus));
      const searchMatches = !normalizedQuery || [
        order.orderNumber,
        order.deliveryAddress,
        ...order.items.map((item) => item.productName),
      ].some((value) => value?.toLocaleLowerCase('vi-VN').includes(normalizedQuery));
      return filterMatches && searchMatches;
    });
  }, [filter, orders, query]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
  const paginatedOrders = useMemo(() => {
    const offset = (currentPage - 1) * ORDERS_PER_PAGE;
    return filteredOrders.slice(offset, offset + ORDERS_PER_PAGE);
  }, [currentPage, filteredOrders]);

  const pageItems = useMemo<Array<number | 'ellipsis'>>(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const aroundCurrent = [currentPage - 1, currentPage, currentPage + 1].filter((page) => page > 1 && page < totalPages);
    return [1, ...(aroundCurrent[0] > 2 ? ['ellipsis' as const] : []), ...aroundCurrent, ...(aroundCurrent.at(-1)! < totalPages - 1 ? ['ellipsis' as const] : []), totalPages];
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, query]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const filters: Array<{ id: OrderFilter; label: string; count: number }> = [
    { id: 'ALL', label: 'Tất cả', count: summary.total },
    { id: 'ACTIVE', label: 'Đang xử lý', count: summary.active },
    { id: 'COMPLETED', label: 'Đã giao', count: summary.completed },
    { id: 'CANCELLED', label: 'Đã hủy', count: orders.filter((order) => ['CANCELLED', 'REJECTED'].includes(getOrderStatus(order))).length },
  ];

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-11">
      <section className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#287DA8]">
            <ReceiptText className="w-3.5 h-3.5" />
            Trung tâm đơn hàng
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Đơn hàng của tôi</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">Theo dõi đơn đang giao và xem lại mọi lần đặt hàng của bạn.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadOrders()}
          disabled={isLoading || isRefreshing}
          className="inline-flex self-start sm:self-auto items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isRefreshing ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
        {[
          { label: 'Tổng đơn hàng', value: summary.total, note: 'Từ lần đặt đầu tiên', icon: ReceiptText, tone: 'text-[#287DA8] bg-[#287DA8]/10' },
          { label: 'Đang xử lý', value: summary.active, note: 'Cần theo dõi', icon: Truck, tone: 'text-amber-600 bg-amber-50' },
          { label: 'Đã giao thành công', value: summary.completed, note: 'Đơn đã hoàn tất', icon: PackageCheck, tone: 'text-emerald-600 bg-emerald-50' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-slate-200/80 bg-white px-4 py-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">{item.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{item.value}</p>
                </div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.tone}`}><Icon className="w-4.5 h-4.5" /></div>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">{item.note}</p>
            </div>
          );
        })}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 min-w-0 overflow-x-auto pb-1 lg:pb-0">
              <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
              {filters.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filter === item.id
                    ? 'bg-[#0E6BA8] text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'}`}
                >
                  {item.label}
                  <span className={`text-[10px] ${filter === item.id ? 'text-white/75' : 'text-slate-400'}`}>{item.count}</span>
                </button>
              ))}
            </div>
            <label className="relative block w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm mã đơn hoặc sản phẩm"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#287DA8] focus:bg-white focus:ring-3 focus:ring-[#287DA8]/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          {!isLoading && error && orders.length > 0 && <p role="status" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{error}</p>}
          {isLoading ? (
            <div className="py-20 flex flex-col items-center text-center">
              <RefreshCw className="w-5 h-5 text-[#287DA8] animate-spin" />
              <p className="mt-3 text-sm font-medium text-slate-600 dark:text-zinc-300">Đang tải đơn hàng của bạn</p>
            </div>
          ) : error && orders.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center">
              <CircleAlert className="w-8 h-8 text-rose-400" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-zinc-200">{error}</p>
              <button type="button" onClick={() => void loadOrders(true)} className="mt-4 text-xs font-semibold text-[#0E6BA8] hover:text-[#0B5586]">Thử lại</button>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center dark:bg-zinc-800"><ShoppingBag className="w-5 h-5 text-slate-400" /></div>
              <p className="mt-4 text-sm font-semibold text-slate-700 dark:text-zinc-200">Không tìm thấy đơn hàng phù hợp</p>
              <p className="mt-1 text-xs text-slate-400">Hãy điều chỉnh bộ lọc hoặc đặt đơn đầu tiên từ nút thông minh.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {paginatedOrders.map((order, index) => {
                const currentStatus = getOrderStatus(order);
                const meta = statusMeta[currentStatus] || { label: currentStatus, badge: 'bg-slate-50 text-slate-600 border-slate-200', icon: Clock3 };
                const StatusIcon = meta.icon;
                const isExpanded = expandedOrder === order.id;

                const isCancelled = ['CANCELLED', 'REJECTED'].includes(currentStatus);
                const isUnpaid = !isCancelled && (order.paymentStatus === 'UNPAID' || (order.paymentStatus !== 'PAID' && order.paymentMethod !== 'COD' && order.paymentMethod !== 'CASH_ON_DELIVERY'));
                const canCancel = !isCancelled && (
                  isUnpaid || ['PENDING', 'CONFIRMED'].includes(currentStatus)
                );
                const canPayNow = isUnpaid && order.paymentMethod === 'PAYOS';
                const itemSummary = order.items.slice(0, 2).map((item) => `${item.quantity}× ${item.productName}`).join(', ');
                return (
                  <motion.article key={order.id || order.orderNumber || index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.035, 0.22) }}>
                    <button
                      type="button"
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      className="w-full px-2 sm:px-3 py-4 text-left rounded-xl transition hover:bg-slate-50/80 dark:hover:bg-zinc-800/60"
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="hidden sm:flex mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-slate-100 items-center justify-center dark:bg-zinc-800"><ShoppingBag className="w-4 h-4 text-slate-500" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">#{order.orderNumber}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}><StatusIcon className="w-3 h-3" />{meta.label}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400 truncate">{itemSummary}{order.items.length > 2 ? ` và ${order.items.length - 2} sản phẩm khác` : ''}</p>
                          <p className="mt-1.5 text-[11px] text-slate-400 tabular-nums">{formatDate(order.createdAt)}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2 sm:gap-3">
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-900 tabular-nums dark:text-white">{formatPrice(order.totalAmount)}</p>
                            <p className={`mt-1 text-[10px] ${isUnpaid ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                              {isCancelled ? 'Đơn đã hủy · Không cần thanh toán' : order.paymentStatus === 'PAID' ? 'Đã thanh toán' : (order.paymentMethod === 'COD' || order.paymentMethod === 'CASH_ON_DELIVERY') ? 'Chờ thanh toán (Tiền mặt khi nhận)' : 'Chờ thanh toán (PayOS)'}
                            </p>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                    </button>
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                          <div className="mx-2 sm:mx-3 mb-4 rounded-xl bg-slate-50/80 border border-slate-100 p-4 dark:bg-zinc-800/50 dark:border-zinc-700">
                            <div className="grid md:grid-cols-[1fr_auto] gap-5">
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Sản phẩm</p>
                                <div className="mt-2.5 space-y-2">
                                  {order.items.map((item, itemIdx) => (
                                    <div
                                      key={item.id || (item as any).orderItemId || `${item.productId || 'item'}-${itemIdx}`}
                                      className="flex justify-between gap-4 text-xs"
                                    >
                                      <span className="text-slate-600 dark:text-zinc-300">{item.quantity}× {item.productName}</span>
                                      <span className="font-semibold tabular-nums text-slate-800 dark:text-zinc-100">{formatPrice(item.totalPrice)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="md:w-64 space-y-3 text-xs">
                                <ShippingContact order={order} />
                                {isCancelled && order.cancellationReason && <p className="text-rose-600">Lý do hủy: {order.cancellationReason}</p>}
                                <div className="flex gap-2 text-slate-500 dark:text-zinc-400"><CreditCard className="w-3.5 h-3.5 shrink-0 text-slate-400" /><span>{isCancelled ? 'Đơn đã hủy, không phát sinh thanh toán' : ['COD', 'CASH_ON_DELIVERY'].includes(order.paymentMethod as string) ? (order.paymentStatus === 'PAID' ? 'Đã thu tiền mặt khi nhận hàng' : 'Tiền mặt khi nhận hàng (Chờ thanh toán)') : order.paymentStatus === 'PAID' ? 'Đã thanh toán trực tuyến qua PayOS' : 'Thanh toán trực tuyến PayOS (Chờ thanh toán)'}</span></div>
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-200/70 flex justify-between text-sm font-bold text-slate-900 dark:border-zinc-700 dark:text-white"><span>Tổng thanh toán</span><span className="tabular-nums">{formatPrice(order.totalAmount)}</span></div>
                            {(canCancel || canPayNow) && (
                              <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <p className="text-[11px] text-slate-400">
                                  {isUnpaid
                                    ? 'Đơn hàng chưa hoàn tất thanh toán. Bạn có thể thanh toán ngay hoặc hủy đơn hàng.'
                                    : 'Đơn hàng đang chờ xử lý, bạn vẫn có thể hủy đơn nếu muốn thay đổi.'}
                                </p>
                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                  {canPayNow && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={async (event) => {
                                          event.stopPropagation();
                                          try {
                                            toast.info('Đang mở liên kết thanh toán PayOS...');
                                            const res = await api.post('/payments/payos/create-link', {
                                              orderId: order.id || (order as any).orderId,
                                            });
                                            const checkoutUrl = res.data?.data?.checkoutUrl || res.data?.checkoutUrl;
                                            if (checkoutUrl) {
                                              window.location.href = checkoutUrl;
                                            } else {
                                              toast.error('Không tìm thấy liên kết thanh toán.');
                                            }
                                          } catch (err: any) {
                                            toast.error(err.response?.data?.message || 'Không thể tạo liên kết thanh toán PayOS.');
                                          }
                                        }}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0E6BA8] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0B5586]"
                                      >
                                        <CreditCard className="w-3.5 h-3.5" />
                                        Thanh toán lại
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isSwitchingCod === (order.id || (order as any).orderId)}
                                        onClick={async (event) => {
                                          event.stopPropagation();
                                          const oId = String(order.id || (order as any).orderId);
                                          const oCode = order.orderNumber || oId;
                                          setIsSwitchingCod(oId);
                                          try {
                                            await paymentsService.selectOrderPaymentMethod(oId, 'COD');
                                            toast.success(`Đã chuyển đơn hàng #${oCode} sang thanh toán Tiền mặt (COD)! Cửa hàng sẽ chuẩn bị đơn hàng.`);
                                            await loadOrders();
                                          } catch (err: any) {
                                            toast.error(err.response?.data?.message || 'Không thể đổi sang tiền mặt lúc này.');
                                          } finally {
                                            setIsSwitchingCod(null);
                                          }
                                        }}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 hover:border-emerald-400 disabled:opacity-60 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                      >
                                        {isSwitchingCod === (order.id || (order as any).orderId) ? (
                                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Banknote className="w-3.5 h-3.5" />
                                        )}
                                        Đổi sang Tiền mặt (COD)
                                      </button>
                                    </>
                                  )}
                                  {canCancel && (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setOrderToCancel(order);
                                      }}
                                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 hover:border-rose-300 dark:bg-zinc-900 dark:border-rose-900/70 dark:text-rose-400 dark:hover:bg-rose-950/30"
                                    >
                                      <CircleAlert className="w-3.5 h-3.5" />
                                      Hủy đơn hàng
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.article>
                );
              })}
            </div>
          )}
          {!isLoading && !error && filteredOrders.length > 0 && totalPages > 1 && (
            <nav aria-label="Phân trang đơn hàng" className="mt-4 flex flex-wrap items-center justify-center gap-1 border-t border-slate-100 pt-4 dark:border-zinc-800 sm:justify-end">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Trước</span>
              </button>
              {pageItems.map((item, index) => item === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="grid min-h-9 w-8 place-items-center text-xs text-slate-400">…</span>
              ) : (
                <button
                  type="button"
                  key={item}
                  onClick={() => setCurrentPage(item)}
                  aria-current={currentPage === item ? 'page' : undefined}
                  className={`min-h-9 min-w-9 rounded-lg px-2 text-xs font-semibold transition ${currentPage === item ? 'bg-[#0E6BA8] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}
                >
                  {item}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <span>Sau</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </nav>
          )}
        </div>
      </section>

      <AnimatePresence>
        {orderToCancel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm"
            onMouseDown={() => !isCancelling && setOrderToCancel(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 360, damping: 27 }}
              onMouseDown={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-order-title"
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center dark:bg-rose-950/35 dark:text-rose-400"><CircleAlert className="w-5 h-5" /></div>
              <h2 id="cancel-order-title" className="mt-4 text-lg font-bold tracking-tight text-slate-900 dark:text-white">Hủy đơn hàng?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-zinc-400">Bạn sắp hủy đơn <span className="font-semibold text-slate-700 dark:text-zinc-200">#{orderToCancel.orderNumber}</span>. Thao tác này không thể hoàn tác.</p>
              <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button type="button" disabled={isCancelling} onClick={() => setOrderToCancel(null)} className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800">Giữ lại đơn</button>
                <button type="button" disabled={isCancelling} onClick={confirmCancellation} className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-rose-600 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60">
                  {isCancelling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Xác nhận hủy đơn
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
};
