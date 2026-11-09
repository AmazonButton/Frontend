import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import { financeError } from '../../services/store-finance-flow';
import { createStorePlanFlow, readStorePlanSubscription, type StorePlanSubscription } from '../../services/store-service-plans';
import { subscriptionDateLabel, subscriptionOverview } from '../../services/store-subscription-overview';
import { BankError, bankButton } from '../common/BankingPrimitives';
import { card } from '../../pages/operations/OperationPrimitives';
const flow = createStorePlanFlow(api);
export const StoreRegisteredPeriods: React.FC<{ storeId: string; refreshKey: number }> = ({ storeId, refreshKey }) => {
  const [history, setHistory] = useState<{ rows: StorePlanSubscription[]; pagination: any } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [page, setPage] = useState(1);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const generation = useRef(0);
  const now = Date.now();
  useEffect(() => {
    const request = ++generation.current;
    setHistoryLoading(true);
    void flow.history(page).then(result => {
      const rows = result.rows.map(row => readStorePlanSubscription(row, storeId)!);
      if (request === generation.current) { setHistory({ rows, pagination: result.pagination }); setHistoryError(''); }
    }).catch(error => { if (request === generation.current) setHistoryError(financeError(error)); })
      .finally(() => { if (request === generation.current) setHistoryLoading(false); });
    return () => { generation.current++; };
  }, [storeId, page, historyRefresh, refreshKey]);
  return (
<section className={card} aria-labelledby="service-plan-history"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="service-plan-history" className="font-semibold">Các kỳ gói đã đăng ký</h2><Link to="/store/finance#subscription-payments" className="text-sm font-semibold text-[#287DA8]">Xem lịch sử đóng phí<ArrowRight size={15} className="ml-1 inline" /></Link></div><div className="mt-4"><BankError message={historyError} retry={() => setHistoryRefresh(value => value + 1)} busy={historyLoading} /></div>{historyLoading && !history ? <p role="status" className="py-6 text-sm text-zinc-500">Đang tải các kỳ đăng ký…</p> : history?.rows.length ? <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">{history.rows.map(row => <li key={row.subscriptionId} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="text-sm font-semibold">{row.plan?.planName || `Gói #${row.planId}`}</h3><p className="mt-1 text-xs text-zinc-500">#{row.subscriptionId} · {subscriptionDateLabel(row.startDate)} – {subscriptionDateLabel(row.endDate)}</p></div><span className="rounded-md bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">{subscriptionOverview(row, now).label}</span></li>)}</ul> : !historyError && <p className="py-6 text-sm text-zinc-500">Chưa có kỳ đăng ký nào.</p>}{history && <nav aria-label="Phân trang gói đã đăng ký" className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800"><span className="text-xs text-zinc-500">{history.pagination.totalItems} kỳ · Trang {history.pagination.page}</span><div className="flex gap-2"><button type="button" className={bankButton} disabled={historyLoading || page <= 1} onClick={() => setPage(value => value - 1)}>Trước</button><button type="button" className={bankButton} disabled={historyLoading || !history.pagination.hasNextPage} onClick={() => setPage(value => value + 1)}>Sau</button></div></nav>}</section>
  );
};
