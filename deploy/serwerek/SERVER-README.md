# serwerek: czytaj najpierw

Ten plik leży w `/opt/serwerek/README.md` i jest odświeżany przy każdym `deploy.sh` z repo (`deploy/serwerek/SERVER-README.md`).
**Źródłem prawdy jest repozytorium na GitHubie** (`pawelekbyra/polutek-pl`, `main`; od 2026-10-07, wcześniej krótko serwer TAKT). Kopia dokumentacji na serwerze jest tylko do czytania na miejscu.

## Projekty na tym serwerze

Na serwerze działa **kilka niezależnych projektów**. Projekt **główny** to **pawelperfect** (`www.pawelperfect.com`); pozostałe to osobne strony i eksperymenty (stan na 2026-11-03).

| Nazwa | Opis | Adres | Katalog | Kontener / port | noindex? | Dokumentacja |
|---|---|---|---|---|---|---|
| **pawelperfect** (GŁÓWNY) | Platforma Next.js + Postgres + Redis + kodowanie wideo + kolektor; panel admina i PP Support (oba za Cloudflare Access); Odoo z modułem księgowości JDG | https://www.pawelperfect.com, https://admin.pawelperfect.com, https://support.pawelperfect.com, https://firma.pawelperfect.com/web/login | `apps/polutek/`, `apps/pp-support/`, `apps/odoo/` | `polutek-app-1` 127.0.0.1:3000, `polutek-admin-1` :3100, `pp-support-web-1` :3010, `odoo-proxy-1` :3200 (+ bazy, redis, encoder, collector); tunel Cloudflare | nie (strona publiczna); admin, support i Odoo za logowaniem | `docs/operations/STATUS.md`, `SERWEREK.md`, `ADMIN-PANEL.md`, `PP-SUPPORT-GUIDE.md`, `ODOO.md` |
| **pawelperfect.pl** (domena) | Domena z home.pl (NS nadal home.pl). Strefa Cloudflare `pending`: przekierowanie 301 na `.com` i Email Routing przygotowane, ale nieaktywne do zmiany NS na Cloudflare (robi właściciel w home.pl) | pawelperfect.pl | brak (nic tu nie hostujemy) | brak | nie dotyczy | `DOMENA-PAWELPERFECT-PL.md` |
| **nasza-gazetka** | Statyczna strona (eksport Next.js) w nginx. Migracja z Vercela w toku: NS już u Cloudflare (strefa `active`), ale rekordy nadal wskazują na Vercel; przełączenie na tunel (`cutover.sh to-tunnel`) czeka na zgodę właściciela | https://nasza-gazetka.pl (Vercel), testowo https://test-gazetka.pawelperfect.com (ten serwer, tunel Cloudflare) | `apps/nasza-gazetka/` (strona: `data/nasza-gazetka/site`) | `nasza-gazetka-web` 127.0.0.1:3300, sieć `nasza-gazetka-net`, 64 MB, 0,25 CPU | tak na adresie testowym (X-Robots-Tag); po przełączeniu domeny decyduje właściciel | `NASZA-GAZETKA.md` |
| **SIKUBENZA** (eksperyment) | Strona retro 1997 oraz makieta bramki płatności (bez prawdziwych płatności) | http://46.224.211.115:8088/ oraz `/bramka.html` (tylko HTTP, goły adres IP) | `apps/static-demo/` | `static-demo-web`, 0.0.0.0:8088, sieć `static-demo-net`, 64 MB, 0,25 CPU | tak (X-Robots-Tag, meta, robots.txt) | `STATIC-DEMO.md`, `apps/static-demo/README.md` |
| **dziennikarski** (eksperyment) | Statyczny eksport z repo `dziennikarski` | http://46.224.211.115:8089/ (tylko HTTP) | `apps/dziennikarski/` | `dziennikarski-web`, 0.0.0.0:8089, sieć `dziennikarski-net`, 512 MB, 0,5 CPU | tak (X-Robots-Tag) | `DZIENNIKARSKI-EKSPERYMENT.md` |

Ścieżki dokumentacji bez katalogu leżą w `docs/operations/`.

**Zasada dla nowych projektów:** osobny katalog w `apps/`, osobna sieć Dockera, limity zasobów (pamięć i CPU), `noindex` (nagłówek `X-Robots-Tag`, meta robots i `robots.txt`), dokumentacja w `docs/operations/` i wpis w tej tabeli. Nie ruszaj przy tym kontenerów, DNS ani tunelu innych projektów.

## Co to jest

Serwer produkcyjny Hetzner CX33 (4 vCPU, 8 GB RAM, 80 GB dysku od 2026-11-02) z projektem głównym `www.pawelperfect.com`: aplikacja Next.js w Dockerze za Cloudflare Tunnel, Postgres 17, Redis, kodowanie wideo (`encoder`), kolektor telemetrii (`collector`),
panel administratora (`admin.pawelperfect.com`), PP Support (poczta pomocy), Odoo (`firma.pawelperfect.com`) i zadania z systemd. Obok działają mniejsze projekty i eksperymenty z tabeli wyżej.

## Gdzie co leży

| Co | Gdzie |
|---|---|
| Aplikacja: compose, `deploy.sh`, `deploy-admin.sh`, pliki env, `src/` (kod wdrożonego commita) | `/opt/serwerek/apps/polutek/` |
| PP Support | `/opt/serwerek/apps/pp-support/` |
| Pozostałe projekty (odoo, nasza-gazetka, static-demo, dziennikarski) | `/opt/serwerek/apps/<nazwa>/` |
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
w godzinach ruchu (testy i budowanie robi się lokalnie przed wdrożeniem). Sprawdź, czy dokumentacja w `/opt/serwerek/docs` nie jest starsza niż ostatni deploy; aktualną wersję ma zawsze repo.
