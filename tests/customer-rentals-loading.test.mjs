import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : [node.props?.children].flat(Infinity).map(text).join('');
const nodes = node => node && typeof node === 'object' ? [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)] : [];

function screen(prefix, packages, rentals) {
  let cursor = 0, tree;
  const slots = [], effects = [];
  const react = {
    useState(value) { const i = cursor++; slots[i] ||= { value: typeof value === 'function' ? value() : value }; return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }]; },
    useRef(value) { return slots[cursor++] ||= { current: value }; },
    useMemo(fn) { return fn(); }, useCallback(fn) { return fn; },
    useEffect(fn) { const i = cursor++; if (!slots[i]) { slots[i] = {}; effects.push(fn); } },
  };
  const jsx = (type, props) => ({ type, props });
  const exports = {};
  const source = readFileSync(new URL(prefix + 'pages/customer/CustomerRentalsPage.tsx', import.meta.url), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, console,
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react-router-dom') return { useNavigate: () => () => {} };
      if (name === 'framer-motion') return { motion: new Proxy({}, { get: (_, key) => 'motion.' + String(key) }), AnimatePresence: 'presence' };
      if (name === 'lucide-react') return new Proxy({}, { get: (_, key) => 'icon.' + String(key) });
      if (name === 'canvas-confetti') return () => {};
      if (name.endsWith('/AuthContext')) return { useAuth: () => ({ user: { id: '1', role: 'CUSTOMER' } }) };
      if (name.endsWith('/ToastContext')) return { toast: { error() {} } };
      if (name.endsWith('/rentals.service')) return { rentalsService: { listPackages: () => packages.promise, getMyRentals: () => rentals.promise } };
      if (name.endsWith('/rental-notifications')) return { subscribeRentalChannelEvents: () => () => {} };
      throw Error(name);
    },
  });
  return {
    render() { cursor = 0; tree = exports.CustomerRentalsPage(); return text(tree); },
    start() { effects.splice(0).forEach(fn => fn()); },
    async settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); return this.render(); },
    tab(label) { nodes(tree).find(n => n.type === 'button' && text(n).includes(label)).props.onClick(); },
  };
}

for (const prefix of ['../src/', '../frontend/src/']) {
  test(`${prefix}loading never flashes empty state and packages do not wait for contracts`, async () => {
    const packages = deferred(), rentals = deferred(), app = screen(prefix, packages, rentals);
    assert.match(app.render(), /Đang tải các gói thuê/);
    assert.doesNotMatch(app.render(), /Chưa có gói/);
    app.start();
    packages.resolve([{ packageId: '1', packageName: 'Gói gia đình', monthlyPrice: 30000, depositFee: 100000, buttonQuantity: 1, features: [] }]);
    assert.match(await app.settle(), /Gói gia đình/);
    app.tab('Hợp Đồng');
    assert.match(app.render(), /Đang tải danh sách hợp đồng/);
    rentals.reject({ response: { status: 500 } });
    assert.match(await app.settle(), /HTTP 500/);
    assert.doesNotMatch(app.render(), /Bạn chưa có hợp đồng/);
  });
  test(`${prefix}empty packages and failed package requests are distinct`, async () => {
    for (const fail of [false, true]) {
      const packages = deferred(), rentals = deferred(), app = screen(prefix, packages, rentals);
      app.render(); app.start(); rentals.resolve([]);
      if (fail) packages.reject(Error('offline')); else packages.resolve([]);
      const result = await app.settle();
      assert.match(result, fail ? /Chưa tải được các gói/ : /Chưa có gói thuê/);
      if (fail) assert.doesNotMatch(result, /Chưa có gói thuê/);
    }
  });
}
