import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { api } from '../../services/api';
import { toast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStore, getSocket } from '../../services/socket';
import { Device, Product, FleetStats, DeviceTelemetry, DeviceAuditLog } from '../../types';
import { QRCodeSVG } from 'qrcode.react';
import {
  Cpu,
  Plus,
  Battery,
  Wifi,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Sliders,
  FileSpreadsheet,
  Activity,
  Layers,
  Search,
  Filter,
  Copy,
  Check,
  RefreshCw,
  Power,
  Clock,
  Lightbulb,
  Printer,
  X,
  ChevronRight,
  Shield,
  Tag,
  MapPin,
  FileText,
  Radio,
  ExternalLink,
  Camera,
  Hash,
  Edit3,
  Trash2,
  LayoutGrid,
  List,
  Sparkles,
  AlertTriangle,
  Play,
  Zap,
  Calendar,
  Bluetooth,
  MoreHorizontal,
  ChevronDown,
  ShoppingCart,
  RotateCcw,
  Wrench,
  PhoneCall,
  Siren,
  Ban,
  MousePointerClick,
  Timer,
  ShieldAlert,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { QrCameraScanner } from '../../components/common/QrCameraScanner';
import { WhiteDeviceAirPodsModal } from '../../components/devices/WhiteDeviceAirPodsModal';

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

const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.22, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } },
};

const modalDialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.93, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 28,
      stiffness: 350,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 12,
    transition: { duration: 0.18, ease: 'easeIn' },
  },
};

interface ActionDefinition {
  value: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
}

const ACTION_DEFINITIONS: Record<string, ActionDefinition> = {
  ORDER_PRODUCT: {
    value: 'ORDER_PRODUCT',
    label: 'Đặt hàng tự động ngay lập tức',
    desc: 'Tự động tạo đơn hàng ngay khi người dùng nhấn nút',
    icon: Zap,
    iconClass: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
  ADD_TO_SHOPPING_LIST: {
    value: 'ADD_TO_SHOPPING_LIST',
    label: 'Thêm vào danh sách đi chợ / Giỏ hàng',
    desc: 'Đưa sản phẩm vào danh sách chờ xác nhận',
    icon: ShoppingCart,
    iconClass: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
  },
  CANCEL_LAST_ORDER: {
    value: 'CANCEL_LAST_ORDER',
    label: 'Hủy đơn hàng vừa bấm (trong 60s)',
    desc: 'Cho phép khách tự hủy đơn hàng vừa ấn nhầm',
    icon: RotateCcw,
    iconClass: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
  },
  REQUEST_SERVICE: {
    value: 'REQUEST_SERVICE',
    label: 'Yêu cầu kỹ thuật viên / Thay bình / Bảo dưỡng',
    desc: 'Tạo phiếu yêu cầu bảo trì gửi tới cửa hàng',
    icon: Wrench,
    iconClass: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  },
  CALL_STORE: {
    value: 'CALL_STORE',
    label: 'Báo cửa hàng gọi điện liên hệ tư vấn',
    desc: 'Thông báo nhân viên CSKH chủ động liên hệ với khách',
    icon: PhoneCall,
    iconClass: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  },
  TRIGGER_EMERGENCY: {
    value: 'TRIGGER_EMERGENCY',
    label: 'Báo động khẩn cấp SOS tới người thân & Cửa hàng',
    desc: 'Kích hoạt còi chuông và gửi cảnh báo khẩn cấp',
    icon: Siren,
    iconClass: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  },
  WIFI_CONFIG: {
    value: 'WIFI_CONFIG',
    label: 'Kích hoạt chế độ cài Wi-Fi (SoftAP / BLE)',
    desc: 'Phát sóng AP/BLE để kết nối với mạng Wi-Fi mới',
    icon: Wifi,
    iconClass: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
  },
  NONE: {
    value: 'NONE',
    label: 'Vô hiệu hóa cử chỉ',
    desc: 'Không thực hiện hành động nào (Chỉ bật đèn LED / Đánh thức)',
    icon: Ban,
    iconClass: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  },
};

const GESTURE_ITEMS = [
  {
    key: 'singlePressAction' as const,
    menuKey: 'single' as const,
    title: 'Nhấn Đơn (Single Click)',
    subtitle: 'Thực hiện khi người dùng bấm nhanh 1 lần',
    badgeLabel: '1×',
    BadgeIcon: MousePointerClick,
    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50',
    options: ['ORDER_PRODUCT', 'ADD_TO_SHOPPING_LIST', 'NONE'],
    defaultOption: 'ORDER_PRODUCT',
  },
  {
    key: 'doublePressAction' as const,
    menuKey: 'double' as const,
    title: 'Nhấn Đúp (Double Click)',
    subtitle: 'Thực hiện khi bấm 2 lần liên tiếp trong 1.5s',
    badgeLabel: '2×',
    BadgeIcon: Layers,
    badgeClass: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50',
    options: ['ADD_TO_SHOPPING_LIST', 'ORDER_PRODUCT', 'CANCEL_LAST_ORDER', 'NONE'],
    defaultOption: 'ADD_TO_SHOPPING_LIST',
  },
  {
    key: 'hold3sAction' as const,
    menuKey: 'hold3s' as const,
    title: 'Nhấn Giữ 3 Giây (Hold 3s)',
    subtitle: 'Thực hiện khi ấn đè nút trong 3 giây',
    badgeLabel: '3s',
    BadgeIcon: Timer,
    badgeClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50',
    options: ['REQUEST_SERVICE', 'CALL_STORE', 'NONE'],
    defaultOption: 'REQUEST_SERVICE',
  },
  {
    key: 'hold5sAction' as const,
    menuKey: 'hold5s' as const,
    title: 'Nhấn Giữ 5 Giây (Hold 5s)',
    subtitle: 'Cử chỉ khẩn cấp hoặc cấu hình phần cứng',
    badgeLabel: '5s',
    BadgeIcon: ShieldAlert,
    badgeClass: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/50',
    options: ['TRIGGER_EMERGENCY', 'WIFI_CONFIG', 'NONE'],
    defaultOption: 'TRIGGER_EMERGENCY',
  },
];

export const StoreDevicesPage: React.FC = () => {
  const { user } = useAuth();
  const [showAirPodsModal, setShowAirPodsModal] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);

  useEffect(() => {
    const handleClosePopups = () => {
      setOpenMenuId(null);
      setShowToolsDropdown(false);
    };
    window.addEventListener('click', handleClosePopups);
    return () => window.removeEventListener('click', handleClosePopups);
  }, []);
  const [devices, setDevices] = useState<Device[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [fleetStats, setFleetStats] = useState<FleetStats>({
    total: 0,
    online: 0,
    offline: 0,
    lowBattery: 0,
    unconfigured: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [productFilter, setProductFilter] = useState('ALL');

  // Modals state
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardMode, setWizardMode] = useState<'PAIR_EXISTING' | 'CREATE_NEW'>('PAIR_EXISTING');
  const [quickCodeInput, setQuickCodeInput] = useState('');
  const [foundDeviceForConfig, setFoundDeviceForConfig] = useState<any | null>(null);
  const [quickConfigProductId, setQuickConfigProductId] = useState('');
  const [quickConfigCustomName, setQuickConfigCustomName] = useState('');
  const [quickConfigQuantity, setQuickConfigQuantity] = useState(1);
  const [quickConfigLocation, setQuickConfigLocation] = useState('');
  const [storeCameraActive, setStoreCameraActive] = useState(false);

  const [wizardForm, setWizardForm] = useState({
    deviceId: '',
    claimCode: '',
    pairingCode: '',
    qrToken: '',
    macAddress: '',
    customName: '',
    location: '',
    description: '',
    productId: '',
    defaultQuantity: 1,
  });
  const [wizardLoading, setWizardLoading] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [showTechOptions, setShowTechOptions] = useState(false);

  // Quick Assign Product Modal
  const [assigningDevice, setAssigningDevice] = useState<Device | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [assignCustomName, setAssignCustomName] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // QR Code Modal
  const [qrModalDevice, setQrModalDevice] = useState<Device | null>(null);

  // Telemetry & Audit Modal
  const [inspectDevice, setInspectDevice] = useState<Device | null>(null);
  const [activeTab, setActiveTab] = useState<'telemetry' | 'audit'>('telemetry');
  const [telemetries, setTelemetries] = useState<DeviceTelemetry[]>([]);
  const [auditLogs, setAuditLogs] = useState<DeviceAuditLog[]>([]);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Bulk Import Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [csvText, setCsvText] = useState(
    'deviceId,serialNumber,macAddress,customName,productSku\nSOB-000101,ESP32-101,24:6F:28:AB:CD:11,Nút Lavie Bếp,WATER-LAVIE-20L\nSOB-000102,ESP32-102,24:6F:28:AB:CD:12,Nút Gas Kho B,GAS-PETRO-12KG'
  );
  const [bulkPreview, setBulkPreview] = useState<any[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string | null>(null);

  // Copied tag helper
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // View mode: Grid vs Table
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Create Device Modal State (CRUD: Create)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    deviceId: '',
    serialNumber: '',
    macAddress: '',
    customName: '',
    productId: '',
    defaultQuantity: 1,
    location: '',
    description: '',
    batteryLevel: 100,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'ACTIVE',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Device Modal State (CRUD: Update)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState({
    customName: '',
    productId: '',
    defaultQuantity: 1,
    location: '',
    description: '',
    status: 'ACTIVE',
    batteryLevel: 100,
    expiresAt: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editMissingFields, setEditMissingFields] = useState<string[]>([]);

  // Simulation test state
  const [simulatingDeviceId, setSimulatingDeviceId] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  // Delete Confirmation Modal State (CRUD: Delete)
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // SmartSupply Behavior Designer Modal State
  const [behaviorDevice, setBehaviorDevice] = useState<Device | null>(null);
  const [behaviorSaving, setBehaviorSaving] = useState(false);
  const [openGestureMenu, setOpenGestureMenu] = useState<'single' | 'double' | 'hold3s' | 'hold5s' | null>(null);
  const [behaviorForm, setBehaviorForm] = useState({
    singlePressAction: 'ORDER_PRODUCT',
    doublePressAction: 'ADD_TO_SHOPPING_LIST',
    hold3sAction: 'REQUEST_SERVICE',
    hold5sAction: 'TRIGGER_EMERGENCY',
  });

  // Universal body scroll lock & header submerge whenever any modal is open on this page
  const isAnyModalOpen = Boolean(
    showWizard ||
    assigningDevice ||
    qrModalDevice ||
    inspectDevice ||
    showBulkModal ||
    showCreateModal ||
    editingDevice ||
    deletingDevice ||
    simulationResult ||
    behaviorDevice
  );
  useBodyScrollLock(isAnyModalOpen);

  // Random ID / Serial Generators
  const generateRandomDeviceId = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `SOB-${randomNum}`;
  };

  const generateRandomSerialNumber = () => {
    const hex = Math.random().toString(16).substring(2, 8).toUpperCase();
    return `ESP32-${hex}`;
  };

  const handleOpenCreateModal = () => {
    setCreateForm({
      deviceId: generateRandomDeviceId(),
      serialNumber: generateRandomSerialNumber(),
      macAddress: '',
      customName: '',
      productId: products.length > 0 ? products[0].id : '',
      defaultQuantity: 1,
      location: '',
      description: '',
      batteryLevel: 100,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'ACTIVE',
    });
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleCreateDeviceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    try {
      const payload: any = {
        deviceId: createForm.deviceId.trim().toUpperCase(),
        serialNumber: createForm.serialNumber.trim() || undefined,
        macAddress: createForm.macAddress.trim() || undefined,
        customName: createForm.customName.trim() || undefined,
        location: createForm.location.trim() || undefined,
        description: createForm.description.trim() || undefined,
        productId: createForm.productId || undefined,
        defaultQuantity: Number(createForm.defaultQuantity) || 1,
        batteryLevel: Number(createForm.batteryLevel) || 100,
        expiresAt: createForm.expiresAt ? new Date(createForm.expiresAt).toISOString() : undefined,
        status: createForm.status || 'ACTIVE',
      };
      const res = await api.post('/devices', payload);
      if (res.data.success) {
        setShowCreateModal(false);
        await fetchData();
        if (res.data.data) {
          setQrModalDevice(res.data.data);
        }
      }
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Không thể tạo nút bấm mới');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenEditModal = (device: Device) => {
    const assignedProd = device.product || device.configuration?.product;
    setEditingDevice(device);
    setEditForm({
      customName: device.customName || '',
      productId: assignedProd?.id || device.productId || '',
      defaultQuantity: device.configuration?.defaultQuantity || 1,
      location: device.location || '',
      description: device.description || '',
      status: device.status || 'ACTIVE',
      batteryLevel: device.batteryLevel ?? 100,
      expiresAt: device.expiresAt ? new Date(device.expiresAt).toISOString().split('T')[0] : '',
    });
    setEditError(null);
    setEditMissingFields([]);
  };

  const handleEditDeviceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;
    setEditError(null);
    const missingFields = [
      !editForm.customName.trim() && 'customName',
      !editForm.status && 'status',
      !editForm.productId && 'productId',
      (!Number.isInteger(Number(editForm.defaultQuantity)) || Number(editForm.defaultQuantity) < 1) && 'defaultQuantity',
      !editForm.location.trim() && 'location',
      (String(editForm.batteryLevel).trim() === '' || Number(editForm.batteryLevel) < 0 || Number(editForm.batteryLevel) > 100) && 'batteryLevel',
      !editForm.expiresAt && 'expiresAt',
    ].filter(Boolean) as string[];

    if (missingFields.length > 0) {
      setEditMissingFields(missingFields);
      setEditError('Vui lòng nhập đầy đủ các trường bắt buộc được đánh dấu * trước khi lưu.');
      return;
    }

    setEditMissingFields([]);
    setEditLoading(true);
    try {
      const payload: any = {
        customName: editForm.customName.trim(),
        productId: editForm.productId || null,
        defaultQuantity: Number(editForm.defaultQuantity) || 1,
        quantity: Number(editForm.defaultQuantity) || 1,
        location: editForm.location?.trim() || undefined,
        description: editForm.description?.trim() || undefined,
        status: editForm.status,
        batteryLevel: Number(editForm.batteryLevel) || 100,
        expiresAt: editForm.expiresAt ? new Date(editForm.expiresAt).toISOString() : null,
      };
      const res = await api.patch(`/devices/${editingDevice.deviceId}`, payload);
      if (res.data.success) {
        toast.success('Đã lưu thay đổi thiết bị thành công!');
        setEditingDevice(null);
        await fetchData();
      }
    } catch (err: any) {
      const apiMsg = err.response?.data?.message;
      setEditError(
        Array.isArray(apiMsg)
          ? apiMsg.join(', ')
          : (typeof apiMsg === 'string' ? apiMsg : 'Không thể cập nhật thiết bị')
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteDeviceSubmit = async () => {
    if (!deletingDevice) return;
    setDeleteLoading(true);
    try {
      const res = await api.delete(`/devices/${deletingDevice.deviceId}`);
      if (res.data.success) {
        setDeletingDevice(null);
        await fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa thiết bị');
    } finally {
      setDeleteLoading(false);
    }
  };

  const fetchData = async (attempt = 0) => {
    const results = await Promise.allSettled([
        api.get('/devices'),
        api.get('/products'),
        api.get('/devices/fleet/stats'),
    ]);
    const [deviceResult, productResult, statsResult] = results;
    const failedRequests = results.filter((result) => result.status === 'rejected');

    if (deviceResult.status === 'fulfilled' && deviceResult.value.data?.success) {
      setDevices(deviceResult.value.data.data);
    }
    if (productResult.status === 'fulfilled' && productResult.value.data?.success) {
      setProducts(productResult.value.data.data);
    }
    if (statsResult.status === 'fulfilled' && statsResult.value.data?.success) {
      setFleetStats(statsResult.value.data.data);
    }

    if (failedRequests.length > 0) {
      setLoadError('Một phần dữ liệu hạm đội chưa tải được. Hệ thống sẽ tự thử lại.');
      if (attempt < 2) {
        window.setTimeout(() => void fetchData(attempt + 1), 1000 * (attempt + 1));
      }
    } else {
      setLoadError(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    if (user?.storeId) {
      subscribeToStore(user.storeId);
      const socket = getSocket();

      const handleHeartbeat = (data: any) => {
        setDevices((prev) =>
          prev.map((d) =>
            d.deviceId === data.deviceId
              ? {
                  ...d,
                  batteryLevel: data.batteryLevel,
                  wifiRSSI: data.wifiRSSI,
                  lastSeenAt: data.lastSeenAt,
                }
              : d
          )
        );
      };

      const handleRefresh = () => {
        fetchData();
      };

      const handleDevicesAllocated = (payload: any) => {
        if (user?.storeId && payload?.storeId && String(user.storeId) !== String(payload.storeId)) {
          return;
        }
        fetchData();
        toast.success(
          payload.message || `Cửa hàng vừa nhận bàn giao ${payload.allocatedCount || ''} nút bấm mới vào kho!`,
          { title: '📦 Kho nút bấm cập nhật 🎉', duration: 7000 }
        );
      };

      socket.on('DEVICE_HEARTBEAT', handleHeartbeat);
      socket.on('device:online', handleRefresh);
      socket.on('device:offline', handleRefresh);
      socket.on('device:product_changed', handleRefresh);
      socket.on('device:configured', handleRefresh);
      socket.on('device:deleted', handleRefresh);
      socket.on('DEVICES_ALLOCATED', handleDevicesAllocated);
      socket.on('devices:allocated', handleDevicesAllocated);

      return () => {
        socket.off('DEVICE_HEARTBEAT', handleHeartbeat);
        socket.off('device:online', handleRefresh);
        socket.off('device:offline', handleRefresh);
        socket.off('device:product_changed', handleRefresh);
        socket.off('device:configured', handleRefresh);
        socket.off('device:deleted', handleRefresh);
        socket.off('DEVICES_ALLOCATED', handleDevicesAllocated);
        socket.off('devices:allocated', handleDevicesAllocated);
      };
    }
  }, [user]);

  // Copy to clipboard
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Toggle Device Status
  const handleToggleStatus = async (device: Device) => {
    const isCurrentlyActive = device.status === 'ACTIVE';
    const endpoint = isCurrentlyActive
      ? `/devices/${device.deviceId}/disable`
      : `/devices/${device.deviceId}/enable`;

    try {
      const res = await api.post(endpoint);
      if (res.data.success) {
        setDevices((prev) =>
          prev.map((d) =>
            d.id === device.id
              ? { ...d, status: isCurrentlyActive ? 'DISABLED' : 'ACTIVE' }
              : d
          )
        );
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể thay đổi trạng thái');
    }
  };

  // Thao tác Pin (Store Manage)
  const handleUpdateBattery = async (deviceId: string, batteryLevel: number = 100) => {
    try {
      const res = await api.patch(`/devices/${deviceId}/battery`, { batteryLevel });
      if (res.data.success) {
        setDevices((prev) =>
          prev.map((d) => (d.deviceId === deviceId ? { ...d, batteryLevel } : d))
        );
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cập nhật pin');
    }
  };

  // Thao tác Thời hạn (Store Manage)
  const handleExtendWarranty = async (deviceId: string, months: number = 12) => {
    try {
      const res = await api.patch(`/devices/${deviceId}/extend-warranty`, { months });
      if (res.data.success) {
        await fetchData();
        toast.success(`Đã gia hạn thành công nút [${deviceId}] thêm ${months} tháng!`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể gia hạn');
    }
  };

  // Thao tác Mô phỏng bấm nút gửi server (Store Manage)
  const handleSimulatePress = async (deviceId: string) => {
    setSimulatingDeviceId(deviceId);
    try {
      const res = await api.post(`/devices/${deviceId}/simulate-press`, { eventType: 'DOUBLE_PRESS' });
      if (res.data.success) {
        setSimulationResult(res.data);
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Mô phỏng bấm nút thất bại');
    } finally {
      setSimulatingDeviceId(null);
    }
  };

  // Re-pair device
  const handleRepair = async (device: Device) => {
    if (!confirm(`Tạo lại mã ghép nối mới cho nút ${device.deviceId}?`)) return;
    try {
      const res = await api.post(`/devices/${device.deviceId}/re-pair`);
      if (res.data.success) {
        toast.success('Đã sinh mã QR và token ghép nối mới!');
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể tạo lại mã ghép nối');
    }
  };

  // Handle Quick Assign Product Submit
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningDevice || !selectedProductId) return;

    setAssignLoading(true);
    try {
      const res = await api.post(`/devices/${assigningDevice.deviceId}/assign-product`, {
        productId: selectedProductId,
        customName: assignCustomName || undefined,
      });
      if (res.data.success) {
        toast.success(`Đã gán sản phẩm cho nút [${assigningDevice.deviceId}] thành công!`);
        setAssigningDevice(null);
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể gán sản phẩm');
    } finally {
      setAssignLoading(false);
    }
  };

  // SmartSupply Behavior Designer Handlers
  const handleOpenBehaviorModal = (device: Device) => {
    setBehaviorDevice(device);
    setOpenGestureMenu(null);
    const cfg = device.configuration;
    setBehaviorForm({
      singlePressAction: cfg?.singlePressAction || 'ORDER_PRODUCT',
      doublePressAction: cfg?.doublePressAction || 'ADD_TO_SHOPPING_LIST',
      hold3sAction: cfg?.hold3sAction || 'REQUEST_SERVICE',
      hold5sAction: cfg?.hold5sAction || 'TRIGGER_EMERGENCY',
    });
  };

  const handleSaveBehavior = async () => {
    if (!behaviorDevice) return;
    setBehaviorSaving(true);
    try {
      const res = await api.put(`/devices/${behaviorDevice.deviceId}/behavior`, behaviorForm);
      if (res.data?.success) {
        toast.success(`Đã lưu hành vi cử chỉ nút [${behaviorDevice.deviceId}] thành công!`);
        setBehaviorDevice(null);
        await fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể lưu hành vi nút');
    } finally {
      setBehaviorSaving(false);
    }
  };

  // Tra cứu thiết bị theo mã 6 số hoặc QR code
  const handleStoreLookupCode = async (codeToSearch?: string) => {
    const code = (codeToSearch !== undefined ? codeToSearch : quickCodeInput).trim();
    if (!code) {
      setWizardError('Vui lòng nhập mã số hoặc quét mã QR');
      return;
    }
    setWizardLoading(true);
    setWizardError(null);
    try {
      const res = await api.post('/devices/lookup-code', { code });
      if (res.data.success && res.data.data) {
        const dev = res.data.data;
        setFoundDeviceForConfig(dev);
        setQuickConfigProductId(dev.productId || dev.configuration?.productId || '');
        setQuickConfigCustomName(dev.customName || `Nút ${dev.product?.name || 'Đặt Hàng'}`);
        setQuickConfigQuantity(dev.configuration?.defaultQuantity || 1);
        setQuickConfigLocation(dev.location || '');
        setStoreCameraActive(false);
        return;
      }
    } catch (err: any) {
      setWizardError(err.response?.data?.message || `Không tìm thấy thiết bị với mã "${code}".`);
    } finally {
      setWizardLoading(false);
    }
  };

  // Cấu hình / Gán sản phẩm cho thiết bị qua mã số mà không cần MAC
  const handleStoreConfigureByCode = async () => {
    if (!foundDeviceForConfig) return;
    if (!quickConfigProductId) {
      setWizardError('Vui lòng chọn một sản phẩm từ kho cửa hàng để gán cho nút');
      return;
    }
    setWizardLoading(true);
    setWizardError(null);
    try {
      const res = await api.post('/devices/configure-by-code', {
        code: foundDeviceForConfig.pairingCode || foundDeviceForConfig.deviceId,
        productId: quickConfigProductId,
        customName: quickConfigCustomName,
        defaultQuantity: quickConfigQuantity,
        location: quickConfigLocation,
      });
      if (res.data.success) {
        setShowWizard(false);
        setFoundDeviceForConfig(null);
        setQuickCodeInput('');
        fetchData();
        return;
      }
    } catch (err: any) {
      setWizardError(err.response?.data?.message || 'Không thể lưu cấu hình thiết bị');
    } finally {
      setWizardLoading(false);
    }
  };

  // Handle Setup Wizard Completion
  const handleWizardSubmit = async () => {
    setWizardLoading(true);
    setWizardError(null);

    try {
      // Step 1 & 2 & 3: Register / Pair device
      const payload: any = {
        deviceId: wizardForm.deviceId ? wizardForm.deviceId.trim().toUpperCase() : undefined,
        macAddress: wizardForm.macAddress ? wizardForm.macAddress.trim() : undefined,
        customName: wizardForm.customName ? wizardForm.customName.trim() : undefined,
        location: wizardForm.location ? wizardForm.location.trim() : undefined,
        description: wizardForm.description ? wizardForm.description.trim() : undefined,
        productId: wizardForm.productId || undefined,
        defaultQuantity: wizardForm.defaultQuantity || 1,
      };

      if (wizardForm.claimCode) payload.claimCode = wizardForm.claimCode.trim();
      if (wizardForm.pairingCode) payload.pairingCode = wizardForm.pairingCode.trim();

      const res = await api.post('/devices', payload);
      if (res.data.success) {
        setShowWizard(false);
        setWizardStep(1);
        setWizardForm({
          deviceId: '',
          claimCode: '',
          pairingCode: '',
          qrToken: '',
          macAddress: '',
          customName: '',
          location: '',
          description: '',
          productId: '',
          defaultQuantity: 1,
        });
        fetchData();
      }
    } catch (err: any) {
      setWizardError(err.response?.data?.message || 'Không thể hoàn tất thiết lập thiết bị');
    } finally {
      setWizardLoading(false);
    }
  };

  // Open Telemetry & Audit modal
  const handleInspect = async (device: Device) => {
    setInspectDevice(device);
    setInspectLoading(true);
    try {
      const [telRes, logRes] = await Promise.all([
        api.get(`/devices/${device.deviceId}/telemetry`),
        api.get(`/devices/${device.deviceId}/audit-logs`),
      ]);
      if (telRes.data.success) setTelemetries(telRes.data.data);
      if (logRes.data.success) setAuditLogs(logRes.data.data);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không tải được dữ liệu thiết bị.');
    } finally {
      setInspectLoading(false);
    }
  };

  // Bulk Import: Parse CSV
  const handleParseCsv = () => {
    setBulkErrors([]);
    setBulkSuccessMsg(null);

    const lines = csvText.trim().split('\n');
    if (lines.length <= 1) {
      setBulkErrors(['Tệp CSV không có dữ liệu để phân tích']);
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const parsedRows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(',').map((v) => v.trim());
      const row: any = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      parsedRows.push({
        deviceId: row.deviceid || row.id || '',
        serialNumber: row.serialnumber || '',
        macAddress: row.macaddress || row.mac || '',
        customName: row.customname || row.name || '',
        productSku: row.productsku || row.sku || '',
      });
    }

    setBulkPreview(parsedRows);
  };

  // Execute Bulk Import
  const handleExecuteBulk = async () => {
    setBulkLoading(true);
    setBulkErrors([]);
    try {
      const res = await api.post('/devices/bulk-import', { rows: bulkPreview });
      if (res.data.success) {
        setBulkSuccessMsg(res.data.message);
        fetchData();
      } else if (res.data.errors) {
        setBulkErrors(res.data.errors);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Nhập hàng loạt thất bại';
      setBulkErrors([msg]);
    } finally {
      setBulkLoading(false);
    }
  };

  // Filtered devices
  const filteredDevices = devices.filter((device) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      device.deviceId.toLowerCase().includes(q) ||
      (device.customName && device.customName.toLowerCase().includes(q)) ||
      (device.macAddress && device.macAddress.toLowerCase().includes(q)) ||
      (device.location && device.location.toLowerCase().includes(q));

    const matchesStatus =
      statusFilter === 'ALL' || device.status === statusFilter;

    const matchesProduct =
      productFilter === 'ALL' ||
      (device.productId && device.productId === productFilter) ||
      (device.product && device.product.id === productFilter);

    return matchesSearch && matchesStatus && matchesProduct;
  });

  return (
    <div className="w-full space-y-3.5 text-zinc-900 dark:text-zinc-100">
      {/* ── Command Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Quản Trị Hạm Đội Nút Bấm
            </h1>
            <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              FLEET-TELEMETRY
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            Cấu hình phần cứng ESP32, ánh xạ sản phẩm động & giám sát viễn trắc thời gian thực
          </p>
        </div>

        {/* Command Bar Actions */}
        <div className="flex items-center gap-1.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={handleOpenCreateModal}
            className="px-2.5 py-1 rounded-md bg-[#287DA8] hover:bg-[#206588] text-white text-xs font-semibold shadow-[0_2px_8px_rgba(40,125,168,0.25)] flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Thêm Thiết Bị</span>
          </motion.button>

          {/* Batch Tools Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowToolsDropdown(!showToolsDropdown);
              }}
              className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
              <span>Công Cụ</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            <AnimatePresence>
              {showToolsDropdown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  style={{ transformOrigin: 'top right' }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-1 w-52 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl py-1 z-40 text-xs text-zinc-700 dark:text-zinc-300 divide-y divide-zinc-100 dark:divide-zinc-800"
                >
                  <div className="py-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAirPodsModal(true);
                        setShowToolsDropdown(false);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                    >
                      <Bluetooth className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                      <span>Ghép Nối Nút (AirPods)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowWizard(true);
                        setWizardStep(1);
                        setWizardError(null);
                        setShowToolsDropdown(false);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                      <span>Wizard Cấu Hình 4 Bước</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowBulkModal(true);
                        handleParseCsv();
                        setShowToolsDropdown(false);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                      <span>Nhập CSV Hàng Loạt</span>
                    </button>
                  </div>

                  <div className="py-0.5">
                    <Link
                      to="/store/device-templates"
                      onClick={() => setShowToolsDropdown(false)}
                      className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                      <span>Mẫu Thiết Bị (Templates)</span>
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Sleek Horizontal Fleet Metrics Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 dark:divide-zinc-800 overflow-hidden">
        <div className="p-3 sm:px-4 sm:py-2.5 flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Tổng Thiết Bị
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {fleetStats.total}
            </span>
            <span className="text-[10.5px] font-mono text-zinc-400">nút</span>
          </div>
        </div>

        <div className="p-3 sm:px-4 sm:py-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Đang Online
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {fleetStats.online}
            </span>
            <span className="text-[10.5px] font-mono text-zinc-400">&lt;25s beat</span>
          </div>
        </div>

        <div className="p-3 sm:px-4 sm:py-2.5 flex flex-col justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Deep Sleep
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-zinc-700 dark:text-zinc-300">
              {fleetStats.offline}
            </span>
            <span className="text-[10.5px] font-mono text-zinc-400">&lt;15µA</span>
          </div>
        </div>

        <div className="p-3 sm:px-4 sm:py-2.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Cảnh Báo Pin
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                fleetStats.lowBattery > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`}
            ></span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`text-xl font-bold font-mono ${
                fleetStats.lowBattery > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {fleetStats.lowBattery}
            </span>
            <span className="text-[10.5px] font-mono text-zinc-400">&lt;20%</span>
          </div>
        </div>

        <div className="p-3 sm:px-4 sm:py-2.5 flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Chưa Gán SKU
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`text-xl font-bold font-mono ${
                fleetStats.unconfigured > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {fleetStats.unconfigured}
            </span>
            <span className="text-[10.5px] font-mono text-zinc-400">chờ gán</span>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Command Bar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Tìm theo Device ID, Tên, Vị trí..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1 text-xs rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400 transition-colors"
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

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Filter className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái ({devices.length})</option>
              <option value="ACTIVE">Hoạt động (ACTIVE)</option>
              <option value="DISABLED">Tạm ngưng (DISABLED)</option>
              <option value="UNCLAIMED">Chưa kích hoạt</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="text-xs px-2 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none max-w-xs truncate cursor-pointer"
            >
              <option value="ALL">Tất cả sản phẩm</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── High-Density Hardware Terminal Table ── */}
      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span>{loadError}</span>
          <button type="button" onClick={() => void fetchData()} className="font-semibold underline underline-offset-2">
            Thử lại ngay
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-x-auto lg:overflow-visible">
        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 animate-pulse inline-block"></span>
              Đang tải danh sách thiết bị viễn trắc...
            </div>
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Cpu className="w-7 h-7 text-zinc-200 dark:text-zinc-700 mx-auto" strokeWidth={1.5} />
            <p className="text-xs font-medium text-zinc-400">
              Không tìm thấy thiết bị nào khớp với bộ lọc
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                <th className="py-2 px-3.5 font-semibold">Thiết Bị (Hardware ID)</th>
                <th className="py-2 px-3.5 font-semibold">Trạng Thái</th>
                <th className="py-2 px-3.5 font-semibold">Sản Phẩm Ánh Xạ</th>
                <th className="py-2 px-3.5 font-semibold">Viễn Trắc (Telemetry)</th>
                <th className="py-2 px-3.5 font-semibold text-right">Thao Tác</th>
              </tr>
            </thead>
            <motion.tbody
              variants={tableContainerVariants}
              initial="hidden"
              animate="show"
              className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs"
            >
              {filteredDevices.map((device, index) => {
                const isOnline =
                  device.lastSeenAt &&
                  Date.now() - new Date(device.lastSeenAt).getTime() < 25000 &&
                  device.status === 'ACTIVE';

                const assignedProduct =
                  device.product || device.configuration?.product;

                const isNearBottom = index >= filteredDevices.length - 2 && filteredDevices.length > 2;

                return (
                  <motion.tr
                    key={device.id}
                    variants={tableRowVariants}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors group"
                  >
                    {/* Device ID & Name */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            device.status === 'ACTIVE'
                              ? isOnline
                                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse'
                                : 'bg-emerald-500/80'
                              : device.status === 'DISABLED'
                              ? 'bg-rose-500'
                              : 'bg-zinc-400'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-1.5 font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-none">
                            <span>{device.deviceId}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(device.deviceId, device.id)}
                              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                              title="Sao chép Device ID"
                            >
                              {copiedId === device.id ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 truncate max-w-[220px]">
                            {device.customName || 'Smart Order Button'}
                            {device.location ? ` · ${device.location}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status with Tiny Solid Dot */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            device.status === 'ACTIVE'
                              ? isOnline
                                ? 'bg-emerald-500'
                                : 'bg-emerald-500/80'
                              : device.status === 'DISABLED'
                              ? 'bg-rose-500'
                              : 'bg-zinc-400'
                          }`}
                        />
                        <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                          {device.status === 'ACTIVE'
                            ? isOnline
                              ? 'Trực tuyến'
                              : 'Sẵn sàng'
                            : device.status === 'DISABLED'
                            ? 'Tạm ngưng'
                            : 'Chưa kích hoạt'}
                        </span>
                      </div>
                    </td>

                    {/* Mapped SKU */}
                    <td className="py-2.5 px-3.5">
                      {assignedProduct ? (
                        <div>
                          <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]">
                            {assignedProduct.name}
                          </div>
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                            SKU: {assignedProduct.sku} · {device.configuration?.defaultQuantity || 1} {assignedProduct.unit || 'món'}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAssigningDevice(device);
                            setSelectedProductId('');
                            setAssignCustomName(device.customName || '');
                          }}
                          className="text-[11px] font-medium text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 inline-flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Gán SKU</span>
                        </button>
                      )}
                    </td>

                    {/* Horizontal Minimalist Telemetry */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-3.5 text-xs font-mono text-zinc-500 dark:text-zinc-400">
                        {/* Battery */}
                        <span className="flex items-center gap-1" title={`Dung lượng pin: ${device.batteryLevel}%`}>
                          <Battery className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={1.5} />
                          <span>{device.batteryLevel}%</span>
                        </span>

                        {/* Signal RSSI */}
                        <span className="flex items-center gap-1" title={`Cường độ Wi-Fi: ${device.wifiRSSI || -65} dBm`}>
                          <Wifi className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={1.5} />
                          <span>{device.wifiRSSI || -65} dBm</span>
                        </span>

                        {/* Expiry */}
                        <span className="flex items-center gap-1 text-[11px]" title={`Thời hạn: ${device.expiresAt ? new Date(device.expiresAt).toLocaleDateString('vi-VN') : '1 Năm'}`}>
                          <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" strokeWidth={1.5} />
                          <span>{device.expiresAt ? new Date(device.expiresAt).toLocaleDateString('vi-VN') : '1 Năm'}</span>
                        </span>
                      </div>
                    </td>

                    {/* Actions Architecture */}
                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Subtle Minimalist Primary Action (Test Ping) - reveals on row hover */}
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.94 }}
                          onClick={() => handleSimulatePress(device.deviceId)}
                          disabled={simulatingDeviceId === device.deviceId}
                          className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium flex items-center gap-1 shadow-2xs"
                          title="Mô phỏng bấm nút gửi tín hiệu đặt hàng"
                        >
                          {simulatingDeviceId === device.deviceId ? (
                            <RefreshCw className="w-3 h-3 animate-spin text-zinc-500" strokeWidth={1.5} />
                          ) : (
                            <Play className="w-3 h-3 text-zinc-500" strokeWidth={1.5} />
                          )}
                          <span>Test Ping</span>
                        </motion.button>

                        {/* Context Menu Dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === device.id ? null : device.id);
                            }}
                            className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors"
                            title="Thao tác"
                          >
                            <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
                          </button>

                          <AnimatePresence>
                            {openMenuId === device.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: isNearBottom ? 4 : -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: isNearBottom ? 4 : -4 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                style={{ transformOrigin: isNearBottom ? 'bottom right' : 'top right' }}
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute right-0 ${
                                  isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'
                                } w-48 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl py-1 z-30 text-xs text-zinc-700 dark:text-zinc-300 text-left divide-y divide-zinc-100 dark:divide-zinc-800`}
                              >
                              <div className="py-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleOpenEditModal(device);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                                  <span>Chỉnh sửa thông tin</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssigningDevice(device);
                                    setSelectedProductId(assignedProduct?.id || '');
                                    setAssignCustomName(device.customName || '');
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                                >
                                  <Tag className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                                  <span>Đổi SKU sản phẩm</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setQrModalDevice(device);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                                >
                                  <QrCode className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                                  <span>Xem & In Mã QR</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    handleInspect(device);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                                >
                                  <Activity className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                                  <span>Telemetry & Nhật ký</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    handleOpenBehaviorModal(device);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 active:scale-[0.98] transition-all cursor-pointer text-[#0E6BA8] dark:text-sky-400 font-medium"
                                >
                                  <Sliders className="w-3.5 h-3.5 text-[#0E6BA8] dark:text-sky-400" strokeWidth={1.5} />
                                  <span>Hành vi nút (Behavior)</span>
                                </button>
                              </div>

                              <div className="py-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleUpdateBattery(device.deviceId, 100);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                                >
                                  <Battery className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                                  <span>Sạc pin đầy 100%</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    handleExtendWarranty(device.deviceId, 12);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                                >
                                  <Clock className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                                  <span>Gia hạn (+1 năm)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    handleRepair(device);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                                  <span>Tái cấp Token ghép nối</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    handleToggleStatus(device);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                                >
                                  <Power className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
                                  <span>{device.status === 'ACTIVE' ? 'Tạm dừng nút' : 'Kích hoạt lại'}</span>
                                </button>
                              </div>

                              <div className="py-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeletingDevice(device);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                                  <span>Xóa thiết bị</span>
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </motion.tbody>
          </table>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. DEVICE SETUP & CONFIGURATION MODAL (CODE / QR / NEW)                   */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {showWizard && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain">
              <motion.div
                variants={modalBackdropVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
                onClick={() => {
                  setShowWizard(false);
                  setFoundDeviceForConfig(null);
                  setWizardError(null);
                  setStoreCameraActive(false);
                }}
              />
              <motion.div
                variants={modalDialogVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative z-10 bg-white dark:bg-[#0F172A] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto"
              >
                {/* Wizard Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Thêm & Cấu Hình Nút Bấm
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cấu hình thiết bị phần cứng qua Mã Số PIN hoặc Mã QR
                </p>
              </div>
              <button
                onClick={() => {
                  setShowWizard(false);
                  setFoundDeviceForConfig(null);
                  setWizardError(null);
                  setStoreCameraActive(false);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setWizardMode('PAIR_EXISTING');
                  setWizardError(null);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  wizardMode === 'PAIR_EXISTING'
                    ? 'bg-white dark:bg-slate-800 text-[#287DA8] shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Hash className="w-4 h-4" />
                <span>Cấu Hình Nút Có Sẵn (Mã 6 số / QR)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setWizardMode('CREATE_NEW');
                  setWizardError(null);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  wizardMode === 'CREATE_NEW'
                    ? 'bg-white dark:bg-slate-800 text-[#287DA8] shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Tạo Mới & Sinh Tem QR</span>
              </button>
            </div>

            {wizardError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{wizardError}</span>
              </div>
            )}

            {/* MODE 1: PAIR / CONFIGURE EXISTING DEVICE */}
            {wizardMode === 'PAIR_EXISTING' && (
              <div className="space-y-4">
                {!foundDeviceForConfig ? (
                  <div className="space-y-4">
                    <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
                      <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold">Quy trình ghép nối phía Cửa hàng:</span>
                        <p className="text-[11px] text-blue-700 dark:text-blue-300">
                          Chủ cửa hàng chỉ cần ghép mã nút & gán sản phẩm từ kho. <strong>Tuyệt đối không cần kết nối Wi-Fi cửa hàng</strong> — Người dùng khi đem nút về nhà sẽ tự bấm kết nối vào Wi-Fi gia đình của họ.
                        </p>
                      </div>
                    </div>

                    {!storeCameraActive ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Mã số PIN 6 số hoặc Mã Thiết Bị:
                          </label>
                          <input
                            type="text"
                            value={quickCodeInput}
                            onChange={(e) => {
                              setQuickCodeInput(e.target.value);
                              setWizardError(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleStoreLookupCode();
                            }}
                            placeholder="Ví dụ: 882910 hoặc BTN-8829-WTR"
                            className="w-full px-4 py-3 text-sm font-mono font-bold tracking-wider rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 font-medium"
                          />
                        </div>

                        {/* Quick pills */}
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
                          <span>Mã mẫu:</span>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickCodeInput('882910');
                              handleStoreLookupCode('882910');
                            }}
                            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 font-mono text-slate-700 dark:text-slate-300 font-semibold"
                          >
                            882910
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickCodeInput('BTN-8829-WTR');
                              handleStoreLookupCode('BTN-8829-WTR');
                            }}
                            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 font-mono text-slate-700 dark:text-slate-300 font-semibold"
                          >
                            BTN-8829-WTR
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickCodeInput('SOB-000001');
                              handleStoreLookupCode('SOB-000001');
                            }}
                            className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 font-mono text-slate-700 dark:text-slate-300 font-semibold"
                          >
                            SOB-000001
                          </button>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setStoreCameraActive(true)}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Camera className="w-4 h-4 text-[#287DA8]" />
                            <span>Quét Camera QR</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStoreLookupCode()}
                            disabled={wizardLoading || !quickCodeInput.trim()}
                            className="flex-1 py-2.5 rounded-xl bg-[#287DA8] hover:bg-[#206588] disabled:opacity-50 text-white font-bold text-xs shadow-[0_2px_8px_rgba(40,125,168,0.25)] flex items-center justify-center gap-2 cursor-pointer transition-all"
                          >
                            {wizardLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>TÌM THIẾT BỊ NÀY</span>}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <QrCameraScanner
                          onScanSuccess={(txt) => {
                            setQuickCodeInput(txt);
                            handleStoreLookupCode(txt);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setStoreCameraActive(false)}
                          className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          Chuyển về nhập mã số thủ công
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Device Found -> Map Product & Save */
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs space-y-1.5">
                      <div className="flex justify-between items-center font-bold text-emerald-700 dark:text-emerald-400">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          Đã tìm thấy thiết bị
                        </span>
                        <span className="font-mono">{foundDeviceForConfig.deviceId}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">
                        Mã PIN: <strong className="font-mono text-sky-600">{foundDeviceForConfig.pairingCode || 'Không có'}</strong> • Pin: {foundDeviceForConfig.batteryLevel ?? 95}% • Sóng: {foundDeviceForConfig.wifiRSSI ?? -55} dBm
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Sản phẩm gán cho nút này *
                      </label>
                      <select
                        value={quickConfigProductId}
                        onChange={(e) => setQuickConfigProductId(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-medium"
                      >
                        <option value="">-- Chọn sản phẩm trong kho cửa hàng --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {p.price.toLocaleString()} ₫ / {p.unit} (SKU: {p.sku})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Tên gọi thiết bị (Hiển thị cho khách hàng & quản lý):
                      </label>
                      <input
                        type="text"
                        value={quickConfigCustomName}
                        onChange={(e) => setQuickConfigCustomName(e.target.value)}
                        placeholder="VD: Nút Nước Lavie Bếp, Nút Gas..."
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Số lượng mỗi lần bấm:
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={quickConfigQuantity}
                          onChange={(e) => setQuickConfigQuantity(parseInt(e.target.value, 10) || 1)}
                          className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Vị trí (Tuỳ chọn):
                        </label>
                        <input
                          type="text"
                          value={quickConfigLocation}
                          onChange={(e) => setQuickConfigLocation(e.target.value)}
                          placeholder="VD: Bếp ăn, Phòng khách"
                          className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setFoundDeviceForConfig(null);
                          setWizardError(null);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                      >
                        Đổi mã khác
                      </button>
                      <button
                        type="button"
                        onClick={handleStoreConfigureByCode}
                        disabled={wizardLoading || !quickConfigProductId}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2"
                      >
                        {wizardLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>LƯU CẤU HÌNH CHO NÚT NÀY</span>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODE 2: CREATE NEW HARDWARE PROFILE FOR PRINTING STICKERS */}
            {wizardMode === 'CREATE_NEW' && (
              <div className="space-y-4">
                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Tên gợi nhớ cho nút bấm *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Nút Nước Lavie Bếp Ăn, Nút Gas Kho B..."
                        value={wizardForm.customName}
                        onChange={(e) => setWizardForm({ ...wizardForm, customName: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Sản phẩm gán đặt hàng mỗi lần bấm *
                      </label>
                      <select
                        value={wizardForm.productId}
                        onChange={(e) => setWizardForm({ ...wizardForm, productId: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-medium"
                      >
                        <option value="">-- Chọn sản phẩm trong kho cửa hàng --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {p.price.toLocaleString()} ₫ / {p.unit} (SKU: {p.sku})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Số lượng mỗi lần bấm
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={wizardForm.defaultQuantity}
                          onChange={(e) =>
                            setWizardForm({
                              ...wizardForm,
                              defaultQuantity: parseInt(e.target.value, 10) || 1,
                            })
                          }
                          className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Vị trí lắp đặt (Tùy chọn)
                        </label>
                        <input
                          type="text"
                          placeholder="VD: Bếp ăn, Phòng khách, Kho"
                          value={wizardForm.location}
                          onChange={(e) => setWizardForm({ ...wizardForm, location: e.target.value })}
                          className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* Collapsible Advanced Options */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setShowTechOptions(!showTechOptions)}
                        className="text-[11px] font-bold text-slate-500 hover:text-sky-600 flex items-center gap-1.5 transition-colors"
                      >
                        <span>{showTechOptions ? '▼ Thu gọn tùy chọn kỹ thuật' : '⚙️ Tùy chọn kỹ thuật nâng cao (Chỉ khi cần)'}</span>
                      </button>

                      {showTechOptions && (
                        <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Mã Device ID (Để trống hệ thống tự sinh SOB-XXXXXX)
                            </label>
                            <input
                              type="text"
                              placeholder="Tự động sinh (VD: SOB-000009)"
                              value={wizardForm.deviceId}
                              onChange={(e) =>
                                setWizardForm({ ...wizardForm, deviceId: e.target.value.toUpperCase() })
                              }
                              className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                Địa chỉ MAC (Tùy chọn)
                              </label>
                              <input
                                type="text"
                                placeholder="VD: 24:6F:28:AB:CD:01"
                                value={wizardForm.macAddress}
                                onChange={(e) =>
                                  setWizardForm({ ...wizardForm, macAddress: e.target.value.toUpperCase() })
                                }
                                className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                Mã Claim Code (In trên tem)
                              </label>
                              <input
                                type="text"
                                placeholder="Tự sinh (VD: CLAIM-749201)"
                                value={wizardForm.claimCode}
                                onChange={(e) =>
                                  setWizardForm({ ...wizardForm, claimCode: e.target.value.toUpperCase() })
                                }
                                className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (!wizardForm.customName) {
                            setWizardError('Vui lòng nhập tên cho nút bấm');
                            return;
                          }
                          setWizardError(null);
                          setWizardStep(2);
                        }}
                        className="px-5 py-2.5 text-xs font-bold rounded-xl bg-[#287DA8] hover:bg-[#206588] text-white shadow-[0_2px_8px_rgba(40,125,168,0.25)] flex items-center space-x-1.5 cursor-pointer transition-all"
                      >
                        <span>Tiếp tục xác nhận</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-slate-200/50 dark:border-slate-800">
                        <span className="text-slate-500">Tên Nút Bấm:</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {wizardForm.customName || 'Smart Order Button'}
                        </span>
                      </div>

                      <div className="flex justify-between py-1.5 border-b border-slate-200/50 dark:border-slate-800">
                        <span className="text-slate-500">Sản Phẩm Đặt:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {products.find((p) => p.id === wizardForm.productId)?.name || 'Chưa chọn'}
                        </span>
                      </div>

                      <div className="flex justify-between py-1.5 border-b border-slate-200/50 dark:border-slate-800">
                        <span className="text-slate-500">Mã Device ID:</span>
                        <span className="tabular-nums font-bold text-[#287DA8]">
                          {wizardForm.deviceId || '(Tự động sinh)'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setWizardStep(1)}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        Quay lại
                      </button>

                      <button
                        type="button"
                        disabled={wizardLoading}
                        onClick={handleWizardSubmit}
                        className="px-6 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center space-x-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{wizardLoading ? 'Đang tạo...' : 'HOÀN TẤT & SINH TEM QR'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )}

      {/* ========================================================================= */}
      {/* 2. QUICK ASSIGN / CHANGE PRODUCT MODAL                                    */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {assigningDevice && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain">
              <motion.div
                variants={modalBackdropVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer"
                onClick={() => setAssigningDevice(null)}
              />
              <motion.div
                variants={modalDialogVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative z-10 bg-white dark:bg-[#0F172A] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-4 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center space-x-2">
                <Tag className="w-5 h-5 text-[#287DA8]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Đổi Ánh Xạ Sản Phẩm / SKU
                </h3>
              </div>
              <button
                onClick={() => setAssigningDevice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Thiết bị: <strong className="tabular-nums font-bold text-[#287DA8]">{assigningDevice.deviceId}</strong> ({assigningDevice.customName || 'Không tên'}).
              Khi đổi sản phẩm, lần bấm tiếp theo sẽ đặt sản phẩm mới ngay tức thì.
            </p>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Chọn Sản Phẩm Mới Trong Kho *
                </label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 transition-all"
                >
                  <option value="">-- Chọn sản phẩm --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.price.toLocaleString()} ₫ ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên Gợi Nhớ Nút (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="VD: Nút Gas Bếp Chính"
                  value={assignCustomName}
                  onChange={(e) => setAssignCustomName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 transition-all"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssigningDevice(null)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={assignLoading}
                  className="rounded-lg bg-[#287DA8] hover:bg-[#206588] text-white px-5 py-2 text-sm font-semibold shadow-[0_2px_8px_rgba(40,125,168,0.25)] hover:shadow-[0_4px_12px_rgba(40,125,168,0.35)] transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  {assignLoading ? 'Đang lưu...' : 'Lưu Ánh Xạ Mới'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )}

      {/* ========================================================================= */}
      {/* 3. SECURE QR CODE PAIRING MODAL                                           */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {qrModalDevice && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain">
              <motion.div
                variants={modalBackdropVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer"
                onClick={() => setQrModalDevice(null)}
              />
              <motion.div
                variants={modalDialogVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative z-10 bg-white dark:bg-[#0F172A] rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-4 text-center max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-[#287DA8]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Tem QR Ghép Nối Thiết Bị
                </h3>
              </div>
              <button
                onClick={() => setQrModalDevice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Printable Sticker Preview (Section 9 Official Label Spec) */}
            <div className="p-5 rounded-2xl bg-white text-slate-900 border-2 border-slate-900 shadow-lg inline-block mx-auto w-64 text-center font-sans">
              <div className="text-xs font-black tracking-wider text-slate-900 mb-1 uppercase border-b pb-1.5 border-slate-200">
                SMART ORDER BUTTON
              </div>

              <div className="py-1 text-xs text-slate-600 font-medium">
                Device
                <p className="text-base tabular-nums font-black text-slate-950 tracking-tight">{qrModalDevice.deviceId}</p>
              </div>

              <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-inner inline-block my-1.5">
                <QRCodeSVG
                  value={qrModalDevice.qrPayload || `SOBPAIR://setup?device=${qrModalDevice.deviceId}&token=${qrModalDevice.pairingToken || 'DEMO'}&v=1`}
                  size={160}
                  level="H"
                />
              </div>

              <div className="space-y-0.5 mt-1">
                <p className="text-xs font-bold text-slate-900">Scan to Setup</p>
                <p className="text-[10px] text-slate-500 italic mt-1">Do not remove this label.</p>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Payload: <span className="tabular-nums text-[10px] break-all">{qrModalDevice.qrPayload}</span>
            </p>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-[#287DA8] hover:bg-[#206588] text-white text-xs font-semibold flex items-center space-x-1.5 shadow-[0_2px_8px_rgba(40,125,168,0.25)] hover:shadow-[0_4px_12px_rgba(40,125,168,0.35)] transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>In Tem Dán Hộp</span>
              </button>
              <button
                onClick={() => setQrModalDevice(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
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

      {/* ========================================================================= */}
      {/* 4. TELEMETRY & AUDIT LOGS MODAL                                           */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {inspectDevice && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain">
              <motion.div
                variants={modalBackdropVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer"
                onClick={() => setInspectDevice(null)}
              />
              <motion.div
                variants={modalDialogVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative z-10 bg-white dark:bg-[#0F172A] rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-4 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#287DA8]" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Thông Số Telemetry & Nhật Ký Kiểm Toán
                  </h3>
                </div>
                <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                  Device: {inspectDevice.deviceId} ({inspectDevice.customName || 'Smart Button'})
                </p>
              </div>
              <button
                onClick={() => setInspectDevice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/10 text-xs font-bold">
              <button
                onClick={() => setActiveTab('telemetry')}
                className={`pb-2.5 px-4 transition-colors cursor-pointer ${
                  activeTab === 'telemetry'
                    ? 'border-b-2 border-[#287DA8] text-[#287DA8]'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Lịch Sử Telemetry Phần Cứng ({telemetries.length})
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`pb-2.5 px-4 transition-colors cursor-pointer ${
                  activeTab === 'audit'
                    ? 'border-b-2 border-[#287DA8] text-[#287DA8]'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Nhật Ký Đổi Cấu Hình (Audit Logs) ({auditLogs.length})
              </button>
            </div>

            {/* Tab 1: Telemetry */}
            {activeTab === 'telemetry' && (
              <div className="max-h-72 overflow-y-auto space-y-2 tabular-nums text-xs">
                {telemetries.length === 0 ? (
                  <p className="text-slate-400 py-6 text-center">Chưa có bản tin telemetry nào được gửi.</p>
                ) : (
                  <table className="w-full text-left">
                    <thead className="text-[10px] uppercase text-slate-400 border-b border-slate-100 dark:border-white/5">
                      <tr>
                        <th className="py-2">Thời gian</th>
                        <th className="py-2">Pin %</th>
                        <th className="py-2">Điện áp</th>
                        <th className="py-2">Wi-Fi RSSI</th>
                        <th className="py-2">Boot Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {telemetries.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2 text-slate-500">
                            {new Date(t.createdAt).toLocaleTimeString('vi-VN')}
                          </td>
                          <td className="py-2 font-bold text-slate-900 dark:text-white">
                            {t.batteryLevel}%
                          </td>
                          <td className="py-2 text-slate-600 dark:text-slate-300">
                            {t.voltageMv} mV
                          </td>
                          <td className="py-2 text-[#287DA8] font-semibold">
                            {t.wifiRSSI} dBm
                          </td>
                          <td className="py-2 text-slate-500">{t.bootReason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab 2: Audit Logs */}
            {activeTab === 'audit' && (
              <div className="max-h-72 overflow-y-auto space-y-2 text-xs">
                {auditLogs.length === 0 ? (
                  <p className="text-slate-400 py-6 text-center">Chưa có nhật ký thay đổi cấu hình nào.</p>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200/60 dark:border-white/5 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="tabular-nums font-bold text-[#287DA8]">{log.action}</span>
                          <span className="text-slate-400 font-mono">
                            {new Date(log.createdAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        {log.oldValues && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 font-mono truncate">
                            Cũ: {log.oldValues}
                          </p>
                        )}
                        {log.newValues && (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono truncate">
                            Mới: {log.newValues}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-white/5">
              <button
                onClick={() => setInspectDevice(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
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

      {/* ========================================================================= */}
      {/* 5. BULK CSV IMPORT MODAL                                                  */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {showBulkModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain">
              <motion.div
                variants={modalBackdropVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-0 bg-slate-950/75 backdrop-blur-md cursor-pointer"
                onClick={() => setShowBulkModal(false)}
              />
              <motion.div
                variants={modalDialogVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative z-10 bg-white dark:bg-[#0F172A] rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-4 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Nhập Thiết Bị Hàng Loạt Qua CSV
                </h3>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Định dạng CSV hỗ trợ: <code className="text-[#287DA8] font-semibold tabular-nums">deviceId,serialNumber,macAddress,customName,productSku</code>.
              Hệ thống sẽ kiểm tra trùng Device ID, trùng MAC và gán SKU tự động.
            </p>

            <div>
              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full p-3 tabular-nums text-xs rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 transition-all"
              />
              <button
                type="button"
                onClick={handleParseCsv}
                className="mt-2 px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Search className="w-3.5 h-3.5 text-[#287DA8]" />
                <span>Phân Tích & Kiểm Tra Tính Hợp Lệ</span>
              </button>
            </div>

            {bulkErrors.length > 0 && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold space-y-1 max-h-32 overflow-y-auto">
                {bulkErrors.map((err, idx) => (
                  <p key={idx} className="flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>{err}</span>
                  </p>
                ))}
              </div>
            )}

            {bulkSuccessMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{bulkSuccessMsg}</span>
              </div>
            )}

            {bulkPreview.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Xem trước dữ liệu ({bulkPreview.length} dòng):
                </div>
                <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-white/10 rounded-xl">
                  <table className="w-full text-left text-[11px] tabular-nums">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 border-b border-slate-200 dark:border-white/10">
                      <tr>
                        <th className="p-2">Device ID</th>
                        <th className="p-2">MAC</th>
                        <th className="p-2">Tên</th>
                        <th className="p-2">Product SKU</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {bulkPreview.map((r, i) => (
                        <tr key={i}>
                          <td className="p-2 font-bold text-slate-900 dark:text-white">{r.deviceId}</td>
                          <td className="p-2 text-slate-500">{r.macAddress || '-'}</td>
                          <td className="p-2 text-slate-700 dark:text-slate-300">{r.customName || '-'}</td>
                          <td className="p-2 text-[#287DA8] font-semibold">{r.productSku || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={bulkLoading || bulkPreview.length === 0}
                onClick={handleExecuteBulk}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20"
              >
                {bulkLoading ? 'Đang nhập...' : `Xác Nhận Nhập ${bulkPreview.length} Nút Bấm`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )}
      {/* ========================================================================= */}
      {/* CRUD: 1. CREATE DEVICE MODAL                                              */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {showCreateModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain">
              <motion.div
                variants={modalBackdropVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
                onClick={() => setShowCreateModal(false)}
              />
              <motion.div
                variants={modalDialogVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative z-10 bg-white dark:bg-[#0F172A] rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Tạo Nút Bấm IoT Mới
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Thêm thiết bị Smart Order Button vào hạm đội của cửa hàng
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {createError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <form onSubmit={handleCreateDeviceSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Mã Thiết Bị (Device ID) *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={createForm.deviceId}
                          onChange={(e) =>
                            setCreateForm({ ...createForm, deviceId: e.target.value.toUpperCase() })
                          }
                          className="w-full pl-3 pr-9 py-2 text-xs tabular-nums font-bold rounded-lg bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 transition-all"
                          placeholder="SOB-000101"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCreateForm({ ...createForm, deviceId: generateRandomDeviceId() })
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#287DA8] dark:hover:text-[#287DA8] p-1 transition-colors cursor-pointer"
                          title="Sinh mã ngẫu nhiên"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Số Serial Phần Cứng *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={createForm.serialNumber}
                          onChange={(e) =>
                            setCreateForm({ ...createForm, serialNumber: e.target.value })
                          }
                          className="w-full pl-3 pr-9 py-2 text-xs tabular-nums rounded-lg bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 transition-all"
                          placeholder="ESP32-XXXX"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCreateForm({ ...createForm, serialNumber: generateRandomSerialNumber() })
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#287DA8] dark:hover:text-[#287DA8] p-1 transition-colors cursor-pointer"
                          title="Sinh serial ngẫu nhiên"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Tên Nút Bấm Hiển Thị *
                      </label>
                      <input
                        type="text"
                        required
                        value={createForm.customName}
                        onChange={(e) => setCreateForm({ ...createForm, customName: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 transition-all"
                        placeholder="VD: Nút Lavie Bếp B1"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Địa chỉ MAC (Tùy chọn)
                      </label>
                      <input
                        type="text"
                        value={createForm.macAddress}
                        onChange={(e) => setCreateForm({ ...createForm, macAddress: e.target.value })}
                        className="w-full px-3 py-2 text-xs tabular-nums rounded-lg bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 transition-all"
                        placeholder="24:6F:28:AB:CD:12"
                      />
                    </div>
                  </div>

                  {/* Product Mapping & Quantity (Flat layout, single divider) */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <Tag className="w-3.5 h-3.5 text-[#287DA8]" />
                      <span>Ánh Xạ Sản Phẩm Đặt Hàng Nhanh (1 Chạm)</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Sản phẩm được giao
                        </label>
                        <select
                          value={createForm.productId}
                          onChange={(e) => setCreateForm({ ...createForm, productId: e.target.value })}
                          className="w-full px-3 py-2 pr-10 truncate text-xs rounded-lg bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 transition-all"
                        >
                          <option value="">-- Chưa gán sản phẩm --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} - {p.price.toLocaleString()} ₫ ({p.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Số lượng mặc định
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={createForm.defaultQuantity}
                          onChange={(e) =>
                            setCreateForm({ ...createForm, defaultQuantity: Number(e.target.value) || 1 })
                          }
                          className="w-full px-3 py-2 text-xs tabular-nums font-bold rounded-lg bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 text-left transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Vị Trí Lắp Đặt
                      </label>
                      <input
                        type="text"
                        value={createForm.location}
                        onChange={(e) => setCreateForm({ ...createForm, location: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 transition-all"
                        placeholder="VD: Phòng Bếp Tầng 2"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Mô Tả / Ghi Chú
                      </label>
                      <input
                        type="text"
                        value={createForm.description}
                        onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 transition-all"
                        placeholder="Ghi chú thêm..."
                      />
                    </div>
                  </div>

                  {/* Status, Battery & Expiration Configuration (Flat layout, single divider) */}
                  <div className="grid grid-cols-3 gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Trạng Thái Ban Đầu
                      </label>
                      <select
                        value={createForm.status}
                        onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                        className="w-full px-3 py-2 pr-10 truncate text-xs font-semibold rounded-lg bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 transition-all"
                      >
                        <option value="ACTIVE">Đang hoạt động</option>
                        <option value="READY_FOR_CUSTOMER">Sẵn Sàng Giao Khách</option>
                        <option value="DISABLED">Tạm Dừng (DISABLED)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Dung Lượng Pin (%)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={createForm.batteryLevel}
                        onChange={(e) => setCreateForm({ ...createForm, batteryLevel: Number(e.target.value) })}
                        className="w-full px-3 py-2 text-xs tabular-nums font-bold rounded-lg bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 text-left transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Thời Hạn Sử Dụng
                      </label>
                      <input
                        type="date"
                        value={createForm.expiresAt}
                        onChange={(e) => setCreateForm({ ...createForm, expiresAt: e.target.value })}
                        className="w-full px-3 py-2 text-xs tabular-nums rounded-lg bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      Hủy Bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={createLoading}
                      className="rounded-lg bg-[#287DA8] hover:bg-[#206588] text-white px-5 py-2 text-sm font-semibold shadow-[0_2px_8px_rgba(40,125,168,0.25)] hover:shadow-[0_4px_12px_rgba(40,125,168,0.35)] transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center cursor-pointer"
                    >
                      {createLoading ? (
                        <span>Đang tạo nút...</span>
                      ) : (
                        <span>Xác Nhận Tạo Nút Bấm</span>
                      )}
                    </button>
                  </div>
                </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )}

      {/* ========================================================================= */}
      {/* CRUD: 2. EDIT DEVICE MODAL                                                */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {editingDevice && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain">
              <motion.div
                variants={modalBackdropVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
                onClick={() => setEditingDevice(null)}
              />
              <motion.div
                variants={modalDialogVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative z-10 bg-white dark:bg-[#0F172A] rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#287DA8]/10 text-[#287DA8] flex items-center justify-center border border-[#287DA8]/20">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Chỉnh Sửa Nút Bấm
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold tabular-nums">
                      {editingDevice.deviceId}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Cập nhật thông tin cấu hình và sản phẩm gán tức thời
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingDevice(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditDeviceSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tên Nút Bấm Hiển Thị *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.customName}
                    onChange={(e) => setEditForm({ ...editForm, customName: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-black/40 border text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${editMissingFields.includes('customName') ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-800 focus:border-[#287DA8] focus:ring-[#287DA8]/20'}`}
                    placeholder="VD: Nút Nước Bếp"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Trạng Thái Hoạt Động
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className={`w-full px-3 py-2 text-xs font-semibold rounded-lg bg-slate-50 dark:bg-black/40 border text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${editMissingFields.includes('status') ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-800 focus:border-[#287DA8] focus:ring-[#287DA8]/20'}`}
                  >
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="DISABLED">Tạm Dừng (DISABLED)</option>
                    <option value="UNCLAIMED">Chưa Kích Hoạt (UNCLAIMED)</option>
                  </select>
                </div>
              </div>

              {/* Product Mapping & Quantity */}
              <div className="p-3.5 rounded-2xl bg-[#287DA8]/5 dark:bg-[#287DA8]/10 border border-[#287DA8]/20 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#287DA8]">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Sản Phẩm Đang Ánh Xạ</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Chọn sản phẩm gán mới
                    </label>
                    <select
                      value={editForm.productId}
                      onChange={(e) => setEditForm({ ...editForm, productId: e.target.value })}
                      className={`w-full px-3 py-2 pr-10 truncate text-xs rounded-lg bg-white dark:bg-black/50 border text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${editMissingFields.includes('productId') ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-800 focus:border-[#287DA8] focus:ring-[#287DA8]/20'}`}
                    >
                      <option value="">-- Không gán sản phẩm --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} - {p.price.toLocaleString()} ₫ ({p.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Số lượng mặc định
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={editForm.defaultQuantity}
                      onChange={(e) =>
                        setEditForm({ ...editForm, defaultQuantity: Number(e.target.value) || 1 })
                      }
                      className={`w-full px-3 py-2 text-xs tabular-nums font-bold rounded-lg bg-white dark:bg-black/50 border text-slate-900 dark:text-white focus:outline-none focus:ring-2 text-center transition-all ${editMissingFields.includes('defaultQuantity') ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-800 focus:border-[#287DA8] focus:ring-[#287DA8]/20'}`}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vị Trí Lắp Đặt
                  </label>
                  <input
                    type="text"
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className={`w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-black/40 border text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${editMissingFields.includes('location') ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-800 focus:border-[#287DA8] focus:ring-[#287DA8]/20'}`}
                    placeholder="VD: Phòng Bếp Tầng 2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mô Tả / Ghi Chú
                  </label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/20 transition-all"
                    placeholder="Ghi chú..."
                  />
                </div>
              </div>

              {/* Battery & Expiration Configuration */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Dung Lượng Pin Hiện Tại (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editForm.batteryLevel}
                    onChange={(e) => setEditForm({ ...editForm, batteryLevel: Number(e.target.value) })}
                    className={`w-full px-3 py-2 text-xs tabular-nums font-bold rounded-lg bg-white dark:bg-black/50 border text-slate-900 dark:text-white focus:outline-none focus:ring-2 text-center transition-all ${editMissingFields.includes('batteryLevel') ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-800 focus:border-[#287DA8] focus:ring-[#287DA8]/20'}`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Thời Hạn Sử Dụng / Bảo Hành
                  </label>
                  <input
                    type="date"
                    value={editForm.expiresAt}
                    onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
                    className={`w-full px-3 py-2 text-xs tabular-nums rounded-lg bg-white dark:bg-black/50 border text-slate-900 dark:text-white focus:outline-none focus:ring-2 transition-all ${editMissingFields.includes('expiresAt') ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-200 dark:border-slate-800 focus:border-[#287DA8] focus:ring-[#287DA8]/20'}`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingDevice(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="rounded-lg bg-[#287DA8] hover:bg-[#206588] text-white px-5 py-2 text-sm font-semibold shadow-[0_2px_8px_rgba(40,125,168,0.25)] hover:shadow-[0_4px_12px_rgba(40,125,168,0.35)] transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center cursor-pointer"
                >
                  {editLoading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )}

      {/* ========================================================================= */}
      {/* CRUD: 3. DELETE DEVICE CONFIRMATION MODAL                                 */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {deletingDevice && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain">
              <motion.div
                variants={modalBackdropVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
                onClick={() => setDeletingDevice(null)}
              />
              <motion.div
                variants={modalDialogVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative z-10 bg-white dark:bg-[#0F172A] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-500/30 space-y-4 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center border border-rose-500/20 flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Xác Nhận Xóa Nút Bấm
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hành động này sẽ gỡ nút khỏi hệ thống cửa hàng
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/5 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Mã Thiết Bị:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {deletingDevice.deviceId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tên Hiển Thị:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {deletingDevice.customName || 'Chưa đặt tên'}
                </span>
              </div>
              {deletingDevice.location && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Vị Trí:</span>
                  <span className="text-slate-800 dark:text-slate-200">
                    {deletingDevice.location}
                  </span>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span><strong>Lưu ý:</strong> Lịch sử các đơn hàng trước đây từng đặt qua nút bấm này vẫn được bảo toàn 100% trong báo cáo doanh thu.</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingDevice(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleDeleteDeviceSubmit}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold shadow-md shadow-rose-500/25 flex items-center space-x-1.5"
              >
                {deleteLoading ? (
                  <span>Đang xóa...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Xác Nhận Xóa Vĩnh Viễn</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )}

      {/* ========================================================================= */}
      {/* SIMULATION RESULT MODAL (REAL-TIME ORDER CREATED VIA BUTTON EVENT)       */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {simulationResult && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain">
              <motion.div
                variants={modalBackdropVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
                onClick={() => setSimulationResult(null)}
              />
              <motion.div
                variants={modalDialogVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative z-10 bg-white dark:bg-[#0F172A] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-indigo-500/30 space-y-4 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20">
                  <Play className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Mô Phỏng Nhấn Nút Thành Công
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Sự kiện gửi qua server và tạo đơn tự động tức thì
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSimulationResult(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                <span>{simulationResult.message || 'Đơn hàng mới đã được khởi tạo!'}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-emerald-500/10">
                <span className="text-slate-500">Mã Đơn Hàng:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  #{simulationResult.order?.orderNumber || simulationResult.order?.id?.slice(0, 8)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sản Phẩm:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {simulationResult.order?.items?.[0]?.product?.name || 'Sản phẩm đã gán'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Số Lượng:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  x{simulationResult.order?.items?.[0]?.quantity || 1}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tổng Tiền:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {(simulationResult.order?.totalAmount || 0).toLocaleString()} ₫
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSimulationResult(null)}
                className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold shadow-md shadow-indigo-500/25"
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

      {/* ========================================================================= */}
      {/* SMARTSUPPLY BEHAVIOR DESIGNER MODAL                                      */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {behaviorDevice && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain">
              <motion.div
                variants={modalBackdropVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm cursor-pointer"
                onClick={() => !behaviorSaving && setBehaviorDevice(null)}
              />
              <motion.div
                variants={modalDialogVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative z-10 bg-white dark:bg-[#101014] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-5 max-h-[90vh] overflow-y-auto"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#0E6BA8]/10 text-[#0E6BA8] dark:text-sky-400 flex items-center justify-center border border-[#0E6BA8]/20">
                      <Sliders className="w-4 h-4 stroke-[2]" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Thiết Lập Hành Vi Cử Chỉ Nút
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        SmartSupply Designer · Mã nút: <span className="font-mono font-semibold text-slate-700 dark:text-zinc-300">{behaviorDevice.deviceId}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => !behaviorSaving && setBehaviorDevice(null)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Gesture Configuration Cards */}
                <div className="space-y-3">
                  {GESTURE_ITEMS.map((g) => {
                    const currentActionKey = behaviorForm[g.key] || g.defaultOption;
                    const currentAction = ACTION_DEFINITIONS[currentActionKey] || ACTION_DEFINITIONS.NONE;
                    const CurrentIcon = currentAction.icon;
                    const isMenuOpen = openGestureMenu === g.menuKey;

                    return (
                      <div
                        key={g.key}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isMenuOpen
                            ? 'border-[#0E6BA8]/50 bg-slate-50/80 dark:bg-zinc-900/60 shadow-xs'
                            : 'border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30'
                        }`}
                      >
                        {/* Gesture Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${g.badgeClass}`}>
                              <g.BadgeIcon className="w-3.5 h-3.5 stroke-[2.2]" />
                              <span className="text-[11px] font-bold font-mono">{g.badgeLabel}</span>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                                {g.title}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                                {g.subtitle}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Selector Trigger */}
                        <button
                          type="button"
                          onClick={() => setOpenGestureMenu(isMenuOpen ? null : g.menuKey)}
                          className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                            isMenuOpen
                              ? 'border-[#0E6BA8] ring-2 ring-[#0E6BA8]/20 bg-white dark:bg-zinc-900'
                              : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${currentAction.iconClass}`}>
                              <CurrentIcon className="w-3.5 h-3.5 stroke-[2.2]" />
                            </div>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-medium text-slate-900 dark:text-white truncate">
                                {currentAction.label}
                              </span>
                              {currentActionKey === g.defaultOption && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 shrink-0">
                                  Mặc định
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                              isMenuOpen ? 'rotate-180 text-[#0E6BA8]' : ''
                            }`}
                          />
                        </button>

                        {/* Expandable Options List */}
                        <AnimatePresence>
                          {isMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.18, ease: 'easeOut' }}
                              className="overflow-hidden pt-1.5"
                            >
                              <div className="p-1 rounded-xl bg-slate-100/70 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-700/60 space-y-1">
                                {g.options.map((optKey) => {
                                  const opt = ACTION_DEFINITIONS[optKey] || ACTION_DEFINITIONS.NONE;
                                  const OptIcon = opt.icon;
                                  const isSelected = currentActionKey === optKey;

                                  return (
                                    <button
                                      key={optKey}
                                      type="button"
                                      onClick={() => {
                                        setBehaviorForm({ ...behaviorForm, [g.key]: optKey });
                                        setOpenGestureMenu(null);
                                      }}
                                      className={`w-full flex items-center justify-between gap-2.5 p-2 rounded-lg text-left transition-all cursor-pointer ${
                                        isSelected
                                          ? 'bg-white dark:bg-zinc-900 shadow-xs border border-slate-200/80 dark:border-zinc-700'
                                          : 'hover:bg-white/60 dark:hover:bg-zinc-800/60'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 border ${opt.iconClass}`}>
                                          <OptIcon className="w-3.5 h-3.5 stroke-[2.2]" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span
                                              className={`text-xs truncate ${
                                                isSelected
                                                  ? 'font-semibold text-slate-900 dark:text-white'
                                                  : 'font-medium text-slate-700 dark:text-zinc-300'
                                              }`}
                                            >
                                              {opt.label}
                                            </span>
                                            {optKey === g.defaultOption && (
                                              <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-200/60 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 shrink-0">
                                                Mặc định
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                                            {opt.desc}
                                          </p>
                                        </div>
                                      </div>
                                      {isSelected && (
                                        <div className="w-4 h-4 rounded-full bg-[#0E6BA8] text-white flex items-center justify-center shrink-0">
                                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                                        </div>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
                  <button
                    type="button"
                    disabled={behaviorSaving}
                    onClick={() => setBehaviorDevice(null)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={behaviorSaving}
                    onClick={handleSaveBehavior}
                    className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-[#0E6BA8] hover:bg-[#0B5586] shadow-xs transition-all active:scale-[0.98] disabled:opacity-60 flex items-center gap-1.5 cursor-pointer"
                  >
                    {behaviorSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Lưu Cấu Hình Hành Vi</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Apple-Style AirPods White Device Pairing Modal */}
      <WhiteDeviceAirPodsModal
        isOpen={showAirPodsModal}
        onClose={() => setShowAirPodsModal(false)}
        onDeviceBound={() => fetchData()}
      />
    </div>
  );
};
