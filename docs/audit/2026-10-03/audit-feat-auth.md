# Audyt: logowanie i konta użytkowników (Better Auth), 2026-10-03

Zakres: stan `main` @ `88c787d0`, better-auth 1.7.7 (najnowsza na npm, wydana 2026-09-30), Next 16.3.8, Prisma 6.19.3.
Metoda: lektura kodu (lib/auth, lib/api/auth.ts, app/api/{auth,user,users,avatars}, app/components/auth, middleware.ts,
lib/modules/users, reset-password, sso-callback), lektura źródeł Better Auth w `node_modules/better-auth/dist`
(sign-up, one-tap, link-account, password, update-user, session, two-factor, trusted-origins), testów w `tests/unit/auth`
i `tests/unit/components/auth`, oraz wyłącznie GET-y do produkcji (nagłówki). Niczego nie zmieniałem, nie logowałem się, nie wysyłałem formularzy.

## 1. Podsumowanie i ocena

Ocena ogólna: **dobra baza, niegotowa na "idealny" poziom**. Konfiguracja Better Auth jest przemyślana (weryfikacja e-mail,
brak auto-logowania, HIBP, Turnstile przed endpointami, blokada po nieudanych próbach liczona tylko z porażek, pre-hijack guard,
re-auth przy usuwaniu konta, ochrona ostatniego admina, admin z bazy, CSRF dla `/api/user/*`). Wersja biblioteki jest aktualna,
a krytyczny GHSA-965c-763c-88jm (wydany razem z 1.7.7) i tak nas nie dotyczy (brak magic link).

Najpoważniejsze realne problemy (P1):
1. **Otwarte przekierowanie po logowaniu Google** przez `?next=` ze znakiem tabulacji/nowej linii (sanityzacja nie odrzuca znaków kontrolnych). Potwierdzone w Node: `new URL("/\t/evil.com", base)` daje `https://evil.com/`.
2. **Zmiana e-maila bez ponownego uwierzytelnienia i bez powiadomienia starego adresu**: `/change-email` w Better Auth używa `sensitiveSessionMiddleware` (nie sprawdza świeżości), więc każda ważna sesja (do 30 dni) może trwale przejąć konto.
3. **`/change-email` bez limitu**: zalogowane konto może wysyłać ok. 120 e-maili weryfikacyjnych na minutę na dowolne adresy z naszej domeny Resend.
4. **Modal logowania trzyma e-mail i hasło w stanie React** po zamknięciu, po zalogowaniu i po wylogowaniu (bez przeładowania). Na wspólnym komputerze następna osoba klika "Pokaż" i widzi hasło poprzednika.
5. **Brak CSP na ścieżkach bez prefiksu języka, w tym na `/`** (zweryfikowane na produkcji: `/` nie ma nagłówka `Content-Security-Policy`, `/pl` ma).
6. **Polityka prywatności nadal wymienia Clerk jako dostawcę logowania** i pomija Google (logowanie) oraz HIBP; to rozbieżność prawna, decyzja właściciela.

Liczba znalezisk: **38** (P0: 0, P1: 6, P2: 11, P3: 21).

Świadome decyzje właściciela (nie zgłaszam jako błędy): enumeracja adresów przy rejestracji (`EMAIL_TAKEN`/`EMAIL_TAKEN_GOOGLE`),
brak TOTP dla logowania Google/One Tap (F-07), domyślny avatar także dla kont Google, `freshAge` 1 dzień z komunikatem "zaloguj się ponownie" (F-05),
"zapamiętaj urządzenie" opt-in na 7 dni, One Tap raz dziennie po bramce wejściowej, brak Apple, brak passkeys (na razie).

## 2. Tabela przepływów

| Przepływ | Pliki | Stan | Test zachowania |
|---|---|---|---|
| Rejestracja e-mail + hasło | `AuthModal.tsx` 140-166, `hooks.ts` 40-50, 180-192, `auth.ts` 67-85 | OK (ryzyko: AUTH-04, AUTH-08, AUTH-26) | częściowo (hooki jednostkowo; UI rejestracji i EMAIL_TAKEN bez testu) |
| Istniejący e-mail przy rejestracji | `hooks.ts` 180-192 | OK (decyzja), UX dla niezweryfikowanego "squattera" AUTH-34 | jest (hook, mock) |
| Weryfikacja e-mail, wygasanie, ponowne wysłanie | `AuthModalProvider.tsx` 60-96, `LinkExpiredView.tsx`, `CheckInboxView.tsx`, `auth.ts` 79-85 | OK | jest (provider, CheckInboxView) |
| Logowanie e-mail + hasło, blokada | `AuthModal.tsx` 112-138, `hooks.ts` 141-171, 194-202, `config.ts` 23-27 | OK; ryzyko AUTH-04, AUTH-08, AUTH-12 | jest (hooki); UI tylko częściowo |
| 2FA logowanie, kody zapasowe, zaufane urządzenie | `TwoFactorView.tsx`, `AuthModal.tsx` 199-208 | ryzyko (AUTH-19) | jest (trustDevice) |
| 2FA włączanie/wyłączanie/regeneracja | `SecuritySection.tsx` 127-232 | błąd UX/bezp. (AUTH-13) | jest (regeneracja) |
| Wylogowanie | `sign-out.ts`, `UserMenu.tsx` 113, `AccountModal.tsx` 87-95 | ryzyko (AUTH-04: stan modala) | jest (signOutCompletely) |
| Reset hasła (żądanie + strona) | `AuthModal.tsx` 183-197, `app/reset-password/page.tsx` | OK; UX AUTH-08, AUTH-26, AUTH-30 | **brak** (strona resetu) |
| Zmiana hasła | `SecuritySection.tsx` 28-38, `hooks.ts` 162-164, 203-209 | OK | **brak** |
| Konto tylko-Google ustawia hasło | `SecuritySection.tsx` 40-73 (link resetu), BA `password.mjs` 161 (tworzy credential) | OK; ryzyko AUTH-36 | częściowo (komunikat) |
| Zmiana e-maila | `AccountSections.tsx` 47-88, `auth.ts` 64, `emails.ts` 30-32 | **błąd/bezp.** (AUTH-02, AUTH-03, AUTH-21) | **brak** |
| Google redirect, One Tap, łączenie kont | `AuthModal.tsx` 210-221, `GoogleOneTapPrompt.tsx`, `auth.ts` 87-105, `hooks.ts` 108-118 | OK; ryzyko AUTH-17 | jednostkowo (hook z mockiem), bez testu z prawdziwym `handleOAuthUserInfo` |
| Łączenie Google z kontem (Konta) | `AccountSections.tsx` 92-163 | **błąd UX** (AUTH-09) | **brak** |
| `/sso-callback` | `app/sso-callback/page.tsx` | ryzyko (AUTH-01, AUTH-09) | jest |
| `?next=` / powrót po logowaniu | `sso-return.ts`, `AuthModalProvider.tsx` 68-69, `AuthModal.tsx` 103-110 | **bezp.** (AUTH-01) | jest, ale bez przypadku znaków kontrolnych |
| Onboarding (pseudonim, avatar, e-mail powitalny) | `OnboardingDialog.tsx`, `app/api/user/first-sign-in/route.ts`, `update-user-profile.use-case.ts` 83-98 | ryzyko (AUTH-10, AUTH-11, AUTH-23) | use case jest; **trasa i dialog bez testu** |
| Zmiana pseudonimu / avatara | `ProfileSection.tsx`, `app/api/user/{nickname,avatar}`, `app/api/avatars/[userId]` | ryzyko (AUTH-10, AUTH-15, AUTH-37) | use case i sekcja profilu są; **trasy bez testu** |
| Usuwanie konta (tombstone) | `app/api/user/account/route.ts`, `reauth.ts`, `account-deletion-cleanup.use-case.ts` | OK; drobne AUTH-24, AUTH-35 | jest (trasa, reauth, DangerSection) |
| Sesje: lista, unieważnianie, freshAge | `SecuritySection.tsx` 234-306 | OK; UX AUTH-31 | jest (SESSION_NOT_FRESH) |
| Sprzątanie niezweryfikowanych (cron) | `prune-unverified.ts`, `app/api/cron/prune-unverified-accounts`, timer systemd | OK; AUTH-25 | jest (mock) |
| Bootstrap admina, admin z bazy | `lib/api/auth.ts` 26-115 | OK; AUTH-14, AUTH-27 | jest |
| Język konta | `AuthLifecycleProvider.tsx` 59-67, `LanguageContext.tsx` ~77-96, `lib/actions/user.ts`, `app/api/user/language` | śmieć/duplikat (AUTH-18) | jest (synchronizacja) |
| Proxy: bramka cookie, CSRF, CSP | `middleware.ts` | **bezp.** (AUTH-05) | jest (gating), **brak testu CSP na rewrite** |

## 3. Znaleziska

Format: ID | waga | typ | plik:linia | problem | naprawa | nakład | pewność.

### P1

**AUTH-01 | P1 | bezpieczeństwo | `lib/auth/sso-return.ts:8-12`, `app/components/auth/AuthModalProvider.tsx:68-69`, `app/sso-callback/page.tsx:21-23`**
Problem: `sanitizeReturnPath` przepuszcza `"/\t/evil.com"` i `"/\n/evil.com"` (zaczyna się od `/`, nie od `//`, nie ma `\`). Parser URL (WHATWG) usuwa tab/LF/CR, więc wynik to `https://evil.com/` (sprawdzone w Node). Ścieżka: link `https://www.pawelperfect.com/?signin=1&next=%2F%09%2Fevil.com` -> `AuthModalProvider` zapisuje `next` w sessionStorage -> ofiara klika "Kontynuuj z Google" -> `/sso-callback` robi `window.location.replace(readReturnPath())` -> przekierowanie na obcą domenę tuż po prawdziwym logowaniu (idealny phishing "zaloguj się ponownie"). Ścieżka e-mail nie przekierowuje tylko dlatego, że Better Auth (`isSafeRelativeURL` w `auth/trusted-origins.mjs:68-78`) odrzuca taki `callbackURL` i logowanie się wywraca (to drugi objaw: logowanie e-mailem psuje się błędem ogólnym).
Naprawa: odrzucać znaki kontrolne i porównywać origin: `new URL(raw, location.origin).origin === location.origin` plus test regex `[\u0000-\u001F\u007F]`, zakodowane `%2F`/`%5C` w ścieżce; najlepiej odwzorować `isSafeRelativeURL` Better Auth. Dodać przypadki do `tests/unit/auth/sso-return.test.ts`.
Nakład S. Pewność wysoka.

**AUTH-02 | P1 | bezpieczeństwo | `lib/auth/auth.ts:64`, `app/components/auth/AccountSections.tsx:54-71`; biblioteka `api/routes/update-user.mjs:397`**
Problem: `changeEmail: { enabled: true }` bez `sendChangeEmailConfirmation`. Endpoint `/change-email` wymaga tylko ważnej sesji (`sensitiveSessionMiddleware`, bez `freshAge`, bez hasła). Link idzie wyłącznie na NOWY adres; stary adres nie dostaje ani potwierdzenia, ani powiadomienia; inne sesje nie są unieważniane. Kto ma cookie sesji (kradzież, odblokowany komputer, wspólny komputer) zmienia e-mail na swój, a potem resetuje hasło: trwałe przejęcie konta. OWASP i ASVS wymagają re-auth i powiadomienia przy zmianie identyfikatora.
Naprawa: (a) `user.changeEmail.sendChangeEmailConfirmation` (zatwierdzenie z obecnego adresu, wspierane przez BA 1.7.7), (b) before-hook na `/change-email` wymagający hasła lub sesji młodszej niż `freshAge`, (c) e-mail "Twój adres został zmieniony" na stary adres po zmianie, (d) unieważnienie pozostałych sesji, (e) audyt `AUTH_EMAIL_CHANGED`.
Nakład M. Pewność wysoka.

**AUTH-03 | P1 | bezpieczeństwo (nadużycie poczty) | `lib/auth/auth.ts:119-126`**
Problem: `customRules` nie obejmuje `/change-email`, więc obowiązuje domyślne 120/min na IP. Każde wywołanie z nowym, nieistniejącym w bazie adresem wysyła e-mail weryfikacyjny przez Resend na dowolny adres. Jedno darmowe konto (np. przez Google) = do ok. 7200 maili/h na obce skrzynki z naszej domeny: reputacja domeny `pawelperfect.com` (EMAIL_DELIVERABILITY) i ryzyko blokady Resend.
Naprawa: `"/change-email": { window: 3600, max: 3 }` plus limit per użytkownik (klucz po userId w hooku), opcjonalnie Turnstile.
Nakład S. Pewność wysoka.

**AUTH-04 | P1 | bezpieczeństwo (wspólny komputer) | `app/components/auth/AuthModal.tsx:47-49, 63-79, 103-110`; `AuthModalProvider.tsx:109`**
Problem: `AuthModal` jest zawsze zamontowany w providerze; `email`, `password`, `confirmPassword` żyją w jego stanie. Efekt otwarcia (63-79) czyści tylko `code`, `confirmPassword`, błędy; `finishSignedIn` niczego nie czyści, a wylogowanie (`signOutCompletely` + `router.refresh()`, bez przeładowania) nie odmontowuje modala. Ścieżka: A loguje się hasłem, wylogowuje, odchodzi; B otwiera "Zaloguj się" w tej samej karcie: pola mają e-mail i hasło A, przycisk "Pokaż" ujawnia hasło. Projekt ma jawny cel "shared computers" (sign-out.ts).
Naprawa: czyścić `email/password/confirmPassword/code` przy każdym otwarciu i po sukcesie; najprościej montować formularz z `key` zależnym od licznika otwarć; przy wylogowaniu robić twarde przeładowanie (`window.location.assign`).
Nakład S. Pewność wysoka.

**AUTH-05 | P1 | bezpieczeństwo | `middleware.ts:136-141` (oraz 98-109)**
Problem: dla każdej ścieżki bez prefiksu języka (`/`, `/watch/...`, `/regulamin`, ...) middleware zwraca `NextResponse.rewrite` od razu, przed ustawieniem `Content-Security-Policy` (linie 198-210). Produkcja: `GET /` -> 200 bez CSP (jest `x-middleware-rewrite: /pl`), `GET /pl` -> CSP jest. Strona główna, gdzie działa modal logowania, One Tap i Turnstile, nie ma CSP; każdy XSS tam to kradzież sesji przez API. Ta sama gałąź pomija też optymistyczną bramkę cookie dla stron chronionych bez prefiksu (mniejsza waga, bo prawdziwa kontrola jest w handlerach).
Naprawa: ustawiać CSP (i `x-request-id`) także na odpowiedzi rewrite, albo przenieść rewrite po bramce i nagłówkach. Test w `middleware-gating.test.ts`, że `/` ma CSP.
Nakład S. Pewność wysoka.

**AUTH-06 | P1 | zgodność/dokumentacja prawna | `app/components/legal/LegalDocs.tsx:196-199` (PL), `:423` (EN)**
Problem: polityka prywatności podaje "Clerk (logowanie)", Vercel, Neon, Upstash, a nie podaje Google (logowanie i One Tap: Google dostaje identyfikator i e-mail), Cloudflare Turnstile (wprost), ani Have I Been Pwned (prefiks skrótu hasła wysyłany do api.pwnedpasswords.com). Od 2026-10-02 logowanie jest u nas, hosting to serwerek. RODO art. 13: informacja o odbiorcach jest nieprawdziwa.
Naprawa: decyzja i tekst właściciela; propozycja: usunąć Clerk/Vercel/Neon/Upstash, dodać Google (logowanie), Cloudflare (Turnstile, Tunnel, R2), HIBP (tylko k-anonimowy prefiks), Hetzner (serwer). Zmienić datę obowiązywania.
Nakład S. Pewność wysoka.

### P2

**AUTH-07 | P2 | dokumentacja/operacje | `docs/architecture/auth-better-auth.md:175-177`; biblioteka `plugins/two-factor/index.mjs:26`**
Problem: dokument mówi, że po rotacji `BETTER_AUTH_SECRET` użytkownicy z 2FA "will need backup codes". Better Auth szyfruje kody zapasowe tym samym sekretem (`storeBackupCodes: "encrypted"`), więc po rotacji nie zadziała ani TOTP, ani kody: pełna blokada kont z 2FA (w tym admina, jeśli włączy 2FA). Ponadto linki resetu hasła to rekordy w `Verification`, rotacja ich nie unieważnia (tekst twierdzi inaczej).
Naprawa: poprawić dokument; procedura rotacji = wcześniejsze wyłączenie/odszyfrowanie i ponowne zaszyfrowanie sekretów 2FA albo ponowne włączenie 2FA przez użytkowników; rozważyć osobny klucz do szyfrowania 2FA.
Nakład S. Pewność wysoka.

**AUTH-08 | P2 | błąd/UX | `AuthModal.tsx:112-221`, `SecuritySection.tsx:28-38, 40-54, 146-192`, `AccountSections.tsx:54-71, 106-111`, `app/reset-password/page.tsx:24-33`**
Problem: `@better-fetch/fetch` (`dist/index.js:456`) wywołuje `fetch` bez łapania wyjątku sieciowego, więc `authClient.*` rzuca przy braku sieci/zerwanym połączeniu. Handlery nie mają `try/finally`: `loading` zostaje `true`, przycisk na zawsze z kręciołkiem i wyłączony, brak komunikatu (telefon w tunelu, wifi w pociągu). Nieobsłużone odrzucenie promise.
Naprawa: jeden pomocnik `runAuthCall()` z `try/catch/finally`, komunikat "Brak połączenia. Spróbuj ponownie."; albo `fetchOptions: { throw: false }`/`catchAllError` w kliencie.
Nakład M. Pewność wysoka.

**AUTH-09 | P2 | błąd/UX | `app/components/auth/AccountSections.tsx:109`, `app/sso-callback/page.tsx:19-23`**
Problem: "Połącz z Google" woła `linkSocial` bez `errorCallbackURL`. Przy błędzie (inny e-mail w Google = `email_doesn't_match`, konto Google już przypięte do innego użytkownika) Better Auth idzie na `/api/auth/error`, które (sprawdzone na produkcji) przekierowuje na `/?error=email_doesn%27t_match`; `AuthModalProvider` zna tylko kody linków weryfikacyjnych, więc użytkownik ląduje na stronie głównej bez słowa. Dodatkowo `/sso-callback` przekierowuje zalogowanego użytkownika zanim pokaże błąd (efekt z 21-23 nie patrzy na `failed`).
Naprawa: `errorCallbackURL: "/sso-callback?error=..."`, w `/sso-callback` najpierw obsłużyć `error` (mapowanie kodów na PL/EN, np. "To konto Google ma inny e-mail"), dopiero potem przekierować; ustawić `onAPIError.errorURL` na własną stronę.
Nakład S. Pewność wysoka.

**AUTH-10 | P2 | błąd/bezpieczeństwo (F-11) | `lib/modules/users/application/update-user-profile.use-case.ts:30-39, 83-98`, `check-nickname-availability.use-case.ts:16-19`, `prisma/schema.prisma` (brak indeksu)**
Problem: unikalność pseudonimu to tylko `findFirst` przed `update` (check-then-act); dwa równoległe zapisy biorą ten sam pseudonim. Do "zajętych" liczą się też pseudonimy-placeholdery kont w onboardingu i niezweryfikowanych (lokalna część e-maila, np. `jan.kowalski`, albo pełne imię z Google), więc ktoś rejestrując `admin@...`/`pawelperfect@...` blokuje te nazwy na 7 dni, a prawdziwi użytkownicy dostają fałszywe "zajęty". Brak listy zastrzeżonych nazw (np. nazwa twórcy, "admin", "moderator") i brak ochrony przed homoglifami (dozwolone litery dowolnego alfabetu, NFC zamiast NFKC + sprawdzania mylących znaków), co ułatwia podszywanie się w komentarzach.
Naprawa: deduplikacja istniejących nazw, potem częściowy indeks unikalny `CREATE UNIQUE INDEX ... ON "User"(lower(name)) WHERE "isDeleted" = false AND "onboardingPending" = false` (migracja addytywna), obsługa P2002 jako `NICKNAME_TAKEN`; placeholder trzymać poza `name` (lub z prefiksem nieprzechodzącym walidacji) i nie liczyć go w sprawdzeniu; lista zastrzeżonych nazw; NFKC i sprawdzanie skryptów mieszanych.
Nakład M. Pewność wysoka.

**AUTH-11 | P2 | prywatność (F-11, druga połowa) | `lib/auth/hooks.ts:40-49`; brak sprawdzenia w `lib/modules/comments`**
Problem: `onboardingPending` wymusza tylko dialog w przeglądarce. Wywołanie API bezpośrednio (komentarz, reakcja) działa z nazwą-placeholderem: dla e-maila to lokalna część adresu (ujawnia część e-maila publicznie), dla Google pełne imię i nazwisko z Google. Grep: `onboardingPending` nie występuje w żadnym module poza profilem.
Naprawa: w `resolveDbBackedActor` lub w use case'ach komentarzy odrzucać zapisy z nazwą użytkownika, gdy `onboardingPending` (kod `ONBOARDING_REQUIRED`); placeholder neutralny ("Nowy użytkownik").
Nakład M. Pewność wysoka.

**AUTH-12 | P2 | dostępność usługi | `lib/rate-limit.ts:77-99, 101-121`, `lib/auth/rate-limit-storage.ts:16-32`, `lib/auth/hooks.ts:141-158`**
Problem: magazyn limitów to `fetch` do bramki REST bez timeoutu, rzucający przy błędzie. Better Auth woła `consume` dla każdego endpointu poza `/get-session`, a hook blokady woła `peek`/`hit`. Awaria lub zawieszenie bramki Redis = zawieszone lub 500 na logowaniu, rejestracji, wylogowaniu, 2FA, zmianie hasła. Admin ma timeout 700 ms i fail-open, auth nie ma żadnej polityki.
Naprawa: `AbortSignal.timeout(500)`; jawna polityka: dla limitów ogólnych fail-open z logiem i alertem (Turnstile i lockout 2FA w DB nadal chronią), dla `peek` blokady fail-open; metryka/alert w ai-log.
Nakład S. Pewność wysoka.

**AUTH-13 | P2 | bezpieczeństwo/UX | `app/components/auth/SecuritySection.tsx:210-229`**
Problem: jedno pole "Hasło" i jeden `<form onSubmit={disable}>` dla wyłączenia 2FA i dla "Wygeneruj nowe kody zapasowe (wpisz hasło powyżej)". Użytkownik wpisuje hasło, żeby wygenerować kody, naciska Enter: **2FA zostaje wyłączone**. Do tego wyłączenie 2FA wymaga tylko hasła (bez kodu TOTP), a przycisk regeneracji ma rzutowanie `e as unknown as React.FormEvent`.
Naprawa: dwa osobne formularze; wyłączenie wymaga hasła i kodu TOTP lub kodu zapasowego (before-hook na `/two-factor/disable`), potwierdzenie; e-mail "2FA wyłączone".
Nakład S. Pewność wysoka.

**AUTH-14 | P2 | bezpieczeństwo | `lib/api/auth.ts:106-115`, `lib/auth/config.ts:9-11`**
Problem: konto ADMIN (zwroty, broadcast e-mail, dane użytkowników) nie musi mieć MFA; logowanie Google admina z założenia omija TOTP; `requireAdminActor` tylko omija cache cookie (`fresh: true`), sesja admina żyje 30 dni bez wymogu świeżości. To nie podważa decyzji F-07 dla zwykłych widzów, ale dla roli admin jest poniżej ASVS L2.
Naprawa: wymagać dla ADMIN passkey lub TOTP (także po Google: krok TOTP w hooku po `/callback/google` dla `role=ADMIN`), krótsza sesja admina lub step-up (sesja młodsza niż np. 12 h) dla mutacji `/api/admin`.
Nakład M. Pewność średnia (to rekomendacja, nie błąd w kodzie).

**AUTH-15 | P2 | dostępność | `app/components/auth/ProfileSection.tsx:140-143`**
Problem: zmiana zdjęcia to `<label>` z `<input type="file" className="hidden">` (display:none). Etykieta nie jest fokusowalna, input jest poza drzewem fokusu: z klawiatury nie da się zmienić avatara (WCAG 2.1.1).
Naprawa: `sr-only` zamiast `hidden` plus widoczny focus na etykiecie, albo `<button>` wywołujący `inputRef.current.click()`; komunikat o wyniku w `role="status"`.
Nakład S. Pewność wysoka.

**AUTH-17 | P2 | błąd (do weryfikacji danymi) | `prisma/migrations/20261002100000_add_better_auth/migration.sql` (brak normalizacji), BA `link-account.mjs` (`findUserByEmail(email.toLowerCase())`)**
Problem: Better Auth zawsze szuka e-maila po małych literach, a unikalność `User.email` w Postgres rozróżnia wielkość liter. Jeśli któryś wiersz z czasów Clerka ma wielkie litery, pierwsze logowanie Google tej osoby utworzy **drugie konto** (stare z płatnościami, grantami i komentarzami zostaje osierocone), a rejestracja e-mailem również utworzy duplikat. Migracja niczego nie normalizowała.
Naprawa: jedno zapytanie kontrolne `SELECT count(*) FROM "User" WHERE email <> lower(email)`; jeśli > 0, migracja normalizująca (po wykryciu kolizji); docelowo kolumna `citext` lub indeks unikalny na `lower(email)`.
Nakład S. Pewność średnia (zależy od danych, których nie czytałem).

**AUTH-38 | P2 | brak testu | `tests/unit/auth/*`, `tests/integration`**
Problem: wszystkie testy auth to testy jednostkowe z zamockowanym Prisma i Better Auth. Nie ma ani jednego testu na prawdziwym Better Auth + Postgres (pełna rejestracja -> weryfikacja -> logowanie -> 2FA -> reset). Brak testów zachowania dla: zmiany e-maila, strony `/reset-password`, trasy `/api/user/first-sign-in`, tras `/api/user/{nickname,avatar}` i `/api/avatars`, `OnboardingDialog`, widoków rejestracji/zapomnianego hasła/EMAIL_TAKEN w modalu, błędów sieci, CSP na rewrite, znaków kontrolnych w `next`, łączenia Google z prawdziwym `handleOAuthUserInfo` + `beforeAccountCreate`, porównania pseudonimów w Postgres (wielkość liter, polskie znaki, `_`), unieważnienia sesji przy cache cookie 60 s, FK przy kasowaniu w cronie.
Naprawa: job `integration-postgres` (już istnieje w CI) z instancją `auth` i `auth.api.*` (BA ma `test-utils`), plus testy RTL dla brakujących widoków.
Nakład L. Pewność wysoka.

### P3

**AUTH-16 | P3 | UX mobile | `app/components/auth/AuthFormParts.tsx:35`, `AccountSections.tsx:268`** - pola mają `text-[15px]`; iOS Safari powiększa stronę przy fokusie pola poniżej 16 px, modal "skacze". Naprawa: `text-base` (16 px) na inputach. S. Pewność wysoka.

**AUTH-18 | P3 | śmieć/bezpieczeństwo | `lib/actions/user.ts:9-23`, `app/components/auth/AuthLifecycleProvider.tsx:59-67`, `app/components/LanguageContext.tsx:~77-96`, `app/api/user/language/route.ts:39-43`, `lib/auth/auth.ts:61`** - zmiana języka zalogowanego zapisuje się dwa razy (PATCH z `LanguageContext.setLanguage` i server action z `AuthLifecycleProvider`), server action robi `revalidatePath('/', 'layout')` na całą aplikację, nie waliduje `language` w czasie wykonania (typ TS nie chroni server action), zwraca `error.message` do klienta; `POST` "backward compatibility" zbędny; pole `language` przy rejestracji (`input: true`) przyjmuje dowolny string. Naprawa: jedna ścieżka (PATCH), walidacja `pl|en` także w hooku `beforeUserCreate`, usunąć server action i `POST`. S. Wysoka.

**AUTH-19 | P3 | UX | `app/components/auth/TwoFactorView.tsx`, `lib/auth/errors.ts`** - po 10 min ciasteczko `two_factor` wygasa (`INVALID_TWO_FACTOR_COOKIE`), komunikat jest ogólny, a widok 2FA nie ma "Wróć do logowania"; `TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE`, `TOTP_NOT_ENABLED` bez tekstu. Naprawa: przycisk powrotu, mapowanie kodów, przy wygaśnięciu automatyczny powrót do logowania. S. Wysoka.

**AUTH-20 | P3 | UX | `lib/auth/errors.ts:9-56`** - brak tekstów m.in. dla `INVALID_EMAIL`, `FAILED_TO_CREATE_USER` (podwójne kliknięcie rejestracji), `SERVICE_UNAVAILABLE` (captcha), "Email is the same" (bez kodu, w zmianie e-maila), `EMAIL_MISMATCH`, `ACCOUNT_ALREADY_LINKED_TO_DIFFERENT_USER`; `UNKNOWN_ERROR` (linia 51) zawsze opisany jako błąd anty-bota, choć kod nie jest specyficzny dla captcha. Naprawa: uzupełnić mapę, test "każdy kod używany w UI ma PL i EN". S. Wysoka.

**AUTH-21 | P3 | błąd (F-15) | `lib/auth/emails.ts:11-18, 30-32`** - przy zmianie e-maila `user.email` to nowy adres, którego nie ma w bazie, więc mail zawsze po angielsku; ten sam szablon co weryfikacja rejestracji ("potwierdź konto"). Naprawa: przekazywać `userId`/język, osobny szablon `change-email`. S. Wysoka.

**AUTH-22 | P3 | audyt (F-16) | `lib/auth/hooks.ts:88-94`** - `AUTH_SIGN_IN` zapisywany przy każdym utworzeniu sesji, także tymczasowej przed 2FA i przy rotacji sesji po włączeniu/wyłączeniu 2FA. Naprawa: after-hook na ścieżkach logowania (`/sign-in/email` bez `twoFactorRedirect`, `/two-factor/verify-*`, `/callback/google`, `/one-tap/callback`) z `metadata.via`. S. Wysoka.

**AUTH-23 | P3 | błąd | `update-user-profile.use-case.ts:83-98`, `app/api/user/first-sign-in/route.ts:28-31`** - onboarding check-then-update nieatomowy (dwie karty = dwa maile powitalne); mail powitalny tylko dla kont młodszych niż 24 h, więc użytkownik, który kliknął link weryfikacyjny po dobie (ponowne wysłanie), nie dostaje powitania; komentarze mówią "Google only". Naprawa: `updateMany({ where: { id, onboardingPending: true } })` i wysyłka tylko przy `count === 1`; kryterium "pierwszy onboarding", nie wiek konta. S. Wysoka.

**AUTH-24 | P3 | porządek danych | `account-deletion-cleanup.use-case.ts:14-16, 57-60`** - tombstone dostaje adres w prawdziwej domenie `deleted.com` (należy do kogoś); nie są kasowane rekordy `Verification` (oczekujący link resetu po usunięciu konta wciąż utworzy credential dla tombstone'a). Naprawa: domena `.invalid` (RFC 2606), `verification.deleteMany` po `value = userId` i identyfikatorach użytkownika. S. Wysoka.

**AUTH-25 | P3 | audyt/bezpieczeństwo | `lib/auth/prune-unverified.ts:18-30`** - kasuje bez wpisu audytu per wiersz i bez warunku "tylko konto z hasłem" (konto Google z `email_verified=false` od Google też zostanie skasowane). Naprawa: `accounts: { every: { providerId: "credential" } }`, audyt z liczbą i id. S. Wysoka.

**AUTH-26 | P3 | bezpieczeństwo/UX | `lib/auth/config.ts:6`, `AuthModal.tsx:329-358`, `app/reset-password/page.tsx:62-70`, `SecuritySection.tsx:79-80`** - minimum 10 znaków (NIST SP 800-63B-4: 15 dla hasła jako jedynego czynnika); brak wskaźnika siły; na stronie resetu brak "Pokaż" i powtórzenia hasła, w zmianie hasła brak powtórzenia. Naprawa: 12-15 znaków dla nowych haseł (stare działają), wskaźnik (np. zxcvbn-ts, lazy), "Pokaż" wszędzie. S. Wysoka.

**AUTH-27 | P3 | dokumentacja/logika | `lib/api/auth.ts:26-34`** - "jednorazowy bootstrap" promuje przy każdym żądaniu: dopóki e-mail jest w `ADMIN_EMAILS`, degradacja w `/admin/users` jest cofana przy następnym żądaniu; dokument mówi, że zmienna "może zostać". Naprawa: promować tylko gdy w bazie nie ma żadnego ADMIN, albo opisać to wprost. S. Wysoka.

**AUTH-28 | P3 | śmieć (resztki Clerka i martwy kod)** -
`package.json:31` skrypt `clerk:resync` wskazuje nieistniejący plik; `app/api/user/sync/route.ts` (nieużywana trasa, komentarz o Clerku, F-18) i `SyncCurrentUserUseCase`; `getAuthSession`, `requireAdminSession` (`lib/api/auth.ts:9-18, 79-82`, nieużywane), `sessionClaims: null` (`lib/auth/server.ts:47-57`); model `ClerkEvent` (`schema.prisma:186-195`) i komentarze `schema.prisma:12` ("clerkUserId"), `:31-32` (onboarding "tylko Google, e-mail wybiera z góry" - nieprawda), `:951`; kolumna `User.username` i `lib/utils/auth.ts` `isGeneratedClerkUsername` (potrzebne tylko dla starych wierszy: przemianować lub zmigrować dane); `user.repository.ts:17` `findByClerkId`, `get-user-access-profile.use-case.ts:7,33` `clerkId`; `EmbeddedComments.tsx:82-105` `clerkUserProfile`; komentarze w `LanguageContext.tsx:84`, `useCheckoutFlow.ts:48-50`, `resolve-admin-audit-context.ts:9`, `get-payment-status.use-case.ts:37`, `PageRevealGate.tsx:111`, `route-matcher.ts:3`; `scripts/check-architecture.ts:13,62` (`@clerk/nextjs`); `img.clerk.com` w CSP (`lib/utils/security.ts:60`), `next.config.mjs:55`, `media.policy.ts:139,164`, `.env.example:110` (zostawić tylko jeśli w bazie są jeszcze `imageUrl` na Clerka; lepiej przepisać je na domyślny avatar, bo aplikacja Clerka jest wyłączona); `lib/auth/nickname.ts:3` zdanie w komentarzu jest pokaleczone; `OnboardingDialog.tsx:15-19`, `first-sign-in/route.ts:11`, `update-user-profile.use-case.ts:78-82` opisują onboarding jako "Google only". Nakład S. Pewność wysoka.

**AUTH-29 | P3 | dostępność | `AuthFormParts.tsx:1-47` (Field), `AccountModal.tsx:54-68`, `AuthModal.tsx:255-262`** - pola bez `aria-invalid`/`aria-describedby` do komunikatu błędu; przełącznik "Pokaż/Ukryj" ma `aria-pressed` i jednocześnie zmienną etykietę (czytniki mówią podwójnie); zakładki konta to zwykłe przyciski bez `role="tablist"/tab`, `aria-selected`; pierwszy fokus w modalu trafia na "×" zamiast na pole e-mail; pole identyfikatora ma `autocomplete="email"` zamiast zalecanego `username` (menedżery haseł), brak atrybutów `name`. S. Wysoka.

**AUTH-30 | P3 | nadużycia | `lib/auth/auth.ts:119-126`** - reset hasła i ponowna weryfikacja mają limit tylko per IP (5/h); brak limitu per adres, więc rotując IP (z rozwiązanym Turnstile) można zasypać jedną skrzynkę. Naprawa: licznik per hash e-maila (jak w lockoucie), np. 3/h. S. Wysoka.

**AUTH-31 | P3 | UX | `SecuritySection.tsx:249-306`** - lista urządzeń pokazuje surowy User-Agent uciety do 60 znaków, bez czytelnej nazwy, daty utworzenia, IP/kraju; brak "wyloguj wszędzie łącznie z tym urządzeniem". S. Wysoka.

**AUTH-32 | P3 | integralność | migracja `20261002100000_add_better_auth`** - brak unikalności `Account(providerId, accountId)` i `TwoFactor(userId)`; wyścig (podwójny callback, podwójne "Włącz 2FA") może dać duplikaty. Naprawa: indeksy unikalne po sprawdzeniu danych. S. Średnia.

**AUTH-33 | P3 | kruchość | `lib/auth/react.ts:82-86`** - `refreshSession` używa wewnętrznego `authClient.$store.notify("$sessionSignal")`, które może zniknąć w aktualizacji BA. Naprawa: `authClient.getSession({ query: { disableCookieCache: true } })` + `useSession().refetch()`, test kontraktu. S. Średnia.

**AUTH-34 | P3 | UX | `lib/auth/hooks.ts:180-192`** - gdy istniejący wiersz jest niezweryfikowaną rejestracją (np. ktoś wpisał cudzy adres albo sam użytkownik nie kliknął linku), rejestracja mówi "masz już konto". Bezpieczniej i wygodniej: dla niezweryfikowanego wiersza wysłać ponownie link (zmiana hasła dopiero po kliknięciu), zamiast `EMAIL_TAKEN`. M. Średnia.

**AUTH-35 | P3 | błąd brzegowy | `AccountSections.tsx:182-190`, `lib/auth/auth.ts:94`** - "Potwierdź przez Google" przy usuwaniu konta z `prompt: select_account` pozwala wybrać inne konto Google: sesja przełącza się na innego użytkownika (lub tworzy nowe konto) bez ostrzeżenia. Naprawa: `loginHint` z e-mailem bieżącego konta i sprawdzenie po powrocie, że `userId` się nie zmienił. S. Średnia.

**AUTH-36 | P3 | błąd brzegowy | `SecuritySection.tsx:311-315`, `AccountSections.tsx:97-100, 113-122, 174-178`** - błąd `listAccounts` (sieć) jest traktowany jak "brak hasła": konto z hasłem widzi ekran "logujesz się przez Google", a usuwanie konta wysyła pusty body i dostaje `PASSWORD_REQUIRED` bez pola hasła; odłączenie Google bez potwierdzenia. Naprawa: stan błędu z "spróbuj ponownie", dialog potwierdzenia. S. Wysoka.

**AUTH-37 | P3 | nadużycia | `app/api/user/avatar/route.ts:16-29`, `app/api/avatars/[userId]/route.ts`** - brak limitu na zmianę avatara (zapis do DB przy każdym żądaniu, `req.json()` bez limitu rozmiaru ciała) i na publiczny odczyt avatarów (zapytanie do DB na każde żądanie z dowolnym `v`). Naprawa: limit per użytkownik (np. 10/h), odrzucanie `Content-Length` > 200 kB, cache CDN po `v`. S. Wysoka.

## 4. Stan punktów starego audytu (`docs/audit/2026-10-02-auth-flows-audit.md`)

| Punkt | W dokumencie | Stan w kodzie | Uwagi |
|---|---|---|---|
| F-01 `?next=` | fixed | naprawione, ale z luką | `finishSignedIn` i `rememberReturnPathIfNone` działają; sanityzacja przepuszcza znaki kontrolne (AUTH-01). |
| F-02 Turnstile awaria | fixed | naprawione | `TurnstileWidget.tsx` stan `failed` + "Spróbuj ponownie". |
| F-03 linki weryfikacyjne | fixed | naprawione | `AuthModalProvider.tsx` 60-96, `LinkExpiredView`. |
| F-04 Google vs niezweryfikowany wiersz | fixed | naprawione | `requireLocalEmailVerified: false` + guard + cron; uwaga AUTH-25. |
| F-05 freshAge | decided | zgodne z decyzją | `ReauthNotice` dla sesji i odłączania. |
| F-06 lockout | fixed | naprawione | tylko porażki, klucz e-mail+IP i e-mail; zależność od Redis (AUTH-12). |
| F-07 2FA vs Google, trustDevice | decided | zgodne z decyzją | trustDevice opt-in 7 dni. Rekomendacja dla admina: AUTH-14. |
| F-08 kody zapasowe | fixed | naprawione, z błędem UX | regeneracja jest; Enter wyłącza 2FA (AUTH-13). |
| F-09 konta z Clerka | fixed (mail open) | podpowiedź i onboarding nazw są; **jednorazowy mail nadal nie wysłany** | |
| F-10 One Tap | fixed | naprawione | raz na dobę, po bramce, `gsi/style` w CSP (widoczne na produkcji). |
| F-11 unikalność pseudonimu, onboarding po stronie serwera | open | **nadal otwarte (obie części)** | AUTH-10, AUTH-11. |
| F-12 usuwanie konta | fixed | naprawione | hasło / świeże Google, ostatni admin, limit 5/15 min. |
| F-13 onboarding w 2 kartach | fixed | naprawione w UI | wyścig na serwerze nadal (AUTH-23). |
| F-14 język po zmianie użytkownika | fixed | naprawione | duplikat ścieżek zapisu (AUTH-18). |
| F-15 zmiana e-maila | open | **częściowo**: ponowny mail powitalny zniknął (brak `afterEmailVerification`), tekst "verify-sent" poprawiony; **język maila nadal zły** | AUTH-21; dodatkowo poważniejsze AUTH-02, AUTH-03. |
| F-16 audyt AUTH_SIGN_IN | open | **nadal otwarte** | AUTH-22. |
| F-17 prompt zgody | open | poza zakresem kodu auth, nie zmieniono statusu | |
| F-18 drobiazgi | open | **nadal otwarte**: `/api/user/sync` istnieje | AUTH-28. |

## 5. Rozbieżności dokumentacja vs kod

1. `docs/architecture/auth-better-auth.md:39`: trasa `app/api/user/onboarding`; w kodzie `app/api/user/first-sign-in`.
2. `auth-better-auth.md:175-177`: rotacja sekretu "unieważnia linki resetu" (nie: to rekordy DB) i "trzeba będzie kodów zapasowych" (nie zadziałają, też są szyfrowane sekretem) - AUTH-07.
3. `auth-better-auth.md:112` i CLAUDE.md 4.12 opisują zmianę e-maila jako bezpieczną; brak wzmianki, że nie wymaga hasła/świeżej sesji ani nie powiadamia starego adresu - AUTH-02.
4. `auth-better-auth.md:137-140` i CLAUDE.md 4.12 "One-time bootstrap", "variable can stay" - w kodzie promocja przy każdym żądaniu, degradacja niemożliwa - AUTH-27.
5. CLAUDE.md 4.11: server action `updateUserLanguage` "używana przez `ClerkLocalizationProvider.tsx`" - plik nie istnieje, używa jej `AuthLifecycleProvider`; dodatkowo `LanguageContext` woła PATCH, więc zapis idzie dwiema ścieżkami - AUTH-18.
6. CLAUDE.md 4.12 "Language ... persists changes through PATCH /api/user/language" - persistuje także server action.
7. CLAUDE.md sekcja 0 (rebrand) i 5: `GET /api/admin/health/clerk`, "Clerk-based admin works" - trasy nie ma (`app/api/admin/health/` zawiera tylko `cloudflare`, `mux`).
8. CLAUDE.md 8.1 "MX is still Google" vs sekcja 0 "Mail cutover done ... MX ... Cloudflare Email Routing" (dotyczy maili auth: dokąd idą odpowiedzi).
9. CLAUDE.md 2 (Stack): Neon, Vercel Crons, Vercel Blob jako główne - stan to serwerek, lokalny Postgres, systemd timery (dotyczy też tabeli w polityce prywatności - AUTH-06).
10. `prisma/schema.prisma:12, 31-32, 951` - komentarze o Clerku i o tym, że rejestracja e-mail wybiera pseudonim z góry (nieprawda od #1597).
11. `docs/audit/2026-10-02-auth-flows-audit.md` 2.1: "Server: same rules again in `beforeUserCreate` (`NICKNAME_TAKEN`)" - nieaktualne (pseudonim nie jest już podawany przy rejestracji).
12. `app/components/legal/LegalDocs.tsx:196-199, 423` - Clerk jako dostawca logowania - AUTH-06.
13. `lib/auth/nickname.ts:1-5` - komentarz mówi o "sign-up forms", pseudonim nie jest już w formularzu rejestracji.
14. `app/api/users/nickname-available/route.ts:10-12` i `middleware.ts:51-53` - uzasadnienie "formularz na /sso-callback bez sesji" jest nieaktualne (onboarding działa po zalogowaniu); trasa mogłaby wymagać sesji, co usuwa publiczną wyrocznię "czy nick istnieje".

## 6. Lepsze rozwiązania (ze źródłami)

1. **Zmiana e-maila jak w zaleceniach**: zatwierdzenie z obecnego adresu (`user.changeEmail.sendChangeEmailConfirmation` w Better Auth), re-auth, powiadomienie starego adresu, unieważnienie sesji. Źródła: [Better Auth, Users & Accounts: change email](https://www.better-auth.com/docs/concepts/users-accounts), [OWASP Authentication Cheat Sheet (re-authentication, change of e-mail)](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).
2. **Przekierowania tylko przez parsowanie URL i porównanie originu** (z odrzuceniem znaków kontrolnych), najlepiej tą samą funkcją co Better Auth (`isSafeRelativeURL`). Źródła: [OWASP Unvalidated Redirects and Forwards Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html), [WHATWG URL: usuwanie ASCII tab/newline](https://url.spec.whatwg.org/#concept-basic-url-parser).
3. **Passkeys** (`@better-auth/passkey`, WebAuthn): odporne na phishing, bez haseł do wycieku, na telefonach logowanie odciskiem/twarzą. Co dadzą: (a) admin z MFA odpornym na phishing (rozwiązuje AUTH-14 bez TOTP), (b) użytkownicy bez hasła i bez Google, (c) mniej resetów hasła i maili. Koszt: tabela `Passkey` (migracja addytywna), sekcja w "Moje konto", przycisk w modalu, `rpID` = `pawelperfect.com`, test na iOS/Android. Kolejność: najpierw obowiązkowo dla ADMIN, potem opcjonalnie dla wszystkich. Źródła: [Better Auth: Passkey plugin](https://www.better-auth.com/docs/plugins/passkey), [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) (syncable authenticators, phishing resistance).
4. **Hasła**: 15 znaków dla hasła jako jedynego czynnika (NIST SP 800-63B-4), brak reguł złożoności (jest), lista wycieków (jest HIBP), wskaźnik siły, pozwolenie na wklejanie (jest). Źródła: [NIST SP 800-63B-4, 3.1.1](https://pages.nist.gov/800-63-4/sp800-63b.html), [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/).
5. **Haszowanie**: Better Auth używa scrypt N=16384, r=16, p=1 (`@better-auth/utils/dist/password.mjs`), co jest nieco poniżej minimum OWASP (N=2^17, r=8, p=1 lub ekwiwalenty). Można podać własne `password.hash/verify` (np. Argon2id 19 MiB, t=2) z migracją przy logowaniu. Źródło: [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Priorytet niski.
6. **Limity per konto dla maili** (reset, weryfikacja, zmiana e-maila) oprócz per IP. Źródło: [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
7. **CSP z nonce bez `'unsafe-inline'` w `script-src`** (obecnie jest `'unsafe-inline'`), ustawiana dla każdej odpowiedzi HTML, także po rewrite. Źródło: [OWASP Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html), [Next.js: CSP z nonce](https://nextjs.org/docs/app/guides/content-security-policy).
8. **Unikalność w bazie zamiast check-then-act**: indeks unikalny częściowy na `lower(name)` i ewentualnie `citext` dla e-maila; błąd P2002 mapowany na komunikat.
9. **Formularze logowania**: `autocomplete="username"` dla identyfikatora, `current-password`/`new-password`, `name` na polach, czcionka >= 16 px na telefonie, fokus na pierwsze pole. Źródło: [web.dev: Sign-in form best practices](https://web.dev/articles/sign-in-form-best-practices).
10. **Aktualność biblioteki**: 1.7.7 to najnowsza wersja; ostatnie advisories (GHSA-965c-763c-88jm magic link + OAuth state, GHSA-r4xp-prcw-77qf OAuth Proxy, GHSA-qq9h-g4jm-xgf3 magic link/OTP) nas nie dotyczą (te pluginy nie są włączone) lub są naprawione w 1.7.7. Warto dodać automatyczne PR-y aktualizacji `better-auth` i monitorowanie advisories. Źródła: [Better Auth security advisories](https://github.com/better-auth/better-auth/security/advisories), [Better Auth: Security update June 2026](https://better-auth.com/blog/security-update-june-2026).
11. **`lib/auth/react.ts`**: warstwa nadal ma sens jako jedyne miejsce importu klienta auth w komponentach (22 pliki), ale kształt "jak Clerk" (`fullName`, `firstName`, `lastName`, `username`, `primaryEmailAddress`) jest zbędny. Uprościć do `{ id, nickname, email, imageUrl, emailVerified, language, onboardingPending, twoFactorEnabled }`; zmiana dotyczy ok. 8 miejsc (UserMenu, sekcje konta, EmbeddedComments, admin users).
12. **Test integracyjny Better Auth na Postgresie** w istniejącym jobie `integration-postgres`, z `better-auth/test-utils` (obecny w `node_modules/better-auth/dist/test-utils`).

## 7. Kolejność małych PR-ów

1. **PR-1 (bezpieczeństwo, S)**: AUTH-01 (sanityzacja `next` + testy), AUTH-03 (limit `/change-email`), AUTH-04 (czyszczenie stanu modala, twarde przeładowanie przy wylogowaniu), AUTH-05 (CSP na rewrite + test).
2. **PR-2 (M)**: AUTH-02 utwardzenie zmiany e-maila (potwierdzenie ze starego adresu, re-auth, powiadomienie, unieważnienie sesji, audyt) + AUTH-21 (język i osobny szablon).
3. **PR-3 (S)**: AUTH-13 rozdzielenie formularzy 2FA i wymóg kodu przy wyłączaniu; AUTH-19, AUTH-20 mapowanie błędów i powrót z widoku 2FA.
4. **PR-4 (M)**: AUTH-08 wspólna obsługa błędów sieci w formularzach auth; AUTH-36 stany błędów `listAccounts`.
5. **PR-5 (S)**: AUTH-09 `errorCallbackURL` dla `linkSocial`, `/sso-callback` najpierw pokazuje błąd, własny `onAPIError.errorURL`; AUTH-35 `loginHint`.
6. **PR-6 (S)**: AUTH-12 timeout i polityka awarii magazynu limitów; AUTH-30 limity per adres.
7. **PR-7 (S, decyzja właściciela)**: AUTH-06 tekst polityki prywatności.
8. **PR-8 (S, najpierw 1 zapytanie SQL)**: AUTH-17 sprawdzenie i ewentualna normalizacja e-maili.
9. **PR-9 (M)**: AUTH-10 + AUTH-11 pseudonimy: deduplikacja, indeks unikalny, placeholder poza `name`, blokada zapisów przy `onboardingPending`, nazwy zastrzeżone; AUTH-23 atomowy onboarding.
10. **PR-10 (S)**: AUTH-28 sprzątanie resztek Clerka i martwego kodu, AUTH-18 jedna ścieżka zapisu języka, poprawki dokumentacji z sekcji 5 i AUTH-07.
11. **PR-11 (S)**: AUTH-15, AUTH-16, AUTH-29 dostępność i telefon.
12. **PR-12 (S)**: AUTH-22, AUTH-24, AUTH-25, AUTH-27, AUTH-32, AUTH-33, AUTH-37 drobne poprawki danych i audytu.
13. **PR-13 (L)**: AUTH-38 testy integracyjne Better Auth + Postgres i brakujące testy UI.
14. **PR-14 (M, decyzja właściciela)**: AUTH-14 MFA dla admina, potem passkeys (sekcja 6.3); AUTH-26 polityka haseł i wskaźnik siły; AUTH-34, AUTH-31 UX.
