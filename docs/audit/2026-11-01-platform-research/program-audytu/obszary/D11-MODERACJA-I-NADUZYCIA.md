# D11 — moderacja, blokady i odwołania

1 listopada 2026, partia 04. **W_TRAKCIE.** Kod Polutka: `c397b9e548ca2c628e21457ac69d66e54b12ddbd`. Przegląd dotyczy wybranych ścieżek komentarzy, banów, decyzji i odwołań. Nie obejmuje jeszcze całego spamu, raportowania, kosztu ataku ani rzeczywistej pracy zespołu moderacji.

## Wniosek dla właściciela

Polutek ma dobre elementy projektu: uprawnienia do moderacji wynikają z kanału komentarza, prywatne uzasadnienia są odseparowane od odpowiedzi dla twórcy, a zawieszony właściciel nadal może się odwołać. To potrzebne funkcje profesjonalnej platformy.

Znaleziono jednak **R25: rozpatrzenie starego odwołania może cofnąć nowsze, niezależne ograniczenie**. Kod sprawdza obecną wartość statusu, ale nie tożsamość decyzji, która ten status ustawiła. Problem odtworzono na rzeczywistej funkcji z atrapą bazy dla kanału i filmu. Nie wymaga dwóch zapisów w tej samej milisekundzie; wystarczy zwykła historia kolejnych decyzji. Potrzebna jest też uprawniona osoba, która uwzględni stare odwołanie — nie jest to samoobsługowe obejście bana przez twórcę.

## Co sprawdzono w granicach dostępu

[authorizeComments](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/comments/application/authorize-comments.ts) ładuje kanał każdego komentarza i sprawdza odpowiednią akcję; jeden pozytywny komentarz nie uprawnia do reszty paczki. `scopeToChannel` ogranicza listy. [Studio](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/api/studio/comments/route.ts) przekazuje kanał rozpoznany z sesji zamiast przyjmować dowolny kanał z query. W [moderacji zbiorczej](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/comments/application/moderate-comments-bulk.use-case.ts#L60) autoryzacja całej listy jest przed transakcją. Eksperyment potwierdził odmowę helpera dla listy mieszającej własny i cudzy kanał. Nie wykonano nim całej mutacji zbiorczej ani testu cofnięcia członkostwa w trakcie jej zapisu.

[Bany kanałowe](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/comments/application/channel-ban.use-cases.ts) wymagają `comment.moderate`, nie pozwalają blokować siebie, właściciela, członka kanału ani administratora platformy. Obiekt blokady wiąże kanał i użytkownika. To zakaz pisania komentarzy, a nie zakaz oglądania filmu. [Guard pisania](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/comments/application/comment-write-guard.ts) zwraca ogólny komunikat bez prywatnego powodu bana; wygasła blokada przestaje działać. Wywołania w tworzeniu komentarza przejrzano, ale nie wykonano pełnego dodania/edycji/odpowiedzi przez HTTP.

[Odwołania](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/channel/application/moderation-appeals.use-cases.ts) pozwalają OWNER/MANAGER działać mimo zawieszenia. Status kanału jest celowo pominięty przy tej jednej decyzji o dostępie, co chroni prawo do zakwestionowania zawieszenia. Cudze decisionId daje taką samą odmowę jak brak decyzji. Twórca dostaje jawnie zbudowane DTO z reasonPublic; reasonInternal, konto operatora i raport nie są kopiowane do tego wyniku.

Tworzenie odwołania sprawdza termin i długość tekstu oraz istniejące odwołanie. W transakcji używa blokady doradczej dla decisionId, gdy klient DB udostępnia `$executeRaw`. Rozstrzygnięcie jest tylko dla personelu, wymaga publicznego uzasadnienia i warunkowo zmienia PENDING. Powstaje nowa decyzja wyniku; stara nie jest przepisywana. W tej partii nie zweryfikowano skuteczności triggera niemodyfikowalności, blokad PostgreSQL i wysyłki powiadomień. Same nazwy i komentarze odnoszące się do DSA nie potwierdzają zgodności prawnej całej usługi.

## R25 — stara decyzja i nowy, taki sam status

[revertDecisionEffect](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/channel/application/moderation-appeals.use-cases.ts#L289) jest wywoływane przy uwzględnieniu odwołania. Odczytuje status celu, porównuje z wartością ze starej decyzji i wykonuje `updateMany` warunkowy na tej wartości. Nie sprawdza, czy pomiędzy decyzją a odwołaniem powstała nowa decyzja dla tego celu. To znany rodzaj pomyłki przy porównywaniu samej wartości: stan wraca do wcześniejszej wartości, choć oznacza już nowe zdarzenie.

Przykład filmu:

1. Decyzja A usuwa film przez moderację (`REMOVED`); twórca odwołuje się od A.
2. Kolejna decyzja przywraca film (`VISIBLE`).
3. Decyzja B ponownie usuwa film z innego powodu (`REMOVED`).
4. Operator uznaje odwołanie od A. Kod widzi REMOVED zgodne z A i ustawia VISIBLE, mimo że obecna blokada pochodzi już z B.

Analogicznie dla kanału: SUSPENDED → ACTIVE → SUSPENDED. [Zmiana statusu kanału](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/channel/application/channel-moderation.use-cases.ts#L142) i [moderacja filmu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/channel/application/channel-moderation.use-cases.ts#L432) dopuszczają te przejścia po zmianie wartości; nie ma tam blokady całej dalszej moderacji podczas oczekiwania odwołania. Kanału głównego nie można zawiesić, ale ograniczenie to nie eliminuje przypadku filmu ani innych kanałów.

**Dowód:** [skrypt](../tools/moderation-boundaries-experiment.cjs) uruchamia rzeczywistą funkcję `resolveModerationAppeal`, rzeczywiste authorize/policy i wewnętrzny kod cofania. Jawna atrapa bazy przestrzega filtrów statusu w updateMany; nie zwraca z góry count=0. Historia fixture zawiera wcześniejszą decyzję, przywrócenie i nową decyzję; kod cofania tej historii nie pyta. Audyt i powiadomienia są atrapami. [Wynik](../evidence/moderation-boundaries-experiment.json) obejmuje sześć prób:

| Historia celu | Kanał po uwzględnieniu starego odwołania | Film po uwzględnieniu starego odwołania |
|---|---|---|
| Tylko pierwotne ograniczenie | ACTIVE — oczekiwane | VISIBLE — oczekiwane |
| Późniejszy status ma inną wartość | BANNED pozostaje — oczekiwane | LIMITED pozostaje — oczekiwane |
| Późniejsze, niezależne ograniczenie wraca do tej samej wartości | **ACTIVE; nowe zawieszenie cofnięte** | **VISIBLE; nowe usunięcie cofnięte** |

W obu problematycznych próbach funkcja zwraca `reverted:true`. Kontrole z inną wartością statusu potwierdzają, że istniejący warunek pomaga, lecz nie rozpoznaje nowej decyzji o tym samym skutku. Problem nie polega na braku transakcji: transakcja może poprawnie i atomowo zapisać niepoprawną decyzję biznesową.

[Istniejący test W03](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/tests/unit/modules/channel/moderation-appeals.test.ts#L123) symuluje nowszą decyzję, każąc atrapie updateMany zwrócić count=0. Nie odtwarza cyklu statusu ani faktycznego dopasowania warunku. Nie powtarzano tego testu w zablokowanym środowisku Prisma i nie zmieniono jego wcześniejszego wyniku.

**Priorytet P1 przed szerszym użyciem moderacji.** Konsekwencja: odwołanie od innego zdarzenia może przywrócić treść albo uprawnienia kanału objęte nowszym ograniczeniem. Nie wykazano, że przypadek wystąpił na produkcji. Wymaga historii kilku decyzji i uwzględnienia starego odwołania przez personel. Uważny operator może dostrzec tę historię, ale badany kod nie wymusza jej sprawdzenia.

Kierunek poprawy: identyfikować aktualnie obowiązującą decyzję lub wersję stanu, a nie tylko nazwę statusu. Sprawdzenie i cofnięcie muszą być spójne z równoległymi zmianami; sam dodatkowy SELECT poza blokadą może dodać kolejny wyścig. Możliwe zachowanie to rozstrzygnięcie odwołania od A bez automatycznego cofnięcia B i z jasnym komunikatem dla operatora. Nie wykonano poprawki.

Test odbioru: prawdziwa DB i oba typy celów; pierwotne ograniczenie, późniejszy inny status oraz dwa różne zdarzenia nadające ten sam status, także równolegle z rozstrzyganiem. Uwzględnienie A nie usuwa B, legalne cofnięcie A działa, ponowne rozstrzygnięcie nie wykonuje kolejnego skutku, a historia decyzji i ślad audytu pozostają spójne.

## Bilans 26 obserwacji i granice tej partii

Eksperyment ma 6 prób skutku rozstrzygnięcia, 4 granic odwołań/DTO, 2 helpera komentarzy, 8 banów/guardów oraz 6 przydziałów języków opisanych w [D04](D04-ROLE-I-IZOLACJA.md). To 26 obserwacji, nie 26 nowych testów Vitest ani 26 potwierdzonych luk. Dwie obserwacje reprodukują ten sam R25; pozostałe są kontrolami i przykładami poprawnych granic.

Brak rzeczywistego HTTP, dispatchu Server Actions, PostgreSQL i wykonania audytu/powiadomień. Pełne polityki spamu, moderacja raportów, masowe operacje, odzyskiwanie po awarii, retencja, raporty przejrzystości i praca zespołu nadal wymagają badania. Otwarte są też kalendarzowy koniec sześciomiesięcznego terminu, usunięty kanał w wejściu Studia oraz zmiana członkostwa pomiędzy sprawdzeniem a zapisem — bez nadawania im statusu dowiedzionych usterek.

## PeerTube jako punkt odniesienia

[Router blokowania filmów](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/controllers/api/videos/blacklist.ts#L28) wymaga uwierzytelnienia i osobnego `MANAGE_VIDEO_BLACKLIST`. [Kod listy blokad](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/lib/video-blacklist.ts) i [testy zgłoszeń](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/api/moderation/abuses.ts) są odniesieniem dla rozdzielenia uprawnień, audytu, komunikacji i testów HTTP. Przeczytano tylko wskazane fragmenty, nie uruchomiono PeerTube. Nie ustalono w tej partii odpowiednika całego mechanizmu odwołań Polutka ani jego odporności na powyższy przypadek; nie wolno twierdzić, że PeerTube automatycznie rozwiązuje R25.

Wniosek projektowy do zachowania: centralna kontrola roli i niezmienny dziennik decyzji są dobrym początkiem. Potrzebne jest również powiązanie aktualnego skutku z konkretną decyzją i testowanie historii kilku zdarzeń, a nie wyłącznie pojedynczych kliknięć.
