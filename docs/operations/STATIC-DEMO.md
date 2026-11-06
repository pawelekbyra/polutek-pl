# static-demo (SIKUBENZA i makieta bramki)

Stan zweryfikowany na serwerze: **2026-11-03**. Osobny **eksperyment**, nie jest częścią aplikacji pawelperfect. Dokument odtworzony 2026-11-03 (poprzednia wersja zginęła przy synchronizacji docs przez `deploy.sh`).

## Co to jest

Statyczna strona w nginx pod gołym adresem IP, **tylko HTTP**, bez domeny i bez Cloudflare:

| Adres | Co |
|---|---|
| `http://46.224.211.115:8088/` | `site/index.html`: SIKUBENZA (strona retro, jeden plik ok. 650 KB), ostra CSP, bez zewnętrznych zasobów |
| `http://46.224.211.115:8088/bramka.html` | makieta bramki płatności (bez prawdziwych płatności), luźniejsza CSP: CDN Tailwind, Google Fonts, FontAwesome |
| `/healthz`, `/robots.txt` | zdrowie kontenera; `Disallow: /` |

Strona jest **publiczna dla każdego, kto zna adres**. Nie wrzucaj tu danych wrażliwych, formularzy ani niczego, co ma przyjmować dane od odwiedzających (`form-action 'none'`, metody inne niż GET/HEAD dają 405).

## Gdzie leży

| Rzecz | Wartość |
|---|---|
| Katalog | `/opt/serwerek/apps/static-demo/` (`docker-compose.yml`, `nginx/nginx.conf`, `nginx/common-headers.conf`, `publish.sh`, `README.md`, `site/`) |
| Kontener | `static-demo-web` (`nginx:1.27-alpine`), `0.0.0.0:8088 → 8080`, sieć `static-demo-net` |
| Zabezpieczenia kontenera | `read_only`, `cap_drop: ALL` (+ CHOWN/SETGID/SETUID), `no-new-privileges`, 64 MB RAM, 0,25 CPU, `pids_limit 64`, logi 5 MB × 2 |
| Zawartość | `site/index.html` ← `/opt/claude/sikubenza-source.html`, `site/bramka.html` ← `/opt/claude/ref-bramka-wlasciciela.html` (źródła zostały na serwerze poza repozytorium) |
| Kopia zapasowa | `apps/` wchodzi do nocnego `configs-<ts>.tar.gz`, więc `site/` jest w kopii; bazy brak (nic nie jest zapisywane) |
| Sekrety | brak |

## Komendy

    cd /opt/serwerek/apps/static-demo
    docker compose up -d                 # start
    docker compose ps                    # powinno być healthy
    docker compose restart               # po zmianie nginx/nginx.conf (site/ nie wymaga restartu)
    docker compose down                  # stop (site/ zostaje)
    rm -rf /opt/serwerek/apps/static-demo   # całkowite usunięcie (po docker compose down)

Podmiana strony (bez restartu, `site/` jest zamontowany tylko do odczytu, nginx czyta pliki na żądanie):

    ./publish.sh /ścieżka/plik.html               # nowa strona główna (site/index.html)
    ./publish.sh /ścieżka/plik.html inna.html     # dodatkowa strona /inna.html
    ./publish.sh /ścieżka/katalog/                # cały katalog (musi mieć index.html; stare pliki zostają)

`publish.sh` odrzuca nazwy docelowe z `/` i kropką na początku, usuwa pliki ukryte w `site/`, ustawia `root:root` i prawa `u=rwX,go=rX`.
Ostra CSP obowiązuje wszędzie poza `/bramka.html`: zewnętrzne CDN są zablokowane (dozwolone tylko inline style/skrypt, obrazy i fonty `data:`). Stronę z CDN trzeba dopisać w `nginx/nginx.conf` (nowy blok `location = /...` z własną CSP) i wykonać `docker compose restart`.

Odtworzenie od zera: skopiuj oba źródła do `site/` (nazwy wyżej) i `docker compose up -d`. Backup bazy niepotrzebny.

## noindex

Trzy warstwy, wszystkie mają zostać: nagłówek `X-Robots-Tag: noindex, nofollow, noarchive` (`nginx/common-headers.conf`, także na `/robots.txt`), `<meta name="robots" content="noindex,nofollow,noarchive">` w obu plikach HTML oraz `robots.txt` z `Disallow: /`.
Nowa strona dodana przez `publish.sh` musi mieć własne `<meta name="robots">`; nagłówek dodaje nginx automatycznie.

## Znane ograniczenia i ryzyka

* Tylko HTTP na gołym IP: ruch nieszyfrowany, brak Cloudflare (brak WAF/CDN/ukrycia IP serwera). Nie wpisuj tu loginów ani haseł.
* Port 8088 nasłuchuje na `0.0.0.0`. Zapora `ufw` nie ma reguły dla 8088, ale Docker publikuje porty z pominięciem `ufw`, więc dostępność z internetu zależy od zapory dostawcy; **nie sprawdzono tego z zewnątrz**. Gdyby kiedyś dodano regułę `ufw allow 8088/tcp`, usuń ją: `ufw delete allow 8088/tcp`.
* Wspólny serwer: limit 64 MB / 0,25 CPU chroni produkcję, a `limit_req` (10 żądań/s na IP) przed prostym zalewaniem.
* Obraz `nginx:1.27-alpine` jest przypięty do linii 1.27; aktualizuj świadomie (`docker compose pull && up -d`).
* Źródła HTML leżą w `/opt/claude/` (poza backupem i repozytorium), ale kopie są w `site/`, które jest w backupie konfiguracji.

## Powiązane dokumenty

[`DZIENNIKARSKI-EKSPERYMENT.md`](DZIENNIKARSKI-EKSPERYMENT.md) (drugi eksperyment, ten sam wzorzec) · [`NASZA-GAZETKA.md`](NASZA-GAZETKA.md) · [`ODOO.md`](ODOO.md) · [`SERWEREK.md`](SERWEREK.md) (tabela „Projekty na tym serwerze” w `deploy/serwerek/SERVER-README.md`).
