# K32 — inwentarz odtwarzania

Stan na 7 listopada 2026. To przegląd plików repozytorium i dokumentacji; nie połączono się z serwerem, Cloudflare, Hetzner ani zewnętrznym bucketem. Wnioski opisują udokumentowany mechanizm, nie potwierdzają aktualnego stanu usług.

## Zasoby i obecny dowód

| Zasób | Udokumentowana kopia | Co sprawdza obecny test | Brakujący dowód / ryzyko |
|---|---|---|---|
| PostgreSQL Polutka | Nocny `pg_dumpall`; lokalna rotacja 7 dni; kopia w prywatnym R2 `serwerek-backups`, szyfrowana age, retencja R2 15 dni i blokada usunięcia 14 dni. | Cotygodniowy `restore-test.sh` odtwarza najnowszy lokalny dump do kontenera tymczasowego bez sieci; sprawdza tylko liczbę `User`, `Video`, historię migracji (różnica ≤3), wiek dumpa ≤30 h i obecność zaszyfrowanego obiektu w R2. | Brak WAL/PITR; udokumentowane RPO wynosi do 24 h. Cotygodniowy test nie pobiera ani nie odszyfrowuje offsite dumpa. RTO pełnego odtworzenia nie jest zmierzone. Test nie sprawdza integralności kanałów, członkostw, praw, oryginałów ani odtwarzania filmu. |
| PostgreSQL PP Support | `pg_dumpall` jest wśród wymaganych baz backupu. | Cotygodniowy restore-test dotyczy tylko `polutek-db-1`. | Brak udokumentowanego testu odtworzenia bazy Support i załączników razem. |
| Załączniki PP Support | Osobny `pp-support-storage-<ts>.tar.gz`, szyfrowany przed offsite uploadem. | Backup sprawdza obecność i rozmiar archiwum w swoim przebiegu. | Brak udokumentowanego odtworzenia archiwum i sprawdzenia powiązania plików z rekordami DB. |
| Konfiguracja i sekrety | `configs-<ts>.tar.gz` zawiera skrypty, dokumentację, compose i jednostki, ale wyklucza `.env`, źródła aplikacji, logi i kopie robocze. Oddzielne `secrets-<ts>.tar.gz.age` obejmuje pliki env i katalog `secrets/`. | Manifest zapisuje rozmiar i SHA-256 plików; `backup.sh` weryfikuje wysłane obiekty przez `rclone check`. | Bootstrap wymaga niezależnego dostępu do R2 i klucza prywatnego age. Dokumentacja wskazuje możliwe lokalizacje prywatnego klucza niezgodnie; jego niezależna kopia offline nie jest potwierdzona. Nie należy sprawdzać katalogu sekretów serwera w ramach tego audytu. |
| Kod i obrazy | Kod źródłowy jest w GitHub; obrazy są budowane/publikowane osobnym protokołem wydania. | Bieżąca gałąź ma lokalne dowody release-proof dla wybranych ścieżek. | Backup hosta nie obejmuje source ani obrazów; pełne odtworzenie zależy od dostępu do GitHub/registry i odtworzenia konfiguracji. K06 nie ma jeszcze pozytywnego odbioru pełnego wydania. |
| Oryginały wideo, HLS i miniatury R2 | Rutynowy `backup.sh` nie kopiuje tych obiektów ani nie ustanawia ich blokady usuwania. | Brak testu odtworzenia tych obiektów z kopii. | Udokumentowane RPO jest nieograniczone: usuniętego oryginału/miniatury nie da się odzyskać z tej kopii. HLS można odtworzyć tylko, jeśli oryginał przetrwa i mieści się to w zatwierdzonym RTO. Włączenie wersjonowania/replikacji ma koszt i wymaga osobnej decyzji. |
| Cloudflare: DNS, Tunnel, Workers | Dokumentacja opisuje ręczne zarządzanie i osobne pliki `cloudflare-backup/`/`dns-backup/` w przestrzeni sekretów właściciela. | Brak IaC i brak testu odtworzenia konfiguracji konta w świeżej strefie. | Nie wiadomo z repo, czy kopie są aktualne, kompletne ani dostępne bez serwera. Odzyskanie wymaga konta i operatora. |
| Płatności i webhooki | Własne rekordy, sumy i zdarzenia znajdują się w PostgreSQL; stan operatora płatności pozostaje zewnętrzny. | K11/K12 mają testy lokalnych kolejności i agregatów, lecz nie test cofnięcia snapshotu wraz z późniejszymi zdarzeniami dostawcy. | Restore starszego DB może cofnąć stan już zaakceptowanego zwrotu/sporu i praw dostępu. Przed aktywną sprzedażą potrzebny jest uzgodniony replay/reconciliation w test-mode; bez ponownego obciążania. |
| Redis, sesje i zadania | Sesje i trwałe zadania aplikacji są zapisywane w DB; rutynowy backup nie zawiera dumpa Redis. | Brak testu odtworzenia Redis ani jawnego rozdzielenia cache/limitów od każdej kolejki ulotnej. | Trzeba potwierdzić, czy Redis przechowuje wyłącznie odbudowywalny cache/limity, czy jakikolwiek stan wymagany po restore; następnie opisać politykę unieważnienia sesji i wznowienia zadań. |

## Znane granice procedury

- `restore-test.sh` jest lokalnym testem dumpa, nie ćwiczeniem utraty hosta ani testem offsite-only. Wymaga działającego źródłowego kontenera Postgres, Dockera i lokalnych plików backupu.
- `WAKE-UP.md` opisuje ręczne odtworzenie nowego hosta. Sama sekwencja z `DROP DATABASE` jest w dokumencie oznaczona jako nieprzećwiczona.
- Obecność zaszyfrowanego pliku w R2 nie dowodzi, że dostępne są niezależne poświadczenia i klucz age, że można go pobrać i odszyfrować, ani że jego zawartość jest kompletna.
- W dokumentacji jest historyczny wynik restore testu z 4 października 2026; nie jest to dowód świeżego przebiegu na obecnym SHA ani pełnego odtworzenia.
- RTO pełnego systemu nie jest zmierzone. Jednostkowy czas przywrócenia bazy do kontenera nie obejmuje provisioning hosta, obrazów, sekretów, DNS/Tunnel, storage ani weryfikacji filmu.

## Decyzje i dowody potrzebne do domknięcia K32

1. Właściciel zatwierdza RPO/RTO osobno dla DB, konfiguracji, sekretów, Support i mediów. Obecne „DB do 24 h” jest opisem aktualnej kadencji, nie zatwierdzonym celem produktu.
2. Właściciel potwierdza bezpieczne, niezależne od hosta miejsce klucza age i procedurę pozyskania poświadczeń do odczytu bucketa. Nie ujawniać kluczy w repo ani logach.
3. Właściciel rozstrzyga, czy nieodtwarzalne oryginały/miniatury mają otrzymać kopię lub wersjonowanie oraz zatwierdza koszt i retencję. Do tej decyzji nie deklarować odzyskiwalności tych mediów.
4. Rozszerzyć syntetyczny restore acceptance o relacje właściciel–kanał–członkostwo–film, załączniki Support oraz ocenę kompletu po czystym provisioning. Osobno wykonać offsite-only download/decrypt/restore na odizolowanych zasobach.
5. Zmierzyć pełne RTO/RPO; test-mode odtworzenia płatności musi objąć zdarzenia operatora późniejsze niż snapshot. Nie wykonywać realnych charge/refund.

Do czasu spełnienia powyższych punktów K32 pozostaje częściowe. Ten inwentarz jest przygotowaniem do decyzji i testu syntetycznego; nie jest zgodą na operacje serwerowe ani na płatne kopie.
