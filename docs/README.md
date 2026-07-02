# Polutek.pl — dokumentacja produktu

Polutek.pl to jednokanałowa platforma VOD jednego twórcy. Widzowie oglądają
filmy (poziomy dostępu: PUBLIC / LOGGED_IN / PATRON), a jednorazowy napiwek
Stripe powyżej progu nadaje **dożywotni status patrona** (`PatronGrant`).
Brak subskrypcji cyklicznych, brak multi-tenant, brak marketplace.

**Punkt wejścia dla agentów AI i deweloperów: [`CLAUDE.md`](../CLAUDE.md)**
(stack, mapa modułów, krytyczne inwarianty, czego nie robić).

## Mapa dokumentacji

| Co | Gdzie |
|---|---|
| Przewodnik po kodzie, inwarianty, moduły | [`CLAUDE.md`](../CLAUDE.md) |
| Znane ograniczenia i sufit skalowalności | [`KNOWN_LIMITATIONS.md`](../KNOWN_LIMITATIONS.md) |
| Checklist wdrożeniowy | [`DEPLOY_CHECKLIST.md`](../DEPLOY_CHECKLIST.md) |
| Architektura i zapisy decyzji (ADR) | [`architecture/`](architecture/) |
| Specyfikacje funkcjonalności | [`specs/`](specs/) |
| Kontrakty API | [`API_CONTRACTS.md`](API_CONTRACTS.md) |
| Decyzje właścicielskie (produktowe) | [`strategy/`](strategy/) |
| Runbooki operacyjne (incydenty, backup, monitoring) | [`operations/`](operations/) |
| Runbook obserwowalności | [`OBSERVABILITY_RUNBOOK.md`](OBSERVABILITY_RUNBOOK.md) |
| Bramki bezpieczeństwa CI/release | [`SECURITY_GATES.md`](SECURITY_GATES.md) |
| Dowody produkcyjne przed launch | [`launch/production-evidence-runbook.md`](launch/production-evidence-runbook.md) |
| Polityki produktowe (np. usuwanie konta) | [`policies/`](policies/) |
| Aktualne audyty | [`audit/`](audit/) |
| Otwarte zadania | [`tickets/ready/`](tickets/ready/) |
| Archiwum (materiały historyczne) | [`archive/`](archive/) |

## Higiena dokumentacji

2026-07-02 usunięto ~240 historycznych plików procesu wieloagentowego
(raporty rekonsyliacyjne, zamknięte tickety, roadmapy refaktoryzacji,
protokoły ról). Historia jest w git — nie odtwarzaj tych struktur.
Zasady:

- Dokumentacja opisuje **stan obecny**, nie przebieg prac. Raporty z sesji
  AI nie trafiają do repo; trwałe wnioski trafiają do CLAUDE.md,
  KNOWN_LIMITATIONS.md albo audytu.
- Nowe zadanie = jeden plik w `tickets/ready/`; po wdrożeniu ticket się
  **usuwa** (commit message i PR są zapisem historii).
- Audyty starsze niż bieżący kwartał można usuwać, gdy ich wnioski są
  wchłonięte przez dokumenty żywe.
