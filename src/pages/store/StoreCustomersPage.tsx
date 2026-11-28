import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  RefreshCw,
  ShieldBan,
  ShieldCheck,
  X,
  Phone,
  Mail,
  Calendar,
  ShoppingBag,
  Wallet,
  Eye,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../context/ToastContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface StoreCustomerItem {
  storeCustomerId: number;
  storeId: number;
  customerId: number;
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  status: 'ACTIVE' | 'BLOCKED' | string;
  joinedAt?: string;
  totalOrders: number;
  totalSpent: number;
}

const formatVnd = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value) || 0);

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const StoreCustomersPage: React.FC = () => {
  const { user } = useAuth();
  const storeId = user?.storeId;

  const [customers, setCustomers] = useState<StoreCustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED'>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [selectedCustomer, setSelectedCustomer] = useState<StoreCustomerItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<{
    customer: StoreCustomerItem;
    nextStatus: 'ACTIVE' | 'BLOCKED';
  } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useBodyScrollLock(!!selectedCustomer || !!confirmTarget);

  const fetchCustomers = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, any> = { page, pageSize: 20 };
      if (appliedSearch.trim()) params.search = appliedSearch.trim();
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const res = await api.get(`/stores/${storeId}/customers`, { params });
      const rows = res.data?.data ?? [];
      setCustomers(Array.isArray(rows) ? rows : []);
      if (res.data?.pagination) {
        setTotalPages(Math.max(1, Number(res.data.pagination.totalPages || 1)));
        setTotalItems(Number(res.data.pagination.totalItems || rows.length || 0));
      } else {
        setTotalItems(Array.isArray(rows) ? rows.length : 0);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không tải được danh sách khách hàng.');
    } finally {
      setLoading(false);
    }
  }, [storeId, page, appliedSearch, statusFilter]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  const openCustomerDetail = async (row: StoreCustomerItem) => {
    setSelectedCustomer(row);
    if (!storeId) return;
    setDetailLoading(true);
    try {
      const res = await api.get(`/stores/${storeId}/customers/${row.customerId}`);
      if (res.data?.data) {
        setSelectedCustomer(res.data.data);
      }
    } catch {
      // Keep row data if detail request fails
    } finally {
      setDetailLoading(false);
    }
  };

  const handleConfirmStatusChange = async () => {
    if (!storeId || !confirmTarget) return;
    setUpdatingStatus(true);
    try {
      const { customer, nextStatus } = confirmTarget;
      const res = await api.patch(`/stores/${storeId}/customers/${customer.customerId}/status`, {
        status: nextStatus,
      });
      const updated = res.data?.data;
      setCustomers((prev) =>
        prev.map((c) =>
          c.customerId === customer.customerId ? { ...c, ...(updated || {}), status: nextStatus } : c
        )
      );
      if (selectedCustomer?.customerId === customer.customerId) {
        setSelectedCustomer((prev) => (prev ? { ...prev, ...(updated || {}), status: nextStatus } : null));
      }
      toast.success(
        nextStatus === 'BLOCKED'
          ? `Đã chặn khách hàng ${customer.fullName || `#${customer.customerId}`}.`
          : `Đã bỏ chặn khách hàng ${customer.fullName || `#${customer.customerId}`}.`
      );
      setConfirmTarget(null);
      void fetchCustomers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể cập nhật trạng thái khách hàng.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const activeCount = customers.filter((c) => c.status === 'ACTIVE').length;
  const blockedCount = customers.filter((c) => c.status === 'BLOCKED').length;
  const pageSpent = customers.reduce((sum, c) => sum + (Number(c.totalSpent) || 0), 0);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#287DA8]">CRM Cửa hàng</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-[#287DA8]" />
            <span>Khách hàng thân thiết</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Theo dõi lịch sử mua hàng, chi tiêu tích lũy và quản lý quyền đặt hàng tại cửa hàng của bạn.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchCustomers()}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start sm:self-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Tổng khách hàng</p>
          <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white tabular-nums">{totalItems}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Đang hoạt động (trang này)</p>
          <p className="mt-1 text-xl font-bold text-emerald-600 tabular-nums">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Đã chặn (trang này)</p>
          <p className="mt-1 text-xl font-bold text-rose-600 tabular-nums">{blockedCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Chi tiêu trang hiện tại</p>
          <p className="mt-1 text-xl font-bold text-[#287DA8] tabular-nums">{formatVnd(pageSpent)}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: 'ALL', label: 'Tất cả' },
              { id: 'ACTIVE', label: 'Đang hoạt động' },
              { id: 'BLOCKED', label: 'Đã chặn' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setPage(1);
                setStatusFilter(tab.id);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === tab.id
                  ? 'bg-[#287DA8] text-white'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200/80 dark:hover:bg-zinc-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setAppliedSearch(searchInput);
          }}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          <div className="relative flex-1 sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm tên, SĐT, email khách hàng..."
              className="w-full rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-zinc-100 focus:border-[#287DA8] focus:bg-white focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 dark:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Tìm
          </button>
          {appliedSearch && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setAppliedSearch('');
                setPage(1);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-400"
            >
              Xóa
            </button>
          )}
        </form>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-10 text-center text-xs text-slate-500">Đang tải danh sách khách hàng...</div>
        ) : customers.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700 dark:text-zinc-200">Chưa có khách hàng phù hợp</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Khách hàng sẽ tự động xuất hiện sau khi kết nối nút hoặc phát sinh đơn hàng tại cửa hàng.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/50 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Liên hệ</th>
                  <th className="px-4 py-3 text-right">Số đơn</th>
                  <th className="px-4 py-3 text-right">Tổng chi tiêu</th>
                  <th className="px-4 py-3">Ngày tham gia</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {customers.map((row) => {
                  const isBlocked = row.status === 'BLOCKED';
                  return (
                    <tr
                      key={row.storeCustomerId || row.customerId}
                      className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">{row.fullName || `Khách hàng #${row.customerId}`}</div>
                        <div className="text-[11px] text-slate-400">KH #{row.customerId}</div>
                      </td>
                      <td className="px-4 py-3 space-y-0.5 text-slate-600 dark:text-zinc-300">
                        <div>{row.phone || '—'}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[190px]">{row.email || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800 dark:text-zinc-200">
                        {row.totalOrders ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#287DA8]">
                        {formatVnd(row.totalSpent)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-zinc-400 tabular-nums">
                        {formatDate(row.joinedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            isBlocked
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
                          }`}
                        >
                          {isBlocked ? 'Đã chặn' : 'Hoạt động'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void openCustomerDetail(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-zinc-200 hover:bg-slate-50"
                          >
                            <Eye className="w-3 h-3" /> Chi tiết
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmTarget({
                                customer: row,
                                nextStatus: isBlocked ? 'ACTIVE' : 'BLOCKED',
                              })
                            }
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                              isBlocked
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                            }`}
                          >
                            {isBlocked ? <ShieldCheck className="w-3 h-3" /> : <ShieldBan className="w-3 h-3" />}
                            <span>{isBlocked ? 'Bỏ chặn' : 'Chặn khách'}</span>
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 px-4 py-3 text-xs text-slate-500">
            <span>
              Trang {page}/{totalPages} ({totalItems} khách hàng)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1 font-medium disabled:opacity-40"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 px-3 py-1 font-medium disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Detail Drawer */}
      {selectedCustomer &&
        createPortal(
          <div className="fixed inset-0 z-[105] flex justify-end">
            <div
              onClick={() => setSelectedCustomer(null)}
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            />
            <div className="relative z-10 w-full max-w-md bg-white dark:bg-zinc-900 h-full shadow-2xl border-l border-slate-200 dark:border-zinc-800 flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 px-5 py-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#287DA8]">Hồ sơ khách hàng</p>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedCustomer.fullName || `Khách hàng #${selectedCustomer.customerId}`}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                {detailLoading && (
                  <p className="text-[11px] text-[#287DA8]">Đang đồng bộ số liệu mới nhất...</p>
                )}

                <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/50 p-3.5">
                  <div>
                    <p className="text-[11px] text-slate-500">Trạng thái tại cửa hàng</p>
                    <p className="font-bold text-sm mt-0.5 text-slate-900 dark:text-white">
                      {selectedCustomer.status === 'BLOCKED' ? 'Đã chặn (BLOCKED)' : 'Đang hoạt động (ACTIVE)'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmTarget({
                        customer: selectedCustomer,
                        nextStatus: selectedCustomer.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED',
                      })
                    }
                    className={`rounded-lg px-3 py-1.5 font-semibold ${
                      selectedCustomer.status === 'BLOCKED'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                    }`}
                  >
                    {selectedCustomer.status === 'BLOCKED' ? 'Bỏ chặn khách' : 'Chặn khách hàng'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3.5">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                      <ShoppingBag className="w-3.5 h-3.5 text-[#287DA8]" />
                      <span>Tổng đơn hàng</span>
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                      {selectedCustomer.totalOrders ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3.5">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Tổng chi tiêu</span>
                    </div>
                    <p className="text-lg font-bold text-[#287DA8] tabular-nums">
                      {formatVnd(selectedCustomer.totalSpent)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-4 space-y-3">
                  <h4 className="font-semibold text-slate-800 dark:text-zinc-200">Thông tin liên hệ</h4>
                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-zinc-300">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{selectedCustomer.phone || 'Chưa cập nhật số điện thoại'}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-zinc-300">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{selectedCustomer.email || 'Chưa cập nhật email'}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-zinc-300">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Ngày kết nối: {formatDate(selectedCustomer.joinedAt)}</span>
                  </div>
                </div>

                <Link
                  to={`/store/dashboard?q=${encodeURIComponent(selectedCustomer.phone || selectedCustomer.fullName || '')}`}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#287DA8]/30 bg-[#287DA8]/5 px-4 py-2.5 font-semibold text-[#287DA8] hover:bg-[#287DA8]/10"
                >
                  <span>Xem đơn hàng của khách này</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Confirm Block / Unblock Modal */}
      {confirmTarget &&
        createPortal(
          <div className="fixed inset-0 z-[115] flex items-center justify-center p-4">
            <div
              onClick={() => !updatingStatus && setConfirmTarget(null)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    confirmTarget.nextStatus === 'BLOCKED'
                      ? 'bg-rose-100 text-rose-600'
                      : 'bg-emerald-100 text-emerald-600'
                  }`}
                >
                  {confirmTarget.nextStatus === 'BLOCKED' ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : (
                    <ShieldCheck className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {confirmTarget.nextStatus === 'BLOCKED'
                      ? 'Xác nhận chặn khách hàng?'
                      : 'Xác nhận bỏ chặn khách hàng?'}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-zinc-300">
                    {confirmTarget.nextStatus === 'BLOCKED' ? (
                      <>
                        Khách hàng <strong>{confirmTarget.customer.fullName || `#${confirmTarget.customer.customerId}`}</strong> sẽ không thể đặt đơn mới tại cửa hàng của bạn (bao gồm qua nút IoT và Storefront). Lịch sử đơn hàng cũ vẫn được bảo toàn.
                      </>
                    ) : (
                      <>
                        Khách hàng <strong>{confirmTarget.customer.fullName || `#${confirmTarget.customer.customerId}`}</strong> sẽ được phép đặt hàng trở lại tại cửa hàng của bạn.
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={updatingStatus}
                  onClick={() => setConfirmTarget(null)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={updatingStatus}
                  onClick={() => void handleConfirmStatusChange()}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                    confirmTarget.nextStatus === 'BLOCKED'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {updatingStatus
                    ? 'Đang cập nhật...'
                    : confirmTarget.nextStatus === 'BLOCKED'
                    ? 'Xác nhận chặn'
                    : 'Bỏ chặn'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
