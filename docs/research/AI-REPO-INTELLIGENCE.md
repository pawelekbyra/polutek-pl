# Warstwa wiedzy repozytorium dla agentów kodujących — research decyzyjny

**Stan badania:** 2026-11-04
**Cel:** ocenić, czy warto w przyszłości dać Codexowi, Claude Code i innym modelom wspólną, trwałą warstwę wiedzy i nawigacji po rosnących repozytoriach. To jest badanie kierunku, nie specyfikacja wdrożenia ani zgoda na wydatki.

## Wniosek na dziś

**Warto kontynuować research. Nie ma jeszcze podstaw, by przesądzić o budowie.** Badania pokazują, że trafne dostarczenie kontekstu może poprawiać pracę agentów, a graf kodu może pomóc odnajdywać zależności. Pokazują też, że wyszukiwanie jest nadal niedoskonałe, żadna technika nie wygrywa we wszystkich zadaniach, a bardziej rozbudowane rusztowanie nie gwarantuje lepszych wyników.

Potencjalny produkt nie miałby zastępować Codexa ani Claude Code, uczyć nowego modelu ani wtłaczać całego repo do promptu. Byłaby to **wspólna, aktualizowana pamięć repozytorium** — z wiedzą o symbolach, zależnościach, testach, decyzjach i historii — dostępna agentom na żądanie. To może dać modelom większą skuteczną wiedzę o konkretnym projekcie, ale nie zmienia ich ogólnej zdolności rozumowania.

## Co już potrafią agenci i narzędzia

- Claude Code potrafi przeszukiwać repo i czytać pliki podczas zadania; Anthropic twierdzi, że takie poszukiwanie na żądanie bywa skuteczniejsze i bardziej elastyczne niż indeksowanie całego repo ([Claude Code FAQ](https://support.claude.com/en/articles/12386420-claude-code-faq)).
- Codex CLI pracuje bezpośrednio w repo: eksploruje kod, planuje zmianę, edytuje i uruchamia narzędzia projektu ([Codex CLI](https://learn.chatgpt.com/docs/codex/cli)).
- Oba ekosystemy obsługują MCP jako sposób podłączania dodatkowych źródeł i narzędzi ([MCP w Codex](https://developers.openai.com/learn/docs-mcp), [MCP w Claude](https://docs.anthropic.com/en/docs/mcp)). To daje realną ścieżkę do udostępnienia jednego serwera wiedzy wielu agentom.
- Nie zaczynamy od pustego pola. Aider buduje zwięzłą mapę repo z symbolami i sygnaturami, wybierając jej fragmenty algorytmem rangowania grafowego ([RepoMap](https://aider.chat/docs/repomap.html)). Sourcegraph oferuje wyszukiwanie, nawigację, historię zmian i Deep Search przez MCP, ale jego serwer MCP jest obecnie przeznaczony dla planów Enterprise ([Sourcegraph MCP](https://sourcegraph.com/docs/api/mcp)).

**Implikacja:** wartość nie może polegać wyłącznie na tym, że dołożymy agentowi jeszcze jedno wyszukiwanie. Musi poprawiać jego pamięć między sesjami, pokazywać istotne relacje, obniżać koszt eksploracji albo pomagać przy zmianach przekrojowych lepiej, niż potrafią jego obecne narzędzia.

## Istniejące systemy, które pokrywają część wizji

Research ujawnia ważną rzecz: wiele elementów pomysłu już istnieje jako lokalne, agentowo-agnostyczne narzędzia. Przed projektowaniem własnego rozwiązania trzeba porównać ich zakres i złożenie kilku prostych warstw.

| System | Co już daje | Czego nie rozstrzyga / na co uważać |
|---|---|---|
| **Codebase-Memory** | Lokalny graf Tree-sitter/SQLite, 66 języków, MCP, śledzenie wywołań i wpływu zmian ([artykuł](https://arxiv.org/abs/2603.27277)). | W ocenie autorów z Claude Opus 4.6 odpowiedzi z grafu uzyskały 0,83 jakości wobec 0,92 agenta eksplorującego pliki, ale zużyły ok. 10× mniej tokenów i 2,1× mniej wywołań narzędzi. Graf wygrał w zapytaniach strukturalnych, agent przy pełnym kontekście źródła i wyczerpującym grep. To benchmark autorów na 31 repozytoriach, ze scoringiem pierwszego autora — nie niezależna replikacja ani test Codexa z dostępem do MCP. |
| **GitNexus** | Lokalne indeksowanie Tree-sitter + graf wywołań, klastrów, procesów i hybrydowe BM25/semantyczne wyszukiwanie; MCP oferuje m.in. symbol context, analizę wpływu i wykrywanie skutków diffu ([README](https://github.com/MatrixForgeLabs/gitnexus/blob/main/gitnexus/README.md)). | Dokumentacja deklaruje integracje z częścią agentów i ogólną zgodność MCP; trzeba sprawdzić aktualne wsparcie klienta, jakość na naszym stosie, utrzymanie indeksu i bezpieczeństwo pakietu. Marketingowe „full codebase awareness” nie jest dowodem kompletności grafu. |
| **codegraph** | Lokalny TypeScript CLI/library/MCP oparty na Tree-sitter; mapa plików, symboli, referencji i zależności, kandydaci na testy dla zmian; deklaruje wsparcie m.in. TypeScript/JavaScript, Python, Go, Rust i SQL ([repozytorium](https://github.com/lzehrung/codegraph)). | Autor jawnie zaznacza, że refleksja, kod generowany, makra i dynamiczne wywołania mogą zostać pominięte, a narzędzie nie zastępuje kompilatora. Repozytorium jest młode i deklaracje wymagają niezależnego sprawdzenia. |
| **Serena** | Serwer MCP oparty o LSP: znajdowanie symboli, definicji i referencji oraz operacje na poziomie symbolu; 30+ języków wg dokumentacji integracji GitHub ([opis](https://github.github.com/gh-aw/reference/serena/)). | Mocna nawigacja językowa, lecz inny problem niż wieloletnia pamięć decyzji, historii prób i uzasadnień projektu. Wynik LSP zależy od poprawnie działającego serwera języka. |
| **Sourcegraph MCP** | Wyszukiwanie kodu, plików, historii commitów, rewizji, definicji i Deep Search; opis integracji zawiera instrukcje dla Codexa i Claude Code ([dokumentacja](https://sourcegraph.com/docs/api/mcp)). | Serwer MCP jest dostępny dla planów Enterprise; koszt i sposób hostowania mogą nie pasować do właścicielskiego ograniczenia braku dodatkowych wydatków. |
| **Aider RepoMap** | Zwięzła mapa symboli całego repo, wybierana rankingiem grafowym i dopasowywana do budżetu kontekstu ([dokumentacja](https://aider.chat/docs/repomap.html)). | Działa jako część Aidera; sama w sobie nie daje wspólnej, trwałej pamięci MCP dla Codexa i Claude Code. |
| **ProjectMem** | Lokalny, zdarzeniowy dziennik prób, poprawek i decyzji, z deterministycznym podsumowaniem i serwerem MCP — bez grafowej bazy ani wektorów ([artykuł](https://arxiv.org/abs/2606.12329)). | Ewaluacja jest samoobserwacją autora przez dwa miesiące na 10 projektach, nie kontrolowanym porównaniem skuteczności. Jest przykładem, że pamięć o „czego próbowaliśmy i dlaczego” może być inną, tańszą warstwą niż code graph. |
| **Cloudflare AI Search / Vectorize** | Zarządzane indeksowanie tekstu/kodu lub własne wektory; szybki RAG nad treścią. | Nie rozwiązuje samodzielnie relacji AST/LSP, zmian między symbolami ani pamięci decyzji; code-aware parser i MCP nadal trzeba dostarczyć. |

### Co to zmienia w decyzji

Własny system od zera **nie jest uzasadniony samą wizją** — istnieją projekty o bardzo zbliżonym zakresie. Najpierw należy sprawdzić trzy drogi: (1) użyć gotowego lokalnego code graph MCP, (2) połączyć narzędzie nawigacji ze zwykłą, wersjonowaną pamięcią decyzji, (3) dopiero po wykazaniu konkretnej luki budować własny komponent. Przewaga mogłaby wynikać z lepszej jakości relacji, aktualności, bezpiecznej pamięci historii, pracy na kilku repo lub jednego niezawodnego interfejsu dla obu agentów — tych przewag nie da się wywnioskować z listy funkcji.

Serwery MCP uruchamiają kod na maszynie agenta i mogą otrzymać szeroki dostęp do repozytorium. Przed użyciem jakiegokolwiek kandydata trzeba osobno sprawdzić licencję, zależności, zakres odczytu/zapisu, wysyłanie danych, sposób instalacji i aktualizacje; sam fakt, że projekt jest publiczny albo lokalny, nie czyni go automatycznie bezpiecznym. Codebase-Memory opisuje supply-chain risk serwerów MCP jako istotne, słabo ustandaryzowane zagrożenie ([dyskusja bezpieczeństwa w artykule](https://arxiv.org/abs/2603.27277)).

## Co mówią badania

| Badanie | Zakres i wynik istotny dla decyzji | Ograniczenie wnioskowania |
|---|---|---|
| **RepoGraph (ICLR 2025)** | Graf kodu na poziomie linii z relacjami definicja–użycie, podłączony do czterech istniejących frameworków, poprawił ich średni wynik na SWE-bench o 32,8% względnie ([artykuł](https://openreview.net/pdf?id=dw9VUsSHGB)). Wspiera hipotezę, że graf może uzupełniać semantyczne wyszukiwanie. | Wynik dotyczy konkretnych frameworków i benchmarku; nie jest bezpośrednim porównaniem dzisiejszego Codexa/Claude Code z takim samym agentem po dodaniu MCP. Wartość względna nie oznacza 32,8 punktu procentowego. |
| **CodeRAG-Bench (Findings of NAACL 2025)** | Ewaluacja 10 retrieverów i 10 modeli obejmuje również zadania repozytoryjne. Dobre pobrane konteksty pomagają, ale retrievery często nie znajdują potrzebnych źródeł, a modele nie zawsze umieją użyć dostarczonego kontekstu ([artykuł ACL](https://aclanthology.org/2025.findings-naacl.176/)). | RAG poprawia wejście, nie naprawia samodzielnie rozumowania ani wykonania zmiany. |
| **ContextBench (2026)** | 1 136 zadań z 66 repozytoriów i 8 języków, z oceną procesu pozyskiwania kontekstu. Autorzy raportują, że złożone scaffoldy dawały tylko marginalny zysk w samym wyszukiwaniu, agenci często pobierali szeroki kontekst z szumem, a część przeczytanych trafnych informacji nie trafiała do końcowego rozwiązania ([artykuł](https://arxiv.org/abs/2602.05892)). | Mocny argument przeciw budowaniu skomplikowanego systemu bez pomiaru. Wnioski pochodzą z określonego zestawu modeli i agentów. |
| **SWE-Explore (2026)** | 848 zadań, 203 repozytoria i 10 języków; osobno mierzy eksplorację kodu przy ustalonym budżecie. Metryki pokrycia, rankingu i efektywności kontekstu wiążą się z późniejszym powodzeniem naprawy ([artykuł](https://arxiv.org/abs/2606.07297)). | Potwierdza, że eksplorację da się mierzyć; nie dowodzi, że każda dodatkowa baza wiedzy ją poprawi. |
| **Agent Retrieval Bench (lipiec 2026)** | 427 próbek z 25 repozytoriów, w korpusie ok. 392 tys. plików. Testuje m.in. wyszukiwanie leksykalne, mapę repo i embeddingi. Żadna metoda nie wygrywa wszędzie; metody strukturalne i semantyczne są komplementarne. W zapisanych przebiegach agentów brakowało wszystkich oznaczonych plików docelowych w 27–35% próbek ([artykuł i artefakty](https://arxiv.org/abs/2607.24882)). | To benchmark diagnostyczny z ograniczoną liczbą zadań, nie dowód na taką samą skalę problemu w każdym repo. „Pliki docelowe” są oznaczonym kontekstem, a nie wyczerpującą listą wszystkich możliwych trafnych plików. |

### Synteza dowodów

Badania wspierają tezę, że **pozyskiwanie właściwego kontekstu pozostaje problemem** i że do zadań kodowych warto łączyć sygnały: symbole i ścieżki, tekst, semantykę oraz relacje. Nie wspierają prostego twierdzenia „wektory zrobią z agenta superinteligencję”. Same embeddingi mogą znaleźć podobne fragmenty, ale zależność typu „kto wywołuje tę funkcję, które testy ją chronią, jaka decyzja ogranicza zmianę?” wymaga innych danych i narzędzi.

## Jak mógłby wyglądać system wzmacniający agentów

Poniższe elementy są hipotezą do sprawdzenia, a nie zatwierdzoną architekturą:

1. **Źródło prawdy:** aktualny Git i dokumentacja projektu. Każdy wynik wskazuje commit/SHA oraz plik i zakres linii.
2. **Strukturalna mapa kodu:** pliki, moduły, symbole, importy, referencje/wywołania, testy i migracje. Relacje pochodzą z parserów, TypeScript/LSP/SCIP lub innych sprawdzalnych analiz, a nie wyłącznie z opisów wygenerowanych przez LLM.
3. **Pamięć intencji:** zatwierdzone decyzje architektoniczne, powody zmian, ograniczenia i historyczne incydenty, każdorazowo z linkiem do wiarygodnego źródła. Nie przenosić całej historii czatów jako „prawdy”.
4. **Wyszukiwanie łączone:** dokładne wyszukanie symbolu/tekstu, semantyczne wyszukanie fragmentów, rozszerzenie o sąsiadów grafu i ranking pod budżet tokenów.
5. **Dostęp agentów:** małe, czytelne narzędzia MCP dla Codexa, Claude Code i kolejnych klientów. Agent nadal może sprawdzić repo bezpośrednio; warstwa ma wskazywać tropy i dowody, nie ukrywać źródeł.
6. **Aktualność i kontrola:** indeks przyrostowy po zmianie commitu, identyfikator wersji parsera/indeksu, wykluczanie sekretów, zależności, buildów i plików generowanych; jawne oznaczenie brakujących lub niepewnych relacji.

To system **zwiększający wiedzę projektową agentów w chwili pracy**, nie trening ani fine-tuning. Doświadczenie może się kumulować przez aktualizowaną mapę i pamięć decyzji, o ile nowe informacje są wersjonowane i sprawdzalne.

## Cloudflare: możliwy magazyn, nie gotowy „mózg repo”

Cloudflare AI Search obsługuje indeksowanie plików tekstowych i kodu z magazynu wbudowanego lub R2, wyszukiwanie semantyczne/pełnotekstowe i konfigurowalne dzielenie tekstu. Wbudowany chunking jest rekurencyjny i opiera się na granicach tekstu, nie na AST ani grafie symboli ([działanie AI Search](https://developers.cloudflare.com/ai-search/concepts/how-ai-search-works/), [chunking](https://developers.cloudflare.com/ai-search/configuration/indexing/chunking/)). Vectorize daje większą kontrolę nad wektorami, ale wymaga samodzielnego przygotowania i aktualizowania embeddingów ([AI Search a Vectorize](https://developers.cloudflare.com/ai-search/concepts/how-ai-search-works/)).

**Wniosek technologiczny:** Cloudflare może być jednym z magazynów lub usług wyszukiwania. Sam nie dostarcza kompletnego, świadomego składni grafu repo ani gotowej pamięci z historią decyzji. Przy lokalnym/tańszym systemie parsowanie i graf można oddzielić od dostawcy wektorów; decyzja o hostingu powinna nastąpić po porównaniu kosztu, prywatności i utrzymania. Nie zakładamy wydatków ani Workers Paid.

## Jak rozstrzygnąć „czy budować” bez polegania na wrażeniach

Research deskowy już pokazuje sensowną hipotezę i istniejące alternatywy. **Nie może sam dowieść zysku na naszym rzeczywistym kodzie.** Przed implementacją należy zatwierdzić krótką, kontrolowaną ewaluację na zadaniach historycznych/odtwarzalnych, gdy właściciel zdecyduje o wznowieniu tego kierunku:

- Porównać, w tych samych modelach i na tym samym SHA repo: (A) Codex/Claude Code bez dodatku, (B) gotową mapę repo/kode-search, (C) wspólną warstwę MCP z wyszukiwaniem hybrydowym i relacjami.
- Ująć różne typy zadań: przejście od błędu/testu do źródła, odnajdywanie testów dla zmiany, wpływ refaktoru na konsumentów, praca przekrojowa obejmująca dokumentację i decyzje.
- Mierzyć osobno: trafność plików/linii przed edycją, końcowe testy i regresje, liczbę dodatkowych odczytów/narzędzi, czas i tokeny/koszt, użycie faktycznie dostarczonego kontekstu oraz błędy wynikające ze starego indeksu.
- Użyć parowanych zadań, przypiąć wersje modeli/narzędzi/indeksu i kolejność prób; przed pomiarem ustalić progi „wdrażamy / nie wdrażamy”. Nie oceniać tylko atrakcyjnych demo ani samych tokenów.

**Warunek przejścia do budowy:** warstwa musi poprawiać wynik zadania lub istotnie zmniejszać czas/eksplorację przy zachowaniu jakości na więcej niż jednym typie zadania i działać zarówno dla Codexa, jak i Claude Code. Jeżeli zysk pojawi się tylko w retrieval recall, bez lepszych zmian/testów albo z dużym kosztem utrzymania, nie budujemy własnego systemu.

## Otwarte pytania dalszego researchu

- Czy celem jest jedno repo, kilka repo Polutka, czy dowolne przyszłe projekty? Wspólna pamięć między repo podnosi wartość, ale też koszt i ryzyko dostępu.
- Czy model MCP ma być lokalny/self-hosted, czy dopuszczamy wysyłanie kodu do usługi hostowanej?
- Które klasy relacji są niezbędne: importy, wywołania, testy, przepływ danych, migracje, decyzje i historia zmian?
- Czy gotowy Sourcegraph/Aider/inny code intelligence pokrywa większość potrzeby bez budowania własnego indeksu?
- Jak zapewnić, żeby agent ufał aktualnemu kodowi, potrafił rozpoznać brak wyniku i nie traktował sugestii indeksu jako prawdy?

## Źródła

- [Anthropic: Claude Code FAQ](https://support.claude.com/en/articles/12386420-claude-code-faq)
- [OpenAI: Codex CLI](https://learn.chatgpt.com/docs/codex/cli)
- [OpenAI: Docs MCP dla Codexa](https://developers.openai.com/learn/docs-mcp)
- [Anthropic: Model Context Protocol](https://docs.anthropic.com/en/docs/mcp)
- [Aider: Repository map](https://aider.chat/docs/repomap.html)
- [Sourcegraph: MCP Server](https://sourcegraph.com/docs/api/mcp)
- [RepoGraph, ICLR 2025](https://openreview.net/pdf?id=dw9VUsSHGB)
- [CodeRAG-Bench, Findings of NAACL 2025](https://aclanthology.org/2025.findings-naacl.176/)
- [ContextBench (2026)](https://arxiv.org/abs/2602.05892)
- [SWE-Explore (2026)](https://arxiv.org/abs/2606.07297)
- [Agent Retrieval Bench (2026)](https://arxiv.org/abs/2607.24882)
- [Cloudflare: How AI Search works](https://developers.cloudflare.com/ai-search/concepts/how-ai-search-works/)
- [Cloudflare: Chunking](https://developers.cloudflare.com/ai-search/configuration/indexing/chunking/)
