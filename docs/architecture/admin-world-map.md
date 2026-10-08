# Mapa świata w panelu (Analityka → Świat)

Stan: 2026-10-08. Zakładka `Świat` w `/analityka` pokazuje odwiedzających według kraju na interaktywnej mapie oraz „podbój świata”: w których dniach pojawiały się kolejne kraje. Nie zbiera żadnych nowych danych: czyta istniejące dzienne agregaty telemetrii (`telemetry.r_traffic_daily`, wymiar `country`, kod ISO z nagłówka Cloudflare `CF-IPCountry`). Definicje i prywatność: [`admin-telemetry.md`](admin-telemetry.md), [`admin-phaseA.md`](admin-phaseA.md).

## Co widać

- **Kafle:** kraje z ruchem w okresie, nowe kraje (pierwszy raz w okresie), kraje od początku pomiaru, odsetek odwiedzających spoza Polski. Porównanie z poprzednim okresem tylko, gdy ten okres był w całości zmierzony; dla „dziś” bez porównań (część doby kontra cała).
- **Mapa (domyślnie „Odwiedzający”):** kolor kraju = suma dobowych unikalnych odwiedzających w okresie, 6 klas. Najechanie albo dotknięcie pokazuje odwiedzających, odsłony, udział i datę pierwszej wizyty; klik/Enter przypina kraj w panelu obok.
- **Podbój świata:** kraje są szare, a z suwakiem albo przyciskiem „Odtwórz” zapalają się w dniu pierwszej wizyty (kolor serii 2 = nowy tego dnia). Pod mapą wykres „Kraje w czasie” i lista kamieni milowych (dni z nowymi krajami).
- **Przybliżenia:** Świat, Europa, Ameryka Północna, Ameryka Południowa, Afryka, Azja, Oceania (animowana zmiana `viewBox`, bez animacji przy `prefers-reduced-motion`).
- **Tabela krajów** pod mapą to pełna, dostępna wersja danych (kraj, odwiedzający, odsłony, udział, pierwszy raz).

## Decyzje projektowe (z researchu)

- **Mapa choropleth na krajach, nie na punktach:** kolor to wielkość, a mapa jest tylko tłem. Rzut **Equal Earth** (równopolowy): żaden kraj nie wygląda na większy, niż jest; to ważne, gdy kolor ma coś znaczyć.
- **Klasy, nie gradient ciągły:** ruch z krajów jest bardzo skośny (jeden kraj domowy, długi ogon pojedynczych wizyt), więc granice klas rosną geometrycznie (1, 2, 5, 10, 20, 50…, najwyżej 6 klas, `worldClassBreaks()`); równe przedziały pomalowałyby prawie wszystko na najjaśniejszy kolor. Brak odwiedzających to osobna, neutralna szarość, wyraźnie inna niż najjaśniejszy krok skali.
- **Jedna barwa sekwencyjna** (`--series-1`, kroki od tła do pełnego koloru, dla ciemnego motywu osobny dobór kroków, żeby najjaśniejszy krok odstawał od szarego), bez tęczy; kolor nigdy nie jest jedynym nośnikiem informacji (tooltip, tabela, legenda).
- **Bez normalizacji na mieszkańców:** panel pokazuje absolutne liczby (mały kanał, jedna osoba z Malty to ważne zdarzenie); procent spoza Polski jest osobnym kaflem.
- **Małe kraje i wyspy** (Malta, Singapur, Andora, Watykan, Reunion, Gibraltar…) są kropkami (75 punktów), rysowanymi tylko, gdy mają dane; Natural Earth 1:110m ich nie ma jako kształtów.
- **Dostępność:** `role="group"` z opisem, ścieżka klawiaturą (strzałki po krajach wg odwiedzających lub dnia odkrycia, Enter przypina, Escape czyści), czytanie na żywo (`aria-live`), tabela jako pełny odpowiednik, przyciski z `aria-pressed`, suwak z `aria-valuetext`, brak pułapki fokusu, `prefers-reduced-motion`, `forced-colors`.
- **Bez stylów inline i bez zewnętrznych skryptów** (ścisłe CSP panelu): kolory to klasy `wm-c0…wm-c6` z `world.css`, rozmiar kropek i `viewBox` to atrybuty SVG ustawiane przez DOM, pozycja podpowiedzi przez CSSOM (jak w `trend-chart`).

## Dane geograficzne

Kształty są wygenerowane **raz** skryptem `scripts/geo/build-world-map.mjs` i zapisane w `apps/admin/components/analytics/world/geo.generated.ts` (ok. 120 KiB): same ścieżki SVG, bez `d3-geo`, `topojson` i bez żadnego żądania do CDN w czasie działania. Źródło: `visionscarto-world-atlas@1.0.0` (BSD-3-Clause), modyfikacja `world-atlas` / Natural Earth (domena publiczna); granice według stanowiska ONZ (Krym w Ukrainie, Sahara Zachodnia wg ONZ), Kosowo, Somaliland i Cypr Północny przypisane do kodów, które wysyła Cloudflare (XK, SO, CY). Antarktyda nie jest rysowana. Kody ISO bez kształtu ani punktu: tylko `AQ` (lista `WORLD_UNMAPPED`).

Pakiety do generowania **nie są zależnościami projektu**; skrypt uruchamia się z katalogu tymczasowego (instrukcja w nagłówku pliku). Wynik jest deterministyczny; po zmianie skryptu wygeneruj plik ponownie i zacommituj. Test `tests/unit/admin-analytics/world-map.test.tsx` pilnuje, że każdy kod ISO ma kształt albo kropkę, że punkty mieszczą się w ramce i że przybliżenia mają proporcje całej mapy.

## Architektura

- **Domena** (`lib/modules/admin-analytics/domain/world.ts`): granice klas, klasa kraju, legenda, polska odmiana „kraj/kraje/krajów”, kroki podboju i narastająca seria. Czysta, z testami.
- **Przypadek użycia** (`application/world.ts`, `getWorldOverview`): dwa nowe zapytania SQL (`countryTotals`, `countryFirstSeen`) na istniejącym agregacie dziennym i dotychczasowy cache SWR panelu; wynik to `WorldOverview` (DTO bez `Date`). Kraje „nieznane” (`??`, VPN, Tor) są policzone osobno i nigdy nie trafiają na mapę. Brak telemetrii albo błąd odczytu to „bez pomiaru”, nigdy zero.
- **Panel** (`apps/admin/components/analytics/world/`): `world-svg.tsx` i `world-tab.tsx` to komponenty serwerowe (ścieżki SVG zostają w HTML, nie w paczce klienta), `world-map.tsx` to jedyny komponent kliencki (dane per kraj, bez ścieżek).
- Karta „Kraje” w zakładce „Ruch i źródła” linkuje do mapy z zachowaniem okresu.

## Ograniczenia

- Kraj pochodzi z adresu IP przez Cloudflare: VPN i Tor zaburzają lokalizację (liczone jako nieznany kraj). Boty i osoby z GPC/DNT nie są liczone (jak w całej telemetrii).
- Agregaty dzienne trzymamy 25 miesięcy, więc „pierwszy raz” sięga najwyżej tak daleko.
- Mapa jest uboga przy małym ruchu (dziś w telemetrii są 2 kraje); sens dostaje po starcie publicznym. Miasta i współrzędne celowo nie są zbierane (poziom prywatności; zmiana wymagałaby aktualizacji polityki).
