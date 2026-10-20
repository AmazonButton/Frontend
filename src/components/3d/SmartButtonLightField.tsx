import React from 'react';

export type ButtonLightState = 'idle' | 'press' | 'connecting' | 'success' | 'error' | 'offline';

interface SmartButtonLightFieldProps {
  state?: ButtonLightState;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const SmartButtonLightField: React.FC<SmartButtonLightFieldProps> = ({
  state = 'idle',
  className = '',
  size = 'lg',
}) => {
  const sizeMap = {
    sm: 'w-64 h-64',
    md: 'w-80 h-80',
    lg: 'w-96 h-96 sm:w-[440px] sm:h-[440px]',
  }[size];

  // Colors and glow intensity tailored strictly to section 36.4 & 36.14 (soft, diffused, subtle)
  const config = {
    idle: {
      colorLight: 'radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, rgba(6, 182, 212, 0.12) 45%, transparent 70%)',
      colorDark: 'radial-gradient(circle, rgba(239, 68, 68, 0.28) 0%, rgba(244, 63, 94, 0.14) 45%, transparent 70%)',
      opacity: 'opacity-85 dark:opacity-90',
      pulse: true,
      scale: 'scale-100',
    },
    press: {
      colorLight: 'radial-gradient(circle, rgba(37, 99, 235, 0.40) 0%, rgba(6, 182, 212, 0.22) 50%, transparent 75%)',
      colorDark: 'radial-gradient(circle, rgba(239, 68, 68, 0.45) 0%, rgba(244, 63, 94, 0.25) 50%, transparent 75%)',
      opacity: 'opacity-95 dark:opacity-95',
      pulse: false,
      scale: 'scale-105',
    },
    connecting: {
      colorLight: 'radial-gradient(circle, rgba(6, 182, 212, 0.32) 0%, rgba(37, 99, 235, 0.18) 45%, transparent 70%)',
      colorDark: 'radial-gradient(circle, rgba(244, 63, 94, 0.35) 0%, rgba(239, 68, 68, 0.22) 45%, transparent 70%)',
      opacity: 'opacity-90',
      pulse: true,
      scale: 'scale-102',
    },
    success: {
      colorLight: 'radial-gradient(circle, rgba(16, 185, 129, 0.30) 0%, rgba(6, 182, 212, 0.12) 50%, transparent 75%)',
      colorDark: 'radial-gradient(circle, rgba(16, 185, 129, 0.35) 0%, rgba(234, 179, 8, 0.15) 50%, transparent 75%)',
      opacity: 'opacity-90',
      pulse: false,
      scale: 'scale-108',
    },
    error: {
      colorLight: 'radial-gradient(circle, rgba(239, 68, 68, 0.28) 0%, rgba(185, 28, 28, 0.10) 45%, transparent 70%)',
      colorDark: 'radial-gradient(circle, rgba(239, 68, 68, 0.35) 0%, rgba(185, 28, 28, 0.15) 45%, transparent 70%)',
      opacity: 'opacity-85',
      pulse: true,
      scale: 'scale-100',
    },
    offline: {
      colorLight: 'radial-gradient(circle, rgba(148, 163, 184, 0.05) 0%, transparent 50%)',
      colorDark: 'radial-gradient(circle, rgba(148, 163, 184, 0.05) 0%, transparent 50%)',
      opacity: 'opacity-20',
      pulse: false,
      scale: 'scale-90',
    },
  }[state];

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 m-auto ${sizeMap} rounded-full pointer-events-none transition-all duration-700 ease-out blur-[65px] ${config.opacity} ${config.scale} ${
        config.pulse ? 'animate-pulse-slow' : ''
      } ${className}`}
    >
      {/* Light Mode Light Field (Blue / Cyan) */}
      <div
        className="w-full h-full rounded-full dark:hidden transition-all duration-500"
        style={{ background: config.colorLight }}
      />
      {/* Dark Mode Light Field (Gold / Amber) */}
      <div
        className="w-full h-full rounded-full hidden dark:block transition-all duration-500"
        style={{ background: config.colorDark }}
      />
    </div>
  );
};
