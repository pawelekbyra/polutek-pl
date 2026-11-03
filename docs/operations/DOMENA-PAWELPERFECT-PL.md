# Domena pawelperfect.pl

Stan zweryfikowany (Cloudflare API tylko do odczytu, DNS publiczny, WHOIS): **2026-11-03**. Dokument odtworzony tego dnia (poprzednia wersja zginęła przy synchronizacji docs przez `deploy.sh`).
**Skrót: strefa Cloudflare jest przygotowana (`pending`), ale domena nadal używa nameserverów home.pl, więc przekierowanie na `.com` i poczta jeszcze NIE działają.**

## Stan faktyczny

| Pozycja | Wartość |
|---|---|
| Rejestrator | home.pl (rejestracja 2026-11-03 ok. 17:13, odnowienie 2027-11-03; do sprawdzenia: autoodnawianie w panelu home.pl) |
| Nameservery u rejestratora (publiczne) | `dns.home.pl`, `dns2.home.pl`, `dns3.home.pl` (bez zmian) |
| Strefa w naszym Cloudflare | `pawelperfect.pl`, id `940b57b0…`, status **`pending`**, przypisane NS Cloudflare: `magdalena.ns.cloudflare.com`, `robert.ns.cloudflare.com` (te same co strefa `pawelperfect.com`) |
| Publiczny DNS dziś | brak rekordów A i MX (odpowiada home.pl pusty), więc `pawelperfect.pl` nie otwiera strony ani nie odbiera poczty |
| SSL strefy / HTTPS | tryb `full`, „Always use HTTPS” **wyłączone**, min. TLS 1.0 (domyślne ustawienia nowej strefy; do zaostrzenia po aktywacji) |

**Co zostaje do zrobienia (właściciel, w panelu home.pl):** po zakończeniu rejestracji zmienić nameservery domeny `pawelperfect.pl` na `magdalena.ns.cloudflare.com` i `robert.ns.cloudflare.com`. Cloudflare sam wykryje zmianę i uaktywni strefę (zwykle minuty do kilku godzin, najwyżej 24–48 h). Rollback: przywrócić `dns/dns2/dns3.home.pl`.
Po aktywacji strefy: sprawdzić `Email Routing` (włączenie zwykle następuje automatycznie przy aktywnej strefie z MX Cloudflare; zweryfikować w panelu) i przetestować oba tory (poniżej).

## Rekordy DNS w strefie Cloudflare (przygotowane, nieaktywne do czasu zmiany NS)

| Typ | Nazwa | Wartość | Uwagi |
|---|---|---|---|
| A (proxied) | `pawelperfect.pl`, `www.pawelperfect.pl` | `192.0.2.1` | adres zastępczy z zakresu dokumentacyjnego: ruch jest przechwytywany w Cloudflare przez regułę przekierowania, żadna usługa pod tym adresem nie istnieje |
| MX | `pawelperfect.pl` | `route1/2/3.mx.cloudflare.net` (priorytety 28, 29, 5) | Cloudflare Email Routing |
| TXT | `pawelperfect.pl` | `v=spf1 include:_spf.mx.cloudflare.net ~all` | SPF dla poczty przekazywanej |
| TXT | `cf2024-1._domainkey` | `v=DKIM1; …` (klucz publiczny Cloudflare) | DKIM Email Routing |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<skrzynka właściciela>; fo=1` | tryb obserwacji |

Brakuje rekordów Resend (patrz niżej). W tunelu `serwerek` **nie ma** hostname dla `pawelperfect.pl` (nie jest potrzebny).

## Przekierowanie na .com

Reguła `http_request_dynamic_redirect` (Redirect Rule) w strefie: dla hosta `pawelperfect.pl` lub `www.pawelperfect.pl` → **301** na `https://www.pawelperfect.com` + ta sama ścieżka, z zachowaniem zapytania (`preserve_query_string`). Aktywna dopiero po aktywacji strefy.
Test po aktywacji: `curl -sI https://pawelperfect.pl/test?x=1` → `301`, `location: https://www.pawelperfect.com/test?x=1`; to samo dla `http://` i `www.`.
Stripe ma `pawelperfect.pl` i `www.pawelperfect.pl` jako zweryfikowane domeny metod płatności (Apple Pay/Google Pay/Link; [`../architecture/patron-zone-audit.md`](../architecture/patron-zone-audit.md)); płatność odbywa się na `.com`, ale ponowna weryfikacja domeny w Stripe (plik pod `/.well-known/`) przez 301 na `.com` nie przejdzie; nie jest to potrzebne, dopóki domeny już są zweryfikowane.
Pozostałość do posprzątania: projekt Vercel `polutek.pl` ma jeszcze przypięte `pawelperfect.pl` (i `.com`, `www`); po zmianie NS Vercel i tak nie jest już używany dla tej domeny.

## Poczta (Cloudflare Email Routing)

Reguły (strefa `pawelperfect.pl`, wszystkie włączone): `pawel@pawelperfect.pl`, `kontakt@pawelperfect.pl` oraz **catch-all** → przekazanie na skrzynkę właściciela (adres docelowy jest w koncie Cloudflare i ma status **verified**).
Wyłącznie odbiór i przekazywanie; **wysyłania z adresu `@pawelperfect.pl` nie ma** (do tego służy Resend, niżej, albo własny transport: [`MAIL-OWN-TRANSPORT.md`](MAIL-OWN-TRANSPORT.md)). Odpowiedź z Gmaila „jako” ten adres wymaga osobnej konfiguracji.
Stan usługi na strefie to dziś `enabled: false / unconfigured`, bo strefa jest `pending`; reguły zadziałają po aktywacji. Catch-all przyjmie też spam na dowolny adres: po uruchomieniu rozważ zawężenie do dwóch adresów.
Ogólny opis poczty dla `.com` (Resend, SES, routing): [`EMAIL_SETUP.md`](EMAIL_SETUP.md), dostarczalność: [`EMAIL_DELIVERABILITY.md`](EMAIL_DELIVERABILITY.md).

## Resend

W koncie Resend (region `eu-west-1`) domena `pawelperfect.pl` jest **dodana, status `not_started`**: rekordy DKIM/SPF Resend nie zostały wpisane do strefy Cloudflare i weryfikacja nie została wywołana. Obecnie wysyłkę obsługują `pawelperfect.com` i `news.pawelperfect.com` (oba `verified`).
Aby wysyłać z `.pl`: po aktywacji strefy dopisać dokładnie te rekordy, które pokaże panel Resend (sprawdź, czy nie kolidują z istniejącym SPF Cloudflare: na jedną nazwę może być tylko jeden rekord SPF), uruchomić weryfikację, dopiero potem użyć adresu w aplikacji. Nie jest to potrzebne, dopóki całość kierujemy na `.com`.

## Sekrety i dostęp (tylko lokalizacje)

Odczyt/zmiana strefy: token Cloudflare w `/root/.ai-secrets/secrets.env` (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`), klucz Resend `RESEND_API_KEY` tamże. Kopie rekordów DNS: `/root/.ai-secrets/dns-backup/`, konfiguracji tunelu: `/root/.ai-secrets/cloudflare-backup/`. Panel rejestratora (home.pl) obsługuje wyłącznie właściciel.

## Znane ograniczenia i ryzyka

* Do zmiany NS domena działa wyłącznie na pustym DNS home.pl: ruch i poczta na `@pawelperfect.pl` nie dotrą (nadawca dostanie odrzucenie).
* Zmiana NS przełącza **całą** strefę: jeśli w panelu home.pl są jakiekolwiek inne rekordy (poczta home.pl, poddomeny), znikną; przed zmianą sprawdź je w panelu (domena świeża, więc najpewniej puste).
* DMARC `p=none` nie chroni przed podszywaniem; zaostrzenie dopiero po okresie obserwacji raportów.
* Catch-all i brak kontroli nadawców: odpowiedzialność za spam spada na skrzynkę docelową.
* Stan Cloudflare zmienia się samoczynnie po zmianie NS; ten dokument opisuje stan sprzed tego kroku. Po aktywacji zaktualizuj go (status strefy, wynik testów przekierowania i poczty).

## Powiązane dokumenty

[`NASZA-GAZETKA.md`](NASZA-GAZETKA.md) (analogiczne przejście domeny z home.pl na Cloudflare) · [`EMAIL_SETUP.md`](EMAIL_SETUP.md) · [`SERWEREK.md`](SERWEREK.md) · [`ACCOUNTS.md`](ACCOUNTS.md) · [`AGENT_ACCESS.md`](AGENT_ACCESS.md).
