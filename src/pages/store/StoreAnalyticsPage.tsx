import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { api, apiSessionMarker } from '../../services/api';
import { dashboardOrderSeries, filterDashboardOrders, formatMetric, orderDashboardMetrics } from '../../services/dashboard-metrics';
import { useDashboardRefresh } from '../../hooks/useDashboardRefresh';
import { normalizeOrder } from '../../services/order-events';
import { toast } from '../../context/ToastContext';
import { Order, Device, Product } from '../../types';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Cpu,
  Download,
  RefreshCw,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Truck,
  Package,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export const StoreAnalyticsPage: React.FC = () => {
  const { token, user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const analyticsGeneration = useRef(0);
  const analyticsFlight = useRef<Promise<void> | null>(null);
  const [analyticsReady, setAnalyticsReady] = useState({orders:false,devices:false,products:false});
  const [analyticsError, setAnalyticsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Period filter
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | 'ALL'>('7D');
  // Metric chart view mode
  const [chartMetric, setChartMetric] = useState<'REVENUE' | 'ORDERS'>('REVENUE');

  const fetchData = async () => {
    if (analyticsFlight.current) return analyticsFlight.current;
    const generation=analyticsGeneration.current;const session=apiSessionMarker();
    const work=(async()=>{
      const errors:string[]=[];
      await Promise.allSettled(['/orders','/devices','/products'].map(async(path,index)=>{
        try { const response=await api.get(path); if(response.data?.success!==true || !Array.isArray(response.data.data))throw new Error('Unavailable');
          if(generation!==analyticsGeneration.current || session!==apiSessionMarker())return;
          const data=response.data.data;
          if(index===0)setOrders(data.map(normalizeOrder));
          if(index===1)setDevices(data);
          if(index===2)setProducts(data.map((p:any)=>({...p,id:String(p.id||p.productId),name:p.name||p.productName,category:typeof p.category==='object'&&p.category ? p.category.categoryName||p.category.name||'Chưa phân loại' : p.category||'Chưa phân loại'})));
          setAnalyticsReady(current=>({...current,[['orders','devices','products'][index]]:true}));
        } catch { errors.push(path); }
      }));
      if(generation!==analyticsGeneration.current || session!==apiSessionMarker())return;
      setAnalyticsError(errors.length?'Chưa cập nhật đủ báo cáo. Dữ liệu đã tải được giữ lại; các mục chưa tải hiển thị —.':'');
      setLoading(false);setRefreshing(false);
    })();analyticsFlight.current=work;
    try{await work;}finally{if(analyticsFlight.current===work)analyticsFlight.current=null;}
  };

  useEffect(() => { ++analyticsGeneration.current;analyticsFlight.current=null;setOrders([]);setDevices([]);setProducts([]);setAnalyticsReady({orders:false,devices:false,products:false});if(token)void fetchData();return()=>{++analyticsGeneration.current;}; }, [token,user?.id,user?.storeId]);
  useDashboardRefresh(fetchData,'analytics:'+user?.id+':'+user?.storeId);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Filter orders by selected timeRange
  const filteredOrders = useMemo(() => filterDashboardOrders(orders, timeRange), [orders, timeRange]);

  // Executive Metrics
  const metrics = useMemo(() => { const summary=orderDashboardMetrics(filteredOrders);return {totalRevenue:summary.provisionalSales,totalOrdersCount:summary.total,completedOrdersCount:summary.completed,cancelledOrdersCount:summary.cancelled,completionRate:summary.completionRate,aov:summary.averageOrderValue,activeDevicesCount:devices.filter(d=>d.status==='ACTIVE').length,devicesTriggeredCount:new Set(filteredOrders.map(order=>order.deviceId).filter(Boolean)).size}; }, [filteredOrders,devices]);

  // Aggregate time series chart data
  const chartData = useMemo(() => dashboardOrderSeries(filteredOrders), [filteredOrders]);

  // Peak revenue statistics
  const peakStats = useMemo(() => {
    if (chartData.length === 0) return { peakRev: 0, peakDate: 'N/A', avgDaily: 0 };
    let peak = chartData[0];
    let sum = 0;
    chartData.forEach((item) => {
      sum += item.revenue;
      if (item.revenue > peak.revenue) peak = item;
    });
    return {
      peakRev: peak.revenue,
      peakDate: peak.date,
      avgDaily: Math.round(sum / chartData.length),
    };
  }, [chartData]);


  // Top Products sold
  const topProducts = useMemo(() => {
    const prodMap: Record<string, { name: string; sku: string; quantity: number; revenue: number }> = {};
    let grandRevenue = 0;

    filteredOrders.forEach((o) => {
      if (o.status === 'CANCELLED' || o.status === 'REJECTED') return;
      o.items?.forEach((item) => {
        const prod = products.find((p) => p.name === item.productName || p.id === item.productId);
        const key = item.productName || prod?.name || 'Sản phẩm';
        if (!prodMap[key]) {
          prodMap[key] = {
            name: key,
            sku: prod?.sku || '—',
            quantity: 0,
            revenue: 0,
          };
        }
        const itemTotal = Number(item.totalPrice ?? (Number(item.quantity) * Number(item.unitPrice))) || 0;
        prodMap[key].quantity += Number(item.quantity) || 0;
        prodMap[key].revenue += itemTotal;
        grandRevenue += itemTotal;
      });
    });

    const list = Object.values(prodMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    if (list.length === 0) { return []; }

    return list.map((item) => ({
      ...item,
      percent: grandRevenue > 0 ? Math.round((item.revenue / grandRevenue) * 100) : 0,
    }));
  }, [filteredOrders, products]);



  // Export CSV handler
  const handleExportCSV = () => {
    const headers = ['Mã Đơn', 'Thời Gian', 'Người Nhận', 'Số Điện Thoại', 'Địa Chỉ', 'Nút Bấm IoT', 'Sản Phẩm', 'Tổng Tiền (VNĐ)', 'Trạng Thái'];
    const rows = filteredOrders.map((o) => [
      `"${o.orderNumber}"`,
      `"${new Date(o.createdAt).toLocaleString('vi-VN')}"`,
      `"${(o.customerName || 'Chưa có tên người nhận').replace(/"/g, '""')}"`,
      `"${(o.customerPhone || '').replace(/"/g, '""')}"`,
      `"${(o.deliveryAddress || '').replace(/"/g, '""')}"`,
      `"${o.deviceId || 'Đặt trực tiếp'}"`,
      `"${(o.items?.map((it) => `${it.productName} (x${it.quantity})`).join(', ') || '').replace(/"/g, '""')}"`,
      o.totalAmount || 0,
      `"${o.status}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bao_Cao_Doanh_Thu_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const chartColor = isDark ? '#38BDF8' : '#0284C7';
  const chartFillGradient = isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(2, 132, 199, 0.25)';

  return (
    <div className="space-y-6 text-zinc-900 dark:text-zinc-100 max-w-7xl mx-auto pb-12">
      {/* ── SECTION 1: Executive Command Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Báo Cáo Doanh Thu & Hiệu Suất
            </h1>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              Dữ liệu hệ thống
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Tổng hợp đơn hàng theo khoảng thời gian đã chọn. Doanh số tạm tính chưa phải số tiền đã thu.
          </p>
        </div>

        {/* Filter Pills & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time Range Pills */}
          <div className="inline-flex items-center rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-0.5 border border-zinc-200/80 dark:border-zinc-700">
            {(['7D', '30D', 'ALL'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTimeRange(r)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  timeRange === r
                    ? 'bg-[#287DA8] text-white shadow-xs font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-[#287DA8] dark:hover:text-white'
                }`}
              >
                {r === '7D' ? '7 Ngày Qua' : r === '30D' ? '30 Ngày' : 'Toàn Bộ'}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-[#287DA8]/5 hover:text-[#287DA8] hover:border-[#287DA8]/30 text-zinc-700 dark:text-zinc-300 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
            title="Tải lại dữ liệu mới nhất"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Làm mới
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#287DA8] hover:bg-[#206588] text-white text-xs font-medium transition-all shadow-[0_2px_8px_rgba(40,125,168,0.25)] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Xuất Báo Cáo CSV
          </button>
        </div>
      </div>

      {/* ── SECTION 2: Top KPI Highlights (4 Cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Tổng Doanh Thu */}
        <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Doanh số tạm tính
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
              {formatMetric(analyticsReady.orders ? metrics.totalRevenue : null)}
              <span className="text-sm font-medium text-zinc-400 ml-1">₫</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
              <span className="text-zinc-400 dark:text-zinc-500">Không gồm đơn hủy / từ chối; chưa phải tiền đã thu</span>
            </div>
          </div>
        </div>

        {/* Card 2: Tổng Đơn Hàng */}
        <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Đơn Hàng Ghi Nhận
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
              {formatMetric(analyticsReady.orders ? metrics.totalOrdersCount : null)}
              <span className="text-sm font-normal text-zinc-400 ml-1">đơn</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium font-mono">
                {analyticsReady.orders ? metrics.completionRate.toFixed(1) + '%' : '—'}
              </span>
              <span className="text-zinc-400 dark:text-zinc-500">hoàn tất ({metrics.cancelledOrdersCount} hủy)</span>
            </div>
          </div>
        </div>

        {/* Card 3: Giá Trị Đơn Trung Bình (AOV) */}
        <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Giá Trị Trung Bình / Đơn
            </span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
              {formatMetric(analyticsReady.orders ? metrics.aov : null)}
              <span className="text-sm font-medium text-zinc-400 ml-1">₫</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
              <span className="text-purple-600 dark:text-purple-400 font-medium">Trung bình</span>
              <span className="text-zinc-400 dark:text-zinc-500">trên mỗi đơn hợp lệ</span>
            </div>
          </div>
        </div>

        {/* Card 4: Hiệu Quả Mạng Lưới Nút Bấm */}
        <div className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Nút Bấm Phát Sinh Đơn
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-bold font-mono tracking-tight text-zinc-900 dark:text-zinc-100">
              {formatMetric(analyticsReady.orders ? metrics.devicesTriggeredCount : null)}
              <span className="text-sm font-normal text-zinc-400 ml-1">/ {analyticsReady.devices ? devices.length : '—'} nút</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              <span className="text-zinc-500 dark:text-zinc-400">Thiết bị có ghi nhận đơn trong kỳ</span>
            </div>
          </div>
        </div>
      </div>

      {analyticsError && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">{analyticsError}</p>}
      {/* Revenue and order volume chart */}
      <div className="grid grid-cols-1 gap-4">
        {/* Revenue & Order Volume Curve */}
        <div className="min-w-0 p-5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Giá Trị Đơn Theo Ngày
                </h3>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  Phân tích chuỗi thời gian doanh số tạm tính theo từng ngày
                </p>
              </div>

              {/* Metric Toggle */}
              <div className="inline-flex items-center rounded-lg bg-zinc-100 dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setChartMetric('REVENUE')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                    chartMetric === 'REVENUE'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  Doanh Thu (VNĐ)
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('ORDERS')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                    chartMetric === 'ORDERS'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  Số Lượng Đơn
                </button>
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="w-full h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={isDark ? 0.45 : 0.35} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke={isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: isDark ? '#A1A1AA' : '#71717A', fontSize: 11, fontFamily: 'monospace' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: isDark ? '#A1A1AA' : '#71717A', fontSize: 11, fontFamily: 'monospace' }}
                    tickFormatter={(val) =>
                      chartMetric === 'REVENUE'
                        ? val >= 1000000
                          ? `${(val / 1000000).toFixed(1)}M`
                          : `${(val / 1000).toFixed(0)}k`
                        : `${val}`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#18181B' : '#FFFFFF',
                      border: isDark ? '1px solid #27272A' : '1px solid #E4E4E7',
                      borderRadius: '0.5rem',
                      color: isDark ? '#FAFAFA' : '#09090B',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    formatter={(val: any) => [
                      chartMetric === 'REVENUE'
                        ? `${Number(val).toLocaleString()} ₫`
                        : `${val} đơn hàng`,
                      chartMetric === 'REVENUE' ? 'Doanh Thu' : 'Số Đơn',
                    ]}
                    labelFormatter={(label) => `Ngày: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey={chartMetric === 'REVENUE' ? 'revenue' : 'orders'}
                    stroke={chartColor}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#analyticsGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Peak Highlights */}
          <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800 text-center">
            <div>
              <span className="text-[10px] uppercase font-mono text-zinc-400">Ngày Đỉnh Điểm</span>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5">{peakStats.peakDate}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-zinc-400">Doanh Số Đỉnh</span>
              <p className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formatMetric(analyticsReady.orders ? peakStats.peakRev : null, true)}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-zinc-400">TB / Ngày Có Đơn</span>
              <p className="text-xs font-semibold font-mono text-zinc-800 dark:text-zinc-200 mt-0.5">
                {formatMetric(analyticsReady.orders ? peakStats.avgDaily : null, true)}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Top best-selling products */}
      <div className="grid grid-cols-1 gap-4">
        {/* Top Best-Selling Products */}
        <div className="p-5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-500" />
                Top Sản Phẩm Bán Chạy Nhất
              </h3>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                Xếp hạng theo tổng doanh thu thu về từ nút bấm
              </p>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">TOP 5</span>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {topProducts.map((p, idx) => (
              <div key={p.name} className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold font-mono shrink-0 ${
                      idx === 0
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : idx === 1
                        ? 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400'
                    }`}
                  >
                    #{idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {p.name}
                    </p>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase">
                      {p.sku} • {p.quantity} đã giao
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-3">
                  <span className="text-xs font-bold font-mono text-zinc-900 dark:text-zinc-100 block">
                    {p.revenue.toLocaleString()} ₫
                  </span>
                  <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                    {p.percent}% doanh thu
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
