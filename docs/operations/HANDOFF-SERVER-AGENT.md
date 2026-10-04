# Przekazanie projektu agentowi pracującemu na serwerku

Stan: 2026-10-05. Dokument dla agenta, który pracuje **bezpośrednio na serwerze `serwerek`** i **nie ma dostępu do GitHuba ani do komputera
właściciela**. Zakłada własne repozytorium git na serwerze (a potem, jeśli właściciel zechce, na innym serwerze) od punktu, w którym skończyła
poprzednia sesja. Reguły pracy, decyzje właściciela i stan prac są w [`STATUS.md`](STATUS.md): przeczytaj go po tym dokumencie.

## 1. Co dostajesz na serwerze

| Co | Gdzie |
|---|---|
| **Pełne repozytorium z historią** (bundle gita) | `/opt/serwerek/handoff/polutek-pl.bundle` |
| **Roboczy klon** (zrobiony z bundla, gałąź `main` wyciągnięta) | `/opt/serwerek/repo` |
| Kopia dokumentacji do czytania bez gita | `/opt/serwerek/docs/` (odświeżana przy każdym `deploy.sh`) |
| Opis serwera i podstawowe polecenia | `/opt/serwerek/README.md` |
| Lista nazw sekretów, których agent może potrzebować (bez wartości) | `/opt/serwerek/handoff/secrets-names.txt` |
| Uruchomiona produkcja (strona, baza, kodowanie, kolektor, panel admina) | `/opt/serwerek/apps/polutek/` |

Bundle zawiera `main` (punkt startu, SHA w pliku `/opt/serwerek/handoff/MAIN-SHA.txt`) oraz gałęzie z pracą w toku, której nie scalono do `main`:

| Gałąź | Zawartość | Stan |
|---|---|---|
| `feat/admin-phase2-content` | panel admina, faza 2: Treści (lista, nowy film, edycja, kodowanie, napisy, układ kanału) | gotowa do przejrzenia i scalenia (PR #1673 na GitHubie) |
| `feat/admin-translations` | model danych tłumaczeń (`VideoTranslation`, `VideoSlugHistory`), ekran „Tłumaczenia” | po `feat/admin-phase2-content` (PR #1675) |
| `feat/admin-server-headroom` | wskaźnik „Zapas serwera” (System, Dzisiaj) | po `feat/admin-translations` (PR #1677) |
| `feat/admin-phase2-community` | faza 2: Społeczność (jeden commit WIP, niedokończone) | wymaga rebase na `main` po scaleniu powyższych (PR #1681 draft) |
| `feat/preloader-polish` | preloader: ciemne tło od pierwszej klatki, czcionka Major Mono Display, samo „WCZYTUJĘ…”, marchewka-kursor | kod gotowy, brak końcowej weryfikacji wizualnej (PR #1678) |
| `feat/local-ci` | `scripts/ops/local-ci.mjs`, tryb `LOCAL_CI=1` w `mergedeploy.sh` | brakuje dokumentacji końcowej (PR #1679) |
| `feat/ops-set-role` | akcja operatora `set-role` (zdjęcie roli ADMIN trzem kontom; zostaje tylko właściciel) | kod gotowy, nic nie wykonano na produkcji (PR #1680) |

Numery PR dotyczą GitHuba (którego tu nie masz): służą tylko do rozpoznania pracy.

## 2. Uruchomienie własnego repozytorium (jeśli klon nie istnieje albo chcesz go odtworzyć)

```bash
cd /opt/serwerek
git clone /opt/serwerek/handoff/polutek-pl.bundle repo       # gałęzie z bundla są lokalne: git branch -a
cd repo
git config user.name "serwerek-agent" && git config user.email "serwerek-agent@pawelperfect.com"
git log --oneline -3 && git rev-parse HEAD                    # porównaj z /opt/serwerek/handoff/MAIN-SHA.txt
git branch -a                                                 # main + gałęzie z tabeli powyżej
```

Własny zdalny serwer (opcjonalnie, decyzja właściciela): na innym serwerze `git init --bare polutek-pl.git`, a tu `git remote add origin <url>` i
`git push -u origin main --tags` oraz wszystkie gałęzie. **Nie dodawaj zdalnego repo, tokenów ani kluczy bez zgody właściciela.**

## 3. Jak pracować bez GitHuba

- Nie ma PR-ów ani CI: „scalenie” to `git merge` w Twoim repo (najlepiej `--no-ff`, po przejrzeniu `git diff main..<gałąź>`), a weryfikacja jest lokalna.
- **Weryfikacja:** testy dotknięte zmianami (`npx vitest run <pliki> --testTimeout=120000`), `npx tsc --noEmit -p tsconfig.typecheck.json` (błędy z `.next/` ignoruj),
  `npx eslint` na zmienionych plikach, `npm run quality:hotspots`. Serwer ma tylko 2 vCPU i 4 GB RAM: uruchamiaj to **poza godzinami ruchu**, po jednym zadaniu
  naraz, `nice -n 10`, a zależności instaluj `npm install --no-audit --no-fund --ignore-scripts` (potem `npx prisma generate`). Jeśli brakuje RAM-u, używaj kontenera
  `node:22` z limitem pamięci. Wolne miejsce: ~41 GB.
- **Wdrożenie:** `cd /opt/serwerek/apps/polutek && rm -rf src && mkdir src && (cd /opt/serwerek/repo && git archive main) | tar -x -C src && ./deploy.sh <tag>`;
  panel: `./deploy-admin.sh <tag>`. Rollback: `./deploy.sh x --rollback`, `./deploy-admin.sh x --rollback`. Szczegóły: [`SERWEREK.md`](SERWEREK.md), [`ADMIN-PANEL.md`](ADMIN-PANEL.md).
  (Skrypt `scripts/ops/mergedeploy.sh` zakłada GitHub i `gh`: tu go nie używaj.)
- Każda zmiana na serwerze: kopia pliku przed edycją i wpis `AI_AGENT=<nazwa> ai-log "..."`.
- Kopie bazy i test odtworzenia chodzą z timerów (nie ruszaj ich konfiguracji bez potrzeby). Przed ryzykowną zmianą: `/opt/serwerek/scripts/backup.sh`.
- Po każdej zakończonej pracy zaktualizuj `docs/operations/STATUS.md` w repo (commit) i odśwież kopię `/opt/serwerek/docs/` (robi to `deploy.sh`).

## 4. Sekrety i czego nadal brakuje

**Właściciel (2026-10-05) pracuje już tylko na serwerze** i skopiował tu cały folder sekretów ze swojego komputera: **`/root/.ai-secrets/`** (katalog 700, pliki 600, tylko root; nigdy do repo, czatu, logów ani kopii poza serwerem):

| Plik | Co |
|---|---|
| `secrets.env` | podzbiór do codziennej pracy: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_R2_*`, `HETZNER_API_TOKEN`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `SUPPORT_ACCESS_CLIENT_ID/SECRET`, `OPS_ADMIN_USER_ID`, puste `GITHUB_TOKEN` |
| `load-secrets.sh` | `source /root/.ai-secrets/load-secrets.sh` ładuje je do powłoki, nic nie wypisuje |
| `secrets.full-from-pc.env` | pełna kopia z komputera właściciela, także wycofane (Vercel, Clerk, Mux, Cloudflare Stream) i sekrety aplikacji; używaj tylko w razie potrzeby |
| `age/` | `serwerek-backups.agekey` (klucz PRYWATNY kopii zapasowych) i `.pub` |
| `cloudflare-backup/`, `dns-backup/` | kopie konfiguracji (polityka Access, tunel przed dodaniem panelu, DNS obu stref, usunięte rekordy DKIM Google) |
| `pp-support.env`, `google-ai-agent.json`, `ops-actions.log` | dostęp do PP Support, klucz konta usługi Google (Workspace anulowany: nieaktualny), dziennik akcji operatora |

Zasady: sekretów **nigdy nie wypisuj** (maskuj, pokazuj najwyżej długość), nie kopiuj do repo ani dokumentacji, nie wysyłaj poza serwer. Sekrety **aplikacji** (Better Auth, Google, Turnstile, HLS, baza)
są w `/opt/serwerek/apps/polutek/app.env` i `admin.env`. **Uwaga o kluczu `age`:** jego obecność tu oznacza, że szyfrowanie kopii w R2 nie chroni przed przejęciem serwera; **zadbaj, żeby właściciel miał
drugą kopię offline** (menedżer haseł), bo przy utracie serwera bez tego klucza kopie z R2 są nieczytelne.

**Nadal brakuje:** `GITHUB_TOKEN` (właściciel nie dostarczył; repo jest lokalne w `/opt/serwerek/repo`), prywatnego klucza SSH do serwera (jest tylko u właściciela, na serwerze niepotrzebny), Claude Code
(uruchamia go właściciel), przeglądarki do kontroli wyglądu. Rejestrację administratora panelu robi właściciel ([`ADMIN-PANEL.md`](ADMIN-PANEL.md) rozdz. 2); link jednorazowy nie idzie na czat.

## 5. Kolejność prac (skrót, pełna lista w STATUS.md)

1. Zweryfikuj stan produkcji: `docker compose ps`, `curl -s localhost:3000/api/health`, wynik nocnego restartu bazy (`/var/log/serwerek/pg-stat-statements.log`).
2. Przejrzyj i scal gałęzie panelu w kolejności: `feat/admin-phase2-content` → `feat/admin-translations` → `feat/admin-server-headroom`; dokończ `feat/admin-phase2-community` (rebase na `main`).
3. `feat/preloader-polish` (obejrzyj wizualnie z właścicielem), `feat/local-ci`, `feat/ops-set-role` (potem wykonaj `set-role` po zgodzie właściciela: zostaje konto `user_3FeY8okjicDKlWDGSSc4Q7bvaPZ`).
4. Panel: fazy 3, A, 5 według [`architecture/admin-panel.md`](../architecture/admin-panel.md) §4 i [`architecture/admin-parity.md`](../architecture/admin-parity.md); wygląd jak w `docs/design/admin-panel/`.
5. Migracja czyszcząca bazy (`audit-database.md`), nowy krótki `CLAUDE.md`, przepisanie `SERWEREK.md`.

Wartości, które trzeba znać: serwer `serwerek` Hetzner CPX22 (2 vCPU, 4 GB, 75 GB), snapshot 439648964 z 2026-10-05; produkcja `www.pawelperfect.com` (Cloudflare Tunnel), panel `admin.pawelperfect.com`
(Access, tylko `pawel.perfect@gmail.com`); jedyne konto ADMIN docelowo: `pawel.perfect@gmail.com` = `user_3FeY8okjicDKlWDGSSc4Q7bvaPZ`.
