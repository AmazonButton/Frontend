import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/pages/store/StoreWalletPage.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('StoreWalletPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
let dependencies;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' &&
      node.arguments[0]?.getText(ast).includes('walletService.lookupBankAccount')) {
    effect = node.arguments[0].getText(ast);
    dependencies = node.arguments[1].getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert(effect, 'Test must execute the real lookup effect');
const js = ts.transpileModule(`(${effect})`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function harness(lookup = async () => ({ data: { accountName: 'DUMMY OWNER' } })) {
  let timer;
  const calls = [];
  const owners = [];
  const loading = [];
  const context = {
    accountNumber: '123456789', selectedBank: { bin: '970422' }, isEditingBank: true,
    accountLookupRequestId: { current: 0 },
    walletService: { lookupBankAccount: (...args) => { calls.push(args); return lookup(...args); } },
    setLookingUpAccount: (v) => loading.push(v), setAccountHolderName: (v) => owners.push(v), setError: () => {},
    window: { setTimeout: (fn) => { timer = fn; return 1; }, clearTimeout: () => { timer = undefined; } },
  };
  return { context, calls, owners, loading, run: () => vm.runInNewContext(js, context)(),
    fire: async () => { const fn = timer; timer = undefined; if (fn) await fn(); } };
}

test('viewing a saved verified account never triggers a lookup', async () => {
  const h = harness(); h.context.isEditingBank = false;
  h.run(); await h.fire(); assert.equal(h.calls.length, 0);
  assert.match(dependencies, /isEditingBank/);
});
test('masked, incomplete, excessive and nonnumeric values never reach backend', async () => {
  for (const value of ['******1234', '', '12345', '12345678901234567890', 'ABC123456', '123 456']) {
    const h = harness(); h.context.accountNumber = value;
    h.run(); await h.fire(); assert.equal(h.calls.length, 0, value);
  }
});
test('valid full account numbers preserve leading zeros and lookup once after debounce', async () => {
  for (const value of ['001234', '1234567890123456789']) {
    const h = harness(); h.context.accountNumber = ` ${value} `;
    h.run(); assert.equal(h.calls.length, 0); await h.fire();
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0][1], value);
    assert.deepEqual(h.owners, ['DUMMY OWNER']);
  }
});
test('cleanup cancels a queued lookup before it sends', async () => {
  const h = harness(); const cleanup = h.run(); cleanup(); await h.fire();
  assert.equal(h.calls.length, 0);
});
test('invalid new input invalidates an already in-flight result', async () => {
  let resolve;
  const h = harness(() => new Promise((done) => { resolve = done; }));
  const cleanup = h.run(); const pending = h.fire();
  cleanup(); h.context.accountNumber = '12345'; h.run();
  resolve({ data: { accountName: 'STALE OWNER' } }); await pending;
  assert.deepEqual(h.owners, []);
  assert.equal(h.loading.at(-1), false);
});
test('closing the form invalidates an in-flight result', async () => {
  let resolve;
  const h = harness(() => new Promise((done) => { resolve = done; }));
  const cleanup = h.run(); const pending = h.fire();
  cleanup(); h.context.isEditingBank = false; h.run();
  resolve({ data: { accountName: 'STALE OWNER' } }); await pending;
  assert.deepEqual(h.owners, []);
});
