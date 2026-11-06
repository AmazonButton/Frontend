import assert from 'node:assert/strict';
import test from 'node:test';
import { activateRentalContract, asItems, canActivateRental, canManageIdentity, canPayout, checkedData, deleteIdentitySession, executeWithdrawalQueue, getIdentitySession, loadAdminPayoutOverview, loadIdentitySessions, performWithdrawalAction, prepareWithdrawalBatch, syncIdentitySession } from '../src/pages/admin/admin-workflows.mjs';

const response = data => ({ data: { success: true, data } });
const withdrawal = (id = 12, overrides = {}) => ({ withdrawalId: String(id), withdrawalCode: `WD-${id}`, amount: '150000', status: 'PENDING', wallet: { bankBin: '970422', bankAccount: '0123456789' }, ...overrides });

test('payout overview keeps withdrawal data when PayOS is unavailable', async () => {
  const client = { get: async path => { if (path.includes('payos')) throw new Error('Unavailable'); return response([withdrawal()]); } };
  const state = await loadAdminPayoutOverview(client);
  assert.equal(state.withdrawals.length, 1); assert.equal(state.payouts, undefined); assert.equal(state.balance, undefined); assert.equal(state.errors.length, 2);
});
test('failed withdrawal load is unavailable rather than an empty successful list', async () => {
  const state = await loadAdminPayoutOverview({ get: async path => { if (path === '/admin/withdrawals') throw new Error('No access'); return response([]); } });
  assert.equal(state.withdrawals, undefined); assert.equal(state.errors[0].section, 'yêu cầu rút tiền');
});
test('withdrawal section becomes available without waiting for the slower provider', async () => {
  let release; const waiting = new Promise(resolve => { release = resolve; }); const sections = [];
  const request = loadAdminPayoutOverview({ get: async path => { if (path.includes('payos')) await waiting; return response(path === '/admin/withdrawals' ? [withdrawal()] : []); } }, section => sections.push(section));
  await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(sections, [0]); release(); await request; assert.equal(sections.length, 3);
});
test('request envelope failure is not reported as success', () => {
  assert.throws(() => checkedData({ data: { success: false, message: 'Không đủ số dư' } }), /Không đủ số dư/);
  assert.throws(() => checkedData(response({ code: '601', desc: 'Provider unavailable' })), /Provider unavailable/);
});
test('payouts support direct and provider-nested list envelopes', () => {
  assert.deepEqual(asItems({ data: { payouts: [{ id: 'p1' }] } }), [{ id: 'p1' }]);
  assert.deepEqual(asItems(null), []);
});
test('PayOS payout requires complete destination, minimum amount and pending status', () => {
  assert.equal(canPayout(withdrawal()), true);
  for (const item of [withdrawal(1, { status: 'PROCESSING' }), withdrawal(1, { amount: 999 }), withdrawal(1, { amount: 'NaN' }), withdrawal(1, { wallet: { bankAccount: '0123' }, bankCode: 'MB' }), withdrawal(1, { withdrawalId: '../12' })]) assert.equal(canPayout(item), false);
});
test('estimate has stable provider references matching single-withdrawal backend flow', () => {
  const items = [withdrawal(12), withdrawal(13, { providerReferenceId: 'provider-stable' })];
  const first = prepareWithdrawalBatch(items), second = prepareWithdrawalBatch([...items].reverse());
  assert.equal(first.referenceId, second.referenceId); assert.equal(first.payouts[0].referenceId, 'WD-12'); assert.equal(first.payouts[1].referenceId, 'provider-stable');
  assert.equal(first.payouts[0].amount, 150000); assert.equal(first.payouts[0].toAccountNumber, '0123456789'); assert.equal(first.validateDestination, true);
});
test('batch refuses duplicates and invalid records before sending money', () => {
  assert.throws(() => prepareWithdrawalBatch([])); assert.throws(() => prepareWithdrawalBatch([withdrawal(), withdrawal()]), /trùng/);
  assert.throws(() => prepareWithdrawalBatch([withdrawal(1, { status: 'TRANSFERRED' })]));
});
test('single PayOS payout uses atomic withdrawal endpoint with no client-side status fabrication', async () => {
  const calls = []; const item = withdrawal();
  const data = await performWithdrawalAction({ post: async (...args) => { calls.push(args); return response({ status: 'PROCESSING' }); } }, item, 'payout');
  assert.deepEqual(calls, [['/admin/withdrawals/12/payout', {}]]); assert.equal(data.status, 'PROCESSING'); assert.equal(item.status, 'PENDING');
});
test('reject requires reason and sends only the intended field', async () => {
  const calls = []; const client = { post: async (...args) => { calls.push(args); return response({ status: 'REJECTED' }); } };
  await assert.rejects(performWithdrawalAction(client, withdrawal(), 'reject', { reason: ' ' }), /lý do/); assert.equal(calls.length, 0);
  await performWithdrawalAction(client, withdrawal(), 'reject', { reason: '  Sai tài khoản  ', ignored: 'x' });
  assert.deepEqual(calls[0], ['/admin/withdrawals/12/reject', { reason: 'Sai tài khoản' }]);
});
test('manual transfer validates evidence URL and prevents executable protocols', async () => {
  const calls = []; const client = { post: async (...args) => { calls.push(args); return response({}); } };
  for (const transferEvidenceUrl of ['', 'javascript:alert(1)', '/relative']) await assert.rejects(performWithdrawalAction(client, withdrawal(), 'transfer', { transferEvidenceUrl }));
  assert.equal(calls.length, 0);
  await performWithdrawalAction(client, withdrawal(), 'transfer', { transferEvidenceUrl: 'https://example.test/evidence.png' });
  assert.deepEqual(calls[0][1], { transferEvidenceUrl: 'https://example.test/evidence.png' });
});
test('already processed withdrawal cannot be transferred or rejected again', async () => {
  let calls = 0; const client = { post: async () => { calls += 1; } };
  for (const action of ['transfer', 'reject', 'payout']) await assert.rejects(performWithdrawalAction(client, withdrawal(1, { status: 'TRANSFERRED' }), action));
  assert.equal(calls, 0);
});
test('multi-select queue is sequential, records partial errors, never retries or invokes unsafe raw batch', async () => {
  const calls = []; let active = 0, maxActive = 0; const progress = [];
  const client = { post: async path => { calls.push(path); active += 1; maxActive = Math.max(maxActive, active); await Promise.resolve(); active -= 1; if (path.includes('/13/')) throw new Error('Network response uncertain'); return response({ status: 'PROCESSING' }); } };
  const results = await executeWithdrawalQueue(client, [withdrawal(12), withdrawal(13), withdrawal(14)], value => progress.push(value.length));
  assert.deepEqual(calls, ['/admin/withdrawals/12/payout', '/admin/withdrawals/13/payout', '/admin/withdrawals/14/payout']);
  assert.equal(maxActive, 1); assert.deepEqual(results.map(item => item.success), [true, false, true]); assert.deepEqual(progress, [1, 2, 3]); assert.match(results[1].message, /uncertain/);
});
test('provider sync never mutates local withdrawal status', async () => {
  const item = withdrawal(12, { status: 'PROCESSING' });
  const result = await performWithdrawalAction({ post: async () => response({ withdrawal: item, statusData: { status: 'SUCCEEDED' } }) }, item, 'sync-payout');
  assert.equal(item.status, 'PROCESSING'); assert.equal(result.statusData.status, 'SUCCEEDED');
});
test('identity capability matches backend list/detail rules', () => {
  assert.equal(canManageIdentity({ role: 'ADMIN' }), true); assert.equal(canManageIdentity({ role: 'SUPER_ADMIN' }), true); assert.equal(canManageIdentity({ role: 'SYSTEM_ADMIN' }), true);
  for (const role of ['STORE_OWNER', 'STORE_MANAGER', 'CUSTOMER']) assert.equal(canManageIdentity({ role }), false);
});
test('identity list keeps server pagination and scoped query', async () => {
  const calls = []; const result = await loadIdentitySessions({ get: async (...args) => { calls.push(args); return { data: { success: true, data: [{ sessionId: '1' }], pagination: { page: 2, totalPages: 3, totalItems: 45 } } }; } }, 2);
  assert.deepEqual(calls, [['/identity-verifications/sessions', { params: { page: 2, pageSize: 20 } }]]); assert.equal(result.pagination.totalPages, 3); assert.equal(result.items.length, 1);
});
test('identity update rereads canonical session after decision endpoint', async () => {
  const calls = []; const client = { get: async path => { calls.push(path); return response(path.endsWith('/decision') ? { status: 'PENDING', decision: { status: 'Approved' } } : { sessionId: '7', status: 'APPROVED' }); } };
  const updated = await syncIdentitySession(client, '7');
  assert.deepEqual(calls, ['/identity-verifications/sessions/7/decision', '/identity-verifications/sessions/7']); assert.equal(updated.status, 'APPROVED');
});
test('identity deletion waits for backend success and propagates provider failure', async () => {
  let called = ''; await deleteIdentitySession({ delete: async path => { called = path; return response(null); } }, '8');
  assert.equal(called, '/identity-verifications/sessions/8');
  await assert.rejects(deleteIdentitySession({ delete: async () => { throw new Error('Provider failed'); } }, '8'), /Provider failed/);
  await assert.rejects(getIdentitySession({ get: async () => { throw new Error('must not call'); } }, '../1'), /không hợp lệ/);
});
test('rental activation role matches controller and only succeeds with canonical ACTIVE status', async () => {
  assert.equal(canActivateRental({ role: 'ADMIN' }), true); assert.equal(canActivateRental({ role: 'SYSTEM_ADMIN' }), true); assert.equal(canActivateRental({ role: 'SUPER_ADMIN' }), true);
  const calls = []; const result = await activateRentalContract({ post: async path => { calls.push(path); return response({ rentalId: '9', status: 'ACTIVE' }); } }, ' 9 ');
  assert.equal(result.status, 'ACTIVE'); assert.deepEqual(calls, ['/rentals/9/activate']);
  await assert.rejects(activateRentalContract({ post: async () => response({ status: 'PENDING_PAYMENT' }) }, '9'), /chưa xác nhận/);
});
test('rental activation preserves unpaid backend rejection and rejects invalid contract IDs', async () => {
  let calls = 0; const client = { post: async () => { calls += 1; throw new Error('Chưa thanh toán'); } };
  for (const id of ['0', 'RNT-1', '-1', '../9']) await assert.rejects(activateRentalContract(client, id), /hợp lệ/);
  assert.equal(calls, 0); await assert.rejects(activateRentalContract(client, '9'), /Chưa thanh toán/); assert.equal(calls, 1);
});
