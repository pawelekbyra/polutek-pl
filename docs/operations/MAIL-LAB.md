# Mail lab: eksperyment z własną wysyłką poczty z serwerka

Stan: 2026-10-07. Bez sekretów. Część projektu „rozgrzewanie mailingu” ([`MAILING-WARMUP.md`](MAILING-WARMUP.md), tor B). Cel: sprawdzić **na boku i bez ryzyka**, jak Gmail, Outlook i polskie skrzynki traktują pocztę wysyłaną z własnego IP serwerka (`46.224.211.115`, PTR `mail.pawelperfect.com`). Prawdziwe maile aplikacji nadal idą przez Resend; lab nie obsługuje żadnego prawdziwego użytkownika.

## Zasady bezpieczeństwa

- **Osobna subdomena `lab.pawelperfect.com`** z własnym SPF, DKIM i DMARC: jeśli reputacja się zepsuje, psuje się tylko ona, nie `pawelperfect.com`.
- **Tylko wysyłka**: kontener Postfix + OpenDKIM bez żadnego nasłuchu i bez opublikowanych portów (`deploy/serwerek/mail-lab/`). Nie przyjmuje poczty z sieci, nie jest otwartym przekaźnikiem.
- **Tylko do skrzynek testowych właściciela** (skrypt `send-test.sh`). Nigdy do prawdziwych użytkowników.
- **Własny projekt compose**, uruchamiany i zatrzymywany ręcznie (`restart: "no"`), twardy limit 128 MB RAM i 0,25 CPU (serwerek ma 4 GB i swap pod presją).
- Wolno i grzecznie: jedno połączenie naraz, pauza 5 s między wiadomościami do tego samego dostawcy.

## DNS dla `lab.pawelperfect.com` (do dodania w Cloudflare, tylko za zgodą właściciela)

| Typ | Nazwa | Wartość |
|---|---|---|
| TXT | `lab.pawelperfect.com` | `v=spf1 ip4:46.224.211.115 -all` |
| TXT | `lab1._domainkey.lab.pawelperfect.com` | klucz publiczny DKIM 2048 bit (z `docker logs pp-mail-lab` albo `/opt/serwerek/data/mail-lab/keys/lab1.txt`) |
| TXT | `_dmarc.lab.pawelperfect.com` | `v=DMARC1; p=none; rua=mailto:pawel.perfect@gmail.com` |

Koperta (MAIL FROM) i `From` to `lab@lab.pawelperfect.com`, więc SPF i DKIM są dopasowane do tej samej subdomeny. Subdomena nie ma MX: zwroty odrzuceń widać w logu Postfixa (odrzucenia przy rozmowie SMTP, czyli większość blokad dostawców), a nie w skrzynce.

## Jak używać

```bash
# na serwerku (jako root)
docker compose -f /opt/serwerek/mail-lab/docker-compose.yml up -d     # start
/opt/serwerek/mail-lab/send-test.sh <skrzynka-testowa> ["temat"]      # jeden mail
docker logs --tail 40 pp-mail-lab                                      # status doręczenia
docker compose -f /opt/serwerek/mail-lab/docker-compose.yml down       # stop
```

Wyniki zapisuj tabelką poniżej (dostawca, Odebrane/Spam, `Authentication-Results`, uwagi). Porównuj z tym samym mailem wysłanym przez Resend do tej samej skrzynki.

## Kryteria

- **Idziemy dalej** (powoli, tygodnie rozgrzewki według [`MAILING-WARMUP.md`](MAILING-WARMUP.md) §5), jeśli Gmail i polskie skrzynki dają Odebrane, a SPF/DKIM/DMARC w nagłówkach przechodzą.
- **Kończymy eksperyment** (`down`, zostają tylko dokumenty), jeśli wszędzie spam albo odrzucenia typu „IP blocked”. Koszt: kilka godzin pracy.
- Barracuda i SpamRATS (formularze usunięcia z list) zgłasza właściciel dopiero, gdy lab ma sens.

## Wyniki

| Data | Skrzynka (dostawca) | Tor | Folder | SPF/DKIM/DMARC | Uwagi |
|---|---|---|---|---|---|
| 2026-10-07 | Gmail (`pawel.perfect@gmail.com`, subdomena `lab.` nowa dla niego) | serwerek | **Odebrane** | SPF pass (IP 46.224.211.115), DKIM pass (`lab1`), DMARC pass | Serwer Gmaila przyjął mail od razu (250 OK, TLS 1.3). Pierwszy test, jedna wiadomość. |
| | | | | | |
