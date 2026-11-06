# Store-owner page loading — 2026-11-06

This update changes code-loading boundaries and image loading hints. It does not redesign another screen or change order/payment/device workflows.

## Measured production JavaScript

The numbers below sum gzip sizes of the app entry and each page's transitive static JavaScript dependencies. Both builds use the same local measurement process. They exclude CSS, images, fonts, API responses, and feature chunks requested after interaction. These are bundle measurements, not browser timings or measured Core Web Vitals.

| Page | Before, gzip KB | After, gzip KB | Result |
| --- | ---: | ---: | --- |
| Live orders | 304.5 | 195.4 | Chart code loads only in the existing chart branch; about 36% less initial JS. |
| Devices | 312.1 | 211.3 | Camera decoder loads only in the existing camera branch; about 32% less initial JS. |
| IoT rentals | 192.0 | 192.0 | Existing independent route chunk retained. |
| Device templates | 187.4 | 187.4 | Existing independent route chunk retained. |
| Products and inventory | 192.3 | 192.3 | Offscreen list thumbnails can load lazily and decode asynchronously; fixed intrinsic dimensions match the existing 44px container. |
| Revenue analytics | 299.5 | 299.5 | Chart code remains available immediately for the visible charts. |
| Wallet | 190.0 | 190.1 | Bank-list logos can load lazily and decode asynchronously; existing selected-bank images retain their loading behavior. |
| Password / profile | 193.7 | 193.7 | Existing independent route chunk retained. |
| Service plan and bank accounts | 190.0 | 183.7 | Separate entry no longer loads customer verification, driver shifts, or admin payouts. |

All nine initial page graphs exclude the camera decoder. Only the revenue analytics page includes chart code initially. Device QR rendering remains available independently of camera scanning. Existing pairing-modal mounting, listeners, state retention and effects were deliberately retained.

## Files for this performance update

The following application changes exist in both `src/` and `frontend/src/`:

- `App.tsx`: point the existing finance lazy import to its independent module; route definitions and guards are unchanged.
- `pages/store/StoreDashboard.tsx`: defer the collapsed chart through a local Suspense boundary; add native loading hints to inventory thumbnails.
- `pages/store/StoreDevicesPage.tsx`: defer the QR camera component within the existing camera condition. The scan callback and manual-code switch remain unchanged.
- `pages/store/StoreProductsPage.tsx`: add native loading/decoding hints and matching intrinsic dimensions to list thumbnails.
- `pages/store/StoreWalletPage.tsx`: add native loading/decoding hints to bank-list logos.
- `pages/store/StoreFinancePage.tsx` (new): move the existing finance component without changing its implementation.
- `pages/operations/OperationPrimitives.tsx` (new): move the existing shared card/button styles and status component without changing their implementation.
- `pages/operations/OperationsPages.tsx`: import the moved primitives and retain a compatibility re-export for finance; other screen implementations are unchanged.

Both `vite.config.ts` files separate camera decoding from QR rendering. The frontend configuration also uses the existing root configuration's framework, animation and chart chunks. No dependencies or versions changed.

`tests/store-page-loading.test.mjs` builds the actual root production bundle in memory and checks all nine initial graphs, dynamic feature availability, and finance isolation. It performs no API calls or browser interactions.

The dashboard CSS changes from the earlier UI task and the user's existing `src/pages/auth/AuthPage.tsx` edit remain in the working tree.

## Validation

- PASS — root `npm.cmd run build`, including TypeScript and Vite.
- PASS — `node --test tests/*.test.mjs`: 23/23 tests, including 11 new production-bundle checks.
- PASS — existing frontend suites for order transitions, payment synchronization, cancellation notifications, order-list refresh, socket refresh, order events, hook refresh, catalog synchronization and partial wallet loading: 57/57 tests.
- PASS — source AST comparison against pre-optimization snapshots: existing handlers, hooks, state transitions, conditions, routes, props and animation definitions are unchanged after removing only the new loading wrappers/image hints from the comparison. Moved finance/shared declarations match their original implementations.
- PASS — `git diff --check`; API/service, backend, context, hook and shared-layout files have no new edits.
- FAIL, pre-existing — `frontend/npm.cmd run build`: `frontend/src/App.tsx` imports missing `PageBackButton` and `CustomerPageMotion` modules. These unrelated imports/files were left unchanged.
- NOT TESTED — lint (no configured lint script); actual browser load times, slow-network/chunk-download failures, real camera permission/scanning, Bluetooth pairing, real-account navigation, production interactions and deployment.

The first use of a deferred chart or scanner requires an additional chunk download and displays a local loading placeholder. Existing data fetching, refresh/polling intervals, socket subscriptions, API payloads, authorization and financial calculations were not changed. Deployment and browser-based end-to-end verification remain pending; the bundle results do not guarantee a particular load time or the absence of every runtime regression.
