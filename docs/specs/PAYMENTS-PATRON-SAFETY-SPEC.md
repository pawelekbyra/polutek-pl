# PAYMENTS-PATRON-SAFETY-SPEC: Financial and Access Integrity

Status: ACTIVE
Launch status: **NO_GO**

## 1. Fulfillment Eligibility

A payment event alone does NOT grant access. It must pass the **PatronEligibilityPolicy**:
- **Status**: Payment must be successful.
- **Amount**: Must meet the threshold for the currency at payment time.
- **Currency**: Supported currencies only.
- **Linked Grant**: One payment = One linked grant. No duplicates.
- **Manual Review**: Fraud or high-risk flags must block automatic grant.

## 2. PatronGrant Lifecycle

- **Creation**: Successful eligible payment creates a `PatronGrant` (linked by `paymentId`).
- **Refund**: A full refund MUST revoke the linked grant (Reason: `REFUNDED`).
- **Dispute**:
  - `dispute.opened` -> SUSPEND linked grant.
  - `dispute.won` -> REACTIVATE linked grant (if policy allows).
  - `dispute.lost` -> REVOKE linked grant.
- **Manual Mutation**: Requires actor, reason, and explicit audit.

## 3. Audit and Idempotency

- Every grant mutation (creation, suspension, revocation) MUST be audited with `actor`, `reason`, `before/after state`, and `timestamp`.
- Webhooks MUST be idempotent using a lock service with ownership/fencing (see `EMAIL-COMMS-SPEC`).
- Audit failure must roll back the mutation to prevent untracked state changes.

## 4. Multi-Source Grants
- A user can have multiple grants (Payment, Admin, Referral).
- Effective patron status is `true` if at least one grant is `ACTIVE`.
- Revoking one source (e.g. refund) does not revoke independent grants.
