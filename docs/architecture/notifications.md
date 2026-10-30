# Powiadomienia widza

## Dwa widoki

Dzwonek otwiera szybki podgląd pięciu najnowszych wpisów. Link „Zobacz wszystkie” prowadzi do prywatnej, lokalizowanej strony `/powiadomienia` (`/en/notifications`), która pokazuje pełną historię strumieniem stron po 20 wpisów i zachowuje filtry, odczyt, aktualizację oraz bezpośrednią nawigację. Panel jest nawigacją szybką; strona jest miejscem do przeglądania historii. Oba widoki korzystają z tego samego hooka, API, licznika i synchronizacji odczytu.

Strona wymaga prawdziwej sesji, ma `noindex` i nie jest cache'owana. Bez sesji wraca do logowania z adresem powrotu. Ustawienia powiadomień nadal otwierają sekcję w „Moje konto”.

Panel przy dzwonku jest zakotwiczonym dialogiem z normalną listą i przyciskami. Na małym ekranie mieści się w viewportcie, a przewija się tylko lista; nagłówek, filtr i stopka pozostają na miejscu. Ikona pochodzi ze stabilnego `type` DTO: odpowiedź, zwykły lajk, serce twórcy, film, premiera, powitanie, wsparcie, moderacja albo komunikat systemowy. Ikony są dekoracyjne; znaczenie przekazuje też tekst. Fokus trafia do tytułu dialogu, pozostaje w nim podczas otwarcia i wraca do dzwonka po zamknięciu; Escape i widoczny przycisk zamknięcia są dostępne. Zwykłe przyciski i odnośniki zachowują standardową klawiaturę, bez semantyki `menuitem` dla wierszy.

Oba widoki mają filtry „Wszystkie” i „Nieprzeczytane”, jawne akcje odczytu/ponownego oznaczenia oraz „Oznacz wszystkie”. Rozwinięcie ujawnia pełny tytuł i treść. Wpis bez celu pozostaje czytelny i rozwijalny zamiast znikać za nieaktywnym linkiem. Samo otwarcie widoku nigdy nie oznacza wpisów jako przeczytanych. Panel nie ładuje starszych stron — do pełnej historii prowadzi link „Zobacz wszystkie”.

Odświeżanie co 60 s działa tylko dla widocznej karty. Przy zamkniętym panelu pobierany jest wyłącznie licznik. Gdy panel jest otwarty, ciche odświeżenie nie zastępuje załadowanych stron ani nie przestawia czytelnika: aktualizuje tekst/stan znanych ID osobnym, ograniczonym zapytaniem i sygnalizuje nowe wpisy przyciskiem. Dopiero jawne pokazanie nowych wpisów wstawia je nad historią; uzupełnianie przerwy w aktywnym kanale jest ograniczone do pięciu stron i 8 s na kliknięcie. Błędy pierwszego pobrania, odświeżania, starszej strony i zapisu są rozdzielone, a ponowienie zachowuje odpowiednio poprzednią listę lub kursor. Żądania kończą się timeoutem po 15 s.

## Nawigacja

Zwykły klik w wewnętrzny link zamyka panel i korzysta z nawigacji klientowej. Znany film w `ChannelHome` jest przełączany lokalnie przez historię, bez przeładowania dokumentu; inne cele używają routera. Klik z Ctrl/Cmd i linki zewnętrzne zachowują natywne działanie odnośnika. Absolutny adres tej samej domeny jest traktowany jako wewnętrzny.

Link do komentarza otwiera zakładkę komentarzy, pobiera jeden uprawniony kontekst wątku przez `/api/comments/<id>/context`, odsłania także odpowiedź spoza podglądu, ustawia fokus i podświetla cel. Działa dla już otwartego filmu i ponownego wyboru tego samego celu. Nie uruchamia filmu z dźwiękiem. Zwykła nawigacja filmowa usuwa poprzedni cel komentarza. Niewidoczny/usunięty komentarz ma komunikat, a błąd sieci — możliwość ponowienia. Historia zachowuje film, komentarz i rzeczywisty adres używany przez maskowanie URL.

## Dane i spójność

- API listy i liczników zwraca tylko własne wiersze widza, z `Cache-Control: private, no-store`. Mutacje są idempotentne, ograniczane na użytkownika i chronione kontrolą origin w middleware.
- DTO zawiera `kind`, prezentacyjny `type` wyprowadzony z rodzaju/szablonu i czas `snapshotAt`; nie ujawnia surowych parametrów ani danych innych kont. Tekst jest renderowany w aktywnym języku UI (`language` z dozwolonej listy), a przy jego braku w języku konta. Zapytanie `ids` synchronizuje maksymalnie 50 własnych wierszy naraz i nadal przechodzi przez filtr właściciela.
- Keyset `createdAt + id` pozwala kontynuować listę po usunięciu granicznego wiersza. Stare kursory będące ID są obsługiwane tylko dla własnych powiadomień. Paginacja deduplikuje wyniki i blokuje równoległe kliknięcia „Pokaż starsze”.
- Lista ma cutoff `createdAt <= snapshotAt`; „Oznacz wszystkie” wysyła pierwszy snapshot jako `before`. Nowsze wiadomości zachowują stan nieprzeczytany. Globalny licznik po zapisie pochodzi z odpowiedzi serwera.
- Pojedynczy odczyt i ponowne oznaczenie aktualizują wiersz/licznik optymistycznie. Błąd zapisu przywraca stan i daje celowe ponowienie; zapisy są pojedynczo serializowane. „Oznacz wszystkie” wysyła cutoff z pierwszej strony, a nowa wiadomość po nim pozostaje nieprzeczytana.
- Licznik odświeża się co minutę przy widocznej karcie; otwarty panel odświeża listę. Zamknięty panel pobiera tylko licznik. Dzwonek jest montowany z kluczem ID konta; zmiana konta czyści jego stan i zamyka kanał poprzedniego użytkownika. `BroadcastChannel` jest nazwany per ID konta i przesyła tylko `{ type: "changed" }`, bez treści powiadomień.
- Bezpieczne odnośniki dopuszczają ścieżki wewnętrzne i poprawne HTTPS bez loginu/hasła; odrzucają kontrolki, backslashe, kodowane separatory i błędne kodowania.

Generowanie wiadomości korzysta ze wspólnego `sendNotification` i preferencji widza. Nowe filmy i premiery są rozsyłane przez trwałe zadanie `NEW_VIDEO_FANOUT`, z deduplikacją oraz ponowną kontrolą widoczności. Cykl retencji pozostaje osobny (`pruneOldNotifications`).
