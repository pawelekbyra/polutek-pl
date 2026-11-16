# Przejęcie badania przez Claude Code

Stan przygotowany 16 listopada 2026. To instrukcja przejęcia pracy na istniejącej gałęzi audytowej, nie deklaracja zakończenia audytu ani zgoda na wdrożenie.

## Punkt startowy

- Repo: `pawelekbyra/polutek-pl`.
- Gałąź: `docs/polutek-platform-audit`.
- Worktree dozwolony dla tego zadania: `/opt/codex/polutek-pl/.worktrees/platform-audit`.
- Ostatni zapisany commit na początku przekazania: `256fe91e` (`docs(audit): map additional API handler evidence`).
- Drzewo było czyste po tym commicie.
- Pierwsze do przeczytania: `AGENTS.md`, `CLAUDE.md`, `docs/audit/2026-11-01-platform-research/README.md`, `program-audytu/PROGRAM.md`, `program-audytu/ROADMAPA-NAPRAW.md`, `program-audytu/STAN.md`, `POSTEP-NAPRAW.md` oraz `program-audytu/WNIOSEK-DLA-WLASCICIELA.md`.

## Stan, którego nie wolno nadinterpretować

- To gałąź dokumentująca audyt i dowody. Nie zawiera kompletnego pakietu napraw aplikacji.
- Wszystkie D01–D18 są `W_TRAKCIE`; wszystkie 18 pozycji `DOMKNIECIE-DOWODOW.csv` jest otwartych; żadna z pięciu bramek gotowości nie ma zatwierdzenia.
- Mapa powierzchni ma 286 wpisów: 98 `W_TRAKCIE`, 188 `NIEZBADANE`. Crosswalk ma 40 wpisów i łączy tylko wybrane testy z metodami tras.
- Ostatnie 14 selektywnych zmian statusu powierzchni opiera się na jednym lokalnym przebiegu HTTP/PostgreSQL oraz 13 testach handlerów z atrapami. To dowody częściowe, nie `PASS` całej trasy ani obszaru.
- Macierz ASVS nie została ponownie zakwalifikowana po pełnym zapisie z 2 listopada. Wyniki testów dotyczą różnych SHA; nie składają się na jeden pełny przebieg na bieżącym kodzie.
- Brak pełnego odbioru produkcyjnego, pełnej macierzy HTTP/DB/ról, realnych integracji R2/Stripe, restore offsite, reprezentatywnego testu skali i niezależnego przeglądu.

## Zadanie przejmującego

1. Potwierdź branch, HEAD i czystość drzewa. Nie zakładaj, że lokalny branch lub jego dowody są równoważne bieżącemu `main`; sprawdź różnicę kodu względem aktualnej bazy bez zmieniania jej.
2. Zrób niezależny, krytyczny przegląd ostatniej aktualizacji crosswalku i powierzchni: `KRYTYCZNE-TRASY-DOWODY.csv`, `POWIERZCHNIA-WEJSC.csv`, `STAN.md` i wniosek właściciela. Sprawdź zgodność ścieżek, metod, fizycznych linii CSV, SHA testów, ograniczeń atrap oraz liczników. Zgłoś każdą niezgodność przed zmianą statusu.
3. Porównaj pokrycie D01–D18, ASVS i powierzchni wejść z warunkami w `DOMKNIECIE-DOWODOW.csv`. Wskaż brakujące zakresy i zależności, nie tylko kolejne testy, które już istnieją.
4. Zaproponuj jedną małą, najwyższego priorytetu partię dalszego badania: konkretne wymagania/powierzchnie, potrzebny dowód, środowisko, kryteria akceptacji i ograniczenia. Zacznij od luk bezpieczeństwa, pieniędzy, izolacji i cyklu danych; nie obniżaj rygoru dowodów dla wygody.
5. Zapisuj wyłącznie potwierdzone wnioski w istniejących rejestrach, małymi commitami. Aktualizuj liczby i ograniczenia we wszystkich powiązanych dokumentach. Jeżeli nie da się potwierdzić twierdzenia, oznacz je jako niewiadomą lub błąd dokumentacji zamiast dopowiadać.

## Granice pracy

Obowiązują polecenia właściciela zapisane w `AGENTS.md`: pracuj tylko we wskazanym worktree i na tej gałęzi; bez produkcji, serwera, `/opt/claude`, wdrożeń, publikowania PR i pushowania do `main`. Nie dotykaj sekretów i nie wpisuj ich do repo. Nie wykonuj płatnych ani nieodwracalnych działań. Przed uruchomieniem ciężkiego przebiegu lub testu zależnego od usług jasno określ cel, środowisko i skutki oraz postępuj zgodnie z obowiązującymi instrukcjami projektu. Sam przegląd dokumentacji może zacząć się od razu.

Badanie i implementacja napraw to osobne etapy. Nie oznaczaj całej gałęzi jako „gotowej do wdrożenia”; przekaż Claude’owi zadanie niezależnego review i kolejnego kroku badawczego. Po zakończeniu partii podaj właścicielowi: co sprawdzono, na jakim SHA, jakie są ograniczenia, co pozostało i dokładny commit.

## Prompt do wznowienia

> Przejmij badanie Polutka na gałęzi `docs/polutek-platform-audit` w `/opt/codex/polutek-pl/.worktrees/platform-audit`. Zacznij od `AGENTS.md`, `CLAUDE.md` i `docs/audit/2026-11-01-platform-research/PRZEJECIE-CLAUDE.md`, potem przeczytaj wskazane tam dokumenty startowe. Najpierw niezależnie zweryfikuj ostatni crosswalk i jego ograniczenia; nie zakładaj, że audyt jest zamknięty. Następnie wybierz i wykonaj jedną małą, najlepiej uzasadnioną partię dalszego mapowania brakujących dowodów z `DOMKNIECIE-DOWODOW.csv`. Pracuj wyłącznie w dozwolonym worktree i na tej gałęzi, nie wdrażaj, nie publikuj PR ani nie pushuj do `main`. Nie zaliczaj testów z atrapami jako pełnego odbioru. Dokumentuj SHA, środowisko, ograniczenia i następny krok oraz zapisuj pracę małymi commitami.
