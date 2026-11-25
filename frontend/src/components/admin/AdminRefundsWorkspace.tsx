import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ArrowDownRight,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  Eye,
  Filter,
  HelpCircle,
  Info,
  Loader2,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { adminPaymentRefundsService, PaymentRefundObligation } from '../../services/admin-payment-refunds';
import { api } from '../../services/api';
import { adminDate, adminField, adminMoney, adminSecondary, AdminWorkflowDialog, AdminWorkflowNotice } from '../../pages/admin/AdminWorkflowDialog';
import { card, primaryButton } from '../../pages/operations/OperationPrimitives';

const OBLIGATION_TYPE_MAP: Record<string, { label: string; icon: React.ElementType; tone: string }> = {
  ORDER_REFUND: {
    label: 'Hoàn tiền đơn hàng',
    icon: ShoppingBag,
    tone: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
  },
  ORDER_CANCELLATION: {
    label: 'Hủy đơn hàng',
    icon: ShoppingBag,
    tone: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
  },
  EXCESS_PAYMENT: {
    label: 'Chuyển tiền thừa',
    icon: Banknote,
    tone: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  },
  STORE_PENNY_VERIFICATION: {
    label: 'Xác minh cửa hàng',
    icon: Store,
    tone: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
  },
  CUSTOMER_PENNY_VERIFICATION: {
    label: 'Xác minh khách hàng',
    icon: UserCheck,
    tone: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900',
  },
  RENTAL_DEPOSIT_REFUND: {
    label: 'Hoàn cọc thiết bị',
    icon: RotateCcw,
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
  },
};

const STATUS_MAP: Record<string, { label: string; tone: string; icon: React.ElementType }> = {
  PENDING: {
    label: 'Chờ chi trả',
    tone: 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900',
    icon: Clock3,
  },
  PENDING_RECIPIENT_VERIFICATION: {
    label: 'Chờ xác minh tài khoản nhận',
    tone: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900',
    icon: Clock3,
  },
  READY_FOR_PAYOUT: {
    label: 'Sẵn sàng chi trả',
    tone: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900',
    icon: CheckCircle2,
  },
  DISPATCHING: {
    label: 'Đang gửi lệnh',
    tone: 'bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
    icon: Loader2,
  },
  PROCESSING: {
    label: 'Đang chuyển tiền',
    tone: 'bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
    icon: Loader2,
  },
  PROCESSING_PAYOUT: {
    label: 'Đang chi trả PayOS',
    tone: 'bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900',
    icon: Loader2,
  },
  SETTLED: {
    label: 'Đã hoàn tất',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
    icon: CheckCircle2,
  },
  REFUNDED: {
    label: 'Đã hoàn tất',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900',
    icon: CheckCircle2,
  },
  PENDING_RECONCILIATION: {
    label: 'Chờ đối soát',
    tone: 'bg-orange-50 text-orange-700 border-orange-200/80 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900',
    icon: AlertCircle,
  },
  FAILED: {
    label: 'Thất bại',
    tone: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900',
    icon: XCircle,
  },
  REJECTED: {
    label: 'Đã từ chối',
    tone: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
    icon: XCircle,
  },
};

export const AdminRefundsWorkspace: React.FC = () => {
  const reducedMotion = useReducedMotion();
  const [items, setItems] = useState<PaymentRefundObligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [notice, setNotice] = useState<{ text: string; success?: boolean } | null>(null);

  // Modals
  const [activePayoutItem, setActivePayoutItem] = useState<PaymentRefundObligation | null>(null);
  const [activeDetailItem, setActiveDetailItem] = useState<PaymentRefundObligation | null>(null);
  const [detailOrder, setDetailOrder] = useState<any>(null);
  const [loadingDetailOrder, setLoadingDetailOrder] = useState(false);
  const [payoutNote, setPayoutNote] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!activeDetailItem?.orderId) {
      setDetailOrder(null);
      return;
    }
    let mounted = true;
    setLoadingDetailOrder(true);
    api.get(`/orders/${activeDetailItem.orderId}`)
      .then((res: any) => {
        if (mounted) setDetailOrder(res.data?.data || res.data || null);
      })
      .catch(() => {
        if (mounted) setDetailOrder(null);
      })
      .finally(() => {
        if (mounted) setLoadingDetailOrder(false);
      });
    return () => { mounted = false; };
  }, [activeDetailItem?.orderId]);

  const loadData = useCallback(async (isRefresh = false, force = false) => {
    if (loadingRef.current && !force) return;
    loadingRef.current = true;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const apiStatusFilter = statusFilter === 'SETTLED' ? 'REFUNDED' : statusFilter;
      const res = await adminPaymentRefundsService.listObligations({
        pageSize: 100,
        status: apiStatusFilter !== 'ALL' ? apiStatusFilter : undefined,
      });
      if (mountedRef.current) {
        setItems(res.items);
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      const is403 = err?.response?.status === 403;
      const msg = is403
        ? 'Tài khoản hiện tại không có quyền SUPER_ADMIN. Tính năng Đối soát & Hoàn tiền PayOS yêu cầu quyền Quản trị tối cao (SUPER_ADMIN) để bảo mật dòng tiền của hệ thống.'
        : err?.response?.data?.message || 'Không thể tải danh sách nghĩa vụ hoàn tiền. Vui lòng thử lại.';
      setNotice({
        text: msg,
        success: false,
      });
    } finally {
      loadingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData(false, true);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadData(true);
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadData(true);
      }
    }, 10000);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [loadData]);

  // Derived metrics
  const metrics = useMemo(() => {
    const totalCount = items.length;
    const pendingItems = items.filter(i => ['PENDING', 'DISPATCHING', 'PROCESSING', 'PROCESSING_PAYOUT', 'PENDING_RECIPIENT_VERIFICATION', 'READY_FOR_PAYOUT'].includes(i.status));
    const pendingAmount = pendingItems.reduce((acc, curr) => acc + (Number(curr.refundAmount) || 0), 0);
    const settledItems = items.filter(i => ['SETTLED', 'REFUNDED'].includes(i.status));
    const settledAmount = settledItems.reduce((acc, curr) => acc + (Number(curr.refundAmount) || 0), 0);
    const reconcileCount = items.filter(i => ['PENDING_RECONCILIATION', 'FAILED'].includes(i.status)).length;
    return {
      totalCount,
      pendingCount: pendingItems.length,
      pendingAmount,
      settledCount: settledItems.length,
      settledAmount,
      reconcileCount,
    };
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter(item => {
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'REFUNDED' || statusFilter === 'SETTLED') {
          if (!['REFUNDED', 'SETTLED'].includes(item.status)) return false;
        } else if (item.status !== statusFilter) {
          return false;
        }
      }
      if (typeFilter !== 'ALL' && item.obligationType !== typeFilter) return false;
      if (!q) return true;
      const oblId = String(item.obligationId || '').toLowerCase();
      const orderId = String(item.orderId || '').toLowerCase();
      const orderCode = String(item.order?.orderCode || '').toLowerCase();
      const name = String(item.targetAccountName || '').toLowerCase();
      const masked = String(item.targetAccountMasked || '').toLowerCase();
      const bin = String(item.targetBankBin || '').toLowerCase();
      return oblId.includes(q) || orderId.includes(q) || orderCode.includes(q) || name.includes(q) || masked.includes(q) || bin.includes(q);
    });
  }, [items, searchQuery, statusFilter, typeFilter]);

  // Execute payout
  const handleExecutePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePayoutItem) return;
    setSubmittingPayout(true);
    try {
      const res = await adminPaymentRefundsService.initiatePayout(activePayoutItem.obligationId, {
        note: payoutNote.trim() || undefined,
      });
      const returnedObl = res?.data || res;
      const isSettledNow = ['REFUNDED', 'SETTLED'].includes(returnedObl?.status);
      setNotice({
        text: isSettledNow
          ? `Đã chi hoàn tiền và tất toán nghĩa vụ #${activePayoutItem.obligationId} thành công.`
          : res?.message || `Đã gửi lệnh chi trả cho nghĩa vụ #${activePayoutItem.obligationId}. Hệ thống đang chờ xác nhận đối soát từ PayOS.`,
        success: true,
      });
      setActivePayoutItem(null);
      setPayoutNote('');
      await loadData(true, true);
    } catch (err: any) {
      setNotice({
        text: err?.response?.data?.message || 'Không thể khởi tạo lệnh chi tiền qua PayOS. Vui lòng kiểm tra lại.',
        success: false,
      });
    } finally {
      setSubmittingPayout(false);
    }
  };

  // Sync obligation
  const handleSyncObligation = async (item: PaymentRefundObligation) => {
    // If obligation has no active payout attempt, guide the admin to initiate payout
    if (!item.activePayoutAttemptId) {
      setNotice({
        text: `Nghĩa vụ #${item.obligationId} chưa phát sinh lệnh chi trả trên PayOS. Vui lòng bấm "Chi PayOS" để hệ thống tự động kiểm tra tài khoản đã xác minh của khách và chuyển tiền hoàn.`,
        success: false,
      });
      return;
    }
    setSyncingId(item.obligationId);
    try {
      const res = await adminPaymentRefundsService.syncObligation(item.obligationId);
      const syncData = res?.data ?? res;
      const syncedObl = syncData?.obligation ?? syncData;
      const isSettled =
        syncData?.settled === true || ['REFUNDED', 'SETTLED'].includes(syncedObl?.status);
      const latestFailure =
        syncedObl?.failureReason || syncedObl?.payoutAttempts?.[0]?.failureReason;
      if (isSettled) {
        setNotice({
          text: `Đã đối soát thành công! Nghĩa vụ #${item.obligationId} đã chuyển sang Đã hoàn tất (Đã hoàn tiền).`,
          success: true,
        });
      } else {
        const label = STATUS_MAP[syncedObl?.status]?.label || syncedObl?.status || 'Chờ đối soát';
        setNotice({
          text: `Nghĩa vụ #${item.obligationId} vẫn đang ở trạng thái ${label}.${latestFailure ? ` Lý do: ${latestFailure}` : ' Worker IP tĩnh (Node-3) chưa nhận được xác nhận tất toán cuối cùng từ PayOS — vui lòng kiểm tra Worker Node-3 hoặc xem chi tiết chứng từ.'}`,
          success: false,
        });
      }
      await loadData(true, true);
    } catch (err: any) {
      setNotice({
        text: err?.response?.data?.message || 'Chưa thể đồng bộ trạng thái từ PayOS. Vui lòng kiểm tra lại sau.',
        success: false,
      });
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notice Banner */}
      {notice && (
        <AdminWorkflowNotice success={notice.success}>
          <div className="flex items-center justify-between w-full">
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="ml-3 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
              aria-label="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </AdminWorkflowNotice>
      )}

      {/* Hero KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Chỉ số hoàn tiền">
        {/* Card 1: Chờ hoàn tiền */}
        <div className={`${card} relative overflow-hidden group hover:border-[#287DA8]/40 transition-all duration-200`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Chờ hoàn tiền</span>
            <span className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Clock3 className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums">
            {adminMoney(metrics.pendingAmount)}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold text-amber-700 bg-amber-100/70 dark:bg-amber-900/40 dark:text-amber-300">
              {metrics.pendingCount} giao dịch
            </span>
            <span>đang chờ xử lý Payout</span>
          </div>
        </div>

        {/* Card 2: Đã tất toán */}
        <div className={`${card} relative overflow-hidden group hover:border-[#287DA8]/40 transition-all duration-200`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Đã hoàn tất</span>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums">
            {adminMoney(metrics.settledAmount)}
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold text-emerald-700 bg-emerald-100/70 dark:bg-emerald-900/40 dark:text-emerald-300">
              {metrics.settledCount} thành công
            </span>
            <span>đã chuyển khoản</span>
          </div>
        </div>

        {/* Card 3: Cần đối soát */}
        <div className={`${card} relative overflow-hidden group hover:border-[#287DA8]/40 transition-all duration-200`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Cần đối soát</span>
            <span className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums">
            {metrics.reconcileCount}
          </p>
          <div className="mt-2 text-xs text-zinc-500">
            <span>Khoản tiền cần kiểm tra lại chứng từ PayOS</span>
          </div>
        </div>

        {/* Card 4: Tổng nghĩa vụ */}
        <div className={`${card} relative overflow-hidden group hover:border-[#287DA8]/40 transition-all duration-200`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tổng ghi nhận</span>
            <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-[#287DA8] dark:text-sky-400">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums">
            {metrics.totalCount}
          </p>
          <div className="mt-2 text-xs text-zinc-500">
            <span>Tất cả khoản hoàn tiền trong hệ thống</span>
          </div>
        </div>
      </section>

      {/* Main Table Card */}
      <section className={`${card} !p-4 sm:!p-6 space-y-4`}>
        {/* Header Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
              Danh sách nghĩa vụ hoàn tiền PayOS
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Quản lý chi trả hoàn tiền hủy đơn, hoàn cọc thiết bị và đối soát tiền thừa tự động.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData(true, true)}
              disabled={loading || refreshing}
              className={`${adminSecondary} !py-2 text-xs`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing && !reducedMotion ? 'animate-spin' : ''}`} />
              <span>Tải lại</span>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã OBL, đơn hàng, STK, tên..."
              className={`${adminField} !pl-9 !text-xs !py-2`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              aria-label="Lọc trạng thái hoàn tiền"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className={`${adminField} !text-xs !py-2 cursor-pointer`}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">Chờ chi trả (Pending)</option>
              <option value="PENDING_RECIPIENT_VERIFICATION">Chờ xác minh tài khoản</option>
              <option value="DISPATCHING">Đang gửi lệnh (Dispatching)</option>
              <option value="REFUNDED">Đã hoàn tất (Đã hoàn tiền)</option>
              <option value="PENDING_RECONCILIATION">Chờ đối soát (Reconciliation)</option>
              <option value="FAILED">Thất bại (Failed)</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="relative">
            <select
              aria-label="Lọc loại hoàn tiền"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className={`${adminField} !text-xs !py-2 cursor-pointer`}
            >
              <option value="ALL">Tất cả phân loại</option>
              <option value="ORDER_REFUND">Hoàn tiền đơn hàng</option>
              <option value="ORDER_CANCELLATION">Hủy đơn hàng</option>
              <option value="RENTAL_DEPOSIT_REFUND">Hoàn cọc thiết bị nút bấm</option>
              <option value="EXCESS_PAYMENT">Chuyển tiền thừa</option>
              <option value="STORE_PENNY_VERIFICATION">Xác minh STK cửa hàng (2.000đ)</option>
              <option value="CUSTOMER_PENNY_VERIFICATION">Xác minh STK khách hàng (2.000đ)</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        {loading && !refreshing ? (
          <div className="py-16 text-center text-sm text-zinc-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#287DA8]" />
            <p>Đang tải dữ liệu nghĩa vụ hoàn tiền…</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-400">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              {searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                ? 'Không tìm thấy nghĩa vụ hoàn tiền phù hợp'
                : 'Chưa có nghĩa vụ hoàn tiền nào cần xử lý'}
            </h3>
            <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL'
                ? 'Thử thay đổi từ khóa tìm kiếm hoặc đặt lại các bộ lọc bên trên.'
                : 'Tất cả các khoản hoàn tiền (hủy đơn, cọc nút, penny deposit) đều đã được hoàn tất hoặc chưa phát sinh giao dịch mới.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/80 dark:bg-zinc-850/80 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 text-[11px] font-semibold uppercase tracking-wider">
                <tr>
                  <th scope="col" className="py-3 px-3.5">Mã & Phân loại</th>
                  <th scope="col" className="py-3 px-3.5">Đơn hàng liên quan</th>
                  <th scope="col" className="py-3 px-3.5">Tài khoản nhận tiền</th>
                  <th scope="col" className="py-3 px-3.5 text-right">Số tiền hoàn</th>
                  <th scope="col" className="py-3 px-3.5 text-center">Trạng thái</th>
                  <th scope="col" className="py-3 px-3.5 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800/80">
                {filteredItems.map(item => {
                  const typeMeta = OBLIGATION_TYPE_MAP[item.obligationType] || {
                    label: item.obligationType,
                    icon: Receipt,
                    tone: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300',
                  };
                  const TypeIcon = typeMeta.icon;
                  const statusMeta = STATUS_MAP[item.status] || {
                    label: item.status,
                    tone: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300',
                    icon: HelpCircle,
                  };
                  const StatusIcon = statusMeta.icon;
                  const canPayout = [
                    'PENDING',
                    'READY_FOR_PAYOUT',
                    'PENDING_RECIPIENT_VERIFICATION',
                    'FAILED',
                  ].includes(item.status);
                  const rowFailureReason = item.failureReason || item.payoutAttempts?.[0]?.failureReason;
                  const isSyncing = syncingId === item.obligationId;

                  return (
                    <tr
                      key={item.obligationId}
                      className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/60 transition-colors"
                    >
                      {/* Mã & Phân loại */}
                      <td className="py-3 px-3.5 align-top">
                        <div className="font-bold text-zinc-900 dark:text-white">
                          #{item.obligationId}
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-semibold tracking-tight shadow-2xs whitespace-nowrap">
                          <TypeIcon className="w-3 h-3 shrink-0" />
                          <span>{typeMeta.label}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-zinc-400">
                          {adminDate(item.createdAt)}
                        </div>
                      </td>

                      {/* Đơn hàng liên quan */}
                      <td className="py-3 px-3.5 align-top">
                        {item.orderId ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-[11px]">
                            <ShoppingBag className="w-3 h-3" />
                            <span>{item.order?.orderCode ? `#${item.order.orderCode}` : `Đơn #${item.orderId}`}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic">Không có</span>
                        )}
                        {item.receipt?.receivedAt && (
                          <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400" title="Thời gian thanh toán PayOS">
                            Thu: {adminDate(item.receipt.receivedAt)}
                          </p>
                        )}
                        {item.receiptId && (
                          <p className="mt-0.5 text-[10px] text-zinc-400">
                            Biên lai #{item.receiptId}
                          </p>
                        )}
                      </td>

                      {/* Tài khoản nhận tiền */}
                      <td className="py-3 px-3.5 align-top">
                        <div className="font-semibold text-zinc-900 dark:text-white">
                          {item.targetAccountName || (item.receipt?.sourceAccountMasked ? `Nguồn PayOS: ${item.receipt.sourceAccountMasked}` : 'Chưa ghi nhận tên')}
                        </div>
                        <div className="mt-0.5 text-zinc-500 dark:text-zinc-400 tabular-nums">
                          {item.targetAccountMasked || (item.receipt?.sourceBankBin ? `BIN ${item.receipt.sourceBankBin}` : 'Chưa có STK')}
                        </div>
                        {!item.targetAccountName && (
                          <div className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            Chờ liên kết STK đích
                          </div>
                        )}
                      </td>

                      {/* Số tiền hoàn */}
                      <td className="py-3 px-3.5 align-top text-right">
                        <div className="text-sm font-bold text-zinc-900 dark:text-white tabular-nums">
                          {adminMoney(item.refundAmount)}
                        </div>
                        <span className="text-[10px] text-zinc-400 uppercase font-semibold">
                          {item.currency || 'VND'}
                        </span>
                      </td>

                      {/* Trạng thái */}
                      <td className="py-3 px-3.5 align-top text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusMeta.tone}`}
                        >
                          <StatusIcon className={`w-3 h-3 ${item.status === 'DISPATCHING' ? 'animate-spin' : ''}`} />
                          <span>{statusMeta.label}</span>
                        </span>
                        {item.verificationNote && (
                          <p className="mt-1 text-[10px] text-zinc-400 max-w-xs mx-auto truncate" title={item.verificationNote}>
                            {item.verificationNote}
                          </p>
                        )}
                        {rowFailureReason && (
                          <p className="mt-1 text-[10px] text-rose-600 dark:text-rose-400 font-medium max-w-xs mx-auto truncate" title={rowFailureReason}>
                            ⚠️ {rowFailureReason}
                          </p>
                        )}
                      </td>

                      {/* Hành động */}
                      <td className="py-3 px-3.5 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {canPayout && (
                            <button
                              type="button"
                              onClick={() => {
                                setActivePayoutItem(item);
                                setPayoutNote('');
                              }}
                              className={`${primaryButton} !py-1 !px-2.5 !text-xs !min-h-0 shadow-xs`}
                              title={
                                item.status === 'PENDING_RECIPIENT_VERIFICATION'
                                  ? 'Kiểm tra STK đã xác minh của khách & gửi lệnh chi trả qua PayOS'
                                  : 'Khởi tạo lệnh chi tiền qua PayOS'
                              }
                            >
                              <Send className="w-3 h-3" />
                              <span>Chi PayOS</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void handleSyncObligation(item)}
                            disabled={isSyncing}
                            className={`${adminSecondary} !py-1 !px-2.5 !text-xs`}
                            title="Đồng bộ kết quả từ cổng PayOS"
                          >
                            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                            <span>Đối soát</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveDetailItem(item)}
                            className={`${adminSecondary} !py-1 !px-2 !text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white`}
                            title="Xem chi tiết kỹ thuật"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal: Xác nhận chi trả hoàn tiền qua PayOS */}
      {activePayoutItem && (
        <AdminWorkflowDialog
          title="Xác nhận chi trả hoàn tiền qua PayOS"
          onClose={() => {
            if (!submittingPayout) setActivePayoutItem(null);
          }}
          busy={submittingPayout}
        >
          <form onSubmit={handleExecutePayout} className="space-y-4">
            {/* Summary card */}
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 p-4 border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Mã nghĩa vụ: #{activePayoutItem.obligationId}</span>
                <span className="font-semibold">{OBLIGATION_TYPE_MAP[activePayoutItem.obligationType]?.label || activePayoutItem.obligationType}</span>
              </div>
              <div className="mt-3">
                <p className="text-xs text-zinc-500">Số tiền cần chi trả chuyển khoản:</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white tabular-nums mt-0.5">
                  {adminMoney(activePayoutItem.refundAmount)}
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-xs space-y-1">
                <p>
                  <strong className="text-zinc-700 dark:text-zinc-300">Tên người nhận:</strong>{' '}
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    {activePayoutItem.targetAccountName || 'Tự động đối soát từ hồ sơ STK đã xác minh của khách'}
                  </span>
                </p>
                <p>
                  <strong className="text-zinc-700 dark:text-zinc-300">Số tài khoản / Ngân hàng:</strong>{' '}
                  <span className="tabular-nums font-mono">
                    {activePayoutItem.targetAccountMasked || (activePayoutItem.receipt?.sourceAccountMasked ? `Nguồn PayOS: ${activePayoutItem.receipt.sourceAccountMasked}` : 'Tự động liên kết khi chi')}
                  </span>
                </p>
                {(activePayoutItem.targetBankBin || activePayoutItem.receipt?.sourceBankBin) && (
                  <p>
                    <strong className="text-zinc-700 dark:text-zinc-300">Mã BIN ngân hàng:</strong>{' '}
                    <span>{activePayoutItem.targetBankBin || activePayoutItem.receipt?.sourceBankBin}</span>
                  </p>
                )}
                {activePayoutItem.status === 'PENDING_RECIPIENT_VERIFICATION' && (
                  <div className="mt-2 p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 text-sky-900 dark:text-sky-200 text-[11px] space-y-1">
                    <p className="font-semibold flex items-center gap-1 text-sky-800 dark:text-sky-300">
                      <Sparkles className="w-3.5 h-3.5 text-[#287DA8]" />
                      <span>Xác minh tài khoản nhận tự động (Zero-Trust ACID)</span>
                    </p>
                    <p>
                      Khi bấm xác nhận, hệ thống Backend sẽ tự động đối soát hồ sơ tài khoản ngân hàng VERIFIED của khách hàng với nguồn thanh toán PayOS. Nếu trùng khớp, hệ thống sẽ tự động liên kết STK và phát lệnh chuyển tiền 24/7 ngay lập tức.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Note Input */}
            <div>
              <label htmlFor="payout-note" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Ghi chú giao dịch Payout (Tùy chọn)
              </label>
              <textarea
                id="payout-note"
                value={payoutNote}
                onChange={e => setPayoutNote(e.target.value)}
                maxLength={500}
                rows={2}
                disabled={submittingPayout}
                className={adminField}
                placeholder="VD: Chi hoàn tiền hủy đơn hàng hoặc đối soát hoàn cọc..."
              />
            </div>

            {/* Security Disclaimer */}
            <div className="rounded-xl p-3 bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 text-xs text-sky-900 dark:text-sky-300 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-[#287DA8]" />
              <span>
                Lệnh chi sẽ được gửi trực tiếp tới cổng PayOS Payout. Số tiền sẽ được khấu trừ từ số dư tài khoản chi trả của nền tảng. Vui lòng bấm xác nhận một lần và chờ kết quả.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={submittingPayout}
                onClick={() => setActivePayoutItem(null)}
                className={adminSecondary}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submittingPayout}
                className={`${primaryButton} flex items-center gap-1.5`}
              >
                {submittingPayout ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang gửi lệnh...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Xác nhận chi tiền</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </AdminWorkflowDialog>
      )}

      {/* Modal: Chi tiết kỹ thuật & nghiệp vụ hoàn tiền */}
      {activeDetailItem && (
        <AdminWorkflowDialog
          title={`Chi tiết đối soát hoàn tiền #${activeDetailItem.obligationId}`}
          onClose={() => setActiveDetailItem(null)}
        >
          <div className="space-y-4 text-xs">
            {/* Khối 1: Thông tin Đơn hàng & Người mua */}
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/80 p-4 border border-zinc-200 dark:border-zinc-700/80">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-200/80 dark:border-zinc-700/80">
                <span className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5 text-xs">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#287DA8]" />
                  <span>Đơn hàng & Người mua</span>
                </span>
                {loadingDetailOrder && (
                  <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Đang tải đơn...</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <span className="text-zinc-500">Mã đơn hàng:</span>
                  <p className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                    {detailOrder?.orderNumber || detailOrder?.orderCode || activeDetailItem.order?.orderCode ? (
                      `#${detailOrder?.orderNumber || detailOrder?.orderCode || activeDetailItem.order?.orderCode}`
                    ) : (
                      `Đơn #${activeDetailItem.orderId || '—'}`
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500">Thời gian đặt đơn:</span>
                  <p className="font-medium text-zinc-900 dark:text-white mt-0.5">
                    {detailOrder?.createdAt ? adminDate(detailOrder.createdAt) : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500">Khách hàng đặt:</span>
                  <p className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                    {detailOrder?.customer?.fullName || 'Chưa ghi nhận'}
                    {detailOrder?.customer?.phone || detailOrder?.customer?.phoneNumber ? (
                      <span className="font-normal text-zinc-500 ml-1">
                        ({detailOrder.customer.phone || detailOrder.customer.phoneNumber})
                      </span>
                    ) : null}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500">Người nhận hàng:</span>
                  <p className="font-medium text-zinc-900 dark:text-white mt-0.5">
                    {detailOrder?.shippingRecipientName || '—'}
                    {detailOrder?.shippingPhone ? (
                      <span className="text-zinc-500 ml-1">({detailOrder.shippingPhone})</span>
                    ) : null}
                  </p>
                </div>
                {detailOrder?.store?.name && (
                  <div>
                    <span className="text-zinc-500">Cửa hàng phục vụ:</span>
                    <p className="font-medium text-zinc-900 dark:text-white mt-0.5">
                      {detailOrder.store.name}
                    </p>
                  </div>
                )}
                {detailOrder?.shippingAddress && (
                  <div className="sm:col-span-2">
                    <span className="text-zinc-500">Địa chỉ giao:</span>
                    <p className="font-normal text-zinc-700 dark:text-zinc-300 mt-0.5 break-words">
                      {detailOrder.shippingAddress}
                    </p>
                  </div>
                )}
              </div>

              {/* Sản phẩm trong đơn */}
              {detailOrder?.items && detailOrder.items.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-zinc-200/70 dark:border-zinc-700/70">
                  <span className="text-zinc-500 font-medium">Sản phẩm đã đặt ({detailOrder.items.length}):</span>
                  <div className="mt-1.5 space-y-1">
                    {detailOrder.items.map((it: any, idx: number) => (
                      <div
                        key={it.orderItemId || idx}
                        className="flex justify-between items-center py-1 px-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-700/60"
                      >
                        <span className="font-medium text-zinc-900 dark:text-white">
                          {it.quantity}× {it.productName || it.name || 'Sản phẩm'}
                        </span>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">
                          {adminMoney(it.totalPrice || (it.unitPrice || it.price || 0) * it.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Khối 2: Nguồn thanh toán PayOS đã thu */}
            {activeDetailItem.receipt && (
              <div className="rounded-xl bg-sky-50/60 dark:bg-sky-950/20 p-4 border border-sky-100 dark:border-sky-900/40">
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-sky-200/60 dark:border-sky-900/40">
                  <span className="font-semibold text-sky-900 dark:text-sky-300 flex items-center gap-1.5 text-xs">
                    <Receipt className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                    <span>Nguồn tiền đã thu qua PayOS</span>
                  </span>
                  <span className="font-mono text-[11px] text-sky-700 dark:text-sky-300">
                    GD: {activeDetailItem.receipt.providerTransactionRef || activeDetailItem.receipt.receiptId}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-zinc-500">Số tiền khách đã trả:</span>
                    <p className="font-bold text-sky-800 dark:text-sky-300 mt-0.5 tabular-nums">
                      {adminMoney(activeDetailItem.receipt.amount)}
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Thời gian thanh toán PayOS:</span>
                    <p className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                      {activeDetailItem.receipt.receivedAt ? adminDate(activeDetailItem.receipt.receivedAt) : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Tài khoản nguồn khách chuyển:</span>
                    <p className="font-mono font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                      {activeDetailItem.receipt.sourceAccountMasked || '—'}
                      {activeDetailItem.receipt.sourceBankBin ? ` (BIN ${activeDetailItem.receipt.sourceBankBin})` : ''}
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Kênh thanh toán:</span>
                    <p className="font-medium text-zinc-800 dark:text-zinc-200 mt-0.5">
                      {activeDetailItem.receipt.channel || activeDetailItem.receipt.provider || 'PayOS'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Khối 3: Kế hoạch chi trả hoàn tiền */}
            {(() => {
              const modalStatusMeta = STATUS_MAP[activeDetailItem.status] || {
                label: activeDetailItem.status,
                tone: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300',
                icon: HelpCircle,
              };
              const ModalStatusIcon = modalStatusMeta.icon;

              return (
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-850 p-4 border border-zinc-200 dark:border-zinc-700/80 space-y-3.5">
                  <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200/80 dark:border-zinc-700/80">
                    <span className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5 text-xs">
                      <CreditCard className="w-3.5 h-3.5 text-[#287DA8]" />
                      <span>Kế hoạch chi trả hoàn tiền (PayOS Payout)</span>
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 tabular-nums">
                      Cần hoàn: {adminMoney(activeDetailItem.refundAmount)}
                    </span>
                  </div>

                  {/* Grid thông số cơ bản */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-zinc-500">Mã nghĩa vụ tài chính:</span>
                      <p className="font-semibold text-zinc-900 dark:text-white mt-0.5">
                        #{activeDetailItem.obligationId}
                        <span className="font-normal text-zinc-400 text-[11px] ml-1.5">
                          ({OBLIGATION_TYPE_MAP[activeDetailItem.obligationType]?.label || activeDetailItem.obligationType})
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-zinc-500">Thời gian tạo yêu cầu hoàn:</span>
                      <p className="font-medium text-zinc-900 dark:text-white mt-0.5">
                        {activeDetailItem.createdAt ? adminDate(activeDetailItem.createdAt) : '—'}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-zinc-500">Trạng thái tiến trình:</span>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${modalStatusMeta.tone}`}>
                          <ModalStatusIcon className="w-3.5 h-3.5" />
                          <span>{modalStatusMeta.label}</span>
                        </span>
                        {activeDetailItem.status === 'PENDING_RECIPIENT_VERIFICATION' && (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            (Hệ thống đang tạm khóa nút chi tiền để bảo vệ nguồn quỹ cho đến khi có STK hợp lệ)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Thẻ tài khoản thụ hưởng */}
                  <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-750">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        Tài khoản đích nhận tiền hoàn
                      </span>
                      {activeDetailItem.targetAccountMasked ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3 h-3" /> Đã xác thực
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-medium">
                          <Clock3 className="w-3 h-3" /> Chờ bổ sung STK
                        </span>
                      )}
                    </div>

                    {activeDetailItem.targetAccountMasked ? (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-zinc-400 text-[11px]">Chủ tài khoản:</span>
                          <p className="font-bold text-zinc-900 dark:text-white">{activeDetailItem.targetAccountName}</p>
                        </div>
                        <div>
                          <span className="text-zinc-400 text-[11px]">Số tài khoản / Ngân hàng:</span>
                          <p className="font-mono font-medium text-zinc-900 dark:text-white">
                            {activeDetailItem.targetAccountMasked} (BIN: {activeDetailItem.targetBankBin})
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-zinc-800 dark:text-zinc-200">
                            Chưa có thông tin số tài khoản ngân hàng thụ hưởng
                          </p>
                          <p className="text-[11px] text-zinc-500 mt-0.5">
                            Khách hàng chưa đăng ký số tài khoản ngân hàng để nhận tiền hoàn qua PayOS Payout.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Thông tin giao dịch Payout qua Napas / PayOS nếu đã phát sinh */}
                  {(activeDetailItem.activePayoutAttemptId || activeDetailItem.settledAttemptId) && (
                    <div className="p-2.5 rounded-lg bg-zinc-100/70 dark:bg-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                      <span className="text-zinc-500">Mã giao dịch chi tiền (Payout Attempt):</span>
                      <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                        {activeDetailItem.activePayoutAttemptId || activeDetailItem.settledAttemptId}
                      </span>
                    </div>
                  )}

                  {/* Lịch sử các đợt phát lệnh chi PayOS */}
                  {Array.isArray(activeDetailItem.payoutAttempts) && activeDetailItem.payoutAttempts.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        Lịch sử gửi lệnh chi PayOS ({activeDetailItem.payoutAttempts.length})
                      </span>
                      <div className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden text-xs">
                        {activeDetailItem.payoutAttempts.map((att: any, idx: number) => (
                          <div key={att.attemptId || idx} className="p-2.5 bg-zinc-50/60 dark:bg-zinc-850/60 flex items-center justify-between">
                            <div>
                              <span className="font-mono font-semibold text-zinc-900 dark:text-white">
                                #{att.attemptId || idx + 1} {att.payoutReference ? `(${att.payoutReference})` : ''}
                              </span>
                              {att.failureReason && (
                                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">{att.failureReason}</p>
                              )}
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                              {att.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hướng dẫn đối soát & Cảnh báo an toàn */}
                  {activeDetailItem.verificationNote && (
                    <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-amber-900 dark:text-amber-300">
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <p className="font-bold">Ghi chú đối soát & Hướng dẫn xử lý:</p>
                          <p className="mt-0.5 text-amber-800 dark:text-amber-200 font-medium">
                            {activeDetailItem.verificationNote}
                          </p>
                          {activeDetailItem.status === 'READY_FOR_PAYOUT' && (
                            <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                              ✅ Tài khoản ngân hàng của khách đã được đối soát thành công và khớp chính chủ với giao dịch gốc.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Lý do lỗi nếu PayOS phản hồi thất bại */}
                  {activeDetailItem.failureReason && (
                    <div className="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 text-rose-900 dark:text-rose-300">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <p className="font-bold">Thông báo chi trả PayOS:</p>
                          <p className="mt-0.5 text-rose-800 dark:text-rose-200 font-medium">
                            {activeDetailItem.failureReason}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              {['PENDING', 'READY_FOR_PAYOUT', 'PENDING_RECIPIENT_VERIFICATION', 'FAILED'].includes(activeDetailItem.status) && (
                <button
                  type="button"
                  onClick={() => {
                    const toPayout = activeDetailItem;
                    setActiveDetailItem(null);
                    setActivePayoutItem(toPayout);
                    setPayoutNote('');
                  }}
                  className={`${primaryButton} !py-1.5 !px-3 !text-xs flex items-center gap-1.5 shadow-xs`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Chi PayOS ngay</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveDetailItem(null)}
                className={adminSecondary}
              >
                Đóng
              </button>
            </div>
          </div>
        </AdminWorkflowDialog>
      )}
    </div>
  );
};
