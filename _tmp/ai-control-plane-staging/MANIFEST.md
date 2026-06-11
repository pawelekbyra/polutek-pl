# Manifest stagingu Post-R AI Delivery Control Plane

Status aktywacji:

```txt
STAGED ONLY — NIEAKTYWNE
```

Ten folder nie jest aktywnym źródłem prawdy, dopóki Integrator activation PR nie przeniesie/skopiuje go do docelowych ścieżek i nie zaktualizuje root `README.md`. Do tego czasu aktywnym źródłem prawdy pozostaje root `README.md` R-phase.

## Po co istnieje ten folder

`_tmp/ai-control-plane-staging/` zawiera gotowy do aktywacji szkic przyszłego systemu pracy AI dla Polutek.pl po zakończeniu R-phase. Jest to control plane dla pracy Plannerów, Builderów, Reviewerów, Integratorów i Certifierów.

Celem nie jest aktywowanie nowej roadmapy dzisiaj. Celem jest przygotowanie ścisłego, nudnego i operacyjnego systemu, który po R10/R11 handoff pozwoli właścicielowi uruchamiać małe tickety bez chaosu.

## Co jest staged

- `README.md` — przyszły krótki panel sterowania dla właściciela i agentów.
- `AGENTS.template.md` — przyszła treść root `AGENTS.md`; celowo nie nazywa się `AGENTS.md` w stagingu, żeby nie działała jako aktywne instrukcje agentów przed aktywacją.
- `docs/architecture/**` — target-only blueprint i decyzje architektoniczne.
- `docs/strategy/**` — synteza badań, decyzje właściciela, standard produktu, zakres launch i do-not-build.
- `docs/specs/**` — specyfikacje domenowe X1-X7.
- `docs/roadmap/**` — roadmapa aktywacyjna, timeline właściciela, workflow Codex, bramki jakości i launch readiness.
- `docs/roadmap/lanes/**` — lane'y domenowe i operacyjne.
- `docs/tickets/**` — kolejka ticketów staged-ready po aktywacji.
- `docs/reports/**` — miejsca raportów PR, review, reconciliation i certification.
- `docs/templates/**` — szablony ticketów, raportów, decyzji i promptów Codex.
- `docs/operations/**` — protokoły multi-agent, merge, review, integrator, certifier i manual właściciela.

## Root files affected at activation

Integrator activation PR, po R10/R11 handoff lub jawnej zgodzie właściciela, może:

1. Zamienić root `README.md` w krótki control panel.
2. Skopiować/zmienić nazwę `_tmp/ai-control-plane-staging/AGENTS.template.md` -> root `AGENTS.md`.
3. Przenieść/skopiować staged `docs/**` do docelowego root `docs/**`.
4. Ustawić `docs/roadmap/Active-Execution-Roadmap.md` jako aktywną kolejkę egzekucji.
5. Ustawić `docs/roadmap/OWNER-TIMELINE.md` jako dashboard właściciela.
6. Ustawić `docs/tickets/ready/` jako kolejkę dla Codex/Jules Builder agents.

## Bezpieczeństwo nazwy AGENTS

`AGENTS.template.md` jest przyszłą treścią root `AGENTS.md`. Jest celowo nazwany jako template, nie `AGENTS.md`, aby staging nie był interpretowany przez agentów jako aktywny kontrakt przed activation PR.

## Co blokuje aktywację

- R10/R11 handoff/certification albo jawna zgoda właściciela.
- Reconciliation aktualnego kodu, docs, auditów i guardów.
- Decyzja Integratora, że root README może zostać slimmed/replaced.
- Potwierdzenie, że staged docs nie udają aktualnej implementacji.
- Integrator activation PR z walidacją i raportem.

## Jak aktywować później

1. Uruchom ticket X0 activation checklist.
2. Zweryfikuj aktualny main, guardy, README i audity.
3. Otwórz osobny docs-only Integrator PR aktywacyjny.
4. Przenieś/skopiuj staged pliki do finalnych ścieżek.
5. Zaktualizuj root README na krótki control panel.
6. Oznacz staged folder jako migrated.
7. Dopiero po merge owner może uruchamiać Builderów z `docs/tickets/ready/`.

## Jak usunąć `_tmp` po aktywacji

Po aktywacji i certyfikacji X0 Integrator może usunąć `_tmp/ai-control-plane-staging/`, jeśli:

- wszystkie potrzebne pliki zostały przeniesione do finalnych ścieżek,
- root README nie wskazuje już stagingu jako źródła przyszłego control plane,
- certifier potwierdził brak utraconych plików,
- właściciel zaakceptował cleanup.

## Zakaz

Żaden Builder nie może traktować plików w tym folderze jako aktywnych ticketów przed aktywacją. Żaden agent nie może na ich podstawie zmieniać runtime bez osobnego aktywnego ticketu po aktywacji.
