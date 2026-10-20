import React, { useEffect, useRef } from 'react';

interface Point3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
}

export const Ambient3DBackground: React.FC<{
  particleCount?: number;
  interactive?: boolean;
}> = ({ particleCount = 38, interactive = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = (e.clientX - width / 2) * 0.3;
      mouseRef.current.targetY = (e.clientY - height / 2) * 0.3;
    };

    window.addEventListener('resize', handleResize);
    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    // Initialize 3D points
    const points: Point3D[] = [];
    const colors = [
      'rgba(37, 99, 235, 0.45)', // Brand blue
      'rgba(6, 182, 212, 0.45)', // Tech cyan
      'rgba(99, 102, 241, 0.35)', // Indigo
      'rgba(16, 185, 129, 0.35)', // Emerald
    ];

    for (let i = 0; i < particleCount; i++) {
      points.push({
        x: (Math.random() - 0.5) * width * 1.5,
        y: (Math.random() - 0.5) * height * 1.5,
        z: Math.random() * 800 + 200,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: (Math.random() - 0.5) * 0.6,
        size: Math.random() * 2.5 + 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const fov = 450;

    const render = () => {
      // Smooth mouse damping
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // Draw subtle connections between nearby nodes
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];

        // Move
        p1.x += p1.vx;
        p1.y += p1.vy;
        p1.z += p1.vz;

        // Wrap boundaries in 3D
        if (p1.z < 100) p1.z = 1000;
        if (p1.z > 1000) p1.z = 100;
        if (p1.x < -width) p1.x = width;
        if (p1.x > width) p1.x = -width;
        if (p1.y < -height) p1.y = height;
        if (p1.y > height) p1.y = -height;

        // 3D Perspective Projection
        const scale = fov / (fov + p1.z);
        const projX = (p1.x + mouseRef.current.x * 0.4) * scale + width / 2;
        const projY = (p1.y + mouseRef.current.y * 0.4) * scale + height / 2;

        // Connect lines to nearby points
        for (let j = i + 1; j < points.length; j++) {
          const p2 = points[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
          if (dist < 180) {
            const scale2 = fov / (fov + p2.z);
            const p2X = (p2.x + mouseRef.current.x * 0.4) * scale2 + width / 2;
            const p2Y = (p2.y + mouseRef.current.y * 0.4) * scale2 + height / 2;

            const alpha = (1 - dist / 180) * 0.18 * scale;
            ctx.beginPath();
            ctx.moveTo(projX, projY);
            ctx.lineTo(p2X, p2Y);
            ctx.strokeStyle = `rgba(6, 182, 212, ${alpha})`;
            ctx.lineWidth = 0.8 * scale;
            ctx.stroke();
          }
        }

        // Draw 3D glowing point
        const radius = p1.size * scale;
        ctx.beginPath();
        ctx.arc(projX, projY, Math.max(1, radius), 0, Math.PI * 2);
        ctx.fillStyle = p1.color;
        ctx.fill();

        // Extra soft halo for closest points
        if (scale > 0.6) {
          ctx.beginPath();
          ctx.arc(projX, projY, radius * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = p1.color.replace('0.45', '0.08').replace('0.35', '0.06');
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      cancelAnimationFrame(animationFrameId);
    };
  }, [particleCount, interactive]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 opacity-85 dark:opacity-75 transition-opacity duration-300"
    />
  );
};
