import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Check, CheckCircle2, Clock3, Loader2, MapPin, Package, Phone, RefreshCw, Truck, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { driversService, DriverDutyStatus, DriverShift, DeliveryFailureCode } from '../../services/drivers.service';
import { mediaService } from '../../services/media.service';
import { buildDeliveryPayload, canClaimDelivery, canRecordDelivery, cloudinaryEvidenceUrl, deliveryPaymentMethod, driverError, evidenceFileError, failureReasons, money } from '../../services/driver-workflow';
import { driverCard, driverInput, driverPrimary, driverSecondary, DriverDialog, DriverEntrance, DriverLoading, DriverNotice, DriverStatus } from './DriverWorkflowUI';

const paymentLabel = (order: any) => deliveryPaymentMethod(order) === 'COD' ? 'Thu tiền mặt' : 'Chuyển khoản';

const DeliveryResultDialog: React.FC<{ order: any; mode: 'delivered' | 'failed'; userId: string; role: string; onClose: () => void; onDone: (message: string) => Promise<void> }> = ({ order, mode, userId, role, onClose, onDone }) => {
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState(String(order.totalAmount || 0));
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState<DeliveryFailureCode>('CUSTOMER_UNREACHABLE');
  const [note, setNote] = useState('');
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const upload = async (file: File | null) => {
    if (lock.current || !file) return;
    const invalid = evidenceFileError(file);
    if (invalid) { setError(invalid); return; }
    lock.current = true;
    setUploading(true); setError(''); setImageUrl('');
    try {
      const response = await mediaService.uploadPodImage(file, order.id);
      if (response?.success === false) throw new Error(response.message || 'Chưa tải được ảnh.');
      const url = response?.data?.secureUrl || response?.data?.url;
      if (!cloudinaryEvidenceUrl(url, String(order.storeId))) throw new Error('Chưa nhận được ảnh giao hàng hợp lệ. Vui lòng tải lại ảnh.');
      if (alive.current) setImageUrl(url);
    } catch (issue) { if (alive.current) setError(driverError(issue)); }
    finally { lock.current = false; if (alive.current) setUploading(false); }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current) return;
    setError('');
    if (!imageUrl) { setError('Vui lòng chọn ảnh bằng chứng và đợi tải ảnh hoàn tất.'); return; }
    lock.current = true; setSaving(true);
    try {
      // Re-read the order: payment or assignment may have changed while the form was open.
      const latest = await driversService.getOrder(order.id);
      if (!canRecordDelivery(latest, userId, role)) throw new Error('Đơn này đã thay đổi trạng thái hoặc người giao. Đóng hộp thoại và tải lại danh sách.');
      if (mode === 'delivered') {
        const payload = buildDeliveryPayload(latest, imageUrl, amount, confirmed);
        await driversService.completeDelivery(order.id, payload);
      } else {
        await driversService.failDelivery(order.id, { failureReasonCode: reason, failureNote: note.trim() || undefined, evidenceImageUrl: imageUrl });
      }
      await onDone(mode === 'delivered' ? `Đã xác nhận giao đơn ${order.orderNumber || order.id}.` : `Đã ghi nhận kết quả đơn ${order.orderNumber || order.id}.`);
    } catch (issue) { if (alive.current) setError(driverError(issue)); }
    finally { lock.current = false; if (alive.current) setSaving(false); }
  };
  const cash = deliveryPaymentMethod(order) === 'COD';
  return <DriverDialog title={mode === 'delivered' ? 'Xác nhận đã giao hàng' : 'Ghi nhận chưa giao được'} busy={saving || uploading} onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-800/70"><p className="font-semibold">Đơn {order.orderNumber || `#${order.id}`}</p><p className="mt-1 text-zinc-500">{order.customerName || 'Khách hàng'} · {money(order.totalAmount)}</p></div>
      {error && <DriverNotice>{error}</DriverNotice>}
      {mode === 'delivered' ? <>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{cash ? 'Kiểm tra tiền đã thu và thêm ảnh giao hàng trước khi hoàn tất.' : 'Thanh toán chuyển khoản phải được hệ thống xác nhận trước khi hoàn tất giao hàng.'}</p>
        {cash ? <><label className="block text-sm font-medium">Số tiền mặt đã thu (đồng)<input type="number" inputMode="numeric" min="0" step="1" required value={amount} onChange={event => { setAmount(event.target.value); setConfirmed(false); }} disabled={saving} className={driverInput} /></label><label className="flex cursor-pointer items-start gap-2 rounded-xl border border-zinc-200 p-3 text-sm leading-6 dark:border-zinc-700"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={saving} className="mt-1 h-4 w-4 accent-[#287DA8]" /><span>Tôi đã thu đủ {money(order.totalAmount)} và giao hàng cho người nhận.</span></label></> : <DriverNotice success={String(order.paymentStatus).toUpperCase() === 'PAID'}>{String(order.paymentStatus).toUpperCase() === 'PAID' ? 'Hệ thống đã xác nhận thanh toán.' : 'Chưa xác nhận thanh toán. Trạng thái sẽ được kiểm tra lại khi bạn gửi kết quả.'}</DriverNotice>}
      </> : <><label className="block text-sm font-medium">Lý do<select value={reason} onChange={event => setReason(event.target.value as DeliveryFailureCode)} disabled={saving} className={driverInput}>{failureReasons.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="block text-sm font-medium">Ghi chú thêm <span className="font-normal text-zinc-400">(không bắt buộc)</span><textarea rows={3} maxLength={1000} value={note} onChange={event => setNote(event.target.value)} disabled={saving} className={driverInput} placeholder="Thông tin giúp cửa hàng hỗ trợ khách..." /></label></>}
      <div><p className="text-sm font-medium">Ảnh bằng chứng <span className="text-rose-600">*</span></p><label className={`mt-2 flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-600 dark:text-zinc-300 ${saving || uploading ? 'pointer-events-none opacity-60' : 'hover:border-[#287DA8] hover:bg-sky-50/40 dark:hover:bg-sky-950/20'}`}>
        {uploading ? <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : <Camera className="h-5 w-5" />}<span>{uploading ? 'Đang tải ảnh...' : imageUrl ? 'Đổi ảnh bằng chứng' : 'Chụp hoặc chọn ảnh'}<small className="mt-1 block text-xs text-zinc-400">JPG, PNG, WEBP, GIF · tối đa 1,5 MB</small></span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" disabled={saving || uploading} onChange={event => { const file = event.target.files?.[0] || null; event.target.value = ''; void upload(file); }} className="sr-only" />
      </label>{imageUrl && <div className="mt-3 flex items-center gap-3"><img src={imageUrl} alt="Ảnh bằng chứng của đơn hàng" className="h-20 w-20 rounded-xl object-cover" /><span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"><Check className="h-4 w-4" />Đã tải ảnh</span></div>}</div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800"><button type="button" onClick={onClose} disabled={saving || uploading} className={driverSecondary}>Quay lại</button><button type="submit" disabled={saving || uploading || !imageUrl} className={driverPrimary}>{saving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{saving ? 'Đang lưu kết quả...' : 'Xác nhận kết quả'}</button></div>
    </form>
  </DriverDialog>;
};

export const DriverDeliveryPage: React.FC = () => {
  const { user } = useAuth();
  const storeId = String(user?.storeId || '');
  const userId = String((user as any)?.userId || user?.id || '');
  const role = String(user?.role || '');
  const [duty, setDuty] = useState<DriverDutyStatus | null>(null);
  const [shift, setShift] = useState<DriverShift | null>(null);
  const [ready, setReady] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [online, setOnline] = useState<DriverDutyStatus[]>([]);
  const [tab, setTab] = useState<'ready' | 'mine'>('ready');
  const [filter, setFilter] = useState('SHIPPING');
  const [page, setPage] = useState(1);
  const [readyPage, setReadyPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [claim, setClaim] = useState<any>(null);
  const [result, setResult] = useState<{ order: any; mode: 'delivered' | 'failed' } | null>(null);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const controller = useRef<AbortController>();
  const generation = useRef(0);
  const actionLock = useRef(false);
  const alive = useRef(true);
  const paused = useRef(false);
  paused.current = busy || Boolean(claim || result);
  const load = useCallback(async () => {
    if (!alive.current) return;
    if (!storeId) { setLoading(false); return; }
    controller.current?.abort();
    const current = ++generation.current;
    const request = new AbortController(); controller.current = request;
    setLoading(true);
    const responses = await Promise.allSettled([
      driversService.getMyDuty(request.signal), driversService.getCurrentShift(request.signal), driversService.getReadyOrders(request.signal),
      driversService.getMyOrders({ status: filter || undefined, page, limit: 12, dateRange: 'all' }, request.signal),
      ...(onlineOpen ? [driversService.getOnlineDrivers(storeId, request.signal)] : []),
    ]);
    if (!alive.current || request.signal.aborted || current !== generation.current) return;
    const nextErrors: Record<string, string> = {};
    const names = ['duty', 'shift', 'ready', 'mine', 'online'];
    responses.forEach((response, index) => {
      if (response.status === 'rejected') { nextErrors[names[index]] = driverError(response.reason); return; }
      const data = response.value;
      if (index === 0) setDuty(data?.data || null);
      if (index === 1) setShift(data?.data || null);
      if (index === 2) { setReady(data); setReadyPage(value => Math.min(value, Math.max(1, Math.ceil(data.length / 12)))); }
      if (index === 3) { setMine(data.orders); setPages(Math.max(1, Number(data.pagination?.totalPages) || 1)); }
      if (index === 4) setOnline(Array.isArray(data?.data) ? data.data : []);
    });
    setErrors(nextErrors); setLoading(false);
  }, [storeId, filter, page, onlineOpen]);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; controller.current?.abort(); }; }, [load]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden && !paused.current) void load(); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);
  const run = async (operation: () => Promise<any>, success: string) => {
    if (actionLock.current) return false;
    actionLock.current = true; setBusy(true); setNotice(''); setErrors(value => ({ ...value, action: '' }));
    let failure = '';
    try { await operation(); if (alive.current) { setNotice(success); setClaim(null); } }
    catch (issue) { failure = driverError(issue); }
    finally { await load(); actionLock.current = false; if (alive.current) { setBusy(false); if (failure) setErrors(value => ({ ...value, action: failure })); } }
    return !failure;
  };
  const readyCount = Math.max(1, Math.ceil(ready.length / 12));
  const orders = tab === 'ready' ? ready.slice((readyPage - 1) * 12, readyPage * 12) : mine;
  const dataError = errors[tab];
  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#287DA8]">Vận hành cửa hàng</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Giao hàng</h1><p className="mt-2 text-sm text-zinc-500">Nhận đơn, giao hàng và cập nhật kết quả trong cùng một nơi.</p></div><Link to="/driver/shifts" className={driverSecondary}><Clock3 className="h-4 w-4" />Ca làm & bàn giao<ArrowRight className="h-4 w-4" /></Link></header>
    {!storeId ? <DriverNotice>Tài khoản chưa được liên kết với cửa hàng để nhận và giao đơn. Liên hệ quản lý cửa hàng để được thiết lập.</DriverNotice> : <>
      {notice && <DriverNotice success>{notice}</DriverNotice>}
      {errors.action && <DriverNotice>{errors.action}</DriverNotice>}
      <DriverEntrance><section className={`${driverCard} flex flex-wrap items-center justify-between gap-4`}>
        <div className="flex items-center gap-3"><div className="rounded-xl bg-sky-50 p-3 text-[#287DA8] dark:bg-sky-950/40"><Truck className="h-5 w-5" /></div><div><p className="text-sm font-semibold text-zinc-900 dark:text-white">{user?.fullName || 'Nhân viên giao hàng'}</p><div className="mt-1.5 flex flex-wrap items-center gap-2">{duty && <DriverStatus status={duty.status} />}<span className="text-xs text-zinc-500">{shift?.status === 'OPEN' ? `Ca #${shift.shiftId}` : 'Chưa mở ca làm'}</span></div></div></div>
        <div className="flex flex-wrap gap-2"><button onClick={() => void load()} disabled={loading || busy} className={driverSecondary}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />Tải lại</button><button className={duty?.status === 'ONLINE' ? driverSecondary : driverPrimary} disabled={busy || loading || Boolean(errors.duty) || (duty?.status !== 'ONLINE' && shift?.status !== 'OPEN')} onClick={() => void run(() => driversService.updateDuty(duty?.status === 'ONLINE' ? 'OFFLINE' : 'ONLINE'), duty?.status === 'ONLINE' ? 'Đã chuyển sang tạm nghỉ.' : 'Bạn đã sẵn sàng nhận đơn.')}>
          {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}{duty?.status === 'ONLINE' ? 'Tạm nghỉ nhận đơn' : 'Sẵn sàng nhận đơn'}</button></div>
        {(errors.duty || errors.shift) && <div className="w-full"><DriverNotice>{errors.duty || errors.shift}</DriverNotice></div>}
        {!loading && !shift && !errors.shift && <p className="w-full text-sm text-zinc-500">Mở ca làm trước khi bật nhận đơn. <Link to="/driver/shifts" className="font-semibold text-[#287DA8] hover:underline">Đi đến ca làm</Link></p>}
      </section></DriverEntrance>
      <section className={driverCard}>
        <div className="flex flex-wrap items-center justify-between gap-3"><nav aria-label="Danh sách giao hàng" className="flex flex-wrap gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800"><button onClick={() => setTab('ready')} aria-pressed={tab === 'ready'} className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${tab === 'ready' ? 'bg-white text-[#287DA8] shadow-sm dark:bg-zinc-900' : 'text-zinc-500'}`}>Chờ nhận <span className="ml-1 text-xs">({ready.length})</span></button><button onClick={() => setTab('mine')} aria-pressed={tab === 'mine'} className={`min-h-10 rounded-lg px-4 text-sm font-semibold ${tab === 'mine' ? 'bg-white text-[#287DA8] shadow-sm dark:bg-zinc-900' : 'text-zinc-500'}`}>Đơn của tôi</button></nav>{tab === 'mine' && <label className="flex items-center gap-2 text-xs text-zinc-500">Hiển thị<select value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }} className="min-h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"><option value="SHIPPING">Đang giao</option><option value="DELIVERED">Đã giao</option><option value="DELIVERY_FAILED">Chưa giao được</option><option value="">Tất cả</option></select></label>}</div>
        <div className="mt-4 space-y-3">{dataError && <DriverNotice>{dataError}</DriverNotice>}{loading && !orders.length ? <DriverLoading /> : !orders.length ? <div className="py-12 text-center"><Package className="mx-auto h-9 w-9 text-zinc-300" /><h2 className="mt-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">{tab === 'ready' ? 'Chưa có đơn chờ nhận' : 'Chưa có đơn trong danh sách này'}</h2><p className="mt-2 text-sm text-zinc-500">Danh sách sẽ cập nhật khi có thay đổi.</p></div> : orders.map(order => <article key={order.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-bold text-zinc-900 dark:text-white">{order.orderNumber || `Đơn #${order.id}`}</p><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{order.customerName || 'Khách hàng'}</p></div><DriverStatus status={order.status} /></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"><div className="min-w-0 space-y-2 text-sm text-zinc-500"><p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{order.deliveryAddress || 'Chưa có địa chỉ. Liên hệ cửa hàng trước khi nhận.'}</span></p>{order.customerPhone && <a href={`tel:${String(order.customerPhone).replace(/[^\d+]/g, '')}`} className="inline-flex min-h-8 items-center gap-2 font-medium text-[#287DA8]"><Phone className="h-4 w-4" />{order.customerPhone}</a>}<p>{(order.items || []).map((item: any) => `${item.productName || item.product?.name || 'Sản phẩm'} × ${item.quantity}`).join(' · ')}</p></div><div className="text-left sm:text-right"><p className="font-bold text-zinc-900 dark:text-white">{money(order.totalAmount)}</p><p className="mt-1 text-xs text-zinc-500">{paymentLabel(order)}{String(order.paymentStatus).toUpperCase() === 'PAID' ? ' · Đã thanh toán' : ''}</p></div></div><div className="mt-4 flex flex-wrap justify-end gap-2">{tab === 'ready' ? <button className={driverPrimary} disabled={busy || loading || Boolean(errors.duty || errors.shift || errors.ready) || !canClaimDelivery(order, duty, shift, storeId)} onClick={() => setClaim(order)}>Nhận giao đơn<ArrowRight className="h-4 w-4" /></button> : canRecordDelivery(order, userId, role) ? <><button disabled={busy || loading || Boolean(errors.mine)} onClick={() => setResult({ order, mode: 'failed' })} className={driverSecondary}>Chưa giao được</button><button disabled={busy || loading || Boolean(errors.mine)} onClick={() => setResult({ order, mode: 'delivered' })} className={driverPrimary}><CheckCircle2 className="h-4 w-4" />Đã giao hàng</button></> : <span className="text-xs text-zinc-500">{order.status === 'DELIVERY_FAILED' ? failureReasons.find(reason => reason.value === order.failureReasonCode)?.label || 'Cửa hàng đã nhận thông tin hỗ trợ.' : 'Kết quả đã được lưu.'}</span>}</div></article>)}</div>
        {(tab === 'ready' ? readyCount : pages) > 1 && <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800"><span className="text-zinc-500">Trang {tab === 'ready' ? readyPage : page} / {tab === 'ready' ? readyCount : pages}</span><div className="flex gap-2"><button className={driverSecondary} disabled={loading || (tab === 'ready' ? readyPage : page) <= 1} onClick={() => tab === 'ready' ? setReadyPage(value => value - 1) : setPage(value => value - 1)}>Trước</button><button className={driverSecondary} disabled={loading || (tab === 'ready' ? readyPage >= readyCount : page >= pages)} onClick={() => tab === 'ready' ? setReadyPage(value => value + 1) : setPage(value => value + 1)}>Sau</button></div></div>}
      </section>
      <details className={driverCard} onToggle={event => setOnlineOpen(event.currentTarget.open)}><summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200"><Users className="h-4 w-4 text-[#287DA8]" />Nhân viên đang sẵn sàng nhận đơn</summary>{onlineOpen && <div className="mt-4">{errors.online ? <DriverNotice>{errors.online}</DriverNotice> : loading ? <DriverLoading /> : online.length ? <ul className="grid gap-3 sm:grid-cols-2">{online.map(driver => <li key={driver.driverId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/60"><span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{driver.fullName || `Nhân viên #${driver.driverId}`}</span>{driver.phone && <a className="text-sm text-[#287DA8]" href={`tel:${driver.phone.replace(/[^\d+]/g, '')}`}>{driver.phone}</a>}</li>)}</ul> : <p className="text-sm text-zinc-500">Chưa có nhân viên bật sẵn sàng nhận đơn.</p>}</div>}</details>
    </>}
    {claim && <DriverDialog title="Nhận giao đơn hàng" onClose={() => setClaim(null)} busy={busy}><p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">Bạn sẽ nhận giao đơn <strong className="text-zinc-900 dark:text-white">{claim.orderNumber || `#${claim.id}`}</strong> cho {claim.customerName || 'khách hàng'}. Đơn sẽ chuyển sang đang giao khi hệ thống xác nhận.</p>{errors.action && <div className="mt-3"><DriverNotice>{errors.action}</DriverNotice></div>}<div className="mt-5 flex justify-end gap-2"><button className={driverSecondary} disabled={busy} onClick={() => setClaim(null)}>Quay lại</button><button className={driverPrimary} disabled={busy} onClick={() => void run(() => driversService.claimOrder(claim.id), 'Đã nhận đơn. Bạn có thể theo dõi trong Đơn của tôi.').then(success => { if (success) { setTab('mine'); setFilter('SHIPPING'); setPage(1); } })}>{busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}Xác nhận nhận đơn</button></div></DriverDialog>}
    {result && <DeliveryResultDialog order={result.order} mode={result.mode} userId={userId} role={role} onClose={() => setResult(null)} onDone={async message => { setResult(null); setNotice(message); await load(); }} />}
  </main>;
};
