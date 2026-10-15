import React, { useEffect, useMemo } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface HeroBackgroundProps {
  className?: string;
  patternType?: 'grid' | 'dots';
}

interface ParticleNode {
  id: number;
  top: string;
  left: string;
  type: 'dot' | 'ring' | 'diamond' | 'cross';
  size: number;
  depth: number; // Multiplier for parallax depth (0.6x - 1.4x)
  colorClass: string;
}

/**
 * Creative Interactive 3D Parallax Background
 * Hand-crafted with Framer Motion, Tailwind CSS & SVG
 * Architecture:
 * - 3D Perspective Context: 1200px
 * - Layer 1 (Far): Ambient mesh glows moving inverted to mouse
 * - Layer 2 (Mid): 3D skewed grid plane tilting dynamically in 3D
 * - Layer 3 (Foreground): Micro-particles & geometric wireframes floating with varied depth
 * - Bottom Fade: 200px smooth gradient mask into next section
 */
export const HeroBackground: React.FC<HeroBackgroundProps> = ({
  className = '',
  patternType = 'grid',
}) => {
  // 1. Mouse coordinates normalized to [-0.5, 0.5] from screen center
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // 2. Spring smoothing with damping = 30 (prevents harsh jerky stops)
  const springConfig = { damping: 30, stiffness: 160, mass: 0.75 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // 3. Parallax Transforms per Depth Layer
  // Layer 1: Ambient Glow (Inverted, very subtle 6-10px)
  const glowX = useTransform(smoothX, [-0.5, 0.5], [10, -10]);
  const glowY = useTransform(smoothY, [-0.5, 0.5], [8, -8]);

  // Layer 2: 3D Skewed Grid (Translates & tilts in 3D perspective)
  const gridX = useTransform(smoothX, [-0.5, 0.5], [-12, 12]);
  const gridY = useTransform(smoothY, [-0.5, 0.5], [-8, 8]);
  const gridRotateX = useTransform(smoothY, [-0.5, 0.5], [58.5, 61.5]); // Base 60deg +/- 1.5deg
  const gridRotateY = useTransform(smoothX, [-0.5, 0.5], [-2, 2]);

  // Layer 3: Foreground particles (Translates forward with mouse 18-28px)
  const fgX = useTransform(smoothX, [-0.5, 0.5], [-26, 26]);
  const fgY = useTransform(smoothY, [-0.5, 0.5], [-20, 20]);

  // Global mouse move listener on window
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = e.clientX / innerWidth - 0.5;
      const y = e.clientY / innerHeight - 0.5;
      mouseX.set(x);
      mouseY.set(y);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  // Curated, hand-crafted aesthetic foreground nodes (memoized to avoid re-renders)
  const particles: ParticleNode[] = useMemo(
    () => [
      // Top Left Area
      { id: 1, top: '16%', left: '8%', type: 'dot', size: 6, depth: 0.7, colorClass: 'bg-blue-400/40 dark:bg-sky-400/50' },
      { id: 2, top: '24%', left: '14%', type: 'ring', size: 22, depth: 1.2, colorClass: 'border-blue-500/25 dark:border-sky-400/30' },
      { id: 3, top: '12%', left: '26%', type: 'cross', size: 12, depth: 0.85, colorClass: 'text-slate-300 dark:text-zinc-600' },

      // Center Upper Orbit
      { id: 4, top: '18%', left: '48%', type: 'diamond', size: 10, depth: 0.6, colorClass: 'border-slate-300 dark:border-zinc-700' },
      { id: 5, top: '28%', left: '52%', type: 'dot', size: 5, depth: 1.1, colorClass: 'bg-orange-400/40 dark:bg-orange-400/50' },

      // Right / Behind & Above Button
      { id: 6, top: '14%', left: '82%', type: 'ring', size: 30, depth: 1.35, colorClass: 'border-orange-500/25 dark:border-orange-400/30' },
      { id: 7, top: '22%', left: '92%', type: 'dot', size: 7, depth: 0.8, colorClass: 'bg-orange-500/35 dark:bg-orange-400/45' },
      { id: 8, top: '38%', left: '88%', type: 'diamond', size: 12, depth: 1.15, colorClass: 'border-orange-400/30 dark:border-orange-400/40' },
      { id: 9, top: '46%', left: '96%', type: 'dot', size: 4, depth: 0.65, colorClass: 'bg-sky-400/35 dark:bg-sky-400/45' },

      // Lower Left Margins
      { id: 10, top: '68%', left: '6%', type: 'ring', size: 18, depth: 0.9, colorClass: 'border-blue-400/25 dark:border-blue-400/30' },
      { id: 11, top: '78%', left: '16%', type: 'cross', size: 14, depth: 1.25, colorClass: 'text-blue-300/40 dark:text-blue-400/40' },
      { id: 12, top: '84%', left: '28%', type: 'dot', size: 5, depth: 0.75, colorClass: 'bg-slate-400/30 dark:bg-zinc-600/40' },

      // Lower Right Margins
      { id: 13, top: '72%', left: '76%', type: 'dot', size: 8, depth: 1.3, colorClass: 'bg-orange-400/35 dark:bg-orange-400/45' },
      { id: 14, top: '82%', left: '84%', type: 'ring', size: 24, depth: 0.95, colorClass: 'border-slate-300/40 dark:border-zinc-700/50' },
      { id: 15, top: '88%', left: '64%', type: 'diamond', size: 10, depth: 1.05, colorClass: 'border-blue-400/25 dark:border-sky-400/30' },
    ],
    []
  );

  return (
    <div
      aria-hidden="true"
      style={{ perspective: 1200 }}
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none bg-white dark:bg-[#09090B] -z-10 ${className}`}
    >
      {/* ========================================================================= */}
      {/* LAYER 1: FAR BACKGROUND (Ambient Mesh Glows - Moves Inverted to Mouse)    */}
      {/* ========================================================================= */}
      <motion.div
        style={{
          x: glowX,
          y: glowY,
          transformStyle: 'preserve-3d',
        }}
        className="absolute inset-0 pointer-events-none will-change-transform z-0"
      >
        {/* Top-Left Tech Primary Blue Glow */}
        <div className="absolute -top-24 -left-20 w-[540px] h-[540px] sm:w-[650px] sm:h-[650px] rounded-full bg-blue-500/12 dark:bg-blue-600/15 blur-[120px] pointer-events-none" />

        {/* Right / Behind Button Showcase: Tone-sur-tone FPT Warm Orange Glow */}
        <div className="absolute top-1/4 -right-16 w-[560px] h-[560px] sm:w-[680px] sm:h-[680px] rounded-full bg-orange-500/15 dark:bg-orange-500/18 blur-[130px] pointer-events-none" />

        {/* Center Top Ambient Sky Highlight */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[760px] h-[360px] rounded-full bg-sky-400/8 dark:bg-sky-500/10 blur-[110px] pointer-events-none" />
      </motion.div>

      {/* ========================================================================= */}
      {/* LAYER 2: MIDGROUND (3D Skewed Grid Plane - rotateX(60deg) rotateZ(-10deg) */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 flex items-end justify-center pointer-events-none z-10 overflow-hidden">
        <motion.div
          style={{
            x: gridX,
            y: gridY,
            rotateX: gridRotateX,
            rotateY: gridRotateY,
            rotateZ: -10,
            transformStyle: 'preserve-3d',
            transformOrigin: 'bottom center',
          }}
          className="w-[160vw] h-[95vh] -mb-[12vh] will-change-transform relative opacity-70 dark:opacity-55"
        >
          {/* Subtle SVG 3D Grid with Radial Depth Mask */}
          <svg
            className="w-full h-full stroke-slate-200/60 dark:stroke-zinc-800/70 [mask-image:radial-gradient(ellipse_at_bottom,white_30%,transparent_85%)]"
            aria-hidden="true"
          >
            <defs>
              {/* Primary 48x48 Orthogonal Grid */}
              <pattern
                id="hero-3d-grid-pattern"
                width={48}
                height={48}
                patternUnits="userSpaceOnUse"
              >
                <path d="M 48 0 L 0 0 0 48" fill="none" strokeWidth={1} />
                {/* Subtle Intersection Micro-Dots */}
                <circle cx={48} cy={48} r={1.5} className="fill-slate-300 dark:fill-zinc-700" />
              </pattern>
            </defs>

            <rect width="100%" height="100%" fill="url(#hero-3d-grid-pattern)" />
          </svg>
        </motion.div>
      </div>

      {/* ========================================================================= */}
      {/* LAYER 3: FOREGROUND (Interactive Particles & Delicate Wireframe Nodes)    */}
      {/* ========================================================================= */}
      <motion.div
        style={{
          x: fgX,
          y: fgY,
          transformStyle: 'preserve-3d',
        }}
        className="absolute inset-0 pointer-events-none will-change-transform z-20"
      >
        {particles.map((node) => (
          <div
            key={node.id}
            style={{
              top: node.top,
              left: node.left,
              transform: `translate3d(0, 0, ${node.depth * 30}px) scale(${0.85 + node.depth * 0.2})`,
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
          >
            {/* Type A: Micro Glowing Dot */}
            {node.type === 'dot' && (
              <div
                style={{ width: `${node.size}px`, height: `${node.size}px` }}
                className={`rounded-full ${node.colorClass} shadow-xs`}
              />
            )}

            {/* Type B: Delicate Wireframe Ring */}
            {node.type === 'ring' && (
              <div
                style={{ width: `${node.size}px`, height: `${node.size}px` }}
                className={`rounded-full border ${node.colorClass} bg-white/5 dark:bg-white/2 backdrop-blur-[0.5px]`}
              />
            )}

            {/* Type C: 3D Skewed Diamond */}
            {node.type === 'diamond' && (
              <div
                style={{ width: `${node.size}px`, height: `${node.size}px` }}
                className={`rotate-45 border ${node.colorClass}`}
              />
            )}

            {/* Type D: Minimalist Crosshair (+) */}
            {node.type === 'cross' && (
              <svg
                width={node.size}
                height={node.size}
                viewBox="0 0 12 12"
                fill="none"
                className={node.colorClass}
              >
                <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            )}
          </div>
        ))}
      </motion.div>

      {/* ========================================================================= */}
      {/* 4. SEAMLESS BOTTOM FADE OUT (Smooth transition to following section)      */}
      {/* ========================================================================= */}
      <div className="absolute bottom-0 left-0 right-0 h-48 sm:h-56 bg-gradient-to-b from-transparent via-white/80 to-white dark:via-[#09090B]/80 dark:to-[#09090B] pointer-events-none z-30" />
    </div>
  );
};
