import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const refreshPlugin = require('react-refresh/babel');
const refreshRuntime = require('react-refresh/runtime');
const ts = require('typescript');

function getSignature(source, filename, functionName) {
  const { ast } = transformSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    plugins: [refreshPlugin],
    parserOpts: { plugins: ['typescript', 'jsx'] },
    ast: true,
    code: false,
  });
  let signature;
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && node.arguments[0]?.name === functionName && node.arguments[1]?.type === 'StringLiteral') {
      signature = { key: node.arguments[1].value, forceReset: node.arguments[2]?.value === true };
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(ast);
  assert.ok(signature, `Fast Refresh signature is emitted for ${functionName}`);
  return signature;
}

const sources = [
  ['../src/hooks/useOrderSync.ts', 'useOrderSync'],
  ['../src/components/common/NotificationBellPopover.tsx', 'NotificationBellPopover'],
];

for (const [file, functionName] of sources) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  test(`${functionName}: the actual React transform forces a safe remount`, () => {
    assert.equal(getSignature(source, file, functionName).forceReset, true);
  });

  test(`${functionName}: emitted application logic stays identical`, () => {
    const compile = (text) => ts.transpileModule(text, {
      fileName: file,
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, removeComments: true },
    }).outputText;
    const withoutRefreshDirective = source.replace(/^\/\/ @refresh reset\r?\n/m, '');
    assert.equal(compile(source), compile(withoutRefreshDirective));
  });
}

test('Editing and rolling back useRef/useEffect layouts remounts instead of preserving old hook queues', () => {
  const file = '../src/hooks/useOrderSync.ts';
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const withRef = source.replace("import { useEffect }", "import { useEffect, useRef }")
    .replace('  const { user, token } = useAuth();', '  const { user, token } = useAuth();\n  useRef(null);');
  const signatures = [getSignature(source, file, 'useOrderSync'), getSignature(withRef, file, 'useOrderSync'), getSignature(source, file, 'useOrderSync')];
  assert.notEqual(signatures[0].key, signatures[1].key);

  let current = function NotificationBellPopover() {};
  refreshRuntime.setSignature(current, signatures[0].key, signatures[0].forceReset);
  refreshRuntime.register(current, 'hook-edit-rollback-regression');
  for (const signature of signatures.slice(1)) {
    const next = function NotificationBellPopover() {};
    refreshRuntime.setSignature(next, signature.key, signature.forceReset);
    refreshRuntime.register(next, 'hook-edit-rollback-regression');
    const update = refreshRuntime.performReactRefresh();
    assert.equal(update.staleFamilies.size, 1);
    assert.equal(update.updatedFamilies.size, 0);
    current = next;
  }
});

test('A reset custom hook also resets its consuming component even if the parent hook signature is unchanged', () => {
  const previousHook = function useOrderSync() {};
  const nextHook = function useOrderSync() {};
  refreshRuntime.setSignature(previousHook, 'hook-key', true);
  refreshRuntime.setSignature(nextHook, 'hook-key', true);
  const previous = function NotificationBellPopover() {};
  const next = function NotificationBellPopover() {};
  refreshRuntime.setSignature(previous, 'same-parent-key', false, () => [previousHook]);
  refreshRuntime.setSignature(next, 'same-parent-key', false, () => [nextHook]);
  refreshRuntime.register(previous, 'nested-hook-reset-regression');
  refreshRuntime.register(next, 'nested-hook-reset-regression');
  const update = refreshRuntime.performReactRefresh();
  assert.equal(update.staleFamilies.size, 1);
  assert.equal(update.updatedFamilies.size, 0);
});
