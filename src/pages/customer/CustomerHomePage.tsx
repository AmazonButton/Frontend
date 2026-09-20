import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/OrderSoundContext';
import { subscribeToCustomer, getSocket } from '../../services/socket';
import { Device, Order, Product } from '../../types';
import { Radio, ShoppingBag, Clock, CheckCircle2, AlertCircle, X, ChevronRight, MapPin, Truck, RefreshCw, Battery, Wifi, Zap, Sparkles, Plus, Share2, QrCode, WifiOff, Key, Camera, Hash, Check, Lightbulb, Bluetooth, Sliders, Power, Edit3 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Floating3DCard } from '../../components/3d/Floating3DCard';
import { WebBluetoothProvisioner } from '../../components/devices/WebBluetoothProvisioner';
import { WhiteDeviceAirPodsModal } from '../../components/devices/WhiteDeviceAirPodsModal';

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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Order Success Celebration Modal */}
      {showSuccessModal && activeSuccessOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-white dark:bg-[#101014] rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
            {/* Top Header Banner */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 dark:from-emerald-700 dark:via-teal-800 dark:to-zinc-900 p-6 text-white text-center relative overflow-hidden">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-mono font-bold tracking-wider uppercase mb-2">
                <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-200" />
                <span>Nút Bấm ESP32 Đã Kích Hoạt</span>
              </div>

              <h3 className="text-xl font-black tracking-tight flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300" />
                <span>Đã Tạo Đơn Hàng Thành Công!</span>
              </h3>
              <p className="text-xs text-emerald-100 mt-1 max-w-xs mx-auto">
                Tín hiệu ngắt phần hardware đã được xác thực và chuyển tiếp đến trạm đại lý.
              </p>
            </div>

            {/* Order Details Body */}
            <div className="p-5 space-y-4">
              {/* Receipt Box */}
              <div className="bg-slate-50 dark:bg-black/50 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200 dark:border-zinc-800">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Mã Đơn Hàng</span>
                    <p className="font-mono font-bold text-sm text-slate-900 dark:text-white">{activeSuccessOrder.orderNumber}</p>
                  </div>
                  <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    CHỜ GIAO HÀNG
                  </span>
                </div>

                {/* Product Items */}
                <div className="space-y-1.5">
                  {activeSuccessOrder.items?.map((it: any) => (
                    <div key={it.id || it.productName} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-500/10 dark:bg-red-500/15 text-blue-600 dark:text-red-400 flex items-center justify-center font-mono font-bold text-[11px]">
                          {it.quantity}x
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{it.productName}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{it.totalPrice?.toLocaleString()} ₫</span>
                    </div>
                  ))}
                </div>

                {/* Total & Delivery Address */}
                <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 space-y-1 text-xs">
                  <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                    <span>Tổng tiền thanh toán:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black text-sm">{activeSuccessOrder.totalAmount?.toLocaleString()} ₫</span>
                  </div>
                  <div className="flex items-start gap-1 text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="truncate">Giao đến: {activeSuccessOrder.deliveryAddress}</span>
                  </div>
                </div>
              </div>

              {/* Cancel Countdown Notice */}
              {secondsRemaining > 0 && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                      Thời gian hủy miễn phí:
                    </span>
                    <span className="font-mono text-sm font-black text-amber-700 dark:text-amber-300 bg-white dark:bg-zinc-900 px-2.5 py-0.5 rounded-lg border border-amber-500/30 shadow-sm">
                      00:{secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining}s
                    </span>
                  </div>

                  <div className="w-full bg-amber-200 dark:bg-amber-950/60 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-amber-500 to-rose-500 h-full transition-all duration-1000 ease-linear rounded-full"
                      style={{ width: `${(secondsRemaining / ((activeSuccessOrder as any).cancelWindowSeconds || 60)) * 100}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                    <span><strong>Mẹo:</strong> Nhấn đúp 2 lần trên nút vật lý ESP32 để hủy tức thì.</span>
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                {secondsRemaining > 0 && (
                  <button
                    onClick={() => {
                      handleCancelOrder(activeSuccessOrder.id);
                      setShowSuccessModal(false);
                    }}
                    className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <X className="w-4 h-4" />
                    <span>HỦY ĐƠN HÀNG NÀY (00:{secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining}s)</span>
                  </button>
                )}

                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-gradient-to-r dark:from-red-600 dark:to-rose-600 dark:hover:from-red-500 dark:hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 dark:shadow-red-600/30 flex items-center justify-center gap-1.5 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4 text-cyan-300 dark:text-white" />
                  <span>ĐÃ HIỂU — THEO DÕI ĐƠN HÀNG</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Welcoming Header - Modern Glassmorphism Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white p-6 sm:p-8 shadow-xl shadow-slate-950/10 border border-slate-800/80">
        {/* Subtle Ambient Glow Background */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs font-medium text-cyan-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Cổng Cư Dân Thông Minh • 1 Chạm Đặt Nhanh</span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Xin chào, {user?.fullName || 'Cư Dân Sunwah Pearl'}!
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1.5 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  Đại lý phục vụ: <strong className="text-white font-semibold">{user?.store?.name || 'Đại lý Nước & Gas Gia Định'}</strong>
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">Căn hộ {(user as any)?.customerProfile?.apartment || '1204 - Sapphire'}</span>
              </p>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-4 py-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Nút Bấm Sẵn Sàng</div>
                <div className="text-lg font-black text-white">{devices.length} <span className="text-xs font-normal text-slate-400">thiết bị</span></div>
              </div>
            </div>

            <div className="px-4 py-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                <Battery className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Pin Thiết Bị TB</div>
                <div className="text-lg font-black text-white">96% <span className="text-xs font-normal text-slate-400">khỏe</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancelled Success Toast */}
      {cancelToast && (
        <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-xl flex items-center justify-between animate-bounce">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-xs font-bold">{cancelToast}</span>
          </div>
          <button onClick={() => setCancelToast(null)} className="p-1 hover:bg-emerald-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Throttled Anti-Spam Notice */}
      {throttledNotice && (
        <div className="p-4 bg-amber-600 text-white rounded-2xl shadow-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-xs font-semibold">{throttledNotice}</span>
          </div>
          <button onClick={() => setThrottledNotice(null)} className="p-1 hover:bg-amber-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cancellation Grace Period Floating Banner */}
      {!showSuccessModal && activeCancelOrder && secondsRemaining > 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white rounded-2xl shadow-xl flex items-center justify-between animate-pulse">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              <p className="text-[11px] font-mono font-bold uppercase tracking-wider opacity-95">Đơn hàng mới tạo từ nút ESP32</p>
            </div>
            <p className="text-xs font-medium">
              Mã #{activeCancelOrder.orderNumber} • Hủy miễn phí: <strong className="font-mono">00:{secondsRemaining < 10 ? `0${secondsRemaining}` : secondsRemaining}s</strong>
            </p>
            <p className="text-[10px] text-amber-100 flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
              <span>Nhấn đúp 2 lần trên nút ESP32 để hủy ngay</span>
            </p>
          </div>
          <button
            onClick={() => handleCancelOrder(activeCancelOrder.id)}
            className="px-3.5 py-2 bg-white text-rose-700 text-xs font-bold rounded-xl shadow hover:bg-slate-100 btn-press shrink-0 ml-2"
          >
            Hủy Đơn
          </button>
        </div>
      )}

      {/* Main Grid: Left = Buttons, Right = Orders History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Smart Buttons */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-cyan-500/15 border border-blue-500/20 dark:border-cyan-500/30 flex items-center justify-center text-blue-600 dark:text-cyan-400">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Nút Bấm Của Bạn ({devices.length})
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Nút IoT phần cứng đã gán vào căn hộ
                </p>
              </div>
            </div>

            {/* Unified Action Controls Bar - Only Scan & Connect */}
            <div className="inline-flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs shadow-inner">
              <button
                type="button"
                onClick={() => setShowAirPodsModal(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-sm shadow-blue-500/25 transition-all active:scale-95"
              >
                <Bluetooth className="w-3.5 h-3.5 animate-pulse" />
                <span>Quét & Kết Nối Nút Bấm</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs font-mono text-slate-500 bg-white dark:bg-[#101014] rounded-3xl border border-slate-200 dark:border-zinc-800">
              <div className="w-6 h-6 mx-auto mb-2 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              Đang tải danh sách nút bấm...
            </div>
          ) : devices.length === 0 ? (
            <div className="p-10 bg-white dark:bg-[#101014] border border-slate-200 dark:border-zinc-800 rounded-3xl text-center space-y-4 shadow-sm">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-100 dark:bg-zinc-800/80 flex items-center justify-center text-slate-400">
                <Radio className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Chưa có nút bấm nào</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Bạn chưa liên kết nút bấm nào. Bấm "Nút Trắng" hoặc quét mã QR từ thiết bị để bắt đầu trải nghiệm 1 chạm.
                </p>
              </div>
              <button
                onClick={() => setShowAirPodsModal(true)}
                className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs inline-flex items-center gap-2 shadow-md shadow-blue-500/20"
              >
                <Bluetooth className="w-4 h-4" />
                <span>Ghép Nối Nút Trắng Ngay</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {devices.map((dev) => {
                const config = dev.configuration;
                const product = config?.product;

                const isDevicePressing = isPressing && pressingDeviceId === dev.deviceId;
                const isOnline = dev.lastSeenAt && (Date.now() - new Date(dev.lastSeenAt).getTime() < 25000);

                // Fallback image based on product category
                const productImg = product?.imageUrl || 
                  (product?.name?.includes('gas') ? 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?auto=format&fit=crop&w=400&q=80'
                  : product?.name?.includes('Gạo') ? 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=400&q=80'
                  : product?.name?.includes('Khải Hoàn') || product?.name?.includes('mắm') ? 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=400&q=80'
                  : 'https://images.unsplash.com/photo-1548839140-29a749e1bc4e?auto=format&fit=crop&w=400&q=80');

                return (
                  <Floating3DCard key={dev.id} depth={12} className="rounded-3xl">
                    <div
                      className={`relative overflow-hidden bg-white dark:bg-[#11141c] border rounded-3xl p-5 shadow-sm transition-all flex flex-col justify-between space-y-4 ${
                        isDevicePressing
                          ? 'border-amber-500 ring-4 ring-amber-400/30 shadow-xl scale-[1.01]'
                          : 'border-slate-200/80 dark:border-zinc-800/90 hover:border-cyan-500/40 hover:shadow-lg'
                      }`}
                    >
                      {/* Top Header Card */}
                      <div className="flex items-start gap-4 justify-between">
                        {/* Product Thumbnail */}
                        <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700/80 shrink-0 shadow-sm">
                          <img
                            src={productImg}
                            alt={product?.name || 'Sản phẩm'}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                          <span className="absolute bottom-1 left-1.5 text-[8px] font-bold text-white uppercase tracking-wider">
                            {dev.hardwareModel?.includes('WHITE') || dev.deviceId?.includes('WHITE') ? 'SOB PRO' : 'ESP32'}
                          </span>
                        </div>

                        {/* Title & Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-zinc-700/60">
                              {dev.deviceId}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                dev.status === 'DISABLED'
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                                  : dev.status === 'EXPIRED'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                                  : isOnline
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  dev.status === 'DISABLED' ? 'bg-rose-500' : dev.status === 'EXPIRED' ? 'bg-amber-500' : isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                }`}
                              />
                              {dev.status === 'DISABLED' ? 'Tạm Khóa' : dev.status === 'EXPIRED' ? 'Hết Hạn' : isOnline ? 'Đang Online' : 'Chế Độ Chờ (Deep Sleep)'}
                            </span>
                          </div>

                          <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1.5 truncate">
                            {config?.customName || dev.customName || 'Smart Button'}
                          </h3>

                          <div className="flex items-center gap-2 mt-1 text-xs">
                            <span className="text-slate-600 dark:text-zinc-300 font-medium truncate">
                              {product?.name || 'Chưa gán mặt hàng'}
                            </span>
                            <span className="text-slate-300 dark:text-zinc-700">•</span>
                            <span className="text-cyan-600 dark:text-cyan-400 font-bold font-mono shrink-0">
                              {((product?.price || 0) * (config?.defaultQuantity || 1)).toLocaleString()} ₫
                            </span>
                          </div>
                        </div>

                        {/* Physical Tactile Button Visualizer */}
                        <div
                          onClick={() => handleSimulatePress(dev.deviceId)}
                          className={`w-14 h-14 rounded-2xl border-2 flex flex-col items-center justify-center shrink-0 cursor-pointer transition-all shadow-inner group ${
                            isDevicePressing
                              ? 'bg-amber-400 border-amber-300 text-amber-950 scale-95 shadow-amber-500/30 ring-4 ring-amber-400/40 animate-pulse'
                              : 'bg-gradient-to-b from-slate-50 to-slate-200 dark:from-zinc-800 dark:to-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-cyan-500/50 hover:shadow-md active:scale-95'
                          }`}
                          title="Nhấp để mô phỏng bấm nút vật lý"
                        >
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${
                            isDevicePressing ? 'bg-amber-500 border-amber-600 text-white' : 'bg-blue-600 border-blue-500 text-white shadow-sm'
                          }`}>
                            <Radio className={`w-4 h-4 ${simulatingDeviceId === dev.deviceId ? 'animate-spin' : ''}`} />
                          </div>
                          <span className="text-[8px] font-black uppercase tracking-widest mt-0.5 opacity-75">
                            {isDevicePressing ? 'ĐANG BẤM' : 'BẤM THỬ'}
                          </span>
                        </div>
                      </div>

                      {/* Live Pressing Progress Banner */}
                      {isDevicePressing && (
                        <div className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-amber-800 dark:text-amber-200 font-semibold animate-pulse">
                          <Radio className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
                          <span>Đang nhận tín hiệu từ nút ESP32: Nhấn đúp 2 lần để Đặt / Hủy đơn, Giữ 5s để Đổi Wi-Fi</span>
                        </div>
                      )}

                      {/* Hardware Telemetry Bar */}
                      <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/80 text-[11px] font-mono text-slate-600 dark:text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <Battery className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>Pin: <strong className="text-slate-800 dark:text-zinc-200">{dev.batteryLevel ?? 96}%</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 justify-center">
                          <Wifi className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span>Sóng: <strong className="text-slate-800 dark:text-zinc-200">{dev.wifiRSSI ?? -55} dBm</strong></span>
                        </div>
                        <div className="flex items-center gap-1 justify-end text-slate-500 dark:text-zinc-400">
                          <span>Hủy: <strong className="text-slate-800 dark:text-zinc-200">{config?.cancelWindowSeconds ?? 60}s</strong></span>
                        </div>
                      </div>

                      {/* Hardware Physical Gestures Guide */}
                      <div className="px-3 py-2 rounded-2xl bg-slate-50/80 dark:bg-zinc-950/70 border border-slate-100 dark:border-zinc-800/70 text-[10px] text-slate-600 dark:text-zinc-400 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <strong className="text-blue-600 dark:text-sky-400">1 Click:</strong> Bật nguồn
                        </span>
                        <span className="text-slate-300 dark:text-zinc-700">•</span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                          <strong className="text-indigo-600 dark:text-indigo-400">2 Clicks:</strong> Đặt / Hủy đơn
                        </span>
                        <span className="text-slate-300 dark:text-zinc-700">•</span>
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <strong className="text-amber-600 dark:text-amber-400">Giữ 5s:</strong> Đổi Wi-Fi
                        </span>
                      </div>

                      {/* Primary CTA & Clean Action Toolbar */}
                      <div className="space-y-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleQuickReorder(dev.deviceId)}
                          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                        >
                          <ShoppingBag className="w-4 h-4" />
                          <span>Đặt Hàng Ngay (1 Chạm Vật Lý)</span>
                        </button>

                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => handleSimulatePress(dev.deviceId)}
                            disabled={simulatingDeviceId === dev.deviceId}
                            className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                            title="Thử nghiệm tín hiệu nút bấm vật lý"
                          >
                            <Radio className={`w-3.5 h-3.5 text-blue-600 dark:text-sky-400 ${simulatingDeviceId === dev.deviceId ? 'animate-spin' : ''}`} />
                            <span>{simulatingDeviceId === dev.deviceId ? 'Đang gửi...' : 'Thử Nút'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openConfigModal(dev)}
                            className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Sliders className="w-3.5 h-3.5 text-slate-500" />
                            <span>Cấu Hình</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setChangeWifiDevice(dev)}
                            className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Wifi className="w-3.5 h-3.5 text-slate-500" />
                            <span>Đổi Wi-Fi</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </Floating3DCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Order History */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/80 flex items-center justify-center text-slate-500 dark:text-zinc-400">
                <Clock className="w-4 h-4" />
              </div>
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Lịch Sử Đặt Hàng
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-400">5 đơn gần nhất</span>
          </div>

          {orders.length === 0 ? (
            <div className="p-8 bg-white dark:bg-[#11141c] border border-slate-200/80 dark:border-zinc-800 rounded-3xl text-center space-y-2 shadow-sm">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-300 font-semibold">Chưa có đơn hàng nào</p>
              <p className="text-[11px] text-slate-400">Đơn hàng tạo từ nút bấm ESP32 sẽ xuất hiện tại đây.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 5).map((order) => {
                const isPending = order.status === 'PENDING';
                const statusMap: Record<string, { label: string; dot: string; cls: string }> = {
                  PENDING: { label: 'Chờ xác nhận (Có thể hủy)', dot: 'bg-amber-400 animate-ping', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' },
                  CONFIRMED: { label: 'Đã xác nhận', dot: 'bg-blue-500', cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30' },
                  PREPARING: { label: 'Đang đóng gói', dot: 'bg-indigo-500', cls: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' },
                  SHIPPING: { label: 'Đang giao hàng', dot: 'bg-sky-500', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30' },
                  COMPLETED: { label: 'Giao thành công', dot: 'bg-emerald-500', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
                  CANCELLED: { label: 'Đã hủy', dot: 'bg-slate-400', cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25' },
                };
                const statusInfo = statusMap[order.status] || { label: order.status, dot: 'bg-slate-400', cls: 'bg-slate-500/10 text-slate-500 border-slate-500/30' };

                return (
                  <div
                    key={order.id}
                    className={`relative bg-white dark:bg-[#11141c] border rounded-2xl p-4 shadow-sm text-xs space-y-3 transition-all ${
                      isPending
                        ? 'border-amber-500/50 shadow-amber-500/10 ring-2 ring-amber-500/20'
                        : 'border-slate-200/80 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-slate-800 dark:text-zinc-200 text-xs">
                        #{order.orderNumber}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${statusInfo.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {order.items.map((it) => (
                        <div key={it.id} className="flex justify-between items-center text-slate-700 dark:text-zinc-300">
                          <span className="font-semibold">{it.quantity}x {it.productName}</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{it.totalPrice.toLocaleString()} ₫</span>
                        </div>
                      ))}
                    </div>

                    <div className="text-[11px] text-slate-400 dark:text-zinc-500 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex justify-between font-mono items-center">
                      <span>{new Date(order.createdAt).toLocaleDateString('vi-VN')}</span>
                      <span>Tổng tiền: <strong className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">{order.totalAmount.toLocaleString()} ₫</strong></span>
                    </div>

                    {/* Quick Cancel Action directly on order card if PENDING */}
                    {isPending && (
                      <div className="pt-1">
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          className="w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>HỦY ĐƠN HÀNG NÀY (TRONG CỬA SỔ 60S)</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>



      {/* ========================================================================= */}
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
  );
};
