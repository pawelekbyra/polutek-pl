# Powiadomienia widza

Panel przy dzwonku pokazuje najnowsze wiadomości, fragment treści, czas i nieprzeczytany stan. Ikona pochodzi ze stabilnego `type` DTO: odpowiedź, zwykły lajk, serce twórcy, film, premiera, powitanie, wsparcie, moderacja albo komunikat systemowy. Ikony są dekoracyjne; znaczenie przekazuje też tekst. Obsługa menu: strzałki, Enter, Escape i powrót fokusu do dzwonka. Lista mieści się na telefonie i przewija wewnątrz panelu.

## Nawigacja

Zwykły klik w wewnętrzny link zamyka panel i korzysta z nawigacji klientowej. Znany film w `ChannelHome` jest przełączany lokalnie przez historię, bez przeładowania dokumentu; inne cele używają routera. Klik z Ctrl/Cmd i linki zewnętrzne zachowują natywne działanie odnośnika. Absolutny adres tej samej domeny jest traktowany jako wewnętrzny.

Link do komentarza otwiera zakładkę komentarzy, pobiera jeden uprawniony kontekst wątku przez `/api/comments/<id>/context`, odsłania także odpowiedź spoza podglądu, ustawia fokus i podświetla cel. Działa dla już otwartego filmu i ponownego wyboru tego samego celu. Nie uruchamia filmu z dźwiękiem. Zwykła nawigacja filmowa usuwa poprzedni cel komentarza. Niewidoczny/usunięty komentarz ma komunikat, a błąd sieci — możliwość ponowienia. Historia zachowuje film, komentarz i rzeczywisty adres używany przez maskowanie URL.

## Dane i spójność

- API listy i liczników zwraca tylko własne wiersze widza, z `Cache-Control: private, no-store`. Mutacje są idempotentne, ograniczane na użytkownika i chronione kontrolą origin w middleware.
- DTO zawiera `kind`, prezentacyjny `type` wyprowadzony z rodzaju/szablonu i czas `snapshotAt`; nie ujawnia surowych parametrów ani danych innych kont. Teksty pozostają w ośmiu językach.
- Keyset `createdAt + id` pozwala kontynuować listę po usunięciu granicznego wiersza. Stare kursory będące ID są obsługiwane tylko dla własnych powiadomień. Paginacja deduplikuje wyniki i blokuje równoległe kliknięcia „Pokaż starsze”.
- Lista ma cutoff `createdAt <= snapshotAt`; „Oznacz wszystkie” wysyła pierwszy snapshot jako `before`. Nowsze wiadomości zachowują stan nieprzeczytany. Globalny licznik po zapisie pochodzi z odpowiedzi serwera.
- Pojedynczy odczyt aktualizuje wiersz i licznik optymistycznie. Błąd zapisu przywraca stan i daje komunikat. Generacje żądań odrzucają spóźnione strony/liczniki; zapis jest serializowany. Otwarcie panelu samo nie oznacza wpisów jako przeczytanych.
- Licznik odświeża się co minutę przy widocznej karcie; otwarty panel odświeża listę. Zamknięty panel pobiera tylko licznik. Dzwonek jest przypisany kluczem do konta; zmiana konta czyści jego stan, a kolejka starego komponentu nie wysyła kolejnych zapisów.
- Bezpieczne odnośniki dopuszczają ścieżki wewnętrzne i poprawne HTTPS bez loginu/hasła; odrzucają kontrolki, backslashe, kodowane separatory i błędne kodowania.

Generowanie wiadomości korzysta ze wspólnego `sendNotification` i preferencji widza. Nowe filmy i premiery są rozsyłane przez trwałe zadanie `NEW_VIDEO_FANOUT`, z deduplikacją oraz ponowną kontrolą widoczności. Cykl retencji pozostaje osobny (`pruneOldNotifications`).
