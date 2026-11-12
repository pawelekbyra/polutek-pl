# K05 — profil produktu i bramki decyzyjne

Stan: **częściowo opracowane; odbiór K05 otwarty**. Data przeglądu źródeł: 7 listopada 2026. Ten dokument zestawia zapisane decyzje właściciela z kodem bieżącej gałęzi. Nie potwierdza konfiguracji produkcji ani działania runtime.

## Profil wynikający z zapisanych decyzji

Najnowszy zapis właściciela w [`docs/operations/STATUS.md`](../../../operations/STATUS.md), z 5 listopada, mówi: produkt jest obecnie niekomercyjny; napiwek nie odblokowuje treści; CTA napiwku jest przeznaczone dla widza z aktywnym Premium; etap nie obejmuje sprzedaży za pieniądze. Odrębny zapis mówi o dwóch poziomach dostępu: publicznym i po zalogowaniu. To jest profil decyzyjny, nie dowód, że kod i konfiguracja serwera już go wymuszają.

| Obszar | Oczekiwany wynik dla widza | Oczekiwany wynik dla twórcy | Oczekiwany wynik dla administratora | Sterowanie / ograniczenie |
|---|---|---|---|---|
| Oglądanie | Filmy publiczne są dostępne bez konta; filmy oznaczone jako wymagające logowania wymagają konta. | Publikuje w ramach kanału i uprawnień; brak obietnicy udziału w przychodzie. | Zarządza przez osobną aplikację administracyjną i nadane uprawnienia. | `Video.accessTier`; role i stan publikacji. Nie ma jednej globalnej flagi widoczności. Runtime do odbioru. |
| Kanały twórców | Widzi publiczne strony kanałów i treści dozwolone przez ich stan. | Zarządza swoim kanałem w ramach członkostwa i ról. | Obsługuje zgłoszenia i kanały w panelu. | `PLATFORM_GATE_CHANNEL_CREATION` (`off`/`invite`/`on`); kod przyjmuje brak lub nieznaną wartość jako `off`. Wartość produkcyjna niepotwierdzona. |
| Napiwek | Może dobrowolnie wesprzeć; wpłata nie zmienia dostępu do filmu. | W tym profilu nie ma obiecanej wypłaty ani publicznej odznaki. | Prywatna ewidencja wpłat i wspierających. | `TIP_GATE_ENABLED` steruje UI; aktualnie `true`. Ścieżka API płatności ma osobne sterowanie i nie wolno utożsamiać ukrycia UI z blokadą serwera. Odbiór ścieżki nadal wymagany. |
| Premium / płatny dostęp | Zapis z 5 listopada nie przewiduje sprzedaży na obecnym etapie. | Brak obietnicy przychodu z tego produktu. | Nie aktywować sprzedaży jako wniosku z samej obecności kodu. | Kod ma `PREMIUM_PASS_EXPERIMENT` i `PREMIUM_PASS_PAYMENTS`; tryb płatności domyślny w kodzie to demo. Konflikt z opisami Premium jako produktu końcowego w `CLAUDE.md` i `docs/architecture/patron-zone.md`; bieżąca konfiguracja produkcji niepotwierdzona. **BLOCKED** do uzgodnienia dokumentacji, runtime i polityki. |
| Marketplace i wypłaty | Zakup treści od wielu twórców nie jest obietnicą aktywnego produktu. | Brak obietnicy sprzedaży lub wypłaty. | Moduły pozostają za bramkami. | `PLATFORM_GATE_SALES` i `PLATFORM_GATE_PAYOUTS`, oba domyślnie `off`; to nie dowód wartości produkcyjnych. **BLOCKED** do wymaganych decyzji i odbioru. |
| Publiczny start | Strona pozostaje w trybie beta/noindex, dopóki właściciel nie zdecyduje o starcie. | Brak obietnicy otwartej rejestracji. | Start wymaga właściwych zgód i checklisty operacyjnej. | `NEXT_PUBLIC_SITE_BETA`, domyślnie `true`, wartość czasu budowania; produkcyjna wartość niepotwierdzona. |

## Rozbieżności wymagające rozwiązania

1. `STATUS.md` z 5 listopada mówi „nic za pieniądze na tym etapie”, ale `CLAUDE.md` i opis strefy patrona przedstawiają Premium jako produkt końcowy z prawdziwą ścieżką Stripe. Nie rozstrzygamy tego przez wybór starszego albo nowszego kodu.
2. `STATUS.md` mówi, że okno napiwku jest ukryte, lecz `TIP_GATE_ENABLED` ma wartość `true`; dokumentacja płatności opisuje też serwerową ścieżkę napiwku. Ukrycie przycisku nie dowodzi odmowy żądań API.
3. Dokumentacja operacyjna i audyt strefy patrona zawierają odczyty konfiguracji z października. Nie są dowodem konfiguracji z 7 listopada.
4. Nazwy produktów, historyczne identyfikatory i flagi opisują implementację. Same nie potwierdzają aktywnej obietnicy wobec widzów.

W konsekwencji **nie ogłaszamy zgodności kodu z profilem niekomercyjnym** i nie twierdzimy, że aktualny system nie może przyjąć pieniędzy. Ścieżki płatności pozostają zablokowane do czasu uzgodnienia profilu i sprawdzenia przez uprawnionego operatora bezsekretowej konfiguracji oraz runtime. Ten dokument nie zmienia żadnej flagi, regulaminu, danych ani kluczy.

## Rejestr DP01–DP09

Właścicielem decyzji jest Paweł. „Przed pakietem” oznacza bramkę, przed którą decyzja musi być jawna; nie jest automatycznym terminem ani zgodą na aktywację.

| ID | Decyzja | Status | Wymagana bramka |
|---|---|---|---|
| DP01 | Co dzieje się z dostępem po refundzie, sporze i rozpoczęciu/zużyciu okresu? | OTWARTA; nie zakładać automatycznego cofnięcia ani zachowania dostępu. | Przed K11–K12 i aktywacją płatnych uprawnień. |
| DP02 | Jak traktować kanał i jego dane przy usunięciu konta właściciela: transfer, ukrycie, retencja czy usunięcie? | OTWARTA; kod nie wybiera polityki za właściciela. | Przed K26 i usuwaniem kont twórców. |
| DP03 | Jakie świeże potwierdzenie administratora wymagane jest dla operacji finansowych? | OTWARTA. | Przed K08 i aktywacją operacji finansowych. |
| DP04 | Jak długo może być uznawana sesja WWW za świeżą dla operacji wrażliwych? | OTWARTA. | Przed K08/K28 i zmianą polityki sesji. |
| DP05 | Jak szybko i jakim mechanizmem trzeba cofnąć dostęp do HLS po zmianie uprawnień? | OTWARTA; dotychczasowy TTL/cache to nie nowa zgoda. | Przed K29 i obietnicą natychmiastowego odebrania dostępu. |
| DP06 | Jak system ma zachować się przy awarii usługi uwierzytelniania: zamknąć dostęp czy dopuścić ograniczone działanie? | OTWARTA. | Przed K09 i zmianą fail-open/fail-closed. |
| DP07 | Jakie SLO jakości odtwarzania i dostępności przyjmujemy dla wybranego profilu? | OTWARTA; przykłady z roadmapy nie są zatwierdzonym celem. | Przed K35–K36 i deklaracją jakości. |
| DP08 | Jakie są docelowe RPO i RTO oraz zakres odtworzenia wymagany dla platformy? | OTWARTA. | Przed K32/K36 i deklaracją odtwarzalności. |
| DP09 | Jaki budżet operacyjny i kosztowy ogranicza ruch, storage i usługi zewnętrzne? | OTWARTA; bez samodzielnego uruchamiania płatnych zasobów. | Przed K33/K38–K39 i testem skali generującym koszt. |

## Dowód i pozostały zakres K05

- K05-T1: częściowo spełnione dla profilu powyżej; nadal wymagane uzgodnienie sprzeczności oraz weryfikacja zachowania tras płatności, gate'ów i stanu produkcji.
- K05-T2: rejestr DP01–DP09 ma właściciela, status i bramkę. Otwarte funkcje oznaczono jako BLOCKED; brak potwierdzonej konfiguracji runtime jest jawny.
- Zbadane źródła bieżącej gałęzi: `lib/platform-gates.ts`, `lib/modules/patron-zone/domain/config.ts`, `lib/modules/patron-zone/domain/payments-mode.ts`, `app/components/channel/tip-gate.ts`, `lib/site-stage.ts`, `CLAUDE.md`, `docs/operations/STATUS.md`, `docs/architecture/patron-zone.md`, `docs/architecture/payments-and-tips.md`.
- K05 pozostaje **częściowe**, dopóki właściciel nie rozstrzygnie sprzecznego opisu Premium, a uprawniony odbiór nie potwierdzi bezsekretowej konfiguracji i aktywnych ścieżek. Bez tego nie zmieniać polityk ani nie odblokowywać K11/K26/K29/K40.
