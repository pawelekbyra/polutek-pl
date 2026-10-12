# Przywracanie serwera ze snapshotu Hetznera

Stan: 2026-10-12. Ten plik jest dla agenta (i właściciela), który uruchamia **snapshot** serwera `serwerek` na nowej maszynie. Jeśli stawiasz wszystko od zera, a nie ze snapshotu, użyj `WAKE-UP.md` (ten sam katalog). Szczegóły serwera: `SERWEREK.md`.

## Kontekst

- Właściciel zrobił snapshot dysku serwera `serwerek` (Hetzner CPX22: 2 vCPU, 4 GB RAM, 80 GB, Norymberga) i skasował serwer, żeby nie płacić ok. 20 EUR miesięcznie, gdy strona jest w becie (`noindex`) i nikt nad nią nie pracuje.
- Snapshot zawiera: system, obrazy Dockera i kontenery z bazą (Postgres 17, PP Support, Redis), pliki env (sekrety), konfigurację tunelu Cloudflare, skrypty w `/opt/serwerek/scripts`, jednostki systemd, dokumentację w `/opt/serwerek/docs`.
- **Czego snapshot nie zawiera:** plików wideo i miniatur (są w Cloudflare R2: buckety `polutek`, `polutek-hls`, `polutek-thumbnails*`), kopii zapasowych bazy (R2 `serwerek-backups`, szyfrowane kluczem `age` właściciela, wygasają po 15 dniach) oraz klucza prywatnego `age` (właściciel trzyma go sam i nie wolno o niego pytać bez realnej potrzeby).
- Reguły pracy: najpierw `CLAUDE.md` (§0, §8.1, §9). Zmiany na produkcji tylko na wyraźną zgodę właściciela w czacie. Każdą zmianę na serwerze zapisz: `AI_AGENT=<nazwa> ai-log "co i dlaczego"`.

## Kolejność przywracania

1. **Utwórz serwer ze snapshotu** (Hetzner → Images → Snapshots → Create server): ten sam typ (CPX22) lub większy, lokalizacja najlepiej `nbg1`. Dodaj klucz SSH właściciela. Nie ustawiaj kopii zapasowych Hetznera (kopie robi `serwerek-backup.timer`).
2. **Pierwsze logowanie:** `ssh root@<nowy-IP>`. Klucz hosta SSH jest nowy, więc zaktualizuj `known_hosts` właściciela. Ustaw alias `serwerek` na nowy adres.
3. **Stan systemu:** `docker ps`, `docker compose ls` (powinny być projekty `polutek`, `pp-support`, `mail-lab`), `systemctl status cloudflared-serwerek`, `systemctl list-timers | grep serwerek`, `df -h /`.
4. **Tunel Cloudflare:** usługa `cloudflared-serwerek` (token w `/etc/serwerek/tunnel.env`) startuje sama. W Cloudflare Zero Trust → Networks → Tunnels sprawdź, że tunel jest `HEALTHY` i ma **jeden** łącznik. Jeśli stary serwer nadal istnieje, **wyłącz go**, żeby nie dzielił ruchu. Adres IP serwera się zmienił, ale strona jest za tunelem, więc DNS zostaje bez zmian.
5. **Kontenery:** jeśli nie wstały, `cd /opt/serwerek/apps/polutek && docker compose up -d` (profil `admin` osobno: `deploy/serwerek/deploy-admin.sh`, patrz `SERWEREK.md` rozdz. 7). Obrazy są w snapshocie. Gdyby brakowało, zbuduj ponownie przez `deploy.sh` z `git archive origin/main`.
6. **Baza:** `docker exec polutek-db-1 pg_isready`; w logach Postgresa zobacz, czy odtworzył się po zatrzymaniu dysku. Uruchom `/opt/serwerek/scripts/restore-test.sh`, który sprawdza ostatni zrzut. Dane zatrzymały się na chwili snapshotu: wpłaty i konta po tej dacie nie istnieją w tej kopii.
7. **Healthcheck i strona:** `curl -s https://www.pawelperfect.com/api/health -H "x-health-token: ..."` (token w `app.env`), potem strona, logowanie, odtwarzanie filmu, panel `admin.pawelperfect.com` (Access), `support.pawelperfect.com`.
8. **Webhooki zewnętrzne (obowiązkowe po dłuższej przerwie):**
   - **Stripe:** endpoint mógł zostać wyłączony po kilku dniach błędów. Panel Stripe → Developers → Webhooks: włącz i użyj „Resend” dla zdarzeń z okresu przerwy. Potem `GET /api/cron/stripe-reconciliation` (z `CRON_SECRET`).
   - **Resend / SES (SNS) / Postmark:** sprawdź, czy webhooki dostarczają. SES nie zależy od IP serwera.
   - **Google OAuth i Turnstile** nie zależą od adresu serwera.
9. **Poczta:** wysyłka idzie przez Amazon SES (SMTP po TLS), niezależnie od IP serwera. Własny MTA (`EMAIL_OWN_*`) jest domyślnie wyłączony. Jeśli go używasz, ustaw rDNS nowego adresu IPv4 w panelu Hetznera. Poczta przychodząca: Cloudflare Email Routing → Worker `support-mail-ingest` → PP Support; sprawdź, że wiadomości z okresu przerwy nie odbiły się (nie ma ich w PP Support).
10. **Kopie zapasowe:** uruchom `/opt/serwerek/scripts/backup.sh` i sprawdź, że 5 plików `.age` trafiło do R2 (`serwerek-backups`). Zrób tak zanim cokolwiek zmienisz. Jednostka `serwerek-backup.timer` robi to nocą o 02:30.
11. **Ochrona w Hetznerze:** włącz ochronę przed usunięciem i przebudową serwera, sprawdź firewall (`ufw`/Hetzner) i że port 22 jest ograniczony do kluczy.
12. **Zapis zmian:** wpis do `ai-log`, aktualizacja `STATUS.md` (sekcja o stanie wdrożenia).

## Typowe pułapki

- Dwa serwery z tym samym tokenem tunelu dzielą ruch (połowa żądań trafi na stary, nieaktualny serwer).
- `NEXT_PUBLIC_*` są wypalone w obrazach (nie zmieniają się przez edycję `app.env`).
- Po długiej przerwie zaległe zadania cron mogą ruszyć lawinowo: sprawdź kolejkę rozsyłek (`send-broadcasts`) **zanim** uruchomisz timery, żeby nie wysłać starych wiadomości.
- Pliki `app.env.bak-*` zawierają stare wartości: nie używaj ich jako źródła.
- Sekrety właściciela (`/root/.ai-secrets`, klucz `age`): nie wypisuj wartości (CLAUDE.md §8.1).
