import React, { useEffect, useRef } from 'react';
import { MotionConfig, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

/** Animate presentation without remounting pages, restarting requests or moving fixed dialogs. */
export const CustomerPageMotion: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const { pathname, search } = useLocation();
  const reduceMotion = useReducedMotion();
  const profileTab = pathname === '/customer/profile' || pathname === '/profile'
    ? new URLSearchParams(search).get('tab') || 'INFO'
    : '';

  useEffect(() => {
    const content = contentRef.current;
    if (!content || reduceMotion) return;

    // Animate only each screen's in-flow sections. Checkout, notifications and
    // fixed dialogs stay outside these surfaces, retaining their stacking order.
    const animations = Array.from(content.querySelectorAll<HTMLElement>('[data-page-motion]'))
      .filter((section) => typeof section.animate === 'function')
      .map((section, index) => section.animate(
        [{ opacity: 0.78 }, { opacity: 1 }],
        { duration: 220, delay: Math.min(index * 30, 90), easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      ));
    return () => animations.forEach((animation) => animation.cancel());
  }, [pathname, profileTab, reduceMotion]);

  return (
    <MotionConfig reducedMotion="user">
      <div ref={contentRef} className="customer-page-motion min-w-0 w-full">
        {children}
      </div>
    </MotionConfig>
  );
};
