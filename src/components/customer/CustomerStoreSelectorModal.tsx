import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Search, Store, X } from 'lucide-react';
import { api } from '../../services/api';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export interface StoreItem {
  id: string;
  name: string;
  code: string;
  ownerName: string;
  phone: string;
  address: string;
  district: string;
  distanceKm: number;
  deliveryMinutes: string;
  rating: number;
  ordersCount: number;
  openHours: string;
  categories: string[];
  featuredProducts: { name: string; price: string }[];
  isVerified: boolean;
}

const toStoreItem = (store: any): StoreItem => ({
  id: String(store.storeId || store.id),
  name: store.name || 'Cửa hàng',
  code: store.code || store.storeCode || String(store.storeId || store.id),
  ownerName: store.ownerName || '', phone: store.phone || '', address: store.address || '',
  district: store.district || '', distanceKm: Number(store.distanceKm || 0),
  deliveryMinutes: store.deliveryMinutes || '—', rating: Number(store.rating || 0),
  ordersCount: Number(store.ordersCount || 0), openHours: store.openHours || '—',
  categories: store.categories || [], featuredProducts: store.featuredProducts || [], isVerified: Boolean(store.isVerified),
});

interface Props { isOpen: boolean; onClose: () => void; currentStoreCode?: string; onStoreSelected: (store: StoreItem) => void; }

export const CustomerStoreSelectorModal: React.FC<Props> = ({ isOpen, onClose, currentStoreCode, onStoreSelected }) => {
  const [search, setSearch] = useState(''); const [stores, setStores] = useState<StoreItem[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  useBodyScrollLock(isOpen);
  const load = useCallback(async (term = '') => { setLoading(true); setError(''); try { const res = await api.get('/stores', { params: { search: term || undefined, limit: 50 } }); const raw = res.data?.data?.items || res.data?.data || []; setStores(Array.isArray(raw) ? raw.map(toStoreItem) : []); } catch (e: any) { setError(e.response?.data?.message || 'Không thể tải danh sách cửa hàng.'); setStores([]); } finally { setLoading(false); } }, []);
  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);
  if (!isOpen) return null;
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center p-4"><button aria-label="Đóng" onClick={onClose} className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" /><section className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"><header className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-zinc-800"><div><p className="text-xs font-bold uppercase tracking-wider text-[#287DA8]">Cửa hàng thực</p><h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">Chọn cửa hàng phục vụ</h2></div><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button></header><div className="p-5"><form onSubmit={(e) => { e.preventDefault(); load(search); }} className="flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên hoặc khu vực" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#287DA8] dark:border-zinc-700 dark:bg-zinc-900" /></div><button className="rounded-lg bg-[#287DA8] px-3 text-xs font-bold text-white">Tìm</button></form>{error && <p className="mt-3 text-sm text-rose-600">{error}</p>}<div className="mt-4 max-h-80 space-y-2 overflow-y-auto">{loading ? <p className="py-8 text-center text-sm text-slate-500">Đang tải cửa hàng...</p> : stores.length ? stores.map((store) => <button key={store.id} onClick={() => { onStoreSelected(store); onClose(); }} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:border-[#287DA8] hover:bg-sky-50 dark:border-zinc-800 dark:hover:bg-sky-950/20 ${currentStoreCode === store.code ? 'border-[#287DA8] bg-sky-50' : 'border-slate-200'}`}><div className="rounded-lg bg-[#287DA8]/10 p-2 text-[#287DA8]"><Store className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800 dark:text-zinc-100">{store.name}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3" />{store.address || store.code}</p></div></button>) : <p className="py-8 text-center text-sm text-slate-500">Không tìm thấy cửa hàng phù hợp.</p>}</div></div></section></div>, document.body);
};
