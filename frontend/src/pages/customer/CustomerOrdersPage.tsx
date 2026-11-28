// @refresh reset
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CheckCircle2,
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
  Camera,
  RotateCcw,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { mediaService } from '../../services/media.service';
import { paymentsService } from '../../services/payments.service';
import { toast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/OrderSoundContext';
import { getSocket, subscribeToCustomer } from '../../services/socket';
import { Order } from '../../types';
import { normalizeOrder, ORDER_EVENT, publishOrderEvent } from '../../services/order-events';
import { dashboardOrderStatus, isActiveDashboardOrder, orderDashboardMetrics } from '../../services/dashboard-metrics';
import { useDashboardRefresh } from '../../hooks/useDashboardRefresh';
import { ShippingContact } from '../../components/orders/ShippingContact';
import { PayOSOrderQrModal } from '../../components/orders/PayOSOrderQrModal';

type OrderFilter = 'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
const ORDERS_PER_PAGE = 8;

const statusMeta: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  PENDING: { label: 'Chờ xác nhận', badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock3 },
  CONFIRMED: { label: 'Đã tiếp nhận', badge: 'bg-sky-50 text-sky-700 border-sky-200', icon: PackageCheck },
  PREPARING: { label: 'Đang chuẩn bị', badge: 'bg-violet-50 text-violet-700 border-violet-200', icon: PackageCheck },
  OUT_FOR_DELIVERY: { label: 'Đang giao', badge: 'bg-blue-50 text-blue-700 border-blue-200', icon: Truck },
  READY_FOR_DELIVERY: { label: 'Sẵn sàng giao', badge: 'bg-blue-50 text-blue-700 border-blue-200', icon: PackageCheck },
  SHIPPING: { label: 'Đang giao', badge: 'bg-blue-50 text-blue-700 border-blue-200', icon: Truck },
  DELIVERY_FAILED: { label: 'Giao hàng thất bại', badge: 'bg-rose-50 text-rose-700 border-rose-200', icon: CircleAlert },
  COMPLETED: { label: 'Đã giao', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: PackageCheck },
  CANCELLED: { label: 'Đã hủy', badge: 'bg-rose-50 text-rose-700 border-rose-200', icon: CircleAlert },
  REJECTED: { label: 'Không thể xử lý', badge: 'bg-rose-50 text-rose-700 border-rose-200', icon: CircleAlert },
};

const isActiveOrder = isActiveDashboardOrder;

const formatPrice = (value: number) => `${(value || 0).toLocaleString('vi-VN')} ₫`;

const viOrderDateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const formatDate = (value: string) => viOrderDateTimeFormatter.format(new Date(value));

export const CustomerOrdersPage: React.FC = () => {
  const { playOrderChime } = useSound();
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage?.getItem('sob_cached_cust_orders') || window.sessionStorage?.getItem('sob_cached_cust_orders');
        if (raw) {
          const p = JSON.parse(raw);
          if (Array.isArray(p) && p.length > 0) return p.map(normalizeOrder);
        }
      }
    } catch {}
    return [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage?.getItem('sob_cached_cust_orders') || window.sessionStorage?.getItem('sob_cached_cust_orders');
        return !raw;
      }
    } catch {}
    return true;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialUrlFilter = (searchParams.get('status') || '').toUpperCase();
  const [filter, setFilter] = useState<OrderFilter>(
    (['ALL', 'ACTIVE', 'COMPLETED', 'CANCELLED'].includes(initialUrlFilter) ? initialUrlFilter : 'ALL') as OrderFilter
  );
  const [query, setQuery] = useState(() => searchParams.get('q') || searchParams.get('order') || '');
  const [currentPage, setCurrentPage] = useState(() => Math.max(1, Number(searchParams.get('page')) || 1));
  const [expandedOrder, setExpandedOrder] = useState<string | null>(() => searchParams.get('id') || searchParams.get('orderId'));

  // Reorder Confirmation Modal State (Item 6.1)
  interface ReorderLine {
    productId: string;
    productName: string;
    quantity: number;
    oldUnitPrice: number;
    currentPrice: number;
    availableStock: number | null;
    inStock: boolean;
  }
  const [reorderOrder, setReorderOrder] = useState<Order | null>(null);
  const [reorderLines, setReorderLines] = useState<ReorderLine[]>([]);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [reorderSubmitting, setReorderSubmitting] = useState(false);
  const [reorderPaymentMethod, setReorderPaymentMethod] = useState<'CASH_ON_DELIVERY' | 'PAYOS'>('CASH_ON_DELIVERY');
  const missingDeepLinkToastRef = useRef<string | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSwitchingCod, setIsSwitchingCod] = useState<string | null>(null);
  const [payosModalData, setPayosModalData] = useState<{
    orderId: string | number;
    orderNumber?: string;
    amount: number;
    qrCode?: string;
    checkoutUrl?: string;
    paymentLinkId?: string;
  } | null>(null);
  const [isCreatingPayosLink, setIsCreatingPayosLink] = useState<string | null>(null);
  const [showPodModal, setShowPodModal] = useState<boolean>(false);
  const [podLoading, setPodLoading] = useState<boolean>(false);
  const [podData, setPodData] = useState<{
    orderId: string;
    orderNumber?: string;
    orderStatus: string;
    viewUrl: string;
    expiresAt?: string;
    deliveredAt?: string;
    orderNote?: string;
  } | null>(null);

  const handleOpenCustomerPod = async (order: Order) => {
    setShowPodModal(true);
    setPodLoading(true);
    setPodData(null);
    try {
      const orderId = String(order.id || (order as any).orderId);
      const res = await mediaService.getPodView(orderId);
      if (res?.success && res?.data) {
        setPodData({
          ...res.data,
          orderNumber: order.orderNumber,
          orderNote: (order as any).orderNote || (order as any).failureNote,
        });
      } else {
        const fallbackUrl = (order as any).podImageUrl || (order as any).evidenceImageUrl;
        if (fallbackUrl) {
          setPodData({
            orderId,
            orderNumber: order.orderNumber,
            orderStatus: order.status,
            viewUrl: fallbackUrl,
            deliveredAt: (order as any).deliveredAt,
            orderNote: (order as any).orderNote || (order as any).failureNote,
          });
        } else {
          toast.error('Không tìm thấy ảnh bằng chứng cho đơn hàng này');
          setShowPodModal(false);
        }
      }
    } catch (err: any) {
      const fallbackUrl = (order as any).podImageUrl || (order as any).evidenceImageUrl;
      if (fallbackUrl) {
        setPodData({
          orderId: String(order.id || (order as any).orderId),
          orderNumber: order.orderNumber,
          orderStatus: order.status,
          viewUrl: fallbackUrl,
          deliveredAt: (order as any).deliveredAt,
          orderNote: (order as any).orderNote || (order as any).failureNote,
        });
      } else {
        toast.error(err?.response?.data?.message || err?.message || 'Chưa thể tải ảnh bằng chứng giao hàng');
        setShowPodModal(false);
      }
    } finally {
      setPodLoading(false);
    }
  };

  const orderRequests = useRef({ generation: 0, flight: null as Promise<void> | null, queued: false });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('orderId')) setExpandedOrder(params.get('orderId'));
    if (params.get('order')) { setQuery(params.get('order') || ''); setFilter('ALL'); }

    // Xử lý khi quay lại từ cổng thanh toán PayOS
    const status = params.get('payos_status') || params.get('status');
    const isCancelled = status === 'cancelled' || status === 'CANCELLED' || params.get('cancel') === 'true';
    const isSuccess = status === 'success' || status === 'PAID';
    const targetOrderId = params.get('orderId') || params.get('orderCode');

    if (isCancelled && targetOrderId) {
      api.post(`/orders/${targetOrderId}/cancel`, {
        reason: 'Khách hàng hủy thanh toán trực tuyến PayOS',
      }).then(() => {
        publishOrderEvent('ORDER_CANCELLED', {
          order: { id: targetOrderId, status: 'CANCELLED' },
          reason: 'Khách hàng hủy thanh toán trực tuyến PayOS',
        });
        toast.info(`Đã hủy đơn hàng #${targetOrderId} theo yêu cầu. Cửa hàng đã được thông báo.`);
        loadOrders();
      }).catch(() => {
        loadOrders();
      });
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {}
    } else if (isSuccess && targetOrderId) {
      toast.success(`Đã nhận được kết quả thanh toán PayOS! Đang cập nhật trạng thái đơn...`);
      loadOrders();
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {}
    }
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
          const mappedOrders = data.map(normalizeOrder);
          setOrders(mappedOrders);
          try {
            if (typeof window !== 'undefined') {
              window.localStorage?.setItem('sob_cached_cust_orders', JSON.stringify(mappedOrders));
              window.sessionStorage?.setItem('sob_cached_cust_orders', JSON.stringify(mappedOrders));
            }
          } catch {}
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
      if (requests.flight === flight) {
        requests.flight = null;
      }
      if (isMountedRef.current) {
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
      const incoming = payload?.order || payload;
      const targetId = String(incoming?.orderId || incoming?.id || '');
      const nextStatus = incoming?.orderStatus || incoming?.status;
      const nextPaymentStatus = incoming?.paymentStatus;
      if (targetId && (nextStatus || nextPaymentStatus)) {
        setOrders((prev) =>
          prev.map((o) =>
            String(o.id || (o as any).orderId) === targetId
              ? {
                  ...o,
                  ...(nextStatus ? { status: nextStatus, orderStatus: nextStatus } : {}),
                  ...(nextPaymentStatus ? { paymentStatus: nextPaymentStatus } : {}),
                }
              : o,
          ),
        );
      }
      loadOrders();
    };

    const handleOrderCreated = (newOrderPayload?: any) => {
      // 1. Phát âm thanh chuông "Ting Ting" thông báo
      playOrderChime(true);

      const target = newOrderPayload?.order || newOrderPayload;
      if (target && (target.id || target.orderId || target.orderNumber || target.orderCode)) {
        const normalized = normalizeOrder(target);
        // 2. Chèn ngay đơn hàng mới lên đầu danh sách mà KHÔNG CẦN F5 tải lại trang
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === normalized.id || o.orderNumber === normalized.orderNumber);
          if (exists) return prev;
          return [normalized, ...prev];
        });
        // 3. Hiện toast thông báo góc màn hình
        const code = (normalized as any).orderCode || normalized.orderNumber || normalized.id;
        toast.success(`Đã nhận đơn hàng mới #${code}!`);
      }
      loadOrders();
    };

    const handleOrderCancelled = () => {
      loadOrders();
    };

    const handlePaymentConfirmed = (payload: any) => {
      const incoming = payload?.order || payload;
      const incomingId = String(incoming?.orderId || incoming?.id || '');
      const incomingCode = String(incoming?.orderNumber || incoming?.orderCode || '');
      if (incomingId || incomingCode) {
        setOrders((prev) =>
          prev.map((o) => {
            const oId = String(o.id || (o as any).orderId || '');
            const oCode = String(o.orderNumber || (o as any).orderCode || '');
            if ((incomingId && oId === incomingId) || (incomingCode && oCode === incomingCode)) {
              return {
                ...o,
                paymentStatus: 'PAID',
                status: o.status === 'PENDING' ? 'CONFIRMED' : o.status,
                orderStatus: o.orderStatus === 'PENDING' ? 'CONFIRMED' : o.orderStatus,
              };
            }
            return o;
          }),
        );
      }
      loadOrders();
      const orderNum = payload?.orderNumber || payload?.orderCode || '';
      if (orderNum) {
        toast.success(`Thanh toán đơn hàng #${orderNum} đã được xác nhận thành công!`);
      }
    };

    const handlePaymentMethodChanged = (payload: any) => {
      const incoming = payload?.order || payload;
      const targetId = String(incoming?.orderId || incoming?.id || '');
      if (targetId && incoming?.paymentMethod) {
        setOrders((prev) =>
          prev.map((o) =>
            String(o.id || (o as any).orderId) === targetId
              ? {
                  ...o,
                  paymentMethod: incoming.paymentMethod,
                  paymentStatus: incoming.paymentStatus || o.paymentStatus,
                }
              : o,
          ),
        );
      }
      loadOrders();
    };

    const handleOrderRefunded = (payload: any) => {
      const targetId = String(payload?.orderId || payload?.order?.orderId || payload?.order?.id || '');
      if (targetId) {
        setOrders((prev) =>
          prev.map((o) =>
            String(o.id || (o as any).orderId) === targetId
              ? {
                  ...o,
                  paymentStatus: payload?.orderPaymentStatus || 'REFUNDED',
                }
              : o,
          ),
        );
      }
      toast.success('Hoàn tiền đơn hàng đã được xác nhận thành công!');
      void loadOrders();
    };

    const handleWindowFocus = () => {
      if (document.visibilityState === 'visible') {
        void loadOrders();
      }
    };

    socket.on('ORDER_STATUS_CHANGED', handleStatusChanged);
    socket.on('ORDER_CREATED', handleOrderCreated);
    socket.on('ORDER_CANCELLED', handleOrderCancelled);
    socket.on('ORDER_PAYMENT_CONFIRMED', handlePaymentConfirmed);
    socket.on('ORDER_PAYMENT_METHOD_CHANGED', handlePaymentMethodChanged);
    socket.on('ORDER_REFUNDED', handleOrderRefunded);
    socket.on('ORDER_DELIVERED', handleStatusChanged);
    window.addEventListener(ORDER_EVENT, handleOrderCreated);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      orderRequests.current.generation += 1;
      orderRequests.current.flight = null;
      orderRequests.current.queued = false;
      socket.off('ORDER_STATUS_CHANGED', handleStatusChanged);
      socket.off('ORDER_CREATED', handleOrderCreated);
      socket.off('ORDER_CANCELLED', handleOrderCancelled);
      socket.off('ORDER_PAYMENT_CONFIRMED', handlePaymentConfirmed);
      socket.off('ORDER_PAYMENT_METHOD_CHANGED', handlePaymentMethodChanged);
      socket.off('ORDER_REFUNDED', handleOrderRefunded);
      socket.off('ORDER_DELIVERED', handleStatusChanged);
      window.removeEventListener(ORDER_EVENT, handleOrderCreated);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [loadOrders, user?.id, user?.role, user?.customerProfileId]);

  const getOrderStatus = (o: any) => dashboardOrderStatus(o);
  useDashboardRefresh(() => loadOrders(), 'customer-orders:' + user?.id + ':' + user?.customerProfileId, true);

  useEffect(() => {
    const hasActiveOrders = orders.some((o) =>
      ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_DELIVERY', 'SHIPPING'].includes(
        dashboardOrderStatus(o),
      ),
    );
    if (!hasActiveOrders) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadOrders();
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [orders, loadOrders]);

  const confirmCancellation = async () => {
    if (!orderToCancel) return;

    setIsCancelling(true);
    const targetId = orderToCancel.id || (orderToCancel as any).orderId;
    const targetCode = orderToCancel.orderNumber || (orderToCancel as any).orderCode || targetId;
    try {
      const response = await api.post(`/orders/${targetId}/cancel`, {
        reason: 'Khách hàng yêu cầu hủy đơn',
      });
      const updatedOrder = response.data?.data;
      const nextStatus = updatedOrder?.orderStatus || updatedOrder?.status || 'CANCELLED';
      const nextPaymentStatus =
        updatedOrder?.paymentStatus ||
        (String(orderToCancel.paymentStatus || '').toUpperCase() === 'PAID'
          ? 'REFUND_PENDING'
          : orderToCancel.paymentStatus);
      publishOrderEvent('ORDER_CANCELLED', {
        order: updatedOrder || { ...orderToCancel, status: nextStatus, paymentStatus: nextPaymentStatus },
        reason: 'Khách hàng yêu cầu hủy đơn',
      });
      setOrders((current) => current.map((order) => {
        const oId = order.id || (order as any).orderId;
        return oId === targetId
          ? { ...order, ...updatedOrder, status: nextStatus, orderStatus: nextStatus, paymentStatus: nextPaymentStatus }
          : order;
      }));
      setExpandedOrder(null);
      setOrderToCancel(null);
      toast.info(`Đã hủy đơn hàng #${targetCode} thành công. Cửa hàng đã được thông báo đơn hàng đã hủy.`);
    } catch (requestError: any) {
      const errorMsg = requestError.response?.data?.message || requestError.message;
      if (requestError.response?.status === 400 && /PENDING|CONFIRMED|xác nhận|tiếp nhận/i.test(errorMsg)) {
        toast.warning(errorMsg || 'Cửa hàng đã tiếp nhận đơn hàng này, không thể tự hủy lúc này.');
      } else {
        toast.error(errorMsg || 'Không thể hủy đơn hàng lúc này.');
      }
      setOrderToCancel(null);
      await loadOrders();
    } finally {
      setIsCancelling(false);
    }
  };

  const summary = useMemo(() => orderDashboardMetrics(orders), [orders]);

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
    return orders.filter((order) => {
      const currentStatus = getOrderStatus(order);
      const filterMatches =
        filter === 'ALL' ||
        (filter === 'ACTIVE' && (isActiveOrder(currentStatus) || currentStatus === 'DELIVERY_FAILED')) ||
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
    const params = new URLSearchParams(location.search);
    if (params.get('payos_status') || params.get('cancel')) return;
    const next = new URLSearchParams();
    if (filter !== 'ALL') next.set('status', filter);
    if (query.trim()) next.set('q', query.trim());
    if (currentPage > 1) next.set('page', String(currentPage));
    const currentId = params.get('id') || params.get('orderId');
    if (currentId) next.set('id', currentId);
    if (next.toString() !== params.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [filter, query, currentPage, setSearchParams, location.search]);

  useEffect(() => {
    const deepId = searchParams.get('id') || searchParams.get('orderId');
    if (!deepId || isLoading) return;
    const matched = orders.find(
      (o) => String(o.id) === String(deepId) || String(o.orderNumber) === String(deepId)
    );
    if (matched) {
      setExpandedOrder(String(matched.id));
    } else if (missingDeepLinkToastRef.current !== deepId) {
      missingDeepLinkToastRef.current = deepId;
      toast.warning(`Không tìm thấy đơn hàng #${deepId} hoặc bạn không có quyền truy cập.`);
    }
  }, [searchParams, orders, isLoading]);

  const handleOpenReorder = async (order: Order) => {
    setReorderOrder(order);
    setReorderLoading(true);
    setReorderPaymentMethod(
      String(order.paymentMethod || '').toUpperCase() === 'PAYOS' ? 'PAYOS' : 'CASH_ON_DELIVERY'
    );
    const baseLines: ReorderLine[] = (order.items || []).map((item) => {
      const qty = Math.max(1, Number(item.quantity || 1));
      const oldPrice = item.unitPrice ?? (qty > 0 ? Number(item.totalPrice || 0) / qty : 0);
      return {
        productId: String(item.productId || ''),
        productName: item.productName || 'Sản phẩm',
        quantity: qty,
        oldUnitPrice: oldPrice,
        currentPrice: oldPrice,
        availableStock: null,
        inStock: true,
      };
    });
    setReorderLines(baseLines);

    try {
      const storeId = order.storeId || (order as any).store?.id;
      let liveProducts: any[] = [];
      if (storeId) {
        try {
          const res = await api.get(`/storefront/stores/${storeId}/products`);
          liveProducts = res.data?.data ?? res.data ?? [];
        } catch {
          const catRes = await api.get('/products/storefront/catalog', { params: { storeId } });
          liveProducts = catRes.data?.data ?? catRes.data ?? [];
        }
      }
      if (Array.isArray(liveProducts) && liveProducts.length > 0) {
        const byId = new Map(liveProducts.map((p: any) => [String(p.id || p.productId), p]));
        setReorderLines(
          baseLines.map((line) => {
            const matched = byId.get(line.productId);
            if (!matched) {
              return { ...line, availableStock: 0, inStock: false };
            }
            const stock = Number(matched.stock ?? matched.availableStock ?? matched.inventory?.quantityOnHand ?? 99);
            const livePrice = Number(matched.price ?? matched.basePrice ?? line.oldUnitPrice);
            return {
              ...line,
              productName: matched.name || matched.productName || line.productName,
              currentPrice: livePrice,
              availableStock: stock,
              inStock: stock >= line.quantity && matched.status !== 'INACTIVE',
            };
          })
        );
      }
    } catch {
      // Keep original order snapshot if catalog lookup unavailable
    } finally {
      setReorderLoading(false);
    }
  };

  const handleConfirmReorder = async () => {
    if (!reorderOrder) return;
    const validLines = reorderLines.filter((l) => l.inStock && l.productId);
    if (validLines.length === 0) {
      toast.error('Không có sản phẩm nào còn tồn kho để đặt lại.');
      return;
    }
    const storeId = reorderOrder.storeId || (reorderOrder as any).store?.id;
    if (!storeId) {
      toast.error('Không xác định được cửa hàng của đơn gốc.');
      return;
    }
    setReorderSubmitting(true);
    try {
      const res = await api.post(
        '/storefront/orders',
        {
          storeId: Number(storeId) || storeId,
          items: validLines.map((l) => ({ productId: Number(l.productId) || l.productId, quantity: l.quantity })),
          customerName: reorderOrder.customerName || user?.fullName || 'Khách hàng',
          customerPhone: reorderOrder.customerPhone || user?.phone || '',
          deliveryAddress: reorderOrder.deliveryAddress || '',
          paymentMethod: reorderPaymentMethod,
        },
        {
          headers: {
            'x-idempotency-key': `reord-${reorderOrder.id}-${Date.now()}`,
          },
        }
      );
      const created = normalizeOrder(res.data?.data || res.data);
      publishOrderEvent('ORDER_CREATED', { order: created });
      setReorderOrder(null);
      await loadOrders();
      setExpandedOrder(String(created.id));

      if (reorderPaymentMethod === 'PAYOS') {
        try {
          const payRes = await api.post('/payments/payos/create-link', { orderId: created.id });
          const payData = payRes.data?.data || payRes.data;
          if (payData?.qrCode || payData?.checkoutUrl) {
            setPayosModalData({
              orderId: created.id,
              orderNumber: created.orderNumber,
              amount: Number(created.totalAmount || 0),
              qrCode: payData.qrCode,
              checkoutUrl: payData.checkoutUrl,
              paymentLinkId: payData.paymentLinkId,
            });
            return;
          }
        } catch {
          toast.info(`Đơn #${created.orderNumber} đã được tạo! Hãy bấm "Thanh toán lại" để quét QR PayOS.`);
          return;
        }
      }
      toast.success(`Đã đặt lại đơn hàng #${created.orderNumber} thành công!`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể đặt lại đơn hàng lúc này.');
    } finally {
      setReorderSubmitting(false);
    }
  };

  const prevFilterQueryRef = useRef({ filter, query });
  useEffect(() => {
    if (prevFilterQueryRef.current.filter !== filter || prevFilterQueryRef.current.query !== query) {
      prevFilterQueryRef.current = { filter, query };
      setCurrentPage(1);
    }
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
    <main className="customer-ui customer-orders max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-11">
      <section data-page-motion className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
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

      <section data-page-motion aria-label="Tóm tắt đơn hàng" className="orders-summary grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
        {[
          { label: 'Tổng đơn hàng', value: summary.total, note: 'Từ lần đặt đầu tiên', icon: ReceiptText, tone: 'text-[#287DA8] bg-[#287DA8]/10' },
          { label: 'Đang xử lý', value: summary.active, note: 'Cần theo dõi', icon: Truck, tone: 'text-amber-600 bg-amber-50' },
          { label: 'Đã giao thành công', value: summary.completed, note: 'Đơn đã hoàn tất', icon: PackageCheck, tone: 'text-emerald-600 bg-emerald-50' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="orders-summary-item rounded-xl border border-slate-200/80 bg-white px-4 py-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">{item.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{isLoading || (error && !orders.length) ? '—' : item.value}</p>
                </div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.tone}`}><Icon className="w-4.5 h-4.5" /></div>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">{item.note}</p>
            </div>
          );
        })}
      </section>

      <section data-page-motion className="orders-list mt-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div aria-label="Lọc trạng thái đơn hàng" className="orders-filters flex items-center gap-2 min-w-0 overflow-x-auto pb-1 lg:pb-0">
              <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
              {filters.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                  aria-pressed={filter === item.id}
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
                aria-label="Tìm đơn hàng theo mã đơn hoặc sản phẩm"
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#287DA8] focus:bg-white focus:ring-3 focus:ring-[#287DA8]/10 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </label>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          {!isLoading && error && orders.length > 0 && <p role="status" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{error}</p>}
          {isLoading && orders.length === 0 ? (
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
                const isDeliveryFailed = currentStatus === 'DELIVERY_FAILED';
                const payStatusUpper = String(order.paymentStatus || '').toUpperCase();
                const payMethodUpper = String(order.paymentMethod || '').toUpperCase();
                const isRefundPending = isCancelled && payStatusUpper === 'REFUND_PENDING';
                const isRefunded = isCancelled && payStatusUpper === 'REFUNDED';
                const isPaid = payStatusUpper === 'PAID';
                const isCod = ['COD', 'CASH_ON_DELIVERY'].includes(payMethodUpper);
                const isUnpaid = !isCancelled && !isPaid && !['REFUND_PENDING', 'REFUNDED'].includes(payStatusUpper);
                const canSwitchPayment = isUnpaid && ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_DELIVERY', 'SHIPPING'].includes(currentStatus);
                // Khách hàng có thể tự hủy đơn khi đơn ở PENDING, CONFIRMED hoặc DELIVERY_FAILED (Hướng B)
                const canCancel = !isCancelled && ['PENDING', 'CONFIRMED', 'DELIVERY_FAILED'].includes(currentStatus);
                const canPayNow = canSwitchPayment && !isCod;
                const canSwitchToPayos = canSwitchPayment && isCod;
                const itemSummary = order.items.slice(0, 2).map((item) => `${item.quantity}× ${item.productName}`).join(', ');
                return (
                  <motion.article key={order.id || order.orderNumber || index} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.035, 0.22) }}>
                    <button
                      type="button"
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      className="w-full px-2 sm:px-3 py-4 text-left rounded-xl transition hover:bg-slate-50/80 dark:hover:bg-zinc-800/60"
                      aria-expanded={isExpanded}
                    >
                      <div className="order-row flex items-start gap-3 sm:gap-4">
                        <div className="hidden sm:flex mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-slate-100 items-center justify-center dark:bg-zinc-800"><ShoppingBag className="w-4 h-4 text-slate-500" /></div>
                        <div className="order-identity min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                            <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">#{order.orderNumber}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}><StatusIcon className="w-3 h-3" />{meta.label}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400 truncate">{itemSummary}{order.items.length > 2 ? ` và ${order.items.length - 2} sản phẩm khác` : ''}</p>
                          <p className="mt-1.5 text-[11px] text-slate-400 tabular-nums">{formatDate(order.createdAt)}</p>
                        </div>
                        <div className="order-total shrink-0 flex items-center gap-2 sm:gap-3">
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-900 tabular-nums dark:text-white">{formatPrice(order.totalAmount)}</p>
                            <p className={`mt-1 text-[10px] ${isRefundPending ? 'text-amber-600 font-medium' : isRefunded ? 'text-emerald-600 font-medium' : isUnpaid ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
                              {isRefundPending
                                ? 'Đơn đã hủy · Chờ hoàn tiền (12–24h)'
                                : isRefunded
                                ? 'Đơn đã hủy · Đã hoàn tiền'
                                : isCancelled
                                ? 'Đơn đã hủy · Không cần thanh toán'
                                : String(order.paymentStatus || '').toUpperCase() === 'PAID'
                                ? 'Đã thanh toán thành công'
                                : ['COD', 'CASH_ON_DELIVERY'].includes(String(order.paymentMethod || '').toUpperCase())
                                ? 'Chờ thanh toán (Tiền mặt khi nhận)'
                                : 'Chờ thanh toán (PayOS)'}
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
                                <div className="flex gap-2 text-slate-500 dark:text-zinc-400">
                                  <CreditCard className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                  <span>
                                    {isRefundPending
                                      ? 'Khoản thanh toán trực tuyến sẽ được hoàn về tài khoản sau 12–24 giờ làm việc.'
                                      : isRefunded
                                      ? 'Hệ thống đã xác nhận hoàn tiền thành công về tài khoản.'
                                      : isCancelled
                                      ? 'Đơn đã hủy, không phát sinh thanh toán'
                                      : ['COD', 'CASH_ON_DELIVERY'].includes(String(order.paymentMethod || '').toUpperCase())
                                      ? (String(order.paymentStatus || '').toUpperCase() === 'PAID' ? 'Đã thu tiền mặt khi nhận hàng' : 'Tiền mặt khi nhận hàng (Chờ thanh toán)')
                                      : String(order.paymentStatus || '').toUpperCase() === 'PAID' ? 'Đã thanh toán thành công qua PayOS' : 'Thanh toán trực tuyến PayOS (Chờ thanh toán)'}
                                  </span>
                                </div>
                                {isRefundPending && (
                                  <div className="mt-2.5 p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 flex flex-col gap-2.5">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                      <div className="text-xs text-sky-900 dark:text-sky-200">
                                        <p className="font-semibold">Tiến độ hoàn tiền (REFUND_PENDING)</p>
                                        <p className="text-[11px] text-sky-700 dark:text-sky-300 mt-0.5">
                                          Đơn đã thanh toán trước khi hủy. Vui lòng cập nhật tài khoản ngân hàng chính chủ để hệ thống chi trả qua PayOS Payout.
                                        </p>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void loadOrders();
                                          }}
                                          className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-sky-800 hover:bg-sky-50"
                                        >
                                          <RefreshCw className="w-3 h-3" />
                                          Kiểm tra tiến độ
                                        </button>
                                        <Link
                                          to="/customer/banking"
                                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#287DA8] text-white text-xs font-semibold hover:bg-[#20668a] transition shadow-xs"
                                        >
                                          <span>Cập nhật tài khoản ngân hàng</span>
                                        </Link>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                {isRefunded && (
                                  <div className="mt-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 flex items-center gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <div>
                                      <p className="font-semibold">Đã hoàn tiền thành công về tài khoản</p>
                                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                                        Giao dịch chi hoàn qua PayOS Payout đã được đối soát hoàn tất.
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-200/70 flex justify-between text-sm font-bold text-slate-900 dark:border-zinc-700 dark:text-white"><span>Tổng thanh toán</span><span className="tabular-nums">{formatPrice(order.totalAmount)}</span></div>
                            {(canCancel || canPayNow || canSwitchToPayos) && (
                              <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                                  {isDeliveryFailed
                                    ? isPaid
                                      ? 'Giao hàng chưa thành công. Bạn có thể hủy đơn để hệ thống tự động chuyển sang quy trình hoàn tiền (REFUND_PENDING) qua PayOS Payout; nếu không giao lại, hệ thống sẽ tự động hủy & kích hoạt hoàn tiền sau 24 giờ.'
                                      : 'Giao hàng chưa thành công. Bạn có thể tự hủy đơn này nếu không muốn chờ cửa hàng giao lại.'
                                    : canPayNow
                                    ? canCancel
                                      ? 'Đơn hàng chưa hoàn tất thanh toán PayOS. Bạn có thể quét QR thanh toán ngay, đổi sang Tiền mặt (COD) hoặc hủy đơn hàng.'
                                      : 'Đơn hàng chưa thanh toán PayOS. Bạn có thể thanh toán ngay qua QR hoặc đổi sang Tiền mặt (COD) khi nhận hàng.'
                                    : canSwitchToPayos
                                    ? 'Đơn đang chọn Tiền mặt (COD). Bạn có thể thanh toán trước qua PayOS / QR bất kỳ lúc nào trước khi nhận hàng.'
                                    : currentStatus === 'CONFIRMED'
                                    ? 'Đơn hàng đã được tiếp nhận. Bạn vẫn có thể hủy đơn trước khi cửa hàng bắt đầu đóng gói.'
                                    : 'Đơn hàng đang chờ xử lý, bạn vẫn có thể hủy đơn nếu muốn thay đổi.'}
                                </p>
                                <div className="order-actions flex flex-wrap items-center gap-2 self-end sm:self-auto">
                                  {canSwitchToPayos && (
                                    <button
                                      type="button"
                                      disabled={isCreatingPayosLink === String(order.id || (order as any).orderId)}
                                      onClick={async (event) => {
                                        event.stopPropagation();
                                        const oId = String(order.id || (order as any).orderId);
                                        const oCode = order.orderNumber || (order as any).orderCode || oId;
                                        const oAmount = Number(order.totalAmount || 0);
                                        setIsCreatingPayosLink(oId);
                                        try {
                                          toast.info('Đang chuyển sang PayOS và tạo mã quét QR...');
                                          await paymentsService.selectOrderPaymentMethod(oId, 'PAYOS');
                                          const res = await api.post('/payments/payos/create-link', {
                                            orderId: oId,
                                          });
                                          const data = res.data?.data || res.data;
                                          const checkoutUrl = data?.checkoutUrl;
                                          const qrCode = data?.qrCode;
                                          const paymentLinkId = data?.paymentLinkId;
                                          await loadOrders();
                                          if (checkoutUrl || qrCode) {
                                            setPayosModalData({
                                              orderId: oId,
                                              orderNumber: oCode,
                                              amount: oAmount,
                                              qrCode,
                                              checkoutUrl,
                                              paymentLinkId,
                                            });
                                          } else {
                                            toast.error('Không tìm thấy liên kết thanh toán PayOS.');
                                          }
                                        } catch (err: any) {
                                          toast.error(err.response?.data?.message || 'Không thể chuyển sang thanh toán PayOS lúc này.');
                                        } finally {
                                          setIsCreatingPayosLink(null);
                                        }
                                      }}
                                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0E6BA8] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0B5586] disabled:opacity-60"
                                    >
                                      {isCreatingPayosLink === String(order.id || (order as any).orderId) ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <CreditCard className="w-3.5 h-3.5" />
                                      )}
                                      Thanh toán trước qua PayOS / QR
                                    </button>
                                  )}
                                  {canPayNow && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={isCreatingPayosLink === String(order.id || (order as any).orderId)}
                                        onClick={async (event) => {
                                          event.stopPropagation();
                                          const oId = String(order.id || (order as any).orderId);
                                          const oCode = order.orderNumber || (order as any).orderCode || oId;
                                          const oAmount = Number(order.totalAmount || 0);
                                          setIsCreatingPayosLink(oId);
                                          try {
                                            toast.info('Đang tạo mã quét QR PayOS...');
                                            const res = await api.post('/payments/payos/create-link', {
                                              orderId: oId,
                                            });
                                            const data = res.data?.data || res.data;
                                            const checkoutUrl = data?.checkoutUrl;
                                            const qrCode = data?.qrCode;
                                            const paymentLinkId = data?.paymentLinkId;
                                            if (checkoutUrl || qrCode) {
                                              setPayosModalData({
                                                orderId: oId,
                                                orderNumber: oCode,
                                                amount: oAmount,
                                                qrCode,
                                                checkoutUrl,
                                                paymentLinkId,
                                              });
                                            } else {
                                              toast.error('Không tìm thấy liên kết thanh toán.');
                                            }
                                          } catch (err: any) {
                                            toast.error(err.response?.data?.message || 'Không thể tạo liên kết thanh toán PayOS.');
                                          } finally {
                                            setIsCreatingPayosLink(null);
                                          }
                                        }}
                                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0E6BA8] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#0B5586] disabled:opacity-60"
                                      >
                                        {isCreatingPayosLink === String(order.id || (order as any).orderId) ? (
                                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <CreditCard className="w-3.5 h-3.5" />
                                        )}
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
                                            toast.success(`Đã chuyển đơn hàng #${oCode} sang thanh toán Tiền mặt (COD)! Cửa hàng sẽ tiếp tục xử lý đơn hàng.`);
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
                            {['PREPARING', 'READY_FOR_DELIVERY', 'SHIPPING'].includes(currentStatus) && (
                              <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                                <span className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-500" />
                                  {currentStatus === 'PREPARING'
                                    ? 'Đơn hàng đang được đóng gói chuẩn bị giao.'
                                    : currentStatus === 'READY_FOR_DELIVERY'
                                    ? 'Đơn hàng đã sẵn sàng chờ tài xế nhận giao.'
                                    : 'Đơn hàng đang trên đường giao đến bạn.'}
                                </span>
                                <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                                  Để hủy hoặc đổi địa chỉ, vui lòng liên hệ trực tiếp cửa hàng.
                                </span>
                              </div>
                            )}
                            {['COMPLETED', 'DELIVERED'].includes(currentStatus) && (
                              <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                                  <PackageCheck className="w-4 h-4 shrink-0 text-emerald-500" />
                                  Đơn hàng đã được giao thành công.
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleOpenReorder(order);
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#0E6BA8]/30 bg-[#0E6BA8]/5 px-3 py-1.5 text-xs font-semibold text-[#0E6BA8] transition hover:bg-[#0E6BA8]/10 cursor-pointer"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Đặt lại đơn này
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async (event) => {
                                      event.stopPropagation();
                                      await handleOpenCustomerPod(order);
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100 hover:border-sky-300 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 cursor-pointer"
                                  >
                                    <Camera className="w-3.5 h-3.5" />
                                    Xem ảnh bằng chứng giao hàng (POD)
                                  </button>
                                </div>
                              </div>
                            )}
                            {['CANCELLED', 'REJECTED'].includes(currentStatus) && (
                              <div className="mt-4 pt-3 border-t border-slate-200/70 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                                <span className="text-slate-500 dark:text-zinc-400">
                                  Muốn đặt lại các mặt hàng này theo giá và tồn kho mới nhất?
                                </span>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleOpenReorder(order);
                                  }}
                                  className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-[#0E6BA8]/30 bg-[#0E6BA8]/5 px-3 py-1.5 text-xs font-semibold text-[#0E6BA8] transition hover:bg-[#0E6BA8]/10 cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Đặt lại đơn này
                                </button>
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm responsive-modal overflow-y-auto"
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
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-zinc-400">
                Bạn sắp hủy đơn <span className="font-semibold text-slate-700 dark:text-zinc-200">#{orderToCancel.orderNumber}</span>.
                {String(orderToCancel.paymentStatus || '').toUpperCase() === 'PAID'
                  ? ' Khoản tiền đã thanh toán qua PayOS sẽ tự động chuyển sang quy trình hoàn tiền (REFUND_PENDING) và lên danh sách chi trả PayOS Payout cho Admin giải ngân về tài khoản ngân hàng của bạn.'
                  : ' Thao tác này không thể hoàn tác.'}
              </p>
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

      <AnimatePresence>
        {showPodModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-sm responsive-modal overflow-y-auto"
            onMouseDown={() => setShowPodModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#0E6BA8] dark:text-sky-400" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                    Ảnh Bằng Chứng Giao Hàng (POD)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPodModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4">
                {podLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                    <RefreshCw className="w-8 h-8 text-[#0E6BA8] animate-spin mb-3" />
                    <p className="text-sm">Đang tải ảnh bằng chứng an toàn...</p>
                  </div>
                ) : podData?.viewUrl ? (
                  <div className="space-y-4">
                    <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-950 flex items-center justify-center max-h-[380px]">
                      <img
                        src={podData.viewUrl}
                        alt={`Ảnh giao hàng đơn #${podData.orderNumber || podData.orderId}`}
                        className="w-full h-full object-contain max-h-[380px]"
                      />
                      <span className="absolute top-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-medium text-emerald-400 backdrop-blur-xs">
                        Bảo mật PII · Link 15 phút
                      </span>
                    </div>

                    <div className="rounded-xl bg-slate-50 dark:bg-zinc-800/60 p-3 space-y-1.5 text-xs text-slate-600 dark:text-zinc-300">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 dark:text-zinc-200">Mã đơn:</span>
                        <span>#{podData.orderNumber || podData.orderId}</span>
                      </div>
                      {podData.deliveredAt && (
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700 dark:text-zinc-200">Thời gian giao:</span>
                          <span>{formatDate(podData.deliveredAt)}</span>
                        </div>
                      )}
                      {podData.orderNote && (
                        <div className="pt-1 border-t border-slate-200/50 dark:border-zinc-700">
                          <span className="font-semibold text-slate-700 dark:text-zinc-200">Ghi chú giao hàng:</span>
                          <p className="mt-0.5 text-slate-500 whitespace-pre-wrap">{podData.orderNote}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowPodModal(false)}
                  className="rounded-lg bg-slate-100 dark:bg-zinc-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {reorderOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => !reorderSubmitting && setReorderOrder(null)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Xác nhận đặt lại đơn #{reorderOrder.orderNumber}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Kiểm tra giá bán & tồn kho mới nhất trước khi tạo đơn mới.
                </p>
              </div>
              <button
                type="button"
                disabled={reorderSubmitting}
                onClick={() => setReorderOrder(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reorderLoading ? (
              <p className="py-6 text-center text-xs text-slate-500">Đang kiểm tra giá và tồn kho mới nhất...</p>
            ) : (
              <>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-800">
                  {reorderLines.map((line, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs">
                      <div className="min-w-0">
                        <p className={`font-semibold truncate ${line.inStock ? 'text-slate-900 dark:text-white' : 'text-slate-400 line-through'}`}>
                          {line.quantity}× {line.productName}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {line.currentPrice !== line.oldUnitPrice ? (
                            <>
                              Giá cũ: <span className="line-through">{formatPrice(line.oldUnitPrice)}</span> → Mới:{' '}
                              <span className="font-semibold text-[#0E6BA8]">{formatPrice(line.currentPrice)}</span>
                            </>
                          ) : (
                            <span>Đơn giá: {formatPrice(line.currentPrice)}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {line.inStock ? (
                          <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                            {formatPrice(line.currentPrice * line.quantity)}
                          </span>
                        ) : (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                            Hết hàng / Ngừng bán
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 text-xs">
                  <label className="block font-semibold text-slate-700 dark:text-zinc-200">Phương thức thanh toán</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setReorderPaymentMethod('CASH_ON_DELIVERY')}
                      className={`rounded-xl border px-3 py-2 text-left font-semibold transition ${
                        reorderPaymentMethod === 'CASH_ON_DELIVERY'
                          ? 'border-[#0E6BA8] bg-[#0E6BA8]/5 text-[#0E6BA8]'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Tiền mặt (COD)
                    </button>
                    <button
                      type="button"
                      onClick={() => setReorderPaymentMethod('PAYOS')}
                      className={`rounded-xl border px-3 py-2 text-left font-semibold transition ${
                        reorderPaymentMethod === 'PAYOS'
                          ? 'border-[#0E6BA8] bg-[#0E6BA8]/5 text-[#0E6BA8]'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      Chuyển khoản PayOS
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 pt-3 text-sm font-bold text-slate-900 dark:text-white">
                  <span>Tổng ước tính mới</span>
                  <span className="text-[#0E6BA8] tabular-nums">
                    {formatPrice(
                      reorderLines
                        .filter((l) => l.inStock)
                        .reduce((sum, l) => sum + l.currentPrice * l.quantity, 0)
                    )}
                  </span>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={reorderSubmitting}
                onClick={() => setReorderOrder(null)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={reorderLoading || reorderSubmitting || reorderLines.every((l) => !l.inStock)}
                onClick={() => void handleConfirmReorder()}
                className="rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {reorderSubmitting ? 'Đang tạo đơn...' : 'Xác nhận đặt lại'}
              </button>
            </div>
          </div>
        </div>
      )}

      {payosModalData && (
        <PayOSOrderQrModal
          isOpen={!!payosModalData}
          orderId={payosModalData.orderId}
          orderNumber={payosModalData.orderNumber}
          amount={payosModalData.amount}
          qrCode={payosModalData.qrCode}
          checkoutUrl={payosModalData.checkoutUrl}
          paymentLinkId={payosModalData.paymentLinkId}
          onClose={() => setPayosModalData(null)}
          onSuccess={() => {
            loadOrders();
          }}
          onCancelled={(cancelledId) => {
            setOrders((current) =>
              current.map((ord) => {
                const oId = String(ord.id || (ord as any).orderId);
                return oId === String(cancelledId)
                  ? { ...ord, status: 'CANCELLED', orderStatus: 'CANCELLED' }
                  : ord;
              })
            );
            setExpandedOrder(null);
            loadOrders();
          }}
        />
      )}
    </main>
  );
};
