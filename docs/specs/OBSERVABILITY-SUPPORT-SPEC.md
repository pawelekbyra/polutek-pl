# Observability / Support / System Health Spec

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE. Ta specyfikacja jest target/product standard w aktywnym control plane, ale nie dowód aktualnego runtime.

## Purpose

Ustalić reguły, model docelowy, forbidden shortcuts, strategię testów, kandydatów ticketów i kryteria certyfikacji dla domeny: Observability / Support / System Health.

## Product rules

- Owner health dashboard.
- Admin support diagnostics.
- Developer observability.
- Audit trail separate from operational logs.
- Privacy-safe analytics.
- No secrets/tokens in logs.
- Admin preview excluded from analytics.

## Launch-critical requirements

- Webhook processing states visible.
- Failed/stuck events visible.
- Payment/patron health and mismatches.
- Access diagnostics.
- Video upload/provider health.
- Playback errors.
- Email delivery health.
- Comment/community health.
- Alerts for critical billing/access/video failures.

## Target model

Operational events, audit events, health read models, support workflows and redaction policy.

## Forbidden shortcuts

- Logging secrets/tokens.
- Treating audit as debug logs.
- Hiding failed webhook states.
- Analytics that include admin previews as public views.

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

## Launch observability evidence model

This section defines the minimum support/observability standard for one creator and one product. It is not an enterprise observability platform and does not certify current runtime.

### Definitions

- Health signal: a product-meaningful state that tells owner whether a launch-critical domain can operate or needs action, for example webhook backlog, failed provider event, access mismatch, email suppression, playback failure or comments abuse queue.
- Audit event: immutable business/security record of who did what, when, why and to which domain object, especially manual access actions, moderation and broadcast actions.
- Operational log: diagnostic runtime record used to debug service behavior; it must not replace audit trail and must not expose secrets, tokens or private playback URLs.
- Alert: owner/developer notification for a health signal crossing an owner-approved threshold and requiring acknowledgement or recovery.
- Support diagnostic: admin-visible answer to a concrete support question, such as “why is this paid user locked?” or “why did this video fail processing?”.

Dashboard bez owner action lub recovery path nie jest launch-critical diagnostic.

### Correlation identifiers and redaction

Launch-critical support diagnostics SHOULD include the minimum safe identifiers needed to connect events without exposing secrets:

- internal user id or redacted email display,
- Stripe event id/payment id where applicable,
- PatronGrant id and grant status,
- Video id and VideoAsset id,
- provider asset id without playback token/source URL,
- webhook event id and processing status,
- request id / correlation id,
- admin actor id for audited actions,
- email message id / subscription id where applicable,
- comment/report id where applicable.

Redaction rules:

- never log or display secrets, API keys, session tokens, webhook secrets, playback tokens, signed URLs or private playback URLs,
- redact PII not needed for the support question,
- keep operational logs separate from audit events,
- screenshots/recordings used as evidence must redact personal data and tokens,
- use `NOT_APPLICABLE` only with an explanation for identifiers a flow cannot have.

### Failed/stuck event definition

An event is failed/stuck when it requires owner/developer action or safe retry because it exceeded the expected processing window, ended in terminal provider error, retried without success, produced inconsistent domain state, or cannot be correlated to the expected domain object. Owner-approved thresholds are `OWNER_DECISION_REQUIRED` until recorded.

Minimum failed/stuck categories:

- Stripe webhook failed/stuck,
- Cloudflare webhook failed/stuck,
- payment exists but PatronGrant missing/suspended/revoked unexpectedly,
- access decision mismatch,
- provider asset processing failed/stuck,
- playback failure for allowed user,
- email delivery/bounce/complaint failure,
- comments abuse/moderation queue health issue.

### Alert ownership and recovery

Every launch-critical alert MUST include:

| Alert | Status | Threshold | Owner | Acknowledgement path | Recovery path | Test before X7 |
| --- | --- | --- | --- | --- | --- | --- |
| Stripe webhook failed/stuck | `OWNER_DECISION_REQUIRED` until threshold/channel approved | Owner-approved threshold required | Owner/developer named in runbook | Required | Retry/reconcile path required | Required |
| Cloudflare webhook failed/stuck | `OWNER_DECISION_REQUIRED` until threshold/channel approved | Owner-approved threshold required | Owner/developer named in runbook | Required | Retry/reconcile path required | Required |
| Payment/access mismatch | `OWNER_DECISION_REQUIRED` until threshold/channel approved | Owner-approved threshold required | Owner/developer named in runbook | Required | Paid-but-locked diagnostic and correction path required | Required |
| Provider/playback failure | `OWNER_DECISION_REQUIRED` until threshold/channel approved | Owner-approved threshold required | Owner/developer named in runbook | Required | Provider retry/import/recovery path required | Required |
| Email failure/suppression | `OWNER_DECISION_REQUIRED` until threshold/channel approved | Owner-approved threshold required | Owner/developer named in runbook | Required | Suppression/delivery review path required | Required |
| Comments abuse/health | `OWNER_DECISION_REQUIRED` until threshold/channel approved | Owner-approved threshold required | Owner/developer named in runbook | Required | Moderation/rate-limit response path required | Required |

A critical alert is not X7-ready until its threshold, channel, owner, acknowledgement path, recovery path and test-alert evidence are recorded. Alerts that do not lead to an owner action or recovery path should be removed from launch-critical scope or redefined.

### Support diagnostics required for X7

X7 Launch Evidence Pack must show diagnostics for:

- failed/stuck Stripe webhook,
- failed/stuck Cloudflare webhook,
- payment/patron mismatch,
- final access decision and source of truth,
- provider failure,
- playback failure,
- email failure/suppression,
- comments health.

Each diagnostic must answer: what happened, who/what is affected, whether access/payment/video/email/comment integrity is at risk, next safe action, retry/recovery path and where audit evidence is stored if an admin action is taken.
## Current implementation snapshot

This section is informational and references current reconciliation evidence. The normative requirements above remain the product standard.

Merged implementation/local tests do not equal production launch certification; X6/X7 production/manual evidence remains required.
