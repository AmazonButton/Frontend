import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Search, RefreshCw, Battery, Cpu, ShoppingBag, Banknote, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import { WorkflowDialog, WorkflowLoading, WorkflowNotice, WorkflowReveal, workflowButton, workflowInput, workflowSecondary } from '../../components/operations/WorkflowUI';
import { formatMoney, workflowData, workflowError } from '../../utils/workflow';

const AnalyticsChart = React.lazy(() => import('../../components/AnalyticsChart').then(module => ({ default: module.AnalyticsChart })));
const card = 'rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900';

export const AdminLiveAnalytics: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const current = useRef(0);
  const load = useCallback(async () => {
    const request = ++current.current;
    setLoading(true); setError('');
    try { const result = workflowData(await api.get('/analytics/dashboard')); if (request === current.current) setData(result); }
    catch (err) { if (request === current.current) setError(workflowError(err, 'Chưa tải được báo cáo.')); }
    finally { if (request === current.current) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => { ++current.current; }; }, [load]);
  return <WorkflowReveal className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Báo cáo & doanh thu</h2><p className="mt-1 text-sm text-zinc-500">Số liệu được lấy từ đơn hàng trong phạm vi tài khoản của bạn.</p></div><button className={workflowSecondary} disabled={loading} onClick={() => void load()}><RefreshCw className="h-4 w-4" />Làm mới</button></div><WorkflowNotice tone="error">{error}</WorkflowNotice>
    {loading && !data ? <WorkflowLoading label="Đang tải báo cáo..." /> : data && <><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[{ label: 'Tổng đơn hàng', value: Number(data.totalOrders || 0).toLocaleString('vi-VN'), icon: ShoppingBag }, { label: 'Doanh thu đơn hợp lệ', value: formatMoney(data.totalRevenue), icon: Banknote }, { label: 'Nút đang hoạt động', value: Number(data.activeButtons || 0).toLocaleString('vi-VN'), icon: Cpu }].map(({ label, value, icon: Icon }) => <div key={label} className={card}><Icon className="h-5 w-5 text-[#287DA8]" aria-hidden="true" /><p className="mt-4 text-xs text-zinc-500">{label}</p><p className="mt-1 break-words text-2xl font-bold tabular-nums">{value}</p></div>)}</div><section className={card}><h3 className="font-semibold">Xu hướng giá trị đơn theo ngày</h3><p className="mt-1 text-xs leading-relaxed text-zinc-500">Biểu đồ thể hiện tổng giá trị đơn theo ngày từ báo cáo hệ thống. Doanh thu ở trên đã loại đơn bị hủy hoặc từ chối.</p>{Array.isArray(data.chartData) && data.chartData.length ? <Suspense fallback={<WorkflowLoading label="Đang tải biểu đồ..." />}><AnalyticsChart data={data.chartData} /></Suspense> : <p className="py-16 text-center text-sm text-zinc-500">Chưa có đơn hàng để hiển thị biểu đồ.</p>}</section></>}
  </WorkflowReveal>;
};

export const AdminLiveDevices: React.FC = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [detailError, setDetailError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const request = useRef(0);
  const load = useCallback(async () => {
    const id = ++request.current; setLoading(true); setError('');
    try { const data = workflowData(await api.get('/devices')); if (request.current === id) setDevices(Array.isArray(data) ? data : []); }
    catch (err) { if (request.current === id) setError(workflowError(err)); }
    finally { if (request.current === id) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => { ++request.current; }; }, [load]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setDetail(null); setSnapshot(null); setDetailLoading(true); setDetailError('');
    const id = encodeURIComponent(selected.deviceId || selected.id);
    void Promise.allSettled([api.get(`/devices/${id}`, { signal: controller.signal }), api.get(`/devices/${id}/telemetry`, { signal: controller.signal })]).then(results => {
      if (controller.signal.aborted) return;
      const errors: string[] = [];
      if (results[0].status === 'fulfilled') { try { setDetail(workflowData(results[0].value)); } catch (err) { errors.push(workflowError(err)); } } else errors.push(workflowError(results[0].reason));
      if (results[1].status === 'fulfilled') { try { const logs = workflowData(results[1].value); setSnapshot(Array.isArray(logs) ? logs[0] || null : logs); } catch (err) { errors.push(workflowError(err)); } } else errors.push(workflowError(results[1].reason));
      setDetailError(errors.join(' ')); setDetailLoading(false);
    });
    return () => controller.abort();
  }, [selected]);
  const filtered = devices.filter(device => `${device.deviceId || ''} ${device.customName || device.name || ''} ${device.storeId || ''}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')));
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const visible = filtered.slice((Math.min(page, pages) - 1) * 12, Math.min(page, pages) * 12);
  const latest = snapshot;
  return <WorkflowReveal className="space-y-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Thiết bị & pin</h2><p className="mt-1 text-sm text-zinc-500">Danh sách thiết bị trong hệ thống. Chọn thiết bị để xem thông tin.</p></div><button onClick={() => void load()} disabled={loading} className={workflowSecondary}><RefreshCw className="h-4 w-4" />Làm mới</button></div><WorkflowNotice tone="error">{error}</WorkflowNotice><label className="relative block max-w-md"><span className="sr-only">Tìm theo mã thiết bị, tên hoặc mã cửa hàng</span><Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-zinc-400" /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm thiết bị, cửa hàng..." className={`${workflowInput} pl-10`} /></label>
    {loading && !devices.length ? <WorkflowLoading /> : <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visible.map(device => <button type="button" key={device.deviceId || device.id} onClick={() => setSelected(device)} className={`${card} text-left transition-colors hover:border-[#287DA8] focus-visible:ring-2 focus-visible:ring-[#287DA8]`}><div className="flex items-start justify-between gap-3"><Cpu className="h-5 w-5 text-[#287DA8]" /><span className="text-xs text-zinc-500">{device.status === 'ACTIVE' ? 'Đang hoạt động' : device.status === 'INACTIVE' ? 'Đã tắt' : device.status || 'Chưa có trạng thái'}</span></div><h3 className="mt-4 break-words font-semibold">{device.customName || device.name || device.deviceId}</h3><p className="mt-1 break-all text-xs text-zinc-500">{device.deviceId}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs"><span>Cửa hàng #{device.storeId || '—'}</span><span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300"><Battery className="h-4 w-4" />{device.batteryLevel == null ? 'Chưa có mức pin' : `${device.batteryLevel}%`}</span></div></button>)}</div>{!visible.length && <p className="py-12 text-center text-sm text-zinc-500">Không có thiết bị phù hợp.</p>}<div className="flex items-center justify-between gap-3 text-sm text-zinc-500"><span>{filtered.length} thiết bị · Trang {Math.min(page, pages)}/{pages}</span><div className="flex gap-2"><button aria-label="Trang trước" disabled={page <= 1} onClick={() => setPage(value => value - 1)} className={workflowSecondary}><ChevronLeft className="h-4 w-4" /></button><button aria-label="Trang sau" disabled={page >= pages} onClick={() => setPage(value => value + 1)} className={workflowSecondary}><ChevronRight className="h-4 w-4" /></button></div></div></>}
    <WorkflowDialog open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.customName || selected?.name || 'Chi tiết thiết bị'} description={selected?.deviceId}><WorkflowNotice tone="error">{detailError}</WorkflowNotice>{detailLoading ? <WorkflowLoading /> : <><dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-xs text-zinc-500">Cửa hàng</dt><dd className="mt-1">#{detail?.storeId || selected?.storeId || '—'}</dd></div><div><dt className="text-xs text-zinc-500">Pin (minh họa)</dt><dd className="mt-1">{latest?.batteryLevel == null ? 'Chưa có dữ liệu' : `${latest.batteryLevel}%`}</dd></div><div><dt className="text-xs text-zinc-500">Wi-Fi (minh họa)</dt><dd className="mt-1">{latest?.wifiRSSI == null ? 'Chưa có dữ liệu' : `${latest.wifiRSSI} dBm`}</dd></div><div><dt className="text-xs text-zinc-500">Phiên bản thiết bị</dt><dd className="mt-1 break-all">{latest?.firmwareVersion || 'Chưa có dữ liệu'}</dd></div></dl><WorkflowNotice>Thông tin pin và Wi-Fi hiện là dữ liệu minh họa từ hệ thống, chưa dùng để đánh giá thiết bị thực tế. Lịch sử đo chưa sẵn sàng.</WorkflowNotice></>}</WorkflowDialog>
  </WorkflowReveal>;
};
