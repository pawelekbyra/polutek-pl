# PAYMENTS-PATRON-SAFETY-SPEC: Financial and Access Integrity

Status: ACTIVE
Launch status: **NO_GO**

## 1. Fulfillment Eligibility

A payment event alone does NOT grant access. It must pass the **PatronEligibilityPolicy**:
- **Status**: Payment must be successful.
- **Amount**: Must meet the threshold for the currency.
- **Linked Grant**: One payment = One linked grant. No duplicates.

## 2. PatronGrant Lifecycle

- **Creation**: Successful eligible payment creates a `PatronGrant` (linked by `paymentId`).
- **Refund**: A full refund MUST revoke the linked grant (Reason: `REFUNDED`).
- **Dispute**:
  - `dispute.opened` -> SUSPEND grant.
  - `dispute.won` -> REACTIVATE grant.
  - `dispute.lost` -> REVOKE grant.

## 3. Audit and Idempotency

- Every grant mutation (creation, suspension, revocation) MUST be audited with `actor`, `reason`, and `timestamp`.
- Webhooks MUST be idempotent using a lock service with ownership/fencing (see `EMAIL-COMMS-SPEC`).
