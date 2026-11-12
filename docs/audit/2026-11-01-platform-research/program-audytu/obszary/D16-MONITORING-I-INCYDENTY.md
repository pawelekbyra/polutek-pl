# D16 — monitoring i incydenty

Stan: **W_TRAKCIE**, 2 listopada 2026, partia 14. Kod Polutka `c397b9e548ca2c628e21457ac69d66e54b12ddbd`; PeerTube `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`. Rodzic zapisu `fe1efe563f311d6fa4cf8a62779b699627ae5d66`. Analiza bez zmian aplikacji, produkcji i wysyłania wiadomości.

Polutek ma już użyteczne podstawy: zewnętrzny watchdog, heartbeat hosta, kontrolę procesów i zasobów, panel stanów kolejek oraz pomiary jakości odtwarzania. To więcej niż pojedynczy adres „health”. Nie ma jednak dowodu, że te elementy wykryją każdą awarię filmu albo skutecznie zawiadomią operatora. Potwierdzono granice znanego R18 i osobny **R36: możliwość utraty powiadomienia o zakończeniu awarii**. Nie stwierdzono rzeczywistego incydentu produkcyjnego.

Przy kilkunastu twórcach i 10000 równoczesnych widzów najważniejsze jest wykrycie skutku dla widza oraz czasu do reakcji. Sama liczba zielonych kontrolek tego nie potwierdza. Nie ustalono jeszcze SLO, czyli mierzalnego celu dostępności i jakości; dokument nie przypisuje platformie deklaracji „99,9%”.

## Dowody i granice

- [Zakres/hash plików i metody](../evidence/batch14-review.json), [brak zmian aplikacji](../evidence/source-scope-batch14.json), [walidacja artefaktów](../evidence/validation-batch14.json).
- [Watchdog: dziewięć obserwacji](../evidence/watchdog-delivery-experiment.json), [skrypt](../tools/watchdog-delivery-experiment.cjs). Rzeczywisty, niezmieniony Worker.fetch i funkcje wewnętrzne, lecz zegar, D1 i odpowiedzi wszystkich fetch są atrapami. Request/Response to obiekty lokalne, nie połączenie z Cloudflare. Zero wiadomości i połączeń z dostawcą.
- [Health/probes/logger: 13 obserwacji](../evidence/monitoring-boundaries-experiment.json), [skrypt](../tools/monitoring-boundaries-experiment.cjs). Rzeczywiste funkcje TS; jawne atrapy bazy, fetch i konfiguracji kanału. Nazwy enum VideoStatus pochodzą ze schematu i są przekazywane lokalnie w VM; nie podstawiano zainstalowanego klienta Prisma ani nie uzyskiwano w ten sposób zielonego Vitest. Bez Next, rzeczywistego HTTP/SQL, klienta Prisma i systemu operacyjnego produkcji.
- [Istniejący Vitest JSON](../evidence/monitoring-targeted-vitest.json), [log](../evidence/monitoring-targeted-vitest.log): **exit 1 całego wywołania**. Pięć plików przeszło: 22 zarejestrowane testy, 22 passed, zero failed/pending. Szósty plik `admin-overview/time-and-rules.test.ts` zablokowany przed rejestracją przez niewygenerowany Prisma. Nie uznawać całego wywołania za zielone ani blokady za dowiedziony błąd produkcji.
- [22 scenariusze](../SCENARIUSZE-MONITORING.csv), [mapa monitoringu](../MONITORING-POKRYCIE.csv), [mapa logów](../LOGOWANIE-POKRYCIE.csv). Każda pełna próba stosu pozostaje NIEWYKONANA. Liczba obserwacji nie oznacza liczby pełnych testów incydentów.
- Pierwsza próba harnessu Workera miała błąd formatu modułu, zanim zarejestrowano obserwacje. [Zapis zachowany](../evidence/watchdog-harness-initial-failure.json). Poprawiono wyłącznie konfigurację transpile w skrypcie badawczym; finalny przebieg exit 0. Nie zmieniono Workera.

## Co już działa sensownie

| Mechanizm | Dowód i wartość | Granica dowodu |
|---|---|---|
| Watchdog poza hostem | Kod rozdziela próby WWW, domeny video, support i heartbeat; timeout 10 s na probe, próg dwóch porażek, przypomnienie po 6 h, limit 20 wiadomości/dobę | Konfiguracja cron, D1, dostawcy i faktyczna skrzynka nie były sprawdzane |
| Heartbeat hosta | Brak pingu/starość ponad 15 min wykrywane osobno; długie WARN eskaluje po 30 min | Przegląd źródła, nie rzeczywista awaria hosta; zewnętrzne okno detekcji zależy także od harmonogramu |
| Health z nagłówkiem | Rzeczywisty use case przy poprawnym syntetycznym tokenie wykrywa błąd zapytania DB; zły token nie ujawnia diagnostyki | Nie wykonano trasy Next ani połączenia z bazą |
| Probe Redis | Nie wystarcza HTTP 200: odpowiedź musi odpowiadać PONG; oba warianty sprawdzone | Atrapa REST Redis, bez awarii realnej usługi |
| Encoder | Stary heartbeat RUNNING daje crit, stara kolejka bez aktywnego zadania warn, świeży heartbeat ok | Fakty zadań były syntetyczne; panel nie jest sam w sobie zewnętrznym alarmem |
| Płatności/kolejki | Kolektor panelu ma reguły m.in. FAILED/stuck Stripe, stary PENDING i błędy broadcastów | Nie dowodzi wysłania alarmu operatorowi, obsługi wszystkich dostawców lub poprawnego rozliczenia |
| Jakość odtwarzania | Tracker rejestruje start, wyjście przed startem, zacięcia, błędy i zmiany jakości; sześć istniejących testów przeszło | Brak pełnej ścieżki klient → kolektor → agregaty → panel → alarm; adblock/offline i brak prób wymagają osobnej oceny |
| Redakcja logów | Logger maskuje syntetyczne wrażliwe klucze, query i userinfo URL; scopedLogger zachowuje wspólne requestId | Nie obejmuje automatycznie każdego console, każdego pola i wszystkich logów infrastruktury |

Hostowe skrypty mają też `OnFailure` systemd, ograniczenie częstości wiadomości i best-effort zapis `telemetry.job_run`. W `common.sh` znacznik wysłania alertu jest zapisywany dopiero po udanym curl. To odrębny mechanizm od R36 Workera; nie przenosimy na niego automatycznie wyniku eksperymentu. Skryptów hosta nie uruchamiano — mogłyby wczytać rzeczywiste sekrety i wykonać operacje.

## R18 — odpowiadający proces nie oznacza działającej usługi wideo

Źródła: [publiczna trasa health](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/api/health/route.ts), [use case](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/health/application/check-health.use-case.ts), [probes panelu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/admin-overview/infrastructure/probes.ts), [health hosta](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/scripts/serwerek/health.sh).

1. Publiczny health bez poprawnego `x-health-token` zwraca `{ok:true}` bez zapytania diagnostycznego do DB. W próbie DB mogłaby rzucić, ale nie została dotknięta. Jest to świadomy lekki endpoint, nie dowód zdrowia bazy.
2. Tokenowany use case potrafi zwrócić `{ok:false,database:"failed"}`. Trasa podaje jego wynik do `handleApiResponse` bez zmiany domyślnego statusu 200 — ustalenie z odczytu kodu, nie wykonanej trasy. Probe panelu ocenia status, więc fixture HTTP 200 z takim body nadal jest „ok”. Dopuszcza także 404, odrzuca 502.
3. Health może mieć `ok:true`, a szczegółowe pola `mainChannelPublic:false` i zero filmów. Te pola nadają się do interpretacji przez odbiorcę; nie każdy brak treści jest awarią. Ogólny `ok` nie jest gwarancją gotowości produktu.
4. Watchdog domeny video akceptuje 404 korzenia; probe HLS w panelu wykonuje HEAD korzenia i przyjmuje status poniżej 500. Żaden z tych konkretnych probe nie pobiera manifestu i segmentu znanego filmu. W próbie zapisano wszystkie wywołane adresy. Nie zasymulowano ani nie udowodniono rzeczywistej awarii R2.
5. `health.sh` sprawdza lokalny i publiczny health po HTTP, **bez diagnostycznego nagłówka**. Bada również stan kontenera DB, ale to nie jest zapytanie SQL. Historyczny skrót sugerujący tokenowany probe hosta nie powinien być używany jako opis bieżącego skryptu; raport bazowy zostaje zachowany, to jest jego doprecyzowanie.

**Skutek:** awaria manifestów/segmentów, uprawnień lub startu odtwarzania może nie zmienić tych kontrolek. To granica pokrycia R18, nie dowód, że wszystkie awarie są niewykrywalne. Istnieją dodatkowe sygnały DB, kolejek i QoE, lecz w tej partii nie wykazano ich pełnego połączenia z zewnętrznym alarmem.

**Kierunek:** rozdzielić lekki liveness, chroniony readiness zależności oraz syntetyczny test znanego filmu: uzyskanie dostępu, manifest, właściwy segment i faktyczny start dekodowania. Osobno kontrolować ścieżkę od uploadu do publikacji. Próbki muszą mieć bezpieczny koszt, własne treści i sprzątanie; nie używać tokenów widzów. Dla płatności monitorować zdarzenia i uzgodnienie, nie cyklicznie obciążać karty.

**Uzupełnienie K30, 7 listopada 2026:** app probe przyjmuje tylko statusy 2xx. `/api/health` bez tokenu jest liveness; z ważnym `x-health-token` jest readiness i odpowiedź zależności `ok:false` mapuje się na HTTP 503. Test use case potwierdza, że niedostępne SQL daje `{ok:false,database:"failed"}`. Trasa 3/3, łącznie celowane health/probe **29/29 PASS**, lint i typecheck PASS. Nadal brak canary manifestu/segmentu/dekodowania i end-to-end alertu. HLS Worker wymaga podpisanego, krótkotrwałego tokenu, więc nie należy konfigurować w zewnętrznym watchdogzie statycznego URL, który wygaśnie lub będzie bearer credentialem; kolejny projekt powinien mintować token po stronie aplikacji dla jawnie wybranego, własnego publicznego kontrolnego filmu.

## R36 — utracone powiadomienie „OK again”

Źródło: [Worker, przejście stanu i zapis](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/workers/pp-watchdog/worker.mjs#L88). Priorytet **P2 operacyjny**, niezależny przegląd PENDING.

Odtworzony przebieg rzeczywistego handlera z atrapami:

1. Dwie kolejne porażki WWW powodują alarm DOWN; syntetyczny dostawca odpowiada sukcesem.
2. WWW zdrowieje. `nextState` ustawia `ok=1`, `fails=0`, `last_alert=null` i tworzy wiadomość OK again.
3. Dostawca zwraca HTTP 503. `sendMail` zwraca false, lecz rollback w `runChecks` działa tylko przy `state.last_alert === now`, czyli dla DOWN. Stan zdrowy zostaje zapisany bez oczekującej wiadomości.
4. W następnym zdrowym przebiegu, mimo sprawnego dostawcy, ponownej próby nie ma. Tak samo jest po odmowie przez limit 20 wiadomości: kolejny dzień nie przywraca utraconego powiadomienia o poprawie.

**Kontrole ograniczające wniosek:** nieudany DOWN HTTP 503 jest ponawiany przy kolejnym złym wyniku. DOWN zatrzymany limitem zostaje wysłany następnego dnia przy nadal trwającej awarii. Wyjątek sieciowy przy recovery przerywa wykonanie przed zapisem zdrowego stanu, więc następna zdrowa próba ponawia recovery. R36 nie dotyczy jednakowo wszystkich rodzajów niepowodzeń dostawcy. Przyjęcie przez API dostawcy też nie jest gwarancją doręczenia do skrzynki.

**Znaczenie:** operator może otrzymać wiadomość o awarii, a potem nie otrzymać informacji o poprawie i nie wiedzieć, czy incydent trwa. Nie wykazano utraty ostrzeżenia o rozpoczęciu awarii w tym scenariuszu. Nie jest to duplikat R05: tam chodzi o okno przed utworzeniem powiadomień publikacji w aplikacji, tutaj o oddzielny stan recovery w edge watchdogu.

**Propozycja, bez wdrożenia:** oddzielić stan obserwowanej usługi od trwałego zdarzenia powiadomienia z id incydentu i statusem dostarczenia. Ponawiać niezaakceptowane zdarzenie również po powrocie usługi i po zmianie dnia; ustalić politykę kolejności oraz duplikatów. Dodać ograniczony timeout dostawcy. Outbox zmniejsza ryzyko utraty, ale sam nie gwarantuje dokładnie jednego e-maila przy niepewnej odpowiedzi.

**Test odbioru:** DOWN zaakceptowany → recovery HTTP 503 / limit → zdrowy kolejny przebieg / kolejny dzień → recovery ponowione i oznaczone dopiero po akceptacji. Kontrole: wyjątek sieciowy, błąd zapisu D1, równoległe scheduled/manual run, timeout i duplikat, nowa awaria zanim poprzednie recovery zostało wysłane. Ówczesny eksperyment nie testował współbieżności ani atomowości D1.

### K31 — lokalna implementacja, 6 listopada 2026

Worker zapisuje zdarzenie DOWN/recovery do tabeli D1 `alert_delivery` przed wysyłką i ponawia je po błędach HTTP, wyjątkach sieciowych oraz limicie dziennym. Dzienny limit odkłada próbę do następnej północy UTC; błędy dostawcy używają rosnącego odstępu do 6 godzin. Warunkowa aktualizacja z krótką dzierżawą chroni zdarzenie przed równoległym runem, a stały `Idempotency-Key` wiąże retry z tym samym zdarzeniem. Healthy stan monitoringu jest zapisywany niezależnie od zaległej wiadomości.

Nowe testy jednostkowe z atrapą D1 i całkowicie stubowanym fetch potwierdzają: recovery HTTP 503 i późniejsze ponowienie, oczekiwanie do resetu dziennego limitu, wyjątek sieciowy i jeden claim przy dwóch współbieżnych uruchomieniach. Razem z dotychczasowymi testami: 6/6; kontrola architektury i typecheck PASS, ESLint bez błędów (jedno ostrzeżenie anonymous default export). Dodatkowy [probe SQLite](../tools/k31-watchdog-sqlite-check.mjs) wykonał rzeczywisty kod Workera na lokalnym in-memory SQLite 3.51.3: schema i `UPDATE ... RETURNING` zadziałały, dwa równoległe runy dały jeden call provider stub. Wynik i hashe: [K31 evidence](../evidence/k31-watchdog-outbox-2026-11-06/result.json). Nie sprawdzono Cloudflare D1 runtime/konfiguracji wdrożonej bazy, Workera, Resend ani skrzynki. K31 pozostaje częściowy do niezależnego sprawdzenia D1, awarii między akceptacją Resend i zapisem SENT, timeoutu i prób w sandboxie. Klucz idempotencji ogranicza duplikaty; nie jest gwarancją dostarczenia do skrzynki ani absolutnie dokładnie jednego e-maila.

**Uzupełnienie K31, 7 listopada 2026:** po akceptacji przez provider worker zapisuje SENT, zwiększa `alert_day` i usuwa przeterminowane dni w jednej transakcyjnej partii `D1.batch()`. Lokalny SQLite rollback po pierwszym statement zostawił delivery PENDING i nie zwiększył kwoty; kolejna próba wysłała to samo ID idempotencji, zapisała SENT i naliczyła event tylko raz. 7/7 testów jednostkowych, repo typecheck, ESLint bez błędów (jedno istniejące ostrzeżenie) i aktualny probe SQLite PASS. [Dowód](../evidence/k31-atomic-acceptance-2026-11-07/result.json). Nadal trzeba sprawdzić Cloudflare D1 i kontrakt/retencję idempotencji Resend w sandboxie; wynik nie dowodzi dokładnie jednego e-maila w skrzynce.

## Logi, korelacja i prywatność

Rzeczywisty logger pozytywnie przeszedł próby redakcji oraz korelacji requestId. Płatności mają w wybranych wpisach id zdarzenia i płatności; pomaga to śledzić retry. Z tego nie wynika wspólny identyfikator całej drogi przeglądarka → API → zadanie → encoder → publikacja. [Mapa logów](../LOGOWANIE-POKRYCIE.csv) rozdziela źródła i niewiadome.

W kontrolnej próbie logger zachował syntetyczny marker w ścieżce URL w kształcie adresu HLS. Maskowanie query nie jest maskowaniem tokenu umieszczonego w path. **Nie znaleziono w tej partii konkretnego wywołania, które zapisuje ważny token widza**, nie użyto poprawnego tokenu i nie ogłaszamy wycieku. To pytanie do przeglądu wszystkich miejsc logowania, reverse proxy/CDN i dostępu do logów. Nie dodano nowego ustalenia bezpieczeństwa.

`health.sh` ogranicza swój health.log do 5000 linii; brak analogicznej rotacji alerts.log w tym konkretnym skrypcie nie dowodzi braku zewnętrznego logrotate. Nie sprawdzono aktywnej retencji Docker/journald/CDN/DB, dostępu personelu, eksportu ani tego, czy logi przetrwają utratę hosta. W ASVS V16.2.4/V16.2.5 rozpoczęto częściową ocenę, niczego nie zaliczono.

Podsumowanie panelu świadomie pomija INFO przy określaniu najgorszego stanu. Sama pozycja INFO daje „Działa: 0 z 0 kontroli OK”. To zaobserwowana polityka, a nie nowe potwierdzone uszkodzenie. W procedurze operatora trzeba rozróżniać „nie zmierzono” i „zmierzono zdrowe”, w tym świeżość cache probe (60 s) i czas ostatniej próbki.

## Porównanie z PeerTube

Przeczytano wybrane źródła, **nie uruchomiono PeerTube**. [Dokładna lista/hash](../evidence/batch14-review.json). Nie ma porównywalnego benchmarku ani dowodu, że jego operator otrzymuje wszystkie alarmy.

| Obszar | Konkretne rozwiązanie PeerTube | Wniosek dla Polutka |
|---|---|---|
| Eksport metryk | [OpenTelemetry/Prometheus](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/opentelemetry/metrics.ts), obserwatory kolejek lokalnych i zewnętrznych runnerów | Rozdzielić liczbę oczekujących, aktywnych, błędnych i wiek najstarszego zadania; udostępnić do trwałej analizy i alarmów, poza panelem |
| Baza | Osobne health/lag replik i fallback queries | Przy ewentualnym read-scaling mierzyć opóźnienie i zgodność z oczekiwaniami, nie tylko ping do DB; nie budować replik bez potrzeby |
| Jakość widza | [Playback metrics](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/opentelemetry/metric-helpers/playback-metrics.ts): błędy, stalls, jakość, HTTP/P2P | Polutek ma już własne startup/rebuffer/exit-before-start. Najpierw wykazać kompletność transportu i zbudować alarmy/percentyle; brak podstaw do wyrzucenia istniejącego trackera |
| Korelacja | Logger JSON, rotacja plików, opcjonalne traceId/spanId; instrumentacja HTTP/DB/Redis | Przejąć wzorzec korelacji i kontrolowanej retencji. Wybrać nośnik/format zgodnie z wdrożeniem, bez kopiowania całego stosu Winston/Jaeger |
| Koszt i poufność | [Konfiguracja](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/config/default.yaml#L392): metrics i tracing domyślnie off, exporter loopback; komentarz ostrzega o cardinality HTTP duration | Metryki z videoUUID i szczegółowe ślady też kosztują i wymagają prywatności. Nie dodawać tokenów/userId jako etykiet; ocenić sampling, retencję i budżet |

Walidator playback PeerTube kontroluje typy/liczby i istnienie filmu; przy wyłączonych metrics kończy odpowiedzią 204 przed handlerem, mimo dodatkowej odmowy 403 w handlerze. Sam odczyt jednej funkcji mógłby tu dać mylny opis. Nie przetestowano walidatora, limiterów ani eksportera runtime. Tracing ma bogate opcje raportowania DB/argumentów Redis; większa szczegółowość wymaga przeglądu danych, nie jest automatycznie bezpieczniejsza.

Przeczytano online oficjalny [opis sygnałów OpenTelemetry](../sources/opentelemetry-signals.md): logs, metrics, traces i baggage służą różnym rodzajom obserwacji. To podstawa do uporządkowania mapy sygnałów, nie norma zgodności ani nakaz instalacji OpenTelemetry. [Pobranie HTTP 200/hash](../sources/fetch-monitoring-batch14.json), autor OpenTelemetry Authors, niezmieniona kopia, [licencja CC BY 4.0](../sources/opentelemetry-website-LICENSE).

## Jak dojść do sprawdzonej gotowości operacyjnej

To plan odbioru, nie wykonane ćwiczenia ani zatwierdzone cele liczbowe:

1. Ustalić mierzone cele: udane starty, czas do pierwszej klatki p95/p99, udział zacięć, czas kodowania/publikacji, świeżość kolejki i płatności. Określić mianownik, okno, brak danych, zakres publiczny/płatny i koszt prób. Sam średni czas ukrywa ogon problemów.
2. Każdemu istotnemu sygnałowi przypisać właściciela, próg, adresata, instrukcję i identyfikator incydentu. Potwierdzić odbiór także alarmu końca awarii. Panel z czerwonym polem nie zastępuje tej ścieżki.
3. W odizolowanym środowisku wykonać awarie: DB niedostępna; świeży proces bez HLS; błędny manifest/segment; encoder bez heartbeat; przyrastająca kolejka; opóźniony webhook; zapełnienie dysku; brak heartbeatu; niedostępny dostawca alarmów. Nie wywoływać ich na produkcji.
4. Zapisać dla każdej próby rzeczywisty czas awarii, wykrycia, wysłania/akceptacji/odbioru alarmu, reakcji i przywrócenia; porównać z uzgodnionymi celami. Sprawdzić także brak fałszywego alarmu podczas planowanej przerwy i jego zakończenie.
5. Przećwiczyć odtworzenie z kopii i rollback wdrożenia w D17. Obecność timera lub pliku backupu nie potwierdza odzyskania filmu, płatności i kont; zachować R12 zamiast tworzyć duplikat.

Instrukcje w `docs/operations/SERWEREK.md`, `health.sh`, `common.sh`, `cron-runner.sh` i `unit-failed.sh` zawierają praktyczne ścieżki diagnozy. Nie ustalono jednak kompletnej, aktywnej obsady incydentu, zastępstwa, odbioru alarmów i wyniku regularnych ćwiczeń. Brak takiego dowodu nie oznacza, że nikt nigdy nie reagował. Te pytania, pełna ścieżka QoE i niezależny przegląd R18/R36 pozostają otwarte.
