export interface RentalPurchasedEvent {
  rentalCode: string;
  customerName: string;
  customerPhone?: string;
  deliveryAddress?: string;
  packageName: string;
  buttonQuantity: number;
  monthsRented: number;
  totalAmount: number;
  depositAmount?: number;
  timestamp?: string;
}

export interface RentalPackageCreatedEvent {
  packageId?: string | number;
  packageCode: string;
  packageName: string;
  buttonQuantity: number;
  monthlyPrice: number;
  depositFee: number;
  description?: string;
  timestamp?: string;
}

const RENTAL_CHANNEL_NAME = 'smart_order_rentals_channel';
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    broadcastChannel = new BroadcastChannel(RENTAL_CHANNEL_NAME);
  } catch (_) {}
}

export const RENTAL_PURCHASED_EVENT = 'smart-order:rental-purchased';
export const RENTAL_PACKAGE_CREATED_EVENT = 'smart-order:rental-package-created';

export function publishRentalPurchased(data: RentalPurchasedEvent) {
  if (typeof window === 'undefined') return;
  // 1. Same-window CustomEvent
  window.dispatchEvent(new CustomEvent(RENTAL_PURCHASED_EVENT, { detail: data }));
  // 2. Cross-tab BroadcastChannel
  try {
    broadcastChannel?.postMessage({ type: RENTAL_PURCHASED_EVENT, payload: data });
  } catch (_) {}
  // 3. Fallback localStorage ping for cross-window sync
  try {
    localStorage.setItem('smart_order_last_rental_purchased', JSON.stringify({ data, time: Date.now() }));
  } catch (_) {}
}

export function publishRentalPackageCreated(data: RentalPackageCreatedEvent) {
  if (typeof window === 'undefined') return;
  // 1. Same-window CustomEvent
  window.dispatchEvent(new CustomEvent(RENTAL_PACKAGE_CREATED_EVENT, { detail: data }));
  // 2. Cross-tab BroadcastChannel
  try {
    broadcastChannel?.postMessage({ type: RENTAL_PACKAGE_CREATED_EVENT, payload: data });
  } catch (_) {}
  // 3. Fallback localStorage ping for cross-window sync
  try {
    localStorage.setItem('smart_order_last_rental_package_created', JSON.stringify({ data, time: Date.now() }));
  } catch (_) {}
}

export function subscribeRentalChannelEvents(callbacks: {
  onRentalPurchased?: (data: RentalPurchasedEvent) => void;
  onRentalPackageCreated?: (data: RentalPackageCreatedEvent) => void;
}) {
  if (typeof window === 'undefined') return () => {};

  const handleCustomPurchased = (e: Event) => {
    callbacks.onRentalPurchased?.((e as CustomEvent).detail);
  };
  const handleCustomPackageCreated = (e: Event) => {
    callbacks.onRentalPackageCreated?.((e as CustomEvent).detail);
  };

  window.addEventListener(RENTAL_PURCHASED_EVENT, handleCustomPurchased);
  window.addEventListener(RENTAL_PACKAGE_CREATED_EVENT, handleCustomPackageCreated);

  const handleBroadcast = (event: MessageEvent) => {
    if (event.data?.type === RENTAL_PURCHASED_EVENT) {
      callbacks.onRentalPurchased?.(event.data.payload);
    } else if (event.data?.type === RENTAL_PACKAGE_CREATED_EVENT) {
      callbacks.onRentalPackageCreated?.(event.data.payload);
    }
  };

  broadcastChannel?.addEventListener('message', handleBroadcast);

  return () => {
    window.removeEventListener(RENTAL_PURCHASED_EVENT, handleCustomPurchased);
    window.removeEventListener(RENTAL_PACKAGE_CREATED_EVENT, handleCustomPackageCreated);
    broadcastChannel?.removeEventListener('message', handleBroadcast);
  };
}

