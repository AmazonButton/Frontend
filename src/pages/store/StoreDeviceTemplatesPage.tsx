import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DeviceTemplate, Product, Device } from '../../types';
import {
  Layers,
  Plus,
  Rocket,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Tag,
  ArrowRight,
  X,
  Sliders,
  Radio,
  Clock,
  Check,
  Cpu,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const StoreDeviceTemplatesPage: React.FC = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<DeviceTemplate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DeviceTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    category: 'Nước uống',
    defaultProductId: '',
    singlePressAction: 'CREATE_ORDER',
    doublePressAction: 'CANCEL_ORDER',
    longPressAction: 'WIFI_CONFIGURATION',
    defaultQuantity: 1,
    cancelWindowSeconds: 60,
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Deploy Modal
  const [deployingTemplate, setDeployingTemplate] = useState<DeviceTemplate | null>(null);
  const [deployMode, setDeployMode] = useState<'range' | 'select'>('range');
  const [rangePrefix, setRangePrefix] = useState('WATER-');
  const [rangeStart, setRangeStart] = useState('1');
  const [rangeEnd, setRangeEnd] = useState('20');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployResult, setDeployResult] = useState<any | null>(null);

  const fetchData = async () => {
    try {
      const [tempRes, prodRes, devRes] = await Promise.all([
        api.get('/device-templates'),
        api.get('/products'),
        api.get('/devices'),
      ]);
      if (tempRes.data.success) setTemplates(tempRes.data.data);
      if (prodRes.data.success) setProducts(prodRes.data.data);
      if (devRes.data.success) setDevices(devRes.data.data);
    } catch (e) {
      console.error('Failed to load templates data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: '',
      description: '',
      category: 'Nước uống',
      defaultProductId: products[0]?.id || '',
      singlePressAction: 'CREATE_ORDER',
      doublePressAction: 'CANCEL_ORDER',
      longPressAction: 'WIFI_CONFIGURATION',
      defaultQuantity: 1,
      cancelWindowSeconds: 60,
    });
    setModalError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (t: DeviceTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({
      name: t.name,
      description: t.description || '',
      category: t.category || 'Nước uống',
      defaultProductId: t.defaultProductId || '',
      singlePressAction: t.singlePressAction || 'CREATE_ORDER',
      doublePressAction: t.doublePressAction || 'CANCEL_ORDER',
      longPressAction: t.longPressAction || 'WIFI_CONFIGURATION',
      defaultQuantity: t.defaultQuantity || 1,
      cancelWindowSeconds: t.cancelWindowSeconds || 60,
    });
    setModalError(null);
    setShowModal(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError(null);

    try {
      if (editingTemplate) {
        await api.patch(`/device-templates/${editingTemplate.id}`, templateForm);
      } else {
        await api.post('/device-templates', templateForm);
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Không thể lưu template');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa template này?')) return;
    try {
      await api.delete(`/device-templates/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa template');
    }
  };

  const handleExecuteDeploy = async () => {
    if (!deployingTemplate) return;
    setDeployLoading(true);
    setDeployResult(null);

    try {
      const payload: any = {};
      if (deployMode === 'range') {
        payload.prefix = rangePrefix.trim().toUpperCase();
        payload.startRange = parseInt(rangeStart, 10);
        payload.endRange = parseInt(rangeEnd, 10);
        payload.padLength = 3;
      } else {
        payload.deviceIds = selectedDeviceIds;
      }

      const res = await api.post(`/device-templates/${deployingTemplate.id}/deploy`, payload);
      if (res.data.success) {
        setDeployResult(res.data);
        fetchData();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Triển khai thất bại');
    } finally {
      setDeployLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-inner">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Mẫu Cấu Hình Thiết Bị (Device Templates)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                PROFILES
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Chuẩn hóa kịch bản nút bấm, sản phẩm mặc định và triển khai hàng loạt cho 10-100 thiết bị
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/25 flex items-center space-x-2 transition-all btn-press"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Mẫu Thiết Bị Mới</span>
          </button>
          <Link
            to="/store/devices"
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors"
          >
            Quay lại Danh Sách Nút
          </Link>
        </div>
      </div>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-[#0F172A] border border-dashed border-slate-200 dark:border-white/10 rounded-3xl">
          <Layers className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">Chưa có mẫu cấu hình nào</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
            Tạo template mẫu như <strong>Nút Nước Lavie</strong> hoặc <strong>Nút Gas Petrolimex</strong> để áp dụng hàng loạt.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-4 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white shadow-sm"
          >
            + Tạo Template Đầu Tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((t) => {
            const product = t.defaultProduct || products.find((p) => p.id === t.defaultProductId);

            return (
              <div
                key={t.id}
                className="flex flex-col justify-between p-5 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 hover:border-indigo-500/40 rounded-3xl shadow-sm transition-all"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase">
                      {t.category || 'Nhu yếu phẩm'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {t._count?.devices || 0} nút đang dùng
                    </span>
                  </div>

                  <div className="py-3 space-y-1">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.name}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {t.description || 'Không có mô tả chi tiết'}
                    </p>
                  </div>

                  {/* Product mapping badge */}
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/30 border border-slate-200/60 dark:border-white/5 space-y-1.5">
                    <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                      Sản phẩm mặc định
                    </div>
                    {product ? (
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {product.name}
                        </p>
                        <p className="text-[11px] font-mono text-indigo-500 font-semibold mt-0.5">
                          SKU: {product.sku} • {product.price?.toLocaleString()} ₫
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-500 font-medium">Chưa gán sản phẩm</p>
                    )}
                  </div>

                  {/* Actions mapping table */}
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-50/50 dark:bg-black/20 border border-slate-100 dark:border-white/5 space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Single Click:</span>
                      <span className="font-bold text-emerald-500">{t.singlePressAction}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Double Click:</span>
                      <span className="font-bold text-rose-500">{t.doublePressAction}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Hủy miễn phí:</span>
                      <span className="font-bold">{t.cancelWindowSeconds}s</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Buttons */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleOpenEdit(t)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                      title="Chỉnh sửa template"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 text-rose-600"
                      title="Xóa template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setDeployingTemplate(t);
                      setDeployResult(null);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm flex items-center space-x-1.5 transition-all"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    <span>Triển Khai Hàng Loạt</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. CREATE / EDIT TEMPLATE MODAL                                           */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingTemplate ? 'Chỉnh Sửa Mẫu Cấu Hình' : 'Tạo Mẫu Cấu Hình Thiết Bị Mới'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 rounded-xl text-xs font-semibold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveTemplate} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên Mẫu Cấu Hình *
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: WATER BUTTON - Lavie 20L"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Ngành Hàng / Danh Mục
                  </label>
                  <select
                    value={templateForm.category}
                    onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="Nước uống">Nước uống</option>
                    <option value="Gas">Gas</option>
                    <option value="Gạo">Gạo</option>
                    <option value="Sữa">Sữa</option>
                    <option value="Nhu yếu phẩm">Nhu yếu phẩm</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Sản Phẩm SKU Gán Mặc Định *
                  </label>
                  <select
                    required
                    value={templateForm.defaultProductId}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, defaultProductId: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none max-w-xs truncate"
                  >
                    <option value="">-- Chọn sản phẩm --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mô Tả Kỹ Thuật
                </label>
                <textarea
                  rows={2}
                  placeholder="Mô tả trường hợp sử dụng của profile nút này..."
                  value={templateForm.description}
                  onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Single Click Action
                  </label>
                  <input
                    type="text"
                    disabled
                    value={templateForm.singlePressAction}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/5 text-emerald-500 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Double Click Action
                  </label>
                  <input
                    type="text"
                    disabled
                    value={templateForm.doublePressAction}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/5 text-rose-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/20"
                >
                  {modalLoading ? 'Đang lưu...' : 'Lưu Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. BULK DEPLOY TEMPLATE MODAL                                             */}
      {/* ========================================================================= */}
      {deployingTemplate && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center space-x-2">
                <Rocket className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Triển Khai Mẫu: {deployingTemplate.name}
                </h3>
              </div>
              <button
                onClick={() => setDeployingTemplate(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Áp dụng cài đặt sản phẩm và hành vi của template này tới hàng loạt thiết bị mà không cần nạp lại firmware vi xử lý.
            </p>

            {/* Mode selection tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/10 text-xs font-bold">
              <button
                onClick={() => setDeployMode('range')}
                className={`pb-2 px-4 transition-colors ${
                  deployMode === 'range'
                    ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500'
                }`}
              >
                Theo Dải Mã (VD: WATER-001 → WATER-100)
              </button>
              <button
                onClick={() => setDeployMode('select')}
                className={`pb-2 px-4 transition-colors ${
                  deployMode === 'select'
                    ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500'
                }`}
              >
                Chọn Từng Nút Trong Danh Sách ({selectedDeviceIds.length})
              </button>
            </div>

            {deployMode === 'range' ? (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tiền tố mã thiết bị (Prefix)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: WATER-"
                    value={rangePrefix}
                    onChange={(e) => setRangePrefix(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 font-mono rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Từ số
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                      className="w-full px-3 py-2 font-mono rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Đến số
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      className="w-full px-3 py-2 font-mono rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl font-mono text-[11px]">
                  Dải sẽ triển khai: {rangePrefix}{rangeStart.padStart(3, '0')} ➔ {rangePrefix}{rangeEnd.padStart(3, '0')}
                </div>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 dark:border-white/10 rounded-xl p-2 text-xs">
                {devices.map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center space-x-2.5 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDeviceIds.includes(d.deviceId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDeviceIds([...selectedDeviceIds, d.deviceId]);
                        } else {
                          setSelectedDeviceIds(selectedDeviceIds.filter((id) => id !== d.deviceId));
                        }
                      }}
                      className="rounded text-indigo-600"
                    />
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{d.deviceId}</span>
                    <span className="text-slate-400 truncate">({d.customName || 'Không tên'})</span>
                  </label>
                ))}
              </div>
            )}

            {deployResult && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{deployResult.message}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setDeployingTemplate(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={deployLoading}
                onClick={handleExecuteDeploy}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25"
              >
                {deployLoading ? 'Đang triển khai...' : 'Bắt Đầu Triển Khai'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
