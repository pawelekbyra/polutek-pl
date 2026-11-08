# D15 — UX, dostępność i języki

Partia 13, 1 listopada 2026. **W_TRAKCIE**. Polutek `c397b9e548ca2c628e21457ac69d66e54b12ddbd`; PeerTube `fa7d2b5d8a44bbec99159b11e91763f7d2308faa`. [Zakres/hash](../evidence/batch13-review.json), [12 zadań użytkownika](../ZADANIA-UZYTKOWNIKA.csv), [14 scenariuszy komponentów](../SCENARIUSZE-UX.csv), [15 wybranych kryteriów WCAG](../WCAG-POKRYCIE.csv), [języki](../JEZYKI-POKRYCIE.csv), [walidacja](../evidence/validation-batch13.json). Badanie bez zmian aplikacji i produkcji.

## Wniosek dla właściciela

W kodzie są konkretne elementy dobrej obsługi użytkownika: bezpieczna akcja początkowa w potwierdzeniu, przywracanie fokusu, wybór języka klawiaturą, zachowanie notatki po błędzie, komunikaty statusu i reguły ograniczania ruchu. Lokalne testy potwierdziły też spójność katalogów ośmiu języków. To istotne podstawy produktu, ale nie ocena wygody całej platformy ani zgodności ze standardem dostępności.

Nowe **R35**: w rzeczywistym Chromium, na niezmienionym ConfirmDialog, stan oczekiwania wyłącza oba przyciski i pozwala Tabem przejść do tła. Enter może uruchomić tamtejszą kontrolkę, choć okno nadal ma aria-modal=true. Przypadek odpowiada czasowi oczekiwania na usunięcie playlisty; działanie i dane w próbie były syntetyczne. Nie wykonano prawdziwego usuwania ani nie dowiedziono obejścia uprawnień.

**R20** pozostaje jawnym kompromisem produktu: viewport i ZoomLock ograniczają gesty powiększania zgodnie z decyzją właściciela. Wygląd, logo, intro i zoom pozostały bez zmian. Wpływ na użytkowników wymagających powiększenia trzeba zbadać na urządzeniach i z technologiami asystującymi przed ewentualną osobną decyzją o zmianie.

## Metoda i granice

Wybrane fragmenty i zależności **59 plików Polutka** objęto zakresem; część katalogów była liczona i pakowana, nie oceniana językowo. Liczby nie oznaczają pełnego ręcznego audytu tych plików. PeerTube porównano na fragmentach **8 źródeł**, bez instalacji lub uruchomienia.

[Strona testowa](../tools/ux-browser-harness.tsx) składa rzeczywiste ConfirmDialog, ReportDialog, DeleteCommentDialog i LanguageSwitcher. Ładuje rzeczywiste katalogi i helpery tłumaczeń oraz kompiluje oryginalny globals.css i moduł CSS przełącznika. Prosty provider/stany i otaczająca strona są fixture. Przyciski usuwania/zgłoszenia wywołują wyłącznie syntetyczne callbacki; strona nie ma konta, płatności, bazy lub rzeczywistego API.

[Runner](../tools/ux-browser-experiment.cjs) uruchamia lokalny HTTP dla HTML/JS/CSS/flag i Chromium **154.0.8037.57**. Połączenia przeglądarki do adresów innych niż loopback są blokowane; odnotowano zero takich prób, zero żądań API aplikacji i zero page errors w finalnym przebiegu. Początkowy viewport 1280×900, potem 320×812; prefers-reduced-motion emulowane jako reduce. [Wersje pakietów i warunki](../evidence/ux-environment-batch13.json), [14 obserwacji](../evidence/ux-browser-experiment.json), [log](../evidence/ux-browser-experiment.log).

To prawdziwa próba DOM i klawiatury w Chromium dla komponentów, nie pełne E2E Polutka. Nie uruchomiono Next, logowania, playera z HLS, rzeczywistych zgłoszeń, Stripe ani Prisma. Fonty i otaczający układ nie odtwarzają dokładnie produkcji. Nie testowano Safari, Firefox, fizycznego telefonu, VoiceOver/NVDA, powiększania użytkownika ani odbioru przez osobę z niepełnosprawnością.

## R35 — fokus opuszcza potwierdzenie podczas oczekiwania

[ConfirmDialog](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/components/studio/ConfirmDialog.tsx) na wejściu skupia Cancel, a handler Tab zawija między aktywnymi przyciskami. Gdy busy=true, oba dostają disabled. Selektor button:not([disabled]) zwraca pustą listę, handler wraca bez zatrzymania Tab. Panel nie ma zastępczego miejsca fokusu, a otaczające elementy nie są inert.

Źródłowa ścieżka produktu jest w [StudioPlaylists](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/components/studio/StudioPlaylists.tsx#L193): destroy ustawia deleting=true, czeka na DELETE, po sukcesie wraca do listy, po błędzie zamyka potwierdzenie i pokazuje błąd. ConfirmDialog dostaje busy={deleting}. Długość tego okna zależy od prawdziwej operacji; nie mierzono jej tutaj.

| Próba w Chromium | Wynik |
|---|---|
| Otwarcie | Fokus na bezpiecznym Cancel |
| Tab i Shift+Tab bez busy | Zawinięcie między Cancel i Delete playlist |
| Escape bez busy | Okno zamknięte, fokus wraca na opener |
| Potwierdzenie i utrzymane busy | Oba przyciski disabled; Tab osiąga opener, przycisk i link tła |
| Tab do kontrolki tła, następnie Enter | Syntetyczna akcja tła wykonana przy nadal otwartym alertdialog |

Demonstracja nie wymagała programowego fokusowania przycisku tła: po przejściu w busy użyto Tab/Enter. [Screenshot pokazuje fokus poza oknem](../evidence/ux-confirm-busy.png), z jawną etykietą testowej strony. Tekst i akcja tła są fixture; nie jest to zrzut produkcji. [JSON](../evidence/ux-browser-experiment.json) ma dwa świadectwa tego samego R35, nie dwa odrębne problemy.

**Ocena:** P2 dostępności i spójności interakcji, potwierdzone dla komponentu, niezależny przegląd PENDING. To nie luka autoryzacji. **Poprawa:** zachować fokus w panelu również bez aktywnych przycisków, odizolować tło i ogłaszać oczekiwanie; można wykorzystać wspólny prymityw dialogu już obecny w repo. Uzgodnić, czy wolno anulować podczas operacji. **Odbiór:** Tab/Shift+Tab nie wychodzi do tła w normalnym i busy, Enter nie wywołuje tła; sukces, błąd i usunięty opener kończą w logicznym miejscu. Dopiero osobna próba pełnego Studia rozliczy integrację z DELETE.

### K34 — implementacja i lokalny odbiór komponentu (częściowo, 2026-11-06)

`ConfirmDialog` korzysta teraz z istniejącego modalnego prymitywu Base UI. W Chromium 149 sprawdzono prawdziwy komponent React i skompilowane style projektu: fokus początkowy i zawijanie Tab, stan busy bez aktywnych kontrolek, odcięcie tła od drzewa dostępności, ogłoszenie `aria-busy`/statusu PL+EN, zablokowane Escape/Enter podczas operacji, retry po syntetycznym błędzie, przywrócenie fokusu do openera oraz fallback do `main` po usunięciu openera. Całe badanie przeszło **16/16 obserwacji**, zero błędów strony i zero zewnętrznych żądań. [Dowód](../evidence/k34-confirm-dialog-focus-2026-11-06/result.json), [pełny wynik Chromium](../evidence/ux-browser-experiment.json).

To nadal fixture komponentu: nie uruchamiano Next/Studia, prawdziwego DELETE, Safari/Firefox ani czytnika ekranu; niezależny review oczekuje. K34 pozostaje częściowe do pełnego odbioru serwerowego i niezależnego przeglądu. Escape i kliknięcie tła podczas busy są celowo ignorowane; po zakończeniu lub błędzie użytkownik może zamknąć okno albo ponowić operację.

**Uzupełnienie 8 listopada — ReportDialog:** w czasie wysyłania zgłoszenia panel dostaje `aria-busy`, fokus jest przenoszony na panel, a `role=status` ogłasza „Operacja w toku”; Escape i zamknięcie są ignorowane do zakończenia requestu. Test komponentu potwierdza busy/status, fokus, blokadę Escape i zamknięcie po sukcesie (**3/3 PASS**), pełny repo typecheck i ESLint zmienionych plików PASS. To nie jest test z czytnikiem ekranu ani pełnego przepływu HTTP; retry po błędzie zachowuje dotychczasowe zachowanie.

## Dialog zgłoszenia: działające kontrole i ograniczenie wzorca radio

ReportDialog używa wspólnego [Dialog/Base UI](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/components/ui/dialog.tsx). W finalnym pomiarze, po ustaleniu fokusu przez dwie klatki przeglądarki, 12 kolejnych Tab nie dotarło do kontrolek tła. Escape zamknął okno i przywrócił opener. Nie uogólniamy R35 na każdy dialog projektu.

Po syntetycznej awarii zgłoszenia notatka pozostała w polu, okno zostało otwarte, a role=alert zawierał przetłumaczony komunikat. Klawiaturą wybrano Nękanie przez Space, callback dostał HARASSMENT oraz notatkę. Nie wysłano zgłoszenia do moderatora ani nie zbadano odczytu alertu przez screen reader.

W pierwotnym przebiegu sześć powodów miało `role=radio`, ale wszystkie sześć było w kolejności Tab, a ArrowDown nie zmieniał wyboru/fokusu — rozbieżność względem wzorca APG radio group. **Uzupełnienie 8 listopada:** `ReportDialog` ma teraz roving tabindex, strzałki zmieniają wybór i fokus (z zawijaniem), Home/End wybierają skrajne pozycje. Test komponentu potwierdza jeden stopień Tab oraz nawigację **4/4 suite PASS**. Nie jest to odczyt z prawdziwym screen readerem; ocena pozostałych kryteriów WCAG pozostaje otwarta.

Anulowanie DeleteCommentDialog nie wywołało syntetycznej akcji usuwania. Snapshot wykonano w trakcie obsługi zamknięcia/animacji; nie uznano go za osobne potwierdzenie końcowego restore focus. Istniejący test jednostkowy potwierdza wywołanie onConfirm dopiero po przycisku usunięcia, nie prawdziwe kasowanie.

## Języki: mocna kontrola kompletności, otwarta jakość treści

[Pomiar](../tools/i18n-catalog-measurement.ts) korzysta z istniejącego ekstraktora AST i rzeczywistego loadCatalog: **1589 wywołań tx/txRich w 144 plikach, 1245 unikalnych kluczy angielskich**. Sześć katalogów UI ma po 1245 kluczy; PL/EN korzystają z tekstów zapisanych w kodzie. W tym zakresie nie ma brakujących, zbędnych, pustych wartości ani różnic placeholderów. [Pełny wynik](../evidence/i18n-catalog-measurement.json), [8 wierszy pokrycia](../JEZYKI-POKRYCIE.csv).

| Język | Źródło UI | Klucze katalogu | Wpisy identyczne z angielskim |
|---|---|---:|---:|
| pl / en | Teksty w kodzie | 0 / 0 | Nie dotyczy |
| de | Katalog | 1245 | 41 |
| es | Katalog | 1245 | 17 |
| fr | Katalog | 1245 | 31 |
| it | Katalog | 1245 | 25 |
| pt-BR | Katalog | 1245 | 22 |
| zh-CN | Katalog | 1245 | 6 |

Identyczność może być prawidłowa dla nazw własnych lub wspólnych słów, więc nie są to automatycznie braki tłumaczeń. 20 kluczy angielskich występuje z więcej niż jednym wariantem polskim — to materiał do przeglądu kontekstu, nie 20 stwierdzonych pomyłek. Ekstraktor nie rozlicza całego panelu, treści serwerowych i e-maili. Nie przeprowadzono oceny native speakera, tonu ani terminologii finansowej/prawnej.

W prawdziwym Chromium lista języków miała osiem opcji, fokus listbox, poprawne Home/End i aria-activedescendant. Type-ahead „d” wybrał niemiecki, Enter zamknął listę i przywrócił fokus przycisku. Fixture providera zaktualizowało html lang=de. To nie test właściwego LanguageProvider, zapisu preferencji na koncie, cookie ani routingu.

Przy 320 px testowa lista miała szerokość 292 px i mieściła się między x=9 a x=301. [Screenshot](../evidence/ux-language-320.png). To geometria jednego komponentu w fixture; nie zaliczenie reflow całej strony przy 400% ani całej strony po niemiecku. Reduced motion było emulowane, ale nie sprawdzono wszystkich animacji.

[I18N.md](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/docs/operations/I18N.md) opisuje granicę: osiem języków interfejsu, treści filmów/e-maile/dokumenty głównie PL/EN, dla pozostałych odpowiedni angielski fallback. Napisy nie dostają automatycznie ośmiu wersji przez sam wybór UI; wymagają istniejącej ścieżki. Trzeba osobno zweryfikować oznaczanie języka fragmentów, komunikaty o fallback i rzeczywiste układy.

## Całe zadania i inne źródła UX

[Mapa 12 zadań](../ZADANIA-UZYTKOWNIKA.csv) obejmuje wejście/oglądanie/wyszukanie/język/logowanie/zgłoszenie/komentarz, upload i usunięcie playlisty, płatność, dane konta i dokumenty. **Żadne całe zadanie nie jest tu zaliczone end to end**. Źródła i wcześniejsze partie dostarczają dowodów poszczególnych granic.

W źródłach sprawdzono m.in. fokus tytułu po zmianie widoku logowania i kroku uploadu, aria-live progresu, role status/alert playera, napisy i skróty Vidstack, chapter shortcuts oraz gałąź reduced-motion intro i inert strony pod nim. Nie wykonano pełnej ścieżki filmu ani wejścia przez intro. Sam marker aria-live lub skrót w kodzie nie potwierdza, że screen reader go poprawnie odczyta.

R20 obejmuje viewport maximumScale=1/userScalable=false i listenery gesturestart/gesturechange/touchmove/touchstart w ZoomLock. Nie utożsamiamy tego automatycznie z wynikiem każdego kryterium resize/reflow i każdej przeglądarki. Zamrożone decyzje wyglądu wymagają osobnego uzgodnienia, jeśli badanie produktu wykaże potrzebę zmiany.

## Weryfikacja istniejących testów

Siedem plików, **62/62 passed, exit 0 tego podzbioru**: LanguageSwitcher 12, katalogi 23, helpery UI 9, dialogi komentarzy 2, statyczne reguły a11y 2+4 i wybrane kontrasty/tokeny 10. [JSON](../evidence/ux-targeted-vitest.json), [log](../evidence/ux-targeted-vitest.log). Nie uruchamiano pełnego zestawu, generowania Prisma, pełnego typecheck ani local-ci.

Test kontrastu liczy wybrane tokeny i placeholder, nie każdy tekst na rzeczywistym tle. Testy statyczne sprawdzają określone fragmenty źródeł; testy jsdom nie odtwarzają całego silnika przeglądarki. Przejście tych kontroli nie zalicza wszystkich kryteriów WCAG.

## Porównanie z PeerTube

| Mechanizm | Przeczytane rozwiązanie PeerTube | Wniosek i ograniczenie |
|---|---|---|
| Potwierdzenie | ConfirmComponent używa NgbModal, wspólnego ConfirmService i opcjonalnego wymaganego tekstu/hasła; closes przed emisją wyniku | Warto centralizować politykę dialogów i testować wspólnie. Brak równoważnego pending-state i runtime; nie twierdzimy, że przechodzi nasz przypadek R35 |
| Zgłoszenie | Wspólny template raportów, native checkbox dla wielu powodów, pola formularza i błędy walidacji role=alert | Natywne kontrolki zmniejszają ilość własnej obsługi klawiatury. Wiele checkboxów ma inną semantykę niż pojedynczy radio wybór Polutka |
| Zamknięcie zgłoszenia | CommentReportComponent otwiera modal z keyboard:false | To konkretny kontrargument wobec automatycznej przewagi PeerTube: nie mamy podstaw, by obiecywać tam zamknięcie Escape. Polutek w próbie je obsłużył |
| Błąd zgłoszenia | Sukces zamyka okno, błąd idzie do Notifier | Sam template/handler nie dowodzi wszystkich ogłoszeń SR, retencji notatki lub poprawności fokusu; PeerTube nie uruchamiano |
| Lokalizacja | Weblate, XLIFF/$localize i osobne zbiory client/player/server/server-internal | Dobry wzorzec procesu translatorskiego i rozdzielania domen treści. Nie jest dowodem, że wszystkie języki są kompletne i lepsze językowo od Polutka |
| Język filmu | Przeczytany SelectLanguages wybiera języki treści z serwera | Nie jest przełącznikiem języka UI. Nie użyto go jako fałszywego odpowiednika LanguageSwitcher |

[Osiem źródeł i hashe](../evidence/batch13-review.json). Porównanie dotyczy wzorców i granic konkretnych komponentów. Nie przeprowadzono równych testów przeglądarkowych obu platform, oceny całego UX PeerTube ani kopiowania implementacji.

## Oficjalne wzorce i historia harnessu

Pobrano online W3C ARIA Authoring Practices: [modal dialog](../sources/apg-modal-dialog.html), [radio group](../sources/apg-radio-group.html), [listbox](../sources/apg-listbox.html), wszystkie HTTP 200; [URL/SHA256](../sources/fetch-ux-batch13.json), [W3C Software and Document License](../sources/aria-practices-LICENSE.md). Autorzy W3C i współtwórcy; kopie niezmienione. APG opisuje wzorce interakcji i nie jest samodzielnym certyfikatem zgodności z normatywnym [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Pierwsze dwa starty własnej strony badawczej nie miały poprawnego zastąpienia process.env; zachowano [initial log](../evidence/ux-browser-initial.log), [diagnostic log](../evidence/ux-browser-diagnostic.log) i [startup JSON](../evidence/ux-browser-startup-failure.json). Następna korekta metadanych obsłużyła wirtualny moduł esbuild, [log błędu](../evidence/ux-browser-build-failure.log). To błędy konfiguracji harnessu, nie aplikacji.

Pierwsze kontrole fokusu odczytywały stan natychmiast po klawiszu i weszły w odroczone przekierowanie strażników Base UI: [log pierwszej kontroli](../evidence/ux-browser-focus-initial.log), [szybki przebieg/log](../evidence/ux-browser-focus-fast.json) oraz [log](../evidence/ux-browser-focus-fast.log). Zweryfikowano mechanizm i zmieniono pomiar na dwie klatki; [finalny snapshot](../evidence/ux-browser-focus-diagnostic.json) nie osiąga tła. **Nie zarejestrowano podatności Base UI na podstawie przejściowego pomiaru.** Własny ConfirmDialog nadal wypuszcza fokus po ustaleniu stanu. Finalny pełny przebieg harnessu ma exit 0 i 14 obserwacji; kod produktu nie zmieniał się.

## Co pozostaje otwarte

Zapis partii domknięto 2 listopada po przerwie spowodowanej limitem usługi automatycznej kontroli zgód. Wcześniejsze polecenie walidacji nie zostało wykonane; po odnowieniu limitu wykonano tę samą zatwierdzaną kontrolę, bez ponawiania Chromium/testów. [Metadane przerwy](../evidence/approval-review-interruption-batch13.json).

15 pozycji w [WCAG-POKRYCIE.csv](../WCAG-POKRYCIE.csv) to początkowy zakres wybranych kryteriów, wszystkie W_TRAKCIE i bez pełnego werdyktu. Nie jest to kompletna lista WCAG 2.2 AA. Potrzebne są rzeczywiste zadania z użytkownikami, screen reader, Safari/Firefox/mobile/touch, zoom, całe reflow i kontrasty, player z napisami, błędy sieci, pełne osiem języków oraz niezależny przegląd R35. R20 wymaga świadomej decyzji na podstawie wpływu produktu.

Następny obszar: **D16 — monitoring i incydenty**, czyli czy operator zauważy niesprawne odtwarzanie, kolejkę, bazę i płatności oraz otrzyma użyteczny alarm.
