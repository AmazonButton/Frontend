# Multi-store checkout — frontend only

Updated: 2026-11-14.

## Scope

The customer can select products from multiple stores in one cart. The cart groups products by store, supports selection by product/store/all, and shows each store's subtotal before checkout.

The implementation calls the existing `POST /storefront/orders` separately for each store. Every request contains only that store's products and its own idempotency key. The existing single-store checkout, including immediate PayOS redirect, remains in place.

Multi-store checkout requires an authenticated customer. COD remains separate per order. PayOS orders are created separately and paid from the existing customer order history. The result dialog links to each order and lists any stores that failed.

Successful products are removed from the cart; unconfirmed products remain. Retries reuse the pending request key for the same account and payload, including after a page reload in the same browser tab. Only request keys and payload digests are stored, without recipient details. This relies on the backend's existing idempotency retention. It is not an all-store database transaction: one store may succeed while another fails.

## Notifications and backend boundary

The existing backend emits `ORDER_CREATED` to the order's store room. The existing web notification handler checks the current store and stores notifications under the user's account/role key. The frontend also uses its existing order-list reconciliation when socket events are missed.

Tests exercise the actual notification handler with orders from the same customer at two stores and verify that each owner accepts only their store's order. These are local behavioral tests; live delivery across production accounts was not exercised.

Backend changes initially attempted during this task were reversed after the user's explicit instruction. No new backend route, schema change, migration, persisted notification behavior, or mobile push behavior is included. Existing backend working-tree changes belonging to the user were retained. Backend diff SHA-256 stayed `dc53a6c120487a147d8505daa36ac7e161875733810c59f04bc69199573281c7` throughout subsequent frontend work after the reversal.

## Files

Source and relevant tests are synchronized between the root application and `frontend/`:

- `src/pages/customer/ShopPage.tsx`
- `src/services/marketplace-checkout.ts`
- `src/components/orders/MarketplaceReceipt.tsx`
- `tests/marketplace-checkout.test.mjs`
- `tests/payos-checkout.test.mjs`
- `tests/store-cancellation-notifications.test.mjs`

## Verified commands

- Root: `npm.cmd run build` — passed.
- `frontend/`: `npm.cmd run build` — passed.
- Root: the following test command — 46 passed, 0 failed.
- `frontend/`: the same test command — 65 passed, 0 failed.

```powershell
node --experimental-strip-types --test tests/marketplace-checkout.test.mjs tests/payos-checkout.test.mjs tests/store-cancellation-notifications.test.mjs tests/order-list-refresh.test.mjs tests/payment-method-sync.test.mjs tests/socket-token-order-refresh.test.mjs tests/web-push-flow.test.mjs
```

No deployment, database migration, or production order/payment creation was performed. Production verification with a customer and two authorized store-owner accounts remains a deployment validation step.
