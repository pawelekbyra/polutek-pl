# Amazon SES jako główny dostawca poczty

Stan: 2026-10-11. Bez sekretów. Część projektu „rozgrzewanie mailingu” ([`MAILING-WARMUP.md`](MAILING-WARMUP.md)). Przełączenie na pełno (decyzja właściciela 2026-10-11): strona nie ma jeszcze użytkowników, poczty jest mało, a wcześniejsi dostawcy (Resend, Postmark, własny serwer) kończyli u Hotmaila w spamie.

## Jak działa w kodzie

- `EMAIL_PROVIDER=ses` + `SES_SMTP_USER` i `SES_SMTP_PASS` → `sendEmail()` wysyła przez SMTP SES (`email-smtp.eu-north-1.amazonaws.com:587`, STARTTLS, biblioteka `nodemailer`, bez AWS SDK). Kod: `lib/modules/email/infrastructure/ses-email.transport.ts`. Bez poświadczeń albo bez zmiennej zostaje Resend.
- **Awaryjnie Resend:** gdy SES nie może wysłać (awaria, przepustowość, dzienny limit, konto w piaskownicy, odrzucone poświadczenia), ten sam mail idzie przez Resend. Błędy adresata (zły adres, kod 501/553) są ostateczne. Wymaga `RESEND_API_KEY`.
- Każdy mail dostaje znaczniki SES (`X-SES-MESSAGE-TAGS`: `app=pawelperfect, kind=<rodzaj>, stream=tx|news`) i, jeśli ustawiono `SES_CONFIGURATION_SET`, nagłówek zestawu konfiguracji. Nagłówki `List-Unsubscribe`, `Feedback-ID`, `Auto-Submitted` zostają.
- Własny tor (`EMAIL_OWN_*`, [`MAIL-OWN-TRANSPORT.md`](MAIL-OWN-TRANSPORT.md)) jest wyłączony (`EMAIL_OWN_SHARE=0`), żeby testy dostarczalności mierzyły samo SES. Kod zostaje.

## Konto AWS

- Region: **Europa (Sztokholm), `eu-north-1`**. Domena `pawelperfect.com` zweryfikowana z DKIM i własnym MAIL FROM (potwierdzenia z 2026-10-06). Piaskownica zdjęta 2026-10-11 (sprawa AWS 179128326000153): **50 000 maili dziennie, 14 na sekundę**. Ustawienia i limity są **per region**: inny region wymaga osobnej weryfikacji domeny i osobnego wniosku.
- Cennik: 0,10 USD za 1000 maili (stara stawka) lub 0,16 USD za 1000 na planie Essentials (nowe konta od 21.07.2026); bez opłaty stałej. Sprawdź w konsoli, który plan ma konto.
- Konto ma domyślnie **listę zawieszeń na poziomie konta** (odbite i zgłoszone jako spam adresy są pomijane przez SES).
- Pilnuj jakości: AWS wszczyna kontrolę konta przy ok. 5% odbić albo 0,1% skarg i zawiesza je przy ok. 10% i 0,5% (progi z dokumentacji AWS, do weryfikacji).

## Zmienne środowiskowe (`app.env`)

| Zmienna | Rola |
|---|---|
| `EMAIL_PROVIDER` | `ses` włącza SES; puste albo `resend` = Resend |
| `SES_SMTP_USER`, `SES_SMTP_PASS` | poświadczenia SMTP SES (sekrety, na serwerku w `app.env` i `/root/.ai-secrets/secrets.env`) |
| `SES_SMTP_HOST`, `SES_SMTP_PORT` | opcjonalnie; domyślnie punkt końcowy Sztokholmu i 587 |
| `SES_CONFIGURATION_SET` | opcjonalnie; nazwa zestawu konfiguracji (zdarzenia SES → SNS) |
| `EMAIL_FROM` | `Pawel Perfect <no-reply@pawelperfect.com>` (nazwa nadawcy normalnymi literami: wersja „PAWELPERFECT.COM” wielkimi literami to klasyczny sygnał spamu, Hotmail wysyłał takie maile do Junka) |

## Czego jeszcze nie ma

- **Zdarzenia odbić i skarg w aplikacji.** SES publikuje je przez SNS (zestaw konfiguracji → temat SNS → HTTPS), a trasa przyjmująca je (z weryfikacją podpisu SNS) nie istnieje. Do czasu jej dodania odbite adresy chroni tylko lista zawieszeń konta SES, a `EmailSuppression` w naszej bazie o nich nie wie.

## Test dostarczalności

1. Mail do skrzynki, którą da się odczytać w całości: w nagłówkach (`Authentication-Results`) mają być `spf=pass`, `dkim=pass`, `dmarc=pass`.
2. Maile do świeżych skrzynek u odbiorców problematycznych (Outlook/Hotmail, Gmail, Yahoo, WP, O2): sprawdzić, czy trafiają do skrzynki odbiorczej, czy do spamu. Skrzynki testowe, które już widziały nasze wcześniejsze maile, nie nadają się (są oznaczone).
3. Wyniki zapisać w [`MAIL-LAB.md`](MAIL-LAB.md).

## Wyniki testów 2026-10-11 (po przełączeniu)

Mail przez prawdziwą ścieżkę produkcyjną (`sendEmail()` z środowiskiem produkcji):

- **Gmail** (`pawel.perfect@gmail.com`): skrzynka odbiorcza (kategoria Aktualizacje), nie spam. Nagłówki: `spf=pass` (ścieżka zwrotna `bounce.pawelperfect.com`), `dkim=pass` (podpis domeny `pawelperfect.com`, zgodny z nadawcą, i drugi z `amazonses.com`), `dmarc=pass` (rekord DMARC ma dziś `p=none`).
- **Newsletter** (nadawca `newsletter@news.pawelperfect.com`, z `List-Unsubscribe`): SES przyjmuje poddomenę, Gmail: skrzynka odbiorcza.
- **mail-tester.com: 9,1/10.** W pełni uwierzytelniony, adres IP wysyłki na białej liście Mailspike, bez czarnych list i błędnych linków. **Jedyna kara: `FROM_FMBLA_NEWDOM14`, „domena nadawcy zarejestrowana w ostatnich 7–14 dniach”.**

**Wniosek:** dostarczalność u Hotmaila (Microsoft) najpewniej psuł nie dostawca, tylko **wiek domeny** (u wszystkich trzech dostawców wynik był ten sam) oraz wcześniej nazwa nadawcy wielkimi literami („PAWELPERFECT.COM”). Wiek domeny mija z czasem i z historią dobrej wysyłki; żaden dostawca tego nie obejdzie. Czego nie wiemy: faktycznego umieszczenia w skrzynce Outlooka/Hotmaila (do sprawdzenia na świeżych skrzynkach, patrz wyżej).

Uwaga: SES nadpisuje nagłówek `Feedback-ID` własnym (`...:AmazonSES`), więc nasz podział na rodzaje maili w Gmail Postmaster Tools nie obowiązuje; do podziału służą znaczniki SES (`X-SES-MESSAGE-TAGS`).

## Cofnięcie

Usunięcie `EMAIL_PROVIDER` (albo wartość `resend`) z `app.env` i odtworzenie kontenera `app`: całość wraca na Resend, bez zmian w kodzie. Poprzednia wartość `EMAIL_FROM` jest w kopii `app.env.bak-pre-ses-*` na serwerku.
