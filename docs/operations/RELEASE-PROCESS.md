# Proces wydań: budowa na tymczasowej maszynie Hetzner

Stan: **prototyp (etap 2 z 6)**. Skrypty są w repo (`deploy/release/`), ale produkcja nadal wydaje przez stary
`/opt/serwerek/apps/polutek/deploy.sh`. Ten zostaje na zawsze jako **tryb awaryjny**. Podstawa: audyt
`AUDYT-1-WYDANIA.md` (wariant A: maszyna tymczasowa, bez rejestru, bez GHCR, bez GitHub Actions).

## Po co to jest

Dziś `deploy.sh` buduje obrazy na serwerze produkcyjnym (4 vCPU, 8 GB). Budowa Next.js dusi stronę.
Nowy proces buduje obrazy na maszynie wynajętej na godzinę. Serwer tylko odbiera gotowe obrazy i je uruchamia.

```
serwer: release-build.sh <sha>
  -> Hetzner API: maszyna "polutek-rb-..." (firewall: SSH tylko z IP serwera, klucz SSH jednorazowy)
  -> wysyła: git archive <sha> + PUBLICZNE zmienne NEXT_PUBLIC_* z build.env (lista dozwolonych w skrypcie)
  -> maszyna: npm ci (bramka) + docker build: app, migrator, worker, collector (te same targety co deploy.sh)
  -> serwer ciągnie: ssh maszyna 'cat images.tar.zst' | zstd -d | docker load   (suma SHA-256 po obu stronach)
  -> maszyna skasowana (zawsze: trap, watchdog TTL 90 min, release-gc.sh)
  -> manifest.json: commit, ID obrazów (sprawdzone: na maszynie = na serwerze), wersje, czasy, koszt
serwer: release-deploy.sh <manifest>
  -> dysk -> weryfikacja manifestu i obrazów -> backup.sh + zrzut bazy -> migracje -> app -> health
  -> encoder, collector -> .env z bieżącymi obrazami -> sprzątanie (zostają 3 wydania)
```

Na maszynę budującą **nie trafia żaden sekret** aplikacji. Jedyne poświadczenie, które tam jest, to jej własny
jednorazowy klucz SSH. Token Hetzner zostaje na serwerze (`/root/.ai-secrets/secrets.env`, zmienna `HETZNER_API_TOKEN`).

## Jak wydać, krok po kroku (gdy proces zostanie przyjęty)

Wszystko na serwerze, jako root, z katalogu z repo (np. `/opt/serwerek/releases/tools`, kopia `deploy/release/`).

1. PR scalony do `main`. Zapisz SHA: `git ls-remote origin main`.
2. Budowa: `deploy/release/release-build.sh <sha>`.
   Skrypt sam przechodzi w tło: zerwane SSH niczego nie przerywa. Log: `/opt/serwerek/releases/logs/build-*.log`.
   Ostatnia linia: `DONE (full)` i ścieżka do manifestu.
3. Podgląd bez zmian: `deploy/release/release-deploy.sh /opt/serwerek/releases/<tag>/manifest.json --check`.
   Pokazuje, czy obrazy się zgadzają i jakie migracje czekają.
4. Wydanie: `deploy/release/release-deploy.sh /opt/serwerek/releases/<tag>/manifest.json`.
   - Migracje wideo (np. tabela `VideoEncodeJob`): dodaj `RD_DRAIN_ENCODER=1` (encoder zatrzymany przed migracją).
   - Chcesz najpierw zobaczyć listę migracji po zrobieniu kopii: `--stop-before-migrate`, potem uruchom bez tej opcji.
5. Ostatnia linia logu: `OK: polutek-app:<tag> is live` (lub `OK (WITH WARNINGS)`).

Blokada `.deploy.lock` jest wspólna z `deploy.sh` i `deploy-admin.sh`: dwa wdrożenia naraz się nie uruchomią.
Panel admina (`deploy-admin.sh`) na razie wydaje się po staremu.

## Co kosztuje

Ceny z API Hetzner (24.11.2026, brutto, lokalizacja nbg1, tam gdzie serwer):

| Typ | vCPU / RAM | €/h (z IPv4) | Uwagi |
|---|---|---|---|
| cpx32 | 4 / 8 GB | 0,071 | domyślny wybór skryptu (najtańszy dostępny ≥ 4 vCPU / 8 GB) |
| cpx42 | 8 / 16 GB | 0,138 | szybsza budowa: `RB_SERVER_TYPE=cpx42` |
| cx33, cpx31 | 4 / 8 GB | 0,017–0,034 | tańsze, ale dziś **niedostępne** w nbg1, fsn1, hel1 |

Skrypt wybiera typ sam (najtańszy dostępny w tej lokalizacji, x86, bo serwer jest x86).
Hetzner liczy za każdą rozpoczętą godzinę, więc jedno wydanie (budowa < 60 min) kosztuje ok. **0,07 €**.
Przy 25 wydaniach miesięcznie wychodzi ok. **1,8 €/mies.** Ruch między maszyną a serwerem mieści się w limicie.
Każde uruchomienie zapisuje koszt w logu i w `/opt/serwerek/releases/costs.log`.

## Jak cofnąć

- **Kod, od razu:** `deploy/release/release-deploy.sh --rollback`. Wraca do poprzedniego wydania z
  `/opt/serwerek/releases/.previous-release`, a gdy go nie ma, do `.previous-image`. Rollback **jest zawsze dozwolony**:
  wystarczą obrazy na dysku, nie trzeba żadnego dowodu. Można też wskazać konkretny manifest:
  `--rollback /opt/serwerek/releases/<tag>/manifest.json`.
- Stara droga działa dalej: `cd /opt/serwerek/apps/polutek && ./deploy.sh <tag> --rollback`
  (te same pliki stanu `.current-image` i `.previous-image`).
- **Schemat bazy nie jest cofany automatycznie.** Po migracji niszczącej przywróć zrzut sprzed wdrożenia
  (`/opt/serwerek/backups/pre-deploy-<tag>-*.sql.gz`). O tym decyduje człowiek, bo traci się dane z okna wdrożenia.
- Po każdym wdrożeniu starym `deploy.sh` uruchom `release-deploy.sh --sync-env`. Wtedy linie `APP_IMAGE=...` w `.env`
  zgadzają się z tym, co działa. Inaczej ręczne `docker compose up -d` mogłoby wrócić do starszego obrazu.

## Co zrobić przy awarii

| Sytuacja | Co robić |
|---|---|
| Hetzner API nie działa / brak typu maszyny | Spróbuj innej lokalizacji (`RB_LOCATION=fsn1`) lub typu (`RB_SERVER_TYPE=ccx23`). Pilna poprawka: **stary `deploy.sh`** (buduje na serwerze, najlepiej wieczorem). |
| Budowa się wywala | Log w `releases/logs/build-*.log`. Maszyna jest skasowana automatycznie. Produkcja nietknięta. |
| Skrypt padł, maszyna mogła zostać | `deploy/release/release-gc.sh --list`, potem `release-gc.sh --all`. Usuwa tylko zasoby z etykietą `managed-by=polutek-release` i nazwą `polutek-rb-*`, nigdy serwera produkcyjnego. Watchdog i tak kasuje maszynę po 90 min. |
| Suma kontrolna przesyłu się nie zgadza | Manifest nie powstaje, więc `release-deploy.sh` nie wyda takich obrazów. Puść budowę jeszcze raz. |
| Migracja nie przeszła | App nie jest restartowana, strona działa na starym obrazie. Zrzut sprzed wdrożenia jest w logu. |
| Nowa app nie przechodzi health | Automatyczny rollback do poprzedniego obrazu (schemat zostaje zmigrowany). |
| Mało miejsca na dysku | Budowa wymaga ≥ 8 GB wolnego, wydanie ≥ 5 GB. Posprzątaj: `docker image prune`, `docker builder prune`. |

## Jak sprawdzić po wydaniu

1. `docker ps`: app, encoder i collector mają nowy tag.
2. `curl -s -o /dev/null -w "%{http_code}" https://www.pawelperfect.com/api/health` daje `200`
   (skrypt sprawdza to sam, a także readiness z tokenem, redis i srh).
3. Na stronie widać zmianę. Telemetria: wiersz `deploy` w `telemetry.job_run` (opis `release: <tag>`).
4. `release-gc.sh --list` pokazuje puste listy: żadna maszyna nie została.

## Ustawienia (zmienne środowiska)

Budowa: `RB_SERVER_TYPE`, `RB_LOCATION`, `RB_MIN_CORES=4`, `RB_MIN_MEM_GB=8`, `RB_TTL_MIN=90`,
`RB_GATE="npm ci --no-audit --no-fund"` (np. dopisz `&& npx prisma generate && npm run typecheck`), `RB_MIN_FREE_GB=8`,
`RB_REPO` (repo z commitem, domyślnie lustro `/opt/serwerek/releases/repo.git`), `RB_DOCKER_MATCH=1` (na maszynie
ta sama wersja Dockera co na serwerze), `RB_EXTRA_SSH_CIDRS`, `RB_LOAD_RATE` (limit przesyłu, wymaga `pv`).
Wydanie: `RD_MIN_FREE_GB=5`, `RD_BACKUP=full|dump`, `RD_DRAIN_ENCODER=1`, `HEALTH_TIMEOUT=150`, `KEEP_RELEASES=3`.
`RELEASE_FOREGROUND=1` wyłącza przejście w tło. Testy pomocników: `node --test deploy/release/test/*.test.mjs`.

## Plan wdrożenia procesu (6 etapów z audytu)

| Etap | Co | Stan |
|---|---|---|
| 0. Porządek dysku | `src-before-*`, build cache, wykluczenia w `backup.sh` | do zrobienia |
| 1. Infrastruktura | osobny projekt Hetzner + token tylko do niego, timer `release-gc.sh` co 30 min | do decyzji (dziś token widzi też serwer produkcyjny) |
| 2. Kod | ta gałąź: `deploy/release/*`, stary `deploy.sh` bez zmian | **zrobione (prototyp)** |
| 3. Próby bez produkcji | pełna budowa `main` na maszynie, próbne wdrożenie na tej maszynie (kopia compose i bazy), rollback, zerwanie SSH, brak miejsca | następny krok |
| 4. Wydanie bazowe | ten sam commit, który już działa, przez `release-deploy.sh` (bez migracji), w nocy | po etapie 3 |
| 5. Pierwsze prawdziwe wydanie | najmniejszy pakiet; migracje wideo z `RD_DRAIN_ENCODER=1` | po etapie 4 |
| 6. Wygaszenie starego | po ok. 4 tyg. i ≥ 5 udanych wydaniach `deploy.sh` zostaje tylko jako tryb awaryjny | później |

## Testy T1–T14 (z audytu) i wyniki

Próba 24.11.2026: dwa uruchomienia `release-build.sh HEAD --probe` (maszyna cpx22, mały obraz alpine).

| # | Test | Wynik |
|---|---|---|
| T1 | `docker save` na maszynie → `docker load` na serwerze: ID i etykiety identyczne (containerd, Docker 29.8.2) | **częściowo OK**: mały obraz `release-probe:test` (3,6 MB po kompresji) ma identyczne ID i etykietę revision. Obie strony: Docker 29.8.2, magazyn containerd. Duże obrazy jeszcze nie testowane. |
| T2 | Weryfikacja dowodu bez atrap | **częściowo OK**: `manifest.mjs create` porównał prawdziwe `docker image inspect` z obu stron. `verify` na pełnym wydaniu jeszcze nie testowany. |
| T3 | Pełna budowa `main` na maszynie: czas, koszt | nie testowano (wymaga zgody koordynatora) |
| T4 | Próbne wdrożenie na maszynie, zepsuty obraz → rollback, pierwsze wdrożenie bez poprzedniego dowodu | nie testowano |
| T5 | Zerwanie SSH w trakcie | **częściowo**: obie próby szły w tle (`setsid nohup` + log). Samego zerwania SSH nie symulowano. |
| T6 | Brak miejsca | nie testowano (kontrola `df` jest w obu skryptach) |
| T7 | Migracje K16/K19/K24 na kopii bazy | nie testowano |
| T8 | Odsączenie encodera | nie testowano (`RD_DRAIN_ENCODER=1`) |
| T9 | Worker `hls-edge`: stary i nowy format adresu | poza zakresem tego etapu |
| T10 | Sprzątanie po 4 wydaniach | nie testowano |
| T11 | Ręczne `docker compose up -d` z `.env` | nie testowano |
| T12 | Odtworzenie bez GitHuba | nie testowano |
| T13 | Obciążenie produkcji przy `docker load` workera 2,5 GB | nie testowano. Uwaga: `ionice`/`nice` działa tylko na kliencie, nie na demonie Dockera |
| T14 | Wydanie bazowe i rollback na produkcji | nie testowano |
| dod. | Sprzątanie przy awarii: watchdog TTL=1 min w trakcie startu maszyny | **OK**: maszyna, firewall i klucz skasowane, skrypt zakończony kodem 143, blokada zwolniona |

Zmierzone (pierwsza próba): utworzenie maszyny 10 s, SSH i cloud-init z Dockerem 54 s, budowa obrazu i przesył 5 s,
skasowanie 12 s. Maszyna żyła 82 s, cały skrypt 87 s. Koszt: 0,0009 € proporcjonalnie, rozliczone 0,039 €
(1 rozpoczęta godzina cpx22). Druga próba (awaryjna): 90 s, 0,039 €. Po obu próbach w API Hetzner jest dokładnie to
samo co przed nimi: 1 serwer (produkcja), 2 klucze SSH, 0 firewalli, wolumenów, floating IP i snapshotów,
2 przypisane primary IP.
