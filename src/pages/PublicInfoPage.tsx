import React, { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, Info } from 'lucide-react';
import { PUBLIC_ARTICLES, PUBLIC_INFORMATION_GROUPS } from '../content/public-content';
import { PageBackButton } from '../components/common/PageBackButton';
import './public-info.css';

export const PublicInfoPage: React.FC = () => {
  const { pathname, search, hash, key } = useLocation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const article = PUBLIC_ARTICLES.find((item) => item.path === pathname.replace(/\/$/, ''));
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${article?.title || 'Không tìm thấy nội dung'} | Smart Order Button`;
    return () => { document.title = previousTitle; };
  }, [article]);

  useEffect(() => {
    let id = '';
    try { id = decodeURIComponent(hash.slice(1)); } catch { /* Malformed hashes do not block reading. */ }
    const ids = article ? [
      ...article.sections.map((section) => section.id),
      ...(article.related ? [article.related.id, ...article.related.links.map((link) => link.id)] : []),
    ] : [];
    const target = id && ids.includes(id) ? document.getElementById(id) : null;
    if (target) {
      target.scrollIntoView({ block: 'start', behavior: prefersReducedMotion ? 'instant' as ScrollBehavior : 'smooth' });
      (document.getElementById(`${id}-title`) || target).focus({ preventScroll: true });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      heading.current?.focus({ preventScroll: true });
    }
  }, [article, hash, key, prefersReducedMotion]);

  const navigateToSection = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate({ pathname, search, hash: `#${id}` });
  };

  if (!article) return (
    <main className="public-info public-info--missing">
      <nav className="public-info__back-navigation" aria-label="Điều hướng quay lại"><PageBackButton fallbackTo="/" /></nav>
      <BookOpen aria-hidden="true" size={32} />
      <h1 ref={heading} tabIndex={-1}>Không tìm thấy nội dung</h1>
      <p>Bạn có thể quay lại hướng dẫn đặt hàng hoặc chọn một chủ đề ở cuối trang.</p>
      <Link to="/help/ordering">Xem hướng dẫn đặt hàng <ArrowRight aria-hidden="true" size={16} /></Link>
    </main>
  );

  const topicLinks = PUBLIC_INFORMATION_GROUPS.flatMap((group) => group.links);
  const activeTopic = topicLinks.find((link) => link.to === `${article.path}${hash}`)?.to || article.path;
  return (
    <div className={`public-info${article.category === 'Chính sách' ? ' public-info--policy' : ''}`}>
      <div className="public-info__inner">
        <nav className="public-info__back-navigation" aria-label="Điều hướng quay lại">
          <PageBackButton fallbackTo="/" />
        </nav>
        <nav className="public-info__breadcrumb" aria-label="Vị trí trang">
          <Link to="/">Trang chủ</Link><ChevronRight aria-hidden="true" size={13} />
          <span>{article.category}</span><ChevronRight aria-hidden="true" size={13} />
          <span aria-current="page">{article.title}</span>
        </nav>
        <div className="public-info__layout">
          <aside className="public-info__sidebar">
            <span className="public-info__eyebrow">THÔNG TIN DỊCH VỤ</span>
            <nav className="public-info__topic-menu" aria-label="Hướng dẫn và chính sách">
              <h2>Thông tin & chính sách</h2>
              {PUBLIC_INFORMATION_GROUPS.map((group, index) => <div key={group.title} className="public-info__topic-group" role="group" aria-labelledby={`public-topic-${index}`}>
                <h3 id={`public-topic-${index}`}>{group.title}</h3>
                {group.links.map((link) => <Link key={link.to} to={link.to} className={link.to.includes('#') ? 'public-info__subtopic' : undefined} aria-current={link.to === activeTopic ? (link.to.includes('#') ? 'location' : 'page') : undefined}>{link.label}<ChevronRight aria-hidden="true" size={14} /></Link>)}
              </div>)}
            </nav>
            <div className="public-info__topic-picker">
              <label htmlFor="public-topic-picker">Chọn nội dung cần xem</label>
              <select id="public-topic-picker" value={activeTopic} onChange={(event) => navigate(event.target.value)}>
                {PUBLIC_INFORMATION_GROUPS.map((group) => <optgroup label={group.title} key={group.title}>{group.links.map((link) => <option key={link.to} value={link.to}>{link.label}</option>)}</optgroup>)}
              </select>
            </div>
            <div className="public-info__sidebar-note">
              <BookOpen aria-hidden="true" size={20} />
              <p>{article.category === 'Chính sách' ? 'Cần biết cách thao tác?' : 'Tìm hiểu trước khi sử dụng.'}</p>
              <Link to={article.category === 'Chính sách' ? '/help/ordering' : '/policies/terms'}>{article.category === 'Chính sách' ? 'Đọc hướng dẫn sử dụng' : 'Xem điều khoản sử dụng'} <ArrowRight aria-hidden="true" size={13} /></Link>
            </div>
          </aside>
          <main className="public-info__article">
            <article aria-labelledby="public-article-title">
            <header>
              <span className="public-info__eyebrow">{article.category.toLocaleUpperCase('vi-VN')}</span>
              <h1 id="public-article-title" ref={heading} tabIndex={-1}>{article.title}</h1>
              <p className="public-info__description">{article.description}</p>
            </header>
            <div className="public-info__notice"><Info aria-hidden="true" size={19} /><p>{article.notice}</p></div>
            <nav className="public-info__contents" aria-label="Nội dung bài viết">
              <span>Trong trang này</span>
              {article.sections.map((section) => <a href={`#${section.id}`} key={section.id} onClick={(event) => navigateToSection(event, section.id)}>{section.title}</a>)}
            </nav>
            {article.sections.map((section) => (
              <section key={section.id} id={section.id} className="public-info__section" aria-labelledby={`${section.id}-title`}>
                <h2 id={`${section.id}-title`} tabIndex={-1}>{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.methods && <dl className="public-info__methods">{section.methods.map((method) => (
                  <div key={method.title}>
                    <dt>{method.title}</dt>
                    <dd>{method.description}</dd>
                    <dd className="public-info__method-note">{method.note}</dd>
                  </div>
                ))}</dl>}
                {section.flows && <div className="public-info__flow-table"><table>
                  <caption>Các khoản tiền trong mô hình cửa hàng chịu phí thuê</caption>
                  <thead><tr><th scope="col">Khoản tiền</th><th scope="col">Bên chi trả</th><th scope="col">Bên tiếp nhận</th><th scope="col">Mục đích</th></tr></thead>
                  <tbody>{section.flows.map((flow) => <tr key={flow.name}>
                    <th scope="row">{flow.name}</th><td data-label="Bên chi trả">{flow.payer}</td><td data-label="Bên tiếp nhận">{flow.receiver}</td><td data-label="Mục đích">{flow.description}</td>
                  </tr>)}</tbody>
                </table></div>}
                {section.steps && <ol>{section.steps.map((step) => <li key={step}>{step}</li>)}</ol>}
                {section.links && <ul className="public-info__related-links">{section.links.map((link) => <li key={link.to}><Link to={link.to}>{link.label}<ArrowRight aria-hidden="true" size={14} /></Link></li>)}</ul>}
              </section>
            ))}
            {article.related && <aside className="public-info__related" id={article.related.id} aria-labelledby={`${article.related.id}-title`}>
              <h2 id={`${article.related.id}-title`} tabIndex={-1}>{article.related.title}</h2>
              <p>{article.related.description}</p>
              <ul className="public-info__related-links">{article.related.links.map((link) => <li key={link.to} id={link.id} tabIndex={link.id ? -1 : undefined}><Link to={link.to}>{link.label}<ArrowRight aria-hidden="true" size={14} /></Link></li>)}</ul>
            </aside>}
            {article.support && <div className="public-info__support">
              <div><h2>{article.support.title}</h2><p>{article.support.description}</p></div>
              <Link to={article.support.to} className="public-info__action">{article.support.label}<ArrowRight aria-hidden="true" size={16} /></Link>
            </div>}
            <div className="public-info__next">
              <Link to="/" className="public-info__back"><ArrowLeft aria-hidden="true" size={16} /> Về trang chủ</Link>
              {article.support?.to !== article.action.to && !article.related?.links.some((link) => link.to === article.action.to) && <Link to={article.action.to} className={article.support ? 'public-info__back' : 'public-info__action'}>{article.action.label}<ArrowRight aria-hidden="true" size={16} /></Link>}
            </div>
            </article>
          </main>
        </div>
      </div>
    </div>
  );
};
