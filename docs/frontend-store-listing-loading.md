# Store listing permission loading — 2026-11-14

Implemented in the root frontend and `frontend/`. Backend files were not changed.

## Findings and changes

- The listing hook's refresh callback depended on the entire user object. A replacement object for the same account/store restarted its effect and requests. The callback now depends on account/store scope and reads current user metadata from a ref.
- Initial loading, focus, polling, and manual retries could issue identical concurrent checks. Matching pending checks now share a promise; effect cleanup invalidates stale requests and releases the pending reference for React development effect replay.
- Automatic checks previously set `checking=true` on every poll/focus. They now preserve the resolved permission while reading updates in the background. The existing 30-second polling cadence, cooldown handling, and explicit checks before publishing/re-enabling products remain.
- The products banner could simultaneously show exemption/unlimited rights, a loading message, and a subscription-registration action. Pending and error states now show unconfirmed rights and the actual error. The existing exemption label returns after a successful check.
- Development Fast Refresh remounts this hook safely after hook layout edits.

## Validation

The regression suite reproduced duplicate checks on a same-account object replacement, overlapping focus/poll/manual reads, and a loading banner during background updates before the fix. All new cases pass after the fix.

```powershell
node --experimental-strip-types --test frontend/tests/store-listing-access.test.mjs frontend/tests/store-subscription-policy.test.mjs frontend/tests/store-finance-flow.test.mjs frontend/tests/hooks-fast-refresh.test.mjs tests/dashboard-refresh.test.mjs
```

Result: 60 passed, 0 failed. Includes real hook logic, rendered product-banner states, account/store changes, request failures/retries, effect replay, cooldown, subscription policy, finance regression checks, and dashboard refresh scheduling.

- `npm.cmd run build` at repository root: passed.
- `npm.cmd run build` in `frontend/`: passed.
- Changed source copies match between both frontend roots.
- Backend diff SHA-256 unchanged: `dc53a6c120487a147d8505daa36ac7e161875733810c59f04bc69199573281c7`.

Validation used local tests/builds. Existing backend 500 responses and cross-account product isolation remain separate issues; this fix does not resolve those backend conditions. No production requests, database writes, or deployment were performed.
