import React, { Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';

const Analytics = React.lazy(() => import('./StoreAnalyticsPage').then(module => ({ default: module.StoreAnalyticsPage })));
const StoreWallet = React.lazy(() => import('./StoreWalletPage').then(module => ({ default: module.StoreWalletPage })));

export const StoreRevenuePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'WALLET' ? 'WALLET' : 'REVENUE';

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">

      <Suspense fallback={<div role="status" className="flex min-h-64 items-center justify-center gap-2 text-sm text-zinc-500"><span className="h-5 w-5 animate-spin rounded-full border-2 border-[#287DA8] border-t-transparent" />Đang tải dữ liệu…</div>}>
        {activeTab === 'WALLET' ? <StoreWallet /> : <Analytics />}
      </Suspense>
    </div>
  );
};
