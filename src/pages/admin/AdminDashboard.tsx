import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, type Variants } from 'framer-motion';
import { api } from '../../services/api';
import { Store, AuditLog } from '../../types';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Store as StoreIcon,
  Cpu,
  ShoppingBag,
  DollarSign,
  AlertCircle,
  Terminal,
  Activity,
  Boxes,
  PlusCircle,
  Send,
  CheckSquare,
  Square,
  QrCode,
  Users,
  Layers,
  Battery,
  BatteryWarning,
  Radio,
  FileSpreadsheet,
  Download,
  Bell,
  MessageSquare,
  Sliders,
  Search,
  Filter,
  Eye,
  EyeOff,
  Trash2,
  Edit3,
  Plus,
  RefreshCw,
  Zap,
  TrendingUp,
  Truck,
  FileText,
  ArrowRight,
  Check,
} from 'lucide-react';
import { STORE_CATALOG_PRODUCTS, StoreCatalogItem } from '../../data/storeProductsData';
import { AnalyticsChart } from '../../components/AnalyticsChart';

const tableBodyVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
    },
  },
};

const tableRowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

export const AdminDashboard: React.FC = () => {
  // Navigation tabs organized sequentially by physical IoT operational lifecycle
  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'STORES' | 'CATALOG' | 'DEVICES' | 'RBAC' | 'TELEMETRY' | 'ANALYTICS' | 'NOTIFICATIONS'
  >('OVERVIEW');

  // Ref for mouse wheel horizontal scrolling on the navigation tabs
  const navTabsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = navTabsRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const [pendingStores, setPendingStores] = useState<Store[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Reject modal state
  const [rejectingStoreId, setRejectingStoreId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Device Batch Inventory & Allocation State
  const [unassignedDevices, setUnassignedDevices] = useState<any[]>([]);
  const [allStores, setAllStores] = useState<any[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [batchCount, setBatchCount] = useState(20);
  const [batchPrefix, setBatchPrefix] = useState('BTN');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // =========================================================================
  // 4.2.1 RBAC User Management State
  // =========================================================================
  const [usersList, setUsersList] = useState<any[]>([
    {
      id: 'usr-admin-01',
      fullName: 'Võ Minh Quân',
      email: 'admin@smartorder.local',
      phone: '0901000999',
      role: 'SUPER_ADMIN',
      isActive: true,
      createdAt: '2026-01-10T08:00:00Z',
      storeName: 'Toàn Hệ Thống',
    },
    {
      id: 'usr-store-01',
      fullName: 'Nguyễn Văn Định',
      email: 'store@smartorder.local',
      phone: '0908112233',
      role: 'STORE_OWNER',
      isActive: true,
      createdAt: '2026-02-14T09:30:00Z',
      storeName: 'Đại lý Nước & Gas Gia Định',
    },
    {
      id: 'usr-delivery-01',
      fullName: 'Trần Văn Hùng (Shipper)',
      email: 'shipper.hung@smartorder.local',
      phone: '0933556677',
      role: 'DELIVERY_STAFF',
      isActive: true,
      createdAt: '2026-03-01T10:15:00Z',
      storeName: 'Đại lý Nước & Gas Gia Định',
    },
    {
      id: 'usr-customer-01',
      fullName: 'Nguyễn Văn An (Chung Cư)',
      email: 'customer@smartorder.local',
      phone: '0988776655',
      role: 'CUSTOMER',
      isActive: true,
      createdAt: '2026-02-20T14:20:00Z',
      storeName: 'Căn hộ 1204 - Tháp Sapphire',
    },
    {
      id: 'usr-customer-02',
      fullName: 'Trần Thị Mai',
      email: 'mai.tran@smartorder.local',
      phone: '0977223344',
      role: 'CUSTOMER',
      isActive: false,
      createdAt: '2026-03-05T11:00:00Z',
      storeName: 'Căn hộ 0802 - Tháp Ruby',
    },
  ]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');

  // =========================================================================
  // 4.2.2 Master Product Catalog State
  // =========================================================================
  const [catalogProducts, setCatalogProducts] = useState<StoreCatalogItem[]>(STORE_CATALOG_PRODUCTS);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('ALL');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    brand: '',
    category: 'Nước mắm' as any,
    unit: '',
    price: 0,
    stock: 100,
    minStockAlert: 15,
    imageUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80',
    description: '',
  });

  // =========================================================================
  // 4.2.3 IoT Telemetry & Battery Monitoring State
  // =========================================================================
  const [telemetryDevices, setTelemetryDevices] = useState<any[]>([
    {
      deviceId: 'BTN-8829-WTR',
      customName: 'Nút Nước La Vie Bếp',
      customer: 'Nguyễn Văn An (1204 Sunwah)',
      status: 'ONLINE',
      battery: 94,
      wifiRssi: -56,
      ip: '192.168.1.188',
      firmware: 'v2.1.0',
      lastSeen: 'Vừa xong (12 giây trước)',
      lowBatteryAlert: false,
    },
    {
      deviceId: 'BTN-8830-GAS',
      customName: 'Nút Gas An Toàn',
      customer: 'Nguyễn Văn An (1204 Sunwah)',
      status: 'ONLINE',
      battery: 88,
      wifiRssi: -62,
      ip: '192.168.1.189',
      firmware: 'v2.1.0',
      lastSeen: '1 phút trước',
      lowBatteryAlert: false,
    },
    {
      deviceId: 'SOB-WHITE-PRO-01',
      customName: 'Nút Bấm Trắng Nước Mắm Khải Hoàn',
      customer: 'Trần Văn Cường (Phòng 1502 Sapphire)',
      status: 'ONLINE',
      battery: 98,
      wifiRssi: -42,
      ip: '192.168.1.195',
      firmware: 'v2.4.0-WhitePro',
      lastSeen: 'Vừa kết nối (AirPods BLE)',
      lowBatteryAlert: false,
    },
    {
      deviceId: 'SOB-000105',
      customName: 'Nút Gạo ST25 Ban Công',
      customer: 'Lê Thu Thủy (Phòng 0701 Ruby)',
      status: 'ONLINE',
      battery: 18, // LOW BATTERY WARNING
      wifiRssi: -78,
      ip: '192.168.1.204',
      firmware: 'v2.0.8',
      lastSeen: '3 phút trước',
      lowBatteryAlert: true,
    },
    {
      deviceId: 'SOB-000109',
      customName: 'Nút Dầu Ăn Simply',
      customer: 'Hoàng Long (Phòng 2104 Topaz)',
      status: 'OFFLINE',
      battery: 12, // CRITICAL BATTERY
      wifiRssi: -89,
      ip: '192.168.1.210',
      firmware: 'v1.9.4',
      lastSeen: '6 giờ trước',
      lowBatteryAlert: true,
    },
  ]);

  // =========================================================================
  // 4.2.5 FCM Configuration & Message Templates State
  // =========================================================================
  const [fcmConfig, setFcmConfig] = useState({
    serverKey: 'AAAA-SMARTORDER-FCM-KEY-PROD-99882910-ESP32-AUTH',
    senderId: '1029384756201',
    projectId: 'smart-order-button-prod',
    enablePush: true,
    enableSound: true,
  });

  const [messageTemplates, setMessageTemplates] = useState([
    {
      id: 'tpl-1',
      trigger: 'BUTTON_PRESSED_ORDER_CREATED',
      title: 'Đơn hàng mới kích hoạt từ nút bấm!',
      body: 'Căn hộ {{apartment}} vừa nhấn nút đặt {{quantity}}x {{productName}}. Đơn hàng đã chuyển đến cửa hàng.',
      enabled: true,
    },
    {
      id: 'tpl-2',
      trigger: 'ORDER_EMERGENCY_CANCELLED',
      title: 'Đã hủy đơn hàng thành công!',
      body: 'Đơn hàng #{{orderNumber}} đã được hủy theo yêu cầu trong thời gian 2 phút. Hệ thống đã tự động hoàn kho.',
      enabled: true,
    },
    {
      id: 'tpl-3',
      trigger: 'ORDER_SHIPPED',
      title: 'Nhân viên đang giao hàng đến căn hộ!',
      body: 'Shipper {{shipperName}} đang mang {{productName}} lên phòng {{room}}. Vui lòng chuẩn bị nhận hàng.',
      enabled: true,
    },
    {
      id: 'tpl-4',
      trigger: 'LOW_BATTERY_WARNING',
      title: 'Cảnh báo pin yếu trên Nút Bấm SOB!',
      body: 'Nút bấm {{deviceName}} tại {{location}} chỉ còn {{battery}}% pin. Kỹ thuật viên sẽ liên hệ thay pin sớm.',
      enabled: true,
    },
  ]);

  const fetchAdminData = async () => {
    try {
      const [pendingRes, statsRes, logsRes, unassignedRes, storesRes, usersRes] = await Promise.all([
        api.get('/admin/stores/pending'),
        api.get('/admin/stats'),
        api.get('/admin/audit-logs'),
        api.get('/devices/unassigned'),
        api.get('/admin/stores'),
        api.get('/admin/users').catch(() => ({ data: { success: false, data: [] } })),
      ]);

      if (pendingRes.data.success) setPendingStores(pendingRes.data.data);
      if (statsRes.data.success) setStats(statsRes.data.data);
      if (logsRes.data.success) setAuditLogs(logsRes.data.data);
      if (unassignedRes.data.success) setUnassignedDevices(unassignedRes.data.data || []);
      if (storesRes.data.success) setAllStores(storesRes.data.data || []);
      if (usersRes.data?.success && usersRes.data.data.length > 0) {
        setUsersList(usersRes.data.data);
      }
    } catch (e) {
      console.error('Failed to load admin portal data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleApprove = async (storeId: string) => {
    try {
      const res = await api.post(`/admin/stores/${storeId}/approve`);
      if (res.data.success) {
        alert(res.data.message);
        fetchAdminData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể phê duyệt');
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingStoreId || !rejectReason.trim()) return;

    try {
      const res = await api.post(`/admin/stores/${rejectingStoreId}/reject`, {
        reason: rejectReason,
      });
      if (res.data.success) {
        setRejectingStoreId(null);
        setRejectReason('');
        fetchAdminData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể từ chối');
    }
  };

  const handleBatchGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessingBatch(true);
    try {
      const res = await api.post('/devices/batch-generate', {
        count: Number(batchCount),
        prefix: batchPrefix.trim().toUpperCase(),
      });
      if (res.data.success) {
        alert(res.data.message);
        setShowBatchModal(false);
        fetchAdminData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tạo lô nút bấm');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const handleAllocateDevices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreId) {
      alert('Vui lòng chọn cửa hàng cần cấp phát nút');
      return;
    }
    if (selectedDeviceIds.length === 0) {
      alert('Vui lòng tick chọn ít nhất 1 nút bấm từ kho');
      return;
    }

    setIsProcessingBatch(true);
    try {
      const res = await api.post('/devices/allocate-store', {
        storeId: selectedStoreId,
        deviceIds: selectedDeviceIds,
      });
      if (res.data.success) {
        alert(res.data.message);
        setShowAllocateModal(false);
        setSelectedDeviceIds([]);
        fetchAdminData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cấp phát nút');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // Toggle user status
  const handleToggleUserStatus = async (userId: string) => {
    try {
      await api.post(`/admin/users/${userId}/toggle-status`).catch(() => {});
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: !u.isActive } : u))
      );
    } catch (_) {}
  };

  // Change user role
  const handleChangeUserRole = async (userId: string, newRole: string) => {
    try {
      await api.post(`/admin/users/${userId}/role`, { role: newRole }).catch(() => {});
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (_) {}
  };

  // Add Product to Master Catalog
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const newProd: StoreCatalogItem = {
      id: `prod-custom-${Date.now()}`,
      sku: `PROD-${Date.now().toString().slice(-6)}`,
      name: newProductForm.name,
      brand: newProductForm.brand || 'Việt Nam',
      category: newProductForm.category,
      unit: newProductForm.unit || 'Gói/Chai',
      price: Number(newProductForm.price),
      stock: Number(newProductForm.stock),
      minStockAlert: Number(newProductForm.minStockAlert),
      imageUrl: newProductForm.imageUrl,
      description: newProductForm.description || 'Sản phẩm thiết yếu cho cư dân',
    };
    setCatalogProducts((prev) => [newProd, ...prev]);
    setShowAddProductModal(false);
    alert(`Đã thêm sản phẩm "${newProd.name}" vào Danh mục gốc thành công!`);
  };

  // Delete product from master catalog
  const handleDeleteProduct = (prodId: string) => {
    if (confirm('Bạn có chắc muốn xóa sản phẩm này khỏi danh mục gốc?')) {
      setCatalogProducts((prev) => prev.filter((p) => p.id !== prodId));
    }
  };

  // Export CSV Report
  const handleExportCsv = () => {
    const headers = 'DeviceID,Name,Customer,Battery,Status,Firmware\n';
    const rows = telemetryDevices
      .map((d) => `${d.deviceId},${d.customName},${d.customer},${d.battery}%,${d.status},${d.firmware}`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SmartOrderButton_Telemetry_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
      const q = userSearch.toLowerCase().trim();
      const matchQuery =
        !q ||
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.includes(q);
      return matchRole && matchQuery;
    });
  }, [usersList, userRoleFilter, userSearch]);

  // Filtered Catalog
  const filteredCatalog = useMemo(() => {
    return catalogProducts.filter((p) => {
      const matchCat = catalogCategoryFilter === 'ALL' || p.category === catalogCategoryFilter;
      const q = catalogSearch.toLowerCase().trim();
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.unit.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [catalogProducts, catalogCategoryFilter, catalogSearch]);

  const toggleDeviceSelect = (devId: string) => {
    setSelectedDeviceIds((prev) =>
      prev.includes(devId) ? prev.filter((id) => id !== devId) : [...prev, devId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedDeviceIds.length === unassignedDevices.length) {
      setSelectedDeviceIds([]);
    } else {
      setSelectedDeviceIds(unassignedDevices.map((d) => d.deviceId));
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* ========================================================================= */}
      {/* COMMAND CENTER TOP SECTION: ULTRA-SLIM HEADER & NAVIGATION TABS           */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30">
        {/* Ultra-Slim Header: Title, Breadcrumb & Actions */}
        <div className="border-b border-zinc-200/80 dark:border-zinc-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex items-center justify-center font-mono font-bold text-[11px] shrink-0">
                AH
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400 font-mono">System /</span>
                <h1 className="font-semibold text-zinc-900 dark:text-white tracking-tight">
                  Admin Hub
                </h1>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  Command Center
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Active</span>
              </div>
              <button
                onClick={() => fetchAdminData()}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-750 transition-colors shadow-2xs cursor-pointer"
                title="Làm mới dữ liệu hệ thống"
              >
                <RefreshCw className="w-3 h-3" />
                <span className="hidden sm:inline text-[11px]">Làm Mới</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs (Immediate, with layoutId physics-based bottom border underline) */}
        <div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav
              ref={navTabsRef}
              className="flex items-center gap-1 sm:gap-2 -mb-px overflow-x-auto scrollbar-none"
              aria-label="Tabs"
            >
              {[
                { key: 'OVERVIEW', label: 'Tổng Quan', icon: Boxes },
                { key: 'STORES', label: '1. Trạm Cửa Hàng', icon: StoreIcon, badge: pendingStores.length > 0 ? pendingStores.length : null },
                { key: 'CATALOG', label: '2. Danh Mục Gốc', icon: Layers },
                { key: 'DEVICES', label: '3. Kho Nút Bấm', icon: Cpu, badge: unassignedDevices.length > 0 ? unassignedDevices.length : null },
                { key: 'RBAC', label: '4. Tài Khoản & Phân Quyền', icon: Users },
                { key: 'TELEMETRY', label: '5. Giám Sát IoT & Pin', icon: Battery, alert: telemetryDevices.filter(d => d.battery < 20).length > 0 },
                { key: 'ANALYTICS', label: '6. Báo Cáo & Doanh Thu', icon: TrendingUp },
                { key: 'NOTIFICATIONS', label: '7. Cấu Hình FCM', icon: Bell },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`relative flex items-center gap-1.5 py-2.5 px-3 text-xs whitespace-nowrap transition-colors cursor-pointer ${
                      isActive
                        ? 'text-zinc-900 dark:text-white font-medium'
                        : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`} />
                    <span>{tab.label}</span>
                    {tab.badge !== null && tab.badge !== undefined && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium ${
                        isActive
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                          : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                    {tab.alert && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="activeAdminTabUnderline"
                        className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-900 dark:bg-white"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      {/* ========================================================================= */}
      {/* MODULE 0: OVERVIEW, STATS & SYSTEM AUDIT TRAIL                           */}
      {/* ========================================================================= */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-8">
          {/* System Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xs">
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tổng Trạm Cửa Hàng</div>
                <p className="text-2xl font-bold font-mono text-zinc-900 dark:text-white mt-1">{stats.totalStores}</p>
                <p className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-medium mt-1">{stats.pendingStores} đang chờ duyệt</p>
              </div>

              <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xs">
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Smart Buttons Hoạt Động</div>
                <p className="text-2xl font-bold font-mono text-zinc-900 dark:text-white mt-1">{stats.activeDevices}</p>
                <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-1">/ {stats.totalDevices} thiết bị toàn mạng</p>
              </div>

              <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xs">
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Tổng Lượt Đặt Hàng</div>
                <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">{stats.totalOrders}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">Xử lý tự động qua nút ESP32</p>
              </div>

              <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xs">
                <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Doanh Thu Toàn Mạng</div>
                <p className="text-2xl font-bold font-mono text-zinc-900 dark:text-white mt-1">{stats.totalRevenue?.toLocaleString()} ₫</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">Khớp lệnh Realtime</p>
              </div>
            </div>
          )}

          {/* Quick Jump Action Bar */}
          <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Thao Tác Nhanh Quản Trị
              </span>
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-white">
                Truy cập trực tiếp các tác vụ cấp phát & phê duyệt cốt lõi
              </h4>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setActiveTab('DEVICES');
                  setShowBatchModal(true);
                }}
                className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Tạo Lô Nút Mới</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('CATALOG');
                  setShowAddProductModal(true);
                }}
                className="px-3.5 py-2 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 font-medium text-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm Hàng Gốc</span>
              </button>
              {pendingStores.length > 0 && (
                <button
                  onClick={() => setActiveTab('STORES')}
                  className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span>Duyệt {pendingStores.length} Đại Lý Chờ</span>
                </button>
              )}
            </div>
          </div>

          {/* System Audit Trail (Nhật Ký Vận Hành Thực Tế) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase font-mono tracking-wider">
                  Nhật Ký Vận Hành Hệ Thống (Audit Trail)
                </h3>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  {auditLogs.length} sự kiện
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">Realtime Stream</span>
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-center space-y-1.5 bg-zinc-50/50 dark:bg-zinc-900/50">
                <Activity className="w-5 h-5 text-zinc-400 mx-auto" />
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Hệ thống đang hoạt động ổn định</p>
                <p className="text-[11px] text-zinc-400 font-mono">
                  Sự kiện phân quyền, cấp phát nút và duyệt cửa hàng sẽ xuất hiện tại đây theo thời gian thực.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-850 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">Thời Gian</th>
                      <th className="py-2 px-3">Tài Khoản</th>
                      <th className="py-2 px-3">Hành Động</th>
                      <th className="py-2 px-3">Đối Tượng</th>
                      <th className="py-2 px-3">Chi Tiết Sự Kiện</th>
                    </tr>
                  </thead>
                  <motion.tbody
                    variants={tableBodyVariants}
                    initial="hidden"
                    animate="visible"
                    className="divide-y divide-zinc-200 dark:divide-zinc-800 font-mono"
                  >
                    {auditLogs.slice(0, 15).map((log) => (
                      <motion.tr
                        variants={tableRowVariants}
                        key={log.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-850/60 transition-colors"
                      >
                        <td className="py-2 px-3 text-zinc-500 text-[11px]">
                          {new Date(log.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2 px-3 font-semibold text-zinc-900 dark:text-white">
                          {log.user?.fullName || log.user?.email || 'Hệ thống'}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-zinc-600 dark:text-zinc-400">
                          {log.entity} <span className="text-[10px] text-zinc-400">({log.entityId?.slice(-6)})</span>
                        </td>
                        <td className="py-2 px-3 text-zinc-600 dark:text-zinc-300 text-[11px]">
                          {log.newValues || log.oldValues || 'Thao tác cập nhật trạng thái'}
                        </td>
                      </motion.tr>
                    ))}
                  </motion.tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 1: STORES & PARTNERS APPROVAL (1. DUYỆT ĐẠI LÝ)                     */}
      {/* ========================================================================= */}
      {activeTab === 'STORES' && (
        <div className="space-y-5">
          {/* Pending Store Approvals */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase font-mono tracking-wider">
                  Đơn Đăng Ký Đại Lý Chờ Xét Duyệt ({pendingStores.length})
                </h3>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">Xác minh giấy phép & kho</span>
            </div>

            {pendingStores.length === 0 ? (
              <div className="p-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-center space-y-1.5 bg-zinc-50/50 dark:bg-zinc-900/50">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Không có đơn đại lý nào chờ duyệt</p>
                <p className="text-[11px] text-zinc-400 font-mono">
                  Tất cả các trạm cửa hàng đăng ký đều đã được xử lý hoàn tất.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingStores.map((store) => (
                  <div
                    key={store.id}
                    className="p-3.5 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-2xs"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-white">{store.name}</span>
                        <span className="font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.2 rounded border border-zinc-200 dark:border-zinc-700">
                          {store.code}
                        </span>
                      </div>
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                        Chủ: <strong className="text-zinc-700 dark:text-zinc-200">{store.ownerName}</strong> • {store.phone} • {store.email}
                      </p>
                      <p className="text-zinc-400 dark:text-zinc-500 text-[11px]">Kho: {store.address}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(store.id)}
                        className="px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Phê Duyệt</span>
                      </button>
                      <button
                        onClick={() => setRejectingStoreId(store.id)}
                        className="px-3 py-1.5 rounded-md bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 text-xs font-medium dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Từ Chối</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Stores Fleet Directory */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StoreIcon className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                <h3 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase font-mono tracking-wider">
                  Trạm Đại Lý Đang Hoạt Động ({allStores.length})
                </h3>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">Mạng lưới phân phối ủy quyền</span>
            </div>

            {allStores.length === 0 ? (
              <p className="text-xs text-zinc-400 py-6 text-center font-mono">Chưa có trạm đại lý nào được kích hoạt.</p>
            ) : (
              <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-850 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">Tên Trạm Đại Lý</th>
                      <th className="py-2 px-3">Mã Trạm</th>
                      <th className="py-2 px-3">Chủ Cơ Sở</th>
                      <th className="py-2 px-3">Liên Hệ</th>
                      <th className="py-2 px-3">Địa Chỉ Kho</th>
                      <th className="py-2 px-3">Trạng Thái</th>
                    </tr>
                  </thead>
                  <motion.tbody
                    variants={tableBodyVariants}
                    initial="hidden"
                    animate="visible"
                    className="divide-y divide-zinc-200 dark:divide-zinc-800"
                  >
                    {allStores.map((s) => (
                      <motion.tr
                        variants={tableRowVariants}
                        key={s.id}
                        className="hover:bg-zinc-50 dark:hover:bg-zinc-850/60 transition-colors"
                      >
                        <td className="py-2 px-3 font-semibold text-zinc-900 dark:text-white">{s.name}</td>
                        <td className="py-2 px-3 font-mono font-medium text-xs text-zinc-700 dark:text-zinc-300">
                          <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                            {s.code}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-zinc-700 dark:text-zinc-300">{s.ownerName}</td>
                        <td className="py-2 px-3 font-mono text-zinc-500 dark:text-zinc-400 text-[11px]">
                          <div>{s.phone}</div>
                          <div className="text-[10px] text-zinc-400">{s.email}</div>
                        </td>
                        <td className="py-2 px-3 text-zinc-500 dark:text-zinc-400 text-[11px] max-w-xs truncate">{s.address}</td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Hoạt động</span>
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </motion.tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 3: DEVICES BATCH INVENTORY & ALLOCATION (3. KHO NÚT BẤM)           */}
      {/* ========================================================================= */}
      {activeTab === 'DEVICES' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>Kho Nút Bấm Trống & Bàn Giao Đại Lý</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    {unassignedDevices.length} nút chưa phân bổ
                  </span>
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Tạo hàng loạt mã định danh nút ESP32 mới và ủy quyền phân phối cho các đại lý cửa hàng
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBatchModal(true)}
                className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Tạo Lô Nút Bấm Mới</span>
              </button>
              <button
                disabled={selectedDeviceIds.length === 0}
                onClick={() => setShowAllocateModal(true)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  selectedDeviceIds.length > 0
                    ? 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 shadow-2xs cursor-pointer dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-750'
                    : 'bg-zinc-50 border border-zinc-200/60 text-zinc-400 cursor-not-allowed dark:bg-zinc-800/40 dark:border-zinc-800 dark:text-zinc-600'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>Cấp Phát Cho Cửa Hàng ({selectedDeviceIds.length})</span>
              </button>
            </div>
          </div>

          {unassignedDevices.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="p-12 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center space-y-2 bg-zinc-50/50 dark:bg-zinc-900/50"
            >
              <Boxes className="w-8 h-8 text-zinc-400 mx-auto" />
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Kho nút tổng đang trống</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Nhấn nút <strong className="text-zinc-700 dark:text-zinc-300">"Tạo Lô Nút Bấm Mới"</strong> để nạp mã thiết bị vào hệ thống.
              </p>
            </motion.div>
          ) : (
            <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase font-mono tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3 w-10">
                      <button onClick={toggleSelectAll} className="flex items-center cursor-pointer">
                        {selectedDeviceIds.length === unassignedDevices.length && unassignedDevices.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-zinc-900 dark:text-white" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-400" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3">Mã Thiết Bị (ID)</th>
                    <th className="py-2.5 px-3">Số Serial</th>
                    <th className="py-2.5 px-3">Mã PIN Ghép Nối</th>
                    <th className="py-2.5 px-3">Tên Bluetooth Phát Sóng</th>
                    <th className="py-2.5 px-3">Trạng Thái</th>
                  </tr>
                </thead>
                <motion.tbody
                  variants={tableBodyVariants}
                  initial="hidden"
                  animate="visible"
                  className="divide-y divide-zinc-100 dark:divide-zinc-800/60 font-mono"
                >
                  {unassignedDevices.slice(0, 50).map((dev) => {
                    const isSelected = selectedDeviceIds.includes(dev.deviceId);
                    return (
                      <motion.tr
                        variants={tableRowVariants}
                        key={dev.id}
                        onClick={() => toggleDeviceSelect(dev.deviceId)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-zinc-100/70 dark:bg-zinc-800/60'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-850/40'
                        }`}
                      >
                        <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => toggleDeviceSelect(dev.deviceId)} className="cursor-pointer">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-zinc-900 dark:text-white" />
                            ) : (
                              <Square className="w-4 h-4 text-zinc-400" />
                            )}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-white">
                          <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs">
                            {dev.deviceId}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-zinc-500 dark:text-zinc-400 text-[11px]">{dev.serialNumber}</td>
                        <td className="py-2.5 px-3 text-zinc-800 dark:text-zinc-200 font-bold">{dev.pairingCode || '-'}</td>
                        <td className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300">
                          <span className="text-[11px] font-sans text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded">
                            SOB-{dev.deviceId}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            Trong Kho Trống
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 2: 4.2.1 RBAC USER MANAGEMENT & PERMISSIONS                        */}
      {/* ========================================================================= */}
      {activeTab === 'RBAC' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white uppercase font-mono tracking-wider">
                Quản Lý Người Dùng & Phân Quyền (RBAC)
              </h2>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                {filteredUsers.length} tài khoản
              </span>
            </div>

            {/* Role Filter & Search */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Tìm tên, email, SĐT..."
                  className="pl-8 pr-3 py-1 text-xs rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400"
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 cursor-pointer"
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="SUPER_ADMIN">Admin (Quản trị viên)</option>
                <option value="STORE_OWNER">Vendor (Chủ cửa hàng)</option>
                <option value="DELIVERY_STAFF">Delivery Staff (Giao hàng)</option>
                <option value="CUSTOMER">Customer (Cư dân)</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-850 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-3">Họ & Tên</th>
                  <th className="py-2 px-3">Email / SĐT</th>
                  <th className="py-2 px-3">Căn Hộ / Cửa Hàng</th>
                  <th className="py-2 px-3">Vai Trò (RBAC)</th>
                  <th className="py-2 px-3">Trạng Thái</th>
                  <th className="py-2 px-3 text-right">Hành Động</th>
                </tr>
              </thead>
              <motion.tbody
                variants={tableBodyVariants}
                initial="hidden"
                animate="visible"
                className="divide-y divide-zinc-200 dark:divide-zinc-800"
              >
                {filteredUsers.map((u) => (
                  <motion.tr
                    variants={tableRowVariants}
                    key={u.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-850/60 transition-colors"
                  >
                    <td className="py-2 px-3 font-semibold text-zinc-900 dark:text-white">
                      {u.fullName}
                    </td>
                    <td className="py-2 px-3 text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">
                      <div>{u.email}</div>
                      <div className="text-[10px] text-zinc-400">{u.phone}</div>
                    </td>
                    <td className="py-2 px-3 text-zinc-600 dark:text-zinc-300">
                      {u.storeName || u.store?.name || 'Mặc định'}
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeUserRole(u.id, e.target.value)}
                        className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 cursor-pointer text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        <option value="STORE_OWNER">STORE_OWNER</option>
                        <option value="DELIVERY_STAFF">DELIVERY_STAFF</option>
                        <option value="CUSTOMER">CUSTOMER</option>
                      </select>
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <span className="text-zinc-700 dark:text-zinc-300">{u.isActive ? 'Hoạt động' : 'Đã khóa'}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleToggleUserStatus(u.id)}
                        className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                          u.isActive
                            ? 'border-zinc-200 hover:bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                            : 'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 dark:border-white dark:bg-white dark:text-zinc-900'
                        }`}
                      >
                        {u.isActive ? 'Khóa TK' : 'Mở Khóa'}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 3: 4.2.2 MASTER PRODUCT CATALOG (CRUD & BUTTON BINDING)            */}
      {/* ========================================================================= */}
      {activeTab === 'CATALOG' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-zinc-900 dark:text-white" />
                <span>Danh Mục Sản Phẩm Gốc (Master Product Catalog)</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Quản lý các mặt hàng nhu yếu phẩm sẵn có để cư dân liên kết vào nút bấm IoT một chạm
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowAddProductModal(true)}
                className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm Mặt Hàng Gốc Mới</span>
              </button>
            </div>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between p-2.5 bg-zinc-50 dark:bg-zinc-850 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Tìm SKU, tên sản phẩm, thương hiệu..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none text-xs">
              {['ALL', 'Nước mắm', 'Nước uống', 'Gas', 'Gạo', 'Dầu ăn & Gia vị'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCatalogCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    catalogCategoryFilter === cat
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {cat === 'ALL' ? 'Tất Cả' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* PART 2: High-Density Admin Data Table */}
          <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-850 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-mono text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-3 w-12 text-center">Ảnh</th>
                  <th className="py-2 px-3">Mã SKU</th>
                  <th className="py-2 px-3">Tên Sản Phẩm</th>
                  <th className="py-2 px-3">Danh Mục</th>
                  <th className="py-2 px-3">Giá Niêm Yết</th>
                  <th className="py-2 px-3">Trạng Thái / Tồn Kho</th>
                  <th className="py-2 px-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <motion.tbody
                variants={tableBodyVariants}
                initial="hidden"
                animate="visible"
                className="divide-y divide-zinc-200 dark:divide-zinc-800"
              >
                {filteredCatalog.map((prod) => (
                  <motion.tr
                    variants={tableRowVariants}
                    key={prod.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-850/60 transition-colors"
                  >
                    <td className="py-2 px-3 text-center">
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-8 h-8 rounded object-cover border border-zinc-200 dark:border-zinc-700 inline-block shrink-0 bg-white"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </td>
                    <td className="py-2 px-3 font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {prod.sku || prod.id}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-zinc-900 dark:text-white line-clamp-1 max-w-xs sm:max-w-md">
                        {prod.name}
                      </div>
                      <div className="text-[10px] text-zinc-400 line-clamp-1">
                        {prod.brand} • {prod.unit}
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                        {prod.category}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono font-semibold text-xs text-zinc-900 dark:text-white whitespace-nowrap">
                      {prod.price.toLocaleString('vi-VN')} ₫
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            prod.stock > prod.minStockAlert
                              ? 'bg-emerald-500'
                              : prod.stock > 0
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        <span className="text-zinc-700 dark:text-zinc-300">
                          {prod.stock > prod.minStockAlert ? 'Sẵn hàng' : prod.stock > 0 ? 'Sắp hết' : 'Hết hàng'}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">
                          ({prod.stock})
                        </span>
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => alert(`Chỉnh sửa: ${prod.name}`)}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                          title="Chỉnh sửa sản phẩm"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod.id)}
                          className="p-1 rounded text-zinc-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Xóa sản phẩm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 4: 4.2.3 IOT TELEMETRY & BATTERY MONITORING                        */}
      {/* ========================================================================= */}
      {activeTab === 'TELEMETRY' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Battery className="w-4 h-4 text-zinc-900 dark:text-white" />
                <span>Giám Sát Telemetry & Mạng Lưới Thiết Bị IoT</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Chỉ số pin thời gian thực, cường độ tín hiệu sóng và tình trạng heartbeat
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất Báo Cáo Pin (CSV)</span>
              </button>
            </div>
          </div>

          {/* Telemetry Devices List - High Density Edge-to-Edge Data Table */}
          <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-mono text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Mã Device ID</th>
                  <th className="py-2.5 px-3">Tên Nút Bấm</th>
                  <th className="py-2.5 px-3">Căn Hộ Sở Hữu</th>
                  <th className="py-2.5 px-3">Dung Lượng Pin</th>
                  <th className="py-2.5 px-3">Trạng Thái</th>
                  <th className="py-2.5 px-3">Sóng Wi-Fi / IP</th>
                  <th className="py-2.5 px-3">Lần Cuối Bấm</th>
                </tr>
              </thead>
              <motion.tbody
                variants={tableBodyVariants}
                initial="hidden"
                animate="visible"
                className="divide-y divide-zinc-200 dark:divide-zinc-800 font-mono"
              >
                {telemetryDevices.map((dev) => (
                  <motion.tr
                    variants={tableRowVariants}
                    key={dev.deviceId}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-850/60 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-mono font-semibold text-zinc-900 dark:text-white">
                      {dev.deviceId}
                    </td>
                    <td className="py-2.5 px-3 font-sans font-medium text-zinc-900 dark:text-zinc-200">
                      {dev.customName}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-zinc-600 dark:text-zinc-400">
                      {dev.customer}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            dev.battery > 20 ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        <span className="text-sm font-medium font-mono text-zinc-900 dark:text-zinc-100">
                          {dev.battery}%
                        </span>
                        {dev.battery <= 20 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                            PIN YẾU
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {dev.status === 'ONLINE' ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          ONLINE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                          OFFLINE
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-500 text-xs">
                      <div>{dev.wifiRssi} dBm</div>
                      <div className="text-[10px] text-zinc-400">{dev.ip}</div>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-500 font-sans text-xs">
                      {dev.lastSeen}
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 5: 4.2.4 ANALYTICS & EXPORT REPORTS (CSV / PDF)                   */}
      {/* ========================================================================= */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-zinc-900 dark:text-white" />
                <span>Báo Cáo Phân Tích & Hiệu Suất Vận Hành</span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Chỉ số thời gian giao hàng, tỷ lệ hủy đơn 2 phút và tần suất kích hoạt
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất CSV Báo Cáo</span>
              </button>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 font-medium text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>In / Xuất PDF</span>
              </button>
            </div>
          </div>

          {/* Operational Metrics Cards - High Density */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <span className="text-[11px] font-mono font-medium text-zinc-500 uppercase">Thời Gian Giao Trung Bình</span>
              <p className="text-xl font-bold font-mono text-zinc-900 dark:text-white mt-1">18.4 Phút</p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Nhanh hơn mục tiêu 6.6p</span>
            </div>
            <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <span className="text-[11px] font-mono font-medium text-zinc-500 uppercase">Tỷ Lệ Hủy Đơn (2 Phút)</span>
              <p className="text-xl font-bold font-mono text-zinc-900 dark:text-white mt-1">1.8%</p>
              <span className="text-[10px] text-zinc-400">Khách đổi ý hoặc bấm nhầm</span>
            </div>
            <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <span className="text-[11px] font-mono font-medium text-zinc-500 uppercase">Tần Suất Bấm Nút / Căn Hộ</span>
              <p className="text-xl font-bold font-mono text-zinc-900 dark:text-white mt-1">4.2 Lần / Tháng</p>
              <span className="text-[10px] text-zinc-400">Nhu yếu phẩm định kỳ</span>
            </div>
            <div className="p-3.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <span className="text-[11px] font-mono font-medium text-zinc-500 uppercase">Độ Hài Lòng Khách Hàng</span>
              <p className="text-xl font-bold font-mono text-zinc-900 dark:text-white mt-1">4.92 / 5.0</p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Đánh giá 1-chạm</span>
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2">
            <h4 className="text-xs font-semibold text-zinc-900 dark:text-white font-mono uppercase tracking-wider">
              Biểu Đồ Xu Hướng Đơn Hàng & Doanh Thu Toàn Mạng
            </h4>
            <AnalyticsChart data={[]} />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 6: 4.2.5 FCM NOTIFICATIONS & MESSAGE TEMPLATES                     */}
      {/* ========================================================================= */}
      {activeTab === 'NOTIFICATIONS' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-zinc-900 dark:text-white" />
              <span>Cấu Hình Thông Báo FCM & Mẫu Tin Nhắn Tự Động</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Thiết lập Firebase Cloud Messaging và quản lý các khuôn mẫu thông báo đẩy tự động
            </p>
          </div>

          {/* FCM Configuration Form */}
          <div className="p-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-zinc-900 dark:text-white tracking-wider font-mono">
              Cấu Hình Firebase Cloud Messaging (FCM Web SDK)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  FCM Server Key (Secret)
                </label>
                <input
                  type="password"
                  value={fcmConfig.serverKey}
                  onChange={(e) => setFcmConfig({ ...fcmConfig, serverKey: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  FCM Sender ID / Project ID
                </label>
                <input
                  type="text"
                  value={fcmConfig.projectId}
                  onChange={(e) => setFcmConfig({ ...fcmConfig, projectId: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-zinc-800 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={fcmConfig.enablePush}
                  onChange={(e) => setFcmConfig({ ...fcmConfig, enablePush: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-900 accent-zinc-900 cursor-pointer"
                />
                <span>Kích hoạt gửi Push Notification tức thì đến App di động</span>
              </label>
            </div>
          </div>

          {/* Message Templates List */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase text-zinc-900 dark:text-white tracking-wider font-mono">
              Quản Lý Mẫu Tin Nhắn Tự Động (Event Templates)
            </h3>

            <div className="space-y-2">
              {messageTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-3.5 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      Sự kiện: {tpl.trigger}
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tpl.enabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setMessageTemplates((prev) =>
                            prev.map((t) => (t.id === tpl.id ? { ...t, enabled: checked } : t))
                          );
                        }}
                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-900 accent-zinc-900 cursor-pointer"
                      />
                      <span className="font-medium">Bật gửi</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Tiêu đề thông báo:
                    </label>
                    <input
                      type="text"
                      value={tpl.title}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMessageTemplates((prev) =>
                          prev.map((t) => (t.id === tpl.id ? { ...t, title: val } : t))
                        );
                      }}
                      className="w-full px-3 py-1.5 text-xs rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white font-medium focus:outline-none focus:border-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      Nội dung thông báo (Biến: {"{{apartment}}, {{productName}}, {{quantity}}"}):
                    </label>
                    <textarea
                      rows={2}
                      value={tpl.body}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMessageTemplates((prev) =>
                          prev.map((t) => (t.id === tpl.id ? { ...t, body: val } : t))
                        );
                      }}
                      className="w-full px-3 py-1.5 text-xs rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-zinc-900"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </main>

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}
      {/* Reject Store Modal */}
      {rejectingStoreId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-5 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Từ Chối Phê Duyệt Cửa Hàng</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Bắt buộc phải nhập lý do từ chối để hệ thống gửi thông báo cho chủ cơ sở.
            </p>

            <form onSubmit={handleReject} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Lý do từ chối
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="VD: Không cung cấp được giấy phép kinh doanh..."
                  className="w-full px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRejectingStoreId(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  Xác Nhận Từ Chối
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Generate Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-5 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center">
                <PlusCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Tạo Lô Nút Bấm Trống Mới</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Tự động sinh mã ID, Serial, Secret và QR Code vào kho</p>
              </div>
            </div>

            <form onSubmit={handleBatchGenerate} className="space-y-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Số lượng nút cần tạo</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  required
                  value={batchCount}
                  onChange={(e) => setBatchCount(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-mono focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">Tiền tố mã định danh (Prefix)</label>
                <input
                  type="text"
                  required
                  value={batchPrefix}
                  onChange={(e) => setBatchPrefix(e.target.value.toUpperCase())}
                  placeholder="BTN"
                  className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-mono font-medium focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessingBatch}
                  onClick={() => setShowBatchModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isProcessingBatch}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  {isProcessingBatch ? 'Đang tạo...' : 'Xác Nhận Tạo Lô Nút'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocate to Store Modal */}
      {showAllocateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-lg w-full p-5 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Cấp Phát Nút Cho Cửa Hàng</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Ủy quyền phân phối <strong>{selectedDeviceIds.length}</strong> nút bấm đã chọn
                </p>
              </div>
            </div>

            <form onSubmit={handleAllocateDevices} className="space-y-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Chọn Cửa Hàng nhận bàn giao nút
                </label>
                <select
                  required
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white focus:outline-none focus:border-zinc-900"
                >
                  <option value="">-- Chọn Cửa Hàng --</option>
                  {allStores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name} ({store.code}) - {store.ownerName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Danh sách mã nút bấm sẽ cấp ({selectedDeviceIds.length} nút)
                </label>
                <div className="max-h-36 overflow-y-auto p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg flex flex-wrap gap-1.5 font-mono text-[11px]">
                  {selectedDeviceIds.map((id) => (
                    <span
                      key={id}
                      className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-medium"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessingBatch}
                  onClick={() => setShowAllocateModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isProcessingBatch}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  {isProcessingBatch ? 'Đang bàn giao...' : 'Xác Nhận Bàn Giao'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Master Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-xl max-w-lg w-full p-5 shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Thêm Mặt Hàng Gốc Mới (Master Catalog)
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Hàng hóa gốc sẽ xuất hiện trong kho cho các cư dân gán vào nút bấm
            </p>

            <form onSubmit={handleAddProduct} className="space-y-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Tên sản phẩm:
                </label>
                <input
                  type="text"
                  required
                  value={newProductForm.name}
                  onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                  placeholder="VD: Nước Mắm Nam Ngư Đệ Nhị 900ml"
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Nhóm danh mục:
                  </label>
                  <select
                    value={newProductForm.category}
                    onChange={(e) => setNewProductForm({ ...newProductForm, category: e.target.value as any })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-900"
                  >
                    <option value="Nước mắm">Nước mắm</option>
                    <option value="Nước uống">Nước uống</option>
                    <option value="Gas">Gas</option>
                    <option value="Gạo">Gạo</option>
                    <option value="Dầu ăn & Gia vị">Dầu ăn & Gia vị</option>
                    <option value="Nhu yếu phẩm">Nhu yếu phẩm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Thương hiệu:
                  </label>
                  <input
                    type="text"
                    value={newProductForm.brand}
                    onChange={(e) => setNewProductForm({ ...newProductForm, brand: e.target.value })}
                    placeholder="VD: Nam Ngư"
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Giá niêm yết (VNĐ):
                  </label>
                  <input
                    type="number"
                    required
                    value={newProductForm.price}
                    onChange={(e) => setNewProductForm({ ...newProductForm, price: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono focus:outline-none focus:border-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Quy cách:
                  </label>
                  <input
                    type="text"
                    value={newProductForm.unit}
                    onChange={(e) => setNewProductForm({ ...newProductForm, unit: e.target.value })}
                    placeholder="VD: Chai 900ml"
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Đường dẫn ảnh sản phẩm (Image URL):
                </label>
                <input
                  type="text"
                  value={newProductForm.imageUrl}
                  onChange={(e) => setNewProductForm({ ...newProductForm, imageUrl: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  Lưu Vào Danh Mục Gốc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
