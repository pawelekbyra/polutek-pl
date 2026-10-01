# Serwerek 04: warstwa danych, kolejka i operacje

Research z 2026-10-01. Temat: co zrobić z bazą (Neon czy własny Postgres), kopiami, kolejką dla workera HLS i codziennym utrzymaniem, gdy aplikacja ma kiedyś działać na serwerze Hetzner "serwerek" (CPX22: 2 vCPU, 4 GB RAM, 80 GB, Norymberga). Kontekst: [`docs/architecture/serwerek.md`](../../architecture/serwerek.md), [`docs/operations/SERWEREK.md`](../../operations/SERWEREK.md) (zwłaszcza §8 backup i §14 pomiary).

Oznaczenia: **[zmierzone]** sprawdzone przez nas 2026-10-01, **[źródło]** z dokumentacji (link w §9), **[niezweryfikowane]** wiedza ogólna, do potwierdzenia przed użyciem.

> ## Rekomendacja dla nas
>
> 1. **Baza i aplikacja muszą stać w tym samym regionie.** Projekt Neon `restless-glade-19830690` jest w **AWS us-east-1** (Wirginia), a serwerek w Norymberdze: połączenie TCP serwerek → Neon to **ok. 92 ms** [zmierzone]. Strona główna robi kilka zapytań po kolei, więc aplikacja na serwerku z bazą w Neon us-east-1 byłaby wyraźnie wolniejsza niż dziś na Vercelu. Albo przenosimy aplikację razem z bazą, albo nie przenosimy wcale.
> 2. **Na dziś: zostaje Neon + Vercel.** Baza waży ok. 56 MB, mieści się w darmowym planie i ma za sobą kopie oraz PITR (6 h) za darmo. Nic nie zmieniamy, dopóki aplikacja nie przenosi się na serwerek.
> 3. **Gdy aplikacja przechodzi na serwerek: własny Postgres 17 w Dockerze na tym samym serwerze**, bez PgBouncera (jeden długo żyjący proces Node z pulą Prisma 5-10 połączeń wystarcza). Migracja przez `pg_dump`/`pg_restore` w krótkim oknie serwisowym (baza jest mała, przerwa rzędu kilku minut), **nie** przez replikację logiczną z Neon (wymaga nieodwracalnego włączenia w projekcie i restartu compute; przy 56 MB nie warto).
> 4. **Kopie: pgBackRest do Cloudflare R2** (pełna co tydzień, różnicowa co noc, ciągłe archiwum WAL, szyfrowanie AES-256, 4 tygodnie historii). Daje PITR z RPO ok. 5 min. Obecny nocny `pg_dumpall` zostaje jako druga, niezależna kopia logiczna. Próba odtworzenia raz w miesiącu. Koszt R2: w darmowych 10 GB.
> 5. **Kolejka dla workera HLS: zacznij od pg-boss na Postgresie, nie od Redisa + BullMQ.** Transkodowań jest kilka w miesiącu, concurrency 1; osobny Redis to dodatkowa usługa do kopii, pamięci i aktualizacji bez zysku. BullMQ ma sens dopiero przy dużym wolumenie zadań albo jeśli i tak postawimy Redisa. Limity żądań zostają na Upstash (darmowe, działa).
> 6. **IaC: jeden skrypt bash `bootstrap.sh` w repo + pliki compose**, idempotentny, uruchamiany przez SSH. Ansible ma sens, gdy maszyn będzie więcej niż dwie. Cel odtworzenia całej maszyny: ok. 1 h (RTO), przećwiczony.
> 7. **Bezpieczeństwo, następne kroki (darmowe):** sekrety jako pliki zaszyfrowane SOPS+age w repo (klucz age tylko na serwerze i w `.ai-secrets`), SSH tylko przez Cloudflare Tunnel (zamknięcie portu 22 w obu firewallach po przetestowaniu dostępu awaryjnego przez konsolę Hetzner), aktualizacje obrazów raz w tygodniu, CrowdSec opcjonalnie. Docker zostaje w trybie zwykłym (rootful), ale porty kontenerów tylko na `127.0.0.1`.

---

## 1. Stan wyjściowy (fakty)

| Rzecz | Wartość | Skąd |
|---|---|---|
| Neon projekt | `restless-glade-19830690` ("NEON-krau"), Postgres 17, region **aws-us-east-1**, plan Free (`free_v3`) | Neon API, 2026-10-01 [zmierzone] |
| Compute | 0,25 CU (stałe, min = max), scale-to-zero | Neon API [zmierzone] |
| Rozmiar | `synthetic_storage_size` ≈ 56 MB; limit gałęzi 1 GiB | Neon API [zmierzone] |
| Historia (PITR) | 21 600 s = 6 h | Neon API [zmierzone] |
| Replikacja logiczna | wyłączona (`enable_logical_replication: false`) | Neon API [zmierzone] |
| RTT serwerek → Neon (TCP connect :5432) | 92-95 ms (pierwsza próba 220 ms, z DNS) | `curl` z serwerka, 5 prób [zmierzone] |
| Schemat | `prisma/schema.prisma`: 39 modeli, ok. 1150 linii; `url = DATABASE_URL`, `directUrl = DATABASE_URL_UNPOOLED` | repo |
| Rozszerzenia Postgresa | żadne nie są deklarowane w schemacie (Prisma bez `extensions`); listy z bazy nie udało się pobrać (`run_sql` przez MCP zwrócił 401) | repo; do potwierdzenia `select * from pg_extension` |
| Prisma | `@prisma/client`/`prisma` ^6.19.3 | `package.json` |
| Migracje | `scripts/vercel-build.mjs`: `db:migrate:repair` + `db:migrate:deploy` tylko na buildzie produkcyjnym Vercel | repo |
| Limity żądań | `lib/rate-limit.ts`: Upstash **REST** (HTTP, skrypt Lua przez `EVAL`), fallback w pamięci | repo |
| Pomiary aplikacji na serwerku | app 122-240 MiB, Postgres 35-69 MiB, szczyt systemu 1,37 GB / 3,8 GB; wąskie gardło CPU | `SERWEREK.md` §14 [zmierzone] |
| Backup serwerka | nocny `pg_dumpall` kontenerów + tar konfiguracji, lokalnie 7 dni, R2 `serwerek-backups` 14 dni | `SERWEREK.md` §4, §8 |

## 2. Neon zostaje czy własny Postgres?

### 2.1 Neon Free, co dostajemy [źródło: Neon plans]

1 GB/projekt (20 GB na koncie), 100 CU-h/projekt/mies., scale-to-zero po 5 min (nie da się wyłączyć), 10 gałęzi, 5 GB transferu publicznego/mies., okno natychmiastowego odtworzenia 6 h, 1 ręczny snapshot. Plan Launch: $0,106/CU-h, $0,35/GB-mies., odtwarzanie do 7 dni, bez opłaty minimalnej.

Przy 0,25 CU 100 CU-h to ok. 400 h aktywności w miesiącu: przy rosnącym ruchu (baza nie zasypia) limit się skończy. Dziś wystarcza.

### 2.2 Opóźnienie decyduje

Każde zapytanie z serwerka do Neon us-east-1 kosztuje co najmniej jeden RTT ≈ 92 ms [zmierzone], nowe połączenie TLS kilka RTT. Strona główna (sidebar, film, komentarze, ustawienia) to kilka do kilkunastu zapytań, częściowo sekwencyjnych: szacunkowo +0,5 do 1,5 s na render [niezweryfikowane, wynika z RTT × liczba zapytań]. Dla porównania lokalnie na serwerku `/en` p50 = 330 ms pod obciążeniem (§14). To przekreśla układ "aplikacja na serwerku, baza w Neon us-east-1".

Region projektu Neon nie zmienia się w miejscu; trzeba założyć nowy projekt np. w `aws-eu-central-1` (Frankfurt, kilka ms od Norymbergi [niezweryfikowane]) i przenieść dane tak samo jak do własnego Postgresa. Wtedy jednak dzisiejszy Vercel (funkcje domyślnie w USA, iad1 [niezweryfikowane dla tego projektu]) miałby daleko do bazy. Wniosek: region bazy zmienia się **razem** z miejscem uruchamiania aplikacji.

### 2.3 Porównanie (po przeniesieniu aplikacji na serwerek)

| | Neon (nowy projekt we Frankfurcie) | Postgres 17 w Dockerze na serwerku |
|---|---|---|
| Opóźnienie | kilka ms + TLS | <1 ms (sieć wewnętrzna compose) |
| Koszt | Free, dopóki mieści się w 1 GB i 100 CU-h; potem Launch (pay-as-you-go) | 0 zł ponad serwer; RAM ok. 70-300 MB |
| Kopie/PITR | wbudowane (6 h na Free) | musimy zrobić sami (§4) |
| Gałęzie (preview, testy migracji) | tak, za darmo | nie (CI ma `integration-postgres`) |
| Awaria serwerka | baza żyje dalej | baza leży razem z aplikacją; odtworzenie z R2 |
| Praca administracyjna | prawie zero | aktualizacje, kopie, próby odtwarzania, monitoring |
| Zimny start | scale-to-zero budzi się kilkaset ms [niezweryfikowane] | brak |

**Rekomendacja:** dopóki działamy na Vercelu, zostaje Neon us-east-1. Gdy aplikacja przechodzi na serwerek, wybór jest między "Neon Frankfurt" (mniej pracy, zależność od zewnętrznej usługi i limitów Free) a "własny Postgres" (najszybciej, pełna kontrola, nasza odpowiedzialność za kopie). Dla jednej maszyny z ok. 2,4 GB wolnego RAM i bazą 56 MB rekomenduję **własny Postgres**, pod warunkiem że wcześniej działa pgBackRest z przećwiczonym odtworzeniem (§4). Bez tego warunku: Neon Frankfurt.

## 3. Migracja z Neon do własnego Postgresa 17

### 3.1 Metoda: dump/restore, nie replikacja

- **`pg_dump -Fc` + `pg_restore`**: przy 56 MB zrzut i odtworzenie trwają sekundy do minut [niezweryfikowane czasowo, rząd wielkości]. Przerwa w zapisie = czas zrzutu + odtworzenia + przełączenia, czyli kilka minut.
- **Replikacja logiczna z Neon** jest wspierana [źródło: Neon logical replication], ale: włączenie jest **nieodwracalne dla projektu**, **restartuje wszystkie compute**, a podłączony subskrybent **nie pozwala bazie zasnąć** (więcej CU-h). Nie replikuje DDL ani wartości sekwencji [niezweryfikowane: ogólne ograniczenie replikacji logicznej Postgresa]. Ma sens dla dużych baz, gdzie dump trwa godzinami. U nas nie.

### 3.2 Procedura (okno serwisowe ok. 15 min)

1. **Próba generalna** dzień wcześniej: ta sama procedura do bazy testowej na serwerku, plus `scripts/verify-restored-database.ts` (z `docs/operations/database-backup-restore-drill.md`) i test aplikacji przez tunel.
2. Na serwerku działa docelowy `postgres:17` (ta sama wersja główna co Neon) z pustą bazą `polutek` i rolą aplikacji.
3. Tryb serwisowy: zatrzymanie zapisów (strona "przerwa techniczna" na kilka minut; Stripe i Clerk ponawiają nieudane webhooki [niezweryfikowane: dokładne okna ponowień]).
4. Zrzut z Neon połączeniem **bez poolera** (`DATABASE_URL_UNPOOLED`), `pg_dump` w wersji ≥ 17 (np. z obrazu `postgres:17`):
   ```
   pg_dump "$NEON_UNPOOLED" -Fc --no-owner --no-privileges -f polutek.dump
   ```
5. Odtworzenie:
   ```
   pg_restore -d "postgresql://polutek@127.0.0.1:5432/polutek" --no-owner --role=polutek -j 2 polutek.dump
   ```
   Tabela `_prisma_migrations` przechodzi razem z danymi, więc `prisma migrate deploy` po przełączeniu nie powinien nic zastosować (sprawdzić: `prisma migrate status`).
6. Weryfikacja: liczby wierszy kluczowych tabel (`User`, `Video`, `Payment`, `PatronGrant`, `Comment`) po obu stronach, `ANALYZE`.
7. Przełączenie `DATABASE_URL` aplikacji na serwerku, test logowania, płatności testowej, odtwarzania.
8. Neon zostaje **nietknięty co najmniej 30 dni** jako awaryjny powrót. Usunięcie projektu Neon to decyzja właściciela.

### 3.3 Prisma i połączenia

- Prisma 6: domyślna pula = `2 × fizyczne_rdzenie + 1` (na 2 vCPU ok. 5), `pool_timeout` 10 s [źródło: Prisma connection pool]. Długo żyjący serwer Node to jeden proces i jedna pula, więc **PgBouncer nie jest potrzebny** (Prisma zaleca go głównie dla serverless).
- `DATABASE_URL` i `DATABASE_URL_UNPOOLED` na serwerku mogą wskazywać **to samo** (`postgresql://polutek:...@db:5432/polutek?connection_limit=10`). `directUrl` służy migracjom; bez poolera nie ma różnicy.
- Budżet połączeń: app 10 + worker/kolejka 3 + migracje/backup/psql kilka → `max_connections = 40` z zapasem.
- Migracje: dziś robi je `vercel-build.mjs` na buildzie produkcyjnym. Na serwerku: jednorazowy kontener `migrate` (już jest w `deploy/serwerek/docker-compose.yml`, profil `tools`) uruchamiany **przed** podmianą kontenera `app` w skrypcie wdrożenia; przy błędzie wdrożenie staje, stara wersja działa dalej. Reguły z CLAUDE.md §4 (bez BOM, addytywnie) zostają. Obraz narzędziowy waży 3,4 GB [zmierzone]; da się go odchudzić (tylko `prisma` CLI + schemat + migracje).

### 3.4 Konfiguracja Postgresa dla 4 GB współdzielonych z aplikacją i ffmpeg

Postgres nie jest tu jedynym lokatorem (app do 1 GB, ffmpeg do 1,5 GB, system), więc liczymy od budżetu ok. 512 MB-1 GB dla bazy, a nie 25% całego RAM. Dokumentacja: domyślnie `shared_buffers` 128 MB, `work_mem` 4 MB, `maintenance_work_mem` 64 MB; 25% RAM to punkt startowy dla **dedykowanego** serwera, powyżej 40% raczej bez zysku [źródło: PG 17 resource config].

```
# postgresql.conf (albo command: w compose), punkt startowy
max_connections = 40
shared_buffers = 256MB          # baza 56 MB mieści się cała; 128MB z §14 też wystarczy
effective_cache_size = 1GB      # podpowiedź dla planera, nie alokacja
work_mem = 8MB                  # × liczba węzłów sortowania × połączenia; trzymać nisko
maintenance_work_mem = 128MB
wal_level = replica             # wymagane przez pgBackRest (archiwum WAL)
archive_mode = on
archive_command = 'pgbackrest --stanza=polutek archive-push %p'
archive_timeout = 300           # wymusza zamknięcie segmentu WAL co 5 min => RPO ok. 5 min
max_wal_size = 1GB
min_wal_size = 80MB
checkpoint_completion_target = 0.9
random_page_cost = 1.1          # dysk SSD/NVMe
shared_preload_libraries = 'pg_stat_statements'
log_min_duration_statement = 500ms
log_checkpoints = on
```

Compose: `mem_limit: 768m` dla `db` (w §14 zalecono 512m przy `shared_buffers=128MB`; przy 256MB dać 768m), wolumen na `/opt/serwerek/data/<app>/pg`, port nieopublikowany (tylko sieć compose). Rozszerzenia: dziś żadne nie są wymagane przez schemat; jeśli zapytanie z §1 pokaże jakieś, dodać je przed migracją. `pg_stat_statements` warto mieć do diagnozy wolnych zapytań.

## 4. Kopie zapasowe

### 4.1 Co mamy i czego brakuje

Obecny `backup.sh`: nocny `pg_dumpall` + R2 14 dni. To kopia **logiczna raz na dobę**: RPO do 24 h, brak odtworzenia na wybraną chwilę, brak szyfrowania po naszej stronie (R2 szyfruje w spoczynku po swojej [niezweryfikowane]), odtworzenie nieprzećwiczone (`SERWEREK.md` §11 pkt 9). Na dane testowe wystarcza; na produkcję (płatności, konta) nie.

### 4.2 pgBackRest czy WAL-G

| | pgBackRest | WAL-G |
|---|---|---|
| PITR, archiwum WAL, kopie przyrostowe | tak (pełna/różnicowa/przyrostowa) | tak (delta) |
| S3-kompatybilne (R2) | tak, `repo1-type=s3` + własny endpoint [źródło: pgBackRest guide] | tak [niezweryfikowane dla R2] |
| Szyfrowanie repo | wbudowane `repo1-cipher-type=aes-256-cbc` [źródło] | libsodium/OpenPGP |
| Retencja | `repo1-retention-full(-type=time)` [źródło] | `delete retain` ręcznie/cron |
| Weryfikacja | `pgbackrest check`, `verify`, `info` | `wal-verify` |
| Dokumentacja | bardzo obszerny user guide (wersja 2.59.2 w dokumentacji) | krótsza |

Wybór: **pgBackRest** (lepsza dokumentacja dla agenta AI, wbudowane szyfrowanie i retencja, `check` jako test konfiguracji).

### 4.3 Konfiguracja (szkic)

pgBackRest musi widzieć katalog danych i WAL: najprościej obraz `postgres:17` rozszerzony o pakiet `pgbackrest` (jeden kontener), konfiguracja w `/etc/pgbackrest/pgbackrest.conf`:

```ini
[global]
repo1-type=s3
repo1-s3-endpoint=<ACCOUNT_ID>.r2.cloudflarestorage.com
repo1-s3-bucket=serwerek-pgbackrest
repo1-s3-region=auto
repo1-s3-uri-style=path
repo1-path=/polutek
repo1-s3-key=<z sekretu>
repo1-s3-key-secret=<z sekretu>
repo1-cipher-type=aes-256-cbc
repo1-cipher-pass=<z sekretu, kopia w .ai-secrets>
repo1-retention-full-type=time
repo1-retention-full=28
compress-type=zst
archive-async=y
spool-path=/var/spool/pgbackrest
process-max=1
start-fast=y

[polutek]
pg1-path=/var/lib/postgresql/data
```

`region=auto` i `uri-style=path` dla R2 to typowa konfiguracja S3-kompatybilnych magazynów [niezweryfikowane dla pgBackRest + R2: przetestować `pgbackrest check` przed poleganiem]. Osobny bucket i **osobny token R2 ograniczony do tego bucketu** (jak `serwerek-backups`). Hasło szyfrowania bez kopii = kopie nie do odczytania: kopia w `.ai-secrets` właściciela obowiązkowo.

Harmonogram (cron na hoście, `docker exec`):

```
# pełna w niedzielę 03:00, różnicowa pn-sob 03:00
0 3 * * 0   root docker exec polutek-db pgbackrest --stanza=polutek --type=full backup
0 3 * * 1-6 root docker exec polutek-db pgbackrest --stanza=polutek --type=diff backup
```

Plus ciągłe `archive-push` z `archive_command`. `pg_dumpall` z `backup.sh` zostaje (kopia logiczna, odporna na błąd w pgBackRest, czytelna zwykłym `psql`).

### 4.4 Cele i koszt

- **RPO** (ile danych możemy stracić): ok. 5 min (`archive_timeout = 300`). Dla jednoosobowego projektu wystarcza; Stripe i tak jest źródłem prawdy o płatnościach (rekoncyliacja przez `fulfillPayment()`).
- **RTO** (jak szybko wracamy): do 1 h przy utracie maszyny (nowy serwer + bootstrap + restore), do 15 min przy błędzie w danych na działającej maszynie (`pgbackrest restore --type=time --target=...` do nowego katalogu).
- **R2**: baza 56 MB, pełna kopia po zst kilkanaście MB, 4 pełne + różnicowe + WAL: rząd setek MB [niezweryfikowane, szacunek]. Mieści się w darmowych 10 GB. Operacje: jeden segment WAL = jeden PUT; przy `archive_timeout=300` maks. ok. 8 600 segmentów/mies. plus kopie, daleko poniżej darmowego 1 mln operacji klasy A [źródło: R2 pricing: $0,015/GB-mies., A $4,50/mln, B $0,36/mln, darmowo 10 GB + 1 mln A + 10 mln B, egress 0].

### 4.5 Próba odtworzenia (co miesiąc, automatycznie)

1. Na serwerku tymczasowy kontener `postgres:17` + pgBackRest z tą samą konfiguracją repo (osobny token R2 tylko do odczytu).
2. `pgbackrest --stanza=polutek --type=time --target="<teraz - 10 min>" restore` do pustego katalogu, start, `scripts/verify-restored-database.ts` z `RESTORE_DATABASE_URL`.
3. Wynik (czas, liczby wierszy) do `/var/log/serwerek/restore-drill.log`; przy błędzie mail jak w `health.sh`.
4. Kontener i katalog usuwane po teście. Raz na kwartał ręcznie: odtworzenie na **nowej** maszynie (pełny DR, §6.5).

## 5. Kolejka dla workera HLS

### 5.1 Charakter zadań

Kilka transkodowań w miesiącu, każde minuty do dziesiątek minut CPU (§14: 60 s 1080p → 720p+480p w 19-43 s; pełna drabinka i dłuższe filmy znacznie dłużej). Concurrency 1. Liczy się: nie zgubić zadania, nie zrobić go dwa razy równolegle, widzieć postęp w panelu, ponowić po awarii.

### 5.2 pg-boss czy BullMQ

| | pg-boss (Postgres) | BullMQ (Redis) |
|---|---|---|
| Nowa usługa | nie (ta sama baza) | Redis: kontener, pamięć, AOF, kopie, aktualizacje |
| Transakcyjność z danymi | zadanie można dodać w tej samej transakcji co zmianę `Video` | dwa systemy, możliwa niespójność |
| Mechanizm | `SKIP LOCKED` [źródło: pg-boss] | struktury Redis + blokady |
| Ponowienia, backoff, deduplikacja, harmonogram, dead letter | tak [źródło] | tak (`attempts`, `backoff`, `jobId`, repeatable) |
| Postęp zadania | własna tabela/kolumna | `job.updateProgress()` wbudowane |
| Wymagania | Node ≥ 22.12, Postgres ≥ 13 [źródło]; na serwerku Node 22.23 | Redis z `maxmemory-policy noeviction`, AOF zalecany [źródło: BullMQ production] |
| Panel | brak oficjalnego (podgląd przez SQL/admin) | Bull Board |
| Przy dużym wolumenie | obciąża Postgresa | lepszy |

Uwaga: jeśli baza zostaje w Neon us-east-1, pg-boss odpytuje bazę przez ocean i nie pozwala jej zasnąć (zużywa CU-h) [niezweryfikowane: częstotliwość odpytywania].

**Wybór:** pg-boss, **o ile** Postgres stoi na serwerku. Jeśli worker ruszy wcześniej, gdy baza jest jeszcze w Neon us-east-1: najprostsza kolejka to wiersz w istniejącej tabeli zadań wideo (logika `video-provider-jobs` z rekoncyliacją) i worker pytający co 30-60 s, albo BullMQ na lokalnym Redisie. Decyzja zależy od kolejności migracji (otwarte pytanie 1).

### 5.3 Projekt zadania (niezależnie od biblioteki)

- **Klucz idempotencji**: `transcode:<videoId>:<sha256 oryginału>:<wersja drabinki>`. Ten sam klucz = to samo zadanie (pg-boss `singletonKey`, BullMQ `jobId`). Wynik idzie do `videos/<id>/hls/<wersja>/` w R2; manifest główny publikowany **na końcu** (przełączenie przez zapis w bazie), więc powtórzone zadanie nadpisuje tylko swój katalog roboczy.
- **Concurrency 1**, worker w osobnym kontenerze; ffmpeg jako **proces potomny** (`child_process.spawn`), więc pętla zdarzeń Node nie jest blokowana i blokada zadania się odnawia (BullMQ: zadanie "stalled", gdy worker nie odnowi blokady, bo CPU jest zajęte w procesie Node [źródło: BullMQ stalled jobs]). Limity z §14: `nice -n 19`, `MemoryMax=1500M`, bez `CPUQuota`.
- **Ponowienia**: 3 próby, backoff wykładniczy od 1 min. Błąd deterministyczny (uszkodzony plik, nieobsługiwany kodek) oznaczyć jako trwały i nie ponawiać. Timeout zadania: np. 4 × długość filmu + 10 min.
- **Zadanie przerwane** (restart kontenera, OOM): BullMQ przenosi je z powrotem po `stalledInterval` i liczy `maxStalledCount` (domyślnie 30 s i 1 [niezweryfikowane: z API BullMQ]); pg-boss przez wygaśnięcie (`expireIn`) i ponowienie. Worker przy starcie czyści katalog roboczy na dysku.
- **Postęp**: ffmpeg `-progress pipe:1` → co 5 s zapis procentu i etapu do bazy (jak dzisiejsze stany `CREATING_SOURCES`/`PARTIALLY_READY` w panelu admina). Panel czyta bazę, nie kolejkę.
- **Zamknięcie**: obsługa `SIGTERM` (dokończ albo oddaj zadanie), `docker stop -t 60`.
- **Retencja**: zadania zakończone 7 dni, nieudane 30 dni.

### 5.4 Gdyby jednak Redis

```
# redis.conf
maxmemory 128mb
maxmemory-policy noeviction     # wymagane przez BullMQ
appendonly yes
appendfsync everysec            # BullMQ: zapis co sekundę wystarcza
```

Port nieopublikowany (sieć compose). Klient workera: `maxRetriesPerRequest: null` [źródło: BullMQ production]. Kopia: plik AOF do R2 w `backup.sh` (stan kolejki da się odtworzyć z bazy, więc to wygoda, nie konieczność).

### 5.5 Limity żądań: Upstash zostaje

`lib/rate-limit.ts` mówi do Upstash przez **REST**, nie protokołem Redis, więc lokalny Redis wymagałby nowej implementacji `RateLimitStore` (np. ioredis) albo bramki REST (np. projekt `serverless-redis-http` [niezweryfikowane]). Upstash Free działa. Opóźnienie z Norymbergi zależy od regionu bazy Upstash (do sprawdzenia: jeśli USA, każde limitowane żądanie dostaje ok. 90 ms). Rekomendacja: zostaw Upstash; przy przenosinach aplikacji sprawdź region i w razie potrzeby załóż nową bazę Upstash w UE. Lokalny Redis tylko, jeśli i tak powstanie dla BullMQ.

## 6. Operacje

### 6.1 Aktualizacje Postgresa

- **Wersje poboczne (17.x)**: `docker compose pull db && docker compose up -d db`. Restart = kilka sekund przerwy (żądania trafiające w restart dostaną błąd). W nocy, po świeżej kopii.
- **Wersje główne (17 → 18)**: zmiana formatu danych. Dla małej bazy najprostsze i najbezpieczniejsze: nowy kontener `postgres:18` obok, `pg_dump | pg_restore` (jak w §3.2), przełączenie, stary katalog zostaje 30 dni. `pg_upgrade --link` jest szybszy, ale w Dockerze wymaga obrazu z dwiema wersjami [niezweryfikowane]. Prawdziwe "zero przestojów" (replikacja logiczna między wersjami) przy 56 MB nie jest warte złożoności; akceptujemy kilka minut przerwy z ogłoszeniem. pgBackRest: po zmianie wersji głównej `stanza-upgrade` i nowa pełna kopia.

### 6.2 Logi

- Docker: w `/etc/docker/daemon.json` `{"log-driver":"local","log-opts":{"max-size":"20m","max-file":"5"}}` (domyślny `json-file` nie rotuje [niezweryfikowane: zachowanie domyślne]). Restart dockera tylko w oknie serwisowym.
- `/var/log/serwerek/*.log`: `logrotate` tygodniowo, 8 rotacji, kompresja.
- `journald`: `SystemMaxUse=500M`.

### 6.3 Aktualizacje systemu i restarty

`unattended-upgrades` już działa. Dodać `Unattended-Upgrade::Automatic-Reboot "true"; Automatic-Reboot-Time "04:30";` (po kopiach o 03:00), kontenery z `restart: unless-stopped`, a `health.sh` po restarcie sprawdza, czy aplikacja odpowiada. Obrazy: co tydzień `docker compose pull` + odtworzenie kontenerów przez skrypt wdrożenia (nie Watchtower: automatyczna podmiana bazy bez kontroli jest ryzykowna). Wersje obrazów przypięte do wersji głównej (`postgres:17-alpine`, nie `latest`).

### 6.4 Monitoring: na co alarmować

Już jest (`health.sh`): dysk >80%, RAM <300 MB, swap >2 GB, usługi. Dodać:

| Sygnał | Próg | Jak |
|---|---|---|
| Aplikacja z zewnątrz | `/api/health` nie 200 przez 2 min | zewnętrzny pinger (UptimeRobot/Better Stack Free; `SERWEREK.md` §11 pkt 11), publiczny endpoint health lub token usługi Access |
| Archiwum WAL | `pg_stat_archiver.failed_count` rośnie albo ostatni sukces >15 min | `health.sh` + `psql` |
| Ostatnia kopia | starsza niż 26 h | `pgbackrest info --output=json` |
| Próba odtworzenia | nieudana lub starsza niż 35 dni | log z §4.5 |
| Kolejka | zadanie aktywne > timeout, nieudane > 0 | zapytanie do tabeli kolejki |
| Postgres | połączenia > 80% `max_connections`, transakcje > 5 min | `pg_stat_activity` |
| Tunel | nie `healthy` | API Cloudflare (już opisane) |

Kanał: mail przez Resend (jak dziś), limit 1 na 6 h na problem.

### 6.5 Odtworzenie całej maszyny w ok. 1 h (runbook docelowy)

1. (5 min) Nowy CPX22 w nbg1 przez API Hetzner, klucz SSH agenta, przypięcie `serwerek-fw`. (Nowy serwer to koszt: zgoda właściciela, chyba że zastępuje utracony.)
2. (15 min) `bootstrap.sh` z repo: pakiety, UFW, fail2ban, swap, Docker, cloudflared, ai-log, cron, logrotate, `daemon.json`.
3. (5 min) Sekrety: klucz age z `.ai-secrets` → `sops -d` plików z repo do `/etc/serwerek/`.
4. (5 min) Tunel: nowy token dla istniejącego tunelu `serwerek` (ingress jest zdalny, DNS się nie zmienia).
5. (15 min) `docker compose up -d db` z pustym katalogiem, `pgbackrest restore` z R2 (najnowszy stan), start, `verify-restored-database.ts`.
6. (10 min) Obraz aplikacji (z rejestru GHCR albo build), `migrate status`, `up -d app worker`, test przez tunel.
7. Wpis w `ai-log`, aktualizacja `SERWEREK.md`. Ćwiczyć raz na kwartał, mierzyć czas.

### 6.6 Infrastructure as Code

| | bash `bootstrap.sh` | cloud-init | Ansible |
|---|---|---|---|
| Wymagania | ssh | tylko przy tworzeniu serwera | Python + Ansible na komputerze (Windows: przez WSL) |
| Idempotencja | trzeba pisać samemu (sprawdzenia przed zmianą) | jednorazowe | wbudowana |
| Zmiany na działającej maszynie | tak | nie | tak |
| Przy 1-2 maszynach | wystarcza | dobre jako "pierwsze uruchomienie" | przerost |

**Rekomendacja:** `deploy/serwerek/bootstrap.sh` (idempotentny, sekcje z komentarzem "co i po co") + compose i konfiguracje w `deploy/serwerek/`. Opcjonalnie cloud-init z jedną linią: pobierz repo i uruchom `bootstrap.sh`. Ansible przy 3+ maszynach.

## 7. Bezpieczeństwo ponad to, co już jest

- **Sekrety: SOPS + age.** Zaszyfrowane `deploy/serwerek/secrets/*.env.sops` w repo, klucz prywatny age tylko w `/etc/serwerek/age.key` (600) i w `.ai-secrets`. Daje historię zmian i odtwarzalność (§6.5 pkt 3) bez jawnych sekretów w repo. Pliki `.env` w `/etc/serwerek/` zostają formatem wykonawczym (odszyfrowane przy wdrożeniu). To rozszerza listę dozwolonych plików z sekretami w `SERWEREK.md` §4/§6 i wymaga tam wpisu.
- **Docker rootless: nie.** Komplikuje wolumeny, sieć i cgroup (limity ffmpeg) [niezweryfikowane: zakres problemów w Docker 29]. W zamian: kontenery z użytkownikiem nie-root (`USER node`; postgres działa jako `postgres`), `read_only: true` gdzie się da, `cap_drop: [ALL]` dla app/worker, `no-new-privileges`.
- **Docker omija UFW** dla opublikowanych portów (reguły NAT przed łańcuchami ufw) [źródło: Docker packet filtering]. Dlatego zasada "porty tylko na `127.0.0.1`" z `SERWEREK.md` §9 jest krytyczna, a baza i Redis nie publikują portów wcale. Hetzner Firewall chroni niezależnie od tego.
- **SSH tylko przez Tunnel**: `cloudflared access ssh` + aplikacja Access dla hostname SSH; potem zamknięcie 22/tcp w Hetzner FW i UFW. Dostęp awaryjny: konsola Hetzner (właściciel) i rescue system. Wykonać dopiero po teście z komputera właściciela i agenta; inaczej ryzyko odcięcia.
- **CrowdSec**: opcjonalny. Przy SSH za tunelem i braku publicznych portów fail2ban wystarcza; CrowdSec ma sens, gdyby kiedyś wystawić publiczny HTTP (Caddy).
- **Aktualizacje obrazów**: co tydzień (§6.3), plus skan obrazu przy budowie (`trivy` albo `docker scout`) [niezweryfikowane: wybór narzędzia].
- **Baza**: hasło roli aplikacji z SOPS, `pg_hba.conf` tylko sieć compose, rola aplikacji bez `SUPERUSER`, osobna rola tylko do odczytu dla diagnostyki/AI.

## 8. Otwarte pytania (dla właściciela)

1. **Kolejność migracji**: najpierw sam worker HLS (baza dalej w Neon us-east-1), czy od razu aplikacja + baza na serwerku? Od tego zależy wybór kolejki (§5.2).
2. **Neon Frankfurt czy własny Postgres** po przeniesieniu aplikacji (§2.3)? Rekomendacja: własny, po działającym pgBackRest i udanej próbie odtworzenia.
3. **Okno serwisowe** na migrację bazy (ok. 15 min, noc): kiedy i czy z komunikatem dla widzów?
4. **Przerwy przy restartach**: akceptujemy kilka sekund przerwy przy nocnych aktualizacjach, czy celujemy w dwie instancje aplikacji (więcej RAM)?
5. **Zewnętrzny monitoring**: konto UptimeRobot/Better Stack (darmowe) i publiczny `/api/health` czy token usługi Access?
6. **SSH tylko przez Tunnel**: zgoda na zamknięcie portu 22 po teście (konsola Hetzner jako dostęp awaryjny)?
7. **Hetzner Backups (+20%)** dodatkowo do pgBackRest, czy pgBackRest + `pg_dumpall` w R2 wystarczą?
8. **Regiony Upstash i funkcji Vercel**: do sprawdzenia w panelach (wpływa na opóźnienia po przenosinach).

## 9. Źródła

Wszystkie odczytane 2026-10-01.

- Neon API, `describe_project` dla `restless-glade-19830690` (region, plan, limity, PITR, replikacja) [zmierzone przez MCP Neon].
- Pomiar RTT: `curl telnet://c-5.us-east-1.aws.neon.tech:5432` z serwerka, 5 prób, 92-95 ms [zmierzone].
- Neon plans: https://neon.com/docs/introduction/plans
- Neon Free FAQ: https://neon.com/faqs/free-plan-limits-and-quotas
- Neon logical replication do zewnętrznego Postgresa: https://neon.com/docs/guides/logical-replication-postgres
- Prisma connection pool: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool
- PostgreSQL 17, zużycie zasobów: https://www.postgresql.org/docs/17/runtime-config-resource.html
- pgBackRest user guide (v2.59.2): https://pgbackrest.org/user-guide.html ; konfiguracja: https://pgbackrest.org/configuration.html
- BullMQ, produkcja: https://docs.bullmq.io/guide/going-to-production ; stalled jobs: https://docs.bullmq.io/guide/workers/stalled-jobs
- pg-boss: https://github.com/timgit/pg-boss
- Cloudflare R2 cennik: https://developers.cloudflare.com/r2/pricing/
- Docker i firewalle (UFW): https://docs.docker.com/engine/network/packet-filtering-firewalls/
- Repo: `docs/operations/SERWEREK.md` (§4, §8, §14), `docs/architecture/serwerek.md`, `scripts/vercel-build.mjs`, `lib/rate-limit.ts`, `prisma/schema.prisma`, `docs/operations/database-backup-restore-drill.md`.

Niezweryfikowane (oznaczone w tekście): wartości domyślne `stalledInterval`/`maxStalledCount` BullMQ, działanie pgBackRest i WAL-G z R2 (`region=auto`, `uri-style=path`), szacunki czasu dump/restore i rozmiaru repo kopii, regiony funkcji Vercel i bazy Upstash, `serverless-redis-http`, domyślne zachowanie logów Docker, `pg_upgrade` w Dockerze.
