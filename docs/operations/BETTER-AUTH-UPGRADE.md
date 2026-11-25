# Aktualizacja Better Auth 1.7.7 → 1.7.26 (paczka D3)

## Co się zmienia
- `better-auth`, `@better-auth/core` i `@better-auth/passkey` 1.7.7 → 1.7.26, przypięte dokładnie (bez `^`), żeby
  zawsze była jedna kopia core. 1.7.26 (18.11) to najnowsze 1.7.x sprzed około tygodnia; nowsze 1.7.27–1.7.28 celowo pomijamy.
  Zgodnie z ich zależnościami: `better-call` 1.4.0 → 1.4.6, `@better-auth/utils` 0.4.2 → 0.5.1, `@better-fetch/fetch` 1.3.3.
- `@better-auth/utils` (0.5.1) i `@better-auth/core` są wpisane wprost do `package.json` (panel admina importuje
  z utils kod TOTP). Przy następnej aktualizacji zmień razem trzy wersje 1.7.x i sprawdź utils.
- Override `better-call → zod: $zod` zostaje bez zmian.
- **Schemat bazy bez zmian**: tabele User, Session, Account, Verification, TwoFactor, Passkey (i Admin*) są
  w obu wersjach identyczne. Nie ma migracji Prisma.
- Kod aplikacji bez zmian. Dochodzi test `tests/unit/auth/better-auth-upgrade-contract.test.ts`, który uruchamia
  prawdziwe Better Auth z naszą konfiguracją (baza w pamięci): nazwy i atrybuty ciasteczek, stara sesja nadal
  działa, pola sesji, hook rejestracji (wersja regulaminu), blokada obcego Origin, Turnstile, kody TOTP.

## Zmiany w bibliotece, które nas dotyczą (same poprawki błędów)
- Sesje: `revoke-session` i usunięcie konta kasują ciasteczko; `getSession` nie zostawia wygasłej sesji.
- 2FA: po wygaśnięciu wyzwania kod nie jest już liczony jako błędna próba.
- Passkey: oczekiwany origin pochodzi wyłącznie z konfiguracji (my i tak go podajemy), `userVerification:
  "required"` w panelu admina jest teraz egzekwowane przez samą bibliotekę (my sprawdzamy to też sami).
- Linki weryfikacji e-mail i zmiany adresu działają tylko dla konta, dla którego je wysłano.
- Hasło: nieudany reset nie zużywa linku; zmiana hasła nie zostaje, gdy nie da się unieważnić sesji.
- Google One Tap: poprawki obsługi FedCM. OAuth: brak błędu `state_mismatch` przy zmianie czasu (DST).
- `better-call`: ciasteczka `__Host-`/`__Secure-` zawsze dostają wymagane atrybuty (u nas już je mają);
  dokładne dopasowanie `Content-Type` (nasz klient wysyła `application/json`).
- Bezpieczeństwo: znane advisories (GHSA) nie dotyczą ani 1.7.7, ani 1.7.26. Alarm z `npm audit` z 08.11
  szedł przez stary Zod 3 w `better-call`; zniknął po wejściu Zod 4 do main.

## Ryzyka
- Logowanie dotyczy wszystkich. Najgorszy przypadek: wylogowanie użytkowników albo błąd 500 na `/api/auth/*`.
- Ciasteczko pamięci sesji (`__Secure-pp.session_data`, 60 s) może zostać odrzucone po zmianie wersji; wtedy
  sesja jest po prostu czytana z bazy. Ciasteczko sesji (`__Secure-pp.session_token`) ma ten sam format.
- Google, passkey i 2FA nie mają testu end-to-end w CI; sprawdza je test kontraktu i lista ręczna niżej.

## Plan wdrożenia (po scaleniu, osobno od Zod/Next/Nodemailer)
1. `/opt/serwerek/scripts/backup.sh` (musi się udać).
2. Zapisz liczbę aktywnych sesji (tylko odczyt, bez tokenów):
   `docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM \"Session\" WHERE \"expiresAt\" > now()"'`
3. `./deploy.sh <sha>r1` (aplikacja), potem `./deploy-admin.sh <sha>r1` (panel; ten sam kod biblioteki).
4. Sprawdzenie automatyczne (niżej). Wynik i tag zapisz w raporcie wdrożenia.

## Automatyczne sprawdzenie po wdrożeniu (bez właściciela)
- `curl -s -o /dev/null -w "%{http_code}" https://www.pawelperfect.com/api/health` → 200.
- `curl -s https://www.pawelperfect.com/api/auth/get-session` → 200 i treść `null` (gość).
- `curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -H "Origin: https://www.pawelperfect.com"
  -d '{"email":"x@example.test","password":"x"}' https://www.pawelperfect.com/api/auth/sign-in/email` → 400
  (brak odpowiedzi Turnstile; to dowód, że endpoint i wtyczka captcha działają, nikt się nie loguje).
- Strona główna z `?signin=1` (okno logowania) → 200. (Nie odpytuj opcji passkey: to zapisuje wyzwanie w bazie.)
- Ta sama liczba sesji co w kroku 2 (± naturalne logowania/wygaśnięcia). Spadek do zera = wszyscy wylogowani → cofnij.
- Przez 10 minut: `docker logs --since 10m polutek-app-1 2>&1 | grep -ciE "\[auth\]|Better Auth|status.?(401|500)"`
  porównane z 10 minutami sprzed wdrożenia; nowy wzrost błędów `[auth] session lookup failed` lub 500 = cofnij.
- Panel admina: `docker ps` pokazuje nowy tag `polutek-admin`, a `https://admin.pawelperfect.com` odpowiada
  jak przed wdrożeniem (przekierowanie Cloudflare Access, bez 500).

## Testy ręczne dla właściciela (opcjonalnie, kiedy zechce)
1. Bez wylogowania: odśwież stronę na telefonie i komputerze; nadal zalogowany.
2. Wyloguj się, zaloguj przez Google (konto wybierane z listy), potem przez One Tap.
3. Zaloguj się kluczem dostępu (passkey) na telefonie.
4. Jeśli masz 2FA: e-mail + hasło + kod z aplikacji; sprawdź „zapamiętaj urządzenie”.
5. Panel admina: wejście przez Cloudflare Access (i, jeśli używasz, passkey + kod TOTP przy akcji wrażliwej).

## Cofnięcie
- Schemat bazy się nie zmienia, więc cofnięcie jest bezpieczne i nie wymaga przywracania kopii.
- Aplikacja: `./deploy.sh <poprzedni-tag> --rollback` (uruchamia obraz z `.previous-image`, bez budowy).
- Panel: `./deploy-admin.sh <poprzedni-tag> --rollback`.
- Kiedy cofać od razu: spadek liczby sesji do zera, 500 na `/api/auth/get-session`, brak 400 z Turnstile,
  wyraźny wzrost błędów `[auth]` w logach. Sesje utworzone po wdrożeniu działają też na starej wersji.
