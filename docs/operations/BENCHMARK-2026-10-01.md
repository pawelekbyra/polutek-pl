# Pomiary CPX22 z 2026-10-01 (aplikacja, ffmpeg)

Pomiar jednorazowy z czasów testowego wdrożenia (stos `polutek-test`, usunięty z serwera): pusta lokalna baza z seedem, atrapy zmiennych, bez prawdziwych sekretów. Środowisko: Hetzner CPX22 (2 vCPU, 3,8 GB RAM + 4 GB swapu),
Ubuntu 26.04, Docker 29, Next.js 16.3.8 (Turbopack). Nowszy, pełniejszy test obciążenia z 2026-10-04 i próg „zapasu serwera”: [`LOAD-TEST.md`](LOAD-TEST.md). Opis serwera: [`SERWEREK.md`](SERWEREK.md).
Dane niżej opisują stan z tamtej daty (wcześniejszy kod, jedna instancja aplikacji); traktuj je jako rząd wielkości.

## Aplikacja

| Pomiar | Wynik |
|---|---|
| Build obrazu (zimny: `npm ci` 35 s + `next build` 35 s + eksport warstw) | ok. 2 min 47 s; kolejny build z cache: 17 s |
| Rozmiar obrazu aplikacji (standalone) | 624 MB na dysku (164 MB skompresowane) |
| Rozmiar obrazu narzędziowego (migracje/seed, pełne `node_modules`) | 3,4 GB (usunięty; dziś obraz `migrator` ma tylko `prisma`) |
| Zimny start | restart → `/api/health` 200 w 1,9 s; pierwszy `/en` 0,52 s, kolejne 0,06 s |
| RAM aplikacji: spoczynek / szczyt | 122 MiB / 240 MiB |
| RAM Postgresa: spoczynek / szczyt | 35 MiB / 69 MiB |
| Szczyt RAM systemu (aplikacja + baza + ffmpeg + autocannon) | 1,37 GB z 3,8 GB; swap praktycznie nieużywany |
| CPU aplikacji | szczyt ok. 158% (z 200%) przy `/en` |
| Lokalnie na serwerze (autocannon, 20 poł.), `/en` | 59 req/s, p50 330 ms, p99 448 ms (SSR, ograniczone CPU) |
| Lokalnie, `/api/channel/sidebar` (20 poł.) | 422 req/s, p50 44 ms, p99 103 ms |
| Przez tunel SSH z komputera (10 poł., 45 s) | `/en` 28 req/s p50 332 ms; sidebar 80 req/s p50 122 ms; `/en/regulamin` 68 req/s p50 134 ms; 0 błędów |

Pomiary przez tunel zależą od łącza domowego (ogon opóźnień jest w dużej mierze po stronie tunelu); dla samej aplikacji wiarygodne są pomiary lokalne na serwerze.

## ffmpeg

Źródło syntetyczne 1080p30, 60 s, drabinka HLS 720p 2,8 Mb/s + 480p 1,4 Mb/s, `libx264 -preset veryfast`, segmenty 6 s.

| Scenariusz | Czas transkodowania | CPU ffmpeg | Szczyt RAM ffmpeg | Aplikacja w tym czasie (`/en`, 5 poł.) |
|---|---|---|---|---|
| Sama aplikacja (odniesienie) | n/d | n/d | n/d | 49 req/s, p50 97 ms, p99 171 ms |
| ffmpeg sam | 19 s (3,2x czasu rzeczywistego) | 189% | 295 MB | n/d |
| ffmpeg bez limitów + ruch | 37 s | 96% | 295 MB | 39 req/s, p50 122 ms, p99 245 ms, 0 błędów |
| `nice -n 19` + `MemoryMax=1500M` + `CPUQuota=100%` + ruch | 43 s | 85% | 301 MB | 36 req/s, p50 128 ms, p99 306 ms, 0 błędów |

Wnioski: aplikacja pozostała responsywna przez cały czas, przepustowość SSR spadła o 20-28%, p50 wzrosło o 25-30 ms. `CPUQuota=100%` wydłużył transkodowanie o ok. 15% i nie poprawił widocznie opóźnień,
więc wystarczą `nice` i `MemoryMax` jako bezpiecznik pamięci (dziś encoder: `nice 10`, `mem_limit 1500m`, `cpu_shares 256`). RAM ffmpeg przy 720p/480p to ok. 300 MB; wąskim gardłem jest CPU (2 vCPU), nie pamięć.
Nie sprawdzono: drabinek 1080p/4K, wielu równoległych transkodowań, logowania i płatności; źródło było syntetyczne (`testsrc2`).

## Werdykt z tamtej daty

CPX22 wystarczał na aplikację, Postgresa i jedno zadanie ffmpeg naraz przy małym ruchu (pamięć z dużym zapasem, ok. 50-60 renderów strony głównej na sekundę lokalnie). Powiększenie (CPX32: 4 vCPU, 8 GB) ma sens
przy stałym ruchu powyżej ok. 30 renderów strony na sekundę, równoległych albo 1080p+ transkodowaniach lub bazie powyżej ok. 1 GB; opcje i ceny: `STATUS.md` (sekcja „Hetzner: powiększenie i przenoszenie”).
Wideo dla widzów idzie z Cloudflare, więc ruch wideo nie wlicza się do powyższych obciążeń.
