# CI dla pull requestów (`.github/workflows/ci.yml`)

Niezależne sprawdzenie każdego PR do `main` na maszynie GitHuba. To **nie** jest proces wydań: workflow nie buduje
i nie publikuje obrazów (żadnego GHCR), nie wdraża, nie ma sekretów ani dostępu do produkcji
(`permissions: contents: read`, w `env` tylko fałszywe wartości). Wdrożenie nadal robi `deploy.sh` na serwerze.

## Co się uruchamia

| Job | Co robi | Blokuje? |
|---|---|---|
| `static` | `npm ci`, `prisma validate/generate`, `tsc` (tsconfig.typecheck.json), lint, granice architektury, hotspots, strict-escapes, walidacja env, parytet i18n | tak |
| `unit` | cały Vitest (`tests/unit`, `tests/integration`), 2 workery; bez testu z prawdziwym ffmpeg (idzie do `heavy`) | tak |
| `postgres` | pusta baza `postgres:17`, `prisma migrate deploy` (wszystkie migracje od zera), `db:smoke`, testy `tests/postgres/**` | tak |
| `actionlint` | sprawdza składnię wszystkich workflow (binarka 1.7.12, suma SHA-256) | tak |
| `audit` | `npm audit --omit=dev --audit-level=high` | **nie** (tylko informacja) |
| `heavy` | ffmpeg + Chromium + PG 17: test kodowania HLS (`ENCODE_SMOKE=1`, brak ffmpeg = błąd) i testy „stack” (`PG_STACK=1`) | tylko na żądanie |

Kiedy: `pull_request` do `main` (otwarcie, nowy push, ponowne otwarcie, wyjście z wersji roboczej) oraz ręcznie
(`workflow_dispatch`). PR zmieniający tylko `docs/**` lub pliki `*.md` nie uruchamia CI. Nowy push do PR anuluje
poprzedni przebieg (`concurrency`). Każdy job ma limit czasu (5–45 min).

`heavy` startuje, gdy: (a) ręcznie: Actions → CI → Run workflow, zaznacz `heavy`, albo
`gh workflow run ci.yml --ref <gałąź> -f heavy=true`; (b) PR ma etykietę `ci:heavy` w chwili pushu (dodaj
etykietę, potem push albo zamknij i otwórz PR). Lista testów „stack” jest w `vitest.postgres.config.ts`
(`STACK_TESTS`); test z tej listy, któremu brakuje narzędzi, ma paść, a nie zniknąć po cichu.

## Jak czytać wyniki

- Na stronie PR sekcja „Checks”: zielone = przeszło. Kliknij job, żeby zobaczyć log kroku, który padł.
- `unit`, `postgres` i `heavy` piszą w podsumowaniu przebiegu (Summary) tabelę: pliki, testy, zaliczone,
  nieudane, **pominięte**, oraz listę każdego pominiętego testu z powodem (plik + nazwa). Dziś świadomie
  pominięte w `unit` są 2 testy `email-event-idempotency` (bez bazy; uruchamia je job `postgres`).
- `audit` na żółto/czerwono nie blokuje PR: oznacza nową poważną lukę w zależnościach produkcyjnych do przejrzenia.

## Włączenie i wyłączenie

- Włączenie (właściciel, po scaleniu): `gh workflow enable ci.yml -R pawelekbyra/polutek-pl` albo Actions → CI →
  „Enable workflow”. Wyłączenie: `gh workflow disable ci.yml -R pawelekbyra/polutek-pl`.
- Wymagane kontrole (opcjonalnie): Settings → Branches (lub Rules) → reguła dla `main` → „Require status checks”:
  `static …`, `unit (vitest)`, `postgres …`, `actionlint …`. **Nie** dodawaj `audit` ani `heavy`. Uwaga: PR tylko
  z dokumentacją nie uruchamia CI, więc przy wymaganych kontrolach czekałby w nieskończoność; wtedy scal go jako
  administrator albo usuń `paths-ignore`.

## Koszt (repo prywatne)

Szacunek na jeden przebieg (każdy job liczony osobno i zaokrąglany w górę do pełnej minuty; `npm ci` z cache ok. 1–2 min):

| Job | Minuty |
|---|---|
| static (npm ci + tsc ~2 + lint ~2 + reszta) | 6–9 |
| unit (npm ci + vitest 5–10) | 7–12 |
| postgres (npm ci + migracje + testy) | 3–5 |
| actionlint, audit | 1 + 1 |
| **razem typowo** | **ok. 18–28** |
| heavy (tylko na żądanie) | +10–20 |

Darmowy limit planu Free to **2000 min/mies.** (Pro: 3000), co daje ok. **70–110 przebiegów miesięcznie**, np.
ok. 30 PR po 3 pushe. Limity i zużycie trzeba potwierdzić u właściciela: Settings → Billing and plans → Usage
(stan mojej wiedzy, nie sprawdzony na koncie). Ograniczenia już włączone: tylko PR do `main`, pomijanie zmian
samej dokumentacji, anulowanie starego przebiegu przy nowym pushu, brak przebiegu po scaleniu (`push` do `main`
nie jest wyzwalaczem), `heavy` tylko na żądanie. Gdy minut zabraknie, GitHub po prostu nie uruchomi jobów; praca
idzie dalej lokalnie (`scripts/ops/local-ci.mjs`, `docs/operations/LOCAL-CI.md`).

## Co jest świadomie pominięte

- Build Next.js (`next build`, `admin:build`) i obrazy Dockera: robi je `deploy.sh` na serwerze (drogie w minutach).
- Publikowanie czegokolwiek (GHCR, artefakty, release-proof) i `images.yml` (osobny, ręczny workflow).
- Pokrycie kodu (`--coverage`) i testy E2E Playwright na prawdziwej stronie.
- Testy wymagające Stripe/R2/SMTP na prawdziwych kontach (brak sekretów w CI z założenia).
