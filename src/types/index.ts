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
  name: string;
  code: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
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
