export const ALLOCATED_INVENTORY_STATES = new Set([
  'ALLOCATED_TO_STORE',
  'IN_STORE',
  'IN_CUSTOMER_CUSTODY',
  'RETURN_IN_TRANSIT',
  'DEFECTIVE_RETURN',
]);

export function resolveCustodyStoreId(device: any): string {
  if (!device) return '';
  if (device.custodyStoreId != null && String(device.custodyStoreId).trim() !== '') {
    return String(device.custodyStoreId);
  }
  const invState = String(device.inventoryState || '').toUpperCase();
  if (invState && invState !== 'IN_PLATFORM_WAREHOUSE' && device.storeId != null) {
    return String(device.storeId);
  }
  return '';
}

export function isUnassignedWarehouseDevice(device: any): boolean {
  if (!device || device.customerId) return false;
  if (device.custodyStoreId != null && String(device.custodyStoreId).trim() !== '') {
    return false;
  }
  const invState = String(device.inventoryState || 'IN_PLATFORM_WAREHOUSE').toUpperCase();
  return invState === 'IN_PLATFORM_WAREHOUSE';
}

export function isAllocatedDevice(device: any): boolean {
  if (!device) return false;
  if (device.custodyStoreId != null && String(device.custodyStoreId).trim() !== '') {
    return true;
  }
  const invState = String(device.inventoryState || '').toUpperCase();
  return ALLOCATED_INVENTORY_STATES.has(invState);
}

export function resolveCustodyStoreMeta(
  device: any,
  stores: any[] = [],
): { storeId: string; storeName: string; storeCode: string } {
  const sid = resolveCustodyStoreId(device);
  const matchedStore = sid
    ? stores.find((s) => String(s?.id || s?.storeId || '') === sid)
    : null;
  const storeName =
    device?.custodyStore?.storeName ||
    device?.custodyStore?.name ||
    matchedStore?.name ||
    matchedStore?.storeName ||
    (sid && device?.store?.storeId && String(device.store.storeId) === sid
      ? device.store.storeName || device.store.name
      : '') ||
    (sid ? `Cửa hàng #${sid}` : 'Chưa xác định');
  const storeCode =
    device?.custodyStore?.code ||
    matchedStore?.code ||
    matchedStore?.storeCode ||
    '';

  return { storeId: sid, storeName, storeCode };
}
