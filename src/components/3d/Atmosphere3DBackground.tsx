import React from 'react';

export type AtmosphereVariant = 'hero' | 'showcase' | 'auth' | 'dashboard' | 'device-config';

interface Atmosphere3DBackgroundProps {
  variant?: AtmosphereVariant;
  interactive?: boolean;
  className?: string;
  configState?: 'idle' | 'changed' | 'saved';
}

export const Atmosphere3DBackground: React.FC<Atmosphere3DBackgroundProps> = ({
  className = '',
}) => {
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden transition-colors duration-500 bg-[#F8FAFC] dark:bg-[#08080A] ${className}`}
    >
      {/* 1. Precision Tech Architectural Grid (Subtle Linear/Vercel Engineering Grid with Radial Vignette) */}
      <div className="absolute inset-0 bg-tech-grid mask-radial-vignette pointer-events-none" />

      {/* 2. Signature Top Horizon Lighting Beam (Vibrant Electric Indigo in Light / Cyber Crimson in Dark) */}
      <div className="absolute -top-[140px] left-1/2 -translate-x-1/2 w-[1000px] h-[500px] rounded-full bg-gradient-to-b from-blue-500/18 via-cyan-500/8 to-transparent dark:from-red-600/22 dark:via-rose-600/8 dark:to-transparent blur-[100px] pointer-events-none" />

      {/* 3. Secondary Ambient Breathing Auras for Rich Dimensional Depth */}
      {/* Right Side Aura (Warm Cyan / Rose) */}
      <div className="absolute top-1/4 -right-24 w-[480px] h-[480px] rounded-full bg-cyan-400/8 dark:bg-rose-600/10 blur-[130px] pointer-events-none animate-ambient-breathe" />

      {/* Left Bottom Aura (Deep Royal Blue / Crimson Obsidian) */}
      <div
        className="absolute bottom-10 -left-28 w-[520px] h-[520px] rounded-full bg-blue-600/6 dark:bg-red-950/25 blur-[140px] pointer-events-none animate-ambient-breathe"
        style={{ animationDelay: '-6s' }}
      />

      {/* 4. Fine Tactile Micro-Noise Texture (Eliminates OLED/LCD banding, produces luxury matte silk finish) */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.02] dark:opacity-[0.035] pointer-events-none mix-blend-overlay">
        <filter id="atmosphereNoise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#atmosphereNoise)" />
      </svg>
    </div>
  );
};

