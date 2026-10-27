# Platforma wdrożeń "jak Vercel" - plan pełny (bez półśrodków)

Status: notatka z planem, nic z tego nie jest jeszcze zbudowane. Decyzja właściciela: robimy to w całości, nie etapami "na pół gwizdka".

## Cel

Każda zmiana (PR) ma własny działający adres do obejrzenia na telefonie, zanim trafi na produkcję. Produkcja wdraża się tym samym obrazem, który oglądał właściciel, bez przerwy w działaniu i z cofnięciem jednym kliknięciem. Wszystko widać w jednym panelu.

## Stan dzisiaj (punkt wyjścia)

- Źródła są wysyłane na serwerek (`./src`), `deploy.sh <tag>` buduje obraz lokalnie na 2 vCPU / 4 GB (2-3 min), migruje bazę w jednorazowym kontenerze, restartuje aplikację i sprawdza zdrowie, a przy awarii cofa obraz.
- Tryb `IMAGE_SOURCE=ghcr` i workflow `.github/workflows/images.yml` już istnieją (obrazy z GHCR, bez buildu na serwerze); nieużywane na co dzień.
- Brak podglądów, brak panelu, restart aplikacji z krótką przerwą, nowy tag trzeba ręcznie wymusić, bo `deploy.sh` pomija budowanie, jeśli obraz o tym tagu już jest (incydent 2026-10-26: stary kod pod nowym tagiem).

## Architektura docelowa

### 1. Build poza serwerem (CI)
- GitHub Actions buduje obrazy (app, worker, collector) dla każdego commitu na `main` i dla każdego PR-a. Tag = pełny hash commitu. Obrazy w GHCR (prywatne).
- Cache warstw w Actions, testy celowane i typecheck jako bramka przed publikacją obrazu.
- Serwer nigdy nie buduje; tylko pobiera obraz po hashu. Znika problem "pominięty build" i obciążenia 2 vCPU.

### 2. Podglądy per PR (preview)
- Wildcard DNS `*.podglad.pawelperfect.com` w Cloudflare (+ wildcard certyfikat), reverse proxy (Caddy/Traefik) kieruje `pr-<numer>.podglad...` do kontenera tego PR-a.
- Po otwarciu/aktualizacji PR-a: CI buduje obraz, serwer podnosi kontener `preview-<numer>`; komentarz w PR z linkiem i statusem. Po zamknięciu PR-a: kontener, wolumeny i baza są sprzątane.
- Izolacja: osobny Postgres (schemat/baza `preview_<numer>` ze zmigrowanym schematem i danymi demo), brak kluczy produkcyjnych (Stripe w trybie demo, bez wysyłki prawdziwych maili, bez dostępu do R2 produkcji, `noindex`).
- Dostęp tylko dla zalogowanych (Cloudflare Access, tożsamość właściciela), żeby podglądy nie były publiczne.
- Limity zasobów na kontener (CPU/RAM), maksymalna liczba jednoczesnych podglądów, automatyczne usypianie po bezczynności. Przy większym ruchu: osobny serwer podglądów, żeby nie ruszać produkcji.

### 3. Staging (stałe środowisko przed produkcją)
- `staging.pawelperfect.com`: ten sam obraz co produkcja, osobna baza z kopią zanonimizowaną, demo płatności. Tu idą testy dymne i ręczna akceptacja.
- Ścieżka: PR -> podgląd -> merge -> staging (automatycznie) -> promocja na produkcję.

### 4. Produkcja: promocja i wdrożenie bez przerwy
- Promocja = ten sam obraz (ten sam hash) z staging, bez ponownego buildu. Panel pokazuje, co dokładnie idzie.
- Blue/green: nowy kontener startuje obok starego, przechodzi kontrolę zdrowia i test dymny, dopiero wtedy proxy przełącza ruch; stary zostaje na szybki powrót (okno minut).
- Migracje: wzorzec rozszerz-migruj-skurcz (migracje addytywne, jak dziś), uruchamiane przed przełączeniem, ze zrzutem bazy przed migracją (jak dziś `pre-deploy`).
- Rollback jednym kliknięciem do dowolnego poprzedniego obrazu z historii.
- Kontrola po wdrożeniu: sprawdza zawartość działającego obrazu (znacznik wersji w `/api/health` = hash commitu, który musi się zgadzać z oczekiwanym), nie samą etykietę.

### 5. Panel (`deploy.pawelperfect.com`, za Cloudflare Access)
- Lista wdrożeń: czas, commit, autor, PR, środowisko, wynik, czas trwania, log builda i wdrożenia.
- Lista aktywnych podglądów z linkami i przyciskiem usunięcia; stan stagingu i produkcji (jaki hash, od kiedy, zdrowie).
- Przyciski: promuj, cofnij, wymuś przebudowę, usuń podgląd.
- Dane z logów deployów (dziś `deploy-*.log`) i z `telemetry.job_run` (już zapisuje wynik każdego deployu).

### 6. Obserwowalność i powiadomienia
- Powiadomienie (Telegram/e-mail) przy: nieudanym deployu, automatycznym rollbacku, zdrowiu poniżej progu, zapełnionym dysku/pamięci.
- Test dymny po każdym wdrożeniu (strona główna, odtwarzacz, logowanie, kasa w demo) z wynikiem w panelu.

## Czego to wymaga

- Cloudflare: wildcard DNS, Access (zmiany w koncie właściciela - wymagają jego zgody).
- GitHub: workflow, sekrety (token GHCR, klucz SSH/deploy), uprawnienia do komentarzy w PR.
- Serwer: reverse proxy z dynamicznymi trasami, katalog na podglądy, limity zasobów; rozważyć drugi serwer na podglądy.
- Rozdział sekretów: podglądy nigdy nie dostają `app.env` produkcji; osobny `preview.env` z wartościami demo.

## Ryzyka (i jak je zamykamy)

| Ryzyko | Zabezpieczenie |
|---|---|
| Podgląd łączy się z produkcyjną bazą/Stripe/pocztą | Osobny `preview.env`, osobna sieć Dockera bez dostępu do produkcyjnej bazy, test CI, że podgląd nie ma produkcyjnych kluczy |
| Przeciążenie 4 GB RAM | Build w CI, limity kontenerów, max 2 podglądy, usypianie, ewentualnie drugi serwer |
| Podglądy publiczne | Cloudflare Access + noindex |
| Migracja psuje produkcję | Zrzut przed migracją, migracje addytywne, test na stagingu na kopii |
| Etykieta obrazu kłamie (incydent 2026-10-26) | Tag = hash, znacznik wersji w `/api/health`, kontrola zawartości po wdrożeniu |

## Kolejność wykonania (jedna całość, ale w tej kolejności zależności)

1. CI buduje i publikuje obrazy po hashu + znacznik wersji w `/api/health`.
2. Reverse proxy z dynamicznymi trasami, wildcard DNS i Access.
3. Podglądy per PR (kontener + izolowana baza + komentarz w PR + sprzątanie).
4. Staging i test dymny.
5. Blue/green, promocja tym samym obrazem, rollback.
6. Panel i powiadomienia.
7. Dokumentacja operacyjna (`docs/operations/SERWEREK.md`) i aktualizacja `CLAUDE.md`.
