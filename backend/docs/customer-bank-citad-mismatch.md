# Customer bank verification: CITAD/BIN mismatch

Date: 2026-11-13

## Scope and authorization

Documentation only. The user explicitly prohibits backend code changes. The local fix, helper and associated regression test were withdrawn. No deployment, production verification update or refund was performed.

## Verified findings

Read-only inspection of a customer verification receipt confirmed:

- The received account hash exactly matched the registered account hash.
- The payment was 2,000 VND and arrived within the verification period.
- The registered TPBank BIN was `970423`; the recorded source bank code was `01358001`.
- The stored decision was `MISMATCH_BIN`, with verification status `FAILED_MISMATCH`.
- The repository compares the source bank code directly with the registered BIN, without converting between bank identifier systems.

TPBank CITAD `01358001` is documented in the [bank-published CITAD list](https://apac.bnpparibas/app/uploads/sites/11/2025/06/citad-code-updated-10.06.2025v1.pdf). The application bank catalogue identifies TPBank by BIN `970423`.

## Relevant existing code

- `src/customers/customer-bank-penny-verification.service.ts`: source bank extraction in `recordInboundPaymentEvidence`; bank comparison for duplicate receipts in `reconcileExistingInboundTransaction`.
- `src/customers/customers.repository.ts`: bank identity comparison in `recordInboundTransactionAndObligationAtomicTx`.
- `src/bank-verification/constants/vietnam-banks.constant.ts`: registered bank catalogue.

## Recommendations for the backend owner — not implemented

1. Normalize explicitly documented provider bank identifiers to a canonical bank identity before comparison; do not infer bank identity from numeric suffixes.
2. Preserve full account matching, amount, expiry, session lifecycle, authenticated evidence and duplicate-receipt checks.
3. Review refund destination bank identifiers as well as verification matching.
4. Test matching and nonmatching accounts, different banks, incomplete evidence, polling/webhook deduplication and legacy receipt replays.
5. Reconcile affected historical receipts against trusted evidence and current refund state. A code fix alone will not automatically correct persisted verification decisions.

No personal account numbers, customer names, credentials or production receipt identifiers are recorded here.
