# Poczta wychodząca: Amazon SES (region eu-north-1, Sztokholm)

Stan: **Resend usunięty z kodu, Amazon SES jest jedynym transportem** (gałąź `feat/email-ses`, jeszcze niezmergowana i niewdrożona). Bez sekretów w tym pliku.

## UWAGA: sandbox SES (konsekwencja, którą trzeba znać)

Dopóki AWS nie przyzna **dostępu produkcyjnego**, konto SES jest w sandboxie: **poczta dochodzi tylko do zweryfikowanych adresów** (tożsamości w SES), limit ok. **200 wiadomości na dobę, 1 na sekundę**. Po wdrożeniu tej gałęzi bez dostępu produkcyjnego:

- mail weryfikacyjny, reset hasła, potwierdzenia i rozsyłki do **dowolnego niezweryfikowanego adresu zostaną odrzucone przez SES** (SMTP 554 "Email address is not verified"),
- aplikacja **nie wywala się**: błąd wysyłki jest logowany (`[email] Provider failed to send "<szablon>" email`, `[auth-email] ... failed`) z polską podpowiedzią o sandboxie, rejestracja i reset hasła kończą się normalnie (użytkownik zobaczy ekran „sprawdź skrzynkę”, ale maila nie dostanie), usuwanie konta, płatności i panel działają, rozsyłka oznacza takiego odbiorcę jako nieudanego, a „Wyślij test do siebie” pokazuje adminowi komunikat z podpowiedzią,
- **nie wdrażaj na produkcję przed zgodą AWS**, chyba że świadomie akceptujesz, że nowi użytkownicy nie dostaną maila weryfikacyjnego. Do testów zweryfikuj w SES swój adres.

## 1. Architektura

- Jedno miejsce wysyłki: `sendEmail()` w `lib/modules/email/infrastructure/email.transport.ts` (dokument HTML, wersja tekstowa, nadawca, Reply-To, nagłówki) -> `ses-email.transport.ts` (SMTP przez `nodemailer`). Publiczne funkcje wysyłające (`sendVerificationEmail`, rozsyłki, `sendOperatorEmail` itd.) bez zmian.
- Konfiguracja nadawców, danych SES, SNS i limitów w jednym module: `lib/email-config.ts`. Nie ma przełącznika dostawcy.
- Połączenie: host `email-smtp.<AWS_REGION>.amazonaws.com` (domyślnie eu-north-1), port **587**, STARTTLS wymagany (`requireTLS`), pula 3 połączeń, limity czasu 10/10/30 s. Port 465 i 25 nie są używane (Hetzner blokuje 25 i 465 wychodzące).
- Brak `SES_SMTP_USER` / `SES_SMTP_PASS`: wysyłka kończy się jasnym błędem `smtp_credentials_missing` (nic nie jest wysyłane); produkcja nie wystartuje bez nich (walidacja env).
- Identyfikator wiadomości z odpowiedzi SES (`250 Ok <id>`) jest zapisywany przy odbiorcy rozsyłki (kolumna `BroadcastEmailRecipient.resendEmailId`, nazwa historyczna) i służy do dopasowania zdarzeń SNS.
- SES nie ma klucza idempotencji: awaria między przyjęciem wiadomości a zapisem w bazie może wysłać jednemu odbiorcy rozsyłki mail dwukrotnie (okno milisekund).

### Nadawcy

| Rodzaj poczty | Zmienna | Domyślnie |
|---|---|---|
| systemowa i konta (rejestracja, hasło, potwierdzenia, rozsyłki) | `EMAIL_FROM` | `Pawel Perfect <no-reply@pawelperfect.com>` |
| odpowiedzi | `EMAIL_REPLY_TO` | `support@pawelperfect.com` |
| poczta z pracy supportu (`sender: 'support'`) | `EMAIL_SUPPORT_FROM` | `Pawel Perfect <support@pawelperfect.com>` |

`List-Unsubscribe` i `List-Unsubscribe-Post` (RFC 8058) dostają **tylko rozsyłki i powitalny mail z wypisem**, nigdy poczta systemowa i konta.

### Subskrybenci

Źródłem prawdy są `EmailPreference` i `EmailSuppression`. Zapis, wypis, usuwanie konta nie wywołują żadnej zewnętrznej listy (po Resend nie ma Audience). Tabela `ResendContactRemoval` i kolumny `resend*` zostają w schemacie, nieużywane (do późniejszej migracji sprzątającej, bez niszczących zmian teraz).

## 2. Zmienne środowiskowe

| Zmienna | Znaczenie |
|---|---|
| `SES_SMTP_USER`, `SES_SMTP_PASS` | dane SMTP z konsoli SES (nie klucze IAM). **Wymagane na produkcji.** |
| `EMAIL_FROM` (wymagane), `EMAIL_REPLY_TO`, `EMAIL_SUPPORT_FROM` | nadawcy |
| `AWS_REGION` | domyślnie `eu-north-1` |
| `SES_SMTP_HOST` | opcjonalne nadpisanie hosta |
| `SES_CONFIGURATION_SET` | np. `pawelperfect-default`: dodaje nagłówki `X-SES-CONFIGURATION-SET` i `X-SES-MESSAGE-TAGS` |
| `SES_SNS_TOPIC_ARN` | lista dozwolonych tematów SNS (po przecinku). **Pusta = endpoint `/api/webhooks/ses` odrzuca wszystko (503).** |
| `SES_SNS_REGIONS` | opcjonalnie dodatkowe regiony hostów certyfikatu SNS (domyślnie `AWS_REGION`) |
| `EMAIL_DAILY_LIMIT`, `EMAIL_MONTHLY_LIMIT` | limity pokazywane w panelu (domyślnie sandbox 200/6000) |

Ustawia się je w `app.env` na serwerku (strona) i, tylko `SES_SMTP_*` + `EMAIL_FROM` do „Wyślij test do siebie”, w `admin.env`. Po zmianie restart kontenera. Nigdy w gicie. Usunięte zmienne (nic już ich nie czyta): `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `RESEND_AUDIENCE_ID`, `RESEND_DAILY_LIMIT`, `RESEND_MONTHLY_LIMIT`, `EMAIL_PROVIDER`.

## 3. Rekordy DNS już w Cloudflare (nie zmieniano)

- DKIM SES: trzy CNAME `<token>._domainkey.pawelperfect.com` -> `<token>.dkim.amazonses.com`.
- MAIL FROM `bounce.pawelperfect.com`: MX `10 feedback-smtp.eu-north-1.amazonses.com` i TXT SPF `v=spf1 include:amazonses.com ~all`.
- Tożsamość domeny `pawelperfect.com` w SES (eu-north-1). DMARC i poczta przychodząca (Cloudflare Email Routing) bez zmian.

## 4. Dostęp produkcyjny (kroki właściciela)

1. Konsola AWS -> Amazon SES, region **Europe (Stockholm) eu-north-1** -> *Account dashboard* -> **Request production access**.
2. Typ poczty: Transactional i Marketing; strona `https://www.pawelperfect.com`.
3. Opis (po angielsku): odbiorcy sami zakładają konto lub zapisują się na powiadomienia; wypis przez link w stopce i jednokliknięciowy List-Unsubscribe; odbicia i skargi obsługiwane automatycznie (SNS -> endpoint, adres trafia na listę blokad, skarga cofa zgodę); wolumen kilkaset do kilku tysięcy miesięcznie.
4. Po zgodzie ustaw `EMAIL_DAILY_LIMIT` / `EMAIL_MONTHLY_LIMIT` zgodnie z nowym limitem.
5. SES -> *Suppression list* -> *Account-level settings*: włącz **Bounces** i **Complaints**.

## 5. Dane SMTP (kroki właściciela)

1. SES -> *SMTP settings* -> **Create SMTP credentials** (użytkownik IAM z `ses:SendRawEmail`, np. `pp-ses-smtp`).
2. Nazwa i hasło SMTP pokazane **tylko raz**. Hasło SMTP jest pochodną klucza liczoną w konsoli: nie wpisuj klucza IAM jako hasła.
3. Zapisz wyłącznie w `/root/.ai-secrets/secrets.env` na serwerku (`SES_SMTP_USER`, `SES_SMTP_PASS`), w `app.env` (opcjonalnie `admin.env`) i w `/etc/serwerek/alert.env` (alerty serwerka). Nigdy w gicie ani w czacie.
4. Rotacja: nowe dane, podmiana w env, restart, usunięcie starych w IAM.

## 6. Zdarzenia odbić i skarg przez SNS (kroki właściciela w konsoli AWS)

Endpoint: `POST https://www.pawelperfect.com/api/webhooks/ses` (publiczny, bez sesji; chroniony weryfikacją podpisu).

1. **SNS** (region eu-north-1) -> Topics -> Create topic -> typ **Standard**, nazwa `ses-events`. Skopiuj ARN (np. `arn:aws:sns:eu-north-1:<konto>:ses-events`).
2. **SES** -> *Configuration sets* -> Create set, nazwa `pawelperfect-default`. W nim *Event destinations* -> Add destination -> typ **Amazon SNS**, temat `ses-events`, zdarzenia: **Bounce, Complaint, Delivery, Reject, Delivery delay** (Send opcjonalnie).
3. W `app.env` ustaw `SES_CONFIGURATION_SET=pawelperfect-default` i `SES_SNS_TOPIC_ARN=<ARN z kroku 1>`, **zrestartuj** stronę (to musi być przed krokiem 4: bez `SES_SNS_TOPIC_ARN` endpoint odrzuca potwierdzenie subskrypcji).
4. SNS -> temat `ses-events` -> Create subscription: protokół **HTTPS**, endpoint `https://www.pawelperfect.com/api/webhooks/ses`. Nasz endpoint **sam potwierdza** subskrypcję (po weryfikacji podpisu i hosta `SubscribeURL`); status w konsoli zmieni się na *Confirmed*. W logach strony: `[ses-events] Subscription confirmed for topic ...`. Jeśli *Pending*: sprawdź `SES_SNS_TOPIC_ARN` (ten sam ARN) i logi `[ses-events] Rejected: ...`.
5. Włącz listę blokad konta (punkt 4.5).
6. Test symulatorem SES (nadawca musi być zweryfikowany; nie wpływa na reputację): wyślij z aplikacji lub `scripts/ops/send-test-email.mjs <adres>` na
   - `success@simulator.amazonses.com` -> zdarzenie *Delivery* (`email.delivered`),
   - `bounce@simulator.amazonses.com` -> twarde odbicie: w panelu *Komunikacja -> Blokady* pojawia się adres, licznik odbić rośnie,
   - `complaint@simulator.amazonses.com` -> skarga: adres zablokowany, zgoda na powiadomienia cofnięta.
   
   Zdarzenia dochodzą po kilku sekundach. W panelu *Komunikacja* karta limitów przestaje pokazywać „nie podłączone” po pierwszym zdarzeniu; w *Ustawienia -> Integracje* karta „Amazon SES” pokazuje „zdarzenia odbić/skarg: podłączone (SNS)”. W logach: `[ses-events] Suppression recorded`. Odrzucenia: `[ses-events] Rejected: <powód>` (np. `topic_not_allowed`, `signature_mismatch`, `cert_url_not_allowed`).

### Jak endpoint chroni się przed podróbkami

Każda wiadomość: ciało maks. 256 KB, limit żądań na IP; sprawdzany jest podpis (SignatureVersion 1 = RSA-SHA1, 2 = RSA-SHA256; łańcuch do podpisu zgodny z dokumentacją AWS osobno dla Notification, SubscriptionConfirmation i UnsubscribeConfirmation); `SigningCertURL` musi być `https://sns.<region>.amazonaws.com/SimpleNotificationService-<id>.pem` (ścisły host, bez portu i danych logowania; region `eu-north-1` + `SES_SNS_REGIONS`), certyfikat jest pobierany z limitem czasu i rozmiaru, buforowany godzinę i sprawdzany pod kątem ważności; `TopicArn` musi być na liście `SES_SNS_TOPIC_ARN` (brak listy = odmowa); znacznik czasu nie starszy niż 14 dni (SNS ponawia przez wiele dni) i nie z przyszłości. `SubscribeURL` jest potwierdzany GET-em tylko po weryfikacji i na tym samym ścisłym hoście. Nic nie jest wykonywane dla niepodpisanych lub błędnych wiadomości.

### Co robi zdarzenie

| Zdarzenie | Skutek |
|---|---|
| Bounce Permanent | adres do `EmailSuppression` (powód BOUNCE, źródło `SES_SNS`), odbiorca rozsyłki -> BOUNCED |
| Bounce Transient / Undetermined, DeliveryDelay | tylko zapis zdarzenia |
| Complaint | adres do `EmailSuppression` (COMPLAINT), cofnięcie zgody na powiadomienia (jak link wypisu: subskrypcja, preferencje), odbiorca -> COMPLAINED |
| Delivery | zapis, odbiorca -> DELIVERED |
| Reject | odbiorca -> FAILED |
| Send, Open, Click, inne | Send zapisuje wysłanie; reszta ignorowana (200) |

Obsługiwane są oba formaty: publikowanie zdarzeń (`eventType`, konfiguracja set -> SNS) i zwykłe powiadomienia tożsamości (`notificationType`). Idempotencja po `MessageId` SNS (`EmailEvent.providerEventId`), status odbiorcy tylko do przodu (spóźniony Delivery nie cofa odbicia). Błąd bazy lub blokady zwraca 5xx, więc SNS ponawia; nieznane typy zwracają 200 i są logowane. Mail innego nadawcy z tym samym kontem (tag `app` inny niż `pawelperfect`) jest ignorowany.

## 7. Test wysyłki

1. W sandboxie zweryfikuj swój adres w SES. Na serwerku: `node --env-file=<app.env> scripts/ops/send-test-email.mjs [adres]` (domyślnie `pawel.perfect@gmail.com`). Skrypt odmawia bez danych, nie drukuje sekretów, pokazuje identyfikator wiadomości i polską podpowiedź przy błędzie.
2. W Gmailu „Pokaż oryginał”: `SPF`, `DKIM`, `DMARC` = PASS, `Reply-To: support@pawelperfect.com`.
3. Test rozsyłki do siebie z kreatora w panelu (nagłówki List-Unsubscribe obecne).

### Mapowanie błędów SES

| Odpowiedź SMTP | Nazwa | Zachowanie |
|---|---|---|
| 554 *Email address is not verified* | `message_rejected_not_verified` | odbiorca nieudany; podpowiedź o sandboxie |
| 554 inne | `message_rejected` | jak wyżej |
| 454 *Maximum sending rate exceeded* | `rate_limit_exceeded` | kolejka rozsyłek pauzuje 1 min |
| 454 *Daily message quota exceeded* | `daily_quota_exceeded` | pauza 1 h |
| 535 / 530 | `smtp_auth_failed` | pauza 1 h (nie psuje odbiorców) |
| 421 / 450 / 451 / 452, sieć | `smtp_temporary_failure` / `smtp_connection_failed` | ponowienia z narastającą przerwą |

## 8. Alerty serwerka i watchdog

- **Alerty serwerka** (`scripts/serwerek/common.sh`, `send_alert`): przez SES SMTP z `python3` (`smtplib`, bez Node), dane z `/etc/serwerek/alert.env`: `SES_SMTP_USER`, `SES_SMTP_PASS`, `ALERT_TO`, `ALERT_FROM` (adres `@pawelperfect.com`), opcjonalnie `AWS_REGION`. Stary `RESEND_API_KEY` w tym pliku można usunąć. W sandboxie `ALERT_TO` musi być zweryfikowany w SES. Ten skrypt nie był uruchomiony na prawdziwym SES.
- **`workers/pp-watchdog`** (Cloudflare Worker): Worker nie umie SMTP, a właściciel ma tylko dane SMTP SES, więc wybrano najprostszą trwałą opcję: darmowy binding **Email Workers `send_email`** ograniczony do jednego zweryfikowanego adresu docelowego (skrzynka właściciela, np. `pawel.perfect@gmail.com`; domena ma Email Routing). Kod nie ma już żadnego klucza dostawcy. Nie wdrożono ani nie zmieniono nic w Cloudflare. Kroki właściciela/koordynatora:
  1. Cloudflare -> domena `pawelperfect.com` -> Email -> Email Routing -> *Destination addresses*: adres `pawel.perfect@gmail.com` musi być **Verified** (jeśli nie ma, dodaj i potwierdź linkiem z maila).
  2. Wdrożenie Workera (za zgodą): `WATCHDOG_ALERT_TO=pawel.perfect@gmail.com node workers/pp-watchdog/deploy.mjs` ze zmiennymi `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `WATCHDOG_PING_TOKEN` (nowa wersja dodaje binding `ALERT_EMAIL` typu `send_email` z `destination_address`; token API musi mieć prawo edycji Workers).
  3. Test: `POST /test-alert` z tokenem (szczegóły w SERWEREK.md §25); mail przychodzi od `pp-watchdog@pawelperfect.com`. Jeśli binding zostanie odrzucony przez Cloudflare, awaryjnie alerty Workera są wyłączone (reszta strażnika działa: sprawdzenia, heartbeat, stan w D1), a sygnał o awarii serwera dociera i tak przez `send_alert`.
  4. Usuń z Workera stary sekret `RESEND_API_KEY` (Cloudflare -> Workers -> pp-watchdog -> Settings -> Variables), po udanym teście.
  Nie testowano tego w Cloudflare (tylko budowanie wiadomości w testach jednostkowych).

## 9. PP Support (zmiana później, koordynator, za zgodą właściciela)

**Nie zmieniono** `deploy/serwerek/support/docker-compose.yml`. PP Support nadal korzysta z Resend SMTP, więc konto Resend i jego klucz `pp-support-smtp` muszą zostać, dopóki to nie zostanie przełączone. Zmiana w `environment`:

```yaml
SMTP_ADDRESS: email-smtp.eu-north-1.amazonaws.com
SMTP_PORT: "587"
SMTP_USERNAME: ${SES_SMTP_USER}        # nazwa użytkownika SMTP z SES (zamiast "resend")
SMTP_AUTHENTICATION: login
SMTP_ENABLE_STARTTLS_AUTO: "true"
SMTP_OPENSSL_VERIFY_MODE: peer
# SMTP_DOMAIN, MAILER_SENDER_EMAIL: bez zmian
```

oraz w `.env` PP Support: `SMTP_PASSWORD` = hasło SMTP z SES (zamiast klucza Resend); ustawienia kanału skrzynki w panelu PP Support też mają hasło SMTP (zmienić tam). Potem `docker compose up -d`, test odpowiedzi na wątek (SPF/DKIM/DMARC PASS). Powrót: stare wartości. W sandboxie odpowiedzi trafią tylko do zweryfikowanych adresów.

## 10. Rekordy DNS Resend do usunięcia PO teście SES (nic nie usuwamy teraz)

Usuń dopiero gdy: SES poza sandboxem, test z punktów 6 i 7 zaliczony, PP Support przełączony (punkt 9), watchdog przełączony (punkt 8). Nazwy z kopii `DNS_BACKUP_mail_2026-10-02.md` (sprawdź w Cloudflare po nazwie przed usunięciem; nie dotykaj rekordów SES ani `bounce.`):

- TXT `resend._domainkey.pawelperfect.com` (DKIM Resend)
- MX `send.pawelperfect.com` -> `feedback-smtp.eu-west-1.amazonses.com`
- TXT `send.pawelperfect.com` -> `v=spf1 include:amazonses.com ~all`
- ewentualny CNAME/TXT z nazwą zawierającą `resend` lub `rsend` (jeśli należy do Resend: sprawdź w panelu Resend, zakładka domeny)
- To samo dla domeny `pawelperfect.pl`, jeśli ma rekordy Resend.

Dalej: usunąć klucze API Resend, webhook Resend i domenę w panelu Resend; unieważnić stare `RESEND_*` w `/root/.ai-secrets` i `app.env`.

## Źródła

- SES, połączenie SMTP, porty, `250 Ok <id>`: https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp-client-command-line.html
- SES, kody odpowiedzi SMTP: https://docs.aws.amazon.com/ses/latest/dg/smtp-response-codes.html
- SES, dane SMTP: https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html
- SES, wyjście z sandboxa: https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html
- SES, nagłówki konfiguracji i tagów: https://docs.aws.amazon.com/ses/latest/dg/event-publishing-send-email.html
- SES, symulator skrzynki: https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html (sekcja o adresach symulatora)
- SES, format zdarzeń (Bounce, Complaint, Delivery): https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html
- SNS, weryfikacja podpisu wiadomości HTTP(S): https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html
- Nodemailer, SMTP: https://nodemailer.com/smtp/ i https://nodemailer.com/smtp/pooled/
- Cloudflare Email Workers, `send_email`: https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/
- RFC 8058: https://www.rfc-editor.org/rfc/rfc8058

Uwaga: w tej pracy automatycznie sprawdzono tylko strony o połączeniu SMTP i kodach odpowiedzi; pozostałe szczegóły (dokładne limity sandboxa, ścieżki w konsoli, zachowanie bindingu `send_email`) pochodzą z wiedzy własnej i trzeba je potwierdzić przy wykonywaniu kroków. Nic nie zostało uruchomione na prawdziwym AWS ani Cloudflare.
