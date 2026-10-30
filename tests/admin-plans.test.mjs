import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync(new URL('../src/pages/admin/AdminDashboard.tsx', import.meta.url), 'utf8');
const sidebar = readFileSync(new URL('../src/layouts/Sidebar.tsx', import.meta.url), 'utf8');

test('admin dashboard includes the subscription-plan section and API integration', () => {
  assert.match(dashboard, /'PLANS'/);
  assert.match(dashboard, /api\.get\('\/admin\/plans'\)/);
  assert.match(dashboard, /api\.post\('\/admin\/plans', payload\)/);
  assert.match(dashboard, /api\.put\(`\/admin\/plans\/\$\{encodeURIComponent\(String\(planId\)\)\}`, \{ isActive: nextActive \}\)/);
  assert.match(dashboard, /activeTab === 'PLANS'/);
});

test('admin sidebar links to the subscription-plan section', () => {
  assert.match(sidebar, /\/admin\/dashboard\?section=PLANS/);
});

test('an active store can be suspended from the admin list with a reason', () => {
  assert.match(dashboard, /openStoreActionModal\(String\(sId\), 'SUSPEND'\)/);
  assert.match(dashboard, /api\.post\(`\/admin\/stores\/\$\{rejectingStoreId\}\/reject`, \{/);
  assert.match(dashboard, /Lý do ngừng hoạt động/);
  assert.match(dashboard, /Xác Nhận Ngừng Hoạt Động/);
});
