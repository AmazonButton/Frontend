import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
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
  const portalTarget = typeof document !== 'undefined' ? (document.getElementById('modal-root') || document.body) : null;
  const [templates, setTemplates] = useState<DeviceTemplate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  // Universal body scroll lock & header submerge whenever any modal is open
  useBodyScrollLock(Boolean(showModal || deployingTemplate));

  const fetchData = async (attempt = 0) => {
    const results = await Promise.allSettled([
        api.get('/device-templates'),
        api.get('/products'),
        api.get('/devices'),
    ]);
    const [templateResult, productResult, deviceResult] = results;
    const failedRequests = results.filter((result) => result.status === 'rejected');

    if (templateResult.status === 'fulfilled' && templateResult.value.data?.success) {
      setTemplates(templateResult.value.data.data);
    }
    if (productResult.status === 'fulfilled' && productResult.value.data?.success) {
      setProducts(productResult.value.data.data);
    }
    if (deviceResult.status === 'fulfilled' && deviceResult.value.data?.success) {
      setDevices(deviceResult.value.data.data);
    }

    if (failedRequests.length > 0) {
      setLoadError('Một phần dữ liệu chưa tải được. Hệ thống sẽ tự thử lại.');
      if (attempt < 2) {
        window.setTimeout(() => void fetchData(attempt + 1), 1000 * (attempt + 1));
      }
    } else {
      setLoadError(null);
    }
    setLoading(false);
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
      const payload: any = {
        name: templateForm.name.trim(),
        description: templateForm.description?.trim() || undefined,
        category: templateForm.category,
        defaultProductId: templateForm.defaultProductId ? String(templateForm.defaultProductId) : undefined,
        singlePressAction: templateForm.singlePressAction || 'CREATE_ORDER',
        doublePressAction: templateForm.doublePressAction || 'CANCEL_ORDER',
        longPressAction: templateForm.longPressAction || 'WIFI_CONFIGURATION',
        defaultQuantity: Number(templateForm.defaultQuantity) || 1,
        cancelWindowSeconds: Number(templateForm.cancelWindowSeconds) || 60,
      };

      if (editingTemplate) {
        await api.patch(`/device-templates/${editingTemplate.id}`, payload);
      } else {
        await api.post('/device-templates', payload);
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      const apiMsg = err.response?.data?.message;
      setModalError(
        Array.isArray(apiMsg)
          ? apiMsg.join(', ')
          : (typeof apiMsg === 'string' ? apiMsg : 'Không thể lưu template cấu hình thiết bị')
      );
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

  const getCategoryBadgeStyle = (cat?: string | null) => {
    const lower = (cat || '').toLowerCase();
    if (lower.includes('lương thực') || lower.includes('gạo')) {
      return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40';
    }
    if (lower.includes('nước') || lower.includes('uống')) {
      return 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/40';
    }
    if (lower.includes('gas')) {
      return 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40';
    }
    return 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
  };

  return (
    <div className="w-full space-y-5 text-slate-900 dark:text-slate-100">
      {/* ── Page Header (Sits directly on canvas with 1px border) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Mẫu Cấu Hình Thiết Bị
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Chuẩn hóa kịch bản nút bấm, sản phẩm mặc định và triển khai hàng loạt cho 10–100 thiết bị
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-3.5 py-2 rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            <span>Tạo Mẫu Thiết Bị Mới</span>
          </button>
          <Link
            to="/store/devices"
            className="px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-medium transition-colors cursor-pointer"
          >
            Quay lại Danh Sách Nút
          </Link>
        </div>
      </div>

      {/* ── Templates Content ── */}
      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <span>{loadError}</span>
          <button type="button" onClick={() => void fetchData()} className="font-semibold underline underline-offset-2">
            Thử lại ngay
          </button>
        </div>
      )}
      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-slate-400 tabular-nums">
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 animate-pulse inline-block"></span>
            Đang tải dữ liệu mẫu cấu hình...
          </div>
        </div>
      ) : templates.length === 0 ? (
        /* ── Empty State ── */
        <div className="py-20 text-center space-y-3">
          <Layers className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" strokeWidth={1.25} />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Chưa có mẫu cấu hình nào</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
              Tạo template mẫu như Nút Nước La Vie hoặc Nút Gạo ST25 để áp dụng hàng loạt.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white shadow-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              <span>Tạo Mẫu Thiết Bị Mới</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── Templates Grid (Flat Linear / Stripe 3-column Layout) ── */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {templates.map((t) => {
            const product =
              t.defaultProduct ||
              products.find((p) => String(p.id) === String(t.defaultProductId));

            return (
              <div
                key={t.id}
                className="flex flex-col justify-between p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div>
                  {/* Card Header: Category Badge & Device Count */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${getCategoryBadgeStyle(t.category)}`}>
                      {t.category || 'Lương thực'}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                      {t._count?.devices || 0} nút đang dùng
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div className="py-3 space-y-1">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                      {t.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {t.description || 'Cấu hình chuẩn cho hộ gia đình'}
                    </p>
                  </div>

                  {/* Flat Product Mapping Section (No nested box border) */}
                  <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-lg p-3 my-3">
                    <div className="text-xs text-slate-400 dark:text-slate-500 mb-1">
                      Sản phẩm gắn mặc định
                    </div>
                    {product ? (
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">
                          {product.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                          {product.price?.toLocaleString()} đ{product.unit ? ` (${product.unit})` : ''}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 dark:text-slate-500 italic">
                        Chưa gắn sản phẩm mặc định
                      </div>
                    )}
                  </div>

                  {/* Flat Action Mapping (Vietnamese localized, no nested borders) */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 dark:text-slate-500">Nhấn 1 lần (Single Click)</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {t.singlePressAction === 'CREATE_ORDER' ? 'Tạo đơn tự động' : (t.singlePressAction || 'Tạo đơn tự động')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 dark:text-slate-500">Nhấn 2 lần (Double Click)</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {t.doublePressAction === 'CANCEL_ORDER' ? 'Hủy đơn vừa đặt' : (t.doublePressAction || 'Hủy đơn vừa đặt')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 dark:text-slate-500">Thời gian cho phép hủy</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium tabular-nums">
                        {t.cancelWindowSeconds || 60} giây đầu
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-3.5 mt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(t)}
                      className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title="Chỉnh sửa template"
                    >
                      <Edit2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      title="Xóa template"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDeployingTemplate(t);
                      setDeployResult(null);
                    }}
                    className="bg-[#0E6BA8] hover:bg-[#0B5586] text-white font-medium text-xs px-3.5 py-2 rounded-lg transition-all active:scale-[0.98] cursor-pointer shadow-xs"
                  >
                    Triển khai hàng loạt
                  </button>
                </div>
              </div>
            );
          })}

          {/* ── Placeholder Card to complete 3-column grid professionally ── */}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-[#0E6BA8]/50 dark:hover:border-[#0E6BA8]/50 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:text-[#0E6BA8] dark:hover:text-[#0E6BA8] cursor-pointer transition-all min-h-[300px] group bg-white/40 dark:bg-slate-900/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/80"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 group-hover:scale-105 group-hover:bg-[#0E6BA8]/10 transition-all">
              <Plus className="w-5 h-5 text-slate-500 group-hover:text-[#0E6BA8] transition-colors" strokeWidth={2} />
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 group-hover:text-[#0E6BA8] transition-colors">
              Tạo mẫu thiết bị mới
            </span>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 text-center">
              Thêm mẫu cấu hình nhanh cho thiết bị
            </p>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. CREATE / EDIT TEMPLATE MODAL (With Framer Motion AnimatePresence)       */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm cursor-pointer"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 14 }}
              transition={{
                type: 'spring',
                damping: 28,
                stiffness: 320,
                mass: 0.8,
              }}
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

                {/* Technical Fields: Read-only Inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Nhấn 1 lần (Single Click)
                    </label>
                    <input
                      type="text"
                      disabled
                      value="Tạo đơn tự động"
                      className="w-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg cursor-not-allowed select-none"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Nhấn 2 lần (Double Click)
                    </label>
                    <input
                      type="text"
                      disabled
                      value="Hủy đơn vừa đặt"
                      className="w-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg cursor-not-allowed select-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading}
                    className="px-4 py-2 rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    {modalLoading ? 'Đang lưu...' : 'Lưu Template'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      (portalTarget || document.body) as HTMLElement
    )}

      {/* ========================================================================= */}
      {/* 2. BULK DEPLOY TEMPLATE MODAL (With Framer Motion AnimatePresence)         */}
      {/* ========================================================================= */}
      {createPortal(
        <AnimatePresence>
          {deployingTemplate && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setDeployingTemplate(null)}
              className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm cursor-pointer"
            />

            {/* Modal Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 14 }}
              transition={{
                type: 'spring',
                damping: 28,
                stiffness: 320,
                mass: 0.8,
              }}
              className="relative z-10 bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <Rocket className="w-4 h-4 text-[#0E6BA8]" strokeWidth={2} />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Triển Khai Mẫu: {deployingTemplate.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDeployingTemplate(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Áp dụng cài đặt sản phẩm và hành vi của template này tới hàng loạt thiết bị mà không cần nạp lại firmware vi xử lý.
              </p>

              {/* Mode selection tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setDeployMode('range')}
                  className={`pb-2 px-3 transition-colors cursor-pointer ${
                    deployMode === 'range'
                      ? 'border-b-2 border-[#0E6BA8] text-[#0E6BA8] font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Theo Dải Mã (VD: WATER-001 → 100)
                </button>
                <button
                  type="button"
                  onClick={() => setDeployMode('select')}
                  className={`pb-2 px-3 transition-colors cursor-pointer ${
                    deployMode === 'select'
                      ? 'border-b-2 border-[#0E6BA8] text-[#0E6BA8] font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Chọn Từng Nút ({selectedDeviceIds.length})
                </button>
              </div>

              {deployMode === 'range' ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Tiền tố mã thiết bị (Prefix)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: WATER-"
                      value={rangePrefix}
                      onChange={(e) => setRangePrefix(e.target.value.toUpperCase())}
                      className="w-full px-3 py-1.5 text-xs tabular-nums rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0E6BA8]/20 focus:border-[#0E6BA8] transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Từ số
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs tabular-nums rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0E6BA8]/20 focus:border-[#0E6BA8] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Đến số
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs tabular-nums rounded-lg bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0E6BA8]/20 focus:border-[#0E6BA8] transition-colors"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-xs tabular-nums">
                    Dải sẽ triển khai: {rangePrefix}{rangeStart.padStart(3, '0')} ➔ {rangePrefix}{rangeEnd.padStart(3, '0')}
                  </div>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs">
                  {devices.map((d) => (
                    <label
                      key={d.id}
                      className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
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
                        className="rounded text-[#0E6BA8] focus:ring-[#0E6BA8]/20 border-slate-300 cursor-pointer"
                      />
                      <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{d.deviceId}</span>
                      <span className="text-slate-400 truncate">({d.customName || 'Không tên'})</span>
                    </label>
                  ))}
                </div>
              )}

              {deployResult && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  <span>{deployResult.message}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeployingTemplate(null)}
                  className="px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={deployLoading}
                  onClick={handleExecuteDeploy}
                  className="px-4 py-2 rounded-lg bg-[#0E6BA8] hover:bg-[#0B5586] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deployLoading ? 'Đang triển khai...' : 'Bắt Đầu Triển Khai'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      (portalTarget || document.body) as HTMLElement
    )}
    </div>
  );
};
