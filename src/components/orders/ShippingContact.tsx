import React from 'react';
import { MapPin, Phone, UserRound } from 'lucide-react';
import { deliveryMapUrl } from '../../services/delivery-location';
import { getOrderRecipient } from '../../services/order-events';
import type { Order } from '../../types';

export const ShippingContact: React.FC<{ order: Partial<Order> }> = ({ order }) => {
  const recipient = getOrderRecipient(order);
  return (
  <div className="space-y-2 text-xs text-slate-600 dark:text-zinc-300">
    <p className="flex gap-2"><UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="break-words">{recipient.customerName || 'Chưa có tên người nhận'}</span></p>
    <p className="flex gap-2"><Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" />{recipient.customerPhone ? <a href={`tel:${recipient.customerPhone}`} className="hover:underline">{recipient.customerPhone}</a> : <span>Chưa có số điện thoại</span>}</p>
    <p className="flex gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="whitespace-pre-line break-words">{recipient.deliveryAddress || 'Chưa có địa chỉ giao hàng'}</span></p>
    {deliveryMapUrl(order) && <a href={deliveryMapUrl(order)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sky-700 hover:underline dark:text-sky-400"><MapPin className="h-3.5 w-3.5" />Xem vị trí giao hàng trên Google Maps</a>}
  </div>
);
};
