import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { api } from '../../services/api';
import { Product } from '../../types';
import {
  Package,
  Plus,
  AlertTriangle,
  Search,
  X,
  SlidersHorizontal,
  Boxes,
  Radio,
  Check,
  ChevronDown,
} from 'lucide-react';

const tableContainerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const tableRowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};

export const StoreProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

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

  // Metrics summary
  const totalSkus = products.length;
  const totalStockCount = products.reduce((acc, p) => acc + p.stock, 0);
  const totalReserved = products.reduce((acc, p) => acc + p.reservedStock, 0);
  const lowStockProducts = products.filter((p) => p.stock <= p.minStockAlert);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      const matchesCategory = categoryFilter === 'ALL' || prod.category === categoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        prod.name.toLowerCase().includes(q) ||
        prod.sku.toLowerCase().includes(q) ||
        prod.brand.toLowerCase().includes(q) ||
        prod.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [products, categoryFilter, searchQuery]);

  const categories = ['ALL', 'Nước uống', 'Gas', 'Gạo', 'Sữa', 'Nhu yếu phẩm'];

  return (
    <div className="space-y-6 text-zinc-900 dark:text-zinc-100">
      {/* 3. Command Bar Header (Operational Terminal Style) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Quản Lý Tồn Kho & Sản Phẩm
            </h1>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              INVENTORY-TELEMETRY
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Định danh SKU, quản lý định mức tồn kho và liên kết với Smart Order Button
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Sản Phẩm Mới</span>
          </motion.button>
        </div>
      </div>

      {/* Unified Inline Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 dark:divide-zinc-800">
        <div className="p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Tổng Mặt Hàng (SKUs)
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {totalSkus}
            </span>
            <span className="text-[11px] font-mono text-zinc-400">mã hàng</span>
          </div>
        </div>

        <div className="p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Tổng Tồn Kho
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {totalStockCount.toLocaleString()}
            </span>
            <span className="text-[11px] font-mono text-zinc-400">đơn vị</span>
          </div>
        </div>

        <div className="p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Đang Giữ Cho Đơn
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
              {totalReserved}
            </span>
            <span className="text-[11px] font-mono text-zinc-400">chờ xuất kho</span>
          </div>
        </div>

        <div className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Cảnh Báo Tồn Thấp
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                lowStockProducts.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`}
            ></span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold font-mono ${
                lowStockProducts.length > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {lowStockProducts.length}
            </span>
            <span className="text-[11px] text-zinc-400">
              {lowStockProducts.length > 0 ? 'cần nhập thêm' : 'ổn định'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Terminal Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        {/* Category Filter Pills with layoutId */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 sm:pb-0 relative">
          {categories.map((cat) => {
            const isActive = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors z-10 ${
                  isActive
                    ? 'text-white dark:text-zinc-900 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="activeProductCategory"
                    className="absolute inset-0 bg-zinc-900 dark:bg-zinc-100 rounded-lg -z-10 shadow-xs"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <span>{cat === 'ALL' ? 'Tất Cả Danh Mục' : cat}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input with Monospace Hint */}
        <div className="relative sm:w-72">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tên, SKU, nhãn..."
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-zinc-400 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. High-Density Operational Data Table */}
      <div className="bg-white dark:bg-[#09090B] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-xs font-mono text-zinc-400">
            Đang nạp danh mục sản phẩm kho...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Package className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto" />
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Không có sản phẩm nào khớp với bộ lọc hiện tại
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4 font-medium">Sản Phẩm & Quy Cách</th>
                  <th className="py-2.5 px-4 font-medium">Mã SKU</th>
                  <th className="py-2.5 px-4 font-medium">Danh Mục</th>
                  <th className="py-2.5 px-4 font-medium">Đơn Giá</th>
                  <th className="py-2.5 px-4 font-medium">Tồn Khả Dụng</th>
                  <th className="py-2.5 px-4 font-medium">Đang Giữ</th>
                  <th className="py-2.5 px-4 font-medium text-right">Điều Chỉnh Kho</th>
                </tr>
              </thead>
              <motion.tbody
                variants={tableContainerVariants}
                initial="hidden"
                animate="show"
                className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs"
              >
                {filteredProducts.map((prod) => {
                  const availableStock = prod.stock - prod.reservedStock;
                  const isLow = prod.stock <= prod.minStockAlert;

                  return (
                    <motion.tr
                      key={prod.id}
                      variants={tableRowVariants}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition-colors group"
                    >
                      {/* Sản Phẩm & Quy Cách */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {prod.name}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                          {prod.brand} • Quy cách: {prod.unit}
                        </div>
                      </td>

                      {/* Mã SKU (Monospace) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                          {prod.sku}
                        </span>
                      </td>

                      {/* Danh Mục */}
                      <td className="py-3 px-4 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                        {prod.category}
                      </td>

                      {/* Đơn Giá (Monospace) */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {prod.price.toLocaleString()} ₫
                      </td>

                      {/* Tồn Kho Khả Dụng (LED Status Indicator) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isLow ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                            }`}
                          ></span>
                          <span
                            className={`font-bold ${
                              isLow
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-zinc-900 dark:text-zinc-100'
                            }`}
                          >
                            {availableStock}
                          </span>
                          <span className="text-[11px] text-zinc-400">/ Tổng {prod.stock}</span>
                          {isLow && (
                            <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 ml-1">
                              [TỒN THẤP]
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Đang Giữ */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-zinc-500 dark:text-zinc-400">
                        {prod.reservedStock} {prod.unit.split(' ')[0]}
                      </td>

                      {/* Minimalist Inline Steppers (Refined ghost buttons with whileTap) */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleStockUpdate(prod.id, prod.stock, -5)}
                            className="px-2 py-0.5 rounded bg-transparent border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-900 active:text-white dark:active:bg-zinc-100 dark:active:text-zinc-900 font-mono text-[11px] font-medium transition-colors"
                            title="Trừ 5 cái"
                          >
                            -5
                          </motion.button>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleStockUpdate(prod.id, prod.stock, -1)}
                            className="px-2 py-0.5 rounded bg-transparent border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-900 active:text-white dark:active:bg-zinc-100 dark:active:text-zinc-900 font-mono text-[11px] font-medium transition-colors"
                            title="Trừ 1 cái"
                          >
                            -1
                          </motion.button>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleStockUpdate(prod.id, prod.stock, 1)}
                            className="px-2 py-0.5 rounded bg-transparent border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-900 active:text-white dark:active:bg-zinc-100 dark:active:text-zinc-900 font-mono text-[11px] font-medium transition-colors"
                            title="Cộng 1 cái"
                          >
                            +1
                          </motion.button>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleStockUpdate(prod.id, prod.stock, 10)}
                            className="px-2 py-0.5 rounded bg-transparent border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-900 active:text-white dark:active:bg-zinc-100 dark:active:text-zinc-900 font-mono text-[11px] font-medium transition-colors"
                            title="Cộng 10 cái"
                          >
                            +10
                          </motion.button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Product Modal (Framer Motion pop-in physics) */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setShowAddModal(false)}
              className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-10 w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Thêm Sản Phẩm Nhu Yếu Phẩm Mới
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Cấu hình sản phẩm để gán vào Smart Order Button
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Tên Sản Phẩm *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Nước khoáng Lavie 20L"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 dark:focus:ring-zinc-100/20 dark:focus:border-zinc-100 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Thương Hiệu *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Nestlé Waters"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 dark:focus:ring-zinc-100/20 dark:focus:border-zinc-100 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Mã SKU (Monospace) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: WTR-LAV-20L"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 dark:focus:ring-zinc-100/20 dark:focus:border-zinc-100 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Danh Mục
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 dark:focus:ring-zinc-100/20 dark:focus:border-zinc-100 transition-colors cursor-pointer"
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
                      Đơn Vị Quy Cách *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Bình 20L, Bình 12kg..."
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 dark:focus:ring-zinc-100/20 dark:focus:border-zinc-100 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Đơn Giá Bán (VNĐ) *
                    </label>
                    <input
                      type="number"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 dark:focus:ring-zinc-100/20 dark:focus:border-zinc-100 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Tồn Ban Đầu *
                    </label>
                    <input
                      type="number"
                      required
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 dark:focus:ring-zinc-100/20 dark:focus:border-zinc-100 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-md transition-colors"
                  >
                    Hủy
                  </button>
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.96 }}
                    disabled={submitLoading}
                    className="px-4 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white rounded-md shadow-xs disabled:opacity-50 transition-colors"
                  >
                    {submitLoading ? 'Đang lưu...' : 'Lưu Sản Phẩm'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
