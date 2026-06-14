# Polutek.pl — Architecture Repair Plan

Status: PROPOSED_CANONICAL
Launch status: NO_GO until launch-critical requirements are certified
Document type: implementation repair contract

## 1. Purpose and Source-of-Truth Hierarchy

The purpose of this plan is to eliminate the drift between target architecture and current implementation, prevent historical problems from masquerading as current state, and ensure every architectural gap is ticketed and verified.

### Hierarchy of Truth

1. **Product-policy truth**: Owner decisions, active product standard, approved ADRs, core invariants.
2. **Current implementation truth**: Current main code, schema, tests, and CI configuration.
3. **Current execution truth**: Exactly one current ticket, ready queue, Masterplan, latest accepted reconciliation.
4. **Target architecture truth**: Blueprint, specs, ADRs, and this repair plan.
5. **Evidence truth**: Every claim must have a precise status and proof.

## 2. Mandatory Core Domain Invariants

The following invariants are non-negotiable:

- `Payment` = financial/support fact
- `PatronGrant` = access right and lifecycle state
- `Subscription` = mailing/follow/newsletter consent
- `User.isPatron` = denormalized cache/read model only
- `Clerk patron metadata` = UI cache and diagnostic information only
- `Frontend state` = rendering state only

### Rules of Access:
- Only the **Access module** makes the final backend patron access decision.
- An active, effective **PatronGrant** is the sole source of truth for patron access.
- Payment, Stripe state, Subscription, Clerk metadata, `User.isPatron`, frontend state, URL params, and client claims **cannot** independently grant access.
- Clerk provides authentication/identity, NOT canonical patron authorization.
- Patron status does NOT subscribe a user to marketing.
- Newsletter subscription does NOT grant patron access.
- Transactional email and optional marketing consent are separate.

## 3. Current-State Matrix

| Area | Current verified state | Remaining gap | Evidence | Ticket |
| --- | --- | --- | --- | --- |
| Patron access truth | `PatronGrant` exists | Some paths may still use `User.isPatron` | `REPOSITORY_EVIDENCE` | `ARCH-ACCESS-001` |
| `User.isPatron` drift | Denormalized on User | No reconciliation job | `REPOSITORY_EVIDENCE` | `ARCH-ACCESS-001` |
| Clerk metadata/sync | Basic sync exists | No durable retry/reconciliation | `REPOSITORY_EVIDENCE` | `ARCH-CLERK-001` |
| Payment vs Access | Decoupled | Explicit eligibility policy missing | `REPOSITORY_EVIDENCE` | `ARCH-PAYMENT-001` |
| PatronGrant lifecycle | ACTIVE/REVOKED | SUSPENDED status and dispute handling | `REPOSITORY_EVIDENCE` | `ARCH-PATRON-002` |
| Grant mutation audit | Partial | Incomplete audit for all transitions | `REPOSITORY_EVIDENCE` | `ARCH-PATRON-001` |
| Playback provider gating | Check before token | `READY` + `canPlay=false` possible | `REPOSITORY_EVIDENCE` | `ARCH-PLAYBACK-002` |
| PlaybackPlan semantics | Discriminated union | Non-strict mapping in some cases | `REPOSITORY_EVIDENCE` | `ARCH-PLAYBACK-001` |
| Comments authorization | Tier based | No explicit AccessDecision use | `REPOSITORY_EVIDENCE` | `ARCH-COMMENTS-001` |
| Admin authorization | `ADMIN_CLERK_USER_IDS` | Canonical resolver missing | `REPOSITORY_EVIDENCE` | `ARCH-ADMIN-AUTH-001` |
| Access Diagnostics | Basic view | Missing drift/eligibility details | `REPOSITORY_EVIDENCE` | `ARCH-ADMIN-001` |
| Architecture guard | Basic boundaries | Missing forbidden source rules | `REPOSITORY_EVIDENCE` | `ARCH-GUARD-001` |
| Legacy services | `lib/services/` exists | Many active callers | `REPOSITORY_EVIDENCE` | `ARCH-LEGACY-*` |
| AppContext boundary | Initial foundation | Context creation inconsistent | `REPOSITORY_EVIDENCE` | `ARCH-DI-001` |
| Email idempotency | PR #905 merged | No lock ownership/fencing | `REPOSITORY_EVIDENCE` | `EMAIL-WEBHOOK-POSTMERGE-VERIFY-001` |
| Email authenticity | Svix + Legacy | Legacy fallback in production | `REPOSITORY_EVIDENCE` | `EMAIL-WEBHOOK-ROUTE-SECURITY-001` |
| Logging/PII/retention | Redaction helpers | Raw errors in DB/logs | `REPOSITORY_EVIDENCE` | `ARCH-LOG-001` |
| Migration evidence | 20260614000000 | Upgrade path not proven | `REPOSITORY_EVIDENCE` | `EMAIL-WEBHOOK-MIGRATION-VERIFY-001` |
| Control-plane consistency | Mixed | Historical tickets marked historical | `REPOSITORY_EVIDENCE` | `ARCH-DOCS-001` |

## 4. Known Gap — Canonical Admin Authorization

**Ticket/Backlog ID**: `ARCH-ADMIN-AUTH-001`
**Risk ID**: `ADMIN-AUTHORITY-DRIFT`
**Status**: `CONFIRMED_GAP`

**Observed risk**:
- Admin authority resolution is fragmented across Clerk claims, DB roles, and environment variables (`ADMIN_CLERK_USER_IDS`).
- Potential for "Maintenance Required" UI loops or unauthorized access if resolvers disagree.

**Required target**:
- Single canonical administrator authorization resolver.
- Inventory of all admin-sensitive surfaces.
- Tests for: database admin, configured admin, stale Clerk claims, regular user, guest.

## 5. Repair Areas

### Area A: Single Patron Access Truth
- Only Access module issue `AccessDecision`.
- Decision must be based on effective active `PatronGrant`.
- **Tickets**: `ARCH-ACCESS-001`, `ARCH-GUARD-001`, `ARCH-TEST-001`.

### Area B: User.isPatron Cache and Drift
- `User.isPatron` is strictly a read-model.
- Implement drift reconciliation job and admin diagnostics.
- **Ticket**: `ARCH-ACCESS-001`.

### Area C: Clerk Synchronization and Drift
- Local access must work during Clerk outages.
- Durable retry for Clerk metadata sync failures.
- **Ticket**: `ARCH-CLERK-001`.

### Area D: PatronGrant Lifecycle
- Explicit states: ACTIVE, SUSPENDED, REVOKED.
- Dispute opened -> SUSPEND. Dispute won -> REACTIVATE. Dispute lost -> REVOKE.
- **Tickets**: `ARCH-PATRON-002`, `ARCH-PATRON-003`.

### Area E: Grant Mutation Audit Completeness
- Transactional audit for every grant transition.
- Actor, Reason, State Before/After, RequestID.
- **Ticket**: `ARCH-PATRON-001`.

### Area F: Payment Eligibility Boundary
- Payment fulfillment must call an explicit eligibility policy.
- Below threshold or unsupported currency must not grant patron status.
- **Ticket**: `ARCH-PAYMENT-001`.

### Area G: Central Access Module Boundary
- Routes are transport adapters; they cannot locally reconstruct policy.
- **Tickets**: `ARCH-ACCESS-001`, `ARCH-GUARD-001`.

### Area H: Strict PlaybackPlan Contract
- `READY` iff `canPlay === true` AND `access.allowed === true` AND source exists.
- **Tickets**: `ARCH-PLAYBACK-001`, `ARCH-PLAYBACK-002`.

### Area I: Provider Gating and Credential Safety
- Zero provider calls on deny/non-ready.
- Provider token issued only after AccessDecision allow.
- **Tickets**: `ARCH-PLAYBACK-001`, `ARCH-DI-003`.

### Area J: Frontend Rendering Boundary
- Frontend renders backend PlaybackPlan and does not authorize independently.
- No player mount or provider iframe on denied access.
- **Ticket**: `ARCH-E2E-001`.

### Area K: Comments Visibility and Permission
- Public-read, gated-write permission matrix.
- Inherit video policy through Access module.
- **Ticket**: `ARCH-COMMENTS-001`.

### Area L: Admin Override
- Admin overrides must be explicit in `AccessDecision`.
- Excluded from public metrics.
- **Ticket**: `ARCH-ADMIN-002`.

### Area M: Access Diagnostics
- Admin view showing Identity, Patron truth, Cache/drift, Financial eligibility, and Audit.
- **Ticket**: `ARCH-ADMIN-001`.

### Area N: Sensitive Response Caching
- Non-cacheable headers (private, no-store) for personalized access/playback/token responses.
- **Ticket**: `ARCH-CACHE-001`.

### Area O: Legacy Service Retirement
- Inventory and retirement of `lib/services/**`.
- **Tickets**: `ARCH-LEGACY-001` to `ARCH-LEGACY-007`.

### Area P: AppContext, Prisma and Dependency Boundaries
- Route -> Use Case -> Domain Ports -> Infrastructure Adapters.
- Remove direct Prisma in application layer.
- **Tickets**: `ARCH-DI-001` to `ARCH-DI-004`.

### Area Q: Architecture Guard
- Mandatory CI guard checking boundaries and forbidden sources.
- **Tickets**: `ARCH-CI-001`, `ARCH-GUARD-001`.

### Area R: Test Strategy
- Multi-dimensional matrix: Actors x Tiers x Video States x Asset Status.
- **Ticket**: `ARCH-TEST-001`.

### Area S: Risk-Based Coverage
- High coverage targets (90%) for Access and Playback gating.
- **Ticket**: `ARCH-COVERAGE-001`.

### Area T: Logging, Secrets and PII
- No raw payloads, tokens, or PII in logs/errors.
- Redaction helpers mandatory.
- **Ticket**: `ARCH-LOG-001`.

### Area U: Control-Plane Consistency
- Exactly one ready ticket. No drift between documents and code.
- **Ticket**: `ARCH-DOCS-001`.

### Area V: Resend Webhook Idempotency, Lock Ownership and Post-Merge Certification
- Fix lock ownership and fencing (lease tokens).
- Svix-only production authenticity.
- Real PostgreSQL concurrency evidence.
- **Tickets**: `EMAIL-WEBHOOK-*`, `ARCH-CI-001`.

## 6. Required ADR Program (Proposed)

- **ADR-0008**: AccessDecision canonical output.
- **ADR-0009**: `User.isPatron` and Clerk metadata non-authoritative.
- **ADR-0010**: PatronGrant lifecycle representation.
- **ADR-0011**: Strict PlaybackPlan discriminated union.
- **ADR-0012**: Sensitive responses non-cacheable.
- **ADR-0013**: Application layer dependency boundary.
- **ADR-0014**: Architecture guard mandatory CI policy.
- **ADR-0015**: Domain audit versus operational logs.
- **ADR-0016**: Email webhook event lease ownership and fencing.
- **ADR-0017**: Production Resend webhook authenticity.
- **ADR-0018**: Canonical administrator authorization resolver.

## 7. Definition of Completion

The program is complete when the Access module is the sole source of authorization, Payment/Patron lifecycles are fully audited and deterministic, Playback gating is strict, and the Architecture Guard enforces all boundaries in CI. Final certification requires fresh/upgrade migration proof and real concurrency proof.
