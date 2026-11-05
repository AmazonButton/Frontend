import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export const PageBackButton: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    // Router's entry index distinguishes an in-app visit from a newly opened tab.
    const historyIndex = window.history.state?.idx;
    if (Number.isInteger(historyIndex) && historyIndex > 0) {
      navigate(-1);
      return;
    }

    const isProfile = location.pathname === '/customer/profile' || location.pathname === '/profile';
    const isSecurityTab = isProfile && new URLSearchParams(location.search).get('tab') === 'SECURITY';
    const fallback = isSecurityTab
      ? '/customer/profile?tab=INFO'
      : location.pathname === '/customer/home'
        ? '/shop'
        : '/customer/home';

    // Replace the direct entry so repeatedly going back cannot create a loop.
    navigate(fallback, { replace: true });
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#0E6BA8] active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#287DA8] focus-visible:ring-offset-2 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-sky-400 dark:active:bg-zinc-700 dark:focus-visible:ring-offset-zinc-950"
      aria-label="Quay lại trang trước"
    >
      <ArrowLeft className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span>Quay lại</span>
    </button>
  );
};
