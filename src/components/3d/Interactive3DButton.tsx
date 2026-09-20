import React, { useState } from 'react';
import { Radio } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Interactive3DButtonProps {
  onPress?: () => void;
  interactive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showTelemetry?: boolean;
  showCircularHalo?: boolean;
  label?: string;
  subLabel?: string;
  hideFeedbackFooter?: boolean;
  overrideLedState?: 'off' | 'blue' | 'yellow' | 'green' | 'red';
  overrideStatusText?: string;
}

export const Interactive3DButton: React.FC<Interactive3DButtonProps> = ({
  onPress,
  interactive = true,
  size = 'lg',
  label,
  subLabel,
  hideFeedbackFooter = false,
  overrideLedState,
  overrideStatusText,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [internalLedState, setInternalLedState] = useState<'off' | 'blue' | 'yellow' | 'green' | 'red'>('off');
  const [internalStatusText, setInternalStatusText] = useState('Sẵn sàng • Deep Sleep (<15µA)');

  const activeLedState = overrideLedState !== undefined ? overrideLedState : internalLedState;
  const activeStatusText = overrideStatusText !== undefined ? overrideStatusText : internalStatusText;

  // Web Audio synthetic click & chime
  const playTactileClick = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(260, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  };

  const playSuccessChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);
        gain.gain.setValueAtTime(0.18, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.28);
      });
    } catch {}
  };

  const handlePress = () => {
    if (isPressed || !interactive) return;
    setIsPressed(true);
    playTactileClick();
    setInternalLedState('blue');
    setInternalStatusText('RTC Wake (8ms) → Kết nối Wi-Fi...');
    onPress?.();

    setTimeout(() => {
      setInternalLedState('yellow');
      setInternalStatusText('Ký băm HMAC-SHA256 & Đẩy gói tin Cloud...');
    }, 650);

    setTimeout(() => {
      setInternalLedState('green');
      setInternalStatusText('Đơn Hàng Xác Nhận Thành Công! (60s hủy)');
      playSuccessChime();
      try {
        confetti({
          particleCount: 80,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#2563EB', '#06B6D4', '#10B981', '#EF4444'],
        });
      } catch {}
    }, 1400);

    setTimeout(() => {
      setInternalLedState('off');
      setIsPressed(false);
      setInternalStatusText('Hoàn tất → Quay về Deep Sleep (<15µA)');
    }, 4200);
  };

  const sizeClasses = {
    sm: 'w-48 h-48',
    md: 'w-60 h-60',
    lg: 'w-64 h-64 sm:w-72 sm:h-72',
  }[size];

  const buttonCapSize = {
    sm: 'w-28 h-28',
    md: 'w-36 h-36',
    lg: 'w-44 h-44 sm:w-48 sm:h-48',
  }[size];

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Clean Physical Button Enclosure */}
      <div className={`relative ${sizeClasses} flex items-center justify-center`}>
        {/* Soft Ambient Base Glow */}
        <div
          className="absolute inset-2 rounded-full blur-2xl transition-all duration-500 pointer-events-none"
          style={{
            background:
              activeLedState === 'green'
                ? 'radial-gradient(circle, rgba(16, 185, 129, 0.4) 0%, transparent 70%)'
                : activeLedState === 'yellow'
                ? 'radial-gradient(circle, rgba(245, 158, 11, 0.4) 0%, transparent 70%)'
                : activeLedState === 'blue'
                ? 'radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, transparent 70%)'
                : activeLedState === 'red'
                ? 'radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, transparent 70%)'
                : 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%)',
          }}
        />

        {/* Outer Chamfered Hardware Bezel */}
        <div className="w-full h-full rounded-full bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-950 p-[4px] shadow-xl flex items-center justify-center">
          {/* Inner Recessed Bezel Housing */}
          <div className="w-full h-full rounded-full bg-gradient-to-b from-slate-100 to-slate-200 dark:from-[#18181c] dark:to-[#0c0c0e] p-3 flex items-center justify-center relative overflow-hidden">
            {/* LED Status Ring */}
            <div
              className={`absolute inset-2 rounded-full border-2 transition-all duration-300 pointer-events-none ${
                activeLedState === 'green'
                  ? 'border-emerald-500 shadow-[0_0_20px_#10b981]'
                  : activeLedState === 'yellow'
                  ? 'border-amber-400 shadow-[0_0_20px_#f59e0b]'
                  : activeLedState === 'blue'
                  ? 'border-cyan-400 shadow-[0_0_20px_#06b6d4]'
                  : activeLedState === 'red'
                  ? 'border-rose-500 shadow-[0_0_20px_#ef4444]'
                  : 'border-slate-300/60 dark:border-red-500/30 shadow-none'
              }`}
            />

            {/* Tactile Button Cap */}
            <button
              type="button"
              onClick={handlePress}
              aria-label="Nhấn nút đặt hàng thông minh"
              className={`relative ${buttonCapSize} rounded-full transition-transform duration-100 active:scale-95 cursor-pointer flex flex-col items-center justify-center group outline-none ${
                activeLedState === 'off' ? 'btn-cap-idle' : ''
              }`}
              style={{
                background:
                  activeLedState === 'green'
                    ? 'radial-gradient(circle at 35% 35%, #34d399 0%, #059669 65%, #064e3b 100%)'
                    : activeLedState === 'yellow'
                    ? 'radial-gradient(circle at 35% 35%, #fbbf24 0%, #d97706 65%, #78350f 100%)'
                    : activeLedState === 'blue'
                    ? 'radial-gradient(circle at 35% 35%, #38bdf8 0%, #0284c7 65%, #082f49 100%)'
                    : activeLedState === 'red'
                    ? 'radial-gradient(circle at 35% 35%, #f87171 0%, #dc2626 65%, #7f1d1d 100%)'
                    : undefined,
                boxShadow: isPressed
                  ? 'inset 0 4px 8px rgba(0,0,0,0.6), 0 2px 4px rgba(0,0,0,0.4)'
                  : '0 12px 24px -4px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -4px 8px rgba(0,0,0,0.4)',
              }}
            >
              {/* Cap Gloss Highlight */}
              <div className="absolute top-2 w-3/4 h-1/3 rounded-full bg-gradient-to-b from-white/30 dark:from-white/20 to-transparent pointer-events-none" />

              {/* Central Glowing Icon & Prompt */}
              <div className="relative flex flex-col items-center justify-center text-white pointer-events-none px-2 text-center">
                <Radio
                  className={`${
                    size === 'sm' ? 'w-6 h-6' : 'w-10 h-10 sm:w-11 sm:h-11'
                  } text-white drop-shadow-md transition-transform group-hover:scale-105`}
                />
                <span
                  className={`${
                    size === 'sm' ? 'text-[9px]' : 'text-[11px] sm:text-xs'
                  } font-mono font-black tracking-widest uppercase mt-1.5 text-white drop-shadow`}
                >
                  {label ? label : isPressed ? 'TRANSMITTING' : 'PRESS TO ORDER'}
                </span>
                {subLabel && (
                  <span className="text-[9px] font-sans text-white/80 font-medium">
                    {subLabel}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Realtime Status Feedback Pill */}
      {!hideFeedbackFooter && (
        <div className="mt-5 flex flex-col items-center space-y-1.5 z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-[#121214] border border-slate-200/90 dark:border-zinc-800 text-xs font-mono font-semibold shadow-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                activeLedState === 'green'
                  ? 'bg-emerald-500 animate-ping'
                  : activeLedState === 'yellow'
                  ? 'bg-amber-500 animate-pulse'
                  : activeLedState === 'blue'
                  ? 'bg-cyan-500 animate-pulse'
                  : activeLedState === 'red'
                  ? 'bg-rose-500 animate-pulse'
                  : 'bg-emerald-500 dark:bg-red-500'
              }`}
            />
            <span className="text-slate-800 dark:text-zinc-200">{activeStatusText}</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 text-center">
            Nhấp chuột để mô phỏng đặt hàng thực tế qua IoT Cloud
          </p>
        </div>
      )}
    </div>
  );
};
