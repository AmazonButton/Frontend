import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { api, apiSessionMarker } from '../../services/api';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export const EditStorePlanModal: React.FC<{ plan: any; onClose: () => void; onSaved: (changes: any) => void }> = ({ plan, onClose, onSaved }) => {
  const [form, setForm] = useState({ planName: plan.planName || '', description: plan.description || '', price: String(plan.price ?? ''), durationDays: String(plan.durationDays ?? ''), maxProducts: String(plan.maxProducts ?? '') });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false), alive = useRef(true);
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useBodyScrollLock(true);
  useEffect(() => {
    alive.current = true;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending.current) { event.preventDefault(); close.current(); }
      if (event.key === 'Tab') {
        const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)') || []);
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (!first) { event.preventDefault(); dialog.current?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', keydown);
    return () => { alive.current = false; window.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current) return;
    const payload = { planName: form.planName.trim(), description: form.description.trim(), price: Number(form.price), durationDays: Number(form.durationDays), maxProducts: Number(form.maxProducts) };
    if (!payload.planName || !form.price.trim() || !form.durationDays.trim() || !form.maxProducts.trim() || !Number.isSafeInteger(payload.price) || payload.price < 0 || !Number.isSafeInteger(payload.durationDays) || payload.durationDays < 1 || !Number.isSafeInteger(payload.maxProducts) || payload.maxProducts < 1) {
      setError('Nhập tên gói, giá nguyên không âm, thời hạn và giới hạn sản phẩm là số nguyên lớn hơn 0.'); return;
    }
    const scope = apiSessionMarker();
    pending.current = true; setSaving(true); setError('');
    try {
      const response = await api.put(`/admin/plans/${encodeURIComponent(String(plan.planId || plan.id))}`, payload);
      if (!alive.current || apiSessionMarker() !== scope) return;
      if (response.data?.success !== true) throw new Error(response.data?.message || 'Chưa cập nhật được gói dịch vụ.');
      onSaved(payload);
    } catch (failure: any) {
      if (alive.current && apiSessionMarker() === scope) setError(failure.response?.data?.message || failure.message || 'Không thể cập nhật gói. Vui lòng thử lại.');
    } finally { pending.current = false; if (alive.current) setSaving(false); }
  };
  return createPortal(<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget && !pending.current) onClose(); }}>
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="edit-store-plan-title" className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white text-zinc-900 shadow-2xl outline-none dark:bg-zinc-900 dark:text-white">
      <header className="flex items-start justify-between gap-4 border-b border-zinc-100 bg-sky-50/70 p-5 dark:border-zinc-800 dark:bg-sky-950/20"><div><h2 id="edit-store-plan-title" className="text-lg font-semibold">Chỉnh sửa gói dịch vụ</h2><p className="mt-1 text-xs text-zinc-500">Mã gói: {plan.planCode}</p></div><button type="button" disabled={saving} aria-label="Đóng chỉnh sửa gói" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"><X size={20} /></button></header>
      <form onSubmit={submit} className="space-y-4 overflow-y-auto p-5" data-scrollable="modal" aria-busy={saving}>
        <fieldset disabled={saving} className="space-y-4 disabled:opacity-70">
          {([{ key: 'planName', label: 'Tên gói', type: 'text' }, { key: 'price', label: 'Giá (₫)', type: 'number', min: 0 }, { key: 'durationDays', label: 'Thời hạn (ngày)', type: 'number', min: 1 }, { key: 'maxProducts', label: 'Giới hạn sản phẩm', type: 'number', min: 1 }] as const).map(field => <div key={field.key}><label htmlFor={`edit-plan-${field.key}`} className="mb-1.5 block text-sm font-medium">{field.label}</label><input id={`edit-plan-${field.key}`} required type={field.type} min={'min' in field ? field.min : undefined} step={field.type === 'number' ? 1 : undefined} value={form[field.key]} onChange={event => setForm({ ...form, [field.key]: event.target.value })} className="min-h-11 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none focus:border-[#287DA8] focus:ring-1 focus:ring-[#287DA8] dark:border-zinc-700 dark:bg-zinc-950" /></div>)}
          <div><label htmlFor="edit-plan-description" className="mb-1.5 block text-sm font-medium">Mô tả</label><textarea id="edit-plan-description" rows={3} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm outline-none focus:border-[#287DA8] dark:border-zinc-700 dark:bg-zinc-950" /></div>
        </fieldset>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800"><button type="button" disabled={saving} onClick={onClose} className="min-h-11 rounded-lg border border-zinc-200 px-4 text-sm font-semibold disabled:opacity-40 dark:border-zinc-700">Hủy</button><button type="submit" disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#287DA8] px-4 text-sm font-semibold text-white hover:bg-[#206588] disabled:opacity-50">{saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div>
      </form>
    </section>
  </div>, document.body);
};
