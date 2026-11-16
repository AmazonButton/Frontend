# Product creation console report — 2026-11-14

User report contains three distinct failures:

- `POST /api/v1/products`: HTTP 403. The response body is collapsed as `Object`, so its exact error message/code is unavailable.
- React hook order changed in `StoreProductsPage`, with a previous `useState` slot becoming `useRef`, followed by `Should have a queue` in `useStoreListingAccess`.
- `GET /api/v1/auth/me`: HTTP 500, without a response body or server log.

## Frontend correction

The listing hook recently gained refs. Its reset directive is now supplemented with `// @refresh reset` on both consuming store pages: `StoreProductsPage.tsx` and `StoreDashboard.tsx`, synchronized between the root application and `frontend/`.

The page boundaries discard old hook queues during development updates even if nested hook refresh metadata is unavailable. Tests verify the actual transformed signatures, edit/rollback remounts, and unchanged emitted application logic. An already failed browser session may need one page reload to discard its previous runtime state.

## API findings — no backend edits

The local backend create-product path calls `validateStoreCanListProducts` for non-admin store owners. That method requires a current active subscription and enforces its product quota. It does not contain the grandfathered-store exemption currently present in the frontend entitlement policy. This mismatch can allow the frontend to present exemption/unlimited rights while a create request is rejected by the backend. A role guard can also return 403, so the actual request's response message/code is required to identify which condition rejected it.

The `/auth/me` 500 cannot be diagnosed from the supplied console status alone. It requires its response and the corresponding server exception log. No backend code, roles, subscription rules, or data were changed to bypass either failure.

## Validation

```powershell
node --experimental-strip-types --test frontend/tests/hooks-fast-refresh.test.mjs frontend/tests/store-listing-access.test.mjs frontend/tests/store-subscription-policy.test.mjs
```

30 passed, 0 failed. Root and `frontend/` production builds both passed with `npm.cmd run build`. Changed source copies match. Backend diff SHA-256 remains `dc53a6c120487a147d8505daa36ac7e161875733810c59f04bc69199573281c7`.

No live product creation, payment, migration, or deployment was performed. Runtime recovery in the user's existing browser and the precise API rejection/500 causes remain unverified.
