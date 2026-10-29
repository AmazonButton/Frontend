import React from 'react';
import { MapPin, Phone, UserRound } from 'lucide-react';

export const ShippingContact: React.FC<{ order: { customerName?: string; customerPhone?: string; deliveryAddress?: string } }> = ({ order }) => (
  <div className="space-y-2 text-xs text-slate-600 dark:text-zinc-300">
    <p className="flex gap-2"><UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="break-words">{order.customerName || 'Chưa có tên người nhận'}</span></p>
    <p className="flex gap-2"><Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" />{order.customerPhone ? <a href={`tel:${order.customerPhone}`} className="hover:underline">{order.customerPhone}</a> : <span>Chưa có số điện thoại</span>}</p>
    <p className="flex gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="whitespace-pre-line break-words">{order.deliveryAddress || 'Chưa có địa chỉ giao hàng'}</span></p>
  </div>
);
