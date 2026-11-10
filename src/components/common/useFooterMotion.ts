import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import './footer-motion.css';

/** Reveal footer sections without hiding links, changing layout or remounting content. */
export function useFooterMotion() {
  const footerRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer || reduceMotion || typeof IntersectionObserver === 'undefined') return;

    const sections = Array.from(footer.querySelectorAll<HTMLElement>('[data-footer-motion]'));
    const animations = new Map<HTMLElement, Animation>();
    const seen = new Set<HTMLElement>();
    let disposed = false;

    const observer = new IntersectionObserver((entries) => {
      if (disposed) return;
      entries.forEach((entry) => {
        const section = entry.target as HTMLElement;
        if (!entry.isIntersecting || seen.has(section)) return;
        seen.add(section);
        observer.unobserve(section);
        // A keyboard user reaching a link should not have its focus target move.
        if (section.contains(document.activeElement) || typeof section.animate !== 'function') return;
        const index = sections.indexOf(section);
        animations.set(section, section.animate(
          [{ opacity: 0.78, transform: 'translate3d(0, 8px, 0)' }, { opacity: 1, transform: 'translate3d(0, 0, 0)' }],
          { duration: 360, delay: Math.min(index * 40, 120), easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        ));
      });
    }, { threshold: 0 });

    const stopFocusedSection = (event: FocusEvent) => {
      if (!(event.target instanceof Node)) return;
      sections.forEach((section) => {
        if (section.contains(event.target as Node)) {
          seen.add(section);
          observer.unobserve(section);
          animations.get(section)?.cancel();
          animations.delete(section);
        }
      });
    };
    sections.forEach((section) => observer.observe(section));
    footer.addEventListener('focusin', stopFocusedSection);

    return () => {
      disposed = true;
      observer.disconnect();
      footer.removeEventListener('focusin', stopFocusedSection);
      animations.forEach((animation) => animation.cancel());
    };
  }, [pathname, reduceMotion]);

  return footerRef;
}
