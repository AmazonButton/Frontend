// Synthetic test data only; these modules are never imported by the production app.
const params = new URLSearchParams(window.location.search);
const empty = params.get('review') === 'empty';
const store = { id: '71', name: 'Cửa hàng kiểm thử', code: 'QA-71', address: 'Địa chỉ kiểm thử', phone: '0900000000' };
export const reviewUser = {
 id: '901', role: params.get('reviewRole') === 'store' ? 'STORE_OWNER' : 'CUSTOMER',
 fullName: 'Khách hàng kiểm thử', email: 'customer@example.test', phone: '0900000000',
 customerProfileId: '901', address: 'Địa chỉ kiểm thử', store,
 customerProfile: { id: '901', storeId: '71', apartment: 'Căn hộ kiểm thử', deliveryAddress: 'Địa chỉ kiểm thử' },
};
const products = [
 { id: '101', name: 'Nước khoáng Vĩnh Hảo 20L', brand: 'Vĩnh Hảo', category: 'Nước uống', unit: 'bình', price: 65000, imageUrl: '/assets/products/vinhhao.png' },
 { id: '102', name: 'Bình gas Petrolimex 12kg', brand: 'Petrolimex', category: 'Gas', unit: 'bình', price: 420000, imageUrl: '/assets/products/Petrolimex.png' },
 { id: '103', name: 'Gạo ST25 túi 5kg', brand: 'ST25', category: 'Thực phẩm', unit: 'túi', price: 185000, imageUrl: '/assets/products/rice-st25.png' },
 { id: '104', name: 'Giấy vệ sinh dùng cho gia đình – gói tiết kiệm', brand: 'Giấy gia đình', category: 'Gia dụng', unit: 'gói', price: 89000, imageUrl: '/assets/products/toilet-paper.jpg' },
].map(p => ({ ...p, storeId: '71', stock: 24, reservedStock: 0, store, isActive: true }));
const devices = products.slice(0, 2).map((product, i) => ({
 id: String(i + 301), deviceId: `QA-BUTTON-${i+1}`, customName: i === 0 ? 'Nút đặt nước phòng bếp' : 'Nút đặt gas',
 status: i === 0 ? 'ACTIVE' : 'DISABLED', batteryLevel: i === 0 ? 87 : 24, wifiRSSI: -58, product,
 configuration: { product, productId: product.id, defaultQuantity: 1, cancelWindowSeconds: 60 },
}));
const orders = ['SHIPPING', 'PENDING', 'COMPLETED', 'CANCELLED'].map((status, i) => ({
 id: String(501+i), orderNumber: `QA-2026-${501+i}`, status, orderStatus: status,
 totalAmount: products[i].price, paymentMethod: i === 1 ? 'PAYOS' : 'COD', paymentStatus: i === 2 ? 'PAID' : 'UNPAID',
 createdAt: '2026-11-05T02:20:00.000Z', customerName: reviewUser.fullName, customerPhone: reviewUser.phone,
 deliveryAddress: 'Địa chỉ kiểm thử có nội dung dài để kiểm tra cách xuống dòng trên điện thoại',
 items: [{ id: String(601+i), productId: products[i].id, productName: products[i].name, quantity: 1, unitPrice: products[i].price, price: products[i].price, totalPrice: products[i].price }],
}));
const packages = [1, 2, 3].map((count, i) => ({
 packageId: i+1, packageCode: `QA-PKG-${i+1}`, packageName: ['Gói cá nhân', 'Gói gia đình', 'Gói nhiều thiết bị'][i],
 description: `${count} nút bấm cho các sản phẩm thường dùng trong gia đình.`,
 buttonQuantity: count, monthlyPrice: count*30000, depositFee: count*150000, isActive: true,
 features: [`${count} nút bấm IoT`, 'Hỗ trợ kết nối thiết bị', 'Điều kiện hoàn cọc theo hợp đồng'],
}));
export function reviewData(url: string, config?: any) {
 if (url.includes('storefront/catalog')) {
  const search = (config?.params?.search || '').toLowerCase();
  return empty ? [] : products.filter(p => p.name.toLowerCase().includes(search));
 }
 if (url === '/devices') return empty ? [] : devices;
 if (url === '/orders') return empty ? [] : orders;
 if (url === '/products') return empty ? [] : products;
 if (url === '/rentals/packages') return empty ? [] : packages;
 if (url === '/rentals/my-rentals') return empty ? [] : [{ rentalId: 801, rentalCode: 'QA-RENT-801', packageId: 2, monthsRented: 3, totalRentAmount: 180000, depositAmount: 300000, startDate: '2026-11-05', endDate: '2027-02-05', status: 'ACTIVE', package: packages[1], buttons: devices }];
 if (url.includes('identity-verifications')) {
  if (!['approved','pending','declined'].includes(params.get('review') || '')) return [];
  return [{ id: 'QA-701', status: params.get('review') === 'approved' ? 'APPROVED' : params.get('review') === 'declined' ? 'DECLINED' : 'PENDING', createdAt: '2026-11-05T02:00:00.000Z', metadata: { fullName: reviewUser.fullName, documentNumber: '000000001234', nationality: 'VNM' } }];
 }
 if (url.includes('/stores')) return [store];
 return [];
}
