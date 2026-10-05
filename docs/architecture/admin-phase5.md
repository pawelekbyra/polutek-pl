# Panel administratora, faza 5: wygaszenie starego panelu na `www`

Stan: 2026-10-05, gałąź `feat/p5-retire-old-admin`, **zbudowane w kodzie, niewdrożone**. Plan: [`admin-panel.md`](admin-panel.md) §4 „Faza 5” i decyzja 8.
Parytet funkcji: [`admin-parity.md`](admin-parity.md) (123 wiersze „zrobione”, 9 „DROP”, 4 wiersze fazy 5 zamknięte tą gałęzią, 1 wiersz „po decyzji” zostaje u właściciela).

> ## OSTRZEŻENIE: kiedy wdrożyć
>
> **Wdrożyć dopiero po udanym zalogowaniu do nowego panelu (logowanie przez Cloudflare Access z Gmailem właściciela) i sprawdzeniu, że panel działa.**
>
> Po wdrożeniu tej gałęzi stary panel na `www` przestaje istnieć: `/admin*` przekierowuje na `admin.pawelperfect.com`, a `/api/admin*` odpowiada 404.
> Jeśli właściciel nie potrafi jeszcze wejść do nowego panelu, **straci dostęp do wszystkich funkcji administracyjnych** (filmy, komentarze, wpłaty, zwroty, rozsyłki), bo drogi wstecz przez stary panel już nie będzie.
> Do tej pory (stan na 2026-10-05) nowy panel nie był jeszcze sprawdzony przez właściciela w przeglądarce; logowanie (tryb `access`, `ADMIN_AUTH_MODE`) opisuje `docs/operations/ADMIN-PANEL.md` rozdz. 1b.
>
> Lista kontrolna przed wdrożeniem:
> 1. Panel jest wdrożony i dostępny (`admin.pawelperfect.com`, Cloudflare Access przepuszcza właściciela).
> 2. Właściciel **zalogował się** do panelu przez Access (kod z maila na pawel.perfect@gmail.com), otworzył Treści, Społeczność, Przychody, Ustawienia.
> 3. Wiadomo, jak wrócić do trybu `passkey` albo cofnąć wdrożenie (`docs/operations/ADMIN-PANEL.md`, rozdz. 1b i 4).
> 4. Właściciel zrobił ręczny snapshot serwera (zasada projektu przed ryzykownymi krokami).
>
> **Wycofanie (rollback):** poprzedni obraz aplikacji zostaje na serwerze: `./deploy.sh x --rollback` (uruchamia poprzedni obraz, bez budowania i migracji; ta faza nie zmienia schematu bazy, więc nic do cofania w danych). Stary panel wraca wtedy w całości, razem ze starymi trasami.

## 1. Co usunięto

Razem 224 pliki zmienione, ok. 16 600 linii netto mniej (`git diff --shortstat 0cf42592..HEAD`).

| Co | Pliki | Uwagi |
|---|---|---|
| `app/admin/**` | 72 | strony, komponenty, hooki (ok. 8 500 linii) |
| `app/api/admin/**` | 49 | 66 handlerów (ok. 2 300 linii) |
| `components/skeletons/admin.tsx` | 1 | |
| Martwy kod `lib/` | 15 | `auth-utils.ts` (cały: `requireAdminForApi`, `requireAdmin`, `isAdmin`), `api/admin-body.ts`, `api/admin-rate-limit.ts`, `api/admin-recent-sign-in.ts`, `api/admin-payments-query.ts`, `api/admin-users-export-query.ts`, `api/app-context-factory.ts`, `admin/` (3 pliki), `admin-channel-error-classification.ts`, `blob-config.ts`, `modules/admin-stats/**` (nieużywany przez panel), `modules/video/domain/admin-video-list.dto.ts` |
| Naprawa jednorazowa „kanał główny” | 2 | `lib/channel/main-channel.maintenance.ts` i `lib/modules/channel/application/main-channel.maintenance.ts` (w parytecie: DROP, brak wołającego) |
| Nieużywane prymitywy UI | 6 | `components/ui/{badge,card,input,progress,table,tabs}.tsx`: importował je tylko stary panel |
| Testy | 38 | testy „tekstu źródła” starych plików i tras |
| `lib/api/admin-schemas.ts` | przycięty | zostały 3 schematy wgrywania wieloczęściowego, których używa panel |

Weryfikacja, że nic cudzego nie zniknęło: `npm run admin:build` przechodzi, `tsc` przechodzi, a skrypt osiągalności importów (jednorazowy, nie w repo) po usunięciu wskazuje tylko pliki martwe jeszcze przed tą zmianą (patrz sekcja 6).

## 2. Mapa przekierowań (308)

Jedyne źródło: `lib/admin-legacy-redirects.ts` (`resolveLegacyAdminRedirect`), wołane z `middleware.ts` **przed** bramką sesji, więc zakładka z zapisanym adresem trafia do panelu także wtedy, gdy ktoś nie jest zalogowany na `www`. Zapytanie (`?...`) jest porzucane. Test wylicza całą mapę: `tests/unit/admin-legacy-redirects.test.ts`; zachowanie w middleware: `tests/unit/auth/middleware-gating.test.ts`.

| Stary adres (`www`) | Nowy adres (`https://admin.pawelperfect.com`) |
|---|---|
| `/admin` | `/` |
| `/admin/videos` | `/tresci` |
| `/admin/videos/layout` | `/tresci/uklad` |
| `/admin/videos/<id>`, `/admin/videos/<id>/edit` | `/tresci` (stary adres miał id, panel używa sluga: bez odczytu bazy nie da się przeliczyć) |
| `/admin/users`, `/admin/users/dashboard` | `/spolecznosc?tab=uzytkownicy` |
| `/admin/users/payments` | `/przychody?tab=wplaty` |
| `/admin/users/<userId>` | `/spolecznosc/u/<userId>` |
| `/admin/comments` | `/spolecznosc?tab=komentarze` |
| `/admin/comments/reports` | `/spolecznosc` (Moderacja) |
| `/admin/emails` | `/komunikacja?tab=szablony` |
| `/admin/emails/broadcast` | `/komunikacja?tab=rozsylki` |
| `/admin/notifications` | `/komunikacja?tab=powiadomienia` |
| `/admin/channel`, `/admin/settings` | `/ustawienia?tab=kanal` |
| `/admin/payments` | `/ustawienia?tab=platnosci` |
| `/admin/diagnostics`, `/admin/system` | `/system` (takich stron nie było, wpis na zapas) |
| każdy inny `/admin/...` | `/` |
| `/api/admin`, `/api/admin/...` (każda metoda) | **404** JSON `{"error":"Not found"}`, bez sesji i z sesją |

Adres docelowy jest zawsze budowany z ustalonego początku `https://admin.pawelperfect.com`; segment `<userId>` trafia tylko do ścieżki, więc przekierowanie nie może wyprowadzić na obcy host (test „no open redirect”).

## 3. Decyzje (i dlaczego)

1. **Przekierowania w `middleware.ts`, nie w `next.config`.** Stare trasy musiały też zniknąć z bramki sesji (wcześniej `/admin` wymagało ciasteczka i odsyłało do logowania `www`). Jedno miejsce w kodzie, jeden test z całą mapą, kod stanu 308 (trwały, zachowuje metodę). `next.config` `redirects()` nie rozróżnia „bez sesji”, a ma tylko wzorce, nie funkcję testowalną jednostkowo.
2. **`/api/admin*` odpowiada 404 w middleware**, a nie tylko brakiem plików. Dzięki temu żadna przyszła przypadkowa trasa `app/api/admin/...` nie zadziała, a test jednostkowy pilnuje kontraktu. 404 (nie 401/403): trasa nie istnieje.
3. **Moderacja na `www` (decyzja 8, rekomendacja „przenieść całość”).** Z `CommentItem.tsx` usunięto Ukryj, Przywróć i Serce oraz trzy wywołania `/api/admin/comments/*`. Panel ma już moderację, „Serduszko” i „Odpowiedz jako twórca”. Zwykłe funkcje użytkownika zostają (zgłoś, usuń własny, edytuj własny, przypnij przez twórcę filmu, lubię, odpowiedz). **Serce twórcy zostaje widoczne** pod komentarzem (tylko do odczytu), bo to treść publiczna, a nie uprawnienie. Konsekwencja dla właściciela: ukrycie komentarza wymaga otwarcia panelu (na telefonie też).
4. **Link „Zarządzaj kanałem”** (`UserMenu`, `AccountModal`): nowa karta (`target="_blank"`, `rel="noopener noreferrer"`) na `ADMIN_PANEL_ORIGIN`. Powód: panel to osobna aplikacja z własnym logowaniem i Cloudflare Access; właściciel często wraca do strony publicznej, więc nowa karta jest wygodniejsza niż utrata kontekstu. Widoczny jak dotąd tylko dla roli ADMIN.
5. **Rola `ADMIN` na koncie publicznym = tylko znacznik.** Zostaje w `lib/api/auth.ts` (`User.role === "ADMIN"` z bazy, bez żadnego awansu po e-mailu), bo `www` używa jej do: podglądu szkiców (miniatura szkicu, `home-viewer-data`), przycisku w menu i uprawnień w publicznym API komentarzy (usuwanie cudzego komentarza przez rolę, które UI już nie wystawia). Nadawanie roli: panel (profil 360°) albo `scripts/ops` (`changeUserRoleAsAdmin`).
6. **`ADMIN_EMAILS` znika całkowicie:** `getAdminEmails`/`isAdminEmail` w `lib/auth/config.ts`, awans i wpis audytu `AUTH_ADMIN_BOOTSTRAP` w `lib/api/auth.ts`, zmienna w `.env.example`, `.github/workflows/ci.yml`, skrypty `scripts/ops/actions` (znacznik `inAdminEmails`), testy, dokumentacja. Test `tests/unit/auth/admin-guard.test.ts` pilnuje, że nawet ustawiona zmienna nikogo nie awansuje.
   - **Zostaje celowo:** nazwa akcji `AUTH_ADMIN_BOOTSTRAP` w zapytaniach odprawy (`scripts/ops/briefing-*.mjs`), bo stare wiersze `AuditLog` ją niosą; zmienna `ADMIN_EMAIL` (liczba pojedyncza) w `lib/constants.ts` (używana przez panel i skrypty naprawcze, to nie jest dostęp administratora); wzmianki historyczne w `docs/audit/**`, `admin-panel.md` i opis wdrożenia Clerk→Better Auth w `SERWEREK.md` (oznaczone jako historyczne).
   - Jeśli `ADMIN_EMAILS` stoi jeszcze w `app.env` na serwerze, jest ignorowane; można je skasować przy okazji.
7. **Domyślna baza wgrywania wieloczęściowego** (`lib/video-upload/multipart-uploader.ts`) to teraz `/api/videos` (panel) zamiast usuniętego `/api/admin/videos`.
8. **Narzędzia jakości:** z `check-hotspots.ts` zniknęło 5 wyjątków dla plików starego panelu, z `check-architecture.ts` wyjątek trasy `app/api/admin/users/[userId]/patron`, ze `strict-escapes-baseline.jsonc` 11 wpisów usuniętych plików.

## 4. Testy (kontrakty zamiast „tekstu źródła”)

| Test | Pilnuje |
|---|---|
| `tests/unit/admin-legacy-redirects.test.ts` | cała mapa starych stron → panel, ukośnik końcowy, nieznane ścieżki, brak otwartego przekierowania, brak łapania podobnych ścieżek |
| `tests/unit/auth/middleware-gating.test.ts` | middleware: 308 dla `/admin*` (z sesją i bez), 404 dla `/api/admin*` (GET/POST/PATCH/DELETE, z sesją i bez), podobne ścieżki nietknięte, CSRF `/api/user/*` |
| `tests/unit/legacy-admin-retired.test.ts` | brak `app/admin` i `app/api/admin`, brak importów usuniętych modułów (grep po `app`, `lib`, `scripts`), brak `/api/admin` w kodzie `www`, brak przycisków moderacji w `CommentItem`, linki do panelu z `rel=noopener`, brak `ADMIN_EMAILS` w kodzie, CI i `.env.example` |
| `tests/unit/auth/admin-guard.test.ts` | rola z bazy jedyna liczy się; ciasteczkowe „admin” ignorowane; zmienna `ADMIN_EMAILS` nikogo nie awansuje |
| `tests/unit/api/admin-schemas.test.ts` | schematy wgrywania wieloczęściowego używane przez panel |
| `tests/unit/video-pipeline/multipart-uploader.test.ts` | domyślna baza `/api/videos` |

Usunięto testy „tekstu źródła” plików, które już nie istnieją (m.in. `admin-route-authorization-static`, `admin-mutations-audit-static`, `admin-mutations-validation-static`, `admin-*-ux`). Odpowiedniki dla panelu są w `tests/unit/admin-app`, `admin-content`, `admin-phase3` itd.

## 5. Co się zmienia dla właściciela

- Stare zakładki i zakładki przeglądarki `www.pawelperfect.com/admin/...` otwierają odpowiedni ekran nowego panelu (po zalogowaniu kluczem).
- Pod komentarzem na stronie nie ma już menu moderacji ani serca do przełączenia: moderacja, serduszko i odpowiedź twórcy są w panelu (Społeczność).
- „Zarządzaj kanałem” w menu konta otwiera panel w nowej karcie.
- Nie ma już awansu na administratora po adresie e-mail. Rolę nadaje się w panelu albo skryptem operatora.
- Aplikacja publiczna jest mniejsza o ok. 16 600 linii; w obrazie `www` nie ma kodu ani tras administratora.

## 6. Czego nie zrobiono / co zostaje

- **Nie wdrożono, nie sprawdzono w przeglądarce ani na produkcji.** Przekierowania i 404 są sprawdzone testami middleware (jednostkowo), nie prawdziwym żądaniem HTTP przez Cloudflare. Cloudflare może cache'ować 308: po wdrożeniu otworzyć `https://www.pawelperfect.com/admin/videos` w oknie prywatnym.
- Martwy CSS `.admin-visual-shell` w `app/globals.css`: wymieszany z regułami publicznymi (te same bloki selektorów), więc nie ruszany, żeby uniknąć konfliktów ze zmianami wyglądu strony. Do usunięcia w osobnym, małym PR.
- Pliki martwe jeszcze przed tą zmianą, nietknięte: `app/components/{CheckoutForm,InstallAppMenu,OrientationLock,RotateDeviceGuard}.tsx`, `app/components/channel/DonationLegalDialog.tsx`, `app/hooks/usePwaInstall.ts`, `lib/modules/users/infrastructure/user-admin.service.ts`, `lib/modules/video/infrastructure/r2-original-storage.client.ts`. Stare wpisy bazowe w `strict-escapes-baseline.jsonc` dla dawno usuniętych plików (Clerk, Cloudflare Stream, katalogi eksperymentów) też zostają.
- `robots.ts` nadal blokuje `/admin/` (nieszkodliwe, bo adres przekierowuje).
- Role: panel ma własne konta; „Odznaka ADMIN” na koncie publicznym pozostaje ręcznie nadawana. Decyzja o rolach (STATUS.md pkt 4) nadal należy do właściciela.
