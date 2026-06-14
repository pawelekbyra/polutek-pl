# Launch Execution Backlog

Status: ACTIVE
Purpose: complete non-executable launch backlog
Current executable source: docs/tickets/ready/README.md
Launch status: NO_GO

This document is not an executable queue.
It may list many planned items.
Only docs/tickets/ready/README.md may identify the single current executable ticket.

## Backlog table

| Order | Workstream | Planned ticket / state | Depends on | Primary executor | Owner/operator/legal action | Completion evidence | Launch impact |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | Email consent boundary | LAUNCH-EMAIL-003 / COMPLETED | Owner decisions recorded | Builder | None for this ticket | Completed through PR #899; system email does not change content consent, does not auto-subscribe to Resend Audience, missing preference = not opted in, system email does not reverse opt-out | Compliance blocker resolved for this boundary only |
| 2 | Resend webhook production repair | EMAIL-WEBHOOK-SVIX-PRODUCTION-REPAIR-001 / IMPLEMENTED + VERIFIED | Email webhook idempotency verification | Builder + Reviewer / Certifier | None for this repair | Implemented in PR #914 and independently verified PASS in PR #916; report `docs/reports/verification/EMAIL-WEBHOOK-SVIX-POSTMERGE-VERIFY-001.md` | Webhook security blocker resolved for this repair only |
| 3 | Signed unsubscribe | EMAIL-SIGNED-UNSUBSCRIBE-001 / IMPLEMENTED + VERIFIED | Email consent boundary | Reviewer / Certifier | None for this verification | Implementation PR #918; verification PR #920; verification merge SHA `77081b64073ec77bf1df13217622a0f88d118011`; report `docs/reports/verification/EMAIL-SIGNED-UNSUBSCRIBE-POSTMERGE-VERIFY-001.md` | Signed-unsubscribe blocker resolved for this boundary only; public launch remains NO_GO |
| 4 | Admin auth actor canonicalization | ADMIN-AUTH-ACTOR-CANONICALIZATION-001 / READY VIA CANONICAL QUEUE | Launch-critical admin authorization defects | Builder | None until implementation | Canonical server-side actor resolver, DB-authoritative admin checks, deleted-user denial, admin bypass regression coverage | urgent launch-critical auth/runtime repair |
| 5 | Admin video Cloudflare create flow | ADMIN-VIDEO-CLOUDFLARE-CREATE-FLOW-REPAIR-001 / PLANNED / URGENT / NEXT AFTER AUTH CANONICALIZATION | Auth canonicalization implementation, independent verification PASS and reconciliation | Builder | None until implementation; provider/operator evidence remains separate | Cloudflare-first draft, resumable file upload, truthful asset lifecycle, safe publication gate, playback verification | launch-critical admin/runtime repair |
| 6 | Bounce/complaint suppression | EMAIL-BOUNCE-COMPLAINT-SUPPRESSION-001 / PLANNED / NEXT AFTER VIDEO REPAIR | Email consent boundary and signed unsubscribe separation; admin video repair implementation, independent verification PASS and reconciliation | Builder + operator | Provider access/evidence | Provider events, durable local suppression, no automatic re-opt-in, deliverability evidence | Compliance blocker; public launch remains NO_GO |
| 7 | System email events and idempotency | Planned, not ticketed | Email consent boundary | Builder | None until ticketed | Welcome, first tip + patron granted as one mail, subsequent tip, account deletion, refund, dispute, chargeback, isActive, no retry duplicates, error history | Launch blocker |
| 8 | Language persistence and email language | Planned, not ticketed | System email event audit | Builder | None until ticketed | PL/EN initial detection, manual switch precedence, DB persistence, first email language, deletion email language before anonymization | Trust/localization blocker |
| 9 | Referral notifications | Planned, not ticketed | Email preferences and templates | Builder | Owner/admin configuration | Optional 1/5–4/5 default off, 5/5 result email, counting independent from email toggle | Non-core launch readiness |
| 10 | Runtime/provider privacy inventory | Planned, not ticketed | Current runtime snapshot | Technical agent | Owner review after inventory | Real providers, actual data fields, cookies, retention, transaction facts, no invented processing | Legal prerequisite |
| 11 | Legal copy PL/EN | Planned, not ticketed | Runtime/provider privacy inventory | Technical/legal drafting agent + professional lawyer | Professional lawyer review and owner approval | Terms, privacy, cookies, tips/refunds, moderation, access termination, contact and identification | Public launch blocker |
| 12 | Vercel production evidence | Operator pending | Production access | Operator/Certifier | Operator access | Redacted production environment and log evidence | X7 blocker |
| 13 | Stripe production evidence | Operator pending | Production access and email/access behavior | Operator/Certifier | Controlled production test | Controlled minimum tip, PatronGrant, full refund, redacted evidence | X7 blocker |
| 14 | Cloudflare production evidence | Operator pending | Production access and video asset | Operator/Certifier | Cloudflare/Vercel access | Upload/import, webhook, signed playback, denied playback, originals preserved outside Cloudflare | X7 blocker |
| 15 | Backup, restore and alerts | Operator pending | Production DB/monitoring access | Operator/Certifier | Restore drill and alert delivery | Restore drill, RPO 24h, RTO 48h, alert delivery to support@polutek.pl | X7 blocker |
| 16 | X6.2 State completeness | Planned, not ticketed | Runtime/legal blockers sufficiently resolved | Certifier/Reviewer | None until scheduled | X6.2 evidence report | X6 blocker |
| 17 | X6.3 Responsive/browser | Planned, not ticketed | Runtime/legal blockers sufficiently resolved | Certifier/Reviewer | Device/browser access | X6.3 evidence report | X6 blocker |
| 18 | X6.4 Accessibility | Planned, not ticketed | Runtime/legal blockers sufficiently resolved | Certifier/Reviewer | None until scheduled | X6.4 evidence report | X6 blocker |
| 19 | X6.5 Performance | Planned, not ticketed | Runtime/legal blockers sufficiently resolved | Certifier/Reviewer | Production-like measurement | X6.5 evidence report | X6 blocker |
| 20 | X6.6 Copy/trust | Planned, not ticketed | Legal copy PL/EN | Certifier/Reviewer | Owner/legal approval | X6.6 evidence report | X6 blocker |
| 21 | X6.7 Owner/admin usability | Planned, not ticketed | Admin flows stable | Certifier/Reviewer | Owner/admin validation | X6.7 evidence report | X6 blocker |
| 22 | X6.8 Representative user validation | Planned, not ticketed | X6.2–X6.7 near-complete | Certifier/Reviewer | Representative user validation | X6.8 evidence report | X6 blocker |
| 23 | X6 certification | Planned, not ticketed | X6.2–X6.8 evidence | Certifier | Owner acceptance of evidence | X6 certification report | X7 prerequisite |
| 24 | X7 Launch Evidence Pack | Planned, not ticketed | Legal, runtime, operator and X6 completion | Certifier/Integrator | Owner/operator evidence | Complete Launch Evidence Pack | Launch blocker |
| 25 | X7 certification | Planned, not ticketed | X7 Launch Evidence Pack | Certifier | Owner review | X7 certification recommendation | Launch blocker |
| 26 | Final owner launch decision | Planned, not ticketed | X7 certification recommendation | Owner | Owner chooses GO, CONDITIONAL_GO or NO_GO | Recorded owner launch decision | Determines launch |
| 27 | Final docs reconciliation and controlled launch | Planned, not ticketed | Final owner launch decision | Integrator/Operator | Owner/operator coordination | Reconciled docs and controlled launch evidence | Launch execution |
