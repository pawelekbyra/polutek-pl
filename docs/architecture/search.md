# Wyszukiwarka publiczna (wszystkie kanały)

Stan obecny. Reguły skrótowo w CLAUDE.md §4.30.

## Dane

- `Video.searchText` (tekst znormalizowany: tytuł PL/EN, tagi, kategoria, opis i tytuły rozdziałów tylko dla `PUBLIC`) i `Video.durationSeconds` (z tekstu `duration`) są zapisywane **wyłącznie** przez trigger `video_search_refresh()` (migracja `20261019170000_video_search`). Każda ścieżka zapisu (Studio, panel, skrypty) jest więc objęta bez zmian w kodzie aplikacji. Migracja robi też uzupełnienie istniejących wierszy. Tytuły rozdziałów (`Video.chapters`, PL i EN, do 2000 znaków) dopisuje następna migracja `20261020130000_video_chapters_search` (nowa wersja funkcji, trigger reaguje też na zmianę `chapters`; reszta bez zmian, `video_search_normalize()` nietknięta); filmy nie-`PUBLIC` nie dostają ich w `searchText`.
- `video_search_normalize(text)`: `translate()` ze składanych znaków (polskie i inne łacińskie diakrytyki, małe i wielkie), `lower()`, usunięcie znaków łączących, separatory (biały znak, ASCII-interpunkcja, typograficzne cudzysłowy i myślniki) do jednej spacji. Lustro w TS: `normalizeSearchText()`; test `search-query.test.ts` pilnuje identycznych tablic.
- Indeksy (częściowe, tylko `PUBLISHED`): GIN `to_tsvector('simple', "searchText")`, `(category, publishedAt DESC)`, `(views DESC, publishedAt DESC)`.

## Dlaczego bez `pg_trgm` / `unaccent`

Obraz produkcyjny to `postgres:17-alpine`. Rozszerzenia z contrib da się tam włączyć, ale to zmiana bazy poza migracją addytywną tabel i dodatkowa zależność przy odtwarzaniu serwera. Znormalizowana kolumna utrzymywana triggerem daje to samo (ignorowanie wielkości liter i polskich znaków) bez nowego rozszerzenia.

## Zapytanie

1. Słowa (maks. 6, po normalizacji) łączone AND; każde słowo to prefiks `to_tsquery('simple', 'slowo:*')` na indeksie GIN **lub** trafienie w nazwę/uchwyt kanału (ID kanałów wyznaczane osobnym małym zapytaniem) **lub** w kategorię (klucz albo nazwa PL/EN).
2. Gdy pierwsza strona jest pusta, powtórka tym samym zapytaniem z `searchText LIKE '%slowo%'` (środek wyrazu). Nie używa indeksu GIN, ale jest tylko zapasowa i działa na opublikowanych wierszach po pozostałych filtrach.
3. Trafność: tytuł 10, tag 6, kategoria 5, kanał 4 (za każde słowo) + 8 za całą frazę w tytule; remisy: kubełek popularności `floor(ln(views+1))`, data publikacji, id. Sortowania: trafność, najnowsze, najczęściej oglądane.
4. Paginacja kursorem (klucz złożony z wartości ostatniego wiersza, base64url, walidowany); kursor niesie tryb (`fts`/`like`), więc kolejne strony nie zmieniają techniki.
5. Filtry: kategoria, tag (porównanie po `video_search_normalize`), kanał (slug lub uchwyt), długość (krótkie < 4 min, średnie 4-20, długie > 20), data dodania (doba, tydzień, miesiąc, rok).

Plan zapytania (z rozumowania, nie z pomiaru na produkcji): wiersze są najpierw zawężane indeksem GIN i/lub częściowym indeksem `PUBLISHED`, połączenie z `Creator` po kluczu głównym, a obliczenia trafności robią się tylko na dopasowanych wierszach. Dla skali platformy (tysiące filmów) sortowanie dopasowanych wierszy jest tanie.

## Widoczność

Jedno miejsce: `visibilitySql()` w `public-search.service.ts`, używane przez wyniki i liczniki. Filmy nie-`PUBLIC` są szukalne po tytule i tagach, ale opis nie wchodzi do `searchText` i nie jest zwracany.

## Nie zrobione

- Filtr języka: `Video` nie ma pola języka treści (potrzebne pole w Studiu i decyzja o uzupełnieniu istniejących filmów).
