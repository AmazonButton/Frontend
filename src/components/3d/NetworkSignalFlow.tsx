import React, { useEffect, useState } from 'react';
import { Radio, Cpu, Wifi, Cloud, Store } from 'lucide-react';

interface NetworkSignalFlowProps {
  activeStep?: number; // 0 to 4
  interactive?: boolean;
  className?: string;
  onStepClick?: (step: number) => void;
  autoPlay?: boolean;
}

export const NetworkSignalFlow: React.FC<NetworkSignalFlowProps> = ({
  activeStep: controlledStep,
  interactive = true,
  className = '',
  onStepClick,
  autoPlay = true,
}) => {
  const [internalStep, setInternalStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const currentStep = controlledStep !== undefined ? controlledStep : internalStep;

  // Auto-play signal flow cycle (Section 36.3: Living IoT Pipeline)
  useEffect(() => {
    if (!autoPlay || isPaused) return;

    const interval = setInterval(() => {
      setInternalStep((prev) => {
        const next = (prev + 1) % 5;
        onStepClick?.(next);
        return next;
      });
    }, 2800);

    return () => clearInterval(interval);
  }, [autoPlay, isPaused, onStepClick]);

  const nodes = [
    { id: 'button', label: 'Smart Button', sub: 'Nút vật lý', icon: Radio },
    { id: 'esp32', label: 'ESP32 Node', sub: 'Mã hóa HMAC', icon: Cpu },
    { id: 'wifi', label: 'Wi-Fi Edge', sub: 'Gateway 2.4GHz', icon: Wifi },
    { id: 'cloud', label: 'Cloud Broker', sub: 'Xác thực & Router', icon: Cloud },
    { id: 'store', label: 'Đại Lý Kho', sub: 'Nhận đơn Socket', icon: Store },
  ];

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`w-full py-6 select-none ${className}`}
    >
      {/* Visual Pipeline Container */}
      <div className="relative max-w-4xl mx-auto px-4">
        {/* Subtle Background SVG Signal Connector Line */}
        <div className="absolute top-1/2 left-8 right-8 -translate-y-1/2 h-0.5 pointer-events-none hidden sm:block">
          <svg className="w-full h-4 overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 2">
            {/* Base static faint line */}
            <line
              x1="0"
              y1="1"
              x2="100"
              y2="1"
              stroke="currentColor"
              className="text-slate-200 dark:text-red-500/20"
              strokeWidth="1.5"
            />
            {/* Animated dashed signal pulse flowing from Button to Store */}
            <line
              x1="0"
              y1="1"
              x2="100"
              y2="1"
              stroke="url(#signalGradient)"
              strokeWidth="2.5"
              className="animate-signal-flow opacity-80 dark:hidden"
            />
            <line
              x1="0"
              y1="1"
              x2="100"
              y2="1"
              stroke="url(#signalGradientCyber)"
              strokeWidth="2.5"
              className="animate-signal-flow opacity-90 hidden dark:block"
            />
            <defs>
              <linearGradient id="signalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563EB" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#06B6D4" stopOpacity="1" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="signalGradientCyber" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#DC2626" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#EF4444" stopOpacity="1" />
                <stop offset="100%" stopColor="#FB7185" stopOpacity="0.9" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* 5 Physical IoT Nodes */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 relative z-10">
          {nodes.map((node, idx) => {
            const Icon = node.icon;
            const isCurrent = idx === currentStep;
            const isPassed = idx <= currentStep;

            return (
              <div
                key={node.id}
                onClick={() => {
                  if (interactive) {
                    setInternalStep(idx);
                    onStepClick?.(idx);
                  }
                }}
                className={`flex flex-col items-center text-center p-3.5 rounded-2xl transition-all duration-300 ${
                  interactive ? 'cursor-pointer' : ''
                } ${
                  isCurrent
                    ? 'bg-white dark:bg-[#141416] border-2 border-blue-600 dark:border-red-500 shadow-xl shadow-blue-500/20 dark:shadow-red-500/30 scale-105 -translate-y-1'
                    : isPassed
                    ? 'bg-white/90 dark:bg-[#121214]/90 border border-blue-200 dark:border-red-500/25'
                    : 'bg-slate-50/70 dark:bg-zinc-900/40 border border-slate-200/50 dark:border-zinc-800 opacity-60 hover:opacity-80'
                }`}
              >
                {/* Node Orb with Icon */}
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                    isCurrent
                      ? 'bg-gradient-to-br from-blue-600 to-indigo-600 dark:from-red-600 dark:to-rose-600 text-white shadow-md shadow-blue-500/35 dark:shadow-red-500/40 scale-110'
                      : isPassed
                      ? 'bg-blue-500/15 dark:bg-red-500/15 text-blue-600 dark:text-red-400'
                      : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-400 dark:text-zinc-500'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isCurrent ? 'animate-pulse' : ''}`} />
                </div>

                {/* Node Metadata */}
                <span className="text-xs font-bold text-slate-900 dark:text-white mt-2">
                  {node.label}
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">
                  {node.sub}
                </span>

                {/* Status Dot */}
                <div className="mt-1.5 flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isCurrent
                        ? 'bg-blue-600 dark:bg-red-500 animate-ping'
                        : isPassed
                        ? 'bg-emerald-500 dark:bg-rose-500'
                        : 'bg-slate-300 dark:bg-zinc-700'
                    }`}
                  />
                  <span className="text-[9px] font-mono uppercase text-slate-400 dark:text-zinc-500 font-semibold">
                    {isCurrent ? 'ACTIVE' : isPassed ? 'READY' : 'STANDBY'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
