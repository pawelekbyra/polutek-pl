# Launch Execution Backlog

Status: ACTIVE
Purpose: complete non-executable launch backlog
Current executable source: docs/tickets/ready/README.md
Launch status: NO_GO

This document is not an executable queue. It may list many planned items. Only docs/tickets/ready/README.md may identify the single current executable ticket.

## Ordered repair queue after PR #931/#932 reconciliation

| Order | Workstream | Planned ticket / state | Depends on | Completion evidence | Launch impact |
| ---: | --- | --- | --- | --- | --- |
| 1 | CI signal restoration | CI-SIGNAL-RESTORATION-001 / MERGED / ACCEPTED / CI_VISIBILITY_RESTORED / HISTORICAL_BASELINE_ACTIVE | Emergency docs reconciliation | Independently visible strict-escapes, hotspots, architecture boundaries, typecheck, tests/coverage, lint, build, integration-postgres, control-plane docs and security checks restored; not FULL_CI_PASS | P0 visibility gate complete / health unresolved |
| 2 | Security dependency remediation | SECURITY-DEPENDENCY-REMEDIATION-001 / IMPLEMENTATION_MERGED / HIGH_AUDIT_FINDINGS_ZERO / HISTORICAL | CI signal baseline | PR #946 merged; later CI/security checks also passed during #953. This is no longer a current executable ticket. | P0 security dependency blocker complete; launch still NO_GO for remaining gates |
| 3 | Cloudflare containment | ADMIN-VIDEO-CLOUDFLARE-CONTAINMENT-001 / PLANNED | CI signal restoration | Unsafe upload/attach paths disabled or safely contained | P0 blocker |
| 4 | Cloudflare provider privacy | CLOUDFLARE-PRODUCTION-ASSET-PRIVACY-VERIFY-001 / BLOCKED_OPERATOR_ACCESS | Operator Cloudflare access | Redacted provider evidence for requireSignedURLs/existing asset privacy | X7 blocker |
| 5 | TUS upload lifecycle | ADMIN-VIDEO-TUS-UPLOAD-LIFECYCLE-001 / PLANNED | Containment and CI signal | Real TUS contract, resume, duplicate-attempt lifecycle, late-webhook handling | P0 blocker |
| 6 | Publication and Hero contract | ADMIN-VIDEO-PUBLICATION-AND-HERO-CONTRACT-001 / PLANNED | Upload lifecycle | Publication diagnostics, stable publishedAt, Hero/state transition policy | P0 blocker |
| 7 | Create form and filters | ADMIN-VIDEO-CREATE-FORM-AND-FILTER-CONTRACT-001 / PLANNED | Publication/Hero contract | Strict server DTOs, truthful form defaults, nullable source filtering | HIGH |
| 8 | Video post-merge verification | ADMIN-VIDEO-POSTMERGE-VERIFY-001 / PLANNED | Video runtime repairs | Independent verification of create/upload/publish/playback | P0 blocker |
| 9 | Auth reverification | ADMIN-AUTH-POSTMERGE-REVERIFY-001 / PLANNED | CI signal and video stabilization | Current-main verification of DB-authoritative admin/access paths | HIGH |
| 10 | Legacy AccessPolicy retirement | LEGACY-ACCESS-POLICY-RETIREMENT-001 / PLANNED | Auth reverification | Legacy playback access path retired or fully reconciled | HIGH |
| 11 | Admin channel root cause | ADMIN-CHANNEL-ROOT-CAUSE-001 / PLANNED | CI signal | Production-safe diagnostics, DB/schema evidence, strict DTO typing | HIGH |
| 12 | Legacy media proxy retirement | LEGACY-MEDIA-PROXY-RETIREMENT-001 / PLANNED | Video playback reconciliation | /api/media and /api/media-source contracts reconciled | HIGH |
| 13 | Control-plane guard hardening | CONTROL-PLANE-GUARD-HARDENING-001 / NON_EXECUTABLE / PLANNED | CI signal | Chronology/current-pointer guard hardened | MEDIUM |
| 14 | Beta-scope guard reconciliation | BETA-SCOPE-GUARD-RECONCILIATION-001 / NON_EXECUTABLE / PLANNED | Control-plane hardening | Guard retired, renamed or rebuilt for public-launch scope; no more exception-only patching | MEDIUM |

## Continuing launch backlog

Legal/privacy/cookies/support copy remains `LEGAL_REVIEW_REQUIRED / IMPLEMENTATION_MISSING`. Email content-notification runtime boundary, partial refund runtime handling, RPO/RTO and alert channel evidence, Cloudflare originals/retention evidence, Vercel/Stripe/Cloudflare production evidence, backup/restore drills, X6.2-X6.8 and X7 certification all remain open. Public launch remains NO_GO.

## Legacy launch backlog terms retained for guard continuity

The following workstreams remain open or historical as documented elsewhere: Email consent boundary; Signed unsubscribe; Bounce/complaint suppression; System email events; Language persistence; Referral notifications; Runtime/provider privacy inventory; Legal copy PL/EN; Vercel production evidence; Stripe production evidence; Cloudflare production evidence; Backup, restore and alerts; X6.2; X6.3; X6.4; X6.5; X6.6; X6.7; X6.8; X6 certification; X7 Launch Evidence Pack; X7 certification; Final owner launch decision.