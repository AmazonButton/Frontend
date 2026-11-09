import './StoreDashboard.css';
import { deliveryMapUrl } from '../../services/delivery-location';
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { api } from '../../services/api';
import { subscribeToStore, getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/OrderSoundContext';
import { toast } from '../../context/ToastContext';
import { Order } from '../../types';
import { mergeOrderUpdate, normalizeOrder, normalizeOrderEvent, ORDER_EVENT, publishOrderEvent } from '../../services/order-events';
import { orderDashboardMetrics, formatMetric } from '../../services/dashboard-metrics';
import { ShippingContact } from '../../components/orders/ShippingContact';
import { subscribeRentalChannelEvents } from '../../services/rental-notifications';
import { getUserStoreId } from '../../services/order-reconciliation';
import { useStoreListingAccess } from '../../hooks/useStoreListingAccess';
import { getStoreSuspendedNotice } from '../../services/store-status';
import {
  AlertTriangle,
  Wallet,
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Phone,
  MapPin,
  Radio,
  DollarSign,
  TrendingUp,
  X,
  Volume2,
  Search,
  Filter,
  Boxes,
  Package,
  Camera,
  Plus,
  Save,
  Trash2,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { StoreCatalogItem, getStoreCatalog, saveStoreCatalog } from '../../data/storeProductsData';

// The collapsed chart must not pull the charting library into the orders load.
const AnalyticsChart = React.lazy(() => import('../../components/AnalyticsChart').then((module) => ({ default: module.AnalyticsChart })));

const buildChartDataFromOrders = (orders: Order[]) => {
  const byDay = new Map<string, { date: string; rawDate: Date; revenue: number }>();

  orders.forEach((order) => {
    if (order.status === 'CANCELLED' || order.status === 'REJECTED') return;
    const rawDate = new Date(order.createdAt);
    if (Number.isNaN(rawDate.getTime())) return;
    const key = rawDate.toISOString().slice(0, 10);
    const current = byDay.get(key) || {
      date: new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(rawDate),
      rawDate,
      revenue: 0,
    };
    current.revenue += Number((order as any).totalAmount || 0);
    byDay.set(key, current);
  });

  return Array.from(byDay.values())
    .sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime())
    .slice(-14)
    .map(({ date, revenue }) => ({ date, revenue }));
};

export const StoreDashboard: React.FC = () => {
  const location = useLocation();
  const { user, token, logout } = useAuth();
  const suspendedNotice = getStoreSuspendedNotice(user);
  const isSuspended = suspendedNotice.isSuspended;
  const [showSuspendedModal, setShowSuspendedModal] = useState<boolean>(() => isSuspended);

  useEffect(() => {
    if (isSuspended) {
      setShowSuspendedModal(true);
    }
  }, [isSuspended]);
  const listingAccess = useStoreListingAccess(user);
  const storeId = getUserStoreId(user);
  const { playOrderChime, announceStoreOrder, testStoreBankSpeaker } = useSound();

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const key = 'sob_cached_orders_' + (user?.storeId || 'store');
        const raw = window.localStorage?.getItem(key) || window.sessionStorage?.getItem(key) || window.sessionStorage?.getItem('sob_cached_store_orders');
        if (raw) {
          const p = JSON.parse(raw);
          if (Array.isArray(p) && p.length > 0) return p;
        }
      }
    } catch {}
    return [];
  });
  const latestOrdersRef = useRef(orders);
  latestOrdersRef.current = orders;
  const [pendingStatusUpdates, setPendingStatusUpdates] = useState<Record<string, string>>({});
  const statusUpdatesRef = useRef(new Map<string, { previous: Order; displayStatus: string }>());
  const orderListRevision = useRef(0);
  const [loading, setLoading] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const key = 'sob_cached_orders_' + (user?.storeId || 'store');
        const raw = window.localStorage?.getItem(key) || window.sessionStorage?.getItem(key) || window.sessionStorage?.getItem('sob_cached_store_orders');
        return !raw;
      }
    } catch {}
    return true;
  });
  const [ordersReady, setOrdersReady] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const key = 'sob_cached_orders_' + (user?.storeId || 'store');
        const raw = window.localStorage?.getItem(key) || window.sessionStorage?.getItem(key) || window.sessionStorage?.getItem('sob_cached_store_orders');
        return Boolean(raw);
      }
    } catch {}
    return false;
  });
  const [ordersError, setOrdersError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  useEffect(() => {
    const orderNumber = new URLSearchParams(location.search).get('order');
    if (orderNumber) { setSearchQuery(orderNumber); setStatusFilter('ALL'); }
  }, [location.search]);
  const [sortBy, setSortBy] = useState<'PRIORITY' | 'NEWEST' | 'OLDEST'>('PRIORITY');
  const [showChart, setShowChart] = useState(false);

  // Pagination state (15 orders per page)
  const PAGE_SIZE = 15;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const tableTopRef = useRef<HTMLDivElement>(null);

  // Inventory state with exact number input & image upload
  const [showInventoryModal, setShowInventoryModal] = useState<boolean>(false);
  useBodyScrollLock(showInventoryModal);
  const [inventoryList, setInventoryList] = useState<StoreCatalogItem[]>(() => getStoreCatalog());
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [inventoryCategory, setInventoryCategory] = useState<string>('Tất cả');
  const [showAddProductForm, setShowAddProductForm] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // New product form
  const [newProdName, setNewProdName] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<StoreCatalogItem['category']>('Nước mắm');
  const [newProdUnit, setNewProdUnit] = useState('Chai 520ml');
  const [newProdPrice, setNewProdPrice] = useState<number>(45000);
  const [newProdStock, setNewProdStock] = useState<number>(50);
  const [newProdImage, setNewProdImage] = useState<string>('');

  const [newOrderAlert, setNewOrderAlert] = useState<any | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const cancelAlertTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchOrders = async () => {
    const revision = orderListRevision.current;
    try {
      const orderRes = await api.get('/orders');
      if (revision !== orderListRevision.current) return;
      if (orderRes.data?.success && Array.isArray(orderRes.data.data)) {
        setOrdersReady(true); setOrdersError('');
        const fetchedOrders: Order[] = orderRes.data.data.map((raw: any) => {
          const order = normalizeOrder(raw);
          const pending = statusUpdatesRef.current.get(order.id);
          return pending ? { ...order, status: pending.displayStatus as Order['status'], orderStatus: pending.displayStatus } : order;
        });
        setOrders(fetchedOrders);
        setChartData(buildChartDataFromOrders(fetchedOrders));
        try {
          if (typeof window !== 'undefined') {
            const key = 'sob_cached_orders_' + (user?.storeId || 'store');
            window.localStorage?.setItem(key, JSON.stringify(fetchedOrders));
            window.sessionStorage?.setItem('sob_cached_store_orders', JSON.stringify(fetchedOrders));
          }
        } catch {}

        // Auto-dismiss newOrderAlert if the order has already been accepted (status !== 'PENDING')
        setNewOrderAlert((currentAlert: any) => {
          if (!currentAlert || currentAlert.type !== 'CREATE') return currentAlert;
          const matched = fetchedOrders.find(
            (o) =>
              (currentAlert.orderId && o.id === currentAlert.orderId) ||
              (currentAlert.orderNumber &&
                String(o.orderNumber || '').replace(/^#/, '') === String(currentAlert.orderNumber).replace(/^#/, ''))
          );
          if (matched && matched.status !== 'PENDING') {
            return null; // ALREADY ACCEPTED -> DISMISS IMMEDIATELY
          }
          return currentAlert;
        });
      } else {
        throw new Error('Invalid order list');
      }
    } catch (_) {
      setOrdersError('Chưa cập nhật được đơn hàng. Dữ liệu đã tải được giữ lại.');
      toast.error('Không tải được dữ liệu đơn hàng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('smart_order_token') : null);
    if (!activeToken) return;
    setPendingStatusUpdates({});
    fetchOrders();

    if (storeId) {
      subscribeToStore(storeId);
    }

    const socket = getSocket();

    const handleOrderCreated = (newOrderPayload: any) => {
      const normalizedEvent = normalizeOrderEvent(newOrderPayload);
      const newOrder = normalizedEvent.order || newOrderPayload;
      if (storeId && newOrder?.storeId && String(newOrder.storeId) !== storeId) return;

      // 1. Phát âm thanh chuông "Ting Ting" thông báo
      playOrderChime();

      // 2. Chèn ngay đơn hàng mới lên đầu danh sách mà KHÔNG CẦN F5 tải lại trang
      setOrders((prevOrders) => {
        const orderId = String(newOrder.id || newOrder.orderId || '');
        const exists = prevOrders.some(
          (o) => (orderId && o.id === orderId) || (newOrder.orderNumber && o.orderNumber === newOrder.orderNumber)
        );
        if (exists) return prevOrders;
        const safeOrder = {
          ...newOrder,
          items: Array.isArray(newOrder.items) ? newOrder.items : [],
        };
        return [safeOrder, ...prevOrders];
      });

      // 3. Hiện toast thông báo góc màn hình
      const code = (newOrder as any).orderCode || newOrder.orderNumber || newOrder.id;
      // 3. Hiện toast thông báo góc màn hình
      toast.success(`Đã nhận đơn hàng mới #${code}!`);

      const rawNum =
        newOrder?.orderNumber ||
        newOrder?.orderCode ||
        (newOrder?.id ? String(newOrder.id).slice(-6) : 'SOB');
      const orderNumber = String(rawNum).replace(/^#/, '');

      if (cancelAlertTimerRef.current) clearTimeout(cancelAlertTimerRef.current);
      statusUpdatesRef.current.clear();
      ++orderListRevision.current;
      setNewOrderAlert({
        type: 'CREATE',
        orderNumber,
        customerName: normalizedEvent.customerName || newOrder?.customerName || newOrder?.customer?.user?.fullName || 'Khách hàng',
        customerPhone: newOrder?.customerPhone || normalizedEvent.customerPhone,
        productName: normalizedEvent.productName || newOrder?.items?.[0]?.product?.name || newOrder?.items?.[0]?.productName || 'Nhu yếu phẩm',
        quantity: normalizedEvent.quantity || newOrder?.items?.[0]?.quantity || 1,
        totalAmount: newOrder?.totalAmount ?? normalizedEvent.totalAmount,
        deliveryAddress: newOrder?.deliveryAddress || normalizedEvent.deliveryAddress,
        orderId: newOrder?.id || normalizedEvent.orderId || normalizedEvent.id,
      });

      fetchOrders();
    };

    const handleOrderCancelled = (payload: any) => {
      payload = normalizeOrderEvent(payload, 'ORDER_CANCELLED');
      if (storeId && payload.order.storeId && String(payload.order.storeId) !== storeId) return;
      const rawNum =
        payload.order?.orderNumber ||
        payload.orderNumber ||
        (payload.orderId ? String(payload.orderId).slice(-6) : (payload.id ? String(payload.id).slice(-6) : 'SOB'));
      const orderNumber = String(rawNum).replace(/^#/, '');

      setNewOrderAlert({
        customerName: payload.order.customerName,
        customerPhone: payload.order.customerPhone,
        deliveryAddress: payload.order.deliveryAddress,
        type: 'CANCEL',
        orderNumber,
        reason: payload.reason || payload.cancellationReason || 'Đơn hàng đã được hủy',
      });
      if (payload.order?.id) {
        setOrders((prev) =>
          prev.map((o) => (o.id === payload.order.id ? { ...o, status: 'CANCELLED' as any } : o))
        );
      }
      fetchOrders();

      if (cancelAlertTimerRef.current) clearTimeout(cancelAlertTimerRef.current);
      cancelAlertTimerRef.current = setTimeout(() => {
        setNewOrderAlert(null);
      }, 4000);
    };

    const handleOrderUpdated = (data?: any) => {
      if (['CANCELLED', 'REJECTED'].includes(normalizeOrderEvent(data).status)) {
        handleOrderCancelled(data);
        return;
      }
      const updated = data?.order || data;
      if (storeId && updated?.storeId && String(updated.storeId) !== storeId) return;
      const updatedId = String(updated?.id || updated?.orderId || '');
      if (updatedId) {
        setOrders((prev) =>
          prev.map((o) => (o.id === updatedId ? mergeOrderUpdate(o, { ...updated, id: updatedId }) : o))
        );
      }
      fetchOrders();

      if (updated && updated.status && updated.status !== 'PENDING') {
        setNewOrderAlert((currentAlert: any) => {
          // A cancellation alert must remain visible for its timer. A status
          // event normally follows ORDER_CANCELLED and previously cleared it
          // immediately before the user could see it.
          if (!currentAlert || currentAlert.type !== 'CREATE') return currentAlert;
          const matchId =
            currentAlert.orderId &&
            (currentAlert.orderId === updated.id || currentAlert.orderId === updated.orderId);
          const matchNum =
            currentAlert.orderNumber &&
            String(currentAlert.orderNumber).replace(/^#/, '') ===
              String(updated.orderNumber || '').replace(/^#/, '');
          if (matchId || matchNum) {
            return null; // DISMISS IMMEDIATELY WHEN STORE OR ANYONE ACCEPTS
          }
          return currentAlert;
        });
      }
    };

    const handleLocalEvent = (event: Event) => {
      const { type, payload } = (event as CustomEvent).detail;
      if (type === 'ORDER_CREATED') handleOrderCreated(payload);
      else if (type === 'ORDER_CANCELLED') handleOrderCancelled(payload);
      else handleOrderUpdated(payload);
    };
    window.addEventListener(ORDER_EVENT, handleLocalEvent);
    window.addEventListener('focus', fetchOrders);

    const unsubRentals = subscribeRentalChannelEvents({
      onRentalPurchased: (data) => {
        playOrderChime();
        toast.success(
          `Khách hàng ${data.customerName || 'Khách'} vừa đăng ký gói thuê ${data.packageName} (${data.buttonQuantity || 1} nút IoT)!`,
          { title: '📦 Đăng ký thuê nút mới!', duration: 7000 }
        );
      },
    });

    const handleDevicesAllocated = (payload: any) => {
      if (user?.storeId && payload?.storeId && String(user.storeId) !== String(payload.storeId)) {
        return;
      }
      fetchOrders();
      toast.success(
        payload.message || `Cửa hàng vừa nhận bàn giao ${payload.allocatedCount || ''} nút bấm mới vào kho!`,
        { title: '📦 Thiết bị mới về kho 🎉', duration: 7000 }
      );
    };

    socket.on('ORDER_CREATED', handleOrderCreated);
    socket.on('order:created', handleOrderCreated);
    socket.on('ORDER_STATUS_CHANGED', handleOrderUpdated);
    socket.on('ORDER_PAYMENT_CHANGED', handleOrderUpdated);
    socket.on('ORDER_PAYMENT_CONFIRMED', (payload: any) => {
      handleOrderUpdated(payload);
      const rawNum = payload?.order?.orderNumber || payload?.orderCode || payload?.orderId || '';
      const amount = payload?.amount ? Number(payload.amount).toLocaleString('vi-VN') + ' ₫' : '';
      toast.success(
        `Đơn hàng #${rawNum} đã thanh toán PayOS thành công ${amount ? `(${amount})` : ''}!`,
        { title: '💰 Khách đã thanh toán PayOS 🎉', duration: 6000 }
      );
    });
    socket.on('order:status_changed', handleOrderUpdated);
    socket.on('order:updated', handleOrderUpdated);
    socket.on('ORDER_CANCELLED', handleOrderCancelled);
    socket.on('DEVICES_ALLOCATED', handleDevicesAllocated);
    socket.on('devices:allocated', handleDevicesAllocated);

    // Socket.IO provides immediate updates; this is a low-frequency fallback if it disconnects.
    const pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      fetchOrders();
    }, 15000);

    return () => {
      clearInterval(pollTimer);
      socket.off('ORDER_CREATED', handleOrderCreated);
      socket.off('order:created', handleOrderCreated);
      socket.off('ORDER_STATUS_CHANGED', handleOrderUpdated);
      socket.off('ORDER_PAYMENT_CHANGED', handleOrderUpdated);
      socket.off('ORDER_PAYMENT_CONFIRMED', handleOrderUpdated);
      socket.off('order:status_changed', handleOrderUpdated);
      socket.off('order:updated', handleOrderUpdated);
      socket.off('ORDER_CANCELLED', handleOrderCancelled);
      socket.off('DEVICES_ALLOCATED', handleDevicesAllocated);
      socket.off('devices:allocated', handleDevicesAllocated);
      window.removeEventListener(ORDER_EVENT, handleLocalEvent);
      window.removeEventListener('focus', fetchOrders);
      unsubRentals();
      if (cancelAlertTimerRef.current) clearTimeout(cancelAlertTimerRef.current);
    };
  }, [user, token]);

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    if (statusUpdatesRef.current.has(orderId)) return;
    const previous = orders.find((order) => order.id === orderId);
    if (!previous) return;
    // Completing an order can settle money: show success only after the API.
    const displayStatus = nextStatus === 'COMPLETED' ? String(previous.orderStatus || previous.status) : nextStatus;
    const operation = { previous, displayStatus };
    statusUpdatesRef.current.set(orderId, operation);
    ++orderListRevision.current;
    setPendingStatusUpdates((current) => ({ ...current, [orderId]: nextStatus }));
    // The row reads orderStatus first, so both aliases must change together.
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: displayStatus as Order['status'], orderStatus: displayStatus } : o))
    );

    setNewOrderAlert((currentAlert: any) => {
      if (!currentAlert) return null;
      const targetOrder = orders.find((o) => o.id === orderId);
      const matchId = currentAlert.orderId === orderId;
      const matchNum =
        targetOrder &&
        currentAlert.orderNumber &&
        String(targetOrder.orderNumber || '').replace(/^#/, '') === String(currentAlert.orderNumber).replace(/^#/, '');
      if (matchId || matchNum) {
        return null; // DISMISS IMMEDIATELY UPON ACCEPTING
      }
      return currentAlert;
    });

    try {
      const res = await api.patch(`/orders/${orderId}/status`, { status: nextStatus });
      if (statusUpdatesRef.current.get(orderId) !== operation) return;
      ++orderListRevision.current;
      if (res.data.success) {
        const existingOrder = latestOrdersRef.current.find((order) => order.id === orderId) || previous;
        const returnedOrder = res.data.data || { id: orderId, status: nextStatus };
        const updatedOrder = existingOrder ? mergeOrderUpdate(existingOrder, returnedOrder) : normalizeOrder(returnedOrder);
        setOrders((current) => current.map((order) => order.id === orderId ? mergeOrderUpdate(order, returnedOrder) : order));
        publishOrderEvent(['CANCELLED', 'REJECTED'].includes(nextStatus) ? 'ORDER_CANCELLED' : 'ORDER_STATUS_CHANGED', { order: updatedOrder });
        if (nextStatus === 'CONFIRMED') {
          toast.success('Đơn hàng đã được tiếp nhận.', { title: 'Đã nhận đơn', duration: 4000 });
        } else if (nextStatus === 'PREPARING') {
          toast.success('Đang chuẩn bị sản phẩm.', { title: 'Chuẩn bị hàng', duration: 4000 });
        } else if (nextStatus === 'READY_FOR_DELIVERY') {
          toast.success('Đơn hàng sẵn sàng để bắt đầu giao.', { title: 'Sẵn sàng giao', duration: 4000 });
        } else if (nextStatus === 'SHIPPING') {
          toast.success('Đơn hàng đang được giao đến khách hàng.', { title: 'Bắt đầu giao', duration: 4000 });
        } else if (nextStatus === 'DELIVERED') {
          toast.success('Đã xác nhận giao hàng. Hãy hoàn tất đơn để cộng tiền vào ví.', { title: 'Đã giao', duration: 5000 });
        } else if (nextStatus === 'COMPLETED') {
          toast.success('Đã giao thành công! Tiền đã cộng vào Ví Cửa Hàng.', { title: 'Giao thành công 🎉', duration: 5000 });
        }
      } else {
        throw new Error(res.data.message || 'Không thể cập nhật trạng thái');
      }
    } catch (e: any) {
      if (statusUpdatesRef.current.get(orderId) !== operation) return;
      statusUpdatesRef.current.delete(orderId);
      ++orderListRevision.current;
      // Restore status only; keep newer payment/contact data from socket events.
      setOrders((current) => current.map((order) => order.id === orderId && String(order.orderStatus || order.status) === displayStatus
        ? { ...order, status: previous.status, orderStatus: previous.orderStatus || previous.status }
        : order));
      toast.error(e.response?.data?.message || e.message || 'Không thể cập nhật trạng thái');
      void fetchOrders();
    } finally {
      // A response from an old page/session must not unlock a newer request.
      const activeOperation = statusUpdatesRef.current.get(orderId);
      if (activeOperation && activeOperation !== operation) return;
      if (statusUpdatesRef.current.get(orderId) === operation) statusUpdatesRef.current.delete(orderId);
      setPendingStatusUpdates((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
    }
  };

  const showToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3500);
  };

  // Handle Exact Stock Change (Direct manual input)
  const handleStockChange = (id: string, val: string | number) => {
    const num = Math.max(0, parseInt(String(val), 10) || 0);
    setInventoryList((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, stock: num } : item));
      saveStoreCatalog(updated);
      return updated;
    });
  };

  // Handle Image Upload for existing product
  const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Url = reader.result as string;
      setInventoryList((prev) => {
        const updated = prev.map((item) => (item.id === id ? { ...item, imageUrl: base64Url } : item));
        saveStoreCatalog(updated);
        return updated;
      });
      showToast('Đã gắn ảnh mới cho sản phẩm thành công!');
    };
    reader.readAsDataURL(file);
  };

  // Handle Paste Image URL
  const handleImageUrlPrompt = (id: string, currentUrl: string) => {
    const url = prompt('Nhập đường link ảnh (URL) mới cho sản phẩm:', currentUrl);
    if (url && url.trim()) {
      setInventoryList((prev) => {
        const updated = prev.map((item) => (item.id === id ? { ...item, imageUrl: url.trim() } : item));
        saveStoreCatalog(updated);
        return updated;
      });
      showToast('Đã gắn link ảnh cho sản phẩm!');
    }
  };

  // Delete product from inventory
  const handleDeleteProduct = (id: string, name: string) => {
    if (confirm(`Bạn có chắc muốn xóa sản phẩm "${name}" khỏi kho cửa hàng?`)) {
      setInventoryList((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        saveStoreCatalog(updated);
        return updated;
      });
      showToast(`Đã xóa sản phẩm "${name}" khỏi kho`);
    }
  };

  // Add new store product
  const handleAddNewProduct = () => {
    if (!newProdName.trim()) {
      alert('Vui lòng nhập tên sản phẩm');
      return;
    }
    const newProduct: StoreCatalogItem = {
      id: `custom-prod-${Date.now()}`,
      sku: `CUSTOM-${Date.now().toString().slice(-6)}`,
      name: newProdName.trim(),
      brand: newProdBrand.trim() || 'Cửa hàng',
      category: newProdCategory,
      unit: newProdUnit.trim() || 'Chai',
      price: newProdPrice || 0,
      stock: Math.max(0, newProdStock || 0),
      minStockAlert: 10,
      imageUrl: newProdImage.trim() || 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80',
      description: 'Sản phẩm do chủ cửa hàng thêm và quản lý trực tiếp.',
      badge: 'Sản phẩm quán',
      rating: 5.0,
    };

    setInventoryList((prev) => {
      const updated = [newProduct, ...prev];
      saveStoreCatalog(updated);
      return updated;
    });

    setNewProdName('');
    setNewProdBrand('');
    setNewProdImage('');
    setNewProdStock(50);
    setNewProdPrice(45000);
    setShowAddProductForm(false);
    showToast(`Đã thêm sản phẩm "${newProduct.name}" vào kho hàng!`);
  };

  // Filtered inventory list
  const filteredInventory = inventoryList.filter((item) => {
    const matchCategory = inventoryCategory === 'Tất cả' || item.category === inventoryCategory;
    const matchSearch =
      !inventorySearch.trim() ||
      item.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      item.brand.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      item.category.toLowerCase().includes(inventorySearch.toLowerCase());
    return matchCategory && matchSearch;
  });

  // Metrics calculations
  const totalRevenue = orderDashboardMetrics(orders).provisionalSales;

  const pendingCount = orders.filter((o) => o.status === 'PENDING').length;
  const inProgressCount = orders.filter((o) => ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'SHIPPING', 'READY_FOR_DELIVERY'].includes(o.status)).length;
  const completedCount = orders.filter((o) => ['COMPLETED', 'DELIVERED'].includes(o.status as string)).length;

  const priorityMap: Record<string, number> = {
    PENDING: 1,
    CONFIRMED: 2,
    PREPARING: 3,
    OUT_FOR_DELIVERY: 4,
    SHIPPING: 4,
    READY_FOR_DELIVERY: 4,
    COMPLETED: 5,
    DELIVERED: 5,
    CANCELLED: 6,
    REJECTED: 7,
  };

  const filteredOrders = orders
    .filter((o) => {
      const matchStatus =
        statusFilter === 'ALL' ||
        o.status === statusFilter ||
        (statusFilter === 'COMPLETED' && (o.status as string) === 'DELIVERED') ||
        (statusFilter === 'OUT_FOR_DELIVERY' && ['SHIPPING', 'READY_FOR_DELIVERY'].includes(o.status as string));
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
        (o.customerName && o.customerName.toLowerCase().includes(q)) ||
        (o.customerPhone && o.customerPhone.includes(q)) ||
        (o.deliveryAddress && o.deliveryAddress.toLowerCase().includes(q)) ||
        (Array.isArray(o.items) && o.items.some((it) => it.productName?.toLowerCase().includes(q)));
      return matchStatus && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'PRIORITY') {
        const pA = priorityMap[a.status] || 99;
        const pB = priorityMap[b.status] || 99;
        if (pA !== pB) return pA - pB;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'NEWEST') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  // Reset pagination to page 1 on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, filteredOrders.length);
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + PAGE_SIZE);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    if (tableTopRef.current) {
      tableTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [1];
    if (currentPage > 3) {
      pages.push('...');
    }
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) {
      pages.push('...');
    }
    pages.push(totalPages);
    return pages;
  };

  // Status presentation; existing status mappings and pulse are preserved.
  const renderStatus = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="store-order-status store-order-status--pending">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
            Chờ xác nhận
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="store-order-status store-order-status--confirmed">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
            Đã tiếp nhận
          </span>
        );
      case 'PREPARING':
        return (
          <span className="store-order-status store-order-status--preparing">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0"></span>
            Đang chuẩn bị
          </span>
        );
      case 'READY_FOR_DELIVERY':
        return (
          <span className="store-order-status store-order-status--ready">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
            Sẵn sàng giao
          </span>
        );
      case 'OUT_FOR_DELIVERY':
      case 'SHIPPING':
        return (
          <span className="store-order-status store-order-status--shipping">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
            Đang giao
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="store-order-status store-order-status--delivered">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            Đã giao · Chờ hoàn tất
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="store-order-status store-order-status--completed">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            Đã giao
          </span>
        );
      case 'CANCELLED':
      case 'REJECTED':
        return (
          <span className="store-order-status store-order-status--cancelled">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
            Đã hủy
          </span>
        );
      default:
        return (
          <span className="store-order-status store-order-status--unknown">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0"></span>
            {status === 'DELIVERED' ? 'Đã giao' : status}
          </span>
        );
    }
  };

  // Motion physics for table rows
  const tableContainerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const tableRowVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2, ease: 'easeOut' },
    },
  };

  const getOrderShortCode = (num?: string | null): string => {
    if (!num) return '';
    const clean = String(num).trim().replace(/^Đơn\s*#?/i, '').replace(/^#/, '');
    if (clean.includes('-')) {
      const parts = clean.split('-');
      return parts[parts.length - 1];
    }
    return clean.length > 6 ? clean.slice(-4) : clean;
  };

  const cleanOrderNumber = String(newOrderAlert?.orderNumber || '')
    .trim()
    .replace(/^Đơn\s*#?/i, '')
    .replace(/^#/, '');

  const alertShortCode = getOrderShortCode(cleanOrderNumber);

  // Look up if this order exists in current orders list and check its status
  const matchedAlertOrder = newOrderAlert?.type === 'CREATE'
    ? orders.find(
        (o) =>
          (newOrderAlert.orderId && o.id === newOrderAlert.orderId) ||
          (cleanOrderNumber && String(o.orderNumber || '').replace(/^#/, '') === cleanOrderNumber)
      )
    : undefined;

  // Strict rule: new order alert is ONLY visible while the order is PENDING (chưa tiếp nhận)
  const isAlertVisible = Boolean(
    newOrderAlert &&
    (newOrderAlert.type === 'CANCEL' || !matchedAlertOrder || matchedAlertOrder.status === 'PENDING')
  );

  return (
    <div className="store-orders w-full text-zinc-900 dark:text-zinc-100">

      {/* ── Page Header ── */}
      <div className="w-full">
        {/* Page Title Row */}
        <div className="store-orders-header">
          <div>
            <div className="store-orders-title-row">
              <h1 className="store-orders-title">
                Đơn Hàng Trực Tiếp
              </h1>
              <span className="store-orders-live">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                LIVE
              </span>
            </div>
            <p className="store-orders-subtitle">
              Luồng sự kiện tức thì từ Smart Order Button trong mạng lưới khách hàng
            </p>
          </div>
        </div>
      </div>

            {/* Cửa hàng bị ngừng hoạt động notice banner */}
      {isSuspended && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200 shadow-sm">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-rose-900 dark:text-rose-100">
                  Tài khoản của bạn bị ngừng hoạt động
                </h3>
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                  TẠM NGỪNG HOẠT ĐỘNG
                </span>
              </div>
              <p className="mt-1 text-xs text-rose-800 dark:text-rose-300">
                {suspendedNotice.reason}
              </p>
              <p className="mt-1 text-[11px] text-rose-700/80 dark:text-rose-400/80">
                Cửa hàng hiện không thể nhận đơn hàng hoặc đăng bán sản phẩm lên sàn Smart Order Button. Hãy liên hệ với ban quản trị hệ thống để được hỗ trợ mở khóa.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSuspendedModal(true)}
              className="shrink-0 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-zinc-900 dark:text-rose-300 transition-colors cursor-pointer"
            >
              Xem chi tiết
            </button>
          </div>
        </div>
      )}

      {/* Modal popup cảnh báo tài khoản bị ngừng hoạt động */}
      {showSuspendedModal && isSuspended && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-2xl dark:border-rose-900 dark:bg-zinc-900">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/60">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                  Tài khoản của bạn bị ngừng hoạt động
                </h2>
                <p className="text-xs text-zinc-500">Thông báo từ Quản trị viên</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-rose-50 p-3.5 text-xs text-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
              <p className="font-semibold">{suspendedNotice.reason}</p>
              <p className="mt-1.5 opacity-90">
                Cửa hàng {suspendedNotice.storeName ? `"${suspendedNotice.storeName}"` : ''} tạm thời bị khóa các tính năng bán hàng và nhận đơn trên sàn Smart Order Button.
              </p>
            </div>
            <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
              Nếu bạn có bất kỳ thắc mắc nào hoặc muốn mở lại hoạt động của cửa hàng, vui lòng liên hệ với ban quản trị hệ thống.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowSuspendedModal(false)}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 shadow-2xs hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 cursor-pointer"
              >
                Đã hiểu
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 cursor-pointer"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Newly registered store package alert */}
      {user?.role === 'STORE_OWNER' && !listingAccess.isGrandfathered && !listingAccess.allowed && listingAccess.requiresSubscription && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-semibold">Cửa hàng chưa kích hoạt gói dịch vụ</p>
              <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/90">
                Cửa hàng cần đăng ký gói dịch vụ để có thể đăng tải sản phẩm và nhận đơn hàng trên sàn thương mại Smart Order Button.
              </p>
            </div>
          </div>
          <Link
            to="/store/service-plans"
            className="inline-flex min-h-9 items-center rounded-lg bg-[#287DA8] px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-[#206588] transition-colors"
          >
            Đăng ký gói dịch vụ ngay →
          </Link>
        </div>
      )}
      {/* ── Metrics Strip ── */}
      <div className="w-full">
        {ordersError && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{ordersError}</p>}
      <div className="store-orders-metrics">
          {[
            {
              label: 'Chờ xử lý',
              value: pendingCount,
              sub: 'cần xác nhận ngay',
              dot: 'bg-amber-500',
              urgent: pendingCount > 0,
              valueColor: pendingCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-900 dark:text-zinc-100',
            },
            {
              label: 'Đang tiến hành',
              value: inProgressCount,
              sub: 'chuẩn bị & giao',
              dot: 'bg-[#287DA8]',
              urgent: false,
              valueColor: 'text-zinc-900 dark:text-zinc-100',
            },
            {
              label: 'Đã hoàn thành',
              value: completedCount,
              sub: 'giao thành công',
              dot: 'bg-[#4AA785]',
              urgent: false,
              valueColor: 'text-zinc-900 dark:text-zinc-100',
            },
            {
              label: 'Doanh số tạm tính',
              value: null,
              revenue: totalRevenue,
              sub: 'các đơn không bị hủy / từ chối',
              dot: null,
              urgent: false,
              valueColor: 'text-zinc-900 dark:text-zinc-100',
            },
          ].map((m, i) => (
            <div key={i} className="store-orders-metric">
              <div className="store-orders-metric-label-row">
                <span className="store-orders-metric-label">
                  {m.label}
                </span>
                {m.dot && (
                  <span className={`w-2 h-2 rounded-full ${m.dot} ${m.urgent ? 'animate-pulse' : ''}`}></span>
                )}
                {!m.dot && (
                  <DollarSign className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                )}
              </div>
              {m.revenue !== undefined ? (
                <div className="store-orders-metric-value text-zinc-900 dark:text-zinc-100">
                  {formatMetric(!ordersReady ? null : m.revenue)}
                  {ordersReady && m.revenue !== null && <span className="store-orders-currency">₫</span>}
                </div>
              ) : (
                <div className={`store-orders-metric-value ${m.valueColor}`}>
                  {!ordersReady ? '—' : m.value}
                </div>
              )}
              <p className="store-orders-metric-description">{m.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Analytics Chart (Collapsible) ── */}
      {showChart && (
        <div className="w-full">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[12.5px] font-bold text-zinc-900 dark:text-zinc-100">
                  Xu Hướng Đơn Hàng
                </span>
                <span className="ml-2 text-xs text-zinc-600 dark:text-zinc-400">7 ngày gần nhất</span>
              </div>
              <button
                type="button"
                onClick={() => setShowChart(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <React.Suspense fallback={<div className="w-full h-72 flex items-center justify-center text-sm text-zinc-500" role="status">Đang tải biểu đồ...</div>}>
              <AnalyticsChart data={chartData} />
            </React.Suspense>
          </div>
        </div>
      )}

      {/* ── Orders Table Section ── */}
      <div className="store-orders-list">

        {/* Filter Bar */}
        <div className="store-orders-toolbar">
          {/* Status Tabs with Framer Motion layoutId gliding pill */}
          <div className="store-orders-tabs">
            {[
              { key: 'ALL', label: 'Tất cả', count: orders.length },
              { key: 'PENDING', label: 'Chờ xử lý', count: pendingCount, urgent: pendingCount > 0 },
              { key: 'CONFIRMED', label: 'Đã nhận' },
              { key: 'PREPARING', label: 'Chuẩn bị' },
              { key: 'OUT_FOR_DELIVERY', label: 'Đang giao' },
              { key: 'COMPLETED', label: 'Đã giao', count: completedCount },
              { key: 'CANCELLED', label: 'Đã hủy' },
            ].map((tab) => {
              const isActive = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`store-orders-tab relative rounded-md font-medium whitespace-nowrap transition-colors flex items-center gap-2 z-10 cursor-pointer ${
                    isActive
                      ? 'text-white font-semibold'
                      : 'text-zinc-600 dark:text-zinc-300 hover:text-[#206588] dark:hover:text-white hover:bg-[#287DA8]/5 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="activeStoreDashboardTab"
                      className="absolute inset-0 bg-[#206588] rounded-md -z-10 shadow-sm pointer-events-none"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`store-orders-tab-count px-1.5 py-0.5 rounded leading-none transition-colors ${
                        isActive
                          ? 'bg-white/25 text-white font-bold'
                          : (tab as any).urgent
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search + Sort */}
          <div className="store-orders-search-sort">
            <div className="store-orders-search relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm kiếm đơn hàng"
                placeholder="Tìm mã đơn, tên, SĐT, địa chỉ..."
                className="store-orders-input w-full transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="store-orders-search-clear absolute right-1 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="Sắp xếp đơn hàng"
              className="store-orders-sort cursor-pointer"
            >
              <option value="PRIORITY">Ưu tiên xử lý</option>
              <option value="NEWEST">Mới nhất</option>
              <option value="OLDEST">Cũ nhất</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div ref={tableTopRef} className="store-orders-table-panel overflow-hidden scroll-mt-20">
          {loading && orders.length === 0 ? (
            <div className="store-orders-placeholder text-center">
              <div className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 animate-pulse inline-block"></span>
                Đang tải dữ liệu đơn hàng...
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="store-orders-placeholder text-center space-y-2">
              <ShoppingBag className="w-9 h-9 text-zinc-600 dark:text-zinc-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                Không có đơn hàng nào khớp với bộ lọc
              </p>
            </div>
          ) : (
            <>
              <div className="store-orders-table-scroll" tabIndex={0} role="region" aria-label="Danh sách đơn hàng, cuộn ngang để xem đầy đủ">
              <table className="store-orders-table w-full text-left border-collapse">
                <caption className="sr-only">Đơn hàng với thông tin người nhận, giao hàng, thanh toán, trạng thái và thao tác</caption>
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                    <th scope="col" className="font-semibold">Mã đơn</th>
                    <th scope="col" className="font-semibold">Người nhận</th>
                    <th scope="col" className="font-semibold">Địa chỉ</th>
                    <th scope="col" className="font-semibold">Mặt hàng</th>
                    <th scope="col" className="font-semibold">Trạng thái</th>
                    <th scope="col" className="font-semibold text-right">Thao tác</th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={tableContainerVariants}
                  initial="hidden"
                  animate="show"
                  className="divide-y divide-zinc-200/70 dark:divide-zinc-800 text-sm"
                >
                  {paginatedOrders.map((order) => {
                    const items = Array.isArray(order.items) ? order.items : [];
                    const firstItem = items[0];
                    const otherCount = Math.max(0, items.length - 1);
                    const confirmedStatus = String((order as any).orderStatus || order.status || '').toUpperCase();
                    const pendingStatus = pendingStatusUpdates[order.id];
                    const orderStatus = pendingStatus && pendingStatus !== 'COMPLETED' && !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(confirmedStatus)
                      ? pendingStatus : confirmedStatus;
                    const isCancelled = ['CANCELLED', 'REJECTED'].includes(orderStatus);
                    return (
                      <motion.tr
                        key={order.id}
                        variants={tableRowVariants}
                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors group"
                      >
                        {/* Mã đơn / Giờ */}
                        <td className="store-orders-code-cell">
                          <div
                            className="store-orders-code"
                            title={`Mã đầy đủ: #${order.orderNumber}`}
                          >
                            <span className="font-bold text-slate-900 dark:text-zinc-100">
                              #{getOrderShortCode(order.orderNumber)}
                            </span>
                            {order.orderNumber.includes('-') && (
                              <span className="store-orders-reference">
                                · {order.orderNumber.slice(0, order.orderNumber.lastIndexOf('-'))}
                              </span>
                            )}
                          </div>
                          <div className="store-orders-time">
                            {new Date(order.createdAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {' · '}
                            {new Date(order.createdAt).toLocaleDateString('vi-VN', {
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </div>
                        </td>

                        {/* Người nhận ghi trên đơn hàng */}
                        <td className="store-orders-recipient-cell">
                          <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 whitespace-normal break-words">
                            {order.customerName || 'Chưa có tên người nhận'}
                          </div>
                          <div className="store-orders-secondary flex items-center gap-1.5 mt-1">
                            <Phone className="w-3 h-3 shrink-0" />
                            {order.customerPhone ? <a href={`tel:${order.customerPhone}`} className="break-all hover:underline">{order.customerPhone}</a> : 'Chưa có số điện thoại'}
                          </div>
                        </td>

                        {/* Địa chỉ */}
                        <td className="store-orders-address-cell">
                          <div
                            className="whitespace-pre-line break-words text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300"
                            title={order.deliveryAddress}
                          >
                            {order.deliveryAddress || 'Chưa có địa chỉ giao hàng'}
                          </div>
                          {deliveryMapUrl(order) && <a href={deliveryMapUrl(order)!} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-medium text-[#206588] dark:text-sky-300 hover:underline">Xem vị trí giao hàng</a>}
                          {order.device && (
                            <div className="store-orders-secondary flex items-center gap-1.5 mt-1">
                              <Radio className="w-3 h-3 text-emerald-600 shrink-0" />
                              {order.device.configuration?.customName || order.device.deviceId}
                            </div>
                          )}
                        </td>

                        {/* Mặt hàng */}
                        <td className="store-orders-product-cell">
                          <div className="text-sm text-zinc-900 dark:text-zinc-100 font-semibold break-words">
                            {firstItem ? `${firstItem.quantity}× ${firstItem.productName}` : 'Đơn hàng'}
                            {otherCount > 0 && (
                              <span className="text-xs text-zinc-600 dark:text-zinc-400 ml-1 font-normal">+{otherCount} món</span>
                            )}
                          </div>
                          <div className="store-orders-payment">
                            <span className="store-orders-amount">
                              {Number(order.totalAmount || (order as any).total_amount || 0).toLocaleString()} ₫
                            </span>
                            {isCancelled ? (
                              <span className="text-zinc-600 dark:text-zinc-400">Đơn đã hủy · Không cần thanh toán</span>
                            ) : order.paymentStatus === 'REFUND_PENDING' ? (
                              <span className="text-rose-600 dark:text-rose-400">Đã nhận tiền · Chờ hoàn PayOS</span>
                            ) : order.paymentStatus === 'PAID' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium">
                                <Check className="w-3 h-3" />
                                {['CASH_ON_DELIVERY', 'COD'].includes(order.paymentMethod as string) ? 'Đã thu tiền mặt' : 'Đã thanh toán (PayOS)'}
                              </span>
                            ) : ['CASH_ON_DELIVERY', 'COD'].includes(order.paymentMethod as string) ? (
                              <span className="text-amber-700 dark:text-amber-300 font-medium">COD · Chờ thu tiền khi giao</span>
                            ) : order.paymentMethod === 'PAYOS' ? (
                              <span className="text-amber-700 dark:text-amber-300 font-medium">Chờ thanh toán PayOS</span>
                            ) : (
                              <span className="text-zinc-600 dark:text-zinc-400">Chờ thanh toán</span>
                            )}
                          </div>
                        </td>

                        {/* Trạng thái */}
                        <td className="store-orders-status-cell">
                          {renderStatus(orderStatus)}
                        </td>

                        {/* Thao tác */}
                        <td className="store-orders-action-cell text-right">
                          <fieldset disabled={Boolean(pendingStatusUpdates[order.id])} aria-busy={Boolean(pendingStatusUpdates[order.id])} className="m-0 min-w-0 border-0 p-0 disabled:opacity-60">
                          {orderStatus === 'PENDING' && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'CONFIRMED')}
                              className="store-orders-action bg-[#206588] hover:bg-[#194f6b] text-white font-semibold rounded-md shadow-sm transition-all cursor-pointer"
                            >
                              Tiếp nhận
                            </motion.button>
                          )}
                          {orderStatus === 'CONFIRMED' && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'PREPARING')}
                              className="store-orders-action bg-[#206588] hover:bg-[#194f6b] text-white font-semibold rounded-md shadow-sm transition-all cursor-pointer"
                            >
                              Chuẩn bị
                            </motion.button>
                          )}
                          {orderStatus === 'PREPARING' && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'READY_FOR_DELIVERY')}
                              className="store-orders-action bg-[#206588] hover:bg-[#194f6b] text-white font-semibold rounded-md shadow-sm transition-all cursor-pointer"
                            >
                              Xuất giao
                            </motion.button>
                          )}
                          {orderStatus === 'READY_FOR_DELIVERY' && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'SHIPPING')}
                              className="store-orders-action bg-[#206588] hover:bg-[#194f6b] text-white font-semibold rounded-md shadow-sm transition-all cursor-pointer"
                            >
                              Bắt đầu giao
                            </motion.button>
                          )}
                          {(orderStatus === 'OUT_FOR_DELIVERY' || orderStatus === 'SHIPPING') && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'DELIVERED')}
                              className="store-orders-action bg-[#237455] hover:bg-[#195a40] text-white font-semibold rounded-md shadow-sm transition-all cursor-pointer"
                            >
                              Đã giao ✓
                            </motion.button>
                          )}
                          {orderStatus === 'DELIVERED' && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'COMPLETED')}
                              className="store-orders-action bg-[#237455] hover:bg-[#195a40] text-white font-semibold rounded-md shadow-sm transition-all cursor-pointer"
                            >
                              Hoàn tất & cộng ví
                            </motion.button>
                          )}
                          {orderStatus === 'COMPLETED' && (
                            <span className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-end gap-1 font-semibold">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              Đã giao
                            </span>
                          )}
                          {isCancelled && (
                            <span className="text-xs text-zinc-600 dark:text-zinc-400">Đã hủy</span>
                          )}
                          </fieldset>
                          {pendingStatusUpdates[order.id] && <span role="status" className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">Đang xác nhận…</span>}
                        </td>
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="store-orders-pagination border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-[13px] text-zinc-600 dark:text-zinc-400 tabular-nums">
                Hiển thị{' '}
                <span className="font-semibold text-slate-700 dark:text-zinc-200">
                  {filteredOrders.length === 0 ? 0 : startIndex + 1}–{endIndex}
                </span>{' '}
                trong tổng số{' '}
                <span className="font-semibold text-slate-700 dark:text-zinc-200">
                  {filteredOrders.length}
                </span>{' '}
                đơn hàng
              </div>

              {totalPages > 1 && (
                <div className="store-orders-page-controls flex items-center gap-1.5 ml-auto">
                  {/* Nút Trước */}
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                    className="min-w-9 min-h-9 px-2.5 py-2 text-xs font-medium rounded-md text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1 select-none"
                    title="Trang trước"
                    aria-label="Trang trước"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Trước</span>
                  </button>

                  {/* Các nút số trang */}
                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((page, idx) => {
                      if (page === '...') {
                        return (
                          <span
                            key={`ellipsis-${idx}`}
                            className="w-7 h-7 flex items-center justify-center text-xs text-slate-400 select-none"
                          >
                            …
                          </span>
                        );
                      }
                      const isCurrent = page === currentPage;
                      return (
                        <button
                          key={`page-${page}`}
                          type="button"
                          aria-label={`Trang ${page}`}
                          aria-current={isCurrent ? 'page' : undefined}
                          onClick={() => handlePageChange(Number(page))}
                          className={`min-w-9 h-9 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer tabular-nums flex items-center justify-center select-none ${
                            isCurrent
                              ? 'bg-[#206588] text-white shadow-sm font-semibold'
                              : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>

                  {/* Nút Sau */}
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="min-w-9 min-h-9 px-2.5 py-2 text-xs font-medium rounded-md text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1 select-none"
                    title="Trang sau"
                    aria-label="Trang sau"
                  >
                    <span className="hidden sm:inline">Sau</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        </div>
      </div>

      {/* ── Inventory Modal (Redesigned: Minimalist, Airy, Border-b List, Tabular Nums) ── */}
      {createPortal(
        <AnimatePresence>
          {showInventoryModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overscroll-contain responsive-modal overflow-y-auto">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
                onClick={() => setShowInventoryModal(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.93, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{
                  type: 'spring',
                  damping: 28,
                  stiffness: 350,
                  mass: 0.8,
                }}
                className="relative z-10 w-full max-w-4xl bg-white dark:bg-[#0B0F17] rounded-xl border border-slate-200/80 dark:border-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.12)] p-0 max-h-[88vh] flex flex-col overflow-hidden"
              >
                {/* 1. Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800/80 bg-white dark:bg-[#0B0F17] shrink-0">
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-semibold text-[#0F172A] dark:text-zinc-100 tracking-tight">
                  Quản Lý Kho Hàng
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-[#F1F5F9] dark:bg-zinc-800 text-[11px] font-medium text-[#475569] dark:text-zinc-400 tabular-nums">
                  {filteredInventory.length} sản phẩm
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductForm(!showAddProductForm)}
                  className="px-3 py-1.5 rounded-lg bg-[#287DA8] hover:bg-[#206588] text-white text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddProductForm ? 'Ẩn Form' : 'Thêm Món'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowInventoryModal(false)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 2. Filter Bar (Search + Categories) */}
            <div className="px-6 py-3 border-b border-slate-100 dark:border-zinc-800/80 bg-white dark:bg-[#0B0F17] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm sản phẩm, thương hiệu..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-[#F8FAFC] dark:bg-zinc-800/60 border border-slate-200/70 dark:border-zinc-700/80 text-[#0F172A] dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#287DA8] focus:ring-1 focus:ring-[#287DA8]/20 transition-all"
                />
              </div>

              {/* Categories */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0">
                {['Tất cả', 'Nước mắm', 'Nước uống', 'Gas', 'Gạo', 'Dầu ăn & Gia vị'].map((cat) => {
                  const isCatActive = inventoryCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setInventoryCategory(cat)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors cursor-pointer ${
                        isCatActive
                          ? 'bg-[#287DA8] text-white shadow-xs font-medium'
                          : 'text-[#64748B] dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto">
              {/* Toast Message */}
              {saveToast && (
                <div className="mx-6 mt-3 px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{saveToast}</span>
                </div>
              )}

              {/* Collapsible Add Product Form */}
              {showAddProductForm && (
                <div className="mx-6 mt-4 p-4 bg-[#F8FAFC] dark:bg-zinc-800/40 border border-slate-200/80 dark:border-zinc-700 rounded-xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-[#0F172A] dark:text-zinc-200">
                      Thêm Nhu Yếu Phẩm Mới Vào Kho
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddProductForm(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Tên sản phẩm *</label>
                      <input
                        type="text"
                        placeholder="VD: Nước Mắm Cốt Nhĩ Cá Cơm 500ml..."
                        value={newProdName}
                        onChange={(e) => setNewProdName(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[#0F172A] dark:text-zinc-100 focus:outline-none focus:border-[#287DA8] transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Thương hiệu</label>
                      <input
                        type="text"
                        placeholder="VD: Khải Hoàn, Chinsu..."
                        value={newProdBrand}
                        onChange={(e) => setNewProdBrand(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[#0F172A] dark:text-zinc-100 focus:outline-none focus:border-[#287DA8] transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Danh mục</label>
                      <select
                        value={newProdCategory}
                        onChange={(e) => setNewProdCategory(e.target.value as any)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[#0F172A] dark:text-zinc-100 focus:outline-none cursor-pointer"
                      >
                        <option value="Nước mắm">Nước mắm</option>
                        <option value="Nước uống">Nước uống</option>
                        <option value="Gas">Gas & Nhiên liệu</option>
                        <option value="Gạo">Gạo & Ngũ cốc</option>
                        <option value="Dầu ăn & Gia vị">Dầu ăn & Gia vị</option>
                        <option value="Nhu yếu phẩm">Nhu yếu phẩm khác</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Đơn vị quy cách</label>
                      <input
                        type="text"
                        placeholder="VD: Chai 520ml, Bình 20L..."
                        value={newProdUnit}
                        onChange={(e) => setNewProdUnit(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[#0F172A] dark:text-zinc-100 focus:outline-none focus:border-[#287DA8] transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Giá bán (₫)</label>
                      <input
                        type="number"
                        value={newProdPrice}
                        onChange={(e) => setNewProdPrice(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[#0F172A] dark:text-zinc-100 focus:outline-none tabular-nums"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Tồn kho ban đầu *</label>
                      <input
                        type="number"
                        min="0"
                        value={newProdStock}
                        onChange={(e) => setNewProdStock(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[#0F172A] dark:text-zinc-100 focus:outline-none tabular-nums font-semibold"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[11px] font-medium text-slate-600 dark:text-zinc-400">Ảnh sản phẩm</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Dán liên kết ảnh (https://...)"
                          value={newProdImage}
                          onChange={(e) => setNewProdImage(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-[#0F172A] dark:text-zinc-100 focus:outline-none focus:border-[#287DA8] transition-colors"
                        />
                        <label className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-medium cursor-pointer flex items-center gap-1.5 shrink-0 transition-colors border border-slate-200 dark:border-zinc-700">
                          <Camera className="w-3.5 h-3.5" />
                          <span>Tải Ảnh</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const r = new FileReader();
                                r.onloadend = () => setNewProdImage(r.result as string);
                                r.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAddNewProduct}
                      className="px-4 py-1.5 rounded-lg bg-[#287DA8] hover:bg-[#206588] text-white text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Lưu Sản Phẩm</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Product List (Border-b Row list, No box-in-box) */}
              <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {filteredInventory.map((item) => (
                  <div
                    key={item.id}
                    className="px-6 py-3 flex items-center justify-between hover:bg-[#F8FAFC] dark:hover:bg-zinc-800/40 transition-colors group"
                  >
                    {/* Left: Image (48x48) + Info */}
                    <div className="flex items-center gap-3.5 min-w-0 pr-4">
                      {/* Product Thumbnail with subtle hover actions */}
                      <div className="relative shrink-0 w-12 h-12 rounded-[6px] overflow-hidden border border-slate-200/80 dark:border-zinc-700/80 bg-white dark:bg-zinc-800 group/thumb">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          loading="lazy"
                          decoding="async"
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                        {/* Hover Overlay with Camera Icon */}
                        <label
                          htmlFor={`img-upload-${item.id}`}
                          className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                          title="Đổi ảnh sản phẩm"
                        >
                          <Camera className="w-3.5 h-3.5 text-white" />
                          <input
                            id={`img-upload-${item.id}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload(item.id, e)}
                          />
                        </label>

                        {/* Subtle Link icon to paste URL */}
                        <button
                          type="button"
                          onClick={() => handleImageUrlPrompt(item.id, item.imageUrl)}
                          className="absolute bottom-0.5 right-0.5 p-1 rounded bg-black/60 text-white/90 hover:text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                          title="Dán link ảnh"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      {/* Text details */}
                      <div className="min-w-0">
                        <h4 className="text-[13px] font-medium text-[#1E293B] dark:text-zinc-100 truncate leading-snug">
                          {item.name}
                        </h4>
                        <div className="text-[12px] text-[#64748B] dark:text-zinc-400 font-normal flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="font-semibold text-[#0F172A] dark:text-white tabular-nums">
                            {item.price.toLocaleString('vi-VN')} ₫
                          </span>
                          <span className="text-slate-300 dark:text-zinc-600">·</span>
                          <span>{item.unit}</span>
                          {item.brand && (
                            <>
                              <span className="text-slate-300 dark:text-zinc-600">·</span>
                              <span className="text-slate-400 dark:text-zinc-500">{item.brand}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Status Badge + Counter + Trash (Perfect Column Alignment) */}
                    <div className="flex items-center gap-4 shrink-0">
                      {/* Status Badge: Fixed width for strict column alignment */}
                      <div className="w-24 flex justify-end">
                        {item.stock === 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FEF2F2] dark:bg-rose-950/40 text-[#991B1B] dark:text-rose-400 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]"></span>
                            Hết hàng
                          </span>
                        ) : item.stock <= item.minStockAlert ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FFFBEB] dark:bg-amber-950/40 text-[#92400E] dark:text-amber-400 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>
                            Sắp hết
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F0FDF4] dark:bg-emerald-950/40 text-[#166534] dark:text-emerald-400 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]"></span>
                            Sẵn hàng
                          </span>
                        )}
                      </div>

                      {/* Quantity Stepper [- 120 +] (Fixed width number for alignment) */}
                      <div className="inline-flex items-center rounded-[6px] border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleStockChange(item.id, Math.max(0, item.stock - 1))}
                          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-xs font-semibold cursor-pointer select-none"
                          title="Giảm 1"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={item.stock}
                          onChange={(e) => handleStockChange(item.id, e.target.value)}
                          className="w-10 h-7 text-center font-medium text-xs text-[#0F172A] dark:text-zinc-100 bg-transparent focus:outline-none tabular-nums p-0"
                        />
                        <button
                          type="button"
                          onClick={() => handleStockChange(item.id, item.stock + 1)}
                          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-xs font-semibold cursor-pointer select-none"
                          title="Tăng 1"
                        >
                          +
                        </button>
                      </div>

                      {/* Delete Custom Item Button */}
                      {item.id.startsWith('custom-prod-') ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(item.id, item.name)}
                          className="w-7 h-7 rounded-[6px] flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Xóa món này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <div className="w-7 h-7" />
                      )}
                    </div>
                  </div>
                ))}

                {filteredInventory.length === 0 && (
                  <div className="py-16 text-center text-slate-400 text-xs">
                    Không tìm thấy sản phẩm nào khớp với tìm kiếm.
                  </div>
                )}
              </div>
            </div>

            {/* 4. Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 dark:border-zinc-800/80 bg-white dark:bg-[#0B0F17] flex items-center justify-between shrink-0">
              <span className="text-[11px] text-[#64748B] dark:text-zinc-400 flex items-center gap-1.5 font-normal">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Số lượng và thông tin kho lưu tự động
              </span>
              <button
                type="button"
                onClick={() => setShowInventoryModal(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[#0F172A] dark:text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )}

    </div>
  );
};
