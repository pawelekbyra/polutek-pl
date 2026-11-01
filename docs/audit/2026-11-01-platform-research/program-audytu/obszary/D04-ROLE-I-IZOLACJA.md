# D04 — role i izolacja twórców

1 listopada 2026, partia 02. **W_TRAKCIE.** SHA Polutka: `c397b9e548ca2c628e21457ac69d66e54b12ddbd`. Zakres tej partii: rdzeń uprawnień, kontekst Studia, wybrane ścieżki filmów/uploadu i przekazanie kanału do automatycznej publikacji. Nie zakończono przeglądu wszystkich 279 wejść systemu.

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

## Co warto przejąć z PeerTube

[Router aktualizacji](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/controllers/api/videos/update.ts) łączy authenticate z walidatorem, który [wiąże uprawnienia z rzeczywistym filmem](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/middlewares/validators/shared/videos.ts#L312) i [kanałem/współpracownikiem](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/server/core/middlewares/validators/shared/video-channels.ts#L42). Polutek ma analogiczny zamiar w use case'ach; nie ma powodu kopiować frameworka Express do Next.

Konkretny wzorzec do przejęcia to [test edycji i usuwania cudzego filmu](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/api/check-params/videos.ts#L899) oraz [testy współpracowników](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/packages/tests/src/api/check-params/channel-collaborators.ts). Używają kont i rzeczywistych żądań. W tej wersji PeerTube też ma współpracowników; twierdzenie, że tylko Polutek ma obsługę wspólnego kanału, byłoby nieprawdziwe. Nie porównano jeszcze pełnej szczegółowości ról ani działania ich wdrożeń.

OWASP [WSTG v4.2 ATHZ-04](../sources/wstg-v42-idor.md), pobrane online, zaleca mapowanie każdego odwołania do zasobu oraz co najmniej dwa konta o różnych własnościach/uprawnieniach. Zapisano [macierz dalszych prób](../SCENARIUSZE-D03-D04.csv); wszystkie pełne próby HTTP pozostają niewykonane.

Do zamknięcia D04: wszystkie wejścia i pola, role panelu i języki tłumacza, członkostwo/invites/transfer własności, playlisty, komentarze/bany/odwołania, podgląd i tokeny wideo, eksporty i finanse, Server Actions i systemowe crony/workery, cofnięcie uprawnień w trakcie operacji oraz ujemne testy międzykanałowe. Nie uznajemy obecności słowa `authorize` za zaliczenie trasy.
