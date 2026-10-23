import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title?: string;
  duration?: number;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration: number;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Standalone global dispatcher so toast can be called anywhere
type ToastListener = (toast: ToastItem) => void;
const listeners = new Set<ToastListener>();

export const toast = {
  success: (message: string, options?: ToastOptions) => {
    dispatchGlobalToast('success', message, options);
  },
  error: (message: string, options?: ToastOptions) => {
    dispatchGlobalToast('error', message, options);
  },
  warning: (message: string, options?: ToastOptions) => {
    dispatchGlobalToast('warning', message, options);
  },
  info: (message: string, options?: ToastOptions) => {
    dispatchGlobalToast('info', message, options);
  },
};

function dispatchGlobalToast(type: ToastType, message: string, options?: ToastOptions) {
  const item: ToastItem = {
    id: `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    type,
    message,
    title: options?.title || (
      type === 'success' ? 'Thành công' :
      type === 'error' ? 'Đã có lỗi xảy ra' :
      type === 'warning' ? 'Cảnh báo' : 'Thông báo'
    ),
    duration: options?.duration ?? 4000,
  };
  listeners.forEach((fn) => fn(item));
}

// Single Toast Card Component
const ToastCard = React.forwardRef<
  HTMLDivElement,
  {
    item: ToastItem;
    onClose: (id: string) => void;
  }
>(({ item, onClose }, ref) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / item.duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onClose(item.id);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [item, onClose]);

  const config = {
    success: {
      accent: 'from-emerald-500 to-teal-500',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200/70 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400',
      progressBar: 'bg-emerald-500',
      icon: <CheckCircle2 className="w-5 h-5 shrink-0" />,
    },
    error: {
      accent: 'from-rose-500 to-red-600',
      iconBg: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200/70 dark:border-rose-800/50 text-rose-600 dark:text-rose-400',
      progressBar: 'bg-rose-500',
      icon: <AlertCircle className="w-5 h-5 shrink-0" />,
    },
    warning: {
      accent: 'from-amber-500 to-orange-500',
      iconBg: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200/70 dark:border-amber-800/50 text-amber-600 dark:text-amber-400',
      progressBar: 'bg-amber-500',
      icon: <AlertTriangle className="w-5 h-5 shrink-0" />,
    },
    info: {
      accent: 'from-[#0E6BA8] to-sky-500',
      iconBg: 'bg-sky-50 dark:bg-sky-950/50 border-sky-200/70 dark:border-sky-800/50 text-[#0E6BA8] dark:text-sky-400',
      progressBar: 'bg-[#0E6BA8]',
      icon: <Info className="w-5 h-5 shrink-0" />,
    },
  }[item.type];

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, x: 48, y: 12, scale: 0.94, filter: 'blur(4px)' }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: 36, scale: 0.94, filter: 'blur(2px)' }}
      transition={{
        type: 'spring',
        damping: 28,
        stiffness: 340,
        mass: 0.8,
      }}
      className="pointer-events-auto relative w-full max-w-sm sm:max-w-md bg-white/95 dark:bg-[#121216]/95 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.18)] rounded-2xl p-4 overflow-hidden"
    >
      {/* Decorative vertical gradient bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${config.accent}`} />

      <div className="flex items-start gap-3.5 pl-1.5">
        {/* Icon Pill */}
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${config.iconBg}`}>
          {config.icon}
        </div>

        {/* Text Details */}
        <div className="flex-1 min-w-0 pr-2">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
            {item.title}
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed break-words">
            {item.message}
          </p>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => onClose(item.id)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer shrink-0 -mr-1 -mt-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Thin Animated Duration Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100 dark:bg-zinc-800/80 overflow-hidden">
        <div
          className={`h-full transition-all duration-75 ease-linear ${config.progressBar}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
});

ToastCard.displayName = 'ToastCard';

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((item: ToastItem) => {
    // A toast is a transient status message, not an inbox. Keep one visible
    // message only: repeated actions restart its timer, and newer outcomes
    // (especially errors) replace stale success messages immediately.
    setToasts([item]);
  }, []);

  const showToast = useCallback((type: ToastType, message: string, options?: ToastOptions) => {
    const item: ToastItem = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      message,
      title: options?.title || (
        type === 'success' ? 'Thành công' :
        type === 'error' ? 'Đã có lỗi xảy ra' :
        type === 'warning' ? 'Cảnh báo' : 'Thông báo'
      ),
      duration: options?.duration ?? 4000,
    };
    addToast(item);
  }, [addToast]);

  const success = useCallback((msg: string, opt?: ToastOptions) => showToast('success', msg, opt), [showToast]);
  const error = useCallback((msg: string, opt?: ToastOptions) => showToast('error', msg, opt), [showToast]);
  const warning = useCallback((msg: string, opt?: ToastOptions) => showToast('warning', msg, opt), [showToast]);
  const info = useCallback((msg: string, opt?: ToastOptions) => showToast('info', msg, opt), [showToast]);

  // Hook into global dispatcher
  useEffect(() => {
    listeners.add(addToast);

    // Intercept native browser alert so any unhandled legacy alert gets designer toast
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      info(String(msg ?? ''));
    };

    return () => {
      listeners.delete(addToast);
      window.alert = originalAlert;
    };
  }, [addToast, info]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, removeToast }}>
      {children}

      {/* Floating single status message. Full event history belongs in the notification bell. */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col-reverse items-end gap-2.5 pointer-events-none w-full max-w-sm sm:max-w-md px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((item) => (
            <ToastCard key={item.id} item={item} onClose={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback to standalone toast if used outside provider
    return {
      showToast: (type: ToastType, message: string, options?: ToastOptions) => {
        if (type === 'success') toast.success(message, options);
        else if (type === 'error') toast.error(message, options);
        else if (type === 'warning') toast.warning(message, options);
        else toast.info(message, options);
      },
      success: toast.success,
      error: toast.error,
      warning: toast.warning,
      info: toast.info,
      removeToast: () => {},
    };
  }
  return context;
};
