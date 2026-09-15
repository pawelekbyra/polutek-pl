# Audyt jakości kodu — runda 3 — 2026-09-13/14

Kontynuacja `docs/audit/2026-09-13-code-quality-cleanup-round-1.md` (runda 1)
i drugiej rundy (opisanej w commitach tego samego dnia, bez osobnego pliku —
patrz historia git od commita usuwającego martwy kod po naprawę checkoutu).
Ta runda celowała w obszary jawnie wylistowane w sekcji 4 audytu rundy 1 jako
"jeszcze nie sprawdzone": pełny UI panelu admina, resztę modułów `lib/`,
dostępność poza głównym shellem, spójność tokenów CSS, higienę zależności,
realny pomiar pokrycia testami, i wydajność/bundle size.

Ta sama dyscyplina co poprzednio: każda zmiana zweryfikowana niezależnie
(`tsc --noEmit` + pełny `vitest run`) przed commitem, małe logiczne commity,
tickety zamiast pamięciowego backlogu dla rzeczy wymagających decyzji
właściciela albo większego nakładu niż jedna runda.

---

## 1. Co znaleziono i naprawiono

### Bugi i realne problemy

- **`/nakladki`** — niedokumentowana, nietknięta od miesiąca galeria
  porównawcza 8 stylów `AccessLockOverlay`, oznaczona w kodzie jako
  `TEMPORARY`. Na decyzję właściciela: usunięta wraz z trzema haczykami
  w `middleware.ts`.
- **Krytyczny bug w seedowaniu maili**: `scripts/ensure-welcome-template.ts`
  i `scripts/ensure-required-emails.ts` obie "zapewniały" istnienie
  szablonu `welcome-email`, ale z różnym kształtem — pierwsza zostawiała
  `isSystem` na domyślnym `false`. Jeśli uruchomiona pierwsza, kanoniczny
  szablon systemowy stawał się usuwalny z panelu admina (omijając
  zabezpieczenie `deleteEmailTemplate` przed usunięciem systemowych
  szablonów). Usunięto zbędny, wadliwy skrypt-duplikat.
- **Podwójny fetch na stronie głównej** (największe znalezisko wydajnościowe):
  `SidebarPlaylist` montuje się dwukrotnie (mobile + desktop, zgodnie z
  udokumentowanym "always-mounted" fixem), a każda instancja niezależnie
  odpytuje `/api/channel/sidebar` — podwaja obciążenie bazy na stronie już
  oznaczonej w `KNOWN_LIMITATIONS.md` jako wąskie gardło skalowalności.
  **Naprawione 2026-09-14** (współdzielone żądanie in-flight w
  `app/components/channel/sidebar-layout-request.ts`) — szczegóły i
  zachowane inwarianty: sekcja 3.
- **Dwie krytyczne poprawki dostępności w żywym checkoucie** (z rundy
  poprzedzającej tę, ale część tej samej fali): `CheckoutModal` nie miał
  semantyki dialogu/pułapki fokusu/Escape; pole kwoty napiwku miało
  całkowicie niewidoczny fokus klawiatury.
- Sześć bugów w panelu admina: zawieszający się stan zapisywania w
  ustawieniach kanału, mylący licznik zgłoszeń, brak paginacji głównej
  listy komentarzy, brakujące `aria-label`, akcje niewidoczne dla
  klawiatury (hover-only), nieaktualna dokumentacja o `AdminLayoutShell`.

### Bezpieczeństwo/dokumentacja

- CSP: `'unsafe-inline'`/`'unsafe-eval'` budowane przez konkatenację
  stringów (`'un' + 'safe'`) zamiast literałów — ukrywało to realną,
  stałą słabość CSP przed grep-based przeglądami bezpieczeństwa.
  Zapisane teraz wprost (sama polityka CSP niezmieniona).
- 8 dokumentów opisywało `User.isPatron` jako istniejące pole (usunięte
  w migracji `20260630000000`) — w tym runbook incydentowy, który
  dosłownie kazał "ustawić `User.isPatron = false`", co jest dziś
  fizycznie niewykonalne. Poprawione na realną akcję (`revokePatron()`).
- Niespójne listy walut w dwóch dokumentach architektury (brakowało
  CHF/GBP) — ujednolicone do realnej listy 5 walut z `lib/constants.ts`.
- Martwe odniesienia w `Owner-Operating-Manual.md` i
  `legal-privacy-terms-publication-checklist.md` do nieistniejących
  plików — poprawione.
- Nieaktualny opis UI w smoke teście uploadu do Cloudflare — zaktualizowany
  do obecnego modelu strategii dystrybucji.

### Deduplikacja / porządki

- `checkVideoAccess` przestał reimplementować inline logikę już
  zakodowaną w `MainChannelPolicy.isVideoOnMainChannel`/
  `isPublicMainChannel`.
- `check-health.use-case.ts` przełączony z `@deprecated getMainChannel`
  na `MainChannelService.getOptional`.
- Martwy kod usunięty: `PatronNotFoundError`, `PatronPolicy.
  shouldPreservePatronSince`, `AccessDecisionReason.ADMIN_REQUIRED`,
  `RevokePatronInput.revokedByUserId` (przyjmowane, ale nigdzie nieczytane).
- 6 nieużywanych pakietów `@radix-ui` + `react-icons` usunięte z
  `package.json` (uwaga: `media-icons` **wyglądał** na nieużywany wg grepa
  po źródłach, ale `@vidstack/react`'s skompilowany bundle importuje go
  bezpośrednio — usunięcie złapane przez testy, przywrócone; realna
  zależność, nie martwy kod).
- `@types/node` podbite z `^20.0.0` do `^22.20.2` (zgodnie z
  `engines.node: 22.x`).
- Literały hex zamienione na tokeny `--chan-*` w 7 plikach (CheckoutSummaryPanel,
  LegalDocs, HomeExperience, komponenty komentarzy, strona unsubscribe,
  admin user-detail tabs).
- Brakujące `loading.tsx` dodane dla 3 tras admina (comments, comments/
  reports, notifications) — wcześniej pokazywały pustą stronę podczas
  montowania zamiast natychmiastowego skeletonu.
- Dwie niezależne, rozjeżdżające się reimplementacje `cn()` (bez
  `tailwind-merge`) zastąpione współdzielonym importem.
- Zmierzone realne pokrycie testami po raz pierwszy: 57-63%
  (statements/branches/functions/lines) w zakresie `app/api`,
  `lib/modules`, `lib/services`, `lib/api`, `lib/webhooks`. Sama
  konfiguracja miała błąd (`lib/access/**` nie istnieje jako katalog;
  `lib/auth-utils.ts`/`lib/api/**` — realny gatekeeper autoryzacji admina
  — w ogóle nie były mierzone) — naprawiona.

---

## 2. Nowe tickety w kolejce (7 dodanych w tej rundzie)

Patrz `docs/tickets/ready/`:

- `AUDIT-LOG-INDEX-001` — brakujący indeks DB, wymaga migracji.
- `ADMIN-DESIGN-SYSTEM-CONSISTENCY-001` — batch drobnych niespójności
  wizualnych panelu admina (stat-tile x4, nagłówki x4, zakładki, ikony,
  puste/loading states, tabele).
- `COMMENT-LIST-MEMOIZATION-001` — moderate finding wydajnościowy.
- `TEST-COVERAGE-PAYMENTS-GAPS-001` — realne dziury pokrycia na
  refundach/sporach/route'ach płatności (0% na kilku wysokokonsekwencyjnych
  plikach).
- Rozszerzono istniejący `ADMIN-EMAILS-VISUAL-DRIFT-001` o
  `/admin/notifications` (ten sam dryf wizualny co `/admin/emails`).

---

## 3. Niedokończone w tej rundzie

- **Dedup podwójnego fetchu `SidebarPlaylist`** (task #28 wewnętrznego
  trackera) — zlecone dedykowanemu agentowi z pełnym kontekstem, dwukrotnie
  przerwane limitem sesji zanim zdążyło wykonać realną pracę (żadnych
  zmian w plikach). To najcenniejsze pozostałe znalezisko tej rundy —
  potraktować priorytetowo w kolejnej sesji. Kontekst: `ChannelHome.tsx`
  renderuje `SidebarPlaylist` dwa razy (mobile+desktop, oba always-mounted
  per udokumentowany fix), każda instancja robi własny fetch
  `/api/channel/sidebar`. Trzeba zdedupować fetch bez cofania
  always-mounted pattern ani łamania mobile tab handoff/`#donations` fixów.

  **Uzupełnienie 2026-09-14 — zrobione.** Nowy moduł
  `app/components/channel/sidebar-layout-request.ts`: mapa **wyłącznie
  trwających** żądań, kluczowana tożsamością widza; drugi mount dołącza do
  żądania pierwszego zamiast wysyłać własne. Wpis znika w momencie
  rozstrzygnięcia żądania (to nie jest cache wyniku), więc zmiana stanu
  auth zawsze pobiera dane od nowa — zero ryzyka pokazania cudzego stanu
  blokad. Abort zachowany przez licznik subskrybentów (odpala się dopiero
  gdy odłączy się ostatni). `ChannelHome.tsx` nietknięty, więc
  always-mounted, `getVisibleDonationsElement()` i mobile tab handoff bez
  zmian. Testy: `tests/unit/components/channel/SidebarPlaylist-shared-fetch.test.tsx`
  (zweryfikowane, że padają na kodzie sprzed fixu: 2 fetche zamiast 1).

## 4. Czego wciąż NIE sprawdzono

Aktualizacja listy z rundy 1 — to zostało zamknięte w tej rundzie: pełny UI
admina (wizualnie i funkcjonalnie), pozostałe moduły `lib/`, dostępność
poza checkoutem, częściowy sweep CSS, higiena zależności, realne pokrycie
testami, wydajność/bundle. Wciąż otwarte:

- **Realne pisanie testów** dla luk znalezionych w `TEST-COVERAGE-PAYMENTS-GAPS-001`
  — sam pomiar jest zrobiony, testy jeszcze nie napisane.
- **Wykonanie** dwóch dużych ticketów projektowych (`ADMIN-EMAILS-VISUAL-DRIFT-001`,
  `ADMIN-LIST-SCAFFOLD-CONSOLIDATION-001`, `ADMIN-DESIGN-SYSTEM-CONSISTENCY-001`)
  — to realna budowa, nie audyt; czeka na decyzję właściciela o zakresie.
- **`docs/` poza tym, co już sprawdzono** — `docs/architecture/`,
  `docs/specs/`, `docs/operations/` zostały przejrzane pod kątem
  konkretnych, cytowanych faktów (patrz sekcja 1), ale nie linia-po-linii
  w całości.
- **Bundle analyzer** — rekomendowany, nieskonfigurowany; żadne twierdzenie
  o rozmiarze bundla nie jest dziś zweryfikowane realnymi liczbami.
- **Migracje Prisma** — `PRISMA-MIGRATION-TIMESTAMP-DEDUP-001` (z rundy 1)
  wciąż czeka, nie tknięte w tej rundzie.
