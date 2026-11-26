import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Bluetooth, Check, CheckCircle2, Eye, EyeOff, Loader2, RefreshCw, Wifi, X } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { connectBle, finishPairedProduct, DEVICE_SYNC_EVENT, deviceData, deviceId, deviceProductIds, readConnectionDraft, readScopedDevice, rememberBleReceipt, rescanBleWifiNetworks, saveConnectionDraft, saveDeviceProduct, sendBleWifi } from '../../services/device-connection';
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
  const [scannedNetworks, setScannedNetworks] = useState<string[]>([]);
  const [manualSsidMode, setManualSsidMode] = useState(false);
  const [wifiPassword, setWifiPassword] = useState('');
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [wifiVerifiedIp, setWifiVerifiedIp] = useState('');
  const [wifiCheckError, setWifiCheckError] = useState('');
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
    if (!isOpen || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      if (typeof window.removeEventListener === 'function') {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [isOpen, busy, onClose]);
  useEffect(() => {
    alive.current = isOpen; generation.current++;
    if (isOpen) {
      setStep('DISCOVER'); setRecord(null); setSession(null); setPairCode(''); setError(''); setNotice(''); setCatalog([]); setScannedNetworks([]); setManualSsidMode(false); setSsid(''); setWifiPassword(''); setShowWifiPassword(false); setWifiVerifiedIp(''); setWifiCheckError(''); setBusy(''); setUncertain(false); locked.current = false; confirmationSent.current = false;
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
      const list = Array.isArray(found.networks) ? found.networks : [];
      setScannedNetworks(list);
      if (list.length > 0) {
        setManualSsidMode(false);
        setSsid(prev => (prev && list.includes(prev) ? prev : list[0]));
      }
    }
    if (!code) throw new Error('Nhập mã nút hoặc kết nối Bluetooth để đọc mã thiết bị.');
    const lookup = await lookupPairingDevice(api, code);
    if (ble && lookup.deviceId !== code) throw new Error('Danh tính Bluetooth không khớp dữ liệu máy chủ.');
    if (!active()) return;
    try { saveConnectionDraft(localStorage, user, lookup); } catch { setNotice('Trình duyệt chưa lưu được tiến trình. Thiết bị đã có trên máy chủ vẫn được giữ nguyên.'); }
    setManualCode(lookup.deviceId);
    if (customer && !lookup.isClaimed) {
      setRecord(lookup); setStep('WIFI_CONFIG');
      setNotice(ble
        ? `Đã kết nối nút ${lookup.deviceId}. Nhập tên Wi-Fi 2.4GHz và mật khẩu để nạp trực tiếp cho nút.`
        : `Đã nhận diện nút ${lookup.deviceId}. Kết nối Bluetooth tới nút rồi nhập Wi-Fi 2.4GHz để nạp.`);
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
  const isOwnedRecord = (item: any) =>
    Boolean(
      item?.isClaimed ||
      (user?.customerProfileId && String(item?.customerId || '') === String(user.customerProfileId)),
    );
  const loadCatalog = async () => run('catalog', async active => {
    if (!customer || !record) return;
    const current = await readScopedDevice(api, record.deviceId, user);
    const store = deviceData(await api.get(`/stores/${encodeURIComponent(current.storeId)}`));
    if (String(store.storeId || store.id) !== String(current.storeId) || store.status !== 'ACTIVE') throw new Error('Cửa hàng của nút chưa sẵn sàng.');
    if (!active()) return;
    setRecord({ ...current, isClaimed: true });
    setCatalog((store.products || []).filter((p: any) => p.status === 'ACTIVE' && (!p.storeId || String(p.storeId) === String(current.storeId))));
    setStep('SELECT_PRODUCT');
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
    setRecord({ ...saved, isClaimed: true }); publish(saved);
    if (wifiVerifiedIp) {
      setStep('BOUND_SUCCESS');
      setNotice('Đã lưu sản phẩm cho nút thành công. Wi-Fi và sản phẩm đã sẵn sàng!');
    } else {
      setStep('WIFI_CONFIG');
      setNotice('Máy chủ đã lưu nút và sản phẩm. Nhập Wi-Fi 2.4GHz để nạp cho nút ngay.');
    }
  });
  const checkSaved = async () => run('check', async active => {
    if (!customer || !record) return;
    let saved = await readScopedDevice(api, record.deviceId, user);
    if (selectedProductId) saved = await finishPairedProduct(api, saved, user, session?.storeId || record.storeId, selectedProductId, buttonName, active);
    if (session && String(saved.storeId) !== String(session.storeId)) throw new Error('Cửa hàng của thiết bị không khớp phiên ghép nối.');
    if (!active()) return;
    try { if (customer) clearPairingProgress(sessionStorage, user); } catch {}
    setRecord(saved); publish(saved); setStep('WIFI_CONFIG'); setError(''); setNotice('Máy chủ đã lưu nút và sản phẩm. Nhập Wi-Fi 2.4GHz để nạp cho nút ngay.');
  });
  const deployWifi = async () => run('wifi', async active => {
    if (!customer || !record) return;
    setWifiVerifiedIp('');
    setWifiCheckError('');
    const targetDeviceId = isOwnedRecord(record)
      ? (await readScopedDevice(api, record.deviceId, user)).deviceId
      : record.deviceId;
    if (!active()) return;
    try {
      const result = await sendBleWifi(
        connection.current?.server,
        targetDeviceId,
        ssid,
        wifiPassword,
        (statusText) => { if (active()) setNotice(statusText); },
      );
      if (!active()) return;
      if (result?.status === 'WIFI_CONNECTED') {
        setWifiPassword('');
        setWifiVerifiedIp(result.ip || 'OK');
        if (isOwnedRecord(record)) publish(record);
        try {
          const current = await readScopedDevice(api, record.deviceId, user);
          const store = deviceData(await api.get(`/stores/${encodeURIComponent(current.storeId)}`));
          if (active() && String(store.storeId || store.id) === String(current.storeId) && store.status === 'ACTIVE') {
            setRecord({ ...current, isClaimed: true });
            setCatalog((store.products || []).filter((p: any) => p.status === 'ACTIVE' && (!p.storeId || String(p.storeId) === String(current.storeId))));
            setStep('SELECT_PRODUCT');
            setNotice(`Kết nối Wi-Fi "${ssid.trim()}" thành công${result.ip ? ` (${result.ip})` : ''}! Chọn sản phẩm của cửa hàng để gán cho nút.`);
            return;
          }
        } catch (catalogErr: any) {
          if (active()) {
            const status = catalogErr?.response?.status;
            if (!isOwnedRecord(record) || status === 403) {
              setNotice(`Kết nối Wi-Fi "${ssid.trim()}" thành công${result.ip ? ` (${result.ip})` : ''}! Nút này hiện chưa thuộc tài khoản Khách đang đăng nhập nên chưa mở danh sách sản phẩm.`);
            } else {
              setNotice(`Kết nối Wi-Fi "${ssid.trim()}" thành công${result.ip ? ` (${result.ip})` : ''}! ${pairingError(catalogErr)}`);
            }
          }
          return;
        }
        if (active()) {
          setNotice(`Kết nối Wi-Fi "${ssid.trim()}" thành công${result.ip ? ` (IP: ${result.ip})` : ''}! Bấm "Kiểm tra / chọn sản phẩm" để chọn sản phẩm cho nút.`);
        }
      } else {
        setWifiPassword('');
        setNotice('Đã gửi Wi-Fi tới nút nhưng chưa nhận được phản hồi xác nhận từ mạch (hãy chắc chắn bạn đã Upload bản TanTai.ino mới nhất). Bạn vẫn có thể bấm "Kiểm tra / chọn sản phẩm" bên dưới.');
        if (isOwnedRecord(record)) publish(record);
      }
    } catch (err: any) {
      if (active()) {
        setNotice('');
        setWifiCheckError(pairingError(err));
      }
      throw err;
    }
  });
  const rescanWifi = async () => run('scan', async active => {
    if (!connection.current?.server?.connected) {
      throw new Error('Hãy kết nối Bluetooth tới nút trước khi quét Wi-Fi.');
    }
    const list = await rescanBleWifiNetworks(connection.current.server);
    if (!active()) return;
    setScannedNetworks(list);
    if (list.length > 0) {
      setManualSsidMode(false);
      setSsid(list[0]);
      setNotice(`Đã quét được ${list.length} mạng Wi-Fi 2.4GHz từ nút ${record?.deviceId || ''}.`);
    } else {
      setManualSsidMode(true);
      setNotice('Nút chưa tìm thấy mạng Wi-Fi nào. Bạn có thể nhập tên Wi-Fi thủ công.');
    }
  });
  if (!isOpen) return null;
  const selected = catalog.find(p => String(p.productId || p.id) === selectedProductId);
  return createPortal(<div
    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 responsive-modal overflow-y-auto"
    onClick={(event) => {
      if (event.target === event.currentTarget && !busy) {
        onClose();
      }
    }}
  >
    <motion.section role="dialog" aria-modal="true" aria-labelledby="device-connect-title" initial={reduced ? false : { opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .2 }} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 text-slate-900 shadow-xl dark:bg-zinc-900 dark:text-zinc-100 sm:p-6">
      <header className="flex items-start justify-between gap-3"><div><h2 id="device-connect-title" className="text-lg font-semibold">Kết nối nút bấm thông minh</h2><p className="mt-1 text-sm text-slate-500">{record?.deviceId || 'Đọc mã thật trên nút và đối chiếu với hệ thống.'}</p></div><button type="button" className={secondary} disabled={!!busy} aria-label="Đóng kết nối nút" onClick={onClose}><X size={18} /></button></header>
      <ol className="my-5 flex flex-wrap gap-2 text-xs" aria-label="Tiến trình kết nối">{(customer ? ['Nhận diện nút', 'Xác nhận & cấu hình', 'Đã lưu trên hệ thống'] : ['Đọc ID nút', 'Đối chiếu lô cửa hàng']).map((label, i) => <li key={label} className="rounded-lg bg-sky-50 px-3 py-2 text-[#287DA8] dark:bg-sky-950/40">{i + 1}. {label}</li>)}</ol>
      {notice && <p role="status" className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm leading-6 dark:border-sky-900 dark:bg-sky-950/30">{notice}</p>}
      {error && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{error}</p>}
      {step === 'DISCOVER' && <div className="space-y-4">{customer && <Link to="/customer/pair-device" onClick={onClose} className={secondary}>Khôi phục / kiểm tra ghép nối đã gửi</Link>}<button type="button" disabled={!!busy} onClick={() => void identify(true)} className={primary + ' w-full'}>{busy ? <Loader2 size={18} className="motion-safe:animate-spin" /> : <Bluetooth size={18} />}Tìm & kết nối Bluetooth</button><form onSubmit={event => { event.preventDefault(); void identify(false); }}><label className="block text-sm">Hoặc kiểm tra mã nút đã có<input value={manualCode} onChange={e => setManualCode(e.target.value)} className={field} required disabled={!!busy} autoComplete="off" /></label><button disabled={!!busy} className={secondary + ' mt-3'}>Kiểm tra nút trên hệ thống</button></form></div>}
      {step === 'PAIRING' && <div className="space-y-4"><p className="text-sm leading-6">Nút đang thuộc cửa hàng cấp phát. Ghép nối bằng mã do cửa hàng cung cấp để giữ đúng nút và đúng cửa hàng.</p><label className="block text-sm">Mã ghép nối hoặc nội dung QR<input value={pairCode} onChange={e => setPairCode(e.target.value)} className={field} disabled={!!busy || uncertain} autoComplete="off" /></label><button type="button" disabled={!!busy || !pairCode.trim() || uncertain} onClick={() => void pairCustomer()} className={primary}>Kiểm tra mã ghép nối</button>{uncertain && <Link to={'/customer/pair-device?deviceId=' + encodeURIComponent(record.deviceId)} onClick={onClose} className={secondary}>Mở trang kiểm tra ghép nối</Link>}</div>}
      {step === 'IDENTIFIED' && !customer && <div className="space-y-4"><CheckCircle2 className="h-9 w-9 text-[#287DA8]" /><h3 className="font-semibold">Đã đối chiếu ID với kho cửa hàng</h3><p className="text-sm leading-6 text-slate-500">Kết nối này chỉ nhận diện nút trong lô được cấp, không kích hoạt, không đổi Wi-Fi hoặc sản phẩm của khách.</p><button type="button" className={primary} onClick={onClose}>Hoàn tất nhận diện</button></div>}
      {customer && step === 'WIFI_CONFIG' && <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2.5">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${connection.current?.server?.connected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-sky-100 text-[#287DA8] dark:bg-sky-950/60 dark:text-sky-300'}`}>
              <Bluetooth size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{connection.current?.server?.connected ? `Đã kết nối BLE · ${record?.deviceId}` : 'Chưa kết nối Bluetooth'}</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">{connection.current?.server?.connected ? 'Chọn Wi-Fi 2.4GHz bên dưới và nhập mật khẩu' : 'Giữ nút 5 giây rồi bấm Kết nối BLE'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" disabled={!!busy} onClick={() => void identify(true)}>
              <Bluetooth size={14} />{connection.current?.server?.connected ? 'Kết nối lại' : 'Kết nối BLE'}
            </button>
            {connection.current?.server?.connected && (
              <button type="button" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-[#287DA8] hover:bg-sky-100 disabled:opacity-50 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300" disabled={!!busy} onClick={() => void rescanWifi()}>
                <RefreshCw size={14} className={busy === 'scan' ? 'animate-spin' : ''} />{busy === 'scan' ? 'Đang quét…' : 'Quét lại'}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800 dark:text-zinc-200">Mạng Wi-Fi 2.4GHz</span>
            {scannedNetworks.length > 0 && (
              <button type="button" className="text-xs font-medium text-[#287DA8] hover:underline" onClick={() => { setManualSsidMode(v => !v); if (manualSsidMode && scannedNetworks[0]) setSsid(scannedNetworks[0]); else if (!manualSsidMode) setSsid(''); }}>
                {manualSsidMode ? `Chọn từ ${scannedNetworks.length} mạng đã quét` : 'Nhập tên Wi-Fi thủ công'}
              </button>
            )}
          </div>
          {scannedNetworks.length > 0 && !manualSsidMode ? (
            <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-950/40">
              {scannedNetworks.map(net => {
                const activeItem = ssid === net;
                return (
                  <button
                    key={net}
                    type="button"
                    disabled={!!busy}
                    onClick={() => { setSsid(net); setWifiVerifiedIp(''); setError(''); }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-all ${activeItem ? 'border border-[#287DA8] bg-white font-semibold text-[#287DA8] shadow-sm dark:bg-zinc-900 dark:text-sky-300' : 'border border-transparent text-slate-700 hover:bg-white/80 dark:text-zinc-300 dark:hover:bg-zinc-900/60'}`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Wifi size={16} className={activeItem ? 'text-[#287DA8] shrink-0' : 'text-slate-400 shrink-0'} />
                      <span className="truncate">{net}</span>
                    </span>
                    {activeItem && <Check size={16} className="shrink-0 text-[#287DA8]" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <input value={ssid} onChange={e => { setSsid(e.target.value); setWifiVerifiedIp(''); }} className={field} disabled={!!busy} autoComplete="off" placeholder="Nhập tên Wi-Fi 2.4GHz nhà bạn" />
          )}
        </div>

        <label className="block text-sm font-semibold text-slate-800 dark:text-zinc-200">
          Mật khẩu Wi-Fi
          <div className="relative mt-2">
            <input
              type={showWifiPassword ? 'text' : 'password'}
              value={wifiPassword}
              onChange={e => { setWifiPassword(e.target.value); setWifiVerifiedIp(''); }}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-11 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-950"
              disabled={!!busy}
              autoComplete="new-password"
              placeholder="Nhập mật khẩu Wi-Fi để nút kiểm tra"
            />
            <button
              type="button"
              aria-label={showWifiPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              onClick={() => setShowWifiPassword(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800"
            >
              {showWifiPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        {wifiCheckError && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <X size={16} className="shrink-0 text-rose-600" />
            <span>{wifiCheckError}</span>
          </div>
        )}
        {wifiVerifiedIp && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span>Mật khẩu chính xác — nút đã kết nối Wi-Fi{wifiVerifiedIp !== 'OK' ? ` (${wifiVerifiedIp})` : ''}!</span>
          </div>
        )}

        <button type="button" className={`${primary} w-full`} disabled={!!busy || !ssid.trim()} onClick={() => void deployWifi()}>
          {busy === 'wifi' ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
          {busy === 'wifi' ? 'Đang kiểm tra mật khẩu Wi-Fi…' : 'Gửi & kiểm tra Wi-Fi trên nút'}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={!!busy} className={secondary} onClick={() => void loadCatalog()}>Kiểm tra / chọn sản phẩm</button>
          <button type="button" disabled={!!busy} className={secondary} onClick={onClose}>Hoàn tất & đóng</button>
        </div>
      </div>}
      {customer && step === 'SELECT_PRODUCT' && <div className="space-y-4">
        {wifiVerifiedIp && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
            <span>Wi-Fi đã kết nối{wifiVerifiedIp !== 'OK' ? ` (${wifiVerifiedIp})` : ''} · Chọn sản phẩm bên dưới</span>
          </div>
        )}
        <label className="block text-sm font-semibold text-slate-800 dark:text-zinc-200">Tên nút<input value={buttonName} onChange={e => setButtonName(e.target.value)} className={field} maxLength={100} disabled={!!busy || confirmationSent.current} /></label>
        <div className="space-y-2">
          <span className="block text-sm font-semibold text-slate-800 dark:text-zinc-200">Sản phẩm của cửa hàng ({catalog.length})</span>
          {catalog.length > 0 ? (
            <div className="max-h-60 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-950/40">
              {catalog.map(p => {
                const pid = String(p.productId || p.id);
                const activeProd = selectedProductId === pid;
                const priceNum = Number(p.basePrice ?? p.price);
                return (
                  <button
                    key={pid}
                    type="button"
                    disabled={!!busy || confirmationSent.current}
                    onClick={() => setSelectedProductId(pid)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl p-2.5 text-left transition-all ${activeProd ? 'border border-[#287DA8] bg-white shadow-sm dark:bg-zinc-900' : 'border border-transparent hover:bg-white/80 dark:hover:bg-zinc-900/60'}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {p.thumbnailUrl || p.imageUrl ? (
                        <img src={p.thumbnailUrl || p.imageUrl} alt={p.productName || p.name} className="h-11 w-11 shrink-0 rounded-lg border border-slate-100 object-cover" />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#287DA8]"><Wifi size={18} /></span>
                      )}
                      <div className="min-w-0">
                        <p className={`truncate text-sm ${activeProd ? 'font-bold text-[#287DA8] dark:text-sky-300' : 'font-medium text-slate-800 dark:text-zinc-200'}`}>{p.productName || p.name}</p>
                        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">{Number.isFinite(priceNum) ? `${priceNum.toLocaleString('vi-VN')} ₫` : ''}</p>
                      </div>
                    </div>
                    {activeProd && <Check size={18} className="shrink-0 text-[#287DA8]" />}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 p-3 text-sm text-slate-500">Chưa có sản phẩm đang bán trong cửa hàng của nút.</p>
          )}
        </div>
        {confirmationSent.current ? <button type="button" disabled={!!busy} className={`${primary} w-full`} onClick={() => void checkSaved()}><RefreshCw size={16} />Kiểm tra kết quả đã lưu</button> : <button type="button" disabled={!!busy || !selectedProductId || !buttonName.trim()} className={`${primary} w-full`} onClick={() => void saveProduct()}>{busy === 'save' ? 'Đang lưu…' : customer && session ? 'Xác nhận lưu nút vào tài khoản' : 'Lưu sản phẩm cho nút'}</button>}
      </div>}
      {customer && step === 'BOUND_SUCCESS' && <div className="space-y-4"><CheckCircle2 className="h-10 w-10 text-emerald-600" /><h3 className="font-semibold">Đã xác nhận dữ liệu lưu trên máy chủ</h3><p className="text-sm">Nút {record.deviceId} · {record.product?.name || record.products?.[0]?.productName || 'Sản phẩm đã lưu'}</p><p className="text-sm text-slate-500">Bạn có thể tải lại trang. Nút giữ nguyên ID, cửa hàng và sản phẩm; trạng thái mạng được cập nhật riêng.</p><button type="button" disabled={!!busy} className={secondary} onClick={() => setStep('WIFI_CONFIG')}>Kết nối Wi-Fi cho nút này</button><button type="button" className={primary} onClick={onClose}>Hoàn tất & đóng</button></div>}
      {!!busy && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-[#287DA8]"><Loader2 size={16} className="motion-safe:animate-spin" />Đang kiểm tra dữ liệu thực tế…</p>}
    </motion.section>
  </div>, document.body);
};
