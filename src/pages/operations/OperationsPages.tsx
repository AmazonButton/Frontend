import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  FileCheck2,
  Landmark,
  Play,
  RefreshCw,
  RotateCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { api } from '../../services';
import { useAuth } from '../../context/AuthContext';

const card = 'rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg bg-[#287DA8] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_2px_8px_rgba(40,125,168,0.25)] transition-colors hover:bg-[#206588] disabled:cursor-not-allowed disabled:opacity-50';

const StatusPill: React.FC<{ value?: string }> = ({ value }) => {
  const normalized = (value || 'PENDING').toUpperCase();
  const isApproved =
    normalized.includes('APPROV') || normalized.includes('ACTIVE') || normalized.includes('SUCCESS');
  const isDeclined =
    normalized.includes('REJECT') ||
    normalized.includes('FAIL') ||
    normalized.includes('DECLIN') ||
    normalized.includes('CANCEL');

  const tone = isApproved
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
    : isDeclined
      ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400'
      : 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ring-1 ${tone}`}>
      {isApproved && <CheckCircle2 className="h-3 w-3" />}
      {isDeclined && <XCircle className="h-3 w-3" />}
      {!isApproved && !isDeclined && <Clock3 className="h-3 w-3" />}
      {value || 'PENDING'}
    </span>
  );
};

export const CustomerVerificationPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'success' | 'error'>('info');
  const [trackingSessionId, setTrackingSessionId] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/identity-verifications/sessions');
      const list = res.data?.data || [];
      setSessions(list);
      return list;
    } catch (error: any) {
      if (!silent) {
        setMessage(error.response?.data?.message || 'Không thể tải trạng thái xác minh.');
        setMessageType('error');
      }
      return [];
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isSyncingRef = React.useRef(false);
  const lastSyncTimeRef = React.useRef(0);

  // Sync decision directly from Didit API via backend fallback endpoint
  const syncDecision = useCallback(
    async (sessionId: string | number, silent = false) => {
      if (!sessionId || isSyncingRef.current) return;
      isSyncingRef.current = true;
      setSyncing(true);
      try {
        const res = await api.get(`/identity-verifications/sessions/${sessionId}/decision`);
        const payload = res.data?.data || res.data || {};
        const status = String(payload.status || payload.decision?.status || '').toUpperCase();

        if (status.includes('APPROV') || status.includes('SUCCESS')) {
          await load(true);
          setMessage('Xác minh danh tính thành công! Hồ sơ của bạn đã được chứng thực hoàn tất.');
          setMessageType('success');
          setTrackingSessionId(null);
          await refreshUser?.();
        } else if (status.includes('DECLIN') || status.includes('REJECT') || status.includes('FAIL')) {
          await load(true);
          setMessage('Phiên xác minh không hoàn tất hoặc chưa đạt yêu cầu từ Didit. Bạn có thể tạo phiên mới để thử lại.');
          setMessageType('error');
          setTrackingSessionId(null);
        } else {
          if (!silent) {
            setMessage('Didit đang xử lý đối soát hoặc bạn chưa chụp giấy tờ. Vui lòng bấm lại sau ít giây.');
            setMessageType('info');
          }
        }
      } catch (err: any) {
        if (!silent) {
          setMessage(err.response?.data?.message || 'Chưa thể đồng bộ kết quả từ Didit lúc này.');
          setMessageType('error');
        }
      } finally {
        setSyncing(false);
        isSyncingRef.current = false;
      }
    },
    [load, refreshUser]
  );

  const latest = sessions[0];
  const isApproved =
    String(latest?.status || '').toUpperCase().includes('APPROV') ||
    String((user as any)?.kycStatus || '').toUpperCase().includes('APPROV');
  const isPending =
    !isApproved &&
    (String(latest?.status || '').toUpperCase().includes('PENDING') || starting);
  const isDeclined =
    !isApproved &&
    !isPending &&
    latest &&
    (String(latest.status || '').toUpperCase().includes('DECLIN') ||
      String(latest.status || '').toUpperCase().includes('REJECT') ||
      String(latest.status || '').toUpperCase().includes('FAIL'));

  // Auto-sync on window focus if latest session is pending (throttled to at most once per 30s)
  useEffect(() => {
    const onFocus = () => {
      const now = Date.now();
      if (now - lastSyncTimeRef.current < 30000) return;
      if (latest && String(latest.status).toUpperCase() === 'PENDING') {
        lastSyncTimeRef.current = now;
        syncDecision(latest.id || latest.sessionId, true);
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [latest?.id, latest?.sessionId, latest?.status, syncDecision]);

  // Polling check while tracking (max 6 attempts at 10s intervals)
  useEffect(() => {
    if (!trackingSessionId) return;

    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts++;
      if (attempts >= 6) {
        setTrackingSessionId(null);
        window.clearInterval(interval);
        return;
      }
      await syncDecision(trackingSessionId, true);
    }, 10000);

    return () => window.clearInterval(interval);
  }, [trackingSessionId, syncDecision]);

  const start = async () => {
    setStarting(true);
    setMessage('');
    try {
      const res = await api.post('/identity-verifications/sessions');
      const data = res.data?.data || {};
      const verifyUrl = data.verificationUrl || data.url || data.redirectUrl;
      const sid = data.sessionId || data.id || data.diditSessionId;

      if (verifyUrl) {
        const verificationWindow = window.open(verifyUrl, 'didit-verification');
        if (!verificationWindow) {
          setMessage('Trình duyệt đang chặn cửa sổ xác minh. Hãy cho phép pop-up rồi thử lại.');
          setMessageType('error');
          return;
        }

        verificationWindow.opener = null;
        if (sid) setTrackingSessionId(String(sid));
        setMessage('Trang xác minh Didit đã được mở ở tab mới. Hãy hoàn tất chụp giấy tờ và khuôn mặt, sau đó quay lại đây.');
        setMessageType('info');
        await load(true);
      } else {
        setMessage('Phiên xác minh đã tạo. Hãy mở lại trang này để theo dõi trạng thái.');
        setMessageType('info');
        await load(true);
      }
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Không thể khởi tạo phiên xác minh.');
      setMessageType('error');
    } finally {
      setStarting(false);
    }
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-7 sm:px-6">
      {/* Top Hero Banner */}
      {isApproved ? (
        <section className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-700 via-teal-700 to-sky-900 p-6 text-white shadow-lg">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-emerald-200">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                <span className="text-xs font-bold uppercase tracking-[0.16em]">Danh tính đã chứng thực</span>
              </div>
              <h1 className="text-2xl font-bold">Xác minh danh tính thành công</h1>
              <p className="mt-2 max-w-xl text-sm text-emerald-100">
                Hồ sơ eKYC của bạn đã được chứng thực thành công qua nhà cung cấp Didit. Toàn bộ tính năng tài khoản và bảo vệ thanh toán đã được kích hoạt.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md ring-1 ring-white/30 shadow-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                ĐÃ HOÀN TẤT eKYC
              </div>
            </div>
          </div>
        </section>
      ) : isPending ? (
        <section className="relative overflow-hidden rounded-2xl border border-[#287DA8]/20 bg-gradient-to-br from-[#0E6BA8] to-[#287DA8] p-6 text-white shadow-lg">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sky-100">
                <Clock3 className="h-5 w-5 text-amber-300" />
                <span className="text-xs font-bold uppercase tracking-[0.16em]">Đang chờ đối soát eKYC</span>
              </div>
              <h1 className="text-2xl font-bold">Xác minh danh tính đang xử lý</h1>
              <p className="mt-2 max-w-xl text-sm text-sky-50">
                Nếu bạn đã hoàn thành chụp ảnh trên Didit, hãy bấm nút đồng bộ bên cạnh để cập nhật kết quả duyệt tức thì.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => syncDecision(latest?.id || latest?.sessionId)}
                disabled={syncing}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-[#0E6BA8] shadow-sm hover:bg-sky-50 disabled:opacity-60 transition"
              >
                <RotateCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Đang đồng bộ...' : 'Đồng bộ kết quả từ Didit'}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#287DA8]/20 bg-gradient-to-br from-[#0E6BA8] to-[#287DA8] p-6 text-white shadow-lg">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sky-100">
                <ShieldCheck className="h-5 w-5" />
                <span className="text-xs font-bold uppercase tracking-[0.16em]">Bảo vệ tài khoản</span>
              </div>
              <h1 className="text-2xl font-bold">Xác minh danh tính</h1>
              <p className="mt-2 max-w-xl text-sm text-sky-50">
                Hoàn tất eKYC để tăng độ tin cậy và mở các tính năng yêu cầu xác minh.
              </p>
            </div>
            <button
              onClick={start}
              disabled={starting}
              className="rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-[#0E6BA8] shadow-sm hover:bg-sky-50 disabled:opacity-60 transition"
            >
              <BadgeCheck className="mr-2 inline h-4 w-4" />
              {starting ? 'Đang khởi tạo...' : 'Bắt đầu xác minh'}
            </button>
          </div>
        </section>
      )}

      {/* Alert Notification */}
      {message && (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
            messageType === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
              : messageType === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300'
                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300'
          }`}
        >
          {messageType === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          ) : messageType === 'error' ? (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          ) : (
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div className="flex-1 leading-5">{message}</div>
        </div>
      )}

      {/* Main Status Grid */}
      <section className="grid gap-4 md:grid-cols-[1.15fr_.85fr]">
        {/* Latest Status Card */}
        <div className={card}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-zinc-900 dark:text-white">Trạng thái gần nhất</h2>
            {latest && (
              <button
                onClick={() => syncDecision(latest.id || latest.sessionId)}
                disabled={syncing}
                title="Đồng bộ trạng thái từ nhà cung cấp"
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:border-[#287DA8] hover:text-[#287DA8] dark:border-zinc-700 dark:text-zinc-300"
              >
                <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin text-[#287DA8]' : ''}`} />
                {syncing ? 'Đang đồng bộ...' : 'Đồng bộ'}
              </button>
            )}
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-zinc-500">Đang tải thông tin xác minh...</p>
          ) : latest ? (
            <div className="mt-5 space-y-4">
              <div className="flex items-start gap-4">
                <div
                  className={`rounded-xl p-3 ring-1 ${
                    isApproved
                      ? 'bg-emerald-50 text-emerald-600 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : isDeclined
                        ? 'bg-rose-50 text-rose-600 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-400'
                        : 'bg-amber-50 text-amber-600 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400'
                  }`}
                >
                  {isApproved ? (
                    <ShieldCheck className="h-6 w-6" />
                  ) : isDeclined ? (
                    <ShieldAlert className="h-6 w-6" />
                  ) : (
                    <Clock3 className="h-6 w-6" />
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill value={latest.status} />
                    <span className="text-xs text-zinc-400">
                      Tạo lúc: {formatDate(latest.createdAt)}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                    Phiên #{latest.id || latest.sessionId}
                  </p>

                  <p className="text-xs text-zinc-500">
                    {isApproved
                      ? 'Xác thực danh tính điện tử thành công qua nhà cung cấp Didit.'
                      : isDeclined
                        ? 'Phiên xác minh chưa đạt yêu cầu hoặc đã hết hạn.'
                        : 'Cập nhật trạng thái từ nhà cung cấp xác minh.'}
                  </p>
                </div>
              </div>

              {/* Verified Details Card for APPROVED */}
              {isApproved && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    <UserCheck className="h-4 w-4" />
                    Hồ sơ danh tính đã chứng thực
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400">Họ và tên</p>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                        {latest.metadata?.fullName || (user as any)?.fullName || 'Hồ sơ đã chứng thực'}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400">Số giấy tờ</p>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                        {latest.metadata?.documentNumber
                          ? '•••• ' + String(latest.metadata.documentNumber).slice(-4)
                          : '•••••••• (Bảo mật)'}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400">Quốc tịch</p>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                        {latest.metadata?.nationality === 'VNM' ? 'Việt Nam (VNM)' : latest.metadata?.nationality || 'Việt Nam (VNM)'}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400">Thời gian duyệt</p>
                      <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                        {formatDate(latest.completedAt || latest.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Pending Action Box */}
              {isPending && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <p className="text-xs text-amber-900 dark:text-amber-200">
                    💡 <strong>Lưu ý:</strong> Nếu bạn vừa hoàn tất bước chụp ảnh trên Didit, vui lòng bấm nút bên dưới để hệ thống truy vấn và nhận quyết định duyệt ngay.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => syncDecision(latest.id || latest.sessionId)}
                      disabled={syncing}
                      className={primaryButton}
                    >
                      <RotateCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                      {syncing ? 'Đang kiểm tra...' : 'Đồng bộ kết quả từ Didit ngay'}
                    </button>
                    {latest.verificationUrl && (
                      <a
                        href={latest.verificationUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 transition"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-[#287DA8]" />
                        Mở lại liên kết xác minh
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Declined Action Box */}
              {isDeclined && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
                  <p className="text-xs text-rose-800 dark:text-rose-300">
                    Phiên xác minh này chưa thành công. Bạn có thể bấm bắt đầu để tạo phiên xác minh mới.
                  </p>
                  <button
                    onClick={start}
                    disabled={starting}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 transition"
                  >
                    <BadgeCheck className="h-4 w-4" />
                    {starting ? 'Đang khởi tạo...' : 'Bắt đầu phiên xác minh mới'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <p className="text-sm text-zinc-500">Bạn chưa có phiên xác minh nào.</p>
              <button onClick={start} disabled={starting} className={primaryButton}>
                <BadgeCheck className="h-4 w-4" />
                {starting ? 'Đang khởi tạo...' : 'Bắt đầu ngay'}
              </button>
            </div>
          )}
        </div>

        {/* Benefits / Process Card */}
        <div className={card}>
          {isApproved ? (
            <>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                <h2 className="font-bold text-zinc-900 dark:text-white">Đặc quyền bảo mật đã mở</h2>
              </div>
              <ul className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    <strong>Rút tiền & quản lý ví:</strong> Mở toàn bộ hạn mức rút tiền về tài khoản ngân hàng liên kết.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    <strong>Bảo vệ 2 lớp:</strong> Ngăn chặn giả mạo thông tin tài khoản và hỗ trợ xử lý tranh chấp ưu tiên.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    <strong>Huy hiệu xác minh:</strong> Tự động kích hoạt nhãn chứng thực số trên toàn bộ nền tảng Smart Order.
                  </span>
                </li>
              </ul>
            </>
          ) : (
            <>
              <h2 className="font-bold text-zinc-900 dark:text-white">Quy trình xác minh</h2>
              <ol className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#287DA8]/10 text-xs font-bold text-[#287DA8]">
                    1
                  </span>
                  <span>Mở phiên xác minh an toàn do Didit bảo đảm.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#287DA8]/10 text-xs font-bold text-[#287DA8]">
                    2
                  </span>
                  <span>Chụp 2 mặt giấy tờ tùy thân và quét khuôn mặt (Liveness Check).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#287DA8]/10 text-xs font-bold text-[#287DA8]">
                    3
                  </span>
                  <span>Quay lại đây và hệ thống sẽ tự động đồng bộ kết quả duyệt tức thì.</span>
                </li>
              </ol>
            </>
          )}
        </div>
      </section>

      {/* History Table */}
      {sessions.length > 1 && (
        <section className={card}>
          <h2 className="font-bold text-zinc-900 dark:text-white">Lịch sử các phiên xác minh</h2>
          <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {sessions.map((item, index) => (
              <div
                key={item.id || item.sessionId || index}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-100">
                    Phiên #{item.id || item.sessionId}
                  </p>
                  <p className="text-xs text-zinc-400">
                    Tạo lúc: {formatDate(item.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill value={item.status} />
                  {String(item.status).toUpperCase() === 'PENDING' && (
                    <button
                      onClick={() => syncDecision(item.id || item.sessionId)}
                      disabled={syncing}
                      className="text-xs font-semibold text-[#287DA8] hover:underline disabled:opacity-50"
                    >
                      Đồng bộ
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
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
