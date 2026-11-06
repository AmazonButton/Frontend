import assert from 'node:assert/strict';
import test from 'node:test';
import { readCustomerVerificationDetails } from '../src/components/customer/customer-verification-details.mjs';

test('customer verification detail reads actual known session and checks owner', async () => {
  const calls = []; const session = { sessionId: '12', userId: '8', status: 'APPROVED' };
  const actual = await readCustomerVerificationDetails({ get: async path => { calls.push(path); return { data: { success: true, data: session } }; } }, '12', '8');
  assert.equal(actual, session); assert.deepEqual(calls, ['/identity-verifications/sessions/12']);
});
test('missing or invalid session identifiers never cause a request', async () => {
  let calls = 0;
  for (const id of [undefined, '', '0', '../12', 'provider-uuid']) await assert.rejects(readCustomerVerificationDetails({ get: async () => { calls++; } }, id, '8'));
  assert.equal(calls, 0);
});
test('business errors and different customer data never display a successful detail', async () => {
  await assert.rejects(readCustomerVerificationDetails({ get: async () => ({ data: { success: false, message: 'Denied' } }) }, '12', '8'), /Denied/);
  for (const data of [{ sessionId: '12', userId: '99' }, { sessionId: '99', userId: '8' }]) await assert.rejects(readCustomerVerificationDetails({ get: async () => ({ data: { success: true, data } }) }, '12', '8'), /không khớp/);
});
