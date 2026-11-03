# D14 — koszty, limity i wrażliwość modelu

Partia 11, 1 listopada 2026. **W_TRAKCIE**. [Parametry do zmiany](../ZALOZENIA-KOSZTOW.json), [wykonywalny model](../tools/capacity-cost-model.py), [pełne wyniki](../evidence/capacity-cost-model.json), [zakres](../evidence/batch11-review.json), [walidacja](../evidence/validation-batch11.json). Bez API dostawców, sekretów, produkcji i zmian aplikacji.

Właściciel wybrał **kilkunastu twórców i 10 tys. jednoczesnych widzów w szczycie**. 15 twórców to przybliżenie do arytmetyki, nie dokładna liczba zatwierdzona przez właściciela. Pozostałe parametry są roboczymi założeniami. Rachunek obejmuje wyłącznie wybrane pozycje R2 Standard i Workers Paid.

## Wniosek dla właściciela

Przy 15 twórcach, katalogu 300 ośmiominutowych filmów i 30 nowych filmach miesięcznie magazyn i średnie kodowanie są małymi pozycjami tego wariantu. Znaczenie ma intensywność oglądania: **10 tys. widzów w szczycie, średnio 2500 przez miesiąc**, daje 1,8 mln godzin oglądania i około 1,539 mld żądań Workera/miesiąc. Przy przyjętym 90% trafień w cache i CPU 2 ms/żądanie model daje **582,29 USD/miesiąc za wybrane R2+Workers**.

To nie pełny budżet Polutka, oferta dostawcy ani dowód obsługi 10 tys. widzów. Brakuje m.in. hostingu aplikacji/DB/Redis/kolektora, CPU i dysku encodera, backupów, monitoringu, e-maili, operatorów płatności, moderacji i obsługi, podatków oraz pracy zespołu. Historyczny model z 12 października zachowano bez zmian; jego stawki serwerów i ekwiwalenty CPU nie są bieżącą ofertą ani benchmarkiem.

## Cennik sprawdzony online i jednostki

Pobrano oficjalne materiały Cloudflare z repo cloudflare-docs, oba HTTP 200: [R2](../sources/cloudflare-r2-pricing.mdx), [Workers](../sources/cloudflare-workers-pricing.mdx), [adresy, czas i SHA256](../sources/fetch-capacity-batch11.json). Autorzy Cloudflare i współtwórcy, [CC BY 4.0](../sources/cloudflare-docs-LICENSE.txt). Niezmienione kopie opisują odczytaną wersję zmiennej gałęzi production; nie podpisany kontrakt konta.

| Pozycja | Stawka użyta w modelu |
|---|---|
| R2 Standard | 0,015 USD/GB-miesiąc; 10 GB-miesiąc bez opłaty |
| Class A | 4,50 USD/mln operacji; 1 mln bez opłaty |
| Class B | 0,36 USD/mln operacji; 10 mln bez opłaty |
| Egress R2 | Według pobranego cennika bez opłaty za transfer; koszty usług wywołujących są osobne |
| Workers Paid | Minimum 5 USD/miesiąc; 10 mln żądań i 30 mln CPU-ms w cenie; potem 0,30 USD/mln żądań i 0,02 USD/mln CPU-ms |
| Workers Free | 100 tys. żądań/dzień, limit CPU na invocation; to dzienny budżet, nie darmowe 3 mln zamienne między dniami |

R2 zaokrągla w górę jednostki rozliczeniowe. Model odejmuje jeden wspólny darmowy limit konta i zaokrągla storage do GB-miesiąca, operacje do miliona. Workers overage liczy proporcjonalnie jak oficjalne przykłady. Wszystkie ulgi konta zastosowano raz na scenariusz, przy założeniu braku innego zużycia. Infrequent Access, rabaty enterprise i inne produkty nie są modelowane.

GB=10^9 bajtów, GiB=2^30 bajtów; 16 MiB części uploadu nie oznacza 16 MB. Storage R2 to średnia dziennych maksimów w okresie, więc stały katalog jest uproszczeniem, a nie stanem magazynu w ostatniej sekundzie miesiąca.

## Jawne założenia i wzory

- Szczyt 10000 widzów; średnia 25% szczytu przez 30 dni. Warianty 5% i 100% poniżej. Nie zmierzono profilu godzinowego.
- Film 480 s, przeciętnie obejrzane 40%=192 s. Segment 6 s pochodzi z domyślnego encodera; 6 żądań narzutu i mnożnik 1,2 na prefetch/ABR są założeniami. Żądania/odtworzenie: `(ceil(192/6)+6)*1.2=45.6`.
- Godziny oglądania: `peak * average_to_peak * 24 * days`. Liczba odtworzeń: `watch_hours * 3600 / watched_seconds`. Przeliczenie zakłada rozkład średniej długości, nie wszystkie filmy oglądane równo.
- Oryginał 12 Mb/s → 0,72 GB/film; cała drabinka średnio 10 Mb/s → 0,60 GB/film. 10 Mb/s to niezmierzona średnia, nie suma maksymalnych bitrate ani bitrate jednego widza. 20 filmów/twórcę → 396 GB (~368,8 GiB) łącznie dla 15 twórców.
- Widz średnio 2,5 Mb/s → około 2025 TB/miesiąc ruchu w głównym wariancie. To przeliczona objętość, bez testu przepustowości, limitów usługi i faktycznej taryfy konta.
- Maksymalnie 5 wariantów encodera i 16 MiB multipart według źródeł. Class A szacuje zapis segmentów/manifestów i multipart; nie pełną księgę wszystkich HEAD/LIST/retry/caption/thumbnail. 30 uploadów → 13530 takich operacji, poniżej założonej ulgi konta.
- Cache hit 90% jest założeniem ważonym żądaniami, nie bajtami. Miss mnożony przez liczbę żądań przybliża R2 Class B. Rzeczywisty Worker przy miss z Range może dodatkowo pobrać pełny obiekt w tle; HEAD i inne operacje także wymagają licznika. Model nie udaje dokładności faktury.
- Worker nadal otrzymuje żądanie i weryfikuje token przed swoim cache. R2 hit nie usuwa opłaty za inbound Worker ani automatycznie CPU. CPU 2 ms jest założeniem, nie czasem ściennym czekania na sieć.
- Upload 30×8 min=4 h źródła/miesiąc. RTF=2 daje 8 h pracy encodera. RTF i 70% dostępności są niezmierzone; szczyt uploadów i oczekiwanie w kolejce pozostają do pomiaru.

## Trzy poziomy oglądania, 15 twórców

| Widzowie w szczycie | Godziny oglądania/mies. | R2 storage | R2 A | R2 B | Workers | Suma wybranych R2+Workers |
|---:|---:|---:|---:|---:|---:|---:|
| 100 | 18000 | 5,79 | 0 | 0 | 6,63 | 12,42 USD |
| 1000 | 180000 | 5,79 | 0 | 2,16 | 53,73 | 61,68 USD |
| 10000 | 1800000 | 5,79 | 0 | 51,84 | 524,66 | 582,29 USD |

Wszystkie wiersze używają tego samego katalogu, nie zakładają 10000 twórców. 10 albo 19 twórców zmienia przede wszystkim katalog i uploady; pełne warianty zapisano w JSON. Nowe uploady nie powiększają tu katalogu w czasie — przyjęto stały przeciętny stan. Rozwój katalogu wymaga modelu kohort/retencji.

## Co najbardziej zmienia wynik

| Zmieniany parametr, reszta stała; szczyt 10000 | Warianty | Suma wybranych R2+Workers/mies. |
|---|---|---|
| Średnia liczba widzów / szczyt | 5% / 25% / 100% | 119,40 / 582,29 / 2318,39 USD |
| Trafienia cache R2 | 0% / 90% / 99% | 1080,89 / 582,29 / 532,61 USD |
| CPU Workera na żądanie | 0,5 / 2 / 7 ms | 536,12 / 582,29 / 736,19 USD |
| Segmenty HLS | 4 / 6 / 10 s | 826,01 / 582,29 / 399,77 USD |
| Mnożnik przechowywanych bajtów | 1 / 2 / 3 | 582,29 / 588,23 / 594,17 USD |

Zmiana segmentów wpływa także na startup, przełączanie jakości i odporność odtwarzania; tabela nie jest zaleceniem wydłużenia segmentów. Sam cache nie usuwa miliardów żądań Workera. Średnio 51,3 mln żądań/dzień w wariancie głównym znacznie przekracza dzienny limit Free. Komentarz w kodzie o historycznym planie Free nie jest odczytem aktualnej taryfy konta.

## R06 — quota produktu i koszt platformy

channelUploadLimitError sprawdza plik/dzień/kolejkę oraz sumę VideoOriginal.sizeBytes, wyłączając ABANDONED, SUPERSEDED i FAILED. Nie sumuje HLS i wszystkich fizycznych/starych obiektów ani żądań oglądania. Jest to potwierdzenie źródłowe istniejącego R06, bez nowego znaleziska i bez wykonanego w tej partii protokołu quota/Prisma.

Te limity mają wartość: ograniczają zużycie przez twórców, koszt rezerwacji i kolejki. Staff/system/main mają celowo osobną politykę. Dla obecnego małego grona twórców szeroka farma encoderów nie wynika z założeń. Nadal potrzebne są osobne liczniki fizycznego storage, starych wersji/cleanup i ruchu widzów, alarm rachunku i polityka reakcji. Nie wolno obiecać, że limit 5 GB kanału oznacza maksymalnie koszt przechowania 5 GB.

## PeerTube jako punkt odniesienia

[D13](D13-WYDAJNOSC-I-POJEMNOSC.md) zestawia 13 konkretnych źródeł kolejki, runnerów, SQL, pul i replik. Z tego warto przejąć sposób jawnego budżetowania zasobów i podziału zadań. Nie mamy równych benchmarków obu platform ani rachunków równoważnego hostingu PeerTube. Nie twierdzimy, że PeerTube jest tańszy. Egress R2 według cennika jest korzystną cechą obecnego wyboru, ale nie zastępuje kosztu Workera, aplikacji i zespołu. Nie porównano tutaj kosztu P2P/federacji/replicacji; nie przypisujemy im wymyślonego procentu oszczędności.

## Wiarygodność i dalszy pomiar

10 kontroli arytmetyki przeszło, m.in. GB/GiB, osobne traktowanie cache i Worker requests, jednokrotne ulgi, zaokrąglenia, monotoniczność storage, RTF oraz oficjalny przykład Workers. To kontrola modelu, nie empiryczne potwierdzenie wejściowych bitrate, CPU i popularności. Koszty hostingu/encodera świadomie pozostają nieoszacowane do zebrania danych i aktualnej oferty.

Kolejny krok D14: pomiar godzin oglądania i requests/CPU/hit ratio przy realnej mieszance, rozmiar katalogu i retencja wersji, koszt pełnej drabinki na reprezentatywnych plikach, budżet miesięczny właściciela i uzgodnienie jednostek z fakturą. Bez tych danych nie zamykamy D14 ani nie podajemy jednej ceny całej platformy.
