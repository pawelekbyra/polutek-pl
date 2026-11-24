# Nodemailer 10: aktualizacja z 7.0.13 i próba po wdrożeniu

Stan: 2026-11-24 (paczka D5 etapu 1.5 planu audytu). Bez sekretów. Nodemailer używają tylko dwa tory poczty: własny Postfix (`lib/modules/email/infrastructure/own-mail.transport.ts`, [`MAIL-OWN-TRANSPORT.md`](MAIL-OWN-TRANSPORT.md)) i SES przez SMTP (`ses-email.transport.ts`, [`EMAIL_SES.md`](EMAIL_SES.md)). Resend i Postmark nie używają tej biblioteki.

## Co się zmieniło

- `nodemailer` `^7.0.13` → `^10.6.1` (poprawki podatności SMTP injection, CRLF, omijanie reguł dostępu do plików i URL-i są w 8.0.4, 8.0.5, 8.0.9, 9.0.1, 9.0.2, 9.0.5 i 10.x). Wymaga Node 20+ (produkcja ma 22).
- `@types/nodemailer` usunięte: od 10.0.0 paczka niesie własne typy (układ zgodny z `@types`), a stare typy 8.x tylko dublowały deklaracje.
- Kod transportów **bez zmian**: kształt błędów, na którym opierają się `mapOwnMailError`, `mapSesError` i `isSesUnavailable`, jest w 10.6.1 ten sam co w 7.0.13 (sprawdzone na prawdziwej bibliotece, oba warianty, ten sam skrypt z serwerem SMTP na loopbacku): `code` (`EENVELOPE` po odrzuceniu RCPT/MAIL, `EMESSAGE` po DATA, `EAUTH`, `ESOCKET` przy odmowie połączenia, `ETIMEDOUT`, `EDNS`), `responseCode`, `command`, `response`.
- Nowe pola błędu (nieużywane, nic nie psują): `err.permanent` (5xx poza 503 = true), `err.originalCode` (np. `ECONNREFUSED` pod `ESOCKET`), `info.serverMessageId`.

## Zmiany łamiące 8 → 10 i ich wpływ na nas

| Wersja | Zmiana | Wpływ |
|---|---|---|
| 8.0.0 | kod błędu `NoAuth` → `ENOAUTH`; kody błędów ujednolicone | nie używamy `NoAuth`; nasze mapowanie czyta tylko `code` i `responseCode`, a te się nie zmieniły |
| 9.0.0 | HTTPS przy pobieraniu zdalnej treści (załączniki `href`/`path`, OAuth2, proxy CONNECT) domyślnie weryfikuje certyfikat | nie wysyłamy załączników ani nie pobieramy URL-i; SMTP weryfikował certyfikat już wcześniej |
| 10.0.0 | Node 20+, przepisanie na TypeScript (ESM + CJS) | produkcja Node 22; Next bundluje `import nodemailer from "nodemailer"` bez zmian; typy własne paczki |
| 8.0.5 | CRLF w opcji `name` transportu czyszczone | nie ustawiamy `name` |
| 8.0.4 | rozmiar w kopercie sanityzowany | nie używamy |
| 9.0.5 | znaki sterujące w wartościach nagłówków i adresach są usuwane lub kodowane | nasze nagłówki (`Auto-Submitted`, `List-Unsubscribe`, `Feedback-ID`, `X-SES-*`) są jednowierszowe; tematy z polskimi znakami kodowane jak dotąd |
| 9.0.1 / 9.1.1 | `disableFileAccess` / `disableUrlAccess` obowiązują też dla opcji `raw` i przy `resolveContent` | nie używamy `raw`, plików ani URL-i w treści |
| 9.1.0 | opcja `maxRecipients` | nie ustawiamy; jeden adresat na wiadomość |
| 10.1.0 | utwardzenie strumieni, połączeń SMTP i puli; `requireTLS` wygrywa z `ignoreTLS` i `opportunisticTLS`; po odpowiedzi 421 sesja jest kończona | SES: `requireTLS: true` na 587 jak dotąd (wprost zalecane zachowanie); własny tor: `ignoreTLS: true` bez `requireTLS`, więc zostaje czysty SMTP w sieci dockera |
| 10.1.x–10.6.x | poprawki addressparsera (adres `Nazwa <adres>` w `From`), kodowania nagłówków, DKIM (nie używamy), `socketCloseTimeout`, `AbortSignal` | `From: Pawel Perfect <no-reply@pawelperfect.com>` i `To` bez zmian |

Nie dotyczą nas: SES SDK (używamy SMTP SES), DKIM w bibliotece (podpisuje Postfix lub SES), `attachments`, OAuth2.

## Testy

- Nowy `tests/unit/modules/email/nodemailer-real-errors.test.ts` uruchamia **prawdziwy** Nodemailer przeciw malutkiemu serwerowi SMTP na loopbacku (bez sieci, bez mocka biblioteki): sukces z identyfikatorem kolejki Postfixa i identyfikatorem SES, odrzucenie 554 na RCPT, 450, 421, odmowa po DATA, odmowa połączenia (`ESOCKET`), 454 throttling, 535 odrzucone poświadczenia, 554 piaskownica, 501 zły adres oraz pełne ścieżki `sendEmail()` z awaryjnym Resendem (Resend zamockowany). Przy każdej przyszłej aktualizacji biblioteki ten plik pokaże zmianę kształtu błędów.
- `own-mail.test.ts` miał wymyślony kształt błędu odmowy połączenia (`code: 'ECONNECTION'`); poprawiony na prawdziwy (`ESOCKET`, `originalCode: 'ECONNREFUSED'`). Nazwa błędu w logach (`own_smtp_esocket`, `ses_esocket`) była taka sama także w Nodemailer 7.

## Próba ręczna po wdrożeniu

Skrypt `scripts/ops/nodemailer-smoke.mjs` używa dokładnie tych opcji transportu, co kod aplikacji. Tryb domyślny **nic nie wysyła**: łączy się, robi STARTTLS i AUTH (`verify()`). Wysłanie jednej wiadomości (`--send`, adres stały: `pawel.perfect@gmail.com`) tylko za zgodą właściciela w czacie. Biblioteka jest w obrazie aplikacji zbundlowana, więc skrypt biegnie w jednorazowym kontenerze `node:22` w sieci kontenera `polutek-app-1` (te same nazwy hostów co aplikacja, np. `pp-mail-lab`):

```bash
# 1. Biblioteka w tej samej wersji co package.json (bez zależności), w katalogu tymczasowym
D=$(mktemp -d) && cd "$D" && npm pack nodemailer@10.6.1 --silent && mkdir -p node_modules/nodemailer \
  && tar xzf nodemailer-10.6.1.tgz -C node_modules/nodemailer --strip-components=1 \
  && cp /opt/claude/polutek-pl/scripts/ops/nodemailer-smoke.mjs .   # główny klon, po scaleniu PR-a

# 2. Zmienne tylko do procesu (sekrety nie trafiają na dysk ani do wyjścia)
for v in EMAIL_OWN_SMTP_HOST EMAIL_OWN_SMTP_PORT EMAIL_OWN_ENVELOPE_FROM SES_SMTP_USER SES_SMTP_PASS SES_SMTP_HOST SES_SMTP_PORT EMAIL_FROM; do
  export "$v=$(docker exec polutek-app-1 printenv $v 2>/dev/null)"; done

# 3. Własny SMTP (Postfix) i SES: tylko połączenie i uwierzytelnienie
for m in own ses; do
  docker run --rm --network container:polutek-app-1 -v "$D":/w:ro -w /w \
    -e EMAIL_OWN_SMTP_HOST -e EMAIL_OWN_SMTP_PORT -e EMAIL_OWN_ENVELOPE_FROM -e SES_SMTP_USER -e SES_SMTP_PASS -e SES_SMTP_HOST -e SES_SMTP_PORT -e EMAIL_FROM \
    node:22-bookworm-slim node nodemailer-smoke.mjs $m
done

# 4. Po zgodzie właściciela: jedna prawdziwa wiadomość każdym torem (dopisz --send po nazwie trybu)
#    ... node nodemailer-smoke.mjs own --send   oraz   ... node nodemailer-smoke.mjs ses --send

# 5. Sprzątanie
unset SES_SMTP_USER SES_SMTP_PASS; rm -rf "$D"
```

Oczekiwane: `verify: OK`; po `--send` odpowiedź `250 2.0.0 Ok: queued as <ID>` (Postfix; potem `status=sent` w logu kontenera `pp-mail-lab`) albo `250 Ok <ID>` (SES). Błąd drukuje się jako JSON z `code`, `responseCode`, `command`.

### Jak sprawdzić awaryjny Resend

1. **Bez ingerencji w produkcję:** testy z prawdziwą biblioteką (`nodemailer-real-errors.test.ts`, trzy testy „falls back to Resend”) przechodzą na CI: odmowa połączenia z Postfixem, odrzucenie 554 przez Postfix i niedostępny punkt SES kończą się wysyłką tego samego maila przez Resend (jeden wywołany `emails.send`), a błąd adresata (501) nie.
2. **Na produkcji (tylko za zgodą właściciela, to zmiana konfiguracji i restart):** w `app.env` ustaw tymczasowo `SES_SMTP_PORT=1` (SES nieosiągalny), odtwórz `app`, wywołaj jeden mail transakcyjny na adres właściciela (np. „wyślij ponownie weryfikację”) i sprawdź w `docker logs polutek-app-1`: `[email] SES unavailable, falling back to Resend { name: 'ses_esocket' ...}`, a mail dochodzi (nagłówki w Gmailu: `Received` z Resend). Potem przywróć `SES_SMTP_PORT` (usuń zmienną) i odtwórz `app`. Własny tor analogicznie: `EMAIL_OWN_SMTP_PORT=1` i log `Own mail transport failed, falling back to the primary provider`.

## Cofnięcie

Kod i konfiguracja się nie zmieniają, więc cofnięcie to wycofanie PR-a (`git revert` merge'a, ponowne wdrożenie poprzednim tagiem `rN` przez `deploy.sh --rollback`): wraca Nodemailer 7.0.13 z `@types/nodemailer`. Baza i `app.env` nie są dotknięte.
