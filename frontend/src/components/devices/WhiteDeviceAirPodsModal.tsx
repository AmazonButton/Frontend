import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Bluetooth, CheckCircle2, Loader2, RefreshCw, Wifi, X } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { connectBle, finishPairedProduct, DEVICE_SYNC_EVENT, deviceData, deviceId, deviceProductIds, readConnectionDraft, readScopedDevice, rememberBleReceipt, saveConnectionDraft, saveDeviceProduct, sendBleWifi } from '../../services/device-connection';
import { clearPairingProgress, savePairingProgress, confirmAtomicPairing, createPairingSession, loadPairingStore, lookupPairingDevice, pairingError, parsePairingInput, readOwnedPairedDevice, verifyPairingSession } from '../../pages/customer/device-pairing.mjs';

interface WhiteDeviceAirPodsModalProps {
  isOpen: boolean; onClose: () => void; onDeviceBound?: (device: any) => void; availableProducts?: any[];
}
const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#287DA8] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-[#206588]';
const secondary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800 disabled:opacity-50';
const field = 'mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950';

export const WhiteDeviceAirPodsModal: React.FC<WhiteDeviceAirPodsModalProps> = ({ isOpen, onClose, onDeviceBound }) => {
  const { user } = useAuth();
  const reduced = useReducedMotion();
  const customer = user?.role === 'CUSTOMER';
  const [step, setStep] = useState<'DISCOVER' | 'IDENTIFIED' | 'PAIRING' | 'WIFI_CONFIG' | 'SELECT_PRODUCT' | 'BOUND_SUCCESS'>('DISCOVER');
  const [record, setRecord] = useState<any>(null);
  const [manualCode, setManualCode] = useState('');
  const [pairCode, setPairCode] = useState('');
  const [session, setSession] = useState<any>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [buttonName, setButtonName] = useState('');
  const [ssid, setSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const connection = useRef<any>(null);
  const locked = useRef(false);
  const generation = useRef(0);
  const alive = useRef(false);
  const confirmationSent = useRef(false);
  useBodyScrollLock(isOpen);
  useEffect(() => {
    alive.current = isOpen; generation.current++;
    if (isOpen) {
      setStep('DISCOVER'); setRecord(null); setSession(null); setPairCode(''); setError(''); setNotice(''); setCatalog([]); setBusy(''); setUncertain(false); locked.current = false; confirmationSent.current = false;
      try { setManualCode(readConnectionDraft(localStorage, user) || ''); } catch { setManualCode(''); }
    }
    return () => { alive.current = false; generation.current++; connection.current?.hardware?.gatt?.disconnect(); connection.current = null; };
  }, [isOpen, user?.id, user?.role]);
  const run = async (kind: string, task: (active: () => boolean) => Promise<void>) => {
    if (locked.current) return;
    locked.current = true; setBusy(kind); setError('');
    const version = generation.current;
    const active = () => alive.current && generation.current === version;
    try { await task(active); } catch (failure) { if (active()) setError(pairingError(failure)); }
    finally { if (active()) { locked.current = false; setBusy(''); } }
  };
  const publish = (saved: any) => { onDeviceBound?.(saved); window.dispatchEvent(new CustomEvent(DEVICE_SYNC_EVENT, { detail: { deviceId: saved.deviceId, storeId: saved.storeId, customerId: saved.customerId, device: saved } })); };
  const identify = async (ble: boolean) => run('identify', async active => {
    let code = manualCode.trim();
    if (ble) {
      const found = await connectBle(navigator);
      if (!active()) { found.hardware.gatt.disconnect(); return; }
      connection.current?.hardware?.gatt?.disconnect(); connection.current = found; code = found.info.deviceId;
    }
    if (!code) throw new Error('Nhập mã nút hoặc kết nối Bluetooth để đọc mã thiết bị.');
    const lookup = await lookupPairingDevice(api, code);
    if (ble && lookup.deviceId !== code) throw new Error('Danh tính Bluetooth không khớp dữ liệu máy chủ.');
    if (!active()) return;
    try { saveConnectionDraft(localStorage, user, lookup); } catch { setNotice('Trình duyệt chưa lưu được tiến trình. Thiết bị đã có trên máy chủ vẫn được giữ nguyên.'); }
    setManualCode(lookup.deviceId);
    if (customer && !lookup.isClaimed) {
      setRecord(lookup); setStep('PAIRING');
      setNotice('Đã nhận diện đúng nút. Nhập mã ghép nối của cửa hàng để lưu nút vào tài khoản của bạn.');
      return;
    }
    const saved = await readScopedDevice(api, lookup.deviceId, user);
    if (!active()) return;
    setRecord(saved); setButtonName(saved.customName || saved.name || 'Nút bấm của tôi'); setSelectedProductId(deviceProductIds(saved)[0] || '');
    if (ble && !customer) {
      try { rememberBleReceipt(localStorage, user, saved); } catch { setNotice('Nút vẫn thuộc kho cửa hàng trên máy chủ; chưa lưu được dấu nhận diện BLE trên trình duyệt.'); }
    }
    publish(saved); setStep(customer ? 'WIFI_CONFIG' : 'IDENTIFIED');
    setNotice(customer ? 'Đã xác nhận đúng nút đã lưu trong tài khoản. Đổi Wi-Fi không đổi cửa hàng hoặc sản phẩm.' : 'Đã đối chiếu đúng ID trong lô được cấp cho cửa hàng. Khách hàng sẽ ghép nối, cấu hình Wi-Fi và chọn hàng khi mang nút về nhà.');
  });
  const pairCustomer = async () => run('pair', async active => {
    if (!record || uncertain) return;
    const parsed = pairCode.includes('://') ? parsePairingInput({ qrPayload: pairCode }) : parsePairingInput({ deviceCode: record.deviceId, token: pairCode });
    if (parsed.deviceId.toUpperCase() !== record.deviceId.toUpperCase()) throw new Error('Mã ghép nối thuộc một nút khác.');
    let sent = false;
    try {
      const created = await createPairingSession(api, parsed, () => { sent = true; });
      if (!active()) return;
      setSession(created); setPairCode(''); try { savePairingProgress(sessionStorage, user, { deviceId: created.deviceId, session: created }); } catch {}
      const verified = await verifyPairingSession(api, created);
      const store = await loadPairingStore(api, verified);
      if (!active()) return;
      setSession(verified); setCatalog(store.products); setButtonName('Nút bấm của tôi'); setStep('SELECT_PRODUCT');
    } catch (failure) { if (sent && active()) setUncertain(true); throw failure; }
  });
  const loadCatalog = async () => run('catalog', async active => {
    if (!customer || !record) return;
    const current = await readScopedDevice(api, record.deviceId, user);
    const store = deviceData(await api.get(`/stores/${encodeURIComponent(current.storeId)}`));
    if (String(store.storeId || store.id) !== String(current.storeId) || store.status !== 'ACTIVE') throw new Error('Cửa hàng của nút chưa sẵn sàng.');
    if (!active()) return;
    setRecord(current); setCatalog((store.products || []).filter((p: any) => p.status === 'ACTIVE' && (!p.storeId || String(p.storeId) === String(current.storeId)))); setStep('SELECT_PRODUCT');
  });
  const saveProduct = async () => run('save', async active => {
    if (!customer || !record || !selectedProductId || confirmationSent.current) return;
    if (session) {
      await confirmAtomicPairing(api, session, user, { productId: selectedProductId, buttonName }, () => { if (!active()) throw new Error('Trang kết nối đã đóng.'); confirmationSent.current = true; try { savePairingProgress(sessionStorage, user, { deviceId: session.deviceId, session, confirmationSent: true, productId: selectedProductId, buttonName }); } catch {} });
    } else {
      // The existing server API changes the mapping of the same stored device.
      await saveDeviceProduct(api, record.deviceId, selectedProductId, user, buttonName, () => { confirmationSent.current = true; }, active);
    }
    let saved = session ? await readOwnedPairedDevice(api, record.deviceId, user, { storeId: session.storeId, productId: selectedProductId }) : await readScopedDevice(api, record.deviceId, user);
    if (session) saved = await finishPairedProduct(api, saved, user, session.storeId, selectedProductId, buttonName, active);
    if (!active()) return;
    try { if (customer) clearPairingProgress(sessionStorage, user); } catch {}
    setRecord(saved); publish(saved); setStep('BOUND_SUCCESS'); setNotice('Máy chủ đã lưu nút và sản phẩm. Wi-Fi không làm thay đổi danh tính nút.');
  });
  const checkSaved = async () => run('check', async active => {
    if (!customer || !record) return;
    let saved = await readScopedDevice(api, record.deviceId, user);
    if (selectedProductId) saved = await finishPairedProduct(api, saved, user, session?.storeId || record.storeId, selectedProductId, buttonName, active);
    if (session && String(saved.storeId) !== String(session.storeId)) throw new Error('Cửa hàng của thiết bị không khớp phiên ghép nối.');
    if (!active()) return;
    try { if (customer) clearPairingProgress(sessionStorage, user); } catch {}
    setRecord(saved); publish(saved); setStep('BOUND_SUCCESS'); setError('');
  });
  const deployWifi = async () => run('wifi', async active => {
    if (!customer || !record) return;
    // Verify ownership before transmitting credentials to the physical device.
    const saved = await readScopedDevice(api, record.deviceId, user);
    if (!active()) return;
    await sendBleWifi(connection.current?.server, saved.deviceId, ssid, wifiPassword);
    if (!active()) return;
    setWifiPassword(''); setNotice('Đã gửi cấu hình tới đúng nút qua Bluetooth. Chờ nút khởi động lại và heartbeat để xác nhận kết nối Internet; nút và sản phẩm vẫn được giữ nguyên.');
    publish(saved);
  });
  if (!isOpen) return null;
  const selected = catalog.find(p => String(p.productId || p.id) === selectedProductId);
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 responsive-modal overflow-y-auto">
    <motion.section role="dialog" aria-modal="true" aria-labelledby="device-connect-title" initial={reduced ? false : { opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .2 }} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 text-slate-900 shadow-xl dark:bg-zinc-900 dark:text-zinc-100 sm:p-6">
      <header className="flex items-start justify-between gap-3"><div><h2 id="device-connect-title" className="text-lg font-semibold">Kết nối nút bấm thông minh</h2><p className="mt-1 text-sm text-slate-500">{record?.deviceId || 'Đọc mã thật trên nút và đối chiếu với hệ thống.'}</p></div><button type="button" className={secondary} disabled={!!busy} aria-label="Đóng kết nối nút" onClick={onClose}><X size={18} /></button></header>
      <ol className="my-5 flex flex-wrap gap-2 text-xs" aria-label="Tiến trình kết nối">{(customer ? ['Nhận diện nút', 'Xác nhận & cấu hình', 'Đã lưu trên hệ thống'] : ['Đọc ID nút', 'Đối chiếu lô cửa hàng']).map((label, i) => <li key={label} className="rounded-lg bg-sky-50 px-3 py-2 text-[#287DA8] dark:bg-sky-950/40">{i + 1}. {label}</li>)}</ol>
      {notice && <p role="status" className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm leading-6 dark:border-sky-900 dark:bg-sky-950/30">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{error}</p>}
      {step === 'DISCOVER' && <div className="space-y-4">{customer && <Link to="/customer/pair-device" onClick={onClose} className={secondary}>Khôi phục / kiểm tra ghép nối đã gửi</Link>}<button type="button" disabled={!!busy} onClick={() => void identify(true)} className={primary + ' w-full'}>{busy ? <Loader2 size={18} className="motion-safe:animate-spin" /> : <Bluetooth size={18} />}Tìm & kết nối Bluetooth</button><form onSubmit={event => { event.preventDefault(); void identify(false); }}><label className="block text-sm">Hoặc kiểm tra mã nút đã có<input value={manualCode} onChange={e => setManualCode(e.target.value)} className={field} required disabled={!!busy} autoComplete="off" /></label><button disabled={!!busy} className={secondary + ' mt-3'}>Kiểm tra nút trên hệ thống</button></form></div>}
      {step === 'PAIRING' && <div className="space-y-4"><p className="text-sm leading-6">Nút đang thuộc cửa hàng cấp phát. Ghép nối bằng mã do cửa hàng cung cấp để giữ đúng nút và đúng cửa hàng.</p><label className="block text-sm">Mã ghép nối hoặc nội dung QR<input value={pairCode} onChange={e => setPairCode(e.target.value)} className={field} disabled={!!busy || uncertain} autoComplete="off" /></label><button type="button" disabled={!!busy || !pairCode.trim() || uncertain} onClick={() => void pairCustomer()} className={primary}>Kiểm tra mã ghép nối</button>{uncertain && <Link to={'/customer/pair-device?deviceId=' + encodeURIComponent(record.deviceId)} onClick={onClose} className={secondary}>Mở trang kiểm tra ghép nối</Link>}</div>}
      {step === 'IDENTIFIED' && !customer && <div className="space-y-4"><CheckCircle2 className="h-9 w-9 text-[#287DA8]" /><h3 className="font-semibold">Đã đối chiếu ID với kho cửa hàng</h3><p className="text-sm leading-6 text-slate-500">Kết nối này chỉ nhận diện nút trong lô được cấp, không kích hoạt, không đổi Wi-Fi hoặc sản phẩm của khách.</p><button type="button" className={primary} onClick={onClose}>Hoàn tất nhận diện</button></div>}
      {customer && step === 'WIFI_CONFIG' && <div className="space-y-4"><p className="text-sm leading-6">{customer ? 'Nút đã được lưu cho tài khoản của bạn.' : 'Nút đã có trong lô cửa hàng được cấp phát. Kết nối BLE không tạo nút mới và không chuyển quyền sở hữu.'}</p><button type="button" className={secondary} disabled={!!busy} onClick={() => void identify(true)}><Bluetooth size={16} />Kết nối lại đúng nút qua BLE</button><label className="block text-sm">Tên Wi-Fi 2.4GHz<input value={ssid} onChange={e => setSsid(e.target.value)} className={field} disabled={!!busy} autoComplete="off" /></label><label className="block text-sm">Mật khẩu Wi-Fi<input type="password" value={wifiPassword} onChange={e => setWifiPassword(e.target.value)} className={field} disabled={!!busy} autoComplete="new-password" /></label><button type="button" className={primary} disabled={!!busy || !ssid.trim()} onClick={() => void deployWifi()}><Wifi size={16} />{busy === 'wifi' ? 'Đang gửi cấu hình…' : 'Gửi Wi-Fi tới nút'}</button><div className="flex flex-wrap gap-2"><button type="button" disabled={!!busy} className={secondary} onClick={() => void loadCatalog()}>Kiểm tra / chọn sản phẩm</button><button type="button" disabled={!!busy} className={secondary} onClick={onClose}>Hoàn tất nhận diện</button></div></div>}
      {customer && step === 'SELECT_PRODUCT' && <div className="space-y-4"><label className="block text-sm">Tên nút<input value={buttonName} onChange={e => setButtonName(e.target.value)} className={field} maxLength={100} disabled={!!busy || confirmationSent.current} /></label><label className="block text-sm">Sản phẩm của cửa hàng cấp nút<select value={selectedProductId} onChange={e => setSelectedProductId(e.target.value)} className={field} disabled={!!busy || confirmationSent.current}><option value="">Chọn sản phẩm</option>{catalog.map(p => <option key={p.productId || p.id} value={p.productId || p.id}>{p.productName || p.name}</option>)}</select></label>{selected && <p className="text-sm">{selected.productName || selected.name} · {Number(selected.basePrice ?? selected.price).toLocaleString('vi-VN')} ₫</p>}{confirmationSent.current ? <button type="button" disabled={!!busy} className={primary} onClick={() => void checkSaved()}><RefreshCw size={16} />Kiểm tra kết quả đã lưu</button> : <button type="button" disabled={!!busy || !selectedProductId || !buttonName.trim()} className={primary} onClick={() => void saveProduct()}>{busy === 'save' ? 'Đang lưu…' : customer && session ? 'Xác nhận lưu nút vào tài khoản' : 'Lưu sản phẩm cho đúng nút'}</button>}{!catalog.length && <p className="text-sm text-slate-500">Chưa có sản phẩm đang bán trong cửa hàng của nút.</p>}</div>}
      {customer && step === 'BOUND_SUCCESS' && <div className="space-y-4"><CheckCircle2 className="h-10 w-10 text-emerald-600" /><h3 className="font-semibold">Đã xác nhận dữ liệu lưu trên máy chủ</h3><p className="text-sm">Nút {record.deviceId} · {record.product?.name || record.products?.[0]?.productName || 'Sản phẩm đã lưu'}</p><p className="text-sm text-slate-500">Bạn có thể tải lại trang. Nút giữ nguyên ID, cửa hàng và sản phẩm; trạng thái mạng được cập nhật riêng.</p><button type="button" disabled={!!busy} className={secondary} onClick={() => setStep('WIFI_CONFIG')}>Kết nối Wi-Fi cho nút này</button><button type="button" className={primary} onClick={onClose}>Hoàn tất & đóng</button></div>}
      {!!busy && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-[#287DA8]"><Loader2 size={16} className="motion-safe:animate-spin" />Đang kiểm tra dữ liệu thực tế…</p>}
    </motion.section>
  </div>, document.body);
};
