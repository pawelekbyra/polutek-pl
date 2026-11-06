# nasza-gazetka.pl: migracja z Vercela na serwer

Stan zweryfikowany (serwer, Cloudflare API, publiczny DNS): **2026-11-03, ok. 23:00 CET** (cutover wykonany ok. 22:58 CET = 21:58 UTC).
**Skrót: PRZEŁĄCZONE. `nasza-gazetka.pl` (apex) obsługuje nasz serwer przez tunel Cloudflare (CNAME proxied na tunel `serwerek`), `www` → apex 301, noindex wszędzie. Vercel jest tylko zapasem (projekt i domeny w nim zostają 7 dni, do ok. 2026-11-10; nic tam nie usuwano). Wersja serwowana to nowy portal newsowy (ten sam build co `test-gazetka`).**

## Co to jest

Statyczna strona (eksport Next.js 14.2.3, `output: 'export'`, 12 adresów: `/{pl,en,es,de,fr,cs}` i `/{lang}/prokuratura-rejonowa-w-walbrzychu`), obecnie na Vercelu. Żadnej bazy, logowania, płatności, API ani zmiennych środowiskowych. Źródło: prywatne repo GitHub `pawelekbyra/polutek`, commit **`91db05e`** (2026-06-27; nazwa repo to tylko źródło, strona nie ma związku z platformą pawelperfect). To **nie** jest repo `dziennikarski` (patrz [`DZIENNIKARSKI-EKSPERYMENT.md`](DZIENNIKARSKI-EKSPERYMENT.md)).

## Stan faktyczny

| Element | Stan |
|---|---|
| Domena | `nasza-gazetka.pl`, rejestrator home.pl (rejestracja 2026-03-09, odnowienie 2027-03-09; sprawdzić autoodnawianie) |
| Nameservery | **zmienione na Cloudflare**: `alfred.ns.cloudflare.com`, `arya.ns.cloudflare.com` (publiczne resolvery 8.8.8.8 i 1.1.1.1 już je zwracają) |
| Strefa Cloudflare | `nasza-gazetka.pl`, id `fad41f39…`, status **`active`** od 2026-11-03 16:42 UTC (po zmianie NS w home.pl) |
| Rekordy w strefie | **po cutoverze**: `CNAME @` i `CNAME www` → tunel (proxied), `MX @ 0 .` (null MX), `TXT @ v=spf1 -all`, `TXT _dmarc v=DMARC1; p=reject; adkim=s; aspf=s`, `TXT @ google-site-verification=…` (zachować). Poprzednie rekordy Vercela (`A 216.198.79.1`, `CNAME www b94284e245ccde39.vercel-dns-017.com`) są w skrypcie rollbacku |
| Co widzi świat | `nasza-gazetka.pl` → adresy Cloudflare (104.21.x / 172.67.x) → tunel → nasz serwer (`server: cloudflare`, brak `x-vercel-id`) |
| Tunel `serwerek` | hostnames już dodane: `nasza-gazetka.pl`, `www.nasza-gazetka.pl`, `test-gazetka.pawelperfect.com` → `http://127.0.0.1:3300` (przed regułą 404). Kopia konfiguracji sprzed zmiany: `/opt/serwerek/apps/cloudflared/tunnel-config-pre-nasza-gazetka-20261103-173340.json` |
| Ustawienia strefy | SSL `full`, „Always use HTTPS” włączone, min. TLS 1.2, HSTS wyłączone, reguła 301 www → apex (utworzona przez `cutover.sh to-tunnel`) |
| Wersja testowa | `https://test-gazetka.pawelperfect.com/` → 200 (tunel + CNAME w strefie `pawelperfect.com`), `noindex` |
| Kontener | `nasza-gazetka-web` healthy, `127.0.0.1:3300` |
| Strona | zbudowana: 124 pliki, 58 MB w `/opt/serwerek/data/nasza-gazetka/site` |
| Poczta | domena **bez poczty** (null MX), choć strona wyświetla adresy `marlow@` i `kontakt@nasza-gazetka.pl`: wiadomości na nie nie dotrą (ryzyko zgłoszone właścicielowi) |

Czego nie ustalono z serwera: czy porównanie 12 adresów z produkcją Vercel (statusy, rozmiary, zrzuty, obrazy z R2, nagłówki) zostało w pełni wykonane i zaakceptowane; decyzji właściciela o terminie przełączenia i o indeksacji po przełączeniu.

## Jak to działa na serwerze

| Rzecz | Wartość |
|---|---|
| Katalog | `/opt/serwerek/apps/nasza-gazetka/`: `docker-compose.yml`, `nginx/` (`nginx.conf`, `common-headers.conf`, `robots.txt`), `build.sh`, `cutover.sh` (600), `patches/nasza-gazetka-noindex-canonical.patch` |
| Dane | `/opt/serwerek/data/nasza-gazetka/site/` (zbudowana strona, montowana tylko do odczytu), `…/nasza-gazetka-src-91db05e.tar.gz` (źródło) |
| Kopie źródła | `/opt/claude/research-migration/nasza-gazetka-src-91db05e.tar.gz` (+ `.sha256`) i `/opt/serwerek/data/nasza-gazetka/…`; zrzut DNS z home.pl: `/opt/claude/research-migration/dns-snapshot-nasza-gazetka.pl-*/` oraz `DNS-HOME-PL-nasza-gazetka.pl-panel-2026-11-03.md` (zrzut z panelu: dokładnie 3 rekordy) |
| Kontener | `nasza-gazetka-web` (`nginx:1.27-alpine`, użytkownik 101, `read_only`, `cap_drop: ALL`, `no-new-privileges`, 64 MB, 0,25 CPU, `pids_limit 64`), sieć `nasza-gazetka-net`, `127.0.0.1:3300 → 8080` |
| nginx | tylko GET/HEAD (405), `www.nasza-gazetka.pl` → 301 na apex, adresy z końcowym `/` → 308 bez ukośnika (jak na Vercelu), `/_next/static/` z `immutable` na rok, obrazy i media na dobę, gzip (brotli robi Cloudflare), `limit_req` 30/s i `limit_conn` 40 na IP z `CF-Connecting-IP`, `/healthz`, ukryte pliki 404, własna `404.html` |
| Nagłówki (`common-headers.conf`) | `X-Robots-Tag: noindex, nofollow, noarchive`, `nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`, COOP, CSP (dozwolone: `self`, inline, `cdn.jsdelivr.net`, `https:` dla obrazów/mediów/połączeń) |
| Sekrety | brak (strona statyczna); tokeny Cloudflare dla `cutover.sh` w `/root/.ai-secrets/secrets.env` przez `/root/cf-helper.sh` |

### Budowa strony

    cd /opt/serwerek/apps/nasza-gazetka && ./build.sh

`build.sh`: odmawia pracy, gdy trwa wdrożenie produkcji (`flock` na `/opt/serwerek/apps/polutek/.deploy.lock`) lub dostępne jest mniej niż 2500 MB RAM; rozpakowuje źródło do `/opt/claude/nasza-gazetka-build/src` (katalog roboczy, można kasować), nakłada patch, buduje w `node:22-alpine` (2 GB, `nice`, `yarn install --ignore-scripts`, `yarn build`) i **dopiero po sukcesie** podmienia zawartość `site/` w miejscu (nie przenosi katalogu, bo jest zamontowany w kontenerze). Restart nginx niepotrzebny. Czas ok. 1–2 min po zbudowaniu zależności.
Patch (`nasza-gazetka-noindex-canonical.patch`): apex jako baza adresów, poprawny `canonical` (zamiast `…/undefined/`), `meta robots noindex`, usunięte `robots.ts`, `sitemap.ts` i Vercel Analytics.
Zmiana treści strony = nowe źródło (tarball) + `build.sh`; po przełączeniu domeny nie ma już Vercela, który budowałby ją z GitHuba.

### Uruchomienie / zatrzymanie

    cd /opt/serwerek/apps/nasza-gazetka
    docker compose up -d      # start
    docker compose ps         # healthy
    docker compose restart    # po zmianie nginx/*
    docker compose down       # stop (site/ i dane zostają)

## Przełączenie domeny (cutover) i rollback

**Stan: PRZEŁĄCZONE 2026-11-03 ok. 21:58 UTC** (`cutover.sh to-tunnel`, zgoda właściciela w czacie). Rekordy: `CNAME @` i `CNAME www` → `a61ae173-0747-492e-9fa5-47692e43c1a7.cfargotunnel.com` (proxied); reguła 301 www → apex w rulesecie `http_request_dynamic_redirect`; MX null, SPF `-all`, DMARC reject i TXT google-site-verification zachowane. Certyfikat: Let's Encrypt (CN YE1) z Cloudflare Universal SSL, ważny 2026-11-03 – 2027-02-01. Kopia rekordów sprzed zmiany: `/opt/claude/research-migration/dns-backup-nasza-gazetka.pl-przed-cutover.json` (wcześniej brak reguły przekierowań w strefie).

**Jak wrócić na Vercel (rollback, ok. 1–5 min):** na serwerze `cd /opt/serwerek/apps/nasza-gazetka && ./cutover.sh to-vercel` (kasuje CNAME-y na tunel, odtwarza `A @ 216.198.79.1` i `CNAME www b94284e245ccde39.vercel-dns-017.com`, DNS-only, TTL 300, czyści regułę 301). Weryfikacja: `./cutover.sh status`, `curl -sI https://nasza-gazetka.pl/` (ma być `x-vercel-id`). Do końca okresu zapasowego (ok. 2026-11-10) domeny muszą zostać w projekcie Vercel; po tym terminie rollback wymagałby ich ponownego dodania. Awaryjnie, gdyby Cloudflare był niedostępny: NS w home.pl z powrotem na `dns/dns2/dns3.home.pl`.

`cutover.sh` (tylko po zgodzie właściciela; wymaga strefy `active` i działającego `:3300`):

    ./cutover.sh status       # lista rekordów strefy
    ./cutover.sh to-tunnel    # usuwa A/CNAME Vercela; tworzy CNAME apex i www → tunel (proxied, TTL auto); reguła 301 www → apex
    ./cutover.sh to-vercel    # ROLLBACK: przywraca A 216.198.79.1 i CNAME Vercela (DNS-only, TTL 300), usuwa regułę przekierowania

Bezpieczne kolejne kroki: sprawdzić `test-gazetka` na urządzeniach (mobile), ustalić indeksację (patrz niżej), wykonać `to-tunnel`, odczekać aż Cloudflare Universal SSL pokryje apex i `www` (minuty), sprawdzić 12 adresów, `www` → apex 301, nagłówki i certyfikat, obserwować 7 dni, dopiero potem wyłączyć projekt Vercel (`nasza-gazetka.pl`, domeny `nasza-gazetka.pl`, `www`). Rekordy Vercela są zachowane w skrypcie rollbacku; rollback poza skryptem = przywrócenie NS `dns/dns2/dns3.home.pl` (rekordy w home.pl nietknięte).
Certyfikat Vercela (Let's Encrypt) jest ważny do 2026-12-10; po przełączeniu certyfikat wystawia Cloudflare.

## Redesign: serwis informacyjny (2026-11-03, tylko strona testowa)

Strona główna każdego języka (`/pl`, `/en`, `/es`, `/de`, `/fr`, `/cs`) jest teraz portalem newsowym: masthead „Nasza Gazetka”, pasek z datą i przełącznikiem języka, nawigacja działów (kotwice do sekcji strony głównej, bez podstron), **artykuł przewodni**, kolumna „Wybór redakcji”, siatka „Najnowsze” i sekcje działów (Śledztwa, Prawo, Społeczeństwo, Opinie, O nas). Każdy artykuł ma adres `/<lang>/<slug>` (ten sam slug we wszystkich językach), łącznie 67 stron (`/`, 6 stron głównych, 10 artykułów x 6 języków).

| Slug | Dział | Rodzaj |
|---|---|---|
| `eliksir-wiedzmina` (CD Projekt, dawniej `/<lang>`) | Śledztwa | prawdziwy, **przewodni** |
| `prokuratura-rejonowa-w-walbrzychu` | Śledztwa | prawdziwy |
| `jak-zlozyc-wniosek-o-informacje-publiczna`, `jak-czytac-wyrok-sadowy`, `czym-jest-przedawnienie-karne`, `jak-dziala-sprawa-karna` | Prawo | atrapa |
| `jak-chronic-zrodla-dziennikarskie`, `jak-weryfikowac-informacje-w-sieci` | Społeczeństwo | atrapa |
| `dlaczego-jawnosc-rozpraw-ma-znaczenie`, `po-co-nam-media-lokalne` | Opinie | atrapa |

Przewodni jest materiał o CD Projekt: najlepiej udokumentowany (wyroki, księgi wieczyste, Onet) i ma okładkę. Zmiana przewodniego = przeniesienie `lead: true` w `app/data/articles.ts`.

**Gdzie co jest w kodzie** (źródło w prywatnym repo `polutek`):

* `app/data/articles.ts`: jedna lista artykułów (slug, dział, data, okładka, `placeholder`, `lead`) oraz lista „Wybór redakcji” (`sidePickSlugs`);
* `app/data/ui.ts`: teksty interfejsu w 6 językach (działy, etykiety, daty);
* `app/data/placeholders/<slug>.ts`: treść atrap w 6 językach (PL napisany, reszta zwięzłe tłumaczenia), rejestr w `placeholders/index.ts`;
* `app/components/portal/*`: nagłówek, stopka, karty, szablon artykułu, okładki SVG (`CoverArt`, bez zdjęć i twarzy);
* `app/(localized)/[lang]/page.tsx` (strona główna), `[slug]/page.tsx` (szablon atrap), `eliksir-wiedzmina/` i `prokuratura-…/` (prawdziwe artykuły, treść bez zmian, dodany nagłówek i „powiązane”);
* `app/(localized)/[lang]/layout.tsx` ustawia `<html lang>` z adresu (wcześniej zawsze `pl`), `app/(hub)/` to strona wyboru języka `/`.

**Atrapy** mają `placeholder: true` i widoczny znacznik „Materiał przykładowy” (karta, strona artykułu, nota, stopka). Nie zawierają nazwisk, instytucji ani spraw. **Zastąpienie prawdziwym artykułem:** (1) dodaj artykuł (komponent + treść, wzór: `PlaceholderArticle` lub `eliksir-wiedzmina/page.tsx`); (2) w `articles.ts` ustaw `placeholder: false` (znacznik znika) albo usuń wpis, plik `placeholders/<slug>.ts` i wpis w `placeholders/index.ts`; (3) gdy nie zostanie żadna atrapa, stopka sama przestaje pokazywać notkę. Pozycje „Wybór redakcji” zmieniasz w `sidePickSlugs`.

**Odtworzenie:** patche w `apps/nasza-gazetka/patches/`: `nasza-gazetka-noindex-canonical.patch`, potem `nasza-gazetka-redesign.patch` (względem commita `91db05e` + pierwszy patch). `build.sh` stosuje wszystkie `*.patch` alfabetycznie; `SKIP_REDESIGN=1 ./build.sh` buduje starą wersję. Pełny tarball źródła: `/opt/claude/nasza-gazetka-src-redesign-2026-11-03.tar.gz`; różnica względem `91db05e` w jednym pliku: `/opt/claude/gazetka-redesign/redesign-full-vs-91db05e.patch` (do `git apply` w repo `polutek`). Kopia poprzedniej strony: `/opt/serwerek/data/nasza-gazetka/site.bak-2026-11-03` (rollback: `rsync -a --delete site.bak-2026-11-03/ site/`).

**Uwagi:** `site/` serwuje zarówno test-gazetka, jak i (po cutoverze) apex, więc `cutover.sh to-tunnel` opublikuje już redesign. Adres `/<lang>` przestał być artykułem CD Projekt (jest nim `/<lang>/eliksir-wiedzmina`): stare linki do `/pl` prowadzą na portal. Daty atrap są umowne; data prokuratury (2026-06-27) to data commita źródła: do potwierdzenia. Tekst „O nas” jest ogólny, do akceptacji właściciela. Obrazek okładki CD Projekt ma w sobie polski napis.

## noindex i SEO

Decyzja właściciela: wszystkie nowe strony i eksperymenty mają `noindex`. Dlatego nginx dodaje `X-Robots-Tag: noindex, nofollow, noarchive`, `robots.txt` to `Disallow: /` (plik `nginx/robots.txt`), a build zawiera `meta robots noindex`.
**Konsekwencja przy przełączeniu produkcyjnej domeny:** dziś produkcja na Vercelu jest indeksowana (`robots: index, follow`); po cutoverze z `noindex` strona zniknie z wyszukiwarek. Jeśli ma być indeksowana, trzeba świadomie zmienić trzy miejsca naraz: `nginx/common-headers.conf` (usunąć `X-Robots-Tag`), `nginx/robots.txt` (np. `Allow: /` + mapa strony) i patch/build (`meta robots`, przywrócić sitemapę), potem `docker compose restart` i `build.sh`. To decyzja właściciela (nie podejmowana w dokumentacji).

## Znane ograniczenia i ryzyka

* **Kopie**: `site/` i tarball źródła leżą w `/opt/serwerek/data/…` oraz `/opt/claude/…`, które **nie są objęte** nocnym backupem (`configs-*.tar.gz` obejmuje tylko `apps/`, `docs`, `scripts`). Strona jest odtwarzalna z tarballa (sha256 w `…/research-migration/`), ale sam tarball nie ma kopii poza serwerem (prywatne repo `polutek` jest źródłem prawdy). Rozważ dopisanie `data/nasza-gazetka` do `backup.sh`.
* Wspólny serwer: budowa potrzebuje do 2 GB RAM i ok. 1–2 GB dysku (dysk ok. 82%); nie buduj w trakcie wdrożenia produkcji.
* Media z publicznego bucketu R2 (`naszagazetka`, w naszym koncie Cloudflare) i jedno odwołanie do Pinata (zewnętrzne); `public/` w repo ma ok. 55 MB. Duże pliki (np. `sim_mirrored.png` 8 MB) nie zostały zoptymalizowane.
* `@vercel/analytics` usunięty: po migracji nie ma analityki (opcja: Cloudflare Web Analytics).
* `middleware.ts` z oryginału nie działa w eksporcie statycznym; zachowanie adresów odtwarzają reguły nginx. `/` pokazuje wybór języka jak na Vercelu.
* Zmiany NS już zostały wykonane; `dns-only` rekordy do Vercela działają tak jak wcześniej, ale DNS jest teraz w Cloudflare (zmiany rekordów robimy tam, nie w home.pl). Domena jest nadal zarejestrowana w home.pl: niezapłacone odnowienie (2027-03-09) wyłączyłoby także DNS, więc pilnuj odnowienia.
* Domena bez poczty: strona wyświetla adresy e-mail w domenie bez skrzynek (jeśli kontakt ma działać, trzeba Email Routing albo zmienić adresy na stronie).

## Powiązane dokumenty

[`DOMENA-PAWELPERFECT-PL.md`](DOMENA-PAWELPERFECT-PL.md) (ta sama ścieżka: home.pl → Cloudflare) · [`DZIENNIKARSKI-EKSPERYMENT.md`](DZIENNIKARSKI-EKSPERYMENT.md) · [`STATIC-DEMO.md`](STATIC-DEMO.md) · [`SERWEREK.md`](SERWEREK.md) (tunel, backup) · [`ACCOUNTS.md`](ACCOUNTS.md).
Notatki robocze agentów (na serwerze, poza repozytorium): `/opt/claude/research-migration/NASZA-GAZETKA-STAN.md` (nieaktualny: z 15:20, sprzed budowy i zmiany NS), `DZIENNIKARSKI-MIGRACJA.md` (pełna analiza wariantów A/B).
