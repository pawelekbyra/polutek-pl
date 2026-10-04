# Audyt bezpieczeństwa pawelperfect.com (tylko do odczytu)

Stan: `main` @ `88c787d0` (worktree `dns-migration-cloudflare-bcfaf0`), 2026-10-03. Audytor: agent Claude, bez zmian w repo, bez logowania na serwer, bez wywołań produkcji. Wersje: Next 16.3.8, React 19.2.6, better-auth 1.7.7, stripe 20.4.1, Prisma 6.19.x, sanitize-html 2.17.7. Kod Mux/Stream/YouTube/Vimeo pominięty (PR #1614), wymieniony tylko w „Do usunięcia”.

---

## 1. Podsumowanie (10 zdań)

1. Rdzeń jest zrobiony solidnie: wszystkie 61 tras `/api/admin/**` wołają `requireAdminForApi` (świeża sesja + rola z bazy), proxy dokłada CSRF (Origin/Fetch-Metadata) i limity, a webhook Stripe weryfikuje podpis, ma blokadę idempotencji i porównuje kwotę, walutę, intent i użytkownika przed `fulfillPayment()`.
2. Dostarczanie własnego HLS (`SelfHlsTokenService` + `workers/hls-edge`) jest poprawne: HMAC weryfikowany przez `crypto.subtle.verify` (stałoczasowo), wygasanie, ścisłe regexy ścieżki (brak path traversal), klucz cache bez tokenu, token wydawany dopiero po `checkVideoAccess()` i bramce premiery.
3. Najpoważniejsze znalezisko jest poza kodem: w historii gita leży plik `.env.local` (marzec 2026) z hasłem do bazy Neon, tokenem Vercel Blob z prawem zapisu i kluczem Clerk; jeśli nie zostały zrotowane, to jest P0.
4. Drugie: otwarte przekierowanie po zalogowaniu, bo `sanitizeReturnPath` przepuszcza `/%09/evil.com` (przeglądarka usuwa tabulator i robi z tego `//evil.com`); potwierdzone parserem URL.
5. Trzecie: konto administratora można przejąć przez wspólną skrzynkę helpdesku, bo `hello@` (wg runbooka w `ADMIN_EMAILS`) trafia do PP Support i archiwum Gmail, a reset hasła, zmiana e-maila i logowanie Google opierają się na kontroli nad tą skrzynką.
6. Skradziona sesja wystarczy do trwałego przejęcia konta przez `/api/auth/change-email` (link idzie tylko na nowy adres, stary nie jest pytany ani powiadamiany), choć usunięcie konta słusznie wymaga hasła.
7. CSP nie jest wysyłany na stronie głównej `/` ani żadnej ścieżce bez prefiksu języka (proxy zwraca rewrite przed ustawieniem nagłówka), a sam CSP ma `'unsafe-inline'`, nieużywany `cdn.jsdelivr.net` i brak `form-action`.
8. Optymalizator obrazów Next akceptuje dowolny publiczny Vercel Blob dowolnej firmy i kilka martwych hostów, co daje darmowe proxy/transkoder na 2-rdzeniowym serwerze; do tego nieużywana trasa `/api/comments/image-upload` pozwala każdemu zalogowanemu wrzucać pliki bez limitu.
9. Admin nie ma wymuszonego MFA, kopie bazy z `deploy.sh` powstają z domyślnymi prawami (prawdopodobnie 0644), a kilka drobniejszych spraw (CSRF tylko dla `/api/admin` i `/api/user`, brak escapowania zmiennych w e-mailach, server action bez walidacji) to P3.
10. Zależności: `npm audit --omit=dev` pokazuje tylko 4 umiarkowane w narzędziach testowych (vitest); Next 16.3.8 zawiera poprawki z 30.09.2026, better-auth 1.7.7 to najnowsze wydanie z 30.09.2026.

Świadomie zaakceptowane (nie liczone jako błędy): enumeracja e-maila przy rejestracji (`EMAIL_TAKEN`), brak TOTP dla logowania Google, token HLS jako bearer na 6 h („kontrola dostępu, nie DRM”).

---

## 2. Tabela tras API

Legenda strażnika: **pub** = publiczna; **cookie** = proxy wymaga ciasteczka sesji (optymistycznie, bez walidacji); **sesja** = handler waliduje sesję Better Auth; **aktor** = `getActorFromAuth` (sesja + wiersz w bazie, odrzuca usuniętych); **admin** = `requireAdminForApi` (świeża sesja, `User.role=ADMIN`), plus w proxy CSRF dla mutacji i limit 120/min (ostrzejsze dla refund/broadcast itd.); **cron** = `Bearer CRON_SECRET` (timingSafeEqual); **podpis** = weryfikacja podpisu webhooka; **CSRF-U** = proxy sprawdza Origin dla mutacji `/api/user/*`.

### 2a. Trasy nie-adminowe (46)

| Trasa | Metody | Strażnik | Walidacja / limit | Uwagi |
|---|---|---|---|---|
| `/api/__version` | GET | pub | — | zawsze `development` na serwerku (zmienna Vercel) |
| `/api/access` | GET | pub + aktor (gość dozwolony) | `videoId` wymagany | przez slug omija bramkę premiery (SEC-10, bez wycieku) |
| `/api/auth/[...all]` | * | pub (Better Auth sam: origin check, captcha, rate limit) | Better Auth | `/update-user` wyłączone; `/change-email` włączone (SEC-04) |
| `/api/avatars/[userId]` | GET | pub | — | `nosniff`, `CSP sandbox`, mime z whitelisty, OK |
| `/api/channel/sidebar` | GET | pub + sesja opcjonalna | — | bez cache publicznego, OK |
| `/api/checkout` | GET, POST | cookie; POST = alias create-intent | jak niżej | zbędny alias |
| `/api/checkout/create-intent` | POST | cookie + sesja | zod (`amountMinor` int, waluta enum, `title` 1–120, `requestId` uuid), min/max kwoty, 10/10 min | `title` od klienta trafia do opisu Stripe (SEC-16) |
| `/api/comments` | GET pub; POST/PATCH/DELETE cookie | aliasy do tras niżej | jak niżej | aliasy zbędne |
| `/api/comments/[commentId]` | PATCH, DELETE | cookie + aktor, autor/moderator w use case | zod `text` min 1 (max 2000 w use case) | brak Origin check (SEC-12) |
| `/api/comments/[commentId]/context` | GET | cookie + aktor | — | — |
| `/api/comments/[commentId]/pin` | POST, DELETE | cookie + aktor, admin/twórca w use case | — | — |
| `/api/comments/[commentId]/reaction` | PUT, DELETE | cookie + aktor | typ LIKE/DISLIKE | brak limitu |
| `/api/comments/[commentId]/replies` | GET | cookie + aktor | — | wymaga ciasteczka, choć komentarze mają być publiczne (niespójność funkcjonalna) |
| `/api/comments/[commentId]/report` | POST | cookie + aktor | zod `note` ≤500, limit | — |
| `/api/comments/image-upload` | POST | cookie + aktor | mime z nagłówka klienta, 5 MB, **brak limitu, brak magic bytes** | nieużywana przez UI (SEC-07) |
| `/api/cron/*` (5 tras) | GET | pub + cron | — | OK; logika auth skopiowana 5× |
| `/api/diagnostics/cloudflare-stream` | GET | cookie + `x-health-token` | — | martwa (Stream) |
| `/api/health` | GET | pub; szczegóły tylko z `x-health-token` | — | bez tokenu `{ok:true}`; zbędne `getActorFromAuth` |
| `/api/media-source/[videoId]` | GET | pub + aktor + `checkVideoAccess` + bramka premiery | 60/min/wideo/użytkownik-IP | `no-store`, brak URL przy odmowie (OK) |
| `/api/media/[...path]` | GET | pub? (nie ma na liście publicznej → cookie) + aktor + `getGatedMedia` | 240/min | legacy proxy, przekazuje Content-Type upstreamu (SEC-19) |
| `/api/notifications` | GET, PUT | cookie + sesja | `limit` obcięty do 100; właściciel sprawdzany | — |
| `/api/payment-settings` | GET | pub | — | tylko minima, OK |
| `/api/payments/[paymentId]` | GET | cookie + sesja, `{id,userId}` | — | każde odpytanie = wywołanie Stripe API, brak limitu (SEC-15) |
| `/api/subscriptions` | GET, POST, DELETE | cookie + aktor | limit | — |
| `/api/subscriptions/unsubscribe` | POST | pub + token HMAC (timingSafeEqual, TTL 7 dni) | — | OK |
| `/api/user/account` | DELETE | cookie + CSRF-U + aktor | hasło lub świeże logowanie Google, 5/15 min, ostatni admin chroniony | OK |
| `/api/user/avatar` | PUT, DELETE | cookie + CSRF-U + aktor | data URL ≤120 kB, sygnatura JPEG/PNG/WebP | brak limitu częstotliwości |
| `/api/user/first-sign-in` | POST | cookie + CSRF-U + aktor | nick + avatar; jednorazowe (`onboardingPending`) | — |
| `/api/user/language` | PATCH, POST | cookie + CSRF-U + aktor | `pl`/`en` | OK (ale server action – SEC-14) |
| `/api/user/nickname` | PATCH | cookie + CSRF-U + aktor | reguły nicku, unikalność (bez indeksu, SEC-23) | — |
| `/api/user/notification-preferences` | GET, PATCH | cookie + CSRF-U + sesja | booleany | — |
| `/api/user/profile` | GET | cookie + aktor | — | zwraca tylko język/flagi |
| `/api/user/sync` | GET | cookie + sesja | — | — |
| `/api/users/nickname-available` | GET | pub | limit per IP | wyrocznia dla placeholderów = część lokalna e-maila (SEC-23) |
| `/api/videos/[id]/comments` | GET pub*, POST | cookie (ścieżka nie jest publiczna!) + aktor | zod `text` ≤5000, limit | GET wymaga ciasteczka (niespójne z `/api/comments`) |
| `/api/videos/[id]/playback-event` | POST | pub + aktor opcjonalny | 150/min, pola destrukturyzowane | OK |
| `/api/videos/[id]/thumbnail` | GET | pub; szkice tylko admin | — | Content-Type z upstreamu (SEC-19) |
| `/api/videos/[id]/viewer-state` | GET | cookie + sesja | — | `private, no-store`, OK |
| `/api/webhooks/stripe` | POST | pub + podpis (`constructEvent`) | blokada `StripeEvent`, porównanie kwoty/waluty | OK |
| `/api/webhooks/resend` | POST | pub + podpis svix (wymagany w prod) | body ≤100 kB | OK |
| `/api/webhooks/cloudflare-stream`, `/api/webhooks/mux` | POST | pub + podpis | — | martwe (PR #1614) |

### 2b. Trasy adminowe (61, wszystkie: cookie → CSRF (mutacje) → limit → `requireAdminForApi`; mutacje przez `parseAdminBody` + zod, wymuszone testem statycznym)

| Grupa | Trasy (metody) |
|---|---|
| Kanał/ustawienia | `channel` (GET, PATCH), `settings/media/default-video-thumbnail` (GET, POST, DELETE), `.../proxy` (GET), `payment-settings` (GET, PATCH, limit 10), `stats` (GET), `maintenance/main-channel/{preview GET, apply POST}` |
| Komentarze | `comments` (GET), `comments/[id]/{approve,delete,heart,hide,hold,restore}` (POST), `comments/reports` (GET), `comments/reports/[reportId]/resolve` (POST) |
| E-mail/powiadomienia | `emails/broadcast` (POST limit 3, GET), `emails/responses` (GET, PATCH), `emails/status` (GET), `notifications` (GET), `notifications/broadcast` (POST limit 3), `notifications/templates` (GET, PUT, DELETE), `templates` (GET, POST, DELETE; HTML przez sanitize-html), `subscribers/resync` (POST) |
| Płatności | `payments` (GET), `payments/[id]/refund` (POST, limit 5, pusty body = pełny zwrot, zniekształcony JSON = 400), `payments/[id]/dispute-sync` (POST, limit 5) |
| Użytkownicy | `users` (GET), `users/[userId]` (GET), `users/[userId]/patron` (PATCH, limit 10), `users/export` (GET, CSV – SEC-17), `users/stats` (GET) |
| Wideo | `videos` (GET, POST, DELETE), `videos/[id]` (GET, PATCH), `[id]/actions` (PATCH, POST), `[id]/comments` (GET), `[id]/distribution-plan`, `[id]/media` (GET), `[id]/original-upload` (POST, PATCH), `[id]/original-upload/multipart` (POST, GET, DELETE; limit 20), `.../multipart/parts` (POST), `.../multipart/complete` (POST; weryfikacja rozmiaru i magic bytes w use case), `[id]/pipeline` (GET), `[id]/pipeline/encode` (POST), `[id]/pipeline/jobs/[jobId]` (DELETE), `[id]/pipeline/assets/[assetId]` (DELETE), `[id]/playback-route` (PATCH), `[id]/reconcile` (POST), `cover-upload` (POST, mime z whitelisty bez magic bytes, admin), `reorder`, `resync`, `r2-diagnostics` (GET), `video-provider-jobs/reconcile`, `distribution-backfill`; martwe: `[id]/sources`, `[id]/sources/[sourceId]`, `[id]/sources/mux-upload`, `[id]/provider-jobs/[jobId]/retry`, `[id]/upload`, `health/cloudflare`, `health/mux` |

Nie znalazłem trasy bez strażnika ani IDOR w trasach użytkownika (płatności, powiadomienia, komentarze sprawdzają właściciela). Brak `$queryRawUnsafe`.

---

## 3. Znaleziska (od najpoważniejszych)

### SEC-01 · P0 (warunkowo) · Sekrety produkcyjne w historii gita
- **Gdzie:** plik `.env.local` dodany w `fb89f920` (2026-03-21), zmieniany w `eef0a574`, `dd4f5cc5`, `159550ed`, usunięty w `91b73d38` (2026-03-22). Wartości zamaskowane w tym raporcie.
- **Zawartość (nazwy):** `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `PGPASSWORD`, `POSTGRES_PASSWORD`, `POSTGRES_URL*` (Neon, prefiks `npg_`), `BLOB_READ_WRITE_TOKEN` (Vercel Blob, zapis/odczyt/usuwanie), `CLERK_SECRET_KEY` (`sk_t…`, test), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
- **Ścieżka ataku:** każdy, kto ma lub kiedykolwiek miał dostęp do repo `github.com/pawelekbyra/polutek-pl` (lub do klonu/forka/narzędzia CI z jego kopią), może wyciągnąć dane: `git show 159550ed:.env.local`. Jeśli hasło Neon nie było zmienione, ma pełny dostęp do bazy Neon („przestarzały fallback”, czyli kopia danych użytkowników, e-maili i płatności); token Blob daje odczyt prywatnych blobów (stare miniatury, media legacy) i ich podmianę/usunięcie.
- **Naprawa:** (1) zrotować hasło roli Neon lub usunąć projekt Neon, jeśli już niepotrzebny; (2) unieważnić `BLOB_READ_WRITE_TOKEN` w Vercel (a najlepiej opróżnić i usunąć store po migracji 6 miniatur); (3) usunąć aplikację Clerk; (4) dopiero potem ewentualnie wyczyścić historię (`git filter-repo`), choć rotacja jest tym, co naprawdę zamyka sprawę; (5) dodać `gitleaks` jako hook pre-commit i krok CI.
- **Nakład:** S. **Pewność:** wysoka, że sekrety są w historii; nieznana, czy zostały zrotowane i czy repo jest publiczne (nie sprawdzałem, bo to wywołanie zewnętrznej usługi).
- Dodatkowo w `1baa9893` (skrypt v0 `scripts/unzip.js`) jest presigned URL S3 dostawcy v0 z cudzym `AKIA…` (wygasł po 1 h, to nie nasz klucz): bez działania poza ewentualnym wyczyszczeniem historii.

### SEC-02 · P1 · Otwarte przekierowanie po zalogowaniu (`next`)
- **Gdzie:** `lib/auth/sso-return.ts:8-12` (`sanitizeReturnPath`), użycie: `app/components/auth/AuthModalProvider.tsx:68-69`, `app/sso-callback/page.tsx:22` (`window.location.replace(readReturnPath())`), `app/components/auth/AuthModal.tsx:105-108` (`router.push(next)`).
- **Ścieżka ataku:** atakujący wysyła link `https://www.pawelperfect.com/?signin=1&next=/%09/evil.example/login`. `URLSearchParams` dekoduje `%09` do tabulatora; wartość `"/\t/evil.example/login"` przechodzi wszystkie testy (zaczyna się od `/`, nie od `//`, nie ma `\`). Po zalogowaniu (Google → `/sso-callback`) przeglądarka wykonuje `location.replace`, parser WHATWG usuwa tabulatory/nowe linie i powstaje `//evil.example/login`, czyli `https://evil.example/login`. Sprawdzone: `new URL("/\t/evil.com", "https://www.pawelperfect.com/x").href === "https://evil.com/"`. Ofiara właśnie się zalogowała, więc fałszywe „sesja wygasła, podaj hasło” jest wiarygodne.
- **Naprawa:** walidować przez parser, nie przez prefiksy: `const u = new URL(raw, location.origin); if (u.origin !== location.origin || /[\u0000-\u001F\u007F]/.test(raw)) return "/"; return u.pathname + u.search + u.hash;` (jedna funkcja współdzielona przez klienta i serwer, test z `%09`, `%0a`, `%0d`, `/\\`, `/%5c`).
- **Nakład:** S. **Pewność:** wysoka.

### SEC-03 · P1 · Konto admina zależne od wspólnej skrzynki helpdesku
- **Gdzie:** `lib/api/auth.ts:26-33` (bootstrap `ADMIN_EMAILS` przy każdym żądaniu), `lib/auth/auth.ts:104` (auto-łączenie Google), `workers/support-mail-ingest/worker.mjs:21` (`hello` trafia do PP Support) + kopia do archiwum Gmail; runbook `docs/operations/SERWEREK.md:319` podaje `ADMIN_EMAILS` np. `pawel.perfect@gmail.com,hello@pawelperfect.com`.
- **Ścieżki ataku (każda wymaga tylko odczytu skrzynki `hello@`, którą widzi każdy agent PP Support, przyszły agent AI oraz archiwum):**
  1. „Nie pamiętam hasła” dla konta admina z e-mailem `hello@` → link resetu ląduje we wspólnej skrzynce → nowe hasło → admin.
  2. Zwykły użytkownik woła `POST /api/auth/change-email {newEmail:"hello@pawelperfect.com"}` → link weryfikacyjny trafia do skrzynki; kliknięcie (np. przez agenta, który „sprawdza link”) daje kontu atakującego zweryfikowany adres z `ADMIN_EMAILS` → przy następnym żądaniu `isAdminUser` nadaje `ADMIN`. (Better Auth odmawia, jeśli adres jest już zajęty przez istniejące konto, więc ta ścieżka działa, gdy `hello@` nie ma jeszcze konta w serwisie.)
  3. Po rezygnacji z Google Workspace (planowanej przez właściciela) każdy, kto czyta `hello@`, może założyć konsumenckie konto Google na ten adres (kod weryfikacyjny przychodzi do skrzynki), a Google zwraca `email_verified=true`, więc logowanie Google łączy się z kontem admina (trustedProviders `google`).
- **Naprawa:** w `ADMIN_EMAILS` tylko prywatna skrzynka właściciela, nigdy adres kierowany do helpdesku; bootstrap jednorazowy (tylko gdy w bazie nie ma żadnego admina, potem ignorowany lub wymagający flagi); wymusić TOTP/passkey dla roli ADMIN (SEC-05); rozważyć osobny, nieudostępniany alias logowania admina.
- **Nakład:** S. **Pewność:** średnia (zależy od faktycznej wartości `ADMIN_EMAILS` i tego, kto ma dostęp do PP Support; ścieżki w kodzie potwierdzone).

### SEC-04 · P2 · Skradziona sesja → trwałe przejęcie konta przez zmianę e-maila
- **Gdzie:** `lib/auth/auth.ts:64` (`changeEmail: { enabled: true }` bez `sendChangeEmailConfirmation`); kod biblioteki `node_modules/better-auth/dist/api/routes/update-user.mjs:481-506`: dla zweryfikowanego konta link idzie tylko na NOWY adres.
- **Ścieżka ataku:** ktoś z ważnym ciasteczkiem sesji (XSS na subdomenie, malware, współdzielony komputer) zmienia e-mail na swój, potwierdza go, potem resetuje hasło i wylogowuje ofiarę; stary adres nie dostaje ani pytania, ani powiadomienia. Podobnie `/link-social` pozwala dopiąć własne konto Google. Tymczasem usunięcie konta wymaga hasła (`lib/auth/reauth.ts`), więc ochrona jest odwrócona: łatwiej przejąć niż usunąć.
- **Naprawa:** dodać `user.changeEmail.sendChangeEmailConfirmation` (najpierw potwierdzenie ze starego adresu, potem weryfikacja nowego, zgodnie z dokumentacją Better Auth), wysłać powiadomienie „Twój e-mail został zmieniony” na stary adres, wymagać hasła lub świeżej sesji (np. ≤10 min) dla `change-email`, `link-social`, `two-factor/*`; jeśli UI nie potrzebuje zmiany e-maila, po prostu ją wyłączyć.
- **Nakład:** S. **Pewność:** wysoka.

### SEC-05 · P2 · Brak wymuszonego MFA dla administratora
- **Gdzie:** `lib/api/auth.ts:50-66` (`resolveDbBackedAdminActor` nie sprawdza `twoFactorEnabled` ani metody logowania); Google bez TOTP z decyzji projektowej.
- **Ścieżka ataku:** hasło admina (phishing, wyciek z innej usługi; HIBP sprawdza tylko przy ustawianiu) albo przejęte konto Google daje pełny panel: zwroty, broadcast e-mail do wszystkich, publikacja treści, eksport CSV z e-mailami.
- **Naprawa:** dla `role=ADMIN` wymagać sesji zakończonej TOTP lub passkey (Better Auth plugin `passkey`, osobny „step-up” dla `/admin`); ASVS 5.0 (V6) oczekuje MFA dla kont uprzywilejowanych.
- **Nakład:** M. **Pewność:** wysoka.

### SEC-06 · P2 · CSP nie trafia na `/` i ścieżki bez prefiksu; sam CSP jest słaby
- **Gdzie:** `middleware.ts:136-141` (rewrite zwracany przed `response.headers.set('Content-Security-Policy', …)` w linii 209); `lib/utils/security.ts:83-126`.
- **Ścieżka ataku/błąd:** każde wejście na `https://www.pawelperfect.com/`, `/regulamin`, `/watch/...` dostaje odpowiedź bez CSP (zostają tylko nagłówki z `next.config.mjs`). Tam, gdzie CSP jest, `script-src` ma `'unsafe-inline'` i `https://cdn.jsdelivr.net` (nieużywany w kodzie; pozwala wczytać dowolną paczkę npm, więc każde wstrzyknięcie HTML staje się wykonaniem skryptu), brak `form-action` (wstrzyknięty formularz może wysłać dane na zewnątrz), brak `upgrade-insecure-requests`, dużo martwych hostów (Stream, YouTube, Vimeo, Clerk) i `wss://` dla wszystkiego.
- **Naprawa:** ustawiać nagłówki także na odpowiedzi `NextResponse.rewrite` (wspólna funkcja `withSecurityHeaders(res)`); przejść na `proxy.ts` z nonce + `'strict-dynamic'` (strona i tak jest dynamiczna, więc koszt jest mały); usunąć `jsdelivr`, martwe hosty, dodać `form-action 'self'`, `upgrade-insecure-requests`; wdrożyć najpierw jako `Content-Security-Policy-Report-Only`.
- **Nakład:** S (nagłówek na rewrite) / M (nonce). **Pewność:** wysoka.

### SEC-07 · P2 · Nieużywany upload obrazków w komentarzach
- **Gdzie:** `app/api/comments/image-upload/route.ts:12-49`.
- **Ścieżka ataku:** każdy zalogowany (konto Google zakłada się w sekundę) może w pętli wrzucać pliki do 5 MB do Vercel Blob (jeśli token jest ustawiony; dostęp `public` lub prywatny), bez limitu żądań i bez sprawdzenia zawartości (typ MIME bierze z nagłówka klienta). Darmowy hosting plików na koszt właściciela i ryzyko treści nielegalnych pod jego magazynem. Zwracany URL `/api/comments/image-proxy/...` nie istnieje. UI tej trasy nie używa (tylko test kontraktu).
- **Naprawa:** usunąć trasę (i test). **Nakład:** S. **Pewność:** wysoka co do trasy, średnia co do skutków (zależy od tokenu Blob na serwerku).

### SEC-08 · P2 · Optymalizator obrazów jako otwarte proxy
- **Gdzie:** `next.config.mjs:33-67` (`remotePatterns`: `**.public.blob.vercel-storage.com`, `images.unsplash.com`, `api/www.dicebear.com`, `yellow-elegant-porpoise-917.mypinata.cloud`, `img.clerk.com`, `i.ytimg.com`).
- **Ścieżka ataku:** `GET /_next/image?url=https://<dowolny-klient-vercel>.public.blob.vercel-storage.com/duzy.png&w=3840&q=100` z wieloma wariantami `w`/`q`: serwer (2 vCPU, 1 GB dla app) pobiera i transkoduje cudze obrazy, zapełnia `.next/cache` na dysku. To także proxy dowolnych treści z cudzych blobów pod naszą domeną. Next 16.3.8 ma już poprawkę SSRF w optymalizatorze (CVE-2026-94483), więc chodzi o nadużycie zasobów, nie o sieć wewnętrzną.
- **Naprawa:** zostawić tylko własne hosty (`thumbs.pawelperfect.pl`/R2, ewentualnie własny Blob store konkretnie z nazwy); awatary z dicebear zastąpić lokalnym domyślnym awatarem; rozważyć `images.unoptimized` dla obrazów już przygotowanych (miniatury R2 są statyczne) albo limit w Cloudflare (Rate limiting rule na `/_next/image`).
- **Nakład:** S. **Pewność:** średnia (wzorce potwierdzone, skala DoS szacowana).

### SEC-09 · P2 · Kopie bazy przed wdrożeniem z domyślnymi uprawnieniami
- **Gdzie:** `deploy/serwerek/deploy.sh:99-103` (`mkdir -p /opt/serwerek/backups`, `pg_dump … | gzip > "$dump"`), brak `umask`.
- **Ścieżka ataku:** przy typowym `umask 022` plik ma `0644`, katalog `0755`: pełny zrzut z e-mailami, hashami haseł, sekretami TOTP (szyfrowanymi `BETTER_AUTH_SECRET`) i płatnościami czyta każdy lokalny użytkownik i każdy proces/kontener z zamontowanym `/opt` (serwer jest „AI-managed”, może mieć konta inne niż root).
- **Naprawa:** `umask 077` na początku skryptu, `chmod 700 /opt/serwerek/backups`, szyfrowanie (`age -r <klucz publiczny>`), kopia poza serwerem.
- **Nakład:** S. **Pewność:** średnia (zależy od umask i kont na serwerze).

### SEC-10 · P3 · Bramka premiery omijana przez slug (bez wycieku źródła)
- **Gdzie:** `lib/modules/playback/application/playback.service.ts:144-182` (wideo szukane `findUnique({id})`, bramka premiery tylko `if (video && …)`), `check-video-access.use-case.ts:34-37` (rozwiązuje slug).
- **Skutek:** `/api/access?videoId=<slug-nadchodzącej-premiery>` i `/api/media-source/<slug>` zwracają `hasAccess: true` (nie ma premiery w decyzji); źródło nie wycieka, bo `video` jest `null` i plan kończy się `NO_PRIMARY_ASSET`. To błąd obrony w głąb: jedna zmiana w `PlaybackService` (np. wczytanie po slug) otworzyłaby premierę.
- **Naprawa:** przenieść `isUpcomingPremiere` do `checkVideoAccess()` (jedno miejsce decyzji) i wczytywać wideo raz, tym samym kluczem. **Nakład:** S. **Pewność:** wysoka.

### SEC-11 · P3 · Przestarzałe `requireLocalEmailVerified: false` (pre-hijack)
- **Gdzie:** `lib/auth/auth.ts:104`, osłona `lib/auth/hooks.ts:108-118`.
- **Stan:** opcja wyłącza poprawkę na CVE-2026-53516 / GHSA-g38m-r43w-p2q7 (przejęcie konta przez auto-łączenie OAuth z niezweryfikowanym kontem). Własna osłona (`beforeAccountCreate` usuwa hasło i sesje) obecnie skutecznie zamyka znaną ścieżkę, ale zależy od wewnętrznej kolejności hooków Better Auth i nie obejmuje danych dodanych do konta przed połączeniem (np. przyszłych pól/wtyczek).
- **Naprawa:** wrócić do domyślnego `true` i rozwiązać UX inaczej (przy logowaniu Google usuwać nigdy-niezweryfikowany wiersz z tym e-mailem przed utworzeniem konta) albo `disableImplicitLinking`; test regresyjny dla scenariusza pre-hijack. **Nakład:** M. **Pewność:** wysoka.

### SEC-12 · P3 · Ochrona CSRF tylko dla `/api/admin` i `/api/user`
- **Gdzie:** `middleware.ts:145-148, 159-164`.
- **Ścieżka ataku:** pozostałe mutacje z ciasteczkiem (komentarze, reakcje, zgłoszenia, `checkout/create-intent`, `notifications` PUT, `subscriptions`) polegają tylko na `SameSite=Lax`. Subdomeny `support.`, `video.`, `thumbs.` są „same-site”, więc XSS w obcym oprogramowaniu helpdesku na `support.pawelperfect.com` mógłby pisać komentarze lub tworzyć płatności w imieniu zalogowanych.
- **Naprawa:** to samo `checkAdminCsrf` (Origin + Fetch-Metadata) dla wszystkich mutujących `/api/*` poza `/api/auth`, `/api/webhooks`, `/api/cron`. **Nakład:** S. **Pewność:** wysoka (wymaga kompromitacji subdomeny).

### SEC-13 · P3 · Zmienne w szablonach e-maili bez escapowania HTML
- **Gdzie:** `lib/modules/email/application/send-transactional-email.use-case.ts:10-14, 55-59, 83-84`.
- **Skutek:** `firstName` (imię z Google przed onboardingiem, stare nazwy z Clerk), `email` itd. trafiają do HTML bez escapowania: wstrzyknięcie HTML/linków w mailu wysłanym z naszej domeny (dziś głównie do samego siebie, ale wzorzec jest kruchy przy broadcastach).
- **Naprawa:** escapować wartości dla HTML (osobno dla tematu: bez znaków nowej linii). **Nakład:** S. **Pewność:** wysoka.

### SEC-14 · P3 · Server action `updateUserLanguage` bez walidacji
- **Gdzie:** `lib/actions/user.ts:9-24`.
- **Skutek:** server action to publiczny endpoint; `language` typowany tylko w TypeScript, więc da się zapisać dowolny ciąg (do ~1 MB) w `User.language`; każde wywołanie robi `revalidatePath('/', 'layout')`; w razie błędu zwraca surowy `error.message`.
- **Naprawa:** `z.enum(['pl','en'])`, usunąć `revalidatePath`, zwracać kod błędu; najlepiej usunąć akcję i używać tylko `PATCH /api/user/language` (które waliduje). **Nakład:** S. **Pewność:** wysoka.

### SEC-15 · P3 · Odpytywanie statusu płatności = nielimitowane wywołania Stripe
- **Gdzie:** `app/api/payments/[paymentId]/route.ts`, `get-payment-status.use-case.ts:110-111`.
- **Skutek:** użytkownik z własną płatnością `PENDING` może w pętli wywoływać `paymentIntents.retrieve`; limit Stripe (100 rps na konto) jest wspólny, więc to DoS całego modułu płatności.
- **Naprawa:** limit per użytkownik (np. 30/min) i minimalny odstęp między rekoncyliacjami tej samej płatności (`setNxEx`). **Nakład:** S. **Pewność:** wysoka.

### SEC-16 · P3 · Opis PaymentIntent pochodzi od klienta
- **Gdzie:** `app/api/checkout/create-intent/route.ts:68-76`, `create-checkout-intent.use-case.ts:91`.
- **Skutek:** `title` (do 120 znaków) jest opisem w Stripe, w aplikacji bankowej (BLIK) i na potwierdzeniach; można wstawić dowolny tekst pod marką serwisu.
- **Naprawa:** opis ustawiany po stronie serwera (`Napiwek dla ${APP_NAME}`), pole `title` usunąć ze schematu. **Nakład:** S. **Pewność:** wysoka.

### SEC-17 · P3 · Niepełna ochrona przed formułami w eksporcie CSV
- **Gdzie:** `app/api/admin/users/export/route.ts:29-35`.
- **Skutek:** gałąź dla wartości zaczynających się od `= + - @` nie podwaja `"` (można zamknąć pole i dodać kolumny), a tabulator i `\r` na początku nie są obsługiwane (OWASP CSV Injection). Ryzyko głównie dla starszych nazw/e-maili.
- **Naprawa:** najpierw podwoić `"`, potem dla wiodących `= + - @ \t \r` dodać `'`. **Nakład:** S. **Pewność:** wysoka.

### SEC-18 · P3 · Proxy mediów i miniatur przekazują Content-Type i podążają za przekierowaniami
- **Gdzie:** `lib/blob.ts:184-205`, `lib/modules/media/infrastructure/thumbnail-response.service.ts:45-47, 82, 102-117`.
- **Skutek:** jeśli dozwolony host (lub obiekt w buckecie) zwróci `text/html`/`image/svg+xml`, treść pójdzie z naszej domeny (same-origin XSS); `fetch` domyślnie podąża za przekierowaniem z dozwolonego hosta. Wartości URL ustawia tylko admin, więc ryzyko niskie.
- **Naprawa:** wymusić `Content-Type` z białej listy `image/jpeg|png|webp`/`video/*`, dodać `Content-Security-Policy: sandbox` jak przy awatarach, `redirect: 'manual'`. **Nakład:** S. **Pewność:** średnia.

### SEC-19 · P3 · Limity zapytań: brak trybu awarii i konfiguracja poza repo
- **Gdzie:** `lib/rate-limit.ts:184-191` (wyjątek przy niedostępnym magazynie → 500 na `media-source`, komentarzach, checkout); Redis + SRH żyją tylko w `docker-compose.override.yml` na serwerze (SERWEREK.md:296), nie w repo.
- **Naprawa:** jawny tryb na trasę (odczyt wideo: fail-open z logiem; logowanie i płatności: fail-closed), usługi `redis`/`srh` do `deploy/serwerek/docker-compose.yml`, z czasem bezpośredni klient Redis zamiast bramki REST. **Nakład:** S. **Pewność:** wysoka (kod), średnia (stan serwera).

### SEC-20 · P3 · Placeholder nicku = część lokalna e-maila, brak unikalności w bazie
- **Gdzie:** `lib/auth/hooks.ts:30-33, 43-44`; `update-user-profile.use-case.ts:31-40`.
- **Skutek:** do onboardingu `User.name` to np. `jan.kowalski` z e-maila: widoczne przy komentarzu dodanym przez API przed onboardingiem; `/api/users/nickname-available` staje się wyrocznią „czy ktoś z takim początkiem e-maila nie dokończył rejestracji”; wyścig dwóch żądań może dać dwa identyczne nicki (podszywanie).
- **Naprawa:** neutralny placeholder (`user-<losowe>`), indeks unikalny na `lower(name)` dla aktywnych kont (częściowy), blokada pisania komentarzy przy `onboardingPending`. **Nakład:** S/M. **Pewność:** wysoka.

### SEC-21 · P3 · Łańcuch dostaw kontenerów
- **Gdzie:** `deploy/serwerek/Dockerfile` (`node:22-bookworm-slim`, `mwader/static-ffmpeg:8.0.1` od osoby trzeciej, bez digestów; obraz `worker` z pełnym `node_modules` z devDependencies i całym `app/`), `docker-compose.yml` (`postgres:17-alpine` bez digestu; usługa `migrate` dostaje cały `app.env` ze wszystkimi sekretami).
- **Naprawa:** przypiąć digesty (Renovate), osobny `migrate.env` tylko z `DATABASE_URL`, `npm ci --omit=dev` + `tsx` jako zależność produkcyjna w workerze (lub zbudowany bundle), w compose `read_only: true`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`, `pids_limit`. **Nakład:** S/M. **Pewność:** wysoka.

### SEC-22 · P3 · Higiena konfiguracji
- `next.config.mjs:30` `typescript.ignoreBuildErrors: true`: błędy typów (także w kodzie autoryzacji) trafiają na produkcję niezauważone; CI powinien to łapać `tsc --noEmit`, ale build nie.
- `next.config.mjs:78-79` `X-XSS-Protection: 1; mode=block`: OWASP zaleca `0` lub brak (stary filtr bywał wektorem).
- Brak `Cross-Origin-Opener-Policy: same-origin-allow-popups` (kompatybilne z Google One Tap).
- Logi z adresami e-mail (`send-transactional-email.use-case.ts:90,94`, `handle-resend-webhook.use-case.ts:339`, `send-admin-broadcast-email.use-case.ts:107`, `workers/support-mail-ingest/worker.mjs:87`): maskować (minimalizacja RODO).
- **Nakład:** S. **Pewność:** wysoka.

---

## 4. Lepsze rozwiązania (zweryfikowane na październik 2026)

1. **`middleware.ts` → `proxy.ts` i jedna funkcja nagłówków.** Next 16 nazywa to Proxy i podkreśla, że to tylko optymistyczna kontrola, nie autoryzacja (projekt już waliduje w handlerach, dobrze). Przy okazji naprawić SEC-06: nagłówki na każdej odpowiedzi, także rewrite. Historia CVE pokazuje, że logika w middleware bywa omijana (CVE-2026-64642, CVE-2026-44573, CVE-2026-45109), więc zasada „proxy nigdy nie jest jedyną bramką” musi zostać. Źródła: https://nextjs.org/docs/app/getting-started/proxy, https://github.com/advisories/GHSA-6gpp-xcg3-4w24, https://zeropath.com/blog/cve-2026-44573-nextjs-middleware-bypass
2. **CSP z nonce i `'strict-dynamic'`** generowany w `proxy.ts` (Next wstrzykuje nonce automatycznie do swoich skryptów); strona jest i tak dynamiczna (`force-dynamic`), więc nie tracimy statycznego renderowania. Alternatywa bez nonce: eksperymentalne SRI. Dodać `form-action 'self'`, `upgrade-insecure-requests`, start w trybie Report-Only. Źródła: https://nextjs.org/docs/app/guides/content-security-policy, ASVS 5.0 rozdział V3: https://github.com/OWASP/ASVS
3. **Jeden strażnik CSRF dla wszystkich mutacji** (Fetch Metadata `Sec-Fetch-Site` + Origin), tak jak już działa dla admina; zamiast list wyjątków lepiej odwrócić: wszystko mutujące pod `/api` chronione, poza jawnie wymienionymi (`/api/auth`, `/api/webhooks`, `/api/cron`). Źródło: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
4. **Walidacja ścieżek powrotu parserem URL i porównaniem `origin`** zamiast sprawdzania prefiksów (SEC-02); jedna funkcja dla klienta, serwera i e-maili. Źródło: https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
5. **Better Auth zgodnie z aktualną dokumentacją i poradnikami:** `sendChangeEmailConfirmation` (potwierdzenie ze starego adresu), domyślne `requireLocalEmailVerified: true` (poprawka GHSA-g38m-r43w-p2q7), krótsze `freshAge` dla operacji wrażliwych, passkeys/TOTP obowiązkowe dla admina, bootstrap admina jednorazowy. Wersja 1.7.7 to najnowsze wydanie (30.09.2026) i zawiera m.in. blokadę po 5 błędnych kodach TOTP. Źródła: https://better-auth.com/docs/concepts/users-accounts, https://github.com/advisories/GHSA-g38m-r43w-p2q7, https://better-auth.com/changelog, https://better-auth.com/blog/security-update-june-2026
6. **Webhook Stripe jest zrobiony dobrze** (surowe body, `constructEvent`, idempotencja po `event.id`, porównanie kwoty z lokalnym rekordem). Do rozważenia: obsługa `payment_intent.canceled` i sprawdzanie `event.livemode` względem trybu klucza, szybkie 2xx i przetwarzanie w tle przy dłuższych akcjach. Źródło: https://docs.stripe.com/webhooks
7. **Worker HLS zgodny z zaleceniem Cloudflare** (`crypto.subtle.verify`, wygasanie). Można skrócić TTL tokenu (np. 1–2 h z odświeżaniem planu przez player), żeby skopiowany link żył krócej. Źródło: https://developers.cloudflare.com/workers/examples/signing-requests/
8. **Limity zapytań bez bramki REST:** bezpośredni klient Redis (lub tabela Postgres z `INSERT … ON CONFLICT`) zamiast SRH udającego Upstash; konfiguracja w repo; jawny tryb fail-open/fail-closed na trasę.
9. **Jeden helper „sekret w nagłówku”** dla cronów i diagnostyki (dziś 5 kopii z porównaniem długości UTF-16 zamiast bajtów, co przy wielobajtowym nagłówku daje 500 zamiast 401) oraz jedno źródło prawdy dla listy tras publicznych (np. eksport z modułu tras + test, który sprawdza, że każda trasa jest w dokładnie jednej kategorii).
10. **Sekrety:** `gitleaks` (pre-commit + CI) i skan historii przy każdym PR; kopie bazy szyfrowane `age` i trzymane poza serwerem. Źródło: https://github.com/gitleaks/gitleaks
11. **Szablony e-maili z automatycznym escapowaniem** (np. React Email lub mały renderer z `escapeHtml` dla każdej zmiennej), zamiast `split/join` na surowym HTML.
12. **Nagłówki produkcyjne w jednym miejscu** (Proxy), z testem integracyjnym, który dla `/`, `/pl`, `/regulamin`, `/api/health` sprawdza obecność CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, COOP.

Zależności (stan na 2026-10-03): `npm audit --omit=dev` → 0 low/high/critical, 4 moderate wyłącznie w `vitest`/`@vitest/*` (GHSA-82fw-gwwq-j7x9, narzędzie testowe, nie trafia do obrazu runner). Next 16.3.8 zawiera poprawki z 22.09 (RCE w ImageResponse) i 30.09.2026 (SSRF w optymalizatorze, cache poisoning). Źródła: https://nextjs.org/blog/september-2026-security-release, https://nextjs.org/blog/nextjs-security-update-september-22-2026

---

## 5. Do usunięcia (martwy kod i konfiguracja związana z bezpieczeństwem)

- `app/api/comments/image-upload/route.ts` (SEC-07) i powiązany test kontraktu.
- `lib/data/initial-content.ts` oraz ścieżki `INITIAL_VIDEOS`/`canUseDemoFallbacks` w `check-video-access.use-case.ts:45-58`, `get-gated-media.use-case.ts:40-45`, `playback.service.ts:223-232`, `creator-content.service.ts:75,86` (zawierają publiczne URL-e `pub-…r2.dev` i Unsplash).
- Legacy proxy `app/api/media/[...path]` + `getGatedBlobResponse` w `lib/blob.ts` i gałąź `videoUrl` w `PlaybackService`, gdy żadne wideo nie ma już `videoUrl` (sprawdzić w bazie); `@vercel/blob` po migracji 6 miniatur.
- Kod dostawców (PR #1614): `app/api/diagnostics/cloudflare-stream`, `app/api/admin/health/{mux,cloudflare}`, `app/api/webhooks/{mux,cloudflare-stream}`, `app/api/admin/videos/[id]/sources/**`, `.../provider-jobs/**`, `.../upload`, `lib/security/cloudflare-stream-webhook`, `resolveFallbackSource` w `self-hls-plan.ts` (w tym niepodpisany URL Mux dla PUBLIC), `CloudflareSignedPlaybackTokenService`.
- CSP (`lib/utils/security.ts`): `https://cdn.jsdelivr.net`, `upload.cloudflarestream.com`, `videodelivery.net`, `*.videodelivery.net`, `*.cloudflarestream.com`, `iframe.videodelivery.net`, YouTube, Vimeo, `images.unsplash.com`, `www.dicebear.com`, warianty `wss://` dla hostów HTTP; `img.clerk.com` po przeniesieniu starych awatarów.
- `next.config.mjs` `remotePatterns`: `yellow-elegant-porpoise-917.mypinata.cloud`, `images.unsplash.com`, `api.dicebear.com`, `www.dicebear.com`, `img.clerk.com`, `**.public.blob.vercel-storage.com`, `i.ytimg.com`; nagłówek `X-XSS-Protection`; `ignoreBuildErrors`.
- Zewnętrzne awatary dicebear w `SafeAvatar.tsx:31` i `EmbeddedComments.tsx:123` (wysyłają seed z nazwą/ID do strony trzeciej, a CSP ich i tak nie wpuszcza: `api.dicebear.com` nie jest w `img-src`) oraz `DEFAULT_AVATAR_URL` w `lib/constants.ts:1`.
- Aliasy `app/api/checkout/route.ts` (POST) i `app/api/comments/route.ts` (PATCH/DELETE przez `?id=`) oraz specjalny przypadek `/api/comments` w `middleware.ts:153-155`.
- `lib/auth-utils.ts`: `requireUser` (zawsze rzuca), `verifyAdmin`, `isAdminRequest` (oznaczone jako legacy).
- Ścieżka deweloperska `RESEND_WEBHOOK_DEV_SECRET_AUTH` w `app/api/webhooks/resend/route.ts:76`.
- `app/api/__version` (czyta `VERCEL_GIT_COMMIT_SHA`, na serwerku zawsze `development`) i `scripts/vercel-build.mjs` (`shell: true`) po wyłączeniu Vercel.
- `getActorFromAuth` w `app/api/health/route.ts` (niepotrzebne zapytanie do bazy przy każdym healthchecku Dockera).
- Tabela `ClerkEvent`, `isGeneratedClerkUsername`, wpisy `.env.example` dla Neon/Clerk/Upstash/Blob nieużywane na serwerku.
