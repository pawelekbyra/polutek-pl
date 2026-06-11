# Active Execution Roadmap — staged Post-R

Status aktywacji:

```txt
STAGED ONLY — NIEAKTYWNE
```

Ten folder nie jest aktywnym źródłem prawdy, dopóki Integrator activation PR nie przeniesie/skopiuje go do docelowych ścieżek i nie zaktualizuje root `README.md`. Do tego czasu aktywnym źródłem prawdy pozostaje root `README.md` R-phase.

## Operating principle

Ten dokument stanie się aktywną kolejką egzekucji dopiero po R-phase handoff/certification albo jawnej zgodzie właściciela oraz Integrator activation PR.

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
STAGED ONLY — X PHASES NOT ACTIVE
```

## Phase model

Model faz:

- R0-R11 — aktualna era refaktoru/fundamentów, aktywna do zakończenia i certyfikacji.
- X0 — Control Plane & Truth Reconciliation.
- X0.5 — Product Standard & Research Synthesis.
- X1 — Payments / Patron Safety.
- X2 — Access / Patron Hard Reset.
- X3 — Video Provider Foundation.
- X4 — PlaybackPlan / Player Simplification.
- X5 — Admin Cockpit Foundation.
- X6 — Product Excellence Passes.
- X7 — Launch Readiness / Final Certification.

Fazy X nie mogą stać się aktywne przed zatwierdzonym R-phase handoff albo jawną zgodą właściciela.

## Phase goals

### R0-R11 — current foundation/refactor

Aktywne do czasu zakończenia/certyfikacji. Ten staged control plane nie zmienia statusów R.

### X0 — Control Plane & Truth Reconciliation

Make code/docs/guards/roadmap agree, activate control plane, establish ticket workflow.

### X0.5 — Product Standard & Research Synthesis

Turn DR-01-DR-10 into product standards, owner decisions, specs and seed backlog.

Outputs: `docs/strategy/**` and `docs/specs/**` listed in staging.

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

No runtime work without active ticket. Initial staged tickets are `READY_AFTER_CONTROL_PLANE_ACTIVATION`, not active today.

## Batch policy

Use `Parallel-Work-Matrix.md`. Default max 2 Builder agents. Up to 3 only for isolated docs/inventory/UI tasks after X0 stabilizes.

## Done means

A phase is not done until code, tests, docs, ticket movement, blocker register and certification report agree. Builder cannot certify a phase.
