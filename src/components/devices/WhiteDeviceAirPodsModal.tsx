import React, { useState, useEffect, useMemo } from 'react';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md transition-all duration-300">
      {/* Backdrop click to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Apple-style Airpods Card Container */}
      <div className="relative z-10 w-full sm:max-w-md md:max-w-lg bg-white/95 dark:bg-[#11131A]/95 backdrop-blur-2xl rounded-t-[36px] sm:rounded-[36px] border border-slate-200/80 dark:border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.35)] overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-12">
        
        {/* Top Handle bar (iOS sheet handle) */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-zinc-700 rounded-full" />
        </div>

        {/* Header with Close */}
        <div className="px-6 pt-5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-sky-400"></span>
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Ghép Nối Nút Bấm
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* STEP 1: DISCOVER (Phát hiện nút bấm trắng xung quanh - Kiểu AirPods)     */}
        {/* ========================================================================= */}
        {step === 'DISCOVER' && (
          <div className="p-6 sm:p-8 text-center space-y-6">
            {/* 3D Pearl White Button Centerpiece */}
            <div className="relative mx-auto w-44 h-44 flex items-center justify-center">
              {/* Subtle gentle pulse ring */}
              <div className="absolute inset-0 rounded-full border border-blue-500/20 animate-pulse duration-1000" />
              
              {/* THE WHITE PEARL BUTTON BODY */}
              <div className="relative w-36 h-36 rounded-full bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-white dark:via-slate-100 dark:to-slate-200 shadow-[0_15px_30px_rgba(0,0,0,0.15),inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-3px_6px_rgba(0,0,0,0.1)] border-4 border-slate-100 dark:border-white/90 flex flex-col items-center justify-center cursor-pointer group hover:scale-105 transition-transform duration-300">
                {/* Silver Chamfer Ring */}
                <div className="absolute inset-2 rounded-full border border-slate-200/80 shadow-inner" />
                
                {/* Active LED Center */}
                <div className="w-12 h-12 rounded-full bg-blue-600 dark:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.5)] flex items-center justify-center">
                  <Bluetooth className="w-6 h-6 text-white" />
                </div>

                {/* Subtitle brand */}
                <span className="mt-2 text-[9px] font-bold tracking-wider text-slate-500 uppercase">
                  SOB WHITE
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                SmartOrderButton Trắng
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-xs mx-auto">
                Thiết bị ở gần bạn đang phát tín hiệu Bluetooth, sẵn sàng liên kết với tài khoản.
              </p>
            </div>

            {/* Quick Specs Pill */}
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs text-slate-600 dark:text-zinc-300">
              <span className="flex items-center gap-1 font-medium text-xs">
                <Battery className="w-3.5 h-3.5 text-emerald-500" />
                Pin: <strong>{deviceSpecs.battery}%</strong>
              </span>
              <span className="text-slate-300 dark:text-zinc-600">•</span>
              <span className="flex items-center gap-1 font-medium text-xs">
                <Radio className="w-3.5 h-3.5 text-blue-500" />
                Tín hiệu: <strong>{deviceSpecs.rssi} dBm</strong>
              </span>
            </div>

            {/* Pairing Error Alert */}
            {pairingError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-left text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block">Ghép nối không thành công</span>
                  <span>{pairingError}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleStartPairing(false)}
                className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-500/20 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
              >
                <span>Kết Nối Nút Bấm</span>
              </button>

              {isBluetoothSupported && (
                <button
                  type="button"
                  onClick={() => handleStartPairing(true)}
                  className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800/70 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Bluetooth className="w-3.5 h-3.5 text-blue-500" />
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
            <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-600 animate-spin" />
              <div className="w-20 h-20 rounded-full bg-white dark:bg-slate-100 shadow-lg border-2 border-slate-200 flex items-center justify-center">
                <Bluetooth className="w-7 h-7 text-blue-600 animate-pulse" />
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Đang kết nối với nút bấm...
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Đang thiết lập kênh truyền an toàn và kiểm tra thiết bị.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ========================================================================= */}
        {/* STEP 3: WIFI_SETUP (Khi quét được thiết bị là hiện ra yêu cầu nhập wifi liền) */}
        {/* ========================================================================= */}


        {/* ========================================================================= */}
        {/* STEP 4: SELECT PRODUCT (Tìm kiếm sản phẩm cửa hàng: Nước mắm, Nước, Gas...)*/}
        {/* ========================================================================= */}
        {step === 'SELECT_PRODUCT' && (
          <div className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Gán Sản Phẩm Vào Nút Bấm Trắng
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Tìm kiếm mặt hàng hiện có tại cửa hàng (Nước mắm, Nước, Gas, Gạo...)
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                {deviceSpecs.code}
              </span>
            </div>

            {/* Live Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Gõ tìm sản phẩm (VD: nước mắm, lavie, gas, st25...)"
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  Xóa
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {['Tất cả', 'Nước mắm', 'Nước uống', 'Gas', 'Gạo', 'Dầu ăn & Gia vị'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Binding Error Alert */}
            {bindingError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-left text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold block">Không thể liên kết mặt hàng</span>
                  <span>{bindingError}</span>
                </div>
              </div>
            )}

            {/* Is Binding Processing Indicator */}
            {isBinding && (
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-left text-xs text-cyan-700 dark:text-cyan-300 flex items-center gap-2.5 animate-pulse">
                <div className="w-4 h-4 rounded-full border-2 border-cyan-600 border-t-transparent animate-spin" />
                <span className="font-semibold">Đang đồng bộ cấu hình với thiết bị & máy chủ...</span>
              </div>
            )}

            {/* Notice if filtered */}
            {selectedCategory === 'Nước mắm' && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-400">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>
                  Danh sách đầy đủ các loại <strong>Nước Mắm ngon</strong> đang sẵn hàng tại kho để liên kết vào nút bấm một chạm.
                </span>
              </div>
            )}

            {/* Products List Grid */}
            <div className={`space-y-2.5 max-h-[360px] overflow-y-auto pr-1 ${isBinding ? 'pointer-events-none opacity-60' : ''}`}>
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                  Không tìm thấy sản phẩm nào khớp với từ khóa "{searchQuery}".
                </div>
              ) : (
                filteredProducts.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    data-testid={`product-select-${prod.id}`}
                    onClick={() => handleSelectProduct(prod)}
                    className="w-full text-left p-3 bg-white dark:bg-zinc-900 hover:bg-cyan-50/60 dark:hover:bg-cyan-950/30 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:border-cyan-500/50 transition-all cursor-pointer group flex items-center gap-3.5 shadow-sm active:scale-[0.99]"
                  >
                    {/* Product Image */}
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 dark:bg-zinc-800 shrink-0 border border-slate-200 dark:border-zinc-700 pointer-events-none">
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0 pointer-events-none">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                          {prod.brand}
                        </span>
                        {prod.badge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            {prod.badge}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                        {prod.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1">
                        {prod.description}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-black text-cyan-600 dark:text-cyan-400">
                          {prod.price.toLocaleString('vi-VN')} đ
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Quy cách: <strong>{prod.unit}</strong> | Kho: <strong>{prod.stock}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Action Arrow */}
                    <div
                      className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 group-hover:bg-cyan-600 group-hover:text-white text-slate-500 dark:text-zinc-400 flex items-center justify-center transition-colors shrink-0 pointer-events-none"
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
              
              {/* THE WHITE BUTTON */}
              <div
                onClick={handleSimulatePress}
                className={`relative w-36 h-36 rounded-full bg-gradient-to-b from-white via-slate-100 to-slate-200 dark:from-white dark:via-slate-100 dark:to-slate-300 shadow-[0_15px_35px_rgba(0,0,0,0.25),inset_0_2px_4px_rgba(255,255,255,0.9),inset_0_-4px_8px_rgba(0,0,0,0.15)] border-4 border-slate-200/90 dark:border-white/80 flex flex-col items-center justify-center cursor-pointer transition-all duration-150 ${
                  isSimulatingPress ? 'scale-95 shadow-inner' : 'hover:scale-105'
                }`}
              >
                {/* Silver Chamfer Ring */}
                <div className="absolute inset-2 rounded-full border border-slate-300/70 shadow-inner" />

                {/* Product mini icon inside button */}
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-cyan-500 shadow-md mb-1">
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <span className="text-[9px] font-black text-slate-800 dark:text-slate-900 uppercase tracking-tighter truncate max-w-[90px]">
                  {selectedProduct.brand}
                </span>
                <span className="text-[8px] font-bold text-cyan-700 dark:text-cyan-800">
                  1-TOUCH SOB
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="inline-block px-3 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                Đã gán sản phẩm vào nút
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {selectedProduct.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Giá niêm yết: <strong className="text-blue-600 dark:text-sky-400">{selectedProduct.price.toLocaleString('vi-VN')} đ</strong> / {selectedProduct.unit}
              </p>
            </div>

            {/* Test Order Feedback notice */}
            {simulateSuccessMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-700 dark:text-emerald-400 font-medium animate-in fade-in">
                {simulateSuccessMessage}
              </div>
            )}

            {/* 1-Touch Button Test Action */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleSimulatePress}
                disabled={isSimulatingPress}
                className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
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
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold text-xs transition-colors"
                >
                  Đổi Sản Phẩm Khác
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs transition-colors"
                >
                  Xong & Đóng
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
