# Źródła zewnętrzne programu

Sprawdzone online 1 listopada 2026 przez pobranie z oficjalnych repozytoriów. Wyniki HTTP/curl: `sources/fetch.json` oraz `sources/fetch-additional.json`. Pliki robocze na gałęziach mogą się później zmienić; kopie i hashe w archiwum dokumentują materiał przeczytany teraz.

| Źródło | Co sprawdzono | Jak używamy |
|---|---|---|
| [OWASP ASVS](https://github.com/OWASP/ASVS) | README i [CSV wydania v5.0.0](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.csv), 345 wymagań | Numerowany rejestr wymagań bezpieczeństwa; wszystkie na razie do kwalifikacji/oceny |
| [OWASP WSTG v4.2](https://github.com/OWASP/wstg/tree/v4.2) | README projektu i spis treści stabilnej wersji | Metody testowania, przeglądu źródeł, modelowania zagrożeń i raportowania |
| [W3C WCAG](https://github.com/w3c/wcag) | README, organizacja kryteriów i rozróżnienie materiałów roboczych/publikowanych | Propozycja oceny według [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/); nie deklaracja zgodności |
| [GoogleChrome/web-vitals](https://github.com/GoogleChrome/web-vitals) | README, LCP/INP/CLS i pomiary realnych użytkowników | Metryki strony obok oddzielnych metryk odtwarzania filmu |
| [SLSA](https://github.com/slsa-framework/slsa) | Oficjalny README, cel i rozróżnienie draft/released specs | Pochodzenie i integralność artefaktów budowy; wersję szczegółowego profilu dobierzemy w D17 |
| [PeerTube tests, przypięty commit](https://github.com/Chocobozzz/PeerTube/blob/fa7d2b5d8a44bbec99159b11e91763f7d2308faa/support/doc/development/tests.md) | Przygotowanie usług i uruchamianie testów | Zaplanowanie rzeczywistego porównania runtime |

Pobrano też README [OWASP SAMM](https://github.com/owaspsamm/core), ale nie przeanalizowano modelu. Nie opieramy na tym formalnej oceny dojrzałości SAMM. Nieudane pobrania dwóch zgadywanych ścieżek (PeerTube architecture i SAMM model, 404) są jawne w logach; nie traktujemy ich jako przeczytanych materiałów. Dla testów PeerTube użyto następnie prawidłowej ścieżki przypiętej do SHA.

ASVS i WSTG wskazują CC BY-SA 4.0 w swoich README. Zachowano oryginalne kopie źródeł i atrybucję. `ASVS-POKRYCIE.csv` jest rejestrem metadanych i statusów odnoszących się do ASVS 5.0.0, nie nowym standardem ani listą zaliczonych wymagań. Pozostałe materiały zachowują licencje swoich projektów; patrz ich oficjalne repozytoria.

Partia 02: pobrano online i przeczytano konkretne metody WSTG v4.2: [ATHZ-04 — IDOR](sources/wstg-v42-idor.md), [SESS-06 — wylogowanie](sources/wstg-v42-logout.md) i [ATHN-03 — blokady prób](sources/wstg-v42-lockout.md). [Adresy, HTTP 200 i hashe](sources/fetch-identity-authz.json). Służą do budowy przypadków między kontami, replay sesji i awarii liczników; nie dowodzą wykonania tych procedur. Źródła OWASP zachowano bez zmian, z oryginalnymi tytułami i identyfikatorami.

Z lokalnego klonu przypiętego PeerTube przeczytano wybrane fragmenty routera aktualizacji, kontroli dostępu filmu/kanału oraz testów cudzego filmu, współpracowników, OAuth i 2FA. [Wykaz](evidence/identity-authz-review.json), linki do linii w raportach D03/D04. Nie uruchomiono PeerTube i nie twierdzimy, że samo istnienie testu oznacza jego zaliczenie w tej sesji.

Partia 03: oficjalna [dokumentacja Better Auth v1.7.7](https://github.com/better-auth/better-auth/blob/v1.7.7/docs/content/docs/concepts/session-management.mdx), czyli dokładnie zainstalowanej wersji. Przeczytano fragmenty wygaśnięcia/odświeżania i cookie cache/cofnięcia, nie cały dokument. [Kopia](sources/better-auth-1.7.7-session-management.mdx), [nota MIT](sources/better-auth-1.7.7-LICENSE.txt) i [log pobrania z hashami](sources/fetch-session-batch03.json). Ścieżka LICENSE zwróciła 404; poprawna LICENSE.md zwróciła 200. Dokumentacja wprost opisuje opóźnione cofnięcie przy cache i nie stanowi dowodu błędu biblioteki. Jej zalecenia nie zastępują własnego profilu ryzyka.

Rozszerzono przegląd PeerTube o odczyt/revoke tokenu, TokensCache, rozsyłanie unieważnień Redis i hooki modeli. Linki i wnioski są w D03, [wykaz źródeł](evidence/batch03-review.json). Nie uruchomiono tych mechanizmów i nie oceniono ich odporności na awarie.

Partia 04: wskazane fragmenty routera blokad filmów, modułu video-blacklist i testów zgłoszeń w przypiętym klonie PeerTube. Linki w D11, [zakres](evidence/batch04-review.json). Porównanie dotyczy kontroli uprawnień i organizacji testów. Nie ustalono porównywalnego mechanizmu odwołania po cyklu decyzji; nie przypisujemy PeerTube odporności na R25 bez dowodu.

Partia 05: oficjalna [dokumentacja MVCC PostgreSQL 17](https://github.com/postgres/postgres/blob/REL_17_STABLE/doc/src/sgml/mvcc.sgml), [kopia](sources/postgresql-17-mvcc.sgml), [COPYRIGHT](sources/postgresql-17-COPYRIGHT.txt) i [log pobrania/hash](sources/fetch-postgresql-batch05.json), HTTP 200. Przeczytano fragmenty READ COMMITTED i ponowień po błędach serializacji; nie cały rozdział. Źródło jest gałęzią dokumentacji 17 i może się przesuwać, więc kopia/hash stanowią dowód odczytanej wersji; nie deklarujemy tożsamości z commitem binariów serwera 17.11.

W PeerTube przejrzano wybrane fragmenty database-utils/database-transaction i tworzenia playlisty; [wykaz](evidence/batch05-review.json). Helpery do izolacji/retry są punktem odniesienia, ale nie potwierdzono odpowiednika limitu 100 ani odporności na R26/R27. Nie uruchomiono PeerTube i nie skopiowano implementacji.

Partia 06: rozszerzono przegląd przypiętej kopii PeerTube o cykl complete w AbstractJobHandler, lokalną mapę pending-completions oraz callback Studio przed nieodwracalnymi zmianami. [Cztery ścieżki i hashe](evidence/batch06-review.json), [porównanie i ograniczenia](obszary/D08-UPLOAD-KODOWANIE-I-USUWANIE.md). Są to źródła wzorca faz zakończenia, bez testu równoważnych awarii audytu/usuwania i bez dowodu odporności na wszystkie podziały sieci. Nie kopiowano implementacji ani nie uruchamiano PeerTube.
