import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { api } from '../../services/api';
import { subscribeToStore, getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/OrderSoundContext';
import { toast } from '../../context/ToastContext';
import { AnalyticsChart } from '../../components/AnalyticsChart';
import { Order } from '../../types';
import {
  Wallet,
  ShoppingBag,
  Clock,
  CheckCircle2,
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
  const { user, token } = useAuth();
  const { announceStoreOrder, testStoreBankSpeaker } = useSound();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
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
    try {
      const orderRes = await api.get('/orders');
      if (orderRes.data.success) {
        const fetchedOrders: Order[] = orderRes.data.data;
        setOrders(fetchedOrders);
        setChartData(buildChartDataFromOrders(fetchedOrders));

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
      }
    } catch (_) {
      toast.error('Không tải được dữ liệu đơn hàng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchOrders();

    if (user?.storeId) {
      subscribeToStore(user.storeId);
    }

    const socket = getSocket();

    const handleOrderCreated = (payload: any) => {
      const rawNum =
        payload.order?.orderNumber ||
        payload.orderNumber ||
        (payload.order?.id ? String(payload.order.id).slice(-6) : 'SOB');
      const orderNumber = String(rawNum).replace(/^#/, '');

      if (cancelAlertTimerRef.current) clearTimeout(cancelAlertTimerRef.current);
      setNewOrderAlert({
        type: 'CREATE',
        orderNumber,
        customerName: payload.customerName || payload.order?.customerName || payload.order?.customer?.user?.fullName || 'Khách hàng',
        productName: payload.productName || payload.order?.items?.[0]?.product?.name || payload.order?.items?.[0]?.productName || 'Nhu yếu phẩm',
        quantity: payload.quantity || payload.order?.items?.[0]?.quantity || 1,
        totalAmount: payload.order?.totalAmount ?? payload.totalAmount,
        deliveryAddress: payload.order?.deliveryAddress || payload.deliveryAddress,
        orderId: payload.order?.id || payload.orderId || payload.id,
      });

      // Instantly insert into local state without waiting for F5
      if (payload.order) {
        setOrders((prev) => {
          const exists = prev.some(
            (o) => o.id === payload.order.id || o.orderNumber === payload.order.orderNumber
          );
          if (exists) return prev;
          const safeOrder = {
            ...payload.order,
            items: Array.isArray(payload.order.items) ? payload.order.items : [],
          };
          return [safeOrder, ...prev];
        });
      }

      fetchOrders();
    };

    const handleOrderCancelled = (payload: any) => {
      const rawNum =
        payload.order?.orderNumber ||
        payload.orderNumber ||
        (payload.orderId ? String(payload.orderId).slice(-6) : (payload.id ? String(payload.id).slice(-6) : 'SOB'));
      const orderNumber = String(rawNum).replace(/^#/, '');

      setNewOrderAlert({
        type: 'CANCEL',
        orderNumber,
        reason: payload.reason || payload.cancellationReason || 'Khách hủy qua nút bấm · Đã tự động hoàn kho',
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
      const updated = data?.order || data;
      if (updated && updated.id) {
        setOrders((prev) =>
          prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o))
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
      fetchOrders();
    }, 15000);

    return () => {
      clearInterval(pollTimer);
      socket.off('ORDER_CREATED', handleOrderCreated);
      socket.off('ORDER_STATUS_CHANGED', handleOrderUpdated);
      socket.off('ORDER_PAYMENT_CHANGED', handleOrderUpdated);
      socket.off('ORDER_PAYMENT_CONFIRMED', handleOrderUpdated);
      socket.off('order:status_changed', handleOrderUpdated);
      socket.off('order:updated', handleOrderUpdated);
      socket.off('ORDER_CANCELLED', handleOrderCancelled);
      socket.off('DEVICES_ALLOCATED', handleDevicesAllocated);
      socket.off('devices:allocated', handleDevicesAllocated);
      if (cancelAlertTimerRef.current) clearTimeout(cancelAlertTimerRef.current);
    };
  }, [user]);

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    // Optimistically update orders and clear any alert matching this order
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus as any } : o))
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
      if (res.data.success) {
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
        } else if (nextStatus === 'CANCELLED' || nextStatus === 'REJECTED') {
          toast.info('Đơn hàng đã được hủy.', { title: 'Đã hủy đơn', duration: 4000 });
        }
      } else {
        fetchOrders();
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Không thể cập nhật trạng thái');
      fetchOrders();
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
  const totalRevenue = orders
    .filter((o) => o.status !== 'CANCELLED' && o.status !== 'REJECTED')
    .reduce((sum, o) => sum + o.totalAmount, 0);

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

  // Strict 6px solid dot + Sentence case text (Vercel / Linear system)
  const renderStatus = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-800 dark:text-zinc-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
            Chờ xác nhận
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
            Đã tiếp nhận
          </span>
        );
      case 'PREPARING':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0"></span>
            Đang chuẩn bị
          </span>
        );
      case 'READY_FOR_DELIVERY':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
            Sẵn sàng giao
          </span>
        );
      case 'OUT_FOR_DELIVERY':
      case 'SHIPPING':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
            Đang giao
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            Đã giao · Chờ hoàn tất
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            Đã giao
          </span>
        );
      case 'CANCELLED':
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
            Đã hủy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
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
    <div className="w-full space-y-3.5 text-zinc-900 dark:text-zinc-100">

      {/* ── Page Header ── */}
      <div className="w-full">
        {/* Page Title Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Đơn Hàng Trực Tiếp
              </h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[10px] font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
              Luồng sự kiện tức thì từ Smart Order Button trong mạng lưới khách hàng
            </p>
          </div>
        </div>
      </div>

      {/* ── Metrics Strip ── */}
      <div className="w-full">
        <div className="grid grid-cols-2 md:grid-cols-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800 overflow-hidden">
          {[
            {
              label: 'Chờ Xử Lý',
              value: pendingCount,
              sub: 'cần xác nhận ngay',
              dot: 'bg-amber-500',
              urgent: pendingCount > 0,
              valueColor: pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-100',
            },
            {
              label: 'Đang Tiến Hành',
              value: inProgressCount,
              sub: 'chuẩn bị & giao',
              dot: 'bg-[#287DA8]',
              urgent: false,
              valueColor: 'text-zinc-900 dark:text-zinc-100',
            },
            {
              label: 'Đã Hoàn Thành',
              value: completedCount,
              sub: 'giao thành công',
              dot: 'bg-[#4AA785]',
              urgent: false,
              valueColor: 'text-zinc-900 dark:text-zinc-100',
            },
            {
              label: 'Doanh Số Tạm Tính',
              value: null,
              revenue: totalRevenue,
              sub: 'đã chốt hôm nay',
              dot: null,
              urgent: false,
              valueColor: 'text-zinc-900 dark:text-zinc-100',
            },
          ].map((m, i) => (
            <div key={i} className="px-3.5 py-2.5 sm:px-4 sm:py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  {m.label}
                </span>
                {m.dot && (
                  <span className={`w-2 h-2 rounded-full ${m.dot} ${m.urgent ? 'animate-pulse' : ''}`}></span>
                )}
                {!m.dot && (
                  <DollarSign className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600" />
                )}
              </div>
              {m.revenue !== undefined ? (
                <div className="font-mono font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 leading-none">
                  {Number(m.revenue || 0).toLocaleString()}
                  <span className="text-xs font-medium text-zinc-400 ml-0.5">₫</span>
                </div>
              ) : (
                <div className={`font-mono font-bold text-xl sm:text-2xl leading-none ${m.valueColor}`}>
                  {m.value}
                </div>
              )}
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">{m.sub}</p>
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
                <span className="ml-2 text-[10.5px] font-mono text-zinc-400">7 ngày gần nhất</span>
              </div>
              <button
                type="button"
                onClick={() => setShowChart(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <AnalyticsChart data={chartData} />
          </div>
        </div>
      )}

      {/* ── Orders Table Section ── */}
      <div className="w-full space-y-2.5">

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Status Tabs with Framer Motion layoutId gliding pill */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0 relative">
            {[
              { key: 'ALL', label: 'Tất Cả', count: orders.length },
              { key: 'PENDING', label: 'Chờ Xử Lý', count: pendingCount, urgent: pendingCount > 0 },
              { key: 'CONFIRMED', label: 'Đã Nhận' },
              { key: 'PREPARING', label: 'Chuẩn Bị' },
              { key: 'OUT_FOR_DELIVERY', label: 'Đang Giao' },
              { key: 'COMPLETED', label: 'Đã Giao', count: completedCount },
              { key: 'CANCELLED', label: 'Đã Hủy' },
            ].map((tab) => {
              const isActive = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`relative px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 z-10 cursor-pointer ${
                    isActive
                      ? 'text-white font-semibold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-[#287DA8] dark:hover:text-white hover:bg-[#287DA8]/5 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="activeStoreDashboardTab"
                      className="absolute inset-0 bg-[#287DA8] rounded-md -z-10 shadow-[0_2px_8px_rgba(40,125,168,0.3)] pointer-events-none"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded-full leading-none transition-colors ${
                        isActive
                          ? 'bg-white/25 text-white font-bold'
                          : (tab as any).urgent
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
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
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã đơn, tên, SĐT..."
                className="w-full pl-8 pr-7 py-1 text-xs rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#287DA8] focus:ring-1 focus:ring-[#287DA8]/20 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2 py-1 text-xs rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 focus:outline-none focus:border-[#287DA8] cursor-pointer"
            >
              <option value="PRIORITY">Ưu tiên xử lý</option>
              <option value="NEWEST">Mới nhất</option>
              <option value="OLDEST">Cũ nhất</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div ref={tableTopRef} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden scroll-mt-20">
          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 animate-pulse inline-block"></span>
                Đang tải dữ liệu đơn hàng...
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <ShoppingBag className="w-7 h-7 text-zinc-200 dark:text-zinc-700 mx-auto" />
              <p className="text-xs font-medium text-zinc-400">
                Không có đơn hàng nào khớp với bộ lọc
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    <th className="py-2 px-3.5 font-semibold">Mã Đơn</th>
                    <th className="py-2 px-3.5 font-semibold">Khách Hàng</th>
                    <th className="py-2 px-3.5 font-semibold">Địa Chỉ</th>
                    <th className="py-2 px-3.5 font-semibold">Mặt Hàng</th>
                    <th className="py-2 px-3.5 font-semibold">Trạng Thái</th>
                    <th className="py-2 px-3.5 font-semibold text-right">Thao Tác</th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={tableContainerVariants}
                  initial="hidden"
                  animate="show"
                  className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs"
                >
                  {paginatedOrders.map((order) => {
                    const items = Array.isArray(order.items) ? order.items : [];
                    const firstItem = items[0];
                    const otherCount = Math.max(0, items.length - 1);
                    const orderStatus = String((order as any).orderStatus || order.status || '').toUpperCase();
                    const isCancelled = ['CANCELLED', 'REJECTED'].includes(orderStatus);
                    return (
                      <motion.tr
                        key={order.id}
                        variants={tableRowVariants}
                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors group"
                      >
                        {/* Mã Đơn / Giờ */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div
                            className="font-mono text-[11.5px] flex items-baseline gap-1"
                            title={`Mã đầy đủ: #${order.orderNumber}`}
                          >
                            <span className="font-bold text-slate-900 dark:text-zinc-100">
                              #{getOrderShortCode(order.orderNumber)}
                            </span>
                            {order.orderNumber.includes('-') && (
                              <span className="text-[9.5px] text-slate-400 dark:text-zinc-500 font-normal truncate max-w-[110px]">
                                · {order.orderNumber.slice(0, order.orderNumber.lastIndexOf('-'))}
                              </span>
                            )}
                          </div>
                          <div className="text-[9.5px] font-mono text-zinc-400 mt-0.5">
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

                        {/* Khách Hàng */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div className="font-semibold text-[11.5px] text-zinc-900 dark:text-zinc-100">
                            {order.customerName}
                          </div>
                          <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1 mt-0.5">
                            <Phone className="w-2.5 h-2.5" />
                            {order.customerPhone || (order as any).customer?.phoneNumber || '—'}
                          </div>
                        </td>

                        {/* Địa Chỉ */}
                        <td className="py-2.5 px-3.5 max-w-[240px]">
                          <div
                            className="truncate text-[11.5px] text-zinc-700 dark:text-zinc-300 font-medium"
                            title={order.deliveryAddress}
                          >
                            {order.deliveryAddress}
                          </div>
                          {order.device && (
                            <div className="text-[9.5px] font-mono text-zinc-400 flex items-center gap-1 mt-0.5">
                              <Radio className="w-2.5 h-2.5 text-emerald-500" />
                              {order.device.configuration?.customName || order.device.deviceId}
                            </div>
                          )}
                        </td>

                        {/* Mặt Hàng */}
                        <td className="py-2.5 px-3.5">
                          <div className="text-[11.5px] text-zinc-900 dark:text-zinc-100 font-medium">
                            {firstItem ? `${firstItem.quantity}× ${firstItem.productName}` : 'Đơn hàng'}
                            {otherCount > 0 && (
                              <span className="text-[10px] text-zinc-400 ml-1">+{otherCount} món</span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10.5px] font-mono font-semibold">
                            <span className="text-zinc-500 dark:text-zinc-400">
                              {Number(order.totalAmount || (order as any).total_amount || 0).toLocaleString()} ₫ ·
                            </span>
                            {isCancelled ? (
                              <span className="text-zinc-400 dark:text-zinc-500">Đơn đã hủy · Không cần thanh toán</span>
                            ) : order.paymentStatus === 'REFUND_PENDING' ? (
                              <span className="text-rose-600 dark:text-rose-400">Đã nhận tiền · Chờ hoàn PayOS</span>
                            ) : order.paymentStatus === 'PAID' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                <Check className="w-3 h-3" />
                                {['CASH_ON_DELIVERY', 'COD'].includes(order.paymentMethod as string) ? 'Đã thu tiền mặt' : 'Đã thanh toán (PayOS)'}
                              </span>
                            ) : ['CASH_ON_DELIVERY', 'COD'].includes(order.paymentMethod as string) ? (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">COD · Chờ thu tiền khi giao</span>
                            ) : order.paymentMethod === 'PAYOS' ? (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">Chờ thanh toán PayOS</span>
                            ) : (
                              <span className="text-zinc-400">Chờ thanh toán</span>
                            )}
                          </div>
                        </td>

                        {/* Trạng Thái */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {renderStatus(orderStatus)}
                        </td>

                        {/* Thao Tác */}
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          {orderStatus === 'PENDING' && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'CONFIRMED')}
                              className="px-2.5 py-1 bg-[#287DA8] hover:bg-[#206588] text-white text-[11px] font-semibold rounded-md shadow-[0_2px_8px_rgba(40,125,168,0.25)] transition-all cursor-pointer"
                            >
                              Tiếp Nhận
                            </motion.button>
                          )}
                          {orderStatus === 'CONFIRMED' && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'PREPARING')}
                              className="px-2.5 py-1 bg-[#287DA8] hover:bg-[#206588] text-white text-[11px] font-semibold rounded-md shadow-[0_2px_8px_rgba(40,125,168,0.25)] transition-all cursor-pointer"
                            >
                              Chuẩn Bị
                            </motion.button>
                          )}
                          {orderStatus === 'PREPARING' && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'READY_FOR_DELIVERY')}
                              className="px-2.5 py-1 bg-[#287DA8] hover:bg-[#206588] text-white text-[11px] font-semibold rounded-md shadow-[0_2px_8px_rgba(40,125,168,0.25)] transition-all cursor-pointer"
                            >
                              Xuất Giao
                            </motion.button>
                          )}
                          {orderStatus === 'READY_FOR_DELIVERY' && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'SHIPPING')}
                              className="px-2.5 py-1 bg-[#287DA8] hover:bg-[#206588] text-white text-[11px] font-semibold rounded-md shadow-[0_2px_8px_rgba(40,125,168,0.25)] transition-all cursor-pointer"
                            >
                              Bắt Đầu Giao
                            </motion.button>
                          )}
                          {(orderStatus === 'OUT_FOR_DELIVERY' || orderStatus === 'SHIPPING') && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'DELIVERED')}
                              className="px-2.5 py-1 bg-[#4AA785] hover:bg-[#3d9173] text-white text-[11px] font-semibold rounded-md shadow-[0_2px_8px_rgba(74,167,133,0.25)] transition-all cursor-pointer"
                            >
                              Đã Giao ✓
                            </motion.button>
                          )}
                          {orderStatus === 'DELIVERED' && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'COMPLETED')}
                              className="px-2.5 py-1 bg-[#4AA785] hover:bg-[#3d9173] text-white text-[11px] font-semibold rounded-md shadow-[0_2px_8px_rgba(74,167,133,0.25)] transition-all cursor-pointer"
                            >
                              Hoàn Tất & Cộng Ví
                            </motion.button>
                          )}
                          {orderStatus === 'COMPLETED' && (
                            <span className="text-[10.5px] font-mono text-[#4AA785] dark:text-[#5ec29e] flex items-center justify-end gap-1 font-semibold">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              Đã giao
                            </span>
                          )}
                          {isCancelled && (
                            <span className="text-[10.5px] font-mono text-zinc-400">Đã hủy</span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-zinc-400 tabular-nums">
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
                <div className="flex items-center gap-1.5 ml-auto">
                  {/* Nút Trước */}
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1 select-none"
                    title="Trang trước"
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
                          onClick={() => handlePageChange(Number(page))}
                          className={`min-w-7 h-7 px-2 text-xs font-medium rounded-lg transition-colors cursor-pointer tabular-nums flex items-center justify-center select-none ${
                            isCurrent
                              ? 'bg-[#0E6BA8] text-white shadow-xs font-semibold'
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
                    className="px-2.5 py-1 text-xs font-medium rounded-lg text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1 select-none"
                    title="Trang sau"
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
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overscroll-contain">
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
      {/* ── Floating Toast (Bottom-Right) for Realtime Order Events & Cancellations ── */}
      <AnimatePresence>
        {isAlertVisible && newOrderAlert && (
          <motion.div
            key={newOrderAlert.type + '-' + (cleanOrderNumber || '')}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`fixed bottom-6 right-6 z-[100] w-full max-w-[380px] bg-white dark:bg-[#0c121e] border border-slate-200/90 dark:border-zinc-800 rounded-xl shadow-2xl p-4 transition-all duration-300 animate-in slide-in-from-bottom-5 ${
              newOrderAlert.type === 'CANCEL'
                ? 'border-l-4 border-l-rose-500'
                : 'border-l-4 border-l-[#0E6BA8]'
            }`}
          >
            {newOrderAlert.type === 'CANCEL' ? (
              <div>
                {/* Dòng 1: Chấm tròn đỏ + Tiêu đề Đơn đã hủy · #8446 + Vừa xong + Nút đóng X */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 shrink-0">
                      Đơn đã hủy
                    </span>
                    <span className="text-xs text-slate-300 dark:text-zinc-600">·</span>
                    <span
                      className="text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums truncate cursor-help"
                      title={cleanOrderNumber ? `Mã đầy đủ: #${cleanOrderNumber}` : undefined}
                    >
                      #{alertShortCode}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-normal shrink-0 ml-1">
                      Vừa xong
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (cancelAlertTimerRef.current) clearTimeout(cancelAlertTimerRef.current);
                      setNewOrderAlert(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors p-0.5 cursor-pointer shrink-0"
                    title="Đóng"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Dòng 2: Khách hủy qua nút bấm — Đã tự động hoàn kho */}
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5">
                  Khách hủy qua nút bấm — Đã tự động hoàn kho
                </p>
              </div>
            ) : (
              <div>
                {/* Dòng 1: Chấm tròn xanh bg-[#0E6BA8] animate-pulse + Đơn mới · #8446 + Vừa xong + Nút đóng X */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-[#0E6BA8] animate-pulse shrink-0" />
                    <span className="text-xs font-semibold text-[#0E6BA8] dark:text-[#38a5da] shrink-0">
                      Đơn mới
                    </span>
                    <span className="text-xs text-slate-300 dark:text-zinc-600">·</span>
                    <span
                      className="text-xs font-mono font-bold text-slate-900 dark:text-white tabular-nums truncate cursor-help"
                      title={cleanOrderNumber ? `Mã đầy đủ: #${cleanOrderNumber}` : undefined}
                    >
                      #{alertShortCode}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-normal shrink-0 ml-1">
                      Vừa xong
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewOrderAlert(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors p-0.5 cursor-pointer shrink-0"
                    title="Đóng"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Dòng 2: Tên khách (in đậm) — Mặt hàng */}
                <div className="text-xs text-slate-700 dark:text-zinc-300 mt-1.5 truncate">
                  <span className="font-bold text-slate-900 dark:text-white">
                    {newOrderAlert.customerName || 'Khách hàng'}
                  </span>
                  <span className="text-slate-400 mx-1.5">—</span>
                  <span>
                    {newOrderAlert.quantity ? `${newOrderAlert.quantity}× ` : ''}
                    {newOrderAlert.productName || 'Nhu yếu phẩm'}
                  </span>
                </div>

                {/* Dòng 3: Giá tiền bên trái + Cụm 2 nút hành động bên phải */}
                <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800">
                  <div className="font-mono font-bold text-sm text-[#0E6BA8] dark:text-[#38a5da] tabular-nums">
                    {newOrderAlert.totalAmount !== undefined
                      ? `${Number(newOrderAlert.totalAmount).toLocaleString('vi-VN')} đ`
                      : ''}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        announceStoreOrder({
                          customerName: newOrderAlert.customerName,
                          productName: newOrderAlert.productName,
                          quantity: newOrderAlert.quantity,
                          totalAmount: newOrderAlert.totalAmount,
                          orderNumber: alertShortCode || cleanOrderNumber,
                        });
                      }}
                      className="bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Nghe lại
                    </button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        const matched = orders.find(
                          (o) =>
                            (newOrderAlert.orderId && o.id === newOrderAlert.orderId) ||
                            (cleanOrderNumber && String(o.orderNumber || '').replace(/^#/, '') === cleanOrderNumber)
                        );
                        const targetId = newOrderAlert.orderId || matched?.id;
                        if (targetId) {
                          handleUpdateStatus(targetId, 'CONFIRMED');
                        }
                        setNewOrderAlert(null);
                      }}
                      className="bg-[#0E6BA8] hover:bg-[#0B5586] text-white px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                      Tiếp nhận đơn
                    </motion.button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
