import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { api, productsService, mediaService } from '../../services';
import { toast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { getSocket, subscribeToStore } from '../../services/socket';
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
  Pencil,
  Save,
  Upload,
  Image as ImageIcon,
  Trash2,
  EyeOff,
  Eye,
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
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // New Product Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('Nước uống');
  const [unit, setUnit] = useState('Bình 20L');
  const [price, setPrice] = useState('68000');
  const [stock, setStock] = useState('100');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editCategory, setEditCategory] = useState('Nước uống');
  const [editUnit, setEditUnit] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [statusConfirmation, setStatusConfirmation] = useState<{
    productId: string;
    productName: string;
    currentStatus?: string;
  } | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Inline Price Editing
  const [editingPriceProductId, setEditingPriceProductId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  // Universal body scroll lock & header submerge
  useBodyScrollLock(showAddModal || !!editingProduct || !!statusConfirmation);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setProducts(
          res.data.data.map((p: any) => ({
            ...p,
            id: String(p.id || p.productId),
            name: p.name || p.productName || 'Sản phẩm',
            sku: p.sku || p.productCode || '—',
            brand: p.brand || 'Khác',
            category: p.category?.categoryName || (typeof p.category === 'string' ? p.category : 'Nhu yếu phẩm'),
            unit: p.unit || 'Đơn vị',
            price: Number(p.price || p.basePrice || 0),
            stock: Number(p.stock !== undefined ? p.stock : (p.inventory?.quantityOnHand ?? 0)),
            reservedStock: Number(p.reservedStock ?? p.inventory?.reservedQuantity ?? 0),
            minStockAlert: Number(p.minStockAlert ?? p.inventory?.minStockAlert ?? 5),
            imageUrl: p.imageUrl || p.thumbnailUrl || (p.images?.[0]?.imageUrl || ''),
          }))
        );
      } else {
        setProducts([]);
      }
    } catch (e) {
      toast.error('Không tải được danh sách sản phẩm. Vui lòng thử lại.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();

    if (user?.storeId) {
      subscribeToStore(user.storeId);
    }

    const socket = getSocket();
    const handleRefresh = () => {
      fetchProducts();
    };

    socket.on('PRODUCT_CREATED', handleRefresh);
    socket.on('PRODUCT_UPDATED', handleRefresh);
    socket.on('PRODUCT_DELETED', handleRefresh);
    socket.on('PRODUCT_STOCK_CHANGED', handleRefresh);
    socket.on('ORDER_CREATED', handleRefresh);

    return () => {
      socket.off('PRODUCT_CREATED', handleRefresh);
      socket.off('PRODUCT_UPDATED', handleRefresh);
      socket.off('PRODUCT_DELETED', handleRefresh);
      socket.off('PRODUCT_STOCK_CHANGED', handleRefresh);
      socket.off('ORDER_CREATED', handleRefresh);
    };
  }, [user?.storeId]);

  // Xử lý upload ảnh sản phẩm lên Cloudinary
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'].includes(file.type)) {
      alert('Vui lòng chọn file hình ảnh (PNG, JPG, WebP, SVG, GIF...)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Dung lượng ảnh tối đa là 5MB. Vui lòng chọn ảnh nhỏ hơn.');
      return;
    }

    // Tải ảnh trực tiếp lên Cloudinary qua API /media/upload của Backend
    setImageUploading(true);
    mediaService.uploadImage(file)
      .then((res: any) => {
        const uploadedUrl =
          res?.data?.secureUrl ||
          res?.data?.url ||
          res?.data?.data?.secureUrl ||
          res?.data?.data?.url ||
          res?.secureUrl ||
          res?.url;
        if (uploadedUrl) {
          if (isEdit) {
            setEditImageUrl(uploadedUrl);
          } else {
            setImageUrl(uploadedUrl);
          }
        }
      })
      .catch((error: any) => {
        const message = error.response?.data?.message || 'Tải ảnh thất bại. Vui lòng thử lại.';
        alert(Array.isArray(message) ? message.join(', ') : message);
      })
      .finally(() => setImageUploading(false));
  };

  const resetAddForm = () => {
    setName('');
    setBrand('');
    setSku('');
    setCategory('Nước uống');
    setUnit('Bình 20L');
    setPrice('68000');
    setStock('100');
    setImageUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (imageUploading) {
      alert('Image is still uploading. Please wait before saving the product.');
      return;
    }
    if (imageUrl.startsWith('data:')) {
      alert('Image upload did not complete. Please upload the image again before saving.');
      return;
    }
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
        imageUrl: imageUrl.trim() || undefined,
      });

      if (res.data.success) {
        setShowAddModal(false);
        resetAddForm();
        fetchProducts();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể tạo sản phẩm');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleOpenEdit = (prod: Product) => {
    setEditingProduct(prod);
    setEditName(prod.name);
    setEditBrand(prod.brand);
    setEditSku(prod.sku);
    setEditCategory(prod.category);
    setEditUnit(prod.unit);
    setEditPrice(String(prod.price));
    setEditStock(String(prod.stock));
    setEditImageUrl(prod.imageUrl || '');
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (imageUploading) {
      alert('Image is still uploading. Please wait before saving the product.');
      return;
    }
    if (editImageUrl.startsWith('data:')) {
      alert('Image upload did not complete. Please upload the image again before saving.');
      return;
    }
    setEditLoading(true);

    try {
      const res = await api.put(`/products/${editingProduct.id}`, {
        name: editName,
        brand: editBrand,
        category: editCategory,
        unit: editUnit,
        price: parseFloat(editPrice),
        stock: parseInt(editStock, 10),
        imageUrl: editImageUrl?.trim() || undefined,
      });

      if (res.data.success) {
        toast.success('Cập nhật sản phẩm thành công!');
        setEditingProduct(null);
        fetchProducts();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể cập nhật sản phẩm');
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleProductStatus = async (productId: string, productName: string, currentStatus?: string) => {
    setStatusConfirmation({ productId, productName, currentStatus });
  };

  const handleConfirmProductStatus = async () => {
    if (!statusConfirmation) return;
    const isCurrentlyInactive = statusConfirmation.currentStatus === 'INACTIVE';
    const nextStatus = isCurrentlyInactive ? 'ACTIVE' : 'INACTIVE';
    const actionLabel = isCurrentlyInactive ? 'kích hoạt lại' : 'ngừng kinh doanh (vô hiệu hóa)';

    setStatusUpdating(true);
    try {
      const res = await api.put(`/products/${statusConfirmation.productId}`, { status: nextStatus });
      if (res.data.success) {
        setStatusConfirmation(null);
        await fetchProducts();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || `Không thể ${actionLabel} sản phẩm`);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleStockUpdate = async (productId: string, currentStock: number, delta: number) => {
    const nextStock = Math.max(0, currentStock + delta);
    try {
      const res = await productsService.updateStock(productId, { availableStock: nextStock });
      if (res.success) {
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, stock: nextStock } : p))
        );
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Lỗi cập nhật tồn kho');
    }
  };

  const startEditingPrice = (product: Product) => {
    setEditingPriceProductId(product.id);
    setEditingPrice(String(product.price));
  };

  const handlePriceUpdate = async (productId: string) => {
    const nextPrice = Number(editingPrice);
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      alert('Vui lòng nhập giá lớn hơn 0');
      return;
    }

    setSavingPrice(true);
    try {
      const res = await productsService.update(productId, { price: nextPrice });
      if (res.success) {
        setProducts((prev) =>
          prev.map((product) =>
            product.id === productId ? { ...product, price: nextPrice } : product
          )
        );
        setEditingPriceProductId(null);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cập nhật giá sản phẩm');
    } finally {
      setSavingPrice(false);
    }
  };

  // Metrics summary
  const totalSkus = (products || []).length;
  const totalStockCount = (products || []).reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
  const totalReserved = (products || []).reduce((acc, p) => acc + (Number(p.reservedStock) || 0), 0);
  const lowStockProducts = (products || []).filter((p) => (Number(p.stock) || 0) <= (Number(p.minStockAlert) || 5));

  // Filtered products
  const filteredProducts = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    return list.filter((prod) => {
      const cat = prod.category || 'Nhu yếu phẩm';
      const matchesCategory = categoryFilter === 'ALL' || cat === categoryFilter;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesCategory;
      const pName = (prod.name || '').toLowerCase();
      const pSku = (prod.sku || '').toLowerCase();
      const pBrand = (prod.brand || '').toLowerCase();
      const pCat = cat.toLowerCase();
      const matchesSearch =
        pName.includes(q) ||
        pSku.includes(q) ||
        pBrand.includes(q) ||
        pCat.includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [products, categoryFilter, searchQuery]);

  const categories = ['ALL', 'Nước uống', 'Gas', 'Gạo', 'Sữa', 'Nhu yếu phẩm'];

  return (
    <div className="space-y-6 text-zinc-900 dark:text-zinc-100">
      {/* 1. Command Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Quản Lý Tồn Kho & Sản Phẩm
            </h1>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              INVENTORY-TELEMETRY
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Định danh SKU, hình ảnh hiển thị cho khách hàng, định mức tồn kho và liên kết với Smart Order Button
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => {
              resetAddForm();
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#287DA8] hover:bg-[#206588] text-white text-xs font-semibold shadow-[0_2px_8px_rgba(40,125,168,0.25)] transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Sản Phẩm Mới</span>
          </motion.button>
        </div>
      </div>

      {/* 2. Unified Inline Metrics Bar */}
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

      {/* 3. Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 sm:pb-0 relative">
          {categories.map((cat) => {
            const isActive = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors z-10 cursor-pointer ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-[#287DA8] dark:hover:text-white hover:bg-[#287DA8]/5 dark:hover:bg-zinc-800/60'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="activeProductCategory"
                    className="absolute inset-0 bg-[#287DA8] rounded-lg -z-10 shadow-[0_2px_8px_rgba(40,125,168,0.25)] pointer-events-none"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <span>{cat === 'ALL' ? 'Tất Cả Danh Mục' : cat}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
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

      {/* 4. High-Density Operational Data Table */}
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
                  <th className="py-2.5 px-4 font-medium text-center">Điều Chỉnh Kho</th>
                  <th className="py-2.5 px-4 font-medium text-right">Thao Tác</th>
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

                  const isInactive = prod.status === 'INACTIVE';

                  return (
                    <motion.tr
                      key={prod.id}
                      variants={tableRowVariants}
                      className={`transition-colors group ${
                        isInactive
                          ? 'opacity-65 bg-zinc-50/50 dark:bg-zinc-900/30 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50'
                          : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40'
                      }`}
                    >
                      {/* Sản Phẩm & Hình Ảnh Thumbnail */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(prod)}
                            className="w-11 h-11 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-[#287DA8]/50 transition-all group/thumb relative"
                            title="Bấm để sửa hình ảnh và thông tin"
                          >
                            {prod.imageUrl ? (
                              <img
                                src={prod.imageUrl}
                                alt={prod.name}
                                className="w-full h-full object-contain p-0.5 group-hover/thumb:scale-110 transition-transform duration-200"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Package className="w-5 h-5 text-zinc-400" />
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center text-white text-[9px] font-semibold">
                              Sửa
                            </div>
                          </button>
                          <div className="min-w-0">
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                              <span className={`truncate ${isInactive ? 'line-through text-zinc-500 dark:text-zinc-400' : ''}`}>
                                {prod.name}
                              </span>
                              {isInactive && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-mono font-medium shrink-0">
                                  NGỪNG BÁN
                                </span>
                              )}
                              {!prod.imageUrl && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 font-normal shrink-0">
                                  Chưa có ảnh
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                              {prod.brand} • Quy cách: {prod.unit}
                            </div>
                          </div>
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
                        {editingPriceProductId === prod.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              step="1000"
                              value={editingPrice}
                              onChange={(event) => setEditingPrice(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') handlePriceUpdate(prod.id);
                                if (event.key === 'Escape') setEditingPriceProductId(null);
                              }}
                              autoFocus
                              aria-label={`Giá mới cho ${prod.name}`}
                              className="w-32 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-xs dark:border-zinc-700 dark:bg-zinc-900"
                            />
                            <span className="text-xs">₫</span>
                            <button
                              type="button"
                              disabled={savingPrice}
                              onClick={() => handlePriceUpdate(prod.id)}
                              title="Lưu giá"
                              aria-label="Lưu giá"
                              className="rounded p-1 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-950 cursor-pointer"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={savingPrice}
                              onClick={() => setEditingPriceProductId(null)}
                              title="Hủy sửa giá"
                              aria-label="Hủy sửa giá"
                              className="rounded p-1 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800 cursor-pointer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <span>{prod.price.toLocaleString()} ₫</span>
                            <button
                              type="button"
                              onClick={() => startEditingPrice(prod)}
                              title="Chỉnh sửa giá nhanh"
                              aria-label={`Chỉnh sửa giá ${prod.name}`}
                              className="rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-800 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
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

                      {/* Minimalist Inline Steppers */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleStockUpdate(prod.id, prod.stock, -5)}
                            className="px-2 py-0.5 rounded bg-transparent border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-900 active:text-white dark:active:bg-zinc-100 dark:active:text-zinc-900 font-mono text-[11px] font-medium transition-colors cursor-pointer"
                            title="Trừ 5 cái"
                          >
                            -5
                          </motion.button>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleStockUpdate(prod.id, prod.stock, -1)}
                            className="px-2 py-0.5 rounded bg-transparent border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-900 active:text-white dark:active:bg-zinc-100 dark:active:text-zinc-900 font-mono text-[11px] font-medium transition-colors cursor-pointer"
                            title="Trừ 1 cái"
                          >
                            -1
                          </motion.button>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleStockUpdate(prod.id, prod.stock, 1)}
                            className="px-2 py-0.5 rounded bg-transparent border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-900 active:text-white dark:active:bg-zinc-100 dark:active:text-zinc-900 font-mono text-[11px] font-medium transition-colors cursor-pointer"
                            title="Cộng 1 cái"
                          >
                            +1
                          </motion.button>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleStockUpdate(prod.id, prod.stock, 10)}
                            className="px-2 py-0.5 rounded bg-transparent border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 active:bg-zinc-900 active:text-white dark:active:bg-zinc-100 dark:active:text-zinc-900 font-mono text-[11px] font-medium transition-colors cursor-pointer"
                            title="Cộng 10 cái"
                          >
                            +10
                          </motion.button>
                        </div>
                      </td>

                      {/* Thao Tác Chi Tiết */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleOpenEdit(prod)}
                            className="p-1.5 rounded-md text-zinc-500 hover:text-[#287DA8] hover:bg-[#287DA8]/10 dark:text-zinc-400 dark:hover:text-[#287DA8] dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="Sửa hình ảnh & thông tin"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </motion.button>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleToggleProductStatus(prod.id, prod.name, prod.status)}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors cursor-pointer ${
                              isInactive
                                ? 'text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50'
                                : 'text-zinc-500 hover:bg-amber-50 hover:text-amber-600 dark:text-zinc-400 dark:hover:bg-amber-950/50 dark:hover:text-amber-400'
                            }`}
                            title={isInactive ? 'Kích hoạt lại sản phẩm để bán' : 'Ngừng kinh doanh (vô hiệu hóa sản phẩm)'}
                          >
                            {isInactive ? (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline text-[11px] font-medium">Bật lại</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline text-[11px] font-medium">Ngừng bán</span>
                              </>
                            )}
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

      {/* 5. Add Product Modal */}
      {createPortal(
        <AnimatePresence>
          {showAddModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                onClick={() => setShowAddModal(false)}
                className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm cursor-pointer"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.93, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{
                  type: 'spring',
                  damping: 28,
                  stiffness: 350,
                  mass: 0.8,
                }}
                className="relative z-10 w-full max-w-xl bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <span>Thêm Sản Phẩm Nhu Yếu Phẩm Mới</span>
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Cấu hình sản phẩm, hình ảnh hiển thị cho khách hàng & liên kết Smart Order Button
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
                  {/* Tên Sản Phẩm */}
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
                      className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#287DA8]/20 focus:border-[#287DA8] transition-colors"
                    />
                  </div>

                  {/* Thương Hiệu & SKU */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Thương Hiệu *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Nestlé Waters / Petrolimex"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#287DA8]/20 focus:border-[#287DA8] transition-colors"
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
                        className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#287DA8]/20 focus:border-[#287DA8] transition-colors"
                      />
                    </div>
                  </div>

                  {/* Danh Mục & Đơn Vị */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Danh Mục
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#287DA8]/20 focus:border-[#287DA8] transition-colors cursor-pointer"
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
                        placeholder="Bình 20L, Bình 12kg, Bao 25kg..."
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#287DA8]/20 focus:border-[#287DA8] transition-colors"
                      />
                    </div>
                  </div>

                  {/* Đơn Giá & Tồn Kho */}
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
                        className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-[#287DA8]/20 focus:border-[#287DA8] transition-colors"
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
                        className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-[#287DA8]/20 focus:border-[#287DA8] transition-colors"
                      />
                    </div>
                  </div>

                  {/* PHẦN HÌNH ẢNH SẢN PHẨM (MỚI BỔ SUNG ĐẦY ĐỦ) */}
                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[#287DA8]" />
                        <span>Hình Ảnh Sản Phẩm (Hiển thị cho khách hàng)</span>
                      </label>
                      <span className="text-[11px] text-zinc-400">Tùy chọn</span>
                    </div>

                    <div className="flex items-start gap-3">
                      {/* Box xem trước ảnh (Preview) */}
                      <div className="w-20 h-20 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shrink-0 overflow-hidden relative flex items-center justify-center shadow-xs">
                        {imageUrl ? (
                          <>
                            <img
                              src={imageUrl}
                              alt="Xem trước ảnh sản phẩm"
                              className="w-full h-full object-contain p-1"
                              onError={() => alert('Đường dẫn ảnh không tải được. Vui lòng kiểm tra lại URL!')}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setImageUrl('');
                                if (fileInputRef.current) fileInputRef.current.value = '';
                              }}
                              className="absolute top-1 right-1 p-0.5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer"
                              title="Xóa ảnh này"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <div className="text-center p-1 text-zinc-400">
                            <ImageIcon className="w-6 h-6 mx-auto mb-0.5 opacity-40" />
                            <span className="text-[9px] block leading-tight">Chưa có ảnh</span>
                          </div>
                        )}
                      </div>

                      {/* Các lựa chọn: Nhập link hoặc Tải ảnh */}
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Dán link ảnh (https://... hoặc /assets/products/...)"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 text-xs focus:outline-none focus:ring-1 focus:ring-[#287DA8]"
                          />
                          <label className="px-3 py-1.5 rounded-md bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-medium cursor-pointer flex items-center gap-1.5 shrink-0 border border-zinc-200 dark:border-zinc-700 transition-colors shadow-2xs">
                            <Upload className="w-3.5 h-3.5 text-[#287DA8]" />
                            <span>Tải từ máy</span>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageFileChange(e, false)}
                              className="hidden"
                            />
                          </label>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Ảnh này sẽ hiển thị trên trang Mua hàng cho khách và đại diện nút Smart Button.
                        </p>
                      </div>
                    </div>

                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-md transition-colors cursor-pointer"
                    >
                      Hủy
                    </button>
                    <motion.button
                      type="submit"
                      whileTap={{ scale: 0.96 }}
                      disabled={submitLoading}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-[#287DA8] hover:bg-[#206588] rounded-md shadow-[0_2px_8px_rgba(40,125,168,0.25)] disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {submitLoading ? 'Đang lưu...' : 'Lưu Sản Phẩm'}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* 6. Edit Product & Image Modal */}
      {createPortal(
        <AnimatePresence>
          {editingProduct && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overscroll-contain">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                onClick={() => setEditingProduct(null)}
                className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm cursor-pointer"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.93, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{
                  type: 'spring',
                  damping: 28,
                  stiffness: 350,
                  mass: 0.8,
                }}
                className="relative z-10 w-full max-w-xl bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Pencil className="w-4 h-4 text-[#287DA8]" />
                      <span>Chỉnh Sửa Sản Phẩm & Hình Ảnh</span>
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Cập nhật hình ảnh, thông số và đơn giá cho SKU: {editingProduct.sku}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingProduct(null)}
                    className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUpdateProduct} className="space-y-4 text-xs">
                  {/* Tên Sản Phẩm */}
                  <div>
                    <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Tên Sản Phẩm *
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#287DA8]/20 focus:border-[#287DA8] transition-colors"
                    />
                  </div>

                  {/* Thương Hiệu & SKU */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Thương Hiệu *
                      </label>
                      <input
                        type="text"
                        required
                        value={editBrand}
                        onChange={(e) => setEditBrand(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#287DA8]/20 focus:border-[#287DA8] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Mã SKU
                      </label>
                      <input
                        type="text"
                        disabled
                        value={editSku}
                        className="w-full px-3 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-mono cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Danh Mục & Đơn Vị */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Danh Mục
                      </label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#287DA8]/20 focus:border-[#287DA8] transition-colors cursor-pointer"
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
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#287DA8]/20 focus:border-[#287DA8] transition-colors"
                      />
                    </div>
                  </div>

                  {/* Đơn Giá & Tồn Kho */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Đơn Giá Bán (VNĐ) *
                      </label>
                      <input
                        type="number"
                        required
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-[#287DA8]/20 focus:border-[#287DA8] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Tổng Tồn Kho *
                      </label>
                      <input
                        type="number"
                        required
                        value={editStock}
                        onChange={(e) => setEditStock(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-md bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-mono focus:outline-none focus:ring-2 focus:ring-[#287DA8]/20 focus:border-[#287DA8] transition-colors"
                      />
                    </div>
                  </div>

                  {/* CHỈNH SỬA HÌNH ẢNH SẢN PHẨM */}
                  <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/70 border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[#287DA8]" />
                        <span>Hình Ảnh Sản Phẩm (Hiển thị cho khách hàng)</span>
                      </label>
                    </div>

                    <div className="flex items-start gap-3">
                      {/* Box xem trước ảnh (Preview) */}
                      <div className="w-20 h-20 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shrink-0 overflow-hidden relative flex items-center justify-center shadow-xs">
                        {editImageUrl ? (
                          <>
                            <img
                              src={editImageUrl}
                              alt="Xem trước ảnh"
                              className="w-full h-full object-contain p-1"
                              onError={() => alert('Đường dẫn ảnh không tải được!')}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setEditImageUrl('');
                                if (editFileInputRef.current) editFileInputRef.current.value = '';
                              }}
                              className="absolute top-1 right-1 p-0.5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer"
                              title="Xóa ảnh này"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <div className="text-center p-1 text-zinc-400">
                            <ImageIcon className="w-6 h-6 mx-auto mb-0.5 opacity-40" />
                            <span className="text-[9px] block leading-tight">Chưa có ảnh</span>
                          </div>
                        )}
                      </div>

                      {/* Các lựa chọn: Nhập link hoặc Tải ảnh */}
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Dán link ảnh (https://... hoặc /assets/products/...)"
                            value={editImageUrl}
                            onChange={(e) => setEditImageUrl(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 text-xs focus:outline-none focus:ring-1 focus:ring-[#287DA8]"
                          />
                          <label className="px-3 py-1.5 rounded-md bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-medium cursor-pointer flex items-center gap-1.5 shrink-0 border border-zinc-200 dark:border-zinc-700 transition-colors shadow-2xs">
                            <Upload className="w-3.5 h-3.5 text-[#287DA8]" />
                            <span>Tải từ máy</span>
                            <input
                              ref={editFileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageFileChange(e, true)}
                              className="hidden"
                            />
                          </label>
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Khách hàng xem trên Storefront sẽ nhìn thấy ảnh này ngay sau khi lưu.
                        </p>
                      </div>
                    </div>

                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setEditingProduct(null)}
                      className="px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 rounded-md transition-colors cursor-pointer"
                    >
                      Hủy
                    </button>
                    <motion.button
                      type="submit"
                      whileTap={{ scale: 0.96 }}
                      disabled={editLoading}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-[#287DA8] hover:bg-[#206588] rounded-md shadow-[0_2px_8px_rgba(40,125,168,0.25)] disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {editLoading ? 'Đang lưu...' : 'Cập Nhật Sản Phẩm'}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>
          {statusConfirmation && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !statusUpdating && setStatusConfirmation(null)}
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ type: 'spring', damping: 26, stiffness: 340 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="product-status-confirmation-title"
                className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${statusConfirmation.currentStatus === 'INACTIVE' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400'}`}>
                    {statusConfirmation.currentStatus === 'INACTIVE' ? <Eye className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <h3 id="product-status-confirmation-title" className="text-sm font-bold text-slate-900 dark:text-white">
                      {statusConfirmation.currentStatus === 'INACTIVE' ? 'Kích hoạt lại sản phẩm?' : 'Ngừng kinh doanh sản phẩm?'}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-zinc-300">
                      {statusConfirmation.currentStatus === 'INACTIVE'
                        ? <>Sản phẩm <strong>“{statusConfirmation.productName}”</strong> sẽ được hiển thị lại trên Storefront và có thể gán cho nút bấm.</>
                        : <>Sản phẩm <strong>“{statusConfirmation.productName}”</strong> sẽ bị ẩn khỏi Storefront và nút bấm IoT. Lịch sử đơn hàng vẫn được bảo lưu.</>}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={statusUpdating}
                    onClick={() => setStatusConfirmation(null)}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={statusUpdating}
                    onClick={handleConfirmProductStatus}
                    className={`rounded-lg px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-50 ${statusConfirmation.currentStatus === 'INACTIVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                  >
                    {statusUpdating ? 'Đang cập nhật...' : statusConfirmation.currentStatus === 'INACTIVE' ? 'Kích hoạt lại' : 'Xác nhận ngừng bán'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
