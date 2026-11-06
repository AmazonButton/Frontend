import assert from 'node:assert/strict';
import test from 'node:test';
import { cancelPendingPaymentLink, paymentToolData, readCanonicalPaymentOrder, readKnownPaymentTransaction, readProviderLink, refreshPaymentRecords, validPaymentOrderCode } from '../src/components/orders/payment-request-tools.mjs';

const result = data => ({ success: true, data });
const link = (orderCode, status = 'PENDING') => ({ orderCode, status });

test('payment link identifier must be an actual safe provider order code', () => {
  assert.equal(validPaymentOrderCode(1700000000000), true);
  for (const value of [undefined, null, '', 0, -1, '../7', 'payment-id', '9007199254740992']) assert.equal(validPaymentOrderCode(value), false);
});
test('provider business errors within HTTP success are rejected', () => {
  assert.throws(() => paymentToolData({ success: false, message: 'Denied' }), /Denied/);
  assert.throws(() => paymentToolData(result({ code: '123', desc: 'Cannot cancel' })), /Cannot cancel/);
});
test('cancellation checks canonical PENDING first and submits the provider link only', async () => {
  const calls = [];
  const service = { getPaymentLinkInfo: async code => { calls.push(['read', code]); return result(link(code)); }, cancelPaymentLink: async (code, reason) => { calls.push(['cancel', code, reason]); return result(link(code, 'CANCELLED')); } };
  const cancelled = await cancelPendingPaymentLink(service, 1201, '  Chọn lại thanh toán  ');
  assert.deepEqual(calls, [['read', 1201], ['cancel', 1201, 'Chọn lại thanh toán']]); assert.equal(cancelled.link.status, 'CANCELLED'); assert.equal(cancelled.alreadyCancelled, false);
});
test('paid and processing links cannot be cancelled', async () => {
  for (const status of ['PAID', 'PROCESSING', 'EXPIRED']) {
    let calls = 0; const service = { getPaymentLinkInfo: async code => result(link(code, status)), cancelPaymentLink: async () => { calls++; } };
    await assert.rejects(cancelPendingPaymentLink(service, 1300 + calls + status.length, 'x')); assert.equal(calls, 0);
  }
});
test('already cancelled link does not issue another cancellation', async () => {
  let calls = 0; const outcome = await cancelPendingPaymentLink({ getPaymentLinkInfo: async code => result(link(code, 'CANCELLED')), cancelPaymentLink: async () => { calls++; } }, 1401);
  assert.equal(calls, 0); assert.equal(outcome.alreadyCancelled, true);
});
test('parallel clicks or remounts share a single in-flight cancellation without automatic retries', async () => {
  let release; const wait = new Promise(resolve => { release = resolve; }); let reads = 0, cancels = 0;
  const service = { getPaymentLinkInfo: async code => { reads++; await wait; return result(link(code)); }, cancelPaymentLink: async code => { cancels++; return result(link(code, 'CANCELLED')); } };
  const first = cancelPendingPaymentLink(service, 1501), second = cancelPendingPaymentLink(service, 1501); assert.equal(first, second); release(); await Promise.all([first, second]); assert.equal(reads, 1); assert.equal(cancels, 1);
});
test('failed cancellation is never interpreted as cancelled, including misleading success envelopes', async () => {
  for (const response of [result({ code: '99', desc: 'Race with payment' }), result(link(1601, 'PAID')), result({}), { success: false, message: 'Cannot cancel' }]) {
    const service = { getPaymentLinkInfo: async code => result(link(code)), cancelPaymentLink: async () => response };
    await assert.rejects(cancelPendingPaymentLink(service, 1601));
  }
});
test('provider mismatched link and unrecognized response cannot trigger cancellation', async () => {
  await assert.rejects(readProviderLink({ getPaymentLinkInfo: async () => result(link(9999)) }, 1701), /không khớp/);
  await assert.rejects(readProviderLink({ getPaymentLinkInfo: async () => result({}) }, 1701), /hợp lệ/);
});
test('refresh reads provider and canonical order separately, preserving actual unpaid order status', async () => {
  const original = { id: '27', status: 'PENDING', paymentStatus: 'UNPAID', paymentMethod: 'PAYOS' };
  const paths = []; const state = await refreshPaymentRecords({ getPaymentLinkInfo: async code => result(link(code, 'CANCELLED')) }, { get: async path => { paths.push(path); return { data: result(original) }; } }, 1801, '27');
  assert.equal(state.provider.status, 'CANCELLED'); assert.equal(state.order.paymentStatus, 'UNPAID'); assert.equal(state.order.status, 'PENDING'); assert.deepEqual(paths, ['/orders/27']); assert.equal(state.warnings.length, 0);
});
test('refresh retains known provider result when order follow-up fails without inventing an order event', async () => {
  const state = await refreshPaymentRecords({ getPaymentLinkInfo: async code => result(link(code, 'CANCELLED')) }, { get: async () => { throw new Error('Read unavailable'); } }, 1901, '28');
  assert.equal(state.provider.status, 'CANCELLED'); assert.equal(state.order, null); assert.equal(state.warnings.length, 1); assert.match(state.warnings[0], /Read unavailable/);
});
test('canonical order read rejects a mismatched order before publishing', async () => {
  await assert.rejects(readCanonicalPaymentOrder({ get: async () => ({ data: result({ id: '999' }) }) }, '29'), /không khớp/);
});
test('transaction detail uses only the known ID and verifies transaction-order association', async () => {
  const calls = []; const service = { getTransaction: async id => { calls.push(id); return result({ paymentTransactionId: '31', orderId: '30', status: 'PENDING', amount: 2000 }); } };
  const transaction = await readKnownPaymentTransaction(service, '31', '30'); assert.equal(transaction.status, 'PENDING'); assert.deepEqual(calls, ['31']);
  await assert.rejects(readKnownPaymentTransaction(service, undefined, '30'), /Chưa có mã/); assert.deepEqual(calls, ['31']);
  await assert.rejects(readKnownPaymentTransaction(service, '31', 'other-order'), /không khớp/);
});
