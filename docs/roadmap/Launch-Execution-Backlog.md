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
| 1 | Email consent boundary | LAUNCH-EMAIL-003 / READY | Owner decisions recorded | Builder | None for this ticket | System email does not change content consent, does not auto-subscribe to Resend Audience, missing preference = not opted in, system email does not reverse opt-out | Compliance blocker |
| 2 | Signed unsubscribe | Planned, not ticketed | Email consent boundary | Builder | None until ticketed | Signed token, works without login, no clear e-mail in URL, unsubscribe does not touch PatronGrant | Compliance blocker |
| 3 | Bounce/complaint suppression | Planned, not ticketed | Email consent boundary | Builder + operator | Provider access/evidence | Provider events, suppression, no automatic re-opt-in, deliverability evidence | Compliance blocker |
| 4 | System email events and idempotency | Planned, not ticketed | Email consent boundary | Builder | None until ticketed | Welcome, first tip + patron granted as one mail, subsequent tip, account deletion, refund, dispute, chargeback, isActive, no retry duplicates, error history | Launch blocker |
| 5 | Language persistence and email language | Planned, not ticketed | System email event audit | Builder | None until ticketed | PL/EN initial detection, manual switch precedence, DB persistence, first email language, deletion email language before anonymization | Trust/localization blocker |
| 6 | Referral notifications | Planned, not ticketed | Email preferences and templates | Builder | Owner/admin configuration | Optional 1/5–4/5 default off, 5/5 result email, counting independent from email toggle | Non-core launch readiness |
| 7 | Runtime/provider privacy inventory | Planned, not ticketed | Current runtime snapshot | Technical agent | Owner review after inventory | Real providers, actual data fields, cookies, retention, transaction facts, no invented processing | Legal prerequisite |
| 8 | Legal copy PL/EN | Planned, not ticketed | Runtime/provider privacy inventory | Technical/legal drafting agent + professional lawyer | Professional lawyer review and owner approval | Terms, privacy, cookies, tips/refunds, moderation, access termination, contact and identification | Public launch blocker |
| 9 | Vercel production evidence | Operator pending | Production access | Operator/Certifier | Operator access | Redacted production environment and log evidence | X7 blocker |
| 10 | Stripe production evidence | Operator pending | Production access and email/access behavior | Operator/Certifier | Controlled production test | Controlled minimum tip, PatronGrant, full refund, redacted evidence | X7 blocker |
| 11 | Cloudflare production evidence | Operator pending | Production access and video asset | Operator/Certifier | Cloudflare/Vercel access | Upload/import, webhook, signed playback, denied playback, originals preserved outside Cloudflare | X7 blocker |
| 12 | Backup, restore and alerts | Operator pending | Production DB/monitoring access | Operator/Certifier | Restore drill and alert delivery | Restore drill, RPO 24h, RTO 48h, alert delivery to support@polutek.pl | X7 blocker |
| 13 | X6.2 State completeness | Planned, not ticketed | Runtime/legal blockers sufficiently resolved | Certifier/Reviewer | None until scheduled | X6.2 evidence report | X6 blocker |
| 14 | X6.3 Responsive/browser | Planned, not ticketed | Runtime/legal blockers sufficiently resolved | Certifier/Reviewer | Device/browser access | X6.3 evidence report | X6 blocker |
| 15 | X6.4 Accessibility | Planned, not ticketed | Runtime/legal blockers sufficiently resolved | Certifier/Reviewer | None until scheduled | X6.4 evidence report | X6 blocker |
| 16 | X6.5 Performance | Planned, not ticketed | Runtime/legal blockers sufficiently resolved | Certifier/Reviewer | Production-like measurement | X6.5 evidence report | X6 blocker |
| 17 | X6.6 Copy/trust | Planned, not ticketed | Legal copy PL/EN | Certifier/Reviewer | Owner/legal approval | X6.6 evidence report | X6 blocker |
| 18 | X6.7 Owner/admin usability | Planned, not ticketed | Admin flows stable | Certifier/Reviewer | Owner/admin validation | X6.7 evidence report | X6 blocker |
| 19 | X6.8 Representative user validation | Planned, not ticketed | X6.2–X6.7 near-complete | Certifier/Reviewer | Representative user validation | X6.8 evidence report | X6 blocker |
| 20 | X6 certification | Planned, not ticketed | X6.2–X6.8 evidence | Certifier | Owner acceptance of evidence | X6 certification report | X7 prerequisite |
| 21 | X7 Launch Evidence Pack | Planned, not ticketed | Legal, runtime, operator and X6 completion | Certifier/Integrator | Owner/operator evidence | Complete Launch Evidence Pack | Launch blocker |
| 22 | X7 certification | Planned, not ticketed | X7 Launch Evidence Pack | Certifier | Owner review | X7 certification recommendation | Launch blocker |
| 23 | Final owner launch decision | Planned, not ticketed | X7 certification recommendation | Owner | Owner chooses GO, CONDITIONAL_GO or NO_GO | Recorded owner launch decision | Determines launch |
| 24 | Final docs reconciliation and controlled launch | Planned, not ticketed | Final owner launch decision | Integrator/Operator | Owner/operator coordination | Reconciled docs and controlled launch evidence | Launch execution |
