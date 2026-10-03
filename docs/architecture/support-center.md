# PP Support (centrum obslugi): architektura

Stan: **dziala na serwerku od 2026-10-02**; od 2026-10-03 produkt wystepuje jako **PP Support** (marka, warstwa Cloudflare, nadpisania: runbook sekcja 8). Panel `https://support.pawelperfect.com` za Cloudflare Access. Operacje, limity, backup, rollback: [`../operations/SUPPORT-CENTER.md`](../operations/SUPPORT-CENTER.md). Pochodzenie i licencja oprogramowania: [`../operations/THIRD_PARTY_NOTICES.md`](../operations/THIRD_PARTY_NOTICES.md).

## Cele i zasady (decyzje wlasciciela)

1. Wspolna skrzynka (shared inbox) na poczte `hello@pawelperfect.com`: czlowiek teraz, agent AI pozniej.
2. Jak najmniej zaleznosci od zewnetrznych uslug. **Poczta nie korzysta juz z Google Workspace** (cutover MX 2026-10-02); wlasciciel anuluje Workspace sam po ok. 7 dniach stabilnej pracy.
3. Zero nowych platnych uslug. Serwer ma 4 GB RAM i dzieli go z aplikacja, baza, Redisem i enkoderem wideo: twarde limity pamieci.
4. Poczta wychodzaca nigdy z IP serwera (Hetzner blokuje porty 25 i 465, a IP serwera nie ma reputacji pocztowej): idzie przez Resend jako `hello@pawelperfect.com`.
5. Agent AI to **pozniejszy** etap: tu tylko punkty zaczepienia (sekcja "Agent AI").

## Schemat

```
                  Internet
   klient pisze na support@pawelperfect.com (MX Cloudflare na apexie; hello@ i aliasy .pl tak samo)
                     |
                     v   (cutover wykonany 2026-10-02)
        Cloudflare Email Routing  (reguly: konkretny adres + catch-all)
                     |
                     v
        Email Worker `polutek-support-mail`  (workers/support-mail-ingest/)
           | 1. POST surowego RFC822 do PP Support (basic auth + Access service token)
           | 2. ZAWSZE kopia do archiwum pawel.perfect@gmail.com (naglowek X-Support-Ingest: ok | failed:<powod>)
           v
   https://support.pawelperfect.com/rails/action_mailbox/relay/inbound_emails
        (Cloudflare Tunnel `serwerek` -> 127.0.0.1:3010; osobna aplikacja Access z polityka "service token")
                     |
                     v
   PP Support (web + sidekiq) --- Postgres+pgvector (osobny kontener) --- Redis (osobny, noeviction)
        |
        | odpowiedz agenta/czlowieka
        v
   SMTP Resend (smtp.resend.com:587 STARTTLS, klucz sending-only dla domeny pawelperfect.com)
        Od: "Pawel from Wsparcie <hello@pawelperfect.com>", Reply-To: reply+<uuid>@inbound.pawelperfect.com
        (DKIM/SPF/DMARC: pass, sprawdzone w Gmailu 2026-10-02)
```

Panel dla ludzi: `support.pawelperfect.com` za Cloudflare Access (polityka `serwerek owners`, OTP na e-mail). Wyjatek: sciezka `/rails/action_mailbox/relay/inbound_emails` ma wlasna aplikacje Access wylacznie dla service tokena `support-mail-ingest` (Worker); bez tokena 403, z tokenem bez hasla 401 (sprawdzone).

## Dlaczego tak (i odstepstwa od zalozen)

| Decyzja | Powod |
|---|---|
| Otwarty silnik panelu (obraz `pp-support:4.18.0`, licencja MIT: THIRD_PARTY_NOTICES.md) | wspolna skrzynka z API/webhookami (pod agenta), aplikacja mobilna, mail jako kanal; lzejszy od Zammada/Helpdesk |
| **Osobny** Postgres `pgvector/pgvector:0.8.7-pg17` zamiast naszego Postgresa | migracje silnika wymagaja rozszerzenia `pgvector`, a baza produkcyjna (`postgres:17-alpine`) go nie ma; dodawanie rozszerzen do bazy produkcyjnej ryzykowne. Koszt: ok. 70 MB RAM. Backup nocny obejmuje go automatycznie |
| **Osobny** Redis (`noeviction`, 96 MB) zamiast naszego | nasz Redis ma `allkeys-lru` (limity zapytan aplikacji), a Sidekiq wymaga `noeviction`; wywlaszczenie kluczy gubiloby zadania. Koszt: 5 MB |
| Poczta przychodzaca przez Email Worker + ingress "relay" Action Mailbox | brak IMAP/Gmaila w torze (niezalezne od Workspace); archiwum w Gmailu jako siatka bezpieczenstwa |
| Archiwum = forward do Gmaila **po** proba wrzucenia do PP Support | Email Worker nie umie zwrocic bledu tymczasowego (4xx), odrzucenie byloby trwale: dlatego nigdy nie odrzucamy, a nieudany ingest zostawia mail w archiwum z naglowkiem `X-Support-Ingest: failed:...` |
| SMTP przez port 587 (nie 465) | Hetzner blokuje wychodzace 25 i 465 (sprawdzone), 587/2465/2587 dzialaja |
| Aplikacja mobilna PP Support | patrz "Aplikacja mobilna": wymaga decyzji wlasciciela (konflikt z Access) |

## Inbound: adresy i domeny

- Domena techniczna poczty przychodzacej: `inbound.pawelperfect.com` (MX Cloudflare tylko tu; **apex `pawelperfect.com` dalej ma MX Google**).
- PP Support wysyla `Reply-To: reply+<uuid>@inbound.pawelperfect.com`, wiec odpowiedzi klientow wracaja do watku niezaleznie od tego, dokad wskazuje MX apex. Dlatego regula catch-all Email Routing kieruje do Workera (dziala tylko dla poczty, ktora dotarla przez MX Cloudflare, czyli dzis wylacznie `inbound.*`).
- Nowy adres wejsciowy skrzynki PP Support (przekazywanie): `<uuid>@inbound.pawelperfect.com` (`forward_to_email`, w panelu: Ustawienia, Skrzynki, Wsparcie). Po cutoverze mail do `hello@pawelperfect.com` pasuje do kanalu po adresie `email`.

## Agent AI: punkty zaczepienia (NIE zbudowane)

Zasada: agent **czyta, szkicuje, notuje**; wysyla czlowiek (zatwierdza). Cala poczta od klientow to dane niezaufane (prompt injection).

1. **Webhook (wejscie zdarzen).** PP Support ma webhooki konta (Ustawienia, Integracje, Webhooks) lub webhook botowy agenta (Agent Bots). Nasluchiwacz (osobny maly serwis/kontener, `127.0.0.1`, za Tunnel pod osobnym hostname z Access service token albo podpisem HMAC) przyjmuje zdarzenia `message_created` (tylko `message_type=incoming`) i `conversation_status_changed`. Kontrakt: weryfikacja podpisu naglowka `X-PP Support-Signature` (HMAC SHA-256 sekretu webhooka), idempotencja po `message.id`, odpowiedz 200 szybko, praca asynchroniczna, pomijanie wiadomosci `outgoing`, automatycznych (`Auto-Submitted`, nadawca `no-reply`) i wlasnych notatek agenta (zapobiega petlom).
2. **Kontekst tylko do odczytu z naszej bazy.** Maly wewnetrzny endpoint (np. `GET /api/internal/support/context?email=...`, token serwis-serwis, dostep przez siec dockera, nie publiczny) zwraca ZNORMALIZOWANY, minimalny kontekst z Postgresa aplikacji: konto (id, rola, data utworzenia, e-mail zweryfikowany), ostatnie platnosci (status, kwota, data, bez danych karty), wpis `PatronGrant`, stan wysylek maili. Rola bazy tylko do SELECT na widokach/DTO, bez zapisu i bez sekretow (hasla, tokeny, klucze). Odpowiedz jest danymi, nie instrukcjami.
3. **Wyjscie: wylacznie notatka prywatna.** Agent zapisuje szkic przez API PP Support jako wiadomosc `private: true` (notatka wewnetrzna) z propozycja odpowiedzi i uzasadnieniem. Klucz API agenta ma role agenta ograniczona do tego konta; osobny uzytkownik "AI draft", nie administrator.
4. **Zatwierdzenie.** Czlowiek kopiuje/edytuje szkic i wysyla z PP Support (ten sam tor SMTP). Tryb pol-automatyczny (wysylka bez zatwierdzenia) dopiero po osobnej decyzji wlasciciela i tylko dla wąskich, bezpiecznych kategorii; platnosci, zwroty, sprawy prawne i RODO zawsze do czlowieka.
5. **Bezpieczenstwo.** Agent nie ma zadnych narzedzi poza (a) czytaj kontekst, (b) napisz notatke; nie ma dostepu do panelu admina, Stripe ani DB write. Tresc maila wchodzi do promptu w wyraznie oznaczonym bloku "dane klienta". Limit tokenow i czestosci, log kazdej akcji (id konwersacji, hash promptu) do audytu.

## Aplikacja mobilna (decyzja wlasciciela)

Oficjalna aplikacja mobilna silnika panelu (iOS/Android) loguje sie do `https://support.pawelperfect.com` przez API (`/auth/sign_in`, `/api/v1/*`, `/cable`), a nie umie przejsc logowania Cloudflare Access (OTP w przegladarce). Opcje:
- **A: tylko panel w przegladarce** za Access (najbezpieczniej). Aplikacja mobilna nie zadziala. *(historyczne)*
- **B (WYBRANA i wlaczona 2026-10-02, szczegoly w runbooku sekcja 7): wyjatek Access dla sciezek API** (`/auth/sign_in`, `/api/*`, `/cable`, `/webhooks/*`) z wlasnym uwierzytelnianiem PP Support (haslo + wlaczone 2FA, limity Rack::Attack). Panel w przegladarce (`/app/*`) zostaje za Access. Slabsze: ktos z internetu moze probowac logowania do API. Skrypt i rollback: runbook, "Wlaczenie aplikacji mobilnej". Powiadomienia push przechodza przez przekaznik PP Support (zewnetrzna zaleznosc, tylko metadane).

## Zalezne i zewnetrzne elementy (co zostaje na zewnatrz)

Cloudflare (DNS, Email Routing, Tunnel, Access, Workers Free), Resend (wysylka), Gmail pawel.perfect@gmail.com (archiwum kopii). Google Workspace: nic tu od niego nie zalezy; MX przeniesione, szczegoly i rollback w runbooku (sekcja 6).
