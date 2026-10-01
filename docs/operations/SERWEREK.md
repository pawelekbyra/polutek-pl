# serwerek — runbook serwera Hetzner (stan faktyczny 2026-10-01)

Ten plik opisuje to, co **faktycznie stoi** na serwerze. Plan i cele: [`../architecture/serwerek.md`](../architecture/serwerek.md). Kopia operacyjna tego opisu leży na samym serwerze: `/opt/serwerek/docs/README.md` (przy zmianie aktualizuj OBIE).

## 1. Co to jest i po co

Pierwszy, jedyny serwer startowy ("serwerek"): tania maszyna do testowania systemu, później do hostowania całej aplikacji i workera wideo. **To nie jest produkcja** (produkcja to nadal Vercel + Neon + Cloudflare). Właściciel ma backup wszystkiego. Wideo dla widzów idzie z Cloudflare R2/CDN, nie przez ten VPS.

**Serwer jest zarządzany przez AI** (decyzja właściciela 2026-10-01): AI dba o porządek, a dokumentacja jest najważniejsza, bo inne sesje/AI nic o tej maszynie nie wiedzą.

## 2. Dostęp

- IP: `46.224.211.115` (IPv4), hostname `serwerek`, Hetzner Cloud, Norymberga (nbg1).
- Z komputera właściciela (Windows): `ssh serwerek` (alias w `%USERPROFILE%\.ssh\config`) albo `ssh -i %USERPROFILE%\.ssh\pracownia_ed25519 root@46.224.211.115`.
- Klucz agenta oraz jego kopia zapasowa: `%USERPROFILE%\.ai-secrets\ssh\`. W `secrets.env`: `SERWEREK_HOST`, `SERWEREK_SSH_KEY`. Nigdy nie kopiuj materiału klucza do repo/logów.
- SSH tylko kluczem (`PasswordAuthentication no`, root tylko kluczem: `PermitRootLogin prohibit-password`).
- Konsola Hetzner (logowanie) należy do właściciela. Token API Hetzner: **brak** (zob. `AGENT_ACCESS.md`).

## 3. Parametry i koszt

| | |
|---|---|
| Typ | CPX22: 2 vCPU AMD x86, 4 GB RAM, 80 GB dysku (≈75 GB na `/`) |
| System | Ubuntu 26.04.1 LTS, kernel 7.0.0 |
| Koszt | €0,038/h + IPv4 €0,00098/h ≈ **€24,59/mies.** z 23% VAT |
| Rozliczenie | godzinowe, faktura z dołu co miesiąc |
| Wyłączony serwer | **nadal kosztuje**; płatność zatrzymuje tylko usunięcie serwera |
| Zmiana rozmiaru | tylko w konsoli Hetzner ("Rescale") |

## 4. Co jest zainstalowane

- Zaktualizowany system, po restarcie; `unattended-upgrades` (aktywny), strefa czasowa `Europe/Warsaw`.
- Firewall UFW: domyślnie deny incoming; **otwarte tylko `22/tcp`** (v4 i v6). Nasłuchują tylko: SSH :22 i lokalny resolver DNS.
- `fail2ban` (aktywny).
- Swap 4 GB (`/swapfile`), `vm.swappiness=10`.
- Docker 29.8 (kontenerów brak), Node 22.23, FFmpeg 8.0.1, git, tmux, htop.
- Caddy 2.6.2: **zainstalowany, ale WYŁĄCZONY** (`disabled`, `inactive`) do czasu skonfigurowania strony. Włączając go, udokumentuj otwarcie 80/443.
- **Nie ma jeszcze** aplikacji, bazy ani workera.

## 5. Układ katalogów

```
/opt/serwerek/
  apps/      # aplikacje; każda w apps/<nazwa>/ z docker-compose.yml
  data/      # dane trwałe (wolumeny, bazy)
  backups/   # kopie lokalne
  scripts/   # skrypty utrzymaniowe
  docs/      # README.md = kopia operacyjna tego pliku
/var/log/serwerek/changes.log   # dziennik zmian (ai-log)
/usr/local/bin/ai-log           # pomocnik dziennika
/etc/motd                       # komunikat po zalogowaniu
```

## 6. Zasady dla agentów AI

1. **Każdą zmianę loguj**: `AI_AGENT=<twoja-nazwa> ai-log "co i dlaczego"` (dopisuje do `/var/log/serwerek/changes.log`). Bez wpisu zmiana nie istnieje.
2. **Dokumentuj** wszystko, co dodajesz: w tym pliku ORAZ w `/opt/serwerek/docs/README.md` na serwerze.
3. **Żadnych sekretów na serwerze**, poza wyraźnie wymienionymi tutaj (obecnie: żadnych). Sekrety właściciela żyją w `%USERPROFILE%\.ai-secrets\`.
4. Aplikacje preferuj jako **Docker Compose** w `/opt/serwerek/apps/<nazwa>/`.
5. **Nie otwieraj portów** bez zapisu tutaj i w ai-log; domyślnie dostęp przez Cloudflare Tunnel/Access, nie przez publiczne porty.
6. **Nie usuwaj serwera ani dysku.** Rozmiar zmieniaj tylko przez konsolę Hetzner.
7. Nie osłabiaj SSH (hasła) ani firewalla.

## 7. Sprawdzenie zdrowia

```
ssh serwerek 'uptime; free -h; df -h /; ufw status; systemctl is-active ssh fail2ban docker unattended-upgrades; docker ps; tail -20 /var/log/serwerek/changes.log'
ssh serwerek 'sshd -T | grep -Ei "passwordauthentication|permitrootlogin"; ss -tlnp'
```

Oczekiwane: UFW active z samym 22/tcp, ssh/fail2ban/docker/unattended-upgrades `active`, `passwordauthentication no`.

## 8. Backupy

**Brak.** Na serwerze nie ma jeszcze nic wartego backupu. Plan: włączyć Hetzner Backups (+20% ceny) po pierwszym tygodniu; w razie potrzeby snapshoty (płatne osobno, przez konsolę lub API).

## 9. TODO

- [ ] Testowy deploy aplikacji + Postgres (Docker Compose)
- [ ] Cloudflare Tunnel / Access (dostęp bez publicznych portów)
- [ ] Monitoring i alerty
- [ ] Backupy (Hetzner Backups po tygodniu; snapshoty)
- [ ] Claude Code na serwerze
- [ ] Sejf na sekrety
- [ ] Token API Hetzner (patrz `AGENT_ACCESS.md`)
- [ ] Aktualizować "Stan faktyczny" w `docs/architecture/serwerek.md` po każdym etapie
