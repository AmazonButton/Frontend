import { useEffect, useLayoutEffect } from 'react';

/**
 * Universal Body Scroll & Header Layering Manager
 * 
 * Guarantees:
 * 1. Whenever any popup/modal is open, scrolling the wheel outside will NEVER move the page underneath.
 * 2. The topbar header is forced UNDERNEATH the modal backdrop (z-index: 0, pointer-events: none)
 *    so it never pokes through or sticks out on top of the backdrop.
 * 3. Reference counting for nested or multiple simultaneous modals.
 * 4. Automatic layout padding compensation to prevent horizontal scrollbar jump.
 * 5. Automatic MutationObserver detection for all current and future modals across the entire app.
 */

let lockCount = 0;
let originalOverflow = '';
let originalPaddingRight = '';
let isWindowListenerAttached = false;

// Intercept wheel/touch outside scrollable modal containers
const handleBackdropScroll = (e: WheelEvent | TouchEvent) => {
  if (lockCount <= 0) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  // Allow scrolling only inside containers explicitly designated as scrollable
  const scrollableParent = target.closest(
    '.overflow-y-auto, .overflow-auto, [data-scrollable="true"], [data-scrollable="modal"]'
  );

  if (!scrollableParent) {
    if (e.cancelable) {
      e.preventDefault();
    }
  }
};

const setHeaderUnderneath = (underneath: boolean) => {
  const header = document.querySelector('header, [data-navbar="true"]') as HTMLElement | null;
  if (header) {
    if (underneath) {
      header.style.setProperty('z-index', '0', 'important');
      header.style.setProperty('pointer-events', 'none', 'important');
    } else {
      header.style.removeProperty('z-index');
      header.style.removeProperty('pointer-events');
    }
  }
};

export function lockBodyScroll(): void {
  if (typeof window === 'undefined') return;

  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    originalPaddingRight = document.body.style.paddingRight;

    // Compensate for scrollbar disappearance so page content doesn't jump sideways
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('modal-open-locked');
    document.body.classList.add('modal-open-locked');

    // Force topbar header to lie underneath the modal backdrop
    setHeaderUnderneath(true);

    if (!isWindowListenerAttached) {
      window.addEventListener('wheel', handleBackdropScroll, { passive: false });
      window.addEventListener('touchmove', handleBackdropScroll, { passive: false });
      isWindowListenerAttached = true;
    }
  }
  lockCount += 1;
}

export function unlockBodyScroll(): void {
  if (typeof window === 'undefined') return;

  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = originalOverflow;
    document.body.style.paddingRight = originalPaddingRight;
    document.documentElement.classList.remove('modal-open-locked');
    document.body.classList.remove('modal-open-locked');

    // Restore topbar header back to normal
    setHeaderUnderneath(false);

    if (isWindowListenerAttached) {
      window.removeEventListener('wheel', handleBackdropScroll);
      window.removeEventListener('touchmove', handleBackdropScroll);
      isWindowListenerAttached = false;
    }
  }
}

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * React hook to lock body scroll when a modal is open.
 * Uses useLayoutEffect to execute synchronously BEFORE browser paint, eliminating visual flash.
 * @param isLocked boolean indicating whether scroll should be locked (usually isOpen)
 */
export function useBodyScrollLock(isLocked: boolean = true): void {
  useIsomorphicLayoutEffect(() => {
    if (!isLocked) return;

    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}

/**
 * Check if a DOM element represents a modal backdrop overlay
 */
const isModalBackdropElement = (el: Element): boolean => {
  if (el.hasAttribute('data-modal') || el.getAttribute('role') === 'dialog') {
    return true;
  }
  const cls = (el as HTMLElement).className;
  if (typeof cls === 'string' && cls.includes('fixed') && cls.includes('inset-0')) {
    // Exclude background decorative scenes/canvases which have pointer-events-none or z-0
    if (!cls.includes('pointer-events-none') && !cls.includes('z-0')) {
      return true;
    }
  }
  return false;
};

/**
 * Universal Auto-Detector for all modals across the app
 * Watches the DOM for any modal backdrop overlays and automatically locks background scroll
 * and forces the header underneath.
 */
export function initGlobalModalScrollLock(): () => void {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => {};
  }

  let autoLockActive = false;

  const checkForModals = () => {
    const candidates = document.querySelectorAll(
      '[class*="fixed"][class*="inset-0"], [role="dialog"], [data-modal="true"]'
    );
    let foundModal = false;
    for (let i = 0; i < candidates.length; i++) {
      if (isModalBackdropElement(candidates[i])) {
        foundModal = true;
        break;
      }
    }

    if (foundModal && !autoLockActive) {
      autoLockActive = true;
      lockBodyScroll();
    } else if (!foundModal && autoLockActive) {
      autoLockActive = false;
      unlockBodyScroll();
    }
  };

  const observer = new MutationObserver(() => {
    checkForModals();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initial check
  checkForModals();

  return () => {
    observer.disconnect();
    if (autoLockActive) {
      unlockBodyScroll();
      autoLockActive = false;
    }
  };
}
