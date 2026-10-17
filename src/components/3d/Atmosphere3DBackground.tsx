import React from 'react';

export type AtmosphereVariant = 'hero' | 'showcase' | 'auth' | 'dashboard' | 'device-config';

interface Atmosphere3DBackgroundProps {
  variant?: AtmosphereVariant;
  interactive?: boolean;
  className?: string;
  configState?: 'idle' | 'changed' | 'saved';
}

export const Atmosphere3DBackground: React.FC<Atmosphere3DBackgroundProps> = ({
  variant = 'hero',
  className = '',
}) => {
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none -z-10 overflow-hidden transition-colors duration-500 bg-[#FBFBFC] dark:bg-[#08080A] ${className}`}
    >
      {/* 1. Signature Horizon Lighting Beams */}
      <div className="absolute -top-[140px] left-1/2 -translate-x-1/2 w-[1100px] h-[520px] rounded-full bg-gradient-to-b from-blue-500/10 via-cyan-500/5 to-transparent dark:from-sky-500/15 dark:via-blue-600/5 dark:to-transparent blur-[120px] pointer-events-none" />

      {/* 2. Secondary Ambient Breathing Auras */}
      <div className="absolute top-1/4 -right-24 w-[480px] h-[480px] rounded-full bg-cyan-400/5 dark:bg-sky-600/8 blur-[130px] pointer-events-none" />
      <div
        className="absolute bottom-10 -left-28 w-[520px] h-[520px] rounded-full bg-blue-600/4 dark:bg-indigo-950/20 blur-[140px] pointer-events-none"
      />

      {/* 3. Tactile Micro-Noise Texture */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.02] dark:opacity-[0.035] pointer-events-none mix-blend-overlay">
        <filter id="atmosphereNoise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#atmosphereNoise)" />
      </svg>
    </div>
  );
};
