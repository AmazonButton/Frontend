import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Product } from '../../types';
import { Package, Plus, AlertTriangle, CheckCircle2, DollarSign, Archive, Layers } from 'lucide-react';

export const StoreProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // New Product Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Nước uống');
  const [unit, setUnit] = useState('Bình 20L');
  const [price, setPrice] = useState('68000');
  const [stock, setStock] = useState('100');
  const [imageUrl, setImageUrl] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      if (res.data.success) {
        setProducts(res.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch store products:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);

    try {
      const res = await api.post('/products', {
        name,
        brand,
        sku: sku.trim().toUpperCase(),
        category,
        unit,
        price: parseFloat(price),
        stock: parseInt(stock, 10),
        imageUrl: imageUrl || undefined,
      });

      if (res.data.success) {
        setShowAddModal(false);
        setName('');
        setBrand('');
        setSku('');
        fetchProducts();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tạo sản phẩm');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleStockUpdate = async (productId: string, currentStock: number, delta: number) => {
    const nextStock = Math.max(0, currentStock + delta);
    try {
      const res = await api.put(`/products/${productId}`, { stock: nextStock });
      if (res.data.success) {
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, stock: nextStock } : p))
        );
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Lỗi cập nhật tồn kho');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Sản Phẩm & Quản Lý Tồn Kho</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              INVENTORY
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Danh mục sản phẩm thiết yếu gán cho Smart Order Buttons, theo dõi tồn kho và hàng đang giữ
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-red-600 dark:hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-blue-500/20 dark:shadow-red-600/30 transition-all flex items-center justify-center gap-2 btn-press"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Sản Phẩm Mới</span>
        </button>
      </div>

      {/* Product Table */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 font-mono text-sm">Đang nạp danh mục sản phẩm kho...</div>
      ) : products.length === 0 ? (
        <div className="p-12 bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl text-center">
          <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Chưa có sản phẩm nào</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Hãy thêm các mặt hàng chủ lực (Nước 20L, Bình gas 12kg, Gạo) để bắt đầu gán vào nút bấm cho khách.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0F172A] border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-white/10 text-slate-500 dark:text-slate-400 font-bold uppercase font-mono tracking-wider text-[11px]">
                <tr>
                  <th className="py-4 px-5">Sản Phẩm</th>
                  <th className="py-4 px-5">SKU / Danh Mục</th>
                  <th className="py-4 px-5">Đơn Giá</th>
                  <th className="py-4 px-5">Tồn Kho Khả Dụng</th>
                  <th className="py-4 px-5">Đang Giữ Cho Đơn</th>
                  <th className="py-4 px-5 text-right">Điều Chỉnh Kho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {products.map((prod) => {
                  const availableStock = prod.stock - prod.reservedStock;
                  const isLow = prod.stock <= prod.minStockAlert;

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors">
                      <td className="py-4 px-5">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">{prod.name}</div>
                        <div className="text-slate-400 dark:text-slate-500 text-[11px] mt-0.5">{prod.brand} • Quy cách: {prod.unit}</div>
                      </td>

                      <td className="py-4 px-5">
                        <span className="font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {prod.sku}
                        </span>
                        <div className="text-slate-500 dark:text-slate-400 mt-1">{prod.category}</div>
                      </td>

                      <td className="py-4 px-5 font-bold font-mono text-slate-900 dark:text-white text-sm">
                        {prod.price.toLocaleString()} ₫
                      </td>

                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-extrabold text-sm font-mono ${isLow ? 'text-amber-500' : 'text-emerald-500'}`}>
                            {availableStock}
                          </span>
                          <span className="text-slate-400 dark:text-slate-500 text-[11px] font-mono">/ Tổng: {prod.stock}</span>
                          {isLow && (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[10px] font-bold flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" /> Thấp
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-cyan-400 font-bold font-mono text-xs">
                          {prod.reservedStock} {prod.unit}
                        </span>
                      </td>

                      <td className="py-4 px-5 text-right space-x-1.5">
                        <button
                          onClick={() => handleStockUpdate(prod.id, prod.stock, -5)}
                          className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-mono font-bold text-slate-700 dark:text-slate-300 transition-colors"
                          title="Trừ 5 cái"
                        >
                          -5
                        </button>
                        <button
                          onClick={() => handleStockUpdate(prod.id, prod.stock, 10)}
                          className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 rounded-lg font-mono font-bold transition-colors"
                          title="Cộng 10 cái"
                        >
                          +10
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0F172A] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Thêm Sản Phẩm Nhu Yếu Phẩm Mới</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cấu hình sản phẩm để gán cho các Smart Order Button của khách.</p>

            <form onSubmit={handleCreateProduct} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tên Sản Phẩm</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Nước khoáng Lavie 20L"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-black/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Thương Hiệu</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nestlé Waters"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-black/50 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mã SKU</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: WTR-LAV-20L"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-black/50 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Danh Mục</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="Nước uống">Nước uống</option>
                    <option value="Gas">Gas</option>
                    <option value="Gạo">Gạo</option>
                    <option value="Sữa">Sữa</option>
                    <option value="Nhu yếu phẩm">Nhu yếu phẩm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Đơn Vị Quy Cách</label>
                  <input
                    type="text"
                    required
                    placeholder="Bình 20L, Bình 12kg..."
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-black/50 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Đơn Giá Bán (VNĐ)</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-black/50 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tồn Kho Nhập Ban Đầu</label>
                  <input
                    type="number"
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs border border-slate-200 dark:border-white/10 rounded-xl bg-slate-50 dark:bg-black/50 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all"
                >
                  {submitLoading ? 'Đang lưu...' : 'Lưu Sản Phẩm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
