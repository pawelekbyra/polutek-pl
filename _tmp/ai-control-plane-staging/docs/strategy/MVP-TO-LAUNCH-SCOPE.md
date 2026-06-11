# MVP-to-Launch Scope

Status: STAGED ONLY — NIEAKTYWNE.

## Launch-critical

- Payments/patron lifecycle safety.
- Access hard reset to active PatronGrant.
- Cloudflare Stream first provider path with Mux-ready thin abstraction.
- PlaybackPlan locked states without player mount/token/source.
- Access Diagnostics in admin cockpit.
- Comments read/write policy and moderation/report abuse.
- Email consent/unsubscribe/bounce/complaint suppression.
- Observability for webhooks, access, provider, playback, email, comments.
- Privacy/legal/security/accessibility/mobile/performance.
- Owner runbook and X7 certification.

## Should-have before launch if safe

- Better player UX, captions/subtitles readiness.
- Admin media cockpit polish.
- Broadcast preview UX.
- Comment duplicate detection and moderation ergonomics.
- Basic privacy-safe analytics excluding admin preview.

## Post-launch

- Resume/progress enhancements.
- Advanced Mux analytics/4K/DRM if owner wants.
- Preference center polish.
- Richer community features.
- Deeper alerts/escalation workflows.

## Do-not-build

See `DO-NOT-BUILD.md`. Anything from that list is out of scope unless owner creates a new explicit architecture decision.

## Owner decision required

- Partial refund policy.
- Final legal/cookie copy.
- Whether existing reactions/hearts are launch-critical or Phase 2.
- Exact alert channels and thresholds.
