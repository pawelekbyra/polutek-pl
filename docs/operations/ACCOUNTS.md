# Konta i usługi zewnętrzne (ACCOUNTS)

Stan: 2026-10-12. Spis wszystkiego, od czego zależy `www.pawelperfect.com`, żeby przyszły agent albo właściciel wiedział, gdzie szukać, co wygasa i co się zepsuje, gdy konto przestanie działać.
**Bez sekretów:** podano wyłącznie NAZWY zmiennych i plików, identyfikatory publiczne i nazwy konsol. Adres e-mail konta podano tylko tam, gdzie jest już zapisany w dokumentach; gdzie go nie ma, jest „brak danych w repo” i nie wolno go zgadywać.
Opis odtwarzania: [`WAKE-UP.md`](WAKE-UP.md). Decyzje właściciela i otwarte prace: [`STATUS.md`](STATUS.md). Zasady dla agentów: [`../../CLAUDE.md`](../../CLAUDE.md) §0, §8.1.

Oznaczenia: **DO POTWIERDZENIA** = informacja z dokumentów repo, której nie sprawdzono na żywo albo dokumenty są ze sobą sprzeczne. „brak danych w repo” = nie ma zapisanej wartości.

## 1. Zależności w skrócie

| Usługa | Rola w projekcie | Status | Poświadczenia (nazwy) | Gdy przestanie działać |
|---|---|---|---|---|
| **Cloudflare** (jedno konto) | DNS, rejestrator `pawelperfect.com`, Tunnel, Access, Workery, R2, Email Routing, Turnstile | aktywne, plan Free | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_*`, `tunnel.env`, `TURNSTILE_*`, `CF_ACCESS_*` | cała strona, wideo, panel, poczta przychodząca, kopie: przerwa |
| **Hetzner Cloud** | serwer produkcyjny `serwerek` | aktywne, płatne | `HETZNER_API_TOKEN` | strona, baza i kodowanie leżą; po usunięciu serwera dane z ostatnich kopii tylko w R2 |
| **GitHub** | repozytorium (źródło prawdy), prywatne | aktywne; Actions nie działa | `gh` na komputerze właściciela; `GITHUB_TOKEN` puste | nie da się pobrać kodu na nowy serwer; zapas: klon na komputerze właściciela |
| **Stripe** | napiwki, webhook, zwroty | aktywne, tryb live | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (+ opcjonalnie `PREMIUM_PASS_STRIPE_*`, niżej) | okno napiwku nie działa; film i konta nie są dotknięte |
| **Amazon SES (AWS)** | główny nadawca poczty od 2026-10-11 | aktywne, dostęp produkcyjny | `SES_SMTP_USER`, `SES_SMTP_PASS`, `EMAIL_PROVIDER=ses` | poczta spada na Resend (jeśli klucz działa) |
| **Resend** | poczta awaryjna, wysyłka PP Support, alerty serwera i strażnika | aktywne, plan darmowy | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `SMTP_PASSWORD` (PP Support), `/etc/serwerek/alert.env` | PP Support nie odpowiada klientom, brak alertów, brak poczty awaryjnej |
| **Postmark** | rezerwa dostawcy poczty | skonfigurowany, nieużywany | `POSTMARK_SERVER_TOKEN`, `POSTMARK_WEBHOOK_*` (jeśli ustawione) | nic |
| **Google** | klient OAuth logowania (One Tap), Workspace (do anulowania), Gmail właściciela | stan niejasny | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | logowanie Google przestaje działać (hasło i klucz dostępu zostają) |
| **Rejestratory domen** | `pawelperfect.com` (Cloudflare Registrar), `pawelperfect.pl` (home.pl, porzucona) | patrz rozdz. 3 | konsole rejestratorów | wygaśnięcie `.com` = śmierć projektu (adres, poczta, klucze dostępu) |
| **Vercel, Neon, Clerk, Mux, Cloudflare Stream, Upstash** | wycofane (rozdz. 4) | odcięte, resztki do usunięcia | `BLOB_READ_WRITE_TOKEN` (jedna miniatura) | nic produkcyjnego poza jedną miniaturą |

Konta „centralne”, bez których nie odzyskasz reszty (rozdz. 5): skrzynka `pawel.perfect@gmail.com`, komputer właściciela (klucz SSH, folder sekretów), klucz prywatny `age`.

## 2. Karty usług

### 2.1 Cloudflare

- **Do czego:** strefa `pawelperfect.com` (id `02cb23af5c0000a110f6915b00bbb8ef`), rejestracja domeny (rejestrator: Cloudflare, Inc., wg RDAP), Tunnel `serwerek` (id `a61ae173-0747-492e-9fa5-47692e43c1a7`, zarządzany zdalnie), Zero Trust Access (organizacja `pawelperfect`, `pawelperfect.cloudflareaccess.com`, plan Free, One-time PIN, polityka `serwerek owners` id `d83fe7c1-f52c-432a-80e5-d8dc5fe1851a`), Workery (`polutek-hls-edge`, `pp-watchdog` + D1, `polutek-support-mail`, `pp-support-brand`; subdomena `pawel-perfect.workers.dev`), R2 (buckety `polutek`, `polutek-hls`, `polutek-thumbnails-private`, `polutek-thumbnails`, `serwerek-backups`), Email Routing, Turnstile.
- **Poświadczenia (nazwy):** `CLOUDFLARE_API_TOKEN` (token konta) i `CLOUDFLARE_ACCOUNT_ID` w `secrets.env`; klucze S3 R2: `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY` (aplikacja, encoder, panel) oraz osobny token kopii `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT` w `/etc/serwerek/backup.env`; token tunelu w `/etc/serwerek/tunnel.env`; `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD` w `admin.env`; `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` w `app.env`; service token Access `support-mail-ingest` (id `986f99d4-8b70-41bb-8ef0-8cd58ec464d1`; `SUPPORT_ACCESS_CLIENT_ID`/`_SECRET` w `secrets.env`).
- **Gdzie loguje się właściciel:** panel Cloudflare (dash) i Zero Trust. Adres konta: brak danych w repo.
- **2FA / odzyskiwanie:** `STATUS.md` („Czeka na właściciela” pkt 1) prosi o włączenie TOTP albo klucza dostępu na koncie Cloudflare; czy zrobione: brak danych w repo. Odzyskiwanie: brak danych w repo.
- **Rozliczenia:** plan Free. Workers Paid (5 USD/mies.) zaplanowany dopiero na start publiczny; plan Free ma twarde 100 000 żądań Workera na dobę (`HLS-SELF-HOSTED.md`). Opłata za domenę: rozdz. 3.
- **Gdy wygaśnie / przepadnie:** brak IaC, więc odtworzenie konfiguracji jest ręczne (`WAKE-UP.md` rozdz. 3.5). Tokeny i service token mają własne terminy (rozdz. 6).

### 2.2 Hetzner Cloud

- **Do czego:** serwer `serwerek` (CPX22, 2 vCPU, 4 GB RAM, 75 GB, Norymberga; id 168267250, IP `46.224.211.115`), zapora `serwerek-fw` (id 11716867, 22/tcp i ICMP), ochrona przed usunięciem włączona (`AGENT_ACCESS.md`). Snapshot 439648964 z 2026-10-05 (ok. 27 GB, ok. 0,48 EUR/mies.; czy istnieje: **DO POTWIERDZENIA**).
- **Poświadczenia:** `HETZNER_API_TOKEN` w `secrets.env`; wejście SSH kluczem (prywatny klucz tylko u właściciela).
- **Gdzie loguje się właściciel:** Hetzner Cloud Console. Adres konta: brak danych w repo.
- **2FA / odzyskiwanie:** brak danych w repo.
- **Rozliczenia:** ok. 24,59 EUR/mies. z VAT (konsola 2026-10-01; wyłączony serwer nadal kosztuje). Podwyżka cen Hetznera od 2026-06-15 dotyczy nowych zamówień i zmiany rozmiaru (`koszty-skalowania.md`: CPX22 7,99 -> 19,49 EUR netto bez IPv4). Termin płatności i metoda: brak danych w repo.
- **Gdy wygaśnie:** po zawieszeniu płatności serwer może zostać wyłączony, a po dłuższym czasie usunięty; dane poza R2 znikają. Wiek kopii w R2 to najwyżej 15 dni (`WAKE-UP.md` rozdz. 0.4).

### 2.3 GitHub

- **Do czego:** repozytorium `pawelekbyra/polutek-pl`, gałąź `main` (źródło prawdy od 2026-10-07), prywatne. Konto użytkownika: `pawelekbyra`.
- **Poświadczenia:** `gh` zalogowany w keyring komputera właściciela; `GITHUB_TOKEN` w `secrets.env` jest puste; token `read:packages` do GHCR nie został dostarczony.
- **Rozliczenia:** limit minut Actions wyczerpany 2026-10-04, właściciel nie płaci; weryfikacja jest lokalna (`LOCAL-CI.md`). Pliki `.github/` zostają jako uśpiony wzorzec.
- **Gdy wygaśnie:** nic nie wdroży się samo (i tak nie wdraża); utrata dostępu do repo = brak kodu dla nowego serwera (zapas: klon na komputerze właściciela, bundle na serwerku poza R2).
- **2FA / odzyskiwanie:** brak danych w repo.

### 2.4 Stripe

- **Do czego:** napiwki (PaymentIntent), webhook, zwroty i spory z panelu. Konto `acct_1SOk8E…` (skrócone w dokumentach), kraj PL, tryb live (`AGENT_ACCESS.md`).
- **Poświadczenia:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (wypalany w obrazie przez `build.env`); w `admin.env` osobny klucz ograniczony (zwroty, spory) jako `STRIPE_SECRET_KEY` panelu. Wersja API przypięta w kodzie: `2026-02-25.clover`.
- **Osobny zestaw kluczy kasy premium (opcjonalny):** `PREMIUM_PASS_STRIPE_SECRET_KEY`, `NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY` (wypalany w obrazie przez `build.env`, ale musi być też w `app.env`), `PREMIUM_PASS_STRIPE_WEBHOOK_SECRET`. Wszystkie trzy albo żadna; zwykle klucze **testowe** tego samego konta Stripe, żeby kasa premium działała z prawdziwym Stripe bez pieniędzy, a napiwki zostają na kluczach live. Webhook trybu testowego wskazuje na ten sam adres `/api/webhooks/stripe`. W `admin.env` panelu potrzebny jest dodatkowo `PREMIUM_PASS_STRIPE_SECRET_KEY` (ograniczony klucz testowy), żeby zwroty i spory płatności testowych działały w panelu. Instrukcja: `docs/architecture/patron-zone.md`, „Osobne klucze Stripe”.
- **Gdzie loguje się właściciel:** Stripe Dashboard. Adres konta: brak danych w repo.
- **Stan konfiguracji:** webhook nigdy nie dostał udanej wpłaty (stan na 2026-10-05, `STATUS.md`); czy to się zmieniło: **DO POTWIERDZENIA**. Endpoint musi subskrybować także `refund.created`, `refund.updated`, `refund.failed`.
- **Zasady:** odczyt swobodnie; zwroty, wypłaty i wszystko, co rusza pieniądze, tylko za zgodą właściciela (`CLAUDE.md` §8.1). Agent nie wykonuje wpłat.
- **Gdy wygaśnie:** okno napiwku nie przyjmie płatności; weryfikacja konta Stripe (KYC) i wypłaty to sprawa właściciela. 2FA / odzyskiwanie: brak danych w repo.

### 2.5 Amazon SES (AWS)

- **Do czego:** główny dostawca poczty od 2026-10-11 (`EMAIL_SES.md`). Region `eu-north-1` (Sztokholm), tożsamość domeny `pawelperfect.com` z DKIM i własnym MAIL FROM `bounce.pawelperfect.com`; dostęp produkcyjny przyznany 2026-10-11 (sprawa AWS 179128326000153): 50 000 maili/dobę, 14/s. Ustawienia są per region.
- **Poświadczenia:** `SES_SMTP_USER`, `SES_SMTP_PASS` (SMTP, `email-smtp.eu-north-1.amazonaws.com:587`) w `app.env` i `secrets.env`; opcjonalnie `SES_CONFIGURATION_SET`. Agent nie ma kluczy do API AWS (tylko SMTP), więc konsola jest ręczna.
- **Gdzie loguje się właściciel:** konsola AWS, usługa SES, region `eu-north-1`. Adres konta AWS: brak danych w repo.
- **Rozliczenia:** 0,10 USD za 1000 maili albo 0,16 USD za 1000 (plan Essentials dla nowych kont), bez opłaty stałej; nowe konta AWS mają 200 USD kredytów na 6 miesięcy (`MAILING-WARMUP.md`; data założenia konta i koniec kredytów: brak danych w repo, wnioskowanie: ok. kwietnia 2027). Metoda płatności: brak danych w repo.
- **Jakość:** AWS wszczyna kontrolę konta przy ok. 5% odbić albo 0,1% skarg (`EMAIL_SES.md`). W kodzie nie ma trasy SNS; zdarzeń odbić i skarg aplikacja nie przetwarza (chroni tylko lista zawieszeń konta SES).
- **Gdy wygaśnie:** wysyłka spada na Resend (wymaga działającego `RESEND_API_KEY`); powrót do SES wymaga ponownej weryfikacji i wniosku o dostęp produkcyjny.

### 2.6 Resend

- **Do czego:** poczta awaryjna aplikacji, wysyłka PP Support (SMTP, klucz `pp-support-smtp`), alerty serwera (`/etc/serwerek/alert.env`), mail strażnika `pp-watchdog`, webhook zdarzeń (`/api/webhooks/resend`). Domena `pawelperfect.com` zweryfikowana (region `eu-west-1`); domena `pawelperfect.pl` usunięta 2026-10-07.
- **Poświadczenia:** `RESEND_API_KEY` (aplikacja), osobne klucze wysyłkowe: alerty (`alert.env`), `SMTP_PASSWORD` w `.env` PP Support, `WATCHDOG_RESEND_API_KEY` (Worker), `RESEND_WEBHOOK_SECRET`.
- **Rozliczenia:** plan darmowy: 100 maili/dobę i 3000/mies., dzielone przez aplikację, alerty i PP Support. Plan Pro dopiero przy starcie publicznym (decyzja właściciela, „nic za pieniądze”).
- **Gdy wygaśnie:** klucz unieważniony = PP Support nie wysyła odpowiedzi, serwer nie wysyła alertów (`health.sh`), strażnik nie wysyła maili, awaria SES nie ma zapasu. **To jest cicha zależność krytyczna dla nadzoru.**
- **Logowanie / 2FA:** konsola Resend; adres konta i 2FA: brak danych w repo.

### 2.7 Postmark

- **Do czego:** rezerwa (kod gotowy, domyślnie wyłączona; `EMAIL_POSTMARK.md`). Serwer „www.pawelperfect.com”, konto zatwierdzone 2026-10-09, domena `pawelperfect.com` z DKIM i Return-Path `pm-bounces`, strumienie `outbound` i `broadcast`, webhook `/api/webhooks/postmark` (dane Basic).
- **Poświadczenia:** `POSTMARK_SERVER_TOKEN`, `POSTMARK_STREAM_TX`, `POSTMARK_STREAM_NEWS`, `POSTMARK_WEBHOOK_USER`, `POSTMARK_WEBHOOK_PASSWORD` (czy faktycznie są w `app.env`: **DO POTWIERDZENIA**).
- **Rozliczenia:** plan darmowy 100 maili/mies. wg dokumentu (do sprawdzenia w cenniku). **Gdy wygaśnie:** nic, nie jest na ścieżce produkcyjnej.

### 2.8 Google (OAuth, Workspace, Gmail)

- **Klient OAuth logowania** (`GOOGLE_CLIENT_ID`/`_SECRET`): autoryzowane źródło `https://www.pawelperfect.com`, przekierowanie `https://www.pawelperfect.com/api/auth/callback/google`. Projekt: `pawelperfect-ai` w organizacji `pawelperfect.pl` (stara lokalizacja) albo osobisty projekt `polutek` na `pawel.perfect@gmail.com` (docelowa; przeniesienie to krok właściciela, `GOOGLE_ACCESS.md`). **Który projekt trzyma działający klient i czy ekran zgody jest opublikowany (a nie „Testing”): DO POTWIERDZENIA.**
- **Google Workspace:** admin `hello@pawelperfect.com`; domena główna Workspace to `pawelperfect.pl` (porzucona, wygasła 2026-10-03), `pawelperfect.com` jest domeną dodatkową. Poczta nie idzie już przez Workspace od 2026-10-02. Stan subskrypcji: `HANDOFF-SERVER-AGENT.md` §4 (2026-10-05) mówi „anulowany”, `scripts/ops/briefing.config.json` (2026-10-09) „do anulowania po przeniesieniu klienta OAuth”: **DO POTWIERDZENIA**. Koszt do czasu anulowania: brak danych w repo.
- **Konto usługi** `ai-agent@pawelperfect-ai.iam.gserviceaccount.com` z delegowaniem domeny: nieaktualne po anulowaniu Workspace (klucz w `google-ai-agent.json`; do usunięcia).
- **Gmail `pawel.perfect@gmail.com`:** konto-klucz (rozdz. 5): jedyny adres w polityce Access, archiwum poczty PP Support, odbiorca alertów i maili o nowych kontach (`NEW_USER_NOTIFY_EMAIL`), adres kodów PIN.
- **Search Console / weryfikacja domeny:** nie sprawdzano (`GOOGLE_ACCESS.md`); rekordy `google-site-verification` do przejrzenia.
- **2FA:** `ADMIN-PANEL.md` zaleca weryfikację dwuetapową Google na `pawel.perfect@gmail.com`, bo jest drugim czynnikiem panelu; czy włączona: brak danych w repo.
- **Gdy wygaśnie:** utrata projektu z klientem OAuth wyłącza logowanie Google; hasło i klucze dostępu (RP ID `pawelperfect.com`) zostają.

### 2.9 Cloudflare Turnstile

Część konta Cloudflare (2.1). Widżet chroni rejestrację, logowanie i reset hasła. Klucze: `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`. Lista dozwolonych hostów widżetu: **DO POTWIERDZENIA** (powinna obejmować `www.pawelperfect.com` i apex). Utrata widżetu = logowanie i rejestracja nie przechodzą (zawodzi zamknięcie).

### 2.10 Serwisy pomocnicze bez własnych kont

| Co | Skąd | Uwagi |
|---|---|---|
| Obrazy Dockera | Docker Hub: `postgres:17-alpine`, `redis:7-alpine`, `hiett/serverless-redis-http:latest`, `pgvector/pgvector:0.8.7-pg17`, `node:22-*`, `mwader/static-ffmpeg:8.0.1` | limity pobrań dla anonimowych; `hiett/...` bez przypiętej wersji; `pp-support:4.18.0` to lokalny obraz bez kopii (`WAKE-UP.md` rozdz. 5.1) |
| Pakiety systemu | Ubuntu, Docker, `pkg.cloudflare.com`, `downloads.rclone.org` | `docker`, `containerd`, `cloudflared`, `rclone` nie są objęte `unattended-upgrades` (`SERWEREK.md` rozdz. 15) |
| Źródła zewnętrzne zawartości | klipy CC0 z Wikimedia Commons (4 filmy testowe), flagi circle-flags (MIT) | `THIRD_PARTY_NOTICES.md` |

## 3. Domeny

| Domena | Rejestrator / konto | Status | Termin | Uwagi |
|---|---|---|---|---|
| `pawelperfect.com` | Cloudflare, Inc. (Cloudflare Registrar), wg RDAP Verisign z 2026-10-12 (IANA 1910); serwery nazw `magdalena.ns.cloudflare.com`, `robert.ns.cloudflare.com` | aktywna, `client transfer prohibited`, DNSSEC nie włączony | zarejestrowana 2026-09-30, **wygasa 2027-09-30 18:20 UTC** (RDAP); automatyczne odnawianie i karta: **DO POTWIERDZENIA** | domena główna: adres strony, panelu, poczty, RP ID kluczy dostępu, CSP, SES/Resend; zmiana drogo kosztuje (`pozycjonowanie-platformy.md`) |
| `pawelperfect.pl` | home.pl (konto właściciela), strefa DNS w Cloudflare | **wygasła 2026-10-03, porzucona decyzją właściciela 2026-10-07** | okno przywrócenia w home.pl do 2026-11-02 (wg `SERWEREK.md` z 2026-10-05, może być nieaktualne); strefa w Cloudflare skasuje się sama ok. 2026-10-14 | nic od niej nie zależy (miniatury są na `thumbs.pawelperfect.com`); **lekcja:** domena wygasła, bo nikt nie pilnował terminu; do dziś jest domeną główną organizacji Google Workspace (2.8) |
| `polutek.com` | GoDaddy (zaparkowana na sprzedaż, 799 USD wg sesji badań 2026-10-12) | nie nasza | nie dotyczy | tylko rozważana (`audit/2026-10-12/pozycjonowanie-platformy.md`) |
| `polutek.pl` | cyber_Folks; zarejestrowana 2026-09-25, strefa Cloudflare spoza naszego konta | nie potwierdzona jako nasza | nieznany | właściciel pamięta, że kiedyś była jego: do potwierdzenia (`STATUS.md`) |
| `polutek.com.mx` | wolna | nie nasza | nie dotyczy | notatka z badania domen |

`polutek-pl` w nazwie repozytorium i katalogu to nazwa historyczna projektu, nie domena. Stare `polutek.pl` w komentarzach (Vercel) to nazwa projektu Vercel.

## 4. Usługi wycofane (do kontroli, że nic nie kosztuje i nic nie jest podpięte)

| Usługa | Status | Co jeszcze zostało |
|---|---|---|
| **Vercel** | odcięty; projekt `polutek.pl` wstrzymany (zespół `pawelperfect-5617s-projects`) | magazyny `NEON-krau`, `upstashpolutek`, `BLOB-krau` do usunięcia przez właściciela w panelu Vercel (agent nie może: blokada nieodwracalnych usunięć) |
| **Vercel Blob** | używany jeszcze przez jedną miniaturę (`dla-patronow`) | `BLOB_READ_WRITE_TOKEN` w `app.env`; po przeniesieniu miniatury do R2 usunąć token i `@vercel/blob` (`STATUS.md`) |
| **Neon** | wycofany; baza produkcyjna to lokalny Postgres | projekt `restless-glade-19830690` z danymi testowymi czeka na usunięcie przez właściciela |
| **Clerk** | wycofany; rekordy DNS usunięte 2026-10-05 | instancja Clerk może jeszcze istnieć (koszt/limity): **DO POTWIERDZENIA**; identyfikatory użytkowników w bazie mają format Clerk (`user_...`), to tylko ID |
| **Mux**, **Cloudflare Stream**, **YouTube**, **Vimeo** | wycofane (`MUX_*` usunięte z `app.env` 2026-10-05) | czy w koncie Cloudflare nie ma aktywnej subskrypcji Stream: **DO POTWIERDZENIA**; klucze w `secrets.full-from-pc.env` |
| **Upstash** | wycofany (zastąpiony lokalnym Redisem przez `srh`) | `upstashpolutek` w Vercel do usunięcia |
| **Google Workspace** | poczta przeniesiona 2026-10-02 | patrz 2.8 |

## 5. Punkty, od których zależy reszta

| Rzecz | Dlaczego krytyczna | Stan zabezpieczenia |
|---|---|---|
| Skrzynka `pawel.perfect@gmail.com` | kody PIN Cloudflare Access (panel, PP Support), alerty serwera i strażnika, archiwum poczty `support@`, powiadomienia o nowych kontach, prawdopodobnie odzyskiwanie kont zewnętrznych | 2FA: brak danych w repo |
| Komputer właściciela | jedyny prywatny klucz SSH do serwera, kopia folderu sekretów, klon repo, `gh` | klucz SSH tylko u właściciela (`HANDOFF-SERVER-AGENT.md` §4); drugi klucz awaryjny zaproponowany w `docs/audit/2026-10-03/audit-ops.md`, wykonanie: brak danych w repo |
| Klucz prywatny `age` | bez niego kopie w R2 są nieczytelne | druga kopia offline: **otwarta praca** |
| Folder sekretów agenta (`/root/.ai-secrets/`) | tokeny Cloudflare, Hetzner, Stripe, Resend, SES; kopie konfiguracji Cloudflare | **nie jest w kopii R2**; kopia właściciela poza serwerem |
| Menedżer haseł | nie istnieje (opcjonalna otwarta praca) | hasła i kody odzyskiwania: brak danych w repo |

## 6. Kalendarz odnowień i wygasania

### 6.1 Terminy z datą

| Data | Co | Źródło | Kto pilnuje | Uwaga |
|---|---|---|---|---|
| ok. 2026-10-14 | automatyczne skasowanie strefy DNS `pawelperfect.pl` w Cloudflare | `STATUS.md` | nikt (nic nie zależy) | przy okazji usuń resztki (rekordy `test.`, `apptest.`, aplikacje Access) |
| 2026-11-02 | koniec okna przywrócenia `pawelperfect.pl` w home.pl (jeśli nadal aktualne) | `SERWEREK.md` rozdz. 2 | właściciel | decyzja o porzuceniu już zapadła; ostatni moment na zmianę zdania |
| 2026-11 (połowa) | próg „30 dni” wieku domeny dla reputacji poczty (Microsoft) | `EMAIL_SES.md` | agent przy odprawie | informacyjnie; dziś testy Outlooka wstrzymane |
| ok. 2027-04 | koniec kredytów AWS dla nowego konta (200 USD na 6 miesięcy) | `MAILING-WARMUP.md` + data założenia konta | właściciel | wnioskowanie; data założenia konta AWS: brak danych w repo |
| **2027-09-30** | **wygaśnięcie domeny `pawelperfect.com`** | RDAP 2026-10-12 | właściciel (Cloudflare Registrar) | odnowić z zapasem >= 30 dni; sprawdzić automatyczne odnawianie i ważność karty |
| 2027-10-02 | wygaśnięcie service tokenu Access `support-mail-ingest` | `SUPPORT-CENTER.md` §5 | właściciel / agent | po wygaśnięciu poczta przestaje trafiać do PP Support (zostaje archiwum Gmail); odnowić w Zero Trust i ponownie wdrożyć `polutek-support-mail` |
| co rok od założenia | opłata Cloudflare za domenę, ewentualne opłaty rejestratora | brak danych w repo | właściciel | |

### 6.2 Zdarzenia cykliczne i bez daty

| Co | Cykl / termin | Źródło | Uwaga |
|---|---|---|---|
| Wygasanie kopii w R2 | co 15 dni od utworzenia pliku (blokada usuwania 14 dni) | `SERWEREK.md` rozdz. 9 | gdy serwer stoi, kopie znikają; **zimna kopia bez wygasania jest otwartą pracą** (np. comiesięczne pobranie najnowszego kompletu pięciu plików do pamięci offline) |
| Kopia klucza `age` offline | jednorazowo, potem przy każdej zmianie klucza | `STATUS.md` („Czeka na właściciela” pkt 1) | do dziś niewykonane wg dokumentów |
| Migawka konfiguracji Cloudflare (DNS, Access, tunel, Email Routing, reguły) | po każdej zmianie | `SERWEREK.md` rozdz. 15 (brak IaC) | do zimnej kopii; dziś tylko ręczne kopie w folderze sekretów |
| Rotacja tokenów API (Cloudflare, Hetzner, Stripe, Resend, SES) | brak danych w repo o terminach i TTL tokenów | | token konta Cloudflare i klucze R2: sprawdź w konsoli, czy mają datę ważności |
| Rotacja `BETTER_AUTH_SECRET` | tylko przy kompromitacji | `CLAUDE.md` §4.12 | wylogowuje wszystkich i blokuje konta z 2FA |
| Faktury Hetznera | miesięcznie | brak danych w repo (data i metoda płatności) | brak płatności = zawieszenie serwera |
| Certyfikaty | Cloudflare Universal SSL (zarządzany, odnawia się sam); serwer nie ma własnych certyfikatów (Tunnel) | `SERWEREK.md` | odprawa sprawdza TLS `www`, `video`, `support` |
| Wersja API Stripe | przypięta `2026-02-25.clover` w kodzie; termin wycofania: brak danych w repo | `stripe-client.ts` | sprawdzaj komunikaty Stripe o wycofaniu wersji; endpoint webhooka ma własną wersję |
| Aktualizacje systemu | `unattended-upgrades` tylko `-security`; bez automatycznego restartu; `docker`, `containerd`, `cloudflared`, `rclone` ręcznie | `SERWEREK.md` rozdz. 15 | alert `reboot-required` raz w tygodniu; stare `cloudflared` tracą wsparcie (`audit-ops.md`) |
| Dysk | próg alertu 80% | `health.sh` | logi kontenerów bez rotacji, cache budowania; 75 GB |
| Okres wsparcia Ubuntu 26.04 LTS | brak danych w repo | | zwykle 5 lat |
| Plan Workers Free | 100 000 żądań/dobę | `HLS-SELF-HOSTED.md` | po przekroczeniu wideo nie gra do 00:00 UTC |
| Rejestracja SES: kontrola jakości | ciągła | `EMAIL_SES.md` | ok. 5% odbić / 0,1% skarg = kontrola konta |

### 6.3 Co trzeba monitorować i przez kogo

| Co | Kto / co pilnuje dziś | Jak powiadamia | Luka |
|---|---|---|---|
| Strona publiczna, wideo, PP Support, serce serwera | `pp-watchdog` (Worker, co 5 min) i `health.sh` (co 5 min na serwerze) | mail przez Resend na Gmail właściciela, maks. 20 dziennie | zależność od Resend (2.6); nie sprawdza `admin.pawelperfect.com` |
| Kopie (wiek < 26 h) i test odtworzenia (< 8 dni) | `health.sh` | mail | wygasanie w R2 po 15 dniach nie ma alertu poza „serwer nie działa” |
| Dysk, RAM, swap, usługi, jednostki `failed`, `reboot-required` | `health.sh` | mail | brak logrotate; brak automatycznych restartów |
| Termin domeny | tylko skill `odprawa` (RDAP, `scripts/ops/briefing.config.json`) | raport przy ręcznym uruchomieniu | **nikt nie sprawdza, gdy nikt nie uruchamia odprawy**; polegasz na mailach rejestratora (**DO POTWIERDZENIA**, że przychodzą na Gmail) |
| Limity Workera i plan Free | tylko `odprawa` | raport | brak automatycznego alertu |
| Reputacja poczty SES, odbicia, skargi | konsola AWS (maile AWS), lista zawieszeń konta | maile AWS na adres konta (brak danych w repo) | aplikacja nie przetwarza zdarzeń (brak trasy SNS) |
| Spory i zwroty Stripe | Stripe (maile), panel „Przychody” | mail Stripe | panel tylko na żądanie |
| Wygaśnięcie service tokenu Access i tokenów API | nikt | brak | ustaw przypomnienie u właściciela (rozdz. 6.1) |
| Poczta `support@` | PP Support i archiwum Gmail | powiadomienia w panelu i na e-mail | gdy nikt nie czyta, rozmowy czekają (17 > 24 h wg `STATUS.md`) |

Kto: **automaty** (`health.sh`, `pp-watchdog`), **właściciel** (poczta, rejestrator, Stripe, AWS, Hetzner, 2FA), **przyszły agent** (odprawa `DAILY-BRIEFING.md`, wyłącznie na żywo, bez autonomicznego agenta na serwerze: decyzja 2026-10-04).

## 7. Luki w danych (do uzupełnienia przy najbliższej okazji)

Adresy e-mail kont (Cloudflare, Hetzner, AWS, Resend, Postmark, Stripe), ustawienia 2FA i odzyskiwania, metody płatności i terminy faktur, automatyczne odnawianie domeny, data założenia konta AWS,
stan subskrypcji Google Workspace, projekt z klientem OAuth i status ekranu zgody, lista hostów Turnstile, TTL tokenów API, istnienie snapshotu Hetznera. Uzupełniaj bez sekretów (nazwy i daty), nigdy haseł ani kodów odzyskiwania.
