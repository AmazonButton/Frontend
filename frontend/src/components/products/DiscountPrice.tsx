import React from 'react';
import { ProductDiscount, discountedPrice } from '../../services/product-discounts';
const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
export function DiscountPrice({ price, discounts, now, quantity = 1 }: { price: number; discounts?: ProductDiscount[]; now: number; quantity?: number }) {
  const finalPrice = discountedPrice(price, discounts, now);
  return <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1">
    <span>{money(finalPrice * quantity)}</span>
    {finalPrice < price && <><del className="text-xs font-normal text-slate-400">{money(price * quantity)}</del><span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">−{Math.round((price - finalPrice) / price * 100)}%</span></>}
  </span>;
}
