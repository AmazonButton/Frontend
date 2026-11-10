import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { PUBLIC_LINK_GROUPS } from '../content/public-content';
import { useFooterMotion } from '../components/common/useFooterMotion';
import './footer.css';

export const Footer: React.FC = () => {
  const footerRef = useFooterMotion();

  return (
  <footer ref={footerRef} data-footer-motion-root className="site-footer" aria-label="Thông tin Smart Order Button">
    <div className="site-footer__inner">
      <div data-footer-motion className="site-footer__intro">
        <div>
          <h2>Mọi nhu cầu quen thuộc.<br /><span>Kết nối trong một chạm.</span></h2>
          <p>Mua sắm hằng ngày, thuận tiện từ website đến nút bấm.</p>
        </div>
        <div className="site-footer__actions">
          <Link to="/shop" className="site-footer__primary">Khám phá sản phẩm <ArrowRight aria-hidden="true" size={17} /></Link>
        </div>
      </div>
      <div className="site-footer__navigation">
        <div data-footer-motion className="site-footer__brand">
          <Link to="/" className="site-footer__logo" aria-label="Smart Order Button — Trang chủ">
            <span><img src="/assets/logo.png" alt="" width="32" height="32" loading="lazy" /></span>
            Smart Order Button
          </Link>
          <p>Kết nối gia đình với cửa hàng qua website và nút bấm đặt nhu yếu phẩm thông minh.</p>
            <div data-footer-motion-links className="site-footer__brand-links">
              <Link to="/help/ordering" className="site-footer__guide"><BookOpen aria-hidden="true" size={16} /> Hướng dẫn đặt hàng</Link>
              <Link to="/help/rentals" className="site-footer__guide">Tìm hiểu dịch vụ thuê nút <ArrowRight aria-hidden="true" size={14} /></Link>
            </div>
        </div>
        {PUBLIC_LINK_GROUPS.map((group) => (
          <nav key={group.title} data-footer-motion aria-label={group.title}>
            <h3>{group.title}</h3>
            <ul>{group.links.map((link) => <li key={link.to}><Link to={link.to}>{link.label}</Link></li>)}</ul>
          </nav>
        ))}
      </div>
      <div data-footer-motion data-footer-motion-links className="site-footer__bottom">
        <p>© {new Date().getFullYear()} Smart Order Button.</p>
        <p>Giá, phí và quyền lợi áp dụng theo đơn hàng hoặc hợp đồng được xác nhận.</p>
        <Link to="/policies/privacy">Quyền riêng tư của bạn</Link>
      </div>
    </div>
  </footer>
  );
};
