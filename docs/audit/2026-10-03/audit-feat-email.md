# Audyt podsystemu e-maili i powiadomień (pawelperfect.com)

Stan kodu: `main` @ `88c787d0` (2026-10-03). Audyt tylko do odczytu. Produkcja: wyłącznie anonimowe GET (`/unsubscribe`, `/api/webhooks/resend`), DNS z publicznego resolvera 1.1.1.1. Nie logowałem się do Resend ani na serwer, nie wysłałem żadnego maila. Tam, gdzie wniosek wymaga potwierdzenia w bazie lub w panelu Resend, piszę to przy znalezisku.

---

## 1. Podsumowanie i ocena

**Ocena ogólna: 4/10.** Ścieżka maili bezpieczeństwa (weryfikacja, reset, zmiana hasła) jest zbudowana dobrze: fire-and-forget bez wycieku przez czas odpowiedzi, wersja tekstowa, `Auto-Submitted`, brak `List-Unsubscribe` w mailach bezpieczeństwa, linia z tożsamością nadawcy, poprawne SPF/DKIM/DMARC z dopasowaniem. Wszystko wokół tej ścieżki ma jednak poważne luki:

1. **Wypis nie działa na produkcji.** `GET https://www.pawelperfect.com/unsubscribe?token=…` zwraca **404** (sprawdzone 2026-10-03). Middleware przepisuje `/unsubscribe` na `/pl/unsubscribe`, a pod tą ścieżką nie ma strony. Każdy link „Zarządzaj preferencjami email” w mailach powitalnych i podziękowaniach oraz każdy nagłówek `List-Unsubscribe` prowadzi na 404.
2. **Dwa źródła prawdy dla szablonów, a wygrywa to gorsze.** `instrumentation.ts` przy każdym starcie serwera kopiuje `EMAIL_DEFAULTS` do tabeli `EmailTemplate`, a wysyłka zawsze woli kopię z bazy. Przez to na produkcji najpewniej wychodzą zamrożone stare teksty. Poprawki dostarczalności z #1611 (2026-10-02) mogły nie dotrzeć do `verify-email` i `reset-password`. Mail powitalny może nadal reklamować „Strefę Patrona za napiwek”, co kłóci się z modelem darowizny.
3. **Rozsyłki (broadcast) nie nadają się do użytku.** Wysyłka idzie synchronicznie w żądaniu HTTP (limit 100 s Cloudflare). Poleceń do Resend jest 50 naraz przy limicie 10/s, bez ponowień. Nie ma `List-Unsubscribe` ani wymuszonego linku wypisu, a plan Free (100 maili dziennie) jest wspólny z mailami weryfikacyjnymi. Grupy odbiorców w kreatorze są błędnie opisane, a „Ręczna lista” zawsze daje 0 odbiorców.
4. **Webhook Resend jest w praktyce martwy** (`Svix verification failed`). Odbicia i skargi nie trafiają więc do `EmailSuppression`.
5. **Powiadomienia w aplikacji to martwy podsystem** (dzwonek ukryty). Nadal zapisuje użytkownikom teksty „Teraz masz dostęp do pełnej zawartości” za wpłatę i może zepsuć transakcję realizacji płatności.

**Liczba znalezisk: 37** (P0: 2, P1: 6, P2: 15, P3: 14).

---

## 2. Rodzaje maili

| Rodzaj (slug) | Wyzwalacz (ścieżka) | Szablon (źródło faktyczne) | Język | List-Unsubscribe | Testy |
|---|---|---|---|---|---|
| Weryfikacja e-mail (`verify-email`) | Better Auth `emailVerification.sendVerificationEmail` (`lib/auth/auth.ts:84`) → `queueVerificationEmail` (`lib/auth/emails.ts:30`) → `sendVerificationEmail` (`send-transactional-email.use-case.ts:133`) | wiersz `EmailTemplate` z bazy (zasiany przez `instrumentation.ts`), dopiero potem `EMAIL_DEFAULTS` | `User.language` przez `languageFor()`; brak wiersza lub błąd → `en` (`lib/auth/emails.ts:11-18`) | nie (dobrze) | `tests/unit/auth/auth-emails.test.ts`, `email-templates.test.ts`, `email-content.test.ts` |
| Reset hasła (`reset-password`) | `sendResetPassword` (`lib/auth/auth.ts:75`) → `queuePasswordResetEmail` | jw. | jw. | nie | jw. |
| Hasło zmienione (`password-changed`) | `lib/auth/hooks.ts:206,216` → `queuePasswordChangedEmail` | jw. | jw. | nie | `auth-emails.test.ts` |
| Powitalny (`welcome-email`) | `POST /api/user/first-sign-in` (`app/api/user/first-sign-in/route.ts:29`), gdy konto ma < 24 h | jw. | `pl` gdy `User.language==='pl'`, inaczej `en` | tak, URL prowadzi na **404** | `system-email-consent-boundary.test.ts` (częściowo) |
| Podziękowanie za napiwek (`become-patron` / `thank-you-donation`) | `fulfillPayment()` po pierwszej realizacji (`fulfill-payment.use-case.ts:166-168`) | jw.; dwa prawie identyczne szablony | `User.language`, domyślnie `pl` | tak, **404** | `fulfill-payment.test.ts`, `webhook-orchestration.test.ts` |
| Konto usunięte (`account-deleted`) | `account-deletion-cleanup.use-case.ts:96` | jw. | **zawsze PL** (brak parametru języka, `send-transactional-email.use-case.ts:111`) | nie (odbiorca już zanonimizowany) | `account-deletion-cleanup.use-case.test.ts` |
| Rozsyłka (broadcast) | `POST /api/admin/emails/broadcast` → `sendAdminBroadcastEmail` → `LegacyEmailServiceProvider.sendBroadcast` (synchronicznie) | treść wpisana w kreatorze (opcjonalnie skopiowana z szablonu) | `User.language` odbiorcy (`subjectEn`/`htmlEn` zastępowane wersją PL, gdy puste) | **nie ma** (tylko gdy admin sam wstawi `{{unsubscribeLink}}`) | `send-admin-broadcast-email.test.ts`, `email-service-broadcast-consent-boundary.test.ts`, `admin-broadcast-route.test.ts` |
| Test rozsyłki | `isTest: true` w tej samej trasie → `sendTestEmail` | surowy `htmlPl`, bez obudowy i bez podstawień | tylko PL | nie | `send-admin-broadcast-email.test.ts` |
| Powiadomienia w aplikacji (nie e-mail) | `grant-patron.use-case.ts:87`, `toggle-comment-like.use-case.ts:76`, `POST /api/admin/notifications/broadcast` | `NotificationTemplate` (0 wierszy) lub stałe w kodzie | PL i EN zapisane obok siebie | n/d | **brak testów modułu `lib/modules/notifications`** |

---

## 3. Znaleziska

Format: **ID · waga · typ** · plik:linia · problem · naprawa · nakład · pewność.

### P0

**MAIL-01 · P0 · błąd/RODO/dostarczalność** · `middleware.ts` (`LOCALE_EXEMPT_PATHS` i `shouldRewriteForPolish`, ok. linii 70-90), `app/unsubscribe/page.tsx`
- **Problem:** `/unsubscribe` nie jest w `LOCALE_EXEMPT_PATHS` ani nie zaczyna się od `api|pl|en|admin`. Middleware przepisuje więc ścieżkę na `/pl/unsubscribe`, a tam nie ma strony (`app/[locale]/` nie ma `unsubscribe`). Produkcja, 2026-10-03: `GET /unsubscribe?token=abc.def` → **404**. `/reset-password` i `/sso-callback` są zwolnione z przepisywania i dają 200. To samo przepisanie zepsuło kiedyś `/sso-callback` (commit `e2401f17`).
- **Ścieżka wykonania:** mail powitalny lub podziękowanie → `{{preferencesLink}}` / nagłówek `List-Unsubscribe` → `buildContentUnsubscribeUrl()` (`signed-unsubscribe-token.ts:81`) → `/unsubscribe?token=` → middleware → rewrite → 404.
- **Skutek:** użytkownik nie może się wypisać (art. 21 RODO, wymóg Gmail/Yahoo). Kliknięcie „wypisz” w kliencie poczty kończy się błędem, więc ludzie klikają „spam”.
- **Naprawa:** dodać `'/unsubscribe'` do `LOCALE_EXEMPT_PATHS` i dopisać test middleware (dziś nie ma żadnego testu tej ścieżki). Później przenieść stronę do `app/[locale]/unsubscribe` z tłumaczeniem.
- **Nakład:** S. **Pewność:** bardzo wysoka (sprawdzone na produkcji).

**MAIL-02 · P0 · błąd/dostarczalność/RODO (prawne)** · `instrumentation.ts:1-9`, `scripts/ensure-required-emails.ts:44-71`, `send-transactional-email.use-case.ts:43-81`, `delete-email-template.use-case.ts:22-24`
- **Problem:** `register()` przy każdym starcie Node zakłada brakujące wiersze `EmailTemplate` z bieżącymi `EMAIL_DEFAULTS` i flagą `isSystem: true`. `sendTemplateEmail` zawsze bierze najpierw wiersz z bazy (`template?.subject ?? fallback.subject`). Raz zasiany szablon zamraża więc treść z dnia pierwszego startu. Każda późniejsza zmiana w `lib/email-defaults.ts` nie wychodzi do ludzi. Admin nie może przywrócić domyślnej treści, bo usunięcie szablonu systemowego blokuje `SystemTemplateDeleteError`, a restart i tak zasiałby go ponownie.
- **Co to znaczy w praktyce (do potwierdzenia jednym SELECT-em):**
  - `verify-email` i `reset-password` zostały zasiane przy wdrożeniu #1590 (2026-10-02 02:50). Wtedy temat brzmiał „Potwierdź swój e-mail — {{appName}}” (czyli `www.pawelperfect.com` w temacie), a nagłówek i przycisk miały `text-transform: uppercase`. #1611 (17:52) usunął te rzeczy jako przyczynę wpadania do Junk w Hotmailu, ale jeśli wiersze już istniały, poprawka nie działa.
  - `welcome-email`, `become-patron` i `thank-you-donation` prawdopodobnie pochodzą sprzed 2026-09-26. Mogą więc zawierać „Strefę Patrona — wystarczy wesprzeć projekt jednorazowym napiwkiem”, „Jesteś teraz Patronem 🎉 … stały dostęp” oraz „Twoje wsparcie nie kwalifikowało do statusu Patrona”. To podważa przesłankę darowizny opisaną w CLAUDE.md (NSA III FSK 113/26: brak jakiegokolwiek świadczenia zwrotnego).
  - W bazie może też zostać osierocony wiersz `account-exists` (slug usunięty w #1597, ale z `isSystem: true`, więc nie da się go skasować z panelu).
- **Naprawa:** usunąć zasiewanie z `instrumentation.ts` i z `prisma/seed.ts`. Treść domyślną trzymać tylko w kodzie, a w bazie wyłącznie świadome nadpisania admina (np. kolumna `overriddenAt`; brak nadpisania oznacza kod). Jednorazowa migracja danych powinna usunąć wiersze identyczne z dawnymi domyślnymi albo wszystkie systemowe bez daty edycji przez admina (po pokazaniu właścicielowi różnic). W edytorze dodać „Przywróć domyślny”.
- **Do sprawdzenia przez operatora:** `SELECT slug, "updatedAt", subject FROM "EmailTemplate" ORDER BY slug;`
- **Nakład:** M. **Pewność:** mechanizm bardzo wysoka; treść na produkcji średnio-wysoka (nie widziałem bazy).

### P1

**MAIL-03 · P1 · RODO/dostarczalność** · `lib/modules/subscriptions/domain/signed-unsubscribe-token.ts:5` (`DEFAULT_TTL_SECONDS = 7 dni`)
- **Problem:** link wypisu wygasa po 7 dniach. `SignedContentUnsubscribeUseCase` zwraca wtedy ogólny komunikat i nic nie robi (`signed-unsubscribe.use-case.ts:15-16`). Ktoś, kto kliknie „wypisz” w mailu sprzed tygodnia, dalej jest zapisany i nie dowie się o tym. Praktyka branżowa (CAN-SPAM, Gmail) wymaga, by link działał co najmniej 30 dni. Lepiej, by nie wygasał wcale: token tylko wypisuje, a nadużycie się nie opłaca.
- **Naprawa:** brak terminu ważności, albo 1 rok, plus wersja klucza do rotacji. Wygasły, ale poprawnie podpisany token też powinien wypisywać.
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-04 · P1 · dostarczalność/RODO** · `legacy-email-service-provider.ts:56-62` (nagłówki transakcyjne), `:230-233` (rozsyłka), `app/api/subscriptions/unsubscribe/route.ts:15-18`
- **Problem:** nie ma one-click według RFC 8058. Nigdzie nie ma `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. URL z nagłówka wskazuje stronę `/unsubscribe` (GET z formularzem), a endpoint POST czyta `token` z formularza zamiast z URL-a i nie przyjmuje treści `List-Unsubscribe=One-Click`. Rozsyłki nie mają nagłówka `List-Unsubscribe` w ogóle, tylko `X-Broadcast-Id`/`X-Recipient-Id`. Google i Yahoo wymagają one-click od nadawców masowych (od 2024), a Gmail pokazuje przycisk wypisu tylko wtedy, gdy ten nagłówek jest.
- **Naprawa:** endpoint `POST /api/email/unsubscribe?token=…` przyjmujący `List-Unsubscribe=One-Click` (bez CSRF, bez sesji, 200 bez treści). W nagłówkach `List-Unsubscribe: <https://…/api/email/unsubscribe?token=…>, <mailto:…>` i `List-Unsubscribe-Post`. Dotyczy rozsyłek i maili z opcją wypisu.
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-05 · P1 · RODO/dostarczalność** · `legacy-email-service-provider.ts:197-234`
- **Problem:** rozsyłka nie przechodzi przez `wrapEmailDocument` (brak doctype, `lang`, preheadera i linii tożsamości nadawcy), nie ma wersji `text` i nie wymusza linku wypisu. Link wypisu pojawi się tylko wtedy, gdy admin sam wpisze `{{unsubscribeLink}}`. Prawo komunikacji elektronicznej i RODO (art. 21) wymagają łatwego wypisu w każdej wiadomości marketingowej, a Google wymaga widocznego linku. Podstawienia działają tylko w HTML, nie w temacie.
- **Naprawa:** wspólna funkcja budująca wiadomość (obudowa, tekst, stopka z wypisem i tożsamością dodawana zawsze, nagłówki) dla wszystkich rodzajów maili. Kreator nie powinien przepuścić treści bez stopki.
- **Nakład:** S-M. **Pewność:** wysoka.

**MAIL-06 · P1 · błąd/niezawodność** · `send-admin-broadcast-email.use-case.ts:200-206`, `legacy-email-service-provider.ts:114-286`, `BroadcastWizard.tsx:284-305`
- **Problem:** cała rozsyłka wykonuje się wewnątrz żądania HTTP admina. Dla 1000 odbiorców to 20 paczek po 50, z 1 s przerwy, zapytaniem do bazy i wywołaniem Resend dla każdej osoby, plus wcześniej do 4000 zapytań zgody (MAIL-30). Cloudflare Tunnel zamyka żądanie po 100 s (524). Admin widzi „Błąd wysyłki”, a serwer wysyła dalej. Ponowne kliknięcie tworzy **drugą rozsyłkę** do tych samych osób (brak klucza idempotencji i blokady). Restart kontenera w trakcie zostawia `BroadcastEmail.status = SENDING` i odbiorców `PENDING` na zawsze: nie ma wznowienia ani zadania sprzątającego. Wyniki są nieprawdziwe: `sent: recipients.length` i `skipped: 0` niezależnie od faktycznego wyniku (`send-admin-broadcast-email.use-case.ts:215-223`). Audyt `BROADCAST_CREATED` zapisuje się dopiero po wysyłce, więc przy przerwaniu go nie ma.
- **Naprawa:** kolejka w Postgresie według wzorca `VideoEncodeJob` (`FOR UPDATE SKIP LOCKED`, heartbeat, wznowienie). Trasa tylko tworzy rozsyłkę i zwraca 202. Worker na serwerku wysyła z `idempotencyKey = broadcast/<id>/<recipientId>` (Resend trzyma klucze 24 h), z limitem tempa i ponowieniami 429/5xx. W UI postęp i przycisk „Anuluj” (status `CANCELLED` już jest w enumie). Alternatywa: wyłączyć rozsyłki, dopóki tego nie ma (sekcja 5).
- **Nakład:** M-L. **Pewność:** wysoka.

**MAIL-07 · P1 · błąd/dostarczalność** · `legacy-email-service-provider.ts:139-166`
- **Problem:** `Promise.all` na 50 odbiorcach daje 50 równoległych `emails.send`. Domyślny limit API Resend to 10 żądań na sekundę na zespół (https://resend.com/docs/api-reference/rate-limit), więc większość dostaje 429 i jest oznaczana `FAILED` bez ponowienia. Plan Free to 3000 maili miesięcznie i **100 dziennie** (https://resend.com/pricing). `emails.send` liczy się do tego samego limitu co weryfikacje i resety, więc rozsyłka do 100+ osób blokuje do końca dnia rejestracje i resety haseł, które nie dostają maila.
- **Naprawa:** worker z MAIL-06 z tempem ≤ 5/s albo `resend.batch.send` (do 100 maili na wywołanie, `idempotencyKey` na paczkę), do tego limit dzienny we własnym liczniku z rezerwą na maile bezpieczeństwa. Osobna decyzja: plan Pro albo rozsyłki poza `emails.send` (sekcja 5).
- **Nakład:** M. **Pewność:** wysoka co do mechanizmu; plan konta nieznany.

**MAIL-08 · P1 · bezpieczeństwo/dostarczalność** · `app/api/webhooks/resend/route.ts:58-72`
- **Problem:** w logach produkcji jest `Svix verification failed`. Ten komunikat pada tylko wtedy, gdy przyszły wszystkie trzy nagłówki `svix-*` i sekret jest ustawiony. To więc prawdziwe dostawy Resend z niepasującym podpisem, a nie skanery. Skutki: odbicia i skargi nie trafiają do `EmailSuppression`, statusy odbiorców się nie aktualizują, a ponowienia Resend zalewają log.
- **Prawdopodobne przyczyny, od najbardziej prawdopodobnej:**
  - (a) Inny sekret niż w endpointcie Resend: endpoint utworzony lub odtworzony przy zmianie domeny, albo istnieją dwa endpointy, w tym stary `https://www.pawelperfect.pl/api/webhooks/resend` (EMAIL_SETUP.md:20). Każdy endpoint ma własny sekret.
  - (b) Uszkodzona wartość po przenosinach na serwerek (SERWEREK.md:309 mówi „sekrety przeniesione”), np. `\r` z pliku Windows, cudzysłowy, spacja. Konstruktor `new Webhook(secret)` jest **wewnątrz** `try`, więc zły format sekretu daje ten sam komunikat co zły podpis.
  - (c) Zegar serwera przesunięty o ponad 5 minut (tolerancja Svix).
  - (d) Inny nadawca Svix (np. dawny endpoint Clerka) skierowany na ten URL. Mało prawdopodobne.
  - Surowe body jest czytane poprawnie (`readRequestTextWithLimit`, UTF-8), a Cloudflare Tunnel nie zmienia body POST, więc to nie jest przyczyną.
- **Naprawa:** logować `error.message` (Svix rozróżnia „No matching signature found” i „Message timestamp too old/new”), `svix-id`, różnicę zegara oraz długość i prefiks sekretu (nigdy wartość). Zamiast `svix` użyć `resend.webhooks.verify()` (SDK 6.17 już to ma, MAIL-33). `secret.trim()`. W panelu Resend (właściciel) zostawić jeden endpoint na `.com` i skopiować jego sekret.
- **Nakład:** S. **Pewność:** wysoka co do skutku; przyczyna do potwierdzenia w logach.

### P2

**MAIL-09 · P2 · RODO (prawne)/śmieć** · `lib/modules/notifications/application/send-notification.use-case.ts:69-83`, `grant-patron.use-case.ts:87-94`
- **Problem:** każde przyznanie `PatronGrant` (każdy kwalifikujący się napiwek) zapisuje powiadomienie „Witaj, Patronie! … Teraz masz dostęp do pełnej zawartości”. Szablon `welcome` brzmi „dołącz do społeczności patronów”. Treści są niewidoczne tylko przez ukryty dzwonek, ale `GET /api/notifications` je zwraca. Po zdjęciu flagi `TEMP_HIDE_NOTIFICATIONS_BELL` każdy darczyńca zobaczy obietnicę dostępu za wpłatę, sprzeczną z regulaminem.
- **Naprawa:** usunąć wywołanie w `grant-patron` (lub cały podsystem, MAIL-28) i wyczyścić istniejące wiersze `Notification` z `kind = PATRON`.
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-10 · P2 · błąd** · `grant-patron.use-case.ts:87-94` + `send-notification.use-case.ts:39-65`
- **Problem:** `sendNotification` dostaje `currentTx` i łapie każdy błąd, „żeby nie psuć akcji głównej”. W Postgresie nieudane zapytanie w transakcji ustawia ją w stan aborted (25P02). Kolejne zapytania `grantPatron` (`listActiveGrants`) i commit `fulfillPayment` się wysypią, więc błąd powiadomienia psuje realizację płatności, odwrotnie niż obiecuje komentarz.
- **Naprawa:** wysyłać powiadomienie po commicie, poza transakcją, albo usunąć (MAIL-09).
- **Nakład:** S. **Pewność:** wysoka (zachowanie Postgresa).

**MAIL-11 · P2 · UX/błąd** · `BroadcastWizard.tsx:183-188, 291, 423`, route `broadcast/route.ts:65-74`, `email.repository.ts:19-25`, `email.policy.ts:386-418`
- **Problem:** grupy odbiorców nie odpowiadają opisom.
  - „Wszyscy użytkownicy — wszystkie konta, które nie są usunięte” (`ALL`) trasa mapuje na `ALL_SUBSCRIBERS`, czyli w praktyce to samo co „Subskrybenci”.
  - „Patroni” filtruje po `PatronGrant`, czyli segment darczyńców w modelu, w którym napiwek „nic nie daje”. To wątpliwe (profilowanie po wpłatach) i bezużyteczne.
  - `NON_PATRONS` istnieje w API, ale nie w UI.
  - „Ręczna lista” zawsze daje 0 odbiorców, bo nie ma `userId` (`canReceiveBroadcastEmail` zwraca false, test `send-admin-broadcast-email.test.ts:78` to potwierdza), a UI obiecuje „Odbiorcy zostaną dodani do bazy”. Toast mówi wtedy „Uruchomiono wysyłkę do 0 osób” (`BroadcastWizard.tsx:295`).
- Wszystkie grupy i tak zawężają się do osób z subskrypcją i zgodą, co samo w sobie jest dobre, ale UI tego nie mówi.
- **Naprawa:** jedna grupa „Subskrybenci (zgoda na powiadomienia o treściach)” z liczbą odbiorców przed wysyłką (dry-run już jest w use case, nieużywany w UI). Usunąć `PATRONS`, `NON_PATRONS`, `MANUAL` i `ALL` z UI, API, enumu i testów.
- **Nakład:** S-M. **Pewność:** wysoka.

**MAIL-12 · P2 · bezpieczeństwo** · `send-transactional-email.use-case.ts:10-14, 59-84`, `legacy-email-service-provider.ts:44-48, 209-221`
- **Problem:** `replaceTemplateVariables` wstawia wartości do HTML bez escapowania, choć `escapeHtml` istnieje w `email-content.ts:29`. `firstName` pochodzi z `User.name`/`username`. Nowe pseudonimy są filtrowane (`/^[\p{L}\p{N} _.-]+$/u`), ale stare konta z Clerka i `username` nie, więc możliwe jest wstrzyknięcie HTML lub linku w mailu wysyłanym z naszej domeny. Ten sam pseudonim trafia też do tematu (temat nie wymaga escapowania, ale nie powinien zawierać `\r\n`).
- **Naprawa:** escapować wszystkie zmienne poza zaufanymi URL-ami (`actionUrl`, `appUrl`, `unsubscribeLink`, które też trzeba zakodować w atrybucie). Najlepiej szablony w React Email lub TSX, które escapują same.
- **Nakład:** S. **Pewność:** wysoka co do braku escapowania; praktyczne ryzyko niskie.

**MAIL-13 · P2 · błąd/UX** · `EmailTemplateEditor.tsx:22-32, 85-106`, `send-transactional-email.use-case.ts:59-73`, `legacy-email-service-provider.ts:209-219`
- **Problem:** zmienne są niespójne.
  - Edytor oferuje `{{name}}` i `{{unsubscribeLink}}`, których maile systemowe nie dostają.
  - Edytor nie pokazuje `{{actionUrl}}` (krytycznej dla weryfikacji i resetu) ani `{{preferencesLink}}`.
  - Rozsyłka nie zna `{{brandName}}` (jest w szablonach systemowych kopiowanych do kreatora).
  - `firstName` w rozsyłce to część adresu przed `@` („Witaj, jan.kowalski85”).
  - Nieznana zmienna wychodzi do odbiorcy dosłownie jako `{{x}}`. Nie ma walidacji przy zapisie ani przy wysyłce.
- **Naprawa:** jeden rejestr zmiennych dla każdego rodzaju maila, walidacja przy zapisie (nieznana lub brakująca wymagana zmienna to błąd 400), podgląd na prawdziwej funkcji renderującej.
- **Nakład:** M. **Pewność:** wysoka.

**MAIL-14 · P2 · UX** · `send-admin-broadcast-email.use-case.ts:143-166`, `legacy-email-service-provider.ts:288-308`
- **Problem:** mail testowy nie odpowiada prawdziwemu. Nie ma obudowy, podstawień (`{{unsubscribeLink}}` widać dosłownie), wersji tekstowej ani nagłówków, a test idzie tylko w PL, więc wersji EN nie da się sprawdzić. Audyt zapisuje adres testowy i temat w metadanych (`:151-155`), choć zasada z CLAUDE.md mówi: same identyfikatory.
- **Naprawa:** test przez tę samą funkcję renderującą co prawdziwa wysyłka, z wyborem języka. W audycie zapisywać hash lub sam fakt.
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-15 · P2 · błąd (język)** · `send-transactional-email.use-case.ts:111-113`, `lib/auth/emails.ts:11-18`, `fulfill-payment.use-case.ts:145`, `first-sign-in/route.ts:29`
- **Problem:** domyślny język jest różny w różnych ścieżkach. `account-deleted` idzie zawsze po polsku (brak parametru), a domyślne `User.language` to `en`. Maile auth wybierają `en` przy braku danych, płatności `pl`. Powitalny podstawia pełny pseudonim (`variables.firstName`), pozostałe pierwsze słowo pseudonimu (`name.split(/\s+/)[0]`), więc dla „Mr Bean” mail mówi „Witaj, Mr!”.
- **Naprawa:** jedna funkcja `resolveRecipientLocale(user)`, język przekazywany jawnie we wszystkich wywołaniach (także przed anonimizacją w `account-deletion-cleanup`), jedna zmienna `{{nickname}}` zamiast „imienia”.
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-16 · P2 · RODO** · `lib/email-defaults.ts:237-276` (`account-deleted`)
- **Problem:** mail stwierdza, że „konto i powiązane dane zostały **trwale usunięte**”, ale wiersz `User` zostaje jako zanonimizowany nagrobek, a płatności, `BroadcastEmailRecipient.email`, `EmailEvent` i `Notification` zostają (MAIL-22). Twierdzenie jest nieprawdziwe (art. 5 ust. 1 lit. a i art. 12 RODO).
- **Naprawa:** napisać zgodnie z prawdą: „usunęliśmy profil i zgody; dane płatności przechowujemy przez X lat z obowiązku prawnego”.
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-17 · P2 · UX** · `app/unsubscribe/page.tsx:14-26`, `app/api/subscriptions/unsubscribe/route.ts:19`
- **Problem:** strona wypisu (gdy już zacznie działać) jest tylko po angielsku, nie ma marki ani `noindex`. Formularz robi zwykły POST, a trasa zwraca JSON, więc użytkownik widzi surowe `{"ok":true,"message":"If this link can be processed…"}`. Link „Zarządzaj preferencjami email” prowadzi do strony, która umie tylko „Stop”: nie da się ponownie zapisać ani zobaczyć stanu.
- **Naprawa:** strona w `[locale]`, odpowiedź HTML lub przekierowanie na „Wypisano”, przycisk „Zapisz się ponownie” (dla zalogowanego), `robots: noindex`.
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-18 · P2 · błąd** · `email-preference.repository.ts` (zapisuje e-mail znormalizowany do małych liter, `subscribe.use-case.ts:24`), `legacy-email-service-provider.ts:150-154, 188`, `email.policy.ts:372-376, 412-415`, `handle-resend-webhook.use-case.ts:369-385, 430-444`
- **Problem:** wielkość liter w adresach nie jest ujednolicona. `EmailPreference.email` jest pisane małymi literami, a dopasowanie w rozsyłce i polityce idzie po `User.email` (stare konta z Clerka mogą mieć wielkie litery) przez dokładne `findUnique`/`Map.get`. Takie osoby są pomijane (`CONTENT_NOTIFICATIONS_OPTED_OUT`). `EmailSuppression` i wypis z webhooka zapisują adres w postaci od Resend, więc tłumienie może nie zadziałać przy innej wielkości liter.
- **Naprawa:** normalizacja `lower(trim())` na wejściu wszystkich tabel pocztowych plus migracja danych, albo `citext`.
- **Nakład:** S-M. **Pewność:** średnia (zależy od danych).

**MAIL-19 · P2 · RODO** · `prisma/schema.prisma` (`EmailPreference.marketingEmails @default(true)`), `email-preference.repository.ts:18-31`
- **Problem:** domyślna wartość zgody w schemacie to `true`. Każdy przyszły kod, który utworzy `EmailPreference` bez tego pola, zapisze zgodę, której nie było. Nie ma też dowodu zgody wymaganego przez art. 7 ust. 1 RODO: brak źródła (`consent_modal`, `subscribe_button`), wersji tekstu zgody, czasu wyrażenia zgody (jest tylko `updatedAt`) i historii.
- **Naprawa:** `@default(false)` (migracja addytywna), tabela `EmailConsentEvent` (userId, akcja, źródło, wersja tekstu, czas, opcjonalnie skrót IP).
- **Nakład:** S-M. **Pewność:** wysoka.

**MAIL-20 · P2 · błąd/śmieć** · `handle-resend-webhook.use-case.ts:186-245`, `email.dto.ts:171-216`, `list-inbound-emails.use-case.ts`, `update-inbound-email.use-case.ts`, `app/api/admin/emails/responses/route.ts`, `app/admin/emails/components/InboundInbox.tsx`, model `InboundEmail`
- **Problem:** obsługiwane zdarzenia nie zgadzają się z tym, co Resend wysyła.
  - `email.received` jest martwe od zmiany MX na Cloudflare (2026-10-02). Zostały po nim tabela `InboundEmail` (0 wierszy), zakładka „Odpowiedzi”, trasa, dwa use case'y, DTO i testy.
  - `email.unsubscribed` nie istnieje w Resend (jest `contact.updated`), więc ten kod nigdy się nie wykona.
  - Brak obsługi `email.failed` i `email.suppressed`, które istnieją (https://resend.com/docs/dashboard/webhooks/event-types). Odbiorca, którego Resend sam stłumił, zostaje `SENT`.
- **Naprawa:** usunąć ścieżkę inbound w całości (kod; tabelę zostawić lub usunąć osobną decyzją, bo migracje mają być addytywne). Obsłużyć `email.failed` i `email.suppressed`. W panelu Resend subskrybować tylko obsługiwane zdarzenia.
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-21 · P2 · bezpieczeństwo/integralność danych** · `handle-resend-webhook.use-case.ts:414-446`
- **Problem:** PP Support wysyła przez to samo konto Resend (SUPPORT-CENTER.md:113), a webhooki Resend działają dla całego konta. Gdy webhook zacznie działać (MAIL-08), odbicie lub skarga na mail z PP Support zablokuje klienta w aplikacji przez `handleSuppression` (fallback `data.to[0]`). Odwrotnie: zdarzenia aplikacji nie mówią nic o PP Support.
- **Naprawa:** tłumić tylko zdarzenia z naszym nadawcą lub tagiem (`tags: [{name:'app', value:'pawelperfect'}]` w `emails.send` i filtr w webhooku), albo osobny klucz i domena (np. `mail.` dla PP Support).
- **Nakład:** S. **Pewność:** średnia.

**MAIL-22 · P2 · RODO** · `lib/modules/users/application/account-deletion-cleanup.use-case.ts:40-90`
- **Problem:** usunięcie konta nie czyści `BroadcastEmailRecipient.email` (oryginalny adres zostaje na zawsze), `EmailEvent` (bez retencji, rośnie bez końca), `InboundEmail` ani `Notification` (kaskada działa tylko przy usunięciu wiersza `User`, a ten zostaje). Kontakt w Resend Audience (`ResendAudienceGateway`) też nie jest usuwany. `EmailSuppression` może zostać jako prawnie uzasadniony interes, ale to trzeba opisać w polityce.
- **Naprawa:** dopisać czyszczenie i anonimizację w tej samej transakcji, dodać cron retencji `EmailEvent` i `BroadcastEmailRecipient` (np. 90 dni), usunąć kontakt w Resend.
- **Nakład:** S-M. **Pewność:** wysoka.

**MAIL-23 · P2 · śmieć/decyzja** · `app/components/Navbar.tsx:23, 92, 196-200`, `app/components/notifications/NotificationsMenu.tsx`, `app/components/auth/NotificationsAccountSection.tsx:84-96`, `app/api/user/notification-preferences/route.ts`, `app/admin/notifications/**`, `lib/modules/notifications/**`, modele `Notification*`
- **Problem:** podsystem powiadomień jest martwy dla użytkownika. Dzwonek jest ukryty. W ustawieniach konta są przełączniki („Status Patrona”, „Reakcje na komentarze”, „Wiadomości systemowe”) dla dzwonka, którego nie widać, stąd `NotificationPreference` ma 0 wierszy. Admin może rozsyłać powiadomienia, których nikt nie zobaczy. Mimo to tabela `Notification` rośnie przy każdym polubieniu komentarza (bez deduplikacji, więc polub, cofnij, polub daje trzy wpisy, `toggle-comment-like.use-case.ts:73-88`). `app/types/notification.ts:3-6` nadal mówi „Mock data today”. Moduł nie ma żadnego testu.
- **Co się stanie po zdjęciu flagi:**
  - (a) Przywrócenie dzwonka pokaże historyczny zrzut powiadomień „Patron” (MAIL-09) i spam polubień. Brak też odświeżania, oznaczania wszystkich jako przeczytane i limitu przechowywania.
  - (b) Usunięcie podsystemu: kod (ok. 15 plików), sekcja w koncie, strona admina, dwie trasy API i flaga; tabele zostają jako martwe albo znikają migracją za zgodą właściciela.
- **Rekomendacja:** (b). Przy jednym twórcy i rzadkich publikacjach realną wartość ma tylko „ktoś odpowiedział lub polubił Twój komentarz”, a to lepiej zrobić później, prosto (licznik z `CommentReaction`, bez osobnej tabeli).
- **Nakład:** M. **Pewność:** wysoka.

### P3

**MAIL-24 · P3 · śmieć/UX** · `app/admin/emails/broadcast/BroadcastHistory.tsx:12-14, 61, 90-97` vs `email.repository.ts:47-65`
- **Problem:** historia rozsyłek pokazuje pusty podgląd, bo DTO nie zawiera `htmlPl`/`htmlEn`/`subjectEn`. `format(new Date(log.sentAt))` dla `sentAt = null` (stan READY lub SENDING) daje 1970. Kolumna „Dostarczono” pokazuje `sentCount`, nie liczbę dostarczonych.
- **Naprawa:** dodać pola do DTO (szczegóły ładować na żądanie), obsłużyć `null`, pokazywać `DELIVERED`.
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-25 · P3 · śmieć/UX** · `app/admin/emails/components/EmailDashboard.tsx:60-76, 127-146`, `app/api/admin/emails/status/route.ts:11-21`
- **Problem:** „dashboard” liczy „Łącznie odbiorców” jako sumę `recipientCount` z 20 ostatnich rozsyłek. „Status silnika: Webhooki — Niezweryfikowane” to tekst wpisany na sztywno. Zakładka „Ustawienia” pokazuje tylko, czy `RESEND_AUDIENCE_ID` jest ustawione.
- **Naprawa:** usunąć dashboard i ustawienia albo zastąpić prawdziwymi danymi (ostatnie zdarzenie webhooka z `EmailEvent`, liczba aktywnych tłumień, liczba subskrybentów ze zgodą, zużycie dzienne).
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-26 · P3 · śmieć** · `EmailTemplate.isActive`, `category` (`email.dto.ts:217-243`, `app/api/admin/templates/route.ts:25-36`), enum `EmailTemplateCategory`
- **Problem:** `isActive` jest ignorowane przy wysyłce (dezaktywowany szablon nadal idzie). `category` nic nie robi. Kategorie `PATRON`, `MANUAL`, `BROADCAST` odnoszą się do martwych koncepcji. `TemplatesList.handleDuplicate` tworzy kopie `-copy-NNN` szablonów systemowych, a kopie nigdy nie są wysyłane.
- **Naprawa:** usunąć pola z UI i API albo nadać `isActive` znaczenie. Nie da się „wyłączyć” maila bezpieczeństwa.
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-27 · P3 · śmieć** · `lib/email-defaults.ts:118-198`, `fulfill-payment.use-case.ts:159-169`, `TEMPLATE_METADATA` w `ensure-required-emails.ts:21-31`
- **Problem:** `become-patron` i `thank-you-donation` to dziś ten sam mail („Dziękuję za wsparcie”). O tym, który wyjdzie, decyduje logika progu patrona, która w modelu darowizny nie ma znaczenia. Opisy w metadanych („Systemowe potwierdzenie przyznania dostępu patrona”) są nieaktualne.
- **Naprawa:** jeden szablon `tip-thank-you`. Wysyłka z `idempotencyKey = tip-thank-you/<paymentId>`: dziś przy przekroczeniu czasu, gdy mail mógł wyjść, nie wiadomo, czy wyszedł, i nie ma ponowienia (`fulfill-payment.use-case.ts:170-182`).
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-28 · P3 · wydajność** · `prisma/schema.prisma` (`BroadcastEmailRecipient` bez indeksu na `resendEmailId`), `handle-resend-webhook.use-case.ts:307-311, 417-421`
- **Problem:** każde zdarzenie webhooka (także od maili transakcyjnych i z PP Support, które nie mają wiersza) robi `findFirst({resendEmailId})` w transakcji, czyli skan pełnej tabeli.
- **Naprawa:** `@@index([resendEmailId])` (lub `@unique`) w migracji addytywnej; najpierw sprawdzić, czy ID należy do nas (tag).
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-29 · P3 · błąd** · `legacy-email-service-provider.ts:261-279`, `handle-resend-webhook.use-case.ts:340-351`
- **Problem:** liczniki rozsyłek są niespójne. Końcowy `groupBy` liczy `sentCount` tylko ze statusu `SENT`, a odbiorcy, których webhook zdążył przestawić na `DELIVERED`/`OPENED`, wypadają. `errorCount` nie liczy `COMPLAINED`. Późniejsze webhooki dodają na liczniku przyrostowo, mieszając dwa sposoby liczenia. Jeśli `email.sent` przyjdzie przed zapisem `resendEmailId`, zdarzenie jest gubione jako `NOT_FOUND` i oznaczane jako przetworzone.
- **Naprawa:** liczniki liczone z odbiorców przy odczycie (bez zapisanych sum), `resendEmailId` zapisywane przed lub atomowo z wysyłką (worker z MAIL-06).
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-30 · P3 · wydajność/duplikacja** · `send-admin-broadcast-email.use-case.ts:99-115` + `legacy-email-service-provider.ts:143-195` + `email.policy.ts:386-418`
- **Problem:** zgoda i tłumienie są sprawdzane dwa razy. Use case robi to sekwencyjnie, do 5 zapytań na odbiorcę (tłumienie, twórca, subskrypcja, preferencja). Provider powtarza to samo hurtowo i jeszcze raz pyta o tłumienie dla każdej osoby. Komentarz w `:94-97` przyznaje, że to tymczasowe.
- **Naprawa:** jedno zapytanie SQL wyznaczające odbiorców (`JOIN Subscription, EmailPreference, LEFT JOIN EmailSuppression`) w miejscu tworzenia rozsyłki; worker sprawdza tylko tłumienie tuż przed wysyłką.
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-31 · P3 · błąd** · `signed-unsubscribe.use-case.ts:30-35`
- **Problem:** wypis z linku kasuje `Subscription`, ale nie przelicza `Creator.subscribersCount` (zwykły `UnsubscribeUseCase` to robi) i nie synchronizuje Resend Audience. Licznik subskrybentów na kanale się rozjeżdża.
- **Naprawa:** wspólna funkcja wypisu dla obu ścieżek.
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-32 · P3 · śmieć** · `lib/modules/subscriptions/infrastructure/resend-audience.gateway.ts`, `RESEND_AUDIENCE_ID`
- **Problem:** synchronizacja kontaktów do Resend Audience jest prowadzona, ale nic jej nie używa: rozsyłki idą przez `emails.send`, nie przez Resend Broadcasts. Resend przeszedł z „Audiences” na Contacts, Segments i Topics, więc wywołania z `audienceId` mogą być przestarzałe.
- **Naprawa:** usunąć albo zrobić z tego podstawę rozsyłek przez Resend Broadcasts (sekcja 5).
- **Nakład:** S. **Pewność:** średnia co do deprecjacji, wysoka co do braku użycia.

**MAIL-33 · P3 · śmieć** · `package.json` (`"svix": "^1.89.0"`), `app/api/webhooks/resend/route.ts:3`
- **Problem:** Resend SDK 6.17.1 (zainstalowany) ma `resend.webhooks.verify()` na `standardwebhooks` (zależność `resend`). Bezpośredni `svix` jest zbędny.
- **Naprawa:** przejść na `resend.webhooks.verify`, usunąć `svix` z zależności.
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-34 · P3 · dostarczalność/UX** · `lib/email-defaults.ts:13-69`, `email-content.ts:106-120`
- **Problem:** HTML maili jest kruchy.
  - Układ na `<div>` z `max-width` (Outlook desktop, silnik Worda, to ignoruje).
  - „Przycisk” to `<a>` z `padding` i `border`, a Outlook zostawi sam tekst.
  - `<meta name="color-scheme" content="light">` bez `supported-color-schemes` i bez stylów ciemnych. Gmail i Outlook w trybie ciemnym odwrócą kolory: żółty `#FFEA00` z czarnym tekstem i beżowe tło mogą stać się nieczytelne.
  - Brak `role="presentation"`.
- **Naprawa:** szablony w React Email (komponenty `Container`, `Button` w tabelach) albo ręczne tabele z przyciskiem w stylu bulletproof, plus test w Litmus/Email on Acid lub przynajmniej w Outlook.com.
- **Nakład:** M. **Pewność:** wysoka.

**MAIL-35 · P3 · dostarczalność** · DNS (stan 2026-10-03, 1.1.1.1)
- **Stan:**
  - `pawelperfect.com`: SPF `v=spf1 include:_spf.mx.cloudflare.net ~all`, DMARC `p=none; rua=mailto:pawel.perfect@gmail.com; fo=1`, DKIM `resend._domainkey` (klucz RSA 1024 bit), Return-Path `send.pawelperfect.com` (SPF `include:amazonses.com`, MX `feedback-smtp.eu-west-1.amazonses.com`, region UE).
  - Nie ma BIMI, MTA-STS ani TLS-RPT.
  - `pawelperfect.pl`: DMARC `p=none;` **bez `rua`**, DKIM Resend nadal opublikowany (domena nadal zweryfikowana w Resend, choć aplikacja wysyła z `.com`).
  - Na obu domenach zostały `google._domainkey` i weryfikacje Google po Workspace.
  - Dopasowanie From/Return-Path/DKIM: poprawne (relaxed, subdomena `send.` → `pawelperfect.com`, DKIM `d=pawelperfect.com`).
- **Naprawa:**
  - Po 2-4 tygodniach czystych raportów: `.com` → `p=quarantine; pct=25` → `100` → `reject`.
  - `.pl` (nie wysyła): `p=reject` z `rua`, albo przynajmniej `rua`.
  - Po rezygnacji z Workspace usunąć `google._domainkey`.
  - Rozważyć osobną subdomenę rozsyłek `news.pawelperfect.com` (osobna reputacja).
  - Do rozważenia: MTA-STS i TLS-RPT (darmowe, Cloudflare). BIMI ma sens dopiero przy `p=quarantine/reject` i z certyfikatem VMC.
  - DKIM 2048 bit, jeśli Resend na to pozwala.
- **Nakład:** S. **Pewność:** wysoka (dane z DNS).

**MAIL-36 · P3 · drobne** · `app/api/admin/templates/route.ts:91`, `app/api/admin/emails/broadcast/route.ts:24-51`
- **Problem:**
  - Trasa szablonów robi `await req.json()` bez obsługi błędu, więc zły JSON daje 500 przez `handleApiError` (jest wyjątkiem od `parseAdminBody`).
  - Trasa rozsyłek przyjmuje „kompatybilnościowe” pola (`recipientGroup`, `isTest`, `testEmail`, `manualEmails`, `subjectPl`/`htmlPl` obok `subject`/`body`), czyli dwa kontrakty tego samego API, z których UI używa jednego.
  - `testRecipientEmail` może być dowolnym adresem, więc admin może wysłać dowolną treść z naszej domeny na dowolny adres. Mail nie ma oznaczenia „test od administratora”, a audyt zapisuje sam adres.
- **Naprawa:** `parseAdminBody` i jeden schemat. Test tylko na adres admina (z sesji) albo na krótką listę dozwolonych adresów.
- **Nakład:** S. **Pewność:** wysoka.

**MAIL-37 · P3 · brak testu** · `tests/`
- **Brakujące testy:**
  - middleware dla `/unsubscribe` (MAIL-01);
  - kolejność „baza zamiast kodu” i zasiewanie w `instrumentation.ts` (MAIL-02);
  - escapowanie zmiennych (MAIL-12);
  - nagłówki `List-Unsubscribe` i `-Post` w rozsyłce (MAIL-04);
  - weryfikacja webhooka prawdziwym podpisem (dziś mock `svix`) i przypadek złego formatu sekretu;
  - limit tempa i 429 w rozsyłce;
  - cały moduł `lib/modules/notifications` (zero testów);
  - aborted transaction przy powiadomieniu w `grantPatron` (MAIL-10);
  - nieznane zmienne w szablonie (MAIL-13).
- **Do usunięcia przy sprzątaniu:** testy martwych ścieżek, czyli `inbound-emails.test.ts`, MANUAL w `send-admin-broadcast-email.test.ts:78-89, 206-218` i `email.unsubscribed`.
- **Nakład:** M (rozłożone na PR-y z sekcji 6). **Pewność:** wysoka.

---

## 4. Rozbieżności: dokumentacja a kod

| Dokument | Twierdzenie | Stan faktyczny |
|---|---|---|
| CLAUDE.md, wpis 2026-09-26 „Emails” | „every system email falls back to `EMAIL_DEFAULTS`”; nadpisuje je tylko szablon „admin-edited” | Szablony są zasiewane do bazy automatycznie przy każdym starcie (`instrumentation.ts`), więc baza wygrywa zawsze, nie tylko po edycji admina (MAIL-02). |
| CLAUDE.md, §8.1 „Email (2026-10-02)” | „MX is still Google … Mail is a Google Workspace mailbox (MX at Google)”; `support@` to alias Workspace | MX obu domen: `route1/2/3.mx.cloudflare.net` (DNS 2026-10-03). Sekcja 0 tego samego pliku mówi już „Mail cutover done”, więc plik przeczy sam sobie. |
| CLAUDE.md, wpis 2026-09-30 (.pl → .com) | Webhook Resend wysyła m.in. `received` | `email.received` jest martwe (MX → Cloudflare → PP Support). |
| CLAUDE.md, §4.12 „E-mails” | Maile auth „localized by `User.language`” | Tak, ale przy braku danych domyślnie `en`; `account-deleted` zawsze PL (MAIL-15). |
| CLAUDE.md, §4.12 „First sign-in” | Powitalny wysyłany „exactly once” | Tylko w oknie 24 h, bez klucza idempotencji (fire-and-forget, `first-sign-in/route.ts:28-31`). |
| CLAUDE.md, §4.14 i CLAUDE.md 2026-09-26 | `{{preferencesLink}}` → podpisana strona `/unsubscribe` | Strona daje 404 na produkcji (MAIL-01). |
| `docs/operations/EMAIL_SETUP.md:18` | Domena wysyłki `pawelperfect.pl`, klucz `polutek-production` ograniczony do tej domeny | Aplikacja wysyła z `no-reply@pawelperfect.com`. |
| `EMAIL_SETUP.md:20` | Webhook na `https://www.pawelperfect.pl/api/webhooks/resend`; „MX is at Google” | `.pl` przekierowuje 308 na `.com`; MX to Cloudflare. Możliwe źródło MAIL-08 (drugi endpoint lub sekret). |
| `docs/operations/EMAIL_DELIVERABILITY.md:3, 34, 56, 61, 90, 92` | Skrzynka `hello@` w Google Workspace, linia tożsamości z `hello@…`, `rua` na `hello@`, SPF `include:_spf.google.com` | Kod: `support@pawelperfect.com` (`legacy-email-service-provider.ts:27`); DNS: `rua` na gmail, SPF `include:_spf.mx.cloudflare.net`. |
| `EMAIL_DELIVERABILITY.md:39` | „usuń zapisane wersje (wróci domyślna)” | Niewykonalne: szablony systemowe są nieusuwalne (`delete-email-template.use-case.ts:22-24`), a restart zasiewa je ponownie. |
| `EMAIL_DELIVERABILITY.md:78, 89` | „Nie wysyłamy do adresów, które odbiły … webhook zapisuje odbicia” | Webhook odrzuca podpisy (MAIL-08). Maile transakcyjne w ogóle nie sprawdzają `EmailSuppression` (chroni je tylko lista tłumień po stronie Resend). |
| `EMAIL_DELIVERABILITY.md:22` | Śledzenie otwarć i kliknięć wyłączone | Kod obsługuje `email.opened`/`email.clicked` i trzyma pola `openedAt`/`clickedAt`. Zgodne z wyłączeniem tylko wtedy, gdy nic nie przychodzi; kod i pola są do usunięcia albo do świadomego włączenia z informacją w polityce prywatności. |
| `docs/specs/EMAIL-COMMS-SPEC.md` | Ogólnik: „preview/test-send required, delivery webhooks” | Test nie odpowiada wysyłce (MAIL-14), webhook nie działa (MAIL-08); spec nie opisuje kolejki, one-click ani zgody. |
| `app/types/notification.ts:3-6` | „Mock data today” | Dane pochodzą z prawdziwej tabeli `Notification`. |
| `BroadcastWizard.tsx:184, 423` | „Wszyscy użytkownicy — wszystkie konta”; „Odbiorcy zostaną dodani do bazy” | Tylko subskrybenci ze zgodą; ręczna lista zawsze 0 (MAIL-11). |
| `scripts/ensure-required-emails.ts:21-31` | „podziękowanie za wsparcie poniżej progu patrona”, „przyznania dostępu patrona” | Model darowizny bez dostępu. |
| `send-admin-broadcast-email.use-case.ts:16-21, 94-97` | „R9 … future pass should split … retry/outbox” | Nie zrobione; kod nazywa się „Legacy…Bridge”, a jest jedyną implementacją. |

---

## 5. Lepsze rozwiązania

**A. Jedno źródło prawdy dla treści (najważniejsze).**
- Szablony jako kod: React Email (`@react-email/components`; Resend SDK ma `react` w `emails.send`) albo TSX renderowany do HTML. Daje escapowanie, tabele kompatybilne z Outlookiem, `<Preview>` i wersję tekstową (`render(..., {plainText:true})`). Każdy rodzaj maila to funkcja z typowanymi parametrami, więc literówki w zmiennych wykrywa kompilator.
- Edycja w panelu tylko dla tematów i akapitów, jako nadpisania: wiersz w bazie istnieje wyłącznie wtedy, gdy admin coś zmienił, a przycisk „przywróć domyślny” go kasuje. Bez automatycznego zasiewania.
- Wynik: znikają MAIL-02, -12, -13, -34 i duża część -26.

**B. Wysyłka transakcyjna (zostaje na Resend).**
- Jedna funkcja `sendEmail(kind, recipient, params)`: obudowa, wersja tekstowa, nagłówki, Reply-To, `tags` (np. `app=pawelperfect`, `kind=verify-email`), `idempotencyKey = <kind>/<entityId>`.
- Ponowienie z wykładniczym odstępem dla 429/5xx. Dla maili bezpieczeństwa wystarczy fire-and-forget z jednym ponowieniem.
- Warstwa transportu (`EmailTransport`: Resend API dziś, SMTP lub Mailcow jutro) jest tania i zgodna z planem `07-self-hosted-mail.md`.

**C. Rozsyłki: trzy drogi, rekomendacja.**
1. **Resend Broadcasts + Contacts/Segments/Topics.** Resend sam robi one-click (`List-Unsubscribe-Post`), stronę preferencji, tłumienie, tempo i statystyki. Kontakty marketingowe na planie Free (1000 kontaktów) nie zjadają dziennego limitu 100 maili transakcyjnych. Kod `ResendAudienceGateway` już synchronizuje zgody. Usuwa ok. 1500 linii (kreator, historia, provider, część webhooka). Minus: większe uzależnienie od Resend, sprzeczne z celem właściciela („własny stos, tylko Stripe”).
2. **Własna kolejka (outbox) według wzorca `VideoEncodeJob`.** Tabela zadań, worker na serwerku z `SKIP LOCKED`, `resend.batch.send` po 100 z `idempotencyKey`, tempo ≤ 5/s, wznowienie po restarcie, anulowanie. Spójne z „jeden serwer” i z późniejszą zamianą transportu na Listmonk/Mailcow. Koszt: M-L.
3. **Odłożyć rozsyłki do własnego serwera pocztowego** (Listmonk zrobi kolejkę, szablony, wypis, statystyki i rozgrzewanie).

**Rekomendacja:** teraz wyłączyć wysyłkę rozsyłek w UI. Najpewniej nie ma ich jeszcze wcale, a tabela subskrybentów ze zgodą jest mała. Naprawić P0 i P1 dotyczące wypisu i zgody, bo dotyczą też maili transakcyjnych. Docelowo wybrać (3) zgodnie z `docs/research/serwerek/07-self-hosted-mail.md`, z Resend jako awaryjnym transportem maili krytycznych. Gdyby newsletter był potrzebny przed Listmonkiem, (1) jest szybsze i bezpieczniejsze niż łatanie obecnego kodu. Własna implementacja (2) ma sens tylko wtedy, gdy Listmonk odpada.

**D. Webhook.**
- `resend.webhooks.verify` z obsługą tylko `sent/delivered/delivery_delayed/bounced/complained/failed/suppressed`, filtrowaniem po tagu aplikacji i logowaniem przyczyny odrzucenia.
- `EmailEvent` z retencją 90 dni.
- Sprawdzanie `EmailSuppression` także przed mailem transakcyjnym nie-bezpieczeństwa (powitalny, podziękowanie).

**E. Zgoda i wypis (RODO, PKE).**
- Rejestr zdarzeń zgody z wersją tekstu.
- Domyślnie brak zgody.
- Link wypisu bez terminu ważności.
- One-click według RFC 8058.
- Strona preferencji w `[locale]` z „zapisz ponownie”.
- Usunięcie konta czyści wszystkie tabele pocztowe.

**F. Powiadomienia w aplikacji.** Usunąć podsystem (MAIL-23). Jeśli kiedyś wróci, to tylko „odpowiedź lub polubienie komentarza”, liczone z istniejących tabel, bez szablonów, preferencji i rozsyłek admina.

**G. Dostarczalność.**
- DMARC → `quarantine`/`reject` etapami (raporty na gmail już spływają).
- `.pl`: `p=reject`.
- Osobna subdomena dla rozsyłek (`news.`).
- Google Postmaster Tools dla `pawelperfect.com`.
- Przy rozsyłkach trzymać skargi < 0,1% (wymóg Google: < 0,3%, https://support.google.com/a/answer/81126).

Źródła:
- [Resend: rate limit](https://resend.com/docs/api-reference/rate-limit) (10 żądań/s na zespół)
- [Resend: cennik](https://resend.com/pricing) (Free: 3000/mies., 100/dzień)
- [Resend: zdarzenia webhooków](https://resend.com/docs/dashboard/webhooks/event-types) (`email.failed`, `email.suppressed`)
- [Resend: klucze idempotencji](https://resend.com/docs/dashboard/emails/idempotency-keys) (24 h, `idempotencyKey`)
- [Google: wymagania dla nadawców](https://support.google.com/a/answer/81126) (SPF/DKIM/DMARC, one-click RFC 8058, spam < 0,3%)
- RFC 8058 (List-Unsubscribe-Post)

---

## 6. Kolejność małych PR-ów

1. **PR-1 (S, natychmiast): wypis działa.** `/unsubscribe` do `LOCALE_EXEMPT_PATHS` plus test middleware; token bez wygasania (lub 1 rok); odpowiedź HTML zamiast JSON. Zamyka MAIL-01, -03 i częściowo -17.
2. **PR-2 (S): webhook.** `resend.webhooks.verify`, `secret.trim()`, konstruktor poza `try`, logowanie przyczyny; obsługa `failed`/`suppressed`; usunięcie `email.unsubscribed`/`received`; usunięcie zależności `svix`. Właściciel w panelu Resend: jeden endpoint `.com` i nowy sekret w `.env` na serwerku. Zamyka MAIL-08, -33 i część -20.
3. **PR-3 (S-M): koniec zasiewania szablonów.** Usunąć zasiewanie z `instrumentation.ts` i `prisma/seed.ts`; nadpisania tylko świadome; skrypt diagnostyczny pokazujący różnice baza↔kod; po akceptacji właściciela usunięcie wierszy systemowych, które nie są edycją admina (w tym `account-exists`). Zamyka MAIL-02.
4. **PR-4 (S): powiadomienia stop.** Usunąć powiadomienie „Patron” z `grantPatron` (i z transakcji). Zamyka MAIL-09, -10. Potem **PR-4b (M)**: usunięcie podsystemu powiadomień i flagi `TEMP_HIDE_NOTIFICATIONS_BELL` z rejestru TEMP w CLAUDE.md. Zamyka MAIL-23.
5. **PR-5 (S): rozsyłki wyłączone.** Kreator i trasa za flagą „wyłączone do czasu kolejki”; usunięte grupy `ALL`/`PATRONS`/`NON_PATRONS`/`MANUAL`, zakładki Odpowiedzi/Dashboard/Ustawienia oraz cała ścieżka inbound. Zamyka MAIL-11, -20 (reszta), -24, -25, -36.
6. **PR-6 (M): wspólny renderer.** Jedna funkcja budująca wiadomość (escapowanie, rejestr zmiennych, walidacja, tekst, nagłówki z `List-Unsubscribe` i `-Post`, tagi, `idempotencyKey`); jeden szablon podziękowania; język przekazywany jawnie; poprawiony tekst `account-deleted`. Zamyka MAIL-04 (transakcyjne), -12, -13, -15, -16, -27.
7. **PR-7 (S-M): zgoda i dane.** `marketingEmails @default(false)`, tabela zdarzeń zgody, normalizacja adresów, czyszczenie przy usunięciu konta, retencja `EmailEvent`, indeks `resendEmailId`, wspólna funkcja wypisu (licznik subskrybentów). Zamyka MAIL-18, -19, -22, -28, -31.
8. **PR-8 (M): szablony w React Email** (Outlook, tryb ciemny, przycisk w stylu bulletproof) plus test wizualny. Zamyka MAIL-34, -26.
9. **PR-9 (dokumentacja, S):** poprawić CLAUDE.md (§0/§8.1 MX, zasiewanie, webhook), EMAIL_SETUP.md, EMAIL_DELIVERABILITY.md, EMAIL-COMMS-SPEC.md (sekcja 4).
10. **PR-10 (decyzja właściciela, potem L):** rozsyłki według sekcji 5C (Listmonk docelowo; Resend Broadcasts albo własna kolejka, jeśli potrzebne wcześniej). Zamyka MAIL-05, -06, -07, -29, -30. Równolegle DNS (MAIL-35): DMARC etapami, `.pl` `p=reject`, sprzątanie po Workspace.
