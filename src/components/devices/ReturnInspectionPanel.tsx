import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Wallet,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { toast } from '../../context/ToastContext';

export interface ReturnRequestItem {
  returnId: string;
  returnCode: string;
  rentalId: string;
  rentalCode?: string | null;
  rentalStatus?: string | null;
  buttonId: string;
  deviceId?: string | null;
  buttonCode?: string | null;
  customName?: string | null;
  inventoryState?: string | null;
  status: 'PENDING_RECEIPT' | 'RECEIVED' | string;
  inspectionNote?: string | null;
  receivedAt?: string | null;
  inspectedAt?: string | null;
  createdAt?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  store?: { storeId: string; name: string; code: string } | null;
  depositAmount?: number | null;
  depositRefund?: {
    refundId: string;
    refundCode: string;
    status: string;
    refundAmount: number;
  } | null;
}

const isCanceledRequest = (err: any, signal: AbortSignal): boolean =>
  signal.aborted || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED';

const INSPECTION_PRESETS = [
  'Thiết bị hoạt động tốt, đủ phụ kiện, nhận trả hoàn tất',
  'Vỏ trầy xước nhẹ, nút bấm & kết nối hoạt động bình thường',
];

export const ReturnInspectionPanel: React.FC<{ onConfirmed?: () => Promise<void> | void }> = ({
  onConfirmed,
}) => {
  const [items, setItems] = useState<ReturnRequestItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'PENDING_RECEIPT' | 'RECEIVED' | 'ALL'>(
    'PENDING_RECEIPT'
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [inspectingItem, setInspectingItem] = useState<ReturnRequestItem | null>(null);
  const [inspectionNote, setInspectionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmResult, setConfirmResult] = useState<any | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const genRef = useRef(0);

  const loadReturns = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const gen = ++genRef.current;

    setLoading(true);
    setLoadError('');
    try {
      const res = await api.get('/rentals/returns', {
        params: {
          page,
          pageSize: 12,
          status: statusFilter,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
        signal: controller.signal,
      });
      if (controller.signal.aborted || gen !== genRef.current) return;
      if (res.data?.success && Array.isArray(res.data.data)) {
        const p = res.data.pagination || {};
        setItems(res.data.data);
        setTotalItems(Number(p.totalItems ?? res.data.data.length));
        setTotalPages(Math.max(1, Number(p.totalPages || 1)));
      }
    } catch (err: any) {
      if (isCanceledRequest(err, controller.signal) || gen !== genRef.current) return;
      setLoadError(
        err?.response?.data?.message || 'Không tải được danh sách phiếu trả nút từ máy chủ.'
      );
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void loadReturns();
  }, [loadReturns]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const openInspectModal = (item: ReturnRequestItem) => {
    setInspectingItem(item);
    setInspectionNote(
      item.inspectionNote || 'Thiết bị hoạt động tốt, đủ phụ kiện, nhận trả hoàn tất'
    );
    setSubmitError('');
    setConfirmResult(null);
  };

  const handleConfirmReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingItem || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await api.post(
        `/rentals/returns/${encodeURIComponent(inspectingItem.returnId)}/confirm-receipt`,
        {
          inspectionNote: inspectionNote.trim() || 'Thiết bị hoạt động tốt, nhận trả hoàn tất',
        }
      );
      if (res.data?.success === false) {
        setSubmitError(res.data?.message || 'Không thể xác nhận tiếp nhận nút trả.');
        return;
      }
      setConfirmResult(res.data?.data || { status: 'RECEIVED' });
      toast.success(res.data?.message || 'Đã tiếp nhận nút trả & xếp hàng đợi hoàn cọc.');
      await loadReturns();
      if (onConfirmed) await onConfirmed();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        'Mất kết nối hoặc chưa nhận được phản hồi xác nhận. Ghi chú của bạn vẫn được giữ nguyên để thử lại.';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const portalTarget =
    typeof document !== 'undefined' ? document.getElementById('modal-root') || document.body : null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-[#0E6BA8] dark:text-sky-400 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-white flex flex-wrap items-center gap-2">
              <span>Tiếp nhận & Kiểm tra Nút Khách trả</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                {totalItems} phiếu
              </span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Xác nhận tình trạng phần cứng khi khách hoàn trả nút thuê để thu hồi về kho và đẩy yêu cầu hoàn cọc sang hàng đợi của Admin (Staff không tự duyệt chi tiền).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadReturns()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Tải lại</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: 'PENDING_RECEIPT', label: 'Chờ kiểm nhận' },
            { key: 'RECEIVED', label: 'Đã nhận về kho' },
            { key: 'ALL', label: 'Tất cả' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatusFilter(tab.key as any);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-[#0E6BA8] text-white border-[#0E6BA8]'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm mã phiếu, mã nút, mã HĐ..."
            aria-label="Tìm phiếu trả nút"
            className="pl-8 pr-3 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#0E6BA8] w-full sm:w-64"
          />
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </span>
          <button
            type="button"
            onClick={() => void loadReturns()}
            className="px-2.5 py-1 rounded bg-white dark:bg-zinc-900 border border-rose-300 dark:border-rose-700 font-semibold cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {!loading && items.length === 0 ? (
        <div className="p-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center space-y-2 bg-zinc-50/50 dark:bg-zinc-900/50">
          <RotateCcw className="w-7 h-7 text-zinc-400 mx-auto" />
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            {search.trim()
              ? 'Không tìm thấy phiếu trả nút nào khớp từ khóa'
              : statusFilter === 'PENDING_RECEIPT'
                ? 'Không có nút khách trả nào đang chờ kiểm nhận'
                : 'Chưa có yêu cầu trả nút nào'}
          </p>
          {search.trim() && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="px-3 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 cursor-pointer"
            >
              Xóa bộ lọc tìm kiếm
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Mã phiếu / HĐ</th>
                  <th className="py-2.5 px-3">Nút bấm</th>
                  <th className="py-2.5 px-3">Khách hàng</th>
                  <th className="py-2.5 px-3">Kho tiếp nhận</th>
                  <th className="py-2.5 px-3">Trạng thái phần cứng</th>
                  <th className="py-2.5 px-3">Trạng thái hoàn cọc (Admin)</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {items.map((item) => {
                  const isPending = item.status === 'PENDING_RECEIPT';
                  return (
                    <tr
                      key={item.returnId}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-zinc-900 dark:text-white">
                          {item.returnCode}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          HĐ: {item.rentalCode || `#${item.rentalId}`}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-zinc-900 dark:text-white inline-flex items-center gap-1">
                          <Cpu className="w-3.5 h-3.5 text-[#0E6BA8]" />
                          <span>{item.deviceId || `#${item.buttonId}`}</span>
                        </div>
                        {item.buttonCode && (
                          <div className="text-[11px] text-zinc-500">Code: {item.buttonCode}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-zinc-800 dark:text-zinc-200 font-medium">
                          {item.customerName || 'Khách thuê nút'}
                        </div>
                        {item.customerPhone && (
                          <div className="text-[11px] text-zinc-500">{item.customerPhone}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-700 dark:text-zinc-300">
                        {item.store?.name || 'Kho hệ thống'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isPending
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          }`}
                        >
                          {isPending ? 'Chờ kiểm nhận' : 'Đã nhận về kho'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {item.depositRefund ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800">
                              <Wallet className="w-3 h-3" />
                              <span>{item.depositRefund.status}</span>
                            </span>
                            <div className="text-[11px] text-zinc-500 tabular-nums">
                              {item.depositRefund.refundAmount.toLocaleString('vi-VN')} ₫ ·{' '}
                              {item.depositRefund.refundCode}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-500 tabular-nums">
                            {item.depositAmount
                              ? `Dự kiến hoàn: ${item.depositAmount.toLocaleString('vi-VN')} ₫`
                              : 'Chờ kiểm nhận'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => openInspectModal(item)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isPending
                              ? 'bg-[#0E6BA8] hover:bg-[#0B5586] text-white'
                              : 'border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {isPending ? 'Kiểm tra & Nhận nút' : 'Xem kết quả'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>
                Trang {page} / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loading || page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 cursor-pointer"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={loading || page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 disabled:opacity-40 cursor-pointer"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {inspectingItem &&
        portalTarget &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm">
            <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                    Kiểm tra & Tiếp nhận Nút Trả [{inspectingItem.returnCode}]
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Nút: <strong>{inspectingItem.deviceId}</strong> · HĐ:{' '}
                    <strong>{inspectingItem.rentalCode || `#${inspectingItem.rentalId}`}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setInspectingItem(null)}
                  aria-label="Đóng hộp thoại"
                  className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {confirmResult ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30 p-3.5 space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Kết quả kỹ thuật: Đã thu hồi thiết bị về kho</span>
                    </div>
                    <p className="text-emerald-700 dark:text-emerald-400">
                      Nút <strong>{inspectingItem.deviceId}</strong> đã chuyển về trạng thái kho{' '}
                      <code>{confirmResult.button?.inventoryState || 'ALLOCATED_TO_STORE'}</code>.
                    </p>
                  </div>

                  <div className="rounded-xl border border-sky-200 bg-sky-50/70 dark:border-sky-800 dark:bg-sky-950/30 p-3.5 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-sky-800 dark:text-sky-300">
                      <Wallet className="w-4 h-4 shrink-0" />
                      <span>
                        Hoàn cọc tài chính: {confirmResult.depositRefund?.status || 'PENDING_APPROVAL'}
                      </span>
                    </div>
                    <p className="text-sky-700 dark:text-sky-400">
                      Lệnh hoàn cọc{' '}
                      <strong>{confirmResult.depositRefund?.refundCode || 'đã được xếp hàng'}</strong>{' '}
                      đã chuyển sang bộ phận <strong>Admin tài chính</strong> duyệt chi.
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setInspectingItem(null)}
                      className="px-4 py-2 rounded-lg bg-[#0E6BA8] text-white text-xs font-semibold cursor-pointer"
                    >
                      Quay về danh sách trả nút
                    </button>
                  </div>
                </div>
              ) : inspectingItem.status === 'PENDING_RECEIPT' ? (
                <form onSubmit={handleConfirmReceipt} className="space-y-3.5">
                  <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 p-3 text-xs space-y-1">
                    <div>
                      Khách hàng: <strong>{inspectingItem.customerName || 'Khách hàng'}</strong>{' '}
                      {inspectingItem.customerPhone ? `(${inspectingItem.customerPhone})` : ''}
                    </div>
                    <div>
                      Kho tiếp nhận: <strong>{inspectingItem.store?.name || 'Kho hệ thống'}</strong>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="return-inspection-note"
                      className="block text-xs font-semibold text-zinc-700 dark:text-zinc-200"
                    >
                      Biên bản kiểm tra phần cứng
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {INSPECTION_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          disabled={submitting}
                          onClick={() => setInspectionNote(preset)}
                          className="px-2 py-1 rounded text-[11px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <textarea
                      id="return-inspection-note"
                      rows={3}
                      maxLength={500}
                      required
                      disabled={submitting}
                      value={inspectionNote}
                      onChange={(e) => setInspectionNote(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#0E6BA8]"
                      placeholder="Nhập tình trạng nút bấm, phụ kiện khi tiếp nhận..."
                    />
                  </div>

                  <div className="rounded-lg border border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30 p-2.5 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Xác nhận sẽ thu hồi thiết bị về kho và tạo lệnh hoàn cọc{' '}
                      <strong>PENDING_APPROVAL</strong> chờ Admin tài chính duyệt.
                    </span>
                  </div>

                  {submitError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
                      {submitError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setInspectingItem(null)}
                      className="px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300 cursor-pointer disabled:opacity-50"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? 'Đang xác nhận...' : 'Xác nhận tiếp nhận về kho'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 space-y-1.5">
                    <div>
                      Trạng thái trả: <strong>Đã kiểm nhận ({inspectingItem.status})</strong>
                    </div>
                    <div>
                      Ghi chú kiểm tra: <span>{inspectingItem.inspectionNote || '—'}</span>
                    </div>
                    {inspectingItem.depositRefund && (
                      <div>
                        Hoàn cọc tài chính:{' '}
                        <strong>
                          {inspectingItem.depositRefund.refundCode} ·{' '}
                          {inspectingItem.depositRefund.status} (
                          {inspectingItem.depositRefund.refundAmount.toLocaleString('vi-VN')} ₫)
                        </strong>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setInspectingItem(null)}
                      className="px-4 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          portalTarget
        )}
    </div>
  );
};
