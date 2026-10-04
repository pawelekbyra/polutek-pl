# Stan prac

Jedyna lista otwartych prac. Aktualizuj ją w tym samym PR, który coś zamyka albo otwiera. Rzeczy
zrobionych tu nie trzymamy (są w git). Przed uznaniem punktu za otwarty sprawdź stan faktyczny
(`git log origin/main`, serwer, DNS).

Ostatnia aktualizacja: 2026-10-04.

## Decyzje właściciela, które obowiązują

- Serwis jest niekomercyjny: napiwek nic nie odblokowuje. `Payment` i `PatronGrant` zostają wyłącznie
  jako prywatna ewidencja właściciela („kto wpłacił”). Każda udana wpłata oznacza osobę jako patrona.
- Jedyne źródło wideo to własny HLS. Żadnych zewnętrznych dostawców wideo.
- Wszystko na jednym serwerze. Vercel jest odcięty (projekt wstrzymany, bez domen i bez repo).
- Podstawowa domena to `pawelperfect.com`. Nic nie może zależeć od `pawelperfect.pl`.
- Martwe tabele, kolumny i wartości enumów wolno usuwać migracją po backupie (najpierw kod przestaje
  ich używać, usunięcie w kolejnym wdrożeniu).
- Flagi `TEMP_*` mają zniknąć z kodu.
- Dotychczasowi użytkownicy, wpłaty i dane w bazie były testowe.
- Agenci weryfikują rozwiązania w internecie; audyty i naprawy robią agenci na Opusie, sesja główna
  koordynuje.

- **Język (2026-10-04):** wykrywany automatycznie (zapisany wybór konta, cookie `app-language`, nagłówki przeglądarki/kraj, domyślnie angielski). Zmiana wyboru zapisuje się w cookie (niezalogowany) albo w koncie przy każdej zmianie (zalogowany). **Zrobione** w gałęzi `feat/language-detect-remove-temp` (flaga `TEMP_FORCE_ENGLISH` usunięta; kraj tylko PL → polski, CLAUDE.md §4.11).
- **Dzwonek powiadomień** (2026-10-04): usunąć (UI i flaga `TEMP_HIDE_NOTIFICATIONS_BELL`); podsystem powiadomień w bazie na później. **Zrobione** w `feat/language-detect-remove-temp` (też zakładka powiadomień w oknie konta i publiczne `/api/notifications`, `/api/user/notification-preferences`; tabele i API admina zostają).
- **Poziom dostępu `PATRON`** (2026-10-04): uprościć do dwóch poziomów (publiczny, po zalogowaniu); film z `PATRON` przechodzi na `LOGGED_IN`, wartość enuma usuwana w migracji czyszczącej. **Zrobione w kodzie** w `feat/language-detect-remove-temp` (migracja danych `20261004230000_video_tier_patron_to_logged_in` wchodzi przy wdrożeniu; wartość `AccessTier.PATRON` do usunięcia osobną migracją czyszczącą po wdrożeniu).
- **Pasek zbiórki:** zostaje ręcznie ustawiany (decyzja 2026-10-04).
- **Resend:** zostaje jedynym nadawcą do czasu własnej poczty; plan Pro dopiero przy starcie publicznym. Nowa domena ma słabą reputację u Hotmaila (maile w spamie).
- **Polityka prywatności** (2026-10-04): przepisać na krótką, zrozumiałą, zawierającą tylko to, co wymaga prawo (jak Regulamin); przed startem przegląd prawnika.
- **Odprawa dzienna** (2026-10-04): bez autonomicznego agenta AI na serwerze. Właściciel pyta Claude Code
  „co słychać?”, Claude uruchamia `scripts/ops/briefing.mjs` (tylko odczyt, [`DAILY-BRIEFING.md`](DAILY-BRIEFING.md)),
  a działania wykonuje dopiero po zgodzie właściciela w czacie.
- **Panel administratora** (2026-10-04): niezależna aplikacja na `admin.pawelperfect.com` z bogatą analityką i obserwowalnością (odwraca decyzję z 2026-09-30 o odłożeniu). Wizja, decyzje, fazy budowy i 12 pytań do właściciela: [`architecture/admin-panel.md`](../architecture/admin-panel.md). Wszystkie 12 decyzji według rekomendacji, z wyjątkiem: nic za pieniądze (bez Workers Paid, Resend Pro, kluczy sprzętowych), inne projekty Cloudflare zostają, przed startem fazy 0–1 + poprawki starego panelu. Faza 1 (`apps/admin`: powłoka, logowanie passkey + Access, „Dzisiaj”, „System”) jest w kodzie, czeka na wdrożenie: kroki w [`ADMIN-PANEL.md`](ADMIN-PANEL.md) rozdz. 1 (Access, tunel, `admin.env`, `admin-enroll` z właścicielem).
## Czeka na właściciela

1. **Baza Neon `NEON-krau`** (stara kopia danych testowych): usunąć w panelu Vercel → Storage →
   `NEON-krau` → Delete. Agent nie może (blokada na nieodwracalne usunięcia). W tym samym miejscu są
   `upstashpolutek` (zastąpiony lokalnym Redisem) i `BLOB-krau` (patrz punkt o miniaturach niżej).
2. **Domena `pawelperfect.pl`**: wygasła 2026-10-03, do przywrócenia w home.pl do 2026-11-02. Do tego
   czasu nie działają przekierowania z `.pl` (reguła w Cloudflare jest gotowa) i poczta na `@pawelperfect.pl`.
3. **Start publiczny (decyzja 2026-10-04):** do startu zostaje obecny serwer CPX22. Przy starcie
   właściciel włącza Workers Paid (5 USD/mies.; na planie darmowym po 100 tys. żądań dziennie wideo
   nie działa do północy UTC) i powiększa serwer. Opcje (ceny Hetznera od 15.06.2026, netto):
   CX43 8 vCPU/16 GB 15,99 €, CPX32 4 vCPU/8 GB 35,49 €, dedykowany EX44 14 rdzeni/64 GB 57,30 €.
   Zmiana rozmiaru w trybie „CPU i RAM” (bez dysku), żeby dało się wrócić.
4. **2FA dla kont administratora**: żadne z 4 kont admina nie ma 2FA. `ADMIN_EMAILS` jest na produkcji
   pusty (pomiar 2026-10-04). `hello@` usunięty z polityki Access 2026-10-04 (SERWEREK.md §4). Zostaje dla
   właściciela: włączyć TOTP albo passkey na swoich kontach (strona, Cloudflare, GitHub, Google, Resend, Stripe,
   PP Support) i zdecydować, z których kont admina zdjąć rolę (agent nie robi ad-hoc UPDATE na produkcji).
   Kroki: `architecture/admin-panel.md`, faza 0.
5. **Logowanie Google**: klient OAuth leży w projekcie organizacji Google Workspace. Przed anulowaniem
   Workspace trzeba go przenieść na konto osobiste (`GOOGLE_ACCESS.md`, sekcja „Move the OAuth client”),
   potem agent podmienia `GOOGLE_CLIENT_ID/SECRET` na serwerze.
6. **Anulowanie Google Workspace** (po punkcie 5, ok. 2026-10-09).
7. **Analityka bez zgody (pytanie do prawnika, 2026-10-04):** wytyczne EDPB 2/2023 traktują beacon bez cookies jako
   „dostęp do urządzenia” (art. 5(3) ePrivacy), a art. 399 PKE nie ma wyjątku dla analityki. Statystyki są minimalne,
   anonimowe i opisane w polityce, z wyłącznikiem `TELEMETRY_BEACON=off` (`architecture/admin-telemetry.md` §1).
   Przed startem publicznym prawnik ocenia, czy zostają bez zgody.
8. **Decyzje produktowe z audytów, które jeszcze czekają:** retencja danych (jak długo trzymać oryginały wideo, telemetrię, logi), wymogi prawne z `audit-legal-privacy.md` (polityka prywatności w toku, reklamacje i DSA w regulaminie).

## W toku (gałęzie agentów, każda kończy się PR-em)

| Gałąź | Zakres |
|---|---|
| `fix/payments-audit` | księgowanie wpłat, webhook Stripe, usunięcie starego boxa napiwków i flagi `TEMP_SUPPORT_AS_MODAL` |
| `fix/comments-audit` | odpowiedzi w wątkach, usuwanie/przywracanie, zgłoszenia, odstępy w sekcji komentarzy |
| `fix/hls-audit` | hls.js lokalnie, szybki start, napisy, HDR, drabinka jakości, odświeżanie tokenu |
| `fix/security-auth-audit` | zmiana e-maila, formularze logowania, onboarding, reszta CSP, resztki Clerka |
| `fix/email-audit` | szablony (jedno źródło prawdy), wypis jednym kliknięciem, webhook Resend, kolejka rozsyłek |
| `feat/admin-phase0-telemetry` | panel admina, faza 0: schemat `telemetry`, `pp-collector`, beacon (odsłony, Web Vitals, jakość odtwarzania), polityka prywatności 2026-10-05; po wdrożeniu włączyć `scripts/serwerek/telemetry-enable.sh` (SERWEREK.md §22) |
| `feat/admin-phase0-ops` | faza 0, operacje: kopie (age, bucket lock, test odtworzenia, alerty), `pg_stat_statements`, obrazy z GHCR, strażnik `pp-watchdog`; zmiany na serwerze już wykonane (SERWEREK.md §23–25) |
| `feat/daily-briefing` | dzienna odprawa „co słychać?” (skrypt tylko do odczytu + skill `odprawa`); następny krok: skrypty działań z audytem (odpowiedź-szkic, ukrycie komentarza, zwrot) uruchamiane po zgodzie właściciela |
| `feat/passkey-first-signup` | „Użyj klucza dostępu” zakłada konto jak Google (logowanie kluczem jest już na main); po wdrożeniu właściciel dodaje klucz na telefonie i komputerze (też jako 2. czynnik dla admina, punkt 4) |

## Do zrobienia (kolejność proponowana)

1. Przejrzeć, scalić i wdrożyć pięć gałęzi powyżej; po każdej sprawdzić stronę na żywo.
2. Jedna prawdziwa wpłata testowa po wdrożeniu płatności (w bazie nie ma żadnej płatności `SUCCEEDED`,
   a `StripeEvent` jest pusty: trzeba potwierdzić, że webhook dochodzi).
3. Dokończyć trzy przerwane audyty: martwy kod i architektura, panel admina, strona główna.
4. Naprawy z raportów, których jeszcze nikt nie ruszył: `audit-frontend.md`, `audit-loading.md`
   (cel: strona gotowa od razu, bez szkieletów), `audit-style.md` (poza komentarzami), `audit-tests.md`
   (prawdziwy Postgres w testach, martwe i kruche testy, CI), `audit-ops.md`, `audit-legal-privacy.md`.
5. Migracja czyszcząca bazę według `audit-database.md` (martwe tabele dostawców wideo, `ClerkEvent`,
   `CommentLike`/`CommentDislike`, martwe kolumny i wartości enumów), potem squash migracji.
6. ~~Usunięcie dwóch pozostałych flag~~: zrobione w `feat/language-detect-remove-temp` (rejestr TEMP pusty).
7. Nowy, krótki `CLAUDE.md` opisujący wyłącznie stan obecny (po scaleniu gałęzi z punktu 1).
8. Przepisać `SERWEREK.md` do stanu faktycznego (audyt operacji znalazł 21 rozbieżności). `backup.sh`, `health.sh`,
   `docker-compose.override.yml` są już w repo (`scripts/serwerek/`, `deploy/serwerek/`, gałąź `feat/admin-phase0-ops`).
9. Usuwanie użytkownika i zmiana roli ADMIN: w nowym panelu to ekran „Społeczność → użytkownik”; stary panel
   (`/admin/users/[userId]`, „Rola i uprawnienia” i „Strefa zagrożenia”) dostał je tymczasowo.

## Operacje (z `audit-ops.md`)

- Baza: kopia raz na dobę (do 24 h utraty danych); częstsze zrzuty albo archiwizacja WAL do R2.
- Oryginały wideo i HLS w R2 bez kopii i bez blokady usuwania.
- Obrazy: workflow `images.yml` + `IMAGE_SOURCE=ghcr ./deploy.sh` gotowe (SERWEREK.md §24); brakuje tokenu
  `read:packages` na serwerze (właściciel) i pierwszego wdrożenia z GHCR. Limit minut Actions prywatnego repo
  do sprawdzenia przez właściciela (agent nie ma uprawnień do rozliczeń).
- Rotacja logów kontenerów, twardsze ustawienia kontenerów, osobna rola bazy bez uprawnień superusera.
- Deploy restartuje koder w trakcie kodowania (kodowanie zaczyna od zera).
- Na serwerze do usunięcia: martwe zmienne `MUX_*` w `app.env`, usługa `serwerek-placeholder` i wpisy
  tunelu `test.` oraz `apptest.`.
- DNS do usunięcia: rekordy Clerka w obu strefach.
- Jedna miniatura (`dla-patronow`) nadal idzie przez proxy ze starego Vercel Blob: przenieść do R2,
  potem usunąć `BLOB_READ_WRITE_TOKEN` i `@vercel/blob`.
- Około 230 zdalnych gałęzi bez scalonego PR-a: do przejrzenia i skasowania.

## Pomysły na później (koncepty, nie budujemy teraz)

- **Tłumaczenia filmów i tłumacze w grupie** (decyzja 2026-10-04: koncept zatwierdzony, wracamy po fazie 2–3 panelu): [`architecture/translations-concept.md`](../architecture/translations-concept.md).
- **Krótkie adresy filmów z nazwą w danym języku** bez maskowania adresu: wstrzymane decyzją właściciela (2026-10-04); opcja docelowa to `/pl/<nazwa>` i `/en/<name>` z historią nazw (patrz koncept tłumaczeń).
- **Płatności krypto** (placeholder „Crypto” w bramce napiwkowej): Stripe stablecoin (jeśli dostępny w Polsce) albo BTCPay Server po powiększeniu serwera; wymaga uogólnienia modelu `Payment` i konsultacji podatkowej.
- **Funkcje AI w stronie/panelu** (np. pierwszy filtr komentarzy): odłożone; start od Workers AI, odprawę robi Claude Code na żywo (`operations/DAILY-BRIEFING.md`).

## GitHub Actions: limit wyczerpany (2026-10-04)

Od ok. 17:33 CI na GitHubie nie startuje („recent account payments have failed or your spending limit needs to be increased”): limit minut prywatnego repo zjedzony w kilka dni przez PR-y agentów. Decyzja właściciela: **bez płacenia, tryb lokalny**: przed scaleniem testy, typecheck i lint uruchamiane lokalnie, `SKIP_CI=1 scripts/ops/mergedeploy.sh ...` pomija czekanie na CI GitHuba. Alternatywa: podnieść limit wydatków w GitHub (Settings, Billing and plans). Minuty zużywa też workflow obrazów GHCR.

## Pozostałe

- Dostarczalność do Hotmaila: retest na świeżym koncie, Google Postmaster Tools; DMARC stoi na `p=none`.
- PP Support: właściciel włącza 2FA na swoim koncie; testowe rozmowy do usunięcia.
- Tłumaczenia DE/ES/FR/IT/PT/ZH to makiety.
