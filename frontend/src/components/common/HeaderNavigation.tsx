import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export interface NavItem {
  id: string;
  label: string;
  sectionId: string;
  href: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'features', label: 'Tính năng', sectionId: 'features', href: '/#features' },
  { id: 'pipeline', label: 'Quy trình', sectionId: 'product-story', href: '/#product-story' },
  { id: 'categories', label: 'Nhu yếu phẩm', sectionId: 'categories', href: '/#categories' },
  { id: 'enterprise', label: 'Doanh nghiệp', sectionId: 'enterprise', href: '/#enterprise' }
];

interface HeaderNavigationProps {
  isMobile?: boolean;
  onMobileSelect?: () => void;
}

export const HeaderNavigation: React.FC<HeaderNavigationProps> = ({
  isMobile = false,
  onMobileSelect
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Active item determined by route / scroll
  const [activeId, setActiveId] = useState<string>('features');
  // Hovered item for interactive preview
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const isLandingPage = location.pathname === '/';

  // Track active section on scroll when on Landing Page
  useEffect(() => {
    if (!isLandingPage) {
      setActiveId('');
      return;
    }

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 140; // Offset for sticky header

      for (let i = NAV_ITEMS.length - 1; i >= 0; i--) {
        const item = NAV_ITEMS[i];
        const element = document.getElementById(item.sectionId);
        if (element) {
          const top = element.offsetTop;
          if (scrollPosition >= top) {
            setActiveId(item.id);
            return;
          }
        }
      }

      // Default to first item if near top
      setActiveId('features');
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLandingPage, location]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) => {
    e.preventDefault();
    setActiveId(item.id);

    if (onMobileSelect) {
      onMobileSelect();
    }

    if (!isLandingPage) {
      navigate(`/#${item.sectionId}`);
      return;
    }

    const targetElement = document.getElementById(item.sectionId);
    if (targetElement) {
      const headerOffset = 70;
      const elementPosition = targetElement.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });

      // Update URL hash without page jump
      window.history.pushState(null, '', `#${item.sectionId}`);
    }
  };

  // The item currently highlighted by the sliding pill
  const currentIndicatorId = hoveredId || activeId;

  if (isMobile) {
    return (
      <nav aria-label="Mobile Navigation" className="flex flex-col space-y-1 w-full">
        {NAV_ITEMS.map((item) => {
          const isSelected = activeId === item.id;

          return (
            <a
              key={item.id}
              href={item.href}
              onClick={(e) => handleNavClick(e, item)}
              className={`px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
                isSelected
                  ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white font-bold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800/50'
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Main Navigation"
      onMouseLeave={() => setHoveredId(null)}
      className="relative flex items-center p-1 rounded-2xl bg-transparent"
    >
      {NAV_ITEMS.map((item) => {
        const isSelected = activeId === item.id;
        const isHighlighted = currentIndicatorId === item.id;

        return (
          <div
            key={item.id}
            onMouseEnter={() => setHoveredId(item.id)}
            className="relative"
          >
            {/* Shared Layout Sliding Indicator Pill (Framer Motion Spring) */}
            {isHighlighted && (
              <motion.div
                layoutId="header-active-pill"
                className="absolute inset-0 rounded-xl bg-slate-100/90 dark:bg-zinc-800/80 border border-slate-200/70 dark:border-zinc-700/60 shadow-xs pointer-events-none"
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 32,
                  mass: 0.8
                }}
              />
            )}

            {/* Nav Link Item */}
            <a
              href={item.href}
              onClick={(e) => handleNavClick(e, item)}
              className={`relative z-10 block px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-colors duration-200 select-none outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                isSelected
                  ? 'text-slate-900 dark:text-white font-bold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </a>
          </div>
        );
      })}
    </nav>
  );
};
