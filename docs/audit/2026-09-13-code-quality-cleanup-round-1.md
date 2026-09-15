# Audyt jakości kodu i pierwsza runda porządkowania — 2026-09-13

Audyt wykonany przez czytanie kodu źródłowego (nie dokumentacji) w sześciu
niezależnych przebiegach równoległych, każdy skupiony na innym obszarze
modułowym z mapy w `CLAUDE.md` §3. Każde znalezisko poniżej zostało
zweryfikowane niezależnie (typecheck + pełny `vitest run` + sprawdzenie granic
architektury `npm run quality:architecture-boundaries`) przed wdrożeniem —
żadna zmiana nie trafiła do repo tylko na podstawie deklaracji "wszystko
działa" z pojedynczego przebiegu.

**To NIE jest kompletny audyt całego repozytorium.** Sześć przebiegów mapowania
pokryło: `payments`/`patron`/`access`, `playback`/`media`/webhooki, publiczny
UI (player/ChannelHome/Hero), panel admina (routing + CRUD), dokumentację i
kolejkę ticketów, oraz pozostałe moduły (`users`, `email`, `i18n`). To są
najważniejsze/najbardziej ryzykowne obszary, nie każdy plik w `app/` i `lib/`.
Sekcja 4 poniżej wprost wylicza, czego jeszcze nie sprawdzono.

---

## 1. Co znaleziono i naprawiono

### Bugi produkcyjne (nie tylko porządki)

- **`GetOrCreateUserUseCase`** (używany przez `GET /api/user/sync` i
  `POST /api/subscriptions`) był naiwnym, nietransakcyjnym upsertem bez
  obsługi kolizji e-maila. Ponieważ `User.email` jest `@unique`, kolizja nie
  cichła — rzucała `P2002`, czyli **500 przy każdej synchronizacji sesji**, a
  komentarze/płatności/granty patrona kolidującego użytkownika zostawały
  osierocone na starym koncie. Usunięty; oba callery idą teraz przez
  `getOrCreateCurrentUser()` (transakcyjny `syncUser`). Patrz `CLAUDE.md` §4.14.
- **`UserLanguageService`** (ścieżka akcji serwerowej zmiany języka) zawsze
  wysyłał `null` dla `name`/`username`/`imageUrl` do `UserRepository.update`,
  która te pola **nadpisuje** przy każdym wywołaniu — czyli **każda zmiana
  języka czyściła użytkownikowi wyświetlaną nazwę, username i avatar**.
  Usunięty; akcja serwerowa idzie teraz przez ten sam `updateUserLanguage`
  use-case co `PATCH /api/user/language`. Patrz `CLAUDE.md` §4.11.

### Wydajność / bezpieczeństwo

- `listAdminUsers` przy sortowaniu po dacie patrona (`patronSince`/
  `activeGrantSince`) ściągał **całą** przefiltrowaną tabelę `User` do pamięci
  i sortował w JS (Prisma nie ma `_min`/`_max` dla relacji to-many w
  `orderBy`). Zastąpione parametryzowanym `$queryRaw` z `LIMIT`/`OFFSET` na
  poziomie SQL.
- `findReports` (zgłoszenia komentarzy) nie miało żadnego `take`/`skip` —
  rosło bez ograniczeń. Dodana pełna paginacja (repo → use-case → route → UI).
- `getGatedMedia` nigdy nie sprawdzał `decision.hasAccess` — dla stanu
  LOGIN_REQUIRED/PATRON_REQUIRED nadal zwracał `ok({ videoUrl })`. Nie było to
  dziś eksploatowalne (jedyny caller i tak re-weryfikuje dostęp przed użyciem
  URL-a), ale kontrakt funkcji kłamał. Teraz sam fail-uje (`MediaAccessDeniedError`, 403).
- Mux: gdy podpisywanie nie jest skonfigurowane, tier PATRON był poprawnie
  blokowany, ale LOGGED_IN dostawał niepodpisany, wiecznie ważny URL —
  omijało to wymóg bycia zalogowanym przy przyszłych wizytach. LOGGED_IN
  dostał teraz tę samą twardą blokadę co PATRON (PUBLIC bez zmian, bo tam
  dostęp i tak jest bezwarunkowy).
- `NON_PATRONS` audiencja broadcastu maila była zapisywana w historii jako
  `ALL` (kosmetyczny błąd audytu, nie błąd doboru odbiorców — ten był
  poprawny) — dodana realna wartość enuma `NON_PATRONS` + migracja.
- Przy okazji: licznik zgłoszeń w `/admin/comments` czytał nieaktualny kształt
  odpowiedzi API i zawsze pokazywał `null`.

### Deduplikacja

- Klient Stripe (`new Stripe(...)`) budowany niezależnie w 7+ miejscach z
  niespójnym `apiVersion` → jeden `getStripeClient()` w
  `lib/modules/payments/infrastructure/stripe-client.ts`.
- Logika "zbuduj DTO statusu patrona z aktywnych grantów" powielona w 4
  miejscach (w tym 4× w jednym pliku) → jeden `buildPatronStatusDto()` w
  `lib/modules/patron/domain/patron-read-model.ts`.
- Checkout-plumbing (fetch limitów, stan modala, blokada scrolla, wywołanie
  `/api/checkout/create-intent`) potrojony w `DonationBox`/`SecretPledgeBox`/
  `SecretPledgeBox2` → jeden `lib/hooks/useCheckoutFlow.ts` (878 linii
  usuniętych netto), z zachowaniem różnic w prezentacji/copy każdego wariantu.
- Martwy kod usunięty: `ThreeCupsGame.tsx`, `ServiceWorkerRegistration.tsx`,
  `app/api/admin/creator/route.ts` (deprecated alias), `AccessDeniedError`
  (nigdy nierzucany).

### Testy

- Naprawiono 9 wcześniej istniejących, niezwiązanych z powyższym awarii
  testów (potwierdzone `git stash` na czystej bazie): 2 nieaktualne asercje
  (ścieżka pliku po refaktorze, rozmiar przycisku po świadomym redesignie
  kontrolek playera), 2 realne regresje dostępności przywrócone (brak
  ogłaszanego stanu ładowania komentarzy w `EmbeddedComments.tsx`), reszta —
  literalne asercje tekstu źródłowego, które się rozjechały z komponentem.
- Cały suite: **238/239 plików testowych, 1284/1286 testów — 0 awarii.**

### Dokumentacja

- `KNOWN_LIMITATIONS.md` fałszywie twierdziło, że Vitest ma wymuszone progi
  pokrycia — poprawione (progi nie istnieją, `vitest.config.ts` ich nie ma).
- `CLAUDE.md` miało nieaktualną wzmiankę o `CheckoutSummaryPanel.tsx`
  używającym `BrandName` (od dawna ma własny inline SVG) — poprawione.
- `CLAUDE.md` §4.11/§4.14 zaktualizowane o konsolidację user/language.

---

## 2. Zbadane i celowo NIE zmienione (z uzasadnieniem)

- **Podwójne bramkowanie zgody na broadcast e-mail** (`email.policy.ts`,
  wymóg aktywnej `Subscription` + `EmailPreference.marketingEmails` nawet dla
  audiencji PATRONS) — potwierdzone jako **celowa, udokumentowana** polityka
  (`docs/specs/EMAIL-COMMS-SPEC.md`: "Patron != subskrybent newslettera";
  `docs/strategy/OWNER-LAUNCH-DECISIONS-001.md` §F2). Maile transakcyjne
  (powitanie, podziękowanie za napiwek) idą inną, niezależną ścieżką przez
  `fulfillPayment()` i nie są tym objęte. Nie ruszać bez decyzji właściciela.
- **`AppPreloadProvider` mintuje sesje/tokeny odtwarzania z wyprzedzeniem**
  (do 3 "sąsiednich" filmów + film wybrany, zanim ktokolwiek kliknie play) —
  to prawdziwa nieefektywność (patrz ticket w sekcji 3), ale properowa
  naprawa wymaga rozbicia kontraktu `PlaybackService.createPlaybackPlanWithContext`
  na tani check dostępu vs. drogie mintowanie tokenu — zbyt duża zmiana
  API, żeby robić ją przy okazji audytu.

---

## 3. Nowe tickety w kolejce

Patrz `docs/tickets/ready/`:

- `VIDEO-PLAYBACK-SESSION-RETENTION-001.md` — brak retencji/czyszczenia
  `VideoPlaybackSession`, rośnie bez ograniczeń (znalezione przy audycie
  preloadera, patrz sekcja 2).
- `PRISMA-MIGRATION-TIMESTAMP-DEDUP-001.md` — dwie pary migracji z tym samym
  timestampem plus jedna faktyczna duplikacja tej samej kolumny; nieszkodliwe
  dziś (idempotentne `IF NOT EXISTS`), ale warte normalizacji.
- `MEDIA-DTO-SAFETY-ASSERTS-WIRING-001.md` — `assertPublicVideoDtoSafe`/
  `assertPublicMediaDescriptorSafe` w `media.policy.ts` istnieją i są
  testowane, ale nigdzie nie wywoływane w produkcyjnym kodzie budującym
  `PublicVideoDTO` — martwa siatka bezpieczeństwa.

---

## 4. Czego jeszcze NIE sprawdzono (mapa dla kolejnej rundy)

To jest najważniejsza sekcja dla każdego, kto kontynuuje tę pracę — nie
zaczynaj od zera, idź dalej stąd:

- **Cały panel admina poza routingiem API** — `/admin/videos/*`,
  `/admin/channel`, `/admin/settings`, `/admin/emails` jako strony/komponenty
  (dziś sprawdzono tylko warstwę `app/api/admin/`, nie UI tych stron).
- **Pełny audyt dostępności** — dziś naprawiono tylko to, co wypłynęło przy
  okazji (comments loading state, AccessLockOverlay). Nie było systematycznego
  przejścia WCAG 2.2 AA przez cały publiczny UI.
- **Spójność tokenów CSS/`--chan-*`** — znaleziono kilka literałów hex
  (`CheckoutSummaryPanel.tsx`, `LegalDocs.tsx`) przy okazji, ale nie było
  pełnego grepa całego `app/` pod kątem literalnych kolorów zamiast tokenów.
- **Higiena zależności** (`package.json`) — nieużywane pakiety, przestarzałe
  wersje, duplikaty funkcjonalności — nie badane w tej rundzie.
- **Pokrycie testami** — wiadomo, że nie ma wymuszonych progów (patrz
  `KNOWN_LIMITATIONS.md`), ale nie zmierzono realnego pokrycia ani nie
  zidentyfikowano modułów bez testów.
- **`app/[locale]/secretproject`/`secretproject2`** — moduł kampanii
  crowdfundingowej nie był częścią żadnego z sześciu przebiegów mapowania.
- **Performance/bundle size** — nie badane.
- **`docs/` poza `tickets/ready/`** — sprawdzono tylko `docs/README.md`,
  `KNOWN_LIMITATIONS.md` i wybrane fakty z `CLAUDE.md` przeciw kodowi; nie
  czytano całych `docs/architecture/`, `docs/specs/`, `docs/operations/` linia
  po linii pod kątem aktualności.

---

## 5. Metodologia (dla powtórzenia w kolejnych rundach)

1. Mapowanie: kilka równoległych, tylko-do-odczytu przebiegów, każdy na
   wąskim obszarze modułowym, z konkretnym zestawem pytań/inwariantów do
   zweryfikowania (nie ogólne "przejrzyj kod").
2. Priorytetyzacja: critical (realne bugi/bezpieczeństwo) → moderate
   (wydajność/spójność) → minor (kosmetyka) → do ticketu, jeśli zbyt duże na
   jedną poprawkę albo wymaga decyzji właściciela.
3. Wykonanie: agenty równoległe na obszarach bez nakładających się plików;
   ryzykowne/architektoniczne zmiany na modelu z większym budżetem
   rozumowania, mechaniczne na tańszym.
4. Weryfikacja PRZED każdym commitem, nigdy na słowo: `tsc --noEmit`, pełny
   `vitest run`, `npm run quality:architecture-boundaries`. Commit dopiero po
   samodzielnym potwierdzeniu, małymi logicznymi kawałkami.
5. Dokumentacja aktualizowana w tym samym kroku co kod (`CLAUDE.md`
   maintenance rule), nowe tickety zamiast trzymania backlogu tylko w
   pamięci sesji.
