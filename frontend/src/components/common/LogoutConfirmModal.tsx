import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { User } from '../../types';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  user?: User | null;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  user,
}) => {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();

  useBodyScrollLock(isOpen && !!user);

  // Close immediately if user logs out (user becomes null) or route navigates to auth page
  useEffect(() => {
    if (isOpen && (location.pathname === '/login' || !user)) {
      setIsLoggingOut(false);
      onClose();
    }
  }, [location.pathname, user, isOpen, onClose]);

  // Reset logging out state whenever modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsLoggingOut(false);
    }
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoggingOut) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoggingOut, onClose]);

  if (typeof document === 'undefined') return null;

  const handleConfirmLogout = async () => {
    try {
      setIsLoggingOut(true);
      await onConfirm();
    } catch (_) {
      // ignore
    } finally {
      setIsLoggingOut(false);
      onClose();
    }
  };

  const cleanName = user?.fullName ? user.fullName.replace(/\s*\([^)]*\)/g, '').trim() : 'Người dùng';

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Get user avatar from localStorage or user object
  const uid = user?.id || 'store-owner';
  const avatarUrl =
    (typeof window !== 'undefined' ? localStorage.getItem(`sob_avatar_${uid}`) : null) ||
    (user as any)?.avatar ||
    null;

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'Super Admin';
      case 'STORE_OWNER':
      case 'STORE_MANAGER':
      case 'STORE_STAFF':
        return 'Chủ Cửa Hàng';
      case 'CUSTOMER':
      default:
        return 'Khách Hàng';
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && user && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overscroll-contain">
          {/* Backdrop blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm cursor-pointer"
            onClick={() => !isLoggingOut && onClose()}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl p-6 shadow-2xl border border-slate-200/80 dark:border-zinc-800"
          >
            {/* Header: Title + Close button */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
                Xác nhận đăng xuất?
              </h3>

              <button
                type="button"
                onClick={() => !isLoggingOut && onClose()}
                disabled={isLoggingOut}
                className="p-1.5 -mr-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Description */}
            <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed mt-1.5">
              Phiên làm việc hiện tại sẽ kết thúc trên trình duyệt này. Toàn bộ cấu hình nút bấm và đơn hàng vẫn được lưu trữ an toàn.
            </p>

            {/* Current Account Card */}
            {user && (
              <div className="bg-slate-50/80 dark:bg-zinc-850/60 border border-slate-200/70 dark:border-zinc-800 rounded-xl p-3 my-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold text-xs shrink-0 overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={cleanName} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(cleanName)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {cleanName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      {user.email || 'dinh.nguyen@gmail.com'}
                    </p>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-[#0E6BA8] border border-blue-200/80 dark:bg-blue-950/40 dark:text-[#38a5da] dark:border-blue-800/60 shrink-0">
                  {getRoleLabel(user.role)}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoggingOut}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-zinc-300 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Hủy
              </button>

              <button
                type="button"
                onClick={handleConfirmLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 shadow-xs transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang đăng xuất...</span>
                  </>
                ) : (
                  <span>Đăng xuất</span>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
