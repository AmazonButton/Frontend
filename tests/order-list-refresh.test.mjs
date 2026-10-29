import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import { normalizeOrder } from '../src/services/order-events.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/pages/customer/CustomerOrdersPage.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('CustomerOrdersPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let loadCallback;
let expandCallback;
const visit = (node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'loadOrders') loadCallback = node.initializer.arguments[0].getText(ast);
  if (ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === 'button') {
    const attributes = node.attributes.properties;
    if (attributes.some((attr) => attr.name?.getText(ast) === 'aria-expanded')) {
      expandCallback = attributes.find((attr) => attr.name?.getText(ast) === 'onClick')?.initializer.expression.getText(ast);
    }
  }
  ts.forEachChild(node, visit);
};
visit(ast);
assert.ok(loadCallback && expandCallback, 'Exercise the actual page callbacks');
const evaluate = (callback, context) => vm.runInNewContext(ts.transpileModule(`const callback = ${callback}; callback;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, context);

function harness(get) {
  const state = { orders: [normalizeOrder({ id: '17', status: 'PENDING' })], expandedOrder: '17', query: 'test', filter: 'ACTIVE', currentPage: 2, loading: false, refreshing: false, error: null };
  const loadingChanges = [];
  const requests = { current: { generation: 0, flight: null, queued: false } };
  const context = {
    orderRequests: requests, api: { get }, normalizeOrder,
    setIsLoading: (value) => { state.loading = value; loadingChanges.push(value); },
    setIsRefreshing: (value) => { state.refreshing = value; },
    setOrders: (value) => { state.orders = value; },
    setError: (value) => { state.error = value; },
    setExpandedOrder: (value) => { state.expandedOrder = value; },
    setQuery: (value) => { state.query = value; },
    setFilter: (value) => { state.filter = value; },
    setCurrentPage: (value) => { state.currentPage = value; },
  };
  return { state, requests, loadingChanges, load: evaluate(loadCallback, context) };
}
const response = (status = 'PENDING') => ({ data: { data: [{ id: '17', status }] } });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('The first page load still shows its loading state', async () => {
  const app = harness(async () => response());
  await app.load(true);
  assert.deepEqual(app.loadingChanges, [true, false]);
  assert.equal(app.state.orders[0].id, '17');
});

test('A background refresh updates the order without replacing the list with a loading screen', async () => {
  const app = harness(async () => response('CONFIRMED'));
  await app.load();
  assert.ok(!app.loadingChanges.includes(true));
  assert.equal(app.state.orders[0].status, 'CONFIRMED');
  assert.equal(app.state.expandedOrder, '17');
  assert.equal(app.state.query, 'test');
  assert.equal(app.state.filter, 'ACTIVE');
  assert.equal(app.state.currentPage, 2);
});

test('A burst of focus/socket events is coalesced without overlapping requests or missing the latest change', async () => {
  const first = deferred();
  const latest = deferred();
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const app = harness(async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    const result = await (++calls === 1 ? first.promise : latest.promise);
    active--;
    return result;
  });
  const jobs = [app.load(), ...Array.from({ length: 8 }, () => app.load())];
  assert.equal(calls, 1);
  first.resolve(response());
  await new Promise((done) => setImmediate(done));
  assert.equal(calls, 2);
  latest.resolve(response('CANCELLED'));
  await Promise.all(jobs);
  assert.equal(maxActive, 1);
  assert.equal(app.state.orders[0].status, 'CANCELLED');
  assert.ok(!app.loadingChanges.includes(true));
});

test('A failed background request preserves the visible order and expanded details', async () => {
  const app = harness(async () => { throw new Error('Temporary API error'); });
  const original = app.state.orders;
  await app.load();
  assert.equal(app.state.orders, original);
  assert.equal(app.state.expandedOrder, '17');
  assert.ok(app.state.error);
  assert.equal(app.state.refreshing, false);
  assert.ok(!app.loadingChanges.includes(true));
});

test('Malformed responses cannot clear the visible list', async () => {
  const app = harness(async () => ({ data: { data: null } }));
  const original = app.state.orders;
  await app.load();
  assert.equal(app.state.orders, original);
  assert.ok(app.state.error);
});

test('An old request cannot update the page after unmount/account change', async () => {
  const pending = deferred();
  const app = harness(() => pending.promise);
  const original = app.state.orders;
  const job = app.load();
  app.requests.current.generation++;
  app.requests.current.flight = null;
  app.requests.current.queued = false;
  pending.resolve(response('CANCELLED'));
  await job;
  assert.equal(app.state.orders, original);
  assert.deepEqual(app.loadingChanges, []);
});

test('Clicking an order only toggles its details; it never calls the API or reloads the page', () => {
  for (const isExpanded of [false, true]) {
    let expanded;
    const fail = () => { throw new Error('Unexpected navigation or network request'); };
    const click = evaluate(expandCallback, {
      isExpanded, order: { id: '17' }, setExpandedOrder: (value) => { expanded = value; },
      loadOrders: fail, api: { get: fail }, window: { location: { reload: fail } },
    });
    click();
    assert.equal(expanded, isExpanded ? null : '17');
  }
});
