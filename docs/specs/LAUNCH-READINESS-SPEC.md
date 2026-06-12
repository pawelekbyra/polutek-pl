# Launch Readiness Spec

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE. Ta specyfikacja jest target/product standard w aktywnym control plane, ale nie dowód aktualnego runtime.

## Purpose

Ustalić reguły, model docelowy, forbidden shortcuts, strategię testów, kandydatów ticketów i kryteria certyfikacji dla domeny: Launch Readiness.

## Product rules

- Public launch gate, not private beta.
- Access leak is launch blocker.
- Payment fulfillment gap is launch blocker.
- Privacy/legal/cookie/email consent gaps are launch blockers.
- Admin must diagnose paid-but-locked.
- Owner runbook required.
- Final certification X7 required.

## Launch-critical requirements

- Accessibility, mobile and performance checks.
- Security review.
- Backups and recovery/runbooks.
- Manual QA.
- Legal/privacy review.
- Critical alerts configured.

## Target model

Launch checklist, cert report, owner manual, manual QA evidence and blocker register.

## Forbidden shortcuts

- Launch with known access leak.
- Launch with broken payment fulfillment.
- Launch without unsubscribe/consent.
- Launch without owner support path for paid-but-locked.

## Test strategy

- Unit tests dla policy/use-case/repository granic.
- Route/API contract tests dla wrażliwych przepływów.
- Negative tests dla forbidden shortcuts.
- Idempotency/security tests tam, gdzie domena dotyka webhooków, access, providerów lub tokenów.
- Admin/support tests dla diagnostyki i audit trail.
- Manual QA checklist przed certyfikacją fazy.

## Codex ticket candidates

- Inventory aktualnego kodu vs ta specyfikacja.
- Gap analysis z podziałem launch-critical/should-have/post-launch.
- Jedna migracja use-case albo route family per ticket.
- Test-only ticket dla negative cases.
- Docs reconciliation po merge batcha.

## Certification criteria

- Kod i docs są zgodne.
- Guardy i testy nie kłamią.
- Forbidden shortcuts są pokryte testem albo raportem braku użycia.
- Znane blockery są zapisane w `docs/tickets/blocked/`.
- Certifier rekomenduje status, właściciel merge'uje.

## Open owner questions

- Czy dana rzecz jest launch-critical czy post-launch, jeśli nie wynika to z owner decisions?
- Czy istnieją dodatkowe ograniczenia prawne/UX dla tej domeny?
- Czy obecny runtime ma elementy, które warto zachować zamiast przepisywać?

## Launch Evidence Pack

X7 is Launch Proof, not a launch checklist. This spec does not certify current runtime. A final X7 report MUST collect production/manual evidence and use the shared statuses: `IMPLEMENTED_VERIFIED`, `IMPLEMENTED_UNVERIFIED`, `PARTIAL`, `MISSING`, `BLOCKED`, `OWNER_DECISION_REQUIRED`, `DEFERRED_POST_LAUNCH`, `NOT_APPLICABLE`.

Evidence must record criterion, status, proof, environment, date, evidence owner and blocker/follow-up. Local tests, docs, green preview deployment or agent review are never sufficient alone to mark `LAUNCH_READY`.

### Deployment proof

Required evidence:

- green production deployment,
- green build from current main,
- correct production domain and HTTPS,
- verified production env groups,
- no secrets in repo or public runtime,
- provider dashboards pointing at production URL,
- runtime logs checked,
- rollback documented,
- no reliance on green preview instead of production.

### Payment and access proof

Required positive flow:

```txt
qualifying payment
-> verified Stripe webhook
-> Payment financial fact
-> eligibility policy
-> active PatronGrant
-> access allow
```

Required negative proof:

- below-threshold payment does not grant access,
- duplicate webhook does not create duplicate Payment/grant,
- payment alone does not grant access,
- Clerk metadata does not grant access,
- `User.isPatron` does not grant backend access,
- newsletter subscription does not grant access,
- guest and non-patron remain denied.

Required lifecycle proof: full refund, dispute opened, dispute won, dispute lost/chargeback, manual grant, manual suspend, manual reactivate, manual revoke and reason/audit for manual actions.

### Video and playback proof

Required proof:

- admin upload or import,
- Cloudflare asset lifecycle to READY,
- primary READY asset,
- allowed patron playback,
- denied guest,
- denied logged-in non-patron,
- no playback URL/token for denied,
- no provider playback call for denied,
- no player mount for denied,
- no playback session/view for denied,
- no legacy private fallback for patron-only content,
- correct PROCESSING/FAILED/NO_PRIMARY_ASSET states,
- player checked on mobile and desktop.

### Comments proof

Required proof:

- public read of published comments,
- guest cannot write/react/report,
- non-patron cannot write on patron-only,
- patron can write per policy,
- admin can moderate,
- report abuse works,
- rate limit works,
- duplicate/spam protection is checked,
- hide/delete/restore/dismiss leaves audit,
- no shadow bans.

### Email and consent proof

Required proof:

- patronat does not automatically subscribe to marketing,
- subscribe does not create PatronGrant,
- unsubscribe does not remove PatronGrant,
- transactional and marketing are separated,
- preview/test-send works,
- bounce suppression works,
- complaint suppression works,
- sending domain is verified,
- from/reply-to are correct,
- PL/EN consents match owner/legal decision.

### Observability and support proof

Required proof:

- failed/stuck Stripe webhook visible,
- failed/stuck Cloudflare webhook visible,
- payment/patron mismatch visible,
- access decision visible,
- provider failure visible,
- playback failure visible,
- email failure visible,
- comments health visible,
- alerts for critical events,
- no secrets, tokens or private URLs in logs,
- audit trail separated from operational logs.

### Backup and recovery proof

“Backup is enabled” is not sufficient. Required proof:

- documented backup policy,
- owner-approved RPO,
- owner-approved RTO,
- test restore to safe environment,
- key data integrity confirmation,
- recovery instructions,
- process owner,
- explicit information about what backup does not cover,
- date of latest restore drill.

RPO/RTO are `OWNER_DECISION_REQUIRED` until accepted in owner decisions or an X7 owner approval record.

### Security proof

Use risk-based review based on OWASP ASVS 5.0.0. Do not require blind completion of every ASVS item. Map launch-critical areas:

- authentication,
- session,
- authorization,
- input validation,
- webhook verification,
- payment integrity,
- file/upload handling,
- SSRF/URL import risk,
- secrets,
- logging,
- error handling,
- dependency risk,
- admin actions,
- rate limiting,
- privacy,
- token/source leakage.

Every excluded area requires justification and owner-visible rationale.

### Accessibility, mobile and performance proof

X7 collects final evidence rather than repeating the X6 description. The Launch Evidence Pack must prove that:

- launch-critical flows meet the accessibility target or have explicit blocker/accepted exception,
- mobile/browser matrix was executed,
- performance budgets were checked,
- no critical layout, interaction or navigation problem remains,
- owner accepted explicitly recorded exceptions.

### Legal and owner proof

Required proof:

- privacy policy,
- terms,
- cookie/consent behavior,
- email consent,
- support/contact path,
- refund/dispute communication,
- material retention policy,
- Cloudflare cost/retention policy,
- owner questions explicitly resolved,
- no decision made independently by an agent.

### Final GO / NO-GO

Final certification report MUST state exactly one:

- `GO` — no launch-critical blockers.
- `CONDITIONAL_GO` — only explicit non-critical exceptions accepted by owner; never valid for access, payments, token leakage, legal/privacy, broken production deploy or missing backup/recovery proof.
- `NO_GO` — at least one launch-critical blocker exists or mandatory evidence is missing.
## Current implementation snapshot

This section is informational and references current reconciliation evidence. The normative requirements above remain the product standard.

Current main status is summarized in `docs/reports/reconciliation/DOCS-RECONCILE-001-CURRENT-MAIN-SOURCE-OF-TRUTH.md`. Merged implementation/local tests do not equal production launch certification; X6/X7 production/manual evidence remains required.
