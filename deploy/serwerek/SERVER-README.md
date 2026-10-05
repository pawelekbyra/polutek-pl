# serwerek: czytaj najpierw

Ten plik leży w `/opt/serwerek/README.md` i jest odświeżany przy każdym `deploy.sh` z repo (`deploy/serwerek/SERVER-README.md`).
**Źródłem prawdy jest repozytorium** na serwerze TAKT (`~/pawelperfect`, `origin` = `~/git/pawelperfect.git`); GitHub nie jest używany. Kopia dokumentacji na serwerze jest tylko do czytania na miejscu.

## Co to jest

Serwer produkcyjny Hetzner CPX22 (2 vCPU, 4 GB RAM, 75 GB dysku) z `www.pawelperfect.com`: aplikacja Next.js w Dockerze za Cloudflare Tunnel, Postgres 17, Redis, kodowanie wideo (`encoder`), kolektor telemetrii (`collector`),
panel administratora (`admin.pawelperfect.com`), PP Support (poczta pomocy) i zadania z systemd.

## Gdzie co leży

| Co | Gdzie |
|---|---|
| Aplikacja: compose, `deploy.sh`, `deploy-admin.sh`, pliki env, `src/` (kod wdrożonego commita) | `/opt/serwerek/apps/polutek/` |
| PP Support | `/opt/serwerek/apps/pp-support/` |
| Dane (Postgres, Redis, praca kodowania) | `/opt/serwerek/data/` |
| Skrypty hosta (kopie, test odtworzenia, health, crony) | `/opt/serwerek/scripts/` |
| Dokumentacja projektu (kopia z repo) | `/opt/serwerek/docs/` |
| Kopie zapasowe i instrukcja odtwarzania | `/opt/serwerek/backups/` (`RESTORE.md`) |
| Sekrety (nigdy do repo ani czatu) | `/etc/serwerek/*.env`, pliki `*.env` w `apps/`, `/opt/serwerek/secrets/`, `/root/.ai-secrets/` |

## Zacznij od

1. **Stan prac i decyzje:** `/opt/serwerek/docs/operations/STATUS.md`.
2. **Zasady dla agentów i niezmienniki:** `/opt/serwerek/docs/CLAUDE.md`.
3. **Obsługa serwera (deploy, rollback, crony, kopie, alerty):** `/opt/serwerek/docs/operations/SERWEREK.md`.
4. **Przekazanie projektu agentowi na serwerku:** `/opt/serwerek/docs/operations/HANDOFF-SERVER-AGENT.md`.

## Podstawowe polecenia

```bash
cd /opt/serwerek/apps/polutek
docker compose ps                  # stan kontenerów
./deploy.sh <tag>                  # wdrożenie z ./src (tylko na zgodę właściciela; opis: SERWEREK.md rozdz. 7)
./deploy.sh x --rollback           # powrót do poprzedniego obrazu
systemctl list-timers --no-pager   # zadania cykliczne
AI_AGENT=<nazwa> ai-log "opis"     # wpis o każdej zmianie na serwerze
```

Zasady: każdą zmianę poprzedź kopią pliku i opisz w `ai-log`; zmiany na produkcji tylko na zgodę właściciela; nie otwieraj portów; nie wypisuj sekretów. Nie uruchamiaj tu pełnych testów ani budowy
w godzinach ruchu (testy i budowanie robi się na TAKT). Sprawdź, czy dokumentacja w `/opt/serwerek/docs` nie jest starsza niż ostatni deploy; aktualną wersję ma zawsze repo.
