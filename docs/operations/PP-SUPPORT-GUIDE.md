# PP Support: przewodnik (dla wlasciciela i przyszlej obslugi)

Stan na 2026-10-03. PP Support to nasza wspolna skrzynka obslugi klienta: wszystkie maile na `support@pawelperfect.com` laduja w jednym panelu, gdzie widac je jako rozmowy, mozna je przypisac osobie, oznaczyc, skomentowac wewnetrznie i odpowiedziec klientowi jako `support@pawelperfect.com`.

Ten dokument tlumaczy **jak tego uzywac i jak to dziala**. Techniczne szczegoly (komendy, limity, rollbacki) sa w runbooku [`SUPPORT-CENTER.md`](SUPPORT-CENTER.md), a decyzje projektowe w [`../architecture/support-center.md`](../architecture/support-center.md). Oprogramowanie osob trzecich, na ktorym to stoi, i jego licencja: wylacznie [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## 1. Najkrocej

| Pytanie | Odpowiedz |
|---|---|
| Gdzie jest panel? | `https://support.pawelperfect.com` |
| Kto wejdzie? | tylko osoby z polityki Cloudflare Access `serwerek owners` (kod PIN na e-mail), a potem z kontem w PP Support |
| Jaki adres widza klienci? | `support@pawelperfect.com` (rowniez `hello@` i te same nazwy na `.pl` trafiaja do tej samej skrzynki) |
| Czym wysylamy? | Resend (SMTP 587), nadawca `support@pawelperfect.com`, DKIM/SPF/DMARC przechodza |
| Gdzie to dziala? | serwer Hetzner "serwerek", katalog `/opt/serwerek/apps/pp-support`, dane w `/opt/serwerek/data/pp-support` |
| Ile to zjada? | ok. 0,93 GB RAM z 4 GB (twarde limity w `docker-compose.yml`) |
| Kto pomaga? | konto "Agent AI" (tylko szkice jako notatki prywatne; wysyla czlowiek) |

## 2. Architektura w jednym obrazku

```
 KLIENT pisze na support@pawelperfect.com
        |
        v
 Cloudflare Email Routing (MX Cloudflare na pawelperfect.com i .pl)
        |
        v
 Email Worker "polutek-support-mail"  (workers/support-mail-ingest/)
        |   1) POST maila do PP Support (haslo + service token Access)
        |   2) ZAWSZE kopia do archiwum Gmail (naglowek X-Support-Ingest: ok | failed:... | skipped:...)
        v
 Cloudflare Tunnel -> 127.0.0.1:3010 na serwerku
        |
        v
 +--------------------------- serwerek (Docker, projekt "pp-support") ---------------------------+
 |  web (panel + API)   sidekiq (zadania w tle)   db (Postgres+pgvector)   redis (kolejka)        |
 |  dane: /opt/serwerek/data/pp-support/{pg,redis,storage}                                        |
 +------------------------------------------------------------------------------------------------+
        |                                   ^
        | odpowiedz czlowieka / agenta      | ludzie: przegladarka -> Cloudflare Access (PIN) -> panel
        v                                   |
 Resend SMTP (smtp.resend.com:587) ---> KLIENT dostaje maila od support@pawelperfect.com

 Warstwa marki: Worker Cloudflare "pp-support-brand" (przepisuje wyglad panelu: nazwa, logo, kolory, font)
 Kopie zapasowe: backup.sh co noc 02:30 -> lokalnie 7 dni + Cloudflare R2 "serwerek-backups" 14 dni
```

Wazne zasady architektury:
- Poczta przychodzaca **nie przechodzi przez Gmaila ani Google Workspace**. Gmail dostaje tylko kopie archiwalna (siatka bezpieczenstwa: nic nie ginie, nawet gdy panel lezy).
- Poczta wychodzaca **nigdy nie wychodzi z IP serwera** (Hetzner blokuje porty 25/465), zawsze przez Resend.
- Panel jest za Cloudflare Access; wyjatki tylko dla sciezek API/aplikacji mobilnej i dla ingestu poczty (rozdzial 10).

## 3. Codzienna praca

### 3.1 Logowanie
1. Otworz `https://support.pawelperfect.com`.
2. Cloudflare Access poprosi o e-mail: wpisz swoj adres z listy (dzis `hello@pawelperfect.com` lub `pawel.perfect@gmail.com`) i kod PIN z poczty.
3. Zaloguj sie do PP Support. Jesli nie znasz hasla: "Nie pamietam hasla" (mail z linkiem przyjdzie do skrzynki PP Support, czyli na `hello@`).
4. Zalecane: wlacz 2FA (TOTP) w profilu; PP Support nie pozwala jej wymusic, wiec kazda osoba robi to sama.

### 3.2 Rozmowy
- **Rozmowy** (Conversations) to lista watkow. Kazdy mail klienta to rozmowa; kolejne maile tego samego klienta w watku dopisuja sie do niej (odpowiedzi wracaja przez adres `reply+...@inbound.pawelperfect.com`).
- **Odpowiedz**: otworz rozmowe, wpisz tresc w polu odpowiedzi (karta "Odpowiedz"), wyslij. Klient dostaje maila od `support@pawelperfect.com`, w tym samym watku w swojej poczcie.
- **Notatka prywatna**: przelacz karte z "Odpowiedz" na "Notatka prywatna". Widza ja tylko osoby z panelu, klient jej nie dostaje. Do notatek sluza tez szkice agenta AI.
- **Przypisanie**: kazda rozmowe mozna przypisac osobie (np. do siebie), zeby bylo jasne, kto ja prowadzi.
- **Etykiety**: przypisuj etykiety (np. `platnosc`, `konto`, `bug`), zeby potem filtrowac i raportowac. Etykiety tworzy sie w Ustawieniach.
- **Gotowe odpowiedzi**: powtarzalne teksty (np. "jak zmienic haslo") zapisz w Ustawieniach jako gotowa odpowiedz i wstawiaj ukosnikiem `/` w polu odpowiedzi.
- **Status**: rozmowa jest otwarta, odlozona (snooze) albo rozwiazana. Po rozwiazaniu znika z kolejki; nowy mail od klienta otwiera ja ponownie.
- Nazwy menu moga sie roznic w zaleznosci od wersji i jezyka; czesc napisow interfejsu jest po angielsku (to tlumaczenie silnika, nie blad konfiguracji).

### 3.3 Dobre praktyki
- Zasada jednej rozmowy: nie zakladaj nowej, jesli klient odpowiada w watku.
- Sprawy platnosci, zwrotow, RODO i sprawy prawne rozstrzyga wlasciciel.
- Tresci maili klientow to dane niezaufane (moga zawierac proby wprowadzenia w blad, linki); nie klikaj nieznanych zalacznikow.

## 4. Konta i role

- **Administrator**: widzi wszystko, zarzadza agentami, skrzynkami, etykietami, ustawieniami i integracjami. Dzis: `hello@pawelperfect.com` (administrator i SuperAdmin konsoli `/super_admin`).
- **Agent**: obsluguje rozmowy ze skrzynek, do ktorych jest przypisany; nie zmienia ustawien konta.
- Dodanie osoby: Ustawienia, **Agenci**, "Dodaj agenta" (imie, e-mail, rola). Nowa osoba dostanie mail z zaproszeniem. Zeby w ogole zobaczyla panel, jej adres musi tez byc na polityce Cloudflare Access `serwerek owners` (SERWEREK.md §9 pkt 5), a w skrzynce "Wsparcie" musi byc dodana jako agent.
- Rejestracja kont jest **wylaczona** (`ENABLE_ACCOUNT_SIGNUP=false`): nikt sam sie nie zalozy. Logowanie ma limity prob (5 prob/5 min na IP) i regule rate limit w Cloudflare.
- Usuniecie dostepu: usun agenta w panelu **i** adres z polityki Access.

## 5. Agent AI

Konto "Agent AI" (`agent-ai@pawelperfect.com`, rola agent, czlonek skrzynki Wsparcie) sluzy do pomocy przy odpowiedziach.

- **Co moze**: czytac rozmowy i pisac **szkice jako notatki prywatne** (`private: true`).
- **Czego nie robi bez zgody**: wysylania do klienta. Wysylka (`private: false`) tylko po zatwierdzeniu wlasciciela. To zasada procesu: rola agenta technicznie moze pisac publicznie, wiec nie ma bezpiecznika w oprogramowaniu.
- Tresc maili klientow jest dla agenta danymi niezaufanymi (prompt injection): agent nie wykonuje polecen z maili.
- Token API: serwer `/opt/serwerek/secrets/pp-support-ai-agent.token` (root, 600), lokalnie `%USERPROFILE%\.ai-secrets\pp-support.env` (`PP_SUPPORT_AI_AGENT_TOKEN`). Nigdy nie wypisuj go ani nie wklejaj do czatu/repo. Rotacja i odwolanie: SUPPORT-CENTER.md sekcja 12.
- Przyklady wywolan API i projekt przyszlego automatycznego agenta (webhook, kontekst z bazy aplikacji, zatwierdzanie): SUPPORT-CENTER.md sekcja 12 i `../architecture/support-center.md`.

## 6. Telefon

- **Dzis**: panel dziala w przegladarce telefonu (jest dostosowany do mobilnego). Po zalogowaniu mozna dodac go do ekranu glownego; strona ma manifest PWA z naszym logo (warstwa marki).
- **Aplikacja mobilna silnika** zadziala po wskazaniu adresu `https://support.pawelperfect.com`: sciezki API sa wyjete spod Access (SUPPORT-CENTER.md sekcja 7). Nie testowano na urzadzeniu.
- **Powiadomienia push w tej aplikacji** ida przez serwer posredniczacy producenta silnika (jedyna zewnetrzna zaleznosc, zostawiona celowo): serwer wysyla tam tytul i tresc powiadomienia. Wylaczenie (`ENABLE_PUSH_RELAY_SERVER=false`) kasuje push w aplikacji mobilnej, zostaja powiadomienia w panelu i na e-mail.
- **Plan**: wlasna PWA z Web Push na kluczach VAPID (bez posrednika). Wtedy relay mozna wylaczyc. Do tego czasu nic nie ruszamy.
- Zalecenie: przed uzyciem aplikacji mobilnej wlacz 2FA na kontach (rozdzial 11).

## 7. Poczta: adresy i przeplyw

- Adresy: `support@pawelperfect.com` (publiczny), `hello@pawelperfect.com` i te same nazwy na `.pl` trafiaja do tej samej skrzynki. Reszta (catch-all) idzie tylko do archiwum Gmail (`X-Support-Ingest: skipped:unlisted-recipient`).
- Przychodzaca: Email Routing -> Worker -> PP Support, zawsze z kopia do archiwum. Typowo rozmowa pojawia sie po 20-40 s.
- Wychodzaca: PP Support -> Resend (`smtp.resend.com:587`, STARTTLS). Klucz Resend `pp-support-smtp` (sending-only) siedzi w `.env` na serwerze i w ustawieniach kanalu skrzynki. Nadawca maili systemowych: "PP Support <support@pawelperfect.com>", odpowiedzi do klientow: nazwa nadawcy kanalu (zmieniasz w panelu: Ustawienia, Skrzynki, Wsparcie).
- Google Workspace nie odbiera juz poczty. Anulowanie Workspace robi wlasciciel po ok. 7 dniach stabilnej pracy (SUPPORT-CENTER.md sekcja 6).

## 8. Marka i zmiana nazwy

Nazwa produktu jest w jednym miejscu: `workers/support-brand/brand.config.json` (pole `name`, kopia dla serwera `deploy/serwerek/support/overrides/brand.config.json`, ma byc identyczna).

Zmiana nazwy w 3 krokach:
1. Edytuj `brand.config.json` (obie kopie).
2. Na komputerze wlasciciela: `node workers/support-brand/gen-assets.mjs` (logo, ikony) i `node workers/support-brand/deploy.mjs` (warstwa Cloudflare).
3. Wgraj pliki na serwer i uruchom `PP_ACCOUNT_NAME="<nowa nazwa>" ./apply-brand.sh` w `/opt/serwerek/apps/pp-support`, potem `docker compose up -d --force-recreate web sidekiq` (dokladne komendy: SUPPORT-CENTER.md sekcja 8).

Marka dziala warstwowo: ustawienia instalacji w bazie (`apply-brand`), pliki nadpisywane woluminami (`overrides/`), Worker `pp-support-brand`. Wylaczenie samej warstwy Cloudflare (sekundy, bez dotykania serwera): `node workers/support-brand/deploy.mjs --disable` (pass-through) albo `--off` (bez tras).

## 9. Zdrowie, backup, odtwarzanie

- **Monitoring**: `health.sh` co 5 minut sprawdza cztery kontenery `pp-support-*` i `http://127.0.0.1:3010/api`; problem = mail ostrzegawczy na `hello@pawelperfect.com`.
- **Reczna kontrola**: `ssh serwerek 'cd /opt/serwerek/apps/pp-support && docker compose ps && docker stats --no-stream'`; zdrowy `/api` zwraca JSON z `queue_services` i `data_services` rownym `ok`.
- **Backup**: `backup.sh` o 02:30: zrzut bazy (`pg-pp-support-db-1-<ts>.sql.gz`), zalaczniki (`pp-support-storage-<ts>.tar.gz`), konfiguracje (bez `.env`); lokalnie 7 dni, w R2 14 dni. W backupie **nie ma** pliku `.env` (kopia sekretow u wlasciciela: `%USERPROFILE%\.ai-secrets\pp-support.env`) ani Redisa (kolejka, niekrytyczny).
- **Odtwarzanie**: procedura w SUPPORT-CENTER.md sekcja 4. Bez `SECRET_KEY_BASE` z kopii wlasciciela sesje i zaszyfrowane pola (np. haslo SMTP kanalu) trzeba wpisac od nowa; rozmowy zostaja.
- **Aktualizacja silnika**: tylko wg `THIRD_PARTY_NOTICES.md` (nowy obraz i tag), potem backup, migracje, `apply-brand.sh`, porownanie plikow z `overrides/` z oryginalami w nowym obrazie.
- **Kazda zmiana na serwerze**: `AI_AGENT=<nazwa> ai-log "..."`.

## 10. Rozwiazywanie problemow

| Objaw | Sprawdz |
|---|---|
| Mail nie dochodzi do PP Support | Czy jest w archiwum Gmail? Naglowek `X-Support-Ingest`: `ok` = dotarl (szukaj w panelu, moze w innej skrzynce/rozmowie), `failed:http-401` = zle haslo/token ingestu, `failed:http-403` = Access blokuje, `failed:error-...` = panel nie odpowiada, `skipped:unlisted-recipient` = adres spoza allowlisty. Nieudany mail wrzucisz recznie (SUPPORT-CENTER.md sekcja 5). Swiezo dodana regula Email Routing moze przez ok. minute dawac 550. |
| Mail na `hello@` znika bez rozmowy | Worker musi dopisywac `X-Original-To: support@pawelperfect.com`; sprawdz Worker `polutek-support-mail` (SUPPORT-CENTER.md sekcja 6). |
| Odpowiedz ma status bledu wysylki | Haslo SMTP kanalu (klucz Resend) wygaslo lub zle; sprawdz `SMTP_PASSWORD` w `.env` i ustawienia kanalu, port musi byc 587 (nie 465). Sprawdz tez, czy adres klienta nie jest na liscie supresji Resend. |
| Panel zwraca 5xx / "Bad Gateway" | `docker compose ps` w `/opt/serwerek/apps/pp-support`, logi: `docker compose logs --since 30m web sidekiq \| tail -50`; po restarcie serwera kontenery wstaja same (`unless-stopped`); start web trwa do ok. 90 s. |
| Wolno / brak pamieci | `free -m`, alert health `ram-avail-under-300mb`/`swap-over-2gb`. Enkoder wideo (limit 1500 MB) razem z PP Support potrafi wyczerpac 4 GB: nie koduj filmow w godzinach pracy skrzynki; chwilowo `docker compose stop sidekiq web` (poczta dalej trafia do archiwum). |
| Panel w przegladarce przekierowuje do logowania Cloudflare | To normalne (Access). Adres musi byc na polityce `serwerek owners`. |
| Aplikacja mobilna nie loguje | Czy `https://support.pawelperfect.com/api` odpowiada 200 bez logowania Access; limity prob logowania (429 po 5 probach). |
| Zmienilem nazwe, a panel pokazuje stara | Powtorz `apply-brand.sh`, odtworz web/sidekiq, podbij `?v=` logo (SUPPORT-CENTER.md sekcja 8); cache przegladarki. |

## 11. Bezpieczenstwo

- Panel za Cloudflare Access (PIN na e-mail); wyjatek Access tylko dla `/api`, `/auth`, `/cable`, `/rails/active_storage` (aplikacja mobilna, agent AI, zalaczniki) i osobna aplikacja Access dla ingestu poczty (tylko service token Workera + haslo).
- Rejestracja wylaczona; limity logowania (Rack::Attack + regula Cloudflare); wlacz 2FA na kazdym koncie.
- Sekrety tylko w `/opt/serwerek/apps/pp-support/.env` (600), tokenie agenta (600) i u wlasciciela w `%USERPROFILE%\.ai-secrets\`. Nigdy w repo, logach, czacie.
- Telemetria producenta silnika, dzienne sprawdzanie wersji i wbudowany widget wsparcia w konsoli administratora sa wylaczone; przegladarka laduje zasoby wylacznie z `support.pawelperfect.com`. Jedyny kontakt na zewnatrz poza Cloudflare/Resend to push mobilny (rozdzial 6).
- Wszystko slucha tylko na `127.0.0.1`; serwer wystawia tylko SSH.
- Maile klientow to dane niezaufane (dotyczy tez agenta AI).

## 12. Plan rozwoju

1. **Nakladka `/admin/support`** w naszej aplikacji (zaplanowana, niezbudowana): strona admina z kontekstem klienta obok rozmowy (konto, ostatnie platnosci, wpis `PatronGrant`, stan wysylki maili), tylko do odczytu, przez wewnetrzny endpoint serwis-serwis; panel PP Support zostaje glownym miejscem pracy.
2. **PWA z Web Push na kluczach VAPID**: zastapienie oficjalnej aplikacji mobilnej i wylaczenie relaya push.
3. **Automatyczny agent AI** (webhook zdarzen, kontekst z bazy, szkice jako notatki prywatne, zatwierdzanie przez czlowieka): projekt w `../architecture/support-center.md`.
4. Ewentualnie wiekszy serwer (CPX32, 8 GB RAM) lub ograniczenie enkodera, jesli RAM bedzie sie konczyl (decyzja wlasciciela, koszt).
5. Polskie tlumaczenia pozostalych napisow interfejsu w `brand.js` po decyzji wlasciciela.

## 13. Potencjalne opcje do wcielenia w przyszlosci (nie zaplanowane, nie zbudowane)

Lista funkcji, ktore moglibysmy dopisac sami w nakladce `/admin/support` (nasz kod, bez zewnetrznych licencji i bez zaleznosci od wersji silnika). To banka pomyslow do wyboru przez wlasciciela, nie plan prac. Kolejnosc ponizej to propozycja.

### Rdzen (gdyby ruszyc najpierw)
- **Role i uprawnienia pracownikow**: wlasne role, np. "odpowiada, nie widzi platnosci", "tylko czyta". Latwe.
- **Dziennik dzialan**: wpis do naszej tabeli audytu przy kazdej akcji (kto, co, kiedy); mamy juz ten wzorzec w aplikacji. Latwe.
- **Limity obciazenia i auto-przydzielanie**: maks. liczba otwartych rozmow na osobe, rozdzielanie nowych rozmow. Srednie.
- **Polityki SLA**: cele czasu pierwszej odpowiedzi i rozwiazania, alerty o przekroczeniu. Srednie.
- **Monitorowanie rozmow**: reguly typu "rozmowa bez odpowiedzi 4 godziny", "negatywny ton", z powiadomieniem. Srednie.
- **Raporty**: czas pierwszej odpowiedzi, czas rozwiazania, liczba rozmow, obciazenie osob. Srednie.

### Asystent AI (nasz agent z Claude)
- **Szkice odpowiedzi** jako notatki prywatne, zatwierdzane przez czlowieka; pozniej automatyczne odpowiedzi tylko w bezpiecznych kategoriach.
- **Baza wiedzy i FAQ** z naszych dokumentow i regulaminu, wyszukiwanie po znaczeniu (pgvector).
- **Podpowiedzi FAQ** z rozwiazanych rozmow.
- **Pomocnik pracownika (copilot)**: czat w panelu ("podsumuj rozmowe", "co odpowiedziec").
- **Narzedzia asystenta** (tylko odczyt): status konta i weryfikacji w naszej bazie, wplaty ze Stripe, ostatnie bledy logowania; ewentualnie status uslug.
- **Klasyfikacja wynikow rozmow** ("rozwiazane przez AI", "przez czlowieka", "bez odpowiedzi") i **statystyki asystenta**.
- **Masowe akcje** (zamykanie, etykietowanie, przydzielanie wielu rozmow naraz).
- **Pobieranie wlasnych stron do bazy wiedzy** (nasz crawler dla naszej strony i dokumentacji).

### Pozniej albo wcale
- **Kampanie wychodzace**: razem z wlasna wysylka poczty i drugim serwerem (docs/research/serwerek/07-self-hosted-mail.md).
- **Publiczne centrum pomocy** (artykuly), np. strona `/pomoc` generowana z FAQ.
- **Logowanie SAML i weryfikacja urzadzen**: niepotrzebne, mamy Cloudflare Access i Google.
- **Rozmowy glosowe i WhatsApp**: wymagaja operatora telefonii, poza zakresem.
- **Wlasne domeny, onboarding, integracje z zewnetrznymi CRM i kalendarzami**: tylko jesli kiedys beda potrzebne.

Zasady dla kazdej z tych opcji: pisana od zera przez nas, bez kopiowania cudzego kodu; sekrety tylko w `.ai-secrets`; agent AI nie wysyla niczego do klienta bez zatwierdzenia; kazda zmiana opisana tutaj i w `CLAUDE.md`, jesli zmienia niezmienniki.
