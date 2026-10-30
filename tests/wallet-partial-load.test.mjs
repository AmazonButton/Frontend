import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/store/StoreWalletPage.tsx', import.meta.url), 'utf8');

test('wallet keeps the balance available when a history endpoint fails', () => {
  assert.match(page, /Promise\.allSettled/);
  assert.match(page, /if \(walletResult\.status !== 'fulfilled'\) throw walletResult\.reason/);
  assert.match(page, /Chưa tải được \$\{unavailableHistories\.join\(' và '\)\} từ máy chủ/);
  assert.match(page, /Số dư ví vẫn được hiển thị/);
});
