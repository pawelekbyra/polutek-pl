# Polutek.pl — dokumentacja produktu

Polutek.pl to jednokanałowa platforma VOD jednego twórcy. Widzowie oglądają
filmy (poziomy dostępu: PUBLIC / LOGGED_IN / PATRON), a od 2026-09-22 dostęp
do treści nigdy nie wymaga płatności — `PATRON` działa identycznie jak
`LOGGED_IN`, wystarczy darmowe konto. Wsparcie/napiwek Stripe jest w pełni
dobrowolne, nie nadaje żadnego dostępu ani benefitu; `PatronGrant` nadal
istnieje w kodzie (`fulfillPayment()` nadal go tworzy) wyłącznie jako
księgowość wsparcia/etykieta w adminie — nie jest już czytany przy
sprawdzaniu dostępu do wideo. Szczegóły i uzasadnienie: `CLAUDE.md` §4.1,
§4.4, §4.10. Brak subskrypcji cyklicznych, brak multi-tenant, brak
marketplace.

**Punkt wejścia dla agentów i deweloperów: [`CLAUDE.md`](../CLAUDE.md)**
(stack, mapa modułów, krytyczne inwarianty, czego nie robić).

## Stan obecny

- **2026-09-22 — model dostępu zmieniony na darmowy.** `checkVideoAccess()`
  już nie czyta `PatronGrant`/statusu patrona przy bramkowaniu wideo —
  `PATRON` i `LOGGED_IN` są traktowane identycznie, gość zawsze widzi
  `LOGIN_REQUIRED` (nigdy `PATRON_REQUIRED`). System `PatronGrant`/Stripe/
  `fulfillPayment()` fizycznie zostaje w kodzie pod spodem (nadal tworzy
  rekordy wsparcia, nadal jest jedynym źródłem prawdy dla tego, kto
  wspierał), ale przestał bramkować cokolwiek. Model biznesowy to teraz
  darowizna/napiwek bez świadczenia wzajemnego, zgodnie z aktualnym
  Regulaminem — nie sprzedaż dostępu. Zanim uwierzysz w opis "PatronGrant
  jako źródło prawdy dla dostępu" w starszych dokumentach w `specs/`,
  `architecture/` i `strategy/`, sprawdź `CLAUDE.md` §4.1/§4.4/§4.10 —
  to on jest aktualny; wiele z tamtych plików to zamrożone dokumenty
  "control plane" sprzed tej zmiany i opisują stary, płatny model.
- Legacy pola `User.isPatron`, `User.patronSince` i `User.patronSource`
  zostały usunięte ze schematu; `PatronGrant` pozostaje jedynym źródłem
  prawdy dla tego, kto kiedykolwiek wsparł kanał (do celów księgowych/
  diagnostycznych/e-mailowych), nawet jeśli już nie decyduje o dostępie.
- Publiczny frontend jest na Next.js 16/React 19, używa custom/headless Clerk
  auth UI, progressive app shell, in-memory preloadu (`AppPreloadProvider`) i
  jednego application-grade systemu VOD/PWA (Geist, neutralne powierzchnie,
  niebieskie akcje, bursztynowy patron). Nie ma osobnych tras ze skinami,
  blokującego splash/ENTER gate ani fullscreen transition przy zmianie filmu.
- Production launch nie jest certyfikowany samą dokumentacją ani zielonym CI;
  wymaga owner/legal/operator evidence, manualnego smoke testu i finalnej
  decyzji właściciela.
- Wykonywalne zadania kodowe żyją w `tickets/ready/`. Zakres legal/operator/
  evidence jest śledzony w GitHub issue #1269 i nie powinien być traktowany
  jako gotowa kolejka implementacyjna bez osobnych, małych ticketów.
- Historia prac żyje w git/PR/issue. Dokumenty żywe opisują stan obecny.

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
| Otwarte zadania kodowe | [`tickets/ready/`](tickets/ready/) |
| Archiwum (materiały historyczne) | [`archive/`](archive/) |

## Higiena dokumentacji

2026-07-02 usunięto ~240 historycznych plików procesu wieloagentowego
(raporty rekonsyliacyjne, zamknięte tickety, roadmapy refaktoryzacji,
protokoły ról). Historia jest w git — nie odtwarzaj tych struktur.
Zasady:

- Dokumentacja opisuje **stan obecny**, nie przebieg prac. Raporty z sesji
  agentów nie trafiają do repo; trwałe wnioski trafiają do CLAUDE.md,
  KNOWN_LIMITATIONS.md albo audytu.
- Nowe zadanie = jeden plik w `tickets/ready/`; po wdrożeniu ticket się
  **usuwa** (commit message i PR są zapisem historii).
- GitHub issue, które nie jest już aktualne po zmianach w kodzie, należy
  zaktualizować albo zamknąć zamiast trzymać jako pseudo-backlog.
- Audyty starsze niż bieżący kwartał można usuwać, gdy ich wnioski są
  wchłonięte przez dokumenty żywe.
