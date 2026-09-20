import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { subscribeToStore, getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/OrderSoundContext';
import { AnalyticsChart } from '../../components/AnalyticsChart';
import { Order } from '../../types';
import { ShoppingBag, Clock, CheckCircle2, Truck, AlertCircle, Phone, MapPin, Radio, DollarSign, Calendar, ChevronRight, TrendingUp, X, Activity, Volume2, Sparkles, Search, Filter, Boxes, Package, Zap, Upload, Camera, Plus, Save, Image as ImageIcon, Trash2, Check, ExternalLink } from 'lucide-react';
import { Floating3DCard } from '../../components/3d/Floating3DCard';
import { STORE_CATALOG_PRODUCTS, StoreCatalogItem, getStoreCatalog, saveStoreCatalog } from '../../data/storeProductsData';

export const StoreDashboard: React.FC = () => {
  const { user } = useAuth();
  const { announceStoreOrder, testStoreBankSpeaker, isSoundEnabled, isVoiceEnabled, toggleVoice } = useSound();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'PRIORITY' | 'NEWEST' | 'OLDEST'>('PRIORITY');
  
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
  const completedCount = orders.filter((o) => o.status === 'COMPLETED').length;

  const priorityMap: Record<string, number> = {
    PENDING: 1,
    CONFIRMED: 2,
    PREPARING: 3,
    OUT_FOR_DELIVERY: 4,
    COMPLETED: 5,
    CANCELLED: 6,
  };

  const filteredOrders = orders
    .filter((o) => {
      const matchStatus = statusFilter === 'ALL' || o.status === statusFilter;
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">CHỜ XÁC NHẬN</span>;
      case 'CONFIRMED':
        return <span className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">ĐÃ TIẾP NHẬN</span>;
      case 'PREPARING':
        return <span className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">ĐANG CHUẨN BỊ</span>;
      case 'OUT_FOR_DELIVERY':
        return <span className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">ĐANG GIAO HÀNG</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">HOÀN THÀNH</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">ĐÃ HỦY</span>;
      default:
        return <span className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* High-Fidelity Realtime Alert Banner */}
      {newOrderAlert && (
        <div
          className={`p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
            newOrderAlert.type === 'CREATE'
              ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-emerald-500/20'
              : 'bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 text-white shadow-red-500/20'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            <span className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl shrink-0">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </span>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 bg-white/20 rounded-full">
                  {newOrderAlert.type === 'CREATE' ? 'Đơn Mới Từ Nút ESP32' : 'Đơn Đã Hủy Qua ESP32'}
                </span>
                <span className="font-mono font-bold text-xs">#{newOrderAlert.orderNumber}</span>
              </div>
              <p className="text-sm font-bold">
                {newOrderAlert.type === 'CREATE'
                  ? `Khách ${newOrderAlert.customerName} vừa đặt ${newOrderAlert.quantity}x ${newOrderAlert.productName} (${newOrderAlert.totalAmount?.toLocaleString()} ₫)`
                  : `Đơn hàng #${newOrderAlert.orderNumber} đã bị hủy bởi khách hàng qua nút bấm (Đã tự động hoàn kho)`}
              </p>
              {newOrderAlert.deliveryAddress && (
                <p className="text-xs text-white/85 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{newOrderAlert.deliveryAddress}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            {newOrderAlert.type === 'CREATE' && (
              <>
                <button
                  onClick={() => {
                    announceStoreOrder({
                      customerName: newOrderAlert.customerName,
                      productName: newOrderAlert.productName,
                      quantity: newOrderAlert.quantity,
                      totalAmount: newOrderAlert.totalAmount,
                      orderNumber: newOrderAlert.orderNumber,
                    });
                  }}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                  title="Nghe lại giọng đọc Loa Thông Báo Ngân Hàng"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Nghe Lại Loa</span>
                </button>

                <button
                  onClick={() => {
                    if (newOrderAlert.orderId) {
                      handleUpdateStatus(newOrderAlert.orderId, 'CONFIRMED');
                    }
                    setNewOrderAlert(null);
                  }}
                  className="px-3.5 py-1.5 bg-white text-emerald-800 text-xs font-bold rounded-xl shadow hover:bg-slate-100 transition-all btn-press"
                >
                  Tiếp Nhận Đơn
                </button>
              </>
            )}
            <button
              onClick={() => setNewOrderAlert(null)}
              className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Đơn Hàng Trực Tiếp (Live Orders)</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-50 text-blue-600 border border-blue-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30">
              REALTIME
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Dòng sự kiện thời gian thực từ các Smart Order Button trong mạng lưới khách hàng
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Quản lý & Tra cứu kho hàng */}
          <button
            type="button"
            onClick={() => setShowInventoryModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Tra cứu & Quản lý tồn kho hàng hóa"
          >
            <Boxes className="w-4 h-4 text-blue-600 dark:text-sky-400" />
            <span>Kho Hàng ({inventoryList.length})</span>
          </button>

          {/* Smart Bank Speaker Button */}
          <button
            onClick={() => testStoreBankSpeaker()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Bấm để nghe thử Loa Thông Báo Đơn Hàng"
          >
            <Volume2 className="w-4 h-4 text-amber-500" />
            <span>Thử Loa Báo</span>
          </button>

          <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-xs font-mono font-medium text-slate-600 dark:text-zinc-400">Trực Tuyến</span>
          </div>
        </div>
      </div>

      {/* Stat Cards Matrix */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Floating3DCard depth={18} className="rounded-2xl">
          <div className="p-4 bg-white dark:bg-[#101014] border border-slate-200/80 dark:border-red-500/20 rounded-2xl shadow-md h-full flex flex-col justify-between hover:dark:border-red-500/40 transition-colors">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-semibold">Chờ Xử Lý</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{pendingCount}</p>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">Cần xác nhận đơn ngay</p>
          </div>
        </Floating3DCard>

        <Floating3DCard depth={18} className="rounded-2xl">
          <div className="p-4 bg-white dark:bg-[#101014] border border-slate-200/80 dark:border-red-500/20 rounded-2xl shadow-md h-full flex flex-col justify-between hover:dark:border-red-500/40 transition-colors">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-semibold">Đang Tiến Hành</span>
              <Truck className="w-4 h-4 text-blue-500 dark:text-red-400" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{inProgressCount}</p>
            <p className="text-[11px] text-blue-600 dark:text-red-400 font-medium mt-1">Đang chuẩn bị & giao</p>
          </div>
        </Floating3DCard>

        <Floating3DCard depth={18} className="rounded-2xl">
          <div className="p-4 bg-white dark:bg-[#101014] border border-slate-200/80 dark:border-red-500/20 rounded-2xl shadow-md h-full flex flex-col justify-between hover:dark:border-red-500/40 transition-colors">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-semibold">Đã Hoàn Thành</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{completedCount}</p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">Giao thành công</p>
          </div>
        </Floating3DCard>

        <Floating3DCard depth={18} className="rounded-2xl">
          <div className="p-4 bg-white dark:bg-[#101014] border border-slate-200/80 dark:border-red-500/20 rounded-2xl shadow-md h-full flex flex-col justify-between hover:dark:border-red-500/40 transition-colors">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-xs font-semibold">Doanh Số Tạm Tính</span>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">{totalRevenue.toLocaleString()} ₫</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Đã chốt thành công</p>
          </div>
        </Floating3DCard>
      </div>

      {/* Revenue Analytics Chart (Recharts) */}
      <div className="bg-white dark:bg-[#101014] border border-slate-200/80 dark:border-red-500/20 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Biểu Đồ Doanh Thu Theo Ngày (Telemetry Analytics)</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Xu hướng đặt hàng định kỳ từ mạng lưới Smart Button</p>
            </div>
          </div>
          <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 border border-blue-200 dark:text-red-400 dark:bg-red-500/15 dark:border-red-500/30 px-2.5 py-1 rounded-full">
            7 Ngày Gần Nhất
          </span>
        </div>
        <AnalyticsChart data={chartData} />
      </div>

      {/* Search & Sort Controls (Theo chung cư, Block, Số tầng, Số phòng, Tên, Mã đơn) */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-3.5 bg-slate-50 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Lọc theo Tên cư dân, SĐT, Block, Số tầng, Căn hộ/Phòng (VD: 1204, Sapphire, 0988...)"
            className="w-full pl-10 pr-8 py-2 text-xs rounded-xl bg-white dark:bg-[#101014] border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Sắp xếp:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-[#101014] border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-white focus:outline-none cursor-pointer"
          >
            <option value="PRIORITY">🔥 Ưu Tiên (Chờ xử lý trước)</option>
            <option value="NEWEST">⏱️ Mới Nhất Trước</option>
            <option value="OLDEST">⏳ Cũ Nhất Trước</option>
          </select>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200/80 dark:border-red-500/20 pb-2 overflow-x-auto scrollbar-thin">
        {['ALL', 'PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === st
                ? 'bg-blue-600 dark:bg-red-600 text-white shadow-md shadow-blue-500/20 dark:shadow-red-600/35 border border-transparent dark:border-red-500/40'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-red-950/30'
            }`}
          >
            {st === 'ALL' && 'Tất Cả'}
            {st === 'PENDING' && `Chờ Tiếp Nhận (${pendingCount})`}
            {st === 'CONFIRMED' && 'Đã Nhận'}
            {st === 'PREPARING' && 'Chuẩn Bị'}
            {st === 'OUT_FOR_DELIVERY' && 'Đang Giao'}
            {st === 'COMPLETED' && 'Hoàn Thành'}
            {st === 'CANCELLED' && 'Đã Hủy'}
          </button>
        ))}
      </div>

      {/* Orders List / Live Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm font-mono">Đang tải danh sách đơn hàng...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 bg-white dark:bg-[#101014] border border-slate-200/80 dark:border-red-500/20 rounded-2xl text-center">
          <ShoppingBag className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Chưa có đơn hàng nào</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Khi khách hàng bấm Smart Order Button, đơn hàng sẽ lập tức hiển thị tại đây kèm chuông báo động.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white dark:bg-[#101014] border border-slate-200/80 dark:border-red-500/20 rounded-2xl p-5 shadow-sm hover:border-blue-400 dark:hover:border-red-500/50 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              {/* Left Details */}
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-200 dark:border-red-500/20">
                    {order.orderNumber}
                  </span>
                  {getStatusBadge(order.status)}
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} •{' '}
                    {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs">
                  <div className="font-bold text-slate-900 dark:text-white">
                    Khách: {order.customerName}
                  </div>
                  <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <span className="font-mono">{order.customerPhone}</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400 max-w-md truncate">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{order.deliveryAddress}</span>
                  </div>
                </div>

                {/* Ordered Items Preview & Badges */}
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  {order.items.map((item) => (
                    <span
                      key={item.id}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-300 text-xs font-semibold"
                    >
                      {item.quantity}x {item.productName} ({item.totalPrice.toLocaleString()} ₫)
                    </span>
                  ))}
                  {order.device && (
                    <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-slate-300 font-mono flex items-center gap-1 border border-slate-200 dark:border-red-500/20">
                      <Radio className="w-3 h-3 text-emerald-500" />
                      {order.device.configuration?.customName || order.device.deviceId}
                    </span>
                  )}
                  {order.status === 'PENDING' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                      <Clock className="w-3 h-3 text-amber-500 animate-spin" />
                      HỦY KHẨN CẤP 2P (APP CƯ DÂN)
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    COD - Tiền mặt khi giao
                  </span>
                </div>
              </div>

              {/* Right Action Buttons: Advance Workflow */}
              <div className="flex items-center space-x-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-white/5">
                {order.status === 'PENDING' && (
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'CONFIRMED')}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-red-600 dark:hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 dark:shadow-red-600/30 transition-all flex items-center gap-1.5 btn-press"
                  >
                    <span>Tiếp Nhận Đơn</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {order.status === 'CONFIRMED' && (
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'PREPARING')}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition-all flex items-center gap-1.5 btn-press"
                  >
                    <span>Chuẩn Bị Hàng</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {order.status === 'PREPARING' && (
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'OUT_FOR_DELIVERY')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 btn-press"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Xuất Kho Đi Giao</span>
                  </button>
                )}

                {order.status === 'OUT_FOR_DELIVERY' && (
                  <button
                    onClick={() => handleUpdateStatus(order.id, 'COMPLETED')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 btn-press"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Hoàn Thành & Đã Thu Tiền</span>
                  </button>
                )}

                {order.status === 'COMPLETED' && (
                  <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <CheckCircle2 className="w-4 h-4" /> ĐÃ GIAO XONG
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tra cứu & Quản lý tồn kho hàng hóa (Inventory Lookup & Custom Photo Upload Modal) */}
      {showInventoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="fixed inset-0" onClick={() => setShowInventoryModal(false)} />
          <div className="relative z-10 w-full max-w-4xl bg-white dark:bg-[#11131A] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                  <Boxes className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    Quản Lý Tồn Kho & Hình Ảnh Nhu Yếu Phẩm
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                      {filteredInventory.length} sản phẩm
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Chủ cửa hàng gắn ảnh tùy chỉnh trực tiếp và nhập số lượng tồn kho chính xác theo nhu cầu
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddProductForm(!showAddProductForm)}
                  className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showAddProductForm ? 'Ẩn Form Thêm' : 'Thêm Món Mới'}</span>
                </button>

                <button
                  onClick={() => setShowInventoryModal(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification Toast */}
            {saveToast && (
              <div className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{saveToast}</span>
              </div>
            )}

            {/* Form Thêm Sản Phẩm Mới Có Tải Ảnh Lên */}
            {showAddProductForm && (
              <div className="p-4 bg-cyan-500/5 dark:bg-cyan-950/20 border border-cyan-500/20 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Thêm Nhu Yếu Phẩm Mới Của Quán (Kèm Ảnh & Số Lượng)
                  </h4>
                  <button
                    onClick={() => setShowAddProductForm(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Hủy
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Tên sản phẩm *</label>
                    <input
                      type="text"
                      placeholder="VD: Nước Mắm Cốt Nhĩ Cá Cơm 500ml..."
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Thương hiệu / Nhãn</label>
                    <input
                      type="text"
                      placeholder="VD: Khải Hoàn, Chinsu, Quán Tự Làm..."
                      value={newProdBrand}
                      onChange={(e) => setNewProdBrand(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Nhóm danh mục</label>
                    <select
                      value={newProdCategory}
                      onChange={(e) => setNewProdCategory(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Đơn vị đóng gói</label>
                    <input
                      type="text"
                      placeholder="VD: Chai 520ml, Can 2L, Bình 20L..."
                      value={newProdUnit}
                      onChange={(e) => setNewProdUnit(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Giá bán (VNĐ)</label>
                    <input
                      type="number"
                      value={newProdPrice}
                      onChange={(e) => setNewProdPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase text-cyan-600 dark:text-cyan-400">
                      Số lượng tồn kho cần nhập chính xác *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProdStock}
                      onChange={(e) => setNewProdStock(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-black border border-cyan-500/50 text-cyan-600 dark:text-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono font-black"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Gắn ảnh sản phẩm (Tải file từ máy tính hoặc dán URL)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Dán link ảnh trực tiếp (https://...)"
                        value={newProdImage}
                        onChange={(e) => setNewProdImage(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white focus:outline-none"
                      />
                      <label className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0 transition-colors">
                        <Camera className="w-3.5 h-3.5" />
                        <span>Tải Ảnh Từ Máy</span>
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

                {newProdImage && (
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-[10px] text-slate-400 font-bold">Xem trước ảnh:</span>
                    <img
                      src={newProdImage}
                      alt="Xem trước"
                      className="w-12 h-12 rounded-xl object-cover border border-cyan-500/30"
                    />
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={handleAddNewProduct}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Lưu & Thêm Vào Kho</span>
                  </button>
                </div>
              </div>
            )}

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên nước mắm, gas, gạo, thương hiệu..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {['Tất cả', 'Nước mắm', 'Nước uống', 'Gas', 'Gạo', 'Dầu ăn & Gia vị'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setInventoryCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all ${
                      inventoryCategory === cat
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Inventory List with Exact Number Input & Photo Upload */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {filteredInventory.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 bg-slate-50 dark:bg-zinc-900/80 rounded-2xl border border-slate-200 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-cyan-500/40 transition-colors"
                >
                  {/* Product Info & Photo */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Image with upload overlay button */}
                    <div className="relative group shrink-0 w-14 h-14 rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      
                      {/* Photo Upload Overlay Button */}
                      <label
                        htmlFor={`img-upload-${item.id}`}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-[9px] font-bold cursor-pointer transition-opacity backdrop-blur-xs text-center p-1"
                        title="Bấm để tải ảnh mới từ máy tính"
                      >
                        <Camera className="w-3.5 h-3.5 mb-0.5 text-cyan-300" />
                        <span>Đổi Ảnh</span>
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
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                          {item.category}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">{item.brand}</span>
                        {item.badge && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {item.name}
                      </h4>

                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-cyan-600 dark:text-cyan-400 font-extrabold font-mono">
                          {item.price.toLocaleString('vi-VN')} đ
                        </span>
                        <span className="text-[11px] text-slate-400">/ {item.unit}</span>

                        <button
                          onClick={() => handleImageUrlPrompt(item.id, item.imageUrl)}
                          className="text-[10px] text-slate-400 hover:text-cyan-500 underline ml-2 flex items-center gap-0.5"
                          title="Gắn link ảnh trực tiếp"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span>Dán URL ảnh</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Exact Stock Input & Quick Adjustments */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-zinc-800">
                    {/* Status Badge */}
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-medium">Trạng Thái:</span>
                      {item.stock === 0 ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          Hết hàng
                        </span>
                      ) : item.stock <= item.minStockAlert ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Sắp hết
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Sẵn sàng
                        </span>
                      )}
                    </div>

                    {/* DIRECT EXACT NUMERIC INPUT BOX */}
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                        Nhập số lượng tồn kho chính xác:
                      </span>
                      <div className="flex items-center">
                        <button
                          onClick={() => handleStockChange(item.id, Math.max(0, item.stock - 1))}
                          className="w-8 h-8 rounded-l-xl bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-white font-bold flex items-center justify-center border border-slate-300 dark:border-zinc-700 border-r-0 transition-colors text-sm"
                          title="Giảm 1"
                        >
                          -
                        </button>

                        <input
                          type="number"
                          min="0"
                          value={item.stock}
                          onChange={(e) => handleStockChange(item.id, e.target.value)}
                          className="w-20 h-8 text-center font-mono font-black text-sm bg-white dark:bg-black text-slate-900 dark:text-white border-y border-slate-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 shadow-inner"
                          title="Gõ trực tiếp số lượng chính xác tại đây"
                        />

                        <button
                          onClick={() => handleStockChange(item.id, item.stock + 1)}
                          className="w-8 h-8 rounded-r-xl bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-700 dark:text-white font-bold flex items-center justify-center border border-slate-300 dark:border-zinc-700 border-l-0 transition-colors text-sm"
                          title="Tăng 1"
                        >
                          +
                        </button>

                        <span className="text-xs font-mono font-bold text-slate-500 dark:text-zinc-400 ml-2 min-w-8">
                          {item.unit.split(' ')[0]}
                        </span>
                      </div>
                    </div>

                    {/* Delete item if custom or unwanted */}
                    {item.id.startsWith('custom-prod-') && (
                      <button
                        onClick={() => handleDeleteProduct(item.id, item.name)}
                        className="w-8 h-8 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-colors ml-1"
                        title="Xóa món này khỏi danh mục quán"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {filteredInventory.length === 0 && (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Package className="w-10 h-10 mx-auto text-slate-300 dark:text-zinc-700" />
                  <p className="text-xs">Không tìm thấy sản phẩm nào khớp với từ khóa tìm kiếm.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Số lượng và ảnh gắn vào được lưu tự động trên hệ thống</span>
              </div>

              <button
                onClick={() => setShowInventoryModal(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold transition-all shadow-md"
              >
                Đóng & Hoàn Tất Lưu Kho
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
