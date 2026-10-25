import React, { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Banknote, CheckCircle2, Clock3, CreditCard, ExternalLink, Landmark, Play, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react';
import { api } from '../../services';
import { useAuth } from '../../context/AuthContext';

const card = 'rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg bg-[#287DA8] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_2px_8px_rgba(40,125,168,0.25)] transition-colors hover:bg-[#206588] disabled:cursor-not-allowed disabled:opacity-50';

const StatusPill: React.FC<{ value?: string }> = ({ value }) => {
  const normalized = (value || 'PENDING').toUpperCase();
  const tone = normalized.includes('APPROV') || normalized.includes('ACTIVE') || normalized.includes('SUCCESS')
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
    : normalized.includes('REJECT') || normalized.includes('FAIL') || normalized.includes('CANCEL')
      ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400'
      : 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400';
  return <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold tracking-wide ring-1 ${tone}`}>{value || 'PENDING'}</span>;
};

export const CustomerVerificationPage: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState('');
  const [trackingSessionId, setTrackingSessionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/identity-verifications/sessions');
      setSessions(res.data?.data || []);
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Không thể tải trạng thái xác minh.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!trackingSessionId) return;

    const checkVerificationStatus = async () => {
      try {
        const res = await api.get('/identity-verifications/sessions');
        const updatedSessions = res.data?.data || [];
        setSessions(updatedSessions);

        const session = updatedSessions.find((item: any) =>
          item.diditSessionId === trackingSessionId || item.sessionId === trackingSessionId,
        );
        const status = String(session?.status || '').toUpperCase();

        if (status.includes('APPROV') || status.includes('SUCCESS') || status.includes('COMPLET')) {
          setMessage('Xác minh danh tính đã hoàn tất thành công.');
          setTrackingSessionId(null);
        } else if (status.includes('REJECT') || status.includes('DECLIN') || status.includes('FAIL') || status.includes('CANCEL')) {
          setMessage('Phiên xác minh không hoàn tất. Vui lòng kiểm tra lại thông tin hoặc thử lại.');
          setTrackingSessionId(null);
        }
      } catch {
        // Keep the verification page usable; a transient status-polling error is not a KYC failure.
      }
    };

    void checkVerificationStatus();
    const timer = window.setInterval(checkVerificationStatus, 5000);
    return () => window.clearInterval(timer);
  }, [trackingSessionId]);

  const start = async () => {
    setStarting(true); setMessage('');
    try {
      const res = await api.post('/identity-verifications/sessions');
      const data = res.data?.data || {};
      const verifyUrl = data.verificationUrl || data.url || data.redirectUrl;
      if (verifyUrl) {
        const verificationWindow = window.open(verifyUrl, 'didit-verification');
        if (!verificationWindow) {
          setMessage('Trình duyệt đang chặn cửa sổ xác minh. Hãy cho phép pop-up rồi thử lại.');
          return;
        }

        // Do not leave the app for Didit's separate origin. This keeps third-party console
        // messages out of the app page while we receive the result through our backend.
        verificationWindow.opener = null;
        setTrackingSessionId(data.diditSessionId || data.sessionId || null);
        setMessage('Trang xác minh đã được mở ở tab mới. Chúng tôi sẽ tự cập nhật kết quả tại đây.');
        await load();
      }
      else { setMessage('Phiên xác minh đã tạo. Hãy mở lại trang này để theo dõi trạng thái.'); await load(); }
    } catch (error: any) { setMessage(error.response?.data?.message || 'Không thể khởi tạo phiên xác minh.'); }
    finally { setStarting(false); }
  };

  const latest = sessions[0];
  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-7 sm:px-6">
    <section className="overflow-hidden rounded-2xl border border-[#287DA8]/20 bg-gradient-to-br from-[#0E6BA8] to-[#287DA8] p-6 text-white shadow-lg">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><div className="mb-2 flex items-center gap-2 text-sky-100"><ShieldCheck className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-[0.16em]">Bảo vệ tài khoản</span></div><h1 className="text-2xl font-bold">Xác minh danh tính</h1><p className="mt-2 max-w-xl text-sm text-sky-50">Hoàn tất eKYC để tăng độ tin cậy và mở các tính năng yêu cầu xác minh.</p></div><button onClick={start} disabled={starting} className="rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-[#0E6BA8] shadow-sm hover:bg-sky-50 disabled:opacity-60"><BadgeCheck className="mr-2 inline h-4 w-4" />{starting ? 'Đang khởi tạo...' : 'Bắt đầu xác minh'}</button></div>
    </section>
    {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">{message}</div>}
    <section className="grid gap-4 md:grid-cols-[1.15fr_.85fr]"><div className={card}><h2 className="font-bold text-zinc-900 dark:text-white">Trạng thái gần nhất</h2>{loading ? <p className="mt-5 text-sm text-zinc-500">Đang tải...</p> : latest ? <div className="mt-5 flex items-center gap-4"><div className="rounded-xl bg-[#287DA8]/10 p-3 text-[#287DA8]"><ShieldCheck /></div><div><StatusPill value={latest.status} /><p className="mt-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">Phiên #{latest.id || latest.sessionId}</p><p className="text-xs text-zinc-500">Cập nhật trạng thái từ nhà cung cấp xác minh.</p></div></div> : <p className="mt-5 text-sm text-zinc-500">Bạn chưa có phiên xác minh nào.</p>}</div><div className={card}><h2 className="font-bold text-zinc-900 dark:text-white">Quy trình</h2><ol className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300"><li>1. Mở phiên xác minh an toàn.</li><li>2. Chụp giấy tờ và khuôn mặt.</li><li>3. Theo dõi kết quả ngay tại đây.</li></ol></div></section>
  </main>;
};

export const DriverShiftPage: React.FC = () => {
  const [shift, setShift] = useState<any>(null); const [history, setHistory] = useState<any[]>([]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const load = useCallback(async () => { try { const [current, past] = await Promise.all([api.get('/driver-shifts/current'), api.get('/driver-shifts/history')]); setShift(current.data?.data || null); setHistory(past.data?.data || []); } catch (e: any) { setMessage(e.response?.data?.message || 'Không thể tải dữ liệu ca làm.'); } }, []);
  useEffect(() => { load(); }, [load]);
  const action = async (path: string) => { setBusy(true); setMessage(''); try { await api.post(path); await load(); } catch (e: any) { setMessage(e.response?.data?.message || 'Thao tác chưa hoàn tất.'); } finally { setBusy(false); } };
  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-7 sm:px-6"><header><p className="text-xs font-bold uppercase tracking-[.16em] text-[#287DA8]">Delivery operations</p><h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">Ca làm giao hàng</h1><p className="mt-1 text-sm text-zinc-500">Bắt đầu ca, theo dõi thời lượng và đóng ca minh bạch.</p></header>{message && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</div>}<section className="grid gap-4 md:grid-cols-[1.2fr_.8fr]"><div className={card}><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Ca hiện tại</p><h2 className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{shift ? 'Đang trong ca' : 'Chưa bắt đầu ca'}</h2></div><StatusPill value={shift?.status || (shift ? 'ACTIVE' : 'OFFLINE')} /></div><div className="mt-6 flex gap-2">{shift ? <button className={primaryButton} disabled={busy} onClick={() => action(`/driver-shifts/${shift.id || shift.shiftId}/close`)}><Clock3 className="h-4 w-4" />Kết thúc ca</button> : <button className={primaryButton} disabled={busy} onClick={() => action('/driver-shifts/start')}><Play className="h-4 w-4" />Bắt đầu ca</button>}<button onClick={load} className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:text-[#287DA8] dark:border-zinc-700"><RefreshCw className="h-4 w-4" /></button></div></div><div className={card}><p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Gợi ý</p><p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">Chỉ nhận đơn khi ca đang hoạt động. Đóng ca sau khi hoàn tất bàn giao.</p></div></section><section className={card}><h2 className="font-bold text-zinc-900 dark:text-white">Lịch sử ca gần đây</h2><div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">{history.length ? history.map((item, index) => <div className="flex items-center justify-between py-3 text-sm" key={item.id || index}><span className="font-medium text-zinc-700 dark:text-zinc-200">Ca #{item.id || item.shiftId}</span><StatusPill value={item.status} /></div>) : <p className="py-5 text-sm text-zinc-500">Chưa có lịch sử ca làm.</p>}</div></section></main>;
};

export const StoreFinancePage: React.FC = () => {
  const { user } = useAuth(); const [subscription, setSubscription] = useState<any>(null); const [accounts, setAccounts] = useState<any[]>([]); const [message, setMessage] = useState('');
  const storeId = (user as any)?.storeId || (user as any)?.store?.storeId || (user as any)?.store?.id;
  const load = useCallback(async () => { try { const calls: Promise<any>[] = [api.get('/store/subscriptions/current')]; if (storeId) calls.push(api.get(`/stores/${storeId}/bank-accounts`)); const results = await Promise.all(calls); setSubscription(results[0].data?.data || null); setAccounts(results[1]?.data?.data || []); } catch (e: any) { setMessage(e.response?.data?.message || 'Không thể tải thông tin tài chính cửa hàng.'); } }, [storeId]);
  useEffect(() => { load(); }, [load]);
  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-7 sm:px-6"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#287DA8]">Store finance</p><h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">Gói dịch vụ & tài khoản nhận tiền</h1><p className="mt-1 text-sm text-zinc-500">Quản lý trạng thái dịch vụ và tài khoản dùng để nhận rút tiền.</p></div><button onClick={load} className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:text-[#287DA8] dark:border-zinc-700"><RefreshCw className="h-4 w-4" /></button></header>{message && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</div>}<section className="grid gap-4 md:grid-cols-2"><div className={`${card} bg-gradient-to-br from-white to-sky-50 dark:from-zinc-900 dark:to-sky-950/20`}><div className="flex items-center gap-3"><div className="rounded-xl bg-[#287DA8]/10 p-3 text-[#287DA8]"><WalletCards /></div><div><p className="text-xs font-semibold text-zinc-500">Gói hiện tại</p><h2 className="font-bold text-zinc-900 dark:text-white">{subscription?.planName || subscription?.plan?.name || 'Chưa có gói hoạt động'}</h2></div></div><div className="mt-5"><StatusPill value={subscription?.status} /></div><p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">Đăng ký gói mới sẽ được mở khi backend cung cấp danh sách gói công khai cho cửa hàng.</p></div><div className={card}><div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-950/30"><Landmark /></div><div><p className="text-xs font-semibold text-zinc-500">Tài khoản nhận tiền</p><h2 className="font-bold text-zinc-900 dark:text-white">{accounts.length} tài khoản đã liên kết</h2></div></div><p className="mt-5 text-sm text-zinc-600 dark:text-zinc-300">Chọn một tài khoản mặc định để nhận thanh toán và rút tiền.</p></div></section><section className={card}><h2 className="font-bold text-zinc-900 dark:text-white">Tài khoản ngân hàng</h2><div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">{accounts.length ? accounts.map((account, index) => <div className="flex items-center justify-between py-4" key={account.id || index}><div className="flex items-center gap-3"><CreditCard className="h-5 w-5 text-[#287DA8]" /><div><p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{account.bankName || account.bankBin || 'Ngân hàng'}</p><p className="text-xs text-zinc-500">•••• {account.last4 || account.accountNumberMasked || '—'}</p></div></div>{account.isDefault && <span className="text-xs font-bold text-emerald-600">Mặc định</span>}</div>) : <p className="py-5 text-sm text-zinc-500">Chưa có tài khoản nào. Chức năng thêm/xác minh sẽ được bật sau khi hoàn thiện form ngân hàng.</p>}</div></section></main>;
};

export const AdminPayoutsPage: React.FC = () => {
  const [withdrawals, setWithdrawals] = useState<any[]>([]); const [payouts, setPayouts] = useState<any[]>([]); const [message, setMessage] = useState('');
  const load = useCallback(async () => { try { const [w, p] = await Promise.all([api.get('/admin/withdrawals'), api.get('/admin/payos/payouts')]); setWithdrawals(w.data?.data || []); setPayouts(p.data?.data || []); } catch (e: any) { setMessage(e.response?.data?.message || 'Không thể tải dữ liệu payout.'); } }, []);
  useEffect(() => { load(); }, [load]);
  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-7 sm:px-6"><header><p className="text-xs font-bold uppercase tracking-[.16em] text-violet-600">Admin finance</p><h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">Điều hành payout</h1><p className="mt-1 text-sm text-zinc-500">Theo dõi yêu cầu rút tiền và trạng thái chuyển khoản PayOS.</p></header>{message && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{message}</div>}<section className="grid gap-4 md:grid-cols-2"><div className={card}><Banknote className="h-5 w-5 text-violet-600" /><p className="mt-3 text-2xl font-bold text-zinc-900 dark:text-white">{withdrawals.length}</p><p className="text-sm text-zinc-500">Yêu cầu rút tiền</p></div><div className={card}><CheckCircle2 className="h-5 w-5 text-emerald-600" /><p className="mt-3 text-2xl font-bold text-zinc-900 dark:text-white">{payouts.length}</p><p className="text-sm text-zinc-500">Bản ghi payout</p></div></section><section className={card}><h2 className="font-bold text-zinc-900 dark:text-white">Yêu cầu cần xử lý</h2><div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">{withdrawals.length ? withdrawals.map((item, index) => <div className="flex items-center justify-between gap-3 py-4" key={item.id || index}><div><p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Yêu cầu #{item.id || item.withdrawalId}</p><p className="text-xs text-zinc-500">{item.amount?.toLocaleString?.('vi-VN') || '—'} VND</p></div><StatusPill value={item.status} /></div>) : <p className="py-5 text-sm text-zinc-500">Không có yêu cầu nào.</p>}</div></section></main>;
};
