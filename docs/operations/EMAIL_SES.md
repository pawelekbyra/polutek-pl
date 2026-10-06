# Wysyłka poczty przez Amazon SES (region eu-north-1, Sztokholm)

Stan: kod gotowy i przełączalny (gałąź `feat/email-ses`), **produkcja nadal na Resend**, dopóki właściciel nie ustawi `EMAIL_PROVIDER=ses` po udanym teście. Bez sekretów w tym pliku.

## 1. Architektura

- Jedno miejsce wysyłki: `sendEmail()` w `lib/modules/email/infrastructure/email.transport.ts`. Buduje dokument HTML, wersję tekstową, nadawcę, Reply-To i nagłówki, a potem oddaje wiadomość adapterowi:
  - `resend-email.transport.ts` (Resend, API HTTP), gdy `EMAIL_PROVIDER` jest pusty lub `resend` (**domyślnie**),
  - `ses-email.transport.ts` (Amazon SES przez SMTP, `nodemailer`), gdy `EMAIL_PROVIDER=ses`.
- Publiczne interfejsy funkcji wysyłających (`sendVerificationEmail`, rozsyłki, `sendOperatorEmail` itd.) są bez zmian.
- Konfiguracja nadawców, przełącznika i limitów w jednym module: `lib/email-config.ts`.
- SES: host `email-smtp.<AWS_REGION>.amazonaws.com` (domyślnie `email-smtp.eu-north-1.amazonaws.com`), port **587**, STARTTLS wymagany (`requireTLS: true`, dane logowania nigdy nie idą otwartym tekstem), pula połączeń (3 połączenia, 100 wiadomości na połączenie), limity czasu 10 s (połączenie, powitanie) i 30 s (gniazdo). Port 465 i 25 nie są używane (Hetzner blokuje 25 i 465 wychodzące, 587 działa).
- Identyfikator wiadomości: odpowiedź SES `250 Ok <id>`.
- Gdy ustawiono `SES_CONFIGURATION_SET`, każda wiadomość dostaje nagłówki `X-SES-CONFIGURATION-SET` i `X-SES-MESSAGE-TAGS` (`app=pawelperfect, kind=<rodzaj>`); bez niego tych nagłówków nie ma.
- SES nie ma odpowiednika klucza idempotencji Resend: `idempotencyKey` jest ignorowany. Kolejka rozsyłek i tak zapisuje wynik per odbiorca, więc ryzyko podwójnej wysyłki to wyłącznie awaria między przyjęciem wiadomości a zapisem w bazie (okno kilku milisekund).

### Nadawcy

| Rodzaj poczty | Zmienna | Domyślnie |
|---|---|---|
| systemowa i konta (rejestracja, hasło, klucz dostępu, potwierdzenia, rozsyłki) | `EMAIL_FROM` | `Pawel Perfect <no-reply@pawelperfect.com>` |
| odpowiedzi na pocztę systemową | `EMAIL_REPLY_TO` | `support@pawelperfect.com` |
| poczta wychodząca z pracy supportu (`sender: 'support'` w `sendEmail`) | `EMAIL_SUPPORT_FROM` | `Pawel Perfect <support@pawelperfect.com>` |

Dowolny adres `@pawelperfect.com` jest dozwolony (domena zweryfikowana w SES). Goły adres dostaje nazwę wyświetlaną "Pawel Perfect".

### Nagłówki

`List-Unsubscribe` i `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058) dostają **tylko** rozsyłki (poczta z `unsubscribe`), nigdy poczta systemowa i konta. Podpisywanie linków bez zmian (`EMAIL_UNSUBSCRIBE_SIGNING_SECRET`). Zawsze: `Auto-Submitted: auto-generated`, `X-Entity-Ref-ID`.

### Subskrybenci bez Resend

Źródłem prawdy są tabele `EmailPreference` i `EmailSuppression`. Przy `EMAIL_PROVIDER=ses` zapisy, wypisy, kolejka usuwania kontaktów (`ResendContactRemoval`) i usuwanie konta **nie wywołują Resend** i nie tworzą klienta Resend (`ResendAudienceGateway` zwraca `NOT_CONFIGURED`; test `tests/unit/modules/subscriptions/ses-no-resend.test.ts`). Przy `resend` synchronizacja Audience działa jak dotąd.

## 2. Zmienne środowiskowe

| Zmienna | Znaczenie |
|---|---|
| `EMAIL_PROVIDER` | `resend` (domyślnie) albo `ses`. Inna wartość blokuje start produkcji (walidacja). |
| `SES_SMTP_USER`, `SES_SMTP_PASS` | dane SMTP z konsoli SES (nie klucze IAM). Wymagane na produkcji tylko przy `ses`. |
| `AWS_REGION` | domyślnie `eu-north-1` |
| `SES_SMTP_HOST` | opcjonalne nadpisanie hosta |
| `SES_CONFIGURATION_SET` | opcjonalne; potrzebne dopiero przy zdarzeniach (punkt 7) |
| `RESEND_API_KEY` | wymagane na produkcji tylko przy `resend` |
| `EMAIL_FROM`, `EMAIL_REPLY_TO`, `EMAIL_SUPPORT_FROM` | patrz tabela nadawców (`EMAIL_FROM` zawsze wymagane na produkcji) |
| `EMAIL_DAILY_LIMIT`, `EMAIL_MONTHLY_LIMIT` | limity pokazywane w panelu; zastępują `RESEND_DAILY_LIMIT` / `RESEND_MONTHLY_LIMIT` (stare nazwy nadal działają jako zapas). Domyślnie Resend 100/3000, SES 200/6000. |

Zmienne SES ustawia się w `app.env` na serwerku (strona) i, tylko dla „Wyślij test do siebie”, w `admin.env`. Po zmianie restart kontenera. Nigdy w gicie.

## 3. Rekordy DNS, które już są w Cloudflare

- DKIM SES: trzy rekordy CNAME `<token>._domainkey.pawelperfect.com` -> `<token>.dkim.amazonses.com`.
- MAIL FROM `bounce.pawelperfect.com`: MX `10 feedback-smtp.eu-north-1.amazonses.com` oraz TXT SPF `v=spf1 include:amazonses.com ~all` (nazwa `bounce.`; SPF dopasowany do domeny `From` przez MAIL FROM, DMARC przechodzi także przez DKIM).
- Tożsamość domeny `pawelperfect.com` w SES (eu-north-1) istnieje.
- Bez zmian zostają: DMARC `_dmarc`, rekordy poczty przychodzącej (Cloudflare Email Routing).

(Dokładnych wartości tokenów DKIM tu nie powtarzamy; zobacz konsolę SES i Cloudflare. Nic w DNS nie zostało zmienione w tej pracy.)

## 4. Z sandboxa na produkcję (kroki właściciela)

Nowe konto SES jest w **sandboxie**: wysyłka tylko do zweryfikowanych adresów/domen, ok. **200 wiadomości na dobę, 1 na sekundę** (źródło: dokumentacja SES, „Request production access”). Test w sandboxie na `pawel.perfect@gmail.com` wymaga zweryfikowania tego adresu jako tożsamości w SES.

1. Konsola AWS -> Amazon SES, region **Europe (Stockholm) eu-north-1** -> *Account dashboard* -> **Request production access**.
2. Typ poczty: *Transactional* (konta, potwierdzenia) i *Marketing* (rozsyłki). Adres strony: `https://www.pawelperfect.com`.
3. W opisie (po angielsku): kto jest odbiorcą (osoby, które same założyły konto lub zapisały się na powiadomienia, podwójne potwierdzenie przez konto), jak jest wypis (link w stopce + jednokliknięciowy List-Unsubscribe), jak obsługiwane są odbicia i skargi (lista wstrzymań SES, kolejny krok: webhook SNS), przewidywany wolumen (kilkaset do kilku tysięcy miesięcznie).
4. Poczekać na decyzję AWS (zwykle do 24 h). Po zgodzie zapisać nowy dzienny limit i ustawić `EMAIL_DAILY_LIMIT` / `EMAIL_MONTHLY_LIMIT`.
5. Włączyć listę wstrzymań na poziomie konta dla odbić i skarg (SES -> *Suppression list* -> *Account-level settings*: Bounces i Complaints).

## 5. Dane SMTP (kroki właściciela)

1. SES -> *SMTP settings* -> **Create SMTP credentials** (konsola tworzy użytkownika IAM z uprawnieniem `ses:SendRawEmail`; nazwa np. `pp-ses-smtp`).
2. Konsola pokazuje **nazwę użytkownika SMTP i hasło SMTP tylko raz**. Hasło SMTP jest pochodną klucza dostępu liczoną w konsoli: **nie wpisujemy klucza IAM jako hasła** i nie wyliczamy go ręcznie.
3. Zapisać wyłącznie w `/root/.ai-secrets/secrets.env` na serwerku (`SES_SMTP_USER`, `SES_SMTP_PASS`) oraz w plikach env serwera (`app.env`, opcjonalnie `admin.env`). **Nigdy w gicie, na laptopie ani w czacie.**
4. Rotacja: utworzyć nowe dane, podmienić w env, restart, usunąć stare w IAM.

## 6. Procedura testowa

1. Zweryfikować `pawel.perfect@gmail.com` w SES (w sandboxie). Na serwerku, z załadowanym env: `node --env-file=/ścieżka/app.env scripts/ops/send-test-email.mjs` (z `EMAIL_PROVIDER=ses`) albo z innym odbiorcą jako argument. Skrypt odmawia pracy bez danych, nie drukuje sekretów, wypisuje dostawcę, identyfikator wiadomości i polską podpowiedź przy błędzie.
2. W Gmailu: „Pokaż oryginał” i sprawdzić `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`, `Reply-To: support@pawelperfect.com`, brak `List-Unsubscribe` w mailu testowym systemowym.
3. Ustawić `EMAIL_PROVIDER=ses` w `app.env`, restart, wywołać rejestrację konta testowej osoby (zweryfikowany adres) i zobaczyć dostarczenie weryfikacji.
4. Test rozsyłki do siebie z kreatora w panelu (nagłówki List-Unsubscribe obecne).
5. Powrót awaryjny: `EMAIL_PROVIDER=resend` (lub usunięcie zmiennej) i restart. Resend nadal działa, dopóki go nie usuniemy.

### Mapowanie błędów SES

| Odpowiedź SMTP | Nazwa w aplikacji | Zachowanie |
|---|---|---|
| 554 *Email address is not verified* | `message_rejected_not_verified` | odbiorca oznaczony jako nieudany; podpowiedź o sandboxie |
| 554 inne | `message_rejected` | jak wyżej |
| 454 *Throttling failure: Maximum sending rate exceeded* | `rate_limit_exceeded` (429) | kolejka rozsyłek wstrzymuje się na 1 min |
| 454 *Daily message quota exceeded* | `daily_quota_exceeded` (429) | wstrzymanie na 1 h |
| 535 / 530 | `smtp_auth_failed` (401) | wstrzymanie na 1 h (nie psuje odbiorców) |
| 421 / 450 / 451 / 452, błędy sieci | `smtp_temporary_failure` / `smtp_connection_failed` | ponowienie z narastającą przerwą |

Wysyłka systemowa (rejestracja) zapisuje błąd w logu i zgłasza go wywołującemu jak dotąd; hasła i nazwa użytkownika SMTP są wycinane z komunikatów (test `ses-transport.test.ts`).

## 7. Odbicia i skargi: pierwsza iteracja bez webhooka

Decyzja: **bez webhooka SNS na start**. Dla SES polegamy na liście wstrzymań konta SES (punkt 4.5). Webhook Resend (`/api/webhooks/resend`) i jego obsługa bez zmian, aktywne tylko przy `resend`. Panel jest uczciwy: przy `ses` pokazuje „zdarzenia odbić/skarg: nie podłączone”, liczniki zdarzeń (wysłane/doręczone/odbicia) nie są wiarygodne i mają odpowiednią notkę.

**Następny krok, obowiązkowo PRZED wysyłką do prawdziwych subskrybentów:**
1. Utworzyć *configuration set* (np. `pp-default`) z *event destination* typu SNS dla zdarzeń Bounce, Complaint, Delivery (opcjonalnie Reject, Delivery delay), temat SNS w eu-north-1.
2. Nowy endpoint `/api/webhooks/ses` (HTTPS, subskrypcja HTTP/S tematu SNS): obsługa `SubscriptionConfirmation` (potwierdzenie przez `SubscribeURL` tylko dla hosta `sns.eu-north-1.amazonaws.com` po weryfikacji podpisu), weryfikacja **podpisu SNS** (certyfikat z `SigningCertURL` wyłącznie z domeny `sns.<region>.amazonaws.com`, SignatureVersion 1/2, odrzucenie starych wiadomości), idempotencja po `MessageId`, zapis do `EmailEvent` i `EmailSuppression` jak w handlerze Resend (twarde odbicie i skarga blokują adres; tag `app=pawelperfect` z `X-SES-MESSAGE-TAGS`).
3. Ustawić `SES_CONFIGURATION_SET`, pokazać zdarzenia w panelu i usunąć notkę „nie podłączone”.

## 8. Rekordy DNS Resend, które będzie można usunąć PO weryfikacji i teście SES

Nie usuwamy niczego teraz. Dopiero gdy: SES poza sandboxem, test z punktu 6 zaliczony, `EMAIL_PROVIDER=ses` stabilnie działa kilka dni, PP Support przełączony (punkt 9), a watchdog i alerty serwerka nie używają Resend:

- TXT `resend._domainkey.pawelperfect.com` (DKIM Resend)
- MX `send.pawelperfect.com` -> `feedback-smtp.eu-west-1.amazonses.com`
- TXT `send.pawelperfect.com` -> `v=spf1 include:amazonses.com ~all`
- ewentualne inne rekordy Resend widoczne w panelu Resend dla domeny (np. rekord DMARC lub weryfikacyjny dodany przez Resend; sprawdzić w panelu przed usunięciem)

Kopia stanu sprzed: `DNS_BACKUP_mail_2026-10-02.md`.

## 9. Przełączenie PP Support (zrobi koordynator PÓŹNIEJ, za zgodą właściciela)

**Nie zmieniono** `deploy/serwerek/support/docker-compose.yml`. Po weryfikacji SES i zgodzie właściciela w sekcji `environment` usługi aplikacji (obecnie `smtp.resend.com`, `SMTP_USERNAME: resend`) zmienić:

```yaml
SMTP_ADDRESS: email-smtp.eu-north-1.amazonaws.com
SMTP_PORT: "587"
SMTP_USERNAME: ${SES_SMTP_USER}        # nazwa użytkownika SMTP z SES (nie "resend")
SMTP_AUTHENTICATION: login
SMTP_ENABLE_STARTTLS_AUTO: "true"
SMTP_OPENSSL_VERIFY_MODE: peer
# SMTP_DOMAIN i MAILER_SENDER_EMAIL bez zmian (support@pawelperfect.com, domena zweryfikowana w SES)
```

oraz w pliku `.env` PP Support zastąpić hasło (obecnie klucz Resend w zmiennej hasła SMTP) hasłem SMTP z SES. Potem `docker compose up -d` dla usługi aplikacji i test (odpowiedź na wątek, odbiór w Gmailu, nagłówki SPF/DKIM/DMARC PASS). Powrót: przywrócić poprzednie wartości.

## 10. Co zostaje na Resend (na razie)

- `workers/pp-watchdog` (Cloudflare Worker): Worker nie ma SMTP; SES przez HTTPS wymaga kluczy IAM i podpisu SigV4. To osobna decyzja; do tego czasu watchdog wymaga Resend.
- `scripts/serwerek/common.sh` (`send_alert`): ma już przełącznik `ALERT_PROVIDER=ses` w `/etc/serwerek/alert.env` (zmienne `SES_SMTP_USER`, `SES_SMTP_PASS`, opcjonalnie `AWS_REGION`); domyślnie `resend`. Gałąź SES nie była uruchomiona na prawdziwym SES.

## 11. Usunięcie pakietu `resend` (NIE wykonane; osobny końcowy krok)

Właściciel chce to dopiero po tym, jak wszystko działa. Kroki (jeden commit na końcu):
1. `lib/modules/email/infrastructure/resend-email.transport.ts` i `resend-webhook-verifier.ts`, `handle-resend-webhook.use-case.ts`, `app/api/webhooks/resend/route.ts`, `lib/modules/subscriptions/infrastructure/resend-audience.gateway.ts` (wraz z tabelą kolejki `ResendContactRemoval` w osobnej migracji) usunąć lub zastąpić.
2. W `email.transport.ts` usunąć gałąź `sendViaResend`; w `lib/email-config.ts` zostawić tylko `ses`.
3. Usunąć zmienne `RESEND_*` z walidacji, `.env.example`, `scripts/ops/send-test-email.mjs`, kart panelu.
4. `npm uninstall resend`, czysta instalacja `npm ci` i `npx next build`.
5. Usunąć testy Resend, uruchomić pełne `npm run quality`.
6. Dopiero na końcu: klucze Resend, rekordy DNS (punkt 8), webhook i domena w panelu Resend.

## Źródła

- Amazon SES, testowanie połączenia SMTP, porty i `250 Ok <id>`: https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp-client-command-line.html
- Amazon SES, kody odpowiedzi SMTP (554, 454, 535, 421, 450): https://docs.aws.amazon.com/ses/latest/dg/smtp-response-codes.html
- Amazon SES, dane SMTP (tworzone w konsoli, osobne od kluczy dostępu): https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html
- Amazon SES, wyjście z sandboxa: https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
- Amazon SES, nagłówki `X-SES-CONFIGURATION-SET` i `X-SES-MESSAGE-TAGS`: https://docs.aws.amazon.com/ses/latest/dg/event-publishing-send-email.html
- Amazon SES, powiadomienia przez SNS i podpis SNS: https://docs.aws.amazon.com/ses/latest/dg/configure-sns-notifications.html, https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
- Nodemailer, SMTP (`requireTLS`, `pool`, limity czasu): https://nodemailer.com/smtp/ i https://nodemailer.com/smtp/pooled/
- RFC 8058 (jednokliknięciowy List-Unsubscribe): https://www.rfc-editor.org/rfc/rfc8058; wymagania masowych nadawców Gmail/Yahoo: https://support.google.com/a/answer/81126

Uwaga: powyższe adresy i szczegóły sandboxa/limitów pochodzą z dokumentacji AWS; w tej pracy sprawdzono automatycznie tylko strony o połączeniu SMTP i kodach odpowiedzi. Pozostałe punkty (np. dokładne limity sandboxa, ścieżka w konsoli) potwierdź w konsoli AWS przy wykonywaniu kroków.
