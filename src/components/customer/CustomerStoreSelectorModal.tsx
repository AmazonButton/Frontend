import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Store,
  Navigation,
  CheckCircle2,
  ShieldCheck,
  Tag,
  X,
  Compass,
  Star,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from '../../context/ToastContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export interface StoreItem {
  id: string;
  name: string;
  code: string;
  ownerName: string;
  phone: string;
  address: string;
  district: string;
  distanceKm: number;
  deliveryMinutes: string;
  rating: number;
  ordersCount: number;
  openHours: string;
  categories: string[];
  featuredProducts: { name: string; price: string }[];
  isVerified: boolean;
}

// Mock curated stores dataset matching backend seed stores + regional hubs
export const MOCK_STORES: StoreItem[] = [
  {
    id: 'store-nfht4',
    name: 'LeBao Store — Đại lý Nước & Nhu yếu phẩm Q7',
    code: 'STORE-NFHT4',
    ownerName: 'Lê Hồ Gia Bảo',
    phone: '0908 556 789',
    address: 'Số 120 Đường Nguyễn Hữu Thọ, P. Tân Phong, Quận 7, TP.HCM',
    district: 'Quận 7',
    distanceKm: 0.8,
    deliveryMinutes: '15 - 20 phút',
    rating: 4.95,
    ordersCount: 1420,
    openHours: '07:00 - 21:30',
    categories: ['WATER', 'ESSENTIALS'],
    featuredProducts: [
      { name: 'Nước Vĩnh Hảo 20L', price: '68.000 đ' },
      { name: 'Nước La Vie 19L', price: '72.000 đ' },
      { name: 'Gạo ST25 5kg', price: '195.000 đ' },
    ],
    isVerified: true,
  },
  {
    id: 'store-gd01',
    name: 'Đại lý Nước & Gas Gia Định',
    code: 'STORE-GD01',
    ownerName: 'Nguyễn Văn Định',
    phone: '0908 112 233',
    address: '142 Nguyễn Thị Minh Khai, P. Bến Nghé, Quận 1, TP.HCM',
    district: 'Quận 1',
    distanceKm: 1.5,
    deliveryMinutes: '20 - 30 phút',
    rating: 4.9,
    ordersCount: 2350,
    openHours: '06:30 - 22:00',
    categories: ['WATER', 'GAS'],
    featuredProducts: [
      { name: 'Bình Gas Gia Đình 12kg', price: '385.000 đ' },
      { name: 'Nước Ion Life 19L', price: '75.000 đ' },
      { name: 'Nước Aquafina 5L', price: '32.000 đ' },
    ],
    isVerified: true,
  },
  {
    id: 'store-petro',
    name: 'Tổng Đại Lý Gas Petrolimex Nam Sài Gòn',
    code: 'STORE-GAS01',
    ownerName: 'Trần Hoàng Long',
    phone: '0938 778 990',
    address: '45 Lê Văn Lương, P. Tân Hưng, Quận 7, TP.HCM',
    district: 'Quận 7',
    distanceKm: 2.2,
    deliveryMinutes: '20 - 35 phút',
    rating: 4.88,
    ordersCount: 1890,
    openHours: '06:00 - 22:00',
    categories: ['GAS'],
    featuredProducts: [
      { name: 'Gas Petrolimex 12kg Xanh', price: '395.000 đ' },
      { name: 'Van điều áp an toàn Đức', price: '220.000 đ' },
    ],
    isVerified: true,
  },
  {
    id: 'store-mk02',
    name: 'Minh Khôi Mart Nhu Yếu Phẩm & Nước Khoáng',
    code: 'STORE-MK02',
    ownerName: 'Lê Minh Khôi',
    phone: '0912 445 566',
    address: '88 Song Hành, Phường An Phú, TP. Thủ Đức, TP.HCM',
    district: 'TP. Thủ Đức',
    distanceKm: 4.5,
    deliveryMinutes: '35 - 50 phút',
    rating: 4.82,
    ordersCount: 880,
    openHours: '07:30 - 21:00',
    categories: ['WATER', 'ESSENTIALS'],
    featuredProducts: [
      { name: 'Thùng nước suối Lavie 500ml', price: '98.000 đ' },
      { name: 'Nước khoáng Đảnh Thạnh 19L', price: '65.000 đ' },
    ],
    isVerified: true,
  },
];

interface CustomerStoreSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStoreCode?: string;
  onStoreSelected: (store: StoreItem) => void;
}

export const CustomerStoreSelectorModal: React.FC<CustomerStoreSelectorModalProps> = ({
  isOpen,
  onClose,
  currentStoreCode,
  onStoreSelected,
}) => {
  // Lock background body scroll whenever modal is open
  useBodyScrollLock(isOpen);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'GPS' | 'STORE_CODE'>('GPS');

  // Tab 1 (GPS / Radius) State
  const [selectedRadius, setSelectedRadius] = useState<number>(3); // km
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [userAddress, setUserAddress] = useState<string>(
    '120 Nguyễn Hữu Thọ, P. Tân Phong, Quận 7, TP.HCM'
  );

  // Tab 2 (Store Code) State
  const [storeCodeInput, setStoreCodeInput] = useState<string>('');
  const [searchedStore, setSearchedStore] = useState<StoreItem | null>(null);
  const [codeLookupError, setCodeLookupError] = useState<string | null>(null);

  // Filtered stores in Tab 1 based on radius and category
  const filteredStores = useMemo(() => {
    return MOCK_STORES.filter((s) => {
      const matchRadius = selectedRadius === 0 || s.distanceKm <= selectedRadius;
      const matchCategory =
        selectedCategory === 'ALL' || s.categories.includes(selectedCategory);
      return matchRadius && matchCategory;
    }).sort((a, b) => a.distanceKm - b.distanceKm);
  }, [selectedRadius, selectedCategory]);

  // Handle GPS Auto-detect
  const handleDetectGPS = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setTimeout(() => {
            setIsLocating(false);
            setUserAddress(
              `Tọa độ (${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}) · Nguyễn Hữu Thọ, P. Tân Phong, Q7`
            );
            toast.success('Đã cập nhật vị trí GPS thành công!');
          }, 600);
        },
        () => {
          setTimeout(() => {
            setIsLocating(false);
            setUserAddress('120 Nguyễn Hữu Thọ, P. Tân Phong, Quận 7, TP.HCM');
            toast.info('Sử dụng vị trí mặc định tại Quận 7, TP.HCM');
          }, 500);
        }
      );
    } else {
      setTimeout(() => {
        setIsLocating(false);
        setUserAddress('120 Nguyễn Hữu Thọ, P. Tân Phong, Quận 7, TP.HCM');
      }, 400);
    }
  };

  // Handle Store Code Search
  const handleSearchStoreCode = (codeToSearch?: string) => {
    const raw = (codeToSearch !== undefined ? codeToSearch : storeCodeInput).trim().toUpperCase();
    if (!raw) {
      setCodeLookupError('Vui lòng nhập mã cửa hàng (Ví dụ: STORE-NFHT4)');
      setSearchedStore(null);
      return;
    }

    setCodeLookupError(null);
    const found = MOCK_STORES.find(
      (s) => s.code.toUpperCase() === raw || s.id.toUpperCase() === raw
    );

    if (found) {
      setSearchedStore(found);
      setStoreCodeInput(found.code);
    } else {
      setSearchedStore(null);
      setCodeLookupError(`Không tìm thấy cửa hàng nào với mã "${raw}". Vui lòng kiểm tra lại.`);
    }
  };

  // Confirm selection
  const handleConfirmStore = (store: StoreItem) => {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#0E6BA8', '#10B981', '#38BDF8'],
    });
    toast.success(`Đã kết nối thành công với "${store.name}"!`);
    onStoreSelected(store);
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden overscroll-contain">
          {/* Smooth Backdrop covering everything including Topbar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm cursor-pointer"
          />

          {/* Main Dialog Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 15 }}
            transition={{
              type: 'spring',
              damping: 28,
              stiffness: 320,
              mass: 0.8,
            }}
            className="relative max-h-[90vh] w-full max-w-2xl flex flex-col bg-white dark:bg-[#111116] rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-200/80 dark:border-zinc-800 overflow-hidden z-10"
          >
        {/* Header (fixed shrink-0) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0E6BA8]/10 dark:bg-[#0E6BA8]/20 flex items-center justify-center text-[#0E6BA8] shrink-0">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Lựa chọn & Kết nối Cửa hàng
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Thiết lập đại lý phục vụ giao hàng trực tiếp cho các nút bấm của bạn
              </p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Segmented Control Tabs with Fluid Animated Sliding Indicator (layoutId="modalMainTabIndicator") */}
        <div className="px-6 py-3 bg-slate-50/80 dark:bg-zinc-900/60 border-b border-slate-100 dark:border-zinc-800 shrink-0">
          <div className="grid grid-cols-2 bg-slate-200/70 dark:bg-zinc-800/90 p-1 rounded-lg text-sm font-medium relative">
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => setActiveTab('GPS')}
              className="relative py-2 px-3 rounded-md text-center cursor-pointer select-none transition-colors"
            >
              {activeTab === 'GPS' && (
                <motion.div
                  layoutId="modalMainTabIndicator"
                  className="absolute inset-0 bg-white dark:bg-zinc-900 rounded-md shadow-sm border border-slate-200/50 dark:border-zinc-700/60"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <span className={`relative z-10 flex items-center justify-center gap-2 ${
                activeTab === 'GPS'
                  ? 'text-[#0E6BA8] dark:text-sky-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}>
                <Navigation className="w-4 h-4 shrink-0" />
                <span>1. Vị trí & Bán kính (GPS)</span>
              </span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => setActiveTab('STORE_CODE')}
              className="relative py-2 px-3 rounded-md text-center cursor-pointer select-none transition-colors"
            >
              {activeTab === 'STORE_CODE' && (
                <motion.div
                  layoutId="modalMainTabIndicator"
                  className="absolute inset-0 bg-white dark:bg-zinc-900 rounded-md shadow-sm border border-slate-200/50 dark:border-zinc-700/60"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
              )}
              <span className={`relative z-10 flex items-center justify-center gap-2 ${
                activeTab === 'STORE_CODE'
                  ? 'text-[#0E6BA8] dark:text-sky-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}>
                <Tag className="w-4 h-4 shrink-0" />
                <span>2. Mã Cửa Hàng (Store Code)</span>
              </span>
            </motion.button>
          </div>
        </div>

        {/* Modal Scrollable Content with Smooth Directional Tab Transitions */}
        <div className="flex-1 overflow-y-auto px-6 py-5 overscroll-contain" data-scrollable="true">
          <AnimatePresence mode="wait">
            {/* ========================================================================= */}
            {/* TAB 1: THEO VỊ TRÍ & BÁN KÍNH GẦN NHẤT (GPS)                              */}
            {/* ========================================================================= */}
            {activeTab === 'GPS' ? (
              <motion.div
                key="tab-gps"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4"
              >
                {/* Clean flat Address Input with embedded GPS button */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                    Địa chỉ giao hàng & Điểm định vị
                  </label>
                  <div className="relative flex items-center">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      value={userAddress}
                      onChange={(e) => setUserAddress(e.target.value)}
                      className="w-full pl-9 pr-32 py-2.5 text-sm bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E6BA8]/20 focus:border-[#0E6BA8] transition-all"
                      placeholder="Nhập địa chỉ nhà của bạn..."
                    />
                    <motion.button
                      whileTap={{ scale: 0.93 }}
                      whileHover={{ scale: 1.03 }}
                      transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                      onClick={handleDetectGPS}
                      disabled={isLocating}
                      type="button"
                      className="absolute right-2 px-3 py-1.5 rounded-md bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-medium text-[#0E6BA8] dark:text-sky-400 shadow-2xs hover:bg-slate-50 dark:hover:bg-zinc-700 cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                      <Compass className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                      <span>{isLocating ? 'Đang quét...' : 'Định vị GPS'}</span>
                    </motion.button>
                  </div>
                </div>

                {/* Filters Bar: Radius & Categories with Fluid Animated Sliding Pills */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Bán kính tìm kiếm:
                    </span>
                    <div className="inline-flex p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-lg relative">
                      {[
                        { label: '< 1 km', val: 1 },
                        { label: '< 3 km', val: 3 },
                        { label: '< 5 km', val: 5 },
                        { label: 'Tất cả', val: 0 },
                      ].map((r) => {
                        const isSelected = selectedRadius === r.val;
                        return (
                          <motion.button
                            key={r.val}
                            whileTap={{ scale: 0.94 }}
                            type="button"
                            onClick={() => setSelectedRadius(r.val)}
                            className="relative text-xs px-3 py-1 rounded-md font-medium cursor-pointer border-none select-none transition-colors"
                          >
                            {isSelected && (
                              <motion.div
                                layoutId="modalRadiusIndicator"
                                className="absolute inset-0 bg-[#0E6BA8] rounded-md shadow-xs"
                                transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                              />
                            )}
                            <span className={`relative z-10 transition-colors ${
                              isSelected
                                ? 'text-white font-semibold'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}>
                              {r.label}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category Filter Chips with Animated Sliding Pill Indicator */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 relative no-scrollbar">
                    {[
                      { id: 'ALL', label: 'Tất cả mặt hàng' },
                      { id: 'WATER', label: 'Nước khoáng 19L / 20L' },
                      { id: 'GAS', label: 'Bình Gas Gia Đình 12kg' },
                      { id: 'ESSENTIALS', label: 'Gạo & Nhu yếu phẩm' },
                    ].map((c) => {
                      const isSelected = selectedCategory === c.id;
                      return (
                        <motion.button
                          key={c.id}
                          whileTap={{ scale: 0.95 }}
                          whileHover={{ scale: 1.02 }}
                          type="button"
                          onClick={() => setSelectedCategory(c.id)}
                          className={`relative text-xs whitespace-nowrap px-3 py-1.5 rounded-lg transition-colors cursor-pointer border select-none ${
                            isSelected
                              ? 'border-[#0E6BA8] text-white font-semibold shadow-xs'
                              : 'border-slate-200/80 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {isSelected && (
                            <motion.div
                              layoutId="modalCategoryIndicator"
                              className="absolute inset-0 bg-[#0E6BA8] rounded-lg -z-0"
                              transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                            />
                          )}
                          <span className="relative z-10">{c.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* List of Nearby Stores */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 px-0.5">
                    <span>Tìm thấy {filteredStores.length} cửa hàng có dịch vụ giao nhanh:</span>
                    <span className="text-[11px]">Sắp xếp theo khoảng cách gần nhất</span>
                  </div>

                  {filteredStores.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="py-10 text-center bg-slate-50/50 dark:bg-zinc-900/30 rounded-xl border border-slate-200/80 dark:border-zinc-800"
                    >
                      <Store className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Không có cửa hàng nào trong bán kính này
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                        Hãy mở rộng bán kính lên 5km hoặc chuyển sang tìm kiếm bằng mã cửa hàng.
                      </p>
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        whileHover={{ scale: 1.03 }}
                        onClick={() => setSelectedRadius(5)}
                        className="mt-3 px-3.5 py-1.5 rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-xs font-medium cursor-pointer transition-colors shadow-xs"
                      >
                        Mở rộng bán kính 5 km
                      </motion.button>
                    </motion.div>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {filteredStores.map((store) => {
                        const isCurrent = currentStoreCode === store.code;
                        return (
                          <motion.div
                            key={store.id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            whileHover={{ y: -2 }}
                            transition={{ duration: 0.2 }}
                            className={`p-4 rounded-xl border transition-all ${
                              isCurrent
                                ? 'bg-[#0E6BA8]/5 dark:bg-[#0E6BA8]/10 border-[#0E6BA8] shadow-xs'
                                : 'bg-white dark:bg-zinc-900/60 border-slate-200/90 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-xs'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                    {store.name}
                                  </h4>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 font-medium">
                                    {store.code}
                                  </span>
                                  {store.isVerified && (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                      <span>Đại lý chính hãng</span>
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                                  <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                  <span>{store.address}</span>
                                </p>

                                {/* Clean, unified metric row without rainbow colors */}
                                <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-medium pt-1 flex-wrap">
                                  <span className="tabular-nums">Cách {store.distanceKm} km</span>
                                  <span>·</span>
                                  <span>{store.deliveryMinutes}</span>
                                  <span>·</span>
                                  <span className="inline-flex items-center gap-1">
                                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 inline" />
                                    <span className="tabular-nums">{store.rating} ({store.ordersCount} đơn)</span>
                                  </span>
                                </div>
                              </div>

                              <div className="shrink-0 pt-0.5">
                                {isCurrent ? (
                                  <motion.span
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/60 text-xs font-semibold"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Đang chọn
                                  </motion.span>
                                ) : (
                                  <motion.button
                                    whileTap={{ scale: 0.93 }}
                                    whileHover={{ scale: 1.04, y: -1 }}
                                    transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                                    onClick={() => handleConfirmStore(store)}
                                    className="px-3.5 py-1.5 rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-xs font-medium shadow-xs cursor-pointer transition-colors"
                                  >
                                    Chọn cửa hàng
                                  </motion.button>
                                )}
                              </div>
                            </div>

                            {/* Flat featured products tags without borders */}
                            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] text-slate-400 font-medium">Mặt hàng sẵn có:</span>
                              {store.featuredProducts.map((p, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs px-2 py-0.5 rounded bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 tabular-nums font-normal"
                                >
                                  {p.name} · <strong className="text-slate-900 dark:text-white font-medium">{p.price}</strong>
                                </span>
                              ))}
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </div>
              </motion.div>
            ) : (
              /* ========================================================================= */
              /* TAB 2: THEO MÃ GIỚI THIỆU / MÃ CỬA HÀNG (STORE CODE)                      */
              /* ========================================================================= */
              <motion.div
                key="tab-store-code"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-4"
              >
                {/* Flat Input Section (NO box inside box) */}
                <div>
                  <label className="block text-sm font-semibold text-slate-900 dark:text-white">
                    Nhập mã định danh cửa hàng (Store Code)
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Mã do chủ đại lý, tài xế giao hàng hoặc ban quản lý chung cư cung cấp cho bạn
                  </p>
                </div>

                <div className="flex gap-2.5">
                  <div className="relative flex-1">
                    <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={storeCodeInput}
                      onChange={(e) => {
                        setStoreCodeInput(e.target.value.toUpperCase());
                        setCodeLookupError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSearchStoreCode();
                      }}
                      placeholder="Ví dụ: STORE-NFHT4 hoặc STORE-GD01"
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm uppercase bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0E6BA8]/20 focus:border-[#0E6BA8] transition-all"
                    />
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                    type="button"
                    onClick={() => handleSearchStoreCode()}
                    className="px-5 py-2.5 rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-sm font-medium shadow-xs cursor-pointer transition-colors shrink-0"
                  >
                    Kiểm tra mã
                  </motion.button>
                </div>

                {/* Error notice */}
                {codeLookupError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-rose-600 dark:text-rose-400 font-medium"
                  >
                    {codeLookupError}
                  </motion.p>
                )}

                {/* Quick suggestion chips (Clean Sans-serif, animated tactile buttons) */}
                <div className="pt-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block mb-2">
                    Gợi ý mã cửa hàng đang hoạt động trong hệ thống:
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { code: 'STORE-NFHT4', label: 'STORE-NFHT4 · LeBao Store Q7' },
                      { code: 'STORE-GD01', label: 'STORE-GD01 · Gia Định Q1' },
                      { code: 'STORE-GAS01', label: 'STORE-GAS01 · Gas Petrolimex Q7' },
                      { code: 'STORE-MK02', label: 'STORE-MK02 · Minh Khôi Thủ Đức' },
                    ].map((s) => {
                      const isSelected = storeCodeInput === s.code;
                      return (
                        <motion.button
                          key={s.code}
                          whileTap={{ scale: 0.94 }}
                          whileHover={{ scale: 1.03, y: -1 }}
                          transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                          type="button"
                          onClick={() => handleSearchStoreCode(s.code)}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer transition-all border ${
                            isSelected
                              ? 'bg-[#0E6BA8]/10 text-[#0E6BA8] border-[#0E6BA8] dark:bg-[#0E6BA8]/20 dark:text-sky-400 font-semibold'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 border-transparent'
                          }`}
                        >
                          {s.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Redesigned Store Preview Card (Clean, subtle slate background, flat 3-column layout) */}
                {searchedStore && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', damping: 26, stiffness: 350 }}
                    className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-5 mt-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            ✓ Đã tìm thấy đại lý chính hãng
                          </span>
                          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-200/70 dark:bg-zinc-800 text-slate-700 dark:text-slate-300">
                            {searchedStore.code}
                          </span>
                        </div>
                        <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                          {searchedStore.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{searchedStore.address}</span>
                        </p>
                      </div>
                    </div>

                    {/* Flat 3-column text grid without white boxes */}
                    <div className="grid grid-cols-3 gap-4 pt-4 mt-4 border-t border-slate-200/60 dark:border-zinc-800">
                      <div>
                        <span className="text-xs text-slate-400 dark:text-slate-500 block mb-0.5">Chủ đại lý</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{searchedStore.ownerName}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 dark:text-slate-500 block mb-0.5">Hotline</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">{searchedStore.phone}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 dark:text-slate-500 block mb-0.5">Giờ phục vụ</span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white tabular-nums">{searchedStore.openHours}</span>
                      </div>
                    </div>

                    {/* Confirm CTA with tactile animation */}
                    <div className="pt-4 mt-2">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        whileHover={{ scale: 1.01 }}
                        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                        onClick={() => handleConfirmStore(searchedStore)}
                        className="w-full py-2.5 px-5 rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-sm font-medium shadow-xs cursor-pointer transition-colors text-center"
                      >
                        Kết nối với đại lý này
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer (fixed shrink-0) */}
        <div className="px-6 py-3.5 bg-slate-50/80 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Đơn hàng từ nút bấm vật lý sẽ được tự động chuyển tới đại lý được chọn
          </span>
          <motion.button
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Đóng
          </motion.button>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>,
document.body
);
};
