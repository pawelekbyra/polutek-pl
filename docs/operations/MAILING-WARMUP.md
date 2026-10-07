# Projekt „rozgrzewanie mailingu”

Stan: 2026-10-07. Bez sekretów. Projekt właściciela (hasło do przypomnienia: **„rozgrzewanie mailingu”**): maile z aplikacji mają dochodzić do skrzynek, a docelowo mamy móc wysyłać **największe wolumeny** (miliony/mies.), niezależnie od Resend i za darmo, jeśli się da. Powiązane: [`EMAIL_DELIVERABILITY.md`](EMAIL_DELIVERABILITY.md), [`EMAIL_SETUP.md`](EMAIL_SETUP.md), [`EMAIL_SES.md`](EMAIL_SES.md) (gałąź `feat/email-ses`), [`../architecture/self-hosted-mail-plan.md`](../architecture/self-hosted-mail-plan.md).

## 1. Problem i decyzje właściciela

- Część maili z Resend (Hotmail/Outlook, czasem Gmail) trafia do spamu.
- Decyzja 2026-10-07: prowadzimy **dwa tory**: (A) naprawa dostarczalności przez Resend, (B) profesjonalna rozgrzewka własnego serwera pocztowego na serwerku (Hetzner odblokował porty 25/465 dnia 2026-10-05), docelowo możliwość porzucenia Resend.
- Amazon SES: wniosek o dostęp produkcyjny **odrzucony 2026-10-07** (sprawa 179128326000153, powód: brak historii). Ponowić po ok. miesiącu, z historią wysyłki. Gałąź `feat/email-ses` (transport SMTP, endpoint SNS) zostaje jako gotowy kod, nic z niej nie jest wdrożone, `EMAIL_PROVIDER` domyślnie `resend`.
- Cel docelowy: **najwyższe wolumeny**. Jedno IP z Hetznera tego nie udźwignie; własny MTA to pilot i nauka, a skala = dedykowane IP u dostawcy (Resend, SES) lub własna flota IP.
- Płatności za usługi: na razie nie (decyzja właściciela), każdy wydatek wymaga jego zgody.
- Usługi „rozgrzewania” skrzynek (Mailreach, Warmup Inbox, Lemwarm…) odrzucone: pod cold-mailing, dostawcy dyskontują sygnały z takich pul, płatne. Zostaje prawdziwa korespondencja i testerzy.

## 2. Stan zmierzony (2026-10-07)

| Co | Wynik |
|---|---|
| Resend, 30 dni | 57 wysłanych, 55 doręczonych, 2 twarde bounce (3,5%), 0 skarg, śledzenie otwarć i kliknięć wyłączone (dobrze) |
| Resend, domena `pawelperfect.com` | verified, eu-west-1; domena `.pl` w stanie `partially_failed` (nieużywana) |
| DNS | SPF `include:_spf.mx.cloudflare.net ~all` (**Resend ma osobny SPF na `send.`**), DKIM `resend._domainkey` 1024 bit (Resend nie wspiera 2048, to nie problem), DMARC `p=none` z `rua` na Gmail, brak MTA-STS i TLS-RPT |
| Adresy w kodzie | **jeden nadawca na wszystko:** `Pawel Perfect <no-reply@pawelperfect.com>` (transakcje, powitanie i broadcasty), Reply-To `support@pawelperfect.com` |
| IP serwerka `46.224.211.115` | listowane: **Barracuda** (poor), **SpamRATS** (zakres, wymaga ręcznego przeglądu), do tego generyczne wpisy z powodu PTR `*.clients.your-server.de` (Hostkarma, JustSpam, Polspam i in.). Spamhaus czysty (multirbl/mxtoolbox; check.spamhaus.org nie sprawdzony ręcznie). Talos i SenderScore nie sprawdzone. |
| PTR | **od 2026-10-07:** IPv4 i IPv6 = `mail.pawelperfect.com` (wcześniej generyczny `static.115.211.224.46.clients.your-server.de`); wpisy na listach oparte o generyczny PTR (Hostkarma, JustSpam i in.) powinny zniknąć w ciągu doby, do ponownego sprawdzenia |
| Domena | czysta na wszystkich listach domen; jedyny wpis to SEM-FRESH („świeża domena”), znika sam z wiekiem |
| Webhook Resend | **Był wyłączony przez Resend od 2026-10-02 17:47 UTC do 2026-10-07**: endpoint odpowiadał 401 „Invalid signature”, bo `RESEND_WEBHOOK_SECRET` w `app.env` nie zgadzał się z sekretem webhooka w Resend. Naprawione 2026-10-07: sekret zsynchronizowany z API Resend (kopia `app.env.bak-pre-resendwh-20261007`), podpisany test wewnątrz kontenera dał 200, webhook włączony ponownie, jedno pominięte zdarzenie `email.bounced` odtworzone (replay). W tym czasie zdarzenia odbić i skarg nie docierały do aplikacji (zawieszanie adresów). Zdarzenia `sent`/`delivered` z tego okresu zostały pominięte i nie są odtwarzane. |
| Test do skrzynki `pawel.byra@hotmail.com` | maile z `no-reply@` i `support@` **doszły, ale test jest niemiarodajny**: skrzynka ma wcześniej oznaczonych nadawców jako „nie spam”. Miarodajne są tylko skrzynki, które nas nie znają. |

## 3. Newsletter i powiadomienia o nowościach (pytanie właściciela 2026-10-07)

Na stronie jest przycisk subskrypcji (powiadomienia o nowościach), więc mamy dwa różne rodzaje poczty o różnym ryzyku. **Wniosek: tak, trzeba je rozdzielić.**

| Rodzaj | Dziś | Docelowo |
|---|---|---|
| Transakcyjne (weryfikacja konta, reset hasła, zmiana hasła/e-maila, potwierdzenie napiwku, usunięcie konta) | `no-reply@pawelperfect.com` | zostaje na `pawelperfect.com` (osobny DKIM i Return-Path od masówki), bez linku wypisania |
| Newsletter i powiadomienia o nowościach (powitanie po subskrypcji, broadcasty, nowe filmy) | to samo `no-reply@pawelperfect.com` | **osobna subdomena** `news.pawelperfect.com`, nadawca np. `Pawel Perfect <newsletter@news.pawelperfect.com>`, osobna domena w Resend (własny DKIM, Return-Path, śledzenie wyłączone lub na własnej domenie), `List-Unsubscribe` + one-click, nagłówek `Feedback-ID` |

Dlaczego: skargi na newsletter (a one-click unsubscribe i „to spam” zdarzają się zawsze) liczą się na domenę nadawcy. Gdy masówka i reset hasła siedzą na tej samej domenie, jedna zła kampania wrzuca do spamu także maile logowania. Gmail, Yahoo i Microsoft przy ponad 5000 maili dziennie wymagają też one-click unsubscribe i skarg poniżej 0,10%.

Czy trzeba skrzynek: **fizyczna skrzynka `newsletter@` nie jest potrzebna.** Wystarczy `Reply-To: support@pawelperfect.com` (odpowiedzi trafiają do PP Support i same budują reputację). Potrzebne są natomiast adresy zwyczajowe dla poczty wychodzącej: `postmaster@` i `abuse@` (RFC 2142) przekierowane do PP Support przez Cloudflare Email Routing. Adres typu `newsletter@news.pawelperfect.com` w polu From nie wymaga MX, ale lepiej, by odpowiedź na niego nie ginęła (Reply-To załatwia sprawę).

Do sprawdzenia w kodzie: czy zapis na subskrypcję wysyła mail potwierdzający (**double opt-in**). Dla newslettera to wymóg praktyczny: chroni przed literówkami i pułapkami na spam (spam traps), a potwierdzenie jest tanim mailem „transakcyjnym” z `news.`-owej tożsamości.

## 4. Lista zadań

### Zrobione (2026-10-07)
- Analiza DNS/PTR/DNSBL, pomiar Resend, przegląd narzędzi „warm-up”, przewodnik wymagań (Google/Yahoo/Microsoft/WP/Onet/Interia, Resend, SES, własny MTA).
- Dwa maile testowe na Hotmaila (niemiarodajne, patrz wyżej).
- Odpowiedź na pytanie o newsletter (sekcja 3).

### Mogą zrobić agenci (bez właściciela, po zgodzie na zmiany w DNS/koncie)
- [x] Domena `news.pawelperfect.com` w Resend (eu-west-1, śledzenie wyłączone, id w panelu Resend) + rekordy DNS w Cloudflare dodane 2026-10-07; domena **zweryfikowana** w Resend. Kod: `EMAIL_FROM_NEWS` (`getNewsEmailFrom()`), broadcasty i test broadcastu idą z nadawcy `news.` (`stream: "news"`), bez zmiennej fallback na `EMAIL_FROM`. **Wdrożone 2026-10-07:** `EMAIL_FROM_NEWS` ustawione w `app.env` na serwerku (kopia `app.env.bak-pre-news-20261007`), `app` odtworzony na tym samym obrazie; od teraz broadcasty idą z `newsletter@news.pawelperfect.com`. Powitanie po rejestracji zostaje na domenie transakcyjnej (to mail konta, nie newsletter).
- [x] Nagłówek `Feedback-ID: <rodzaj>:<tx|news>:pp:ppmail` na każdym mailu (`buildFeedbackId()`), `List-Unsubscribe` + one-click już były na broadcastach.
- [x] Subskrypcja wymaga zalogowanego konta, a e-mail konta jest zweryfikowany (link w mailu lub Google), więc to praktycznie double opt-in; dodatkowy mail potwierdzający niepotrzebny.
- [ ] Rekord TXT dla Google Postmaster Tools v2 (gdy właściciel poda kod weryfikacyjny).
- [x] `postmaster@` i `abuse@`: osobne reguły niepotrzebne, catch-all w Cloudflare Email Routing kieruje każdy adres `@pawelperfect.com` do workera PP Support (sprawdzone 2026-10-07).
- [x] PTR IPv4 i IPv6 serwerka ustawione 2026-10-07 na `mail.pawelperfect.com` (Hetzner API) + rekordy A i AAAA `mail.pawelperfect.com` w Cloudflare (DNS only). Poprzedni PTR v4: `static.115.211.224.46.clients.your-server.de`. Forward i reverse zgodne. Wpis w dzienniku zmian serwerka.
- [ ] Wyjaśnić 2 twarde bounce z ostatnich 30 dni (które adresy, czy zostały zawieszone) i zadbać, by twardy bounce zawsze dodawał adres do listy zawieszeń.
- [ ] Testy mail-tester.com (wymaga zezwolenia przeglądarki na stronę lub ręcznego adresu testowego; 3 testy na dobę, bez konta).
- [ ] DMARC `p=none` → `quarantine` (`pct` 10→50→100) po 2–4 tygodniach czystych raportów; potem MTA-STS (tryb `testing`) i TLS-RPT.
- [ ] Pilot własnego MTA na serwerku (Postfix lub Stalwart w kontenerze, DKIM 2048, TLS, kolejka, bounce, suppression, automatyczny fallback do Resend), dopiero po zdjęciu wpisów z Barracudy i SpamRATS i po zmianie PTR.

### Czeka na właściciela
- [ ] **Świeże skrzynki testowe** (nikt z naszej domeny nigdy do nich nie pisał): Outlook/Hotmail, Gmail, WP, Onet, Interia; przekazać adresy i nagłówki wiadomości (Wyświetl źródło). W nagłówku szukać `Authentication-Results` i `X-Forefront-Antispam-Report` (`SFV:SPM` vs `SFV:NSPM`/`SFE`).
- [ ] Panel testerów: 20–30 znajomych na różnych dostawcach, którzy odpisują na maile z `support@` i oznaczają „nie spam”.
- [ ] Zalogować się do Google Postmaster Tools v2 i Yahoo Sender Hub (CFL), podać kod TXT.
- [ ] Formularz **Barracuda** (`barracudacentral.org/rbl/removal-request`, wymaga telefonu i e-maila zgłaszającego, rozpatrzenie do 12 h), najlepiej po zmianie PTR.
- [ ] Prośba do **SpamRATS** o ręczny przegląd zakresu (strona „Contact SpamRATS Support”).
- [ ] Ewentualnie napisać do Hetznera (autoryzacja SNDS/JMRP dla ich zakresu IP) i do Microsoftu (sender.office.com), gdy własny serwer będzie wysyłał do Hotmaila.
- [ ] Ponowić wniosek o SES po ok. miesiącu (z historią wysyłki). Włączyć listę zawieszeń/SNS dopiero po zatwierdzeniu SES.
- [x] Decyzja kosztowa (2026-10-07): **odłożona do wzrostu wolumenu**. Dziś ~57 maili/mies., dedykowane IP bez sensu. Koszty: Resend Scale 90 USD + dodatek IP 30 USD = ok. 120 USD/mies. (źródła różnią się w progu wolumenu); SES 0,10 USD/1000 maili + 24,95 USD/mies. za IP (1 mln maili z 2 IP ok. 150 USD/mies., 5 mln ok. 550 USD/mies.), wariant zarządzany 15 USD/mies. + 0,08 USD/1000; nowe konta AWS 200 USD kredytów na 6 mies. Plan: zostać na wspólnym IP Resend, **2026-11-07 ponowić wniosek o SES z historią wysyłki**, dedykowane IP włączyć przy kilkudziesięciu tysiącach maili/mies. lub przed startem z dużym ruchem (czas na rozgrzewkę).
- [ ] Przy okazji: sprawdzić nagłówki wiadomości testowych z Hotmaila (patrz wyżej).

**Eksperyment na boku (od 2026-10-07):** [`MAIL-LAB.md`](MAIL-LAB.md): osobna subdomena `lab.pawelperfect.com`, Postfix+OpenDKIM w kontenerze, wysyłka tylko do skrzynek testowych właściciela; wyniki w tabeli tamże.

## 5. Plan rozgrzewki własnego serwera (po spełnieniu warunków wstępnych)

Warunki wstępne: PTR na własną nazwę, wpisy zdjęte (Barracuda, SpamRATS), SPF (`ip4:`), DKIM 2048, DMARC, TLS, kolejka z ponawianiem, obsługa bounce i skarg, lista zawieszeń, fallback do Resend.

| Tydzień | Ruch przez własny serwer |
|---|---|
| 1–2 | kilka–kilkadziesiąt maili dziennie: konta testowe i znajomi, maile typu odpowiedź i potwierdzenie; wolumen rośnie powoli, osobno dla Gmaila, Microsoftu i polskich skrzynek |
| 3–4 | niewielki udział prawdziwych maili transakcyjnych (np. 10–25%) |
| 5–8 | stopniowo do 100% transakcji, jeśli bounce poniżej 2%, skargi poniżej 0,1%, Postmaster co najmniej „Medium” |

Kryteria przerwania: bounce powyżej 5%, wzrost skarg, wpis na nowej liście blokad, spadek reputacji w Postmaster; wtedy cały ruch wraca na Resend (fallback automatyczny). Masówka (`news.`) idzie na własny serwer dopiero na końcu, najpierw przez dostawcę z dedykowanym IP.

## 6. Szkice zgłoszeń (do użycia przez właściciela)

Barracuda (po zmianie PTR): „New dedicated server for a small video site (pawelperfect.com). Reverse DNS corrected to a name in our own domain, SPF/DKIM/DMARC configured. The IP was previously unused for mail; we are starting at very low volume with transactional messages only.”

SpamRATS: „The IP is newly assigned to us (Hetzner Cloud). Reverse DNS is set and forward-confirmed. It is used for low-volume transactional mail for pawelperfect.com. Please review the manual classification.”

## 7. Zasady pracy

- Nic nie zmieniamy w DNS, Resend, Hetznerze ani na serwerze bez zgody właściciela w czacie. Każda zmiana na serwerze: `AI_AGENT=<nazwa> ai-log "..."`.
- Do skrzynek innych niż własne (Hotmail, Gmail itp.) nie wysyłamy nic poza testami zleconymi przez właściciela.
- Po każdej pracy aktualizować ten dokument i `STATUS.md`.
