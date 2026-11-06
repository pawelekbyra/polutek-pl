# dziennikarski (eksperyment na :8089)

Stan zweryfikowany na serwerze: **2026-11-03**. Eksperyment: statyczny eksport aplikacji z publicznego repozytorium GitHub `pawelekbyra/dziennikarski`, serwowany z nginx. Dokument odtworzony 2026-11-03 (poprzednia wersja zginęła przy synchronizacji docs przez `deploy.sh`).

**Uwaga, która zmienia interpretację:** to NIE jest strona działająca pod `nasza-gazetka.pl`. Produkcja `nasza-gazetka.pl` jest budowana z prywatnego repo `pawelekbyra/polutek` @ `91db05e` (statyczny eksport, 12 adresów). Repo `dziennikarski` (HEAD klona na serwerze: `eac4f14`, scalenie PR #6) to pełna aplikacja (Next 14, Prisma/SQLite, NextAuth, Stripe, Ably, ok. 30 tras `/api/*`), która nie jest dziś nigdzie publiczna. Migracją domeny zajmuje się [`NASZA-GAZETKA.md`](NASZA-GAZETKA.md).

## Co działa

| Rzecz | Wartość |
|---|---|
| Adres | `http://46.224.211.115:8089/` (tylko HTTP, goły IP, bez domeny i bez Cloudflare) |
| Katalog | `/opt/serwerek/apps/dziennikarski/`: `docker-compose.yml`, `Dockerfile`, `prep.sh`, `nginx/` (`nginx.conf`, `common-headers.conf`), `repo/` (czysty klon), `build/` (kontekst budowy, generowany) |
| Kontener | `dziennikarski-web` (obraz lokalny `dziennikarski-web:local`, nginx 1.27-alpine, statyczny `out/`, brak Node w runtime), `0.0.0.0:8089 → 8080`, sieć `dziennikarski-net` |
| Zasoby | 512 MB RAM, 0,5 CPU, `pids_limit 64`, `read_only`, `cap_drop: ALL` (+ CHOWN/SETGID/SETUID), `no-new-privileges`, logi 5 MB × 2 |
| Sekrety | brak (statyczny eksport, żadnych zmiennych środowiskowych w kontenerze) |

## Jak jest zbudowany

`prep.sh` przygotowuje `build/` z `git archive HEAD` klona `repo/` (klon nie jest zmieniany, nic z repo nie jest uruchamiane) i wycina:
* archiwa i dokumenty (`*.rar`, `*.zip`, `*.7z`, `secret.zip`, `wyrok.pdf`, pliki `*.env*`), `vercel-ai-repo`, `scripts`, `test-results`, `prisma`,
* **całą powierzchnię API i auth**: `app/(main)/api`, `middleware.ts`, `auth.ts`, `auth.config.ts`, `robots.ts`, `sitemap.ts`,
* dopisuje `public/robots.txt` (`Disallow: /`) i `robots: noindex` w metadanych layoutów `(main)` i `(eliksir)`,
* podmienia `next.config.mjs` na `output: "export"` (`trailingSlash`, bez source map, obrazy nieoptymalizowane).

`Dockerfile`: etap 1 `node:22-alpine` (`yarn install --frozen-lockfile --ignore-scripts`, `next build`, `NODE_OPTIONS=--max-old-space-size=1536`), etap 2 `nginx:1.27-alpine` z kopią `out/`.

## Komendy

    cd /opt/serwerek/apps/dziennikarski
    docker compose ps                         # healthy
    docker compose up -d                      # start (obraz już zbudowany)
    docker compose down                       # stop
    # przebudowa po zmianie w repo:
    git -C repo pull --ff-only                # tylko pobranie; zweryfikuj zmiany przed budową
    ./prep.sh && nice -n 15 docker compose build && docker compose up -d

Budowa potrzebuje ok. 2 GB RAM i kilku GB dysku (cache budowy rośnie): sprawdź `free -m` i `df -h /`, nie buduj w trakcie wdrożenia produkcji (`/opt/serwerek/apps/polutek/.deploy.lock`), jedno ciężkie polecenie naraz.
Usunięcie: `docker compose down && docker rmi dziennikarski-web:local && rm -rf /opt/serwerek/apps/dziennikarski`.

## Wyłączone API i noindex

* Nginx zwraca `404` dla `/api/` (dodatkowo API jest wycięte z buildu, więc nie istnieje) i dla plików ukrytych (`/\.`), `405` dla metod innych niż GET/HEAD.
* `client_max_body_size 1k`, `limit_req` 10 żądań/s na IP (burst 40), `limit_conn` 20, krótkie timeouty, `autoindex off`, `server_tokens off`.
* **noindex** w trzech warstwach: `X-Robots-Tag: noindex, nofollow, noarchive` (`common-headers.conf`), `robots.txt` z `Disallow: /` (nginx i `public/`), meta robots w layoutach. Dodatkowe nagłówki: `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, CSP `object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'`.
* `/healthz` → `ok` (healthcheck kontenera).

## Znane ograniczenia i ryzyka

* Tylko HTTP na gołym IP, publiczne dla każdego, kto zna adres. Port `0.0.0.0:8089` nie ma reguły `ufw`, ale Docker omija `ufw`; **dostępność z zewnątrz nie została sprawdzona**.
* Repo źródłowe jest publiczne i zawierało archiwa oraz dokumenty (`KORDYS1.rar`, `secret.zip`, `wyrok*.zip/pdf`), które `prep.sh` usuwa z buildu, ale nadal leżą w `repo/` na dysku serwera i w publicznym repozytorium GitHub. Zawartość nie była oceniana pod kątem wrażliwości.
* Pełna aplikacja (poza eksportem statycznym) ma luki i wymagania (Postgres/Redis, uploady do lokalnego FS, cron, webhook Stripe), opisane w `/opt/claude/research-migration/DZIENNIKARSKI-MIGRACJA.md` (na serwerze, poza repozytorium; plik 640, ok. 29 KB). Nie uruchamiaj pełnej aplikacji bez osobnego przeglądu bezpieczeństwa.
* Eksperyment i produkcja `nasza-gazetka.pl` pokazują różne strony; nie używaj :8089 jako podglądu produkcji.
* `repo/` i `build/` leżą w `apps/`, więc trafiają do nocnej kopii konfiguracji (`public/` ma ok. 44 MB, repo `.git` ok. 71 MB); rozważ wyłączenie ich z `configs-*.tar.gz`.
* Obraz `dziennikarski-web:local` jest budowany lokalnie, bez przypiętego digestu bazowych obrazów.

## Powiązane dokumenty

[`STATIC-DEMO.md`](STATIC-DEMO.md) (ten sam wzorzec nginx) · [`NASZA-GAZETKA.md`](NASZA-GAZETKA.md) · [`ODOO.md`](ODOO.md) · [`SERWEREK.md`](SERWEREK.md).
