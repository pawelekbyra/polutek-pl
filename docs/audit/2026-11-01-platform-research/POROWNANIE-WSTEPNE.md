# Polutek i PeerTube — pierwsze porównanie kodu

Stan przeglądu: 1 listopada 2026. Cel: wybrać rozwiązania PeerTube, które mogą poprawić niezawodność i rozwój Polutka. To przegląd wybranych przepływów, nie pełny audyt bezpieczeństwa ani pomiar wydajności.

## Porównane źródła

- Polutek: `/workspace/polutek-pl`, commit `c397b9e548ca2c628e21457ac69d66e54b12ddbd`.
- PeerTube: `/workspace/PeerTube`, commit `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`.
- PeerTube pobrano z `https://github.com/Chocobozzz/PeerTube.git`, płytkim klonowaniem aktualnej domyślnej gałęzi. Przypięcie do powyższych commitów określa zakres wniosków.
- Nie zmieniono kodu, testów ani zależności żadnego projektu. PeerTube nie instalowano i nie uruchamiano; wnioski dotyczą jego implementacji i treści testów.

## Wniosek

Najbardziej opłaca się przejąć podejście PeerTube do odporności uploadu, testów całego przepływu i kontroli poprawności przy budowie. Polutek ma już sensowny podział domenowy, bezpieczny model wydawania źródeł odtwarzania, osobny proces kodowania, ponowienia zadań i pomiary jakości oglądania. Nie ma podstaw, żeby przepisywać projekt na stos PeerTube.

| Kolejność | Zmiana | Korzyść | Charakter |
|---|---|---|---|
| 1 | Wznawianie uploadu w Studiu, wspólna logika z panelem | Awaria sieci nie zmusza twórcy do wysyłania filmu od początku | Potwierdzona luka funkcjonalna |
| 2 | Test całego przepływu upload → kodowanie → odtwarzanie | Wykrywa błędy pomiędzy działającymi osobno modułami | Potwierdzona luka w obecnej konfiguracji E2E |
| 3 | Obowiązkowy typecheck na drodze budowy/wydania | Obraz aplikacji nie powstanie z błędem typów | Luka w egzekwowaniu kontroli |
| 4 | Metryki i alarmy procesu kodowania | Widać degradację, zanim zgłosi ją użytkownik | Rozszerzenie istniejącego monitoringu |
| 5 | Wspólny, sprawdzany kontrakt API | Mniej rozjazdów między Studiem, panelem i backendem | Usprawnienie rozwoju |
| 6 | Wznawianie etapów kodowania, potem zdalne workery | Mniej powtarzanej pracy po awarii | Warunkowo, po pomiarze kosztu awarii |
| 7 | Miniatury podczas przewijania | Wygodniejsze szukanie fragmentu filmu | Opcjonalne ulepszenie produktu |

## 1. Upload: PeerTube ma spójniejszą odporność, a Polutek ma już większość potrzebnych części

**PeerTube:** wspólna usługa konfiguruje upload wznawialny dla nowego filmu i wymiany źródła. Retry zależy od odpowiedzi serwera; chwilowe 503 są traktowane inaczej niż trwałe błędy. Są też testy rzeczywistych żądań HTTP, nieukończonych uploadów, sprzątania i magazynu obiektowego.

Źródła:

- [Usługa uploadu PeerTube](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/client/src/app/+videos-publish-manage/shared-manage/common/video-upload.service.ts#L48)
- [Polityka ponowień PeerTube](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/client/src/app/helpers/utils/upload.ts#L30)
- [Testy uploadu przez API](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/api/videos/resumable-upload.ts#L26)

**Polutek:** klient Studia zawsze otwiera nowy upload przez POST. Nie odtwarza zapisanej sesji i nie pobiera listy istniejących części; po wyczerpaniu prób wywołuje DELETE. Backend Studia ma jednak GET do listowania części. Co więcej, uploader panelu administratora już pamięta `originalId`, wznawia brakujące części, raportuje prędkość/ETA i potrafi odświeżać podpisane adresy.

Źródła:

- [Klient Studia](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/components/studio/upload-original.ts#L43)
- [Przerwanie sesji po błędzie](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/components/studio/upload-original.ts#L99)
- [Gotowe API wznawiania Studia](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/api/studio/videos/[id]/upload/route.ts#L19)
- [Gotowa obsługa wznawiania w uploaderze panelu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/video-upload/multipart-uploader.ts#L99)

**Zmiana:** wydzielić wspólny silnik uploadu i adaptery tras Studia/panelu. Samo przekazanie innego `apiBase` nie wystarczy: końcówki tras mają inne struktury. Zachować sesję przy błędzie przejściowym i pauzie; usuwać ją przy świadomym anulowaniu. Odróżnić wygaśnięcie adresu części od utraty uprawnień. Nie kopiować mechanicznie liczby prób PeerTube.

**Warunek odbioru:** po przesłaniu części filmu odświeżenie karty i ponowne wybranie tego samego pliku wysyła wyłącznie brakujące części. Testy obejmują też wygasły podpis, brak sieci, odebrane uprawnienia i świadome anulowanie.

## 2. Testy: PeerTube sprawdza działający przepływ, nie tylko jego elementy

**PeerTube:** test HLS uruchamia serwery, wysyła film przez API, czeka na zadania i sprawdza playlisty. Ten sam zestaw obejmuje brak audio, różne ustawienia współbieżności, magazyn obiektowy i usuwanie rezultatów. Są osobne scenariusze wyłączania runnera.

Źródła:

- [Upload i kontrola wyprodukowanego HLS](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/api/transcoding/hls.ts#L41)
- [Warianty magazynu i współbieżności](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/api/transcoding/hls.ts#L145)
- [Zatrzymywanie runnera](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/peertube-runner/shutdown.ts#L1)

**Polutek:** ma testy prawdziwego FFmpeg, testy Postgresa i liczne testy logiki procesu kodowania. Jednak test procesu używa atrap enkodera i magazynu, więc nie dowodzi zgodności całego łańcucha. Playwright wskazuje `tests/e2e`, ale tego katalogu nie ma w porównanym checkoutcie. Polecenie `npm run e2e:list` zakończyło się kodem 1: `No tests found`, 0 testów.

Źródła:

- [Konfiguracja Playwright](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/playwright.config.ts#L12)
- [Atrapy procesu kodowania](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/tests/unit/video-pipeline/process-encode-job.test.ts#L65)
- [Istniejące testy prawdziwego FFmpeg](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/tests/unit/hls/encode-hls.ffmpeg.test.ts#L53)

**Zmiana:** dodać mały zestaw integracyjny z lokalnym Postgresem, magazynem zgodnym z S3 i prawdziwym workerem. Najpierw jeden krótki film od żądania uploadu do pobrania segmentu. Następnie test przeglądarkowy, który potwierdza ruch klatek, a nie tylko obecność elementu `<video>`.

**Warunek odbioru:** działający upload, zakodowane HLS i odtwarzanie publiczne; odmowa dla gościa przy filmie wymagającym konta; wznowienie po restarcie workera; wymiana filmu zachowująca poprzednią wersję do ukończenia nowej. Testy używają lokalnych zasobów i nie wymagają produkcyjnego R2.

## 3. Budowanie: kontrola typów powinna być obowiązkowym warunkiem

**PeerTube:** skrypt budowy serwera ma `set -eu` i uruchamia kompilację TypeScript przed kolejnymi etapami. Błąd kompilacji przerywa ten skrypt.

- [Budowa serwera PeerTube](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/scripts/build/server.sh#L3)

**Polutek:** obie aplikacje ustawiają `ignoreBuildErrors: true`. Oba Dockerfile uruchamiają generowanie Prisma i Next build bez jawnej bramki typecheck. Osobny `npm run quality` poprawnie zawiera typecheck, ale sam build obrazu nie wymusza jego wcześniejszego wykonania. To nie jest dowód, że aktualny kod ma błędy typów; to możliwość pominięcia kontroli.

Źródła:

- [Konfiguracja strony](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/next.config.mjs#L35)
- [Konfiguracja panelu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/next.config.mjs#L29)
- [Budowa obrazu strony](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/deploy/serwerek/Dockerfile#L41)
- [Budowa obrazu panelu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/deploy/serwerek/Dockerfile.admin#L17)
- [Istniejąca bramka quality](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/package.json#L39)

**Zmiana:** wybrać jeden obowiązkowy punkt kontroli typów dla każdego wspieranego sposobu budowy/wydania. Może to być jawny typecheck przed budową albo ponowne włączenie kontroli Next po zweryfikowaniu konfiguracji obu aplikacji. Nie uruchamiać jej wielokrotnie bez potrzeby.

**Warunek odbioru:** kontrolowany błąd typu w kodzie strony lub panelu powoduje niepowodzenie odpowiedniej ścieżki budowy/wydania.

## 4. Monitoring: rozszerzyć to, co już jest

**PeerTube:** ma eksportowane metryki kolejki według typu i stanu zadania, osobne metryki runnerów oraz liczniki błędów i zacięć odtwarzacza.

- [Metryki kolejki](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/opentelemetry/metric-helpers/job-queue-observers-builder.ts#L11)
- [Metryki kolejki runnerów](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/opentelemetry/metric-helpers/runner-job-queue-observers-builder.ts#L1)
- [Metryki odtwarzania](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/opentelemetry/metric-helpers/playback-metrics.ts#L1)

**Polutek:** już zbiera czas startu odtwarzania i rebuffering, ma heartbeat workera, panel kolejki i ostrzeżenia o jej zatrzymaniu. Nie należy opisywać tego jako braku monitoringu. `recordMetric` jest natomiast zapisem do loggera; sam w sobie nie zapewnia szeregu czasowego ani alarmu.

- [Istniejące pomiary jakości oglądania](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/telemetry/client/playback-qoe.ts#L49)
- [Sprawdzenie stanu enkodera](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/admin-overview/application/collect-health.ts#L49)
- [Implementacja recordMetric](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/observability.ts#L30)

**Zmiana:** zacząć od mierzenia wieku najstarszego oczekującego zadania, czasu poszczególnych etapów, liczby retry/błędów i wolnego miejsca. Dodać alarmy oparte na tych danych. Na małym serwerze można wykorzystać istniejący panel i kolektor; pełny stos OpenTelemetry nie jest warunkiem.

**Warunek odbioru:** sztuczne zatrzymanie lokalnego workera przy niepustej kolejce daje widoczne ostrzeżenie; wzrost czasu kodowania jest widoczny w historii. Nie kopiować bez namysłu etykiet z identyfikatorem każdego filmu — zwiększają liczbę szeregów metryk.

## 5. Kontrakty API: jedna sprawdzana definicja zamiast ręcznego utrzymywania zgodności

**PeerTube:** ma obszerny OpenAPI z trasami uploadu i filmów, wspólne modele oraz walidację dokumentu API w skrypcie CI. To nie gwarantuje automatycznie zgodności każdej odpowiedzi z dokumentacją, ale daje konkretny punkt kontroli.

- [OpenAPI](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/support/doc/api/openapi.yaml#L1)
- [Opis uploadu wznawialnego](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/support/doc/api/openapi.yaml#L4184)
- [Walidacja OpenAPI](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/scripts/ci.sh#L258)

**Polutek:** już używa Zod do walidacji wejścia. Jednak klient Studia ręcznie deklaruje kształt odpowiedzi uploadu, a uploader panelu ma osobną implementację i ścieżki. W przeglądzie nie znaleziono odpowiednika centralnego OpenAPI.

- [Ręczny kontrakt uploadu Studia](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/components/studio/upload-original.ts#L30)
- [Wspólna walidacja wejścia tras Studia](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/api/studio-route.ts#L50)

**Zmiana:** zacząć od kontraktów uploadu, zadań i planu odtwarzania, zamiast od dokumentowania całego API. Współdzielić schematy request/response lub generować typy z OpenAPI. Dodać testy faktycznych odpowiedzi względem kontraktu.

**Warunek odbioru:** zmiana nazwy pola odpowiedzi uploadu jest wykrywana przez kontrolę typów lub test kontraktowy, zanim trafi do przeglądarki.

## 6. Kodowanie: PeerTube daje lepszą drogę do rozdzielenia kosztownej pracy

**PeerTube:** ma rozdzielone zadania, zależności parent/child, parametry rozdzielczości oraz wymienny wybór lokalnej kolejki i zdalnych runnerów. Kodowanie można wykonywać poza serwerem WWW.

- [Wybór lokalnej kolejki lub runnerów](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/transcoding/create-transcoding-job.ts#L34)
- [Zależności zadań runnera](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/transcoding/shared/job-builders/transcoding-runner-job-builder.ts#L24)

**Polutek:** worker też jest osobnym procesem, ma odzyskiwanie po awarii i uczciwe kolejkowanie między kanałami. Globalnie dopuszcza jedno kodowanie naraz, świadomie pod mały serwer. Zadanie obejmuje download → probe → encode → upload → finalizację. Ponowienie przed ukończoną finalizacją zasadniczo wraca do początku; zapis postępu nie jest checkpointem umożliwiającym pominięcie wykonanego etapu. Wynik po udanej finalizacji jest już rozpoznawany i wykorzystywany ponownie.

- [Ograniczenie równoległości i sprawiedliwość kolejki](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/infrastructure/encode-job.repository.ts#L41)
- [Przebieg zadania i rozpoznanie gotowego wyniku](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/process-encode-job.ts#L204)

**Zmiana:** najpierw zmierzyć, ile czasu tracą rzeczywiste ponowienia. Jeśli dużo: dodać trwały manifest zweryfikowanych etapów/plików i możliwość wznowienia uploadu gotowego wyniku. Dopiero przy rosnącej kolejce projektować pulę zdalnych workerów lub zadania per wariant jakości. Obecne kodowanie wielu wariantów w jednym procesie ma zaletę: źródło jest dekodowane raz. Rozdzielenie wariantów może zwiększyć koszt CPU.

**Warunek odbioru:** awaria przy końcu uploadu HLS nie powoduje ponownego kodowania całego filmu, a niepełna wersja nadal nigdy nie trafia do odtwarzacza.

## 7. Odtwarzacz: przydatny wzorzec produktu to storyboard

**PeerTube:** ma osobne zadanie generowania arkusza miniatur do podglądu filmu podczas przewijania.

- [Generowanie storyboardu](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/job-queue/handlers/generate-storyboard.ts#L1)

**Polutek:** pasek pokazuje czas i nazwę rozdziału. W analizowanym przepływie nie ma podłączonego podglądu klatek.

- [Podgląd paska przewijania Polutka](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/components/player/controls/ScrubBar.tsx#L62)

**Zmiana:** opcjonalne generowanie sprite'ów oraz indeksu czasowego po kodowaniu i podpięcie ich do istniejącego odtwarzacza. Dla materiałów chronionych miniatury muszą podlegać tej samej decyzji dostępu co film; nie wrzucać ich automatycznie do publicznego bucketa.

**Warunek odbioru:** przewijanie pokazuje właściwą klatkę, a gość nie pobierze storyboardu filmu wymagającego konta lub płatności.

## Co zachować w Polutku

- Centralną decyzję o dostępie przed wydaniem źródła/tokenów i prywatne napisy. Nie zastępować tego publicznymi adresami magazynu.
- Idempotencję, heartbeat, backoff, odzyskiwanie zadań i publikację dopiero po wgraniu wyniku. Te mechanizmy już są.
- Architektoniczne granice modułów oraz wspólne use case'y Studia i panelu.
- Istniejące pomiary QoE i ostrożny model prywatności telemetrii.
- Prosty model wdrożenia dopasowany do małego serwera. Federation/ActivityPub, P2P, system pluginów i rozbudowane skalowanie PeerTube rozwiązują inne potrzeby; nie są domyślną listą braków Polutka.

Nie ma też podstaw do ogólnego twierdzenia „PeerTube jest bezpieczniejszy”. Przykładowo jego [CSP](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/middlewares/csp.ts#L11) również dopuszcza luźne dyrektywy skryptów. Bezpieczeństwo należy oceniać na konkretnych przepływach i testach.

## Wykonane sprawdzenia

W Polutku uruchomiono istniejące testy:

```bash
ENCODE_SMOKE=1 npm exec -- vitest run \
  tests/unit/hls/encode-hls.test.ts \
  tests/unit/hls/encode-hls.ffmpeg.test.ts \
  tests/unit/studio/upload-original.test.ts \
  --maxWorkers=2
```

Wynik: **3 pliki, 28 testów zaliczonych, 1 pominięty**. Zestaw obejmuje realne kodowanie FFmpeg; wynik nie potwierdza wszystkich wariantów HDR ani działania pełnej aplikacji.

`npm run e2e:list`: **niepowodzenie, 0 testów**, `No tests found`.

Nie wykonano pełnego zestawu testów Polutka, benchmarku porównawczego ani testów PeerTube. Wcześniejszy blocker instalacji silnika Prisma pozostaje osobnym zagadnieniem środowiska; nie uznaję go za wadę kodu aplikacji.

## Proponowany pierwszy zakres implementacji

1. Ujednolicić silnik uploadu Studia i panelu, zachowując osobne adaptery tras i uprawnienia.
2. Dodać testy wznowienia po odświeżeniu i błędzie sieci oraz wygasłego podpisu części.
3. Dodać jeden lokalny test pełnego przepływu i przywrócić rzeczywisty zestaw Playwright.
4. Wymusić typecheck na każdej ścieżce budowy/wydania.

To daje poprawę niezawodności bez zmiany frameworka, bazy ani infrastruktury produkcyjnej. Implementacja tych zmian nie była częścią tego przeglądu.

PeerTube jest na licencji AGPL-3.0. Przy dosłownym przenoszeniu jego kodu trzeba uwzględnić tę licencję; powyższe propozycje można wdrożyć jako własne rozwiązania na podstawie opisanych zachowań.
