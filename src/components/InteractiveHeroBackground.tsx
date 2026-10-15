import React, { useEffect, useMemo } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

/**
 * InteractiveHeroBackground — High-Fidelity Responsive 3D Parallax Background
 * ───────────────────────────────────────────────────────────────────────────
 * Preserves the exact refined color palette while delivering clear, responsive
 * interactive 3D motion tracking:
 *
 * 1. Responsive Spring Physics:
 *    • stiffness: 85, damping: 20, mass: 0.45
 *    • Follows mouse immediately with organic physical trail
 *
 * 2. True Dynamic 3D Plane Tilt:
 *    • Pitch rotateX: 62°..74° (steepens/flattens based on vertical cursor)
 *    • Roll rotateZ: -17°..-7° (banks with horizontal cursor)
 *    • Yaw rotateY: -9°..9° (turns toward cursor)
 *    • Translation: ±50px X, ±35px Y, ±35px Z
 *
 * 3. Interactive Cursor Spotlight Aura:
 *    • Soft pool of ambient light (±160px X, ±120px Y) following cursor
 *
 * 4. High Parallax Depth Separation:
 *    • Mesh moves inverted (+50px) while foreground particles move forward (-85px)
 *    • Net 135px multi-tier parallax displacement
 */

interface ParticleItem {
  id: number;
  x: string;
  y: string;
  type: 'far-dot' | 'mid-bokeh' | 'near-bokeh' | 'wireframe-diamond' | 'ring' | 'cross';
  size: number;
  blur?: number;
  opacity: number;
  duration: number;
  delay: number;
  rotateSpeed?: number;
}

export const InteractiveHeroBackground: React.FC<{ className?: string }> = ({
  className = '',
}) => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Z-PERSPECTIVE & RESPONSIVE MOUSE SPRING PHYSICS
  // ═══════════════════════════════════════════════════════════════════════════
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Responsive spring with organic damping (active tracking)
  const springCfg = { stiffness: 85, damping: 20, mass: 0.45 };
  const sx = useSpring(mouseX, springCfg);
  const sy = useSpring(mouseY, springCfg);

  // Layer 1 (Ambient Glows): Inverted translation
  const glowX = useTransform(sx, [-0.5, 0.5], [40, -40]);
  const glowY = useTransform(sy, [-0.5, 0.5], [30, -30]);

  // Dynamic Cursor Spotlight: Follows mouse position across screen
  const spotX = useTransform(sx, [-0.5, 0.5], [-160, 160]);
  const spotY = useTransform(sy, [-0.5, 0.5], [-120, 120]);

  // Layer 2 (3D Topo Mesh): Active 3D tilt & translation
  const gridX = useTransform(sx, [-0.5, 0.5], [50, -50]);
  const gridY = useTransform(sy, [-0.5, 0.5], [35, -35]);
  const gridRotateX = useTransform(sy, [-0.5, 0.5], [62, 74]); // Pitch: 68° ± 6°
  const gridRotateZ = useTransform(sx, [-0.5, 0.5], [-17, -7]); // Roll: -12° ± 5°
  const gridRotateY = useTransform(sx, [-0.5, 0.5], [-9, 9]);   // Yaw: ± 9°
  const gridZ = useTransform(sy, [-0.5, 0.5], [35, -35]);       // Depth: ± 35px

  // Layer 3 (Foreground Bokeh): Forward drift for high-depth parallax
  const partX = useTransform(sx, [-0.5, 0.5], [-85, 85]);
  const partY = useTransform(sy, [-0.5, 0.5], [-75, 75]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      // Normalize from -0.5 to 0.5 relative to screen center
      mouseX.set(e.clientX / window.innerWidth - 0.5);
      mouseY.set(e.clientY / window.innerHeight - 0.5);
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMove);
  }, [mouseX, mouseY]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. LAYER 2: TOPOLOGICAL 3D PERSPECTIVE MESH GENERATION
  // ═══════════════════════════════════════════════════════════════════════════
  const { horizontalCurves, verticalCurves } = useMemo(() => {
    const ROWS = 28;
    const COLS = 30;
    const W = 1600;
    const H = 1050;

    const points: { x: number; y: number }[][] = [];

    for (let r = 0; r <= ROWS; r++) {
      points[r] = [];

      // Non-linear vertical progression: perspective row spacing
      const normalizedRow = r / ROWS;
      const v = Math.pow(normalizedRow, 1.45);
      const baseY = v * H;

      // Perspective fan width (converging to horizon)
      const fovWidth = 0.82 + 0.38 * v;

      for (let c = 0; c <= COLS; c++) {
        const u = c / COLS;
        const baseX = W * 0.5 + (u - 0.5) * W * fovWidth;

        // Topographic wave elevation math
        const diag = u * 2.0 - v * 2.4;
        const elevation =
          Math.sin(diag * Math.PI * 2.2) * (26 + v * 48) +
          Math.cos(u * Math.PI * 2.8 + v * 2.0) * (18 + v * 32) +
          Math.sin(u * 5.8 - v * 4.0) * 14;

        const lateralDisplacement =
          Math.cos(diag * Math.PI * 2.0) * (16 + v * 24) +
          Math.sin(v * Math.PI * 2.5) * 12;

        points[r][c] = {
          x: Number((baseX + lateralDisplacement).toFixed(1)),
          y: Number((baseY + elevation).toFixed(1)),
        };
      }
    }

    // Bezier spline builder for organic topographic lines
    const createSpline = (pts: { x: number; y: number }[]) => {
      if (pts.length < 2) return '';
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const mx = ((p1.x + p2.x) / 2).toFixed(1);
        const my = ((p1.y + p2.y) / 2).toFixed(1);
        d += ` Q ${p1.x} ${p1.y} ${mx} ${my}`;
      }
      d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
      return d;
    };

    // Horizontal curves: soft light-blue hairline opacity from 0.16 (far) to 0.32 (near)
    const hCurves = [];
    for (let r = 0; r <= ROWS; r++) {
      const depthFactor = r / ROWS;
      const opacity = Number((0.16 + depthFactor * 0.16).toFixed(2));
      hCurves.push({
        d: createSpline(points[r]),
        opacity,
      });
    }

    // Vertical curves: softened to 0.22 opacity for minimal text interference
    const vCurves = [];
    for (let c = 0; c <= COLS; c++) {
      const colPts: { x: number; y: number }[] = [];
      for (let r = 0; r <= ROWS; r++) {
        colPts.push(points[r][c]);
      }
      vCurves.push({
        d: createSpline(colPts),
        opacity: 0.22,
      });
    }

    return { horizontalCurves: hCurves, verticalCurves: vCurves };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. LAYER 3: FOREGROUND BOKEH & TECHNICAL WIREFRAME NODES (SUBTLE ACCENTS)
  // ═══════════════════════════════════════════════════════════════════════════
  const particles: ParticleItem[] = useMemo(
    () => [
      // ── Far distance particles ──────────────────────────────────────────
      { id: 1,  x: '9%',  y: '14%', type: 'far-dot', size: 3, opacity: 0.15, duration: 4.4, delay: 0.1 },
      { id: 2,  x: '22%', y: '18%', type: 'far-dot', size: 2, opacity: 0.14, duration: 3.8, delay: 1.2 },
      { id: 3,  x: '75%', y: '15%', type: 'far-dot', size: 3, opacity: 0.15, duration: 4.8, delay: 0.4 },
      { id: 4,  x: '86%', y: '28%', type: 'far-dot', size: 2, opacity: 0.14, duration: 4.0, delay: 1.6 },
      { id: 5,  x: '40%', y: '84%', type: 'far-dot', size: 3, opacity: 0.14, duration: 4.2, delay: 2.1 },

      // ── Mid bokeh particles (soft glowing circles) ──────────────────────
      { id: 6,  x: '7%',  y: '34%', type: 'mid-bokeh', size: 8, blur: 2, opacity: 0.20, duration: 5.2, delay: 0.6 },
      { id: 7,  x: '16%', y: '48%', type: 'mid-bokeh', size: 7, blur: 2, opacity: 0.18, duration: 4.6, delay: 1.8 },
      { id: 8,  x: '70%', y: '26%', type: 'mid-bokeh', size: 9, blur: 2, opacity: 0.22, duration: 5.5, delay: 0.8 },
      { id: 9,  x: '82%', y: '46%', type: 'mid-bokeh', size: 8, blur: 2, opacity: 0.20, duration: 4.5, delay: 1.4 },
      { id: 10, x: '91%', y: '64%', type: 'mid-bokeh', size: 7, blur: 2, opacity: 0.18, duration: 5.0, delay: 0.3 },

      // ── Near camera bokeh (dreamy lens halos) ───────────────────────────
      { id: 11, x: '14%', y: '22%', type: 'near-bokeh', size: 22, blur: 3, opacity: 0.20, duration: 6.0, delay: 0.2 },
      { id: 12, x: '88%', y: '36%', type: 'near-bokeh', size: 24, blur: 3, opacity: 0.22, duration: 6.5, delay: 1.1 },
      { id: 13, x: '76%', y: '68%', type: 'near-bokeh', size: 18, blur: 3, opacity: 0.18, duration: 5.8, delay: 2.0 },

      // ── Wireframe tech diamonds ─────────────────────────────────────────
      { id: 14, x: '18%', y: '65%', type: 'wireframe-diamond', size: 13, opacity: 0.16, duration: 6.2, delay: 0.7, rotateSpeed: 24 },
      { id: 15, x: '84%', y: '20%', type: 'wireframe-diamond', size: 15, opacity: 0.18, duration: 7.2, delay: 1.3, rotateSpeed: 30 },
      { id: 16, x: '93%', y: '78%', type: 'wireframe-diamond', size: 11, opacity: 0.15, duration: 6.0, delay: 2.4, rotateSpeed: 20 },

      // ── Rings & Crosshairs ──────────────────────────────────────────────
      { id: 17, x: '24%', y: '75%', type: 'ring',  size: 20, opacity: 0.14, duration: 5.4, delay: 1.5 },
      { id: 18, x: '80%', y: '56%', type: 'ring',  size: 24, opacity: 0.14, duration: 6.4, delay: 0.9 },
      { id: 19, x: '8%',  y: '70%', type: 'cross', size: 10, opacity: 0.16, duration: 4.8, delay: 0.5 },
      { id: 20, x: '68%', y: '84%', type: 'cross', size: 11, opacity: 0.15, duration: 5.2, delay: 1.9 },
    ],
    []
  );

  return (
    <div
      aria-hidden="true"
      style={{ perspective: '1200px' }}
      className={`absolute inset-0 overflow-hidden pointer-events-none select-none -z-10 ${className}`}
    >
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* LAYER 1: AMBIENT GLOWS & MOUSE-TRACKING SPOTLIGHT (z-10)               */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        style={{ x: glowX, y: glowY }}
        className="absolute inset-0 will-change-transform z-10"
      >
        {/* Deep Ocean Blue Glow (Left) — 900x900 blur-130px */}
        <div
          className="absolute rounded-full"
          style={{
            width: 900,
            height: 900,
            top: '-12%',
            left: '-15%',
            background:
              'radial-gradient(circle, rgba(30,110,245,0.38) 0%, rgba(59,130,246,0.22) 35%, rgba(99,102,241,0.10) 55%, transparent 75%)',
            filter: 'blur(130px)',
          }}
        />

        {/* Fiery Sunset Orange/Amber Glow (Right) — 800x800 blur-120px */}
        <div
          className="absolute rounded-full"
          style={{
            width: 800,
            height: 800,
            top: '6%',
            right: '-10%',
            background:
              'radial-gradient(circle, rgba(255,95,21,0.40) 0%, rgba(249,115,22,0.24) 35%, rgba(245,158,11,0.10) 55%, transparent 75%)',
            filter: 'blur(120px)',
          }}
        />

        {/* Horizon Center Ambient Aura */}
        <div
          className="absolute rounded-full"
          style={{
            width: 950,
            height: 400,
            top: '-15%',
            left: '50%',
            transform: 'translateX(-50%)',
            background:
              'radial-gradient(ellipse, rgba(14,165,233,0.22) 0%, rgba(99,102,241,0.12) 40%, transparent 70%)',
            filter: 'blur(90px)',
          }}
        />

        {/* Subtle stardust micro-points */}
        <div
          className="absolute inset-0 opacity-15 dark:opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 40%, rgba(56,189,248,0.18) 0, transparent 3px), radial-gradient(circle at 86% 60%, rgba(251,146,60,0.18) 0, transparent 3px)',
            backgroundSize: '160px 160px',
          }}
        />
      </motion.div>

      {/* Interactive Cursor Spotlight Aura — Follows mouse smoothly across the hero */}
      <motion.div
        style={{ x: spotX, y: spotY }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none z-10 will-change-transform"
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(56,189,248,0.20) 0%, rgba(99,102,241,0.10) 40%, transparent 70%)',
            filter: 'blur(90px)',
          }}
        />
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* LAYER 2: 3D TOPOLOGICAL MESH WITH DYNAMIC ROTATION & TILT (z-20)       */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        style={{
          x: gridX,
          y: gridY,
          rotateX: gridRotateX,
          rotateY: gridRotateY,
          rotateZ: gridRotateZ,
          z: gridZ,
        }}
        className="absolute inset-0 will-change-transform z-20 flex items-end justify-center"
      >
        <div
          style={{
            transform: 'translateY(22%) scale(1.4)',
            transformOrigin: 'bottom left',
          }}
          className="w-[195vw] h-[110vh] -ml-[25vw] will-change-transform"
        >
          <svg
            viewBox="0 0 1600 1050"
            className="w-full h-full"
            style={{
              maskImage:
                'radial-gradient(ellipse at 50% 50%, black 50%, transparent 90%)',
              WebkitMaskImage:
                'radial-gradient(ellipse at 50% 50%, black 50%, transparent 90%)',
            }}
            fill="none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* Horizontal topographical curves — soft light-blue / slate hairline */}
            {horizontalCurves.map((curve, idx) => (
              <path
                key={`h-${idx}`}
                d={curve.d}
                stroke="currentColor"
                strokeWidth="0.7"
                style={{ opacity: curve.opacity }}
                className="text-sky-200/40 dark:text-sky-500/25"
              />
            ))}

            {/* Vertical topographical curves — softened pastel light-blue */}
            {verticalCurves.map((curve, idx) => (
              <path
                key={`v-${idx}`}
                d={curve.d}
                stroke="currentColor"
                strokeWidth="0.75"
                style={{ opacity: curve.opacity }}
                className="text-sky-300/45 dark:text-sky-400/30"
              />
            ))}
          </svg>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* LAYER 3: FOREGROUND PARTICLES WITH FORWARD PARALLAX (z-30)              */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <motion.div
        style={{ x: partX, y: partY }}
        className="absolute inset-0 will-change-transform z-30"
      >
        {particles.map((p) => {
          const floatTransition = {
            y: {
              duration: p.duration,
              repeat: Infinity,
              repeatType: 'mirror' as const,
              ease: 'easeInOut' as const,
              delay: p.delay,
            },
          };

          return (
            <div
              key={p.id}
              className="absolute"
              style={{ left: p.x, top: p.y }}
            >
              {p.type === 'far-dot' && (
                <motion.div
                  animate={{ y: [0, -18, 0] }}
                  transition={floatTransition}
                  style={{
                    width: p.size,
                    height: p.size,
                    opacity: p.opacity,
                  }}
                  className="rounded-full bg-slate-400 dark:bg-zinc-400"
                />
              )}

              {p.type === 'mid-bokeh' && (
                <motion.div
                  animate={{ y: [0, -18, 0] }}
                  transition={floatTransition}
                  style={{
                    width: p.size,
                    height: p.size,
                    opacity: p.opacity,
                    filter: `blur(${p.blur || 2}px)`,
                  }}
                  className="rounded-full bg-sky-400 dark:bg-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.4)]"
                />
              )}

              {p.type === 'near-bokeh' && (
                <motion.div
                  animate={{ y: [0, -18, 0] }}
                  transition={floatTransition}
                  style={{
                    width: p.size,
                    height: p.size,
                    opacity: p.opacity,
                    filter: `blur(${p.blur || 3}px)`,
                  }}
                  className="rounded-full bg-blue-300 dark:bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.5)]"
                />
              )}

              {p.type === 'wireframe-diamond' && (
                <motion.div
                  animate={{
                    y: [0, -18, 0],
                    rotate: [45, 405],
                  }}
                  transition={{
                    y: floatTransition.y,
                    rotate: {
                      duration: p.rotateSpeed || 30,
                      repeat: Infinity,
                      ease: 'linear' as const,
                    },
                  }}
                  style={{
                    width: p.size,
                    height: p.size,
                    opacity: p.opacity,
                  }}
                  className="border border-slate-300/40 dark:border-zinc-500/40"
                />
              )}

              {p.type === 'ring' && (
                <motion.div
                  animate={{ y: [0, -18, 0] }}
                  transition={floatTransition}
                  style={{
                    width: p.size,
                    height: p.size,
                    opacity: p.opacity,
                  }}
                  className="rounded-full border border-sky-300/40 dark:border-sky-500/35"
                />
              )}

              {p.type === 'cross' && (
                <motion.svg
                  animate={{ y: [0, -18, 0] }}
                  transition={floatTransition}
                  width={p.size}
                  height={p.size}
                  viewBox="0 0 12 12"
                  fill="none"
                  style={{ opacity: p.opacity }}
                  className="text-slate-400/50 dark:text-zinc-500/50"
                >
                  <path
                    d="M6 1v10M1 6h10"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                  />
                </motion.svg>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* LAYER 4: TRANSITION GRADIENT (z-40 - STATIC)                          */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div
        className="absolute bottom-0 left-0 w-full h-[300px] z-40 pointer-events-none"
        style={{
          background:
            'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.85) 45%, rgba(255,255,255,0) 100%)',
        }}
      />
    </div>
  );
};
