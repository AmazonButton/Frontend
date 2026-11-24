import './admin-ui.css';
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RotateCcw, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminRefundsWorkspace } from '../../components/admin/AdminRefundsWorkspace';

export const AdminRefundsPage: React.FC = () => {
  const reduced = useReducedMotion();

  return (
    <motion.main
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="admin-ui admin-payouts mx-auto max-w-6xl space-y-6 px-4 py-7 sm:px-6"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold text-[#287DA8]">Quản trị hệ thống</p>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Đối soát & Hoàn tiền PayOS</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Theo dõi các khoản tiền cần hoàn trả (hủy đơn, hoàn cọc thiết bị, tiền thừa) và gửi lệnh chi trả tự động qua PayOS.
          </p>
        </div>

        {/* Tab switch navigation */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 w-fit shrink-0 border border-zinc-200/80 dark:border-zinc-700/80">
          <Link
            to="/admin/payouts"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Chi trả ví cửa hàng</span>
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 text-[#287DA8] dark:text-[#38a5da] shadow-xs">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Hoàn tiền PayOS</span>
          </div>
        </div>
      </header>

      <AdminRefundsWorkspace />
    </motion.main>
  );
};
