import React from 'react';

export type AtmosphereVariant = 'hero' | 'showcase' | 'auth' | 'dashboard' | 'device-config';

interface Atmosphere3DBackgroundProps {
  variant?: AtmosphereVariant;
  interactive?: boolean;
  className?: string;
  configState?: 'idle' | 'changed' | 'saved';
}

export const Atmosphere3DBackground: React.FC<Atmosphere3DBackgroundProps> = React.memo(({
  className = '',
}) => {
  return (
    <div
      aria-hidden="true"
      style={{ contain: 'strict' }}
      className={`fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[#FBFBFC] dark:bg-[#08080A] ${className}`}
    >
      {/* Pure radial CSS gradients replace heavy blur-[140px] + SVG feTurbulence filters for 60fps scrolling */}
      <div
        className="absolute inset-0 pointer-events-none opacity-90 dark:hidden"
        style={{
          background:
            'radial-gradient(620px 320px at 50% -40px, rgba(59,130,246,0.08), rgba(6,182,212,0.03) 50%, transparent 75%), radial-gradient(360px 360px at 96% 32%, rgba(34,211,238,0.05), transparent 70%), radial-gradient(380px 380px at 4% 88%, rgba(37,99,235,0.04), transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none hidden dark:block"
        style={{
          background:
            'radial-gradient(620px 320px at 50% -40px, rgba(14,165,233,0.12), rgba(37,99,235,0.04) 50%, transparent 75%), radial-gradient(360px 360px at 96% 32%, rgba(2,132,199,0.07), transparent 70%), radial-gradient(380px 380px at 4% 88%, rgba(30,27,75,0.18), transparent 70%)',
        }}
      />
    </div>
  );
});
