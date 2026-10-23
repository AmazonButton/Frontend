export type UserRole =
  | 'SUPER_ADMIN'
  | 'STORE_OWNER'
  | 'STORE_MANAGER'
  | 'STORE_STAFF'
  | 'CUSTOMER'
  | 'TECHNICIAN';

export interface User {
  id: string;
  email: string;
  username?: string | null;
  fullName: string;
  phone?: string;
  role: UserRole;
  emailVerified?: boolean;
  storeId?: string | null;
  customerProfileId?: string | null;
  store?: Store | null;
}

export interface Store {
  id: string;
  storeId?: string;
  name: string;
  code: string;
  ownerName?: string;
  owner?: any;
  phone: string;
  email: string;
  address: string;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | string;
  rejectionReason?: string | null;
  approvedAt?: string | null;
}

export interface CustomerProfile {
  id: string;
  userId: string;
  storeId: string;
  apartment?: string;
  building?: string;
  floor?: string;
  room?: string;
  deliveryAddress: string;
  phone: string;
  user?: User;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  brand: string;
  sku: string;
  description?: string | null;
  category: string;
  unit: string;
  price: number;
  stock: number;
  reservedStock: number;
  minStockAlert: number;
  imageUrl?: string | null;
  status?: string;
  isActive: boolean;
}

export interface DeviceConfiguration {
  id: string;
  deviceId: string;
  customName: string;
  productId: string;
  product?: Product;
  defaultQuantity: number;
  allowCustomerQuantity: boolean;
  allowCustomerProduct: boolean;
  quickOrderDirect: boolean;
  cancelWindowSeconds: number;
  soundEnabled: boolean;
  ledEnabled: boolean;
  singlePressAction?: string;
  doublePressAction?: string;
  hold3sAction?: string;
  hold5sAction?: string;
  customActionPayload?: any;
  version: number;
}

export interface DeviceTemplate {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  storeId?: string | null;
  defaultProductId?: string | null;
  defaultProduct?: Product | null;
  singlePressAction: string;
  doublePressAction: string;
  longPressAction: string;
  defaultQuantity: number;
  cancelWindowSeconds: number;
  _count?: { devices: number };
  createdAt: string;
  updatedAt: string;
}

export interface DeviceTelemetry {
  id: string;
  deviceId: string;
  batteryLevel: number;
  voltageMv: number;
  wifiRSSI: number;
  bootReason: string;
  wakeDurationMs: number;
  firmwareVersion: string;
  createdAt: string;
}

export interface DeviceAuditLog {
  id: string;
  userId?: string | null;
  user?: User | null;
  action: string;
  entity: string;
  entityId: string;
  oldValues?: string | null;
  newValues?: string | null;
  createdAt: string;
}

export interface FleetStats {
  total: number;
  online: number;
  offline: number;
  lowBattery: number;
  unconfigured: number;
}

export interface Device {
  id: string;
  deviceId: string;
  serialNumber: string;
  macAddress?: string | null;
  customName?: string | null;
  claimCode: string;
  pairingCode?: string | null;
  pairingToken?: string | null;
  qrPayload?: string;
  firmwareVersion: string;
  hardwareModel: string;
  status: 'MANUFACTURED' | 'UNCLAIMED' | 'CLAIMED' | 'ASSIGNED' | 'ACTIVE' | 'DISABLED' | 'READY_FOR_CUSTOMER' | 'EXPIRED';
  storeId?: string | null;
  customerId?: string | null;
  productId?: string | null;
  product?: Product | null;
  location?: string | null;
  description?: string | null;
  templateId?: string | null;
  template?: DeviceTemplate | null;
  batteryLevel: number;
  wifiRSSI: number;
  lastSeenAt?: string | null;
  expiresAt?: string | null;
  configuration?: DeviceConfiguration | null;
  customer?: CustomerProfile | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  storeId: string;
  customerId: string;
  deviceId?: string | null;
  device?: Device | null;
  status:
    | 'PENDING'
    | 'CONFIRMED'
    | 'PREPARING'
    | 'OUT_FOR_DELIVERY'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'REJECTED';
  paymentMethod?: 'PAYOS' | 'CASH_ON_DELIVERY' | string | null;
  paymentStatus?: 'UNPAID' | 'PENDING' | 'COD_DUE' | 'PAID' | 'REFUNDED' | string;
  paidAt?: string | null;
  totalAmount: number;
  deliveryAddress: string;
  customerPhone: string;
  customerName: string;
  cancelExpiresAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  items: OrderItem[];
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  user?: User | null;
  action: string;
  entity: string;
  entityId: string;
  oldValues?: string | null;
  newValues?: string | null;
  createdAt: string;
}

export interface PredictionInsight {
  productId: string;
  productName: string;
  unit: string;
  sampleCount: number;
  meanIntervalDays: number;
  stdDevDays: number;
  lastOrderDate: string;
  expectedReplenishmentDate: string;
  daysRemaining: number;
  confidenceScore: number; // 0 - 100%
  status: 'OPTIMAL' | 'DUE_SOON' | 'OVERDUE';
  explanation: string;
}

export interface SmartReminder {
  id: string;
  householdId: string;
  productId: string;
  product: Product;
  expectedDate: string;
  confidence: number;
  reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'ADDED_TO_LIST' | 'SNOOZED' | 'DISMISSED';
  createdAt: string;
  updatedAt: string;
}

export interface ConsumptionStats {
  product: Product;
  totalOrders: number;
  totalQuantity: number;
  averageIntervalDays: number;
  intervalStdDev: number;
  lastConsumedAt: string | null;
}

export interface ConsumptionRecord {
  id: string;
  householdId: string;
  productId: string;
  deviceId?: string | null;
  orderId?: string | null;
  quantity: number;
  recordedAt: string;
  product?: Product;
}

export interface Household {
  id: string;
  name: string;
  address?: string | null;
  apartment?: string | null;
  building?: string | null;
  floor?: string | null;
  room?: string | null;
  phone?: string | null;
  notes?: string | null;
  membership?: {
    role: string;
    nickname?: string;
    joinedAt: string;
  };
  members?: any[];
  devices?: any[];
  reminders?: SmartReminder[];
  shoppingList?: any;
}
