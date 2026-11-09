import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, Package, RefreshCw, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { financeError, financeStoreId } from '../../services/store-finance-flow';
import { walletService } from '../../services/wallet.service';
import { createStorePlanFlow, type StoreServicePlan, type StorePlanSubscription } from '../../services/store-service-plans';
import { subscriptionDateLabel, subscriptionMoney } from '../../services/store-subscription-overview';
import { BankError, bankButton } from '../../components/common/BankingPrimitives';
import { card, primaryButton } from '../operations/OperationPrimitives';
import { StorePlanPayosPayment } from '../../components/store/StorePlanPayosPayment';

const flow = createStorePlanFlow(api);
type PendingRegistration = { planId: string; key: string };
export const StoreServicePlansPage: React.FC = () => {
  const { user } = useAuth();
  const storeId = financeStoreId(user);
  return user?.role === 'STORE_OWNER' ? <StoreServicePlansWorkspace key={`${user.id}:${storeId}`} scope={`${user.id}:${storeId}`} storeId={storeId} /> : null;
};
export const StoreServicePlansWorkspace: React.FC<{ scope: string; storeId: string | null }> = ({ scope, storeId }) => {
  const storageKey = `smart_order_service_registration:${scope}`;
  const [plans, setPlans] = useState<StoreServicePlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState('');
  const [current, setCurrent] = useState<StorePlanSubscription | null>(null);
  const [currentLoading, setCurrentLoading] = useState(true);
  const [currentError, setCurrentError] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [walletError, setWalletError] = useState('');
  const [selected, setSelected] = useState<StoreServicePlan | null>(null);
  const [pending, setPending] = useState<PendingRegistration | null>(() => {
    try { const item = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); return item && /^[1-9]\d*$/.test(item.planId) && /^[A-Za-z0-9._:-]{1,128}$/.test(item.key) ? item : null; } catch { return null; }
  });
  const pendingRef = useRef(pending);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [payosOutstanding, setPayosOutstanding] = useState<string | null>(null);
  const payosOutstandingRef = useRef<string | null>(null);
  const onPayosOutstanding = useCallback((planId: string | null) => { payosOutstandingRef.current = planId; setPayosOutstanding(planId); }, []);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [receipt, setReceipt] = useState<StorePlanSubscription | null>(null);
  const alive = useRef(true);
  const [now, setNow] = useState(Date.now());
  const confirmationRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const savePending = (value: PendingRegistration | null) => {
    pendingRef.current = value; setPending(value);
    try { if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey); } catch { /* In-memory duplicate protection still applies. */ }
  };
  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try { const list = await flow.plans(); if (alive.current) { setPlans(list); setPlansError(''); } }
    catch (error) { if (alive.current) setPlansError(financeError(error)); }
    finally { if (alive.current) setPlansLoading(false); }
  }, []);
  const loadCurrent = useCallback(async () => {
    if (!storeId) { setCurrentLoading(false); setCurrentError('Chưa xác định được cửa hàng liên kết.'); return; }
    setCurrentLoading(true);
    try { const subscription = await flow.current(storeId); if (alive.current) { setCurrent(subscription); setCurrentError(''); setNow(Date.now()); } }
    catch (error) { if (alive.current) setCurrentError(financeError(error)); }
    finally { if (alive.current) setCurrentLoading(false); }
  }, [storeId]);
  const loadWallet = useCallback(async () => {
    if (!storeId) return;
    try {
      const response = await walletService.getWallet();
      if (String(response.data.storeId) !== storeId) throw new Error('Thông tin ví không thuộc cửa hàng đang xem.');
      if (alive.current) { setBalance(response.data.availableBalance); setWalletError(''); }
    } catch (error) { if (alive.current) { setBalance(null); setWalletError(financeError(error)); } }
  }, [storeId]);
  useEffect(() => { void loadPlans(); void loadCurrent(); void loadWallet(); }, [loadPlans, loadCurrent, loadWallet]);
  useEffect(() => { if (selected) confirmationRef.current?.focus(); }, [selected]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  const confirm = async () => {
    if (!selected || !storeId || busyRef.current || payosOutstandingRef.current || balance === null || walletError || currentError || plansError) return;
    if (pendingRef.current && pendingRef.current.planId !== selected.planId) return;
    busyRef.current = true; setBusy(true); setActionError(''); setNotice('');
    let dispatched = false;
    try {
      const latest = (await flow.plans()).find(plan => plan.planId === selected.planId);
      if (!alive.current) return;
      if (!latest) throw new Error('Gói này đã ngừng cung cấp. Hãy tải lại danh sách.');
      if (latest.price !== selected.price || latest.durationDays !== selected.durationDays || latest.maxProducts !== selected.maxProducts) {
        setSelected(latest); throw new Error('Thông tin gói vừa thay đổi. Vui lòng kiểm tra lại giá và quyền lợi trước khi xác nhận.');
      }
      if (!pendingRef.current && balance < latest.price) throw new Error('Số dư ví không đủ để đăng ký gói này.');
      const request = pendingRef.current || { planId: selected.planId, key: `store-plan:${crypto.randomUUID()}` };
      savePending(request);
      dispatched = true;
      const registration = await flow.subscribe(storeId, request.planId, request.key);
      if (!alive.current) return;
      savePending(null); setReceipt(registration); setSelected(null);
      setNotice('Hệ thống đã ghi nhận đăng ký gói dịch vụ. Quyền đăng sản phẩm được mở theo thời hạn có hiệu lực thực tế.');
      
      await Promise.all([loadCurrent(), loadWallet()]);
    } catch (error: any) {
      if (!alive.current) return;
      const status = error?.response?.status;
      if (dispatched && [400, 401, 403, 404, 422].includes(status)) savePending(null);
      setActionError(dispatched && (!status || status >= 500)
        ? 'Chưa xác nhận được kết quả đăng ký. Không chọn gói khác; dùng “Kiểm tra lại yêu cầu” để gửi lại đúng yêu cầu cũ, tránh trừ ví hai lần.' : financeError(error));
      if (dispatched) { void loadCurrent(); void loadWallet();  }
    } finally { if (alive.current) { busyRef.current = false; setBusy(false); } }
  };
  const refreshAll = () => { void loadPlans(); void loadCurrent(); void loadWallet();  };

  return <main className="mx-auto w-full max-w-6xl space-y-6 py-2 text-zinc-900 dark:text-zinc-100">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold text-[#287DA8] dark:text-sky-300">Dành cho chủ cửa hàng</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Đăng ký gói dịch vụ</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">Đăng ký gói cho gian hàng của bạn. Gói cần còn hiệu lực và còn hạn mức để đăng thêm sản phẩm lên sàn.</p></div><button type="button" disabled={busy || plansLoading || currentLoading} onClick={refreshAll} className={bankButton}><RefreshCw size={16} />Tải lại</button></header>
    <div aria-live="polite">{notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</p>}</div>
    <section className={card} aria-label="Số dư thanh toán đăng ký"><Wallet className="h-5 w-5 text-[#287DA8]" /><p className="mt-3 text-xs text-zinc-500">Số dư ví cửa hàng</p><p className="mt-1 text-2xl font-semibold tabular-nums">{subscriptionMoney(balance)}</p><div className="mt-3"><BankError message={walletError} retry={() => void loadWallet()} /><BankError message={currentError} retry={() => void loadCurrent()} busy={currentLoading} /></div>{currentLoading && <p role="status" className="mt-2 text-xs text-zinc-500">Đang kiểm tra điều kiện đăng ký…</p>}<Link to="/store/analytics?tab=WALLET" className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#287DA8]">Xem ví cửa hàng<ArrowRight size={16} /></Link></section>
    {receipt && <section className={`${card} border-emerald-200 dark:border-emerald-900`} aria-label="Đăng ký vừa ghi nhận"><h2 className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} className="text-emerald-600" />Đăng ký #{receipt.subscriptionId}</h2><p className="mt-2 text-sm">{receipt.plan?.planName} · {subscriptionDateLabel(receipt.startDate, true)} – {subscriptionDateLabel(receipt.endDate, true)}</p><p className="mt-2 text-xs text-zinc-500">{Date.parse(receipt.startDate) > now ? 'Kỳ mới bắt đầu sau khi kỳ đã trả trước hiện có kết thúc; không tự chuyển gói ngay lập tức.' : 'Theo dõi thời hạn và hạn mức tại trang quản lý sản phẩm.'}</p><Link to="/store/products" className={`${primaryButton} mt-4 min-h-11 text-sm`}>Quản lý sản phẩm<ArrowRight size={16} /></Link></section>}
    <section className={card} aria-labelledby="service-plans-title"><h2 id="service-plans-title" className="font-semibold">Chọn gói cho gian hàng</h2><p className="mt-1 text-sm leading-6 text-zinc-500">Giá, thời hạn và số lượng sản phẩm được lấy từ danh mục đang cung cấp. Đăng ký khi đã có gói có thể tạo kỳ tiếp theo, theo lịch hệ thống.</p><div className="mt-4"><BankError message={plansError} retry={() => void loadPlans()} busy={plansLoading} /></div>{plansLoading && !plans.length ? <p role="status" className="mt-6 flex items-center gap-2 text-sm text-zinc-500"><Loader2 size={16} className="motion-safe:animate-spin" />Đang tải gói dịch vụ…</p> : plans.length ? <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{plans.map(plan => <article key={plan.planId} className="flex flex-col rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"><Package size={20} className="text-[#287DA8]" /><h3 className="mt-4 font-semibold">{plan.planName}</h3><p className="mt-1 text-xs text-zinc-500">{plan.planCode}</p><p className="mt-4 text-2xl font-semibold tabular-nums">{subscriptionMoney(plan.price)}</p><p className="mt-1 text-xs text-zinc-500">Mỗi kỳ {plan.durationDays} ngày</p><p className="mt-4 text-sm">Tối đa {plan.maxProducts.toLocaleString('vi-VN')} sản phẩm</p>{plan.description && <p className="mt-3 flex-1 whitespace-pre-line text-sm leading-6 text-zinc-500">{plan.description}</p>}<button type="button" disabled={busy || plansLoading || !!plansError || !!currentError || currentLoading || !!pending && pending.planId !== plan.planId || !!payosOutstanding && payosOutstanding !== plan.planId} onClick={() => { setSelected(plan); setActionError(''); }} className={`${primaryButton} mt-5 min-h-11 text-sm`}>{pending?.planId === plan.planId ? 'Kiểm tra lại yêu cầu' : 'Đăng ký gói'}</button></article>)}</div> : !plansError && <p className="mt-6 text-sm text-zinc-500">Chưa có gói dịch vụ đang được cung cấp. Vui lòng liên hệ quản trị viên.</p>}{pending && <p role="status" className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Có yêu cầu đăng ký chưa được xác nhận trong phiên này. Chọn “Kiểm tra lại yêu cầu” ở đúng gói đã chọn; chưa tạo thêm giao dịch cho gói khác.</p>}</section>
    {selected && <section className={`${card} border-sky-200 dark:border-sky-900`} aria-labelledby="confirm-service-plan"><h2 id="confirm-service-plan" ref={confirmationRef} tabIndex={-1} className="font-semibold outline-none">{pending ? 'Kiểm tra lại yêu cầu đăng ký' : 'Xác nhận đăng ký gói dịch vụ'}</h2><dl className="mt-4 grid gap-4 sm:grid-cols-3"><div><dt className="text-xs text-zinc-500">Gói đã chọn</dt><dd className="mt-1 font-semibold">{selected.planName}</dd></div><div><dt className="text-xs text-zinc-500">Phí đăng ký từ ví</dt><dd className="mt-1 font-semibold">{subscriptionMoney(selected.price)}</dd></div><div><dt className="text-xs text-zinc-500">Thời hạn / Giới hạn</dt><dd className="mt-1 text-sm">{selected.durationDays} ngày / {selected.maxProducts} sản phẩm</dd></div></dl><p className="mt-4 text-sm leading-6 text-zinc-500">{pending ? 'Thao tác dùng lại đúng mã yêu cầu trước đó. Hệ thống sẽ trả kết quả đăng ký đã ghi nhận hoặc xử lý yêu cầu đó.' : 'Xác nhận sẽ gửi yêu cầu thanh toán gói bằng ví cửa hàng. Kỳ sử dụng có thể nối tiếp kỳ đã thanh toán; thông tin thời hạn chính xác xuất hiện sau khi hệ thống ghi nhận.'}</p>{balance !== null && balance < selected.price && !pending && <p className="mt-3 text-sm text-amber-800 dark:text-amber-300">Số dư ví chưa đủ để đăng ký gói này.</p>}<div className="mt-4"><BankError message={actionError} /></div><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={confirm} disabled={busy || !!payosOutstanding || balance === null || !pending && balance < selected.price || !!walletError || !!currentError || !!plansError} className={`${primaryButton} min-h-11 text-sm`}>{busy && <Loader2 size={16} className="motion-safe:animate-spin" />}{pending ? 'Kiểm tra lại yêu cầu' : 'Xác nhận đăng ký & thanh toán'}</button><button type="button" disabled={busy} onClick={() => { setSelected(null); setActionError(''); }} className={bankButton}>Đóng</button></div></section>}
    <StorePlanPayosPayment scope={scope} storeId={storeId} selected={selected} catalog={plans} disabled={busy || !!pending || !!plansError || !!currentError || currentLoading} isWalletBusy={() => busyRef.current || !!pendingRef.current} onOutstandingChange={onPayosOutstanding} onConfirmed={() => { void loadCurrent(); void loadWallet();  }} />

  </main>;
};
