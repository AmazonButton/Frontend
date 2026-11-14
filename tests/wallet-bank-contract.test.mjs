import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/services/wallet.service.ts', import.meta.url), 'utf8');
function load(put) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: () => ({ api: { put } }) });
  return exports.walletService;
}
const bank = { bankName: 'TPBank', bankBin: '970423', accountNumber: '123456789', accountHolderName: 'DUMMY OWNER' };
test('bank save sends one canonical backend request including selected BIN', async () => {
  const calls = [];
  const service = load(async (...args) => { calls.push(args); return { data: { success: true } }; });
  assert.equal((await service.updateBankAccount(bank, '5')).success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], '/store/wallet/bank-account');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1])), {
    bankName: 'TPBank', bankBin: '970423', bankAccountNumber: '123456789', bankAccountHolder: 'DUMMY OWNER',
  });
  assert.equal(calls[0][2].params.storeId, '5');
});
test('bank save surfaces 400 without retrying a mutation with another shape', async () => {
  let calls = 0;
  const error = { response: { status: 400, data: { message: 'Validation failed' } } };
  const service = load(async () => { calls++; throw error; });
  await assert.rejects(service.updateBankAccount(bank), (actual) => actual === error);
  assert.equal(calls, 1);
});
