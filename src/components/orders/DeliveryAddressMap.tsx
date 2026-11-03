import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { loadGoongMaps, suggestGoongAddresses, getGoongPlace, type AddressSuggestion, type MapsApi, type MapInstance, type MapMarker } from '../../services/goong-maps';
import type { DeliveryLocation } from '../../services/delivery-location';

type Props = { address: string; location: DeliveryLocation | null; onSelect(address: string, point: DeliveryLocation | null): void };

export const DeliveryAddressMap: React.FC<Props> = ({ address, location, onSelect }) => {
  const container = useRef<HTMLDivElement>(null);
  const state = useRef<{ maps: MapsApi; map: MapInstance; marker: MapMarker }>();
  const latest = useRef({ address, location, onSelect });
  latest.current = { address, location, onSelect };
  const sequence = useRef(0);
  const searchSequence = useRef(0);
  const chosenAddress = useRef('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searchMessage, setSearchMessage] = useState('');
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('Đang tải bản đồ…');
  const key = import.meta.env.VITE_GOONG_API_KEY?.trim();
  const mapKey = import.meta.env.VITE_GOONG_MAPTILES_KEY?.trim();

  useEffect(() => {
    const request = ++searchSequence.current;
    setSuggestions([]);
    setSearchMessage('');
    if (!key || address.trim().length < 3 || address === chosenAddress.current) return;
    const timer = window.setTimeout(async () => {
      setSearchMessage('Đang tìm địa chỉ gợi ý…');
      try {
        const results = await suggestGoongAddresses(key, address);
        if (request !== searchSequence.current) return;
        setSuggestions(results);
        setSearchMessage(results.length ? 'Chọn địa chỉ phù hợp bên dưới.' : 'Không có địa chỉ phù hợp. Thử thêm tên đường, phường/xã hoặc tỉnh/thành.');
      } catch {
        if (request === searchSequence.current) setSearchMessage('Chưa tải được gợi ý. Bạn vẫn có thể nhập địa chỉ hoặc chọn trên bản đồ.');
      }
    }, 400);
    return () => { window.clearTimeout(timer); ++searchSequence.current; };
  }, [address, key]);

  const chooseSuggestion = async (suggestion: AddressSuggestion) => {
    if (!key) return;
    const request = ++sequence.current;
    ++searchSequence.current;
    setSuggestions([]);
    setSearchMessage('Đang lấy vị trí địa chỉ đã chọn…');
    try {
      const place = await getGoongPlace(key, suggestion.id);
      if (request !== sequence.current) return;
      chosenAddress.current = place.address;
      latest.current.onSelect(place.address, place.point);
      setSearchMessage('');
      setMessage('Đã chọn địa chỉ. Bổ sung số nhà, tầng hoặc căn hộ nếu cần.');
    } catch {
      if (request === sequence.current) setSearchMessage('Không lấy được vị trí. Hãy thử chọn lại hoặc nhập địa chỉ đầy đủ.');
    }
  };

  useEffect(() => {
    if (!key) { setMessage('Chưa cấu hình Goong Maps. Bạn vẫn có thể nhập địa chỉ giao hàng.'); return; }
    let active = true;
    let listener: { remove(): void } | undefined;
    const onError = () => {
      // A failed tile request must not disable syncing the selected address.
      setMessage('Không tải được nền bản đồ. Bạn vẫn có thể nhập địa chỉ giao hàng.');
    };
    let errorListener: { remove(): void } | undefined;
    loadGoongMaps(key, mapKey).then((maps) => {
      if (!active || !container.current) return;
      const map = new maps.Map(container.current, { center: latest.current.location || { lat: 10.7769, lng: 106.7009 }, zoom: 14 });
      const marker = new maps.marker.AdvancedMarkerElement({ map, position: latest.current.location });
      state.current = { maps, map, marker };
      listener = map.addListener('click', async (event) => {
        if (!event.latLng) return;
        const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        const request = ++sequence.current;
        ++searchSequence.current;
        setSuggestions([]);
        setSearchMessage('');
        setMessage('Đang tìm địa chỉ tại điểm đã chọn…');
        try {
          const { results } = await new maps.Geocoder().geocode({ location: point });
          if (!active || request !== sequence.current) return;
          if (!results[0]) throw new Error('No address');
          chosenAddress.current = results[0].formatted_address;
          latest.current.onSelect(results[0].formatted_address, point);
          setMessage('Đã chọn vị trí. Kiểm tra và bổ sung số nhà, tầng hoặc căn hộ nếu cần.');
        } catch {
          if (active && request === sequence.current) setMessage('Không tìm được địa chỉ tại điểm này. Hãy chọn điểm khác hoặc nhập địa chỉ.');
        }
      });
      errorListener = map.addListener('error', onError);
      setReady(true);
      setMessage('Nhập địa chỉ để xem trên bản đồ hoặc bấm bản đồ để chọn điểm giao hàng.');
    }).catch(() => { if (active) setMessage('Không tải được Goong Maps. Bạn vẫn có thể nhập địa chỉ giao hàng.'); });
    return () => { active = false; ++sequence.current; listener?.remove(); errorListener?.remove(); if (state.current) state.current.marker.map = null; state.current?.map.remove(); state.current = undefined; };
  }, [key, mapKey]);

  useEffect(() => {
    const request = ++sequence.current;
    if (!ready || !state.current) return;
    const { maps, map, marker } = state.current;
    marker.position = location;
    if (location) { map.focusOn(location, 17); return; }
    if (address.trim().length < 10) { setMessage('Nhập địa chỉ đầy đủ hoặc bấm bản đồ để chọn điểm giao hàng.'); return; }
    const timer = window.setTimeout(async () => {
      setMessage('Đang tìm vị trí theo địa chỉ…');
      try {
        const { results } = await new maps.Geocoder().geocode({ address });
        if (request !== sequence.current) return;
        if (!results[0]) throw new Error('No address');
        const point = results[0].geometry.location;
        // Keep the customer's house/apartment details exactly as entered.
        latest.current.onSelect(address, { lat: point.lat(), lng: point.lng() });
        setMessage('Đã hiển thị vị trí theo địa chỉ. Bạn có thể bấm bản đồ để chỉnh điểm giao hàng.');
      } catch {
        if (request === sequence.current) setMessage('Chưa xác định được vị trí. Hãy ghi rõ phường/xã, tỉnh/thành hoặc bấm chọn trên bản đồ.');
      }
    }, 900);
    return () => { window.clearTimeout(timer); ++sequence.current; };
  }, [address, location, ready]);

  return <div className="mt-3 space-y-2">
    {searchMessage && <p role="status" className="text-xs text-slate-500">{searchMessage}</p>}
    {suggestions.length > 0 && <ul aria-label="Địa chỉ gợi ý" className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      {suggestions.map((suggestion) => <li key={suggestion.id} className="border-b border-slate-100 last:border-b-0">
        <button type="button" onClick={() => chooseSuggestion(suggestion)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-sky-50 focus-visible:bg-sky-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
          <span className="min-w-0"><span className="block text-sm font-medium text-slate-800">{suggestion.title}</span><span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{suggestion.detail}</span></span>
        </button>
      </li>)}
    </ul>}
    {key && <div ref={container} aria-label="Bản đồ chọn địa chỉ giao hàng" className="h-64 w-full overflow-hidden rounded-xl border border-slate-200" />}
    <p role="status" className="text-xs leading-relaxed text-slate-500">{message}</p>
    {key && <p className="text-[11px] text-slate-400">{mapKey ? 'Tìm địa chỉ và bản đồ: Goong' : 'Tìm địa chỉ: Goong · Nền bản đồ: OpenStreetMap'}</p>}
    {location && <p className="text-xs text-teal-700">Vị trí giao hàng: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}</p>}
  </div>;
};
