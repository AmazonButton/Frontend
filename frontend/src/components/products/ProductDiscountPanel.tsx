import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tag, X, Plus, ArrowLeft, Loader2 } from 'lucide-react';
import { Product } from '../../types';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { DiscountInput, ProductDiscount, discountedPrice, productDiscounts } from '../../services/product-discounts';
import { notifyCatalogChanged } from '../../services/catalog-sync';
import './product-discounts.css';
const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
const localDate = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const dateLabel = (value: string) => new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const errorMessage = (error: any) => {
  const message = error?.response?.data?.message;
  return Array.isArray(message) ? message.join('. ') : message || 'Không thể lưu thay đổi. Vui lòng thử lại.';
};
export function ProductDiscountPanel({ product, onClose }: { product: Product; onClose: () => void }) {
  const [items, setItems] = useState<ProductDiscount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDiscount | null>(null);
  const [kind, setKind] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState('10');
  const [start, setStart] = useState(() => localDate(new Date()));
  const [end, setEnd] = useState(() => localDate(new Date(Date.now() + 7 * 86400000)));
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [removing, setRemoving] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useBodyScrollLock(true);
  useEffect(() => {
    let current = true;
    productDiscounts.list(product.id).then(data => { if (current) setItems(data); })
      .catch(() => { if (current) setError('Không tải được danh sách ưu đãi. Đóng và mở lại để thử lại.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [product.id]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, []);
  const openForm = (item?: ProductDiscount) => {
    setEditing(item || null);
    setKind(item?.discountAmount != null ? 'amount' : 'percent');
    setValue(String(item?.discountPercent ?? item?.discountAmount ?? 10));
    setStart(localDate(item ? new Date(item.startAt) : new Date()));
    setEnd(localDate(item ? new Date(item.endAt) : new Date(Date.now() + 7 * 86400000)));
    setStatus(item?.status || 'ACTIVE');
    setError(''); setFormOpen(true); setRemoving(null);
  };
  const reload = async () => {
    notifyCatalogChanged();
    try { setItems(await productDiscounts.list(product.id)); }
    catch { setError('Đã lưu thay đổi. Không tải lại được danh sách, vui lòng mở lại.'); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(value);
    if (!value.trim() || !Number.isFinite(amount) || amount <= 0 || amount > (kind === 'percent' ? 100 : product.price)) {
      setError(kind === 'percent' ? 'Nhập mức giảm lớn hơn 0 và tối đa 100%.' : 'Mức giảm phải lớn hơn 0 và không vượt giá gốc.'); return;
    }
    if (!start || !end || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || new Date(start) >= new Date(end)) {
      setError('Thời gian kết thúc phải sau thời gian bắt đầu.'); return;
    }
    const input: DiscountInput = { startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString(), status,
      ...(kind === 'percent' ? { discountPercent: amount } : { discountAmount: amount }) };
    setBusy(true); setError('');
    try {
      if (editing) await productDiscounts.update(editing.discountId, { ...input, ...(kind === 'percent' ? { discountAmount: null } : { discountPercent: null }) });
      else await productDiscounts.create(product.id, input);
      setFormOpen(false); await reload();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  const mutate = async (item: ProductDiscount, remove = false) => {
    setBusy(true); setError('');
    try {
      if (remove) await productDiscounts.remove(item.discountId);
      else await productDiscounts.update(item.discountId, { status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
      setRemoving(null); await reload();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  const previewPrice = Math.max(0, product.price - (kind === 'percent' ? Math.round(product.price * Number(value || 0) / 100) : Number(value || 0)));
  return createPortal(<div className="discount-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="discount-title" className="discount-panel" onKeyDown={event => {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key === 'Tab') {
        const controls = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <header className="discount-header"><div><h2 id="discount-title">Giảm giá sản phẩm</h2><p>Ưu đãi trực tiếp từ cửa hàng</p></div><button ref={closeButton} type="button" disabled={busy} onClick={onClose} aria-label="Đóng"><X size={20}/></button></header>
      <div className="discount-product">{product.imageUrl ? <img src={product.imageUrl} alt=""/> : <Tag size={24}/>}<div><strong>{product.name}</strong><span>{product.sku} · Giá gốc {money(product.price)}</span></div></div>
      <div className="discount-content">
        {error && <div role="alert" className="discount-error">{error}</div>}
        {loading ? <p role="status" className="discount-empty"><Loader2 className="animate-spin" size={20}/> Đang tải ưu đãi…</p> : formOpen ? <form id="discount-form" onSubmit={save}>
          <button type="button" className="discount-back" disabled={busy} onClick={() => { setFormOpen(false); setError(''); }}><ArrowLeft size={15}/> Danh sách ưu đãi</button>
          <h3>{editing ? 'Chỉnh sửa ưu đãi' : 'Tạo ưu đãi mới'}</h3>
          <fieldset disabled={busy}><legend>Hình thức giảm giá</legend><div className="discount-segment"><button type="button" aria-pressed={kind === 'percent'} onClick={() => setKind('percent')}>Theo phần trăm (%)</button><button type="button" aria-pressed={kind === 'amount'} onClick={() => setKind('amount')}>Theo số tiền (₫)</button></div>
          <label>Mức giảm {kind === 'percent' ? '(%)' : '(₫)'}<input required type="number" min="0.01" step="any" max={kind === 'percent' ? 100 : product.price} value={value} onChange={event => setValue(event.target.value)}/></label>
          <div className="discount-preview"><span>Khách mua với giá</span><div><strong>{money(Number.isFinite(previewPrice) ? previewPrice : product.price)}</strong><del>{money(product.price)}</del></div><small>Áp dụng tự động trong thời gian ưu đãi</small></div>
          <div className="discount-dates"><label>Bắt đầu<input required type="datetime-local" value={start} onChange={event => setStart(event.target.value)}/></label><label>Kết thúc<input required type="datetime-local" value={end} onChange={event => setEnd(event.target.value)}/></label></div>
          <p className="discount-help">Theo giờ trên thiết bị của bạn. Các ưu đãi đang bật của cùng sản phẩm cần có thời gian riêng biệt.</p>
          <label>Trạng thái<select value={status} onChange={event => setStatus(event.target.value as 'ACTIVE' | 'INACTIVE')}><option value="ACTIVE">Bật theo lịch đã chọn</option><option value="INACTIVE">Tạm tắt</option></select></label></fieldset>
        </form> : <>
          <div className="discount-list-heading"><h3>Ưu đãi của sản phẩm</h3><button type="button" className="discount-link" onClick={() => openForm()}><Plus size={15}/> Tạo ưu đãi</button></div>
          {!items.length ? <div className="discount-empty"><Tag size={30}/><strong>Thêm ưu đãi đầu tiên</strong><p>Chọn mức giảm và thời gian để sản phẩm có giá ưu đãi trên gian hàng.</p><button type="button" className="discount-primary" onClick={() => openForm()}>Tạo ưu đãi</button></div> : items.map(item => {
            const now = Date.now();
            const state = item.status !== 'ACTIVE' ? 'Tạm tắt' : Date.parse(item.endAt) < now ? 'Đã kết thúc' : Date.parse(item.startAt) > now ? 'Sắp diễn ra' : 'Đang áp dụng';
            const price = discountedPrice(product.price, [{ ...item, status: 'ACTIVE' }], Date.parse(item.startAt));
            return <article className="discount-card" key={item.discountId}><div className="discount-card-top"><strong>{item.discountPercent != null ? `Giảm ${item.discountPercent}%` : `Giảm ${money(Number(item.discountAmount))}`}</strong><span className={state === 'Đang áp dụng' ? 'discount-status live' : 'discount-status'}>{state}</span></div><div className="discount-card-price">{money(price)} <del>{money(product.price)}</del></div><p>{dateLabel(item.startAt)} – {dateLabel(item.endAt)}</p><div className="discount-card-actions"><button disabled={busy} onClick={() => openForm(item)}>Chỉnh sửa</button><button disabled={busy} onClick={() => void mutate(item)}>{item.status === 'ACTIVE' ? 'Tạm tắt' : 'Bật ưu đãi'}</button><button disabled={busy} className="discount-danger" onClick={() => setRemoving(item.discountId)}>Xóa</button></div>{removing === item.discountId && <div className="discount-confirm"><span>Xóa ưu đãi này?</span><button disabled={busy} onClick={() => setRemoving(null)}>Giữ lại</button><button disabled={busy} className="discount-danger" onClick={() => void mutate(item, true)}>Xóa ưu đãi</button></div>}</article>;
          })}
        </>}
      </div>
      <footer className="discount-footer">{formOpen ? <><button type="button" disabled={busy} onClick={() => setFormOpen(false)}>Hủy</button><button className="discount-primary" type="submit" form="discount-form" disabled={busy}>{busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo ưu đãi'}</button></> : <><span>Ưu đãi được áp dụng tự động khi đặt hàng.</span><button type="button" disabled={busy} onClick={onClose}>Đóng</button></>}</footer>
    </div>
  </div>, document.body);
}
