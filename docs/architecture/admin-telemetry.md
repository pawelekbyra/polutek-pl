# Telemetria panelu administratora: badanie, decyzje, budowa (faza 0)

Stan: 2026-10-04. Dotyczy fazy 0 z [`admin-panel.md`](admin-panel.md) §4. Ten plik opisuje to, co **jest w kodzie**;
miejsca, w których zmieniłem założenia `admin-panel.md`, są oznaczone **[zmiana]**.

## 1. Wnioski z badania (październik 2026)

| Temat | Co mówią źródła | Co z tego wynika dla nas |
|---|---|---|
| Odwiedzający bez cookies | Plausible: `hash(dzienna sól + domena + IP + UA)`, sól zmieniana i kasowana co 24 h, surowe IP i UA nie są zapisywane [1]. Umami: bez cookies [2]. | Ten sam schemat: `sha256(sól dnia ‖ IP ‖ UA ‖ host)`, pierwsze 64 bity. Sól w `telemetry.daily_salt`, jedna na dobę Europe/Warsaw, kasowana zaraz po dniu. |
| **Prawo: art. 5(3) ePrivacy / art. 399 PKE** | EDPB 2/2023 (wersja 2, 7.10.2024): skrypt, który każe przeglądarce wysłać informację (piksel, beacon, odczyt danych urządzenia), to „uzyskanie dostępu” w rozumieniu art. 5(3), także bez cookies [3]. Art. 399 ust. 3 PKE zwalnia ze zgody tylko transmisję i to, co „niezbędne” do usługi, której zażądał użytkownik; **wyjątku dla analityki nie ma** [4]. Hiszpania (AEPD) i Francja (CNIL) tolerują ograniczoną analitykę bez zgody (bez śledzenia między serwisami, retencja ≤ 25 mies.) [5]. Digital Omnibus (projekt z 11.2025, art. 88a RODO) wprowadza wyjątek „pomiar oglądalności przez administratora na własny użytek”, ale jest nadal w procesie legislacyjnym [6]. | **[zmiana]** `admin-panel.md` §2 twierdził, że pomiar bez zapisu na urządzeniu „nie wymaga zgody (art. 399 PKE)”. To nie jest pewne: po EDPB 2/2023 beacon z Web Vitals i jakością odtwarzania może podlegać art. 399. Zrobiłem wszystko, co ogranicza ryzyko (bez cookies, bez identyfikatora na urządzeniu, sól dzienna, brak łączenia z kontem, GPC/DNT = brak zbierania i sprzeciw, retencja jak CNIL, jawny opis w polityce), a beacon ma **wyłącznik bez przebudowy** (`TELEMETRY_BEACON=off`). Ostateczna ocena: prawnik, przed startem publicznym (pytanie w STATUS.md). |
| Web Vitals | `web-vitals` 6.x (07.2026): bez FID, INP z atrybucją, obsługa soft navigation; raporty LCP/CLS/INP przychodzą przy ukryciu strony [7]. | `web-vitals` 6.2.2 z paczki npm (bez CDN), ładowane leniwie; nasza kolejka opróżnia się po ich nasłuchach `visibilitychange`. Rollup trzyma p50/p75/p95 i liczby good / needs-improvement / poor. |
| QoE odtwarzacza | Mux Data: czas startu (żądanie odtworzenia → pierwsza klatka), wyjście przed startem, rebuffering (zastoje po pierwszej klatce, bez czasu po przewinięciu), błędy fatalne, rendycje. | `PlaybackQoeTracker` liczy dokładnie to; błędy jako klasy (`hls:<type>:<details>`, `media:<code>`), nigdy treść ani URL. Krzywa retencji z `video.played` (100 kubełków po 1%). |
| Cloudflare GraphQL / Workers Analytics Engine | GraphQL: 300 zapytań / 5 min, zbiory adaptacyjne ≥ 31 dni na każdym planie [8]. WAE na planie Free: 100 tys. punktów zapisu i 10 tys. zapytań dziennie [9]. | Opcjonalny moduł kolektora (`services/pp-collector/src/cloudflare.ts`) odpytuje GraphQL co 15 min i zapisuje migawki Worker HLS oraz hosta video. Wyniki są adaptacyjnie próbkowane, więc służą jako estymacja i alert z zapasem. WAE nie jest potrzebne. |
| Postgres jako magazyn | Partycjonowanie deklaratywne opłaca się głównie przy usuwaniu starych danych (`DROP` partycji zamiast `DELETE` i `VACUUM`) [10]; BRIN dla kolumn czasu rosnących z wstawianiem [11]. | Miesięczne partycje surowych tabel + partycja `DEFAULT`, BRIN na `ts`, retencja przez `DROP` całych partycji i `DELETE` reszty. Przy 10 tys. wizyt/mies. to kilkadziesiąt MB rocznie. |
| `pg_stat_statements` | W kontrybucjach obrazu `postgres:17-alpine`; wymaga `shared_preload_libraries` (restart) [12]. | Osobny PR (operacje), restart w oknie nocnym. |

## 2. Przepływ danych

```
przeglądarka (TelemetryBeacon, navigator.sendBeacon, 1-3 żądania na odsłonę)
  -> POST https://www.pawelperfect.com/api/t      (Next: zawsze 204 od razu, bez cookies)
     -> after(): POST http://collector:3200/api/t  (sieć compose; IP z CF-Connecting-IP, kraj z CF-IPCountry)
        -> pp-collector: zod, DNT/GPC, boty, Origin, limit, hash odwiedzającego, bufor
           -> co 2 s: INSERT wsadowy do telemetry.{page_view, web_vital, playback} (rola pp_collector)
           -> co 5 min: telemetry.rollup_day(dziś, wczoraj) -> r_traffic_daily, r_vitals_daily, r_video_daily
           -> co 15 min (jeśli skonfigurowany token): Cloudflare GraphQL -> telemetry.external_snapshot
           -> co 6 h: ensure_partitions() + apply_retention(90 dni, 25 mies.); wpis w telemetry.job_run
panel (faza 1+): rola pp_analytics_ro czyta r_* i job_run
```

**[zmiana]** względem `admin-panel.md` §2 („`/api/t` → Redis Stream → pp-collector”):
- **Bez Redis Stream.** Redis na serwerze ma `maxmemory-policy allkeys-lru` (zdarzenia mogłyby znikać przy braku pamięci), a dostęp idzie przez bramkę `srh`, którą audyt operacji zaleca usunąć. Zamiast tego Next przekazuje treść beaconu do kolektora po wysłaniu odpowiedzi (`after()`), a kolektor buforuje w pamięci (do 20 tys. wierszy). Strona nadal nie czeka na telemetrię, a padnięty kolektor kosztuje tylko utracone statystyki.
- **Bez `userId`.** Telemetria nie łączy się z kontem (jest tylko znacznik „zalogowany tak/nie”). Atrybucja kont i napiwków (T11) pójdzie przez pola w `User`/metadane intentu Stripe, nie przez łączenie zdarzeń z kontem: tak jest prościej obronić „anonimowe statystyki” w polityce.
- **Kolektor zbiera również opcjonalne migawki Cloudflare.** Konfiguracja `CLOUDFLARE_ANALYTICS_API_TOKEN`, `CLOUDFLARE_ACCOUNT_TAG`, `CLOUDFLARE_ZONE_TAG` i `CLOUDFLARE_HLS_WORKER_NAME` pozostaje wyłącznie po stronie serwera; braki konfiguracji wyłączają poller, a awaria pollera nie wpływa na beacon ani odtwarzanie. Metryki hosta (`/proc`, cgroup), Postgres/Redis, Stripe i RDAP nadal są dalszymi modułami.

## 3. Model danych (schemat `telemetry`, migracja `20261004210000_telemetry_schema`)

Surowe (partycje miesięczne UTC, 90 dni): `page_view` (ścieżka bez query, host referera, utm_*, kraj, klasa urządzenia, przeglądarka, system, język, `signed_in`), `web_vital` (metryka, wartość, ocena, typ nawigacji), `playback` (delta jednej próby odtworzenia: start, czas startu, wyjście przed startem, czas oglądania, zastoje, błąd, bitrate, maks. wysokość, zmiany jakości, bitmapa `bit(100)`).
Agregaty (dni Europe/Warsaw, 25 mies.): `r_traffic_daily` (wymiar × wartość: odsłony i unikalni; maks. 1000 wartości na wymiar i dzień), `r_vitals_daily` (p50/p75/p95 i oceny, per urządzenie i `all`), `r_video_daily` (próby, starty, wyjścia przed startem, błędy, unikalni, czas oglądania, zastoje, czas startu p50/p95, krzywa retencji `int[100]`).
Pomocnicze: `daily_salt` (jedna sól na dzień; nie widzi jej `pp_analytics_ro`), `job_run` (każde uruchomienie zadania okresowego; 400 dni).
Funkcje: `ensure_partitions()`, `apply_retention()` (SECURITY DEFINER, tylko dla `pp_collector`), `rollup_day(date)` (idempotentna).
Role: `pp_collector` (DML tylko w `telemetry`, brak dostępu do `public`), `pp_analytics_ro` (SELECT w `telemetry`, `statement_timeout 5s`). Migracja tworzy je jako `NOLOGIN`; hasło i logowanie ustawia operator na serwerze (SERWEREK.md, „Telemetria”).
Prisma nie modeluje schematu `telemetry` (tabele partycjonowane, role i funkcje), więc `schema.prisma` się nie zmienia; testy na prawdziwym Postgresie: `tests/postgres/telemetry.pg.test.ts`.

**Wyjątek:** pomysł z `admin-panel.md` „rollup filmów przed cronem `prune-playback-sessions` (T3)” jest zbędny: nowa tabela `playback` jest niezależna od `VideoPlaybackSession`, a krzywą retencji i QoE liczymy z beaconu.

## 4. Odtwarzacz: mniej żądań

Dotąd każde zdarzenie odtwarzacza było osobnym `POST /api/videos/[id]/playback-event` (sprawdzenie dostępu, odczyt sesji, wiersz `VideoPlaybackEvent`). Zdarzenia czysto telemetryczne (`PLAYER_READY`, `SEEKED`, `BUFFERING_STARTED/ENDED`, `WATCHED_25/50/75/90_PERCENT`, `PLAYER_ERROR`) przeszły do beaconu: jadą razem z odsłoną w 1–3 żądaniach na stronę. Na trasie zostały tylko zdarzenia, od których zależy stan produktu: `PLAY_STARTED/RESUMED/PAUSED`, `HEARTBEAT` (60 s), `ENDED` i `WATCHED_10_SECONDS` (liczenie wyświetleń). `VideoPlaybackSession.totalWatchMs` nikt dziś nie czyta; gdy panel przejdzie na `r_video_daily`, heartbeaty też można przenieść (faza 2).

## 5. Prywatność i wyłączniki

- W przeglądarce: brak beaconu przy `navigator.globalPrivacyControl`, `doNotTrack = 1` i `navigator.webdriver`; serwer ponownie sprawdza `Sec-GPC`/`DNT`. Nic nie jest zapisywane na urządzeniu (identyfikator próby odtworzenia żyje tylko w pamięci strony).
- `TELEMETRY_COLLECTOR_URL` (w `app.env`, np. `http://collector:3200`): bez niej strona nie ładuje beaconu, a `/api/t` wszystko odrzuca. `TELEMETRY_BEACON=off`: natychmiastowe wyłączenie bez przebudowy.
- Polityka prywatności (PL/EN, § 2, § 4, § 6) opisuje zakres, brak cookies, codzienną sól, GPC/DNT jako sprzeciw i okresy 90 dni / 25 mies.; test `legal-docs-consistency` pilnuje zgodności liczb ze stałymi w `lib/telemetry/retention.ts`.

## 6. Koszty i zasoby (zmierzone 2026-10-04 na serwerku, kontener testowy)

2000 beaconów (odsłona + vital + odtwarzanie) w 1,8 s: wszystkie 204, 6000 wierszy zapisanych, kolektor 24,6 MiB RAM (limit 96 MiB), Postgres testowy 87 MiB. Obraz: `node:22-alpine` + jeden plik 108 KB. Koszt zewnętrzny: 0.

## Źródła

1. Plausible, Data policy: https://plausible.io/data-policy
2. Umami, FAQ: https://docs.umami.is/docs/faq
3. EDPB Guidelines 2/2023 on Technical Scope of Art. 5(3) ePrivacy Directive, v2 (7.10.2024): https://www.edpb.europa.eu/system/files/2024-10/edpb_guidelines_202302_technical_scope_art_53_eprivacydirective_v2_en_0.pdf
4. Art. 399 PKE (ustawa z 12.07.2024): https://lexlege.pl/komunik-elektr/art-399/ ; omówienie: https://grantthornton.pl/publikacja/prawo-komunikacji-elektronicznej-a-ochrona-danych-osobowych/
5. ODO24, „Cookies a pomiar oglądalności” (warunki AEPD): https://odo24.pl/blog-post.pliki-cookies-a-pomiar-ogladalnosci-jak-uniknac-naruszenia-przepisow
6. Digital Omnibus, art. 88a: https://secureprivacy.ai/blog/eu-digital-omnibus-what-article-88a-changes-for-cookie-consent-2026 , https://www.legal500.com/intelligence/european-union/privacy/digital-omnibus-what-the-proposed-changes-mean-for-gdpr-privacy-and-cookies
7. web-vitals CHANGELOG: https://github.com/GoogleChrome/web-vitals/blob/main/CHANGELOG.md
8. Cloudflare GraphQL Analytics limits: https://developers.cloudflare.com/analytics/graphql-api/limits/
9. Workers Analytics Engine, pricing: https://developers.cloudflare.com/analytics/analytics-engine/pricing/
10. PostgreSQL 17, Table Partitioning: https://www.postgresql.org/docs/17/ddl-partitioning.html
11. PostgreSQL 17, BRIN Indexes: https://www.postgresql.org/docs/17/brin.html
12. PostgreSQL 17, pg_stat_statements: https://www.postgresql.org/docs/17/pgstatstatements.html
