# D04 — role i izolacja twórców

1 listopada 2026, partie 02–04. **W_TRAKCIE.** SHA Polutka: `c397b9e548ca2c628e21457ac69d66e54b12ddbd`. Zakres: rdzeń uprawnień, Studio, wybrane filmy/upload, autopublikacja, playlisty i stan/anulowanie kodowania, a następnie granice moderacji i języki panelu. Nie zakończono przeglądu wszystkich 279 wejść systemu.

## Wniosek dla właściciela

System ról Polutka jest czymś więcej niż ukrywaniem przycisków. Ma centralne reguły po stronie serwera, pięć ról kanałowych i kontrole, do którego kanału należy film. W przeczytanych ścieżkach nie potwierdzono przejęcia cudzego kanału. Z samego tego wyniku nie wynika bezpieczeństwo całej platformy.

Znaleziono **R23: utratę kontekstu kanału przy automatycznej publikacji po kodowaniu**. W kontrolowanym wywołaniu rzeczywistego kodu film innego twórcy zostaje pominięty, choć finalizer zwraca sukces i nie zapisuje błędu automatycznej publikacji. To problem kompletności platformy wielu twórców, nie dowód ujawnienia cudzych danych. Obecny serwis jednego głównego kanału może go nie ujawniać.

## Co oznaczają role

[Macierz](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/authz/domain/matrix.ts) obejmuje 33 nazwane akcje, a [polityka](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/authz/domain/policy.ts) rozróżnia zwykłego członka, gościa, personel i system.

| Rola kanałowa | Przykładowe możliwości | Przykładowa odmowa |
|---|---|---|
| OWNER | Treści, członkowie, kanał, rozliczenia | Akcje platformowe |
| MANAGER | Treści, moderacja, profil kanału, podgląd wypłat | Zarządzanie członkami i kontem wypłat, usunięcie kanału |
| EDITOR | Treści, playlisty, analityka | Usunięcie filmu, moderacja komentarzy, wypłaty |
| MODERATOR | Moderacja komentarzy i podgląd filmu | Upload i publikacja |
| TRANSLATOR | Podgląd, napisy, tłumaczenia | Publikacja i wypłaty |

Nie są to role OWNER/TRANSLATOR osobnego panelu. To inny zbiór kont i uprawnień.

Zwykły użytkownik bez członkostwa nie dostaje dostępu do zasobów kanału; przed zakończeniem onboardingu nie może wykonywać akcji twórcy. SUSPENDED/BANNED/DELETED zamraża zwykłe działania członków, z wyjątkiem przywrócenia DELETED przez OWNER zgodnie z osobnym warunkiem. LIMITED blokuje wybrane działania, a nie wszystko. Personel ma szerokie uprawnienia, lecz nie może zmieniać członków kanału, ceny filmu i konta wypłat. Aktor `system` ma pełne uprawnienia — dlatego kluczowe jest, kto może go utworzyć i z jakim zadaniem.

## Jak ładowane są fakty do decyzji

[authorize](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/authz/application/authorize.ts) dla zwykłego użytkownika przyjmuje kanał, ID kanału albo ID filmu. Przy ID filmu ładuje jego kanał. Z bazy pobiera członkostwo wyłącznie pytającego użytkownika. Gdy otrzyma gotowy kanał bez `members`, uzupełnia członkostwo. Gdy wywołujący poda `members` jawnie, nawet pustą listę, ufa tym faktom. Taki obiekt musi pochodzić z serwera; dalszy przegląd musi wykluczyć zasilenie go niezweryfikowanym JSON-em użytkownika.

24 istniejące testy czystej polityki przeszły. Testy adaptera authorize i członkostw nie załadowały się z powodu Prisma. Dlatego wykonano także osobny [eksperyment](../evidence/identity-context-experiment.json): rzeczywiste authorize z rzeczywistą polityką, atrapą DB i 11 jawnie opisanymi przypadkami. Potwierdzono m.in. odmowę dla obcego kanału/filmu, gościa, niedokończonego onboardingu, edytora usuwającego film, administratora zmieniającego wypłaty i właściciela zawieszonego kanału. To dowód dla funkcji i danych eksperymentu, nie dla każdej trasy sieciowej.

## Studio i wybrane ścieżki filmu

Łańcuch wejścia: [withStudio](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/api/studio-route.ts) → [resolveStudioSession](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/api/studio-session.ts) → [listMyChannels](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/channel/application/channel-lifecycle.use-cases.ts#L441). Konto usunięte odpada. Lista kanałów jest pobierana przez członkostwo użytkownika, z dodatkowym fallbackiem po właścicielu dla dawnych danych. Studio zawsze działa jako user, nawet dla legacy ADMIN.

Wybór `?channel=<id>` jest ograniczony do tej listy. **Nieznany lub obcy identyfikator powoduje wybór pierwszego własnego kanału.** Eksperyment to odtworzył. Odrzucono interpretację „sam parametr daje dostęp do obcego kanału”. Pozostaje kwestia poprawności UX: przy kilku własnych kanałach błędny/stary wybór może skierować operację do innego własnego kanału. Należy zbadać mutacje profilu i tworzenie treści oraz ustalić, czy jawny niepoprawny wybór powinien kończyć się odmową. Nie udowodniono uszkodzenia rzeczywistych danych.

Prześledzone fragmenty:

- [Utworzenie](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video/application/create-admin-video.use-case.ts) sprawdza `video.create` dla kanału kontekstu. Trasa mapuje dozwolone pola, nie przyjmuje dowolnego creatorId/status.
- [Edycja](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video/application/update-admin-video.use-case.ts) i [usunięcie](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video/application/delete-admin-video.use-case.ts) wymagają odpowiedniej akcji, a następnie odrzucają film spoza kanału kontekstu.
- [Odczyt szczegółów](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video/application/get-admin-video-by-id.use-case.ts) wymaga `video.preview` i zapytania po filmie oraz kanale. Studio usuwa auditLogs z odpowiedzi. Nie oceniono jeszcze wszystkich pól diagnostyki pod kątem ujawnienia informacji.
- [Publikacja](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video/application/publish-admin-video.use-case.ts) używa `video.publish` i wyszukania po ID oraz creatorId. Nie zakończono analizy wszystkich przejść archive/unlist/unpublish ani zmian uprawnień w trakcie transakcji.
- [Guard uploadu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/video-guard.ts) najpierw wiąże film z kanałem, potem sprawdza akcję. [Operacje oryginału](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/original-upload.use-cases.ts#L49) wiążą `originalId` z `videoId`. [Enqueue](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/encode-queue.use-cases.ts#L85) również ogranicza oryginał do filmu i zapisuje channelId zadania. Ochrony przed pomieszaniem tych identyfikatorów wymagają jeszcze testu HTTP i sprawdzenia braku efektu w R2.

26 istniejących testów tras Studia przeszło. Sprawdzają m.in. mapowanie/odrzucanie pól i przekazywanie kontekstu. Zastępują resolver i use case'y atrapami; wynik nie potwierdza kontroli członkostwa w pełnym żądaniu. Podobnie niektóre testy nazwane BOLA same ustawiają odpowiedź atrapy `FORBIDDEN`. Nazwa testu nie jest dowodem scenariusza bezpieczeństwa.

## R23 — kanał ginie pomiędzy zadaniem a finalizacją

Źródła: [worker](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/scripts/video-worker.ts#L44), [finalizer](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/finalize-self-hls.ts#L28), [automatyczna publikacja](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video/application/publish-after-asset-ready.use-case.ts#L52), [wybór kanału](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/channel/application/main-channel.service.ts#L64), [repozytorium filmu](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video/infrastructure/video.repository.ts#L108).

1. Enqueue zapisuje kanał filmu w `VideoEncodeJob.channelId`.
2. Finalizer tworzy jeden kontekst `system` bez channelId; nie uzupełnia go na podstawie konkretnego zadania/filmu.
3. Automatyczna publikacja wybiera `MainChannelService.getRequired(ctx)`, więc przy takim kontekście otrzymuje kanał główny.
4. Szuka filmu przez `{id: videoId, creatorId: mainChannel.id}`. Dla innego twórcy dostaje null i wykonuje cichy return.
5. Finalizer zwraca assetId jako sukces. Samo to pominięcie nie ustawia `publishAfterAssetReadyError`.

**Dowód A/B:** [skrypt](../tools/identity-context-experiment.cjs) wykonuje niezmienione moduły finalizera, automatycznej publikacji, kontekstu, wyboru kanału, repozytoriów, wyboru assetu i blokad publikacji. I/O bazy, aktywacja route, zapis audytu i sam publikator są atrapami. Nie instalowano fałszywego klienta Prisma. [Wynik](../evidence/identity-context-experiment.json):

| Próba | Filtr zapytania | Wywołanie granicy publikatora |
|---|---|---|
| Zadanie kanału głównego | video-main + main | Tak |
| Identycznie gotowy film innego kanału | video-creator + **main** | Nie, bez zapisanego błędu |
| Kontrola: ten drugi film z jawnym ctx.channelId | video-creator + creator | Tak |

Kontrargument sprawdzony: film może być niegotowy albo mieć złe metadane. Oba przykładowe filmy mają gotową trasę SELF_HLS, tytuł, slug i ten sam stan; kontrola z poprawnym kontekstem dociera do publikatora. Wynik nie zależy od założonego błędu blokad publikacji. Nie wykonano prawdziwej publikacji w DB ani kodowania/R2; A/B opisuje wyizolowany eksperyment, nie pełny system.

**Priorytet P1 przed szerszym dopuszczeniem twórców**, nie awaria potwierdzona na obecnej produkcji. Proponowany kierunek: kontekst per zadanie wyznaczony z autorytatywnego powiązania filmu z kanałem, walidacja zgodności ze zleceniem i jawny wynik publikacji. Nie wystarczy bez sprawdzenia przekleić dowolnego ID z danych wejściowych. Trzeba też zachować ochronę przed utratą dzierżawy (R02), zawieszeniem/usunięciem kanału, zmianą filmu i retry.

Test odbioru po przyszłej poprawce: dwa różne kanały, PUBLIC i UNLISTED, rzeczywista kolejka/worker i DB; sukces obu legalnych publikacji, brak publikacji po zamrożeniu/usunięciu kanału, brak przejęcia przez cudze zadanie i poprawność powtórzeń. Zmiana nie została wykonana.

## Partia 03 — playlisty i zadania kodowania

Prześledzono wszystkie osiem jawnych metod w czterech plikach tras zarządzania playlistami: lista/utworzenie, szczegóły/edycja/usunięcie, dodanie/usunięcie filmu i kolejność. Wejście bierze `channelId` z rozwiązanego Studia, a [schemat JSON](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/api/studio-playlist-schemas.ts) dopuszcza wyłącznie jawne pola. Następnie [use case](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/playlists/application/playlist-manage.use-cases.ts) sprawdza uprawnienie do kanału, a [repozytorium](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/playlists/infrastructure/playlist.repository.ts) wyszukuje playlistę przez `id + channelId + deletedAt:null`. Dodawany film jest sprawdzany przez `id + creatorId`. Operacje na elementach są związane z rozwiązaną playlistą. Cudzy identyfikator nie zmienia kanału kontekstu.

Odczyty Studia używają `playlist.update`, więc MODERATOR/TRANSLATOR kanału nie widzi tych roboczych playlist. To konsekwencja obecnej macierzy, nie brak sprawdzenia. Ocenę publicznych playlist i ich pól należy zakończyć osobno; nie wynika ona z ochrony zapisów.

**Eksperyment:** [skrypt](../tools/resource-scope-experiment.cjs) uruchamia niezmienione authorize/policy, use case'y i repozytoria. Powtórnie używa atrapy bazy z istniejących testów repo oraz jawnej atrapy audytu. Nie zastępuje authorize z góry wybraną odpowiedzią FORBIDDEN. Każdy załadowany plik ma hash zgodny z bazowym inwentarzem. [Wynik](../evidence/resource-scope-experiment.json) zawiera 19 obserwacji: 12 playlist i 7 kolejki.

| Próba | Wynik w eksperymencie |
|---|---|
| Obcy właściciel edytuje/usuwa/dodaje/usuwa element/zmienia kolejność cudzej playlisty przez własny kanał | 404 i niezmieniony stan |
| Właściciel dodaje film obcego kanału do własnej playlisty | 404 i niezmieniony stan |
| Właściciel podmienia element kolejności na cudzy film | 409 i niezmieniony stan |
| Gość, obca osoba lub moderator edytuje playlistę | Odpowiednio 401/403 i niezmieniony stan |
| Legalny EDITOR zmienia kolejność własnej playlisty | Sukces; oczekiwana kolejność |
| Wstrzyknięty błąd w połowie zmiany kolejności | Atrapa transakcji odtwarza poprzedni stan |
| Własny videoId i cudzy jobId albo cudzy videoId/jobId | Anulowanie odrzucone 404; brak zmian zadań i audytu |
| MODERATOR anuluje zadanie własnego kanału | 403; brak zmian |
| Właściciel anuluje własne zadanie | Własne CANCELLED, obce pozostaje RUNNING |
| Odczyt stanu kodowania cudzego filmu / przez moderatora | 404 / 403 |
| Odczyt własnego filmu przez właściciela | Sukces dla fixture bez oryginału/assetów/historii |

To mocniejszy dowód niż samo znalezienie wywołania guarda: podmieniane są identyfikatory i sprawdzany jest brak zmiany stanu. Nadal jest to model I/O, nie prawdziwa baza ani kompletne HTTP Polutka. Rollback atrapy nie potwierdza poziomu izolacji PostgreSQL; pozytywny odczyt pustego pipeline nie potwierdza pełnego DTO dla wszystkich stanów i assetów. Liczba 19 nie powiększa liczby zaliczonych testów Vitest.

[cancelEncode](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/application/encode-queue.use-cases.ts#L113) przechodzi przez requireVideo, a [repozytorium](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/video-pipeline/infrastructure/encode-job.repository.ts#L247) wiąże jobId z videoId. `getPipelineState` sprawdza kanał filmu i `video.update`, zanim pobierze stan. [Trasa Studia](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/app/api/studio/videos/%5Bid%5D/pipeline/route.ts) usuwa część wewnętrznych ID i kluczy storage z odpowiedzi. Przegląd nie potwierdza jeszcze, czy wszystkie zagnieżdżone pola mają właściwy zakres ujawnienia.

**Otwarte kwestie, bez nowego potwierdzonego znaleziska:** playlistowy lock bierze ID przed `findInChannel`, więc trzeba ocenić zakres blokowania obcego wiersza; limit liczby playlist jest sprawdzany przez COUNT bez widocznego wspólnego locka kanału; uprawnienia są sprawdzane przed wejściem w transakcję. Nie wywołano jeszcze rzeczywistego przeciążenia, przekroczenia quota ani cofnięcia członkostwa w środku transakcji. Te pytania należą także do D06/D07/D14. Nie należy zmieniać ich w dowiedzione obejście uprawnień bez sprawdzenia osiągalności i uzgodnionej granicy operacji.

R24 z [D03](D03-TOZSAMOSC-I-SESJE.md) dotyczy rozpoznania tożsamości na wejściu. Poprawne ograniczenie zasobu nie zastępuje cofnięcia sesji: urządzenie rozpoznane z cache nadal może działać z aktualnie zachowaną rolą. Odebranie członkostwa i cofnięcie sesji są osobnymi zdarzeniami do zbadania.

## Partia 04 — moderator, odwołania i tłumacz panelu

W [D11](D11-MODERACJA-I-NADUZYCIA.md) zapisano szczegóły moderacji, banów i R25: cofnięcia nowszego ograniczenia przez stare odwołanie po cyklu statusu. Użycie cudzego ID decyzji i listy mieszającej komentarze własnego/obcego kanału zostało odrzucone w izolowanym eksperymencie. Zawieszony właściciel nadal może utworzyć odwołanie, a wynik dla twórcy pomija reasonInternal. Nie jest to pełne zaliczenie wszystkich ścieżek moderacji.

**Uprawnienia tłumacza panelu mają łańcuch serwerowy:** [requireAdmin](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/lib/auth/guard.ts) → [openGate](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/lib/actions/gate.ts) → [panelContext](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/lib/actions/panel.ts#L19) → [saveFilmTranslation](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/lib/modules/translations/application/translations.ts#L76). Tłumacz dostaje allowedLanguages z wierszy AdminLanguageGrant; użytkownik nie przekazuje tej listy w FormData. Przełącznik roli w interfejsie nie jest tu jedynym zabezpieczeniem.

W [akcjach tłumaczeń](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/app/%28panel%29/tresci/translation-actions.ts) zapis jawnie dopuszcza OWNER/TRANSLATOR, a zatwierdzanie i generowanie AI pozostają przy domyślnym OWNER. Funkcja zapisu sprawdza język; zatwierdzanie odmawia przy obecnym allowedLanguages, również przy pustej tablicy. Pusta tablica nie oznacza pełnych uprawnień.

Sześć prób w [eksperymencie](../evidence/moderation-boundaries-experiment.json): translator z DE może zapisać DE; zapis FR i zapis DE przy pustych grantach są odrzucone bez zapisu. Translator z DE lub z pustymi grantami nie zatwierdza szkiców; właściciel bez ograniczenia językowego może zatwierdzić. To wywołania rzeczywistych funkcji ze zbudowanym kontekstem i atrapą DB. Nie sprawdzają kryptografii Access, pobrania grantów, aktualizacji roli w trakcie żądania ani prawdziwego dispatchu Server Actions.

Strona tłumacza filtruje wyświetlane języki, a moduł odczytuje film w kanale kontekstu. Helper `setTranslationSubtitle` nie ma własnej kontroli języka. Nie uznano tego automatycznie za obejście: przejrzany [upload napisów](https://github.com/pawelekbyra/polutek-pl/blob/c397b9e548ca2c628e21457ac69d66e54b12ddbd/apps/admin/app/api/videos/%5Bid%5D/subtitles/%5Blang%5D/route.ts) używa panelRouteContext → adminFromRequest z domyślnym OWNER. Potrzebny jest jeszcze pełny test bezpośrednich żądań i pozostałych wywołujących, a przy przyszłym udostępnieniu napisów tłumaczom konieczna będzie ocena tej granicy.

**Istotna zależność architektoniczna:** allowedLanguages nieobecne oznacza w module brak ograniczeń, a aktor panelu OWNER i TRANSLATOR ma ten sam typ admin. Część kontroli jest więc w gate i poprawnym tworzeniu kontekstu, nie w samym typie aktora. Nie wykazano osiągalnego obejścia istniejącego wejścia HTTP, ale nowe wejście nie może pomijać tego łańcucha. Osobno trzeba sprawdzić wszystkie akcje, odczyty, napisy i generowanie AI po cofnięciu grantów.

## Co warto przejąć z PeerTube

[Router aktualizacji](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/controllers/api/videos/update.ts) łączy authenticate z walidatorem, który [wiąże uprawnienia z rzeczywistym filmem](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/middlewares/validators/shared/videos.ts#L312) i [kanałem/współpracownikiem](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/middlewares/validators/shared/video-channels.ts#L42). Polutek ma analogiczny zamiar w use case'ach; nie ma powodu kopiować frameworka Express do Next.

Konkretny wzorzec do przejęcia to [test edycji i usuwania cudzego filmu](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/api/check-params/videos.ts#L899) oraz [testy współpracowników](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/api/check-params/channel-collaborators.ts). Używają kont i rzeczywistych żądań. W tej wersji PeerTube też ma współpracowników; twierdzenie, że tylko Polutek ma obsługę wspólnego kanału, byłoby nieprawdziwe. Nie porównano jeszcze pełnej szczegółowości ról ani działania ich wdrożeń.

OWASP [WSTG v4.2 ATHZ-04](../sources/wstg-v42-idor.md), pobrane online, zaleca mapowanie każdego odwołania do zasobu oraz co najmniej dwa konta o różnych własnościach/uprawnieniach. Zapisano [macierz dalszych prób](../SCENARIUSZE-D03-D04.csv); wszystkie pełne próby HTTP pozostają niewykonane.

Do zamknięcia D04: wszystkie wejścia i pola, role panelu i języki tłumacza, członkostwo/invites/transfer własności, playlisty, komentarze/bany/odwołania, podgląd i tokeny wideo, eksporty i finanse, Server Actions i systemowe crony/workery, cofnięcie uprawnień w trakcie operacji oraz ujemne testy międzykanałowe. Nie uznajemy obecności słowa `authorize` za zaliczenie trasy.

## Uzupełnienie: partia 07

[D09](D09-ODTWARZANIE-TOKENY-I-CACHE.md) dodaje R30: rzeczywisty checkVideoAccess odmawia NOT_FOUND, lecz późniejsza bramka premiery pozostawia tytuł/poster ukrytego filmu, a obcemu zalogowanemu także termin. Źródło, napisy, token i sesja pozostają zablokowane. Sprawdzono też pięć granic ponownego użycia sesji odtwarzania: cudzy użytkownik, film lub fingerprint gościa dostają nową sesję zamiast cudzej. Jawna atrapa DB; brak pełnego HTTP/Prisma. Nie zmienia to otwartych granic pozostałych zasobów D04.
