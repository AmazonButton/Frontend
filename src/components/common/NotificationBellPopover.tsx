import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  ShoppingBag,
  XCircle,
  Inbox,
} from 'lucide-react';
import { api } from '../../services/api';
import { getSocket } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/OrderSoundContext';
import { useNavigate } from 'react-router-dom';

export interface AppNotification {
  id: string;
  type: 'ORDER_CREATED' | 'ORDER_CANCELLED' | 'ORDER_STATUS_CHANGED' | 'SYSTEM';
  title: string;
  orderNumber?: string;
  orderId?: string;
  productName?: string;
  quantity?: number;
  totalAmount?: number;
  reason?: string;
  customerName?: string;
  status?: string;
  isRead: boolean;
  timestamp: string; // ISO string
}

const STORAGE_KEY = 'sob_realtime_notifications_v3';

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 45) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHour < 24) return `${diffHour} giờ trước`;
    if (diffDay === 1) return 'Hôm qua';
    if (diffDay < 7) return `${diffDay} ngày trước`;
    return new Date(isoString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return 'Vừa xong';
  }
}

export const NotificationBellPopover: React.FC = () => {
  const { user, token, isLoading } = useAuth();
  const { playOrderChime, playCancelChime } = useSound();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'NEW_ORDER' | 'CANCELLED'>('ALL');
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 50)));
    } catch {
      // ignore
    }
  }, [notifications]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Load real historical orders on initial mount
  useEffect(() => {
    if (!user || !token || isLoading) return;
    let isMounted = true;
    const fetchRecentOrders = async () => {
      try {
        const res = await api.get('/orders');
        const ordersData = res.data?.data || res.data || [];
        if (!Array.isArray(ordersData) || ordersData.length === 0) return;

        const realNotifs: AppNotification[] = [];
        ordersData.slice(0, 20).forEach((ord: any) => {
          const firstItem = ord.items?.[0];
          const productName = firstItem?.product?.name || firstItem?.productName || 'Nhu yếu phẩm';
          const qty = firstItem?.quantity || 1;
          const isCancelled = ord.status === 'CANCELLED';
          const orderNum = ord.orderNumber || (ord.id ? String(ord.id).slice(-6) : 'SOB');

          if (isCancelled) {
            realNotifs.push({
              id: `notif_cancel_${ord.id}`,
              type: 'ORDER_CANCELLED',
              title: `Đã hủy #${orderNum}`,
              orderNumber: orderNum,
              orderId: ord.id,
              productName,
              quantity: qty,
              totalAmount: ord.totalAmount,
              reason: ord.cancellationReason || 'Khách hủy trong 60 giây đầu',
              customerName: ord.customerName || ord.customer?.user?.fullName || 'Khách hàng',
              status: 'CANCELLED',
              isRead: true,
              timestamp: ord.cancelledAt || ord.updatedAt || ord.createdAt,
            });
          } else {
            realNotifs.push({
              id: `notif_new_${ord.id}`,
              type: 'ORDER_CREATED',
              title: `Đơn mới #${orderNum}`,
              orderNumber: orderNum,
              orderId: ord.id,
              productName,
              quantity: qty,
              totalAmount: ord.totalAmount,
              customerName: ord.customerName || ord.customer?.user?.fullName || 'Khách hàng',
              status: ord.status,
              isRead: true,
              timestamp: ord.createdAt,
            });
          }
        });

        if (isMounted) {
          setNotifications((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const newToAdd = realNotifs.filter((n) => !existingIds.has(n.id));
            if (newToAdd.length === 0 && prev.length > 0) return prev;
            return [...newToAdd, ...prev].sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          });
        }
      } catch (err: any) {
        if (err?.response?.status !== 401) {
          console.warn('Could not pre-fetch orders for notification bell:', err);
        }
      }
    };

    fetchRecentOrders();
    return () => {
      isMounted = false;
    };
  }, [user, token, isLoading]);

  // Realtime Socket Listener: New Orders & Cancellations
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    const handleOrderCreated = (payload: any) => {
      const order = payload.order || payload;
      const firstItem = order.items?.[0];
      const productName = firstItem?.product?.name || firstItem?.productName || 'Nhu yếu phẩm';
      const qty = firstItem?.quantity || 1;
      const orderNum = order.orderNumber || (order.id ? String(order.id).slice(-6) : 'SOB');

      const newNotif: AppNotification = {
        id: `notif_rt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'ORDER_CREATED',
        title: `Đơn mới #${orderNum}`,
        orderNumber: orderNum,
        orderId: order.id,
        productName,
        quantity: qty,
        totalAmount: order.totalAmount,
        customerName: order.customerName || 'Khách hàng',
        status: order.status || 'PENDING',
        isRead: false,
        timestamp: new Date().toISOString(),
      };

      setNotifications((prev) => [newNotif, ...prev]);
    };

    const handleOrderCancelled = (payload: any) => {
      const orderId = payload.orderId || payload.id;
      const orderNum = payload.orderNumber || (orderId ? String(orderId).slice(-6) : 'SOB');
      const reason = payload.reason || payload.cancellationReason || 'Khách hủy trong 60 giây đầu';

      const cancelNotif: AppNotification = {
        id: `notif_rt_cancel_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'ORDER_CANCELLED',
        title: `Đã hủy #${orderNum}`,
        orderNumber: orderNum,
        orderId,
        productName: payload.productName || 'Đơn hàng',
        reason,
        status: 'CANCELLED',
        isRead: false,
        timestamp: payload.cancelledAt || new Date().toISOString(),
      };

      setNotifications((prev) => [cancelNotif, ...prev]);
    };

    socket.on('ORDER_CREATED', handleOrderCreated);
    socket.on('order:created', handleOrderCreated);
    socket.on('ORDER_CANCELLED', handleOrderCancelled);
    socket.on('order:cancelled', handleOrderCancelled);

    return () => {
      socket.off('ORDER_CREATED', handleOrderCreated);
      socket.off('order:created', handleOrderCreated);
      socket.off('ORDER_CANCELLED', handleOrderCancelled);
      socket.off('order:cancelled', handleOrderCancelled);
    };
  }, [playOrderChime, playCancelChime]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  const newOrderCount = useMemo(() => {
    return notifications.filter((n) => n.type === 'ORDER_CREATED').length;
  }, [notifications]);

  const cancelCount = useMemo(() => {
    return notifications.filter((n) => n.type === 'ORDER_CANCELLED').length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'NEW_ORDER') {
      return notifications.filter((n) => n.type === 'ORDER_CREATED');
    }
    if (activeTab === 'CANCELLED') {
      return notifications.filter((n) => n.type === 'ORDER_CANCELLED');
    }
    return notifications;
  }, [notifications, activeTab]);

  const markAllAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleNotificationClick = (notif: AppNotification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
    );
    setIsOpen(false);

    if (user && ['STORE_OWNER', 'STORE_MANAGER', 'STAFF_ORDER'].includes(user.role)) {
      navigate('/store/dashboard');
    } else {
      navigate('/customer/home');
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* ========================================================================= */}
      {/* 1. BELL BUTTON ICON (SYNCHRONIZED WITH VOLUME & THEME BUTTONS)             */}
      {/* ========================================================================= */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`p-2 rounded-lg transition-all relative group cursor-pointer ${
          isOpen
            ? 'bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-white'
            : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
        }`}
        title="Thông báo đơn hàng & biến động trạng thái"
        aria-label="Thông báo"
      >
        <Bell
          className={`w-4 h-4 transition-transform ${
            unreadCount > 0 ? 'text-slate-700 dark:text-zinc-200' : ''
          } group-hover:scale-110`}
        />

        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs tabular-nums ring-2 ring-white dark:ring-[#0B0F17]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ========================================================================= */}
      {/* 2. POPOVER PANEL (ANCHORED EXACTLY BELOW BELL, 100% OPAQUE BACKGROUND)     */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] z-[90] bg-white dark:bg-[#0c121e] border border-slate-200/90 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden flex flex-col"
          >
            {/* Header: Row 1 */}
            <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Thông báo
              </h3>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  disabled={unreadCount === 0}
                  className={`text-xs font-medium transition-colors ${
                    unreadCount > 0
                      ? 'text-[#0E6BA8] dark:text-sky-400 hover:underline cursor-pointer'
                      : 'text-slate-400 dark:text-zinc-600 cursor-default'
                  }`}
                >
                  Đánh dấu đã đọc
                </button>
              )}
            </div>

            {/* Header: Row 2 (Flat Underlined Tabs) */}
            <div className="flex gap-4 px-4 border-b border-slate-100 dark:border-zinc-800 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`pb-2.5 transition-colors cursor-pointer ${
                  activeTab === 'ALL'
                    ? 'text-[#0F172A] dark:text-white border-b-2 border-[#0F172A] dark:border-white font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                Tất cả ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('NEW_ORDER')}
                className={`pb-2.5 transition-colors cursor-pointer ${
                  activeTab === 'NEW_ORDER'
                    ? 'text-[#0F172A] dark:text-white border-b-2 border-[#0F172A] dark:border-white font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                Đơn mới ({newOrderCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('CANCELLED')}
                className={`pb-2.5 transition-colors cursor-pointer ${
                  activeTab === 'CANCELLED'
                    ? 'text-[#0F172A] dark:text-white border-b-2 border-[#0F172A] dark:border-white font-semibold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                Đơn hủy ({cancelCount})
              </button>
            </div>

            {/* Notification Flat List Body */}
            <div className="divide-y divide-slate-100 dark:divide-zinc-800 max-h-[380px] overflow-y-auto custom-scrollbar">
              {filteredNotifications.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-1.5">
                  <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 flex items-center justify-center">
                    <Inbox className="w-5 h-5 stroke-[1.5]" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Không có thông báo nào
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                    Các biến động đơn hàng mới và đơn hủy sẽ hiển thị tại đây.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const isNewOrder = notif.type === 'ORDER_CREATED';
                  const isCancel = notif.type === 'ORDER_CANCELLED';
                  const rawNum = notif.orderNumber || (notif.orderId ? notif.orderId.slice(-6) : '');
                  const cleanCode = rawNum ? rawNum.replace(/^#/, '') : 'SOB';
                  const shortCode = cleanCode.includes('-') ? cleanCode.split('-').pop() : cleanCode;

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`px-4 py-3 hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors flex gap-3 items-start cursor-pointer relative ${
                        !notif.isRead ? 'bg-slate-50/40 dark:bg-zinc-900/30' : ''
                      }`}
                    >
                      {/* Left Icon: Small circular icon 28x28 */}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          isNewOrder
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}
                      >
                        {isNewOrder ? (
                          <ShoppingBag className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                      </div>

                      {/* Middle Content */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: Title & Relative Time */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="text-xs font-semibold text-slate-900 dark:text-white tabular-nums truncate cursor-help"
                            title={cleanCode !== shortCode ? `Mã đầy đủ: #${cleanCode}` : undefined}
                          >
                            {isNewOrder ? `Đơn mới #${shortCode}` : `Đã hủy #${shortCode}`}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500 whitespace-nowrap shrink-0">
                            {formatRelativeTime(notif.timestamp)}
                          </span>
                        </div>

                        {/* Row 2: Product Name & Price */}
                        <div className="text-xs text-slate-700 dark:text-zinc-300 font-medium truncate mt-0.5">
                          <span>{notif.productName || 'Nhu yếu phẩm'}</span>
                          {notif.quantity && notif.quantity > 1 ? ` (${notif.quantity}x)` : ''}
                          {notif.totalAmount !== undefined && (
                            <span className="text-slate-900 dark:text-white font-semibold ml-1.5 tabular-nums">
                              • {notif.totalAmount.toLocaleString('vi-VN')} đ
                            </span>
                          )}
                        </div>

                        {/* Row 3: Secondary Information */}
                        <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 truncate">
                          {isCancel
                            ? (notif.reason || 'Khách hủy trong 60 giây đầu')
                            : `Khách hàng: ${notif.customerName || 'Đang cập nhật'}`}
                        </div>
                      </div>

                      {/* Unread Indicator Dot */}
                      {!notif.isRead && (
                        <div className="shrink-0 mt-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0E6BA8] dark:bg-sky-400 block" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (user && ['STORE_OWNER', 'STORE_MANAGER'].includes(user.role)) {
                  navigate('/store/dashboard');
                } else {
                  navigate('/customer/home');
                }
              }}
              className="w-full py-2.5 text-center text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white bg-slate-50/60 hover:bg-slate-100 dark:bg-zinc-900/60 dark:hover:bg-zinc-800 border-t border-slate-100 dark:border-zinc-800 block transition-colors cursor-pointer"
            >
              Xem tất cả đơn hàng
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
