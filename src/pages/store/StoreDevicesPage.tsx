import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { QrCameraScanner } from '../../components/common/QrCameraScanner';
import { WhiteDeviceAirPodsModal } from '../../components/devices/WhiteDeviceAirPodsModal';

export const StoreDevicesPage: React.FC = () => {
  const { user } = useAuth();
  const [showAirPodsModal, setShowAirPodsModal] = useState(false);
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

  // Simulation test state
  const [simulatingDeviceId, setSimulatingDeviceId] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  // Delete Confirmation Modal State (CRUD: Delete)
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
  };

  const handleEditDeviceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const payload: any = {
        customName: editForm.customName.trim(),
        productId: editForm.productId || null,
        defaultQuantity: Number(editForm.defaultQuantity) || 1,
        location: editForm.location.trim(),
        description: editForm.description.trim(),
        status: editForm.status,
        batteryLevel: Number(editForm.batteryLevel) || 100,
        expiresAt: editForm.expiresAt ? new Date(editForm.expiresAt).toISOString() : null,
      };
      const res = await api.patch(`/devices/${editingDevice.deviceId}`, payload);
      if (res.data.success) {
        setEditingDevice(null);
        await fetchData();
      }
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Không thể cập nhật thiết bị');
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

  const fetchData = async () => {
    try {
      const [devRes, prodRes, statsRes] = await Promise.all([
        api.get('/devices'),
        api.get('/products'),
        api.get('/devices/fleet/stats'),
      ]);
      if (devRes.data.success) setDevices(devRes.data.data);
      if (prodRes.data.success) setProducts(prodRes.data.data);
      if (statsRes.data.success) setFleetStats(statsRes.data.data);
    } catch (e) {
      console.error('Failed to load store devices:', e);
    } finally {
      setLoading(false);
    }
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

      socket.on('DEVICE_HEARTBEAT', handleHeartbeat);
      socket.on('device:online', handleRefresh);
      socket.on('device:offline', handleRefresh);
      socket.on('device:product_changed', handleRefresh);
      socket.on('device:configured', handleRefresh);
      socket.on('device:deleted', handleRefresh);

      return () => {
        socket.off('DEVICE_HEARTBEAT', handleHeartbeat);
        socket.off('device:online', handleRefresh);
        socket.off('device:offline', handleRefresh);
        socket.off('device:product_changed', handleRefresh);
        socket.off('device:configured', handleRefresh);
        socket.off('device:deleted', handleRefresh);
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
        alert(`Đã gia hạn thành công nút [${deviceId}] thêm ${months} tháng!`);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể gia hạn');
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
      alert(err.response?.data?.message || 'Mô phỏng bấm nút thất bại');
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
        alert('Đã sinh mã QR và token ghép nối mới!');
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tạo lại mã ghép nối');
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
        setAssigningDevice(null);
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể gán sản phẩm');
    } finally {
      setAssignLoading(false);
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
    } catch (e) {
      console.error(e);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center border border-cyan-500/20 shadow-inner">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Quản Trị Hạm Đội Nút Bấm IoT
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                FLEET v2.0
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Cấu hình phần cứng ESP32, ánh xạ sản phẩm động không cần nạp firmware & theo dõi telemetry thời gian thực
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAirPodsModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/25 flex items-center space-x-2 transition-all btn-press"
          >
            <Bluetooth className="w-4 h-4 animate-pulse" />
            <span>Nút Trắng (AirPods Style)</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/25 flex items-center space-x-2 transition-all btn-press"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tạo Nút Bấm Mới</span>
          </button>

          <button
            onClick={() => {
              setShowWizard(true);
              setWizardStep(1);
              setWizardError(null);
            }}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200/80 dark:border-white/10 flex items-center space-x-2 transition-all"
          >
            <Sparkles className="w-4 h-4 text-cyan-500" />
            <span>Wizard Cấu Hình 4 Bước</span>
          </button>

          <button
            onClick={() => {
              setShowBulkModal(true);
              handleParseCsv();
            }}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200/80 dark:border-white/10 flex items-center space-x-2 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>Nhập CSV Hàng Loạt</span>
          </button>

          <Link
            to="/store/device-templates"
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200/80 dark:border-white/10 flex items-center space-x-2 transition-all"
          >
            <Layers className="w-4 h-4 text-indigo-500" />
            <span>Mẫu Thiết Bị (Templates)</span>
          </Link>
        </div>
      </div>

      {/* Fleet KPI Statistics Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
            Tổng Thiết Bị
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
              {fleetStats.total}
            </span>
            <span className="text-[11px] text-slate-400">nút toàn mạng</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-emerald-500/20 dark:border-emerald-500/30 bg-emerald-500/5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-mono">
              Đang Online
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
              {fleetStats.online}
            </span>
            <span className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70">&lt;25s heartbeat</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 shadow-sm">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">
            Chế Độ Deep Sleep
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold font-mono text-slate-700 dark:text-slate-300">
              {fleetStats.offline}
            </span>
            <span className="text-[11px] text-slate-400">&lt;15µA chờ ngắt</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-rose-500/20 dark:border-rose-500/30 bg-rose-500/5 shadow-sm">
          <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider font-mono">
            Cảnh Báo Pin Yếu
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400">
              {fleetStats.lowBattery}
            </span>
            <span className="text-[11px] text-rose-600/70 dark:text-rose-400/70">&lt; 20% LiPo</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-amber-500/20 dark:border-amber-500/30 bg-amber-500/5 shadow-sm col-span-2 md:col-span-1">
          <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider font-mono">
            Chưa Cấu Hình SKU
          </div>
          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl font-extrabold font-mono text-amber-600 dark:text-amber-400">
              {fleetStats.unconfigured}
            </span>
            <span className="text-[11px] text-amber-600/70 dark:text-amber-400/70">chờ gán sản phẩm</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo Device ID, Tên, Mã PIN 6 số, Vị trí..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="ALL">Tất cả ({devices.length})</option>
              <option value="ACTIVE">Hoạt Động (ACTIVE)</option>
              <option value="DISABLED">Đã Tắt (DISABLED)</option>
              <option value="UNCLAIMED">Chưa Kích Hoạt</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Sản phẩm:</span>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none max-w-xs truncate"
            >
              <option value="ALL">Tất cả sản phẩm</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          {/* Grid vs Table View Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/10 ml-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title="Dạng Lưới (Cards Grid)"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
              title="Dạng Bảng (Table View)"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Device Cards Grid or Table View */}
      {filteredDevices.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#0F172A] border border-dashed border-slate-200 dark:border-white/10 rounded-3xl">
          <Cpu className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Không tìm thấy thiết bị nào</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
            Thử thay đổi từ khóa tìm kiếm hoặc sử dụng nút <strong>+ Tạo Nút Bấm Mới</strong> để tạo nhanh nút bấm cho cửa hàng.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDevices.map((device) => {
            const isOnline =
              device.lastSeenAt &&
              Date.now() - new Date(device.lastSeenAt).getTime() < 25000 &&
              device.status === 'ACTIVE';

            const assignedProduct =
              device.product || device.configuration?.product;

            return (
              <div
                key={device.id}
                className="group relative flex flex-col justify-between p-5 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 hover:border-cyan-500/50 dark:hover:border-cyan-400/40 rounded-3xl shadow-sm hover:shadow-lg transition-all duration-200"
              >
                <div>
                  {/* Top Row: Device ID & Status Pill */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="relative flex items-center justify-center">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            isOnline
                              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse'
                              : 'bg-slate-400'
                          }`}
                        />
                      </div>
                      <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
                        {device.deviceId}
                      </span>
                      <button
                        onClick={() => handleCopy(device.deviceId, device.id)}
                        className="text-slate-400 hover:text-cyan-500 transition-colors"
                        title="Sao chép ID"
                      >
                        {copiedId === device.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        device.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : device.status === 'DISABLED'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
                      }`}
                    >
                      {device.status}
                    </span>
                  </div>

                  {/* Device Custom Name & Location */}
                  <div className="pt-3 pb-2 space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors">
                      {device.customName || 'Smart Order Button'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {device.location && (
                        <span className="flex items-center gap-1 font-medium">
                          <MapPin className="w-3 h-3 text-cyan-500" />
                          {device.location}
                        </span>
                      )}
                      {device.pairingCode ? (
                        <span className="font-mono text-[10px] bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 px-1.5 py-0.5 rounded font-bold">
                          PIN: {device.pairingCode}
                        </span>
                      ) : device.macAddress ? (
                        <span className="font-mono text-[10px] bg-slate-100 dark:bg-black/40 px-1.5 py-0.5 rounded text-slate-500">
                          MAC: {device.macAddress}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Hardware Telemetry Bar */}
                  <div className="my-3 p-2.5 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-100 dark:border-white/5 flex flex-col gap-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Battery
                          className={`w-4 h-4 ${
                            device.batteryLevel < 20
                              ? 'text-rose-500 animate-bounce'
                              : device.batteryLevel < 50
                              ? 'text-amber-500'
                              : 'text-emerald-500'
                          }`}
                        />
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {device.batteryLevel}%
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <Wifi
                          className={`w-4 h-4 ${
                            device.wifiRSSI > -65
                              ? 'text-emerald-500'
                              : device.wifiRSSI > -80
                              ? 'text-amber-500'
                              : 'text-rose-500'
                          }`}
                        />
                        <span className="text-slate-600 dark:text-slate-400">
                          {device.wifiRSSI} dBm
                        </span>
                      </div>

                      <div className="flex items-center space-x-1 text-[10px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>
                          {device.lastSeenAt
                            ? new Date(device.lastSeenAt).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Chưa thấy'}
                        </span>
                      </div>
                    </div>

                    {/* Expiration Bar */}
                    <div className="pt-1.5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Thời hạn dùng:</span>
                      <span className={`font-bold ${device.expiresAt && new Date(device.expiresAt) < new Date() ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                        {device.expiresAt ? new Date(device.expiresAt).toLocaleDateString('vi-VN') : '1 Năm (Mặc định)'}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Product Mapping Banner */}
                  <div className="mt-2 p-3 rounded-2xl bg-cyan-500/5 dark:bg-cyan-500/10 border border-cyan-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider font-mono">
                        <Tag className="w-3 h-3" />
                        <span>Sản Phẩm Đang Ánh Xạ:</span>
                      </div>
                      <button
                        onClick={() => {
                          setAssigningDevice(device);
                          setSelectedProductId(assignedProduct?.id || '');
                          setAssignCustomName(device.customName || '');
                        }}
                        className="text-[10px] font-bold text-cyan-600 dark:text-cyan-300 hover:underline flex items-center gap-0.5"
                      >
                        <span>Đổi SKU</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>

                    {assignedProduct ? (
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {assignedProduct.name}
                        </p>
                        <div className="flex items-center justify-between text-[11px] mt-0.5">
                          <span className="font-mono text-cyan-600 dark:text-cyan-400 text-[10px]">
                            SKU: {assignedProduct.sku}
                          </span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {assignedProduct.price?.toLocaleString()} ₫ / {assignedProduct.unit}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-1 text-center">
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                          ⚠️ Chưa gán sản phẩm đặt hàng
                        </p>
                        <button
                          onClick={() => {
                            setAssigningDevice(device);
                            setSelectedProductId('');
                            setAssignCustomName(device.customName || '');
                          }}
                          className="mt-1.5 px-3 py-1 text-[11px] font-bold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-sm"
                        >
                          + Gán Sản Phẩm Ngay
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Bottom Actions */}
                <div className="pt-4 mt-3 border-t border-slate-100 dark:border-white/5 flex flex-col gap-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => handleSimulatePress(device.deviceId)}
                      disabled={simulatingDeviceId === device.deviceId}
                      className="py-1.5 px-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-[10px] flex items-center justify-center gap-1 shadow-sm transition-all"
                      title="Mô phỏng thiết bị gửi tín hiệu đặt hàng lên server"
                    >
                      {simulatingDeviceId === device.deviceId ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Radio className="w-3 h-3 text-cyan-300" />
                      )}
                      <span>Test Bấm Nút</span>
                    </button>

                    <button
                      onClick={() => handleUpdateBattery(device.deviceId, 100)}
                      className="py-1.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
                      title="Sạc / Thay pin mới (Đặt lại 100%)"
                    >
                      <Battery className="w-3 h-3 text-emerald-500" />
                      <span>Sạc Pin</span>
                    </button>

                    <button
                      onClick={() => handleExtendWarranty(device.deviceId, 12)}
                      className="py-1.5 px-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/40 dark:hover:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
                      title="Gia hạn thời hạn sử dụng thêm 12 tháng"
                    >
                      <Clock className="w-3 h-3 text-cyan-500" />
                      <span>+1 Năm</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-50 dark:border-white/5">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEditModal(device)}
                        className="p-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 transition-colors"
                        title="Chỉnh sửa thông tin nút (Edit)"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setQrModalDevice(device)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                        title="Xem & In Mã QR Ghép Nối"
                      >
                        <QrCode className="w-3.5 h-3.5 text-indigo-500" />
                      </button>

                      <button
                        onClick={() => handleInspect(device)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                        title="Xem Telemetry & Nhật Ký Kiểm Toán"
                      >
                        <Activity className="w-3.5 h-3.5 text-emerald-500" />
                      </button>

                      <button
                        onClick={() => handleRepair(device)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                        title="Tạo Lại Token Ghép Nối (Re-pair)"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                      </button>

                      <button
                        onClick={() => setDeletingDevice(device)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors"
                        title="Xóa nút bấm (Delete)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleToggleStatus(device)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center space-x-1 transition-all ${
                        device.status === 'ACTIVE'
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                      }`}
                    >
                      <Power className="w-3 h-3" />
                      <span>{device.status === 'ACTIVE' ? 'Tạm Dừng' : 'Kích Hoạt'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Data Table View */
        <div className="overflow-hidden rounded-3xl bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-black/30 text-slate-500 dark:text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-200/80 dark:border-white/10">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Mã Nút & Tên</th>
                  <th className="py-3.5 px-4 font-bold">Trạng Thái</th>
                  <th className="py-3.5 px-4 font-bold">Sản Phẩm Gán</th>
                  <th className="py-3.5 px-4 font-bold">SL Đặt</th>
                  <th className="py-3.5 px-4 font-bold">Pin & Sóng</th>
                  <th className="py-3.5 px-4 font-bold">Thời Hạn</th>
                  <th className="py-3.5 px-4 font-bold">Vị Trí</th>
                  <th className="py-3.5 px-4 font-bold text-right">Thao Tác Quản Lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredDevices.map((device) => {
                  const isOnline =
                    device.lastSeenAt &&
                    Date.now() - new Date(device.lastSeenAt).getTime() < 25000 &&
                    device.status === 'ACTIVE';
                  const assignedProduct =
                    device.product || device.configuration?.product;

                  return (
                    <tr
                      key={device.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                              isOnline
                                ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] animate-pulse'
                                : 'bg-slate-400'
                            }`}
                          />
                          <div>
                            <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                              <span>{device.deviceId}</span>
                              <button
                                onClick={() => handleCopy(device.deviceId, device.id)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                title="Copy Mã"
                              >
                                {copiedId === device.id ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                              {device.customName || 'Chưa đặt tên'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                            device.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {device.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {assignedProduct ? (
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {assignedProduct.name}
                            </div>
                            <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono">
                              SKU: {assignedProduct.sku} • {assignedProduct.price?.toLocaleString()} ₫
                            </div>
                          </div>
                        ) : (
                          <span className="text-amber-500 text-[11px] font-semibold">
                            ⚠️ Chưa gán SKU
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {device.configuration?.defaultQuantity || 1} {assignedProduct?.unit || 'món'}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3 font-mono text-[11px]">
                          <span
                            className={`flex items-center gap-1 font-bold ${
                              device.batteryLevel < 20
                                ? 'text-rose-500'
                                : device.batteryLevel < 50
                                ? 'text-amber-500'
                                : 'text-emerald-500'
                            }`}
                          >
                            <Battery className="w-3.5 h-3.5" />
                            {device.batteryLevel}%
                          </span>
                          <span className="flex items-center gap-1 text-slate-500">
                            <Wifi className="w-3.5 h-3.5" />
                            {device.wifiRSSI} dBm
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {device.expiresAt ? (
                          <div className="font-mono text-[11px]">
                            <span
                              className={
                                new Date(device.expiresAt).getTime() < Date.now()
                                  ? 'text-rose-500 font-bold'
                                  : 'text-slate-600 dark:text-slate-400'
                              }
                            >
                              {new Date(device.expiresAt).toLocaleDateString('vi-VN')}
                            </span>
                            {new Date(device.expiresAt).getTime() < Date.now() && (
                              <div className="text-[9px] text-rose-500 font-bold uppercase">Hết hạn</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Vô thời hạn</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 text-[11px]">
                        {device.location || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSimulatePress(device.deviceId)}
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-colors"
                            title="Thử Nghiệm Nhấn Nút (Tạo đơn ngay)"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleUpdateBattery(device.deviceId, 100)}
                            className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors"
                            title="Sạc Đầy Pin (100%)"
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleExtendWarranty(device.deviceId, 12)}
                            className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 transition-colors"
                            title="Gia Hạn 12 Tháng (+1 Năm)"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(device)}
                            className="p-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 transition-colors"
                            title="Chỉnh sửa nút (Edit)"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setQrModalDevice(device)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-500 transition-colors"
                            title="Mã QR"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleInspect(device)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-500 transition-colors"
                            title="Telemetry & Nhật ký"
                          >
                            <Activity className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(device)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              device.status === 'ACTIVE'
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                            }`}
                            title={device.status === 'ACTIVE' ? 'Tạm Dừng' : 'Kích Hoạt'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingDevice(device)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors"
                            title="Xóa nút bấm (Delete)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
      {/* 1. DEVICE SETUP & CONFIGURATION MODAL (CODE / QR / NEW)                   */}
      {/* ========================================================================= */}
      {showWizard && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 space-y-5">
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
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  wizardMode === 'PAIR_EXISTING'
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
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
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  wizardMode === 'CREATE_NEW'
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
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
                            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5"
                          >
                            <Camera className="w-4 h-4 text-sky-500" />
                            <span>Quét Camera QR</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStoreLookupCode()}
                            disabled={wizardLoading || !quickCodeInput.trim()}
                            className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2"
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
                        className="px-5 py-2.5 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-sm flex items-center space-x-1.5"
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
                        <span className="font-mono font-bold text-sky-600">
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
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. QUICK ASSIGN / CHANGE PRODUCT MODAL                                    */}
      {/* ========================================================================= */}
      {assigningDevice && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center space-x-2">
                <Tag className="w-5 h-5 text-cyan-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Đổi Ánh Xạ Sản Phẩm / SKU
                </h3>
              </div>
              <button
                onClick={() => setAssigningDevice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Thiết bị: <strong className="font-mono text-cyan-500">{assigningDevice.deviceId}</strong> ({assigningDevice.customName || 'Không tên'}).
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
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
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
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssigningDevice(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={assignLoading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20"
                >
                  {assignLoading ? 'Đang lưu...' : 'Lưu Ánh Xạ Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SECURE QR CODE PAIRING MODAL                                           */}
      {/* ========================================================================= */}
      {qrModalDevice && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200 space-y-4 text-center">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-cyan-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Tem QR Ghép Nối Thiết Bị
                </h3>
              </div>
              <button
                onClick={() => setQrModalDevice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
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
                <p className="text-base font-mono font-black text-slate-950 tracking-tight">{qrModalDevice.deviceId}</p>
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
              Payload: <span className="font-mono text-[10px] break-all">{qrModalDevice.qrPayload}</span>
            </p>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-cyan-500/20"
              >
                <Printer className="w-4 h-4" />
                <span>In Tem Dán Hộp</span>
              </button>
              <button
                onClick={() => setQrModalDevice(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TELEMETRY & AUDIT LOGS MODAL                                           */}
      {/* ========================================================================= */}
      {inspectDevice && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-500" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Thông Số Telemetry & Nhật Ký Kiểm Toán
                  </h3>
                </div>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                  Device: {inspectDevice.deviceId} ({inspectDevice.customName || 'Smart Button'})
                </p>
              </div>
              <button
                onClick={() => setInspectDevice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/10 text-xs font-bold">
              <button
                onClick={() => setActiveTab('telemetry')}
                className={`pb-2.5 px-4 transition-colors ${
                  activeTab === 'telemetry'
                    ? 'border-b-2 border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'text-slate-500'
                }`}
              >
                Lịch Sử Telemetry Phần Cứng ({telemetries.length})
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`pb-2.5 px-4 transition-colors ${
                  activeTab === 'audit'
                    ? 'border-b-2 border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'text-slate-500'
                }`}
              >
                Nhật Ký Đổi Cấu Hình (Audit Logs) ({auditLogs.length})
              </button>
            </div>

            {/* Tab 1: Telemetry */}
            {activeTab === 'telemetry' && (
              <div className="max-h-72 overflow-y-auto space-y-2 font-mono text-xs">
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
                          <td className="py-2 text-cyan-600 dark:text-cyan-400">
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
                          <span className="font-mono font-bold text-cyan-500">{log.action}</span>
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
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. BULK CSV IMPORT MODAL                                                  */}
      {/* ========================================================================= */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200 space-y-4">
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
              Định dạng CSV hỗ trợ: <code className="text-cyan-500 font-mono">deviceId,serialNumber,macAddress,customName,productSku</code>.
              Hệ thống sẽ kiểm tra trùng Device ID, trùng MAC và gán SKU tự động.
            </p>

            <div>
              <textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full p-3 font-mono text-xs rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              />
              <button
                type="button"
                onClick={handleParseCsv}
                className="mt-2 px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400" />
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
                  <table className="w-full text-left text-[11px] font-mono">
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
                          <td className="p-2 text-cyan-600 dark:text-cyan-400">{r.productSku || '-'}</td>
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
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* CRUD: 1. CREATE DEVICE MODAL                                              */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center border border-cyan-500/20">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Tạo Nút Bấm IoT Mới
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Thêm thiết bị Smart Order Button vào hạm đội của cửa hàng
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
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
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={createForm.deviceId}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, deviceId: e.target.value.toUpperCase() })
                      }
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                      placeholder="SOB-000101"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setCreateForm({ ...createForm, deviceId: generateRandomDeviceId() })
                      }
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
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
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={createForm.serialNumber}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, serialNumber: e.target.value })
                      }
                      className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                      placeholder="ESP32-XXXX"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setCreateForm({ ...createForm, serialNumber: generateRandomSerialNumber() })
                      }
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500"
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
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
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
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                    placeholder="24:6F:28:AB:CD:12"
                  />
                </div>
              </div>

              {/* Product Mapping & Quantity */}
              <div className="p-3.5 rounded-2xl bg-cyan-500/5 dark:bg-cyan-500/10 border border-cyan-500/20 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400">
                  <Tag className="w-3.5 h-3.5" />
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
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
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
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-center"
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
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
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
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                    placeholder="Ghi chú thêm..."
                  />
                </div>
              </div>

              {/* Status, Battery & Expiration Configuration */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Trạng Thái Ban Đầu
                  </label>
                  <select
                    value={createForm.status}
                    onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  >
                    <option value="ACTIVE">Hoạt Động (ACTIVE)</option>
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
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-center"
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
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/25 flex items-center space-x-1.5"
                >
                  {createLoading ? (
                    <span>Đang tạo nút...</span>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Xác Nhận Tạo Nút Bấm</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CRUD: 2. EDIT DEVICE MODAL                                                */}
      {/* ========================================================================= */}
      {editingDevice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center border border-cyan-500/20">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Chỉnh Sửa Nút Bấm
                    </h2>
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
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
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
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
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
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
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  >
                    <option value="ACTIVE">Hoạt Động (ACTIVE)</option>
                    <option value="DISABLED">Tạm Dừng (DISABLED)</option>
                    <option value="UNCLAIMED">Chưa Kích Hoạt (UNCLAIMED)</option>
                  </select>
                </div>
              </div>

              {/* Product Mapping & Quantity */}
              <div className="p-3.5 rounded-2xl bg-cyan-500/5 dark:bg-cyan-500/10 border border-cyan-500/20 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400">
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
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
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
                      className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-center"
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
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
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
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
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
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 text-center"
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
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingDevice(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md shadow-cyan-500/25 flex items-center space-x-1.5"
                >
                  {editLoading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CRUD: 3. DELETE DEVICE CONFIRMATION MODAL                                 */}
      {/* ========================================================================= */}
      {deletingDevice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-500/30 animate-in fade-in zoom-in-95 duration-150 space-y-4">
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
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SIMULATION RESULT MODAL (REAL-TIME ORDER CREATED VIA BUTTON EVENT)       */}
      {/* ========================================================================= */}
      {simulationResult && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-indigo-500/30 animate-in fade-in zoom-in-95 duration-150 space-y-4">
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
          </div>
        </div>
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
