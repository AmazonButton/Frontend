export type DeliveryLocation = { lat: number; lng: number };

export function readDeliveryLocation(latitude: unknown, longitude: unknown): DeliveryLocation | null {
  if (latitude == null || longitude == null || latitude === '' || longitude === '') return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export function deliveryMapUrl(order: { deliveryAddress?: string; shippingLatitude?: unknown; shippingLongitude?: unknown }) {
  const point = readDeliveryLocation(order.shippingLatitude, order.shippingLongitude);
  const query = point ? `${point.lat},${point.lng}` : order.deliveryAddress?.trim();
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}
