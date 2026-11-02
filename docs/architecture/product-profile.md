# Profil produktu i otwarte decyzje

Stan kodu i znanych decyzji właściciela: 2 listopada 2026. Ten dokument rozstrzyga znaczenie produktu; nie potwierdza aktywnej konfiguracji produkcji ani gotowości do przyjmowania pieniędzy. Datowane opisy „wyłącznie darmowy serwis i napiwki” sprzed decyzji 2026-10-13/21 nie opisują już całego rozwijanego produktu.

## Trzy odrębne przepływy

| Przepływ | Widz / twórca / administrator | Dostęp i ewidencja | Konfiguracja |
|---|---|---|---|
| Darmowe VOD i dawne napiwki | Widz ogląda zgodnie z zasadami filmu; dawne okno napiwku jest ukryte. Twórca zarządza własnym kanałem zgodnie z rolą. Administrator obsługuje platformę w osobnym panelu. | Napiwek nie daje dostępu ani publicznej odznaki. `PatronGrant` pozostaje prywatną ewidencją napiwków. | Okno napiwku: `TIP_GATE_ENABLED=false`. Tworzenie cudzych kanałów jest osobno bramkowane. |
| Obecna strefa patrona / Premium | Widz wybiera 30 dni lub dostęp bez limitu do wskazanych filmów; nie jest to subskrypcja. Obsługa płatności korzysta ze wspólnego stosu Stripe/Payment i `fulfillPayment()`. | Uprawnienie jest zapisane w `AppSetting` `xp.premium_pass:<userId>`, nie w `PatronGrant` ani marketplace `Entitlement`. Slugi strefy nie zmieniają `Video.tier`. | `PREMIUM_PASS_EXPERIMENT=off/testers/all` (domyślnie off); `PREMIUM_PASS_PAYMENTS=demo/stripe` (domyślnie demo). Stripe wymaga zgodnego zestawu kluczy i webhooka; klucze live dodatkowo `PLATFORM_GATE_SALES=on`. |
| Przyszły marketplace wielu twórców | Docelowo twórca sprzedaje film, platforma jest sprzedawcą. Funkcja wymaga odrębnego odbioru; dostępny rdzeń domenowy nie jest kompletną integracją sprzedaży i wypłat. | `Order`, `Entitlement`, `LedgerEntry`, poziom `PAID`; odrębne ryzyka idempotencji i rozliczeń. | `sales` i `payouts` domyślnie off. Samo włączenie flagi lub działający pakiet Premium nie dowodzą gotowości marketplace. |

Strefa patrona jest docelowym produktem według decyzji właściciela z 2026-10-21. Jej historyczne nazwy zmiennych pozostają. Wymaganie cennika/kwoty jest po stronie serwera; przeglądarka wybiera produkt i walutę. Tryb demo nie pobiera pieniędzy. Źle skonfigurowany tryb Stripe nie przechodzi automatycznie w demo.

`Video.tier` ma `PUBLIC`, `LOGGED_IN` i bramkowane `PAID`. Enum `PATRON` nie występuje w bieżącym schemacie. Strefa Premium jest dodatkową regułą dostępu według slugów. Wszystkie decyzje dostępu pozostają w `checkVideoAccess()`; plan odmowy nie niesie źródła/tokenu. To nie zmienia autoryzacji, moderacji, statusów kanałów ani reguły niewyświetlania `UNLISTED` na listach.

Źródła implementacji: [wyłączniki](../../lib/platform-gates.ts), [strefa i cennik](../../lib/modules/patron-zone/domain/config.ts), [tryb płatności](../../lib/modules/patron-zone/domain/payments-mode.ts), [schemat](../../prisma/schema.prisma). Szczegóły: [strefa patrona](patron-zone.md), [napiwki](payments-and-tips.md), [platforma wielu twórców](multi-creator-platform.md). Znane błędy finansów i dostępu pozostają do naprawienia; opis zachowania nie oznacza ich odbioru.

## Aktywacja jest osobnym faktem

Nie odczytano aktualnych flag produkcji na potrzeby tego dokumentu. Przed odbiorem trzeba zapisać bezsekretowy profil: beta/public, kanały off/invite/on, Premium off/testers/all, płatności demo/test/live, sales/payouts off/on oraz wersję aplikacji. Nie kopiować kluczy, tokenów ani list prywatnych identyfikatorów. Wyłączenie funkcji wymaga potwierdzenia na jej wejściach, nie samego opisu flagi.

Scenariusz pomiaru właściciela: kilkunastu twórców i 10000 widzów jednocześnie w szczycie. Nie jest to potwierdzona pojemność ani zgoda na wydatki lub publiczne uruchomienie. Nie zmienia się zamrożonego logo, intro i zoom bez osobnej decyzji.

## Rejestr decyzji potrzebnych dalszym pakietom

Nieustalony wynik ma status **OTWARTE**; nie oznacza zgody na domyślną nową politykę. Właściciel rozstrzyga przed zależnym pakietem/aktywacją, a agent przedstawia konkretne warianty i skutki. Decyzje nie blokują przygotowania pilnej poprawki zależności.

| ID | Decyzja | Potrzebna przed | Stan |
|---|---|---|---|
| DP01 | Zużyte okresy dostępu, częściowy zwrot i spór; korekta niejednoznacznych starych praw. Zwrot jednej wpłaty nie może przypadkowo odebrać innej. | K11/K12; osobna zgoda na korektę prawdziwych danych | OTWARTE |
| DP02 | Transfer, ukrycie lub usunięcie kanału po usunięciu właściciela; retencja oryginałów i innych danych | K26/K27/K32 | OTWARTE |
| DP03 | Niezależne potwierdzenie wrażliwych operacji administratora i jego okno | K08 | OTWARTE |
| DP04 | Dopuszczalny czas cofania sesji i już wydanych tokenów HLS, z uwzględnieniem cache | K28/K29 | OTWARTE |
| DP05 | Ochrona zastępcza auth przy awarii Redis i dopuszczalna degradacja dostępności | K09 | OTWARTE |
| DP06 | Liczbowe SLO, mix ruchu i progi zatrzymania pomiaru 10000 widzów | K38/K39 | OTWARTE |
| DP07 | RPO/RTO osobno dla DB, nieodtwarzalnych mediów, konfiguracji i rozliczeń | K32 | OTWARTE |
| DP08 | Budżet działania i osobny budżet płatnych zasobów testowych; reakcja na przekroczenie | K33/K39; przed każdym wydatkiem | OTWARTE |
| DP09 | Aktualny profil produkcji i zakres planowanego startu; wymagane warunki biznesowe/prawne płatności i przyszłego marketplace | Odbiór K05 i bramki P/O/F | NIEZWERYFIKOWANE / DO DECYZJI |

Nie dokonano aktywacji ani zmian w usługach zewnętrznych. Dokument porządkuje stan implementacji i istniejące decyzje; nie zastępuje ich wymaganej weryfikacji.
