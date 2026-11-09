import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { financeError } from '../../services/store-finance-flow';
import { createStorePlanFlow, eligibleStorePayosPlan, storePlanCheckoutUrl, type StoreServicePlan } from '../../services/store-service-plans';
import { getApiRetryUntil } from '../../services/request-backoff';
import { BankError, bankButton } from '../common/BankingPrimitives';
import { primaryButton } from '../../pages/operations/OperationPrimitives';
import { subscriptionMoney } from '../../services/store-subscription-overview';

const flow = createStorePlanFlow(api);
type Payment = { planId: string; chargeId?: string; checkoutUrl?: string; amount?: number };
export const StorePlanPayosPayment: React.FC<{
  scope: string; storeId: string | null; selected: StoreServicePlan | null; catalog: StoreServicePlan[];
  disabled: boolean; isWalletBusy: () => boolean; onOutstandingChange: (planId: string | null) => void; onConfirmed: () => void;
}> = ({ scope, storeId, selected, catalog, disabled, isWalletBusy, onOutstandingChange, onConfirmed }) => {
  const key = `smart_order_service_payos:${scope}`;
  const [payment, setPayment] = useState<Payment | null>(() => {
    try { const item = JSON.parse(sessionStorage.getItem(key) || 'null'); return item && /^[1-9]\d*$/.test(item.planId) ? item : null; } catch { return null; }
  });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const alive = useRef(true);
  const confirmed = useRef(false);
  const confirmedCallback = useRef(onConfirmed); confirmedCallback.current = onConfirmed;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const save = (value: Payment | null) => {
    setPayment(value);
    try { if (value) sessionStorage.setItem(key, JSON.stringify(value)); else sessionStorage.removeItem(key); } catch { /* Memory fallback. */ }
  };
  useEffect(() => { onOutstandingChange(payment?.planId || null); }, [payment, onOutstandingChange]);
  const check = useCallback(async () => {
    if (!payment?.chargeId || !storeId || running.current) return;
    running.current = true; setBusy(true);
    try {
      const result = await flow.charge(storeId, payment.chargeId);
      if (!alive.current) return;
      setStatus(result.status); setError('');
      if (result.status === 'PAID' && !confirmed.current) { confirmed.current = true; save(null); confirmedCallback.current(); }
      else if (['CANCELLED', 'CANCELED', 'EXPIRED', 'FAILED'].includes(result.status)) save(null);
    } catch (error) { if (alive.current) setError(financeError(error)); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  }, [payment?.chargeId, storeId]);
  useEffect(() => { if (payment?.chargeId) void check(); }, [check]);
  useEffect(() => {
    if (!payment?.chargeId || error || status !== 'PENDING') return;
    const update = () => { if (document.visibilityState === 'visible' && !getApiRetryUntil()) void check(); };
    const timer = window.setInterval(update, 15000); window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); };
  }, [payment?.chargeId, status, error, check]);
  const start = async () => {
    if (!storeId || !selected || disabled || isWalletBusy() || payment || running.current || !eligibleStorePayosPlan(catalog, selected.planId)) return;
    running.current = true; setBusy(true); setError(''); confirmed.current = false;
    // Persist an unresolved attempt BEFORE POST: renew-charge does not have an
    // idempotent create contract. Never automatically repeat this request.
    onOutstandingChange(selected.planId);
    let dispatched = false;
    try {
      const latest = await flow.plans();
      if (!alive.current) return;
      if (!eligibleStorePayosPlan(latest, selected.planId)) throw new Error('Gói thanh toán qua PayOS vừa thay đổi. Vui lòng tải lại danh mục.');
      const returnUrl = `${window.location.origin}/store/service-plans`;
      save({ planId: selected.planId });
      dispatched = true;
      const result = await flow.createPayosCharge(returnUrl, returnUrl);
      if (!alive.current) return;
      save({ ...result, planId: selected.planId }); setStatus(null);
    } catch (error) { if (alive.current) { if (!dispatched) { save(null); onOutstandingChange(null); } setError(financeError(error)); } }
    finally { running.current = false; if (alive.current) setBusy(false); }
  };
  const eligible = selected && eligibleStorePayosPlan(catalog, selected.planId);
  const checkoutUrl = status === 'PENDING' && !error ? storePlanCheckoutUrl(payment?.checkoutUrl) : null;
  if (!eligible && !payment && status !== 'PAID') return null;
  return <section className="rounded-2xl border border-sky-200 bg-sky-50/40 p-5 text-zinc-900 dark:border-sky-900 dark:bg-sky-950/20 dark:text-zinc-100" aria-label="Thanh toán gói dịch vụ qua PayOS"><h2 className="font-semibold">Thanh toán trực tiếp qua PayOS</h2><p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{eligible ? `${selected!.planName} · ${subscriptionMoney(selected!.price)} / ${selected!.durationDays} ngày. Có thể thanh toán bằng ngân hàng khi ví cửa hàng chưa đủ tiền.` : 'Theo dõi yêu cầu thanh toán gói duy trì gian hàng đã tạo.'}</p><div className="mt-3"><BankError message={error} /></div>{status === 'PAID' && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">Server đã xác nhận khoản thu đã thanh toán. Đang cập nhật thời hạn gói của cửa hàng.</p>}{payment && !payment.chargeId && <p role="alert" className="mt-3 text-sm leading-6 text-amber-900 dark:text-amber-300">Yêu cầu tạo thanh toán chưa có kết quả xác nhận. Không tạo hoặc thanh toán thêm yêu cầu khác; hãy kiểm tra gói đã đăng ký và liên hệ hỗ trợ để lấy lại khoản thu.</p>}{payment?.chargeId && <p className="mt-3 text-xs text-zinc-500">Mã khoản thu #{payment.chargeId} · {status === 'PENDING' ? 'Đang chờ thanh toán' : 'Đang kiểm tra trạng thái'}</p>}<div className="mt-4 flex flex-wrap gap-2">{!payment && eligible && status !== 'PAID' && <button type="button" disabled={busy || disabled} className={`${primaryButton} min-h-11 text-sm`} onClick={start}>{busy && <Loader2 size={16} className="motion-safe:animate-spin" />}Tạo thanh toán PayOS</button>}{checkoutUrl && <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className={`${primaryButton} min-h-11 text-sm`}>Mở thanh toán PayOS<ExternalLink size={16} /></a>}{payment?.chargeId && <button type="button" disabled={busy} className={bankButton} onClick={() => void check()}><RefreshCw size={16} />Kiểm tra thanh toán</button>}</div><p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Chỉ thanh toán một yêu cầu. Gói có hiệu lực theo xác nhận từ hệ thống; tạo liên kết hoặc quay lại từ PayOS chưa phải là xác nhận đã thanh toán.</p></section>;
};
