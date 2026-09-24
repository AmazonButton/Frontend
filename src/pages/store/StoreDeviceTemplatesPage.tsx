import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
    <div className="w-full space-y-4 text-zinc-900 dark:text-zinc-100">
      {/* ── Page Header (Sits directly on canvas with 1px border) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Mẫu Cấu Hình Thiết Bị
            </h1>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
              PROFILES
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            Chuẩn hóa kịch bản nút bấm, sản phẩm mặc định và triển khai hàng loạt cho 10-100 thiết bị
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Tạo Mẫu Thiết Bị Mới</span>
          </button>
          <Link
            to="/store/devices"
            className="px-2.5 py-1 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-xs font-medium transition-colors"
          >
            Quay lại Danh Sách Nút
          </Link>
        </div>
      </div>

      {/* ── Templates Content ── */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600 animate-pulse inline-block"></span>
            Đang tải dữ liệu mẫu cấu hình...
          </div>
        </div>
      ) : templates.length === 0 ? (
        /* ── Empty State (Clean centered block directly on canvas) ── */
        <div className="py-20 text-center space-y-3">
          <Layers className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto stroke-zinc-300 dark:stroke-zinc-600" strokeWidth={1.25} />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Chưa có mẫu cấu hình nào</h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-sm mx-auto">
              Tạo template mẫu như Nút Nước Lavie hoặc Nút Gas Petrolimex để áp dụng hàng loạt.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-2 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 shadow-xs inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Tạo Mẫu Thiết Bị Mới</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── Templates Grid (High-Density Monochrome Cards) ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {templates.map((t) => {
            const product = t.defaultProduct || products.find((p) => p.id === t.defaultProductId);

            return (
              <div
                key={t.id}
                className="flex flex-col justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100 dark:border-zinc-800/80">
                    <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 uppercase">
                      {t.category || 'Nhu yếu phẩm'}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                      {t._count?.devices || 0} nút đang dùng
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div className="py-2.5 space-y-0.5">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{t.name}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {t.description || 'Không có mô tả chi tiết'}
                    </p>
                  </div>

                  {/* Product Mapping Section */}
                  <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-800 space-y-1">
                    <div className="text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                      Sản phẩm mặc định
                    </div>
                    {product ? (
                      <div>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {product.name}
                        </p>
                        <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                          SKU: {product.sku} · {product.price?.toLocaleString()} ₫ / {product.unit}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 italic">Chưa gán sản phẩm</p>
                    )}
                  </div>

                  {/* Technical Actions Mapping (Clean monospace inputs) */}
                  <div className="mt-2.5 p-2 rounded-md bg-zinc-50/60 dark:bg-zinc-800/20 border border-zinc-100 dark:border-zinc-800/60 space-y-1 text-[11px] font-mono">
                    <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                      <span className="text-zinc-400">Single Click:</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{t.singlePressAction}</span>
                    </div>
                    <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                      <span className="text-zinc-400">Double Click:</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{t.doublePressAction}</span>
                    </div>
                    <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                      <span className="text-zinc-400">Hủy miễn phí:</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{t.cancelWindowSeconds}s</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(t)}
                      className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                      title="Chỉnh sửa template"
                    >
                      <Edit2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                      title="Xóa template"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDeployingTemplate(t);
                      setDeployResult(null);
                    }}
                    className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Rocket className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>Triển Khai Hàng Loạt</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. CREATE / EDIT TEMPLATE MODAL (With Framer Motion AnimatePresence)       */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-10 bg-white dark:bg-zinc-900 rounded-xl max-w-lg w-full p-5 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {editingTemplate ? 'Chỉnh Sửa Mẫu Cấu Hình' : 'Tạo Mẫu Cấu Hình Thiết Bị Mới'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              {modalError && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 rounded-md text-xs font-medium">
                  {modalError}
                </div>
              )}

              <form onSubmit={handleSaveTemplate} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Tên Mẫu Cấu Hình *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: WATER BUTTON - Lavie 20L"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 dark:focus:ring-zinc-100/20 dark:focus:border-zinc-100 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Ngành Hàng / Danh Mục
                    </label>
                    <select
                      value={templateForm.category}
                      onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 dark:focus:ring-zinc-100/20 dark:focus:border-zinc-100 transition-colors cursor-pointer"
                    >
                      <option value="Nước uống">Nước uống</option>
                      <option value="Gas">Gas</option>
                      <option value="Gạo">Gạo</option>
                      <option value="Sữa">Sữa</option>
                      <option value="Nhu yếu phẩm">Nhu yếu phẩm</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Sản Phẩm SKU Mặc Định *
                    </label>
                    <select
                      required
                      value={templateForm.defaultProductId}
                      onChange={(e) =>
                        setTemplateForm({ ...templateForm, defaultProductId: e.target.value })
                      }
                      className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 dark:focus:ring-zinc-100/20 dark:focus:border-zinc-100 transition-colors truncate cursor-pointer"
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
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Mô Tả Kỹ Thuật
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Mô tả trường hợp sử dụng của profile nút này..."
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 dark:focus:ring-zinc-100/20 dark:focus:border-zinc-100 transition-colors"
                  />
                </div>

                {/* Technical Fields: Read-only Monospace Inputs (No colored pill badges) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Single Click Action
                    </label>
                    <input
                      type="text"
                      disabled
                      value={templateForm.singlePressAction}
                      className="w-full px-3 py-1.5 font-mono text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-md cursor-not-allowed select-none"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Double Click Action
                    </label>
                    <input
                      type="text"
                      disabled
                      value={templateForm.doublePressAction}
                      className="w-full px-3 py-1.5 font-mono text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-md cursor-not-allowed select-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3 py-1.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-xs font-medium transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-colors"
                  >
                    {modalLoading ? 'Đang lưu...' : 'Lưu Template'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 2. BULK DEPLOY TEMPLATE MODAL (With Framer Motion AnimatePresence)         */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {deployingTemplate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setDeployingTemplate(null)}
              className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-10 bg-white dark:bg-zinc-900 rounded-xl max-w-lg w-full p-5 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center space-x-2">
                  <Rocket className="w-4 h-4 text-zinc-900 dark:text-zinc-100" strokeWidth={1.5} />
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Triển Khai Mẫu: {deployingTemplate.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDeployingTemplate(null)}
                  className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Áp dụng cài đặt sản phẩm và hành vi của template này tới hàng loạt thiết bị mà không cần nạp lại firmware vi xử lý.
              </p>

              {/* Mode selection tabs */}
              <div className="flex border-b border-zinc-200 dark:border-zinc-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setDeployMode('range')}
                  className={`pb-2 px-3 transition-colors ${
                    deployMode === 'range'
                      ? 'border-b-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Theo Dải Mã (VD: WATER-001 → 100)
                </button>
                <button
                  type="button"
                  onClick={() => setDeployMode('select')}
                  className={`pb-2 px-3 transition-colors ${
                    deployMode === 'select'
                      ? 'border-b-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100 font-semibold'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Chọn Từng Nút ({selectedDeviceIds.length})
                </button>
              </div>

              {deployMode === 'range' ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Tiền tố mã thiết bị (Prefix)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: WATER-"
                      value={rangePrefix}
                      onChange={(e) => setRangePrefix(e.target.value.toUpperCase())}
                      className="w-full px-3 py-1.5 font-mono text-xs rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 dark:focus:ring-zinc-100/20 dark:focus:border-zinc-100 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Từ số
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                        className="w-full px-3 py-1.5 font-mono text-xs rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 dark:focus:ring-zinc-100/20 dark:focus:border-zinc-100 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Đến số
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                        className="w-full px-3 py-1.5 font-mono text-xs rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 dark:focus:ring-zinc-100/20 dark:focus:border-zinc-100 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-md font-mono text-[11px]">
                    Dải sẽ triển khai: {rangePrefix}{rangeStart.padStart(3, '0')} ➔ {rangePrefix}{rangeEnd.padStart(3, '0')}
                  </div>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 border border-zinc-200 dark:border-zinc-800 rounded-md p-2 text-xs">
                  {devices.map((d) => (
                    <label
                      key={d.id}
                      className="flex items-center space-x-2 p-1.5 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer"
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
                        className="rounded text-zinc-900 focus:ring-zinc-900/20 border-zinc-300"
                      />
                      <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{d.deviceId}</span>
                      <span className="text-zinc-400 truncate">({d.customName || 'Không tên'})</span>
                    </label>
                  ))}
                </div>
              )}

              {deployResult && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-md text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  <span>{deployResult.message}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setDeployingTemplate(null)}
                  className="px-3 py-1.5 rounded-md bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={deployLoading}
                  onClick={handleExecuteDeploy}
                  className="px-4 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-colors"
                >
                  {deployLoading ? 'Đang triển khai...' : 'Bắt Đầu Triển Khai'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
