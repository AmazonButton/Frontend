# Store-owner banking flow review

Date: 2026-11-13

## Scope

Frontend fixes only, in both `src` and `frontend/src`. No backend code, configuration or production records changed. No mock data was added to application UI or API responses. Synthetic fixtures are isolated to the existing frontend test suite.

## Current backend contract

- Lookup: `POST /stores/bank-accounts/lookup`, bank BIN plus account number.
- Verification: `POST /stores/bank-accounts/verification`, store ID, bank BIN, account number and optional account name.
- Both account-number DTOs require 6–19 digits; leading zeros are significant.
- Only `ACCOUNT_NAME_UNRESOLVED` permits the manual-name path. The backend performs lookup again at creation and accepts the entered name only for that specific failure. Other provider/authentication/account errors must remain blocking.
- Submitting an entered name is not proof of ownership. Actual backend verification, payment and refund states remain separate.
- Default account requires `OWNERSHIP_VERIFIED`. Cancellation, deletion, session recovery and expired-transfer guards remain in place.

## Frontend corrections

- Align input attributes, automatic lookup and payload validation with numeric backend DTOs.
- Keep transfer-capable banks selectable even when name lookup is not supported.
- Keep user-entered names visibly identified as entered data; changing the name clears consent.
- If lookup becomes unresolved during creation, return to name entry and explicit confirmation; do not repeat the creation request automatically.
- Keep lookup errors visible alongside the supported manual-name form; other lookup failures remain blocking.

The repository already contained a manual-name form for `ACCOUNT_NAME_UNRESOLVED`. The supplied screenshot does not show that form, so the screenshot alone cannot prove which frontend version or API error envelope was running. This review uses the current workspace backend contract, not an authenticated production browser session.

## Backend issues to review — documentation only

1. Store verification also compares sender bank identity directly: `backend/src/bank-verification/bank-verification.repository.ts`, `executeAtomicWebhookVerificationTx`, sender-bank check. A provider CITAD code such as TPBank `01358001` is not equal as a string to registered BIN `970423`. This can reject an otherwise matching transfer. No store production receipt was inspected during this review; this is a code-level risk supported by the earlier customer-flow diagnosis. Frontend cannot safely correct a server webhook identity decision.
2. Legacy stored account-name placeholders are returned by the backend. The frontend must not replace them with an invented bank-verified name.
3. Backend owns verification amount and receipt details. UI changes do not fix provider configuration, restore a historical failed verification, or confirm a refund.

Backend changes require separate explicit user authorization.

## 2026-11-14: Paid transfer remains pending in the application

Read-only database and authenticated provider GET checks for the reported store verification confirmed:

- PayOS returned HTTP 200, business code `00`, payment status `PAID`, amount paid 2,000 VND, remaining amount zero and one real transaction.
- Provider transaction time was 2026-11-14 00:05:34 Asia/Saigon, within the session deadline of 00:33:06.
- The application's verification row remained `PENDING`; received amount, failure reason and refund status were null. The account remained `PENDING`.
- Reading receipts raised Prisma `P2021`: table `public.store_bank_inbound_receipts` does not exist in the configured database.

The current repository's `executeAtomicWebhookVerificationTx` queries that table before processing the transfer. With this database schema, that processing path cannot complete. The existing migration `backend/prisma/migrations/20261111000000_financial_verification_and_outbox_hardening/migration.sql` contains the table definition. This finding establishes a code/schema mismatch; migration history and deployed instance logs were not inspected, so the reason that the table is missing is not established.

The current backend detail endpoint attempts a PayOS GET for pending sessions. If processing fails, `getVerificationTransactionById` catches the error and returns the still-pending stored transaction. This explains how polling can keep returning pending rather than surfacing the synchronization failure. Browser network traffic and deployed logs were not inspected, so this is a code-supported failure path, not a claim that a specific webhook execution was observed.

The provider also returned TPBank source code `01358001`. The separate CITAD/BIN comparison issue above may still block verification after the schema problem is resolved.

Required backend-owner follow-up, not executed: verify the deployed database target and migration state, restore the required schema through the approved migration process, inspect webhook/polling logs, address canonical bank-code comparison, then reconcile the already-paid receipt with duplicate and refund safeguards. Do not ask the user to pay again as a workaround.

Only provider GET and database reads were performed. No migrations, webhook replay, backend code changes, verification overrides or payouts were executed. This diagnosis does not confirm that any refund has completed.

## Verification

- `node --experimental-strip-types --test tests/store-finance-flow.test.mjs tests/banking-integration.test.mjs`: 96 tests passed.
- `npm.cmd run build`: passed.

These tests use isolated fixtures; they do not initiate real payments or mutate production data. No live end-to-end transfer was performed.
