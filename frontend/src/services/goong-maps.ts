import { readDeliveryLocation, type DeliveryLocation } from './delivery-location';

type ClickEvent = { latLng?: { lat(): number; lng(): number } };
export type MapInstance = { focusOn(point: DeliveryLocation, zoom: number): void; addListener(name: string, callback: (event: ClickEvent) => void): { remove(): void }; remove(): void; native: NativeMap };
export type MapMarker = { position: DeliveryLocation | null; map: MapInstance | null };
export type GeocodeResult = { formatted_address: string; geometry: { location: { lat(): number; lng(): number } } };
export type MapsApi = {
  Map: new (element: HTMLElement, options: { center: DeliveryLocation; zoom: number }) => MapInstance;
  Geocoder: new () => { geocode(request: { address?: string; location?: DeliveryLocation }): Promise<{ results: GeocodeResult[] }> };
  marker: { AdvancedMarkerElement: new (options: { map: MapInstance; position: DeliveryLocation | null }) => MapMarker };
};
type NativeMap = { jumpTo(options: { center: [number, number]; zoom: number }): void; resize(): void; on(name: string, callback: (event: any) => void): void; off(name: string, callback: (event: any) => void): void; remove(): void };
type NativeMarker = { setLngLat(point: [number, number]): NativeMarker; addTo(map: NativeMap): NativeMarker; remove(): void };
type GoongSdk = { Map: new (options: object) => NativeMap; Marker: new (options: object) => NativeMarker };
const SDK_BASE = 'https://cdn.jsdelivr.net/npm/@goongmaps/goong-js@1.0.9/dist/';
let sdkLoading: Promise<GoongSdk> | undefined;

export type AddressSuggestion = { id: string; title: string; detail: string; description: string };

export async function suggestGoongAddresses(apiKey: string, input: string, fetcher: typeof fetch = fetch): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({ api_key: apiKey, input, limit: '5' });
  const response = await fetcher(`https://rsapi.goong.io/v2/place/autocomplete?${params}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('ADDRESS_SEARCH_UNAVAILABLE');
  const data = await response.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') throw new Error('ADDRESS_SEARCH_UNAVAILABLE');
  return (Array.isArray(data.predictions) ? data.predictions : []).filter((item: any) => typeof item.place_id === 'string' && typeof item.description === 'string').slice(0, 5).map((item: any) => ({
    id: item.place_id,
    title: item.structured_formatting?.main_text || item.description,
    detail: item.structured_formatting?.secondary_text || '',
    description: item.description,
  }));
}

export async function getGoongPlace(apiKey: string, id: string, fetcher: typeof fetch = fetch): Promise<{ address: string; point: DeliveryLocation }> {
  const params = new URLSearchParams({ api_key: apiKey, place_id: id });
  const response = await fetcher(`https://rsapi.goong.io/v2/place/detail?${params}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('PLACE_UNAVAILABLE');
  const data = await response.json();
  const point = readDeliveryLocation(data.result?.geometry?.location?.lat, data.result?.geometry?.location?.lng);
  if (data.status !== 'OK' || !point || typeof data.result?.formatted_address !== 'string') throw new Error('PLACE_UNAVAILABLE');
  return { address: data.result.formatted_address, point };
}

function loadSdk(): Promise<GoongSdk> {
  if (sdkLoading) return sdkLoading;
  sdkLoading = new Promise((resolve, reject) => {
    const globals = window as unknown as { goongjs?: GoongSdk };
    if (globals.goongjs) { resolve(globals.goongjs); return; }
    if (!document.getElementById('smart-order-goong-css')) {
      const css = document.createElement('link');
      css.id = 'smart-order-goong-css'; css.rel = 'stylesheet'; css.href = `${SDK_BASE}goong-js.css`;
      document.head.appendChild(css);
    }
    const script = document.createElement('script');
    const fail = () => { window.clearTimeout(timer); script.remove(); sdkLoading = undefined; reject(new Error('MAP_UNAVAILABLE')); };
    const timer = window.setTimeout(fail, 20000);
    script.src = `${SDK_BASE}goong-js.js`; script.async = true;
    script.onload = () => { window.clearTimeout(timer); if (globals.goongjs) resolve(globals.goongjs); else fail(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return sdkLoading;
}

export async function geocodeGoong(apiKey: string, request: { address?: string; location?: DeliveryLocation }, fetcher: typeof fetch = fetch): Promise<{ results: GeocodeResult[] }> {
  const params = new URLSearchParams({ api_key: apiKey });
  if (request.location) params.set('latlng', `${request.location.lat},${request.location.lng}`);
  else if (request.address?.trim()) params.set('address', request.address.trim());
  else return { results: [] };
  const response = await fetcher(`https://rsapi.goong.io/v2/geocode?${params}`, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('GEOCODE_UNAVAILABLE');
  const data = await response.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') throw new Error('GEOCODE_UNAVAILABLE');
  return { results: (Array.isArray(data.results) ? data.results : []).flatMap((result: any) => {
    const point = readDeliveryLocation(result.geometry?.location?.lat, result.geometry?.location?.lng);
    return point && typeof result.formatted_address === 'string' ? [{ formatted_address: result.formatted_address, geometry: { location: { lat: () => point.lat, lng: () => point.lng } } }] : [];
  }) };
}

export async function loadGoongMaps(apiKey: string, mapKey?: string): Promise<MapsApi> {
  const sdk = await loadSdk();
  return {
    Map: class implements MapInstance {
      native: NativeMap;
      constructor(element: HTMLElement, options: { center: DeliveryLocation; zoom: number }) {
        // REST keys cannot load Goong tiles. Use an attributed OSM raster base
        // until a separate Map Tiles key is configured; address lookup stays Goong.
        const style = mapKey ? 'https://tiles.goong.io/assets/goong_map_web.json' : {
          version: 8,
          sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' } },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        };
        this.native = new sdk.Map({ container: element, style, accessToken: mapKey || '', center: [options.center.lng, options.center.lat], zoom: options.zoom });
      }
      focusOn(point: DeliveryLocation, zoom: number) {
        // setZoom interrupts panTo's animation. Apply the selected point and
        // zoom together so a far-away result is centered immediately.
        this.native.resize();
        this.native.jumpTo({ center: [point.lng, point.lat], zoom });
      }
      addListener(name: string, callback: (event: ClickEvent) => void) {
        const handler = (event: any) => callback({ latLng: event.lngLat ? { lat: () => event.lngLat.lat, lng: () => event.lngLat.lng } : undefined });
        this.native.on(name, handler);
        return { remove: () => this.native.off(name, handler) };
      }
      remove() { this.native.remove(); }
    },
    Geocoder: class { geocode(request: { address?: string; location?: DeliveryLocation }) { return geocodeGoong(apiKey, request); } },
    marker: { AdvancedMarkerElement: class implements MapMarker {
      private native = new sdk.Marker({ color: '#0d9488' });
      private currentMap: MapInstance | null;
      private point: DeliveryLocation | null;
      constructor(options: { map: MapInstance; position: DeliveryLocation | null }) { this.currentMap = options.map; this.point = options.position; this.sync(); }
      private sync() { if (this.currentMap && this.point) this.native.setLngLat([this.point.lng, this.point.lat]).addTo(this.currentMap.native); else this.native.remove(); }
      get position() { return this.point; }
      set position(point: DeliveryLocation | null) { this.point = point; this.sync(); }
      get map() { return this.currentMap; }
      set map(map: MapInstance | null) { this.currentMap = map; this.sync(); }
    } },
  };
}
