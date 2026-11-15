import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
const source = readFileSync(new URL('../src/pages/store/StoreWalletPage.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = {};
function visit(n) {
  if (ts.isVariableDeclaration(n) && ['handleStartBankVerification', 'handleCheckBankVerification'].includes(n.name.getText(ast))) {
    handlers[n.name.getText(ast)] = n.initializer.getText(ast);
  }
  ts.forEachChild(n, visit);
}
visit(ast);
function harness() {
  const calls = []; const errors = []; const notices = [];
  const ctx = {
    wallet: { storeId: '5', bankAccount: { bankBin: '970422', accountHolderName: 'DUMMY OWNER' } },
    verificationAccountNumber: '123456789', verificationBusy: { current: false }, bankVerification: null,
    setVerifyingBank: () => {}, setError: (v) => errors.push(v), setNotice: (v) => notices.push(v),
    setVerificationFeedback: () => {}, formatVND: (v) => `${v} VND`,
    window: { location: { origin: 'http://localhost:5173' } },
    setBankVerification: (v) => { ctx.bankVerification = v; }, setVerificationAccountNumber: () => {},
    walletService: {
      initiateBankVerification: async (v) => { calls.push(v); return { data: { verificationId: '12', amount: 2000 } }; },
      getBankVerification: async (v) => { calls.push(v); return { data: { status: 'PENDING' } }; },
    },
    refresh: async () => { calls.push('refresh'); },
  };
  return { ctx, calls, errors, notices, run: (name) => vm.runInNewContext(ts.transpileModule(`(${handlers[name]})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText, ctx)() };
}
test('verification rejects a masked account without creating a session', async () => {
  const h = harness(); h.ctx.verificationAccountNumber = '******1234';
  await h.run('handleStartBankVerification'); assert.equal(h.calls.length, 0); assert(h.errors.at(-1));
});
test('verification creates the store penny session without marking ownership verified', async () => {
  const h = harness(); await h.run('handleStartBankVerification');
  assert.equal(h.calls[0].storeId, '5'); assert.equal(h.calls[0].bankBin, '970422');
  assert.equal(h.calls[0].accountNumber, '123456789');
  assert.equal(new URL(h.calls[0].returnUrl).origin, 'http://localhost:5173');
  assert.equal(h.ctx.bankVerification.verificationId, '12');
  assert.equal(h.ctx.wallet.bankAccount.verificationStatus, undefined);
});
test('duplicate verification clicks cannot create concurrent sessions', async () => {
  const h = harness(); h.ctx.verificationBusy.current = true;
  await h.run('handleStartBankVerification'); assert.equal(h.calls.length, 0);
});
test('checking pending verification refreshes authoritative wallet metadata', async () => {
  const h = harness(); h.ctx.bankVerification = { verificationId: '12' };
  await h.run('handleCheckBankVerification'); assert.deepEqual(h.calls, ['12', 'refresh']);
  assert.equal(h.ctx.wallet.bankAccount.verificationStatus, undefined);
  assert(h.notices.at(-1).includes('PENDING'));
});
