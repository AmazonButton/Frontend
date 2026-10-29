# Frontend scope and verification

## 2026-10-30 — Google popup handling and accurate authentication errors

- Supplied logs show the Google OAuth success callback reaching `/auth/google-login`, followed by an API 401. COOP warnings alone do not establish the cause of that server rejection. The frontend previously replaced every 401/Supabase-related error with an unsupported claim that the backend only allows passwords; it now preserves the API message.
- The Google token-based request contract is unchanged. Missing tokens are rejected locally; popup-closed/blocked and synchronous initialization failures now clear loading and show an actionable message. The Google script must finish loading before launching the popup. No frontend identity fallback, email-only authentication, or unverified successful login was added.
- Added `same-origin-allow-popups` to frontend Vite/Vercel headers, following Google's setup guidance: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid . Verified the running `http://localhost:5173/login` response supplies that exact header. `VITE_GOOGLE_CLIENT_ID` was verified present without printing its value. Backend files/configuration were not modified.
- Verification: `npm.cmd run build` in `frontend/` — PASS; `node --experimental-strip-types --test tests/google-login.test.mjs` — PASS (8/8). Tests execute the real Google callbacks with mocked Google/backend responses; no real login was performed.
- Remaining: Need the JSON Response of the user's failing Google-login request to determine why the deployed API returns 401. Local backend source accepts a Google access token, but that does not prove the deployed service has the same verification/configuration. Google Cloud authorized-origin settings and live account sign-in were not modified or verified. Vercel deployment remains pending.

## 2026-10-30 — Synchronize customer payment-method changes to the store

- Authenticated order reconciliation now tracks order status, payment method, and payment status. A PayOS-to-COD change emits `ORDER_PAYMENT_CHANGED` even when the order remains PENDING/CONFIRMED. Status-only snapshots from older sessions migrate without spurious notifications, and COD/CASH_ON_DELIVERY aliases are equivalent.
- After a successful existing payment-method POST, the frontend reads the authoritative order through the existing GET endpoint and publishes its actual state locally. API rejection never generates a fake COD update. A failed follow-up read does not turn a committed change into a false failure; the five-second authenticated reconciliation channel recovers it.
- The store dashboard accepts order IDs from either existing API alias and merges payment updates without losing recipient contact. COD remains unpaid/chờ thu tiền until the server confirms collection. No backend code, API payload contract, or database was modified.
- Verification: `node --experimental-strip-types --test tests/payment-method-sync.test.mjs tests/store-cancellation-notifications.test.mjs tests/order-list-refresh.test.mjs` — PASS (22/22); `npm.cmd run build` in `frontend/` — PASS; backend Git status — no changes. Tests exercise the actual payment service and dashboard update handler with mocked API responses. No real payment methods/orders were changed. Vercel deployment and live two-account verification remain pending.

## 2026-10-29 — Store-owner cancellation notification recovery

- Store notification listeners/history no longer require an optional top-level `user.storeId` to exist. The frontend resolves a known store ID from the existing nested/flat profile fields, subscribes when available, and filters mismatching known store IDs. Orders still come from the authenticated, server-authorized API/socket channels; backend permissions were not changed. The dashboard uses the same store-ID resolution for cancellation alerts.
- Historical rows no longer prematurely mark incoming events as processed. A live cancellation replaces a matching historical row with one unread notification. Socket status/cancel aliases and API recovery use the same deduplication key so the store gets a single notification/toast/chime.
- Authenticated order reconciliation runs every five seconds while visible and on focus recovery, with an account/store-scoped status-only session snapshot to recover missed cancellations across token refresh or reload. First-time history remains historical; unseen terminal orders do not produce misleading order-created success alerts. No full-page loading behavior was added.
- Files: `NotificationBellPopover.tsx`, `StoreDashboard.tsx`, `useOrderSync.ts`, `services/order-reconciliation.ts`, `tests/store-cancellation-notifications.test.mjs`; added `npm run test:notifications`.
- Verification: `node --experimental-strip-types --test tests/store-cancellation-notifications.test.mjs tests/hooks-fast-refresh.test.mjs tests/order-list-refresh.test.mjs` — PASS (21/21); `npm.cmd run build` in `frontend/` — PASS; `git status --short -- backend` — no changes. Notification tests execute the real listener/dedup callbacks against mocked socket/API events, including missing/nested store ID, cross-store filtering, cleanup, history races, and missed-event recovery. No real orders were cancelled. Vercel deployment and live two-account verification remain pending.

## 2026-10-29 — Keep order details visible during background updates

- `CustomerOrdersPage` previously replaced the whole list with a loading screen on every focus/socket/local-order refresh. Initial loading now has its own path; background/manual updates retain the list, expanded order, search, filter, and page. The refresh button shows progress without unmounting the list. Background errors keep existing orders visible with a non-blocking status message.
- Concurrent refresh triggers are serialized/coalesced, including a follow-up request for an event received while a request is pending. Stale responses are ignored after effect cleanup/account changes. Subscription dependencies use user identity fields instead of the complete user object to avoid unnecessary reloads on profile-object updates. Order-card clicks still only toggle details.
- Added a development-only React Refresh reset marker for this page's updated hook signature. No backend, payment-method payload, checkout redirect, or cancellation endpoint was changed.
- Verification: `node --experimental-strip-types --test tests/order-list-refresh.test.mjs` — PASS (7/7); `npm.cmd run build` in `frontend/` — PASS; `git status --short -- backend` — no changes. Tests cover initial/background loading, focus/socket bursts, error/malformed-response retention, stale responses, and opening/closing an order without requests/navigation. No real orders or payments were created; no Vercel deployment was performed.

## 2026-10-29 — Recipient contact in owner/manager order views

- Order normalization now prefers recipient name/phone/address saved on the order over account-holder/profile information; supports the existing flattened DTO and camel/snake-case shipping snapshots. Empty contact values stay empty rather than being replaced with a fictitious delivery address.
- Owner and manager share the existing store routes. Their dashboard displays full recipient names, callable phone numbers, and untruncated multi-line addresses. Missing values have explicit placeholders. Status/payment updates preserve previously loaded contact details when an event omits them.
- The analytics ledger uses the same normalization and shows all three contact fields through `ShippingContact`. Search includes phone/address and CSV recipient fields use the normalized values. New-order/cancellation alerts retain contact where supplied by the API. No auth permissions, backend files, or checkout/payment endpoints were changed.
- Verification: `npm.cmd run build` in `frontend/` — PASS; `node --experimental-strip-types --test tests/order-events.test.ts tests/payos-checkout.test.mjs` — PASS (14/14, including six recipient mapping/update regressions and the five existing PayOS flow checks). No real orders or payments were created. Vercel deployment and live customer/store verification remain pending.

## 2026-10-29 — Direct PayOS hosted checkout

- Storefront PayOS checkout now shows a short redirect progress indicator and navigates in the same tab to the `checkoutUrl` returned by the existing payment-link API. It no longer mounts the intermediate order receipt before redirecting. Both nested and flat payment-link response envelopes are supported.
- Pending-order recovery data is saved before requesting the payment link. If link creation fails after the order was created, show the pending order with the actual error and instructions to continue from order history rather than placing another order. COD receipt behavior and server-confirmed payment status remain unchanged.
- The existing PayOS link in `OrderSuccessModal` also navigates in the same tab. Backend source and payment APIs were not modified.
- Verification: `npm.cmd run build` in `frontend/` — PASS; `node --experimental-strip-types --test tests/payos-checkout.test.mjs` — PASS (5/5). These tests execute the actual checkout handler with mocked API/navigation/storage: nested/flat redirects, payment-link error recovery, unchanged COD, and invalid-recipient blocking. No real orders or payment links were created.
- Deployment to Vercel and a real hosted-payment flow have not been performed for this change.

## 2026-10-29 — Hook signature recovery during development

- The reported mismatch (`useRef` versus `useEffect` in `NotificationBellPopover`) happened during React Fast Refresh after a custom-hook edit/rollback. The current hook calls are unconditional.
- Added React Refresh's `@refresh reset` directive only to `useOrderSync.ts` and `NotificationBellPopover.tsx`. Development edits remount this refresh boundary and its hook consumers rather than preserving an obsolete hook queue. No hook order, effects, API calls, notification logic, order/payment/cancellation behavior, or backend code was changed by this fix.
- Added `npm run test:hooks`: six regression checks use the installed React Refresh Babel transform/runtime to verify forced remounts, hook-layout edit/rollback behavior, and propagation from custom hooks. TypeScript output with comments removed is identical with/without the directive for both files.
- Verification: `node --test tests/hooks-fast-refresh.test.mjs` — PASS (6/6); `npm.cmd run build` in `frontend/` — PASS. An already-displayed error boundary may require one initial browser reload; subsequent relevant code edits use the reset directive. This development safeguard does not replace the Rules of Hooks for future code changes.

## 2026-10-29 — Storefront contact and order notifications

- User scope: implement frontend only. Backend source may be read to understand API contracts; do not change backend code, database schema, configuration, or documentation. Earlier agent-authored backend changes were reverted, and the agent-created backend files were removed. `git diff --name-only -- backend` returned no changes after the rollback.
- Frontend: sends the existing `customerName`, `customerPhone`, and `deliveryAddress` fields to `/storefront/orders`. Adds form guidance, per-field errors, a checkout receipt, recipient details in customer order history/store alerts, event normalization, duplicate suppression, order navigation, and authenticated API reconciliation when socket updates are missed.
- Input checks are frontend checks only. They validate format/completeness and do not verify recipient identity, phone ownership/activity, or deliverability.
- Notifications use the existing API and socket events. The frontend does not add server-side FCM delivery or guarantee that the API persists cancellation reasons. Show the reason when the API provides it. Subsequent customer history/notifications require a customer login; guest checkout displays the returned receipt.
- Verification: `node --experimental-strip-types --test tests/shipping-contact-validation.test.ts tests/order-events.test.ts` — PASS (49 tests). No production orders, cancellations, or push messages were created by these tests.
- Production deployment and a real customer/store end-to-end check remain unverified.
