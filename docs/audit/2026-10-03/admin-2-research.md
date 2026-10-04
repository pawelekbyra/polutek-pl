# Ścieżka 2 z 3: co panel ma umieć i jak go zorganizować

Stan na 2026-10-04. Praca tylko do odczytu: repo (`origin/main`), serwer (`ssh serwerek`, polecenia odczytu), strony i dokumentacja w internecie. Źródła podaję przy każdym wniosku w sekcji 2 i zbiorczo na końcu.

**Fakty z naszego systemu, na których opiera się projekt (sprawdzone dziś):**
- **Analityki ruchu dziś nie ma wcale.** `@vercel/analytics` w `app/layout.tsx` po przejściu na serwerek dostaje 404 i nic nie wysyła (`docs/audit/2026-10-03/audit-legal-privacy.md`, LEG-21). Polityka prywatności mówi „brak analityki”, więc nowa telemetria wymaga też zmiany polityki.
- Telemetria odtwarzania już jest: `VideoPlaybackSession` (firstPlayAt, totalWatchMs, maxProgressMs, errorCode, isAdminPreview) i `VideoPlaybackEvent` (type, positionMs, bufferedMs, errorCode, metadata). Brakuje w niej pól jakości: czasu startu, buforowania, rendycji. Cron `prune-playback-sessions` kasuje sesje niepoliczone jako obejrzenie po 30 dniach. Bez wcześniejszej agregacji tracimy wtedy wskaźnik „wyjścia przed startem”.
- Do wykorzystania są też `AuditLog` (z actorType, ip, requestId), `EmailEvent`, `StripeEvent`, `Payment`, `VideoView`, `VideoEncodeJob`, `CommentReport` oraz Better Auth `Session`.
- Serwer: 2 vCPU, RAM 3,8 GB, z czego 2,27 GB zajęte. **Swap zajęty w 1,48 GB** przy niemal zerowym ruchu. Dysk: 46 z 75 GB (64%). Działa 9 kontenerów, największe to app 139 MB, pp-support-web 163 MB, sidekiq 134 MB, encoder 117 MB.
- Zadania okresowe:
  - timery systemd: send-broadcasts, stripe-reconciliation, prune-unverified-accounts, abandon-stale-originals, prune-playback-sessions, purge-deleted-comments, sync-public-thumbnails;
  - cron: `/opt/serwerek/scripts/backup.sh` o 02:30 i `health.sh` co 5 min.
- **Kopie zapasowe leżą lokalnie**, w `/opt/serwerek/backups`, na tym samym dysku co baza (widać tam zrzuty `pre-deploy-*.sql.gz`). Panel musi pokazywać, gdzie jest ostatnia kopia poza serwerem i kiedy ostatnio sprawdzono, że da się ją odtworzyć.
- HLS ma segmenty 6 s (`scripts/hls/encode-hls.mjs:57`). Godzina oglądania to ok. 600 żądań segmentów plus playlisty, czyli ok. 650 żądań do Workera. **Darmowy limit Workera to 100 000 żądań na dobę UTC**, co daje tylko ok. 150 godzin oglądania dziennie. Po przekroczeniu Worker zwraca błąd 1027. To pierwszy licznik, który musi być na stronie „Dzisiaj”, dopóki nie przejdziemy na Workers Paid (`1135c0b9` mówi o decyzji „Workers Paid przy starcie”).
- Poprzedni audyt panelu (`docs/audit/2026-10-03/audit-feat-admin.md`) znalazł 37 problemów, w tym 6 P1. Wskazuje też brak strony zdrowia, przeglądarki audytu, eksportu wpłat i wyszukiwarki globalnej (ADM-35).

---

## 1. Podsumowanie i główna wizja (10 zdań)

1. Panel to **centrum dowodzenia jednej osoby**. Strona „Dzisiaj” w 10 sekund odpowiada na trzy pytania: czy wszystko działa, co się zmieniło od ostatniej wizyty, co wymaga mojej decyzji.
2. Panel jest **„nigdy ślepy”**. Każda liczba ma godzinę pomiaru i źródło. Przestarzałe dane są oznaczone kolorem. Strażnik dostępności działa **poza serwerem** (Cloudflare Worker z cronem), bo monitor na tym samym serwerze umiera razem z nim.
3. Dane zewnętrzne (Cloudflare, Stripe, Resend, RDAP, metryki serwera) pobierają **kolektory w tle** i zapisują je jako migawki w Postgresie. Ekran czyta tylko lokalną bazę, więc renderuje się od razu, z serwera, bez szkieletów, a awaria API zewnętrznego niczego nie psuje.
4. Analityka ruchu i oglądania jest **własna, first-party i bez ciasteczek**. Lekkie zdarzenia trafiają do Postgresa z dziennymi agregatami. Tylko tak da się połączyć wizytę, odtworzenie, rejestrację, komentarz i napiwek z naszymi tabelami (User, Payment). Narzędzia zewnętrzne tego nie potrafią, a PostHog czy Sentry nie zmieszczą się na tym serwerze.
5. Jakość odtwarzania mierzymy jak Mux Data: czas startu, wyjścia przed startem, błędy, buforowanie, rendycje. Do tego dochodzą ruch Workera HLS i cache hit, bo to nasz własny „Mux”.
6. Nawigacja ma 8 pozycji: Dzisiaj, Analityka, Treści, Społeczność, Przychody, Komunikacja, System, Bezpieczeństwo. Ustawienia są na dole. Wszystkim steruje paleta poleceń Ctrl/Cmd+K, w której każda akcja i każdy obiekt są dwa klawisze dalej (wzorzec Linear).
7. Każda liczba ma porównanie (poprzedni okres albo ta sama pora tydzień temu) i jest linkiem do przefiltrowanej listy. Każda anomalia prowadzi do akcji, nie do kolejnego wykresu.
8. Wykresy mają adnotacje z osi „co się zmieniło”: deploye, publikacje, rozsyłki, zmiany ustawień, incydenty. Dzięki temu skok ruchu albo błędów od razu ma przyczynę (wzorzec Grafana).
9. Panel sam przychodzi do właściciela: poranny raport e-mailem, alerty i powiadomienia push w PWA na telefonie, tryb „Premiera na żywo” na pierwszą godzinę po wypuszczeniu filmu.
10. **Zbieranie danych jest ważniejsze niż ich prezentacja.** Telemetrii nie da się uzupełnić wstecz, więc faza 0 włącza zbieranie wszystkiego, co MUST i SHOULD, nawet jeśli ekrany powstaną później.

---

## 2. Wnioski z badań porównawczych

| Produkt | Co zapożyczyć | Antywzorzec / ograniczenie | Źródło |
|---|---|---|---|
| **YouTube Studio** | Karta „Realtime” (ostatnie 48 h), lista najlepszych filmów na Przeglądzie. Krzywa retencji z typami momentów: płasko, łagodny spadek, skok (powtórki), dołek (przewijanie). Wskaźnik pierwszych 30 s (intro). Podział na nowych i powracających. Te same zakładki na poziomie kanału i filmu: Overview/Content/Audience/Research. | Retencja liczona 1–2 dni i dopiero od 100 wyświetleń. My mamy mało ruchu, więc liczymy od razu i ostrzegamy przy małym n. | support.google.com/youtube/answer/9314415; tubeanalytics.net/blog/youtube-studio-analytics-guide |
| **Twitch Stream Manager** | Jeden ekran „na żywo”: zdrowie strumienia, kanał aktywności (do 4 paneli z filtrami), szybkie akcje z wyszukiwarką, zapisane układy. To wzorzec dla trybu „Premiera na żywo”. | Pełna personalizacja układu to koszt utrzymania. U nas wystarczy jeden dobrze zaprojektowany układ. | help.twitch.tv/s/article/stream-manager; stream-rise.com/blog/stream-manager |
| **Mux Data** | Pięć wskaźników QoE: Overall, Playback Success, Startup Time, Smoothness, Video Quality. Precyzyjne definicje: Video Startup Time (od kliknięcia do pierwszej klatki), Exits Before Video Start, Playback Failure %, Rebuffer %/Frequency/Duration/Count. Gotowe wzory: Startup score = 8/(8+s)×100, Smoothness = średnia z 1/√(1+(n/2)²) i e^(−10·rebuf%). | Płatny SaaS i zewnętrzny dostawca. Odtwarzamy definicje u siebie na hls.js. | mux.com/docs/guides/data/understand-metric-definitions, …/startup-time-metric, …/smoothness-metric, …/playback-success-metric |
| **Ko-fi / Buy Me a Coffee / Patreon** | Lista wspierających, cel zbiórki (wg Ko-fi strony z celem 2,4 razy częściej dostają 5 lub więcej napiwków), bezpośredni kontakt ze wspierającym. | Analityka „bare bones”: brak źródeł, konwersji i zachowań wspierających. Tego nie powtarzamy, bo atrybucja napiwku jest naszą przewagą. | help.ko-fi.com (Set your Ko-fi Goal); behindrankings.com/ko-fi-review |
| **Ghost** | Atrybucja per wpis: rejestracje i płatne konwersje przypisane do treści, źródła. Newsletter: wysłane/otwarcia/kliknięcia per link. Zakładki Overview, Web traffic, Newsletter, Growth. Eksport CSV. U nas odpowiednikiem jest „ten film przyniósł X kont i Y napiwków”. | – | ghost.org/help/post-analytics/ |
| **Stripe Dashboard** | Konfigurowalne widżety na Home i ważne powiadomienia (nierozstrzygnięte spory). Klawisz `?` z listą skrótów. Przypięte i ostatnie strony („Shortcuts”). Workbench z błędami API i webhooków. Aplikacja mobilna z pushami. Pole `Event.pending_webhooks` = webhooki jeszcze niedostarczone. | Mnogość produktów. My bierzemy tylko płatności, spory, wypłaty i webhooki. | docs.stripe.com/dashboard/basics; docs.stripe.com/api/events/object |
| **Plausible** | Jedna strona zamiast labiryntu raportów. Unique visitors, wizyty (30 min bezczynności), bounce, czas wizyty, scroll depth. Kanały ruchu, UTM, cele, lejki. Automatyczne śledzenie 404 i linków wychodzących. Porównania okresów. | Prywatny SaaS albo osobny serwer. | plausible.io/docs/metrics-definitions |
| **Umami** | Open source, tylko PostgreSQL. Bez ciasteczek. Lejki, ścieżki (journeys), retencja, UTM, przychód, porównania, segmenty. To dobra alternatywa, gdybyśmy nie budowali własnej telemetrii. | Osobny kontener i brak złączeń z naszymi tabelami User/Payment. | docs.umami.is/docs/, docs.umami.is/docs/install |
| **PostHog** | Web analytics z Web Vitals per strona, klasyfikacja ruchu botów i AI. Asystent AI pisze SQL (HogQL) na prawdziwym schemacie i odpowiada na pytania w języku naturalnym. To wzorzec dla naszego asystenta. | Self-host wymaga 4 vCPU i 16 GB RAM i nie ma wsparcia. **Nie dla nas.** | posthog.com/docs/web-analytics; posthog.com/docs/self-host; posthog.com/docs/product-analytics/analyze-data-ai |
| **Cloudflare Web Analytics** | Darmowy beacon bez ciasteczek, wstrzykiwany automatycznie dla stref proxowanych. Core Web Vitals (LCP, INP, CLS) z selektorem winnego elementu. Dobry niezależny „drugi zegar” do porównania z naszą telemetrią. | CLS tylko w Chromium. Dane w Cloudflare, nie w naszej bazie. | developers.cloudflare.com/web-analytics/get-started/, …/data-metrics/core-web-vitals/ |
| **Cloudflare GraphQL Analytics API** | Jedno źródło dla ruchu strefy, cache, Workerów i R2. Zbiory „adaptive” trzymają co najmniej 31 dni na każdym planie. Limit: 300 zapytań na 5 min. To podstawa kolektora CF. | Nie służy do rozliczeń (liczy też ruch DDoS). | developers.cloudflare.com/analytics/graphql-api/, …/limits/ |
| **Cloudflare Workers – limity** | Free: 100 tys. żądań na dobę (reset o północy UTC), 10 ms CPU, błąd 1027 po przekroczeniu, do wyboru fail open/closed. Cron Triggers: 5 na konto Free, 250 na Paid. Wystarczy na zewnętrznego strażnika. | Limit dzienny wprost ogranicza oglądalność (wyliczenie wyżej). | developers.cloudflare.com/workers/platform/limits/ |
| **Cloudflare R2 – cennik** | Darmowe 10 GB-miesiąc, 1 mln operacji A, 10 mln operacji B. Potem 0,015 $/GB, 4,50 $/mln A, 0,36 $/mln B. Wyjście bez opłat. Panel pokazuje zużycie względem tych progów. | – | developers.cloudflare.com/r2/pricing/ |
| **Grafana** | Adnotacje ręczne, z zapytań (np. deploye) i regionów czasowych, jako pionowe znaczniki na wykresach. | Grafana z Prometheusem to za ciężki stos dla jednej osoby na 4 GB RAM. | grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/annotate-visualizations/ |
| **Uptime Kuma** | Typy monitorów: HTTP, słowo kluczowe, JSON, TCP, DNS, push, kontenery Docker. Wygasanie certyfikatów. Ponad 90 kanałów powiadomień. Strony statusu i okna serwisowe. | **Uruchomiony na tym samym serwerze nie zobaczy awarii serwera.** | github.com/louislam/uptime-kuma |
| **Better Stack (heartbeat)** | Monitor „martwego człowieka”: zadanie pinguje URL, a brak pingu w oczekiwanym okresie plus czas łaski otwiera incydent. Jest też `/fail` z kodem wyjścia i logiem. To wzorzec dla naszych cronów i kopii. | Kolejny zewnętrzny dostawca (zasada: tylko Stripe, CF i Resend). Robimy to samo w Workerze. | betterstack.com/docs/uptime/cron-and-heartbeat-monitor/ |
| **Sentry / GlitchTip** | Grupowanie błędów (odcisk), pierwsze i ostatnie wystąpienie, wydanie. | Sentry self-host to minimum 4 rdzenie i 16 GB RAM, **niemożliwe**. GlitchTip: 256–512 MB i Postgres, realny na drugim serwerze. Na start wystarczy własna tabela grup błędów. | develop.sentry.dev/self-hosted/; glitchtip.com/documentation/install |
| **Beszel** | Lekki hub z agentem: CPU, RAM, dysk, sieć, kontenery Docker z historią, alerty, S.M.A.R.T., usługi systemd. | Osobna aplikacja z osobnym logowaniem. Lepiej własny kolektor w naszym panelu (dane te same, jedno okno). | beszel.dev/guide/what-is-beszel |
| **Vercel Observability** | Przepływ drążenia: wykres error rate → zaznacz zakres → lista tras posortowana po błędach i czasie → trasa → logi. Alerty anomalii, notatniki zapytań, zapytania AI. | – | vercel.com/docs/observability |
| **Linear** | Cmd+K jako jedyne wejście do każdej akcji i miejsca, kontekstowe (na obiekcie najpierw jego akcje), ze skrótem wypisanym obok każdej pozycji, więc menu uczy klawiszy. Widoki to zapisane filtry tych samych danych. Triage, czyli skrzynka przeglądu nowych rzeczy. | – | linear.app/docs/conceptual-model; fastshortcuts.com/shortcuts/linear |
| **Directus Insights** | Panele drag-and-drop dla analityki bez kodu. | **Antywzorzec dla nas:** „zbuduj sobie dashboard” przerzuca projektowanie na właściciela. Projektujemy gotowe ekrany. | directus.com/docs/guides/insights/overview |
| **Resend – limity** | Free: 100 e-maili na dzień i 3000 na miesiąc (odebrane też się liczą). 10 żądań/s. Progi jakości: bounce poniżej 4%, spam poniżej 0,08%, inaczej wstrzymanie wysyłki. Retencja danych 30 dni, więc agregaty trzeba zapisywać u siebie. | – | resend.com/docs/knowledge-base/account-quotas-and-limits |
| **NASK RDAP** | Domeny .pl mają autorytatywne RDAP pod `https://rdap.dns.pl`, z rozszerzeniem NASK (stan domeny i daty wygaśnięcia). Wygasanie domen da się monitorować automatycznie. | – | dns.pl/en/RDAP_in_NASK; dns.pl/en/NASK_extension_of_RDAP_Response |
| **WebKit Web Push** | Push w PWA na iOS od 16.4. Wymaga dodania do ekranu głównego i zgody wywołanej gestem użytkownika. Panel jako PWA może wysyłać alerty na iPhone'a. | – | webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ |

Nie badałem w tej ścieżce Substacka, Retoola, Refine, Payloada, Matomo, Fathoma, Netdaty ani Railwaya: ich wzorce pokrywają się z powyższymi, więc nie wnoszą nic nowego do wizji.

---

## 3. Katalog funkcji

**Oznaczenia źródeł danych:**
- **DB:Model** – istniejąca tabela Prisma;
- **NOWE:Nazwa** – nowa tabela lub telemetria (lista w 3.0);
- **CF-GQL** – Cloudflare GraphQL Analytics;
- **CF-API** – Cloudflare REST;
- **STRIPE**, **RESEND** – API;
- **SRV** – kolektor metryk serwera;
- **PPS** – baza PP Support;
- **RDAP** – rejestry domen.

**Częstość odświeżania:**
- „na żywo” – co 5–15 s, tylko w trybach live;
- „1 min” / „5 min” / „1 h” / „dzień” – częstość kolektora albo agregatu.

**Priorytet:**
- MUST – przed startem publicznym;
- SHOULD – 1–2 miesiące po starcie;
- LATER – później.

**Nakład:** S (do 1 dnia), M (2–5 dni), L (ponad tydzień).

### 3.0 Fundament danych: nowe tabele i kolektory (warunek wszystkiego)

| ID | Element | Co zbiera | Uwagi | Prio | Nakład |
|---|---|---|---|---|---|
| T1 | `NOWE:PageEvent` + `DailyTrafficRollup` | `navigator.sendBeacon` na `/api/t`: ścieżka, host źródła, UTM, kraj z nagłówka `CF-IPCountry`, klasa urządzenia, przeglądarka i system (parsowane na serwerze, UA nie zapisujemy), `display-mode` (PWA czy karta), visitorId jako hash (sól dzienna, IP, UA) bez ciasteczka (wzorzec Plausible), userId jeśli zalogowany | Agregaty dzienne i godzinne liczy cron. Surowe dane trzymamy 30–90 dni. Wymaga zmiany polityki prywatności. | MUST | M |
| T2 | Rozszerzenie `VideoPlaybackEvent` (QoE) | `play_request`, `first_frame` (startupMs), `rebuffer_start/end`, `level_switch` (wysokość, bitrate), `error` (fatal, typ hls.js), `exit` (pozycja, czy przed startem), `seek` (z → do), `subtitles_on` | Wysyłane z `VideoPlayer` (hls.js z bundla) | MUST | M |
| T3 | `NOWE:VideoDailyRollup` + `VideoRetentionBucket` | Agregat na film i dzień: obejrzenia, unikalni, czas oglądania, startup p50/p95, rebuffer %, błędy. Retencja: 100 kubełków procentu długości filmu. | Liczony przed pruningiem sesji, żeby nie tracić wyjść przed startem | MUST | M |
| T4 | `NOWE:MetricSample` (SRV) | Co 60 s: CPU, load, RAM, swap, dysk, iowait, sieć. Kontenery: CPU, RAM vs limit, restarty, health (Docker socket tylko do odczytu). Postgres: liczba połączeń, rozmiar. | Surowe dane 14 dni, godzinowe 1 rok. Kolektor jako mały skrypt w kontenerze app albo osobny lekki kontener. | MUST | M |
| T5 | `NOWE:JobRun` (heartbeat zadań) | Każdy cron, `backup.sh`, `health.sh`, encoder: start, koniec, status, krótki wynik, rozmiar (dla kopii) | Brak wpisu w oczekiwanym oknie z czasem łaski uruchamia alert (wzorzec Better Stack) | MUST | S |
| T6 | `NOWE:ErrorGroup` / `ErrorEvent` | `instrumentation.ts` → `onRequestError` (serwer) plus `window.onerror` i `unhandledrejection` (klient). Odcisk = typ + pierwsza ramka + trasa. Liczniki, pierwsze i ostatnie wystąpienie, wydanie, requestId. | Alternatywa: GlitchTip na drugim serwerze | MUST | M |
| T7 | `NOWE:ExternalSnapshot` | Migawki z CF-GQL, CF-API, STRIPE, RESEND, RDAP, PPS: JSON, `fetchedAt`, `ok`, błąd | Panel czyta tylko to i pokazuje „dane z godz.”, nigdy nie woła API przy renderze | MUST | M |
| T8 | `NOWE:ChangeEvent` (oś zmian) | Deploy (wpis z `deploy.sh`: tag obrazu, commit), publikacja i premiera, zmiana ustawień, rozsyłka, incydent, notatka ręczna | Częściowo z `AuditLog`. Służy do adnotacji na wykresach. | MUST | S |
| T9 | `NOWE:Alert` (stan) | Reguła, próg, stan (ok / ostrzeżenie / krytyczny), od kiedy, potwierdzone przez, wyciszone do | Zasila kropkę zdrowia, push i e-mail | MUST | M |
| T10 | Liczniki bezpieczeństwa | Nieudane logowania (e-mail jako hash + IP), blokady, nieudane Turnstile, 403 CSRF, 429 per trasa | Liczniki w Redis, zrzut co minutę do `MetricSample` | MUST | S |
| T11 | Atrybucja | `User.signupSource` (pierwsze źródło, UTM, film, na którym nastąpiła rejestracja). Metadane intentu Stripe: `contextVideoId`, `contextPath`, `utm` | Bez tego lejek i „ten film przyniósł…” są niemożliwe (CLAUDE.md §4.16: napiwki dziś nie są przypisane do filmu) | MUST | S |
| T12 | `NOWE:WebVitalSample` | `useReportWebVitals` (Next.js): LCP, INP, CLS, TTFB, FCP + trasa + urządzenie, z próbkowaniem | Uzupełnia Cloudflare Web Analytics | SHOULD | S |
| T13 | Lejek bramki napiwkowej | Zdarzenia w `SupportModal`: otwarcie, krok, wybór kwoty, wybór metody, potwierdzenie, błąd Stripe (kod), sukces | Do `PageEvent` z typem zdarzenia | MUST | S |

### 3.1 Dzisiaj (strona startowa)

| ID | Funkcja | Pytanie / decyzja właściciela | Dane i źródło | Odśw. | Prio | Nakład |
|---|---|---|---|---|---|---|
| A1 | Kropka zdrowia (zielona, żółta, czerwona) z listą przyczyn | Czy coś się pali? | T9 `Alert` (agregat wszystkich kontroli z 3.8) | 1 min | MUST | S |
| A2 | Skrzynka „Wymaga uwagi” (triage) | Co muszę dziś zrobić? | Zgłoszone komentarze (`CommentReport`), spory Stripe z terminem, nieudane kodowania (`VideoEncodeJob`), odbicia i skargi (`EmailEvent`), wątki PP Support bez odpowiedzi (PPS), otwarte alerty, żądania RODO | 1 min | MUST | M |
| A3 | Pasek KPI z porównaniem | Jak idzie w porównaniu z normą? | Odwiedzający, obejrzenia, czas oglądania, nowe konta, komentarze, napiwki (liczba i PLN). Porównanie do tej samej pory 7 dni temu, ze sparkline 14 dni. Źródła: T1, T3, `User`, `Comment`, `Payment`. | 5 min | MUST | M |
| A4 | Teraz na stronie | Ile osób ogląda w tej chwili i co? | Aktywni w ostatnich 5 min (T1), aktywne sesje odtwarzania (`lastHeartbeatAt` w ostatnich 90 s) per film | 15 s (tylko gdy karta jest widoczna) | SHOULD | S |
| A5 | Kanał aktywności z filtrami | Co się wydarzyło? | Rejestracje, komentarze, napiwki, zgłoszenia, publikacje, deploye, alerty, logowania admina. Źródła: DB + T8. | 1 min | MUST | M |
| A6 | Liczniki limitów z prognozą | Czy coś się zaraz skończy? | Worker HLS x/100 tys. na dobę UTC z godziną wyczerpania przy obecnym tempie (CF-GQL), Resend x/100 dziennie i x/3000 miesięcznie (RESEND / `EmailEvent`), R2 GB i operacje vs darmowe progi, dysk %, swap % | 5 min | MUST | S |
| A7 | Najbliższe zdarzenia | Co nadchodzi? | Najbliższa premiera (odliczanie), następna kopia, zaplanowane rozsyłki, wygasanie domen, certyfikatów i tokenów w ciągu 30 dni | 1 h | SHOULD | S |
| A8 | Najlepsze filmy 48 h | Co teraz działa? | T3 + sesje z ostatnich 48 h, z porównaniem do typowego filmu | 5 min | SHOULD | S |
| A9 | „Od Twojej ostatniej wizyty” | Co przegapiłem? | Różnica zdarzeń od ostatniego logowania admina | przy wejściu | SHOULD | S |
| A10 | Znacznik świeżości i źródła na każdym kaflu | Czy mogę tym liczbom ufać? | `fetchedAt` z T7 i rollupów | – | MUST | S |

### 3.2 Analityka: publiczność i ruch

| ID | Funkcja | Pytanie / decyzja | Dane i źródło | Odśw. | Prio | Nakład |
|---|---|---|---|---|---|---|
| B1 | Odwiedzający, wizyty, odsłony, bounce, czas wizyty z porównaniem | Czy rośniemy? | T1 | 5 min / dzień | MUST | M |
| B2 | Źródła ruchu (kanały: bezpośrednie, wyszukiwarki, społecznościowe, e-mail, odesłania, kampanie) | Skąd przychodzą i gdzie promować? | T1 (referrer host, UTM) | 1 h | MUST | S |
| B3 | Kraje (mapa i lista) | Dla kogo PL, dla kogo EN, w jakich godzinach premiery? | T1 (`CF-IPCountry`) | 1 h | MUST | S |
| B4 | Urządzenia, systemy, przeglądarki, PWA czy karta | Na czym testować i optymalizować? | T1 | dzień | SHOULD | S |
| B5 | Strony wejścia i wyjścia, top strony | Które strony przyciągają, a które zniechęcają? | T1 | dzień | SHOULD | S |
| B6 | Lejek: wizyta → start odtwarzania → rejestracja → weryfikacja e-mail → onboarding → pierwszy komentarz → pierwszy napiwek | Gdzie gubię ludzi? | T1, T2, `User`, `Comment`, `Payment`, T11 | dzień | MUST (wersja z liczbami z DB) / SHOULD (ścieżki per odwiedzający) | M |
| B7 | Atrybucja rejestracji i napiwków (źródło, film, kampania) | Który film i który kanał promocji daje konta i wsparcie? | T11 | dzień | MUST | S |
| B8 | Nowi vs powracający | Czy ludzie wracają? | Zalogowani: dokładnie (`Session`, T1.userId). Anonimowi: bez ciasteczka nie da się, więc pokazujemy tylko zalogowanych i opisujemy to ograniczenie. | dzień | SHOULD | S |
| B9 | Mapa ciepła dzień × godzina | Kiedy publikować i wysyłać rozsyłki? | T1, T3 | dzień | SHOULD | S |
| B10 | Linki kampanii `/go/<kod>` z licznikiem i QR | Czy post w danym miejscu coś dał? | `NOWE:CampaignLink` + T1 | 5 min | SHOULD | S |
| B11 | Ruch maszyn vs ludzi | Ile z ruchu na krawędzi to boty? | CF-GQL (żądania strefy) vs T1 (odsłony z JS) | 1 h | SHOULD | S |
| B12 | Najczęstsze 404 ze źródłem | Jakie linki są zepsute? | T1 (status strony) | dzień | SHOULD | S |
| B13 | Udostępnienia (przycisk Share, cel) | Czy widzowie polecają? | T1 (zdarzenie) | dzień | SHOULD | S |
| B14 | Kohorty retencji kont (tydzień rejestracji × powrót) | Czy nowi zostają na dłużej? | `User`, `Session`, T1 | tydzień | LATER | M |
| B15 | Wyszukiwania na stronie | Czego szukają, a nie znajdują? | T1 (zdarzenie) | dzień | LATER | S |

### 3.3 Analityka: wideo, oglądalność i jakość odtwarzania

| ID | Funkcja | Pytanie / decyzja | Dane i źródło | Odśw. | Prio | Nakład |
|---|---|---|---|---|---|---|
| C1 | Obejrzenia i unikalni widzowie per film (trend) | Który film działa? | `VideoPlaybackSession.countedAsView`, `VideoView`, T3 | 5 min | MUST | S |
| C2 | Czas oglądania (suma, średnio na obejrzenie, średni % obejrzenia) | Czy ludzie naprawdę oglądają? | `totalWatchMs`, `maxProgressMs`, `durationMs` | 5 min | MUST | S |
| C3 | Krzywa retencji z pasmem „typowy film kanału” | W którym momencie odpadają? | T3 `VideoRetentionBucket` | 1 h | SHOULD (zbieranie: MUST) | M |
| C4 | Pierwsze 30 s (intro) | Czy początek trzyma widza? | T3 | 1 h | SHOULD | S |
| C5 | Kluczowe momenty: powtórki i przewijanie | Co było najciekawsze lub nudne? | T2 (`seek`) | dzień | LATER | M |
| C6 | Porównanie z typowym filmem (ranking „2 z 3” po pierwszych 24 h / 48 h / 7 dniach) | Czy ta premiera to sukces? | T3 | 1 h | SHOULD | S |
| C7 | **Czas startu** (od kliknięcia do pierwszej klatki) p50 / p95 + wynik 8/(8+s) | Czy start jest szybki? | T2 | 5 min | MUST | M |
| C8 | **Wyjścia przed startem** % | Czy ludzie rezygnują, zanim film ruszy? | T2, T3 | 5 min | MUST | S |
| C9 | **Błędy odtwarzania** % z kodami (sieć, media, token 403, manifest) i listą sesji | Co się psuje i u kogo? | `errorCode`, T2 | 5 min | MUST | S |
| C10 | **Buforowanie**: % czasu, liczba na obejrzenie, czas trwania + wynik płynności | Czy jest płynnie? | T2 | 5 min | MUST | M |
| C11 | Rendycje: rozkład czasu oglądania wg jakości (240p–1080p), przełączenia, start w niskiej jakości | Czy drabinka bitrate jest dobra? | T2 (`level_switch`) | 1 h | SHOULD | M |
| C12 | QoE wg kraju, urządzenia, przeglądarki, ASN | Gdzie jest gorzej? | T2 + T1 | dzień | SHOULD | M |
| C13 | Ogólny wynik doświadczenia widza (0–100, wzory Mux) | Jedna liczba jakości na „Dzisiaj” | T3 | 5 min | SHOULD | S |
| C14 | **Ruch Workera HLS** (żądania/h, błędy, czas CPU) vs limit 100 tys. na dobę | Czy dziś nie zabraknie limitu? | CF-GQL `workersInvocationsAdaptive` | 5 min | MUST | S |
| C15 | **Cache hit** dla `video.pawelperfect.com` i strony, kody odpowiedzi (403 tokenów, 404 segmentów, 5xx) | Czy krawędź cache'uje i czy tokeny działają? | CF-GQL `httpRequestsAdaptiveGroups` (host, cacheStatus, edgeResponseStatus) | 5 min | MUST | S |
| C16 | Transfer per film i dzień, operacje R2 klasy B | Ile kosztuje oglądanie? | CF-GQL (R2 operations, bytes) | 1 h | SHOULD | S |
| C17 | Widzowie teraz per film | Jak idzie premiera? | Heartbeaty sesji | 15 s | SHOULD | S |
| C18 | Polubienia/niepolubienia, komentarze na 1000 obejrzeń | Jak zaangażowani są widzowie? | `VideoLike`, `VideoDislike`, `Comment` | 1 h | SHOULD | S |
| C19 | CTR miniatur (wyświetlenia kafla w sidebarze → kliknięcie) | Która miniatura i tytuł przyciągają? | T1: zdarzenie `impression` (IntersectionObserver) + klik | dzień | SHOULD | M |
| C20 | Oczekujący na premierę (wyświetlenia kokpitu COMING_SOON) | Jaki jest „hype” przed premierą? | T1 (zdarzenie) | 5 min | SHOULD | S |
| C21 | Napisy: % sesji z PL / EN | Czy warto robić napisy? | T2 | dzień | LATER | S |

### 3.4 Treści

| ID | Funkcja | Pytanie / decyzja | Dane i źródło | Odśw. | Prio | Nakład |
|---|---|---|---|---|---|---|
| D1 | Lista filmów z kolumnami stanu: status, premiera, HLS READY, miniatura publiczna zsynchronizowana, napisy, tier, sidebar, hero, obejrzenia 7 dni | Co wymaga uzupełnienia? | `Video`, `VideoAsset`, `VideoPlaybackRoute`, T3 | przy wejściu | MUST | M |
| D2 | Wgrywanie oryginału (wznawialne) z postępem; kodowanie na żywo (etap, %, ETA) | Czy plik doszedł i kiedy będzie gotowy? | `VideoOriginal`, `VideoEncodeJob` (heartbeat) | 5 s podczas pracy | MUST | M |
| D3 | Kolejka kodowania: oczekujące, w toku, nieudane, ponów, anuluj, przekoduj; czas kodowania na minutę materiału; log ffmpeg | Dlaczego się nie zakodowało? | `VideoEncodeJob`, logi encodera | 1 min | MUST | M |
| D4 | Lista kontrolna przed publikacją (pre-flight): HLS READY, test tokenu i pierwszego segmentu, miniatura, tytuł i opis PL/EN, napisy, tier, podgląd | Czy mogę bezpiecznie opublikować? | `VideoPolicy` blockers + test HTTP | na żądanie | MUST | S |
| D5 | Jeden formularz edycji (jeden schemat zod), z historią zmian i diffem | Co zmieniłem i kiedy? | `Video`, `AuditLog` | – | MUST | M |
| D6 | Premiery: ustaw, przesuń, odwołaj; kalendarz treści | Co i kiedy wychodzi? | `Video.premiereAt` | – | MUST (ustawianie) / SHOULD (kalendarz) | M |
| D7 | Układ kanału (kolejność, hero, sekcje) z podglądem na żywo | Jak wygląda strona główna? | `Video` (kolejność, hero) | – | MUST (naprawa ADM-02, ADM-03) | M |
| D8 | Miniatury: wgranie, kadrowanie, podgląd w kaflu sidebaru, hero i na telefonie, stan kopii publicznej | Czy miniatura wygląda dobrze wszędzie? | R2, `thumbnailPublicUrl` | – | SHOULD | M |
| D9 | Napisy: wgranie VTT, walidacja, podgląd z odtwarzaczem | Czy napisy się zgadzają? | `subtitleUrlPl` / `En` (#1219) | – | SHOULD | M |
| D10 | Cel zbiórki i pasek (ręczny % lub cel) | Co pokazać widzom? | `Video.fundraising*` | – | MUST (przeniesienie) | S |
| D11 | Zasoby osierocone w R2 (bez filmu): rozmiar i koszt | Czy płacę za śmieci? | R2 list + DB | dzień | SHOULD | S |
| D12 | Podgląd jako widz: gość, zalogowany, przed i po premierze | Co widzi widz? | Render strony w trybie podglądu | – | MUST | S |
| D13 | Rozdziały i znaczniki w filmie | Czy ułatwić nawigację po filmie? | `NOWE` | – | LATER | M |

### 3.5 Społeczność

| ID | Funkcja | Pytanie / decyzja | Dane i źródło | Odśw. | Prio | Nakład |
|---|---|---|---|---|---|---|
| E1 | Kolejka moderacji z akcjami klawiszowymi (ukryj, przywróć, ban, zignoruj zgłoszenie) | Co usunąć? | `CommentReport`, `Comment` (status), automatyczne flagi | 1 min | MUST | M |
| E2 | Wszystkie komentarze z filtrami (film, autor, status, tekst, okres) | Co ludzie piszą? | `Comment` | – | MUST | S |
| E3 | Odpowiedź jako twórca i serduszko z panelu | Odpowiadam bez wchodzenia na stronę | `Comment` | – | SHOULD | S |
| E4 | Pytania bez odpowiedzi twórcy (komentarze ze znakiem „?”) | Komu jestem winien odpowiedź? | `Comment` | 1 h | SHOULD | S |
| E5 | Ochrona przed spamem: słowa zakazane, pierwsze komentarze nowych kont do akceptacji, limit linków, wykrywanie przez AI | Jak nie dopuścić do śmieci? | Reguły w `AppSetting` + AI | – | SHOULD | M |
| E6 | **Profil użytkownika 360°**: konto, e-mail i weryfikacja, Google, 2FA, sesje (urządzenie, kraj, ostatnia aktywność), komentarze, reakcje, oglądanie, napiwki, e-maile (dostarczone / odbite), zgody, wątki PP Support, audyt | Kim jest ta osoba i co się z nią działo? | `User`, `Session`, `Account`, `Comment`, `Payment`, `EmailEvent`, PPS, `AuditLog` | przy wejściu | MUST | M |
| E7 | Akcje na koncie: wycisz komentowanie, zablokuj, wyloguj wszędzie, reset 2FA, zmień pseudonim, wyślij link resetu hasła, anonimizacja i usunięcie, eksport danych (RODO art. 15/20) | Jak rozwiązać problem konta? | Use-case'y + `AuditLog` | – | MUST | M |
| E8 | Lista użytkowników z segmentami: nowi, aktywni 30 dni, wspierający, niezweryfikowani, z 2FA, uśpieni | Kim są moi widzowie? | `User`, `Session`, `PatronGrant` | – | MUST | S |
| E9 | Wzrost kont (rejestracje, weryfikacje, usunięcia dziennie) | Czy baza rośnie? | `User`, `AuditLog` (AUTH_SIGN_UP) | 1 h | MUST | S |
| E10 | Superfani (czas oglądania + komentarze + napiwki) | Komu podziękować i kogo zaprosić? | T3, `Comment`, `Payment` | dzień | SHOULD | S |
| E11 | Streszczenie i nastrój komentarzy per film (AI) | Co sądzą o filmie, bez czytania 300 komentarzy? | `Comment` + LLM | na żądanie | LATER | M |

### 3.6 Przychody (napiwki)

| ID | Funkcja | Pytanie / decyzja | Dane i źródło | Odśw. | Prio | Nakład |
|---|---|---|---|---|---|---|
| F1 | Przychód brutto i netto (po opłatach Stripe): dziś, 7 dni, 30 dni, rok; w PLN z kursem; porównanie | Ile zarabiam naprawdę? | `Payment` + STRIPE balance_transaction (fee) | 5 min | MUST | M |
| F2 | Lista napiwków z filtrami: status, metoda (BLIK, P24, karta, portfele), waluta, kraj, film | Kto i jak wsparł? | `Payment`, STRIPE | 1 min | MUST | S |
| F3 | Lejek bramki napiwkowej: otwarcie → kwota → metoda → potwierdzenie → sukces, z kodami odrzuceń | Gdzie ludzie rezygnują z wpłaty? | T13 + STRIPE PaymentIntents (canceled, requires_payment_method) | 1 h | MUST | M |
| F4 | Zwroty pełne i częściowe z kluczem idempotencji, powodem i potwierdzeniem ponownym uwierzytelnieniem | Jak bezpiecznie oddać pieniądze? | `Payment` (refunded*), STRIPE | – | MUST (naprawa ADM-04) | S |
| F5 | Spory: kwota, powód, **termin na dowody** (evidence due_by), link do Stripe | Czy nie przegapię terminu? | STRIPE disputes, `StripeEvent` | 1 h | MUST | S |
| F6 | Zdrowie webhooków Stripe: ostatnie zdarzenie, opóźnienie, `StripeEvent` FAILED / PROCESSING, `pending_webhooks` > 0 | Czy płatności w ogóle do nas dochodzą? | `StripeEvent`, STRIPE events | 5 min | MUST | S |
| F7 | Rekonsylacja: PENDING starsze niż 15 min, rozjazdy DB vs Stripe | Czy nic nie utknęło? | `Payment`, STRIPE, `JobRun` (stripe-reconciliation) | 15 min | MUST | S |
| F8 | Alert „card testing”: wiele drobnych odrzuceń z jednego IP lub w krótkim czasie, early fraud warnings | Czy ktoś testuje skradzione karty? | STRIPE (charges failed, radar.early_fraud_warning) + T10 | 5 min | MUST | S |
| F9 | Eksport CSV (rok, miesiąc) do księgowości | Co dać księgowej? | `Payment` + opłaty | na żądanie | MUST | S |
| F10 | Wspierający: łączna kwota, pierwszy i ostatni napiwek, liczba | Kto wspiera regularnie? | `Payment`, `UserPaymentTotal`, `PatronGrant` | 1 h | SHOULD | S |
| F11 | Saldo, wypłaty, następna wypłata | Kiedy pieniądze trafią na konto? | STRIPE balance, payouts | 1 h | SHOULD | S |
| F12 | Rozkład kwot, mediana, waluty, metody płatności | Jakie kwoty i metody promować? | `Payment` | dzień | SHOULD | S |
| F13 | Atrybucja: film, strona, kampania napiwku | Co skłania do wsparcia? | T11 | dzień | SHOULD | S |
| F14 | Prognoza miesiąca | Ile wpłynie do końca miesiąca? | `Payment` (trend) | dzień | LATER | S |

### 3.7 Komunikacja

| ID | Funkcja | Pytanie / decyzja | Dane i źródło | Odśw. | Prio | Nakład |
|---|---|---|---|---|---|---|
| G1 | E-maile transakcyjne per typ (weryfikacja, reset, powitanie, potwierdzenie): wysłane, dostarczone, odbite, skargi | Czy maile dochodzą? | `EmailEvent` (webhook Resend) | 5 min | MUST | S |
| G2 | Dostarczalność vs progi Resend (bounce < 4%, spam < 0,08%) z alertem | Czy grozi mi blokada wysyłki? | `EmailEvent` | 1 h | MUST | S |
| G3 | Limity Resend: dziś x/100, miesiąc x/3000 (Free) | Czy jutro jeszcze wyślę? | `EmailEvent`, RESEND | 5 min | MUST | S |
| G4 | Rozsyłki: kreator, segment, podgląd PL/EN, test do siebie, harmonogram, wyniki (otwarcia, kliknięcia per link, wypisy), automatyczne UTM w linkach | Do kogo i co wysłać, i czy zadziałało? | `BroadcastEmail*`, `EmailEvent`, T1 | – | MUST | M |
| G5 | Wypisy, preferencje, lista blokad (suppression) | Do kogo nie wolno pisać? | `EmailPreference`, `EmailSuppression` | – | MUST | S |
| G6 | Szablony z podglądem PL/EN i różnicą względem domyślnych (`EMAIL_DEFAULTS`) | Czy szablon nie jest przestarzały? | `EmailTemplate` | – | SHOULD | M |
| G7 | DNS poczty: SPF, DKIM, DMARC, MX dla .com i .pl, z alertem przy zmianie | Czy konfiguracja poczty jest poprawna? | CF-API DNS + zapytania DNS | dzień | SHOULD | S |
| G8 | PP Support: otwarte wątki, nieprzeczytane, czas pierwszej odpowiedzi, link do skrzynki | Kto czeka na odpowiedź? | PPS (odczyt) | 5 min | MUST | S |
| G9 | Poczta przychodząca: ostatnia odebrana wiadomość, błędy Email Workera, kopia do Gmaila | Czy poczta przychodzi? | CF-GQL (`polutek-support-mail`), PPS | 15 min | MUST | S |
| G10 | Powiadomienia w aplikacji (dzwonek, rozsyłki powiadomień) | Czy włączyć dzwonek? | `Notification*` | – | SHOULD | M |

### 3.8 System i infrastruktura

| ID | Funkcja | Pytanie / decyzja | Dane i źródło | Odśw. | Prio | Nakład |
|---|---|---|---|---|---|---|
| H1 | **Centrum zdrowia**: jedna lista kontroli (app `/api/health`, Postgres, Redis, srh, encoder heartbeat, tunel, Worker HLS, R2, webhook Stripe, Resend, PP Support, Email Worker, kopia, domeny) ze stanem, „od kiedy” i linkiem do działania | Co dokładnie nie działa? | T5, T7, T9 | 1 min | MUST | M |
| H2 | Strażnik zewnętrzny (Cloudflare Worker z cronem co 1–5 min): sprawdza stronę, `video.` i heartbeat kopii; alert e-mailem przez Resend i pushem | Czy dowiem się o awarii, gdy cały serwer padnie? | Worker + KV, zapis do panelu przez API | 1–5 min | MUST | S |
| H3 | Serwer: CPU, load, RAM, **swap**, dysk, iowait, sieć; wykresy 24 h / 7 dni z adnotacjami | Czy serwer wytrzymuje i kiedy go powiększyć? | T4 | 1 min | MUST | M |
| H4 | Kontenery: stan, restarty, health, CPU i RAM vs limit (np. encoder 1,47 GiB), wersja obrazu | Który kontener się dusi lub restartuje? | T4 (Docker socket tylko do odczytu) | 1 min | MUST | M |
| H5 | **Zadania i crony**: każdy timer i cron (lista z serwera), ostatnie uruchomienie, czas, wynik, następne; brak heartbeatu daje alert | Czy zadania w tle naprawdę działają? | T5 | 1 min | MUST | S |
| H6 | **Kopie zapasowe**: ostatnia udana, rozmiar i trend, **lokalizacja poza serwerem**, wiek najstarszej, wynik ostatniego testu odtworzenia | Czy odzyskam dane po awarii dysku? | T5 + listing bucketu kopii | 1 h | MUST | M |
| H7 | **Domeny i certyfikaty**: daty wygaśnięcia pawelperfect.com i .pl (RDAP: `rdap.dns.pl` dla .pl, Verisign dla .com), status autoodnowienia, certyfikaty CF; alerty 60/30/14/7/1 dni przed | Czy nie stracę domeny jak .pl? | RDAP, CF-API | dzień | MUST | S |
| H8 | Monitor zmian DNS (różnica rekordów stref co godzinę) | Czy ktoś coś zmienił w DNS? | CF-API | 1 h | SHOULD | S |
| H9 | Deploye: wersja (tag obrazu, commit), czas, lista zmian, poprzednia wersja do wycofania | Co się zmieniło w kodzie? | T8 (z `deploy.sh`) | – | MUST | S |
| H10 | Cloudflare: ruch strefy, cache hit, zdarzenia WAF, stan tunelu (connectors) | Czy krawędź działa i chroni? | CF-GQL, CF-API (tunnel) | 5 min | MUST | S |
| H11 | Błędy aplikacji: grupy, liczba, pierwsze i ostatnie wystąpienie, wydanie, requestId, „nowy od deployu” | Co się sypie po ostatnim wdrożeniu? | T6 | 1 min | MUST | M |
| H12 | Kolejki: rozsyłki do wysłania, zadania kodowania, oczekujące płatności | Czy coś stoi w kolejce? | DB | 1 min | MUST | S |
| H13 | Postgres: rozmiar bazy i największych tabel, przyrost dzienny, połączenia, wolne zapytania (`pg_stat_statements`), cache hit, autovacuum | Czy baza puchnie albo zwalnia? | SQL (rola tylko do odczytu) | 1 h | SHOULD | M |
| H14 | Retencja tabel (`VideoPlaybackEvent`, `AuditLog`, `EmailEvent`, `PageEvent`) i stan pruningu | Czy coś rośnie bez końca? | DB + T5 | dzień | SHOULD | S |
| H15 | R2: rozmiar per bucket, liczba obiektów, operacje A i B vs darmowe progi | Ile zajmuje wideo? | CF-GQL / CF-API | dzień | SHOULD | S |
| H16 | Koszty usług: Hetzner, Workers Paid, R2, Resend, opłaty Stripe, domeny; bieżący miesiąc, prognoza, roczne | Ile mnie to kosztuje? | API + ręczne wpisy w `NOWE:CostItem` | dzień | SHOULD | M |
| H17 | Wydajność HTTP: p50 i p95 czasu odpowiedzi per trasa, odsetek 5xx | Która strona jest wolna? | Pomiar w middleware → T4 | 5 min | SHOULD | M |
| H18 | Web Vitals RUM (LCP, INP, CLS, TTFB p75 per trasa i urządzenie) | Czy strona jest szybka u ludzi? | T12 + Cloudflare Web Analytics | dzień | SHOULD | M |
| H19 | Przeglądarka logów (ostatnie N linii per kontener, filtr poziomu i requestId) | Co dokładnie się stało? | `docker logs` przez kolektor (tylko do odczytu) | na żądanie | SHOULD | M |
| H20 | Aktualizacje: pakiety apt, „wymagany restart”, wersje obrazów (postgres 17, redis 7, pp-support 4.18.0) | Czy system jest załatany? | SRV | dzień | SHOULD | S |
| H21 | Prognoza pojemności: dysk pełny za N dni, zapas RAM, rekomendacja powiększenia | Kiedy kupić większy serwer? | T4 (regresja liniowa) | dzień | SHOULD | S |

### 3.9 Bezpieczeństwo

| ID | Funkcja | Pytanie / decyzja | Dane i źródło | Odśw. | Prio | Nakład |
|---|---|---|---|---|---|---|
| I1 | Logowania admina: historia, urządzenia, IP, kraj, aktywne sesje, wyloguj wszędzie | Czy to na pewno tylko ja? | `Session`, `AuditLog` | – | MUST | S |
| I2 | Obowiązkowy passkey lub TOTP dla admina, ponowne uwierzytelnienie przed operacjami nieodwracalnymi, opcjonalnie Cloudflare Access przed subdomeną | Jak nie stracić panelu? | Better Auth, CF Access | – | MUST (ADM-05) | M |
| I3 | Nieudane logowania (per e-mail i IP), blokady, nieudane Turnstile, masowe rejestracje z jednego IP | Czy ktoś atakuje konta? | T10, `AuditLog` | 5 min | MUST | S |
| I4 | **Dziennik audytu**: przeglądarka z filtrami (aktor, akcja, obiekt, okres), eksport, łańcuch hashy (niezmienność) | Kto, co i kiedy zmienił? | `AuditLog` | – | MUST | M |
| I5 | 403 (CSRF) i 429 (limity) per trasa i IP | Czy limity nie blokują prawdziwych ludzi? | T10 | 5 min | SHOULD | S |
| I6 | Podejrzane zdarzenia: nowe urządzenie lub kraj admina, wysyp komentarzy, card testing, skok 4xx na `video.` | Czy dzieje się coś nietypowego? | Reguły nad T1, T10, `AuditLog`, STRIPE | 5 min | SHOULD | M |
| I7 | Raporty naruszeń CSP (`report-to`) | Czy CSP coś psuje albo blokuje atak? | `NOWE:CspReport` | 1 h | SHOULD | S |
| I8 | Zdarzenia WAF i botów Cloudflare | Co blokuje Cloudflare? | CF-GQL firewallEventsAdaptive | 1 h | SHOULD | S |
| I9 | Sekrety i tokeny: wiek, daty rotacji, wygasanie tokenów API (CF, Stripe restricted, Resend); same nazwy, nigdy wartości | Co trzeba odnowić? | `NOWE:SecretInventory` (metadane) + API | dzień | SHOULD | S |
| I10 | SSH na serwerze: ostatnie logowania, nieudane próby | Czy ktoś puka do serwera? | SRV (`last`, journal) | 1 h | SHOULD | S |
| I11 | Rejestr żądań RODO (eksport, usunięcie) z terminem 30 dni | Czy dotrzymuję terminów RODO? | `NOWE:DataRequest` | dzień | SHOULD | S |

### 3.10 Ustawienia

| ID | Funkcja | Prio | Nakład |
|---|---|---|---|
| J1 | Kanał: nazwa, opis, banery, domyślna miniatura | MUST | S |
| J2 | Płatności: waluty, minimalne kwoty (3 rodzaje progów, CLAUDE.md §4.10), metody | MUST | S |
| J3 | **Flagi funkcji w runtime** (zamiast `TEMP_*` w kodzie): przełącznik, opis, audyt, zaplanowane przełączenie | SHOULD | M |
| J4 | Progi alertów i kanały powiadomień (e-mail, push), godziny ciszy | MUST | S |
| J5 | Integracje: czy klucz jest ustawiony, ostatnie udane wywołanie (bez wartości sekretu) | MUST | S |
| J6 | Baner ogłoszeń i tryb konserwacji z harmonogramem | SHOULD | S |
| J7 | Konto admina: passkey, 2FA, kody zapasowe, sesje | MUST | S |
| J8 | Teksty prawne: wersja i data obowiązywania, podgląd PL/EN | LATER | M |
| J9 | Przekierowania i krótkie linki | SHOULD | S |

---

## 4. Narzędzia, o których właściciel nie pomyślał

| # | Narzędzie | Wartość | Koszt |
|---|---|---|---|
| 1 | **Paleta poleceń Ctrl/Cmd+K**: szuka użytkowników (e-mail, pseudonim), filmów, płatności (`pi_…`, kwota), komentarzy (tekst), ustawień; wykonuje akcje („przekoduj czesc”, „wyłącz komentarze”, „zwrot pi_…”) | Zastępuje połowę nawigacji. Każda rzecz jest dwa klawisze dalej (Linear). | M |
| 2 | **Strażnik zewnętrzny („martwy człowiek”)** w Cloudflare Worker z cronem (Free: 5 triggerów) | Jedyny sposób, by panel nie był ślepy, gdy padnie serwer, tunel albo Docker. Sprawdza też, czy przyszedł heartbeat kopii. | S |
| 3 | **Oś „co się zmieniło” + adnotacje na wszystkich wykresach** (deploy, publikacja, rozsyłka, zmiana ustawień, incydent, notatka ręczna) | Skok błędów czy ruchu od razu ma przyczynę. To najważniejsza pomoc diagnostyczna (Grafana). | S |
| 4 | **Poranny raport e-mailem (7:00) i tygodniowy (poniedziałek)**: liczby z porównaniem, anomalie, lista „do zrobienia”, opcjonalne podsumowanie AI | Właściciel nie musi otwierać panelu, żeby wiedzieć, że jest dobrze. Kosztuje 1–2 e-maile dziennie z limitu Resend. | S |
| 5 | **Panel jako PWA z pushami** (iOS 16.4+, po dodaniu do ekranu głównego): alerty krytyczne, napiwek, spór, zgłoszenie | Reakcja w minutach zamiast godzin, bez zewnętrznych usług (Web Push działa przez Apple i Google). | M |
| 6 | **Tryb „Premiera na żywo”**: pełny ekran przez pierwsze 60 min. Widzowie teraz, startup p95, błędy na minutę, tempo żądań Workera vs limit, CPU i RAM, napiwki i komentarze na żywo, szybkie akcje (przypnij, wyłącz komentarze, zmień hero, baner). | Premiera to moment największego ryzyka i emocji. Wzorzec Twitch Stream Manager. | M |
| 7 | **Podgląd jako użytkownik** (gość, zalogowany, konkretne konto w trybie tylko do odczytu, z banerem i audytem) | Odpowiada na „czemu ten widz nie widzi filmu”, bez proszenia go o zrzuty ekranu. | M |
| 8 | **Ćwiczenie odtworzenia kopii** co tydzień: odtwarza ostatnią kopię do tymczasowego kontenera Postgres, liczy wiersze kluczowych tabel, zapisuje wynik w `JobRun` | Kopia, której nie sprawdzono, nie jest kopią. Na 4 GB uruchamiamy to nocą z limitem pamięci. | M |
| 9 | **Asystent AI w panelu**: pytania w języku naturalnym → SQL na roli tylko do odczytu z timeoutem i widokami bez danych osobowych (wzorzec PostHog AI). Streszczenia komentarzy, wykrywanie spamu, szkice odpowiedzi w PP Support, wyjaśnianie anomalii z osi zmian. | Analityka bez pisania SQL, czyli zgodnie z życzeniem „wiem wszystko”. Wymaga minimalizacji danych wysyłanych do modelu i umowy powierzenia. | M–L |
| 10 | **Prognozy limitów** („przy obecnym tempie limit Workera skończy się o 21:40”, „dysk pełny za 41 dni”) | Zamienia wykres w decyzję z terminem. | S |
| 11 | **Pasmo „typowego zakresu” i wykrywanie anomalii** (porównanie z tymi samymi godzinami 4 poprzednich tygodni) | Alarmuje tylko przy prawdziwej zmianie, bez progów ustawianych na oko. | S |
| 12 | **Flagi funkcji w runtime** z audytem i harmonogramem | Koniec z deployem dla przełączenia `TEMP_*`. Zmiana jest od razu na osi zmian. | M |
| 13 | **Linki kampanii `/go/…` z QR i licznikiem** | Wiadomo, który post na X, Discordzie czy Instagramie przyniósł widzów, konta i napiwki. | S |
| 14 | **Post-flight po publikacji**: automatyczny test (token → master.m3u8 → pierwszy segment każdej rendycji → miniatura publiczna → OG preview) | Publikacja nie kończy się ślepo. Błędy są widoczne, zanim zobaczą je widzowie. | S |
| 15 | **Podgląd udostępnienia** (jak link wygląda na Facebooku, X, Discordzie i w Messengerze) + kontrola sitemap i robots | Premiera promowana linkiem z dobrym obrazkiem i tytułem. | S |
| 16 | **Tryb incydentu**: jeden przycisk włącza baner na stronie, wstrzymuje rozsyłki, opcjonalnie wyłącza komentarze i zapisuje oś czasu incydentu | Spokojna reakcja według gotowej procedury. | M |
| 17 | **Kalendarz treści z checklistą promocji** (T−7 dni: zapowiedź; T−24 h: rozsyłka; T−0: post; T+24 h: podsumowanie) | Premiery przestają być improwizacją. | M |
| 18 | **Notatnik i dziennik właściciela** (notatki przypinane do daty, widoczne jako adnotacje) | Kontekst „wrzuciłem link na Wykop” zostaje przy wykresie na zawsze. | S |
| 19 | **Eksport wszystkiego** (CSV / JSON per lista, paczka całej bazy do pobrania dla właściciela) | Niezależność danych i księgowość. | S |
| 20 | **Status page** `status.pawelperfect.com` z tych samych kontroli | Mniej pytań w PP Support podczas awarii. | S (LATER) |
| 21 | **Testy A/B miniatur i tytułów** (wymaga C19) | Wyższe CTR. Przy małym ruchu wyniki są statystycznie słabe, więc później. | M (LATER) |
| 22 | **Licznik „czas do wyczerpania budżetu”** dla kosztów zmiennych (R2, Workers, Resend) z alertem miesięcznym | Bez niespodzianek na fakturze. | S |
| 23 | **Rejestr inwentarza infrastruktury** (domeny, DNS, buckety, Workery, tokeny, timery, kontenery) generowany automatycznie, z różnicą względem wczorajszego stanu | Widać każdą zmianę w infrastrukturze, także zrobioną przez agenta AI. | M |

---

## 5. Nawigacja i szkice ekranów

### 5.1 Drzewo nawigacji (8 pozycji głównych + Ustawienia)

```
admin.pawelperfect.com
├─ 1 Dzisiaj                         g d
├─ 2 Analityka                       g a
│   ├─ Ruch i źródła
│   ├─ Lejek i atrybucja
│   ├─ Oglądalność (wszystkie filmy, porównania)
│   └─ Jakość odtwarzania (QoE, Worker HLS, cache)
├─ 3 Treści                          g t
│   ├─ Filmy → [film]: Przegląd | Analityka | Jakość | Edycja | Miniatury | Napisy | Historia
│   ├─ Kalendarz i premiery
│   ├─ Układ kanału
│   └─ Wgrywanie i kodowanie
├─ 4 Społeczność                     g s
│   ├─ Moderacja (skrzynka)
│   ├─ Komentarze
│   └─ Użytkownicy → [osoba 360°]
├─ 5 Przychody                       g p
│   ├─ Napiwki
│   ├─ Bramka (lejek)
│   ├─ Wspierający
│   ├─ Zwroty i spory
│   └─ Stripe (webhooki, wypłaty, rekonsylacja)
├─ 6 Komunikacja                     g k
│   ├─ E-maile (dostarczalność, limity)
│   ├─ Rozsyłki
│   ├─ Szablony
│   └─ PP Support (skrót + link)
├─ 7 System                          g y
│   ├─ Centrum zdrowia i alerty
│   ├─ Serwer i kontenery
│   ├─ Baza danych
│   ├─ Zadania, crony, kopie
│   ├─ Domeny, DNS, Cloudflare, R2
│   ├─ Błędy i logi
│   ├─ Deploye i oś zmian
│   └─ Koszty
├─ 8 Bezpieczeństwo                  g b
│   ├─ Logowania i sesje
│   ├─ Zdarzenia podejrzane
│   └─ Dziennik audytu
└─ ⚙ Ustawienia (na dole paska)      g ,
```

Analityka filmu żyje w Treści → [film] → Analityka, tak jak w YouTube Studio. Zakładka Analityka służy do pracy na całym kanale i do porównań.

### 5.2 Powłoka

```
┌──────────┬───────────────────────────────────────────────────────────────┐
│ ● PP     │ [Szukaj lub polecenie… Ctrl K]   Okres: [28 dni ▾] vs [poprz.▾]│
│ admin    │                                   ● Zdrowie  🔔3   Paweł ▾    │
│──────────├───────────────────────────────────────────────────────────────┤
│ Dzisiaj  │ Tytuł strony                         dane z 09:55 · źródło ⓘ  │
│ Analityka│                                                               │
│ Treści  2│   (treść strony)                                              │
│ Społecz. 5│                                                              │
│ Przychody│                                                               │
│ Komunik. │                                                               │
│ System  ●│                                                               │
│ Bezpiecz.│                                                               │
│          │                                                               │
│ ⚙ Ustaw. │                                                               │
└──────────┴───────────────────────────────────────────────────────────────┘
```

Liczba przy pozycji menu to elementy w kolejce (np. 5 zgłoszeń). Kropka oznacza alert w danym module.

### 5.3 Strona „Dzisiaj”

```
┌ ● Wszystko działa · 0 alertów · ostatnia kopia 02:31 (poza serwerem ✓) ────────────┐
├ WYMAGA UWAGI (4) ─────────────────────────────┬ LIMITY DZIŚ ───────────────────────┤
│ ⚑ 3 zgłoszone komentarze           [Moderuj]  │ Worker HLS  ████░░  41 230/100 000 │
│ ⚖ Spór 50 zł, dowody do 08.10      [Otwórz]   │   prognoza: OK do północy UTC      │
│ ✉ 2 wątki PP Support > 24 h        [Skrzynka] │ Resend      ██░░░░  23/100         │
│ ✕ Kodowanie „jj-v2” nieudane       [Ponów]    │ Dysk 64% · Swap 36% ▲ · R2 38/10GB │
├ KPI (vs ta sama pora tydzień temu) ───────────┴────────────────────────────────────┤
│ Odwiedzający  Obejrzenia  Czas ogl.  Nowe konta  Komentarze  Napiwki               │
│ 1 204 ▲18%    842 ▲9%     212 h ▲4%  37 ▼3%      58 ▲40%     6 · 145 zł ▲          │
│ ▁▂▃▅▆▇        ▂▃▃▄▅▆      ▃▃▄▄▅▅     ▅▄▄▅▃▄      ▁▁▂▅▇▆      ▁▃▂▅▃▆               │
├ TERAZ: 23 osoby · 14 ogląda ──────────────────┬ AKTYWNOŚĆ [wszystko▾] ─────────────┤
│ czesc        9  ▸ startup p95 1,4 s · 0 błędów│ 09:52 💰 Napiwek 20 zł (BLIK) – Ola │
│ dla-patronow 5                                │ 09:50 💬 Nowy komentarz pod „jj”   │
├ NAJLEPSZE 48 h ───────────────────────────────┤ 09:41 🚀 Deploy m10040944          │
│ 1 czesc  612 obej. · 71% obejrzenia ▲ typowy  │ 09:30 👤 Nowe konto (z: x.com)     │
├ NADCHODZI ────────────────────────────────────┤ …                                  │
│ Premiera „…” za 2 d 4 h · kopia 02:30 ·       │                                    │
│ pawelperfect.pl wygasa za 312 dni             │                                    │
└───────────────────────────────────────────────┴────────────────────────────────────┘
```

### 5.4 Film → Analityka i jakość

```
[czesc] Przegląd | Analityka | Jakość | Edycja | Miniatury | Napisy | Historia
Okres: od premiery ▾   porównaj z: typowy film kanału
┌ Obejrzenia 3 412 ┬ Czas ogl. 1 020 h ┬ Śr. % obejrzenia 64% ┬ Napiwki z filmu 12 ┐
├ Retencja ─────────────────────────────────────────────────────────────────────────┤
│100%┐╲___                         ░░ pasmo typowego filmu                         │
│    │    ╲____      ▲ powtórki 12:40                                             │
│ 50%│         ╲_____╱╲______                                                     │
│    │                        ╲___  ▼ przewijanie 31:10                           │
│  0%└───────────────────────────────────────────────── czas filmu                │
├ Jakość: startup p50 0,9 s / p95 2,1 s · wyjścia przed startem 3,1% · błędy 0,4%  ┤
│ buforowanie 0,6% · rendycje: 1080p 58% · 720p 31% · 480p 9% · 360p 2%           │
├ Źródła widzów: x.com 34% · bezpośrednie 29% · e-mail 18% · …   [Lejek filmu ▸]  ┤
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 5.5 Centrum zdrowia

| Kontrola | Stan | Od | Ostatni pomiar | Działanie |
|---|---|---|---|---|
| Strona (z zewnątrz, Worker) | ● OK 182 ms | 6 d | 09:55 | historia |
| Worker HLS / limit | ● 41% limitu | – | 09:55 | prognoza |
| Kopia bazy | ● 02:31, 48 MB, poza serwerem | – | 02:31 | test odtworzenia: 29.09 ✓ |
| Crony (8) | ● 8/8 w terminie | – | – | lista |
| Encoder | ● bezczynny, heartbeat 20 s | – | 09:55 | kolejka |
| Swap | ▲ 36% (próg 25%) | 16 h | 09:55 | kontenery wg RAM |
| Domena pawelperfect.com | ● wygasa 2027-09-28 | – | dziś | RDAP |
| Webhook Stripe | ● ostatnie zdarzenie 09:52, 0 nieudanych | – | 09:55 | zdarzenia |

### 5.6 Interakcje

- **Skróty:**
  - `Ctrl/Cmd+K` – paleta;
  - `?` – lista skrótów;
  - `g` + litera – przejście do modułu;
  - `/` – szukaj na liście;
  - `j` / `k` – następny / poprzedni wiersz;
  - `Enter` – otwórz; `e` – edytuj; `x` – zaznacz;
  - w moderacji: `h` ukryj, `r` przywróć;
  - `[` / `]` – poprzedni / następny okres; `t` – wybór okresu;
  - `Esc` – zamknij.
  
  Skrót jest wypisany obok każdej pozycji w palecie.
- **Globalny filtr czasu:** Dziś, 24 h, 7 dni, 28 dni, 90 dni, 12 miesięcy, od premiery, własny. Porównanie: poprzedni okres, rok wcześniej, typowy film. Strefa Europe/Warsaw. Filtr zapisany w URL (`?range=28d&cmp=prev`), więc każdy widok da się zaimportować do zakładki i wysłać.
- **Zapisane widoki:** każda lista z filtrami to URL, który można nazwać i przypiąć w pasku (wzorzec Linear i Stripe Shortcuts). Tabela `NOWE:AdminView`.
- **Drążenie:** każda liczba jest linkiem do listy z tym samym filtrem (np. „6 napiwków” → `/przychody/napiwki?range=today`). Każdy punkt wykresu → lista zdarzeń z tego przedziału. Każdy wiersz → szczegół 360°.
- **Gęstość informacji:** desktop gęsty jak Linear i Stripe (wiersze 32–36 px, cyfry tabelaryczne), bez dekoracyjnych kart. Telefon: pojedyncza kolumna.
- **Telefon:** dolny pasek z 5 pozycjami (Dzisiaj, Skrzynka, Treści, Przychody, Więcej). Tabele zamieniają się w listy, wykresy w sparkline'y z liczbą. Akcje moderacji i odpowiedzi działają, zwroty i usunięcia wymagają ponownego uwierzytelnienia. PWA z pushami.
- **Tryb ciemny:** systemowy i przełącznik. Kolory semantyczne (ok, ostrzeżenie, krytyczny, informacja) sprawdzone pod kontrast w obu motywach. Paleta wykresów osobna od kolorów stanów.
- **Bez szkieletów:**
  - strony to Server Components czytające lokalne agregaty i migawki (zapytania poniżej 50 ms dzięki rollupom);
  - nic zewnętrznego w czasie renderu;
  - jeśli kafel wymaga dłuższego liczenia (AI, ciężkie zapytanie), pokazuje ostatni wynik z godziną „dane z 09:40” i odświeża się w tle, bez szarych bloków;
  - nawigacja przez prefetch linków i `loading` bez placeholderów (poprzednia strona zostaje do czasu gotowości następnej).
- **Zasady wizualizacji:**
  - liczba z porównaniem i sparkline w kaflu;
  - linia dla trendu, słupki dla kategorii, mapa ciepła dla dnia × godziny;
  - małe wielokrotności (small multiples) zamiast jednego wykresu z 10 liniami;
  - pasmo „typowy zakres”;
  - adnotacje z osi zmian;
  - ostrzeżenie „za mało danych (n=12)”;
  - bez wykresów kołowych, 3D i podwójnych osi;
  - zawsze jednostka i strefa czasu.

---

## 6. Zasady i antywzorce

**Zasady**
1. Mniej wykresów, więcej decyzji: każdy ekran zaczyna się od „co z tego wynika” (stan, anomalia, akcja).
2. Każda liczba ma porównanie, godzinę pomiaru i źródło. Brak danych to stan jawny („brak pomiaru od 14 min”), a nie zero.
3. Każda anomalia i alert ma link do działania (moderuj, ponów, otwórz w Stripe, pokaż logi).
4. Zbieraj teraz, pokazuj później: telemetria i agregaty startują w fazie 0.
5. Kolektory w tle, ekran tylko z lokalnej bazy. Dzięki temu panel jest szybki i nigdy ślepy.
6. Monitor poza monitorowanym serwerem.
7. Operacje nieodwracalne: podgląd skutku, ponowne uwierzytelnienie, klucz idempotencji, wpis w audycie, w miarę możliwości cofnięcie.
8. Lekkość: żadnego komponentu potrzebującego GB RAM. Ciężkie rzeczy (GlitchTip, Umami) dopiero na drugim serwerze.
9. Prywatność: analityka bez ciasteczek, hashe zamiast IP, minimalizacja danych do AI, aktualizacja polityki prywatności przed włączeniem telemetrii.
10. Jeden język (polski), jedna powłoka, jeden komponent tabeli, jeden formularz na obiekt.

**Antywzorce do uniknięcia**
- „Zbuduj sobie dashboard” (Directus, Grafana) dla jednej osoby. Projektujemy gotowe ekrany.
- Stos obserwowalności cięższy niż aplikacja: Sentry self-host (16 GB), PostHog (16 GB), Prometheus z Grafaną i Loki na 4 GB.
- Wywołania API Cloudflare, Stripe i Resend w czasie renderu strony (wolno, kruche, limity CF 300 zapytań / 5 min).
- Szkielety ładowania i migające liczniki. Wykresy bez kontekstu i porównania. Średnie bez percentyli przy czasie startu.
- Alerty bez progów histerezy (spam powiadomień) albo bez godzin ciszy.
- Liczby z małych prób przedstawione jak pewniki (retencja z 8 sesji).
- Atrapy filtrów i statystyk, które nic nie robią (ADM-07). Lepiej nie pokazać funkcji niż pokazać martwą.
- Testy „tekstu źródła” zamiast testów zachowania (ADM-31).
- Admin jako zwykły użytkownik ze „przełączką”: osobna subdomena, osobna sesja, osobne wymagania logowania.

---

## 7. Fazy budowy

**Faza 0: szkielet, logowanie i zbieranie danych (ok. 1–2 tygodnie)**
- Aplikacja na `admin.pawelperfect.com`: powłoka z nawigacją z 5.1, tokeny wyglądu, tryb ciemny, globalny filtr czasu w URL, paleta Ctrl+K (wyszukiwanie obiektów), `?` ze skrótami.
- Osobne logowanie admina: passkey lub TOTP obowiązkowe, ponowne uwierzytelnienie dla operacji nieodwracalnych, sesja niezależna od serwisu, rozważyć Cloudflare Access jako drugą warstwę (już używany dla `support.`).
- **Włączenie zbierania:** T1 (`PageEvent`), T2 (QoE w hls.js), T3 (rollupy przed pruningiem), T4 (metryki serwera i kontenerów), T5 (heartbeaty wszystkich cronów, `backup.sh` i encodera), T6 (błędy), T7 (kolektory CF, Stripe, Resend, RDAP, PPS), T8 (deploy w `deploy.sh`), T10, T11, T13. Do tego zmiana polityki prywatności (analityka bez ciasteczek).
- Strażnik zewnętrzny (Worker z cronem) i alert e-mailem.

**Faza 1: MUST na start publiczny (ok. 3–5 tygodni)**
- **Dzisiaj:** A1–A3, A5, A6, A10.
- **System:** H1–H7, H9–H12, kopia poza serwerem oraz pierwszy test odtworzenia (narzędzie 8), alerty z J4.
- **Treści:** D1–D7, D10, D12 oraz post-flight po publikacji (narzędzie 14).
- **Społeczność:** E1, E2, E6–E9.
- **Przychody:** F1–F9.
- **Komunikacja:** G1–G5, G8, G9.
- **Bezpieczeństwo:** I1–I4.
- **Analityka:** B1–B3, B6 (wersja z liczbami), B7, C1, C2, C7–C10, C14, C15.
- **Tryb „Premiera na żywo”** (narzędzie 6), bo start to premiera. Poranny raport e-mailem (narzędzie 4).
- Wszystkie P1 z audytu ADM znikają przy przepisaniu (paginacja, układ, zwroty, potwierdzenia).

**Faza 2: SHOULD, 1–2 miesiące po starcie**
- Retencja i porównania filmów: C3, C4, C6, C11–C13, C17–C20.
- Ruch: B4, B5, B8–B13.
- Web Vitals (T12, H18), baza (H13, H14), R2 i koszty (H15, H16), logi (H19), aktualizacje i prognozy (H20, H21, narzędzia 10–11), DNS (H8).
- Bezpieczeństwo: I5–I11.
- PWA z pushami (narzędzie 5), zapisane widoki, flagi funkcji (J3), kalendarz (D6, narzędzie 17), linki kampanii (narzędzie 13), podgląd jako użytkownik (narzędzie 7), oś zmian z notatkami (narzędzia 3, 18), eksport (narzędzie 19).
- AI: streszczenia komentarzy, wykrywanie spamu (E5), szkice odpowiedzi.

**Faza 3: LATER**
- Asystent AI z pytaniami w języku naturalnym → SQL (narzędzie 9).
- Testy A/B miniatur (narzędzie 21), kluczowe momenty (C5), kohorty (B14), status page (narzędzie 20), tryb incydentu (narzędzie 16), prognoza przychodu (F14), rozdziały (D13).
- GlitchTip i Umami jako drugi zegar na drugim serwerze, jeśli własne narzędzia okażą się za mało.

---

## Źródła

- https://www.mux.com/docs/guides/data/understand-metric-definitions
- https://www.mux.com/docs/guides/data/startup-time-metric
- https://www.mux.com/docs/guides/data/smoothness-metric
- https://www.mux.com/docs/guides/data/playback-success-metric
- https://support.google.com/youtube/answer/9314415
- https://www.tubeanalytics.net/blog/youtube-studio-analytics-guide
- https://help.twitch.tv/s/article/stream-manager
- https://stream-rise.com/blog/stream-manager
- https://help.ko-fi.com/hc/en-us/articles/360004392158-Set-your-Ko-fi-Goal
- https://behindrankings.com/ko-fi-review/
- https://ghost.org/help/post-analytics/
- https://docs.stripe.com/dashboard/basics
- https://docs.stripe.com/api/events/object
- https://plausible.io/docs/metrics-definitions
- https://docs.umami.is/docs/ and https://docs.umami.is/docs/install
- https://posthog.com/docs/web-analytics
- https://posthog.com/docs/self-host
- https://posthog.com/docs/product-analytics/analyze-data-ai
- https://developers.cloudflare.com/web-analytics/get-started/
- https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/
- https://developers.cloudflare.com/analytics/graphql-api/
- https://developers.cloudflare.com/analytics/graphql-api/limits/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/r2/pricing/
- https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/annotate-visualizations/
- https://github.com/louislam/uptime-kuma
- https://betterstack.com/docs/uptime/cron-and-heartbeat-monitor/
- https://develop.sentry.dev/self-hosted/
- https://glitchtip.com/documentation/install
- https://beszel.dev/guide/what-is-beszel
- https://vercel.com/docs/observability
- https://linear.app/docs/conceptual-model
- https://fastshortcuts.com/shortcuts/linear/
- https://directus.com/docs/guides/insights/overview
- https://resend.com/docs/knowledge-base/account-quotas-and-limits
- https://dns.pl/en/RDAP_in_NASK
- https://dns.pl/en/NASK_extension_of_RDAP_Response
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
