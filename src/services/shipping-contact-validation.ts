export type ShippingContactField = 'customerName' | 'customerPhone' | 'deliveryAddress';
export type ShippingContact = Record<ShippingContactField, string>;

// Checkout input checks belong to the frontend. Send only the existing API's
// contact fields; backend source and validation contracts remain read-only.
const fullNamePattern = /^\p{L}[\p{L}\p{M}]*(?:['’-]\p{L}[\p{L}\p{M}]*)*(?: \p{L}[\p{L}\p{M}]*(?:['’-]\p{L}[\p{L}\p{M}]*)*)+$/u;
const mobilePattern = /^0[35789]\d{8}$/;
const addressPattern = /^[\p{L}\p{M}\p{N} ,./()#:'’-]+$/u;

export function normalizeShippingContact(contact: ShippingContact): ShippingContact {
  return {
    customerName: contact.customerName.normalize('NFC').trim().replace(/ +/g, ' '),
    customerPhone: contact.customerPhone.trim(),
    deliveryAddress: contact.deliveryAddress.normalize('NFC').trim().replace(/\s+/g, ' '),
  };
}

export function getShippingContactErrors(input: ShippingContact): Partial<Record<ShippingContactField, string>> {
  const contact = normalizeShippingContact(input);
  const errors: Partial<Record<ShippingContactField, string>> = {};
  if (!contact.customerName) errors.customerName = 'Vui lòng nhập họ và tên người nhận hàng.';
  else if (Array.from(contact.customerName).length > 100) errors.customerName = 'Họ và tên không được vượt quá 100 ký tự.';
  else if (!fullNamePattern.test(contact.customerName)) errors.customerName = 'Vui lòng nhập đầy đủ họ và tên (ít nhất 2 từ), chỉ dùng chữ; không nhập số hoặc ký hiệu đặc biệt.';

  if (!contact.customerPhone) errors.customerPhone = 'Vui lòng nhập số điện thoại của người nhận hàng.';
  else if (!mobilePattern.test(contact.customerPhone)) errors.customerPhone = 'Số điện thoại phải có 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09; không có chữ, dấu cách hoặc ký hiệu.';

  if (!contact.deliveryAddress) errors.deliveryAddress = 'Vui lòng nhập địa chỉ nhận hàng.';
  else if (Array.from(contact.deliveryAddress).length > 255) errors.deliveryAddress = 'Địa chỉ không được vượt quá 255 ký tự.';
  else if (!addressPattern.test(contact.deliveryAddress)) errors.deliveryAddress = 'Địa chỉ chỉ được dùng chữ, số và dấu phân cách thông dụng; không nhập emoji hoặc ký hiệu đặc biệt.';
  else if (Array.from(contact.deliveryAddress).length < 15 || !/\p{L}/u.test(contact.deliveryAddress) || !/^\S+(?: +\S+){2,}$/u.test(contact.deliveryAddress)) errors.deliveryAddress = 'Vui lòng nhập địa chỉ đầy đủ (ít nhất 15 ký tự): số nhà/đường hoặc thôn/ấp, phường/xã và tỉnh/thành phố.';
  return errors;
}
