# Architecture Decision Records

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE.

## ADR-0001 — Polutek.pl is a place, not a platform

Decision:
Polutek.pl is a single-creator VOD place, not a marketplace, multi-creator SaaS, mini-Patreon, white-label CMS or tenant platform.

Consequences:
- No tenant model.
- No marketplace creator onboarding.
- No generic social network scope.
- Product architecture optimizes for one creator, one official channel, one patron/access model.

## ADR-0002 — Patron access is based on PatronGrant, not payment/subscription/cache

Decision:
Active PatronGrant is the target backend source of truth for patron access.

Consequences:
- Payment is financial evidence, not access itself.
- Subscription is email consent, not patron status.
- User.isPatron and Clerk metadata may exist only as legacy/read-model/cache until cleaned up.
- Playback/access decisions must not rely on frontend state.

## ADR-0003 — Cloudflare Stream first, Mux later per VideoAsset

Decision:
Cloudflare Stream is the first video provider. Mux must remain design-compatible per VideoAsset, but no heavy enterprise multi-provider framework is allowed now.

Consequences:
- Build the smallest provider abstraction needed.
- No active R2/S3/Vercel Blob private playback fallback without future architecture decision.
- Provider calls must only happen after backend access allow.

## ADR-0004 — Patronat is one-time support, not recurring subscription

Decision:
Patronat is a reward for qualifying one-time support/donation, not a recurring subscription. Launch thresholds are 10 PLN, 10 USD, 10 EUR and 10 CHF by default, admin-configurable per currency.

Consequences:
- Do not build recurring patron subscription scope without a new owner decision.
- Payment records remain financial evidence; access lifecycle is managed through PatronGrant policy.
- Access is permanent/lifetime/no-expiry by default unless suspended or revoked by policy.

## ADR-0005 — Locked state is not an overlay on player

Decision:
Denied PlaybackPlan renders a locked placeholder without mounting the real player, requesting streams or tokens, calling the provider for playback source or counting playback/view events.

Consequences:
- Frontend must not hide a real player behind an overlay for denied access.
- Denied playback plans must not leak playback URL or playback token.
- Provider calls must be gated by backend access allow.

## ADR-0006 — Comments are visible, writing is gated

Decision:
Comments under patron-only video are visible publicly, but commenting, reacting and writing require patron or admin access.

Consequences:
- Comment visibility is not the same as comment permission.
- Guests may read published comments but cannot write, react or report.
- Generic social network scope remains out of bounds.

## ADR-0007 — Admin cockpit starts with Access Diagnostics

Decision:
Access Diagnostics is the first priority for the admin cockpit. Generic dashboard work comes later.

Consequences:
- Owner support must be able to diagnose paid-but-locked cases without direct database/Stripe/Clerk inspection.
- Manual access-impacting actions require reason, audit and appropriate confirmation for dangerous operations.

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
