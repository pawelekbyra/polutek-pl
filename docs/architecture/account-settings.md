# Panel widza „Moje konto”

`app/components/auth/AccountModal.tsx` jest wspólnym wejściem do ustawień konta. Zachowuje istniejące
sekcje i akcje: profil, powiadomienia, e-mail, połączone konta, hasło i zabezpieczenia, klucze
dostępu, usunięcie konta oraz warunkową strefę patrona.

## Układ i nawigacja

- Dialog ma szerokość dopasowaną do treści (maksymalnie 920 px), stały nagłówek i stopkę oraz jeden
  przewijany obszar aktywnej sekcji. Na telefonie nagłówek, wybór sekcji i stopka mają kompaktowe
  odstępy, a profil mieści wizytówkę i język bez wewnętrznego przewijania na wysokich ekranach.
  Przycisk zamknięcia pochodzi ze wspólnego `DialogContent`.
- Od breakpointu `md` sekcje są pionowymi kartami `@base-ui/react/tabs` z ikonami Lucide, czytelnym
  stanem aktywnym i osobnym kolorem dla usuwania konta. Strzałki klawiatury przenoszą fokus i od razu
  aktywują sekcję.
- Na mniejszych ekranach lista zakładek jest zastąpiona jednym własnym selektorem Base UI. Rozwijane
  menu poprzedza niebieskawa etykieta „Wybierz sekcję”; przycisk i lista mają wyraźny kontrast,
  ikony i stany zaznaczenia panelu. Portal pozwala menu wyjść poza przewijany obszar dialogu.
  Aktywna zawartość mieści się w dialogu, a przewijanie nie przesuwa nagłówka ani stopki.
- Panel profilu nie pokazuje ośmiu języków jako siatki. Selektor `@base-ui/react/select` otwiera
  listę portaled poza przewijanym panelem, pokazuje nazwy własne i flagi języków oraz obsługuje
  klawiaturę. Zmiana nadal używa istniejącego `useSwitchLanguage` i zapisu preferencji konta.
- Sekcja Profil zaczyna się od lekkiej wizytówki bez ramki: wyśrodkowany avatar 96 px z małą,
  klawiaturowo dostępną akcją zmiany zdjęcia przy krawędzi, a następnie centralnie edytowany
  pseudonim na jasnoszarym tle, krótki opis i zapis. Zawartość wizytówki ma mały odstęp od tytułu
  sekcji. Język jest osobną kartą preferencji poniżej wizytówki.

## Wzorce dostępności

Zakładki zachowują semantykę i klawiaturę z WAI-ARIA APG; aktywacja po fokusie jest właściwa, bo
wszystkie sekcje są lokalne i nie czekają na przejście sieciowe. Hierarchiczna nawigacja pionowa
utrzymuje nazwy sekcji czytelne bez zawijania wielu rzędów na szerokim ekranie. Na telefonie jeden
kompaktowy selektor nie konkuruje z formularzem i nie tworzy poziomego przewijania.

Źródła wzorców: [WAI-ARIA Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/),
[USWDS Side Navigation](https://designsystem.digital.gov/components/side-navigation/),
[Carbon Tabs Guidelines](https://www.carbondesignsystem.com/building-blocks/core/components/tabs/guidelines)
i [Base UI Select](https://base-ui.com/react/components/select).
