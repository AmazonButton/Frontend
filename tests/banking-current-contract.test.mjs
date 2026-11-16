import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as banking from '../src/services/banking-flow.ts';
import * as frontendBanking from '../frontend/src/services/banking-flow.ts';
import * as finance from '../src/services/store-finance-flow.ts';
import * as frontendFinance from '../frontend/src/services/store-finance-flow.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const future = '2099-01-01T00:00:00Z';
const receipt = { verificationId: '21', bankAccountId: '31', bankName: 'Test Bank', accountName: 'TEST OWNER', accountNumberMasked: '******0123', referenceCode: 'VERIFY_INTERNAL', transferDescription: 'S1234567', amount: 3500, expiresAt: future, instructions: 'Server instructions' };

for (const flow of [finance, frontendFinance]) {
  test('store verification sends the live callback DTO and preserves the server transfer description', async () => {
    const calls = [];
    const api = flow.createStoreFinanceFlow({ post: async (path, body) => { calls.push({ path, body }); return { data: { success: true, data: receipt } }; } });
    const result = await api.verify('90071992547409931', '970423', '000123456', 'TEST OWNER', 'http://localhost:5173');
    assert.deepEqual(calls, [{ path: '/stores/bank-accounts/verification', body: {
      storeId: '90071992547409931', bankBin: '970423', accountNumber: '000123456', accountName: 'TEST OWNER',
      returnUrl: 'http://localhost:5173/store/wallet?bank_verification=return', cancelUrl: 'http://localhost:5173/store/wallet?bank_verification=cancel',
    } }]);
    assert.equal(result.transferDescription, 'S1234567');
    assert.equal(flow.readFinanceVerification(JSON.stringify(result)).transferDescription, 'S1234567');
    assert.equal(flow.readFinanceVerification(JSON.stringify({ ...receipt, transferDescription: { wrong: true } })), null);
    await assert.rejects(api.verify('12', '970423', '000123456', undefined, 'https://user:pass@example.com'));
    assert.equal(calls.length, 1);
  });
  test('bank callbacks return to bank management and ordinary wallet navigation keeps its destination', () => {
    assert.equal(flow.storeWalletRedirect('?bank_verification=return&status=PAID&id=untrusted'), '/store/finance?bank_verification=return#store-bank-accounts');
    assert.equal(flow.storeWalletRedirect('?bank_verification=cancel'), '/store/finance?bank_verification=cancel#store-bank-accounts');
    assert.equal(flow.storeWalletRedirect(''), '/store/analytics?tab=WALLET');
    assert.equal(flow.storeWalletRedirect('?bank_verification=https://evil.invalid'), '/store/analytics?tab=WALLET');
    assert.deepEqual(flow.storeBankReturnUrls('https://buttontdash.vercel.app'), {
      returnUrl: 'https://buttontdash.vercel.app/store/wallet?bank_verification=return', cancelUrl: 'https://buttontdash.vercel.app/store/wallet?bank_verification=cancel',
    });
  });
}

for (const flow of [banking, frontendBanking]) {
  test('customer QR belongs to the fresh payable server session and disappears once paid', () => {
    const status = { accountId: '31', accountVerificationStatus: 'PENDING', session: { sessionReference: 'SESSION', sessionStatus: 'ACTIVE', verificationStatus: 'PENDING', paymentStatus: 'PENDING', isExpired: false, expiresAt: future, checkoutUrl: 'https://pay.payos.vn/web/test', qrCode: '000201SERVER_QR' } };
    assert.equal(flow.customerBankCheckout(status, null).qrCode, '000201SERVER_QR');
    assert.equal(flow.customerBankCheckout({ ...status, session: { ...status.session, paymentStatus: 'PAID' } }, null), null);
    assert.equal(flow.customerBankCheckout({ ...status, session: { ...status.session, isExpired: true } }, null), null);
    const withoutQr = { ...status, session: { ...status.session, qrCode: null } };
    const otherSession = { accountId: '31', sessionReference: 'OTHER', sessionStatus: 'ACTIVE', verificationStatus: 'PENDING', expiresAt: future, qrCode: '000201STALE' };
    assert.equal(flow.customerBankCheckout(withoutQr, otherSession).qrCode, undefined);
    for (const value of [null, {}, 'https://evil.invalid/qr', '000201' + 'a'.repeat(2000), '000201' + 'ệ'.repeat(1000)]) assert.equal(flow.bankQrPayload(value), null);
    assert.equal(flow.bankTransferDescription(receipt), 'S1234567');
    assert.equal(flow.bankTransferDescription({ referenceCode: 'LEGACY' }), 'LEGACY');
  });
}

for (const prefix of ['../src/', '../frontend/src/']) {
  test(prefix + 'renders the exact bank transfer description and backend QR as SVG', () => {
    const source = readFileSync(new URL(prefix + 'components/common/BankingPrimitives.tsx', import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const exports = {};
    vm.runInNewContext(code, { exports, URL, Date, require: name => name.endsWith('/banking-flow') ? banking : require(name) });
    const html = renderToStaticMarkup(React.createElement(exports.BankTransferInstructions, { receipt }));
    assert.match(html, /S1234567/);
    assert.doesNotMatch(html, /VERIFY_INTERNAL/);
    const qr = renderToStaticMarkup(React.createElement(exports.BankPaymentQr, { value: '000201SERVER_QR' }));
    assert.match(qr, /<svg/);
    assert.doesNotMatch(qr, /<img/);
    assert.equal(renderToStaticMarkup(React.createElement(exports.BankPaymentQr, { value: 'https://evil.invalid' })), '');
  });
}
