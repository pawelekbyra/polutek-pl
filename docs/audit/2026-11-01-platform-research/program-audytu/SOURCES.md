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
