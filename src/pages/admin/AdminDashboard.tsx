import React, { useState, useEffect, useMemo } from 'react';
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

export const AdminDashboard: React.FC = () => {
  // Navigation tabs organized sequentially by physical IoT operational lifecycle
  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'STORES' | 'CATALOG' | 'DEVICES' | 'RBAC' | 'TELEMETRY' | 'ANALYTICS' | 'NOTIFICATIONS'
  >('OVERVIEW');

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20 shadow-inner">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Cổng Giám Sát & Quản Trị Hệ Thống (Admin Hub)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                SUPER ADMIN v2.0
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Hệ thống điều hành trung tâm kết nối cư dân, đối tác cung ứng và hạ tầng IoT nút bấm một chạm ESP32
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAdminData()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors"
            title="Làm mới dữ liệu hệ thống"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Làm Mới</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* OPERATIONAL LIFECYCLE STEPPER (QUY TRÌNH VẬN HÀNH TUẦN TỰ)               */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              Quy Trình Vận Hành Tuần Tự (Operational Lifecycle)
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Chu trình triển khai từ Đối tác Đại lý ➔ Hàng hóa ➔ Nút bấm ➔ Cư dân ➔ Giám sát IoT
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Bấm chọn từng bước để mở module nghiệp vụ tương ứng
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            {
              step: '01',
              title: 'Duyệt Đại Lý',
              desc: 'Phê duyệt trạm cung ứng',
              tabKey: 'STORES' as const,
              icon: StoreIcon,
              badge: pendingStores.length > 0 ? `${pendingStores.length} chờ` : null,
              badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
            },
            {
              step: '02',
              title: 'Danh Mục Gốc',
              desc: 'Chuẩn hóa SKU hàng hóa',
              tabKey: 'CATALOG' as const,
              icon: Layers,
              badge: `${catalogProducts.length} món`,
              badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
            },
            {
              step: '03',
              title: 'Cấp Phát Nút',
              desc: 'Kho lô nút & bàn giao',
              tabKey: 'DEVICES' as const,
              icon: Cpu,
              badge: `${unassignedDevices.length} nút trống`,
              badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
            },
            {
              step: '04',
              title: 'Tài Khoản & Cư Dân',
              desc: 'Phân quyền & gắn nút',
              tabKey: 'RBAC' as const,
              icon: Users,
              badge: `${usersList.length} người`,
              badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
            },
            {
              step: '05',
              title: 'Giám Sát IoT & Pin',
              desc: 'Pin yếu & sóng từ xa',
              tabKey: 'TELEMETRY' as const,
              icon: Battery,
              badge:
                telemetryDevices.filter((d) => d.battery < 20).length > 0
                  ? `${telemetryDevices.filter((d) => d.battery < 20).length} pin yếu`
                  : '100% Khỏe',
              badgeColor:
                telemetryDevices.filter((d) => d.battery < 20).length > 0
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
            },
            {
              step: '06',
              title: 'Báo Cáo & Doanh Thu',
              desc: 'Phân tích & xuất CSV/PDF',
              tabKey: 'ANALYTICS' as const,
              icon: TrendingUp,
              badge: stats?.totalOrders ? `${stats.totalOrders} đơn` : 'Realtime',
              badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
            },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.tabKey;
            return (
              <button
                key={item.step}
                onClick={() => setActiveTab(item.tabKey)}
                className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer btn-press ${
                  isActive
                    ? 'bg-cyan-50/70 dark:bg-cyan-950/30 border-cyan-500/50 shadow-sm ring-2 ring-cyan-500/20'
                    : 'bg-slate-50/80 dark:bg-zinc-900/50 border-slate-200/80 dark:border-zinc-800 hover:border-cyan-500/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-slate-400">
                    BƯỚC {item.step}
                  </span>
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} />
                </div>
                <div className="mt-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {item.title}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                    {item.desc}
                  </p>
                </div>
                {item.badge && (
                  <span className={`mt-2 inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation Modules (Tab Bar - Organized Sequentially) */}
      <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-x-auto scrollbar-thin">
        {[
          { key: 'OVERVIEW', label: 'Tổng Quan & Nhật Ký', icon: Boxes },
          { key: 'STORES', label: '1. Trạm Cửa Hàng & Đại Lý', icon: StoreIcon, badge: pendingStores.length > 0 ? pendingStores.length : null },
          { key: 'CATALOG', label: '2. Danh Mục Hàng Gốc', icon: Layers },
          { key: 'DEVICES', label: '3. Kho Nút Bấm & Cấp Phát', icon: Cpu, badge: unassignedDevices.length > 0 ? unassignedDevices.length : null },
          { key: 'RBAC', label: '4. Tài Khoản & Phân Quyền', icon: Users },
          { key: 'TELEMETRY', label: '5. Giám Sát IoT & Pin', icon: Battery, alert: telemetryDevices.filter(d => d.battery < 20).length > 0 },
          { key: 'ANALYTICS', label: '6. Báo Cáo & Doanh Thu', icon: TrendingUp },
          { key: 'NOTIFICATIONS', label: '7. Cấu Hình Thông Báo FCM', icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-white dark:bg-zinc-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-500 text-white">
                  {tab.badge}
                </span>
              )}
              {tab.alert && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* MODULE 0: OVERVIEW, STATS & SYSTEM AUDIT TRAIL                           */}
      {/* ========================================================================= */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-8">
          {/* System Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Tổng Trạm Cửa Hàng</div>
                <p className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white mt-1">{stats.totalStores}</p>
                <p className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-bold mt-1">{stats.pendingStores} đang chờ duyệt</p>
              </div>

              <div className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Smart Buttons Hoạt Động</div>
                <p className="text-3xl font-extrabold font-mono text-cyan-600 dark:text-cyan-400 mt-1">{stats.activeDevices}</p>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-1">/ {stats.totalDevices} thiết bị toàn mạng</p>
              </div>

              <div className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Tổng Lượt Đặt Hàng</div>
                <p className="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1">{stats.totalOrders}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Xử lý tự động qua nút ESP32</p>
              </div>

              <div className="p-5 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">Doanh Thu Toàn Mạng</div>
                <p className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white mt-1.5">{stats.totalRevenue?.toLocaleString()} ₫</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">Khớp lệnh Realtime</p>
              </div>
            </div>
          )}

          {/* Quick Jump Action Bar */}
          <div className="p-5 bg-gradient-to-r from-cyan-600/10 via-indigo-600/10 to-emerald-600/10 border border-cyan-500/20 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                Thao Tác Nhanh Quản Trị
              </span>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Truy cập trực tiếp các tác vụ cấp phát & phê duyệt cốt lõi
              </h4>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setActiveTab('DEVICES');
                  setShowBatchModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all btn-press"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Tạo Lô Nút Mới</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('CATALOG');
                  setShowAddProductModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-xs flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm Hàng Gốc</span>
              </button>
              {pendingStores.length > 0 && (
                <button
                  onClick={() => setActiveTab('STORES')}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all btn-press"
                >
                  <Clock className="w-4 h-4" />
                  <span>Duyệt {pendingStores.length} Đại Lý Chờ</span>
                </button>
              )}
            </div>
          </div>

          {/* System Audit Trail (Nhật Ký Vận Hành Thực Tế) */}
          <div className="bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-cyan-500" />
                  <span>Nhật Ký Vận Hành Hệ Thống (System Audit Trail)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Ghi nhận toàn bộ thao tác xét duyệt đại lý, bàn giao nút bấm và cấu hình của ban quản trị
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                {auditLogs.length} bản ghi
              </span>
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-8 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center space-y-2">
                <Activity className="w-7 h-7 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Hệ thống đang hoạt động ổn định</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Mọi sự kiện phân quyền, cấp phát nút và duyệt cửa hàng sẽ tự động xuất hiện tại đây theo thời gian thực.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200/80 dark:border-white/5 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-white/10 text-slate-500 font-mono text-[11px] uppercase">
                    <tr>
                      <th className="py-3 px-4">Thời Gian</th>
                      <th className="py-3 px-4">Tài Khoản Thực Hiện</th>
                      <th className="py-3 px-4">Hành Động (Action)</th>
                      <th className="py-3 px-4">Đối Tượng (Entity)</th>
                      <th className="py-3 px-4">Chi Tiết Sự Kiện</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                    {auditLogs.slice(0, 15).map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors">
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(log.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-zinc-200">
                          {log.user?.fullName || log.user?.email || 'Hệ thống'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                          {log.entity} <span className="text-[10px] text-slate-400">({log.entityId?.slice(-6)})</span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-zinc-300 font-sans text-xs">
                          {log.newValues || log.oldValues || 'Thao tác cập nhật trạng thái'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
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
        <div className="space-y-8">
          {/* Pending Store Approvals */}
          <div className="bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <span>Đơn Đăng Ký Đại Lý Chờ Xét Duyệt ({pendingStores.length})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Kiểm tra hồ sơ pháp lý, địa chỉ kho và phê duyệt quyền vận hành trạm phân phối
                </p>
              </div>
            </div>

            {pendingStores.length === 0 ? (
              <div className="p-8 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Không có đơn đại lý nào chờ duyệt</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tất cả các trạm cửa hàng đăng ký đều đã được xử lý hoàn tất.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingStores.map((store) => (
                  <div
                    key={store.id}
                    className="p-4 border border-slate-200/80 dark:border-white/5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:border-cyan-500/30 transition-all"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{store.name}</span>
                        <span className="font-mono text-[11px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded">
                          {store.code}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">
                        Chủ đại lý: <strong>{store.ownerName}</strong> • {store.phone} • {store.email}
                      </p>
                      <p className="text-slate-500 dark:text-slate-500">Địa chỉ kho: {store.address}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(store.id)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all btn-press"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Phê Duyệt Mở Trạm</span>
                      </button>
                      <button
                        onClick={() => setRejectingStoreId(store.id)}
                        className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5 transition-all"
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
          <div className="bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <StoreIcon className="w-5 h-5 text-indigo-500" />
                  <span>Danh Sách Trạm Đại Lý Đang Hoạt Động ({allStores.length})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Các trạm cung ứng chính thức được ủy quyền phục vụ cư dân tại các cụm chung cư
                </p>
              </div>
            </div>

            {allStores.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center font-mono">Chưa có trạm đại lý nào được kích hoạt.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-200/80 dark:border-white/5 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-white/10 text-slate-500 font-mono text-[11px] uppercase">
                    <tr>
                      <th className="py-3 px-4">Tên Trạm Đại Lý</th>
                      <th className="py-3 px-4">Mã Trạm</th>
                      <th className="py-3 px-4">Chủ Cơ Sở / Quản Lý</th>
                      <th className="py-3 px-4">Liên Hệ (SĐT / Email)</th>
                      <th className="py-3 px-4">Địa Chỉ Kho Cung Ứng</th>
                      <th className="py-3 px-4">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {allStores.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{s.name}</td>
                        <td className="py-3 px-4 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10">
                            {s.code}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">{s.ownerName}</td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                          <div>{s.phone}</div>
                          <div className="text-[10px] text-slate-400">{s.email}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-xs">{s.address}</td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Đang hoạt động
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
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
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center border border-cyan-500/20">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Kho Nút Bấm Trống & Bàn Giao Đại Lý</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {unassignedDevices.length} nút chưa phân bổ
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tạo hàng loạt mã định danh nút ESP32 mới và ủy quyền phân phối cho các đại lý cửa hàng
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBatchModal(true)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition-all btn-press"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Tạo Lô Nút Bấm Mới</span>
              </button>
              <button
                disabled={selectedDeviceIds.length === 0}
                onClick={() => setShowAllocateModal(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                  selectedDeviceIds.length > 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20 cursor-pointer btn-press'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-white/5'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>Cấp Phát Cho Cửa Hàng ({selectedDeviceIds.length})</span>
              </button>
            </div>
          </div>

          {unassignedDevices.length === 0 ? (
            <div className="p-8 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-center space-y-2">
              <Boxes className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Kho nút tổng đang trống</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Nhấn nút <strong>"Tạo Lô Nút Bấm Mới"</strong> để nạp mã thiết bị vào hệ thống.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200/80 dark:border-white/5 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-white/10 text-slate-500 dark:text-slate-400 font-bold uppercase font-mono tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4 w-10">
                      <button onClick={toggleSelectAll} className="flex items-center">
                        {selectedDeviceIds.length === unassignedDevices.length && unassignedDevices.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-cyan-500" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">Mã Thiết Bị (ID)</th>
                    <th className="py-3 px-4">Số Serial</th>
                    <th className="py-3 px-4">Mã PIN Ghép Nối</th>
                    <th className="py-3 px-4">Tên Bluetooth Phát Sóng</th>
                    <th className="py-3 px-4">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                  {unassignedDevices.slice(0, 50).map((dev) => {
                    const isSelected = selectedDeviceIds.includes(dev.deviceId);
                    return (
                      <tr
                        key={dev.id}
                        onClick={() => toggleDeviceSelect(dev.deviceId)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-cyan-50/60 dark:bg-cyan-950/20'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-850/50'
                        }`}
                      >
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => toggleDeviceSelect(dev.deviceId)}>
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-cyan-500" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10">
                            {dev.deviceId}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 text-[11px]">{dev.serialNumber}</td>
                        <td className="py-3 px-4 text-cyan-600 dark:text-cyan-400 font-bold">{dev.pairingCode || '-'}</td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          <span className="text-[11px] font-sans text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                            SOB-{dev.deviceId}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Trong Kho Trống
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 2: 4.2.1 RBAC USER MANAGEMENT & PERMISSIONS                        */}
      {/* ========================================================================= */}
      {activeTab === 'RBAC' && (
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                <span>Quản Lý Người Dùng & Phân Quyền (RBAC)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Quản lý quyền hạn cho Quản trị viên, Chủ cửa hàng, Nhân viên giao hàng và Cư dân
              </p>
            </div>

            {/* Role Filter & Search */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Tìm theo tên, email, SĐT..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white"
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-white cursor-pointer"
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
          <div className="overflow-x-auto border border-slate-200 dark:border-zinc-800 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-slate-500 font-mono text-[11px] uppercase">
                <tr>
                  <th className="py-3 px-4">Họ & Tên</th>
                  <th className="py-3 px-4">Email / SĐT</th>
                  <th className="py-3 px-4">Căn Hộ / Cửa Hàng</th>
                  <th className="py-3 px-4">Vai Trò (RBAC)</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4 text-right">Hành Động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {u.fullName}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 font-mono">
                      <div>{u.email}</div>
                      <div className="text-[11px] text-slate-400">{u.phone}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                      {u.storeName || u.store?.name || 'Mặc định'}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleChangeUserRole(u.id, e.target.value)}
                        className="px-2 py-1 rounded-lg text-[11px] font-mono font-bold bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 cursor-pointer text-indigo-600 dark:text-indigo-400"
                      >
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        <option value="STORE_OWNER">STORE_OWNER</option>
                        <option value="DELIVERY_STAFF">DELIVERY_STAFF</option>
                        <option value="CUSTOMER">CUSTOMER</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      {u.isActive ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Đang hoạt động
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          Đã khóa
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleUserStatus(u.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          u.isActive
                            ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400'
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400'
                        }`}
                      >
                        {u.isActive ? 'Khóa TK' : 'Mở Khóa'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 3: 4.2.2 MASTER PRODUCT CATALOG (CRUD & BUTTON BINDING)            */}
      {/* ========================================================================= */}
      {activeTab === 'CATALOG' && (
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-500" />
                <span>Danh Mục Sản Phẩm Gốc (Master Product Catalog)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Quản lý các mặt hàng nhu yếu phẩm sẵn có để cư dân liên kết vào nút bấm IoT một chạm
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowAddProductModal(true)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Mặt Hàng Gốc Mới</span>
              </button>
            </div>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-3 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Tìm sản phẩm theo tên, thương hiệu (VD: nước mắm, lavie, petrolimex...)"
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              {['ALL', 'Nước mắm', 'Nước uống', 'Gas', 'Gạo', 'Dầu ăn & Gia vị'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCatalogCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                    catalogCategoryFilter === cat
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                  }`}
                >
                  {cat === 'ALL' ? 'Tất Cả' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Catalog Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map((prod) => (
              <div
                key={prod.id}
                className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-3 relative group"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={prod.imageUrl}
                    alt={prod.name}
                    className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                      {prod.category}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1 line-clamp-2">
                      {prod.name}
                    </h4>
                    <span className="text-xs font-black text-cyan-600 dark:text-cyan-400 block mt-1">
                      {prod.price.toLocaleString('vi-VN')} đ / {prod.unit}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-2">
                  {prod.description}
                </p>

                <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[10px]">
                    Tồn: <strong>{prod.stock}</strong> | Báo động: &lt;<strong>{prod.minStockAlert}</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => alert(`Đang mở chỉnh sửa cho: ${prod.name}`)}
                      className="p-1.5 rounded-lg bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-cyan-500"
                      title="Chỉnh sửa sản phẩm"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(prod.id)}
                      className="p-1.5 rounded-lg bg-white dark:bg-zinc-800 text-slate-400 hover:text-rose-500"
                      title="Xóa sản phẩm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 4: 4.2.3 IOT TELEMETRY & BATTERY MONITORING                        */}
      {/* ========================================================================= */}
      {activeTab === 'TELEMETRY' && (
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Battery className="w-5 h-5 text-emerald-500" />
                <span>Giám Sát Mạng Lưới Thiết Bị IoT & Dung Lượng Pin Từ Xa</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Cảnh báo trực quan các thiết bị ESP32 pin yếu (&lt; 20% màu cam, &lt; 15% viền đỏ nhấp nháy cần bảo trì)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
              >
                <Download className="w-4 h-4" />
                <span>Xuất Báo Cáo Pin (CSV)</span>
              </button>
            </div>
          </div>

          {/* Telemetry Devices List */}
          <div className="overflow-x-auto border border-slate-200 dark:border-zinc-800 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-slate-500 font-mono text-[11px] uppercase">
                <tr>
                  <th className="py-3 px-4">Mã Device ID</th>
                  <th className="py-3 px-4">Tên Nút Bấm</th>
                  <th className="py-3 px-4">Căn Hộ Sở Hữu</th>
                  <th className="py-3 px-4">Dung Lượng Pin (% Pin)</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4">Sóng Wi-Fi / IP</th>
                  <th className="py-3 px-4">Lần Cuối Bấm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-mono">
                {telemetryDevices.map((dev) => {
                  const isCritical = dev.battery < 15;
                  const isWarning = dev.battery <= 20 && dev.battery >= 15;
                  return (
                    <tr
                      key={dev.deviceId}
                      className={`transition-colors ${
                        isCritical
                          ? 'bg-rose-500/10 border-l-4 border-rose-500'
                          : isWarning
                          ? 'bg-amber-500/5 border-l-4 border-amber-500'
                          : 'hover:bg-slate-50/70 dark:hover:bg-zinc-800/40'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                          {dev.deviceId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-sans font-bold text-slate-800 dark:text-zinc-200">
                        {dev.customName}
                      </td>
                      <td className="py-3.5 px-4 font-sans text-slate-600 dark:text-zinc-400">
                        {dev.customer}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isCritical
                                  ? 'bg-rose-500 animate-pulse'
                                  : isWarning
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${dev.battery}%` }}
                            />
                          </div>
                          <span
                            className={`font-bold font-mono text-xs ${
                              isCritical
                                ? 'text-rose-600 dark:text-rose-400 animate-bounce'
                                : isWarning
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {dev.battery}%
                          </span>
                          {isCritical && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-600 text-white animate-pulse">
                              CẦN THAY PIN
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {dev.status === 'ONLINE' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                            ONLINE
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">OFFLINE</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        <div>{dev.wifiRssi} dBm</div>
                        <div className="text-[10px] text-slate-400">{dev.ip}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-sans text-[11px]">
                        {dev.lastSeen}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 5: 4.2.4 ANALYTICS & EXPORT REPORTS (CSV / PDF)                   */}
      {/* ========================================================================= */}
      {activeTab === 'ANALYTICS' && (
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                <span>Báo Cáo Phân Tích & Hiệu Suất Vận Hành (Analytics & Export)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Trực quan hóa tổng đơn hàng, doanh thu, thời gian giao trung bình và tỷ lệ hủy đơn
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
              >
                <Download className="w-4 h-4" />
                <span>Xuất CSV Báo Cáo</span>
              </button>
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                <span>In / Xuất PDF</span>
              </button>
            </div>
          </div>

          {/* Operational Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Thời Gian Giao Trung Bình</span>
              <p className="text-2xl font-black font-mono text-cyan-600 dark:text-cyan-400 mt-1">18.4 Phút</p>
              <span className="text-[10px] text-emerald-600 font-bold">Nhanh hơn mục tiêu 6.6p</span>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Tỷ Lệ Hủy Đơn (2 Phút)</span>
              <p className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400 mt-1">1.8%</p>
              <span className="text-[10px] text-slate-400">Khách đổi ý hoặc bấm nhầm</span>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Tần Suất Bấm Nút / Căn Hộ</span>
              <p className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">4.2 Lần / Tháng</p>
              <span className="text-[10px] text-slate-400">Nhu yếu phẩm định kỳ</span>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Độ Hài Lòng Khách Hàng</span>
              <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">4.92 / 5.0</p>
              <span className="text-[10px] text-emerald-600 font-bold">Đánh giá 1-chạm</span>
            </div>
          </div>

          {/* Revenue Chart */}
          <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase font-mono">
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
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                <span>Cấu Hình Thông Báo FCM & Mẫu Tin Nhắn Tự Động</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Thiết lập quy định gửi thông báo Firebase Cloud Messaging và chỉnh sửa nội dung tin nhắn tự động
              </p>
            </div>
          </div>

          {/* FCM Configuration Form */}
          <div className="p-5 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider font-mono">
              Cấu Hình Firebase Cloud Messaging (FCM Web SDK)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  FCM Server Key (Secret)
                </label>
                <input
                  type="password"
                  value={fcmConfig.serverKey}
                  onChange={(e) => setFcmConfig({ ...fcmConfig, serverKey: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  FCM Sender ID / Project ID
                </label>
                <input
                  type="text"
                  value={fcmConfig.projectId}
                  onChange={(e) => setFcmConfig({ ...fcmConfig, projectId: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={fcmConfig.enablePush}
                  onChange={(e) => setFcmConfig({ ...fcmConfig, enablePush: e.target.checked })}
                  className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500"
                />
                <span>Kích hoạt gửi Push Notification tức thì đến App di động</span>
              </label>
            </div>
          </div>

          {/* Message Templates List */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider font-mono">
              Quản Lý Mẫu Tin Nhắn Tự Động (Event Templates)
            </h3>

            {messageTemplates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    Sự kiện: {tpl.trigger}
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tpl.enabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setMessageTemplates((prev) =>
                          prev.map((t) => (t.id === t.id ? { ...t, enabled: checked } : t))
                        );
                      }}
                    />
                    <span>Bật gửi</span>
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
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
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1">
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
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}
      {/* Reject Store Modal */}
      {rejectingStoreId && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Từ Chối Phê Duyệt Cửa Hàng</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Bắt buộc phải nhập lý do từ chối để hệ thống gửi thông báo cho chủ cơ sở.
            </p>

            <form onSubmit={handleReject} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Lý do từ chối
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="VD: Không cung cấp được giấy phép kinh doanh..."
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-black/50 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingStoreId(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tạo Lô Nút Bấm Trống Mới</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tự động tạo mã ID, Serial, Secret và QR Code vào kho</p>
              </div>
            </div>

            <form onSubmit={handleBatchGenerate} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Số lượng nút cần tạo</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  required
                  value={batchCount}
                  onChange={(e) => setBatchCount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-black/50 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tiền tố mã định danh (Prefix)</label>
                <input
                  type="text"
                  required
                  value={batchPrefix}
                  onChange={(e) => setBatchPrefix(e.target.value.toUpperCase())}
                  placeholder="BTN"
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-black/50 text-slate-900 dark:text-white font-mono font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessingBatch}
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isProcessingBatch}
                  className="px-5 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl shadow-md"
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Cấp Phát Nút Cho Cửa Hàng</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ủy quyền phân phối <strong>{selectedDeviceIds.length}</strong> nút bấm đã chọn
                </p>
              </div>
            </div>

            <form onSubmit={handleAllocateDevices} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Chọn Cửa Hàng nhận bàn giao nút
                </label>
                <select
                  required
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-black/50 text-slate-900 dark:text-white"
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
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Danh sách mã nút bấm sẽ cấp ({selectedDeviceIds.length} nút)
                </label>
                <div className="max-h-36 overflow-y-auto p-2.5 bg-slate-50 dark:bg-black/40 border border-slate-200/80 dark:border-white/10 rounded-xl flex flex-wrap gap-1.5 font-mono text-[11px]">
                  {selectedDeviceIds.map((id) => (
                    <span
                      key={id}
                      className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-bold"
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
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isProcessingBatch}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md"
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Thêm Mặt Hàng Gốc Mới (Master Catalog)
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Hàng hóa gốc sẽ xuất hiện trong kho cho các cư dân gán vào nút bấm
            </p>

            <form onSubmit={handleAddProduct} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Tên sản phẩm:
                </label>
                <input
                  type="text"
                  required
                  value={newProductForm.name}
                  onChange={(e) => setNewProductForm({ ...newProductForm, name: e.target.value })}
                  placeholder="VD: Nước Mắm Nam Ngư Đệ Nhị 900ml"
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Nhóm danh mục:
                  </label>
                  <select
                    value={newProductForm.category}
                    onChange={(e) => setNewProductForm({ ...newProductForm, category: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"
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
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Thương hiệu:
                  </label>
                  <input
                    type="text"
                    value={newProductForm.brand}
                    onChange={(e) => setNewProductForm({ ...newProductForm, brand: e.target.value })}
                    placeholder="VD: Nam Ngư"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Giá niêm yết (VNĐ):
                  </label>
                  <input
                    type="number"
                    required
                    value={newProductForm.price}
                    onChange={(e) => setNewProductForm({ ...newProductForm, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Quy cách:
                  </label>
                  <input
                    type="text"
                    value={newProductForm.unit}
                    onChange={(e) => setNewProductForm({ ...newProductForm, unit: e.target.value })}
                    placeholder="VD: Chai 900ml"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Đường dẫn ảnh sản phẩm (Image URL):
                </label>
                <input
                  type="text"
                  value={newProductForm.imageUrl}
                  onChange={(e) => setNewProductForm({ ...newProductForm, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl shadow-md"
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
