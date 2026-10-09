# Własny tor poczty (serwerek) obok Resend/Postmarka

Stan: 2026-10-09. Bez sekretów. Część projektu „rozgrzewanie mailingu” ([`MAILING-WARMUP.md`](MAILING-WARMUP.md)). Kod jest w repo i **domyślnie wyłączony**; włączenie, zmiana sieci docker i wdrożenie to zmiany na produkcji, więc tylko na wyraźną zgodę właściciela (CLAUDE.md §0).

## Po co i jak to działa

Dwa tory zamiast jednego: dostawca (Resend, ewentualnie Postmark) zostaje torem głównym i awaryjnym, a własny Postfix (kontener `pp-mail-lab`, [`MAIL-LAB.md`](MAIL-LAB.md)) dostaje stopniowo coraz większy kawałek **niskiego ryzyka** poczty transakcyjnej (np. powitanie). Wyniki testów na Gmailu, Protonie i Outlooku są takie same jak u dostawców, a koszt wysyłki to zero. Docelowo duże wolumeny (newsletter) idą przez ESP z dedykowanymi IP, nie przez ten tor.

`sendEmail()` (`lib/modules/email/infrastructure/resend-email.transport.ts`) po zbudowaniu wiadomości pyta `shouldUseOwnTransport()` (`own-mail.transport.ts`):

1. Wyłączone, dopóki nie ma `EMAIL_OWN_SMTP_HOST`.
2. Tylko rodzaje maili z `EMAIL_OWN_KINDS` (lista po przecinku, np. `welcome-email`), **nigdy poczta masowa** (`stream: 'news'`).
3. Tylko `EMAIL_OWN_SHARE` procent adresatów (0..100). Decyduje skrót SHA-256 adresu, więc ta sama osoba zawsze idzie tą samą drogą, a podniesienie procentu tylko dokłada adresatów.
4. Wysyłka: SMTP przez nodemailer do Postfixa w prywatnej sieci docker (bez TLS i bez haseł, nic nie opuszcza hosta). Koperta (Return-Path) to `lab@lab.pawelperfect.com` (`EMAIL_OWN_ENVELOPE_FROM`), widoczny `From` zostaje `no-reply@pawelperfect.com`; SPF obejmuje IP serwerka, DKIM podpisuje klucz `lab1` (d=`lab.pawelperfect.com`), DMARC przechodzi w trybie relaxed.
5. **Każda porażka** (brak połączenia, timeout, odrzucenie) kończy się wysyłką tego samego maila torem głównym. Skrajny przypadek: timeout po tym, jak Postfix już przyjął wiadomość, może dać duplikat; przy powitaniach to akceptowalne.

Identyfikator zwrócony z toru własnego to numer kolejki Postfixa (`queued as …`), po którym znajdziesz linie doręczenia w `docker logs pp-mail-lab`.

## Zmienne (`app.env`)

| Zmienna | Rola |
|---|---|
| `EMAIL_OWN_SMTP_HOST` | host Postfixa w sieci docker (`pp-mail-lab`); puste = tor wyłączony |
| `EMAIL_OWN_SMTP_PORT` | domyślnie 25 |
| `EMAIL_OWN_KINDS` | rodzaje maili (pole `kind` w `sendEmail`), np. `welcome-email` |
| `EMAIL_OWN_SHARE` | 0..100, procent adresatów; start od 5-10 |
| `EMAIL_OWN_ENVELOPE_FROM` | koperta, domyślnie `lab@lab.pawelperfect.com` |

## Wdrożenie (po zgodzie właściciela, w tej kolejności)

1. Sieć i obraz Postfixa (osobny projekt compose, nie rusza produkcji):
   ```bash
   docker network create --subnet 172.30.250.0/29 pp-mail-submit
   docker compose -f /opt/serwerek/mail-lab/docker-compose.yml up -d --build   # po skopiowaniu deploy/serwerek/mail-lab/
   ```
   Kontener wystawia SMTP tylko w tej sieci (`mynetworks` = pętla zwrotna + `172.30.250.0/29`), bez opublikowanych portów.
2. Dołączenie kontenera `app` do tej sieci w `deploy/serwerek/docker-compose.yml` (osobna zmiana wraz z wdrożeniem aplikacji; sieć musi już istnieć, inaczej `up` się nie uda):
   ```yaml
   app:
     networks: [default, mail-submit]
   networks:
     mail-submit: { external: true, name: pp-mail-submit }
   ```
3. Test bez ruchu użytkowników: z kontenera `app` jedno `nc pp-mail-lab 25` (powinno odpowiedzieć banerem), potem jeden mail do skrzynki testowej przy `EMAIL_OWN_SHARE=100` na czas próby, na koniec ustawienie docelowego procentu.
4. Włączenie: dopisanie czterech zmiennych do `app.env` (kopia pliku przed zmianą, `ai-log`), odtworzenie kontenera `app`.

**Cofnięcie:** usunięcie `EMAIL_OWN_SMTP_HOST` (albo `EMAIL_OWN_SHARE=0`) i odtworzenie `app`; wszystko wraca do toru głównego, bez zmian w kodzie.

## Zwroty i blokady z toru własnego (kod gotowy, timer do włączenia)

Domena `lab.pawelperfect.com` nie ma MX, więc zwroty nie przychodzą jako poczta; wynik każdej wysyłki to linia `status=sent|deferred|bounced` w logu Postfixa. Co 5 minut `serwerek-own-mail-events.timer` (`scripts/serwerek/own-mail-events.sh`) wysyła ostatnie okno logu (z 2-minutowym zakładem) do `POST /api/cron/own-mail-events` (sekret `CRON_SECRET`). Parser i klasyfikacja: `lib/modules/email/domain/postfix-log.ts`.

- **Twarde odbicie adresu** (DSN 5.1.1/5.1.2/5.1.3/5.1.6/5.1.10, 5.2.1, 5.4.4, 5.4.1 z „recipient/user unknown”) → ten sam use case co webhook Resend/Postmarka: adres trafia do `EmailSuppression`. Każda linia ma stabilny identyfikator zdarzenia bez adresu (skrót), więc zachodzące okna nie dublują wpisów.
- **Blokada przez odbiorcę** (5.7.x, 4.7.x albo tekst o blokadzie, liście RBL/Barracuda/Spamhaus, reputacji, limicie, spamie, polityce) **nigdy nie zawiesza adresu** (to sygnał o nas, nie o adresacie). Odpowiedź ma `alert: true`, skrypt kończy się kodem 3, jednostka zostaje `failed` i `health.sh` ją zgłasza; przyczyny (bez adresów) są w logu aplikacji i w odpowiedzi.
- Inne odbicia (skrzynka pełna itp.) i `deferred` są tylko liczone. Gdy kontener `pp-mail-lab` nie działa, skrypt kończy się spokojnie (tor opcjonalny).
- Włączenie (po zgodzie, razem z torem): `install -m 755 scripts/serwerek/own-mail-events.sh /opt/serwerek/scripts/ && install -m 644 deploy/serwerek/systemd/serwerek-own-mail-events.* /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now serwerek-own-mail-events.timer`.

## Otwarte (kolejny etap)

- Pokazanie liczników toru własnego (wysłane / odbicia / blokady) w odprawie dziennej i w panelu.
- Barracuda nadal listuje IP; pojedynczy IP i brak dedykowanej reputacji ograniczają ten tor do niskiego wolumenu.
