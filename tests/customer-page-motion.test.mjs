import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/components/common/CustomerPageMotion.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function harness({ pathname = '/customer/home', search = '', reduced = false, supportsAnimation = true } = {}) {
  let location = { pathname, search };
  let previousDependencies;
  let cleanup;
  let scheduled;
  let cancellations = 0;
  const animations = [];
  const surface = supportsAnimation ? {
    animate: (frames, options) => {
      animations.push({ frames, options });
      return { cancel: () => cancellations++ };
    },
  } : {};
  const ref = { current: {
    querySelectorAll: (selector) => {
      assert.equal(selector, '[data-page-motion]');
      return [surface];
    },
    animate: () => { throw new Error('The ancestor of fixed dialogs must never animate'); },
  } };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, URLSearchParams,
    require: (name) => {
      if (name === 'react-router-dom') return { useLocation: () => location };
      if (name === 'framer-motion') return { MotionConfig: 'motion-config', useReducedMotion: () => reduced };
      if (name === 'react') return {
        ...require('react'),
        useRef: () => ref,
        useEffect: (callback, dependencies) => {
          if (!previousDependencies || dependencies.some((value, index) => value !== previousDependencies[index])) {
            previousDependencies = dependencies;
            scheduled = callback;
          }
        },
      };
      return require(name);
    },
  });
  const child = { type: 'existing-page-state' };
  return {
    animations, child,
    get cancellations() { return cancellations; },
    render(next = location) {
      location = next;
      const tree = exports.CustomerPageMotion({ children: child });
      if (scheduled) {
        cleanup?.();
        const effect = scheduled;
        scheduled = undefined;
        cleanup = effect();
      }
      return tree;
    },
    unmount() { cleanup?.(); },
  };
}

test('all seven customer screens receive a short page entrance', () => {
  const screens = [
    ['/shop', ''], ['/customer/home', ''], ['/customer/rentals', ''],
    ['/customer/orders', ''], ['/customer/verification', ''],
    ['/customer/profile', '?tab=INFO'], ['/customer/profile', '?tab=SECURITY'],
  ];
  for (const [pathname, search] of screens) {
    const app = harness({ pathname, search });
    app.render();
    assert.equal(app.animations.length, 1, pathname + search);
    assert.equal(app.animations[0].options.duration, 220);
  }
});

test('realtime rerenders and product search do not replay the page animation', () => {
  const app = harness({ pathname: '/shop' });
  const first = app.render();
  app.render();
  const updated = app.render({ pathname: '/shop', search: '?search=water' });
  assert.equal(app.animations.length, 1);
  assert.equal(first.key, null, 'the page wrapper must not be keyed by route/data');
  assert.equal(first.props.children.props.children, app.child);
  assert.equal(updated.props.children.props.children, app.child, 'preserve the mounted page and its state');
});

test('changing the page or profile tab replays the animation and cancels the previous one', () => {
  const app = harness();
  app.render();
  app.render({ pathname: '/customer/profile', search: '?tab=INFO' });
  app.render({ pathname: '/customer/profile', search: '?tab=SECURITY' });
  assert.equal(app.animations.length, 3);
  assert.equal(app.cancellations, 2);
  app.unmount();
  assert.equal(app.cancellations, 3);
});

test('reduced-motion preferences disable the page fade and apply to nested motion', () => {
  const app = harness({ reduced: true });
  const tree = app.render();
  assert.equal(app.animations.length, 0);
  assert.equal(tree.props.reducedMotion, 'user');
});

test('the page entrance never transforms the container of fixed dialogs', () => {
  const app = harness();
  const tree = app.render();
  for (const frame of app.animations[0].frames) assert.deepEqual(Object.keys(frame), ['opacity']);
  assert.equal(tree.props.children.props.style, undefined);
});

test('a browser without Web Animations still renders the original page normally', () => {
  const app = harness({ supportsAnimation: false });
  const tree = app.render();
  assert.equal(app.animations.length, 0);
  assert.equal(tree.props.children.props.children, app.child);
});
