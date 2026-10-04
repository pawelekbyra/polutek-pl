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

- **Język (2026-10-04):** wykrywany automatycznie (zapisany wybór konta, cookie `app-language`, nagłówki przeglądarki/kraj, domyślnie angielski). Zmiana wyboru zapisuje się w cookie (niezalogowany) albo w koncie przy każdej zmianie (zalogowany). Flaga `TEMP_FORCE_ENGLISH` do usunięcia.
- **Dzwonek powiadomień** (2026-10-04): usunąć (UI i flaga `TEMP_HIDE_NOTIFICATIONS_BELL`); podsystem powiadomień w bazie na później.
- **Poziom dostępu `PATRON`** (2026-10-04): uprościć do dwóch poziomów (publiczny, po zalogowaniu); film z `PATRON` przechodzi na `LOGGED_IN`, wartość enuma usuwana w migracji czyszczącej.
- **Pasek zbiórki:** zostaje ręcznie ustawiany (decyzja 2026-10-04).
- **Resend:** zostaje jedynym nadawcą do czasu własnej poczty; plan Pro dopiero przy starcie publicznym. Nowa domena ma słabą reputację u Hotmaila (maile w spamie).
- **Polityka prywatności** (2026-10-04): przepisać na krótką, zrozumiałą, zawierającą tylko to, co wymaga prawo (jak Regulamin); przed startem przegląd prawnika.
- **Panel administratora** (2026-10-04): niezależna aplikacja na `admin.pawelperfect.com` z bogatą analityką i obserwowalnością; trwa faza badań i projektu (odwraca decyzję z 2026-09-30 o odłożeniu).
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
4. **2FA dla kont administratora**: żadne z 4 kont admina nie ma 2FA; adres `hello@` jest na liście
   `ADMIN_EMAILS`, a jego poczta trafia do PP Support.
5. **Logowanie Google**: klient OAuth leży w projekcie organizacji Google Workspace. Przed anulowaniem
   Workspace trzeba go przenieść na konto osobiste (`GOOGLE_ACCESS.md`, sekcja „Move the OAuth client”),
   potem agent podmienia `GOOGLE_CLIENT_ID/SECRET` na serwerze.
6. **Anulowanie Google Workspace** (po punkcie 5, ok. 2026-10-09).
7. **Decyzje produktowe z audytów, które jeszcze czekają:** retencja danych (jak długo trzymać oryginały wideo, telemetrię, logi), wymogi prawne z `audit-legal-privacy.md` (polityka prywatności w toku, reklamacje i DSA w regulaminie).

## W toku (gałęzie agentów, każda kończy się PR-em)

| Gałąź | Zakres |
|---|---|
| `fix/payments-audit` | księgowanie wpłat, webhook Stripe, usunięcie starego boxa napiwków i flagi `TEMP_SUPPORT_AS_MODAL` |
| `fix/comments-audit` | odpowiedzi w wątkach, usuwanie/przywracanie, zgłoszenia, odstępy w sekcji komentarzy |
| `fix/hls-audit` | hls.js lokalnie, szybki start, napisy, HDR, drabinka jakości, odświeżanie tokenu |
| `fix/security-auth-audit` | zmiana e-maila, formularze logowania, onboarding, reszta CSP, resztki Clerka |
| `fix/email-audit` | szablony (jedno źródło prawdy), wypis jednym kliknięciem, webhook Resend, kolejka rozsyłek |

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
6. Usunięcie dwóch pozostałych flag: `TEMP_HIDE_NOTIFICATIONS_BELL`, `TEMP_FORCE_ENGLISH` (po decyzjach
   z punktu 7 wyżej).
7. Nowy, krótki `CLAUDE.md` opisujący wyłącznie stan obecny (po scaleniu gałęzi z punktu 1).
8. Przepisać `SERWEREK.md` do stanu faktycznego (audyt operacji znalazł 21 rozbieżności) i dodać do
   repo pliki, które żyją tylko na serwerze: `backup.sh`, `health.sh`, `docker-compose.override.yml`.

## Operacje (z `audit-ops.md`)

- Kopie: sekrety (`app.env`, klucz tunelu) nie są w kopii; szyfrowana kopia sekretów (age) do R2.
- Baza: kopia raz na dobę (do 24 h utraty danych); częstsze zrzuty albo archiwizacja WAL do R2.
- Oryginały wideo i HLS w R2 bez kopii i bez blokady usuwania.
- Monitoring tylko z samego serwera; potrzebny zewnętrzny, plus alert po nieudanym backupie i cronie.
- Obrazy budowane na serwerze produkcyjnym (przy każdym wdrożeniu swap ok. 1,5 GB i większość CPU):
  docelowo budowa poza nim i pobranie gotowego obrazu. Robimy przed startem, niezależnie od rozmiaru serwera.
  CI na GitHubie ma limit minut dla prywatnego repo: testy można uruchamiać na serwerze.
- Rotacja logów kontenerów, twardsze ustawienia kontenerów, osobna rola bazy bez uprawnień superusera.
- Deploy restartuje koder w trakcie kodowania (kodowanie zaczyna od zera).
- Stary rclone na serwerze (pierwsza próba wysyłki do R2 kończy się błędem 501).
- Na serwerze do usunięcia: martwe zmienne `MUX_*` w `app.env`, usługa `serwerek-placeholder` i wpisy
  tunelu `test.` oraz `apptest.`.
- DNS do usunięcia: rekordy Clerka w obu strefach.
- Jedna miniatura (`dla-patronow`) nadal idzie przez proxy ze starego Vercel Blob: przenieść do R2,
  potem usunąć `BLOB_READ_WRITE_TOKEN` i `@vercel/blob`.
- Około 230 zdalnych gałęzi bez scalonego PR-a: do przejrzenia i skasowania.

## Pozostałe

- Dostarczalność do Hotmaila: retest na świeżym koncie, Google Postmaster Tools; DMARC stoi na `p=none`.
- PP Support: właściciel włącza 2FA na swoim koncie; testowe rozmowy do usunięcia.
- Tłumaczenia DE/ES/FR/IT/PT/ZH to makiety.
