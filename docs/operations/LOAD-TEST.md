# Test obciążenia serwera (serwerek)

**Data:** 2026-10-04 (07:59–08:38 UTC i 10:45–10:56 UTC).
**Obraz aplikacji w teście głównym:** `polutek-app:m10040944` (`/opt/serwerek/apps/polutek/.current-image`).
Liczenie zapytań do bazy powtórzono po wdrożeniu `polutek-app:pol10041252` (wynik dla strony głównej identyczny).
**Serwer:** Hetzner CPX22 (2 vCPU, 4 GB RAM, swap 4 GB), Docker Compose: `app` (limit 1 GiB), `db`
(Postgres 17, limit 512 MiB, `shared_buffers=128MB`), `redis` + `srh`, `encoder`, obok PP Support.
**Skrypty:** `scripts/loadtest/` (README tam opisuje uruchomienie, bezpieczniki i sprzątanie).

## Najważniejsze w skrócie

- Serwer obsługuje około **16 nowych gości na sekundę (~960 na minutę)**, zanim czasy odpowiedzi wyraźnie
  się pogorszą. Przy **8 na sekundę (~480 na minutę)** działa tak, jakby nikogo nie było.
- Powyżej **~17 na sekundę (~1000 na minutę)** serwer się zatyka: odpowiedzi rosną do 10–18 s, a aplikacja
  zajmuje coraz więcej pamięci (do ~830 MiB z limitu 1 GiB), co grozi jej restartem.
- **Wąskie gardło: procesor aplikacji (jeden proces Node.js/Next.js).** Baza danych, Redis i dysk mają duży
  zapas (baza 10–20% jednego rdzenia, 1–2 aktywne zapytania naraz).
- Połowa kosztu wizyty to **renderowanie strony głównej** (~45 ms procesora i **44 zapytania do bazy** na
  każde wejście), a strona jest dla każdego gościa taka sama. Cache strony dla gości da największy zysk.
- Drugi problem: **pamięć aplikacji nie wraca po szczycie** (po teście ~895 MiB przez 2 godziny, aż do
  restartu), a proxy miniatur przy 64 żądaniach/s podbiło ją w 15 s z 740 do 925 MiB.

## Co to znaczy dla właściciela

Jedna „podróż widza” = to, co serwer robi przy pierwszym wejściu nowego gościa: strona główna + lista filmów
+ komentarze + plan odtwarzania + jedna miniatura. Samo wideo idzie z Cloudflare (R2 + Worker), nie z serwera.

| Szczyt nowych widzów na minutę | na sekundę | Czy serwer wystarczy? |
|---|---|---|
| do 240 | do 4 | **Wystarczy z dużym zapasem.** Czasy jak bez ruchu. |
| 480 | 8 | **Wystarczy.** Cała wizyta w 0,25 s (95% wejść), procesor aplikacji ~85%. |
| 960 | 16 | **Na granicy.** Działa bez błędów, ale strona główna ładuje się do 0,7–1 s; brak zapasu na oglądających, panel i kodowanie wideo. |
| 1000 i więcej | 17+ | **Nie wystarczy.** Kolejka rośnie, odpowiedzi 10–18 s, ryzyko restartu aplikacji z braku pamięci. |
| 3000 (np. udostępnienie, które „chwyciło”) | 50 | **Nie wystarczy** bez cache strony dla gości albo większego serwera. |

Do planowania: **~500 nowych widzów na minutę bezpiecznie, ~900 na minutę maksymalnie**, na tym obrazie.
Liczby dotyczą szczytu trwającego minuty, nie sumy dziennej (500/min przez godzinę to 30 000 wejść).

Oglądający już widzowie kosztują mało: odtwarzacz wysyła sygnał co 60 s (`POST /api/videos/<id>/playback-event`).
Z kodu: ten sam rząd kosztu co `/api/media-source` (sprawdzenie dostępu, odczyt i zapis sesji, zapis zdarzenia,
~5–8 zapytań, ~7 ms procesora). **1000 osób oglądających naraz ≈ 17 sygnałów/s ≈ 8% mocy aplikacji**, czyli tyle,
co ~70 nowych widzów na minutę. Tego rodzaju żądań test nie wysyłał (zakaz zapisów).

## Metoda

- Generator: k6 1.3.0 w jednorazowym kontenerze **na serwerze** (`--network host --cpus 0.5 --memory 256m`),
  cel `http://127.0.0.1:3000` z nagłówkiem `Host: www.pawelperfect.com`, z pominięciem Cloudflare.
  Generator zabierał aplikacji 4–10% procesora, więc wyniki są **dolnym oszacowaniem**.
- Tylko żądania gościa, tylko odczyt: `GET /pl`, `/api/channel/sidebar`, `/api/comments`,
  `/api/media-source/<id>`, `/api/videos/<id>/thumbnail` dla publicznego filmu `czesc`
  (`c52f0407-…`, 13 komentarzy). Każde żądanie: `User-Agent: pp-loadtest/1`.
- Każda iteracja ma inny adres `CF-Connecting-IP` z puli `198.18.0.0/15` (RFC 2544, zakres do testów
  wydajności). Aplikacja ufa temu nagłówkowi za tunelem, więc każda iteracja wygląda jak nowy gość, a limity
  na adres IP działają jak w produkcji (bez tego `/api/media-source` po 60 żądaniach odpowiadałby 429).
- Obciążenie: stała liczba iteracji na sekundę (model „otwarty”, jak prawdziwi goście), schodki po 60 s,
  podwajane, 30 s przerwy, przed każdym schodkiem kontrola (brak deployu i kodowania, ≥ 600 MB wolnej pamięci,
  load < 3). Seria kończy się na pierwszym schodku, w którym serwer nie nadąża (< 90% zaplanowanych iteracji),
  p95 przekracza 2 s (podróż) / 1 s (pojedyncze adresy) albo jest > 2% błędów 5xx.
- Podróż: najpierw `GET /pl`, potem równolegle (jak przeglądarka) lista filmów, komentarze, plan odtwarzania
  i miniatura przez proxy. Prawdziwa przeglądarka bierze miniaturę opublikowanego filmu wprost z R2
  (`thumbs.pawelperfect.pl`), za to woła jeszcze kilka drobnych adresów (m.in. `/api/auth/get-session`),
  których test nie mierzył; obie różnice są małe i w przybliżeniu się znoszą.
- Liczba zapytań do bazy: 100 kolejnych żądań jednym wątkiem, różnica `pg_stat_database`
  (`xact_commit + xact_rollback`) minus tło zmierzone przez ten sam czas bez ruchu
  (`pg_stat_statements` nie jest włączone i test go nie włączał). Każde zapytanie Prisma poza transakcją to
  jedna transakcja, więc to dolna granica liczby zapytań.

## Bezpieczniki (`scripts/loadtest/guard.sh`, próbka co ~5 s)

Przerwanie generatora, gdy: wolna pamięć < 400 MB; swap urósł o > 1 GB ponad stan z początku (na serwerze
bez ruchu jest już ~1,5–1,7 GB swapu, więc próg bezwzględny 3 GB byłby za późny); load1 > 6 przez 20 s;
restart `polutek-app-1`; **pamięć `polutek-app-1` > 900 MiB** (dodane po pierwszej serii, bo limit kontenera
to 1 GiB). k6 sam przerywa przy > 2% błędów 5xx/timeoutów.

Co zadziałało:
- **Bezpiecznik pamięci aplikacji** przerwał schodek „miniatury 64/s” po ~15 s (740 → 925 MiB). Wynik tego
  schodka nie istnieje; to jest właśnie znalezisko o pamięci.
- Kontrola przed schodkiem raz wstrzymała liczenie zapytań, bo ruszył prawdziwy deploy (`pol10041252`);
  liczenie dokończono po jego zakończeniu.
- Nic poza tym: 0% błędów 5xx we wszystkich schodkach, brak restartu aplikacji, swap bez wzrostu
  (maks. 1,59 GB), najniższa wolna pamięć ~670 MB, najwyższy load1 4,9 (komentarze 256/s).

Incydent: sesja agenta została przerwana limitem w trakcie serii, a `guard.sh` działał potem sam przez ~2 h
(tylko odczyty i próby zabicia nieistniejącego generatora). Dlatego `guard.sh` ma teraz `GUARD_MAX_SECONDS`
(domyślnie 1 h) i kończy się sam.

## Wyniki

Czasy w milisekundach: p50 / p95 / p99. „Nie nadąża” = serwer obsłużył mniej, niż zaplanowano.

### Podróż widza (5 żądań na iterację)

| Przebieg | Podróże/s (plan → wykonane) | Żądania/s | p50 | p95 | p99 | Strona główna p50/p95/p99 | CPU aplikacji (śr.) | CPU bazy | Pamięć aplikacji (maks.) |
|---|---|---|---|---|---|---|---|---|---|
| ciepły | 2 → 2,0 | 10 | 39 | 242 | 286 | 77 / 96 / 114 | 31% | 2% | 206 MiB |
| ciepły | 4 → 4,0 | 20 | 36 | 246 | 280 | 79 / 99 / 114 | 58% | 5% | 270 MiB |
| ciepły | 8 → 8,0 | 40 | 29 | 239 | 278 | 53 / 81 / 112 | 81% | 9% | 387 MiB |
| ciepły | 16 → 15,9 | 80 | 80 | 545 | 994 | 157 / 994 / 1095 | 125% | 12% | 601 MiB |
| ciepły | 32 → **17,1, nie nadąża** | 85 | 694 | 15 556 | 18 144 | 2265 / 10 151 / 14 534 | 145% | 11% | 828 MiB |
| zimny (zaraz po restarcie) | 8 → 8,0 | 40 | 31 | 250 | 340 | 55 / 108 / 707 | 88% | 8% | 290 MiB |
| ciepły, powtórka | 8 → 8,0 | 40 | 29 | 237 | 288 | 53 / 82 / 122 | 84% | 8% | 401 MiB |
| ciepły, powtórka | 16 → 15,9 | 80 | 62 | 393 | 729 | 146 / 729 / 864 | 128% | 13% | 632 MiB |

CPU w % jednego rdzenia (serwer ma 2, czyli 200%); aplikacja dochodzi do ~145–165%, resztę zabiera system,
baza i generator. Najwolniejszy element podróży poniżej nasycenia to miniatura przez proxy (~230 ms: pobranie
z R2), nie serwer.

Zimny start: kontener zdrowy po 7 s, pierwsze sekundy wolniejsze (strona główna p99 707 ms zamiast ~120 ms),
potem jak na ciepło. Restart nie jest problemem wydajności.

### Pojedyncze adresy

| Adres | Żądania/s (plan → wykonane) | p50 | p95 | p99 | CPU aplikacji (śr.) | CPU bazy |
|---|---|---|---|---|---|---|
| `GET /pl` (strona główna) | 16 → 16 | 43 | 81 | 229 | 76% | 8% |
| | 32 → 32 | 72 | 489 | 691 | 136% | 12% |
| | 64 → **40, nie nadąża** | 3539 | 4000 | 8996 | 164% | 15% |
| `/api/channel/sidebar` | 32 → 32 | 10 | 14 | 23 | 32% | 2% |
| | 64 → 64 | 9 | 12 | 23 | 57% | 4% |
| | 128 → 128 | 6 | 15 | 54 | 75% | 6% |
| | 256 → 256 | 5 | 86 | 146 | 105% | 6% |
| `/api/comments` | 32 → 32 | 16 | 21 | 29 | 49% | 9% |
| | 64 → 64 | 12 | 20 | 44 | 73% | 12% |
| | 128 → 128 | 7 | 48 | 88 | 92% | 15% |
| | 256 → **205, nie nadąża** | 662 | 797 | 984 | 148% | 22% |
| `/api/media-source/<id>` | 32 → 32 | 18 | 23 | 31 | 51% | 8% |
| | 64 → 64 | 13 | 22 | 59 | 70% | 11% |
| | 128 → 128 | 10 | 78 | 126 | 88% | 14% |
| | 256 → **190, nie nadąża** | 702 | 867 | 1139 | 130% | 18% |
| `/api/videos/<id>/thumbnail` (proxy) | 16 → 16 | 220 | 275 | 304 | 46% | 3% |
| | 32 → 32 | 216 | 273 | 312 | 68% | 2% |
| | 64 → **przerwane bezpiecznikiem pamięci** | – | – | – | – | – |

Maksymalna przepustowość: strona główna **~40/s**, lista filmów **> 256/s** (nie osiągnięto granicy),
komentarze **~205/s**, plan odtwarzania **~190/s**, miniatury przez proxy **≥ 32/s** (ograniczenie: pamięć).

### Koszt jednego żądania

| Adres | Procesor aplikacji (szac. z CPU / żądania/s) | Zapytania do bazy | Wiersze odczytane (`tup_returned`) | Zapisy |
|---|---|---|---|---|
| `GET /pl` | ~45 ms | **44** | ~700 | 0 |
| `/api/channel/sidebar` | ~6 ms | 3 | ~13 | 0 |
| `/api/comments` | ~7 ms | 9 | ~240 | 0 |
| `/api/media-source/<id>` | ~7 ms | 8 | ~55 | 1 wiersz `VideoPlaybackSession` |
| `/api/videos/<id>/thumbnail` | ~20 ms + bufor obrazu w pamięci | 1 | – | 0 |
| **cała podróż** | **~100 ms** | **66** | ~1000 | 1 |

Strona główna sama robi dwie trzecie zapytań całej wizyty i ~45% jej kosztu procesora.

## Wąskie gardło

1. **Procesor aplikacji.** Jeden proces Node.js wykorzystuje ~1,5 rdzenia; przy tym poziomie kolejka żądań
   rośnie, a czasy skaczą z ułamków sekundy do kilkunastu sekund. Baza ma 80–90% zapasu procesora.
2. **Pamięć aplikacji.** Rośnie z ruchem (95 MiB po starcie → ~600 MiB po 3 minutach 16 podróży/s → ~830 MiB
   przy przeciążeniu) i nie spada po szczycie. Proxy miniatur trzyma obrazy w buforach poza stertą JS i najszybciej
   ją podbija. Limit kontenera to 1 GiB, domyślny limit sterty V8 w tym kontenerze ~524 MB: przy dłuższym
   przeciążeniu realne jest zabicie procesu (OOM) i restart, czyli chwilowa niedostępność strony.

## Rekomendacje (od największego zysku)

1. **Cache strony głównej dla gości** (bez ciasteczka sesji). Strona jest dla każdego gościa taka sama, a CSP
   nie używa nonce (`lib/utils/security.ts`), więc gotowy HTML można bezpiecznie podać wielu osobom.
   Krótki czas życia (np. 30–60 s) w Cloudflare (reguła cache z pominięciem, gdy jest ciasteczko sesji) albo
   cache danych po stronie Next.js zdejmuje ~45% kosztu wizyty i 44 z 66 zapytań. Szacunek: 2× więcej
   nowych widzów na minutę.
2. **Mniej zapytań na render strony głównej** (44 → kilka): te same dane czytane wielokrotnie w jednym
   żądaniu (`React.cache`, jedno zapytanie zamiast wielu). Mniej pracy procesora aplikacji, krótszy czas
   pierwszego bajtu nawet bez cache.
3. **Pamięć:** ustawić `NODE_OPTIONS=--max-old-space-size` spójnie z limitem kontenera (np. 640 przy 1 GiB)
   i zbadać, co trzyma ~900 MiB po szczycie; miniatury opublikowanych filmów już idą z R2, ale proxy warto
   objąć cache Cloudflare (odpowiedź ma `s-maxage`, a Cloudflare domyślnie nie cache'uje ścieżek `/api/`).
4. **Większy serwer dopiero potem.** Więcej rdzeni pomoże tylko z 2+ procesami aplikacji (np. CPX32: 4 vCPU,
   8 GB i dwie repliki `app`): ~2× przepustowości. Punkty 1–3 dają podobny zysk bez kosztu.
5. Baza danych, Redis i dysk nie wymagają zmian przy tym ruchu.

## Jak powtórzyć (te same schodki)

Instrukcja i sprzątanie: `scripts/loadtest/README.md`. Plan użyty w tym teście (zmienne:
`VIDEO_ID=<publiczny film>`, `OUT_DIR=/tmp/pp-loadtest/out`, `K6_IMAGE=grafana/k6:1.3.0`):

```bash
STEP_SECONDS=15 LABEL=smoke ./run-steps.sh journey 1 1
LABEL=journey-warm ./run-steps.sh journey 2 64               # 2, 4, 8, 16, 32
STOP_P95_MS=1000 ./run-steps.sh home 16 64                   # 16, 32, 64
STOP_P95_MS=1000 ./run-steps.sh sidebar 32 256
STOP_P95_MS=1000 ./run-steps.sh comments 32 256
STOP_P95_MS=1000 ./run-steps.sh media 32 256
STOP_P95_MS=1000 ./run-steps.sh thumb 16 128
docker restart polutek-app-1   # potem nowy guard.sh
LABEL=journey-cold ./run-steps.sh journey 8 8
LABEL=journey-warm2 ./run-steps.sh journey 8 16
for t in home sidebar comments media thumb journey; do ./count-queries.sh $t 100; done
```

Pojedyncze adresy zaczynają od tempa, które podróż już bezpiecznie przeszła (16 podróży/s = 16 żądań/s
każdego adresu). Łączny czas obciążenia ~27 min. Porównując po zmianach, patrz na: maksymalne podróże/s,
p95 przy 8 i 16 podróżach/s, zapytania na `GET /pl` i pamięć aplikacji po serii.

## Sprzątanie po teście (wykonane)

- Usunięte 29 969 wierszy `VideoPlaybackSession` utworzonych przez test (`userAgentHash = sha256('pp-loadtest/1')`,
  bez użytkownika; test nie wysyłał zdarzeń odtwarzania). Po teście w tabeli 3326 wierszy (przed testem 3300,
  różnica to zwykły ruch).
- Usunięty obraz `grafana/k6:1.3.0` i katalog `/tmp/pp-loadtest`; brak procesów i kontenerów testu.
- Klucze limitów w Redis (po jednym na adres testowy) wygasają same po 60 s.
- Restart `polutek-app-1` (ten sam obraz) przed pomiarem zimnego startu; `/api/health` = 200.
- Wpisy `ai-log` (`AI_AGENT=claude-loadtest`) na początku, przy wznowieniu i na końcu.
