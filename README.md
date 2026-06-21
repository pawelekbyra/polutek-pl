# Polutek.pl

Polutek.pl to autorska platforma wideo i społecznościowa dla twórcy, który chce publikować treści, obsługiwać płatny dostęp, zarządzać kanałem i utrzymywać relację z odbiorcami we własnym produkcie.

Projekt zakończył główną fazę dużej stabilizacji/refaktoru. Repozytorium jest teraz prowadzone jak aktywny produkt właścicielski: kolejne zmiany powinny być małe, konkretne i robione przez normalne issue/PR.

## Co robi aplikacja

Polutek.pl łączy w jednej aplikacji:

- publiczną stronę główną i strony kanału;
- publikację i odtwarzanie wideo;
- treści publiczne oraz treści dla wspierających;
- płatności i obsługę dostępu patronów;
- komentarze i moderację;
- panel administracyjny dla twórcy;
- konfigurację kanału, wyróżnionych materiałów i list wideo;
- podstawowe przepływy email/support/unsubscribe;
- diagnostykę administracyjną pomagającą szybko znaleźć problemy runtime.

Celem projektu jest niezależna platforma dla twórcy: mniej zależności od cudzych algorytmów, większa kontrola nad treścią, płatnościami i społecznością.

## Aktualny status

Status: **aktywny produkt po dużej stabilizacji**

Fundamenty aplikacji są uporządkowane. Duża kolejka refaktoryzacyjna została zamknięta albo sprowadzona do normalnego utrzymania. Dalsze prace to przede wszystkim:

- drobne poprawki UX i treści;
- poprawki wykryte w użyciu;
- dopracowanie panelu admina;
- utrzymanie integracji z dostawcami;
- testy smoke przed większymi zmianami;
- rzeczy operacyjne, prawne i publikacyjne zależne od decyzji właściciela.

Te rzeczy nie oznaczają, że aplikacja jest „ciągle w refaktorze”. To normalne prace przy żywym produkcie.

## Główne ścieżki użytkownika

### Odwiedzający

Użytkownik może wejść na stronę, przeglądać publiczne materiały, otworzyć kanał twórcy, zobaczyć wideo i komentarze oraz zalogować się, gdy dana akcja tego wymaga.

### Wspierający

Zalogowany użytkownik może korzystać z dostępu wynikającego ze swojego statusu/płatności, oglądać materiały dostępne dla wspierających i uczestniczyć w społeczności.

### Administrator / twórca

Administrator może zarządzać filmami, kanałem, widocznością materiałów, komentarzami, stanem treści i diagnostyką. Uprawnienia administracyjne są oparte o stan w lokalnej bazie danych, a nie wyłącznie o zewnętrzne metadane dostawcy logowania.

## Najważniejsze obszary produktu

### Wideo i kanał

Aplikacja obsługuje strony kanału, publiczne i ograniczone materiały, wyróżnienia, listy wideo oraz panel administracyjny dla treści.

### Dostęp i płatności

Płatności oraz dostęp patronów są powiązane z lokalną prawdą aplikacji, dzięki czemu krytyczne decyzje nie zależą wyłącznie od zmiennych metadanych zewnętrznego providera.

### Komentarze i moderacja

Użytkownicy mogą komentować materiały, a administrator ma osobne ścieżki moderacji i obsługi zgłoszeń.

### Panel administracyjny

Panel admina służy do prowadzenia platformy: zarządzania wideo, kanałem, widocznością, diagnostyką i operacjami twórcy.

### Diagnostyka

Aplikacja ma bezpieczne komunikaty diagnostyczne dla wybranych ścieżek admina. Celem jest szybkie ustalenie problemu bez ujawniania sekretów, surowych błędów bazy danych albo danych dostawców.

## Stack technologiczny

- Next.js / React
- TypeScript
- Prisma
- PostgreSQL
- Clerk
- Stripe
- Resend
- Cloudflare / integracje wideo
- Vitest
- GitHub Actions
- Vercel

## Lokalny development

Instalacja zależności:

```bash
npm install
```

Wygenerowanie klienta Prisma:

```bash
npm run db:generate
```

Uruchomienie aplikacji lokalnie:

```bash
npm run dev
```

Sprawdzenie typów:

```bash
npm run typecheck
```

Lint:

```bash
npm run lint
```

Testy:

```bash
npm run test:coverage
```

Build:

```bash
npm run build
```

## Przydatne komendy

```bash
npm run dev
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run quality:hotspots
npm run quality:strict-escapes
npm run quality:architecture-boundaries
npm run test:integration:postgres
```

## Konfiguracja środowiska

Aplikacja wymaga konfiguracji dla:

- bazy danych;
- logowania;
- płatności;
- emaili;
- dostawcy mediów/wideo;
- adresu aplikacji;
- kont administracyjnych;
- podstawowej konfiguracji kanału i treści.

Szczegóły środowisk produkcyjnych są zarządzane poza README, w ustawieniach deploymentu i dokumentach operacyjnych.

## Dokumentacja

Najważniejsze wejścia do dokumentacji:

- `docs/PROJECT-STATE.md` — aktualny stan produktu i repozytorium;
- `docs/MASTERPLAN.md` — skrócony plan po zamknięciu dużego refaktoru;
- `docs/tickets/ready/README.md` — aktywna kolejka kodowa, jeśli istnieje;
- `docs/operations/` — checklisty operacyjne i publikacyjne;
- `docs/reports/reconciliation/` — historyczne raporty z dużej stabilizacji/refaktoru.

Historyczne raporty i tickety zostają w repozytorium jako ślad prac. Nie należy ich czytać jako dowodu, że projekt nadal jest w trybie kryzysowym.

## Model dalszej pracy

Nowe prace powinny być małe i konkretne:

1. znaleźć błąd albo usprawnienie;
2. opisać je krótkim issue/ticketem;
3. zrobić mały PR;
4. uruchomić pasujące checki;
5. zmergować po sprawdzeniu.

Duże refaktory i szerokie przepisywanie kodu powinny być wyjątkiem, nie domyślnym trybem pracy.

## Operacje i publikacja

Aplikacja może być rozwijana i poprawiana na bieżąco. Decyzje o szerszej publikacji, treściach, warstwie prawnej, konfiguracji dostawców i finalnym uruchomieniu są decyzjami właścicielskimi/operacyjnymi, a nie dowodem, że główny kodowy refaktor jest niedokończony.

## Licencja

Projekt prywatny / właścicielski.
