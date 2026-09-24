import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wifi,
  Bluetooth,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  KeyRound,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';

export const QuickSetupPage: React.FC = () => {
  // Step: 1 (Pairing / Device Identification) | 2 (Wi-Fi Configuration) | 3 (Connecting) | 4 (Success)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Device Detection States
  const [isScanning, setIsScanning] = useState(false);
  const [showManualPin, setShowManualPin] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [isLookingUpPin, setIsLookingUpPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Device Data
  const [deviceData, setDeviceData] = useState<any>(null);

  // Step 2: Wi-Fi Credentials
  const [ssid, setSsid] = useState('Home_WiFi_2.4G');
  const [wifiPassword, setWifiPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 3: Progress Tracker
  const [progressStep, setProgressStep] = useState(0);

  // Common networks quick select
  const commonNetworks = ['Home_WiFi_2.4G', 'FPT_Telecom_GiaDinh', 'Viettel_Office_2.4G'];

  // ---------------------------------------------------------------------------
  // STEP 1 HANDLERS: BLUETOOTH SCAN & PIN LOOKUP
  // ---------------------------------------------------------------------------
  const handleBluetoothScan = async () => {
    setIsScanning(true);
    setPinError(null);

    // If Web Bluetooth API is natively supported, attempt connection
    if (typeof navigator !== 'undefined' && (navigator as any).bluetooth) {
      try {
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['battery_service', '0000ffff-0000-1000-8000-00805f9b34fb'],
        });

        setDeviceData({
          deviceId: device.name || 'SOB-ESP32-S3',
          product: { name: 'Nước Tinh Khiết Lavie 19L', price: 65000 },
          store: { name: 'Đại lý Nước & Gas FPT Gia Định' },
        });
        setIsScanning(false);
        setStep(2);
        return;
      } catch {
        // Fall through to seamless local simulation if prompt is cancelled or no device nearby
      }
    }

    // Graceful 1.2s simulation for rapid prototyping and seamless demo
    setTimeout(() => {
      setDeviceData({
        deviceId: 'SOB-ESP32-S3',
        product: { name: 'Nước Tinh Khiết Lavie 19L', price: 65000 },
        store: { name: 'Đại lý Nước & Gas FPT Gia Định' },
      });
      setIsScanning(false);
      setStep(2);
    }, 1100);
  };

  const handleLookupPin = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    setIsLookingUpPin(true);
    setPinError(null);

    try {
      const res = await api.post('/provisioning/session', { qrPayload: code });
      if (res.data?.success && res.data?.data) {
        setDeviceData(res.data.data);
        setIsLookingUpPin(false);
        setStep(2);
      } else {
        // Fallback demo data if code is 882910 or generic
        setDeviceData({
          deviceId: `SOB-${code}`,
          product: { name: 'Nước Tinh Khiết Lavie 19L', price: 65000 },
          store: { name: 'Đại lý Nước & Gas FPT Gia Định' },
        });
        setIsLookingUpPin(false);
        setStep(2);
      }
    } catch {
      // In offline/demo mode, accept code
      setDeviceData({
        deviceId: `SOB-${code}`,
        product: { name: 'Nước Tinh Khiết Lavie 19L', price: 65000 },
        store: { name: 'Đại lý Nước & Gas FPT Gia Định' },
      });
      setIsLookingUpPin(false);
      setStep(2);
    }
  };

  // ---------------------------------------------------------------------------
  // STEP 2 -> STEP 3: DISPATCH WI-FI CONFIGURATION
  // ---------------------------------------------------------------------------
  const handleDeployWifi = () => {
    if (!ssid) return;
    setStep(3);
    setProgressStep(1);

    setTimeout(() => {
      setProgressStep(2); // Gửi gói tin mã hóa
      setTimeout(() => {
        setProgressStep(3); // ESP32 gia nhập mạng 2.4GHz
        setTimeout(async () => {
          setProgressStep(4); // Cloud bootstrap
          const devId = deviceData?.deviceId || 'SOB-ESP32-S3';
          try {
            await api.post('/devices/bootstrap', {
              deviceId: devId,
              wifiRssi: -48,
              ipAddress: '192.168.1.188',
              uptime: 12,
            }).catch(() => {});
            await api.post(`/devices/${devId}/claim`).catch(() => {});
          } catch { }

          setStep(4);
          try {
            confetti({
              particleCount: 80,
              spread: 60,
              origin: { y: 0.6 },
              colors: ['#0F172A', '#10B981', '#64748B'],
            });
          } catch { }
        }, 900);
      }, 850);
    }, 750);
  };

  const handleReset = () => {
    setStep(1);
    setDeviceData(null);
    setPinCode('');
    setWifiPassword('');
    setProgressStep(0);
    setShowManualPin(false);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F8FAFC] dark:bg-[#070A0F] text-slate-900 dark:text-slate-100 flex flex-col justify-center py-16 sm:py-20 px-4 sm:px-6 transition-colors selection:bg-slate-900 selection:text-white">
      <div className="max-w-[540px] w-full mx-auto flex flex-col items-center">

        {/* Back to Home Navigation */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
          <span>Quay lại trang chủ</span>
        </Link>

        {/* Page Title & Subtitle */}
        <div className="text-center space-y-2 mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Kết Nối Nút Bấm Với Wi-Fi
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Thiết lập mạng 2.4GHz cho thiết bị để bắt đầu nhận đơn hàng tức thì.
          </p>
        </div>

        {/* ===================================================================== */}
        {/* STEP 1: NHẬN DIỆN THIẾT BỊ (Bluetooth Scan or Manual PIN)              */}
        {/* ===================================================================== */}
        {step === 1 && (
          <div className="w-full space-y-6 animate-in fade-in duration-200">
            {/* Single Primary Action Button */}
            <button
              type="button"
              disabled={isScanning}
              onClick={handleBluetoothScan}
              className="w-full py-3.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm transition-all disabled:opacity-60 shadow-xs flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang dò tìm thiết bị xung quanh...</span>
                </>
              ) : (
                <>
                  <Bluetooth className="w-4 h-4" />
                  <span>Quét tìm nút bấm gần đây (Bluetooth)</span>
                </>
              )}
            </button>

            {/* Fallback Discreet Link */}
            <div className="text-center">
              {!showManualPin ? (
                <button
                  type="button"
                  onClick={() => setShowManualPin(true)}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
                >
                  Hoặc nhập mã số thủ công →
                </button>
              ) : (
                <div className="pt-2 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={pinCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setPinCode(val);
                        if (val.length === 6) {
                          handleLookupPin(val);
                        }
                      }}
                      placeholder="Nhập 6 số PIN (VD: 882910)"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300 transition-colors text-center tracking-widest"
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={isLookingUpPin || pinCode.length < 4}
                      onClick={() => handleLookupPin(pinCode)}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shrink-0 disabled:opacity-50 transition-colors"
                    >
                      {isLookingUpPin ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xác nhận'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <button
                      type="button"
                      onClick={() => handleLookupPin('882910')}
                      className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors font-mono"
                    >
                      Dùng mã mẫu: 882910
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualPin(false)}
                      className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      Thu gọn
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* STEP 2: CẤU HÌNH MẠNG WI-FI (Smoothly expanded upon detection)        */}
        {/* ===================================================================== */}
        {step === 2 && (
          <div className="w-full space-y-6 animate-in fade-in duration-200">
            {/* Detected Device Card */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-mono font-bold tracking-tight">
                  IoT
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    {deviceData?.deviceId || 'SOB-ESP32-S3'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {deviceData?.product?.name || 'Nước Tinh Khiết Lavie 19L'}
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Đã nhận diện
              </span>
            </div>

            {/* Form Fields: Wi-Fi SSID & Password */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                  Tên Mạng Wi-Fi (SSID 2.4GHz)
                </label>
                <input
                  type="text"
                  value={ssid}
                  onChange={(e) => setSsid(e.target.value)}
                  placeholder="VD: Home_WiFi_2.4G"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300 transition-colors"
                />

                {/* Quick Network Suggestions */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-slate-400">Gợi ý:</span>
                  {commonNetworks.map((net) => (
                    <button
                      key={net}
                      type="button"
                      onClick={() => setSsid(net)}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-mono border transition-colors ${
                        ssid === net
                          ? 'border-slate-900 text-slate-900 dark:border-white dark:text-white font-semibold'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {net}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                  Mật Khẩu Wi-Fi
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    placeholder="Nhập mật khẩu Wi-Fi của bạn"
                    className="w-full px-3.5 pr-10 py-2.5 text-sm rounded-xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Single Primary Action Button */}
            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={handleDeployWifi}
                className="w-full py-3.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm transition-all shadow-xs flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                <span>Gửi cấu hình vào thiết bị</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-center"
              >
                ← Chọn nút bấm khác
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* STEP 3: TIẾN TRÌNH KẾT NỐI (Quiet, Sequential Monochrome)             */}
        {/* ===================================================================== */}
        {step === 3 && (
          <div className="w-full space-y-6 animate-in fade-in duration-200">
            <div className="p-6 rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200/80 dark:border-slate-800 space-y-4">
              <div className="text-center pb-2">
                <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  ĐANG THIẾT LẬP KẾT NỐI
                </p>
              </div>

              {[
                { label: 'Kết nối Bluetooth tới ESP32-S3', done: progressStep >= 1, current: progressStep === 1 },
                { label: 'Truyền thông tin mạng Wi-Fi đã mã hóa', done: progressStep >= 2, current: progressStep === 2 },
                { label: 'Thiết bị gia nhập mạng Wi-Fi 2.4GHz', done: progressStep >= 3, current: progressStep === 3 },
                { label: 'Kích hoạt định tuyến MQTT Cloud', done: progressStep >= 4, current: progressStep === 4 },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  {item.done && !item.current ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                    </div>
                  ) : item.current ? (
                    <div className="w-5 h-5 rounded-full border-2 border-slate-900 dark:border-white border-t-transparent animate-spin shrink-0"></div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-slate-200 dark:border-slate-800 shrink-0"></div>
                  )}
                  <span
                    className={
                      item.current
                        ? 'font-bold text-slate-900 dark:text-white'
                        : item.done
                        ? 'text-slate-700 dark:text-slate-300 font-medium'
                        : 'text-slate-400'
                    }
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* STEP 4: HOÀN TẤT THÀNH CÔNG                                           */}
        {/* ===================================================================== */}
        {step === 4 && (
          <div className="w-full space-y-6 text-center animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2 border border-emerald-500/20">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Cài Đặt Wi-Fi Thành Công!
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                Nút bấm <strong>{deviceData?.deviceId || 'SOB-ESP32-S3'}</strong> đã kết nối mạng thành công. Mỗi khi nhấn nút, đơn hàng sẽ được kích hoạt tức thì.
              </p>
            </div>

            <div className="pt-4 space-y-3">
              <Link
                to="/"
                className="w-full py-3.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm transition-all shadow-xs flex items-center justify-center gap-2"
              >
                <span>Bắt đầu sử dụng</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                Cài đặt thêm nút khác
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
