import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/OrderSoundContext';
import { subscribeToCustomer, getSocket } from '../../services/socket';
import { Device, Order, Product } from '../../types';
import { Radio, ShoppingBag, Clock, CheckCircle2, AlertCircle, X, ChevronRight, MapPin, Truck, RefreshCw, Battery, Wifi, Zap, Sparkles, Plus, Share2, QrCode, WifiOff, Key, Camera, Hash, Check, Lightbulb, Bluetooth, Sliders, Power, Edit3, Settings, ChevronDown } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Floating3DCard } from '../../components/3d/Floating3DCard';
import { WebBluetoothProvisioner } from '../../components/devices/WebBluetoothProvisioner';
import { WhiteDeviceAirPodsModal } from '../../components/devices/WhiteDeviceAirPodsModal';


// ─────────────────────────────────────────────
// DeviceCardUI — Apple Home style card
// ─────────────────────────────────────────────
interface DeviceCardUIProps {
  dev: Device;
  productImg: string;
  name: string;
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
  dev, productImg, name, priceStr, isOnline, battery, rssi,
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
              {cfg?.product?.name || 'Nút bấm thông minh 1 chạm'}
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
            <span className="text-xs font-medium text-zinc-500">{battery}%</span>
          </div>
        </div>

        {/* Single Primary Action Button: "Đặt ngay — [Price]" */}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => onOrder(dev.deviceId)}
          className="w-full py-2.5 rounded-2xl bg-zinc-900 text-white text-xs font-semibold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors shadow-xs"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>{priceStr ? `Đặt ngay — ${priceStr}` : 'Đặt ngay'}</span>
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
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono px-0.5">
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
                  <button
                    type="button"
                    onClick={() => onConfigOpen(dev)}
                    className="flex-1 px-2.5 py-1.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 text-zinc-600 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                  >
                    <Sliders className="w-3 h-3 text-zinc-400" />
                    <span>Cấu hình</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onWifiOpen(dev)}
                    className="flex-1 px-2.5 py-1.5 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 text-zinc-600 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors"
                  >
                    <Wifi className="w-3 h-3 text-zinc-400" />
                    <span>Wi-Fi</span>
                  </button>
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
  const [wifiPanelTab, setWifiPanelTab] = useState<'BLE' | 'CODE' | 'SELECT'>('BLE');
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
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.4 } });
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
        setActiveCancelOrder(order);
        setSecondsRemaining(cancelWindowSeconds || 60);
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.5 } });
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tạo đơn hàng');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await api.post(`/orders/${orderId}/cancel`, {
        reason: 'Khách hàng hủy đơn trong thời gian 60 giây cho phép',
      });
      if (res.data.success) {
        setActiveCancelOrder(null);
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể hủy đơn hàng');
    }
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

  // Cập nhật cấu hình Wi-Fi trực tiếp trên Web
  const handleSaveWifiOnWeb = async (devToConfig?: Device | null) => {
    const targetDev = devToConfig || changeWifiDevice || wifiLookupFoundDev || devices.find(d => d.deviceId === wifiSelectedDevId) || devices[0];
    if (!targetDev) {
      alert('Vui lòng nhập mã số nút hoặc chọn nút bấm trước khi đổi Wi-Fi');
      return;
    }
    if (!wifiSsidInput.trim()) {
      alert('Vui lòng nhập hoặc chọn Tên mạng Wi-Fi (SSID)');
      return;
    }
    setWifiUpdating(true);
    setWifiSuccessMsg(null);
    try {
      const res = await api.post(`/devices/${targetDev.deviceId}/change-wifi`, {
        ssid: wifiSsidInput.trim(),
        password: wifiPasswordInput,
      });
      if (res.data.success) {
        setWifiSuccessMsg(`🟢 ĐÈN LED NÚT ĐÃ CHUYỂN SANG XANH LÁ!\nĐã cập nhật cấu hình mạng Wi-Fi "${wifiSsidInput.trim()}" cho nút ${targetDev.deviceId} thành công trực tiếp trên Web. Nút đã sẵn sàng bấm đặt hàng ngay, không cần vào 192.168.4.1.`);
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.5 } });
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể lưu cấu hình Wi-Fi');
    } finally {
      setWifiUpdating(false);
    }
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
      {/* Order Success Modal */}
      <AnimatePresence>
        {showSuccessModal && activeSuccessOrder && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-zinc-100"
            >
              <div className="bg-emerald-500 px-6 pt-6 pb-5 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-semibold">Đặt hàng thành công</span>
                </div>
                <p className="text-2xl font-bold">#{activeSuccessOrder.orderNumber}</p>
                <p className="text-emerald-100 text-xs mt-1">Đơn hàng của bạn đã được gửi đến đại lý</p>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-2">
                  {activeSuccessOrder.items?.map((it: any) => (
                    <div key={it.id || it.productName} className="flex justify-between text-sm">
                      <span className="text-zinc-600">{it.quantity}× {it.productName}</span>
                      <span className="font-semibold text-zinc-900">{it.totalPrice?.toLocaleString('vi-VN')} ₫</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-zinc-100">
                    <span className="text-zinc-900">Tổng cộng</span>
                    <span className="text-emerald-600">{activeSuccessOrder.totalAmount?.toLocaleString('vi-VN')} ₫</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{activeSuccessOrder.deliveryAddress}</span>
                </div>
                {secondsRemaining > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-amber-700 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />Có thể hủy trong:
                      </span>
                      <span className="font-mono font-bold text-amber-800 tabular-nums">
                        00:{secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining}s
                      </span>
                    </div>
                    <div className="w-full bg-amber-100 h-1 rounded-full overflow-hidden">
                      <motion.div
                        className="bg-amber-400 h-full rounded-full"
                        animate={{ width: `${(secondsRemaining / ((activeSuccessOrder as any).cancelWindowSeconds || 60)) * 100}%` }}
                        transition={{ duration: 1, ease: 'linear' }}
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {secondsRemaining > 0 && (
                    <button
                      onClick={() => { handleCancelOrder(activeSuccessOrder.id); setShowSuccessModal(false); }}
                      className="w-full py-2.5 rounded-2xl text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />Hủy đơn hàng
                    </button>
                  )}
                  <button
                    onClick={() => setShowSuccessModal(false)}
                    className="w-full py-3 rounded-2xl bg-zinc-900 text-white text-sm font-semibold hover:bg-zinc-700 transition-colors"
                  >
                    Đã hiểu — Theo dõi đơn hàng
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



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
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="flex items-center gap-1.5 text-sm text-zinc-400">
              <MapPin className="w-3.5 h-3.5" />
              {user?.store?.name || 'Đại lý Nước & Gas Gia Định'}
            </span>
            <span className="text-zinc-200">·</span>
            <span className="text-sm text-zinc-400">
              Căn hộ {(user as any)?.customerProfile?.apartment || '—'}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <span className="flex items-center gap-2 text-sm text-zinc-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            {devices.filter(d => d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 25000).length}/{devices.length} nút online
          </span>
          <span className="flex items-center gap-1.5 text-sm text-zinc-500">
            <Battery className="w-3.5 h-3.5 text-zinc-400" />
            Pin trung bình {devices.length > 0 ? Math.round(devices.reduce((s, d) => s + (d.batteryLevel ?? 96), 0) / devices.length) : 96}%
          </span>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowAirPodsModal(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-full hover:bg-zinc-700 transition-colors"
          >
            <Bluetooth className="w-3 h-3" />
            Thêm nút mới
          </motion.button>
        </div>
      </motion.div>

      {/* Cancelled Toast */}
      <AnimatePresence>
        {cancelToast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-600 text-white rounded-2xl shadow-xl text-xs font-medium"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{cancelToast}</span>
            <button onClick={() => setCancelToast(null)} className="ml-2 opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
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
            className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-amber-700 font-medium">
                Đơn #{activeCancelOrder.orderNumber} — Hủy miễn phí trong{' '}
                <span className="font-mono font-bold tabular-nums">
                  00:{secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining}s
                </span>
              </span>
            </div>
            <button
              onClick={() => handleCancelOrder(activeCancelOrder.id)}
              className="px-3 py-1.5 text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-full text-xs font-medium transition-colors"
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
              className="px-5 py-2.5 bg-zinc-900 text-white rounded-2xl text-xs font-medium inline-flex items-center gap-2 hover:bg-zinc-700 transition-colors"
            >
              <Bluetooth className="w-3.5 h-3.5" />
              Ghép nối nút bấm
            </motion.button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((dev) => {
              const cfg = dev.configuration;
              const product = cfg?.product;
              const isOnline = dev.lastSeenAt && Date.now() - new Date(dev.lastSeenAt).getTime() < 25000;
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
              const productImg = getCleanProductCutout(product);
              const name = cfg?.customName || dev.customName || 'Nút Đặt Hàng';
              const priceStr = product ? `${((product.price || 0) * (cfg?.defaultQuantity || 1)).toLocaleString('vi-VN')} ₫` : null;

              return (
                <DeviceCardUI
                  key={dev.id}
                  dev={dev}
                  productImg={productImg}
                  name={name}
                  priceStr={priceStr}
                  isOnline={!!isOnline}
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
          <div className="bg-white border border-zinc-200 rounded-3xl divide-y divide-zinc-100 overflow-hidden">
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
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className={`px-5 py-4 ${isPending ? 'bg-amber-50/50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-semibold text-zinc-600">#{order.orderNumber}</span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${s.ring} ${s.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${order.status === 'PENDING' ? 'animate-pulse' : ''}`} />
                          {s.label}
                        </span>
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        {order.items.map((it) => (
                          <div key={it.id} className="flex justify-between text-xs text-zinc-500">
                            <span>{it.quantity}× {it.productName}</span>
                            <span className="font-medium text-zinc-700">{it.totalPrice.toLocaleString('vi-VN')} ₫</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[11px] text-zinc-400">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</span>
                        <span className="text-[11px] text-zinc-400">·</span>
                        <span className="text-[11px] font-semibold text-zinc-700">{order.totalAmount.toLocaleString('vi-VN')} ₫</span>
                      </div>
                    </div>
                    {isPending && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCancelOrder(order.id)}
                        className="shrink-0 text-rose-500 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        Hủy đơn
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* 2. BẢNG CẤU HÌNH MẠNG WI-FI (TRỰC TIẾP TRÊN WEB HOẶC QUA THIẾT BỊ)       */}
      {/* ========================================================================= */}
      {changeWifiDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#101014] rounded-2xl shadow-2xl p-6 border border-slate-200 dark:border-zinc-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-red-500/15 text-sky-600 dark:text-red-400 flex items-center justify-center border border-sky-200 dark:border-red-500/30">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Cấu Hình Mạng Wi-Fi Nút Bấm
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Chỉ cần nhập tên mạng & mật khẩu — Bảo toàn 100% sản phẩm và sở hữu
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setChangeWifiDevice(null);
                  setShowWifiWebModal(false);
                  setWifiSuccessMsg(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Switcher: CHỌN PHƯƠNG THỨC CHỌN NÚT */}
            <div className="flex p-1 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setWifiPanelTab('BLE')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  wifiPanelTab === 'BLE'
                    ? 'bg-white dark:bg-zinc-800 text-cyan-600 dark:text-red-400 shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Bluetooth className="w-3.5 h-3.5 text-cyan-500 dark:text-red-400" />
                <span>Bluetooth (Không Dây)</span>
              </button>
              <button
                type="button"
                onClick={() => setWifiPanelTab('CODE')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  wifiPanelTab === 'CODE'
                    ? 'bg-white dark:bg-zinc-800 text-sky-600 dark:text-red-400 shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Hash className="w-3.5 h-3.5" />
                <span>Nhập Mã PIN</span>
              </button>
              <button
                type="button"
                onClick={() => setWifiPanelTab('SELECT')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  wifiPanelTab === 'SELECT'
                    ? 'bg-white dark:bg-zinc-800 text-sky-600 dark:text-red-400 shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Chọn Nút ({devices.length})</span>
              </button>
            </div>

            {/* PHƯƠNG THỨC 0: SÓNG BLUETOOTH BLE 1-CHẠM */}
            {wifiPanelTab === 'BLE' && (
              <WebBluetoothProvisioner
                defaultSsid={wifiSsidInput}
                onSuccess={(devId) => {
                  fetchData();
                }}
              />
            )}

            {/* PHƯƠNG THỨC 1: NHẬP MÃ SỐ PIN */}
            {wifiPanelTab === 'CODE' && (
              <div className="space-y-3 p-3.5 bg-slate-50 dark:bg-zinc-900/60 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nhập mã PIN 6 số hoặc Device ID in trên nút:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={wifiCodeInput}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setWifiCodeInput(val);
                      if (val.length === 6 && /^\d+$/.test(val)) {
                        handleLookupWifiCode(val);
                      }
                    }}
                    placeholder="VD: 882910 hoặc SOB-000001"
                    className="flex-1 px-3.5 py-2.5 text-sm font-mono font-bold rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:focus:ring-red-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => handleLookupWifiCode(wifiCodeInput)}
                    disabled={wifiLookupLoading || !wifiCodeInput.trim()}
                    className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 dark:bg-gradient-to-r dark:from-red-600 dark:to-rose-600 dark:hover:from-red-500 dark:hover:to-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                  >
                    {wifiLookupLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Tra Cứu</span>}
                  </button>
                </div>

                {/* Quick samples */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 dark:text-zinc-400">
                  <span>Mã mẫu:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setWifiCodeInput('882910');
                      handleLookupWifiCode('882910');
                    }}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 font-mono text-sky-600 dark:text-red-400 font-bold"
                  >
                    882910
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWifiCodeInput('SOB-000001');
                      handleLookupWifiCode('SOB-000001');
                    }}
                    className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 font-mono text-sky-600 dark:text-red-400 font-bold"
                  >
                    SOB-000001
                  </button>
                </div>

                {wifiLookupError && (
                  <p className="text-xs text-red-500 font-medium">{wifiLookupError}</p>
                )}
              </div>
            )}

            {/* PHƯƠNG THỨC 2: CHỌN NÚT TỪ DANH SÁCH */}
            {wifiPanelTab === 'SELECT' && (
              <div className="space-y-2 p-3.5 bg-slate-50 dark:bg-zinc-900/60 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Chọn nút bấm cần cấu hình lại mạng:
                </label>
                {devices.length === 0 ? (
                  <p className="text-xs text-slate-500">Chưa có nút bấm nào. Hãy dùng tab "Nhập Mã Số Nút" ở trên!</p>
                ) : (
                  <select
                    value={wifiSelectedDevId || (devices[0]?.deviceId || '')}
                    onChange={(e) => {
                      setWifiSelectedDevId(e.target.value);
                      const d = devices.find(x => x.deviceId === e.target.value);
                      if (d) setChangeWifiDevice(d);
                    }}
                    className="w-full px-3.5 py-2.5 text-xs font-mono font-bold bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white outline-none"
                  >
                    {devices.map((d) => (
                      <option key={d.id} value={d.deviceId}>
                        {d.deviceId} — {d.customName || d.product?.name || 'Smart Button'}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* THÔNG TIN THIẾT BỊ ĐÃ XÁC NHẬN */}
            {(changeWifiDevice || wifiLookupFoundDev) && (
              <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/50 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <div>
                    <p className="font-mono font-bold text-emerald-800 dark:text-emerald-300">
                      {(changeWifiDevice || wifiLookupFoundDev)?.deviceId} — {(changeWifiDevice || wifiLookupFoundDev)?.customName || (changeWifiDevice || wifiLookupFoundDev)?.product?.name || 'Smart Order Button'}
                    </p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      {(changeWifiDevice || wifiLookupFoundDev)?.product?.name ? `Sản phẩm: ${(changeWifiDevice || wifiLookupFoundDev)?.product?.name}` : 'Sẵn sàng nạp Wi-Fi'}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-mono text-[10px] font-bold">
                  SẴN SÀNG ĐỔI
                </span>
              </div>
            )}

            {/* FORM NHẬP WI-FI THỦ CÔNG KHI CHỌN TAB CODE HOẶC SELECT */}
            {wifiPanelTab !== 'BLE' && (
            <div className="space-y-3.5 pt-1">
              {wifiSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-500 rounded-2xl text-xs text-emerald-800 dark:text-emerald-200 font-semibold space-y-1 animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                    <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>CẬP NHẬT WI-FI THÀNH CÔNG!</span>
                  </div>
                  <p className="text-[11px] leading-relaxed whitespace-pre-line text-emerald-900 dark:text-emerald-100">
                    {wifiSuccessMsg}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Chọn hoặc Nhập Tên Wi-Fi (SSID 2.4 GHz):
                </label>
                <input
                  type="text"
                  value={wifiSsidInput}
                  onChange={(e) => setWifiSsidInput(e.target.value)}
                  placeholder="VD: Home_WiFi_2.4G"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:focus:ring-red-500/30"
                />
                {/* Quick fill pills */}
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-[11px] text-slate-500 dark:text-zinc-400">
                  <span>Gợi ý:</span>
                  {['Home_WiFi_2.4G', 'FPT_Telecom_GiaDinh', 'Viettel_5G_Extender', 'SmartOffice_Guest'].map((net) => (
                    <button
                      key={net}
                      type="button"
                      onClick={() => setWifiSsidInput(net)}
                      className={`px-2 py-0.5 rounded-md font-mono text-[11px] transition-colors ${
                        wifiSsidInput === net
                          ? 'bg-sky-600 dark:bg-red-600 text-white font-bold'
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      {net}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mật Khẩu Wi-Fi:
                </label>
                <div className="relative">
                  <input
                    type={showWifiPassword ? 'text' : 'password'}
                    value={wifiPasswordInput}
                    onChange={(e) => setWifiPasswordInput(e.target.value)}
                    placeholder="Nhập mật khẩu Wi-Fi nhà bạn"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white font-medium pr-14 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:focus:ring-red-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWifiPassword(!showWifiPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-sky-600 dark:text-red-400"
                  >
                    {showWifiPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </div>

              <div className="p-2.5 bg-blue-50/70 dark:bg-red-950/20 border border-blue-200 dark:border-red-900/40 rounded-xl text-[11px] text-blue-700 dark:text-red-300 flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-500 dark:text-red-400 shrink-0" />
                <span><strong>Đổi Wi-Fi 1 Chạm:</strong> Lưu trực tiếp trên Web/App — Đèn viền nút sẽ tự đổi sang XANH LÁ. Không cần mở trang 192.168.4.1!</span>
              </div>

              <button
                type="button"
                onClick={() => handleSaveWifiOnWeb()}
                disabled={wifiUpdating || !wifiSsidInput.trim()}
                className="w-full py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 dark:bg-gradient-to-r dark:from-red-600 dark:to-rose-600 dark:hover:from-red-500 dark:hover:to-rose-500 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-sky-500/20 dark:shadow-red-600/30 transition-all flex items-center justify-center gap-2"
              >
                {wifiUpdating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>ĐANG NẠP CẤU HÌNH WI-FI XUỐNG NÚT...</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4" />
                    <span>LƯU & ĐỔI WI-FI (ĐÈN CHUYỂN XANH LÁ)</span>
                  </>
                )}
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TRANSFER DEVICE MODAL (CHUYỂN NHƯỢNG NÚT SANG CHỦ MỚI)                */}
      {/* ========================================================================= */}
      {transferringDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-white dark:bg-[#101014] rounded-3xl shadow-2xl p-6 border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-indigo-500 dark:text-rose-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Chuyển Nhượng Nút Bấm</h3>
              </div>
              <button onClick={() => setTransferringDevice(null)} className="p-1 text-slate-400 hover:text-white">
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
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-gradient-to-r dark:from-red-600 dark:to-rose-600 dark:hover:from-red-500 dark:hover:to-rose-500 text-white font-bold text-xs"
                >
                  XÁC NHẬN CHUYỂN NHƯỢNG
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Đã Tạo Mã Chuyển Nhượng Mới!</h4>
                <p className="text-xs text-slate-500 font-mono break-all p-3 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-zinc-800 text-left">
                  {transferResult.qrPayload}
                </p>
                <p className="text-[11px] text-slate-400">
                  Hãy gửi mã này cho chủ mới để họ quét trong ứng dụng Smart Order.
                </p>
                <button
                  onClick={() => setTransferringDevice(null)}
                  className="px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 dark:bg-gradient-to-r dark:from-red-600 dark:to-rose-600 text-slate-950 dark:text-white font-bold text-xs"
                >
                  ĐÓNG
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. USER TỰ CẤU HÌNH NÚT BẤM MODAL                                         */}
      {/* ========================================================================= */}
      {configModalDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#101014] rounded-3xl shadow-2xl p-6 border border-slate-200 dark:border-zinc-800 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Tự Cấu Hình Nút Bấm
                  </h3>
                  <p className="text-xs font-mono text-slate-400">
                    Mã định danh: <span className="font-bold text-sky-600 dark:text-red-400">{configModalDevice.deviceId}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfigModalDevice(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error / Success Alerts */}
            {configError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{configError}</span>
              </div>
            )}
            {configSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{configSuccessMsg}</span>
              </div>
            )}

            {/* Device Diagnostics Overview */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Pin thiết bị</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <Battery className="w-3.5 h-3.5 text-emerald-500" />
                  {configModalDevice.batteryLevel ?? 100}%
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Thời hạn dùng</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  {configModalDevice.expiresAt ? new Date(configModalDevice.expiresAt).toLocaleDateString('vi-VN') : 'Vô thời hạn'}
                </p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Trạng thái</span>
                <p className="font-bold">
                  {configStatus === 'ACTIVE' ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Đang bật</span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400">Tạm khóa</span>
                  )}
                </p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* 1. Tên gợi nhớ */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên Gợi Nhớ Nút (Ví dụ: Nước Bếp, Nước Phòng Khách, Gas Kho)
                </label>
                <input
                  type="text"
                  value={configCustomName}
                  onChange={(e) => setConfigCustomName(e.target.value)}
                  placeholder="Nhập tên nút..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              {/* 2. Chọn sản phẩm đặt khi bấm */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sản Phẩm Đặt Khi Bấm Nút
                </label>
                <select
                  value={configProductId}
                  onChange={(e) => setConfigProductId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                >
                  <option value="">-- Chọn sản phẩm muốn gán cho nút --</option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit}) - {p.price.toLocaleString()} ₫
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Mỗi khi bạn bấm nút này trên bàn, server sẽ tự động tạo đơn đặt mặt hàng này.
                </p>
              </div>

              {/* 3. Số lượng mỗi lần bấm */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Số Lượng Đặt Mỗi Lần Bấm
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setConfigQuantity((prev) => Math.max(1, prev - 1))}
                    className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-white font-bold flex items-center justify-center text-base"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={configQuantity}
                    onChange={(e) => setConfigQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-20 text-center py-2 text-sm font-mono font-bold rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setConfigQuantity((prev) => prev + 1)}
                    className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-white font-bold flex items-center justify-center text-base"
                  >
                    +
                  </button>
                  <span className="text-xs text-slate-500 font-medium">
                    (Ví dụ: 1 bình, 2 bình, 5 bình...)
                  </span>
                </div>
              </div>

              {/* 4. Trạng thái hoạt động (Còn xài hay không) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Power className="w-3.5 h-3.5 text-amber-500" />
                    <span>Cho Phép Đặt Hàng Từ Nút Này</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Tạm khóa nút nếu bạn đi vắng hoặc sợ trẻ nhỏ nghịch bấm nhầm
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfigStatus((prev) => (prev === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    configStatus === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      configStatus === 'ACTIVE' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfigModalDevice(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs"
              >
                HỦY BỎ
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={configLoading}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 dark:bg-gradient-to-r dark:from-amber-500 dark:to-orange-500 text-slate-950 dark:text-white font-extrabold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                {configLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>ĐANG LƯU...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>LƯU CẤU HÌNH</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apple-Style AirPods White Device Pairing Modal */}
      <WhiteDeviceAirPodsModal
        isOpen={showAirPodsModal}
        onClose={() => setShowAirPodsModal(false)}
        onDeviceBound={() => {
          fetchData();
        }}
      />
    </div>

    </div>
  );
};
