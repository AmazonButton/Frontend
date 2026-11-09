import * as dashboardMetrics from '../src/services/dashboard-metrics.ts';
import * as adminSubscriptions from '../src/services/admin-store-subscriptions.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const React = require('react');
const { renderToString } = require('react-dom/server');
const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;

for (const prefix of ['../src/', '../../src/']) {
  const sidebar = readFileSync(new URL(`${prefix}layouts/Sidebar.tsx`, import.meta.url), 'utf8');
  const tree = ts.createSourceFile('Sidebar.tsx', sidebar, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let activeCallback, adminPaths;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'isLinkActive') activeCallback = node.initializer.getText(tree);
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'adminLinks') adminPaths = node.initializer.elements.map(item => item.properties.find(property => property.name.getText(tree) === 'to').initializer.text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  // Group triggers replace top-level links; their children retain the same destinations.
  for (const filename of ['AdminPackageNavigation', 'AdminRevenueNavigation']) {
    const submenu = ts.createSourceFile('submenu.tsx', readFileSync(new URL(`${prefix}components/admin/${filename}.tsx`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const collect = node => {
      if (ts.isVariableDeclaration(node) && /_LINKS$/.test(node.name.getText(submenu))) {
        adminPaths.push(...node.initializer.elements.map(item => item.properties.find(property => property.name.getText(submenu) === 'to').initializer.text));
      }
      ts.forEachChild(node, collect);
    };
    collect(submenu);
  }
  adminPaths = [...new Set(adminPaths)];

  test(`${prefix}admin highlights exactly one menu entry for each dashboard section and direct route`, () => {
    const sections = ['OVERVIEW', 'STORES', 'PLANS', 'RENTALS', 'DEVICES', 'RBAC', 'ANALYTICS', 'NOTIFICATIONS'];
    const cases = sections.map(section => ['/admin/dashboard', `?section=${section}&from=review`, section === 'OVERVIEW' ? '/admin/dashboard' : `/admin/dashboard?section=${section}`]);
    cases.push(['/admin/dashboard', '', '/admin/dashboard'], ['/admin/payouts', '', '/admin/payouts'], ['/admin/profile', '', '/admin/profile']);
    assert.ok(!adminPaths.some(path => /section=(CATALOG|TELEMETRY)/.test(path)));
    for (const [pathname, search, expected] of cases) {
      const active = vm.runInNewContext(compile(`(${activeCallback})`), { isAdmin: true, location: { pathname, search }, URLSearchParams });
      assert.deepEqual(adminPaths.filter(path => active(path)), [expected]);
    }
  });

  test(`${prefix}store and customer menu highlighting keeps its existing behavior`, () => {
    for (const [pathname, search, target] of [['/store/dashboard', '?order=ABC', '/store/dashboard'], ['/customer/home', '', '/customer/home'], ['/customer/profile', '?tab=SECURITY', '/customer/profile?tab=SECURITY']]) {
      const active = vm.runInNewContext(compile(`(${activeCallback})`), { isAdmin: false, location: { pathname, search }, URLSearchParams });
      assert.equal(active(target), true);
    }
  });

  const presentation = {};
  vm.runInNewContext(compile(readFileSync(new URL(`${prefix}pages/admin/admin-presentation.ts`, import.meta.url), 'utf8')), { exports: presentation });
  const dashboardSource = readFileSync(new URL(`${prefix}pages/admin/AdminDashboard.tsx`, import.meta.url), 'utf8');

  test(`${prefix}every admin section renders its actual controls without issuing requests during server render`, () => {
    for (const [section, copy] of Object.entries(presentation.ADMIN_SECTIONS)) {
      let requests = 0;
      const module = { exports: {} };
      const actualRequire = name => {
        if (name.endsWith('.css')) return {};
        if (name === '../../context/AuthContext') return { useAuth: () => ({ user: { id: 'admin-1', role: 'SUPER_ADMIN' } }) };
        if (name === '../../hooks/useDashboardRefresh') return { useDashboardRefresh() {} };
        if (name === '../../services/dashboard-metrics') return dashboardMetrics;
        if (name === '../../services/admin-store-subscriptions') return adminSubscriptions;
        if (name === './admin-presentation') return presentation;
        if (name === './AdminLiveData') return { AdminLiveAnalytics: () => React.createElement('div', null, 'Báo cáo & doanh thu'), AdminLiveDevices: () => React.createElement('div', null, 'Thiết bị từ API') };
        if (name === 'react-router-dom') return { useSearchParams: () => [new URLSearchParams({ section }), () => {}] };
        if (name === 'react-dom') return { createPortal: () => null };
        if (name === '../../hooks/useBodyScrollLock') return { useBodyScrollLock() {} };
        if (name === '../../services/api') return { apiSessionMarker: () => 'test-session', api: new Proxy({}, { get: () => () => { requests++; throw new Error('Unexpected request during render'); } }) };
        if (name === '../../services/rentals.service') return { rentalsService: {} };
        if (name === '../../context/ToastContext') return { toast: {} };
        if (name === '../../data/storeProductsData') return { STORE_CATALOG_PRODUCTS: [] };
        if (name === '../../components/AnalyticsChart') return { AnalyticsChart: () => React.createElement('div', null, 'Chart module') };
        return require(name);
      };
      vm.runInNewContext(compile(dashboardSource), { exports: module.exports, module, require: actualRequire, document: { body: {} } });
      const html = renderToString(React.createElement(module.exports.AdminDashboard));
      assert.ok(html.includes(copy.title.replaceAll('&', '&amp;')), `Visible heading: ${section}`);
      assert.ok(html.includes('admin-content'));
      assert.equal(requests, 0);
      if (section === 'RBAC') {
        assert.match(html, /value="SUPER_ADMIN"[^>]*>Quản trị viên/);
        assert.match(html, /value="STORE_OWNER"[^>]*>Chủ cửa hàng/);
      }
      if (section === 'NOTIFICATIONS') {
        assert.match(html, /<details class="admin-advanced"><summary>Cấu hình kết nối nâng cao<\/summary>/);
        assert.ok(!html.includes('<details open'));
        assert.ok(html.includes('Khi có đơn hàng mới'));
      }
      if (['RBAC', 'OVERVIEW'].includes(section)) assert.ok(html.includes('minh họa'));
    }
  });

  test(`${prefix}unrecognized event codes retain their original meaning`, () => {
    assert.equal(presentation.adminActionLabel('NEW_EVENT'), 'NEW_EVENT');
    assert.equal(presentation.adminEntityLabel('NewEntity'), 'NewEntity');
    assert.equal(presentation.adminTriggerLabel('NEW_TRIGGER'), 'NEW_TRIGGER');
  });
}
