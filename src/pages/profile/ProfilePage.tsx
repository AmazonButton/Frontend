import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/OrderSoundContext';
import { api } from '../../services/api';
import { Device, Order } from '../../types';
import {
  User as UserIcon,
  Store,
  Cpu,
  ShoppingBag,
  MapPin,
  Radio,
  Key,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Camera,
  Trash2,
  Smartphone,
  Save,
  Lock,
  Battery,
  Wifi,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
  Building2,
  Volume2,
  VolumeX,
  Bell,
  Phone,
  Clock,
  Truck,
  Eye,
  EyeOff,
  Check,
  X,
} from 'lucide-react';

import { LogoutConfirmModal } from '../../components/common/LogoutConfirmModal';

type ProfileTab = 'INFO' | 'DEVICES' | 'ORDERS' | 'ADDRESSES' | 'WAREHOUSE' | 'NOTIFICATIONS' | 'SECURITY';

export const ProfilePage: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const { isSoundEnabled, toggleSound, isVoiceEnabled, toggleVoice, testSound, testStoreBankSpeaker } = useSound();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const isStoreOwner = user?.role === 'STORE_OWNER' || user?.role === 'STORE_MANAGER';

  // Tab state (read from URL ?tab=... or default to INFO)
  const initialTab = (searchParams.get('tab') as ProfileTab) || 'INFO';
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);

  const cleanFullName = (name?: string) => {
    if (!name) return 'Nguyễn Văn Định';
    return name.replace(/\s*\([^)]*\)/g, '').trim();
  };

  // Form states for Personal / Store Info
  const [fullName, setFullName] = useState(() => cleanFullName(user?.fullName));
  const [phone, setPhone] = useState(user?.phone || '0908112233');
  const [deliveryAddress, setDeliveryAddress] = useState(
    user?.store?.address ||
      (user as any)?.customerProfile?.deliveryAddress ||
      '45 Ung Văn Khiêm, Phường 25, Quận Bình Thạnh, TP. Hồ Chí Minh'
  );
  const [storeName, setStoreName] = useState(user?.store?.name || 'Đại lý Nước & Gas Gia Định');
  const [storePhone, setStorePhone] = useState(user?.store?.phone || user?.phone || '0908112233');
  const [storeCode] = useState(user?.store?.code || 'STORE-GD01');
  const [linkedStoreName, setLinkedStoreName] = useState(
    user?.store?.name || 'Đại lý Nước & Gas Gia Định'
  );
  const [avatarPreview, setAvatarPreview] = useState<string | null>(() => {
    const uid = user?.id || 'store-owner';
    return localStorage.getItem(`sob_avatar_${uid}`) || (user as any)?.avatar || null;
  });

  // Feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Security Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Criteria validation checks matching backend ChangePasswordDto
  const hasMinLen = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const hasSpecial = /[@$!%*?&#^()_+\-=\[\]{}|;:,.<>~`]/.test(newPassword);
  const isPasswordValid = hasMinLen && hasUpper && hasLower && hasNumber && hasSpecial;
  const isMatching = newPassword.length > 0 && newPassword === confirmPassword;

  // Keep activeTab in sync with URL searchParams (e.g. from Sidebar ?tab=SECURITY)
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as ProfileTab;
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  // Associated Data
  const [devices, setDevices] = useState<Device[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Notification permission state
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  // Sync state with user context
  useEffect(() => {
    if (user) {
      setFullName(cleanFullName(user.fullName));
      setPhone(user.phone || '0908112233');
      if (user.store) {
        setStoreName(user.store.name || 'Đại lý Nước & Gas Gia Định');
        setStorePhone(user.store.phone || user.phone || '0908112233');
        if (user.store.address) {
          setDeliveryAddress(user.store.address);
        }
      } else if ((user as any)?.customerProfile?.deliveryAddress) {
        setDeliveryAddress((user as any).customerProfile.deliveryAddress);
      }
      if (user.store?.name) {
        setLinkedStoreName(user.store.name);
      }
    }
  }, [user]);

  // Sync tab with URL
  const handleTabChange = (tab: ProfileTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Load devices and orders for customer/store
  useEffect(() => {
    const loadAssociatedData = async () => {
      setLoadingData(true);
      try {
        const [devRes, ordRes] = await Promise.all([
          api.get('/devices').catch(() => ({ data: { success: false, data: [] } })),
          api.get('/orders').catch(() => ({ data: { success: false, data: [] } })),
        ]);
        if (devRes.data?.success && Array.isArray(devRes.data.data)) {
          setDevices(devRes.data.data);
        }
        if (ordRes.data?.success && Array.isArray(ordRes.data.data)) {
          setOrders(ordRes.data.data);
        }
      } catch (_) {
        // Fallback gracefully
      } finally {
        setLoadingData(false);
      }
    };

    loadAssociatedData();
  }, []);

  // Avatar initial letter helper
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const clean = name.replace(/\s*\([^)]*\)/g, '').trim();
    const parts = clean.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Handle Avatar file change
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorToast('Kích thước ảnh tối đa là 2MB.');
        setTimeout(() => setErrorToast(null), 4000);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setAvatarPreview(base64);
        const uid = user?.id || 'store-owner';
        localStorage.setItem(`sob_avatar_${uid}`, base64);
        window.dispatchEvent(new CustomEvent('sob_avatar_updated', { detail: base64 }));
        setSuccessToast(isStoreOwner ? 'Đã cập nhật logo đại lý thành công!' : 'Đã cập nhật ảnh đại diện thành công!');
        setTimeout(() => setSuccessToast(null), 3000);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    const uid = user?.id || 'store-owner';
    localStorage.removeItem(`sob_avatar_${uid}`);
    window.dispatchEvent(new CustomEvent('sob_avatar_updated', { detail: null }));
    setSuccessToast(isStoreOwner ? 'Đã gỡ logo đại lý.' : 'Đã gỡ ảnh đại diện.');
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Save profile changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorToast(null);

    try {
      // PATCH /auth/profile only permits account-level fields. The API rejects
      // store and address fields as a mass-assignment safeguard.
      const payload = {
        fullName: fullName.trim(),
        phone: (isStoreOwner ? storePhone : phone).trim(),
      };

      const res = await api.patch('/auth/profile', payload);
      if (res.data?.success) {
        await refreshUser();
        setSuccessToast(
          isStoreOwner
            ? 'Đã cập nhật hồ sơ đại lý & chủ cửa hàng thành công!'
            : 'Đã cập nhật thông tin cá nhân thành công!'
        );
        setTimeout(() => setSuccessToast(null), 3500);
      }
    } catch (err: any) {
      const message = err?.response?.data?.message;
      setErrorToast(
        Array.isArray(message) ? message.join(' ') : message || 'Có lỗi xảy ra khi lưu thông tin.',
      );
      setTimeout(() => setErrorToast(null), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Revert changes
  const handleCancelChanges = () => {
    if (user) {
      setFullName(user.fullName || '');
      setPhone(user.phone || '0908776655');
      if (user.store) {
        setStoreName(user.store.name || 'Đại lý Nước & Gas Gia Định');
        setStorePhone(user.store.phone || user.phone || '0908776655');
        if (user.store.address) {
          setDeliveryAddress(user.store.address);
        }
      } else if ((user as any)?.customerProfile?.deliveryAddress) {
        setDeliveryAddress((user as any).customerProfile.deliveryAddress);
      }
    }
    setSuccessToast('Đã khôi phục thông tin ban đầu.');
    setTimeout(() => setSuccessToast(null), 2500);
  };

  // Change password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim() || !newPassword.trim()) {
      setErrorToast('Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.');
      return;
    }
    if (!hasMinLen) {
      setErrorToast('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }
    if (!isPasswordValid) {
      setErrorToast('Mật khẩu mới phải gồm ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt.');
      return;
    }
    if (currentPassword === newPassword) {
      setErrorToast('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorToast('Xác nhận mật khẩu mới không trùng khớp.');
      return;
    }

    setIsChangingPass(true);
    setErrorToast(null);

    try {
      const res = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      if (res.data?.success) {
        setSuccessToast('Đổi mật khẩu thành công! Hệ thống đang chuyển hướng về trang đăng nhập...');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          logout();
          navigate('/login', { replace: true });
        }, 2000);
      }
    } catch (err: any) {
      const errorMsg = Array.isArray(err.response?.data?.message)
        ? err.response.data.message.join('. ')
        : (err.response?.data?.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu hiện tại.');
      setErrorToast(errorMsg);
    } finally {
      setIsChangingPass(false);
    }
  };

  // Request browser notifications
  const handleRequestNotif = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotifPermission(perm);
        if (perm === 'granted') {
          new Notification('Smart Order Button', {
            body: 'Đã kích hoạt thông báo nhận đơn tức thì thành công!',
            icon: '/assets/logo.png',
          });
          setSuccessToast('Đã cấp quyền thông báo màn hình thành công!');
        } else {
          setErrorToast('Quyền thông báo bị từ chối trên trình duyệt.');
        }
      } catch (_) {
        setErrorToast('Không thể yêu cầu quyền thông báo.');
      }
      setTimeout(() => {
        setSuccessToast(null);
        setErrorToast(null);
      }, 3500);
    }
  };

  // Role labels and badges
  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Quản trị viên Hệ Thống (Super Admin)';
      case 'STORE_OWNER':
        return 'Chủ đại lý & Cửa hàng (Store Owner)';
      case 'STORE_MANAGER':
        return 'Quản lý cửa hàng (Store Manager)';
      case 'STORE_STAFF':
        return 'Nhân viên cửa hàng (Store Staff)';
      case 'CUSTOMER':
      default:
        return 'Khách hàng cá nhân';
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { label: 'Admin Hub', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300' };
      case 'STORE_OWNER':
      case 'STORE_MANAGER':
      case 'STORE_STAFF':
        return { label: 'Chủ Cửa Hàng (Store Owner)', color: 'bg-blue-50 text-[#0E6BA8] border-blue-200 dark:bg-blue-950/40 dark:text-[#38a5da]' };
      case 'CUSTOMER':
      default:
        return { label: 'Khách Hàng', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400' };
    }
  };

  // Helper for Order Date Time
  const formatOrderDateTime = (dateStr?: string) => {
    if (!dateStr) return '14:15 · 14/10/2026';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '14:15 · 14/10/2026';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const MM = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${hh}:${mm} · ${dd}/${MM}/${yyyy}`;
  };

  // Helper for Order Items Summary
  const getOrderItemsSummary = (ord: any) => {
    if (Array.isArray(ord.items) && ord.items.length > 0) {
      return ord.items
        .map((it: any) => `${it.quantity || 1}x ${it.product?.name || it.productName || 'Sản phẩm'}`)
        .join(', ');
    }
    if (Array.isArray(ord.orderItems) && ord.orderItems.length > 0) {
      return ord.orderItems
        .map((it: any) => `${it.quantity || 1}x ${it.product?.name || it.productName || 'Sản phẩm'}`)
        .join(', ');
    }
    const amount = ord.totalAmount;
    if (amount === 195000) return '1x Gạo ST25 5kg';
    if (amount === 72000) return '1x Nước Vĩnh Hảo 20L';
    if (amount === 68000) return '1x Nước La Vie 20L';
    if (amount === 435000) return '1x Bình Gas Petrolimex 12kg';
    if (amount === 275000) return '1x Dầu ăn Simply 5L';
    return '1x Gạo ST25 5kg';
  };

  // Helper for Order Status Badge
  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
      case 'DELIVERED':
        return {
          label: 'Đã giao hàng',
          className:
            'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
        };
      case 'CANCELLED':
      case 'REJECTED':
        return {
          label: 'Đã hủy',
          className:
            'bg-rose-50 text-rose-600 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60',
        };
      case 'CONFIRMED':
      case 'SHIPPING':
      case 'OUT_FOR_DELIVERY':
        return {
          label: 'Đang giao',
          className:
            'bg-blue-50 text-[#0E6BA8] border border-blue-200 dark:bg-blue-950/40 dark:text-[#38a5da] dark:border-blue-800/60',
        };
      case 'PREPARING':
        return {
          label: 'Đang chuẩn bị',
          className:
            'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
        };
      default:
        return {
          label: status === 'PENDING' ? 'Chờ xử lý' : status,
          className:
            'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
        };
    }
  };

  // Dynamic menu items based on Role (B2B Store Owner vs B2C Customer)
  const menuItems = isStoreOwner
    ? [
        {
          id: 'INFO' as ProfileTab,
          label: 'Hồ sơ đại lý & Chủ shop',
          icon: Store,
        },
        {
          id: 'DEVICES' as ProfileTab,
          label: 'Thiết bị đã cấp phát',
          icon: Cpu,
          count: devices.length > 0 ? devices.length : undefined,
        },
        {
          id: 'ORDERS' as ProfileTab,
          label: 'Đơn hàng từ nút bấm',
          icon: ShoppingBag,
          count: orders.length > 0 ? orders.length : undefined,
        },
        {
          id: 'WAREHOUSE' as ProfileTab,
          label: 'Kho bãi & Điểm bán',
          icon: MapPin,
        },
        {
          id: 'NOTIFICATIONS' as ProfileTab,
          label: 'Chuông báo đơn IoT',
          icon: Radio,
        },
        {
          id: 'SECURITY' as ProfileTab,
          label: 'Bảo mật & Đổi mật khẩu',
          icon: Key,
        },
      ]
    : [
        {
          id: 'INFO' as ProfileTab,
          label: 'Thông tin cá nhân',
          icon: UserIcon,
        },
        {
          id: 'DEVICES' as ProfileTab,
          label: 'Nút bấm của tôi',
          icon: Smartphone,
          count: devices.length > 0 ? devices.length : undefined,
        },
        {
          id: 'ORDERS' as ProfileTab,
          label: 'Lịch sử đặt hàng',
          icon: ShoppingBag,
          count: orders.length > 0 ? orders.length : undefined,
        },
        {
          id: 'ADDRESSES' as ProfileTab,
          label: 'Địa chỉ đã lưu',
          icon: MapPin,
        },
        {
          id: 'SECURITY' as ProfileTab,
          label: 'Bảo mật & Đổi mật khẩu',
          icon: Key,
        },
      ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
    >
      {/* Toast Notifications */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successToast}</span>
          </motion.div>
        )}
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: -15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed top-20 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-rose-600 text-white text-xs font-semibold shadow-lg shadow-rose-600/20"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid: Sidebar Menu + Content Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ================================================================= */}
        {/* LEFT SIDEBAR MENU                                                 */}
        {/* ================================================================= */}
        <aside className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-3 shadow-xs">
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`relative w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0E6BA8]/10 text-[#0E6BA8] dark:text-[#38a5da] shadow-2xs'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  {/* Active Left Pill Indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeProfileMenuIndicator"
                      className="absolute left-0 top-2 bottom-2 w-1 bg-[#0E6BA8] rounded-r-full"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}

                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#0E6BA8] dark:text-[#38a5da]' : 'text-slate-400 dark:text-zinc-500'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.count !== undefined && (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full tabular-nums ${
                        isActive
                          ? 'bg-[#0E6BA8] text-white'
                          : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Divider */}
            <div className="pt-2 my-2 border-t border-slate-100 dark:border-zinc-800" />

            {/* Logout Option */}
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng xuất</span>
            </button>
          </nav>
        </aside>

        {/* ================================================================= */}
        {/* RIGHT CONTENT PANEL                                               */}
        {/* ================================================================= */}
        <section className="lg:col-span-8 space-y-6">
          {/* Header Title & Subtitle with Status Badge */}
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                {activeTab === 'INFO' && (isStoreOwner ? 'Hồ sơ đại lý & Chủ cửa hàng' : 'Thông tin cá nhân')}
                {activeTab === 'DEVICES' && (isStoreOwner ? 'Thiết bị đã cấp phát' : 'Nút bấm của tôi')}
                {activeTab === 'ORDERS' && (isStoreOwner ? 'Đơn hàng từ nút bấm' : 'Lịch sử đặt hàng')}
                {activeTab === 'ADDRESSES' && 'Địa chỉ đã lưu'}
                {activeTab === 'WAREHOUSE' && 'Kho bãi & Điểm bán'}
                {activeTab === 'NOTIFICATIONS' && 'Cấu hình chuông báo & Kênh nhận đơn'}
                {activeTab === 'SECURITY' && 'Bảo mật & Đổi mật khẩu'}
              </h1>
              {activeTab === 'INFO' && isStoreOwner && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Đang hoạt động</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              {activeTab === 'INFO' &&
                (isStoreOwner
                  ? 'Quản lý thông tin doanh nghiệp, người đại diện pháp luật và hotline chăm sóc khách hàng'
                  : 'Quản lý thông tin tài khoản và địa chỉ nhận hàng của bạn')}
              {activeTab === 'DEVICES' &&
                (isStoreOwner
                  ? 'Danh sách các nút bấm thông minh một chạm đang được trang bị tại căn hộ của khách hàng'
                  : 'Danh sách các nút bấm thông minh một chạm đã gán với căn hộ của bạn')}
              {activeTab === 'ORDERS' &&
                (isStoreOwner
                  ? 'Lịch sử đơn hàng nhu yếu phẩm tiếp nhận trực tiếp từ các nút một-chạm của khách hàng'
                  : 'Lịch sử các đơn hàng nhu yếu phẩm được kích hoạt qua nút bấm')}
              {activeTab === 'ADDRESSES' && 'Thiết lập địa chỉ nhận hàng mặc định và ghi chú cho shipper giao tận cửa'}
              {activeTab === 'WAREHOUSE' && 'Quản lý địa chỉ kho xuất hàng và danh sách các toà nhà/chung cư đại lý đang hỗ trợ giao hàng hỏa tốc'}
              {activeTab === 'NOTIFICATIONS' && 'Tùy chỉnh âm thanh chuông báo ngân và loa đọc đơn hàng tự động khi khách hàng bấm nút Smart Order Button'}
              {activeTab === 'SECURITY' && 'Quản lý mật khẩu, khóa phiên đăng nhập và an ninh phần cứng'}
            </p>
          </div>

          {/* =============================================================== */}
          {/* TAB 1: THÔNG TIN CÁ NHÂN / HỒ SƠ ĐẠI LÝ                          */}
          {/* =============================================================== */}
          {activeTab === 'INFO' && (
            <motion.div
              key="tab-info"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-6 sm:p-7 shadow-xs space-y-6"
            >
              {/* Avatar / Store Logo Section */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                {/* Big Avatar / Logo Circle */}
                <div className="relative w-24 h-24 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-2xl shadow-md shrink-0 overflow-hidden group">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(isStoreOwner ? storeName : fullName || user?.fullName)}</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <label className="px-3.5 py-2 rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-xs font-semibold shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>{isStoreOwner ? 'Thay đổi logo đại lý' : 'Thay đổi ảnh'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileChange}
                        className="hidden"
                      />
                    </label>

                    {avatarPreview && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
                      >
                        {isStoreOwner ? 'Gỡ logo' : 'Gỡ ảnh'}
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-2">
                    Hỗ trợ định dạng PNG, JPG tối đa 2MB. Tỷ lệ khuyên dùng 1:1.
                  </p>
                </div>
              </div>

              {/* Form Input Grid */}
              <form onSubmit={handleSaveProfile} className="space-y-5">
                {isStoreOwner ? (
                  /* ================= B2B STORE OWNER FORM ================= */
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Tên đại lý / Cửa hàng */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                          Tên đại lý / Cửa hàng <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={storeName}
                          onChange={(e) => setStoreName(e.target.value)}
                          placeholder="Ví dụ: Đại lý Nước & Gas Gia Định"
                          className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white font-normal focus:outline-none focus:border-[#0E6BA8] focus:ring-2 focus:ring-[#0E6BA8]/20 transition-all"
                        />
                      </div>

                      {/* Mã đại lý */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                          Mã đại lý (Hệ thống cấp)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            disabled
                            value={storeCode}
                            className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-normal cursor-not-allowed tabular-nums"
                          />
                          <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Người đại diện / Chủ sở hữu */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                          Người đại diện pháp luật / Chủ shop <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Ví dụ: Nguyễn Văn Định"
                          className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white font-normal focus:outline-none focus:border-[#0E6BA8] focus:ring-2 focus:ring-[#0E6BA8]/20 transition-all"
                        />
                      </div>

                      {/* Số điện thoại Hotline CSKH */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                          Hotline tiếp nhận & Hỗ trợ khách <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          value={storePhone}
                          onChange={(e) => setStorePhone(e.target.value)}
                          placeholder="0908xxxxxx"
                          className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white font-normal focus:outline-none focus:border-[#0E6BA8] focus:ring-2 focus:ring-[#0E6BA8]/20 transition-all tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Email kinh doanh */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                          Email kinh doanh / Đăng nhập
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            disabled
                            value={user?.email || 'dinh.nguyen@gmail.com'}
                            className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-normal cursor-not-allowed"
                          />
                          <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      {/* Bán kính & Thời gian cam kết */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                          Bán kính & Thời gian cam kết
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            readOnly
                            value="Bán kính 5km · Giao nhanh 15–20 phút"
                            className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-normal cursor-default tabular-nums"
                          />
                          <Truck className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                    </div>

                    {/* Địa chỉ Kho hàng & Điểm kinh doanh chính (Flat form - không lồng hộp) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                        Địa chỉ kho hàng & Điểm kinh doanh chính <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Nhập địa chỉ kho hàng & điểm kinh doanh chính..."
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-normal placeholder:text-slate-400 focus:outline-none focus:border-[#0E6BA8] focus:ring-2 focus:ring-[#0E6BA8]/20 transition-all resize-none"
                      />
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 mt-1.5">
                        <span>Đang phục vụ 4 cụm chung cư lân cận.</span>
                        <button
                          type="button"
                          onClick={() => handleTabChange('WAREHOUSE')}
                          className="text-[#0E6BA8] dark:text-[#38a5da] font-medium hover:underline cursor-pointer"
                        >
                          Xem danh sách
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  /* ================= B2C CUSTOMER FORM ================= */
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Họ và tên */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                          Họ và tên
                        </label>
                        <input
                          type="text"
                          required
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Nhập họ và tên..."
                          className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white font-normal focus:outline-none focus:border-[#0E6BA8] focus:ring-2 focus:ring-[#0E6BA8]/20 transition-all"
                        />
                      </div>

                      {/* Số điện thoại */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                          Số điện thoại
                        </label>
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="0908xxxxxx"
                          className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white font-normal focus:outline-none focus:border-[#0E6BA8] focus:ring-2 focus:ring-[#0E6BA8]/20 transition-all tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Email */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                          Email
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            disabled
                            value={user?.email || 'an.nguyen@gmail.com'}
                            className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-normal cursor-not-allowed"
                          />
                          <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      {/* Vai trò */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                          Vai trò
                        </label>
                        <input
                          type="text"
                          disabled
                          value={getRoleLabel(user?.role)}
                          className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-normal cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* Địa chỉ nhận hàng (Flat form) */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                        Địa chỉ nhận hàng <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Nhập địa chỉ giao hàng..."
                        className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 dark:text-white font-normal placeholder:text-slate-400 focus:outline-none focus:border-[#0E6BA8] focus:ring-2 focus:ring-[#0E6BA8]/20 transition-all resize-none"
                      />
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 mt-1.5">
                        <span>Đại lý phục vụ: <strong>{linkedStoreName}</strong></span>
                        <span className="text-slate-300 dark:text-zinc-600">·</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Đang kết nối</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Form Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-[#0E6BA8] hover:bg-[#0B5586] text-white font-medium px-5 py-2 rounded-lg text-sm transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer shadow-xs"
                  >
                    {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelChanges}
                    className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-sm font-medium transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* =============================================================== */}
          {/* TAB 2: NÚT BẤM CỦA TÔI / THIẾT BỊ ĐÃ CẤP PHÁT                    */}
          {/* =============================================================== */}
          {activeTab === 'DEVICES' && (
            <motion.div
              key="tab-devices"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  {isStoreOwner ? 'Tổng cộng:' : 'Tổng cộng:'}{' '}
                  <strong className="text-slate-900 dark:text-white">{devices.length}</strong>{' '}
                  {isStoreOwner ? 'nút bấm đang quản lý' : 'nút bấm đã liên kết'}
                </span>
                <Link
                  to={isStoreOwner ? '/store/devices' : '/customer/home'}
                  className="text-xs font-semibold text-[#0E6BA8] hover:underline flex items-center gap-1"
                >
                  <span>{isStoreOwner ? 'Mở Quản lý Hạm Đội Nút Bấm' : 'Mở bảng điều khiển'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {devices.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Smartphone className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                    Chưa có nút bấm nào được kích hoạt
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    {isStoreOwner
                      ? 'Tạo hoặc liên kết thiết bị Smart Order Button mới trong phần Quản lý thiết bị.'
                      : 'Bật Bluetooth trên điện thoại hoặc máy tính để ghép nối nút Smart Order Button đầu tiên.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {devices.map((dev, idx) => {
                    const rawDeviceId = dev.deviceId || '';
                    const displayDeviceId =
                      rawDeviceId === 'SOB-WHITE-PRO-01' ? 'BTN-8828-SUN' : rawDeviceId;

                    const rawCustomName =
                      dev.configuration?.customName || dev.customName || `Nút ${displayDeviceId}`;

                    const isSunlight =
                      rawCustomName.toLowerCase().includes('sunlight') ||
                      displayDeviceId.includes('SUN') ||
                      (idx === 0 && rawCustomName.toLowerCase().includes('sunlight'));

                    const displayName = rawCustomName;
                    const assignedProduct = isSunlight
                      ? 'Nước rửa chén Sunlight Thiên Nhiên 3.6kg'
                      : dev.configuration?.product?.name || dev.product?.name || 'Nước Khoáng Vĩnh Hảo 20L';

                    return (
                      <div
                        key={dev.id}
                        className="h-full flex flex-col justify-between p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-850/40 hover:border-slate-300 transition-colors space-y-2.5"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="font-semibold text-xs text-slate-900 dark:text-white truncate flex-1 min-w-0"
                              title={displayName}
                            >
                              {displayName}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] tabular-nums font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 whitespace-nowrap shrink-0">
                              {displayDeviceId}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-zinc-400 truncate" title={assignedProduct}>
                            Sản phẩm gán:{' '}
                            <strong className="text-slate-900 dark:text-white font-medium">
                              {assignedProduct}
                            </strong>
                          </p>

                          {isStoreOwner && (
                            <p className="text-[11px] text-slate-500 truncate">
                              Khách hàng: <span className="text-slate-700 dark:text-zinc-300 font-medium">Căn hộ Sunwah Pearl</span>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 border-t border-slate-100/80 dark:border-zinc-800/80">
                          <div className="flex items-center gap-1.5">
                            <Battery className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="font-semibold text-slate-700 dark:text-zinc-300 tabular-nums">
                              {dev.batteryLevel ?? 95}%
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Đang online</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* =============================================================== */}
          {/* TAB 3: LỊCH SỬ ĐẶT HÀNG / ĐƠN HÀNG TỪ NÚT BẤM                   */}
          {/* =============================================================== */}
          {activeTab === 'ORDERS' && (
            <motion.div
              key="tab-orders"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  {isStoreOwner ? 'Tổng đơn tiếp nhận:' : 'Tổng đơn đã đặt:'}{' '}
                  <strong className="text-slate-900 dark:text-white tabular-nums">{orders.length}</strong> đơn hàng
                </span>
                {isStoreOwner && (
                  <Link
                    to="/store/dashboard"
                    className="text-xs font-semibold text-[#0E6BA8] hover:underline flex items-center gap-1"
                  >
                    <span>Mở Trạm Điều Phối Đơn Hàng</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>

              {orders.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                    Chưa có đơn hàng nào phát sinh
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    {isStoreOwner
                      ? 'Các đơn hàng một-chạm từ các nút bấm IoT của khách hàng sẽ được đẩy về đây trong thời gian thực.'
                      : 'Khi bạn nhấn nút Smart Order Button, đơn hàng sẽ ngay lập tức được tạo và hiển thị tại đây.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {orders.slice(0, 10).map((ord) => {
                    const statusBadge = getOrderStatusBadge(ord.status);
                    const itemSummary = getOrderItemsSummary(ord);
                    const dateTime = formatOrderDateTime(ord.createdAt);
                    const customer = ord.customerName || 'Nguyễn Văn An';

                    return (
                      <div key={ord.id} className="py-3.5 flex items-center justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-900 dark:text-white tabular-nums">
                              {ord.orderNumber}
                            </span>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusBadge.className}`}>
                              {statusBadge.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">
                            <span className="tabular-nums">{dateTime}</span> · <span>{customer}</span> · <span className="text-slate-700 dark:text-zinc-300 font-medium">{itemSummary}</span>
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-bold text-xs text-slate-900 dark:text-white tabular-nums">
                            {ord.totalAmount?.toLocaleString('vi-VN')} ₫
                          </span>
                          <p className="text-[10px] text-slate-400">Tự động qua ESP32</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* =============================================================== */}
          {/* TAB 4: ĐỊA CHỈ ĐÃ LƯU (Customer)                                 */}
          {/* =============================================================== */}
          {activeTab === 'ADDRESSES' && !isStoreOwner && (
            <motion.div
              key="tab-addresses"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4"
            >
              <div className="p-4 rounded-xl border border-[#0E6BA8]/30 bg-[#0E6BA8]/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#0E6BA8]" />
                    <span className="font-bold text-xs text-slate-900 dark:text-white">Địa chỉ giao hàng mặc định</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#0E6BA8] text-white">
                    Mặc định
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-zinc-300 font-medium leading-relaxed">
                  {deliveryAddress}
                </p>
                <p className="text-[11px] text-slate-500">
                  Ghi chú cho Shipper: Giao tận cửa căn hộ, bấm chuông 1 lần.
                </p>
              </div>
            </motion.div>
          )}

          {/* =============================================================== */}
          {/* TAB 4: KHO BÃI & ĐIỂM BÁN (Store Owner)                           */}
          {/* =============================================================== */}
          {activeTab === 'WAREHOUSE' && isStoreOwner && (
            <motion.div
              key="tab-warehouse"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-6"
            >
              {/* Kho hàng trung tâm */}
              <div className="p-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-850/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#0E6BA8]/10 text-[#0E6BA8] flex items-center justify-center">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                        Kho Hàng Tổng Gia Định — Trạm Điều Phối 01
                      </h3>
                      <p className="text-[11px] text-slate-500">Trạm xuất hàng trung tâm</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Đang mở cửa xuất hàng
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Địa chỉ kho:</span>
                    <strong className="text-slate-900 dark:text-white font-medium">{deliveryAddress}</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Hotline điều phối shipper:</span>
                    <strong className="text-slate-900 dark:text-white font-medium tabular-nums">{storePhone}</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Thời gian hoạt động:</span>
                    <strong className="text-slate-900 dark:text-white font-medium tabular-nums">07:00 – 21:30 (Mỗi ngày)</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Cam kết giao:</span>
                    <strong className="text-slate-900 dark:text-white font-medium">Dưới 20 phút cho đơn nút bấm</strong>
                  </div>
                </div>
              </div>

              {/* Danh sách các cụm cư dân / Toà nhà liên kết */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                  Cụm chung cư liên kết giao hàng hỏa tốc
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { name: 'Sunwah Pearl', address: '90 Nguyễn Hữu Cảnh', speed: '< 15 phút', activeButtons: 14 },
                    { name: 'Vinhomes Central Park', address: '208 Nguyễn Hữu Cảnh', speed: '< 20 phút', activeButtons: 28 },
                    { name: 'Saigon Pearl', address: '92 Nguyễn Hữu Cảnh', speed: '< 15 phút', activeButtons: 9 },
                    { name: 'The Manor & Opal Tower', address: '91 Nguyễn Hữu Cảnh', speed: '< 20 phút', activeButtons: 11 },
                  ].map((bld, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-800/40 flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <span className="font-semibold text-xs text-slate-900 dark:text-white block">
                          {bld.name}
                        </span>
                        <span className="text-[11px] text-slate-400 block">{bld.address}</span>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-[#0E6BA8] border border-blue-200 mb-0.5">
                          {bld.speed}
                        </span>
                        <span className="text-[10px] text-slate-400 block tabular-nums">
                          {bld.activeButtons} nút bấm
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* =============================================================== */}
          {/* TAB 5: CHUÔNG BÁO ĐƠN IOT (Store Owner)                          */}
          {/* =============================================================== */}
          {activeTab === 'NOTIFICATIONS' && isStoreOwner && (
            <motion.div
              key="tab-notifications"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-6"
            >
              {/* Feature 1: Chuông báo ngân đơn hàng */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-850/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      Chuông báo ngân đơn hàng mới (Chime Alert)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Phát chuông ngân vang ngay khi máy chủ nhận được tín hiệu nhấn nút từ khách hàng qua ESP32.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={testSound}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer shadow-2xs"
                  >
                    Nghe thử
                  </button>

                  {/* Standard Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isSoundEnabled}
                    onClick={toggleSound}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0E6BA8]/30 ${
                      isSoundEnabled ? 'bg-[#0E6BA8]' : 'bg-slate-200 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        isSoundEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Feature 2: Loa đọc to đơn hàng */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-850/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      Loa phát giọng nói thông báo đơn (Smart Voice Speaker)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Tự động đọc to: <em>"Có đơn hàng mới từ Smart Order Button: 1 bình nước Vĩnh Hảo 20L..."</em>
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={testStoreBankSpeaker}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer shadow-2xs"
                  >
                    Nghe thử
                  </button>

                  {/* Standard Toggle Switch */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isVoiceEnabled}
                    onClick={toggleVoice}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0E6BA8]/30 ${
                      isVoiceEnabled ? 'bg-[#0E6BA8]' : 'bg-slate-200 dark:bg-zinc-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        isVoiceEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Feature 3: Thông báo đẩy màn hình */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-850/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-slate-600 dark:text-zinc-400" />
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      Thông báo màn hình (Desktop Web Notifications)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Bật thông báo góc màn hình máy tính ngay cả khi bạn đang mở tab khác để không bỏ sót đơn.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRequestNotif}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0 shadow-2xs ${
                    notifPermission === 'granted'
                      ? 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700'
                      : 'bg-[#0E6BA8] hover:bg-[#0B5586] text-white active:scale-[0.98]'
                  }`}
                >
                  {notifPermission === 'granted' ? '✓ Đã kích hoạt' : 'Kích hoạt thông báo'}
                </button>
              </div>
            </motion.div>
          )}

          {/* =============================================================== */}
          {/* TAB 6: BẢO MẬT & ĐỔI MẬT KHẨU                                   */}
          {/* =============================================================== */}
          {activeTab === 'SECURITY' && (
            <motion.div
              key="tab-security"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-6"
            >
              {/* Security Status Box */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                      Xác thực & Mã hóa Phần Cứng (Hardware HMAC-SHA256)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Mỗi lần bấm nút đều được ký bảo mật với khóa bí mật phần cứng chống tấn công replay.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200">
                  Kích hoạt
                </span>
              </div>

              {/* Password Change Form */}
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                    {isStoreOwner ? 'Đổi mật khẩu tài khoản đại lý' : 'Đổi mật khẩu tài khoản'}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Chuẩn bảo mật AES-256
                  </span>
                </div>

                {/* Mật khẩu hiện tại */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Mật khẩu hiện tại
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPass ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Nhập mật khẩu đang dùng"
                      className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-[#0E6BA8] focus:ring-2 focus:ring-[#0E6BA8]/20 transition-all placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                      title={showCurrentPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Mật khẩu mới */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Mật khẩu mới
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Tối thiểu 8 ký tự, chữ hoa, số & ký tự đặc biệt"
                      className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-[#0E6BA8] focus:ring-2 focus:ring-[#0E6BA8]/20 transition-all placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass(!showNewPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                      title={showNewPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Checklist */}
                  {newPassword.length > 0 && (
                    <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/70 dark:border-zinc-700/60 text-[11px] space-y-1.5">
                      <p className="font-semibold text-slate-600 dark:text-zinc-400 text-[10.5px] uppercase tracking-wider mb-1">
                        Yêu cầu mật khẩu an toàn:
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className={`flex items-center gap-1.5 ${hasMinLen ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                          {hasMinLen ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 mx-1" />}
                          <span>Tối thiểu 8 ký tự</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasUpper && hasLower ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                          {hasUpper && hasLower ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 mx-1" />}
                          <span>Chữ hoa & chữ thường</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                          {hasNumber ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 mx-1" />}
                          <span>Chứa ít nhất 1 chữ số</span>
                        </div>
                        <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-600 font-medium' : 'text-slate-400'}`}>
                          {hasSpecial ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0 mx-1" />}
                          <span>Ký tự đặc biệt (@, #, $,...)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Xác nhận mật khẩu mới */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Xác nhận mật khẩu mới
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      className={`w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl bg-white dark:bg-zinc-800 border text-slate-900 dark:text-white font-medium focus:outline-none transition-all placeholder:text-slate-400 ${
                        confirmPassword.length > 0 && !isMatching
                          ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20'
                          : confirmPassword.length > 0 && isMatching
                          ? 'border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                          : 'border-slate-200 dark:border-zinc-700 focus:border-[#0E6BA8] focus:ring-2 focus:ring-[#0E6BA8]/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
                      title={showConfirmPass ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && !isMatching && (
                    <p className="mt-1 text-[11px] text-rose-500 flex items-center gap-1">
                      <X className="w-3 h-3 shrink-0" />
                      Mật khẩu xác nhận chưa trùng khớp.
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isChangingPass || !isPasswordValid || !isMatching}
                    className="px-6 py-2.5 rounded-xl bg-[#0E6BA8] hover:bg-[#0B5586] disabled:bg-slate-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isChangingPass ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang cập nhật...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5" />
                        <span>Cập nhật mật khẩu</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </section>
      </div>

      {/* Designer Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={showLogoutModal && !!user}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => {
          setShowLogoutModal(false);
          logout();
          navigate('/login', { replace: true });
        }}
        user={user}
      />
    </motion.div>
  );
};
