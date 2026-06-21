# Reconciliation reports

Status: `ACTIVE — FINAL STABILIZATION CLOSEOUT IS CANONICAL`

Reconciliation reports explain how code, tests, docs, tickets and owner decisions aligned at a specific point in time. They are evidence, not certification by themselves.

## Jak czytać te raporty

- Historyczny raport zachowuje stan i walidację z czasu, w którym został napisany.
- Raport oznaczony jako superseded albo older baseline nie jest obecnym opisem runtime.
- Open/unmerged PR reports nie są current-main truth, dopóki nie zostaną zmergowane.
- Production/manual evidence musi być wskazane jawnie; lokalne testy i merged code nie są produkcyjną certyfikacją.
- Aktualny kod i testy na `main` są implementation truth.

## Current canonical closeout

- Finalny closeout po dużej stabilizacji: `docs/reports/reconciliation/POST-1026-FINAL-STABILIZATION-CLOSEOUT.md`.

## Obecne wejścia do projektu

- `README.md`
- `docs/PROJECT-STATE.md`
- `docs/MASTERPLAN.md`
- `docs/tickets/ready/README.md`
- `docs/roadmap/Launch-Execution-Backlog.md`

## Raporty historyczne / superseded dla obecnego statusu

Wcześniejsze raporty current-main/control-plane, w tym `POST-931-CI-SIGNAL-RESTORATION-RECONCILIATION.md`, `POST-929-EMERGENCY-CONTROL-PLANE-RECONCILIATION.md`, `DOCS-RECONCILE-001-CURRENT-MAIN-SOURCE-OF-TRUTH.md`, `DOCS-RECONCILE-002-CURRENT-MAIN.md` i `DOCS-RECONCILE-003-OPERATOR-EVIDENCE-STATUS-CORRECTION.md`, pozostają zachowane jako punktowe evidence. Nie wolno ich czytać jako aktualnej kolejki ani aktualnego runtime bez sprawdzenia nowszego closeoutu i aktualnego `main`.

## Domain index

| Domain | Aktualne źródło | Uwagi historyczne |
| --- | --- | --- |
| Current state / control plane | `POST-1026-FINAL-STABILIZATION-CLOSEOUT.md` + `docs/PROJECT-STATE.md` | POST-931 i starsze są historyczne. |
| Ready queue | `docs/tickets/ready/README.md` | Pojedyncze stare tickety nie są aktywne bez wskazania w README kolejki. |
| Masterplan / risk register | `docs/MASTERPLAN.md` | Historyczne risk IDs mogą być evidence, ale nie current queue. |
| Launch / operator evidence | `docs/roadmap/Launch-Execution-Backlog.md` | Nadal osobna ścieżka właścicielsko-operatorska. |
| X7 launch proof | `docs/roadmap/Launch-Execution-Backlog.md` | Launch certification nie jest claimowana przez merged code. |
