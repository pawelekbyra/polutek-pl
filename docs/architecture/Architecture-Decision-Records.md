# Architecture Decision Records

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE.

## ADR-0001 — Polutek.pl is a place, not a platform
Decision: Polutek.pl is a single-creator VOD place.

## ADR-0002 — Patron access is based on PatronGrant
Decision: Active PatronGrant is the target backend source of truth.

## ADR-0003 — Cloudflare Stream first, Mux later
Decision: Cloudflare Stream is the first provider. Thin abstraction required.

## ADR-0004 — Patronat is one-time support
Decision: Reward for qualifying one-time support, not recurring subscription.

## ADR-0005 — Locked state is not an overlay
Decision: Denied PlaybackPlan renders locked placeholder; no player mount.

## ADR-0006 — Comments are visible, writing is gated
Decision: Visibility publicly; writing requires patron/admin.

## ADR-0007 — Admin cockpit starts with Access Diagnostics
Decision: Priority on diagnostics over generic dashboard.

## ADR-0016 — Email webhook event lease ownership and fencing
Status: PROPOSED / REQUIRED_BEFORE_IMPLEMENTATION
Context: PR #905 merged a basic lock service that lacks ownership identity.
Decision Points:
- Use unique `leaseToken` (UUID/ULID) per attempt.
- Conditional finalization (release) using CAS on the token.
- Explicit stale threshold (10m) and takeover logic.
- Type integrity during takeover.

## ADR-0017 — Production Resend webhook authenticity
Status: PROPOSED / REQUIRED_BEFORE_IMPLEMENTATION
Context: Current route allows fallback to a shared secret without signature verification in production.
Decision Points:
- Production environment MUST require Svix ID, Timestamp, and Signature.
- Replay protection via timestamp tolerance.
- Shared-secret fallback limited to non-production environments.
- Safe HTTP 400/401/503 response mapping.
