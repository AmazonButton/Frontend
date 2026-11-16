# Banking API integration — 15 November 2026

Frontend integration for CUSTOMER and STORE_OWNER was checked against deployed backend commit `076592dac20b25e989123a2f6b4f581dbeb82f9b`, reported by `https://backend-fae8.onrender.com/readyz`. The deployed OpenAPI document was read from `/docs-json` and the corresponding GitHub source was inspected at that exact commit. No backend files, configuration, database records, webhook settings or payouts were changed by this task.

The review covered customer and store controllers, DTOs, account services/repositories, verification and refund status mapping, name lookup, bank identifier normalization, payment provider responses and store checkout return URL validation. This verifies the integration contract; it does not establish that an individual production payment has settled.

All paths below are relative to `/api/v1`.

| Role | Operation | Method and path |
| --- | --- | --- |
| Both | Bank catalogue | `GET /banks` |
| Customer | List / add accounts | `GET /customers/me/bank-accounts`, `POST /customers/me/bank-accounts` |
| Customer | Default / delete account | `PATCH /customers/me/bank-accounts/{id}/default`, `DELETE /customers/me/bank-accounts/{id}` |
| Customer | Start verification | `POST /customers/me/bank-accounts/{id}/initiate-verification` |
| Customer | Verification and refund status | `GET /customers/me/bank-accounts/{id}/verification-status` |
| Customer | History | `GET /customers/me/bank-accounts/verification-history` |
| Store owner | Name lookup / create verification | `POST /stores/bank-accounts/lookup`, `POST /stores/bank-accounts/verification` |
| Store owner | List accounts | `GET /stores/{storeId}/bank-accounts` |
| Store owner | Default / delete account | `PATCH /stores/{storeId}/bank-accounts/{id}/default`, `DELETE /stores/{storeId}/bank-accounts/{id}` |
| Store owner | History / verification details | `GET /stores/{storeId}/bank-account-verifications`, `GET /bank-account-verifications/{id}` |
| Store owner | Cancel existing verification | `POST /stores/bank-accounts/verification/{id}/cancel` |

Sixteen method/path pairs matched the live OpenAPI document. The public bank catalogue returned HTTP 200 with 22 transfer-capable banks and server support flags. Customer account numbers remain strings of 6–20 digits; store lookup/verification uses strings of 6–19 digits, preserving leading zeros. Manual store account-name entry remains available only after `ACCOUNT_NAME_UNRESOLVED`; other lookup errors stay blocking. The frontend does not call the customer `/verify` endpoint to fabricate provider evidence.

Frontend corrections were applied identically in `src/` and `frontend/src/`:

- Customer sessions now consume `qrCode` from the current authenticated status/initiation response. The page encodes that supplied payload directly as SVG, without reconstructing payment details. QR and checkout links disappear when the session is paid, expired or otherwise no longer payable. History data cannot provide a stale payment QR for another session.
- Customer refresh reads the account list before applying the latest verification response, preventing an older list response from replacing a newly verified account. Notifications use the backend message and no longer claim a fixed refund amount or an unfinished refund after it has completed.
- Store payment instructions and copy controls use the backend `transferDescription`, keeping `referenceCode` as the session identifier. The description survives storage and recovery from GET. Older responses without the new field retain their existing reference fallback.
- Store verification sends the current frontend origin with the backend-supported return and cancel paths at `/store/wallet?bank_verification=return|cancel`. That route forwards bank callbacks to `/store/finance#store-bank-accounts`; ordinary wallet navigation keeps its existing analytics destination. PayOS URL parameters never mark an account as verified.
- Verification, received payments and refunds remain separate backend-authoritative states. Source-bank and masked-account failures have understandable messages. Existing ownership guards, confirmation steps, polling/backoff and explicit payment creation are retained.

Validation:

```powershell
node --test tests/banking-current-contract.test.mjs tests/banking-integration.test.mjs tests/store-finance-flow.test.mjs tests/wallet-live-data.test.mjs tests/store-navigation.test.mjs
npm.cmd run build
npm.cmd --prefix frontend run build
```

The five test files passed 178 tests. Production builds passed in the repository root and `frontend/`. Changed source files passed `git diff --check`, and both frontend copies matched. The build in `frontend/` was executed from that directory with `npm.cmd run build`.

Tests use isolated transport and UI fixtures. No new transfer, verification POST, deletion, webhook replay or refund was submitted to the live backend. Authenticated account/payment outcomes still require checking the logged-in application; successful checkout alone is not proof of bank ownership or completed refund.

Backend sources: [customer verification DTO](https://github.com/AmazonButton/Backend/blob/076592dac20b25e989123a2f6b4f581dbeb82f9b/src/customers/dto/customer-bank-verification-response.dto.ts), [store verification service](https://github.com/AmazonButton/Backend/blob/076592dac20b25e989123a2f6b4f581dbeb82f9b/src/bank-verification/bank-verification.service.ts), [store return URL policy](https://github.com/AmazonButton/Backend/blob/076592dac20b25e989123a2f6b4f581dbeb82f9b/src/bank-verification/store-bank-return-url.ts).
