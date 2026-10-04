# serwerek: czytaj najpierw

Ten plik leży w `/opt/serwerek/README.md` i jest odświeżany przy każdym `deploy.sh` z repo (`deploy/serwerek/SERVER-README.md`).
**Źródłem prawdy jest repozytorium** `pawelekbyra/polutek-pl` (gałąź `main`); kopia dokumentacji na serwerze jest tylko
do czytania na miejscu i odświeża się razem z wdrożeniem.

## Co to jest

Serwer produkcyjny Hetzner CPX22 (2 vCPU, 4 GB RAM, 75 GB dysku) z `www.pawelperfect.com`: aplikacja Next.js w Dockerze za Cloudflare Tunnel,
Postgres 17, Redis, kodowanie wideo (kontener `encoder`), kolektor telemetrii (`collector`), PP Support (poczta pomocy) i zadania z systemd.

## Gdzie co leży

| Co | Gdzie |
|---|---|
| Aplikacja: compose, `deploy.sh`, `app.env`, `src/` (źródło wdrożonego commita) | `/opt/serwerek/apps/polutek/` |
| Dane (Postgres, Redis, praca kodowania) | `/opt/serwerek/data/` |
| Skrypty (kopie, test odtworzenia, health, crony) | `/opt/serwerek/scripts/` |
| Dokumentacja projektu (kopia z repo) | `/opt/serwerek/docs/` |
| Kopie zapasowe i instrukcja odtwarzania | `/opt/serwerek/backups/` (`RESTORE.md`) |
| Sekrety | `/opt/serwerek/secrets/`, `app.env` (tylko root, nigdy do repo ani czatu) |

## Zacznij od

1. **Stan prac, otwarte PR-y, decyzje i następne kroki:** `/opt/serwerek/docs/operations/STATUS.md`.
2. **Zasady dla agentów i architektura:** `/opt/serwerek/docs/CLAUDE.md`.
3. **Obsługa serwera (deploy, rollback, crony, telemetria, kopie):** `/opt/serwerek/docs/operations/SERWEREK.md`.
4. **Codzienny przegląd stanu:** `/opt/serwerek/docs/operations/DAILY-BRIEFING.md`.

## Agent pracujący na serwerku

Wdrożenia, diagnostyka, kopie, odczyt bazy i zadania operacyjne możesz robić tu na miejscu (lista i zasady: sekcja „Agent pracujący bezpośrednio na serwerku”
w `/opt/serwerek/docs/operations/STATUS.md`). **Kodu tu nie ma** (brak klonu repo i poświadczeń GitHub): zmiany w kodzie robi sesja na komputerze właściciela,
chyba że właściciel da token GitHub (instrukcja w STATUS.md). Nie uruchamiaj tu pełnych testów ani budowy w godzinach ruchu (2 vCPU, 4 GB RAM).

## Podstawowe polecenia

```bash
cd /opt/serwerek/apps/polutek
./deploy.sh <tag>                  # wdrożenie z ./src (rm -rf src && mkdir src && git archive ... | tar -x -C src najpierw)
./deploy.sh <cokolwiek> --rollback # powrót do poprzedniego obrazu
docker compose ps                  # stan kontenerów
systemctl list-timers --no-pager   # zadania cykliczne
AI_AGENT=<nazwa> ai-log "opis"     # wpis o każdej zmianie na serwerze
```

Każdą zmianę na serwerze poprzedź kopią pliku i opisz w `ai-log`. Sprawdź, czy dokumentacja w `/opt/serwerek/docs` nie jest starsza niż ostatni deploy
(`ls -la --time-style=full-iso /opt/serwerek/docs/operations/STATUS.md`); aktualną wersję ma zawsze repo.
