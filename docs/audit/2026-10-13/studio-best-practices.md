# Studio twórcy: najlepsze praktyki (raport z 2026-10-13)

Metoda: oficjalne strony pomocy (YouTube, Vimeo, Patreon, Rumble, W3C) oraz wyniki wyszukiwania. Pozycje oznaczone [niepotw.] pochodzą z źródeł trzecich lub nieaktualnych i wymagają ręcznej weryfikacji w żywym interfejsie.

## 1. Przepływ wgrywania
- YouTube (kreator wieloetapowy): Szczegóły (tytuł max 100 zn., opis max 5000 zn., miniatura, playlista) -> Odbiorcy (obowiązkowe "dla dzieci": tak/nie, ograniczenie wieku) -> Widoczność (publiczny/niepubliczny/prywatny/zaplanowany) . Pozostałe pola (lokalizacja, płatna promocja, tagi, kategoria, język, licencja, komentarze, napisy) są pod "Pokaż więcej". Zamknięcie okna przed wyborem widoczności zapisuje film jako prywatny (bezpieczny domyślny stan).
- Harmonogram: najpierw widoczność "zaplanowany/prywatny", potem data, godzina i strefa czasowa; zmiana terminu wymaga stanu prywatnego.
- Rumble: plik -> Szczegóły (tytuł, opis, autor/kanał, kategoria, miniatura, tagi) -> Preferencje (monetyzacja, widoczność, umiejscowienie, powiadomienia push, akceptacja regulaminu). Harmonogramu nie znaleziono w dokumentacji [niepotw.].
- Patreon: tytuł wymagany; publikuj teraz / zaplanuj / backdate; kto widzi (publicznie, wszyscy płacący, wybrane poziomy); szkic z autozapisem.
- Substack: wideo przeciągane do edytora, wybór miniatury, dostęp per post (wszyscy / tylko płatni), podgląd "jak zobaczy subskrybent".
- Vimeo: ustawienia domyślne uploadu (Settings -> Videos -> Upload Defaults) zmniejszają liczbę decyzji przy każdym filmie.

## 2. Strona edycji
- Układ Vimeo: odtwarzacz u góry, pod nim tytuł/opis/miniatura/tagi/kategorie/licencja; prywatność i udostępnianie w modalu "Share"; menu "..." (pobierz, kopiuj, usuń).
- YouTube Studio: formularz z jawnym przyciskiem Zapisz; strona pomocy nie opisuje ostrzeżenia o niezapisanych zmianach. Limity: tytuł 100, opis 5000, napisy/rozdziały/auto-rozdziały jako osobne pola.
- Zapis: YouTube = przycisk; Patreon = autozapis szkicu; Vimeo = autozapis prywatności, ręczny zapis w edycji zbiorczej. Wniosek: autozapis szkiców + jawny przycisk dla zmian publicznych.

## 3. Lista treści
- YouTube: kolumny miniatura, tytuł+opis, widoczność, ograniczenia, data, wyświetlenia, komentarze, polubienia; zakładki typu treści; filtr (lejek), sortowanie po nagłówkach kolumn, zaznaczanie z edycją zbiorczą (widoczność, playlisty). "Zaznacz wszystko" obejmuje tylko bieżącą stronę; zmiana "wierszy na stronę" [niepotw., źródła trzecie].
- Twitch Video Producer: lista z tytułem, datą, akcje zbiorcze usuń/ukryj (partie po 20, artykuł z 2021) [niepotw.]; widoczny licznik wygasania i wyciszenia praw autorskich.

## 4. Pulpit (YouTube)
Karty: wyniki ostatniego filmu, analityka kanału (28 dni: wyświetlenia, czas oglądania, subskrybenci, najlepsze filmy), najnowsze komentarze bez odpowiedzi, ostatnia aktywność, ważne powiadomienia, "pomysły dla Ciebie". Karty pojawiają się zależnie od aktywności (nowi twórcy dostają wskazówki).

## 5. Komentarze
- Zakładki: Opublikowane / Wstrzymane do przeglądu (połączone z "Prawdopodobny spam", przechowywanie do 60 dni); filtry po wyszukiwaniu i statusie.
- Akcje: zatwierdź, usuń, zgłoś, ukryj użytkownika, odpowiedz, serduszko, przypnij, "zawsze zatwierdzaj tego użytkownika".
- Poziomy moderacji per film: Brak / Podstawowa / Ścisła / Wstrzymaj wszystkie; zablokowane słowa i linki; zatwierdzeni i ukryci użytkownicy na poziomie kanału; domyślne ustawienia dla nowych filmów. Wyłączenie komentarzy ukrywa istniejące.
- Rozmiary kontrolek: źródła YouTube nie podają; stosować WCAG 2.2 SC 2.5.8 (min. 24x24 CSS px lub odstęp).

## 6. Dostępność i mobile
- WCAG 2.2 SC 2.5.8: cele dotykowe min. 24x24 px (AA); zalecane większe (2.5.5, 44x44 px, wartość spoza strony źródłowej).
- Patreon: aplikacja mobilna nie wspiera uploadu audio, tylko desktop; YouTube Studio ma osobną aplikację z uploadem i powiadomieniem o zakończeniu kontroli.

## Rekomendacje (priorytet)

MUST HAVE
1. Kreator uploadu w 3 krokach (plik+tytuł -> miniatura/opis -> widoczność), reszta w "Więcej opcji". Upload zamknięty w połowie = szkic prywatny. [YouTube 57407]
2. Widoczność: prywatny / niepubliczny / publiczny + zaplanowany z datą, godziną i strefą. Domyślnie prywatny. [YouTube 1270709]
3. Tytuł 100 zn. i opis 5000 zn. z licznikiem znaków. [YouTube 57404]
4. Edycja: odtwarzacz obok, status przetwarzania, link do udostępnienia, jawny przycisk Zapisz, ostrzeżenie o niezapisanych zmianach (YouTube go nie dokumentuje, więc to nasz dodatek). [YouTube 57404, Vimeo 12426156259473]
5. Lista treści: miniatura, tytuł, widoczność, data, wyświetlenia, komentarze; wyszukiwarka, filtr widoczności, sortowanie, paginacja. [YouTube Studio, źródła trzecie]
6. Komentarze: przełącznik włącz/wstrzymaj/wyłącz per film, kolejka "do przejrzenia" z akcjami zatwierdź/usuń, blokada użytkownika. [YouTube 9483359]
7. Pulpit: ostatni film z liczbami, komentarze bez odpowiedzi, powiadomienia. [YouTube 2673341]
8. Cele dotykowe min. 24x24 px, pełna obsługa klawiaturą, układ jednokolumnowy na telefonie. [W3C 2.5.8]

NICE TO HAVE
9. Edycja zbiorcza (widoczność, usuń) z jawnym zakresem "zaznaczono N". [YouTube Studio; Twitch]
10. Moderacja poziomowa (Brak/Podstawowa/Ścisła/Wstrzymaj wszystko), lista blokowanych słów, zatwierdzeni użytkownicy. [YouTube 9483359]
11. Ustawienia domyślne uploadu (widoczność, komentarze, licencja). [Vimeo]
12. Autozapis szkicu. [Patreon 115004048046]
13. Napisy, rozdziały, licencja, tagi, kategoria, ograniczenie wieku/"dla dzieci" (ostatnie obowiązkowe tylko tam, gdzie prawo tego wymaga; w UE rozważyć odpowiednik). [YouTube 57404]
14. Karta "Wskazówki dla nowych" na pulpicie znikająca po pierwszym filmie. [YouTube 2673341]

## Źródła
- https://support.google.com/youtube/answer/57407 (upload)
- https://support.google.com/youtube/answer/57404 (edycja)
- https://support.google.com/youtube/answer/1270709 (harmonogram)
- https://support.google.com/youtube/answer/9483359 (komentarze)
- https://support.google.com/youtube/answer/9482362 (spam)
- https://support.google.com/youtube/answer/2673341 (pulpit)
- https://help.vimeo.com/hc/en-us/articles/12426156259473-Video-settings-overview
- https://help.vimeo.com/hc/en-us/articles/12426215726353 (komentarze Vimeo)
- https://support.patreon.com/hc/articles/115004048046-Posting
- https://rumble.support/help/upload-and-edit-content
- https://on.substack.com/p/video-on-substack
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://www.theouterhaven.net/2021/03/twitch-is-rolling-out-better-dmca-tools-starting-today/ (Twitch, 2021, [niepotw.])

## Luki
Nie zweryfikowano: dokładnych rozmiarów kontrolek w YouTube Studio, filtrów listy treści z oficjalnej pomocy, autozapisu w YouTube/Vimeo, harmonogramu w Rumble, aktualnego Kick VOD (brak źródeł).
