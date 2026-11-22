import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock3, Copy, Loader2, Play, RefreshCw, ShieldAlert, Truck, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { driversService, DriverShift, LegacyHandoverSummary } from '../../services/drivers.service';
import { assertShiftCanClose, canConfirmHandover, driverError, money } from '../../services/driver-workflow';
import { driverCard, driverInput, driverPrimary, driverSecondary, DriverDialog, DriverEntrance, DriverLoading, DriverNotice, DriverStatus } from './DriverWorkflowUI';

const dateText = (date?: string | null) => date && Number.isFinite(new Date(date).getTime()) ? new Date(date).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const ShiftFigures: React.FC<{ shift: DriverShift }> = ({ shift }) => <dl className="mt-5 grid grid-cols-2 gap-4"><div><dt className="text-xs text-zinc-500">Đơn đã giao</dt><dd className="mt-1 font-bold tabular-nums text-zinc-900 dark:text-white">{shift.totalOrdersDelivered || 0}</dd></div><div><dt className="text-xs text-zinc-500">Chưa giao được</dt><dd className="mt-1 font-bold tabular-nums text-zinc-900 dark:text-white">{shift.totalOrdersFailed || 0}</dd></div><div><dt className="text-xs text-zinc-500">Tiền mặt đã thu</dt><dd className="mt-1 font-bold tabular-nums text-[#287DA8]">{money(shift.totalCodCollected)}</dd></div><div><dt className="text-xs text-zinc-500">Chuyển khoản</dt><dd className="mt-1 font-bold tabular-nums text-zinc-900 dark:text-white">{money(shift.totalVietqrCollected)}</dd></div></dl>;

export const DriverShiftPage: React.FC = () => {
  const { user } = useAuth();
  const role = String(user?.role || '');
  const isOwner = role === 'STORE_OWNER';
  const [shift, setShift] = useState<DriverShift | null>(null);
  const [history, setHistory] = useState<DriverShift[]>([]);
  const [storeShifts, setStoreShifts] = useState<DriverShift[]>([]);
  const [legacySummary, setLegacySummary] = useState<LegacyHandoverSummary | null>(null);
  const [legacyError, setLegacyError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState<{ kind: 'close' | 'handover'; shift: DriverShift } | { kind: 'settle' } | null>(null);
  const [note, setNote] = useState('');
  const [counted, setCounted] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<number | null>(null);
  const abort = useRef<AbortController>();
  const alive = useRef(true);
  const locked = useRef(false);
  const paused = useRef(false);
  paused.current = busy || Boolean(dialog);
  const load = useCallback(async () => {
    if (!alive.current) return;
    abort.current?.abort();
    const request = new AbortController(); abort.current = request;
    setLoading(true);
    const hasStoreOwnerScope = isOwner && Boolean(user?.storeId);
    const calls: Array<Promise<any>> = [
      driversService.getCurrentShift(request.signal),
      driversService.getShiftHistory(page, request.signal),
      ...(user?.storeId ? [driversService.getMyOrders({ status: 'SHIPPING', limit: 1, page: 1 }, request.signal)] : []),
      ...(hasStoreOwnerScope ? [
        driversService.getLegacyHandoverStatus(user!.storeId!, request.signal),
        driversService.getStoreDriverShifts(user!.storeId!, page, request.signal),
      ] : []),
    ];
    const results = await Promise.allSettled(calls);
    if (request.signal.aborted || !alive.current) return;
    if (results[0].status === 'fulfilled') { setShift(results[0].value?.data || null); setError(''); } else setError(driverError(results[0].reason));
    if (results[1].status === 'fulfilled') { setHistory(results[1].value.shifts); if (!hasStoreOwnerScope) setPages(Math.max(1, Number(results[1].value.pagination?.totalPages) || 1)); setHistoryError(''); } else setHistoryError(driverError(results[1].reason));
    let cursor = 2;
    if (user?.storeId) {
      const pendingRes = results[cursor++];
      if (pendingRes?.status === 'fulfilled') setPendingOrders(Number(pendingRes.value.pagination?.total || 0));
      else setPendingOrders(null);
    }
    if (hasStoreOwnerScope) {
      const legacyRes = results[cursor++];
      const storeShiftsRes = results[cursor++];
      if (legacyRes?.status === 'fulfilled') { setLegacySummary(legacyRes.value || null); setLegacyError(''); }
      else if (legacyRes?.status === 'rejected') setLegacyError(driverError(legacyRes.reason));
      if (storeShiftsRes?.status === 'fulfilled') {
        setStoreShifts(Array.isArray(storeShiftsRes.value?.shifts) ? storeShiftsRes.value.shifts : []);
        setPages(Math.max(1, Number(storeShiftsRes.value?.pagination?.totalPages) || 1));
        setHistoryError('');
      } else if (storeShiftsRes?.status === 'rejected') {
        setHistoryError(driverError(storeShiftsRes.reason));
      }
    } else {
      setLegacySummary(null);
      setStoreShifts([]);
      setLegacyError('');
    }
    setLoading(false);
  }, [page, user?.storeId, isOwner]);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; abort.current?.abort(); }; }, [load]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden && !paused.current) void load(); };
    const timer = window.setInterval(refresh, 30000); window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);
  const perform = async (action: () => Promise<any>, message: string) => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    let failure = '';
    try { await action(); if (alive.current) { setDialog(null); setNotice(message); } }
    catch (issue) { failure = driverError(issue); }
    finally { await load(); locked.current = false; if (alive.current) { setBusy(false); if (failure) setError(failure); } }
  };
  const copy = async (item: DriverShift) => {
    try {
      await navigator.clipboard.writeText(`Ca #${item.shiftId}\nMã đối chiếu: ${item.handoverCode || '—'}\nTiền mặt: ${money(item.totalCodCollected)}\nChuyển khoản: ${money(item.totalVietqrCollected)}\nĐã giao: ${item.totalOrdersDelivered || 0} đơn\nKết thúc: ${dateText(item.endedAt)}`);
      setNotice('Đã sao chép thông tin bàn giao.');
    } catch { setError('Chưa sao chép được. Bạn có thể xem và đối chiếu thông tin trực tiếp trên ca.'); }
  };
  const openDialog = (kind: 'close' | 'handover', item: DriverShift) => { setError(''); setNote(''); setCounted(false); setDialog({ kind, shift: item }); };
  const openSettleDialog = () => { setError(''); setNote(''); setCounted(false); setDialog({ kind: 'settle' }); };
  const closeCurrentShift = async (item: DriverShift) => {
    const [current, assigned] = await Promise.all([driversService.getCurrentShift(), driversService.getMyOrders({ status: 'SHIPPING', limit: 1, page: 1 })]);
    assertShiftCanClose(item.shiftId, current, assigned);
    return driversService.closeShift(item.shiftId);
  };
  const displayedShifts = isOwner && user?.storeId && storeShifts.length > 0 ? storeShifts : history;
  const hasLegacyItems = Boolean(
    legacySummary &&
      (legacySummary.inFlightShipperOrders.length > 0 ||
        legacySummary.openShifts.length > 0 ||
        legacySummary.pendingHandoverClosedShifts.length > 0 ||
        legacySummary.pendingCodHandoverTotal > 0),
  );
  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#287DA8]">Vận hành cửa hàng</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Ca & đối soát COD</h1><p className="mt-2 text-sm text-zinc-500">Mở ca giao hàng của cửa hàng, theo dõi doanh thu ca và đối soát ca/COD tồn đọng.</p></div><Link to="/driver/deliveries" className={driverSecondary}><Truck className="h-4 w-4" />Đi đến giao hàng<ArrowRight className="h-4 w-4" /></Link></header>
    {notice && <DriverNotice success>{notice}</DriverNotice>}
    {error && <DriverNotice>{error}</DriverNotice>}
    {legacyError && <DriverNotice>{legacyError}</DriverNotice>}
    <DriverEntrance><section className={`${driverCard} space-y-4`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-zinc-500">Ca hiện tại</p><h2 className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">{shift ? `Ca #${shift.shiftId}` : 'Chưa bắt đầu ca làm'}</h2>{shift && <p className="mt-2 text-xs text-zinc-500">Bắt đầu: {dateText(shift.startedAt)}</p>}</div><div className="flex items-center gap-2">{shift && <DriverStatus status={shift.status} />}<button type="button" className="rounded-lg border border-zinc-200 p-2.5 text-zinc-500 hover:text-[#287DA8] disabled:opacity-50 dark:border-zinc-700" onClick={() => void load()} disabled={loading || busy} aria-label="Tải lại ca làm"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} /></button></div></div>
      {loading && !shift ? <DriverLoading /> : shift ? <><ShiftFigures shift={shift} /><div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800"><p className="max-w-lg text-sm leading-6 text-zinc-500">{pendingOrders === null ? 'Kiểm tra các đơn đang giao trước khi kết thúc ca.' : pendingOrders > 0 ? `Bạn còn ${pendingOrders} đơn đang giao. Hoàn tất các đơn trước khi kết thúc ca.` : 'Hoàn tất giao hàng, kết thúc ca rồi đối chiếu tiền để bàn giao.'}</p><button className={driverSecondary} disabled={busy || loading || Boolean(error) || pendingOrders === null || pendingOrders > 0} onClick={() => openDialog('close', shift)}><Clock3 className="h-4 w-4" />Kết thúc ca</button></div></> : <><p className="text-sm leading-6 text-zinc-500">Bắt đầu ca, sau đó bật sẵn sàng nhận đơn tại trang Giao hàng.</p><button className={driverPrimary} disabled={busy || loading || Boolean(error) || !user?.storeId} onClick={() => void perform(() => driversService.startShift(), 'Ca làm đã bắt đầu. Bạn có thể bật nhận đơn.')}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <Play className="h-4 w-4" />}Bắt đầu ca</button>{!user?.storeId && <p className="text-xs text-amber-700">Tài khoản cần được liên kết với cửa hàng để bắt đầu ca.</p>}</>}
    </section></DriverEntrance>
    {isOwner && user?.storeId && (
      <section className={driverCard}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className={`mt-0.5 h-4 w-4 shrink-0 ${hasLegacyItems ? 'text-amber-600' : 'text-emerald-600'}`} />
            <div>
              <h2 className="font-bold text-zinc-900 dark:text-white">Đối soát ca & COD shipper cũ</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {hasLegacyItems
                  ? 'Tổng hợp đơn đang giao, ca chưa đóng và tiền COD còn chờ bàn giao từ mô hình shipper cũ.'
                  : 'Không còn ca mở, đơn shipper cũ hoặc tiền COD tồn đọng.'}
              </p>
            </div>
          </div>
          {hasLegacyItems && (
            <button type="button" disabled={busy || loading} onClick={openSettleDialog} className={driverPrimary}>
              Thu hồi đơn & tất toán COD cũ
            </button>
          )}
        </div>
        {legacySummary && (
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
              <dt className="text-xs text-zinc-500">Đơn shipper đang giao</dt>
              <dd className="mt-1 font-bold tabular-nums text-zinc-900 dark:text-white">{legacySummary.inFlightShipperOrders.length}</dd>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
              <dt className="text-xs text-zinc-500">Ca shipper chưa đóng</dt>
              <dd className="mt-1 font-bold tabular-nums text-zinc-900 dark:text-white">{legacySummary.openShifts.length}</dd>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
              <dt className="text-xs text-zinc-500">Ca chờ bàn giao</dt>
              <dd className="mt-1 font-bold tabular-nums text-zinc-900 dark:text-white">{legacySummary.pendingHandoverClosedShifts.length}</dd>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
              <dt className="text-xs text-zinc-500">COD chờ đối soát</dt>
              <dd className="mt-1 font-bold tabular-nums text-[#287DA8]">{money(legacySummary.pendingCodHandoverTotal)}</dd>
            </div>
          </dl>
        )}
      </section>
    )}
    <section className={driverCard}><div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-[#287DA8]" /><h2 className="font-bold text-zinc-900 dark:text-white">{isOwner ? 'Lịch sử ca toàn cửa hàng' : 'Lịch sử ca của tôi'}</h2></div><p className="mt-2 text-sm text-zinc-500">Tiền mặt và chuyển khoản được tổng hợp từ kết quả giao hàng đã lưu.</p>{historyError && <div className="mt-4"><DriverNotice>{historyError}</DriverNotice></div>}<div className="mt-4 space-y-4">{loading && !displayedShifts.length ? <DriverLoading /> : displayedShifts.length ? displayedShifts.map(item => <article key={item.shiftId} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-zinc-900 dark:text-white">Ca #{item.shiftId}{item.driverName ? ` · ${item.driverName}` : ''}</h3><p className="mt-1 text-xs leading-5 text-zinc-500">{dateText(item.startedAt)}{item.endedAt ? ` — ${dateText(item.endedAt)}` : ''}{item.driverPhone ? ` · ${item.driverPhone}` : ''}</p></div><DriverStatus status={item.status} /></div><ShiftFigures shift={item} />{item.handoverCode && <p className="mt-4 break-all text-xs text-zinc-500">Mã đối chiếu: <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.handoverCode}</span></p>}{item.handoverNote && <p className="mt-3 break-words text-sm text-zinc-500">Ghi chú: {item.handoverNote}</p>}<div className="mt-4 flex flex-wrap justify-end gap-2">{item.status !== 'OPEN' && <button className={driverSecondary} onClick={() => void copy(item)}><Copy className="h-4 w-4" />Sao chép bàn giao</button>}{canConfirmHandover(item, role) && <button className={driverPrimary} disabled={busy || loading || Boolean(historyError)} onClick={() => openDialog('handover', item)}><CheckCircle2 className="h-4 w-4" />Xác nhận nhận bàn giao</button>}</div></article>) : !historyError && <p className="py-8 text-center text-sm text-zinc-500">Chưa có ca làm nào được ghi nhận.</p>}</div>{pages > 1 && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800"><span className="text-zinc-500">Trang {page} / {pages}</span><div className="flex gap-2"><button className={driverSecondary} disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Trước</button><button className={driverSecondary} disabled={loading || page >= pages} onClick={() => setPage(value => value + 1)}>Sau</button></div></div>}</section>
    {dialog && dialog.kind === 'settle' && (
      <DriverDialog title="Thu hồi đơn & tất toán COD cũ" busy={busy} onClose={() => setDialog(null)}>
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault();
            if (!counted || !user?.storeId) return;
            void perform(
              () => driversService.settleLegacyHandover(user.storeId!, note),
              'Đã thu hồi đơn cũ về chủ cửa hàng và tất toán các ca/COD shipper tồn đọng.',
            );
          }}
        >
          <p className="text-sm leading-6 text-zinc-500">
            Hệ thống sẽ chuyển {legacySummary?.inFlightShipperOrders.length || 0} đơn đang giao về chủ cửa hàng, đóng {legacySummary?.openShifts.length || 0} ca đang mở và tất toán {money(legacySummary?.pendingCodHandoverTotal || 0)} tiền mặt chờ bàn giao.
          </p>
          {error && <DriverNotice>{error}</DriverNotice>}
          <label className="block text-sm font-medium">
            Ghi chú đối soát <span className="font-normal text-zinc-400">(không bắt buộc)</span>
            <textarea value={note} onChange={event => setNote(event.target.value)} disabled={busy} rows={3} maxLength={1000} className={driverInput} />
          </label>
          <label className="flex items-start gap-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" required checked={counted} onChange={event => setCounted(event.target.checked)} className="mt-1 h-4 w-4 accent-[#287DA8]" disabled={busy} />
            <span>Tôi đã kiểm đếm {money(legacySummary?.pendingCodHandoverTotal || 0)} COD tồn đọng và xác nhận thu hồi đơn về chủ cửa hàng.</span>
          </label>
          <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <button type="button" onClick={() => setDialog(null)} disabled={busy} className={driverSecondary}>Quay lại</button>
            <button type="submit" disabled={busy || !counted} className={driverPrimary}>
              {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}Xác nhận tất toán
            </button>
          </div>
        </form>
      </DriverDialog>
    )}
    {dialog && dialog.kind !== 'settle' && <DriverDialog title={dialog.kind === 'close' ? 'Kết thúc ca làm' : 'Xác nhận nhận bàn giao'} busy={busy} onClose={() => setDialog(null)}><form className="space-y-4" onSubmit={event => { event.preventDefault(); if (dialog.kind === 'handover' && !counted) return; void perform(() => dialog.kind === 'close' ? closeCurrentShift(dialog.shift) : driversService.confirmHandover(dialog.shift.shiftId, note), dialog.kind === 'close' ? 'Ca làm đã kết thúc. Thông tin đã sẵn sàng để đối chiếu bàn giao.' : 'Đã xác nhận nhận bàn giao ca.'); }}><p className="text-sm leading-6 text-zinc-500">Ca #{dialog.shift.shiftId} · {dialog.kind === 'close' ? 'Kiểm tra kết quả trước khi kết thúc ca. Hệ thống sẽ tổng hợp số tiền lần cuối.' : 'Đối chiếu thông tin dưới đây với tiền và chứng từ thực tế trước khi xác nhận.'}</p><ShiftFigures shift={dialog.shift} />{error && <DriverNotice>{error}</DriverNotice>}{dialog.kind === 'handover' && <><label className="block text-sm font-medium">Ghi chú bàn giao <span className="font-normal text-zinc-400">(không bắt buộc)</span><textarea value={note} onChange={event => setNote(event.target.value)} disabled={busy} rows={3} maxLength={1000} className={driverInput} /></label><label className="flex items-start gap-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300"><input type="checkbox" required checked={counted} onChange={event => setCounted(event.target.checked)} className="mt-1 h-4 w-4 accent-[#287DA8]" disabled={busy} /><span>Tôi đã nhận và đối chiếu đủ {money(dialog.shift.totalCodCollected)} tiền mặt của ca này.</span></label></>}<div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800"><button type="button" onClick={() => setDialog(null)} disabled={busy} className={driverSecondary}>Quay lại</button><button type="submit" disabled={busy || (dialog.kind === 'handover' && !counted)} className={driverPrimary}>{busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{dialog.kind === 'close' ? 'Kết thúc ca' : 'Xác nhận bàn giao'}</button></div></form></DriverDialog>}
  </main>;
};
