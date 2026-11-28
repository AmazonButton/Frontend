import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Battery,
  CheckCircle2,
  Cpu,
  Lock,
  MapPin,
  Package,
  Radio,
  RefreshCw,
  ShoppingCart,
  Store,
  Wifi,
  AlertTriangle,
  Info,
  Hand,
} from 'lucide-react';
import { api } from '../../services/api';
import { normalizeDevice } from '../../services/device-connection';
import { deviceRuntime } from '../../services/device-runtime';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../context/ToastContext';
import { getSocket, subscribeToCustomer } from '../../services/socket';

const formatVnd = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(amount) || 0);

const rssiQualityLabel = (rssi: number | null) => {
  if (rssi === null || !Number.isFinite(rssi)) return 'Chưa có tín hiệu';
  if (rssi >= -60) return `Mạnh (${rssi} dBm)`;
  if (rssi >= -75) return `Ổn định (${rssi} dBm)`;
  return `Yếu (${rssi} dBm)`;
};

export const CustomerDeviceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [device, setDevice] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checkingPing, setCheckingPing] = useState(false);
  const [lastPingMessage, setLastPingMessage] = useState<string | null>(null);

  const [showSimulateConfirm, setShowSimulateConfirm] = useState(false);
  const [simulatingOrder, setSimulatingOrder] = useState(false);

  const loadDevice = useCallback(async (isPing = false) => {
    if (!id) return;
    if (isPing) setCheckingPing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await api.get(`/devices/${encodeURIComponent(id)}`);
      const raw = res.data?.data ?? res.data;
      const normalized = normalizeDevice(raw);
      setDevice(normalized);
      if (isPing) {
        const b = normalized.batteryLevel ?? normalized.telemetry?.batteryLevel ?? null;
        const r = normalized.telemetry?.wifiRssi ?? normalized.rssi ?? null;
        const msg = `Đã đồng bộ telemetry lúc ${new Date().toLocaleTimeString('vi-VN')}: Pin ${b !== null ? `${b}%` : '—'}, Wi-Fi ${rssiQualityLabel(r)}.`;
        setLastPingMessage(msg);
        toast.success('Kiểm tra kết nối phần cứng thành công (chưa tạo đơn hàng).');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg =
        status === 404
          ? 'Không tìm thấy thiết bị này hoặc thiết bị đã được gỡ khỏi hệ thống.'
          : status === 403
          ? 'Bạn không có quyền truy cập thiết bị này.'
          : err?.response?.data?.message || 'Không tải được thông tin thiết bị.';
      setError(msg);
      if (isPing) toast.error(msg);
    } finally {
      setLoading(false);
      setCheckingPing(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDevice(false);
  }, [loadDevice]);

  useEffect(() => {
    if (!user?.customerProfileId) return;
    subscribeToCustomer(user.customerProfileId);
    const socket = getSocket();
    const onDeviceEvent = (payload: any) => {
      const targetId = payload?.deviceId || payload?.device?.deviceId || payload?.id;
      if (!targetId || String(targetId) === String(id)) {
        void loadDevice(false);
      }
    };
    socket.on('DEVICE_HEARTBEAT', onDeviceEvent);
    socket.on('DEVICE_PROVISIONED', onDeviceEvent);
    socket.on('device:wifi_changed', onDeviceEvent);
    socket.on('device:product_changed', onDeviceEvent);
    return () => {
      socket.off('DEVICE_HEARTBEAT', onDeviceEvent);
      socket.off('DEVICE_PROVISIONED', onDeviceEvent);
      socket.off('device:wifi_changed', onDeviceEvent);
      socket.off('device:product_changed', onDeviceEvent);
    };
  }, [user?.customerProfileId, id, loadDevice]);

  const handleConfirmRealOrderPress = async () => {
    if (!id) return;
    setSimulatingOrder(true);
    try {
      const res = await api.post(
        `/devices/${encodeURIComponent(id)}/simulate-press`,
        {},
        {
          headers: {
            'Idempotency-Key': `sim-${id}-${Date.now()}`,
          },
        }
      );
      if (res.data?.success) {
        toast.success('Đã gửi lệnh đặt đơn thành công! Bạn có thể theo dõi tại Đơn hàng của tôi.');
        setShowSimulateConfirm(false);
        navigate('/customer/orders');
      } else {
        throw new Error(res.data?.message || 'Không thể đặt đơn từ nút bấm.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Không thể đặt đơn thử trên thiết bị.');
    } finally {
      setSimulatingOrder(false);
    }
  };

  if (loading && !device) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Đang tải thông số phần cứng & cấu hình nút bấm...
        </div>
      </div>
    );
  }

  if (error && !device) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        <Link
          to="/customer/home"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#0E6BA8] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Nút của tôi</span>
        </Link>
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 space-y-2">
          <div className="flex items-center gap-2 text-rose-700 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Không thể mở chi tiết thiết bị</span>
          </div>
          <p className="text-xs text-rose-600">{error}</p>
        </div>
      </div>
    );
  }

  const runtime = device ? deviceRuntime(device) : null;
  const battery = device?.batteryLevel ?? device?.telemetry?.batteryLevel ?? null;
  const rssi = device?.telemetry?.wifiRssi ?? device?.rssi ?? null;
  const unitPrice = Number(device?.product?.price || device?.deployedTemplate?.productPrice || 0);
  const qty = Number(device?.defaultQuantity || 1);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/customer/home"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E6BA8] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại Nút của tôi</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-[#0E6BA8]" />
            <span>{device?.customName || device?.deviceName || device?.buttonCode || `Thiết bị #${id}`}</span>
          </h1>
          <p className="text-xs text-slate-500">
            Mã phần cứng: <span className="font-mono font-semibold text-slate-700">{device?.buttonCode || device?.serialNumber || device?.deviceId}</span>
            {device?.macAddress ? ` · MAC ${device.macAddress}` : ''}
          </p>
        </div>

        {/* Separated Hardware Check vs Real Simulate Order */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={checkingPing}
            onClick={() => void loadDevice(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#0E6BA8] ${checkingPing ? 'animate-spin' : ''}`} />
            <span>{checkingPing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối thiết bị'}</span>
          </button>

          <button
            type="button"
            disabled={!runtime?.canOrder}
            onClick={() => setShowSimulateConfirm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0E6BA8] hover:bg-[#0B5586] px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Đặt đơn thử ngay</span>
          </button>
        </div>
      </div>

      {lastPingMessage && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <div>
            <span className="font-semibold">{lastPingMessage}</span>
            <span className="block text-[11px] text-emerald-700 mt-0.5">
              Đây là kiểm tra telemetry trực tiếp, không tạo đơn hàng mới.
            </span>
          </div>
        </div>
      )}

      {device?.customerChildLock && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
          <Lock className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <p className="font-semibold">Đang bật Khóa trẻ em (Child Lock)</p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Nút vật lý tạm thời không tự động phát sinh đơn khi trẻ nhỏ bấm nhầm. Bạn có thể tắt trong mục Cấu hình ở Trang chủ.
            </p>
          </div>
        </div>
      )}

      {/* Telemetry & Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Hardware Telemetry */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#0E6BA8]" />
              <span>Thông số & Telemetry phần cứng</span>
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                runtime?.canOrder
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {device?.status || 'UNKNOWN'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Battery className="w-3.5 h-3.5" />
                <span>Mức pin hiện tại</span>
              </div>
              <p className="mt-1 text-base font-bold text-slate-900 tabular-nums">
                {battery !== null ? `${battery}%` : 'Chưa báo cáo'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Wifi className="w-3.5 h-3.5" />
                <span>Cường độ Wi-Fi</span>
              </div>
              <p className="mt-1 text-sm font-bold text-slate-900 tabular-nums">{rssiQualityLabel(rssi)}</p>
            </div>
          </div>

          <dl className="divide-y divide-slate-100 text-xs">
            <div className="flex justify-between py-2">
              <dt className="text-slate-500">Mạng Wi-Fi đã cấu hình</dt>
              <dd className="font-semibold text-slate-800">{device?.wifiSsid || 'Chưa cấu hình / BLE'}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-slate-500">Phiên bản Firmware</dt>
              <dd className="font-mono font-semibold text-slate-800">{device?.firmwareVersion || 'v1.0.0'}</dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-slate-500">Đồng bộ lần cuối</dt>
              <dd className="font-medium text-slate-700">
                {device?.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('vi-VN') : 'Chưa ghi nhận'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Assigned Product & Store */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-4 h-4 text-[#0E6BA8]" />
            <span>Sản phẩm & Cửa hàng đang gán</span>
          </h2>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Sản phẩm đặt nhanh</span>
              <span className="font-bold text-slate-900">
                {device?.product?.name || device?.deployedTemplate?.productName || 'Chưa gán sản phẩm'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Số lượng mỗi lần nhấn</span>
              <span className="font-semibold text-slate-800">
                {qty} {device?.product?.unit || 'đơn vị'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Ước tính mỗi đơn</span>
              <span className="font-bold text-[#0E6BA8] tabular-nums">
                {unitPrice > 0 ? formatVnd(unitPrice * qty) : 'Theo giá niêm yết'}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <Store className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <span>Cửa hàng phục vụ: <strong>{device?.store?.name || 'Chưa liên kết cửa hàng'}</strong></span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
              <span>Địa chỉ giao mặc định: {device?.deliveryAddress || 'Sử dụng địa chỉ mặc định trong hồ sơ'}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            <Link
              to="/customer/home"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Đổi sản phẩm / Cấu hình tại Trang chủ
            </Link>
            <Link
              to="/customer/orders"
              className="rounded-lg border border-[#0E6BA8]/30 bg-[#0E6BA8]/5 px-3 py-1.5 text-xs font-semibold text-[#0E6BA8] hover:bg-[#0E6BA8]/10"
            >
              Xem lịch sử đơn hàng
            </Link>
          </div>
        </div>
      </div>

      {/* Gesture Guide */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-2xs">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Hand className="w-4 h-4 text-[#0E6BA8]" />
          <span>Hướng dẫn thao tác vật lý trên nút bấm</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-xl bg-sky-50/70 border border-sky-100 p-3.5 space-y-1">
            <p className="font-bold text-sky-900">Nhấn 1 lần (Single Press)</p>
            <p className="text-sky-800/80 leading-relaxed">Đặt ngay 1 đơn hàng tự động với sản phẩm và số lượng đã gán.</p>
          </div>
          <div className="rounded-xl bg-amber-50/70 border border-amber-100 p-3.5 space-y-1">
            <p className="font-bold text-amber-900">Nhấn giữ 2 giây (Long Press)</p>
            <p className="text-amber-800/80 leading-relaxed">Hủy nhanh đơn hàng gần nhất nếu đơn vẫn đang ở trạng thái chờ cửa hàng tiếp nhận.</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3.5 space-y-1">
            <p className="font-bold text-slate-800">Nhấn giữ 5 giây (BLE Setup)</p>
            <p className="text-slate-600 leading-relaxed">Đưa nút về chế độ phát Bluetooth để ghép nối hoặc thay đổi mạng Wi-Fi 2.4GHz.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Hệ thống có cơ chế chống bấm trùng trong 30 giây để tránh phát sinh đơn ngoài ý muốn.</span>
        </div>
      </div>

      {/* Confirm Real Order Modal */}
      {showSimulateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => !simulatingOrder && setShowSimulateConfirm(false)}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Xác nhận tạo đơn hàng thử ngay?</h3>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Thao tác này sẽ gửi <strong>1 đơn hàng thật</strong> tới cửa hàng{' '}
                  <strong>{device?.store?.name || 'đang liên kết'}</strong> cho sản phẩm{' '}
                  <strong>{device?.product?.name || device?.deployedTemplate?.productName || 'mặc định'}</strong> ({qty} sản phẩm).
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={simulatingOrder}
                onClick={() => setShowSimulateConfirm(false)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={simulatingOrder}
                onClick={() => void handleConfirmRealOrderPress()}
                className="rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {simulatingOrder ? 'Đang gửi lệnh...' : 'Xác nhận đặt đơn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
