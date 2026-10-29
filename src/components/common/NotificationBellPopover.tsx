// @refresh reset
// Reset this development-only refresh boundary when its hook layout changes.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  ShoppingBag,
  XCircle,
  Inbox,
  Cpu,
  Store,
  Wallet,
  Truck,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import { getSocket, subscribeToStore, subscribeToCustomer } from '../../services/socket';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/OrderSoundContext';
import { toast } from '../../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { normalizeOrder, normalizeOrderEvent, ORDER_EVENT, orderEventKey } from '../../services/order-events';
import { useOrderSync } from '../../hooks/useOrderSync';
import { getUserStoreId } from '../../services/order-reconciliation';
import { getOrderItemsSummary, getOrderNotificationMessage, ORDER_NOTIFICATION_DURATION } from '../../services/order-notifications';

export interface AppNotification {
  id: string;
  type:
    | 'ORDER_CREATED'
    | 'ORDER_CANCELLED'
    | 'ORDER_STATUS_CHANGED'
    | 'ORDER_DELIVERED'
    | 'SYSTEM'
    | 'DEVICES_ALLOCATED'
    | 'DEVICE_ASSIGNED'
    | 'STORE_PENDING'
    | 'WITHDRAWAL_PENDING';
  roleScope: 'CUSTOMER' | 'STORE' | 'ADMIN';
  title: string;
  orderNumber?: string;
  orderId?: string;
  productName?: string;
  itemsSummary?: string;
  quantity?: number;
  totalAmount?: number;
  reason?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  storeName?: string;
  status?: string;
  isRead: boolean;
  timestamp: string; // ISO string
}

function getNotificationStorageKey(user: any): string {
  if (!user) return 'sob_notifs_guest';
  const role = user.role || 'GUEST';
  const uid = user.id || user.userId || 'anon';
  return `sob_notifs_${uid}_${role}`;
}

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
  const { playOrderChime, playCancelChime, announceStoreOrder } = useSound();
  useOrderSync();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('ALL');

  const isAdmin = Boolean(user && ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'ADMIN'].includes(user.role));
  const isStore = Boolean(user && ['STORE_OWNER', 'STORE_MANAGER', 'STORE_STAFF', 'STAFF_ORDER', 'STAFF_INVENTORY', 'STAFF_BUTTON', 'STAFF_DELIVERY'].includes(user.role));
  const isCustomer = Boolean(user && user.role === 'CUSTOMER');
  const storeId = getUserStoreId(user);

  const storageKey = useMemo(() => getNotificationStorageKey(user), [user]);

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [notificationOwner, setNotificationOwner] = useState(storageKey);

  const containerRef = useRef<HTMLDivElement>(null);
  const seenOrderEvents = useRef(new Set<string>());
  const acceptOrderEvent = (type: string, payload: any) => {
    const key = orderEventKey(type, payload);
    if (seenOrderEvents.current.has(key)) return false;
    seenOrderEvents.current.add(key);
    return true;
  };

  // When user account or role changes, reload strictly that user's notifications
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const rows = saved ? JSON.parse(saved) : [];
      setNotifications(rows);
      setNotificationOwner(storageKey);
      seenOrderEvents.current = new Set(rows.map((row: AppNotification) => row.id));
    } catch {
      setNotifications([]);
      setNotificationOwner(storageKey);
      seenOrderEvents.current.clear();
    }
    setActiveTab('ALL');
  }, [storageKey]);

  // Sync to user-scoped localStorage
  useEffect(() => {
    try {
      if (notificationOwner !== storageKey) return;
      localStorage.setItem(storageKey, JSON.stringify(notifications.slice(0, 50)));
    } catch {}
  }, [notifications, storageKey, notificationOwner]);

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

  const isFetchingRef = useRef(false);

  // Load role-specific historical notifications on initial mount
  useEffect(() => {
    if (!user || !token || isLoading) return;
    let isMounted = true;

    const fetchRoleNotifications = async () => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      try {
        const realNotifs: AppNotification[] = [];

        // ========================================================
        // 1. ADMIN SCOPE: Stores pending & Withdrawals pending ONLY
        // (Never load store order details for Admin)
        // ========================================================
        if (isAdmin) {
          const [storesRes, withdrawalsRes] = await Promise.all([
            api.get('/admin/stores/pending').catch(() => ({ data: { data: [] } })),
            api.get('/admin/withdrawals').catch(() => ({ data: { data: [] } })),
          ]);

          const pendingStores = storesRes.data?.data || storesRes.data || [];
          if (Array.isArray(pendingStores)) {
            pendingStores.forEach((st: any) => {
              realNotifs.push({
                id: `notif_store_pending_${st.storeId || st.id}`,
                type: 'STORE_PENDING',
                roleScope: 'ADMIN',
                title: `Cửa hàng chờ duyệt: ${st.name}`,
                storeName: st.name,
                productName: `Chủ đại lý: ${st.ownerName || st.phone || 'Điểm bán'} • ${st.address || 'Đang cập nhật'}`,
                status: 'PENDING_APPROVAL',
                isRead: false,
                timestamp: st.createdAt || new Date().toISOString(),
              });
            });
          }

          const allWithdrawals = withdrawalsRes.data?.data || withdrawalsRes.data || [];
          if (Array.isArray(allWithdrawals)) {
            allWithdrawals
              .filter((w: any) => w.status === 'PENDING')
              .slice(0, 10)
              .forEach((w: any) => {
                const amount = Number(w.amount || 0);
                realNotifs.push({
                  id: `notif_withd_pending_${w.id}`,
                  type: 'WITHDRAWAL_PENDING',
                  roleScope: 'ADMIN',
                  title: `Yêu cầu rút tiền #${String(w.id).slice(-4)}`,
                  storeName: w.store?.name || 'Cửa hàng',
                  productName: `${w.store?.name || 'Cửa hàng'} yêu cầu rút ${amount.toLocaleString('vi-VN')}₫`,
                  totalAmount: amount,
                  status: 'PENDING',
                  isRead: false,
                  timestamp: w.createdAt || new Date().toISOString(),
                });
              });
          }
        }

        // ========================================================
        // 2. STORE OWNER SCOPE: Only orders of this store & devices
        // ========================================================
        else if (isStore) {
          const [ordersRes, devicesRes] = await Promise.all([
            api.get('/orders').catch(() => ({ data: { data: [] } })),
            api.get('/devices').catch(() => ({ data: { data: [] } })),
          ]);

          const ordersData = ordersRes.data?.data || ordersRes.data || [];
          const devicesData = devicesRes?.data?.data || devicesRes?.data || [];

          if (Array.isArray(ordersData)) {
            ordersData.slice(0, 25).map(normalizeOrder).forEach((ord: any) => {
              const firstItem = ord.items?.[0];
              const productName = firstItem?.product?.name || firstItem?.productName || 'Nhu yếu phẩm';
              const qty = firstItem?.quantity || 1;
              const isCancelled = ['CANCELLED', 'REJECTED'].includes(ord.status);
              const orderNum = ord.orderNumber || (ord.id ? String(ord.id).slice(-6) : 'SOB');

              if (isCancelled) {
                realNotifs.push({
                  id: orderEventKey('ORDER_CANCELLED', ord),
                  type: 'ORDER_CANCELLED',
                  roleScope: 'STORE',
                  title: `Đã hủy #${orderNum}`,
                  orderNumber: orderNum,
                  orderId: ord.id,
                  productName,
                  quantity: qty,
                  totalAmount: ord.totalAmount,
                  reason: ord.cancellationReason || 'Khách hủy đơn',
                  customerName: ord.customerName || ord.customer?.user?.fullName || 'Khách hàng',
                  customerPhone: ord.customerPhone,
                  deliveryAddress: ord.deliveryAddress,
                  status: ord.status,
                  isRead: true,
                  timestamp: ord.cancelledAt || ord.updatedAt || ord.createdAt,
                });
              } else {
                realNotifs.push({
                  id: orderEventKey('ORDER_CREATED', ord),
                  type: 'ORDER_CREATED',
                  roleScope: 'STORE',
                  title: `Đơn mới #${orderNum}`,
                  orderNumber: orderNum,
                  orderId: ord.id,
                  productName,
                  quantity: qty,
                  totalAmount: ord.totalAmount,
                  customerName: ord.customerName || ord.customer?.user?.fullName || 'Khách hàng',
                  customerPhone: ord.customerPhone,
                  deliveryAddress: ord.deliveryAddress,
                  status: ord.status,
                  isRead: true,
                  timestamp: ord.createdAt,
                });
              }
            });
          }

          if (Array.isArray(devicesData) && devicesData.length > 0) {
            const now = Date.now();
            const recentAllocated = devicesData.filter((d: any) => {
              const updatedTime = new Date(d.updatedAt || d.createdAt).getTime();
              return now - updatedTime < 48 * 60 * 60 * 1000 && (!d.customerId || d.customerId === 'null');
            });

            if (recentAllocated.length > 0) {
              const codes = recentAllocated.map((d: any) => d.buttonCode || d.deviceId).slice(0, 4).join(', ');
              realNotifs.push({
                id: `notif_alloc_init_${recentAllocated.length}`,
                type: 'DEVICES_ALLOCATED',
                roleScope: 'STORE',
                title: `Bàn giao ${recentAllocated.length} nút bấm mới!`,
                productName: `Mã nút: ${codes}${recentAllocated.length > 4 ? '...' : ''}`,
                status: 'ACTIVE',
                isRead: true,
                timestamp: recentAllocated[0].updatedAt || recentAllocated[0].createdAt || new Date().toISOString(),
              });
            }
          }
        }

        // ========================================================
        // 3. CUSTOMER SCOPE: Only personal orders of this customer
        // ========================================================
        else if (isCustomer) {
          const ordersRes = await api.get('/orders').catch(() => ({ data: { data: [] } }));
          const ordersData = ordersRes.data?.data || ordersRes.data || [];

          if (Array.isArray(ordersData)) {
            ordersData.slice(0, 25).map(normalizeOrder).forEach((ord: any) => {
              const firstItem = ord.items?.[0];
              const productName = firstItem?.product?.name || firstItem?.productName || 'Sản phẩm';
              const qty = firstItem?.quantity || 1;
              const orderNum = ord.orderNumber || (ord.id ? String(ord.id).slice(-6) : 'SOB');
              const awaitingPayOS = String(ord.paymentMethod || '').toUpperCase() === 'PAYOS'
                && String(ord.paymentStatus || '').toUpperCase() !== 'PAID';

              let title = awaitingPayOS
                ? `Đơn hàng #${orderNum} đang chờ thanh toán PayOS`
                : `Đặt hàng thành công #${orderNum}`;
              let type: AppNotification['type'] = 'ORDER_CREATED';

              if (['CANCELLED', 'REJECTED'].includes(ord.status)) {
                title = `Đơn hàng #${orderNum} đã hủy`;
                type = 'ORDER_CANCELLED';
              } else if (ord.status === 'DELIVERED') {
                title = `Đơn hàng #${orderNum} đã giao thành công`;
                type = 'ORDER_DELIVERED';
              } else if (['SHIPPING', 'OUT_FOR_DELIVERY'].includes(ord.status)) {
                title = `Đơn hàng #${orderNum} đang được giao`;
                type = 'ORDER_STATUS_CHANGED';
              } else if (ord.status === 'CONFIRMED') {
                title = `Đơn hàng #${orderNum} đã được xác nhận`;
                type = 'ORDER_STATUS_CHANGED';
              }

              realNotifs.push({
                id: orderEventKey(type, ord),
                type,
                roleScope: 'CUSTOMER',
                title,
                orderNumber: orderNum,
                orderId: ord.id,
                productName,
                quantity: qty,
                totalAmount: ord.totalAmount,
                reason: ord.cancellationReason,
                customerName: ord.customerName,
                customerPhone: ord.customerPhone,
                deliveryAddress: ord.deliveryAddress,
                status: ord.status,
                isRead: true,
                timestamp: ord.updatedAt || ord.createdAt,
              });
            });
          }
        }

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
          void err; // Non-critical pre-fetch
        }
      } finally {
        isFetchingRef.current = false;
      }
    };

    fetchRoleNotifications();
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.role, token, isLoading, isAdmin, isStore, isCustomer]);

  // Realtime Socket Listeners: Strict Role Scoping
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    const resolveItemsSummary = (ord: any) => {
      try {
        if (typeof getOrderItemsSummary === 'function') return getOrderItemsSummary(ord);
      } catch {}
      return (ord?.items || []).map((item: any) => ((item.quantity || 1) + '× ' + (item.productName || item.product?.name || 'Sản phẩm'))).join(', ');
    };
    const resolveNotificationMessage = (p: any, fallback: string) => {
      try {
        if (typeof getOrderNotificationMessage === 'function') return getOrderNotificationMessage(p);
      } catch {}
      return fallback;
    };
    const notifDuration = typeof ORDER_NOTIFICATION_DURATION !== 'undefined' ? ORDER_NOTIFICATION_DURATION : 5000;

    // ========================================================
    // A. STORE STAFF & OWNER SOCKET LISTENERS
    // ========================================================
    if (isStore) {
      // Authenticated sockets also join the owner's authorized rooms on the
      // server. Missing optional profile metadata must not disable listeners.
      if (storeId) subscribeToStore(storeId);

      const handleStoreOrderCreated = (payload: any) => {
        payload = normalizeOrderEvent(payload);
        const order = payload.order || payload;
        // Verify order belongs to this store
        if (storeId && order.storeId && String(order.storeId) !== storeId) return;
        if (!acceptOrderEvent('ORDER_CREATED', payload)) return;

        const firstItem = order.items?.[0];
        const productName = firstItem?.product?.name || firstItem?.productName || 'Nhu yếu phẩm';
        const qty = firstItem?.quantity || 1;
        const orderNum = order.orderNumber || (order.id ? String(order.id).slice(-6) : 'SOB');
        const customerName = order.customerName || order.customer?.user?.fullName || payload.customerName || 'Khách hàng';

        const newNotif: AppNotification = {
          id: orderEventKey('ORDER_CREATED', payload),
          type: 'ORDER_CREATED',
          roleScope: 'STORE',
          title: `Đơn mới #${orderNum}`,
          orderNumber: orderNum,
          orderId: order.id,
          productName,
          itemsSummary: resolveItemsSummary(order),
          quantity: qty,
          totalAmount: order.totalAmount,
          customerName,
          customerPhone: order.customerPhone,
          deliveryAddress: order.deliveryAddress,
          status: order.status || 'PENDING',
          isRead: false,
          timestamp: new Date().toISOString(),
        };

        setNotifications((prev) => [newNotif, ...prev.filter((notification) => notification.id !== newNotif.id)]);

        try {
          announceStoreOrder({ customerName, productName, quantity: qty });
        } catch {}

        toast.success(resolveNotificationMessage(payload, `Đơn hàng mới #${orderNum}`), {
          title: '🔔 Đơn hàng mới!',
          duration: notifDuration,
        });
      };

      const handleStoreOrderCancelled = (payload: any) => {
        payload = normalizeOrderEvent(payload, 'ORDER_CANCELLED');
        if (storeId && payload.order.storeId && String(payload.order.storeId) !== storeId) return;
        if (!acceptOrderEvent('ORDER_CANCELLED', payload)) return;
        const orderId = payload.orderId || payload.id;
        const orderNum = payload.orderNumber || (orderId ? String(orderId).slice(-6) : 'SOB');
        const reason = payload.reason || payload.cancellationReason || 'Khách hủy đơn';

        const cancelNotif: AppNotification = {
          id: orderEventKey('ORDER_CANCELLED', payload),
          type: 'ORDER_CANCELLED',
          roleScope: 'STORE',
          title: `Đã hủy #${orderNum}`,
          orderNumber: orderNum,
          orderId,
          productName: payload.order.items?.[0]?.productName || payload.productName || 'Đơn hàng',
          itemsSummary: resolveItemsSummary(payload.order),
          quantity: payload.order.items?.[0]?.quantity,
          totalAmount: payload.order.totalAmount,
          customerName: payload.customerName || payload.order?.customerName,
          customerPhone: payload.customerPhone || payload.order?.customerPhone,
          deliveryAddress: payload.deliveryAddress || payload.order?.deliveryAddress,
          reason,
          status: payload.status,
          isRead: false,
          timestamp: payload.cancelledAt || new Date().toISOString(),
        };

        setNotifications((prev) => [cancelNotif, ...prev.filter((notification) => notification.id !== cancelNotif.id)]);

        try {
          playCancelChime();
        } catch {}

        toast.info(resolveNotificationMessage({ ...payload, reason }, reason ? ('Đơn hàng #' + orderNum + ' đã bị hủy. Lý do: ' + reason) : ('Đơn hàng #' + orderNum + ' đã bị hủy')), {
          title: 'Đơn hàng đã hủy',
          duration: notifDuration,
        });
      };

      const handleDevicesAllocated = (payload: any) => {
        if (payload?.storeId && String(user.storeId) !== String(payload.storeId)) return;

        const count = payload.allocatedCount || 1;
        const deviceCodes = Array.isArray(payload.deviceIds) ? payload.deviceIds.join(', ') : '';
        const newNotif: AppNotification = {
          id: `notif_alloc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'DEVICES_ALLOCATED',
          roleScope: 'STORE',
          title: `Bàn giao ${count} nút bấm mới!`,
          productName: deviceCodes ? `Mã thiết bị: ${deviceCodes}` : 'Nút bấm thông minh mới',
          status: 'ACTIVE',
          isRead: false,
          timestamp: payload.timestamp || new Date().toISOString(),
        };

        setNotifications((prev) => [newNotif, ...prev]);
        try {
          playOrderChime();
        } catch {}

        toast.success(payload.message || `Quản trị viên vừa cấp phát ${count} nút bấm mới vào kho!`, {
          title: '📦 Nút bấm mới về kho!',
          duration: 7000,
        });
      };

      const handleStoreStatus = (payload: any) => {
        const event = normalizeOrderEvent(payload);
        if (['CANCELLED', 'REJECTED'].includes(event.status)) handleStoreOrderCancelled(event);
      };
      const handleLocalEvent = (event: Event) => {
        const { type, payload } = (event as CustomEvent).detail;
        if (type === 'ORDER_CREATED') handleStoreOrderCreated(payload);
        else if (type === 'ORDER_CANCELLED') handleStoreOrderCancelled(payload);
        else handleStoreStatus(payload);
      };
      window.addEventListener(ORDER_EVENT, handleLocalEvent);
      socket.on('ORDER_STATUS_CHANGED', handleStoreStatus);
      socket.on('ORDER_CREATED', handleStoreOrderCreated);
      socket.on('order:created', handleStoreOrderCreated);
      socket.on('ORDER_CANCELLED', handleStoreOrderCancelled);
      socket.on('order:cancelled', handleStoreOrderCancelled);
      socket.on('DEVICES_ALLOCATED', handleDevicesAllocated);
      socket.on('devices:allocated', handleDevicesAllocated);

      return () => {
        window.removeEventListener(ORDER_EVENT, handleLocalEvent);
        socket.off('ORDER_STATUS_CHANGED', handleStoreStatus);
        socket.off('ORDER_CREATED', handleStoreOrderCreated);
        socket.off('order:created', handleStoreOrderCreated);
        socket.off('ORDER_CANCELLED', handleStoreOrderCancelled);
        socket.off('order:cancelled', handleStoreOrderCancelled);
        socket.off('DEVICES_ALLOCATED', handleDevicesAllocated);
        socket.off('devices:allocated', handleDevicesAllocated);
      };
    }

    // ========================================================
    // B. CUSTOMER SOCKET LISTENERS (Personal Order Status ONLY)
    // ========================================================
    else if (isCustomer) {
      const customerId =
        user.customerProfileId ||
        (user as any)?.customerProfile?.customerId ||
        (user as any)?.customerProfile?.id ||
        (user.role === 'CUSTOMER' ? user.id : null);

      if (customerId) {
        subscribeToCustomer(String(customerId));
      }
      if (user.id && String(user.id) !== String(customerId)) {
        subscribeToCustomer(String(user.id));
      }

      const handleCustomerOrderCreated = (payload: any) => {
        payload = normalizeOrderEvent(payload);
        const order = payload.order || payload;
        const orderCustId = order.customerId || payload.customerId;
        if (
          customerId &&
          orderCustId &&
          String(orderCustId) !== String(customerId) &&
          String(orderCustId) !== String(user.id)
        ) {
          return;
        }
        if (!acceptOrderEvent('ORDER_CREATED', payload)) return;
        const orderNum = order.orderNumber || (order.id ? String(order.id).slice(-6) : 'SOB');
        const firstItem = order.items?.[0];
        const productName = firstItem?.product?.name || firstItem?.productName || 'Sản phẩm';
        const awaitingPayOS = String(order.paymentMethod || '').toUpperCase() === 'PAYOS'
          && String(order.paymentStatus || '').toUpperCase() !== 'PAID';
        const title = awaitingPayOS
          ? `Đơn hàng #${orderNum} đang chờ thanh toán PayOS`
          : `Đặt hàng thành công #${orderNum}`;

        const newNotif: AppNotification = {
          id: orderEventKey('ORDER_CREATED', payload),
          type: 'ORDER_CREATED',
          roleScope: 'CUSTOMER',
          title,
          orderNumber: orderNum,
          orderId: order.id,
          productName,
          itemsSummary: resolveItemsSummary(order),
          quantity: firstItem?.quantity || 1,
          totalAmount: order.totalAmount,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          deliveryAddress: order.deliveryAddress,
          status: order.status || 'PENDING',
          isRead: false,
          timestamp: new Date().toISOString(),
        };

        setNotifications((prev) => [newNotif, ...prev.filter((notification) => notification.id !== newNotif.id)]);
        playOrderChime(true);
        if (awaitingPayOS) {
          toast.info(resolveNotificationMessage(payload, title), {
            title: 'Chờ thanh toán PayOS',
            duration: notifDuration,
          });
        } else {
          toast.success(resolveNotificationMessage(payload, title), {
            title: '🎉 Đặt hàng thành công',
            duration: notifDuration,
          });
        }
      };

      const handleCustomerOrderStatus = (payload: any) => {
        payload = normalizeOrderEvent(payload);
        const orderCustId = payload.order?.customerId || payload.customerId;
        if (
          customerId &&
          orderCustId &&
          String(orderCustId) !== String(customerId) &&
          String(orderCustId) !== String(user.id)
        ) {
          return;
        }
        const orderId = payload.orderId || payload.id;
        const orderNum = payload.orderNumber || (orderId ? String(orderId).slice(-6) : 'SOB');
        const status = payload.status || payload.orderStatus;

        let title = `Đơn hàng #${orderNum} cập nhật: ${status}`;
        let type: AppNotification['type'] = 'ORDER_STATUS_CHANGED';

        if (['DELIVERED', 'COMPLETED'].includes(status)) {
          title = `Đơn hàng #${orderNum} đã giao thành công`;
          type = 'ORDER_DELIVERED';
        } else if (['CANCELLED', 'REJECTED'].includes(status)) {
          title = `Đơn hàng #${orderNum} đã bị hủy`;
          type = 'ORDER_CANCELLED';
        } else if (['SHIPPING', 'OUT_FOR_DELIVERY'].includes(status)) {
          title = `Tài xế đang giao đơn hàng #${orderNum} đến bạn`;
        } else if (status === 'CONFIRMED') {
          title = `Cửa hàng đã xác nhận đơn hàng #${orderNum}`;
        }

        if (!acceptOrderEvent(type, payload)) return;
        if (type === 'ORDER_CANCELLED') playCancelChime();

        const newNotif: AppNotification = {
          id: orderEventKey(type, payload),
          type,
          roleScope: 'CUSTOMER',
          title,
          orderNumber: orderNum,
          orderId,
          productName: payload.order.items?.[0]?.productName || payload.productName || 'Đơn hàng của bạn',
          itemsSummary: resolveItemsSummary(payload.order),
          quantity: payload.order.items?.[0]?.quantity,
          totalAmount: payload.order.totalAmount,
          customerName: payload.customerName || payload.order?.customerName,
          customerPhone: payload.customerPhone || payload.order?.customerPhone,
          deliveryAddress: payload.deliveryAddress || payload.order?.deliveryAddress,
          reason: payload.reason || payload.cancellationReason,
          status,
          isRead: false,
          timestamp: new Date().toISOString(),
        };

        setNotifications((prev) => [newNotif, ...prev.filter((notification) => notification.id !== newNotif.id)]);
        toast.info(resolveNotificationMessage(payload, title), { title, duration: notifDuration });
      };

      const handleCancelled = (payload: any) => handleCustomerOrderStatus(normalizeOrderEvent(payload, 'ORDER_CANCELLED'));
      const handleLocalEvent = (event: Event) => {
        const { type, payload } = (event as CustomEvent).detail;
        if (type === 'ORDER_CREATED') handleCustomerOrderCreated(payload);
        else if (type === 'ORDER_CANCELLED') handleCancelled(payload);
        else handleCustomerOrderStatus(payload);
      };
      window.addEventListener(ORDER_EVENT, handleLocalEvent);

      socket.on('ORDER_CREATED', handleCustomerOrderCreated);
      socket.on('order:created', handleCustomerOrderCreated);
      socket.on('ORDER_STATUS_CHANGED', handleCustomerOrderStatus);
      socket.on('ORDER_DELIVERED', handleCustomerOrderStatus);
      socket.on('ORDER_CANCELLED', handleCancelled);
      socket.on('order:cancelled', handleCancelled);

      return () => {
        window.removeEventListener(ORDER_EVENT, handleLocalEvent);
        socket.off('ORDER_CREATED', handleCustomerOrderCreated);
        socket.off('order:created', handleCustomerOrderCreated);
        socket.off('ORDER_STATUS_CHANGED', handleCustomerOrderStatus);
        socket.off('ORDER_DELIVERED', handleCustomerOrderStatus);
        socket.off('ORDER_CANCELLED', handleCancelled);
        socket.off('order:cancelled', handleCancelled);
      };
    }

    // ========================================================
    // C. ADMIN SOCKET LISTENERS (System, Store approvals ONLY)
    // ========================================================
    else if (isAdmin) {
      const handleStoreRegistered = (payload: any) => {
        const storeName = payload.name || payload.storeName || 'Cửa hàng mới';
        const newNotif: AppNotification = {
          id: `notif_rt_admin_st_${Date.now()}`,
          type: 'STORE_PENDING',
          roleScope: 'ADMIN',
          title: `Cửa hàng đăng ký mới: ${storeName}`,
          storeName,
          productName: `Điểm bán mới đang chờ quản trị viên phê duyệt hồ sơ`,
          status: 'PENDING_APPROVAL',
          isRead: false,
          timestamp: new Date().toISOString(),
        };

        setNotifications((prev) => [newNotif, ...prev]);
        toast.info(`Cửa hàng "${storeName}" vừa đăng ký, đang chờ phê duyệt mở điểm bán!`, {
          title: '🏪 Điểm bán mới chờ duyệt',
          duration: 7000,
        });
      };

      const handleWithdrawalRequested = (payload: any) => {
        const amount = Number(payload.amount || 0);
        const storeName = payload.storeName || 'Cửa hàng';
        const newNotif: AppNotification = {
          id: `notif_rt_admin_w_${Date.now()}`,
          type: 'WITHDRAWAL_PENDING',
          roleScope: 'ADMIN',
          title: `Yêu cầu rút tiền: ${amount.toLocaleString('vi-VN')}₫`,
          storeName,
          productName: `${storeName} vừa tạo yêu cầu rút tiền về tài khoản ngân hàng`,
          totalAmount: amount,
          status: 'PENDING',
          isRead: false,
          timestamp: new Date().toISOString(),
        };

        setNotifications((prev) => [newNotif, ...prev]);
        toast.warning(`${storeName} vừa yêu cầu rút ${amount.toLocaleString('vi-VN')}₫!`, {
          title: '💳 Yêu cầu rút tiền mới',
          duration: 7000,
        });
      };

      socket.on('STORE_REGISTERED', handleStoreRegistered);
      socket.on('store:registered', handleStoreRegistered);
      socket.on('WITHDRAWAL_REQUESTED', handleWithdrawalRequested);
      socket.on('withdrawal:requested', handleWithdrawalRequested);

      return () => {
        socket.off('STORE_REGISTERED', handleStoreRegistered);
        socket.off('store:registered', handleStoreRegistered);
        socket.off('WITHDRAWAL_REQUESTED', handleWithdrawalRequested);
        socket.off('withdrawal:requested', handleWithdrawalRequested);
      };
    }
  }, [playOrderChime, playCancelChime, announceStoreOrder, user, storeId, isAdmin, isStore, isCustomer]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead).length;
  }, [notifications]);

  // Dynamic Tabs based on Active Role
  const roleTabs = useMemo(() => {
    if (isAdmin) {
      return [
        { key: 'ALL', label: 'Tất cả' },
        { key: 'STORES', label: 'Duyệt cửa hàng' },
        { key: 'WITHDRAWALS', label: 'Rút tiền' },
      ];
    }
    if (isCustomer) {
      return [
        { key: 'ALL', label: 'Tất cả' },
        { key: 'DELIVERING', label: 'Đang xử lý / Giao' },
        { key: 'COMPLETED', label: 'Đã nhận / Hủy' },
      ];
    }
    return [
      { key: 'ALL', label: 'Tất cả' },
      { key: 'NEW_ORDER', label: 'Đơn mới' },
      { key: 'CANCELLED', label: 'Đơn hủy' },
    ];
  }, [isAdmin, isCustomer]);

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'ALL') return notifications;

    if (isAdmin) {
      if (activeTab === 'STORES') return notifications.filter((n) => n.type === 'STORE_PENDING');
      if (activeTab === 'WITHDRAWALS') return notifications.filter((n) => n.type === 'WITHDRAWAL_PENDING');
    }

    if (isCustomer) {
      if (activeTab === 'DELIVERING') {
        return notifications.filter((n) => ['ORDER_CREATED', 'ORDER_STATUS_CHANGED'].includes(n.type));
      }
      if (activeTab === 'COMPLETED') {
        return notifications.filter((n) => ['ORDER_DELIVERED', 'ORDER_CANCELLED'].includes(n.type));
      }
    }

    if (isStore) {
      if (activeTab === 'NEW_ORDER') return notifications.filter((n) => n.type === 'ORDER_CREATED');
      if (activeTab === 'CANCELLED') return notifications.filter((n) => n.type === 'ORDER_CANCELLED');
    }

    return notifications;
  }, [notifications, activeTab, isAdmin, isCustomer, isStore]);

  const markAllAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleNotificationClick = (notif: AppNotification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
    );
    setIsOpen(false);

    if (isAdmin) {
      if (notif.type === 'STORE_PENDING') {
        navigate('/admin/dashboard?tab=STORES');
        return;
      }
      if (notif.type === 'WITHDRAWAL_PENDING') {
        navigate('/admin/dashboard?tab=WITHDRAWALS');
        return;
      }
      navigate('/admin/dashboard');
      return;
    }

    if (isStore) {
      if (notif.type === 'DEVICES_ALLOCATED') {
        navigate('/store/devices');
        return;
      }
      navigate(`/store/dashboard${notif.orderNumber ? `?order=${encodeURIComponent(notif.orderNumber)}` : ''}`);
      return;
    }

    if (isCustomer) {
      navigate(`/customer/orders?orderId=${encodeURIComponent(notif.orderId || '')}&order=${encodeURIComponent(notif.orderNumber || '')}`);
      return;
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* 1. BELL BUTTON ICON */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`p-2 rounded-lg transition-all relative group cursor-pointer ${
          isOpen
            ? 'bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-white'
            : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
        }`}
        title="Thông báo hệ thống theo vai trò"
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

      {/* 2. POPOVER PANEL */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-[390px] max-w-[calc(100vw-2rem)] z-[90] bg-white dark:bg-[#0c121e] border border-slate-200/90 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden flex flex-col"
          >
            {/* Header: Row 1 */}
            <div className="px-4 pt-3.5 pb-2.5 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Thông báo
                </h3>
                <span className="text-[10px] font-medium font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                  {isAdmin ? 'Quản trị viên' : isStore ? 'Cửa hàng' : 'Khách hàng'}
                </span>
              </div>
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

            {/* Header: Row 2 (Role-Specific Underlined Tabs) */}
            <div className="flex gap-4 px-4 border-b border-slate-100 dark:border-zinc-800 text-xs font-medium pt-2">
              {roleTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`pb-2.5 transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'text-[#0F172A] dark:text-white border-b-2 border-[#0F172A] dark:border-white font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                  {tab.key === 'ALL' && ` (${notifications.length})`}
                </button>
              ))}
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
                    {isAdmin
                      ? 'Các yêu cầu duyệt đại lý và lệnh rút tiền sẽ hiển thị tại đây.'
                      : isStore
                      ? 'Các đơn hàng mới và thông báo kho nút bấm sẽ hiển thị tại đây.'
                      : 'Cập nhật trạng thái các đơn hàng của bạn sẽ hiển thị tại đây.'}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const isStorePending = notif.type === 'STORE_PENDING';
                  const isWithdPending = notif.type === 'WITHDRAWAL_PENDING';
                  const isDevice = notif.type === 'DEVICES_ALLOCATED' || notif.type === 'DEVICE_ASSIGNED';
                  const isNewOrder = notif.type === 'ORDER_CREATED';
                  const isDelivered = notif.type === 'ORDER_DELIVERED';
                  const isCancel = notif.type === 'ORDER_CANCELLED';

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`px-4 py-3 hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors flex gap-3 items-start cursor-pointer relative ${
                        !notif.isRead ? 'bg-slate-50/40 dark:bg-zinc-900/30' : ''
                      }`}
                    >
                      {/* Left Icon */}
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          isStorePending
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                            : isWithdPending
                            ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400'
                            : isDevice
                            ? 'bg-blue-50 text-[#0E6BA8] dark:bg-blue-950/40 dark:text-sky-400'
                            : isDelivered
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : isNewOrder
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : isCancel
                            ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        {isStorePending ? (
                          <Store className="w-3.5 h-3.5" />
                        ) : isWithdPending ? (
                          <Wallet className="w-3.5 h-3.5" />
                        ) : isDevice ? (
                          <Cpu className="w-3.5 h-3.5" />
                        ) : isDelivered ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : isNewOrder ? (
                          <ShoppingBag className="w-3.5 h-3.5" />
                        ) : isCancel ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : (
                          <Truck className="w-3.5 h-3.5" />
                        )}
                      </div>

                      {/* Middle Content */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: Title & Relative Time */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                            {notif.title}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500 whitespace-nowrap shrink-0">
                            {formatRelativeTime(notif.timestamp)}
                          </span>
                        </div>

                        {/* Row 2: Subtitle / Product info */}
                        <div className="text-xs text-slate-700 dark:text-zinc-300 font-medium truncate mt-0.5">
                          <span>{notif.itemsSummary || notif.productName || (isStorePending ? 'Chờ phê duyệt' : 'Nhu yếu phẩm')}</span>
                          {!notif.itemsSummary && notif.quantity && notif.quantity > 1 ? ` (${notif.quantity}x)` : ''}
                          {notif.totalAmount !== undefined && (
                            <span className="text-slate-900 dark:text-white font-semibold ml-1.5 tabular-nums">
                              • {notif.totalAmount.toLocaleString('vi-VN')} đ
                            </span>
                          )}
                        </div>

                        {/* Row 3: Secondary Context */}
                        {notif.customerName && <p className="mt-1 text-[11px] text-slate-500 break-words">{notif.customerName}{notif.customerPhone ? ` · ${notif.customerPhone}` : ''}</p>}
                        {notif.deliveryAddress && <p className="mt-1 text-[11px] text-slate-500 whitespace-pre-line break-words">{notif.deliveryAddress}</p>}
                        <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 truncate">
                          {isStorePending ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">Bấm để xem hồ sơ và phê duyệt đại lý →</span>
                          ) : isWithdPending ? (
                            <span className="text-sky-600 dark:text-sky-400 font-medium">Bấm để xem và xử lý lệnh chi tiền →</span>
                          ) : isDevice ? (
                            <span className="text-[#0E6BA8] dark:text-sky-400 font-medium">Bấm để quản lý kho thiết bị →</span>
                          ) : isCancel ? (
                            notif.reason || 'Khách hủy đơn'
                          ) : isCustomer ? (
                            `Trạng thái: ${notif.status || 'Đang xử lý'}`
                          ) : (
                            `Khách hàng: ${notif.customerName || 'Khách đặt qua nút bấm'}`
                          )}
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
                if (isAdmin) {
                  navigate('/admin/dashboard');
                } else if (isStore) {
                  navigate('/store/dashboard');
                } else {
                  navigate('/customer/orders');
                }
              }}
              className="w-full py-2.5 text-center text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white bg-slate-50/60 hover:bg-slate-100 dark:bg-zinc-900/60 dark:hover:bg-zinc-800 border-t border-slate-100 dark:border-zinc-800 block transition-colors cursor-pointer"
            >
              {isAdmin
                ? 'Vào Bảng điều khiển Quản trị Admin →'
                : isStore
                ? 'Xem tất cả đơn hàng cửa hàng →'
                : 'Xem lịch sử đơn hàng của tôi →'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
