# Propozycja retencji wierszy `Payment` (PA-10)

Status: REKOMENDACJA do decyzji właściciela. W kodzie nie ma żadnej polityki retencji `Payment`; nic nie jest usuwane automatycznie.
Zakres prawny jest do potwierdzenia z księgowym, to nie jest porada prawna.

## 1. Co jest w wierszu `Payment`
`userId` (po usunięciu konta wskazuje na anonimowy wiersz-nagrobek), kwota, waluta, status, `stripeIntentId`, `requestId`, kwoty i daty zwrotów,
`refundReason` (tekst wpisany przez admina, może zawierać dane osobowe, jeśli admin je wpisał), `metadata` (tylko `requestId`).
Brak karty, IP, nazwiska. Po usunięciu konta (`AccountDeletionCleanupUseCase`) e-mail i nazwa u nas znikają, a od PA-03 także e-mail/nazwa/telefon na Kliencie w Stripe.
`StripeEvent.payload` nie zawiera danych osobowych. `AuditLog` ma `userId`, nie e-mail; IP/UA są zerowane po 90 dniach.

## 2. Podstawa prawna
* RODO art. 6 ust. 1 lit. c (obowiązek prawny) oraz art. 17 ust. 3 lit. b: prawo do usunięcia nie obejmuje danych, które trzeba przechowywać z mocy prawa.
* Ustawa o rachunkowości (art. 74): dokumenty księgowe 5 lat, liczone od początku roku następującego po roku obrotowym. Ordynacja podatkowa: zobowiązanie przedawnia się po 5 latach od końca roku podatkowego.
  Do potwierdzenia z księgowym, czy napiwki tworzą u właściciela dokument księgowy i jaki okres obowiązuje.
* Stripe jest osobnym administratorem danych transakcyjnych (AML, karty) i trzyma je niezależnie od nas.

## 3. Opcje
| Opcja | Opis | Plusy | Minusy |
|---|---|---|---|
| A (rekomendowana) | Wiersze `Payment` zostają z właścicielem-nagrobkiem przez okres księgowy (domyślnie 6 lat pełnych, margines nad 5), potem usuwamy lub zerujemy `refundReason` i `userId` wskazuje nagrobek; osobne zadanie retencji | zgodne z obowiązkiem, minimalizacja po terminie, proste | trzeba napisać zadanie i zatwierdzić okres |
| B | Zostają bezterminowo, tylko zanonimizowane (nagrobek, `refundReason` czyszczony po usunięciu konta) | zero pracy, pełna historia sum | brak limitu przechowywania (zasada ograniczenia czasu przechowywania, art. 5 ust. 1 lit. e) trudna do obrony po latach |
| C | Usuwanie wierszy po N latach (np. 2) | maksymalna minimalizacja | może kolidować z obowiązkiem księgowym; rozjeżdża sumy i raporty |

## 4. Rekomendacja i kolejne kroki (po decyzji)
1. Potwierdzić z księgowym okres (zakładam 6 lat pełnych).
2. Od razu, niezależnie od okresu: przy usunięciu konta czyścić `refundReason` płatności tej osoby (może zawierać dane osobowe wpisane przez admina). To mała zmiana w `AccountDeletionCleanupUseCase`, nie wdrożona bez zgody, bo zmienia treść dowodu zwrotu.
3. Zadanie retencji w `/api/cron/retention`: po okresie księgowym usunąć/zanonimizować wiersze `Payment` (wraz z `UserPaymentTotal` osoby bez płatności), z audytem liczby wierszy.
4. Opisać okres w polityce prywatności (dane płatności, Stripe jako niezależny administrator).
5. Przy przejściu na tryb live: stare płatności testowe (147 wierszy, patrz PA-02) usunąć jednorazowo po decyzji właściciela, to nie są dokumenty księgowe.

Źródła: tekst RODO (art. 5, 6, 17); ustawa o rachunkowości art. 74; Stripe: https://docs.stripe.com/api/customers/update (kasowanie pól pustą wartością).
