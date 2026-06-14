# Architecture Decision Records (ADR)

Status: ACTIVE

## ADR-0008 — AccessDecision is the canonical authorization output
**Status**: `PROPOSED / REQUIRED_BEFORE_IMPLEMENTATION`
**Context**: Authorization is currently fragmented.
**Decision**: Standardize all backend authorization on a strict `AccessDecision` contract.
**Consequences**: Routes cannot locally reconstruct policy.

## ADR-0009 — User.isPatron and Clerk metadata are non-authoritative read models
**Status**: `PROPOSED / REQUIRED_BEFORE_IMPLEMENTATION`
**Context**: Using denormalized flags for authorization leads to drift.
**Decision**: `PatronGrant` is the sole source of truth. Denormalized flags are for UI/diagnostics only.

## ADR-0010 — PatronGrant lifecycle representation
**Status**: `PROPOSED / REQUIRED_BEFORE_IMPLEMENTATION`
**Context**: Need to handle disputes and suspensions.
**Decision**: Use explicit `ACTIVE`, `SUSPENDED`, `REVOKED` states with audit trails.

## ADR-0011 — PlaybackPlan is a strict discriminated union
**Status**: `PROPOSED / REQUIRED_BEFORE_IMPLEMENTATION`
**Context**: Avoid `READY` player state with `canPlay: false`.
**Decision**: Strict union: `READY` (playable), `PATRON_REQUIRED` (gated), `UNAVAILABLE` (error/processing).

## ADR-0012 — Sensitive playback and diagnostics responses are non-cacheable
**Status**: `PROPOSED / REQUIRED_BEFORE_IMPLEMENTATION`
**Decision**: Force `Cache-Control: private, no-store, max-age=0` for all personalized access routes.

## ADR-0013 — Application layer dependency boundary
**Status**: `PROPOSED / REQUIRED_BEFORE_IMPLEMENTATION`
**Decision**: Domain should not depend on Prisma/Stripe/Clerk SDKs. Use Ports/Adapters.

## ADR-0014 — Architecture guard is mandatory CI policy
**Status**: `PROPOSED / REQUIRED_BEFORE_IMPLEMENTATION`
**Decision**: Fail CI on boundary or allowlist violations.

## ADR-0015 — Domain audit events versus operational logs
**Status**: `PROPOSED / REQUIRED_BEFORE_IMPLEMENTATION`
**Decision**: Separate transactional domain audit (immutable) from operational logs (ephemeral/redacted).

## ADR-0016 — Email webhook event lease ownership and fencing
**Status**: `PROPOSED / REQUIRED_BEFORE_IMPLEMENTATION`
**Decision**: Every webhook process must own a lease. Conditional finalization using lease tokens.

## ADR-0017 — Production Resend webhook authenticity
**Status**: `PROPOSED / REQUIRED_BEFORE_IMPLEMENTATION`
**Decision**: Enforce Svix-only in production. Reject legacy fallbacks.

## ADR-0018 — Canonical administrator authorization resolver
**Status**: `PROPOSED / REQUIRED_BEFORE_IMPLEMENTATION`
**Decision**: Single resolver merging DB roles, `ADMIN_CLERK_USER_IDS`, and configured admin IDs.
