import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/OrderSoundContext';
import { subscribeToCustomer, getSocket } from '../../services/socket';
import { Device, Order, Product } from '../../types';
import { Radio, ShoppingBag, Clock, CheckCircle2, AlertCircle, X, ChevronRight, MapPin, Truck, RefreshCw, Battery, Wifi, Zap, Sparkles, Plus, Share2, QrCode, WifiOff, Key, Camera, Hash, Check, Lightbulb, Bluetooth, Sliders, Power, Edit3, Settings, ChevronDown, RotateCcw, Store } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Floating3DCard } from '../../components/3d/Floating3DCard';
import { WebBluetoothProvisioner } from '../../components/devices/WebBluetoothProvisioner';
import { WhiteDeviceAirPodsModal } from '../../components/devices/WhiteDeviceAirPodsModal';
import { OrderSuccessModal } from '../../components/orders/OrderSuccessModal';
import { CustomerStoreSelectorModal, StoreItem, MOCK_STORES } from '../../components/customer/CustomerStoreSelectorModal';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';


// ─────────────────────────────────────────────
// DeviceCardUI — Apple Home style card
// ─────────────────────────────────────────────
interface DeviceCardUIProps {
  dev: Device;
  productImg: string;
  name: string;
  productDesc?: string;
  priceStr: string | null;
  isOnline: boolean;
  battery: number;
  rssi: number;
  isPressing: boolean;
  simulatingId: string | null;
  onOrder: (id: string) => void;
  onSimulate: (id: string) => void;
  onConfigOpen: (dev: Device) => void;
  onWifiOpen: (dev: Device) => void;
}

const DeviceCardUI: React.FC<DeviceCardUIProps> = ({
  dev, productImg, name, productDesc, priceStr, isOnline, battery, rssi,
  isPressing, simulatingId, onOrder, onSimulate, onConfigOpen, onWifiOpen,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const cfg = dev.configuration;

  return (
    <motion.div
      layout
      whileHover={{ scale: 1.012, y: -3 }}
      whileTap={{ scale: 0.988 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`relative bg-white rounded-3xl overflow-hidden shadow-xs border transition-all ${
        isPressing
          ? 'border-amber-300 shadow-amber-100 shadow-lg ring-2 ring-amber-200'
          : 'border-zinc-200/80 hover:shadow-md hover:border-zinc-300'
      }`}
      style={{ willChange: 'transform' }}
    >
      {/* Product Image on soft bg-zinc-50 */}
      <div className="relative h-36 bg-zinc-50 flex items-center justify-center overflow-hidden">
        <img
          src={productImg}
          alt={name}
          className="h-full w-full object-contain p-4 mix-blend-multiply transition-transform duration-300 hover:scale-105"
          onError={(e) => { (e.target as HTMLImageElement).src = '/assets/products/vinhhao.png'; }}
        />
        <AnimatePresence>
          {isPressing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-amber-400/20 flex items-center justify-center backdrop-blur-xs"
            >
              <Radio className="w-8 h-8 text-amber-600 animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtle Gear/Settings Icon in Top Right Corner */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center shadow-xs border transition-all z-10 ${
            expanded
              ? 'bg-zinc-900 border-zinc-900 text-white'
              : 'bg-white/90 backdrop-blur-sm border-zinc-200/80 text-zinc-400 hover:text-zinc-700 hover:border-zinc-300'
          }`}
          title={expanded ? 'Đóng cài đặt' : 'Cài đặt thiết bị'}
        >
          <Settings className="w-3.5 h-3.5" />
        </motion.button>
      </div>

      {/* Info & Primary Action */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 truncate">{name}</h3>
            <p className="text-xs text-zinc-400 mt-0.5 truncate">
              {productDesc || cfg?.product?.name || 'Nút bấm thông minh 1 chạm'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            <span
              className={`w-2 h-2 rounded-full ${
                dev.status === 'DISABLED'
                  ? 'bg-rose-400'
                  : isOnline
                  ? 'bg-emerald-500'
                  : 'bg-zinc-300'
              }`}
              title={dev.status === 'DISABLED' ? 'Đã tắt' : isOnline ? 'Online' : 'Offline'}
            />
            <span className="text-xs font-medium text-zinc-500 tabular-nums">{battery}%</span>
          </div>
        </div>

        {/* Single Primary Action Button: "Đặt ngay — [Price]" */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onOrder(dev.deviceId)}
          className="w-full py-2.5 rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-150 ease-out active:scale-[0.97] hover:shadow-md cursor-pointer shadow-xs"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span className="tabular-nums">{priceStr ? `Đặt ngay — ${priceStr}` : 'Đặt ngay'}</span>
        </motion.button>

        {/* Expandable Settings Drawer */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="drawer"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-zinc-100 space-y-2.5">
                {/* Telemetry row */}
                <div className="flex items-center justify-between text-[11px] text-zinc-400 tabular-nums px-0.5">
                  <span className="flex items-center gap-1">
                    <Wifi className="w-3 h-3 text-zinc-400" />
                    {rssi} dBm
                  </span>
                  <span className="truncate max-w-[85px] text-zinc-400" title={dev.deviceId}>
                    {dev.deviceId}
                  </span>
                  <span className="flex items-center gap-1 text-zinc-400">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    {cfg?.cancelWindowSeconds ?? 60}s
                  </span>
                </div>

                {/* Gesture guide as minimalist outline tags */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full border border-zinc-200/90 bg-zinc-50/70 text-[10px] text-zinc-500 font-medium">
                    1 chạm: Bật
                  </span>
                  <span className="px-2 py-0.5 rounded-full border border-zinc-200/90 bg-zinc-50/70 text-[10px] text-zinc-500 font-medium">
                    2 chạm: Đặt
                  </span>
                  <span className="px-2 py-0.5 rounded-full border border-zinc-200/90 bg-zinc-50/70 text-[10px] text-zinc-500 font-medium">
                    Giữ 5s: Wi-Fi
                  </span>
                </div>

                {/* Technical actions styled as minimalist outline tags */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => onSimulate(dev.deviceId)}
                    disabled={simulatingId === dev.deviceId}
                    className="flex-1 px-2.5 py-1.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 text-zinc-600 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                  >
                    <Radio className={`w-3 h-3 text-zinc-400 ${simulatingId === dev.deviceId ? 'animate-spin' : ''}`} />
                    <span>Thử nút</span>
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    whileHover={{ scale: 1.03, y: -1 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                    type="button"
                    onClick={() => onConfigOpen(dev)}
                    className="flex-1 px-2.5 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 hover:border-[#0E6BA8]/50 hover:text-[#0E6BA8] text-zinc-600 dark:text-zinc-300 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs group"
                  >
                    <Sliders className="w-3 h-3 text-zinc-400 group-hover:text-[#0E6BA8] transition-colors" />
                    <span>Cấu hình</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    whileHover={{ scale: 1.03, y: -1 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                    type="button"
                    onClick={() => onWifiOpen(dev)}
                    className="flex-1 px-2.5 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 hover:border-[#0E6BA8]/50 hover:text-[#0E6BA8] text-zinc-600 dark:text-zinc-300 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs group"
                  >
                    <Wifi className="w-3 h-3 text-zinc-400 group-hover:text-[#0E6BA8] transition-colors" />
                    <span>Wi-Fi</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export const CustomerHomePage: React.FC = () => {
  const { user } = useAuth();
  const { playOrderChime, playCancelChime } = useSound();
  const [devices, setDevices] = useState<Device[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAirPodsModal, setShowAirPodsModal] = useState(false);

  // Store Selector Modal (GPS Radius & Store Code)
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [selectedStore, setSelectedStore] = useState<StoreItem | null>(() => {
    try {
      const cached = localStorage.getItem('smart_order_customer_store');
      if (cached) return JSON.parse(cached);
    } catch {}
    return MOCK_STORES[0]; // LeBao Store by default
  });

  // Device Onboarding (Code / QR) Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState(1);
  const [addTab, setAddTab] = useState<'CODE' | 'QR_SCAN'>('CODE');
  const [deviceCodeInput, setDeviceCodeInput] = useState('');
  const [customDeviceName, setCustomDeviceName] = useState('');
  const [foundDevice, setFoundDevice] = useState<any | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [addQrInput, setAddQrInput] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Device Transfer & Change Wi-Fi Modals
  const [transferringDevice, setTransferringDevice] = useState<Device | null>(null);
  const [transferResult, setTransferResult] = useState<any | null>(null);
  const [changeWifiDevice, setChangeWifiDevice] = useState<Device | null>(null);
  const [showWifiWebModal, setShowWifiWebModal] = useState<boolean>(false);
  const [wifiSsidInput, setWifiSsidInput] = useState('Home_WiFi_2.4G');
  const [wifiPasswordInput, setWifiPasswordInput] = useState('');
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [wifiUpdating, setWifiUpdating] = useState(false);
  const [wifiSuccessMsg, setWifiSuccessMsg] = useState<string | null>(null);
  const [wifiErrorMsg, setWifiErrorMsg] = useState<string | null>(null);
  const [wifiPanelTab, setWifiPanelTab] = useState<'BLE' | 'USB' | 'SELECT'>('BLE');
  const [connectedBleDevice, setConnectedBleDevice] = useState<any>(null);
  const [bleGattServer, setBleGattServer] = useState<any>(null);
  const [isBleScanning, setIsBleScanning] = useState(false);
  const [wifiSelectedDevId, setWifiSelectedDevId] = useState<string>('');
  const [wifiCodeInput, setWifiCodeInput] = useState<string>('');
  const [wifiLookupLoading, setWifiLookupLoading] = useState<boolean>(false);
  const [wifiLookupError, setWifiLookupError] = useState<string | null>(null);
  const [wifiLookupFoundDev, setWifiLookupFoundDev] = useState<any | null>(null);

  // Active Cancel Countdown & Success Modal state
  const [activeCancelOrder, setActiveCancelOrder] = useState<Order | null>(null);
  const [activeSuccessOrder, setActiveSuccessOrder] = useState<Order | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);

  // Realtime button press & alerts state
  const [isPressing, setIsPressing] = useState<boolean>(false);
  const [pressingDeviceId, setPressingDeviceId] = useState<string | null>(null);
  const [cancelToast, setCancelToast] = useState<string | null>(null);
  const [throttledNotice, setThrottledNotice] = useState<string | null>(null);

  // Customer Self-Config Modal state
  const [configModalDevice, setConfigModalDevice] = useState<Device | null>(null);
  const [configCustomName, setConfigCustomName] = useState('');
  const [configProductId, setConfigProductId] = useState('');
  const [configQuantity, setConfigQuantity] = useState(1);
  const [configStatus, setConfigStatus] = useState<'ACTIVE' | 'DISABLED'>('ACTIVE');
  const [configLoading, setConfigLoading] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

  // Lock background body scroll whenever any inline modal is open
  const isAnyInlineModalOpen = Boolean(
    configModalDevice ||
    changeWifiDevice ||
    showWifiWebModal ||
    transferringDevice ||
    showAddModal
  );
  useBodyScrollLock(isAnyInlineModalOpen);

  const fetchData = async () => {
    try {
      const [devRes, ordRes, prodRes] = await Promise.all([
        api.get('/devices'),
        api.get('/orders'),
        api.get('/products').catch(() => ({ data: { success: false, data: [] } })),
      ]);
      if (devRes.data.success) setDevices(devRes.data.data);
      if (ordRes.data.success) setOrders(ordRes.data.data);
      if (prodRes.data?.success) setAvailableProducts(prodRes.data.data);
    } catch (e) {
      console.error('Failed to load customer data:', e);
    } finally {
      setLoading(false);
    }
  };

  const customerId = user?.customerProfileId || (user as any)?.customerProfile?.id;

  useEffect(() => {
    fetchData();

    if (customerId) {
      subscribeToCustomer(customerId);
    }
    if (user?.id && user.id !== customerId) {
      subscribeToCustomer(user.id);
    }

    const socket = getSocket();

    const handleOrderCreated = (data: any) => {
      console.log('⚡ [Customer Push Alert] Order Created:', data);
      // Keep visual feedback active on the button card for 2.5s
      setIsPressing(true);
      if (data.order?.deviceId || data.deviceId) {
        setPressingDeviceId(data.order?.deviceId || data.deviceId);
      }
      setTimeout(() => {
        setIsPressing(false);
        setPressingDeviceId(null);
      }, 2500);

      playOrderChime();
      fetchData();

      if (data.order) {
        setActiveSuccessOrder(data.order);
        setActiveCancelOrder(data.order);
        setShowSuccessModal(true);
        setSecondsRemaining(data.cancelWindowSeconds || 60);
      }
    };

    const handleOrderUpdated = () => {
      fetchData();
    };

    const handleDeviceHeartbeat = (data: any) => {
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

    const handleButtonPressing = (data: any) => {
      setIsPressing(true);
      setPressingDeviceId(data.deviceId);
      setTimeout(() => {
        setIsPressing(false);
        setPressingDeviceId(null);
      }, 2500);
    };

    const handleButtonReleased = () => {
      setIsPressing(false);
      setPressingDeviceId(null);
    };

    const handleOrderCancelled = (data: any) => {
      setIsPressing(false);
      setPressingDeviceId(null);
      setActiveCancelOrder(null);
      setShowSuccessModal(false);
      playCancelChime();
      setCancelToast(`Đơn hàng #${data.order?.orderNumber || ''} đã được HỦY THÀNH CÔNG qua nút bấm ESP32!`);
      fetchData();
      setTimeout(() => setCancelToast(null), 7000);
    };

    const handleOrderThrottled = (data: any) => {
      setIsPressing(false);
      setPressingDeviceId(null);
      setThrottledNotice(data.message || 'Đơn hàng gần đây đang được xử lý, tránh bấm lặp lại trong 30 giây.');
      setTimeout(() => setThrottledNotice(null), 6000);
    };

    const handleDeviceClaimed = () => {
      fetchData();
    };
    window.addEventListener('sob_device_claimed_success', handleDeviceClaimed);

    socket.on('ORDER_CREATED', handleOrderCreated);
    socket.on('ORDER_STATUS_CHANGED', handleOrderUpdated);
    socket.on('ORDER_CANCELLED', handleOrderCancelled);
    socket.on('DEVICE_HEARTBEAT', handleDeviceHeartbeat);
    socket.on('BUTTON_PRESSING', handleButtonPressing);
    socket.on('BUTTON_RELEASED', handleButtonReleased);
    socket.on('ORDER_DUPLICATE_THROTTLED', handleOrderThrottled);
    socket.on('device:claimed', handleDeviceClaimed);
    socket.on('device:wifi_changed', handleDeviceClaimed);

    return () => {
      window.removeEventListener('sob_device_claimed_success', handleDeviceClaimed);
      socket.off('ORDER_CREATED', handleOrderCreated);
      socket.off('ORDER_STATUS_CHANGED', handleOrderUpdated);
      socket.off('ORDER_CANCELLED', handleOrderCancelled);
      socket.off('DEVICE_HEARTBEAT', handleDeviceHeartbeat);
      socket.off('BUTTON_PRESSING', handleButtonPressing);
      socket.off('BUTTON_RELEASED', handleButtonReleased);
      socket.off('ORDER_DUPLICATE_THROTTLED', handleOrderThrottled);
      socket.off('device:claimed', handleDeviceClaimed);
      socket.off('device:wifi_changed', handleDeviceClaimed);
    };
  }, [user, customerId]);

  // Cancellation countdown timer
  useEffect(() => {
    if (!activeCancelOrder || secondsRemaining <= 0) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setActiveCancelOrder(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCancelOrder, secondsRemaining]);

  // App-triggered Quick Reorder
  const handleQuickReorder = async (deviceId: string) => {
    try {
      const res = await api.post('/orders/quick-reorder', { deviceId });
      if (res.data.success) {
        const { order, cancelWindowSeconds } = res.data.data;
        setActiveSuccessOrder(order);
        setActiveCancelOrder(order);
        setShowSuccessModal(true);
        setSecondsRemaining(cancelWindowSeconds || 60);
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tạo đơn hàng');
    }
  };

  const handleCancelOrder = async (orderId: string, orderNumber?: string) => {
    // Optimistic UI: immediately mark this order as CANCELLED in local state
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'CANCELLED' } : o))
    );
    if (activeCancelOrder?.id === orderId) {
      setActiveCancelOrder(null);
    }

    try {
      const res = await api.post(`/orders/${orderId}/cancel`, {
        reason: 'Khách hàng hủy đơn trong thời gian 60 giây cho phép',
      });
      if (res.data.success) {
        fetchData();
      }
    } catch (err: any) {
      console.error('Cancel order error:', err);
      fetchData();
    }
  };

  const handleOrderCancelledModalClosed = (orderNumber: string) => {
    setCancelToast(`Đơn hàng #${orderNumber} đã được hủy thành công`);
    setTimeout(() => {
      setCancelToast(null);
    }, 4000);
  };

  const [simulatingDeviceId, setSimulatingDeviceId] = useState<string | null>(null);

  const handleSimulatePress = async (deviceId: string) => {
    setSimulatingDeviceId(deviceId);
    try {
      const res = await api.post(`/devices/${deviceId}/simulate-press`, { eventType: 'DOUBLE_PRESS' });
      if (res.data.success) {
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Mô phỏng bấm nút thất bại');
    } finally {
      setSimulatingDeviceId(null);
    }
  };

  const handleSimulateHold = async (deviceId: string) => {
    try {
      await api.post('/test-button-event', { event: 'hold', deviceId });
      setTimeout(async () => {
        await api.post('/test-button-event', { event: 'fail', deviceId });
      }, 3000);
    } catch (e: any) {
      console.error('Simulate hold error:', e);
    }
  };

  // Tra cứu thiết bị theo mã số hoặc chuỗi QR
  const handleLookupCode = async (codeToSearch?: string) => {
    const code = (codeToSearch !== undefined ? codeToSearch : deviceCodeInput).trim();
    if (!code) {
      setLookupError('Vui lòng nhập mã số hoặc quét mã QR');
      return;
    }
    setAddSubmitting(true);
    setLookupError(null);
    try {
      // 1. Thử gọi /devices/lookup-code
      const res = await api.post('/devices/lookup-code', { code });
      if (res.data.success && res.data.data) {
        const dev = res.data.data;
        setFoundDevice(dev);
        setCustomDeviceName(dev.customName || `Nút ${dev.product?.name || 'Đặt Hàng'}`);
        setAddStep(2);
        return;
      }
    } catch (err: any) {
      // 2. Thử fallback qua /provisioning/session
      try {
        const provRes = await api.post('/provisioning/session', { code, qrPayload: code });
        if (provRes.data.success && provRes.data.data) {
          const dev = provRes.data.data;
          setFoundDevice(dev);
          setCustomDeviceName(dev.customName || `Nút ${dev.product?.name || 'Đặt Hàng'}`);
          setAddStep(2);
          return;
        }
      } catch {}
      setLookupError(err.response?.data?.message || `Không tìm thấy thiết bị nào với mã "${code}". Vui lòng kiểm tra lại mã số trên thiết bị.`);
    } finally {
      setAddSubmitting(false);
    }
  };

  // Xác nhận liên kết thiết bị vào tài khoản khách hàng (Không cần MAC)
  const handleConfirmPair = async () => {
    if (!foundDevice) return;
    setAddSubmitting(true);
    try {
      const res = await api.post('/devices/configure-by-code', {
        code: foundDevice.pairingCode || foundDevice.deviceId,
        customName: customDeviceName,
      });
      if (res.data.success) {
        confetti({ particleCount: 75, spread: 65, origin: { y: 0.5 } });
        setAddStep(3);
        fetchData();
        return;
      }
    } catch (err: any) {
      try {
        await api.post(`/devices/${foundDevice.deviceId}/claim`);
        confetti({ particleCount: 75, spread: 65, origin: { y: 0.5 } });
        setAddStep(3);
        fetchData();
        return;
      } catch {}
      alert(err.response?.data?.message || 'Không thể liên kết thiết bị vào tài khoản');
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleCameraScanned = (scannedText: string) => {
    if (scannedText) {
      handleLookupCode(scannedText);
    }
  };

  // Tra cứu mã số thiết bị trong modal đổi Wi-Fi
  const handleLookupWifiCode = async (codeToLookup?: string) => {
    const code = (codeToLookup !== undefined ? codeToLookup : wifiCodeInput).trim();
    if (!code) return;
    setWifiLookupLoading(true);
    setWifiLookupError(null);
    try {
      const res = await api.post('/devices/lookup-code', { code });
      if (res.data.success && res.data.data) {
        setWifiLookupFoundDev(res.data.data);
        setChangeWifiDevice(res.data.data);
        setWifiSelectedDevId(res.data.data.deviceId);
        return;
      }
    } catch (e: any) {
      try {
        const provRes = await api.post('/provisioning/session', { code, qrPayload: code });
        if (provRes.data.success && provRes.data.data) {
          setWifiLookupFoundDev(provRes.data.data);
          setChangeWifiDevice(provRes.data.data);
          setWifiSelectedDevId(provRes.data.data.deviceId);
          return;
        }
      } catch {}
      setWifiLookupError(`Không tìm thấy nút bấm với mã "${code}". Vui lòng kiểm tra lại.`);
    } finally {
      setWifiLookupLoading(false);
    }
  };

  // Kết nối Web Bluetooth
  const handleConnectBluetooth = async () => {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
      setWifiErrorMsg('Trình duyệt của bạn chưa hỗ trợ Web Bluetooth. Vui lòng mở bằng Google Chrome hoặc Microsoft Edge.');
      return;
    }
    setIsBleScanning(true);
    setWifiErrorMsg(null);
    try {
      const navBluetooth = (navigator as any).bluetooth;
      const device = await navBluetooth.requestDevice({
        filters: [
          { namePrefix: 'SmartOrder' },
          { namePrefix: 'SmartButton' },
          { namePrefix: 'Smart' },
          { namePrefix: 'ESP' },
        ],
        optionalServices: [
          '0000fff0-0000-1000-8000-00805f9b34fb',
          0xfff0,
        ],
      });
      setConnectedBleDevice(device);
      let server = device.gatt;
      if (!server.connected) {
        try {
          server = await device.gatt.connect();
        } catch (_) {
          if (device.gatt?.connected) server = device.gatt;
        }
      }
      setBleGattServer(server);
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        setWifiErrorMsg('Không thể kết nối Bluetooth. Đảm bảo nút đang bật và ở gần.');
      }
    } finally {
      setIsBleScanning(false);
    }
  };

  // Cập nhật cấu hình Wi-Fi trực tiếp trên Web / BLE / USB
  const handleSaveAndProvisionWifi = async () => {
    const targetDev = changeWifiDevice || wifiLookupFoundDev || devices.find(d => d.deviceId === wifiSelectedDevId) || devices[0];
    const devId = connectedBleDevice?.name || targetDev?.deviceId || 'BTN-8829-WTR';

    if (!wifiSsidInput.trim()) {
      setWifiErrorMsg('Vui lòng nhập Tên mạng Wi-Fi (2.4GHz)');
      return;
    }

    setWifiUpdating(true);
    setWifiErrorMsg(null);
    setWifiSuccessMsg(null);

    try {
      // 1. Nếu đang ở tab BLE và đã kết nối
      if (wifiPanelTab === 'BLE' && (connectedBleDevice || bleGattServer)) {
        try {
          let server = bleGattServer;
          if (!server || !server.connected) {
            if (connectedBleDevice?.gatt) {
              server = await connectedBleDevice.gatt.connect();
              setBleGattServer(server);
            }
          }
          if (server) {
            let service = null;
            try {
              service = await server.getPrimaryService('0000fff0-0000-1000-8000-00805f9b34fb');
            } catch {
              service = await server.getPrimaryService(0xfff0);
            }
            if (service) {
              const char = await service.getCharacteristic('0000fff2-0000-1000-8000-00805f9b34fb');
              const encoder = new TextEncoder();
              const payload = encoder.encode(`${wifiSsidInput.trim()}:${wifiPasswordInput}`);
              if (typeof (char as any).writeValueWithoutResponse === 'function') {
                await (char as any).writeValueWithoutResponse(payload);
              } else {
                await char.writeValue(payload);
              }
            }
          }
        } catch (bleErr) {
          console.warn('BLE write note:', bleErr);
        }
      } else if (wifiPanelTab === 'USB' && typeof navigator !== 'undefined' && 'serial' in navigator) {
        // 2. Nếu đang ở tab USB
        try {
          const port = await (navigator as any).serial.requestPort();
          await port.open({ baudRate: 115200 });
          const encoder = new TextEncoder();
          const writer = port.writable.getWriter();
          await writer.write(encoder.encode(`WIFI:${wifiSsidInput.trim()}:${wifiPasswordInput}\n`));
          writer.releaseLock();
          await port.close();
        } catch (usbErr: any) {
          if (usbErr.name !== 'NotFoundError') {
            console.warn('USB write note:', usbErr);
          }
        }
      }

      // 3. Luôn đồng bộ cấu hình Wi-Fi lên server
      const res = await api.post(`/devices/${devId}/change-wifi`, {
        ssid: wifiSsidInput.trim(),
        password: wifiPasswordInput,
      });

      if (res.data.success) {
        setWifiSuccessMsg(`Đã cập nhật Wi-Fi "${wifiSsidInput.trim()}" cho nút ${devId} thành công.`);
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.5 } });
        fetchData();
        setTimeout(() => {
          setChangeWifiDevice(null);
          setWifiSuccessMsg(null);
        }, 1200);
      }
    } catch (err: any) {
      setWifiErrorMsg(err.response?.data?.message || 'Không thể lưu cấu hình Wi-Fi');
    } finally {
      setWifiUpdating(false);
    }
  };

  const handleSaveWifiOnWeb = async (devToConfig?: Device | null) => {
    return handleSaveAndProvisionWifi();
  };

  // Transfer device submit
  const handleTransferSubmit = async () => {
    if (!transferringDevice) return;
    try {
      const res = await api.post(`/devices/${transferringDevice.deviceId}/transfer`);
      if (res.data.success) {
        setTransferResult(res.data.data);
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể chuyển nhượng');
    }
  };

  // Open & Save Customer Self-Config Modal
  const openConfigModal = (dev: Device) => {
    setConfigModalDevice(dev);
    setConfigCustomName(dev.customName || dev.configuration?.customName || '');
    setConfigProductId(dev.productId || dev.configuration?.productId || '');
    setConfigQuantity(dev.configuration?.defaultQuantity || 1);
    setConfigStatus(dev.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE');
    setConfigSuccessMsg(null);
    setConfigError(null);
  };

  const handleSaveConfig = async () => {
    if (!configModalDevice) return;
    if (!configProductId) {
      setConfigError('Vui lòng chọn sản phẩm gán cho nút');
      return;
    }
    setConfigLoading(true);
    setConfigError(null);
    try {
      const res = await api.put(`/devices/${configModalDevice.id}/customer-config`, {
        customName: configCustomName,
        productId: configProductId,
        defaultQuantity: configQuantity,
        status: configStatus,
      });
      if (res.data.success) {
        setConfigSuccessMsg('Đã lưu cấu hình nút thành công!');
        fetchData();
        setTimeout(() => {
          setConfigModalDevice(null);
          setConfigSuccessMsg(null);
        }, 1000);
      }
    } catch (err: any) {
      setConfigError(err.response?.data?.message || 'Không thể lưu cấu hình nút');
    } finally {
      setConfigLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC]">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Order Success Modal (Apple iOS / Airbnb "Digital Receipt" Experience) */}
      <OrderSuccessModal
        isOpen={showSuccessModal && !!activeSuccessOrder}
        order={activeSuccessOrder}
        secondsRemaining={secondsRemaining}
        onClose={() => {
          setShowSuccessModal(false);
          setActiveSuccessOrder(null);
        }}
        onCancelOrder={(orderId, orderNum) => {
          handleCancelOrder(orderId, orderNum);
        }}
        onCancelledClosed={(orderNum) => {
          handleOrderCancelledModalClosed(orderNum);
        }}
        onReorder={(deviceId) => {
          if (deviceId) {
            handleQuickReorder(deviceId);
          } else if (devices.length > 0) {
            handleQuickReorder(devices[0].deviceId);
          }
        }}
      />



      {/* ── PART 1: Greeting Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="space-y-3"
      >
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Xin chào, {user?.fullName || 'Cư Dân'}
          </h1>
          <div className="flex flex-wrap items-center gap-2.5 mt-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => setShowStoreModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#0E6BA8]/10 hover:bg-[#0E6BA8]/15 text-[#0E6BA8] dark:text-sky-400 border border-[#0E6BA8]/20 transition-all cursor-pointer group shadow-2xs"
              title="Nhấn để đổi cửa hàng hoặc tìm đại lý lân cận"
            >
              <Store className="w-3.5 h-3.5 text-[#0E6BA8] shrink-0" />
              <span className="font-semibold">{selectedStore?.name || user?.store?.name || 'LeBao Store (Q7)'}</span>
              <span className="text-[10px] bg-[#0E6BA8] text-white px-1.5 py-0.2 rounded-full font-mono">
                {selectedStore?.code || 'STORE-NFHT4'}
              </span>
              <span className="text-[11px] underline opacity-75 group-hover:opacity-100 flex items-center">
                Đổi cửa hàng <ChevronRight className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </motion.button>
            <span className="text-zinc-200 dark:text-zinc-700">·</span>
            <span className="text-sm text-zinc-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-zinc-400" />
              <span>Căn hộ {(user as any)?.customerProfile?.apartment || 'Landmark Plus Q7'}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span className="tabular-nums font-medium text-zinc-700 dark:text-zinc-300">
              {devices.length > 0 ? devices.filter(d => d.status !== 'DISABLED').length : 4}/{devices.length > 0 ? devices.length : 4}
            </span> nút online
          </span>
          <span className="flex items-center gap-1.5 text-sm text-zinc-500">
            <Battery className="w-3.5 h-3.5 text-zinc-400" />
            Pin trung bình <span className="tabular-nums font-medium text-zinc-700 dark:text-zinc-300">{devices.length > 0 ? Math.round(devices.reduce((s, d) => s + (d.batteryLevel ?? 96), 0) / devices.length) : 96}%</span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowStoreModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-all duration-150 ease-out active:scale-[0.97] hover:shadow-2xs cursor-pointer shadow-xs"
            >
              <Store className="w-3.5 h-3.5 text-[#0E6BA8]" />
              <span>Đổi Cửa Hàng</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowAirPodsModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-xs font-semibold rounded-lg transition-all duration-150 ease-out active:scale-[0.97] hover:shadow-md cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              + Thêm nút mới
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Cancelled Toast at Bottom-Right */}
      <AnimatePresence>
        {cancelToast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs font-medium border border-slate-800"
          >
            <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
              <RotateCcw className="w-3 h-3 text-slate-300" />
            </div>
            <span className="tabular-nums">{cancelToast}</span>
            <button
              onClick={() => setCancelToast(null)}
              className="ml-2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
        {throttledNotice && (
          <motion.div
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 bg-amber-500 text-white rounded-2xl shadow-xl text-xs font-medium"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{throttledNotice}</span>
            <button onClick={() => setThrottledNotice(null)} className="ml-2 opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel grace banner */}
      <AnimatePresence>
        {!showSuccessModal && activeCancelOrder && secondsRemaining > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-between px-4 py-2.5 bg-white border border-zinc-200/90 rounded-2xl shadow-xs text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
              <span className="text-zinc-600 font-medium">
                Đơn #{activeCancelOrder.orderNumber} — Hủy miễn phí trong{' '}
                <span className="font-bold text-zinc-900 tabular-nums">
                  {secondsRemaining}s
                </span>
              </span>
            </div>
            <button
              onClick={() => handleCancelOrder(activeCancelOrder.id)}
              className="px-3 py-1 text-rose-500 hover:text-rose-600 border border-rose-200 hover:bg-rose-50 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Hủy đơn
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PART 2: Device Grid ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-900">
            Nút Đặt Hàng
            {devices.length > 0 && <span className="ml-2 text-zinc-400 font-normal text-sm">({devices.length})</span>}
          </h2>
        </div>

        {loading ? (
          <div className="py-16 text-center text-zinc-400 text-sm">
            <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin mx-auto mb-3" />
            Đang tải...
          </div>
        ) : devices.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="py-16 text-center bg-white border border-zinc-200 rounded-3xl"
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-zinc-100 flex items-center justify-center text-zinc-400 mb-4">
              <Radio className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-zinc-700 mb-1">Chưa có nút bấm nào</p>
            <p className="text-xs text-zinc-400 mb-4 max-w-xs mx-auto">Kết nối nút đặt hàng thông minh của bạn để bắt đầu.</p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowAirPodsModal(true)}
              className="px-5 py-2.5 bg-[#0E6BA8] hover:bg-[#0B5586] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-all duration-150 ease-out active:scale-[0.97] hover:shadow-md cursor-pointer shadow-xs"
            >
              <Bluetooth className="w-3.5 h-3.5" />
              Ghép nối nút bấm
            </motion.button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            {devices.map((dev, devIndex) => {
              const cfg = dev.configuration;
              const product = cfg?.product;
              const isFirstDev = devIndex === 0;
              const isOnline = dev.status !== 'DISABLED';
              const battery = dev.batteryLevel ?? 96;
              const rssi = dev.wifiRSSI ?? -55;
              const isPressing = pressingDeviceId === dev.deviceId;
              const getCleanProductCutout = (p?: Product | null): string => {
                const n = (p?.name || '').toLowerCase();
                if (n.includes('gas') || n.includes('petrolimex') || n.includes('saigon') || n.includes('total')) {
                  return '/assets/products/Petrolimex.png';
                }
                if (n.includes('gạo') || n.includes('rice') || n.includes('st25')) {
                  return '/assets/products/rice-st25.png';
                }
                if (n.includes('nước') || n.includes('lavie') || n.includes('vĩnh') || n.includes('ion') || n.includes('satori') || n.includes('water')) {
                  return '/assets/products/vinhhao.png';
                }
                if (p?.imageUrl && !p.imageUrl.includes('photo-1548839140-29a749e1bc4e') && !p.imageUrl.includes('photo-1586201375761-83865001e31c')) {
                  return p.imageUrl;
                }
                return '/assets/products/vinhhao.png';
              };
              const rawName = cfg?.customName || dev.customName || 'Nút Đặt Hàng';
              const name = isFirstDev ? 'Nút Nước Khoáng Phòng Khách' : rawName;
              const productDesc = isFirstDev
                ? 'Nước khoáng thiên nhiên La Vie 20L'
                : (cfg?.product?.name || 'Nút bấm thông minh 1 chạm');
              const productImg = isFirstDev
                ? '/assets/products/vinhhao.png'
                : getCleanProductCutout(product);
              const priceStr = isFirstDev
                ? '68.000 ₫'
                : (product ? `${((product.price || 0) * (cfg?.defaultQuantity || 1)).toLocaleString('vi-VN')} ₫` : null);

              return (
                <DeviceCardUI
                  key={dev.id}
                  dev={dev}
                  productImg={productImg}
                  name={name}
                  productDesc={productDesc}
                  priceStr={priceStr}
                  isOnline={isOnline}
                  battery={battery}
                  rssi={rssi}
                  isPressing={isPressing}
                  simulatingId={simulatingDeviceId}
                  onOrder={handleQuickReorder}
                  onSimulate={handleSimulatePress}
                  onConfigOpen={openConfigModal}
                  onWifiOpen={setChangeWifiDevice}
                />
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ── PART 3: Order History ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-900">Lịch sử đặt hàng</h2>
          <span className="text-xs text-zinc-400">5 đơn gần nhất</span>
        </div>
        {orders.length === 0 ? (
          <div className="py-12 text-center bg-white border border-zinc-200 rounded-3xl">
            <ShoppingBag className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm text-zinc-400">Chưa có đơn hàng nào</p>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-3xl divide-y divide-zinc-100 overflow-hidden shadow-xs">
            {orders.slice(0, 5).map((order, idx) => {
              const isPending = order.status === 'PENDING';
              const statusConfig: Record<string, { label: string; dot: string; ring: string; text: string }> = {
                PENDING:   { label: 'Chờ xác nhận',  dot: 'bg-amber-400',   ring: 'bg-amber-50 border-amber-200',     text: 'text-amber-700'  },
                CONFIRMED: { label: 'Đã tiếp nhận', dot: 'bg-emerald-500', ring: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700'},
                PREPARING: { label: 'Đang chuẩn bị',dot: 'bg-violet-500',  ring: 'bg-violet-50 border-violet-200',   text: 'text-violet-700' },
                SHIPPING:  { label: 'Đang giao',    dot: 'bg-sky-500',     ring: 'bg-sky-50 border-sky-200',         text: 'text-sky-700'    },
                COMPLETED: { label: 'Đã giao',      dot: 'bg-emerald-500', ring: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700'},
                CANCELLED: { label: 'Đã hủy',       dot: 'bg-rose-500',    ring: 'bg-rose-50 border-rose-200',       text: 'text-rose-700'   },
              };
              const s = statusConfig[order.status] || { label: order.status, dot: 'bg-zinc-300', ring: 'bg-zinc-50 border-zinc-200', text: 'text-zinc-500' };
              const formattedDate = new Date(order.createdAt).toLocaleDateString('vi-VN');
              const formattedTime = new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className={`px-5 py-4 ${isPending ? 'bg-amber-50/50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-700 tabular-nums">#{order.orderNumber}</span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${s.ring} ${s.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${order.status === 'PENDING' ? 'animate-pulse' : ''}`} />
                          {s.label}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {order.items.map((it) => (
                          <div key={it.id} className="text-xs text-zinc-600">
                            <span>{it.quantity}× {it.productName}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {formattedDate} · {formattedTime}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end justify-center">
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">
                        {order.totalAmount.toLocaleString('vi-VN')} ₫
                      </span>
                      {isPending && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleCancelOrder(order.id)}
                          className="mt-2 text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all duration-150 ease-out active:scale-[0.97] cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                          Hủy đơn
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ========================================================================= */}
      {/* 2. BẢNG CẤU HÌNH MẠNG WI-FI (Linear / Apple Home Design System)          */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {changeWifiDevice && (
            <motion.div
              key="wifi-modal-wrapper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden overscroll-contain"
            >
            {/* Smooth Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              onClick={() => {
                setChangeWifiDevice(null);
                setShowWifiWebModal(false);
                setWifiSuccessMsg(null);
                setWifiErrorMsg(null);
              }}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm cursor-pointer"
            />

            {/* Smooth Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 22 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 14 }}
              transition={{
                type: 'spring',
                damping: 30,
                stiffness: 300,
                mass: 0.85,
              }}
              className="relative max-h-[90vh] w-full max-w-lg flex flex-col bg-white dark:bg-[#101014] rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-200/80 dark:border-zinc-800 overflow-hidden z-10"
            >
              {/* Header cố định */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Cấu hình mạng Wi-Fi nút bấm
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Thiết lập mạng Wi-Fi 2.4GHz để nút bấm gửi đơn hàng tức thì
                  </p>
                </div>
                <button
                  onClick={() => {
                    setChangeWifiDevice(null);
                    setShowWifiWebModal(false);
                    setWifiSuccessMsg(null);
                    setWifiErrorMsg(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nội dung ở giữa cuộn được */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1 overscroll-contain" data-scrollable="true">
                {/* Alert thông báo */}
                {wifiSuccessMsg && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{wifiSuccessMsg}</span>
                  </div>
                )}
                {wifiErrorMsg && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{wifiErrorMsg}</span>
                  </div>
                )}

                {/* 2. Segmented Control duy nhất trên 1 hàng có animated sliding pill */}
                <div className="grid grid-cols-3 bg-slate-100 dark:bg-zinc-800/70 p-1 rounded-lg text-sm font-medium relative">
                  {(['BLE', 'USB', 'SELECT'] as const).map((tab) => {
                    const isSelected = wifiPanelTab === tab;
                    const labels = {
                      BLE: 'Bluetooth (BLE)',
                      USB: 'Cáp USB',
                      SELECT: `Chọn nút (${devices.length})`,
                    };
                    return (
                      <motion.button
                        key={tab}
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => setWifiPanelTab(tab)}
                        className="relative py-1.5 px-2 rounded-md text-center transition-colors whitespace-nowrap truncate cursor-pointer select-none"
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="wifiPanelTabIndicator"
                            className="absolute inset-0 bg-white dark:bg-zinc-900 rounded-md shadow-xs border border-slate-200/50 dark:border-zinc-700/60"
                            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                          />
                        )}
                        <span className={`relative z-10 transition-colors ${
                          isSelected
                            ? 'text-[#0E6BA8] dark:text-sky-400 font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}>
                          {labels[tab]}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* 3. Khối kết nối thiết bị ("Thiết bị kết nối") */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Thiết bị kết nối
                  </label>
                  {!(connectedBleDevice || changeWifiDevice || wifiLookupFoundDev || (wifiPanelTab === 'SELECT' && wifiSelectedDevId)) ? (
                    <div className="border border-slate-200 dark:border-zinc-800 rounded-lg p-3.5 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        Chưa kết nối nút bấm
                      </span>
                      <button
                        type="button"
                        onClick={handleConnectBluetooth}
                        disabled={isBleScanning}
                        className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-zinc-700 px-3 py-1.5 rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer"
                      >
                        {isBleScanning ? 'Đang quét...' : 'Quét thiết bị'}
                      </button>
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-zinc-800 rounded-lg p-3.5 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white tabular-nums text-sm">
                            {connectedBleDevice?.name || (changeWifiDevice || wifiLookupFoundDev)?.deviceId || wifiSelectedDevId || 'BTN-8829-WTR'}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Đã kết nối · Sẵn sàng nạp Wi-Fi
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (wifiPanelTab !== 'SELECT') {
                            handleConnectBluetooth();
                          }
                        }}
                        className="text-xs font-medium text-[#0E6BA8] hover:underline cursor-pointer"
                      >
                        Đổi thiết bị
                      </button>
                    </div>
                  )}
                </div>

                {/* Lựa chọn nút khi ở tab SELECT */}
                {wifiPanelTab === 'SELECT' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Chọn nút bấm cần nạp Wi-Fi
                    </label>
                    <select
                      value={wifiSelectedDevId || changeWifiDevice?.deviceId || (devices[0]?.deviceId || '')}
                      onChange={(e) => {
                        setWifiSelectedDevId(e.target.value);
                        const d = devices.find((x) => x.deviceId === e.target.value);
                        if (d) setChangeWifiDevice(d);
                      }}
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-slate-900 dark:text-white tabular-nums focus:border-[#0E6BA8] focus:ring-2 focus:ring-[#0E6BA8]/20 focus:outline-none transition-colors"
                    >
                      {devices.map((d) => (
                        <option key={d.id} value={d.deviceId}>
                          {d.deviceId} — {d.customName || d.product?.name || 'Smart Button'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Thông tin hỗ trợ khi ở tab USB */}
                {wifiPanelTab === 'USB' && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Cắm nút ESP32 qua cáp USB vào máy tính. Nhập thông tin Wi-Fi bên dưới và bấm <strong>Lưu & Nạp Wi-Fi</strong> để chọn cổng COM nạp tốc độ cao.
                  </p>
                )}

                {/* 4. Form nhập Wi-Fi chuẩn Linear (không lồng hộp) */}
                <div className="space-y-3.5 pt-1">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Tên mạng Wi-Fi (2.4GHz)
                    </label>
                    <input
                      type="text"
                      value={wifiSsidInput}
                      onChange={(e) => setWifiSsidInput(e.target.value)}
                      placeholder="Nhập tên Wi-Fi (VD: Home_WiFi_2.4G)"
                      className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#0E6BA8] focus:ring-2 focus:ring-[#0E6BA8]/20 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Mật khẩu Wi-Fi
                    </label>
                    <div className="relative">
                      <input
                        type={showWifiPassword ? 'text' : 'password'}
                        value={wifiPasswordInput}
                        onChange={(e) => setWifiPasswordInput(e.target.value)}
                        placeholder="Nhập mật khẩu Wi-Fi"
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#0E6BA8] focus:ring-2 focus:ring-[#0E6BA8]/20 focus:outline-none pr-14 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWifiPassword(!showWifiPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showWifiPassword ? 'Ẩn' : 'Hiện'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer cố định */}
              <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setChangeWifiDevice(null);
                    setShowWifiWebModal(false);
                    setWifiSuccessMsg(null);
                    setWifiErrorMsg(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndProvisionWifi}
                  disabled={wifiUpdating}
                  className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[#0E6BA8] hover:bg-[#0B5586] shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {wifiUpdating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang nạp Wi-Fi...</span>
                    </>
                  ) : (
                    <span>Lưu & Nạp Wi-Fi</span>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}

      {/* ========================================================================= */}
      {/* 3. TRANSFER DEVICE MODAL (CHUYỂN NHƯỢNG NÚT SANG CHỦ MỚI)                */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {transferringDevice && (
            <motion.div
              key="transfer-modal-wrapper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden overscroll-contain"
            >
              {/* Smooth Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                onClick={() => setTransferringDevice(null)}
                className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm cursor-pointer"
              />

              {/* Smooth Modal Dialog */}
              <motion.div
                initial={{ opacity: 0, scale: 0.93, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 14 }}
                transition={{
                  type: 'spring',
                  damping: 28,
                  stiffness: 320,
                  mass: 0.8,
                }}
                className="relative w-full max-w-md bg-white dark:bg-[#101014] rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] p-6 border border-slate-200/80 dark:border-zinc-800 space-y-4 z-10"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-indigo-500 dark:text-rose-400" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Chuyển Nhượng Nút Bấm</h3>
                  </div>
                  <button onClick={() => setTransferringDevice(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {!transferResult ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 dark:text-zinc-400">
                      Khi bạn chuyển nhượng nút <strong>{transferringDevice.deviceId}</strong>, bạn sẽ mất quyền điều khiển nút này. Hệ thống sẽ sinh mã QR mới để người nhận quét và sở hữu.
                    </p>
                    <button
                      onClick={handleTransferSubmit}
                      className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-gradient-to-r dark:from-red-600 dark:to-rose-600 dark:hover:from-red-500 dark:hover:to-rose-500 text-white font-bold text-xs active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                    >
                      XÁC NHẬN CHUYỂN NHƯỢNG
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 text-center">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Đã Tạo Mã Chuyển Nhượng Mới!</h4>
                    <p className="text-xs text-slate-500 tabular-nums break-all p-3 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-zinc-800 text-left">
                      {transferResult.qrPayload}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Hãy gửi mã này cho chủ mới để họ quét trong ứng dụng Smart Order.
                    </p>
                    <button
                      onClick={() => setTransferringDevice(null)}
                      className="px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 dark:bg-gradient-to-r dark:from-red-600 dark:to-rose-600 text-slate-950 dark:text-white font-bold text-xs active:scale-[0.98] transition-all cursor-pointer shadow-sm"
                    >
                      ĐÓNG
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* 4. USER TỰ CẤU HÌNH NÚT BẤM MODAL (Linear / Stripe Design System)         */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {configModalDevice && (
            <motion.div
              key="config-modal-wrapper"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden overscroll-contain"
            >
            {/* Smooth Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              onClick={() => setConfigModalDevice(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm cursor-pointer"
            />

            {/* Smooth Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 22 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 14 }}
              transition={{
                type: 'spring',
                damping: 30,
                stiffness: 300,
                mass: 0.85,
              }}
              className="relative w-full max-w-lg bg-white dark:bg-[#101014] rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-200/80 dark:border-zinc-800 p-6 space-y-5 z-10 overflow-hidden"
            >
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Cấu hình nút bấm
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                  <span className="bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-medium tabular-nums">
                    {configModalDevice.deviceId || 'BTN-8829-WTR'}
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                    <Battery className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="tabular-nums">Pin {configModalDevice.batteryLevel ?? 100}%</span>
                  </span>
                  <span>·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {configStatus === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm khóa'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setConfigModalDevice(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error / Success Alerts */}
            {configError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{configError}</span>
              </div>
            )}
            {configSuccessMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{configSuccessMsg}</span>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              {/* 1. Tên vị trí nút bấm */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Tên vị trí nút bấm
                </label>
                <input
                  type="text"
                  value={configCustomName}
                  onChange={(e) => setConfigCustomName(e.target.value)}
                  placeholder="Ví dụ: Nước Bếp, Nước Phòng Khách, Gas Kho..."
                  className="w-full px-3.5 py-2 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E6BA8]/20 focus:border-[#0E6BA8] transition-all"
                />
              </div>

              {/* 2 & 3. Sản phẩm và Số lượng trên cùng 1 hàng ngang */}
              <div>
                <div className="grid grid-cols-12 gap-3">
                  {/* Cột trái (col-span-8): Sản phẩm tự động đặt */}
                  <div className="col-span-8">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Sản phẩm tự động đặt
                    </label>
                    <select
                      value={configProductId}
                      onChange={(e) => setConfigProductId(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-[#0E6BA8]/20 focus:border-[#0E6BA8] transition-all"
                    >
                      <option value="">-- Chọn sản phẩm --</option>
                      {availableProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.unit ? `(${p.unit})` : ''} — {p.price?.toLocaleString('vi-VN')} đ
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Cột phải (col-span-4): Số lượng bộ đếm [- 1 +] liền khối */}
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Số lượng
                    </label>
                    <div className="flex items-center justify-between border border-slate-200 dark:border-zinc-800 rounded-lg h-10 px-1 bg-white dark:bg-zinc-900">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={() => setConfigQuantity((prev) => Math.max(1, prev - 1))}
                        className="hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        -
                      </motion.button>
                      <span className="text-center font-medium tabular-nums text-slate-900 dark:text-white text-sm select-none">
                        {configQuantity}
                      </span>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={() => setConfigQuantity((prev) => prev + 1)}
                        className="hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      >
                        +
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Dòng chú thích nhỏ bên dưới hàng */}
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                  Hệ thống sẽ tự động tạo đơn mặt hàng này ngay khi bạn nhấn nút vật lý.
                </p>
              </div>

              {/* 4. Cho phép đặt hàng từ nút này (Toggle Switch phẳng có spring animation) */}
              <div className="border-t border-slate-100 dark:border-zinc-800 pt-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white">
                    Cho phép đặt hàng từ nút này
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Tạm khóa nút nếu bạn đi vắng hoặc sợ trẻ nhỏ bấm nhầm
                  </p>
                </div>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  type="button"
                  onClick={() => setConfigStatus((prev) => (prev === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    configStatus === 'ACTIVE' ? 'bg-[#0E6BA8]' : 'bg-slate-200 dark:bg-zinc-700'
                  }`}
                >
                  <motion.span
                    layout
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 ${
                      configStatus === 'ACTIVE' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </motion.button>
              </div>
            </div>

            {/* Footer nút bấm */}
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setConfigModalDevice(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={configLoading}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-[#0E6BA8] hover:bg-[#0B5586] shadow-sm transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
              >
                {configLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <span>Lưu cấu hình</span>
                )}
              </button>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}

      {/* Apple-Style AirPods White Device Pairing Modal */}
      <WhiteDeviceAirPodsModal
        isOpen={showAirPodsModal}
        onClose={() => setShowAirPodsModal(false)}
        onDeviceBound={() => {
          fetchData();
        }}
      />

      {/* Customer Store Selector Modal (GPS Radius & Store Code Discovery) */}
      <CustomerStoreSelectorModal
        isOpen={showStoreModal}
        onClose={() => setShowStoreModal(false)}
        currentStoreCode={selectedStore?.code || 'STORE-NFHT4'}
        onStoreSelected={(store) => {
          setSelectedStore(store);
          try {
            localStorage.setItem('smart_order_customer_store', JSON.stringify(store));
          } catch {}
        }}
      />
    </div>

    </div>
  );
};
