/**
 * FE Motion & UI Craft — Calibrated Framer Motion Presets (fe-motion-ui)
 * Combines Emil Kowalski (AI for UI) curves & Design Bookmark spring physics.
 */

export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

export const SPRING_SNAPPY = {
  type: 'spring' as const,
  stiffness: 460,
  damping: 34,
  mass: 0.8,
};

export const SPRING_SURFACE = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 32,
  mass: 1,
};

export const SPRING_DRAWER = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 34,
  mass: 1,
};

export const modalBackdropVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.18, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.13, ease: EASE_OUT },
  },
};

export const modalSurfaceVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: SPRING_SURFACE,
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 6,
    transition: { duration: 0.13, ease: EASE_OUT },
  },
};

export const popoverVariants = {
  hidden: { opacity: 0, scale: 0.96, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.16, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: -3,
    transition: { duration: 0.11, ease: EASE_OUT },
  },
};

export const viewSwapVariants = {
  initial: { opacity: 0, y: 5 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.19, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    y: -3,
    transition: { duration: 0.12, ease: EASE_OUT },
  },
};
