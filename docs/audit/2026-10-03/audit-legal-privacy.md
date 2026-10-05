# Audyt zgodności „dokumenty vs rzeczywistość”: pawelperfect.com

> Stan po naprawach: patrz `RESULT-www-fixes.md` (znaleziska naprawione lub nieaktualne zostały usunięte z tego pliku).

- Data: 2026-10-03. Repo: `main` @ `88c787d0` (worktree `dns-migration-cloudflare-bcfaf0`).
- Tryb: tylko odczyt. Niczego nie zmieniono. Na produkcji wykonano wyłącznie zwykłe GET jako gość (`curl` oraz jedno wejście przeglądarką na `https://www.pawelperfect.com/pl` z kliknięciem bramki „Follow the white rabbit”), bez logowania.
- Zastrzeżenie: to nie jest porada prawna. Raport wskazuje niezgodności faktyczne między tym, co serwis deklaruje, a tym, co robi kod, oraz ryzyka do przejrzenia. Punkty oznaczone **[PRAWNIK]** wymagają oceny prawnika (RODO, prawo telekomunikacyjne/PKE, UŚUDE, DSA, prawo konsumenckie, podatki).
- Źródła zewnętrzne (stan na październik 2026) są podane przy znaleziskach i zebrane w sekcji 8.

---

## 1. Podsumowanie

Regulamin (PL/EN) jest aktualny co do modelu niekomercyjnego: darmowy dostęp, a dobrowolne wsparcie niczego nie odblokowuje. Kod dostępu (`checkVideoAccess`) to potwierdza. Polityka prywatności (PL/EN) opisuje natomiast stos sprzed 1–2 października 2026 (Clerk, Vercel, Neon, Upstash). Pomija faktycznych odbiorców danych: Hetzner, Google (logowanie i One Tap), szerokie role Cloudflare, prywatny Gmail z kopią poczty supportu, jsDelivr i partnerów metod płatności Stripe. Nie opisuje też kilku kategorii danych, które aplikacja zbiera: telemetrii oglądania, publicznego statusu „Patron”, korespondencji supportu i logów audytowych z IP.

Najpoważniejsze rozjazdy:

1. **Skrypty i cookies stron trzecich u każdego gościa bez zgody.** Polityka w § 7 twierdzi, że serwis używa „wyłącznie cookies niezbędnych” i „nie używa cookies śledzących”. Na produkcji gość, który nic nie robi, dostaje Stripe.js (`__stripe_mid` na rok, `__stripe_sid`, ramka antyfraudowa `m-outer`) oraz Google Identity Services (One Tap, cookie `g_state`), a hls.js ładuje się z `cdn.jsdelivr.net`. Sprawdzone w przeglądarce.
2. **Wsparcie daje widoczne wyróżnienie, wbrew Regulaminowi.** Regulamin w § 4 ust. 3 mówi, że wsparcie nie daje „wyróżnień ani innych korzyści”. Kod mimo to pokazuje publiczną odznakę „PATRON” przy komentarzach i złoty pierścień przy awatarze. Wysyła też powiadomienie w aplikacji: „Teraz masz dostęp do pełnej zawartości”. To ujawnia publicznie, kto wpłacił, i osłabia darowiznowy charakter wpłat (por. NSA III FSK 113/26).
3. **Usunięcie konta: mail mija się z prawdą.** Mail „Konto zostało usunięte” deklaruje trwałe usunięcie danych, w tym historii komentarzy i reakcji, oraz możliwość odwołania w ciągu 30 dni. W rzeczywistości zostają: komentarze (tekst), reakcje, płatności, logi z IP, telemetria, e-mail w Resend Audience, klient w Stripe i dane w PP Support. Przywrócenie konta jest technicznie niemożliwe.
4. **Rejestracja bez Regulaminu i Polityki.** Konto e-mail, Google ani One Tap nie pokazuje Regulaminu ani Polityki i nie zbiera ich akceptacji. Akceptacja przy napiwku nie jest nigdzie zapisywana.
5. **Brak trybu reklamacyjnego w Regulaminie.** Usunięto go 2026-09-22, a wymaga go art. 8 ust. 3 pkt 4 UŚUDE **[PRAWNIK]**.
6. **Dane u wycofanych dostawców.** Na Neon leży nieaktualna, pełna kopia bazy produkcyjnej (stan z 2026-10-01, 31 użytkowników). Do tego dochodzą prawdopodobnie rekordy w Clerku, pliki w Vercel Blob i skrzynka Google Workspace. Usunięcia kont po 2026-10-01 tam nie docierają.
7. **Poczta supportu.** Każdy mail na `support@`/`hello@` trafia też na prywatny Gmail właściciela (konsumencki Google, USA, bez umowy powierzenia) i jest trzymany bezterminowo w PP Support. Polityka tego nie opisuje.

**Liczba znalezisk: 30 (P1: 8, P2: 11, P3: 11).**

Waga: **P1** to realna niezgodność z deklaracją wobec użytkownika lub z prawem, do szybkiej naprawy. **P2** to istotna luka informacyjna lub ryzyko. **P3** to porządki, spójność i drobne ryzyka.

---

## 2. Usługi zewnętrzne: dokument vs kod

Legenda kolumny „W polityce”: **TAK**, **NIE**, **NIEAKTUALNE** (wymienione, choć wycofane).

| Usługa | Jakie dane / co trafia | Gdzie w kodzie / konfiguracji | Lokalizacja / transfer | W polityce |
|---|---|---|---|---|
| **Hetzner Online (serwer „serwerek”, Norymberga)** | Cała baza aplikacji (konta, sesje z IP i UA, komentarze, płatności, logi audytu, telemetria), logi kontenerów, PP Support (cała korespondencja), dane robocze kodera wideo | `deploy/serwerek/docker-compose.yml`, `deploy/serwerek/support/docker-compose.yml`, `docs/operations/SERWEREK.md:13` | DE (EOG). Umowę powierzenia (AVV) zawiera się kliknięciem w panelu konta Hetzner ([Hetzner AVV](https://docs.hetzner.com/de/general/general-terms-and-conditions/data-privacy-faq/)) | **NIE** |
| **Cloudflare: proxy/CDN + Tunnel** | Cały ruch HTTP(S) użytkowników (TLS kończy się w Cloudflare), IP, nagłówki, cookies sesyjne | Nagłówki `Server: cloudflare`, `CF-RAY` na produkcji; `TRUST_CF_CONNECTING_IP`, `lib/api/client-ip.ts` | Globalnie; DPA ze SCC przyjmowana z warunkami Cloudflare ([Turnstile/DPA](https://www.cloudflare.com/it-it/turnstile-privacy-policy)) | Częściowo („Cloudflare (wideo i infrastruktura)”) |
| Cloudflare R2 | Miniatury (publiczny bucket `thumbs.pawelperfect.pl`; buckety miniatur w lokalizacji **ENAM**, czyli Ameryka Płn.), oryginały i HLS wideo, **nocne zrzuty baz (w tym PP Support) w buckecie `serwerek-backups`, 14 dni** | `lib/modules/media/**`, `docs/operations/SERWEREK.md:50`, `docs/tickets/ready/MEDIA-THUMBNAILS-R2-MIGRATION-001.md:73` | ENAM dla miniatur; lokalizacja bucketu kopii **nieznana** (do sprawdzenia) | Częściowo |
| Cloudflare Workers (`hls-edge` na `video.pawelperfect.com`, `polutek-support-mail`, `pp-support-brand`) | IP i UA widza przy każdym segmencie wideo; pełna treść maili przychodzących; logi Workers (observability włączone; worker poczty loguje `from`/`to` przy błędzie) | `workers/*/worker.mjs`, `workers/*/deploy.mjs` (`observability: { enabled: true }`) | Globalnie | Częściowo |
| Cloudflare Email Routing + Access | Poczta przychodząca na obie domeny; logowania do panelu PP Support (OTP) | `docs/operations/SUPPORT-CENTER.md` | Globalnie | **NIE** |
| Cloudflare Turnstile | IP, odcisk TLS, UA na formularzach logowania/rejestracji/resetu | `app/components/auth/TurnstileWidget.tsx:36`, `lib/auth/config.ts` (`CAPTCHA_ENDPOINTS`) | Globalnie; Turnstile nie używa cookies ([Turnstile Privacy Addendum](https://www.cloudflare.com/it-it/turnstile-privacy-policy)) | **NIE** (wprost) |
| **Google: Sign-In (OAuth) i One Tap** | IP i UA każdego niezalogowanego gościa po przejściu bramki (skrypt `accounts.google.com/gsi/client`); przy logowaniu e-mail, imię i nazwisko, zdjęcie, `sub`, idToken/accessToken zapisywane w tabeli `Account` | `lib/auth/auth.ts:84-93,176`, `app/components/auth/GoogleOneTapPrompt.tsx`, `AuthModalProvider.tsx:120` | USA (Google LLC; odrębny administrator) | **NIE** |
| **Google: prywatny Gmail właściciela (`pawel.perfect@gmail.com`)** | Kopia **każdego** maila przychodzącego na `support@`/`hello@` (oba domeny) | `workers/support-mail-ingest/worker.mjs:88`, `deploy.mjs:32` | USA; konto konsumenckie, bez umowy powierzenia | **NIE** |
| Google Workspace (do anulowania ~2026-10-09) | Historyczna skrzynka `hello@`, klient OAuth logowania w projekcie organizacji | `docs/operations/STATUS-2026-10-03.md` pkt 1–2 | USA | **NIE** |
| **Stripe** (+ partnerzy metod płatności) | E-mail (tworzony obiekt Customer), `userId`, kwota; dane metody płatności; odciski urządzenia (Radar) z `__stripe_mid`/`__stripe_sid` u **każdego gościa** | `lib/modules/payments/application/create-checkout-intent.use-case.ts:63-99`, `lib/hooks/useCheckoutFlow.ts:30-32` | Stripe Payments Europe Ltd (IE) + Stripe LLC (USA, DPF); 91 podprocesorów ([Stripe DPA/DPF](https://stripe.com/legal/data-privacy-framework), [lista](https://stripe.com/legal/service-providers)) | TAK (bez cookies i odcisków) |
| Operatorzy metod przez Stripe: BLIK, Przelewy24, PayPal, Klarna, Revolut Pay, Apple Pay, Google Pay, iDEAL itd. | Dane płatnika u operatora metody (odrębni administratorzy) | `app/components/support/tip-flow-config.ts:48-64` | Różne | **NIE** |
| **Resend** | Adres e-mail, treść wszystkich maili transakcyjnych i masowych, zdarzenia dostarczenia; kontakty w Resend Audience (subskrypcja) | `lib/modules/email/infrastructure/legacy-email-service-provider.ts`, `lib/modules/subscriptions/infrastructure/resend-audience.gateway.ts:64-104`; SMTP PP Support (`smtp.resend.com`) | **Dane przechowywane w USA** niezależnie od regionu wysyłki; SCC + DPF ([Resend GDPR](https://resend.com/security/gdpr)) | TAK |
| **jsDelivr (cdn.jsdelivr.net)** | IP i UA każdego, kto odtwarza wideo (Vidstack dociąga `hls.js@^1.5.0`) | CSP `lib/utils/security.ts:87`; zaobserwowane na produkcji | Globalny CDN (Cloudflare/Fastly) | **NIE** |
| Have I Been Pwned (api.pwnedpasswords.com) | 5-znakowy prefiks SHA-1 hasła (k-anonimowość) przy rejestracji i zmianie hasła | `lib/auth/auth.ts` (`haveIBeenPwned({ enabled: isProduction })`) | Cloudflare/Azure | NIE (wg mnie nie są to dane osobowe; do wzmianki) |
| PP Support (oprogramowanie self-hosted) + relay powiadomień push producenta | Korespondencja supportu; aplikacja mobilna wysyła push przez relay producenta silnika | `deploy/serwerek/support/**`, `STATUS-2026-10-03.md` pkt 6 | Hetzner DE; relay: **nieznane** | **NIE** |
| Anthropic (agent AI czytający rozmowy PP Support) | Treść rozmów supportu, jeśli agent zostanie użyty | `docs/operations/SUPPORT-CENTER.md:130-136` (konto „Agent AI”, token istnieje) | USA | **NIE** (status: koncepcja, token gotowy) |
| DiceBear (`api.dicebear.com`) | Seed awatara = pseudonim/ID użytkownika (fallback). Przeglądarka: blokowane przez CSP (dozwolone tylko `www.dicebear.com`); `next/image` bez `unoptimized` może pobierać po stronie serwera | `app/components/SafeAvatar.tsx:31,52`, `app/components/comments/EmbeddedComments.tsx:123`, `next.config.mjs:47` | USA/UE | NIE |
| **Clerk** | Wycofany 2026-10-02; rekordy dawnych użytkowników prawdopodobnie nadal u Clerka; tabela `ClerkEvent` z payloadami w naszej bazie | `prisma/schema.prisma:186`; CSP `img.clerk.com` | USA | **NIEAKTUALNE** |
| **Vercel** (hosting, Analytics, Blob) | Hosting wycofany 2026-10-01; w Vercel Blob nadal stare miniatury; endpoint `/api/comments/image-upload` nadal wysyła pliki do Vercel Blob; komponent `@vercel/analytics` w layoucie (na serwerku zwraca 404) | `app/layout.tsx:15,76`, `app/api/comments/image-upload/route.ts:2,38` | USA | **NIEAKTUALNE** |
| **Neon** | **Pełna kopia bazy produkcyjnej z 2026-10-01** („zapas”, nie kasować bez zgody) | `docs/operations/SERWEREK.md:299` | Region do sprawdzenia | **NIEAKTUALNE** (ale dane tam są) |
| **Upstash** | Zastąpiony lokalnym Redisem (SRH) na serwerku | `docs/operations/SERWEREK.md:296` | n/d | **NIEAKTUALNE** |
| Mux, Cloudflare Stream, YouTube, Vimeo | Kod nadal obecny (osadzenia, CSP); decyzja: tylko własny HLS | `lib/utils/security.ts:21-43`, `playback.service.ts` | n/d | NIE (nieużywane) |
| Google Fonts | Tylko w CSP; czcionki są self-hosted (Geist) | `lib/utils/security.ts:75,113-115` | n/d | NIE (nieużywane, do usunięcia z CSP) |

---

## 3. Dane osobowe: co faktycznie jest w systemie

| Dane | Model / miejsce | Cel faktyczny | Retencja faktyczna | Co mówi polityka |
|---|---|---|---|---|
| E-mail, pseudonim (`name`), `username`, język, rola, flagi weryfikacji i 2FA, `stripeCustomerId`, daty | `User` | Konto, logowanie | Do usunięcia konta; potem **nagrobek bezterminowo** (zanonimizowany e-mail `deleted_…@deleted.com`, nazwa „Usunięty Użytkownik”, `createdAt`, `language`) | „e-mail, nazwa, avatar”; do usunięcia + okres roszczeń |
| Awatar (bajty obrazu) | `UserAvatar`, publiczny URL `/api/avatars/[userId]` | Wyświetlanie przy komentarzach (**publicznie**) | Kasowany przy usunięciu konta | „avatar” (bez informacji o publiczności) |
| Sesje: token, **IP, User-Agent**, ważność 30 dni | `Session` | Logowanie | Brak crona; Better Auth usuwa wygasłe tylko przy odczycie; kasowane przy usunięciu konta | „adres IP, logi techniczne… do 90 dni” (ogólnie) |
| Powiązane logowania: hasło (hash), **Google accessToken/refreshToken/idToken (jawnie)** | `Account` | Logowanie | Kasowane przy usunięciu konta | NIE (nic o danych z Google) |
| Sekret TOTP, kody zapasowe | `TwoFactor` | 2FA | Kasowane przy usunięciu konta | NIE |
| Tokeny weryfikacji/resetu (identyfikator = e-mail) | `Verification` | E-maile bezpieczeństwa | 1 h ważności; wygasłe nie są aktywnie czyszczone | NIE |
| **Logi audytu z IP i User-Agent** (logowanie, wylogowanie, zmiana hasła, akcje admina) | `AuditLog` (`ip`, `userAgent`, `actorUserId`) | Bezpieczeństwo | **Bezterminowo** (brak crona; nie kasowane przy usunięciu konta) | „do 90 dni” |
| **Telemetria oglądania**: kto (userId) lub skrót IP/UA (gość), który film, czas, postęp, głośność, wyciszenie, pełny ekran, błędy | `VideoPlaybackSession`, `VideoPlaybackEvent` | Statystyki, liczenie wyświetleń, ochrona linków | Sesje niezaliczone jako wyświetlenie: 30 dni (cron). **Sesje zaliczone i wszystkie zdarzenia: bezterminowo**; po usunięciu konta zostają z `userId` | **NIE** |
| Wyświetlenia (`userId` lub `ipHash`) | `VideoView` | Licznik wyświetleń | Bezterminowo | NIE |
| Skróty IP/UA: **SHA-256 bez soli** (`app/api/videos/[id]/playback-event/route.ts:31-36`, `app/api/media-source/[videoId]/route.ts:54-55`) | j.w. | Wiązanie sesji z urządzeniem | j.w. | NIE. Uwaga: skrót IPv4 bez soli da się łatwo odwrócić (dane pseudonimowe, nie anonimowe) |
| Polubienia/niepolubienia filmów, reakcje i polubienia komentarzy | `VideoLike`, `VideoDislike`, `CommentReaction`, `CommentLike`, `CommentDislike` | Funkcje społecznościowe | **Nie kasowane przy usunięciu konta** | NIE |
| Komentarze (tekst, opcjonalny obraz), edycje, moderacja | `Comment` | Dyskusja | Usunięcie przez autora: tekst nadpisany `[deleted]`. **Usunięcie konta: tekst zostaje w bazie** (ukryty publicznie) | „do czasu usunięcia przez Ciebie lub moderację” |
| Zgłoszenia komentarzy (zgłaszający, powód, notatka) | `CommentReport` | Moderacja | Bezterminowo | NIE |
| **Status „Patron”** (publiczna odznaka) | `PatronGrant` (+ `comments-public-author.ts:35`) | Wyróżnienie wspierających | Bezterminowo; odwoływany przy usunięciu konta | **NIE** (Regulamin mówi, że wyróżnień brak) |
| Płatności: kwota, waluta, status, ID Stripe, zwroty (kto, kiedy, powód) | `Payment`, `UserPaymentTotal` | Obsługa wsparcia, podatki | Bezterminowo (obowiązki podatkowe: zasadne, ale okres nieokreślony) | „przez okres wymagany przez przepisy” |
| Payloady zdarzeń Stripe (mogą zawierać e-mail, dane płatnika, kraj, ostatnie cyfry karty) | `StripeEvent.payload` | Idempotencja webhooków | **Bezterminowo** | NIE |
| Payloady zdarzeń Clerka (dawni użytkownicy: e-maile, nazwy itp.) | `ClerkEvent.payload` (tabela martwa) | Brak (historia) | **Bezterminowo** | NIE |
| Zgody i subskrypcja: `marketingEmails`, `unsubscribedAt`, ID kontaktu Resend | `EmailPreference`, `Subscription`; kontakt w Resend Audience | Powiadomienia o nowościach | Lokalnie kasowane przy usunięciu konta; **kontakt w Resend zostaje** | „wyłącznie gdy udzielisz odrębnej zgody” |
| Odbiorcy wysyłek masowych (e-mail, język, otwarcia/kliknięcia) | `BroadcastEmailRecipient` | Wysyłka | Bezterminowo, **także po usunięciu konta** | NIE |
| Zdarzenia e-mail (e-mail + pełny payload) | `EmailEvent` | Dostarczalność, tłumienie | Bezterminowo | NIE |
| Tłumienia (e-mail po odbiciu/skardze) | `EmailSuppression` | Dostarczalność | Bezterminowo (zasadne) | NIE |
| Poczta przychodząca (stary kanał Resend Inbound) | `InboundEmail` (nadawca, treść HTML/tekst) | Skrzynka w panelu admina | Bezterminowo | NIE |
| **Korespondencja supportu** | PP Support (Postgres `pp_support`, załączniki w `/opt/serwerek/data/pp-support/storage`) + **kopia w Gmailu** + kopie zapasowe w R2 | Obsługa zgłoszeń | **Bezterminowo** | NIE |
| Powiadomienia w aplikacji | `Notification` | Powiadomienia | Bezterminowo (kaskada tylko przy twardym usunięciu, a konto jest nagrobkiem) | NIE |
| Limity zapytań (klucze z IP/e-mailem, skróty) | Redis (SRH) na serwerku | Ochrona przed nadużyciami | TTL okna (minuty) | „limity zapytań” |
| Logi aplikacji (m.in. **adresy e-mail w jawnej postaci**: `send-transactional-email.use-case.ts:90,94`) | Docker json-file; dla kontenera `app` brak limitu rotacji w compose | Diagnostyka | **Nieokreślona** (zależy od `daemon.json`, nieznane) | „do 90 dni” |
| Kopie zapasowe (pełne zrzuty baz) | Lokalnie 7 dni, R2 14 dni; przed deployem `pre-deploy-*.sql.gz` 14 dni | Odtwarzanie | 7/14 dni (zgodnie z dokumentacją serwera) | NIE |
| Kopia bazy na Neon | Neon | Brak (zapas) | **Bezterminowo** | Neon wymieniony jako „baza danych” |

---

## 4. Cookies, pamięć przeglądarki i skrypty stron trzecich

Zaobserwowano na produkcji (gość, czysta przeglądarka, wejście na `/pl`). Przed kliknięciem bramki: brak cookies i skryptów obcych. Po kliknięciu „Follow the white rabbit”, przez około 8 s:

```
cookies: app-language=pl; __stripe_mid=…; __stripe_sid=…; g_state={"i_l":0,…}
skrypty: /_vercel/insights/script.js (404), js.stripe.com/dahlia/stripe.js,
         cdn.jsdelivr.net/npm/hls.js@^1.5.0/dist/hls.min.js, accounts.google.com/gsi/client
ramki:   js.stripe.com/v3/controller-with-preconnect…, js.stripe.com/v3/m-outer-….html
```

| Nazwa | Rodzaj | Kto ustawia | Cel | Czas życia | Niezbędne? | W polityce |
|---|---|---|---|---|---|---|
| `__Secure-pp.session_token` | cookie HttpOnly | Better Auth | Sesja po zalogowaniu | 30 dni (odświeżane co 24 h) | Tak | Ogólnie („utrzymanie sesji”) |
| `__Secure-pp.session_data` | cookie | Better Auth (cookieCache) | Pamięć podręczna sesji | 60 s | Tak | Ogólnie |
| `pp.dont_remember`, `pp.two_factor`, `pp.trust_device`, ciasteczka stanu OAuth | cookie | Better Auth | Sesja bez „zapamiętaj”, krok 2FA (minuty), zaufane urządzenie (7 dni, opt-in), stan/PKCE logowania Google (minuty) | jw. | Tak | Ogólnie |
| `app-language` | cookie (JS) | Aplikacja (`LanguageContext.tsx:26`) | Język | 1 rok | Raczej tak (funkcjonalne, zainicjowane przez użytkownika) | NIE (wprost) |
| **`__stripe_mid`** | cookie 1st-party | **Stripe.js** | Identyfikator urządzenia do antyfraudu (Radar) | **1 rok** | **Sporne**; ustawiane każdemu gościowi, także temu, kto nie płaci | **NIE** |
| **`__stripe_sid`** | cookie | Stripe.js | Sesja antyfraudowa | 30 min | Sporne poza procesem płatności | **NIE** |
| **`g_state`** | cookie 1st-party | **Google Identity Services (One Tap)** | Stan i limit wyświetlania One Tap | Do ok. roku (wg Google) | **Raczej nie** (nikt nie prosił o logowanie) | **NIE** |
| Ciasteczka Google w kontekście `accounts.google.com` | cookie 3rd-party / FedCM | Google | Sprawdzenie, czy gość jest zalogowany w Google | n/d | Nie | NIE |
| `app-language` | localStorage | Aplikacja | Język | trwałe | jw. | NIE |
| `pp:one-tap-last` | localStorage | Aplikacja | Limit One Tap 1×/dzień | trwałe | Pomocnicze do One Tap | NIE |
| `polutek:email-consent-prompt-dismissed:<userId>` | localStorage | Aplikacja | Nie pokazywać ponownie prośby o zgodę marketingową; **zawiera ID użytkownika** | trwałe | Funkcjonalne | NIE |
| `tip-last-method` | localStorage | Aplikacja | Ostatnia metoda napiwku | trwałe | Funkcjonalne | NIE |
| `cockpit-sound` | localStorage | Aplikacja | Wyciszenie dźwięku premiery | trwałe | Funkcjonalne | NIE |
| `polutek_pwa_installed` | localStorage | Aplikacja | Flaga instalacji PWA | trwałe | Funkcjonalne | NIE |
| Punkt wznowienia uploadu (admin) | localStorage | Panel admina | Wznowienie uploadu | trwałe | Tak (admin) | n/d |
| `polutek:revealed`, `sso-return-to` | sessionStorage | Aplikacja | Bramka wejścia; powrót po logowaniu Google | sesja karty | Tak | NIE |
| **Stripe.js + ramka `m-outer`** | skrypt/ramka | js.stripe.com | Antyfraud; ładowane globalnie, bo `loadStripe()` wywołuje się przy imporcie modułu (`lib/hooks/useCheckoutFlow.ts:30-32`), a `SidebarPlaylist.tsx:16` importuje statycznie `DonationBox` | n/d | Tylko przy płatności | **NIE** |
| **Google GSI (`accounts.google.com/gsi/client`)** | skrypt | Google | One Tap po przejściu bramki (`GoogleOneTapPrompt.tsx`) | n/d | Nie | **NIE** |
| **hls.js z jsDelivr** | skrypt | cdn.jsdelivr.net (domyślny loader Vidstack) | Odtwarzacz HLS; wersja „pływająca” `^1.5.0` | n/d | Funkcja tak, ale nie z obcego CDN | **NIE** |
| Turnstile | skrypt/ramka | challenges.cloudflare.com | Tylko na formularzach auth; bez cookies | n/d | Tak (bezpieczeństwo) | NIE (wprost) |
| `@vercel/analytics` | skrypt | `/_vercel/insights/script.js` | Analityka Vercel; na serwerku 404, nic nie wysyła | n/d | — | Polityka mówi „brak analityki” (martwy kod) |
| Śledzenie otwarć i kliknięć maili | piksel/przekierowania | Resend | Wg `docs/operations/EMAIL_DELIVERABILITY.md:22` **wyłączone** (Open/Click Tracking: false). Kod nadal zapisuje zdarzenia `opened`/`clicked`, gdyby je włączono | — | — | Polityka milczy (OK, dopóki wyłączone) |

Ocena zgody **[PRAWNIK]**. Od 10.11.2024 art. 399 PKE wymaga zgody na przechowywanie informacji w urządzeniu i dostęp do nich, chyba że jest to niezbędne do usługi, której zażądał użytkownik ([Grant Thornton o PKE](https://grantthornton.pl/publikacja/prawo-komunikacji-elektronicznej-a-ochrona-danych-osobowych/)). Wytyczne EROD 2/2023 (wersja 2, 7.10.2024) obejmują także piksele, odciski urządzeń i ładowanie zasobów, które czytają informacje z urządzenia ([EDPB Guidelines 2/2023](https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf)). Roczne `__stripe_mid` ładowane poza procesem płatności uchodzi w praktyce za sporne jako „niezbędne” ([analiza `__stripe_mid`](https://getconzent.com/cookie/__stripe_mid/), [Drupal: ograniczenie Stripe.js do stron płatności](https://www.drupal.org/project/commerce_stripe/issues/3083393)). One Tap kontaktuje się z Google, zanim gość o cokolwiek poprosił.

---

## 5. Znaleziska

Format: **ID | waga | miejsce (dokument / kod) | niezgodność | kierunek | nakład**.

### P1

**LEG-02 | P1 | Skrypty i cookies stron trzecich u każdego gościa bez zgody, sprzecznie z § 7 Polityki**
- Dokument: `LegalDocs.tsx:242-250` / `:467-475` („wyłącznie… niezbędnych… Nie używamy… śledzących”) oraz podsumowanie `:151`.
- Kod:
  - Stripe.js: `lib/hooks/useCheckoutFlow.ts:30-32` (moduł wywołuje `loadStripe()` przy imporcie); `app/components/channel/SidebarPlaylist.tsx:16` (statyczny import `DonationBox`).
  - One Tap: `app/components/auth/GoogleOneTapPrompt.tsx`, `AuthModalProvider.tsx:120`, `lib/auth/auth.ts:176`.
  - hls.js z jsDelivr: domyślny loader Vidstack, CSP `lib/utils/security.ts:87`.
- Niezgodność: potwierdzone na produkcji. Gość dostaje `__stripe_mid` (rok), `__stripe_sid`, `g_state` i ramki Stripe, a jego IP trafia do Stripe, Google i jsDelivr, zanim cokolwiek zrobi.
- Kierunek: **zmienić kod**.
  - Stripe.js ładować dopiero przy otwarciu bramki napiwku (leniwy `loadStripe` w `SupportModal`, który już jest `dynamic`).
  - One Tap uruchamiać tylko po geście użytkownika (np. otwarcie okna logowania) albo po zgodzie.
  - hls.js wbudować w bundle lub serwować z własnej domeny, z przypiętą wersją.
  - Następnie opisać w § 7 każde pozostałe cookie i element pamięci przeglądarki. Dopiero jeśli coś zostaje bez zgody: baner zgody. **[PRAWNIK]**: kwalifikacja `__stripe_mid` i One Tap w świetle art. 399 PKE i wytycznych EROD 2/2023.
- Nakład: S–M.

**LEG-03 | P1 | Wsparcie daje publiczne wyróżnienie i komunikat o „dostępie”, wbrew § 4 ust. 3 Regulaminu**
- Dokument: `LegalDocs.tsx:100-103` (PL) / `:325-328` (EN): wsparcie „nie daje dostępu do… wyróżnień ani innych korzyści”.
- Kod:
  - publiczna odznaka „PATRON” przy komentarzach: `lib/comments-public-author.ts:35`, `app/components/comments/components/CommentItem.tsx:182-186`;
  - pierścień i tytuł „Patron” przy awatarze: `app/components/auth/UserMenu.tsx:50-55`, `CommentComposer.tsx:134`;
  - powiadomienie w aplikacji po wpłacie powyżej progu: „Witaj, Patronie! … **Teraz masz dostęp do pełnej zawartości**” (`lib/modules/notifications/application/send-notification.use-case.ts:78-82`, wysyłane przez `lib/modules/patron/application/grant-patron.use-case.ts:87-94` z `fulfill-payment.use-case.ts:118`);
  - osobny mail „become-patron” dla wpłat powyżej progu.
- Niezgodność:
  - Status „Patron” to wyróżnienie zależne od kwoty wpłaty.
  - Publicznie ujawnia, kto wpłacił (informacja o płatności to dane osobowe), czego Polityka nie opisuje.
  - Komunikat o „dostępie” przeczy Regulaminowi i może podważać darowiznowy charakter wpłat. NSA w III FSK 113/26 (7.07.2026) ocenia wpłaty przez pryzmat elementów umowy darowizny ([pit.pl](https://www.pit.pl/darowizna/nsa-anonimowe-wplaty-na-internetowe-zbiorki-to-darowizny-nie-pit-fiskus-przegral)).
- Kierunek: **decyzja właściciela**.
  - Albo usunąć odznakę i pierścień, a powiadomienie zmienić na neutralne podziękowanie (zmiana kodu).
  - Albo zostawić odznakę jako dobrowolną i wyłączalną (opt-in), opisać ją w Polityce (podstawa, publiczność) i zmienić § 4 ust. 3 Regulaminu.
  - Treść powiadomienia `patronAccess` poprawić w każdym wariancie.
  - **[PRAWNIK/doradca podatkowy]**: wpływ na kwalifikację darowizny.
- Nakład: S.

**LEG-06 | P1 | Regulamin nie ma trybu postępowania reklamacyjnego**
- Dokument: `LegalDocs.tsx:37-133` (5 paragrafów, „Reklamacje” usunięto 2026-09-22). Metadane stron nadal obiecują „reklamacje/complaints”: `app/[locale]/regulamin/page.tsx:12`, `app/[locale]/terms/page.tsx:12`.
- Wymóg: art. 8 ust. 3 pkt 4 UŚUDE (regulamin określa tryb reklamacji) ([arslege, art. 8](https://arslege.pl/regulamin-swiadczenia-uslug-droga-elektroniczna/k879/a62684/), [lookreatywni](https://lookreatywni.pl/baza-wiedzy/reklamacja-regulamin-swiadczenia-uslug-droga-elektroniczna/)). Usługa elektroniczna to konto, komentarze i odtwarzanie; reklamacja dotyczy działania serwisu, nie sprzedaży.
- Kierunek: **zmienić dokument** (krótki paragraf: jak, gdzie, w jakim terminie i jak rozpatrywane) i poprawić metadane. **[PRAWNIK]**.
- Nakład: S.

**LEG-07 | P1 | Poczta supportu: kopia na prywatnym Gmailu, bezterminowe przechowywanie, możliwy agent AI**
- Kod: `workers/support-mail-ingest/worker.mjs:88` (`message.forward(env.ARCHIVE_TO…)` dla każdego maila), `workers/support-mail-ingest/deploy.mjs:32` (domyślnie `pawel.perfect@gmail.com`). PP Support przechowuje rozmowy i załączniki bez retencji. Konto „Agent AI” z tokenem API (`docs/operations/SUPPORT-CENTER.md:130-136`). Relay push producenta silnika dla aplikacji mobilnej (`STATUS-2026-10-03.md` pkt 6). Logi Workera z `from`/`to` przy błędzie.
- Niezgodność: Polityka każe pisać na `support@` w sprawach danych (§ 1, § 5), ale nie informuje, że korespondencja trafia do Google (konto konsumenckie, USA, bez umowy powierzenia), ani jak długo jest przechowywana.
- Kierunek: **decyzja właściciela**. Wyłączyć kopię na Gmail, gdy PP Support będzie stabilny, albo przenieść archiwum do usługi z DPA. Ustalić retencję rozmów. Opisać w Polityce (cel: obsługa zapytań, podstawa: art. 6 ust. 1 lit. f/c, odbiorcy, okres). Agent AI tylko po decyzji i z wpisem w Polityce. **[PRAWNIK]**: Gmail konsumencki jako archiwum danych osób trzecich.
- Nakład: S (konfiguracja) + tekst.

**LEG-08 | P1 | Dane osobowe u wycofanych dostawców, bez celu**
- Dokument: Polityka wymienia Neon, Vercel i Clerk jako aktualnych dostawców (`LegalDocs.tsx:198-199`).
- Fakty:
  - pełna kopia bazy produkcyjnej na **Neon** z 2026-10-01 (`docs/operations/SERWEREK.md:299`, „nie kasować bez zgody”);
  - rekordy dawnych użytkowników u **Clerka** (wycofany 2026-10-02) oraz tabela `ClerkEvent` z payloadami;
  - pliki w **Vercel Blob** i ewentualne logi projektu Vercel;
  - skrzynka **Google Workspace** do czasu anulowania;
  - endpoint `app/api/comments/image-upload/route.ts` nadal wysyła pliki do Vercel Blob.
- Niezgodność: usunięcia kont i sprostowania po 2026-10-01 nie docierają do tych kopii, co narusza ograniczenie przechowywania i prawo do usunięcia.
- Kierunek: **decyzja właściciela**, potem porządki. Wyeksportować to, co potrzebne, i skasować dane u Neon, Clerk, Vercel Blob i w Workspace (usuwanie kont i projektów wymaga zgody właściciela; zgodne z planem z `STATUS-2026-10-03.md` pkt 3). Wyczyścić `ClerkEvent.payload`. Usunąć endpoint uploadu do Blob. Do tego czasu Polityka powinna uczciwie mówić, że dane są tam w trakcie usuwania.
- Nakład: S–M.

### P2

**LEG-10 | P2 | Telemetria oglądania nieopisana; skróty IP/UA bez soli**
- Kod: `app/api/videos/[id]/playback-event/route.ts:31-36`, `app/api/media-source/[videoId]/route.ts:54-55`, modele `VideoPlaybackSession`/`VideoPlaybackEvent`/`VideoView`.
- Niezgodność: Polityka nie wspomina o historii oglądania (kto, co, ile, postęp, ustawienia odtwarzacza). Skrót SHA-256 z IPv4 bez soli da się odwrócić, więc to dane osobowe (pseudonimowe), nie „anonimowe”.
- Kierunek: **dokument** (cel: statystyki, liczenie wyświetleń, ochrona linków; podstawa: art. 6 ust. 1 lit. f; retencja) i **kod** (skrót z solą lub HMAC z sekretem rotowanym np. dobowo, minimalizacja pól, retencja z LEG-09).
- Nakład: S–M.

**LEG-11 | P2 | Polityka nie spełnia kilku wymogów informacyjnych art. 13/14 RODO**
- Dokument: `LegalDocs.tsx:135-261` / `:360-486`.
- Brakuje:
  - źródła danych przy logowaniu Google (art. 14) i zakresu danych od Google;
  - informacji, czy podanie danych jest wymogiem umownym i jakie są skutki niepodania;
  - informacji o (braku) zautomatyzowanego podejmowania decyzji (Turnstile, HIBP, limity);
  - konkretnego opisu prawnie uzasadnionych interesów;
  - publicznej widoczności pseudonimu, awatara i odznaki;
  - danych 2FA, języka, polubień, powiadomień, subskrypcji i kontaktu w Resend;
  - informacji, że od zgody marketingowej zależy także kontakt w Resend Audience;
  - wskazania kraju transferu i mechanizmu dla każdego odbiorcy (LEG-12).
- Wymóg: art. 13 i 14 RODO ([EUR-Lex, RODO](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).
- Kierunek: **zmienić dokument**. **[PRAWNIK]** do finalnego brzmienia.
- Nakład: S–M.

**LEG-12 | P2 | Transfery poza EOG opisane ogólnikowo; część lokalizacji niezweryfikowana**
- Dokument: `LegalDocs.tsx:204-208` / `:429-433`.
- Fakty:
  - Resend przechowuje dane w USA (SCC + DPF) ([Resend GDPR](https://resend.com/security/gdpr));
  - Stripe: SPEL (IE) + Stripe LLC (USA, DPF) ([Stripe DPF](https://stripe.com/legal/data-privacy-framework));
  - Cloudflare globalnie (DPA ze SCC);
  - Google (USA);
  - buckety miniatur R2 w ENAM (Ameryka Płn.);
  - lokalizacja bucketu `serwerek-backups` (pełne zrzuty baz) **nieznana**;
  - region Neon nieznany.
- Kierunek: **zweryfikować** lokalizacje (panel Cloudflare: location hint lub jurisdiction bucketów; najlepiej kopie baz w EU jurisdiction) i **opisać** w Polityce per odbiorca. Rozważyć szyfrowanie kopii po stronie klienta (rclone crypt), jeśli go nie ma.
- Nakład: S.

**LEG-13 | P2 | Zgoda marketingowa i wypis: mechanika niespójna**
- Kod:
  - wysyłki masowe bez nagłówka `List-Unsubscribe` (`legacy-email-service-provider.ts:230-233`), a maile transakcyjne go mają (`:56-62`); brak jednoklikowego `List-Unsubscribe-Post` (RFC 8058);
  - strona wypisu tylko po angielsku (`app/unsubscribe/page.tsx:16-27`);
  - dialog zgody („Subskrypcja oznacza zgodę na otrzymywanie powiadomień mailowych o nowościach”, `LanguageContext.tsx:157-158`) nie ma linku do Polityki ani informacji o wycofaniu;
  - zgoda zszyta z przyciskiem „Subskrajb” (subskrypcja kanału = zgoda mailowa);
  - brak zapisu brzmienia i wersji zgody (są tylko daty wiersza);
  - prośba o zgodę wyskakuje sama po zalogowaniu (`UnsubscribedEmailConsentPrompt`).
- Dokument: Polityka § 6 („wypisać się w każdej chwili”).
- Kierunek: **zmienić kod** (nagłówki wypisu w wysyłkach masowych, strona wypisu PL/EN, link do Polityki w dialogu, zapis brzmienia zgody i daty). **[PRAWNIK]**: czy zszycie subskrypcji kanału ze zgodą mailową jest dopuszczalne (art. 398 PKE / art. 10 UŚUDE).
- Nakład: S.

**LEG-14 | P2 | Teksty UI sugerują strefę lub benefit „patronów”**
- Kod:
  - nagłówek sekcji „Strefa Fenkjuu”/„Thank You Zone” (`app/components/channel/SidebarPlaylist.tsx:313`);
  - `LanguageContext.tsx:139,142,152` („Mecenat”, „STREFA THANK YOU”);
  - opis strony „materiałami… patronackimi” (`app/layout.tsx:19`) i manifest PWA (`public/manifest.json:4`);
  - ustawienie „Status Patrona” (`app/components/auth/NotificationsAccountSection.tsx:84`);
  - powitanie „dołącz do społeczności patronów” (`send-notification.use-case.ts:74`);
  - slug filmu `dla-patronow` (dane w bazie).
- Dokument: Regulamin § 2 ust. 1 i § 4 ust. 3.
- Kierunek: **zmienić teksty** (neutralne nazwy, np. „Dla zalogowanych”). Slug zmienić tylko z przekierowaniem.
- Nakład: S.

**LEG-15 | P2 | Klauzula zmian Regulaminu (natychmiast, „dalsze korzystanie = akceptacja”)**
- Dokument: `LegalDocs.tsx:117-129` / `:342-354`.
- Ryzyko: wobec konsumentów jednostronna zmiana bez powiadomienia i terminu może być niedozwolona (art. 385³ k.c.). DSA art. 14 ust. 2 wymaga informowania o istotnych zmianach warunków.
- Kierunek: **zmienić dokument** (powiadomienie e-mailem lub w serwisie z wyprzedzeniem, prawo do usunięcia konta przed wejściem zmian). **[PRAWNIK]**.
- Nakład: S.

**LEG-16 | P2 | DSA i moderacja: zgłaszanie i uzasadnienia**
- Dokument: Regulamin § 3 ust. 2 (`LegalDocs.tsx:85-86`): usuwanie treści i blokada konta.
- Kod:
  - zgłaszać może tylko zalogowany (`lib/modules/comments/domain/comment.dto.ts:83`, `report-comment.use-case.ts:23`);
  - autor nie dostaje uzasadnienia ukrycia lub usunięcia, a zgłaszający nie dostaje informacji o decyzji (brak powiadomień w `lib/modules/comments/application/*`);
  - **nie ma funkcji blokady konta**, którą Regulamin zapowiada;
  - Regulamin nie opisuje zasad moderacji (art. 14 DSA);
  - nie wskazano punktu kontaktowego dla organów i użytkowników (art. 11–12); `support@` jest w Regulaminie opisany jako „w sprawach technicznych”.
- Kontekst: polska ustawa wdrażająca DSA (zmiana UŚUDE, ustawa z 4.09.2026, podpisana 28.09.2026, Prezes UKE koordynatorem) ([UODO](https://uodo.gov.pl/pl/138/4587), [UKE](https://uke.gov.pl/uslugi-cyfrowe/aktualnosci/sejm-uchwalil-ustawe-wdrazajaca-przepisy-aktu-o-uslugach-cyfrowych-prezes-uke-koordynatorem-ds-uslug-cyfrowych,26.html)). Art. 11, 12, 14, 16 i 17 dotyczą także mikrodostawców hostingu ([creativa.legal](https://creativa.legal/dsa-obowiazki-aplikacji-saas/)).
- Kierunek: najpierw **[PRAWNIK]**. Czy niekomercyjny serwis osoby fizycznej jest „usługą społeczeństwa informacyjnego” (zwykle świadczoną za wynagrodzeniem)? Jeśli tak: formularz zgłoszeń dostępny także bez logowania, automatyczne uzasadnienie dla autora, informacja zwrotna dla zgłaszającego, punkt kontaktowy w Regulaminie, opis moderacji, rozważenie funkcji blokady.
- Nakład: M.

**LEG-17 | P2 | Pasek „Postęp zbiórki” ustawiany ręcznie (65%)**
- Kod: `app/components/FundraisingProgressBar.tsx:34` (`aria-label` „Postęp zbiórki”), `Video.fundraisingManualPercent` (CLAUDE.md § 4.16: film premierowy ustawiony na 65).
- Niezgodność i ryzyko: pasek sugeruje rzeczywisty postęp zbiórki na konkretny film, a jest wartością wpisaną ręcznie. Może wprowadzać wpłacających w błąd. Wiąże też wsparcie z konkretnym materiałem, co stoi w napięciu z „nie zobowiązuje Twórcy do… publikowania nowych materiałów” (§ 4 ust. 3).
- Kierunek: **decyzja właściciela**. Pokazywać tylko realne dane albo opisać pasek jako orientacyjny lub symboliczny. **[PRAWNIK]**: wprowadzanie w błąd i ewentualne przepisy o zbiórkach.
- Nakład: S.

**LEG-18 | P2 | Zasoby stron trzecich poza Polityką; CSP szersza niż potrzeba**
- Kod:
  - hls.js z `cdn.jsdelivr.net` (wersja `^1.5.0`, ryzyko łańcucha dostaw);
  - fallback awatarów DiceBear z seedem = pseudonim lub ID (`SafeAvatar.tsx:31,52`, `EmbeddedComments.tsx:123`): w przeglądarce blokowany przez CSP, więc ikony są zepsute, a przez `next/image` serwer może sam pobierać z DiceBear;
  - CSP dopuszcza nieużywane hosty: Google Fonts, YouTube, Vimeo, Cloudflare Stream, Unsplash, `img.clerk.com` (`lib/utils/security.ts:21-43,58-66,75,113-115`).
- Kierunek: **zmienić kod** (lokalny hls.js z przypiętą wersją, lokalny domyślny awatar, czystsza CSP po usunięciu providerów), a resztę opisać w Polityce.
- Nakład: S.

**LEG-19 | P2 | Brak minimalnego wieku**
- Dokument i kod: Regulamin i Polityka nie mówią nic o wieku; brak bramki wiekowej.
- Ryzyko: zgoda marketingowa od osoby poniżej 16 lat (art. 8 RODO), umowy z małoletnimi (k.c.), wpłaty małoletnich. **[PRAWNIK]**: jaki minimalny wiek wpisać i czy wpłaty wymagają pełnoletności.
- Kierunek: **dokument** (np. minimalny wiek i zgoda opiekuna) i ewentualnie oświadczenie przy rejestracji lub napiwku.
- Nakład: S.

### P3

**LEG-22 | P3 | Terminologia i drobne rozjazdy wokół wpłat**
- Regulamin mówi „wsparcie (darowizna)”, a UI i maile „napiwek” (`TipDisclaimerStep.tsx:32`, `email-defaults.ts:118-196`). „Napiwek” potocznie oznacza zapłatę za obsługę **[doradca podatkowy]**.
- Maile mówią „Otrzymano i **zaksięgowano**” (`email-defaults.ts:127`).
- § 4 ust. 5 mówi, że „Potwierdzenie wpłaty wysyła operator płatności”, a aplikacja wysyła własne potwierdzenie. Nie wiadomo, czy Stripe wysyła paragony (nie ustawiono `receipt_email`; zależy od ustawień panelu).
- § 4 ust. 6 mówi tylko o „posiadaczu karty”, a dostępne są BLIK, P24, PayPal i Klarna. Klarna (odroczona płatność, kredyt) przy darowiźnie budzi wątpliwości.
- Kierunek: ujednolicić słownictwo i dostosować § 4 ust. 5–6; rozważyć wyłączenie Klarny w panelu Stripe.
- Nakład: S.

**LEG-23 | P3 | Różnice PL vs EN**
- Szczegóły w sekcji 6.
- Kierunek: wyrównać tłumaczenie.
- Nakład: XS.

**LEG-24 | P3 | Jedna data wejścia w życie dla wszystkich dokumentów; brak wersjonowania i archiwum**
- Kod: `LegalDocs.tsx:3-4`.
- Niezgodność: Polityka ma datę „2 października 2026”, a opisuje stan sprzed tej daty. Zmiana jednego dokumentu zmienia datę wszystkich. Nie ma archiwum poprzednich wersji ani numeru wersji (potrzebne do LEG-05).
- Kierunek: osobne daty i wersje per dokument, archiwum poprzednich wersji.
- Nakład: S.

**LEG-26 | P3 | Minimalizacja i bezpieczeństwo**
- Tokeny Google (access, refresh, idToken z imieniem, nazwiskiem i zdjęciem) leżą jawnie w `Account`; Better Auth ma opcję szyfrowania tokenów OAuth.
- Adresy e-mail są logowane jawnie (`send-transactional-email.use-case.ts:90,94`).
- Polityka nie deklaruje środków bezpieczeństwa, więc nie ma sprzeczności. Brakuje jednak informacji o szyfrowaniu kopii zapasowych (nieznane) i o terminacji TLS w Cloudflare.
- Kierunek: kod (szyfrowanie tokenów lub niezapisywanie idToken, maskowanie e-maili w logach); opcjonalnie dokument.
- Nakład: S.

**LEG-27 | P3 | `EmailPreference.marketingEmails @default(true)`**
- Kod: `prisma/schema.prisma:1177`.
- Ryzyko: dziś wiersze powstają tylko przez jawne opt-in lub opt-out, ale domyślna zgoda w schemacie to pułapka na przyszłość.
- Kierunek: migracja domyślnej wartości na `false`.
- Nakład: XS.

---

## 6. Różnice PL vs EN (zdanie po zdaniu)

**Regulamin (§ 1–5):** merytorycznie zgodny. Drobiazgi:
- Oba warianty opisują `support@` jako adres „w sprawach technicznych” (`:46`, `:272`), choć to jedyny kontakt (także prawny, danych, DSA).
- § 4 ust. 6 w obu wersjach mówi tylko o karcie.
- Metadane: PL „reklamacje”, EN „complaints” (sekcji brak w obu).

**Polityka prywatności:**
1. Podsumowanie, punkt 2. PL: „**Niczego nie sprzedajemy** i nie profilujemy Cię reklamowo” (`:151`); EN: „We never sell **your data**…” (`:376`). Znaczenie jest różne: wersja PL brzmi jak „nie prowadzimy sprzedaży”, a EN mówi o danych. Wyrównać do „nie sprzedajemy Twoich danych”.
2. § 5, końcówka. PL: „w ten sposób usuniesz też konto”; EN: „this also deletes your account”. Wersja EN sugeruje, że każdy mail dotyczący praw kasuje konto. Obie wersje są niejasne (LEG-20).
3. § 2, podstawy prawne. PL: „darowizny”; EN: „a gift”. Zgodne, ale w EN lepiej „donation” (tak jak w Regulaminie EN).
4. Reszta (§ 1, 3, 4, 6, 7, 8 i tabele danych) jest merytorycznie zgodna. Obie wersje są tak samo nieaktualne co do dostawców (LEG-01).

**Spójność Regulamin ↔ Polityka:**
- Administrator, adres (ul. Złota 75, 00-819 Warszawa), e-mail (`support@pawelperfect.com`) i data są takie same we wszystkich czterech dokumentach.
- Brak odwołań do nieistniejących paragrafów w treści dokumentów (poza metadanymi o reklamacjach).
- Stopka (`WWW.PAWELPERFECT.COM`), nagłówek maili (`EMAIL_IDENTITY_LINE`) i `Reply-To` są spójne z dokumentami.
- Nie znaleziono w kodzie widocznym dla użytkownika starych `polutek.pl`, `kutashi`, `hello@` ani `support@pawelperfect.pl`.
- Uwagi: miniatury serwowane są z `thumbs.pawelperfect.pl` (domena `.pl`, bez znaczenia prawnego); strona `/unsubscribe` jest tylko po angielsku.

---

## 7. Pytania do właściciela

1. **Neon, Clerk, Vercel Blob, Workspace:** czy zgadzasz się na usunięcie danych osobowych u wycofanych dostawców (po eksporcie, jeśli potrzebny)? Do tego czasu Polityka musi je wymieniać.
2. **Kopia supportu na Gmailu:** czy wyłączamy ją, gdy PP Support będzie stabilny? Jak długo trzymamy rozmowy supportu? Czy agent AI (Anthropic) ma kiedykolwiek czytać korespondencję?
3. **Status „Patron”:** usuwamy odznakę i pierścień całkowicie, czy zostają jako dobrowolne (opt-in) wyróżnienie, co wymaga zmiany § 4 ust. 3 Regulaminu?
4. **One Tap:** zostaje tylko po kliknięciu „Zaloguj”, czy w ogóle rezygnujemy na rzecz zwykłego przycisku Google?
5. **Pasek zbiórki 65%:** pokazujemy realne dane, czy opisujemy pasek jako symboliczny?
6. **Okresy przechowywania:** logi audytu z IP, telemetria oglądania, płatności (zwykle 5 lat podatkowo; potwierdzić z doradcą), korespondencja.
7. **Minimalny wiek** użytkowników i wpłacających.
8. **Lokalizacja bucketu R2 `serwerek-backups`** (pełne zrzuty baz) i czy kopie są szyfrowane po stronie serwera przed wysyłką. Czy możemy przenieść buckety miniatur do lokalizacji UE?
9. **Stripe:** czy w panelu są włączone paragony e-mail (§ 4 ust. 5 Regulaminu)? Czy Klarna i inne odroczone płatności mają zostać przy darowiznach?
10. **Umowy powierzenia:** czy AVV z Hetznerem jest zaakceptowany w panelu konta?
11. **DSA:** czy chcesz formalnej oceny prawnika, czy serwis podlega DSA (charakter niekomercyjny), zanim zbudujemy formularz zgłoszeń dla gości i uzasadnienia moderacji?
12. **Słownictwo:** „napiwek” czy „wsparcie/darowizna” w UI i mailach (spójnie z Regulaminem i oceną podatkową)?
13. **`TEMP_FORCE_ENGLISH`:** kiedy wyłączamy, żeby polscy użytkownicy widzieli wiążącą wersję polską?

---

## 8. Źródła (stan na październik 2026)

- Art. 399 PKE (od 10.11.2024), zgoda na cookies: https://grantthornton.pl/publikacja/prawo-komunikacji-elektronicznej-a-ochrona-danych-osobowych/
- EDPB Guidelines 2/2023 on Technical Scope of Art. 5(3) ePrivacy, v2 (7.10.2024): https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf
- Stripe, cookies i Radar: https://stripe.com/legal/cookies-policy; analiza `__stripe_mid`: https://getconzent.com/cookie/__stripe_mid/; ładowanie Stripe.js tylko tam, gdzie potrzebne: https://www.drupal.org/project/commerce_stripe/issues/3083393
- Stripe DPF i DPA (SPEL w EOG), podprocesorzy: https://stripe.com/legal/data-privacy-framework, https://stripe.com/legal/dpa, https://stripe.com/legal/service-providers
- Resend: dane w USA, SCC + DPF, DPA automatyczna: https://resend.com/security/gdpr, https://resend.com/legal/subprocessors
- Cloudflare Turnstile Privacy Addendum (bez cookies, sygnały IP/TLS/UA): https://www.cloudflare.com/it-it/turnstile-privacy-policy
- Hetzner AVV (zawierane w panelu konta): https://docs.hetzner.com/de/general/general-terms-and-conditions/data-privacy-faq/, https://www.hetzner.com/AV/DPA_en.pdf
- Google Identity Services, One Tap, FedCM: https://developers.google.com/identity/gsi/web/guides/fedcm-migration
- UŚUDE art. 8 (treść regulaminu, tryb reklamacyjny): https://arslege.pl/regulamin-swiadczenia-uslug-droga-elektroniczna/k879/a62684/
- DSA w Polsce (ustawa z 4.09.2026, podpisana 28.09.2026; Prezes UKE koordynatorem): https://uodo.gov.pl/pl/138/4587, https://uke.gov.pl/uslugi-cyfrowe/aktualnosci/sejm-uchwalil-ustawe-wdrazajaca-przepisy-aktu-o-uslugach-cyfrowych-prezes-uke-koordynatorem-ds-uslug-cyfrowych,26.html
- DSA, obowiązki małych dostawców (art. 11, 12, 14, 16, 17): https://creativa.legal/dsa-obowiazki-aplikacji-saas/
- NSA III FSK 113/26 (7.07.2026), wpłaty internetowe jako darowizna: https://www.pit.pl/darowizna/nsa-anonimowe-wplaty-na-internetowe-zbiorki-to-darowizny-nie-pit-fiskus-przegral
- RODO art. 13 i 14: https://eur-lex.europa.eu/eli/reg/2016/679/oj
