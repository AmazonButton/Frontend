import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, BookOpen, MousePointerClick, PackageCheck, ShoppingBag } from 'lucide-react';
import { PUBLIC_LINK_GROUPS } from '../content/public-content';
import { useFooterMotion } from '../components/common/useFooterMotion';
import './footer.css';

export const Footer: React.FC = () => {
  const footerRef = useFooterMotion();
  const { pathname } = useLocation();
  const isHomepage = pathname === '/';
  const isPolicyPage = pathname.startsWith('/policies/');
  const isCompact = isHomepage || isPolicyPage;

  return (
  <footer ref={footerRef} data-footer-motion-root className={`site-footer${isCompact ? ' site-footer--compact' : ''}${isPolicyPage ? ' site-footer--policy' : ''}`} aria-label="Thông tin Smart Order Button">
    <div className="site-footer__inner">
      {!isPolicyPage && <div data-footer-motion className="site-footer__intro">
        <div>
          {!isHomepage && <span className="site-footer__eyebrow">SMART ORDER BUTTON</span>}
          <h2>Mọi nhu cầu quen thuộc.<br /><span>Kết nối trong một chạm.</span></h2>
          {isHomepage
            ? <p>Mua sắm hằng ngày, thuận tiện từ website đến nút bấm.</p>
            : <p>Từ mua sắm hằng ngày đến nút bấm đặt hàng tại nhà,<br className="hidden sm:block" /> luôn có một cách thuận tiện dành cho bạn.</p>}
        </div>
        <div className="site-footer__actions">
          <Link to="/shop" className="site-footer__primary">Khám phá sản phẩm <ArrowRight aria-hidden="true" size={17} /></Link>
          {!isHomepage && <Link to="/help/ordering" className="site-footer__guide"><BookOpen aria-hidden="true" size={16} /> Hướng dẫn đặt hàng</Link>}
        </div>
      </div>}
      <div className="site-footer__navigation">
        <div data-footer-motion className="site-footer__brand">
          <Link to="/" className="site-footer__logo" aria-label="Smart Order Button — Trang chủ">
            <span><img src="/assets/logo.png" alt="" width="32" height="32" loading="lazy" /></span>
            Smart Order Button
          </Link>
          {isHomepage
            ? <p>Kết nối gia đình với cửa hàng qua website và nút bấm đặt nhu yếu phẩm thông minh.</p>
            : isPolicyPage
              ? <p>Thông tin sử dụng, hỗ trợ và chính sách của Smart Order Button.</p>
              : <p>Kết nối gia đình với cửa hàng qua nền tảng mua sắm và nút bấm thông minh. Nước uống, gas, gạo và nhu yếu phẩm — đặt đúng thứ bạn cần.</p>}
          {isCompact ? (
            <div data-footer-motion-links className="site-footer__brand-links">
              {isPolicyPage && <Link to="/shop" className="site-footer__guide">Khám phá sản phẩm <ArrowRight aria-hidden="true" size={17} /></Link>}
              <Link to="/help/ordering" className="site-footer__guide"><BookOpen aria-hidden="true" size={16} /> Hướng dẫn đặt hàng</Link>
              <Link to="/help/rentals" className="site-footer__guide">Tìm hiểu dịch vụ thuê nút <ArrowRight aria-hidden="true" size={14} /></Link>
            </div>
          ) : <span className="site-footer__brand-note">Gần hơn với những điều thiết yếu.</span>}
        </div>
        {PUBLIC_LINK_GROUPS.map((group) => (
          <nav key={group.title} data-footer-motion aria-label={group.title}>
            <h3>{group.title}</h3>
            <ul>{group.links.map((link) => <li key={link.to}><Link to={link.to}>{link.label}</Link></li>)}</ul>
          </nav>
        ))}
      </div>
      {!isCompact && <div data-footer-motion className="site-footer__services" aria-label="Trải nghiệm trên nền tảng">
        <span><ShoppingBag aria-hidden="true" size={17} /> Mua sắm trực tuyến</span>
        <span><MousePointerClick aria-hidden="true" size={17} /> Đặt hàng bằng nút bấm</span>
        <span><PackageCheck aria-hidden="true" size={17} /> Theo dõi đơn & hợp đồng</span>
        <Link to="/help/rentals">Tìm hiểu dịch vụ thuê nút <ArrowRight aria-hidden="true" size={14} /></Link>
      </div>}
      <div data-footer-motion data-footer-motion-links className="site-footer__bottom">
        <p>© {new Date().getFullYear()} Smart Order Button.</p>
        <p>Giá, phí và quyền lợi áp dụng theo đơn hàng hoặc hợp đồng được xác nhận.</p>
        <Link to="/policies/privacy">Quyền riêng tư của bạn</Link>
      </div>
    </div>
  </footer>
  );
};
