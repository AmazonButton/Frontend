import React, { useState, useEffect } from 'react';
import { motion, type Variants } from 'framer-motion';
import { api } from '../../services/api';
import { subscribeToStore, getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/OrderSoundContext';
import { AnalyticsChart } from '../../components/AnalyticsChart';
import { Order } from '../../types';
import {
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
} from 'lucide-react';
import { StoreCatalogItem, getStoreCatalog, saveStoreCatalog } from '../../data/storeProductsData';

export const StoreDashboard: React.FC = () => {
  const { user } = useAuth();
  const { announceStoreOrder, testStoreBankSpeaker } = useSound();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'PRIORITY' | 'NEWEST' | 'OLDEST'>('PRIORITY');
  const [showChart, setShowChart] = useState(false);

  // Inventory state with exact number input & image upload
  const [showInventoryModal, setShowInventoryModal] = useState<boolean>(false);
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

  const fetchOrders = async () => {
    try {
      const [orderRes, analyticsRes] = await Promise.all([
        api.get('/orders'),
        api.get('/analytics/dashboard').catch(() => ({ data: { success: false } })),
      ]);
      if (orderRes.data.success) {
        setOrders(orderRes.data.data);
      }
      if (analyticsRes.data?.success && analyticsRes.data.data?.chartData) {
        setChartData(analyticsRes.data.data.chartData);
      }
    } catch (e) {
      console.error('Failed to fetch store orders:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    if (user?.storeId) {
      subscribeToStore(user.storeId);
    }

    const socket = getSocket();

    const handleOrderCreated = (payload: any) => {
      console.log('⚡ [Store Live Feed] Order Created:', payload);
      setNewOrderAlert({
        type: 'CREATE',
        orderNumber: payload.order?.orderNumber,
        customerName: payload.customerName || payload.order?.customerName,
        productName: payload.productName,
        quantity: payload.quantity,
        totalAmount: payload.order?.totalAmount,
        deliveryAddress: payload.order?.deliveryAddress,
        orderId: payload.order?.id,
      });
      fetchOrders();
    };

    const handleOrderCancelled = (payload: any) => {
      console.log('❌ [Store Live Feed] Order Cancelled:', payload);
      setNewOrderAlert({
        type: 'CANCEL',
        orderNumber: payload.order?.orderNumber,
        reason: payload.reason || 'Khách bấm nút hủy đơn trên ESP32',
      });
      fetchOrders();
      setTimeout(() => {
        setNewOrderAlert(null);
      }, 8000);
    };

    const handleOrderUpdated = () => {
      fetchOrders();
    };

    socket.on('ORDER_CREATED', handleOrderCreated);
    socket.on('ORDER_STATUS_CHANGED', handleOrderUpdated);
    socket.on('ORDER_CANCELLED', handleOrderCancelled);

    return () => {
      socket.off('ORDER_CREATED', handleOrderCreated);
      socket.off('ORDER_STATUS_CHANGED', handleOrderUpdated);
      socket.off('ORDER_CANCELLED', handleOrderCancelled);
    };
  }, [user]);

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    try {
      const res = await api.patch(`/orders/${orderId}/status`, { status: nextStatus });
      if (res.data.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus as any } : o))
        );
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Không thể cập nhật trạng thái');
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
  const inProgressCount = orders.filter((o) => ['CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'].includes(o.status)).length;
  const completedCount = orders.filter((o) => o.status === 'COMPLETED' || (o.status as string) === 'DELIVERED').length;

  const priorityMap: Record<string, number> = {
    PENDING: 1,
    CONFIRMED: 2,
    PREPARING: 3,
    OUT_FOR_DELIVERY: 4,
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
        (statusFilter === 'COMPLETED' && (o.status as string) === 'DELIVERED');
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.customerPhone && o.customerPhone.includes(q)) ||
        o.deliveryAddress.toLowerCase().includes(q) ||
        o.items.some((it) => it.productName.toLowerCase().includes(q));
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
      case 'OUT_FOR_DELIVERY':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
            Đang giao
          </span>
        );
      case 'DELIVERED':
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

  return (
    <div className="w-full space-y-3.5 text-zinc-900 dark:text-zinc-100">

      {/* ── Page Header ── */}
      <div className="w-full">

        {/* Live Alert Strip */}
        {newOrderAlert && (
          <div
            className={`mb-3 px-3.5 py-2.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
              newOrderAlert.type === 'CREATE'
                ? 'bg-zinc-900 text-white border-zinc-800'
                : 'bg-rose-950 text-rose-100 border-rose-900'
            }`}
            style={{ animation: 'slideDown 0.2s ease-out' }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-2 w-2 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-emerald-400">
                    #{newOrderAlert.orderNumber}
                  </span>
                  <span className="text-xs font-medium truncate">
                    {newOrderAlert.type === 'CREATE'
                      ? `${newOrderAlert.customerName} · ${newOrderAlert.quantity}× ${newOrderAlert.productName} · ${newOrderAlert.totalAmount?.toLocaleString()} ₫`
                      : `Đơn #${newOrderAlert.orderNumber} đã hủy qua nút bấm — Đã hoàn kho`}
                  </span>
                </div>
                {newOrderAlert.deliveryAddress && (
                  <p className="text-[10.5px] text-zinc-400 truncate mt-0.5">
                    📍 {newOrderAlert.deliveryAddress}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {newOrderAlert.type === 'CREATE' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      announceStoreOrder({
                        customerName: newOrderAlert.customerName,
                        productName: newOrderAlert.productName,
                        quantity: newOrderAlert.quantity,
                        totalAmount: newOrderAlert.totalAmount,
                        orderNumber: newOrderAlert.orderNumber,
                      });
                    }}
                    className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Nghe lại
                  </button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      if (newOrderAlert.orderId) {
                        handleUpdateStatus(newOrderAlert.orderId, 'CONFIRMED');
                      }
                      setNewOrderAlert(null);
                    }}
                    className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded-md shadow-xs transition-colors"
                  >
                    Tiếp Nhận Đơn
                  </motion.button>
                </>
              )}
              <button
                type="button"
                onClick={() => setNewOrderAlert(null)}
                className="p-1 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

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

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowChart(!showChart)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-all ${
                showChart
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Biểu đồ 7 ngày
              {showChart ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={() => setShowInventoryModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 text-xs font-medium transition-all hover:border-zinc-400"
            >
              <Boxes className="w-3.5 h-3.5" />
              Kho Hàng
              <span className="font-mono text-zinc-400 dark:text-zinc-600">({inventoryList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => testStoreBankSpeaker()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 text-xs font-medium transition-all hover:border-zinc-400"
              title="Nghe thử âm lượng loa thông báo"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Thử Loa
            </button>
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
              dot: 'bg-blue-500',
              urgent: false,
              valueColor: 'text-zinc-900 dark:text-zinc-100',
            },
            {
              label: 'Đã Hoàn Thành',
              value: completedCount,
              sub: 'giao thành công',
              dot: 'bg-emerald-500',
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
                  {m.revenue.toLocaleString()}
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
                  className={`relative px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 z-10 ${
                    isActive
                      ? 'text-white dark:text-zinc-900 font-semibold'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="activeStoreDashboardTab"
                      className="absolute inset-0 bg-zinc-900 dark:bg-zinc-100 rounded-md -z-10 shadow-xs"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded-full leading-none transition-colors ${
                        isActive
                          ? 'bg-white/20 dark:bg-zinc-900/20 text-white dark:text-zinc-900'
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
                className="w-full pl-8 pr-7 py-1 text-xs rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 transition-colors"
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
              className="px-2 py-1 text-xs rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 focus:outline-none cursor-pointer"
            >
              <option value="PRIORITY">Ưu tiên xử lý</option>
              <option value="NEWEST">Mới nhất</option>
              <option value="OLDEST">Cũ nhất</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
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
                  {filteredOrders.map((order) => {
                    const firstItem = order.items[0];
                    const otherCount = order.items.length - 1;
                    return (
                      <motion.tr
                        key={order.id}
                        variants={tableRowVariants}
                        className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors group"
                      >
                        {/* Mã Đơn / Giờ */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div className="font-mono font-bold text-[11.5px] text-zinc-900 dark:text-zinc-100">
                            #{order.orderNumber}
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
                            {order.customerPhone || '—'}
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
                          <div className="text-[10.5px] font-mono font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {order.totalAmount.toLocaleString()} ₫ · COD
                          </div>
                        </td>

                        {/* Trạng Thái */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {renderStatus(order.status)}
                        </td>

                        {/* Thao Tác */}
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          {order.status === 'PENDING' && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'CONFIRMED')}
                              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-[11px] font-semibold rounded-md shadow-xs transition-colors"
                            >
                              Tiếp Nhận
                            </motion.button>
                          )}
                          {order.status === 'CONFIRMED' && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'PREPARING')}
                              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-[11px] font-semibold rounded-md shadow-xs transition-colors"
                            >
                              Chuẩn Bị
                            </motion.button>
                          )}
                          {order.status === 'PREPARING' && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'OUT_FOR_DELIVERY')}
                              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-[11px] font-semibold rounded-md shadow-xs transition-colors"
                            >
                              Xuất Giao
                            </motion.button>
                          )}
                          {order.status === 'OUT_FOR_DELIVERY' && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => handleUpdateStatus(order.id, 'COMPLETED')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded-md shadow-xs transition-colors"
                            >
                              Đã Giao ✓
                            </motion.button>
                          )}
                          {(order.status === 'COMPLETED' || (order.status as string) === 'DELIVERED') && (
                            <span className="text-[10.5px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              Đã giao
                            </span>
                          )}
                          {(order.status === 'CANCELLED' || order.status === 'REJECTED') && (
                            <span className="text-[10.5px] font-mono text-zinc-400">Đã hủy</span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Inventory Modal ── */}
      {showInventoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="fixed inset-0" onClick={() => setShowInventoryModal(false)} />
          <div className="relative z-10 w-full max-w-4xl bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-0 max-h-[90vh] flex flex-col overflow-hidden">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center">
                  <Boxes className="w-4.5 h-4.5 text-white dark:text-zinc-900" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    Quản Lý Kho Hàng
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                      {filteredInventory.length} sản phẩm
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    Cập nhật số lượng tồn kho và gắn ảnh thực tế
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductForm(!showAddProductForm)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {showAddProductForm ? 'Ẩn Form' : 'Thêm Món'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowInventoryModal(false)}
                  className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Toast */}
              {saveToast && (
                <div className="mx-6 mt-4 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  {saveToast}
                </div>
              )}

              {/* Add Product Form */}
              {showAddProductForm && (
                <div className="mx-6 mt-4 p-5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                      Thêm Nhu Yếu Phẩm Mới Vào Kho
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddProductForm(false)}
                      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      Đóng
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Tên sản phẩm *</label>
                      <input
                        type="text"
                        placeholder="VD: Nước Mắm Cốt Nhĩ Cá Cơm 500ml..."
                        value={newProdName}
                        onChange={(e) => setNewProdName(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Thương hiệu</label>
                      <input
                        type="text"
                        placeholder="VD: Khải Hoàn, Chinsu..."
                        value={newProdBrand}
                        onChange={(e) => setNewProdBrand(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Danh mục</label>
                      <select
                        value={newProdCategory}
                        onChange={(e) => setNewProdCategory(e.target.value as any)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
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
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Đơn vị</label>
                      <input
                        type="text"
                        placeholder="VD: Chai 520ml, Bình 20L..."
                        value={newProdUnit}
                        onChange={(e) => setNewProdUnit(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Giá bán (₫)</label>
                      <input
                        type="number"
                        value={newProdPrice}
                        onChange={(e) => setNewProdPrice(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Tồn kho ban đầu *</label>
                      <input
                        type="number"
                        min="0"
                        value={newProdStock}
                        onChange={(e) => setNewProdStock(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none font-mono font-bold"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Ảnh sản phẩm</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Dán link ảnh (https://...)"
                          value={newProdImage}
                          onChange={(e) => setNewProdImage(e.target.value)}
                          className="flex-1 px-3 py-2 text-xs rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                        />
                        <label className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold cursor-pointer flex items-center gap-1.5 shrink-0 transition-colors border border-zinc-200 dark:border-zinc-700">
                          <Camera className="w-3.5 h-3.5" />
                          Tải Ảnh
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
                      className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Lưu Sản Phẩm
                    </button>
                  </div>
                </div>
              )}

              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-2 px-6 pt-4 pb-3">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm sản phẩm, thương hiệu..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto shrink-0">
                  {['Tất cả', 'Nước mắm', 'Nước uống', 'Gas', 'Gạo', 'Dầu ăn & Gia vị'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setInventoryCategory(cat)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                        inventoryCategory === cat
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inventory List */}
              <div className="px-6 pb-4 space-y-2">
                {filteredInventory.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        <label
                          htmlFor={`img-upload-${item.id}`}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity"
                          title="Đổi ảnh"
                        >
                          <Camera className="w-3 h-3 text-white" />
                          <input
                            id={`img-upload-${item.id}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageUpload(item.id, e)}
                          />
                        </label>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-mono text-zinc-400">{item.category}</span>
                          <span className="text-[10px] text-zinc-300 dark:text-zinc-600">·</span>
                          <span className="text-[10px] text-zinc-400">{item.brand}</span>
                        </div>
                        <h4 className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-300">
                            {item.price.toLocaleString('vi-VN')} ₫
                          </span>
                          <span className="text-[10px] text-zinc-400">/ {item.unit}</span>
                          <button
                            type="button"
                            onClick={() => handleImageUrlPrompt(item.id, item.imageUrl)}
                            className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline flex items-center gap-0.5 ml-1"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            Dán URL
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2.5 md:pt-0 border-t md:border-t-0 border-zinc-200 dark:border-zinc-700">
                      <span className="text-[11px] font-semibold">
                        {item.stock === 0 ? (
                          <span className="text-rose-600">Hết hàng</span>
                        ) : item.stock <= item.minStockAlert ? (
                          <span className="text-amber-600">Sắp hết</span>
                        ) : (
                          <span className="text-emerald-600">Sẵn hàng</span>
                        )}
                      </span>

                      <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                        <button
                          type="button"
                          onClick={() => handleStockChange(item.id, Math.max(0, item.stock - 1))}
                          className="w-7 h-7 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold flex items-center justify-center transition-colors text-xs"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={item.stock}
                          onChange={(e) => handleStockChange(item.id, e.target.value)}
                          className="w-14 h-7 text-center font-mono font-bold text-xs bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleStockChange(item.id, item.stock + 1)}
                          className="w-7 h-7 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-bold flex items-center justify-center transition-colors text-xs"
                        >
                          +
                        </button>
                      </div>

                      {item.id.startsWith('custom-prod-') && (
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(item.id, item.name)}
                          className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors"
                          title="Xóa món"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {filteredInventory.length === 0 && (
                  <div className="py-10 text-center text-zinc-400 text-xs">
                    Không tìm thấy sản phẩm nào khớp với tìm kiếm.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/30 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Số lượng và thông tin kho lưu tự động
              </span>
              <button
                type="button"
                onClick={() => setShowInventoryModal(false)}
                className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-semibold transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};