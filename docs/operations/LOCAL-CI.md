# Lokalne CI (`scripts/ops/local-ci.mjs`)

Stały tryb pracy od 2026-10-04: GitHub Actions dla prywatnego repo nie startuje (limit minut, właściciel nie płaci), więc przed scaleniem te same bramki co w `.github/workflows/ci.yml` uruchamiamy lokalnie (Windows lub Linux, Node 22, bez dodatkowych zależności). Workflow GitHuba zostaje w repo bez zmian: jeśli Actions wróci, oba sposoby dają ten sam wynik.

## Użycie

```bash
npm ci                                   # raz, po każdej zmianie package-lock.json
node scripts/ops/local-ci.mjs            # bramki dla zmian względem origin/main
node scripts/ops/local-ci.mjs --full     # wszystko: lint całości, cały zestaw testów, build, admin build
node scripts/ops/local-ci.mjs --list     # lista bramek i odpowiadających im kroków ci.yml
node scripts/ops/local-ci.mjs --only=unit,lint      # wybrane bramki (+ ich zależności)
```

Opcje: `--all` (eslint całego repo), `--unit-full` (cały zestaw Vitest), `--build` (next build + admin build), `--coverage` (testy z `--coverage`, jak job `tests/coverage`), `--strict` (brak Dockera, sieci lub ffmpeg to FAIL zamiast SKIP), `--skip=a,b`, `--base=<ref>` (domyślnie `origin/main`; zrób `git fetch` wcześniej), `--jobs=<n>` (sloty CPU, domyślnie liczba rdzeni).

Wynik: tabela `bramka / wynik / czas / przyczyna`, kod wyjścia 0 tylko wtedy, gdy każda wymagana bramka ma PASS (SKIP z braku narzędzia nie blokuje, chyba że `--strict`). Raport z hashem HEAD: `.claude/local-ci-last.json` i `.claude/local-ci-last.md`, pełne wyjście każdej bramki: `.claude/local-ci-logs/<bramka>.log` (wszystko w `.gitignore`).

## Scalanie bez GitHub Actions

```bash
LOCAL_CI=1 scripts/ops/mergedeploy.sh <PR> <gałąź> <prefiks-tagu> [--no-deploy]
LOCAL_CI=1 LOCAL_CI_ARGS="--full" scripts/ops/mergedeploy.sh ...   # domyślnie LOCAL_CI_ARGS=--build
```

Skrypt pobiera `origin/<gałąź>` i `origin/main`, sprawdza, że PR wskazuje dokładnie ten commit, i uruchamia lokalne CI na gałęzi scalonej z `origin/main` (tak jak `pull_request` w GitHubie testuje commit scalenia):

- w bieżącym katalogu, jeśli jest czysty, stoi na tym samym commicie i zawiera już `origin/main`;
- w przeciwnym razie w tymczasowym `git worktree` z własnym `npm ci` (kilka minut i ok. 1,5 GB na czas przebiegu; worktree jest usuwany na końcu).

Scala tylko przy PASS (`gh pr merge --squash --admin --match-head-commit <sha>`, więc nowszy push do PR nie zostanie scalony bez testu), a tabela wyników trafia do opisu scalenia. Dotychczasowe tryby bez zmian: domyślnie czekanie na CI GitHuba, `SKIP_CI=1` bez sprawdzeń.

## Bramki

| Bramka | Odpowiednik w ci.yml | Uwagi |
|---|---|---|
| `prisma` | Prisma validation/generation | pierwsza; testy i typecheck czekają na wygenerowanego klienta |
| `ci-parity` | (nowa) | FAIL, gdy ci.yml ma krok `run:`, którego local-ci nie odwzorowuje; zmienne `env:` czytane wprost z ci.yml |
| `migrations` | część integration-postgres | UTF-8 bez BOM; nowe migracje: nazwa `<14 cyfr>_<snake_case>`, znacznik późniejszy niż ostatnia migracja na bazie, tylko operacje addytywne (migracja czyszcząca zatwierdzona przez właściciela musi mieć komentarz `-- local-ci: allow-destructive <powód>`); istniejących migracji nie wolno edytować ani usuwać |
| `unit` | tests/coverage | domyślnie `vitest related` dla zmienionych źródeł i testów + wszystkie testy czytające źródła jako tekst (graf importów ich nie widzi); cały zestaw przy `--full`/`--unit-full` albo zmianie `package*.json`, `vitest*.config.*`, `tsconfig*.json`, `tests/setup.ts`, `prisma/schema.prisma`; pokrycie tylko z `--coverage` |
| `typecheck` | typecheck | `tsc -p tsconfig.typecheck.json --noEmit` |
| `typecheck-all` | (nowa) | `tsc -p tsconfig.json --noEmit` na całym repo razem z testami (CI ich nie sprawdza); błędy w `.next/` pomijane |
| `lint` | lint | eslint zmienionych plików (z cache w `.claude/local-ci-cache/`, wynik jak bez cache); całe repo przy `--all`/`--full` albo zmianie `eslint.config.mjs`, `package*.json`, `tsconfig.json` |
| `architecture`, `hotspots`, `strict-escapes` | jak w CI | |
| `env` | environment validation | `validate-env --mode=production` na fikcyjnych wartościach z ci.yml |
| `audit` | npm audit/security | `scripts/audit-high.mjs` (zależności produkcyjne); SKIP bez sieci |
| `postgres` | integration-postgres | tymczasowy kontener `postgres:16` (jak CI; `LOCAL_CI_PG_IMAGE=postgres:17` dla wersji produkcyjnej) na losowym porcie, `migrate deploy`, `db:smoke`, `vitest.postgres.config.ts`; SKIP bez Dockera |
| `encode-smoke` | encode-smoke (ffmpeg) | SKIP bez `ffmpeg`/`ffprobe` w PATH |
| `build`, `admin-build` | build, admin build | tylko z `--build`/`--full` (zostawiają `.next/`, ok. 1 GB) |

Równoległość: każda bramka zajmuje „sloty” CPU (Vitest: rdzenie − 1 i tyle samo wątków, tsc/eslint/skrypty: 1, build: cała maszyna), więc obok Vitesta biegnie jedna lżejsza bramka. Procesy potomne dostają zmienne z ci.yml (fikcyjne sekrety, `DATABASE_URL` na localhost) i `CI=true`; prawdziwe sekrety z lokalnego `.env` nie są używane.

## Różnice względem CI GitHuba

- Node: lokalny (na maszynie właściciela 24), CI używa 22 z `.nvmrc`; skrypt to wypisuje. Różnice wersji w praktyce dotyczą tylko ostrzeżeń `EBADENGINE`.
- Domyślnie testy i lint tylko dla zmian; pełny odpowiednik CI to `--full --coverage`.
- `postgres` i `encode-smoke` wymagają Dockera i ffmpeg; bez nich SKIP (na maszynie właściciela 2026-10-04 nie ma żadnego z nich). `--strict` zamienia to w FAIL.
- Dodatkowo względem CI: `ci-parity`, `migrations` i `typecheck-all`.
- Nie jest odwzorowany workflow `images.yml` (obrazy GHCR); obraz buduje `deploy.sh` na serwerze.

## Czas i co spowalnia testy (2026-10-04, Windows 10, 4 rdzenie, maszyna obciążona innymi agentami)

Przebieg `--full` na gałęzi wprowadzającej skrypt: **27 min 45 s** ściany.

| Bramka | Czas |
|---|---|
| unit (cały zestaw: 343 pliki, 2289 testów, 3 wątki) | 12 min 49 s |
| build / admin build | 8 min 18 s / 5 min 0 s |
| lint całego repo (pierwszy raz, bez cache) | 7 min 15 s |
| typecheck / typecheck-all | 2 min 54 s / 1 min 21 s (przyrostowo) |
| prisma | 1 min 38 s |
| architecture, audit, hotspots, strict-escapes, env | 6-27 s każda |

Typowy przebieg domyślny (zmiana kilku plików źródłowych, bez buildu) to kilka minut: `vitest related` + testy czytające źródła, lint zmienionych plików, oba typechecki.

Vitest (cały zestaw, 754 s ściany): same testy to 244 s, a sumarycznie import modułów 1159 s, środowisko jsdom 290 s i transformacja 106 s. Ponad 80% czasu to ładowanie modułów i jsdom osobno w każdym pliku (izolacja plików), nie wykonywanie testów; na Windows dochodzi wolny system plików i skanowanie antywirusem `node_modules`. Najwolniejsze pliki: `api/admin/videos/cover-upload/route.test.ts` 29 s, `modules/comments/patron-grant-write-access.test.ts` 15 s, `auth/auth-instance.test.ts` 14 s (pierwszy import Better Auth w treści testu: od 14 s do 135 s zależnie od obciążenia maszyny, dlatego limity czasu w `vitest.config.ts` to 300 s), `modules/users/user-deletion-guardrail.test.ts` 11 s (czyta całe `app/` i `lib/`).

Propozycje przyspieszenia bez zmiany treści testów (do zrobienia osobno, każdą zmierzyć przed i po):

1. Wykluczenie katalogu repo z Windows Defender (właściciel, Ustawienia → Ochrona przed wirusami → Wykluczenia): zwykle największy zysk przy imporcie tysięcy plików z `node_modules`.
2. `test.projects` w `vitest.config.ts`: osobny projekt `node` (ok. 290 plików) z `pool: 'threads'` (tańszy start wątku niż procesu na Windows) i projekt `dom` dla plików z `@vitest-environment jsdom`; wspólne `include`, bez zmian w testach.
3. `test.deps.optimizer.ssr` (wstępne zbundlowanie `better-auth`, `stripe`, `@aws-sdk/*`, `@prisma/client`): import tych bibliotek raz zamiast w każdym pliku.
4. Podział przebiegu na części (`vitest run --shard=1/2` i `--shard=2/2`) tylko na maszynie z większą liczbą rdzeni; na 4 rdzeniach nie pomaga.
5. Długofalowo (audyt testów, TEST-16): statyczne importy zamiast `await import()` w treści testów; to już zmiana testów.

## Kłopoty

- `typecheck` zgłasza błędy tylko w `.next/`: stary build innej gałęzi; usuń `.next`.
- Po zmianie opcji w `tsconfig.json` tsc w trybie przyrostowym potrafi oddać stare błędy: usuń `tsconfig.tsbuildinfo`.
- `Brak node_modules`: `npm ci`. Skrypt nie instaluje zależności sam (poza worktree w `mergedeploy.sh`).
- Przerwanie (Ctrl+C) zatrzymuje bramki i usuwa kontener Postgresa.
