import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, Download, History, Loader2, ReceiptText, RefreshCw, Search, WalletCards } from 'lucide-react';
import { api, apiSessionMarker } from '../../services/api';
import { filterSubscriptionPayments, isPaidSubscription, loadSubscriptionPayments, subscriptionDateLabel, subscriptionMoney, subscriptionMonth, subscriptionPaidTotal, subscriptionPaymentStatus, subscriptionPaymentsCSV, type SubscriptionPayment } from '../../services/store-subscription-overview';

const PAGE_SIZE = 10;
const buttonClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800';

export const StoreSubscriptionPayments: React.FC<{ scope: string; storeId: string | null; refreshKey: number }> = ({ scope, storeId, refreshKey }) => {
  const [result, setResult] = useState<{ scope: string; rows: SubscriptionPayment[]; ready: boolean; loading: boolean; error: string; updatedAt: string | null }>({ scope, rows: [], ready: false, loading: true, error: '', updatedAt: null });
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('ALL');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exportError, setExportError] = useState('');
  const [now, setNow] = useState(Date.now());
  const owner = useRef(scope);
  owner.current = scope;
  const generation = useRef(0);
  const flight = useRef<Promise<void> | null>(null);

  const load = useCallback(async () => {
    if (!storeId || owner.current !== scope) return;
    if (flight.current) return flight.current;
    const request = ++generation.current;
    const session = apiSessionMarker();
    setResult(current => ({ ...(current.scope === scope ? current : { scope, rows: [], ready: false, updatedAt: null }), loading: true, error: '' }));
    const work = (async () => {
      try {
        const rows = await loadSubscriptionPayments(api, () => owner.current === scope && request === generation.current && session === apiSessionMarker());
        if (!rows) return;
        if (owner.current !== scope || request !== generation.current || session !== apiSessionMarker()) return;
        const timestamp = new Date().toISOString();
        setNow(Date.now());
        setResult({ scope, rows, ready: true, loading: false, error: '', updatedAt: timestamp });
      } catch {
        if (owner.current !== scope || request !== generation.current || session !== apiSessionMarker()) return;
        setResult(current => ({ ...current, loading: false, error: 'Chưa cập nhật được lịch sử đóng phí. Hãy thử lại; dữ liệu đã tải vẫn được giữ nguyên.' }));
      }
    })();
    flight.current = work;
    try { await work; } finally { if (flight.current === work) flight.current = null; }
  }, [scope, storeId]);

  useEffect(() => {
    ++generation.current; flight.current = null;
    setResult({ scope, rows: [], ready: false, loading: !!storeId, error: '', updatedAt: null });
    setQuery(''); setPeriod('ALL'); setPage(1); setExpanded(null); setExportError('');
    if (storeId) void load();
    return () => { ++generation.current; flight.current = null; };
  }, [scope, storeId, load]);
  const previousRefresh = useRef(refreshKey);
  useEffect(() => { if (previousRefresh.current !== refreshKey) { previousRefresh.current = refreshKey; void load(); } }, [refreshKey, load]);
  useEffect(() => {
    const refresh = () => { setNow(Date.now()); if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);

  const visible = result.scope === scope ? result : { rows: [], ready: false, loading: !!storeId, error: '', updatedAt: null };
  const paid = visible.rows.filter(isPaidSubscription);
  const total = visible.ready ? subscriptionPaidTotal(visible.rows) : null;
  const monthTotal = visible.ready ? subscriptionPaidTotal(paid.filter(row => subscriptionMonth(row.createdAt) === subscriptionMonth(now))) : null;
  const latest = paid[0];
  const filtered = useMemo(() => filterSubscriptionPayments(visible.rows, query, period, now), [visible.rows, query, period, now]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const exportCSV = () => {
    setExportError('');
    let url: string | null = null;
    try {
      url = URL.createObjectURL(new Blob([subscriptionPaymentsCSV(filtered)], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a'); link.href = url; link.download = `Lich_su_phi_thue_san_${new Date(now).toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link); link.click(); link.remove();
    } catch { setExportError('Chưa xuất được lịch sử. Vui lòng thử lại.'); }
    finally { if (url) URL.revokeObjectURL(url); }
  };

  return <section id="subscription-payments" aria-labelledby="subscription-payments-title" className="scroll-mt-24 space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'Tổng phí thuê sàn qua ví', value: subscriptionMoney(total), detail: 'Các khoản phí đã trừ ví thành công', icon: WalletCards },
        { label: 'Đã chi trong tháng này', value: subscriptionMoney(monthTotal), detail: 'Theo giờ Việt Nam', icon: CalendarDays },
        { label: 'Số lần đóng phí', value: visible.ready ? `${paid.length} lần` : '—', detail: 'Chỉ tính giao dịch thành công', icon: ReceiptText },
        { label: 'Lần đóng phí gần nhất', value: latest ? subscriptionMoney(-latest.amount) : visible.ready ? 'Chưa ghi nhận' : '—', detail: latest ? subscriptionDateLabel(latest.createdAt, true) : 'Lịch sử thanh toán qua ví', icon: History },
      ].map(({ label, value, detail, icon: Icon }) => <div key={label} className="min-w-0 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-center justify-between gap-2"><p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p><Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-[#287DA8]" /></div><p className="mt-3 break-words text-xl font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-white">{value}</p><p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{detail}</p></div>)}
    </div>
    <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900" aria-busy={visible.loading}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="subscription-payments-title" className="text-base font-semibold text-zinc-900 dark:text-white">Lịch sử đóng phí thuê sàn</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">Các khoản thanh toán gói gian hàng của cửa hàng qua ví. Tổng tiền chưa bao gồm hoàn phí hoặc thanh toán qua kênh khác.</p>{visible.updatedAt && <p className="mt-1 text-[11px] text-zinc-400">Cập nhật: {subscriptionDateLabel(visible.updatedAt, true)}</p>}</div><div className="flex gap-2"><button type="button" onClick={() => void load()} disabled={visible.loading || !storeId} className={buttonClass}><RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${visible.loading ? 'motion-safe:animate-spin' : ''}`} />Tải lại lịch sử</button><button type="button" onClick={exportCSV} disabled={!visible.ready || !filtered.length || !!visible.error || visible.loading} className={buttonClass}><Download aria-hidden="true" className="h-3.5 w-3.5" />Xuất CSV</button></div></div>
      {!storeId && <p role="alert" className="mt-4 text-sm text-amber-700 dark:text-amber-300">Chưa xác định được cửa hàng để tải lịch sử đóng phí.</p>}
      {visible.error && <p role="alert" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{visible.error}</p>}
      {exportError && <p role="alert" className="mt-3 text-sm text-rose-600">{exportError}</p>}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1"><span className="sr-only">Tìm giao dịch đóng phí</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-zinc-400" /><input value={query} onChange={event => { setQuery(event.target.value); setPage(1); setExpanded(null); }} placeholder="Tìm nội dung, mã giao dịch hoặc tham chiếu…" className="min-h-10 w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none focus:border-[#287DA8] focus:ring-2 focus:ring-[#287DA8]/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" /></label>
        <label className="sm:w-44"><span className="sr-only">Khoảng thời gian đóng phí</span><select value={period} onChange={event => { setPeriod(event.target.value); setPage(1); setExpanded(null); }} className="min-h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#287DA8] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"><option value="ALL">Tất cả thời gian</option><option value="30">30 ngày gần đây</option><option value="90">90 ngày gần đây</option></select></label>
      </div>
      {!visible.ready && visible.loading ? <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-zinc-500"><Loader2 className="h-4 w-4 motion-safe:animate-spin" />Đang tải lịch sử đóng phí…</div> : visible.ready && !filtered.length ? <div className="py-12 text-center"><ReceiptText aria-hidden="true" className="mx-auto h-7 w-7 text-zinc-400" /><h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">{visible.rows.length ? 'Không có giao dịch phù hợp' : 'Chưa ghi nhận phí thuê sàn qua ví'}</h3><p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{visible.rows.length ? 'Thử đổi khoảng thời gian hoặc từ khóa tìm kiếm.' : 'Các khoản đã trừ ví để thuê gian hàng sẽ xuất hiện tại đây.'}</p></div> : <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">{pageRows.map(row => <li key={row.id} className="py-4"><button type="button" aria-expanded={expanded === row.id} aria-controls={`subscription-payment-${row.id}`} onClick={() => setExpanded(expanded === row.id ? null : row.id)} className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] sm:flex sm:items-start sm:gap-3"><span className="mt-0.5 rounded-lg bg-sky-50 p-2 text-[#287DA8] dark:bg-sky-950/30"><ReceiptText aria-hidden="true" className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium text-zinc-900 dark:text-white">{row.description}</span><span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">#{row.id} · {subscriptionDateLabel(row.createdAt, true)}</span><span className={`mt-2 inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${isPaidSubscription(row) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'}`}>{subscriptionPaymentStatus(row)}</span></span><span className="col-start-2 flex items-center justify-between gap-2 sm:block sm:shrink-0 sm:text-right"><span className="block text-sm font-semibold tabular-nums text-zinc-900 dark:text-white">{subscriptionMoney(row.amount)}</span><ChevronDown aria-hidden="true" className={`ml-auto mt-2 h-4 w-4 text-zinc-400 transition-transform ${expanded === row.id ? 'rotate-180' : ''}`} /></span></button>{expanded === row.id && <dl id={`subscription-payment-${row.id}`} className="mt-4 grid gap-4 rounded-lg bg-zinc-50 p-4 text-xs sm:grid-cols-3 dark:bg-zinc-950/60"><div><dt className="text-zinc-500">Mã tham chiếu</dt><dd className="mt-1 select-all break-all font-medium text-zinc-800 dark:text-zinc-200">{row.referenceId || 'Chưa có'}</dd></div><div><dt className="text-zinc-500">Số dư trước giao dịch</dt><dd className="mt-1 font-medium tabular-nums text-zinc-800 dark:text-zinc-200">{subscriptionMoney(row.balanceBefore)}</dd></div><div><dt className="text-zinc-500">Số dư sau giao dịch</dt><dd className="mt-1 font-medium tabular-nums text-zinc-800 dark:text-zinc-200">{subscriptionMoney(row.balanceAfter)}</dd></div></dl>}</li>)}</ul>}
      {visible.ready && filtered.length > 0 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"><p>{filtered.length} giao dịch · Đã trừ ví: <strong className="font-semibold text-zinc-800 dark:text-zinc-200">{subscriptionMoney(subscriptionPaidTotal(filtered))}</strong></p><div className="flex items-center gap-2"><button type="button" disabled={currentPage <= 1} onClick={() => { setPage(currentPage - 1); setExpanded(null); }} className={buttonClass} aria-label="Trang giao dịch trước">Trước</button><span>Trang {currentPage}/{pageCount}</span><button type="button" disabled={currentPage >= pageCount} onClick={() => { setPage(currentPage + 1); setExpanded(null); }} className={buttonClass} aria-label="Trang giao dịch sau">Sau</button></div></div>}
    </div>
  </section>;
};
