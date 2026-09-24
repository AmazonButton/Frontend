import React, { useState, useRef } from 'react';

interface FptSmartButtonProps {
  onOrderTriggered?: () => void;
  className?: string;
  showCaption?: boolean;
  variant?: 'card' | 'minimal';
}

export const FptSmartButton: React.FC<FptSmartButtonProps> = ({
  onOrderTriggered,
  className = '',
  showCaption,
  variant = 'card',
}) => {
  const isMinimal = variant === 'minimal';
  const shouldShowCaption = showCaption !== undefined ? showCaption : !isMinimal;
  const [isDepressed, setIsDepressed] = useState(false);
  const [orderState, setOrderState] = useState<'idle' | 'processing' | 'success'>('idle');
  const cooldownRef = useRef(false);

  // Native Web Audio Mechanical Tactile Switch Sound (Crisp micro-switch snap)
  const playTactileClick = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(720, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.035);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch { }
  };

  // Subtle Harmonic Confirmation Chime
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.1, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.35);
      });
    } catch { }
  };

  const handleKnobPress = () => {
    if (cooldownRef.current) return;
    setIsDepressed(true);
    playTactileClick();

    setTimeout(() => {
      setIsDepressed(false);
    }, 150);

    triggerOrderFlow();
  };

  const triggerOrderFlow = () => {
    if (orderState !== 'idle') return;
    cooldownRef.current = true;
    setOrderState('processing');

    if (onOrderTriggered) {
      onOrderTriggered();
    }

    setTimeout(() => {
      setOrderState('success');
      playChime();
    }, 650);

    setTimeout(() => {
      setOrderState('idle');
      cooldownRef.current = false;
    }, 3600);
  };

  return (
    <div className={`flex flex-col items-center select-none w-full ${className}`}>
      {/* Floating Pill Enclosure with Serene Ambient Lighting */}
      <div className="relative py-4 my-2 flex items-center justify-center w-full">
        {/* Soft, Diffuse Contact Shadow under button (Floating on table effect) */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[85%] h-8 bg-slate-900/12 dark:bg-black/50 blur-2xl rounded-full pointer-events-none" />

        {/* The Physical Pill Body (Pure Satin Finish with Crisp Bezel) */}
        <div
          className={`relative ${
            isMinimal ? 'w-[260px] sm:w-[310px]' : 'w-[300px] sm:w-[370px]'
          } aspect-[788/316] rounded-full transition-all duration-300 select-none shadow-[0_20px_45px_-12px_rgba(246,96,2,0.38),0_4px_16px_rgba(0,0,0,0.06)] bg-gradient-to-r from-[#FF6305] via-[#F66002] to-[#EE5900] p-[4px] sm:p-[6px] border-[3px] sm:border-[4px] border-[#FFA036]/90`}
        >
          {/* Inner Base */}
          <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-between px-6 sm:px-8">
            {/* Left: Bold White Italic FPT Typography */}
            <div className="flex items-center select-none pl-1 sm:pl-2">
              <span className="text-white font-black italic tracking-wide text-4xl sm:text-5xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
                FPT
              </span>
            </div>

            {/* Right: Interactive 3D Circular White Knob */}
            <div className="relative flex items-center h-full">
              <button
                type="button"
                onClick={handleKnobPress}
                aria-label="Nhấn nút FPT để đặt hàng tức thì"
                className={`relative w-[74px] h-[74px] sm:w-[92px] sm:h-[92px] rounded-full cursor-pointer outline-none transition-all duration-150 flex items-center justify-center ${
                  isDepressed
                    ? 'scale-95 shadow-[inset_0_4px_8px_rgba(0,0,0,0.15)]'
                    : 'hover:scale-[1.02] active:scale-95'
                }`}
              >
                {/* Brushed Bevel Ring */}
                <div className="absolute inset-0 rounded-full border-[3px] border-[#D1D5DB] dark:border-[#9CA3AF] shadow-[0_6px_16px_rgba(0,0,0,0.18),inset_0_2px_4px_rgba(255,255,255,0.9)] bg-gradient-to-b from-[#FFFFFF] via-[#F9FAFB] to-[#E5E7EB]" />

                {/* Concave Center Surface with Micro LED */}
                <div className="relative w-full h-full rounded-full flex flex-col items-center justify-center">
                  <div
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      orderState === 'processing'
                        ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse'
                        : orderState === 'success'
                        ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.9)]'
                        : 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Minimalist Micro-Copy */}
      {shouldShowCaption && (
        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-wide mt-6 text-center">
          Nút bấm vật lý FPT • Chạm để đặt hàng tức thì
        </p>
      )}
    </div>
  );
};
