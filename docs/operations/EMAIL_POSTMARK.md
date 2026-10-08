# Postmark jako dostawca poczty (zamiast Resend)

Stan: 2026-10-08. Bez sekretów. Część projektu „rozgrzewanie mailingu” ([`MAILING-WARMUP.md`](MAILING-WARMUP.md)). Postmark to dostawca poczty transakcyjnej z osobnymi **strumieniami** (transakcyjny i masowy mają osobne pule i reputację), a to dokładnie nasz podział na `pawelperfect.com` (transakcje) i `news.pawelperfect.com` (newsletter). Kod jest gotowy i **domyślnie wyłączony**: dopóki `EMAIL_PROVIDER` nie ma wartości `postmark`, wszystko idzie przez Resend jak dotąd.

## Jak działa w kodzie

- `EMAIL_PROVIDER=postmark` + `POSTMARK_SERVER_TOKEN` → `sendEmail()` wysyła przez API Postmarka (`POST https://api.postmarkapp.com/email`, bez biblioteki). Bez tokenu albo bez zmiennej zostaje Resend.
- **Strumienie:** poczta transakcyjna idzie do strumienia `outbound` (domyślny w Postmarku), masowa (broadcasty, `stream: "news"`) do strumienia `broadcast` (trzeba go utworzyć w panelu Postmarka: *Message Streams → Add*, typ **Broadcast**). Nazwy można zmienić zmiennymi `POSTMARK_STREAM_TX` i `POSTMARK_STREAM_NEWS`.
- **Awaryjnie Resend:** gdy Postmark nie może wysłać (awaria 5xx, odrzucony token, **konto jeszcze w trybie testowym**, kod błędu 10 lub 412), ten sam mail idzie przez Resend. Błędy adresata (zły albo zawieszony adres, kod 300/406) są ostateczne i bez ponawiania. Wymaga `RESEND_API_KEY`.
- Bez śledzenia otwarć i linków (`TrackOpens=false`, `TrackLinks=None`), tak jak w Resend. Nagłówek `Feedback-ID` jest pomijany (Postmark ma własny).
- **Webhook** `POST /api/webhooks/postmark`: dostarczenie, odbicia i skargi na spam trafiają do tego samego use case'u co z Resend (status odbiorcy, zawieszanie adresów po twardym odbiciu i skardze, blokada idempotencji). Postmark nie podpisuje żądań, więc adres webhooka ma **dane Basic** (`POSTMARK_WEBHOOK_USER` i `POSTMARK_WEBHOOK_PASSWORD`), sprawdzane w stałym czasie. Za twarde uznajemy tylko odbicie, które sam Postmark dezaktywował (`Inactive: true`); reszta nigdy nie zawiesza adresu.

## Zmienne środowiskowe (`app.env`, bez wartości w repo)

| Zmienna | Rola |
|---|---|
| `EMAIL_PROVIDER` | `postmark` włącza Postmark; puste albo `resend` = Resend |
| `POSTMARK_SERVER_TOKEN` | Server API token serwera „www.pawelperfect.com” w Postmarku |
| `POSTMARK_STREAM_TX`, `POSTMARK_STREAM_NEWS` | opcjonalnie: ID strumieni (domyślnie `outbound` i `broadcast`) |
| `POSTMARK_WEBHOOK_USER`, `POSTMARK_WEBHOOK_PASSWORD` | dane Basic webhooka (długie, losowe) |

Tokenu **nie wklejamy do czatu ani do repo**: wpisuje się go na serwerku poleceniem, które nie pokazuje wartości (patrz niżej).

## Uruchomienie krok po kroku

**1. Domena w Postmarku (właściciel, w panelu Postmarka).** *Sender Signatures → Add Domain* → `pawelperfect.com`. Postmark pokaże dwa rekordy:
- **DKIM** (TXT, nazwa w stylu `2026….pm._domainkey`),
- **Return-Path** (CNAME `pm-bounces` → `pm.mtasv.net`; zalecany, daje dopasowanie SPF dla DMARC).

Te rekordy dopiszemy w Cloudflare (nie koliduje z Resend: inny selektor DKIM i inna nazwa Return-Path). Wartości przekaż do czatu (to rekordy publiczne, nie sekrety).

**2. Zatwierdzenie konta (właściciel).** Nowe konto jest w **trybie testowym**: wysyła tylko do adresów na domenie nadawcy (inaczej błąd 412). *Request approval* → formularz o wolumenie i zastosowaniu; przegląd trwa zwykle poniżej doby roboczej. Gotowy tekst (po angielsku):

> We run a small non-commercial video site (www.pawelperfect.com). We send transactional email only: account verification, password reset, password-changed and tip-confirmation messages, plus a welcome message after sign-up. Recipients are people who created an account on the site themselves (verified e-mail). Volume is low (under 500 messages a month now, growing). A separate broadcast stream is used only for subscribers who opted in to new-video notifications, each message with one-click unsubscribe. We process bounces and spam complaints through webhooks and suppress those addresses.

Do czasu zatwierdzenia można testować wysyłkę do adresów `@pawelperfect.com` i na `test@blackhole.postmarkapp.com`.

**3. Strumień masowy.** *Message Streams → Add a Message Stream* → typ **Broadcast**, ID `broadcast`. Domena `news.pawelperfect.com` (nadawca newslettera) to osobna domena w Postmarku z własnym DKIM (kolejny krok, po tym jak transakcje zadziałają).

**4. Webhook.** *Message Streams → (strumień) → Webhooks → Add webhook*: adres `https://<użytkownik>:<hasło>@www.pawelperfect.com/api/webhooks/postmark`, zdarzenia **Delivery, Bounce, Spam Complaint**. Użytkownika i hasło ustawiamy najpierw w `app.env`.

**5. Token na serwerku (bez pokazywania go nigdzie).** Na serwerku (`ssh serwerek`), jako root:

```bash
cd /opt/serwerek/apps/polutek && cp -p app.env app.env.bak-pre-postmark
read -rsp "POSTMARK_SERVER_TOKEN: " T; echo
printf '\nPOSTMARK_SERVER_TOKEN=%s\n' "$T" >> app.env; unset T
```

Zmienne `EMAIL_PROVIDER=postmark`, `POSTMARK_WEBHOOK_USER` i `POSTMARK_WEBHOOK_PASSWORD` dopisujemy w ten sam sposób, a kontener `app` odtwarzamy na tym samym obrazie. Wdrożenie kodu i przełączenie to zmiana na produkcji, więc tylko na wyraźną zgodę właściciela.

**5b. Polityka prywatności (przed przełączeniem na stałe).** Postmark będzie odbiorcą danych (adres e-mail i treść maili). Zgodnie z regułą z CLAUDE.md §4.12/§4.18 trzeba w **tym samym PR**, który przełącza dostawcę, dopisać go do listy odbiorców w `LegalDocs.tsx` (PL i EN), zaktualizować `tests/unit/legal-docs-consistency.test.ts` i podnieść `LEGAL_DOCUMENTS_VERSION`. Na etapie testów do skrzynek własnych i testowych właściciela nie jest to potrzebne.

**6. Test przed przełączeniem.** Najpierw jeden mail testowy przez Postmark do skrzynek `@pawelperfect.com`; po zatwierdzeniu konta do skrzynek testowych (Gmail, Proton, świeży Outlook). Porównanie nagłówków (SCL) z Resend i serwerkiem: wyniki do tabeli w [`MAIL-LAB.md`](MAIL-LAB.md).

## Cofnięcie

Usunięcie `EMAIL_PROVIDER` (albo wartość `resend`) z `app.env` i odtworzenie kontenera `app`: całość wraca na Resend, bez zmian w kodzie. Webhook Postmarka można wyłączyć w jego panelu.

## Czego nie wiemy (sprawdzić w praktyce)

- Postmark chwali się wysoką dostarczalnością, ale **nie ma niezależnego, kontrolowanego testu** dla nowej domeny na Outlooku (źródła to blogi i testy konkurentów). Nasze dane z 2026-10-07 pokazują, że Outlook oceniał Resend i własny serwer tak samo (SCL 5), więc głównym czynnikiem jest wiek domeny (zarejestrowana 2026-09-30) i treść, nie dostawca. Dlatego wynik trzeba **zmierzyć** tym samym testem (świeża skrzynka Outlook, nagłówki).
- Cennik (aktualny do sprawdzenia na postmarkapp.com/pricing): plan darmowy to 100 maili miesięcznie bez nadwyżek (po 100 wysyłka staje), Basic ok. 15 USD za 10 tys. Przy dzisiejszym wolumenie (kilkadziesiąt maili miesięcznie) plan darmowy wystarczy na eksperyment; przy newsletterze trzeba będzie płacić. Płatności tylko za zgodą właściciela.
