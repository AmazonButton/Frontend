import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
const source = readFileSync(new URL('../src/pages/store/StoreWalletPage.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(n) {
  if (ts.isCallExpression(n) && n.expression.getText(ast) === 'useEffect' && n.arguments[0]?.getText(ast).includes('walletService.getBankVerification')) effect = n.arguments[0].getText(ast);
  ts.forEachChild(n, visit);
}
visit(ast); assert(effect);
const code = ts.transpileModule(`(${effect})`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
test('reload restores only an authorized server session, never ownership from browser storage', async () => {
  const calls = []; const restored = [];
  const wallet = { storeId: '5' };
  const ctx = { wallet, localStorage: { getItem: () => '12' },
    walletService: { getBankVerification: async (id) => { calls.push(id); return { data: { verificationId: '12', expectedAmount: 2000, status: 'PENDING' } }; } },
    setBankVerification: (v) => restored.push(v), setVerificationFeedback: () => {} };
  vm.runInNewContext(code, ctx)(); await new Promise(setImmediate);
  assert.deepEqual(calls, ['12']); assert.equal(restored[0].amount, 2000);
  assert.equal(wallet.verificationStatus, undefined);
});
test('malformed stored identifier does not generate a request', () => {
  let called = false;
  vm.runInNewContext(code, { wallet: { storeId: '5' }, localStorage: { getItem: () => '../../bad' },
    walletService: { getBankVerification: () => { called = true; } } })();
  assert.equal(called, false);
});
test('without browser state, history recovery selects the exact saved bank account ID', async () => {
  const calls = []; const restored = [];
  const ctx = { wallet: { storeId: '5', bankAccount: { id: '8' } },
    localStorage: { getItem: () => null, setItem: () => {} },
    walletService: {
      getBankVerificationHistory: async () => ({ data: [
        { bankAccountId: '9', verificationId: '99' }, { bankAccountId: '8', verificationId: '12' },
      ] }),
      getBankVerification: async (id) => { calls.push(id); return { data: { verificationId: id, expectedAmount: 2000, status: 'PENDING' } }; },
    }, setBankVerification: (v) => restored.push(v), setVerificationFeedback: () => {} };
  vm.runInNewContext(code, ctx)(); await new Promise(setImmediate);
  assert.deepEqual(calls, ['12']); assert.equal(restored[0].verificationId, '12');
});
