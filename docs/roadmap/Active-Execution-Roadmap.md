# Active Execution Roadmap — Post-R AI Delivery Control Plane

Status aktywacji:

```txt
ACTIVE — POST-R AI DELIVERY CONTROL PLANE
```

Ten dokument jest aktywną częścią Post-R AI Delivery Control Plane. Obowiązuje po aktywacji root `AGENTS.md` i `docs/**`.

## Operating principle

Ten dokument jest aktywną kolejką egzekucji po R-phase handoff i aktywacji Post-R AI Delivery Control Plane. Aktywny jest wyłącznie etap X0; X1-X7 pozostają nieuruchomione runtime’owo do czasu spełnienia bramek X0/X0.5 i osobnych ticketów.

Global docs nie są plikami roboczymi Builderów. Builderzy pracują z ticketów. Integrator synchronizuje roadmapę po batchu merge'y.

## Source of truth

1. Aktualny kod na main.
2. Root README.
3. AGENTS.md.
4. Ten plik.
5. docs/tickets/**.
6. docs/strategy/OWNER-DECISIONS.md.
7. docs/specs/**.
8. docs/audit/**.
9. lane files.
10. blueprint.

## Current activation status

```txt
ACTIVE — X0 CONTROL PLANE PHASE
```

## Current active phase

Current active phase: X0.

Current owner next action: run/assign first X0 ticket: `docs/tickets/ready/X0-READY-001-r-phase-handoff-inventory.md`.

X1-X7 remain inactive until X0/X0.5 gates pass and owner/Integrator explicitly launches a specific ticket.

## Phase model

Model faz:

- R0-R11 — era refaktoru/fundamentów ze statusem HANDOFF_COMPLETE dla pracy Post-R.
- X0 — Control Plane & Truth Reconciliation.
- X0.5 — Product Standard & Research Synthesis.
- X1 — Payments / Patron Safety.
- X2 — Access / Patron Hard Reset.
- X3 — Video Provider Foundation.
- X4 — PlaybackPlan / Player Simplification.
- X5 — Admin Cockpit Foundation.
- X6 — Product Excellence Passes.
- X7 — Launch Readiness / Final Certification.

Current active phase: X0. Current owner next action: run/assign first X0 ticket: `docs/tickets/ready/X0-READY-001-r-phase-handoff-inventory.md`. X1-X7 remain inactive until X0/X0.5 gates pass and owner/Integrator explicitly launches a specific ticket.

## Phase goals

### R0-R11 — current foundation/refactor

R0-R11 mają status HANDOFF_COMPLETE dla potrzeb Post-R. Aktualna praca idzie przez X0.

### X0 — Control Plane & Truth Reconciliation

Make code/docs/guards/roadmap agree, activate control plane, establish ticket workflow.

### X0.5 — Product Standard & Research Synthesis

Turn DR-01-DR-10 into product standards, owner decisions, specs and seed backlog.

Outputs: active `docs/strategy/**` and `docs/specs/**`.

### X1 — Payments / Patron Safety

Payments/patron lifecycle before deeper access reset. Defaults: 10 PLN/USD/EUR/CHF admin-editable, permanent PatronGrant unless revoked/suspended.

### X2 — Access / Patron Hard Reset

Access uses active PatronGrant. User.isPatron ignored for backend access after migration. Clerk metadata UI/cache only. Subscription never access.

### X3 — Video Provider Foundation

Cloudflare first, Mux possible per VideoAsset, thin provider interface, direct uploads, provider webhooks, signed playback, no provider call on denial.

### X4 — PlaybackPlan / Player Simplification

Locked state no player, denied plan no token/source, tracking only real playback.

### X5 — Admin Cockpit Foundation

Access Diagnostics first, dashboard second, manual corrective actions audited, owner can support users without database.

### X6 — Product Excellence Passes

Player UX, comments UX, email UX, mobile, accessibility, copy, performance, admin usability, observability polish.

### X7 — Launch Readiness / Final Certification

Public launch gate: legal/privacy, accessibility, performance, security, backups, owner runbook, manual QA, final cert report.

## Ticket policy

No runtime work without active ticket. The active ready queue lives in `docs/tickets/ready/**`; the first owner action is `docs/tickets/ready/X0-READY-001-r-phase-handoff-inventory.md`. X1-X7 tickets are backlog entries and do not start runtime work until gates pass and owner/Integrator assigns them explicitly.

## Batch policy

Use `Parallel-Work-Matrix.md`. Default max 2 Builder agents. Up to 3 only for isolated docs/inventory/UI tasks after X0 stabilizes.

## Done means

A phase is not done until code, tests, docs, ticket movement, blocker register and certification report agree. Builder cannot certify a phase.
