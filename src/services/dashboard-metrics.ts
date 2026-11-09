export function metricNumber(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function formatMetric(value: unknown, money = false): string {
  const number = metricNumber(value);
  if (number === null) return '—';
  return money ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(number) : number.toLocaleString('vi-VN');
}
export function adminDashboardMetrics(stats: any, pending?: unknown) {
  return {
    totalStores: metricNumber(stats?.totalStores),
    pendingStores: metricNumber(stats?.pendingStores) ?? (Array.isArray(pending) ? pending.length : null),
    activeDevices: metricNumber(stats?.activeButtons ?? stats?.activeDevices),
    totalDevices: metricNumber(stats?.totalButtons ?? stats?.totalDevices),
    totalOrders: metricNumber(stats?.totalOrders),
    // This API returns confirmed/delivered order value, not cash receipts.
    confirmedOrderValue: metricNumber(stats?.totalGmv),
  };
}
export function dashboardOrderStatus(order: any): string {
  const value = String(order?.status || order?.orderStatus || '').toUpperCase();
  return value === 'DELIVERED' ? 'COMPLETED' : value;
}
export function isActiveDashboardOrder(order: any): boolean {
  return ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'SHIPPING'].includes(dashboardOrderStatus(typeof order === 'string' ? {status:order} : order));
}
export function orderDashboardMetrics(orders: any[]) {
  const valid = orders.filter(order => !['CANCELLED','REJECTED'].includes(dashboardOrderStatus(order)));
  const amounts = valid.map(order => metricNumber(order.totalAmount ?? order.total_amount));
  const provisionalSales = amounts.some(value => value === null) ? null : amounts.reduce<number>((sum,value) => sum + (value as number), 0);
  const completed = orders.filter(order => dashboardOrderStatus(order) === 'COMPLETED').length;
  return {
    total: orders.length,
    active: orders.filter(isActiveDashboardOrder).length,
    pending: orders.filter(order => dashboardOrderStatus(order) === 'PENDING').length,
    completed,
    cancelled: orders.filter(order => ['CANCELLED','REJECTED'].includes(dashboardOrderStatus(order))).length,
    provisionalSales,
    averageOrderValue: provisionalSales === null ? null : valid.length ? Math.round(provisionalSales / valid.length) : 0,
    completionRate: orders.length ? completed / orders.length * 100 : 0,
  };
}
export function deviceDashboardMetrics(devices: any[]) {
  const batteries = devices.map(device => metricNumber(device.batteryLevel)).filter((value): value is number => value !== null && value >= 0 && value <= 100);
  return {
    total: devices.length,
    active: devices.filter(device => ['ACTIVE','ONLINE'].includes(String(device.status || '').toUpperCase())).length,
    lowBattery: batteries.filter(value => value < 20).length,
    batteryReadings: batteries.length,
    averageBattery: batteries.length ? Math.round(batteries.reduce((sum,value)=>sum+value,0)/batteries.length) : null,
    unconfigured: devices.filter(device => !device.productId && !device.configuration?.productId && !device.assignedProduct?.id && !device.assignedProduct?.productId && !(Array.isArray(device.buttonProducts) && device.buttonProducts.length) && !(Array.isArray(device.products) && device.products.length)).length,
  };
}
export function filterDashboardOrders<T extends {createdAt?: string; orderDate?: string}>(orders: T[], range: '7D' | '30D' | 'ALL', now = Date.now()): T[] {
  if (range === 'ALL') return orders;
  const cutoff = now - (range === '7D' ? 7 : 30) * 86400000;
  return orders.filter(order => { const time=Date.parse(order.createdAt || order.orderDate || ''); return Number.isFinite(time) && time >= cutoff && time <= now; });
}
export function dashboardOrderSeries(orders: any[]) {
  const days = new Map<string,{date:string;revenue:number;orders:number;rawDate:Date}>();
  for (const order of orders) {
    const date = new Date(order.createdAt || order.orderDate || '');
    if (!Number.isFinite(date.getTime())) continue;
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (!days.has(key)) days.set(key,{date:date.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}),revenue:0,orders:0,rawDate:date});
    const day=days.get(key)!;day.orders++;
    if (!['CANCELLED','REJECTED'].includes(dashboardOrderStatus(order))) day.revenue += metricNumber(order.totalAmount ?? order.total_amount) ?? 0;
  }
  return [...days.values()].sort((a,b)=>a.rawDate.getTime()-b.rawDate.getTime());
}

export const ADMIN_DASHBOARD_PATHS = ['/admin/stores/pending','/admin/stats','/admin/audit-logs','/devices/unassigned','/admin/stores','/admin/users','/admin/plans'] as const;
export async function readAdminDashboard(client: {get:(path:string)=>Promise<any>}, onValue: (index:number,data:any)=>void, onError:(index:number,error:any)=>void, indices: readonly number[] = [0,1,2,3,4,5,6]) {
  await Promise.allSettled(indices.map(async index => {
    try {
      const response=await client.get(ADMIN_DASHBOARD_PATHS[index]);
      const data=response.data?.data;
      if (response.data?.success !== true || data == null) throw new Error(response.data?.message || 'Chưa nhận được dữ liệu.');
      if ([0,3,4,5,6].includes(index) && !Array.isArray(data)) throw new Error('Invalid dashboard list');
      if (index===1 && (typeof data!=='object' || Array.isArray(data))) throw new Error('Invalid dashboard statistics');
      if (index===2 && !Array.isArray(data) && (!Array.isArray(data.orderLogs) || !Array.isArray(data.priceLogs))) throw new Error('Invalid dashboard history');
      onValue(index,data);
    }
    catch(error) { onError(index,error); }
  }));
}
