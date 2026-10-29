import assert from 'node:assert/strict';
import test from 'node:test';
import { getOrderRecipient, mergeOrderUpdate, normalizeOrder, normalizeOrderEvent, orderEventKey } from '../src/services/order-events.ts';

test('Existing checkout response maps contact and order identity without requiring backend changes', () => {
  const order = normalizeOrder({ orderId: '17', orderCode: 'WEB-TEST', orderStatus: 'PENDING', customerName: 'Test recipient', customerPhone: '0900000000', deliveryAddress: '12/3 Test Street, Test Ward, Test City', items: [] });
  assert.equal(order.id, '17');
  assert.equal(order.orderNumber, 'WEB-TEST');
  assert.equal(order.customerPhone, '0900000000');
  assert.equal(order.status, 'PENDING');
});

test('Nested cancellation from the existing backend retains order code and reason', () => {
  const event = normalizeOrderEvent({ order: { id: '17', orderNumber: 'WEB-TEST', status: 'CANCELLED' }, reason: 'Test cancellation reason' });
  assert.equal(event.orderId, '17');
  assert.equal(event.orderNumber, 'WEB-TEST');
  assert.equal(event.status, 'CANCELLED');
  assert.equal(event.reason, 'Test cancellation reason');
});

test('Socket and API reconciliation share the same key to suppress duplicate notifications', () => {
  assert.equal(orderEventKey('ORDER_CANCELLED', { order: { id: '17', status: 'CANCELLED' } }), orderEventKey('ORDER_CANCELLED', { orderId: '17', orderStatus: 'CANCELLED' }));
  assert.equal(normalizeOrderEvent({ orderId: '17' }, 'ORDER_CANCELLED').status, 'CANCELLED');
});

test('Store owner and manager views use the saved recipient ahead of the buyer account', () => {
  const order = normalizeOrder({
    id: '17', shippingRecipientName: 'Actual Recipient', shippingPhone: '0900000000', shippingAddress: '12 Test Street, Test Ward, Test City',
    customerName: 'Account Holder', customerPhone: '0800000000', deliveryAddress: 'Old profile address',
    customer: { fullName: 'Other Account Name', phoneNumber: '0700000000' },
  });
  assert.equal(order.customerName, 'Actual Recipient');
  assert.equal(order.customerPhone, '0900000000');
  assert.equal(order.deliveryAddress, '12 Test Street, Test Ward, Test City');
});

test('Flattened API contact remains ahead of nested profile data for orders placed on behalf of someone else', () => {
  const order = normalizeOrder({ id: '17', customerName: 'Actual Recipient', customerPhone: '0900000000', deliveryAddress: 'Test destination', customer: { user: { fullName: 'Account Holder', phone: '0800000000' } } });
  assert.equal(order.customerName, 'Actual Recipient');
  assert.equal(order.customerPhone, '0900000000');
});

test('Legacy profile fallbacks are used only when no order-recipient contact is supplied', () => {
  assert.deepEqual(getOrderRecipient({ customer: { user: { fullName: 'Legacy Recipient', phone: '0900000000' } } }), {
    customerName: 'Legacy Recipient', customerPhone: '0900000000', deliveryAddress: '',
  });
  assert.deepEqual(getOrderRecipient({}), { customerName: '', customerPhone: '', deliveryAddress: '' });
});

test('Snake-case snapshots, leading zeros, accents, and a complete multi-line address survive display normalization', () => {
  const address = 'Căn 12/3, tầng 8, tòa Kiểm Thử\nPhường Kiểm Thử, Thành phố Kiểm Thử';
  const order = normalizeOrder({ orderId: '17', shipping_recipient_name: 'Nguyễn Văn An', shipping_phone: '0900000000', shipping_address: address });
  assert.equal(order.customerName, 'Nguyễn Văn An');
  assert.equal(order.customerPhone, '0900000000');
  assert.equal(order.deliveryAddress, address);
});

test('A partial status event does not erase the contact currently visible to store staff', () => {
  const current = normalizeOrder({ id: '17', customerName: 'Actual Recipient', customerPhone: '0900000000', deliveryAddress: 'Test destination' });
  const updated = mergeOrderUpdate(current, { id: '17', orderStatus: 'CONFIRMED', customerName: '', customerPhone: null, deliveryAddress: undefined });
  assert.equal(updated.status, 'CONFIRMED');
  assert.equal(updated.customerName, current.customerName);
  assert.equal(updated.customerPhone, current.customerPhone);
  assert.equal(updated.deliveryAddress, current.deliveryAddress);
});

test('A complete updated order replaces the recipient with the latest API snapshot', () => {
  const current = normalizeOrder({ id: '17', shippingRecipientName: 'Original Recipient', shippingPhone: '0900000000', shippingAddress: 'Original destination' });
  const updated = mergeOrderUpdate(current, { id: '17', shippingRecipientName: 'Updated Recipient', shippingPhone: '0800000000', shippingAddress: 'Updated destination' });
  assert.equal(updated.customerName, 'Updated Recipient');
  assert.equal(updated.customerPhone, '0800000000');
  assert.equal(updated.deliveryAddress, 'Updated destination');
});

