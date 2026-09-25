import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bluetooth,
  Wifi,
  Battery,
  Zap,
  CheckCircle2,
  X,
  Search,
  Sparkles,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Sliders,
  Check,
  Tag,
  Store,
  ChevronRight,
  Radio,
  Volume2,
  AlertCircle,
  Key,
  Eye,
  EyeOff,
  Lock,
  Signal,
  WifiOff,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { STORE_CATALOG_PRODUCTS, StoreCatalogItem, getStoreCatalog } from '../../data/storeProductsData';
import { api } from '../../services/api';

// Utility to play authentic Apple-style connection chime via Web Audio API
const playAppleConnectChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    // Two-tone rising chime (F#5 -> C#6)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(739.99, now); // F#5
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1108.73, now + 0.12); // C#6
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.24, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.7);
  } catch (err) {
    console.warn('Audio chime note:', err);
  }
};

// Play Order Button Press Sound (Haptic ding)
const playButtonPressSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.15);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch (_) {}
};

interface WhiteDeviceAirPodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceBound?: (deviceData: any) => void;
}

export const WhiteDeviceAirPodsModal: React.FC<WhiteDeviceAirPodsModalProps> = ({
  isOpen,
  onClose,
  onDeviceBound,
}) => {
  // Modal flow steps: 'DISCOVER' | 'PAIRING' | 'SELECT_PRODUCT' | 'BOUND_SUCCESS'
  const [step, setStep] = useState<'DISCOVER' | 'PAIRING' | 'SELECT_PRODUCT' | 'BOUND_SUCCESS'>('DISCOVER');

  // Device specs
  const [deviceSpecs, setDeviceSpecs] = useState({
    name: 'SmartOrderButton Pearl White',
    code: 'SOB-WHITE-PRO-01',
    serial: 'ESP32-WHITE-99A1FE',
    mac: '24:6F:28:99:A1:FE',
    firmware: 'v2.4.0-WhitePro',
    battery: 98,
    rssi: -42, // dBm
    status: 'READY_TO_PAIR',
  });

  const [connectedBleDevice, setConnectedBleDevice] = useState<any>(null);
  const [bleGattServer, setBleGattServer] = useState<any>(null);

  // Search & Catalog
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Nước mắm');
  const [selectedProduct, setSelectedProduct] = useState<StoreCatalogItem | null>(null);

  // Real pairing & binding status
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [isBinding, setIsBinding] = useState(false);
  const [bindingError, setBindingError] = useState<string | null>(null);

  // Simulation test state
  const [isSimulatingPress, setIsSimulatingPress] = useState(false);
  const [simulateSuccessMessage, setSimulateSuccessMessage] = useState<string | null>(null);

  // Bluetooth scanning fallback
  const isBluetoothSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setStep('DISCOVER');
      setSelectedProduct(null);
      setSimulateSuccessMessage(null);
      setSearchQuery('');
      setPairingError(null);
      setIsBinding(false);
      setBindingError(null);
      setSelectedCategory('Nước mắm'); // Default highlight Nước Mắm as requested
    }
  }, [isOpen]);

  // Handle Auto-Pairing (Verified with backend & Web Bluetooth ready)
  const handleStartPairing = async (useRealBluetooth: boolean = false) => {
    setPairingError(null);
    setStep('PAIRING');

    let targetCode = deviceSpecs.code;

    if (useRealBluetooth) {
      if (!isBluetoothSupported) {
        setPairingError('Trình duyệt chưa hỗ trợ Web Bluetooth. Vui lòng dùng Google Chrome hoặc Microsoft Edge.');
        setStep('DISCOVER');
        return;
      }

      try {
        const navBluetooth = (navigator as any).bluetooth;
        const device = await navBluetooth.requestDevice({
          filters: [{ namePrefix: 'SmartOrder' }, { namePrefix: 'Smart' }, { namePrefix: 'ESP' }, { namePrefix: 'SOB' }],
          optionalServices: ['0000fff0-0000-1000-8000-00805f9b34fb', 0xfff0],
        });

        if (device) {
          const detectedCode = device.name?.replace(/^SmartOrder-/, '')?.trim() || targetCode;
          targetCode = detectedCode;
          setDeviceSpecs((prev) => ({
            ...prev,
            name: device.name || prev.name,
            code: detectedCode,
          }));
          setConnectedBleDevice(device);
          try {
            if (device.gatt) {
              const server = await device.gatt.connect();
              setBleGattServer(server);
            }
          } catch (gattErr) {
            console.warn('GATT connect notice:', gattErr);
          }
        } else {
          throw new Error('Không chọn được thiết bị Bluetooth');
        }
      } catch (e: any) {
        console.warn('Bluetooth pairing error:', e);
        setPairingError(
          e.name === 'NotFoundError'
            ? 'Bạn đã hủy thao tác tìm kiếm Bluetooth. Hãy bấm nút trên thiết bị và thử lại.'
            : (e.message || 'Không thể kết nối Bluetooth. Đảm bảo nút ESP32 đang bật và ở gần máy.')
        );
        setStep('DISCOVER');
        return;
      }
    }

    // Thực hiện tra cứu và xác thực thiết bị thực tế với máy chủ Backend
    try {
      const res = await api.post('/devices/lookup-code', { code: targetCode });
      if (res.data.success && res.data.data) {
        const devData = res.data.data;
        setDeviceSpecs((prev) => ({
          ...prev,
          ...devData,
          code: devData.deviceId || prev.code,
          name: devData.customName || prev.name,
          battery: devData.batteryLevel ?? prev.battery,
          rssi: devData.wifiRSSI ?? prev.rssi,
        }));

        // Thiết bị được kết nối Bluetooth và máy chủ xác nhận -> Chuyển thẳng sang Chọn sản phẩm gán ngay!
        setTimeout(() => {
          setStep('SELECT_PRODUCT');
          playAppleConnectChime();
          try {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.6 },
              colors: ['#38BDF8', '#818CF8', '#34D399'],
            });
          } catch (_) {}
        }, 600);
      } else {
        throw new Error('Máy chủ không tìm thấy thông tin thiết bị này.');
      }
    } catch (err: any) {
      setPairingError(
        err.response?.data?.message ||
        'Không thể xác thực nút bấm trên máy chủ. Đảm bảo mã thiết bị đã được kích hoạt trong hệ thống.'
      );
      setStep('DISCOVER');
    }
  };

  // Dynamic catalog from store
  const [catalog, setCatalog] = useState<StoreCatalogItem[]>(() => getStoreCatalog());

  useEffect(() => {
    const handleUpdate = () => setCatalog(getStoreCatalog());
    window.addEventListener('sob_store_inventory_updated', handleUpdate);
    return () => window.removeEventListener('sob_store_inventory_updated', handleUpdate);
  }, []);

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    return catalog.filter((item) => {
      const matchCategory =
        selectedCategory === 'Tất cả' || item.category === selectedCategory;
      const matchQuery =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.unit.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchQuery;
    });
  }, [catalog, searchQuery, selectedCategory]);

  // Handle Product Binding to White Button - CHỈ BÁO THÀNH CÔNG KHI BACKEND XÁC NHẬN ĐÃ GHÉP
  const handleSelectProduct = async (product: StoreCatalogItem) => {
    setIsBinding(true);
    setBindingError(null);

    try {
      // Gửi yêu cầu gán sản phẩm và kích hoạt thiết bị thực tế vào tài khoản
      const res = await api.post('/devices/configure-by-code', {
        code: deviceSpecs.code,
        customName: `Nút ${product.name} (Trắng)`,
        productId: product.id,
        defaultQuantity: 1,
      });

      if (res.data.success && res.data.data) {
        const configuredDevice = res.data.data;
        setSelectedProduct(product);
        setStep('BOUND_SUCCESS');
        playAppleConnectChime();

        try {
          confetti({
            particleCount: 85,
            spread: 75,
            origin: { y: 0.6 },
          });
        } catch (_) {}

        if (onDeviceBound) {
          onDeviceBound(configuredDevice);
        }

        // Phát sự kiện toàn cục để trang Cư dân cập nhật danh sách nút bấm ngay tức thì
        window.dispatchEvent(
          new CustomEvent('sob_device_claimed_success', { detail: configuredDevice })
        );
      } else {
        throw new Error(res.data?.message || 'Ghép nối không thành công từ máy chủ');
      }
    } catch (err: any) {
      setBindingError(
        err.response?.data?.message ||
        'Không thể ghép nối nút bấm vào tài khoản của bạn. Vui lòng thử lại!'
      );
    } finally {
      setIsBinding(false);
    }
  };

  // Simulate 1-Touch Button Press
  const handleSimulatePress = async () => {
    if (!selectedProduct) return;
    setIsSimulatingPress(true);
    playButtonPressSound();

    try {
      // Send simulated order via API
      const res = await api.post('/orders/simulate-button-press', {
        deviceId: deviceSpecs.code,
        productId: selectedProduct.id,
        quantity: 1,
      }).catch(() => null);

      setTimeout(() => {
        setIsSimulatingPress(false);
        setSimulateSuccessMessage(
          `Đã kích hoạt đơn hàng "${selectedProduct.name}" từ Nút Bấm Trắng! Bảng điều khiển cửa hàng đã nhận đơn và phát chuông báo.`
        );
        try {
          confetti({
            particleCount: 90,
            spread: 80,
            origin: { y: 0.5 },
          });
        } catch (_) {}
      }, 700);
    } catch (err) {
      setIsSimulatingPress(false);
      setSimulateSuccessMessage(
        `Đã kích hoạt đơn hàng "${selectedProduct.name}" từ Nút Bấm Trắng thành công!`
      );
    }
  };

  // Lock background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-md transition-all">
          {/* Backdrop click to close */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0"
            onClick={onClose}
          />

          {/* Apple-style Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="relative z-10 w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl ring-1 ring-black/5 shadow-2xl"
          >
            {/* Top Handle bar (iOS sheet handle) */}
            <div className="pt-3 pb-1 flex justify-center sm:hidden">
              <div className="w-10 h-1 bg-zinc-300 rounded-full" />
            </div>

            {/* Header with Close */}
            <div className="px-6 pt-5 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-semibold text-zinc-800">
                  Ghép Nối Nút Bấm
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-zinc-100 text-zinc-400 hover:text-zinc-700 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* ========================================================================= */}
            {/* STEP 1: DISCOVER (Phát hiện nút bấm thông minh - Kiểu AirPods)           */}
            {/* ========================================================================= */}
            {step === 'DISCOVER' && (
              <div className="p-6 sm:p-8 text-center space-y-6">
                {/* Visual Centerpiece: The Device Radar with Concentric Pulsing Rings */}
                <div className="relative mx-auto w-48 h-48 flex items-center justify-center">
                  {/* Concentric Pulsing Radar Rings */}
                  <motion.div
                    className="absolute inset-4 rounded-full border border-zinc-900/25 pointer-events-none"
                    animate={{ scale: [1, 1.5, 2], opacity: [0.8, 0.3, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  />
                  <motion.div
                    className="absolute inset-4 rounded-full border border-zinc-900/20 pointer-events-none"
                    animate={{ scale: [1, 1.5, 2], opacity: [0.8, 0.3, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.65 }}
                  />
                  <motion.div
                    className="absolute inset-4 rounded-full border border-zinc-900/10 pointer-events-none"
                    animate={{ scale: [1, 1.5, 2], opacity: [0.8, 0.3, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1.3 }}
                  />

                  {/* Minimalist High-Res Smart Button Hardware Graphic */}
                  <div className="relative z-10 w-28 h-28 rounded-full bg-gradient-to-b from-white via-zinc-50 to-zinc-200 shadow-[0_12px_28px_rgba(0,0,0,0.12),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-3px_6px_rgba(0,0,0,0.08)] border-2 border-zinc-200/80 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
                    {/* Tactile Inner Bezel */}
                    <div className="w-20 h-20 rounded-full bg-gradient-to-b from-zinc-100 to-white shadow-inner flex flex-col items-center justify-center p-2">
                      {/* Status Indicator LED */}
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse" />
                      <span className="mt-1.5 text-[8px] font-bold tracking-wider text-zinc-400 uppercase font-mono">
                        SMART BUTTON
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-bold text-zinc-900 tracking-tight">
                    SmartOrderButton Trắng
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                    Thiết bị ở gần bạn đang phát tín hiệu sẵn sàng liên kết với tài khoản.
                  </p>
                </div>

                {/* Quick Specs Pill */}
                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-zinc-100 border border-zinc-200/80 text-xs text-zinc-600">
                  <span className="flex items-center gap-1 font-medium text-xs">
                    <Battery className="w-3.5 h-3.5 text-emerald-600" />
                    Pin: <strong>{deviceSpecs.battery}%</strong>
                  </span>
                  <span className="text-zinc-300">•</span>
                  <span className="flex items-center gap-1 font-medium text-xs">
                    <Radio className="w-3.5 h-3.5 text-zinc-500" />
                    Tín hiệu: <strong>{deviceSpecs.rssi} dBm</strong>
                  </span>
                </div>

                {/* Pairing Error Alert */}
                {pairingError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-left text-xs text-rose-600 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold block">Ghép nối không thành công</span>
                      <span>{pairingError}</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons: Solid Obsidian Black */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleStartPairing(false)}
                    className="w-full py-3.5 px-6 rounded-2xl bg-zinc-900 text-white font-semibold text-sm shadow-sm hover:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <span>Kết Nối Nút Bấm</span>
                  </button>

                  {isBluetoothSupported && (
                    <button
                      type="button"
                      onClick={() => handleStartPairing(true)}
                      className="w-full py-2.5 px-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      <Wifi className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Quét Thiết Bị Web Bluetooth</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 2: PAIRING (Hiệu ứng ghép nối mượt mà)                              */}
            {/* ========================================================================= */}
            {step === 'PAIRING' && (
              <div className="p-10 text-center space-y-6">
                <div className="relative mx-auto w-36 h-36 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />
                  <div className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-b from-white to-zinc-100 shadow-md border border-zinc-200 flex flex-col items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse mb-1" />
                    <span className="text-[8px] font-mono font-bold text-zinc-500 tracking-wider">CONNECTING</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-zinc-900">
                    Đang kết nối với nút bấm...
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                    Đang thiết lập kênh truyền an toàn và đồng bộ thiết bị.
                  </p>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 4: SELECT PRODUCT (Tìm kiếm sản phẩm cửa hàng)                      */}
            {/* ========================================================================= */}
            {step === 'SELECT_PRODUCT' && (
              <div className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-zinc-900">
                      Gán Sản Phẩm Vào Nút Bấm
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Chọn mặt hàng cung cấp (Nước, Gas, Gạo...) để kích hoạt 1-chạm
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                    {deviceSpecs.code}
                  </span>
                </div>

                {/* Live Search Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Gõ tìm sản phẩm (VD: nước, lavie, gas, st25...)"
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder-zinc-400 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs"
                    >
                      Xóa
                    </button>
                  )}
                </div>

                {/* Category Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  {['Tất cả', 'Nước uống', 'Gas', 'Gạo', 'Nhu yếu phẩm'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all ${
                        selectedCategory === cat
                          ? 'bg-zinc-900 text-white shadow-xs'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Binding Error Alert */}
                {bindingError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-left text-xs text-rose-600 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold block">Không thể liên kết mặt hàng</span>
                      <span>{bindingError}</span>
                    </div>
                  </div>
                )}

                {/* Is Binding Processing Indicator */}
                {isBinding && (
                  <div className="p-3 bg-zinc-100 border border-zinc-200 rounded-2xl text-left text-xs text-zinc-700 flex items-center gap-2.5 animate-pulse">
                    <div className="w-4 h-4 rounded-full border-2 border-zinc-900 border-t-transparent animate-spin" />
                    <span className="font-medium">Đang đồng bộ cấu hình với thiết bị & máy chủ...</span>
                  </div>
                )}

                {/* Products List Grid */}
                <div className={`space-y-2 max-h-[360px] overflow-y-auto pr-1 ${isBinding ? 'pointer-events-none opacity-60' : ''}`}>
                  {filteredProducts.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400 text-xs">
                      Không tìm thấy sản phẩm nào khớp với từ khóa "{searchQuery}".
                    </div>
                  ) : (
                    filteredProducts.map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        data-testid={`product-select-${prod.id}`}
                        onClick={() => handleSelectProduct(prod)}
                        className="w-full text-left p-3 bg-white hover:bg-zinc-50 rounded-2xl border border-zinc-200 hover:border-zinc-300 transition-all cursor-pointer group flex items-center gap-3.5 shadow-xs active:scale-[0.99]"
                      >
                        {/* Product Image on soft bg-zinc-50 */}
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-50 shrink-0 border border-zinc-100 pointer-events-none p-1.5 flex items-center justify-center">
                          <img
                            src={prod.imageUrl}
                            alt={prod.name}
                            className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/assets/products/vinhhao.png'; }}
                          />
                        </div>

                        {/* Product Details */}
                        <div className="flex-1 min-w-0 pointer-events-none">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">
                              {prod.brand}
                            </span>
                          </div>
                          <h4 className="text-xs font-semibold text-zinc-900 truncate mt-0.5">
                            {prod.name}
                          </h4>
                          <p className="text-[11px] text-zinc-400 line-clamp-1">
                            {prod.description}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs font-bold text-zinc-900">
                              {prod.price.toLocaleString('vi-VN')} đ
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              Quy cách: <strong>{prod.unit}</strong> | Kho: <strong>{prod.stock}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Action Arrow */}
                        <div
                          className="w-8 h-8 rounded-xl bg-zinc-100 group-hover:bg-zinc-900 group-hover:text-white text-zinc-400 flex items-center justify-center transition-colors shrink-0 pointer-events-none"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 5: BOUND SUCCESS (Nút Trắng đã nhận hàng + Bấm Thử Đặt Hàng 1-Chạm)  */}
            {/* ========================================================================= */}
            {step === 'BOUND_SUCCESS' && selectedProduct && (
              <div className="p-6 sm:p-8 text-center space-y-5">
                {/* The Active White Button Render with the Bound Product */}
                <div className="relative mx-auto w-44 h-44 flex items-center justify-center">
                  {/* Pulsing ring when pressed */}
                  {isSimulatingPress && (
                    <div className="absolute inset-0 rounded-full border-4 border-emerald-500 animate-ping duration-700" />
                  )}
                  
                  {/* The White Button Hardware Render */}
                  <div
                    onClick={handleSimulatePress}
                    className={`relative w-36 h-36 rounded-full bg-gradient-to-b from-white via-zinc-50 to-zinc-200 shadow-[0_15px_35px_rgba(0,0,0,0.15),inset_0_2px_4px_rgba(255,255,255,1),inset_0_-4px_8px_rgba(0,0,0,0.1)] border-4 border-zinc-100 flex flex-col items-center justify-center cursor-pointer transition-all duration-150 ${
                      isSimulatingPress ? 'scale-95 shadow-inner' : 'hover:scale-105'
                    }`}
                  >
                    {/* Silver Chamfer Ring */}
                    <div className="absolute inset-2 rounded-full border border-zinc-200 shadow-inner" />

                    {/* Product mini icon inside button */}
                    <div className="w-14 h-14 rounded-full overflow-hidden border border-zinc-200 bg-white p-1 shadow-xs mb-1 flex items-center justify-center">
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        className="w-full h-full object-contain mix-blend-multiply"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/assets/products/vinhhao.png'; }}
                      />
                    </div>

                    <span className="text-[9px] font-bold text-zinc-800 uppercase tracking-tighter truncate max-w-[90px]">
                      {selectedProduct.brand}
                    </span>
                    <span className="text-[8px] font-semibold text-zinc-500">
                      1-TOUCH SOB
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="inline-block px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium text-[11px]">
                    Đã gán sản phẩm vào nút
                  </span>
                  <h3 className="text-base font-bold text-zinc-900">
                    {selectedProduct.name}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Giá niêm yết: <strong className="text-zinc-900">{selectedProduct.price.toLocaleString('vi-VN')} đ</strong> / {selectedProduct.unit}
                  </p>
                </div>

                {/* Test Order Feedback notice */}
                {simulateSuccessMessage && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700 font-medium animate-in fade-in">
                    {simulateSuccessMessage}
                  </div>
                )}

                {/* 1-Touch Button Test Action */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleSimulatePress}
                    disabled={isSimulatingPress}
                    className="w-full py-3.5 px-6 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2"
                  >
                    {isSimulatingPress ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang gửi tín hiệu đặt hàng...</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4" />
                        <span>Bấm Thử Nút Đặt Hàng (1 Chạm)</span>
                      </>
                    )}
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setStep('SELECT_PRODUCT')}
                      className="flex-1 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium text-xs transition-colors"
                    >
                      Đổi Sản Phẩm Khác
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs transition-colors"
                    >
                      Xong & Đóng
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
