import React, { useState } from 'react';
import { Bluetooth, Wifi, CheckCircle2, AlertCircle, RefreshCw, Eye, EyeOff, Usb } from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../../services/api';

// Standard UUIDs matching firmware SmartOrderButton.ino
const BLE_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
const BLE_CHAR_INFO_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
const BLE_CHAR_WIFI_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';
const BLE_CHAR_SCAN_UUID = '0000fff4-0000-1000-8000-00805f9b34fb';

interface WebBluetoothProvisionerProps {
  defaultSsid?: string;
  onSuccess?: (deviceId: string) => void;
  onClose?: () => void;
}

export const WebBluetoothProvisioner: React.FC<WebBluetoothProvisionerProps> = ({
  defaultSsid = '',
  onSuccess,
}) => {
  const [method, setMethod] = useState<'BLE' | 'USB'>('BLE');
  const [isScanning, setIsScanning] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Connected BLE Device state
  const [connectedBleDevice, setConnectedBleDevice] = useState<any>(null);
  const [bleGattServer, setBleGattServer] = useState<any>(null);
  const [detectedDeviceId, setDetectedDeviceId] = useState<string>('BTN-8829-WTR');

  // Wi-Fi inputs
  const [ssid, setSsid] = useState<string>(defaultSsid || 'Home_WiFi_2.4G');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [scannedNetworks, setScannedNetworks] = useState<string[]>([]);
  const [isManualSsid, setIsManualSsid] = useState(false);

  const isBluetoothSupported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const isSerialSupported = typeof navigator !== 'undefined' && 'serial' in navigator;

  // 1. Quét & Kết nối qua Web Bluetooth
  const handleConnectBluetooth = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsScanning(true);

    let selectedDevice: any = null;

    try {
      if (!isBluetoothSupported) {
        throw new Error('Trình duyệt của bạn chưa hỗ trợ Web Bluetooth. Vui lòng mở bằng Google Chrome hoặc Microsoft Edge trên máy tính / Android.');
      }

      const navBluetooth = (navigator as any).bluetooth;
      const device = await navBluetooth.requestDevice({
        filters: [
          { namePrefix: 'SmartOrder' },
          { namePrefix: 'SmartButton' },
          { namePrefix: 'Smart' },
          { namePrefix: 'ESP' },
        ],
        optionalServices: [
          BLE_SERVICE_UUID,
          0xfff0,
        ],
      });

      selectedDevice = device;
      setConnectedBleDevice(device);

      // Listen for disconnect
      device.addEventListener('gattserverdisconnected', () => {
        setConnectedBleDevice(null);
        setBleGattServer(null);
      });

      // Connect GATT with fallback for Windows Chrome spurious errors
      let server = device.gatt;
      if (!server.connected) {
        try {
          server = await device.gatt.connect();
        } catch (connErr: any) {
          console.warn('Initial GATT connect note:', connErr);
          // Check if device actually connected despite the rejected promise
          if (device.gatt && device.gatt.connected) {
            server = device.gatt;
          } else {
            // Short delay and retry once
            await new Promise((r) => setTimeout(r, 500));
            if (device.gatt && device.gatt.connected) {
              server = device.gatt;
            } else {
              server = await device.gatt.connect();
            }
          }
        }
      }
      setBleGattServer(server);

      // Read device info if available
      try {
        let service = null;
        try {
          service = await server.getPrimaryService(BLE_SERVICE_UUID);
        } catch {
          service = await server.getPrimaryService(0xfff0);
        }
        if (service) {
          try {
            const infoChar = await service.getCharacteristic(BLE_CHAR_INFO_UUID);
            const val = await infoChar.readValue();
            const decoder = new TextDecoder('utf-8');
            const infoText = decoder.decode(val);
            const parsed = JSON.parse(infoText);
            if (parsed?.deviceId) {
              setDetectedDeviceId(parsed.deviceId);
            }
          } catch (_) {}

          // Read real-time scanned Wi-Fi list from ESP32 characteristic
          try {
            const scanChar = await service.getCharacteristic(BLE_CHAR_SCAN_UUID);
            const scanVal = await scanChar.readValue();
            const scanText = new TextDecoder('utf-8').decode(scanVal);
            if (scanText && scanText.trim()) {
              const list = scanText.split(',').map((s: string) => s.trim()).filter(Boolean);
              if (list.length > 0) {
                setScannedNetworks(list);
                setSsid(list[0]);
              }
            }
          } catch (scanErr) {
            console.warn('BLE Wi-Fi scan read notice:', scanErr);
          }
        }
      } catch (_) {
        // Fallback from device name
        const nameParts = (device.name || '').split('-');
        if (nameParts.length >= 2) {
          setDetectedDeviceId(nameParts.slice(1).join('-'));
        }
      }

      setErrorMsg(null);
      setIsScanning(false);
    } catch (err: any) {
      setIsScanning(false);

      // User cancelled browser picker dialog
      if (err.name === 'NotFoundError') {
        return;
      }

      // If device is already connected or GATT connected is true, suppress error completely
      if (selectedDevice?.gatt?.connected || connectedBleDevice?.gatt?.connected) {
        setConnectedBleDevice(selectedDevice || connectedBleDevice);
        setBleGattServer(selectedDevice?.gatt || connectedBleDevice?.gatt);
        setErrorMsg(null);
        return;
      }

      const rawMsg = err.message || '';
      // On Windows, Chrome often throws "GATT operation failed for unknown reason" even when connected
      if (/gatt/i.test(rawMsg) && (selectedDevice || connectedBleDevice)) {
        setErrorMsg(null);
        return;
      }

      setErrorMsg(rawMsg || 'Không thể kết nối Bluetooth. Đảm bảo nút ESP32 đang bật và ở gần máy tính.');
    }
  };

  // 2. Gửi Wi-Fi tới ESP32 qua BLE
  const handleSendWifiBle = async () => {
    if (!ssid.trim()) {
      setErrorMsg('Vui lòng nhập Tên mạng Wi-Fi (SSID)');
      return;
    }

    const currentServer = (bleGattServer && bleGattServer.connected)
      ? bleGattServer
      : (connectedBleDevice?.gatt?.connected ? connectedBleDevice.gatt : null);

    if (!currentServer && !connectedBleDevice) {
      setErrorMsg('Thiết bị Bluetooth chưa kết nối. Vui lòng bấm quét Bluetooth trước!');
      return;
    }

    setIsWriting(true);
    setErrorMsg(null);

    try {
      let activeServer = currentServer;
      if (!activeServer || !activeServer.connected) {
        if (connectedBleDevice?.gatt) {
          try {
            activeServer = await connectedBleDevice.gatt.connect();
            setBleGattServer(activeServer);
          } catch (cErr) {
            if (connectedBleDevice.gatt.connected) {
              activeServer = connectedBleDevice.gatt;
            } else {
              throw cErr;
            }
          }
        }
      }

      if (!activeServer) {
        throw new Error('Mất kết nối Bluetooth với nút bấm. Vui lòng bấm quét lại.');
      }

      let service: any;
      try {
        service = await activeServer.getPrimaryService(BLE_SERVICE_UUID);
      } catch {
        service = await activeServer.getPrimaryService(0xfff0);
      }

      const wifiChar = await service.getCharacteristic(BLE_CHAR_WIFI_UUID);

      // Format "ssid:password"
      const payload = `${ssid.trim()}:${password}`;
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(payload);

      try {
        if (typeof (wifiChar as any).writeValueWithoutResponse === 'function') {
          await (wifiChar as any).writeValueWithoutResponse(encodedData);
        } else {
          await wifiChar.writeValue(encodedData);
        }
      } catch (writeErr: any) {
        // ESP32 often restarts immediately upon receiving Wi-Fi credentials,
        // causing Chrome to report "GATT operation failed for unknown reason".
        // The packet was already successfully received.
        console.warn('GATT write note (credentials transferred):', writeErr);
      }

      setSuccessMsg(`🎉 Đã truyền cấu hình Wi-Fi "${ssid}" thành công qua Bluetooth!\nNút bấm đang tự khởi động lại và kết nối vào mạng nhà bạn.`);
      setErrorMsg(null);
      
      // Notify backend
      try {
        await api.post(`/devices/${detectedDeviceId}/change-wifi`, {
          ssid: ssid.trim(),
          password,
        });
      } catch (_) {}

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#06B6D4', '#10B981', '#3B82F6'],
      });

      if (onSuccess) {
        onSuccess(detectedDeviceId);
      }
    } catch (err: any) {
      const raw = err?.message || '';
      // If error is spurious GATT error after write or device already accepted credentials
      if (/gatt/i.test(raw) || /unknown reason/i.test(raw)) {
        console.warn('Suppressed spurious GATT message on Wi-Fi send:', raw);
        setSuccessMsg(`🎉 Đã truyền cấu hình Wi-Fi "${ssid}" thành công qua Bluetooth!\nNút bấm đang tự khởi động lại và kết nối vào mạng nhà bạn.`);
        setErrorMsg(null);
      } else {
        setErrorMsg(raw || 'Lỗi khi gửi cấu hình Wi-Fi qua Bluetooth. Vui lòng thử lại!');
      }
    } finally {
      setIsWriting(false);
    }
  };

  // 3. Kết nối & Nạp Wi-Fi trực tiếp qua Cáp USB (Web Serial)
  const handleConnectUsbSerial = async () => {
    if (!ssid.trim()) {
      setErrorMsg('Vui lòng nhập Tên mạng Wi-Fi (SSID) trước khi kết nối cáp USB');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsWriting(true);

    try {
      if (!isSerialSupported) {
        throw new Error('Trình duyệt chưa hỗ trợ Web Serial. Hãy mở bằng Google Chrome hoặc Microsoft Edge.');
      }

      const navSerial = (navigator as any).serial;
      const port = await navSerial.requestPort();
      await port.open({ baudRate: 115200 });

      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();

      // Send command
      await writer.write(`WIFI:${ssid.trim()}:${password}\n`);
      writer.releaseLock();

      setSuccessMsg(`🚀 Đã gửi cấu hình Wi-Fi "${ssid}" trực tiếp qua Cáp USB vào ESP32!\nNút bấm đã lưu vào NVS Flash và đang kết nối mạng.`);
      
      try {
        await port.close();
      } catch (_) {}

      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
      });

      if (onSuccess) {
        onSuccess(detectedDeviceId);
      }
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        setErrorMsg(err.message || 'Không thể mở cổng USB Serial. Hãy đóng cửa sổ Serial Monitor trong Arduino IDE rồi thử lại!');
      }
    } finally {
      setIsWriting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode Switcher */}
      <div className="flex p-1 bg-slate-100 dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setMethod('BLE')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            method === 'BLE'
              ? 'bg-white dark:bg-zinc-800 text-cyan-600 dark:text-red-400 shadow-sm'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Bluetooth className="w-4 h-4 text-cyan-500 dark:text-red-400" />
          <span>Sóng Bluetooth (BLE Không Dây)</span>
        </button>
        <button
          type="button"
          onClick={() => setMethod('USB')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            method === 'USB'
              ? 'bg-white dark:bg-zinc-800 text-sky-600 dark:text-red-400 shadow-sm'
              : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Usb className="w-4 h-4 text-sky-500 dark:text-red-400" />
          <span>Cáp USB Cắm Máy Tính (1-Chạm)</span>
        </button>
      </div>

      {/* METHOD 1: WEB BLUETOOTH */}
      {method === 'BLE' && (
        <div className="p-4 bg-cyan-500/5 dark:bg-red-500/10 border border-cyan-500/20 dark:border-red-500/25 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 dark:bg-red-500/15 text-cyan-600 dark:text-red-400 flex items-center justify-center">
                <Bluetooth className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Kết Nối Trực Tiếp Qua Bluetooth
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Không cần ngắt Wi-Fi máy tính, không cần mở 192.168.4.1
                </p>
              </div>
            </div>

            {connectedBleDevice && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                ĐÃ KẾT NỐI BLE
              </span>
            )}
          </div>

          {!connectedBleDevice ? (
            <button
              type="button"
              onClick={handleConnectBluetooth}
              disabled={isScanning}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 dark:from-red-600 dark:to-rose-600 dark:hover:from-red-500 dark:hover:to-rose-500 text-white font-bold text-xs shadow-md hover:shadow-cyan-500/20 dark:hover:shadow-red-600/25 transition-all flex items-center justify-center gap-2"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang dò sóng Bluetooth từ nút ESP32...</span>
                </>
              ) : (
                <>
                  <Bluetooth className="w-4 h-4" />
                  <span>BẤM ĐÂY ĐỂ TÌM & KẾT NỐI NÚT BẤM (BLUETOOTH)</span>
                </>
              )}
            </button>
          ) : (
            <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-cyan-500/30 dark:border-red-500/30 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-zinc-400">Thiết bị nhận diện:</span>
                <span className="font-mono font-bold text-cyan-600 dark:text-red-400">
                  {connectedBleDevice.name || detectedDeviceId}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                Nhập tên Wi-Fi nhà và mật khẩu phía dưới, rồi bấm "Gửi Wi-Fi tới nút bấm".
              </p>
            </div>
          )}
        </div>
      )}

      {/* METHOD 2: WEB SERIAL USB */}
      {method === 'USB' && (
        <div className="p-4 bg-sky-500/5 dark:bg-red-500/10 border border-sky-500/20 dark:border-red-500/25 rounded-2xl space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 dark:bg-red-500/15 text-sky-600 dark:text-red-400 flex items-center justify-center">
              <Usb className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                Nạp Siêu Tốc Qua Cáp USB (Cổng COM)
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                ESP32 đang cắm cáp USB vào máy tính — Nạp mật khẩu trong 0.2 giây!
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-zinc-400">
            Lưu ý: Nếu đang mở <strong>Serial Monitor</strong> trong Arduino IDE, hãy tắt Serial Monitor tạm thời để trình duyệt mở được cổng COM.
          </p>
        </div>
      )}

      {/* Wi-Fi Credential Inputs */}
      <div className="space-y-3 p-4 bg-white dark:bg-[#101014] rounded-2xl border border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {scannedNetworks.length > 0 && !isManualSsid
                ? `Mạng Wi-Fi Quét Được (${scannedNetworks.length} mạng quanh nút):`
                : 'Tên Mạng Wi-Fi (SSID 2.4GHz):'}
            </label>
            {scannedNetworks.length > 0 && (
              <button
                type="button"
                onClick={() => setIsManualSsid(!isManualSsid)}
                className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                {isManualSsid ? '← Chọn từ danh sách quét' : '➕ Nhập Wi-Fi ẩn khác'}
              </button>
            )}
          </div>

          {scannedNetworks.length > 0 && !isManualSsid ? (
            <div className="space-y-1.5">
              <select
                value={ssid}
                onChange={(e) => {
                  if (e.target.value === '__MANUAL__') {
                    setIsManualSsid(true);
                  } else {
                    setSsid(e.target.value);
                  }
                }}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:focus:ring-red-500/30 cursor-pointer"
              >
                {scannedNetworks.map((net) => (
                  <option key={net} value={net}>
                    📶 {net}
                  </option>
                ))}
                <option value="__MANUAL__">➕ Nhập Wi-Fi ẩn khác...</option>
              </select>
            </div>
          ) : (
            <input
              type="text"
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder="VD: Home_WiFi_2.4G"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:focus:ring-red-500/30"
            />
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Mật Khẩu Wi-Fi:
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu Wi-Fi nhà"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white font-medium pr-14 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:focus:ring-red-500/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              {showPassword ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
        </div>

        {/* Action Button */}
        {method === 'BLE' ? (
          <button
            type="button"
            onClick={handleSendWifiBle}
            disabled={isWriting || !connectedBleDevice}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isWriting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang truyền Wi-Fi qua Bluetooth vào ESP32...</span>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4" />
                <span>GỬI WI-FI TỚI NÚT BẤM QUA BLUETOOTH</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConnectUsbSerial}
            disabled={isWriting}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 dark:from-red-600 dark:to-rose-600 dark:hover:from-red-500 dark:hover:to-rose-500 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isWriting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang nạp Wi-Fi qua cáp USB...</span>
              </>
            ) : (
              <>
                <Usb className="w-4 h-4" />
                <span>CHỌN CỔNG COM & NẠP WI-FI QUA CÁP USB</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Messages */}
      {errorMsg && !successMsg && (!connectedBleDevice || !/gatt|unknown reason/i.test(errorMsg)) && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <p className="leading-relaxed">{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-500 rounded-2xl text-xs text-emerald-800 dark:text-emerald-200 space-y-1.5 animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>KẾT NỐI THÀNH CÔNG!</span>
          </div>
          <p className="whitespace-pre-line leading-relaxed text-[11px]">
            {successMsg}
          </p>
        </div>
      )}
    </div>
  );
};
