# Stripe Connect dla wielotwórczej platformy z napiwkami (pawelperfect.com)

Data researchu: 2026-10-13. Główny scenariusz: **istniejące konto platformy Stripe w Polsce (PL), live, charges enabled.** Scenariusz US LLC opisuję tylko pomocniczo.
Oznaczenia: **[FACT: źródło]** to twierdzenie oparte na dokumentacji, **[INFERENCE]** to mój wniosek lub interpretacja. To nie jest porada prawna ani podatkowa. Kwestie VAT, PIT/CIT, DAC7 i usług płatniczych musi potwierdzić doradca.

---

## Wnioski (TL;DR)

1. **„Merchant of record” w Connect oznacza, kto jest stroną transakcji wobec płacącego.** Ten podmiot widnieje na wyciągu, odpowiada za zwroty i chargebacki i musi być wyraźnie wskazany w checkout i w regulaminie. Zasady Stripe są proste. Przy direct charges MoR jest konto połączone (twórca). Przy destination charges i SCT z `on_behalf_of` MoR też jest twórca, ale platforma ponosi ostateczne ryzyko ujemnych sald. Przy destination charges i SCT bez `on_behalf_of` MoR jest platforma. [FACT: docs.stripe.com/connect/merchant-of-record]
2. Właściciel mówi „portal wielu twórców na zasadzie merchant of record”. Najpewniej ma na myśli, że **platforma przyjmuje pieniądze i rozlicza twórców**, czyli model marketplace z platformą jako MoR. **[INFERENCE]** To wymaga potwierdzenia, bo dla napiwków **lepszy jest model „twórca jako MoR”**. Uzasadniam to w kolejnych punktach.
3. **Rekomendacja dla platformy PL to direct charges, a twórca jest MoR.** Konfiguracja kont: `losses_collector=stripe` (Managed Risk), `fees_collector=stripe` („Stripe handles pricing”), `dashboard=none`, a do tego w pełni osadzone komponenty (onboarding, account management, notification banner, documents, payments, payouts). Stripe sam opisuje dokładnie taką konfigurację jako „fully embedded” i daje ją jako przykład. [FACT: docs.stripe.com/connect/build-full-embedded-integration]
   - Platforma nie płaci opłat Connect: 0 zł za konto, 0 zł za wypłatę, 0% od wolumenu. Opłaty płatnicze płaci twórca. [FACT: stripe.com/connect/pricing (PL); docs.stripe.com/connect/direct-charges-fee-payer-behavior]
   - Za nieodzyskiwalne ujemne salda twórców odpowiada Stripe, nie platforma. **Managed Risk wymaga direct charges.** [FACT: docs.stripe.com/connect/risk-management/managed-risk]
   - BLIK i P24 działają na kontach twórców w PL i w EOG, jeśli zamówi się capabilities `blik_payments` i `p24_payments`. [FACT: endpoint wymagań Stripe dla platformy PL; docs.stripe.com/payments/blik]
4. **Alternatywa to platforma jako MoR (destination charges bez OBO).** Wtedy to platforma ponosi chargebacki, zwroty i ujemne salda. Płaci też opłaty Connect: 9 zł za aktywne konto miesięcznie, 0,25% + 1,35 zł za wypłatę i 0,25% wolumenu wypłat. Stripe w tym modelu odradza przerzucanie ryzyka na Stripe. Prawnie i podatkowo platforma staje się odbiorcą środków od napiwkodawcy, co rodzi ryzyka przychodu, VAT i usług płatniczych. Do weryfikacji z doradcą. [FACT/INFERENCE]
5. **Stripe Managed Payments (Stripe jako MoR) odpada.** Nie wspiera Connect ani platform i obsługuje tylko sprzedaż produktów cyfrowych z kodami podatkowymi. [FACT: docs.stripe.com/payments/managed-payments, …/eligibility]
6. **Platforma PL może mieć konta połączone w 43 krajach**, wszystkie wyłącznie na pełnej umowie (`full`). Umowa `recipient` nie jest dostępna dla platformy PL. Dla porównania platforma US ma 121 krajów, a dla 118 z nich dostępna jest umowa `recipient`. [FACT: docs.stripe.com/_endpoint/get-requirement-selections-for-platform-country?platformCountry=PL i …=US]
7. **Platformy tworzenia treści są w Stripe „restricted” i wymagają uprzedniej zgody (preapproval).** Stripe chce zobaczyć kontrole do wykrywania i usuwania nielegalnych treści. Napiwek musi być dawany za dostarczoną treść, a treści dla dorosłych są zabronione. **Przed startem trzeba skontaktować się ze Stripe.** [FACT: stripe.com/legal/restricted-businesses; support.stripe.com/questions/prohibited-and-restricted-businesses-list-faqs; support.stripe.com/questions/requirements-for-accepting-tips-or-donations]
8. **DAC7: narzędzie Stripe „Platform tax reporting” nie obsługuje Polski** („all EU countries with the exception of PL”) i jest w preview. Jeśli platforma PL podlega DAC7, raport do KAS musi przygotować sama. Wątpliwe jest jednak, czy napiwki za treści w ogóle są „relevant activity” w rozumieniu DAC7. [FACT: docs.stripe.com/connect/platform-tax-reporting; podatki.gov.pl] / [INFERENCE co do zakresu]
9. **Twórca musi mieć co najmniej 18 lat**, bo dla kont bez pełnego Dashboardu (Express i Custom, a więc też `dashboard=none`) obowiązuje wymóg 18+. [FACT: support.stripe.com/questions/age-requirement-to-create-a-stripe-account; wynik wyszukiwania, strona nie była pobierana bezpośrednio]
10. **Dla polskiego „individual” KYC jest od razu (upfront).** Wymagane są imię i nazwisko, adres, data urodzenia, telefon, e-mail, obywatelstwo, MCC, URL, akceptacja ToS i rachunek bankowy. Endpoint pokazuje limity `-1` dla wszystkich pól, co interpretuję jako wymóg przed aktywacją capability. [FACT: endpoint get-requirements-for-setups] / [INFERENCE co do semantyki `-1`]

---

## Rekomendowana konfiguracja (scenariusz główny: platforma PL)

### Model: twórca = MoR, direct charges, Stripe zarządza ryzykiem

| Element | Wartość | Dlaczego |
|---|---|---|
| API kont | Accounts v1 z controller properties albo Accounts v2 | v2 Stripe zaleca dla nowych integracji, ale część funkcji wciąż wymaga v1, np. ustawienia wypłat i umowa recipient. Przykłady v2 w docs używają nagłówka `2026-09-30.preview`. Dla stabilności rozważ v1 + `controller` i późniejszą migrację. [FACT: docs.stripe.com/connect/accounts-v2; …/destination-charges] / [INFERENCE] |
| `controller.losses.payments` / `losses_collector` | `stripe` | Managed Risk: Stripe ponosi nieodzyskiwalne ujemne salda. Wymaga direct charges, Radar, onboardingu hostowanego lub osadzonego oraz komponentów Notification banner i Account management. [FACT: managed-risk] |
| `controller.fees.payer` / `fees_collector` | `account` (v1) / `stripe` (v2) | Opłaty płatnicze i opłaty za spory pobierane są od twórcy, a platforma nie płaci opłat Connect. Stripe wysyła wtedy twórcy faktury za opłaty, więc komponent Documents jest wymagany. [FACT: direct-charges-fee-payer-behavior; build-full-embedded-integration] |
| `controller.stripe_dashboard.type` / `dashboard` | `none` | Wszystko odbywa się w naszym panelu twórcy przez embedded components. Wtedy `requirement_collection=stripe`, więc KYC zbiera Stripe. [FACT: connected-account-configuration] Opcja `express` przy `losses=stripe` jest w public preview. [FACT: managed-risk] |
| Umowa (service agreement) | `full` | Jedyna dostępna dla platformy PL, wymagana przez Managed Risk. [FACT] |
| Capabilities | `card_payments`, `transfers`, `blik_payments`, `p24_payments` (w krajach, gdzie są dostępne; konta US pod platformą PL nie mają BLIK/P24) | Apple Pay i Google Pay działają w ramach `card_payments`. [FACT: account-capabilities; endpoint PL] |
| Typ obciążenia | **Direct charge**: `PaymentIntent` tworzony z nagłówkiem `Stripe-Account: acct_…`, Payment Element inicjalizowany z `stripeAccount` | Środki rozliczają się w kraju twórcy. Zwroty i spory obciążają saldo twórcy. [FACT: connect/charges] |
| Prowizja platformy | Na start `application_fee_amount = 0`, opcjonalnie później X% | Przy `fees_collector=stripe` w `application_fee_amount` wpisujesz tylko swoją prowizję, a opłatę Stripe Stripe pobiera osobno. [FACT: connected-account-configuration] |
| Embedded components (obowiązkowe) | `account_onboarding`, `account_management`, `notification_banner`, `documents` | Wymagane w fully embedded z Managed Risk i przy Stripe pricing. [FACT: build-full-embedded-integration] |
| Embedded components (zalecane) | `payments` (obsługa sporów, które w tym modelu prowadzi twórca, plus podgląd), `payouts` lub `balances` (możliwość zasilenia salda przy ujemnym), `payout_details`, `payouts_list`, `balance_report`, `payout_reconciliation_report` | Platforma musi dać twórcom sposób na odpowiedź na spór, przez API albo przez komponent. [FACT: build-full-embedded-integration] |
| Webhooki | Dwa endpointy: (a) „Your account” dla zdarzeń platformy, np. `application_fee.*` i zdarzeń v2; (b) „Connected accounts” (`connect=true`) dla `account.updated`, `capability.updated`, `account.external_account.*`, `payment_intent.succeeded/payment_failed/processing`, `charge.refunded`, `charge.dispute.*`, `payout.*` | Przy direct charges zdarzenia płatności przychodzą na endpoint Connect z polem `event.account`. [FACT: connect/webhooks] |
| Statement descriptor | Ustawiany per konto (`settings.payments.statement_descriptor`, `settings.card_payments.statement_descriptor_prefix`), np. prefix „PPERFECT” i suffix z nazwą kanału, ale tylko jeśli Stripe na to pozwoli. Uwaga: przy direct charges używany jest deskryptor twórcy. | [FACT: connect/statement-descriptors] |

### Proponowane pola w modelu danych (Prisma, tabela np. `CreatorPayoutAccount`)

`userId` (twórca), `stripeAccountId` (acct_…), `apiVersion` ('v1'|'v2'), `country`, `defaultCurrency`, `businessType` ('individual'|'company'), `controllerLosses`, `controllerFeesPayer`, `dashboardType` (zapis konfiguracji z chwili utworzenia, bo responsibilities są niemodyfikowalne), `chargesEnabled`, `payoutsEnabled`, `detailsSubmitted`, `capabilities` (JSON: `card_payments`/`transfers`/`blik_payments`/`p24_payments` → `active|inactive|pending`), `requirementsCurrentlyDue` (string[]), `requirementsEventuallyDue` (string[]), `requirementsPastDue` (string[]), `requirementsPendingVerification` (string[]), `requirementsDisabledReason`, `requirementsCurrentDeadline` (DateTime?), `futureRequirementsCurrentlyDue` (opcjonalnie), `tosAcceptedAt`, `statementDescriptor`, `statementDescriptorPrefix`, `externalAccountLast4` i `externalAccountCurrency` (tylko do wyświetlania), `lastStripeEventId`, `lastStripeEventCreatedAt` (do odrzucania zdarzeń spoza kolejności), `syncedAt`, `createdAt`, `updatedAt`, `disabledAt`.
Dla napiwków (`Tip`): `stripePaymentIntentId` (unique), `stripeChargeId`, `stripeAccountId` (na którym koncie jest charge), `chargeType` ('platform_legacy'|'direct'|'destination'), `amount`, `currency`, `applicationFeeAmount`, `status`, `refundedAmount`, `disputeStatus`, `paymentMethodType` (card/blik/p24/…), `idempotencyKey`.
Dla zdarzeń: tabela `StripeEvent` z kolumnami `id` (evt_…, PK, deduplikacja), `type`, `account`, `livemode`, `receivedAt`, `processedAt`. **[INFERENCE: dobra praktyka]**

### Alternatywa B: platforma jako MoR (gdyby właściciel tego chciał)
Destination charges bez `on_behalf_of`, `losses=application`, `fees=application`, `dashboard=none` albo `express`. Plusy: jeden MoR, jeden deskryptor, BLIK i P24 na koncie platformy, wypłaty cross-border do US, UK, CA i CH bez OBO. Minusy: chargebacki, zwroty i ujemne salda obciążają platformę, płacisz opłaty Connect, dochodzi ryzyko podatkowe i regulacyjne. Szczegóły w sekcjach 2, 3 i 5.

---

## 1. Konfiguracja Connect w ujęciu 2025/2026 (controller properties / Accounts v2) i embedded components

**Model właściwości zamiast typów kont.**
- Stripe traktuje typy Standard, Express i Custom jako przestarzałe („(deprecated) The legacy account types support limited configurations”) i zaleca Accounts v2 albo v1 z controller properties. [FACT: docs.stripe.com/connect/integration-recommendations]
- Odpowiedzialności w v2: `defaults.responsibilities.fees_collector` (`application`|`stripe`) i `losses_collector` (`application`|`stripe`). **Ustawia się je raz i nie można ich później zmienić.** Jeśli `losses_collector=application`, to `fees_collector` też musi być `application`. Przy destination charges Stripe zaleca obie wartości ustawić na `application`. [FACT: docs.stripe.com/connect/accounts-v2/connected-account-configuration]
- `dashboard`: `full` | `express` | `none`. Bez względu na tę wartość można używać embedded components. [FACT: tamże]
- KYC zbiera Stripe, z wyjątkiem jednej kombinacji: `losses=application` + `dashboard=none` (wtedy `requirements_collector=application`, czyli dawny Custom). [FACT: tamże]
- Mapowanie v1 na v2: `controller.fees.payer` ↔ `fees_collector`, `controller.losses.payments` ↔ `losses_collector`, `controller.requirement_collection` (w v2 liczone automatycznie), `controller.stripe_dashboard.type` ↔ `dashboard`. [FACT: tamże]

**Rekomendacje Stripe według typu obciążenia** [FACT: integration-recommendations]:
- Direct charges: dashboard Full, Embedded albo Express. Ujemne salda najlepiej po stronie Stripe. Opłaty pobiera platforma albo Stripe.
- Destination charges i SCT: dashboard Embedded albo Express. Ujemne salda po stronie platformy. Opłaty pobiera platforma. Stripe wprost odradza przerzucanie ujemnych sald na Stripe w tym modelu.
- Direct charges są „not recommended for legacy v1 Express and Custom accounts”. [FACT: connect/charges]

**Co pasuje do napiwków dla wielu małych twórców [INFERENCE].**
- Małe kwoty, duża liczba twórców, platforma bez działu ryzyka i jeden serwer. Najbezpieczniej przerzucić ryzyko strat i obsługę KYC na Stripe. Taką możliwość daje tylko direct charges + `losses=stripe` (Managed Risk).
- Przy `fees=stripe` platforma nie płaci 9 zł miesięcznie za każde aktywne konto. Przy setkach twórców z napiwkami po kilka do kilkudziesięciu złotych miesięcznie te opłaty byłyby dotkliwe dla platformy.
- `dashboard=none` z embedded components pozwala trzymać twórcę w naszym UI. Express Dashboard to dodatkowy brand Stripe i osobne logowanie, a kombinacja Express + `losses=stripe` jest w preview.

**Embedded components dostępne dziś (web)** [FACT: docs.stripe.com/connect/supported-embedded-components?platform=web]:
- Onboarding i compliance: Account onboarding, Account management, Notifications banner.
- Płatności: Payments, Payment details, Disputes for a payment, Disputes list, Payment method settings.
- Wypłaty: Payouts, Balances, Payouts list, Payout details, Instant Payouts promotion.
- Podatki: Tax registrations, Tax settings; w Preview: Export tax transactions, Tax threshold monitoring, Product tax code selector.
- Raporty: Documents, Balance report, Payout reconciliation report; Reporting chart w Preview.
- Pozostałe: Capital (Preview), Terminal, Financial services, Apps (Preview).

**Wymagania techniczne** [FACT: get-started-connect-embedded-components?platform=web]:
- Serwer tworzy `AccountSession` (`/v1/account_sessions`) z listą `components`, a klient używa `@stripe/connect-js` lub `@stripe/react-connect-js` (`loadConnectAndInitialize`).
- CSP musi dopuszczać `frame-src`/`script-src` dla `https://connect-js.stripe.com` i `https://js.stripe.com`, `img-src https://*.stripe.com` oraz hash pustego stylu.
- `Cross-Origin-Opener-Policy` musi mieć wartość `unsafe-none` albo nie być ustawiony. Wartość `same-origin` psuje uwierzytelnianie.
- Embedded components nie działają w webview aplikacji mobilnych.
- Lokalizacja `pl-PL` jest wspierana.
- **Uwierzytelnianie:** przy kontach, dla których Stripe zbiera wymagania (nasz przypadek), komponenty Account onboarding, Account management, Balances, Payouts i Notification banner mogą wymagać logowania do Stripe w popupie (SMS OTP). Wyłączenie tego (`disable_stripe_user_authentication`) jest możliwe tylko tam, gdzie wymagania zbiera platforma (Custom-like), i wtedy platforma przejmuje odpowiedzialność.

**Fully embedded** [FACT: build-full-embedded-integration]:
- Wymagane komponenty: Account onboarding, Account management, Notification banner i Documents (gdy Stripe pobiera opłaty od kont).
- Platforma musi umożliwić odpowiedź na spór, przez API albo przez komponent Payments, Payment details lub Disputes for a payment.
- Zalecany jest komponent Balances albo Payouts, żeby twórca mógł dopłacić przy ujemnym saldzie.
- Stripe wysyła maile do kont z linkami do naszych stron z komponentami. Te URL-e trzeba podać w ustawieniach.
- **Odpowiedź na pytanie: tak, cały panel twórcy można zbudować u siebie, bez Express Dashboardu.**

## 2. Typy obciążeń (charge types)

| | Direct | Destination (bez OBO) | Destination + `on_behalf_of` | SCT (bez/z OBO) |
|---|---|---|---|---|
| Gdzie powstaje charge | Konto twórcy | Platforma | Platforma | Platforma |
| MoR / settlement merchant | Twórca | Platforma | Twórca (ale straty po stronie platformy) | Platforma / twórca przy OBO |
| Deskryptor na wyciągu | Twórcy | Platformy | Twórcy | Platformy / twórcy |
| Kto płaci opłaty Stripe | Twórca albo platforma (`fees_collector`) | Platforma | Platforma (stawki kraju twórcy) | Platforma |
| Zwroty | Z salda twórcy | Z salda platformy, odzysk przez `reverse_transfer` | jw. | jw. |
| Chargebacki i spory | Z salda twórcy; opłata za spór zależy od fee payer | Z salda platformy, odzysk przez transfer reversal | Z salda platformy | Z salda platformy |
| Rozliczenie środków | Kraj twórcy | Kraj platformy | Kraj twórcy | jw. |

[FACT: docs.stripe.com/connect/charges; …/destination-charges; …/merchant-of-record; …/statement-descriptors]

- **`application_fee_amount` (destination).** Cała kwota trafia do konta połączonego, a opłata wraca do platformy. Platforma płaci opłatę Stripe. Opłata platformy rozlicza się w walucie rozliczeniowej konta połączonego. Alternatywa to `transfer_data[amount]`. [FACT: destination-charges]
- **`application_fee_amount` (direct).** Przy `fees_collector=stripe` podajesz tylko swoją prowizję. Przy `application` podajesz swoją prowizję plus opłatę Stripe. [FACT: connected-account-configuration]
- **Cross-border, destination i SCT.** Bez OBO działają w ramach US, UK, EEA, CA i CH. Poza tymi regionami platforma i konto muszą być w tym samym regionie, chyba że użyje się OBO. [FACT: connect/charges; account-capabilities#transfers-cross-border]
- **Cross-border payouts.** Wspierane są tylko przepływy destination i SCT **bez** OBO oraz top-ups. Strona twierdzi też, że nie da się robić cross-border payouts na konta z umową `recipient`. [FACT: connect/cross-border-payouts] **Uwaga na niespójność:** strona service-agreement-types mówi, że cross-border dla kont `recipient` idzie przez Global Payouts. Strona Accounts v2 każe używać Global Payouts do cross-border. Dawniej cross-border wymagał umowy recipient. Dokumentacja jest niejednoznaczna, więc trzeba to potwierdzić ze Stripe.
- **OBO** wymaga, żeby konto twórcy miało capability płatniczą (`card_payments`). Konta `recipient` jej nie dostaną. [FACT: destination-charges]

**Metody płatności:**
- **Karty, Apple Pay i Google Pay** działają ze wszystkimi typami obciążeń. Na koncie twórcy (direct lub OBO) wymagają `card_payments`. [FACT: account-capabilities]
- **BLIK:**
  - „Connect support: Yes”. Klient musi być w Polsce, a waluta to wyłącznie PLN.
  - Lokalizacje firm obejmują PL, całe EOG, GB, CH, US, CA, AU i SG.
  - Capability `blik_payments` musi być aktywna na platformie **i** na koncie połączonym.
  - Tabela deskryptorów obejmuje Direct, Destination, SCT, Destination+OBO i SCT+OBO, czyli BLIK działa z każdym typem.
  - BLIK nie działa z Express Checkout Element ani z deferred intent, czyli z płatnością przed utworzeniem PaymentIntent. [FACT: docs.stripe.com/payments/blik]
  - Pod platformą PL konta PL, DE i GB mają `blik_payments`, ale konta US już nie. Pod platformą US konto US ma `blik_payments`. [FACT: endpointy wymagań]
- **P24:**
  - Klient musi być w PL, waluta PLN albo EUR, minimum 0,50 EUR. Connect jest wspierany.
  - **P24 nie ma sporów ani chargebacków.**
  - P24 wymaga, by strona sprzedawcy pokazywała adres, NIP, numer rejestrowy, politykę zwrotów, prywatności i regulamin. Przy direct charges dotyczy to profilu twórcy, ryzyko opisuję w sekcji Ryzyka.
  - P24 zakazuje m.in. MCC 5262 (Marketplaces), 8398 (fundraising), 5967 (adult) i 7311 (Advertising). MCC 5815 (Digital Goods Media), 7929 (Bands/entertainers) i 7299 są „Restricted”. [FACT: docs.stripe.com/payments/p24]
  - **[INFERENCE]** MCC kont twórców trzeba wybrać ostrożnie. „Marketplace” zablokowałby P24.

## 3. Merchant of record w Connect, MoR według właściciela i konsekwencje

**Definicja Stripe.** MoR to podmiot, który otrzymuje płatność, widnieje na wyciągu i paragonie, odpowiada za towar lub usługę oraz za spory i zwroty. Strona, flow płatności i regulamin muszą go jasno wskazywać. [FACT: merchant-of-record] W Accounts v2 konto, które ma być MoR, musi mieć konfigurację `merchant`. [FACT: tamże]

**Platforma jako MoR** (destination lub SCT bez OBO) [FACT + INFERENCE]:
- Napiwkodawca płaci platformie. Na wyciągu jest „PAWELPERFECT” lub podobna nazwa.
- Platforma ponosi zwroty i chargebacki i może je odzyskać od twórcy przez reversal, o ile twórca ma saldo.
- Platforma jest stroną wobec konsumenta: reklamacje, informacje, potwierdzenia.
- **[INFERENCE, do doradcy]** W PL rodzi to pytania podatkowe:
  - Czy cała kwota napiwku jest przychodem platformy (PIT/CIT), a wypłata twórcy kosztem? Czy platforma działa jako pośrednik lub agent i przychodem jest tylko prowizja?
  - Jak wygląda VAT od prowizji lub od całej kwoty?
  - Czy przyjmowanie środków dla osób trzecich nie jest usługą płatniczą w rozumieniu ustawy o usługach płatniczych? Stripe jako licencjonowany podmiot obsługuje przepływ, ale kwalifikację prawną modelu trzeba potwierdzić.
- Stripe wymaga też zgodności z regułą, że napiwek jest za dostarczoną treść. Treść dostarcza twórca, a platforma ją hostuje.

**Twórca jako MoR** (direct charges albo OBO) [FACT + INFERENCE]:
- Napiwkodawca płaci twórcy. Deskryptor należy do twórcy, a środki trafiają na saldo twórcy w Stripe.
- Spory i zwroty idą z salda twórcy. Przy `losses=stripe` nieodzyskiwalne straty bierze Stripe, nie platforma.
- Potwierdzenie i paragon wskazują twórcę.
- Platforma jest dostawcą oprogramowania i hostingu (model SaaS). Jej przychodem jest wyłącznie `application_fee`, jeśli ją pobiera.
- **[INFERENCE]** To lepiej odpowiada rzeczywistości napiwku: pieniądze są dla twórcy za jego treść. Upraszcza też ewidencję przychodów platformy i ogranicza ryzyko kwalifikacji jako pośrednika płatniczego.
- Wadą jest to, że każdy twórca musi przejść pełne KYC jako „merchant”. Wymagane są MCC, URL i akceptacja pełnej umowy Stripe, a przy P24 dochodzą wymogi strony.
- Przy OBO MoR jest twórca, ale ujemne salda pokrywa platforma. To gorsza kombinacja dla małej platformy. [FACT: merchant-of-record]

**Co właściciel „najpewniej” ma na myśli [INFERENCE].** Hasło „na zasadzie merchant of record” w kontekście subkont najczęściej oznacza „portal przyjmuje płatność i rozlicza subkonta”, czyli model marketplace. Słownictwo jest jednak mylące. Jeśli intencją jest, żeby twórca nie musiał mieć firmy, oba modele to zapewniają: `individual` jest wspierany i Stripe robi KYC osoby fizycznej. **Zalecam przedstawić właścicielowi oba modele i zarekomendować twórcę jako MoR.**

**Stripe Managed Payments (Stripe jako MoR) nie jest opcją** [FACT: docs.stripe.com/payments/managed-payments; …/eligibility]:
- Nie obsługuje Connect, kont Express ani kont kontrolowanych przez platformę.
- Działa tylko z Checkout i Payment Links, a nie z Elements.
- Wymaga kodu produktu cyfrowego i sprzedaży „directly to customers, not through a platform or marketplace”.
- Nie obsługuje P24 (P24: „✗ Managed Payments”). Napiwki nie pasują do żadnej kategorii.

## 4. Cross-border

- **Platforma PL** może utworzyć konta połączone w 43 krajach: AE, AT, AU, BE, BG, BR, CA, CH, CY, CZ, DE, DK, EE, ES, FI, FR, GB, GI, GR, HK, HR, HU, IE, IT, JP, LI, LT, LU, LV, MT, MX, NL, NO, NZ, PL, PT, RO, SE, SG, SI, SK, TH i US. Wszystkie wyłącznie na umowie `full`, z dashboardami full, express lub none. [FACT: endpoint …platformCountry=PL]
- **[INFERENCE]**
  - Przy direct charges środki rozliczają się w kraju twórcy, więc twórca z każdego z tych 43 krajów może przyjmować napiwki lokalnie.
  - Przy destination bez OBO cross-border działa tylko w ramach US, UK, EEA, CA i CH. Konta z AU, JP, SG i innych krajów wymagałyby OBO albo direct.
  - Twórców spoza tej listy 43 krajów (np. Ukraina, Indie) platforma PL nie obsłuży przez Connect. Pozostaje im Global Payouts, ale ten wymaga platformy US lub UK. [FACT: cross-border-payouts, „Global Payouts… Platform location US, UK”]
- **Platforma US (scenariusz LLC):**
  - 121 kraje kont połączonych, z czego 118 z możliwą umową `recipient` (wyjątki to BR, GI i US). [FACT: endpoint …=US]
  - Recipient: brak `card_payments`, transfery dostępne z opóźnieniem 24 h, brak bezpośredniego wsparcia Stripe dla odbiorcy. W v2 nie da się podpisać umowy `recipient`, potrzebne jest v1. [FACT: service-agreement-types; accounts-v2]
  - Konta `recipient` nie mogą używać direct charges ani OBO. [FACT: destination-charges]
- **Waluty.** BLIK działa tylko w PLN, P24 w PLN i EUR, karty w wielu walutach. Konta PL mogą wypłacać na rachunek w PLN i, przy multi-currency settlement, w innych walutach. Tabela walut rozliczeniowych to dynamiczny widżet, który nie wczytał się w wersji tekstowej, więc **tę kwestię trzeba sprawdzić bezpośrednio**. [FACT: payouts-connected-accounts] / [INFERENCE]

## 5. Cennik

**Polska, strona stripe.com/connect/pricing (wersja PL), w zł** [FACT]:

| Pozycja | „Stripe handles pricing” (fees_collector=stripe, tylko direct) | „You handle pricing” (platforma płaci) |
|---|---|---|
| Onboarding, weryfikacja, compliance | 0 | **9 zł / aktywne konto / miesiąc** (aktywne = takie, które dostało wypłatę) |
| Wypłaty | 0 | **0,25% + 1,35 zł za wypłatę** |
| Funds routing / platform management | 0 | **0,25% wolumenu wypłat** |
| Instant Payouts | 1% | 1% |
| Cross-border payouts | od 0,25% | od 0,25% |
| Account debits | n/d | 1,4% |

- Przy „Stripe handles pricing” strona mówi, że platforma nie ponosi opłat za konta, wolumen wypłat, raportowanie podatkowe ani za pojedyncze wypłaty.
- Typowe opłaty płatnicze: karty europejskie standard 1,5% + 1 zł, karty UK 2,5% + 1 zł. BLIK i P24 mają osobny cennik LPM.
- **US (z wtórnych źródeł, bo strona US przekierowała mnie do wersji PL):** 2 USD za aktywne konto miesięcznie oraz 0,25% + 0,25 USD za wypłatę przy „You handle pricing”. [FACT-secondary: flexprice.io, drop-desk.com; zweryfikować na stripe.com/us/connect/pricing]
- **Przykład [INFERENCE]:** 200 twórców z miesięczną wypłatą po 100 zł w modelu B daje 200 × (9 + 0,25 + 1,35 + 0,25) zł ≈ **2170 zł miesięcznie** samych opłat Connect, nie licząc opłat płatniczych. W modelu A rekomendowanym te opłaty wynoszą 0 zł.
- **Instant Payouts:**
  - Dostępne między innymi w PL. W PL tylko na kartę debetową (lista banków). Limity od 2 PLN do 9999 PLN, opłata 1%.
  - Wymagają umowy `full` i wypłaty w lokalnej walucie.
  - Platforma może doliczać własną opłatę przez application fee. [FACT: connect/instant-payouts]
  - Przy `fees=stripe` opłatę za Instant Payout płaci konto połączone. [FACT: fee-payer-behavior]

## 6. Polityka napiwków i donacji, wymogi dla platform

**Restricted Businesses:**
- Platformy, które pozwalają twórcom przyjmować napiwki i inne płatności za treści, są „restricted” i wymagają dodatkowej weryfikacji. Twórcy na zatwierdzonej platformie nie potrzebują osobnej zgody. Treści dla dorosłych są zabronione, także generowane przez AI. [FACT: stripe.com/legal/restricted-businesses]
- „Crowdfunding platforms” i zbiórki charytatywne są restricted.
- „Peer-to-peer money transmission” jest zabroniona.
- „Payment facilitation and aggregation” jest restricted, w tym przyjmowanie środków za cudze towary i usługi.
- Zabronione jest też obsługiwanie płatności dla nieujawnionych sprzedawców. [FACT: tamże]
- **FAQ Stripe:** „content creation platform” to platforma, która hostuje lub dystrybuuje treści wielu twórców i pozwala im płacić. Potrzebna jest preapproval i kontrole wykrywania nielegalnych treści, a Stripe zbiera o nich dodatkowe informacje. [FACT: support.stripe.com/questions/prohibited-and-restricted-businesses-list-faqs]

**Napiwki:**
- Wymogi Stripe: „a tip must be given for a good or service that has been provided (e.g., content)”.
- Donacja musi być związana z celem charytatywnym, i to celem odbiorcy. Nie wolno przyjmować donacji w imieniu kogoś innego.
- Stripe nie obsługuje przelewów P2P.
- Ograniczenia krajowe dotyczą AU, HK, IN, ID, JP (zakaz donacji dla osób fizycznych), SG i TH. PL, UE, UK i US nie są tam wymienione. [FACT: support.stripe.com/questions/requirements-for-accepting-tips-or-donations]
- **[INFERENCE]** Nazywaj to w UI „napiwkiem za treść”, a nie „darowizną”. Przycisk umieszczaj przy treściach. Nie dopuszczaj kanałów bez treści, które służyłyby wyłącznie do zbiórek. Nie zezwalaj na treści adult. Wprowadź moderację i procedurę notice-and-takedown.
- Anegdotyczny sygnał z Reddita: Stripe potraktował napiwki od fanów jako crowdfunding i odrzucił apelację. Trzeba to wyjaśnić ze Stripe przed startem. [secondary]

**Obowiązki platformy:**
- Connected Account Agreement odsyła do „Platform Provider Agreement” między platformą a twórcą. Opłaty platformy muszą być w nim jasno określone, a konta bez dashboardu Stripe kierują wsparcie do platformy. [FACT: stripe.com/legal/connect-account, podsumowanie]
- **[INFERENCE]** Potrzebny jest regulamin dla twórców obejmujący prowizję, wypłaty, zakazy, moderację i dane. Pełny Connect Platform Agreement nie był pobierany.

**Przykłady rynkowe:**
- **Ko-fi** łączy własne konto Stripe twórcy (Standard/Connect, „You can only link a Stripe Connect account”) i nigdy nie trzyma środków. Płatności trafiają bezpośrednio do twórcy, czyli de facto twórca jest MoR (direct charges). [FACT-secondary: help.ko-fi.com/hc/en-us/articles/360007522474]
- **Buy Me a Coffee** używa kont Stripe Express z marką BMC. [FACT-secondary: podfeet.com] Typu obciążenia nie znalazłem. **[INFERENCE]** Przy Express to najpewniej destination charges.
- Throne: brak danych.

## 7. KYC i onboarding

- **PL, `individual`, platforma PL, `card_payments` + `transfers`, dashboard express** (zapytanie do endpointu wymagań): wymagane są `business_profile.mcc`, `business_profile.url`, imię, nazwisko, adres (line1, kod, miasto), data urodzenia, telefon, e-mail, obywatelstwo, `tos_acceptance.ip/date` i `external_account`. Tagi: `eu_orr_identity_verification_rep` i `supports_stripe_identity`. W praktyce oznacza to weryfikację tożsamości i możliwość użycia Stripe Identity. Wszystkie limity mają wartość `-1`, a pól `legal_guardian` brak. [FACT: docs.stripe.com/_endpoint/get-requirements-for-setups?…PL…] **[INFERENCE]** `-1` oznacza wymóg natychmiastowy, bez progu kwotowego. W UE od reform 2024/2025 KYC jest upfront.
- **Struktury dla PL:** `individual` (bez podtypów; JDG i osoba prywatna traktowane są jako individual), `company` (partnerships, private/public corporation, czyli sp. z o.o. to `private_corporation`), `non_profit`. Dla DE „individual” wprost obejmuje Einzelunternehmen. [FACT: endpoint PL]
- **Wiek.** Konta Express i Custom wymagają 18+. Standard pozwala od 13 lat z opiekunem prawnym. Persons API ma relację `legal_guardian`, a Stripe w 2025 upraszczał zgody opiekunów. [FACT-secondary: support.stripe.com/questions/age-requirement-to-create-a-stripe-account] **[INFERENCE]** Przy `dashboard=none` przyjmij monetyzację dopiero od 18 lat. Nieletni mogą prowadzić kanał bez napiwków.
- **Doświadczenie twórcy [INFERENCE + FACT]:**
  - Twórca otwiera osadzony formularz po polsku i zakłada uwierzytelnienie w Stripe (SMS) w popupie.
  - Podaje dane osobowe, rachunek bankowy (IBAN PL) i ewentualnie dokument lub selfie.
  - Status aktualizuje się przez `account.updated`. Typowo trwa to minuty, a przy weryfikacji dokumentów do kilku dni roboczych.
- **Capabilities:**
  - `card_payments` wymaga też `transfers`. Gdy jedna z nich jest nieaktywna, obie są wyłączone.
  - `blik_payments` i `p24_payments` zamawia się osobno. Konto z `losses=stripe` musi mieć `card_payments` i umowę `full`. [FACT: account-capabilities; managed-risk]

## 8. Zwroty, spory, ujemne salda

- **Direct:**
  - Zwrot tworzymy jako `Refund` z nagłówkiem `Stripe-Account` i jest on pobierany z salda twórcy. Przy braku środków ma status `pending`.
  - `refund_application_fee=true` zwraca prowizję platformy.
  - Spór obciąża saldo twórcy. Opłatę za spór przy `fees=stripe` płaci twórca.
  - Nieodzyskiwalne straty przy `losses=stripe` bierze Stripe. [FACT: connect/charges; fee-payer-behavior; managed-risk]
- **Destination:**
  - Zwrot idzie z salda platformy.
  - `reverse_transfer=true` cofa proporcjonalnie transfer od twórcy, a `refund_application_fee=true` (dozwolone tylko razem z reverse_transfer) oddaje prowizję twórcy.
  - Spór zawsze obciąża platformę. Odzysk odbywa się przez transfer reversal, a po wygranej trzeba ponownie zrobić transfer.
  - Przy cross-border OBO lepiej poczekać z odzyskiem do przegranej. [FACT: destination-charges]
- **[INFERENCE] Rekomendacja dla napiwków:**
  - W regulaminie: „napiwki są dobrowolne i co do zasady bezzwrotne”, ale zostaw wyjątki na pomyłki, podwójne płatności i oszustwa.
  - Spory i tak się zdarzą przy kartach, a czasem przy BLIK, który ma procedurę reklamacyjną. P24 nie ma chargebacków.
  - Włącz 3DS i Radar (wymagany przy Managed Risk).
  - Ustaw limit kwoty napiwku i velocity limits. Monitoruj `charge.dispute.created` z Connect endpointu.
  - W panelu twórcy osadź komponent Payments z `dispute_management`.

## 9. Raportowanie podatkowe

- **DAC7:**
  - Stripe ma produkt „Platform tax reporting” (preview). Zbiera TIN od kont i generuje XML (AU, CA, NL dla UE, UK) oraz zestawienia dla sprzedawców. Stripe sam nie składa raportów, a odpowiedzialność zostaje przy platformie.
  - Produkt obsługuje „all EU countries with the exception of PL”. [FACT: docs.stripe.com/connect/platform-tax-reporting]
  - „Reporting platform operator” to platforma, a nie Stripe. [INFERENCE ze sformułowań i z DAC7]
  - W PL DAC7 obowiązuje od 1.07.2024, raportowanie obejmuje okres od 2023 r., termin to 31 stycznia. Zakres to sprzedaż towarów, usługi osobiste, najem nieruchomości i transportu. [FACT: podatki.gov.pl DPI; grantthornton.pl]
  - **[INFERENCE, do doradcy]** Napiwki za treści wideo raczej nie są „usługą osobistą świadczoną na zlecenie”, ale nie jest to pewne. Jeśli podlegają DAC7, platforma PL raportuje sama do Szefa KAS, bo narzędzie Stripe nie obsługuje PL.
- **US 1099-K:** Stripe wystawia 1099-K dla kont US, gdy płacą one opłaty bezpośrednio (`fees.payer=account`). Przy `application` robi to platforma. Progi: 1099-K powyżej 20 000 USD i 200 transakcji, 1099-NEC/MISC od 2000 USD. [FACT: docs.stripe.com/connect/tax-reporting] **[INFERENCE]** W modelu A Stripe przejmuje 1099-K dla twórców z US i powiadamia ich mailowo, stąd wymóg komponentu Documents.
- **Stripe Tax i VAT:** Stripe Tax nie ma dedykowanego kodu dla napiwków. Istnieje `txcd_00000000` (Nontaxable). [FACT-secondary: docs.stripe.com/tax/tax-codes przez wyszukiwanie] **[INFERENCE]** Dobrowolny napiwek bez świadczenia wzajemnego zwykle jest poza VAT, co wynika z orzecznictwa TSUE (np. C-16/93 Tolsma). Prowizja platformy od twórców to usługa platformy podlegająca VAT, z miejscem świadczenia zależnym od statusu twórcy (B2B/B2C). Do doradcy.

## 10. Deskryptory, paragony, branding

- Deskryptor statyczny konta ma 5 do 22 znaków, a prefix 2 do 10 znaków. Dynamiczny suffix (`statement_descriptor_suffix`) działa tylko dla kart. Dla metod niekartowych można nadpisać pełny `statement_descriptor`. [FACT: connect/statement-descriptors; merchant-of-record]
- Przy direct i OBO używany jest deskryptor oraz dane wsparcia (telefon, URL) twórcy. Jeśli ich brak, Stripe bierze dane platformy. [FACT: statement-descriptors]
- **[INFERENCE]**
  - Zalecam prefix w rodzaju „PPERFECT*” i suffix z nazwą kanału. Przy direct charges prefix jest jednak polem konta twórcy, więc trzeba go prefillować przy tworzeniu konta i sprawdzić, czy Stripe akceptuje markę platformy w deskryptorze twórcy, bo deskryptor ma identyfikować MoR.
  - Potwierdzenia e-mail wysyłaj sami, z jasnym „Odbiorca płatności: <twórca>, obsługa techniczna: pawelperfect.com”. Paragony Stripe przy direct charges idą w imieniu konta twórcy.
- Branding Connect (nazwa, ikona, kolor) ustawia się w ustawieniach Connect. Embedded components dziedziczą font i tło, a wygląd dostraja się przez `appearance`. [FACT: build-full-embedded-integration; get-started-connect-embedded-components]

## 11. Webhooki, idempotencja, lokalny mirror

- **Dwa zakresy endpointów:**
  - „Your account” (`connect=false`) obejmuje zdarzenia obiektów platformy, w tym destination charges, `application_fee.*` i zdarzenia v2 `v2.core.account.*`.
  - „Connected accounts” (`connect=true`) obejmuje v1 `account.updated` dla kont połączonych, direct charges i obiekty na kontach. Każde zdarzenie ma top-level `account`.
  - Produkcyjny endpoint Connect dostaje zdarzenia live i test, więc trzeba sprawdzać `livemode`.
  - Sandboxy wymagają osobnych endpointów. [FACT: connect/webhooks]
- **Kluczowe zdarzenia:**
  - `account.updated` (requirements, `charges_enabled`, `payouts_enabled`), `capability.updated`, `account.external_account.updated`, `person.updated`.
  - `payment_intent.succeeded/processing/payment_failed`, `charge.refunded`, `refund.updated`, `charge.dispute.created/updated/closed`.
  - `payout.created/updated/paid/failed`. Wypłaty emitują tylko zdarzenia v1, także przy Accounts v2. [FACT: connect/webhooks; payouts-connected-accounts]
  - `account.application.deauthorized` dotyczy tylko kont z pełnym Dashboardem. [FACT]
- **Mirror [INFERENCE]:**
  - Na każde `account.updated` lub `capability.updated` nie ufaj payloadowi. Wykonaj `GET /v1/accounts/{id}` i nadpisz rekord.
  - Deduplikuj po `event.id` (unikalny klucz w tabeli).
  - Odrzucaj zdarzenia starsze niż `lastStripeEventCreatedAt`, albo zawsze dociągaj świeży stan.
  - Dodaj nocny job „reconcile”, który listuje konta i porównuje je z bazą.
  - Przy tworzeniu kont, PaymentIntentów i zwrotów używaj nagłówka `Idempotency-Key` (np. `tip:<uuid>`).
  - Webhook zwraca 2xx szybko, a ciężką pracę wykonuje asynchronicznie.
  - Przycisk napiwku pokazuj tylko wtedy, gdy `charges_enabled` jest true i wymagana capability ma status `active`.

## 12. Migracja z obecnych napiwków na koncie platformy

- **[INFERENCE]** Historyczne PaymentIntents i salda zostają na koncie platformy PL bez zmian. Connect włącza się na tym samym koncie, które staje się platformą, i wymaga uzupełnienia profilu platformy w Dashboardzie.
- Nowe napiwki dla kanału właściciela mają dwie możliwości:
  - (a) Właściciel jako osoba fizyczna zakłada konto połączone jak każdy twórca. To czystsze i spójne.
  - (b) Napiwki dla „kanału platformy” zostają platform charges, bez Connect. Ma to sens tylko wtedy, gdy kanał należy do tego samego podmiotu co platforma.
- Jeśli platformą będzie sp. z o.o., a kanał należy do właściciela prywatnie, napiwki nie powinny wpadać na konto spółki. **[INFERENCE, do doradcy]**
- Superadmin bez kanału nie potrzebuje konta połączonego. Prowizje (application fees) trafiają na saldo platformy. **[INFERENCE]**
- **Prowizja platformy:**
  - 0% na start upraszcza VAT i regulamin, a w modelu A koszt platformy wynosi 0 zł.
  - X% (np. 5–10%) ustawia się przez `application_fee_amount`.
  - Ko-fi bierze 0–5%, a BMC 5%. [FACT-secondary]
  - Przy `fees_collector=stripe` Stripe dodatkowo pobiera od twórcy opłatę płatniczą.
- **Testy:**
  - Tryb testowy lub sandbox. SMS `000-000`. Daty urodzenia: `1901-01-01` daje match, `1900-01-01` wywołuje alert OFAC.
  - ID `000000000`, adres `address_full_match`. IBAN PL do testów: `PL61109010140000071219812874` (sukces), `PL62370400440532013001` (`no_account`).
  - Tokeny wyzwalające wymagania i blokady: `4000000000004202`, `…4210`, `…4236`.
  - BLIK testuje się wzorcami e-mail. [FACT: connect/testing; destination-charges]
  - `stripe listen --forward-connect-to …` do zdarzeń Connect. [FACT: connect/webhooks]
  - Sandboxy mogą nie egzekwować capabilities. [FACT: account-capabilities]

## 13. Specyfika polska

- Konta połączone dla osób fizycznych w PL są wspierane (`individual`, w tym JDG). Dla platformy PL dostępne są capabilities `card_payments`, `transfers`, `blik_payments` i `p24_payments`. [FACT: endpoint PL]
- BLIK na kontach połączonych działa, jeśli `blik_payments` jest aktywne na platformie i na koncie. Waluta PLN. [FACT: payments/blik]
- Wypłaty w PLN na polski rachunek: **[INFERENCE, wysoka pewność]** PLN jest walutą lokalną dla PL. Tabela walut rozliczeniowych nie wczytała się, więc trzeba to sprawdzić.
- Instant Payouts w PL działają na kartę debetową, w zakresie 2–9999 PLN. [FACT: instant-payouts]
- Platforma PL nie może używać umowy `recipient`. Nie działają też Global Payouts (tylko platformy US i UK) ani narzędzie DAC7 Stripe. [FACT]

---

## Ryzyka i pytania do Stripe i doradcy

**Do Stripe (przed implementacją):**
1. Czy wielotwórcza platforma wideo z napiwkami (PL) dostanie preapproval jako „content creation platform”? Jakie kontrole moderacji i KYC chcecie zobaczyć?
2. Potwierdźcie konfigurację: direct charges + `losses=stripe` + `fees=account` + `dashboard=none` dla platformy PL i kont PL/EOG/UK/US, z capabilities BLIK i P24 na kontach twórców.
3. Jakie MCC przypisać kontom twórców i platformie, żeby nie wypaść z P24 (5262 i 8398 są prohibited, 5815 i 7929 restricted)? Jak P24 traktuje osoby fizyczne bez NIP i numeru rejestrowego, skoro wymaga ich na stronie sprzedawcy?
4. Czy deskryptor lub prefix twórcy może zawierać markę platformy?
5. Niespójność w docs: cross-border payouts a umowa recipient i Global Payouts. Jak to wygląda dla platformy PL?
6. Accounts v2: czy jest GA dla platform PL bez nagłówka preview?
7. Polityka wobec nieletnich twórców i przyjmowania napiwków od nieletnich płatników.

**Do doradcy podatkowo-prawnego:**
1. Platforma jako MoR czy twórca jako MoR: skutki w PIT/CIT, VAT i ustawie o usługach płatniczych (czy model B nie jest świadczeniem usług płatniczych bez licencji, mimo Stripe).
2. VAT i podatek dochodowy od napiwków u twórcy (Tolsma: brak świadczenia wzajemnego?) oraz VAT od prowizji platformy (B2C e-usługi, OSS).
3. DAC7: czy napiwki za treści to „relevant activity”? Jeśli tak, platforma PL raportuje sama, bo Stripe nie wspiera PL.
4. Forma prawna: JDG, sp. z o.o. czy US LLC. Przy US LLC z rezydentem PL dochodzi ryzyko zakładu i miejsca zarządu oraz obowiązki DAC7 dla operatora spoza UE (rejestracja w państwie UE).
5. Regulamin twórcy (Platform Provider Agreement), regulamin napiwkodawcy (wskazanie MoR, zasady zwrotów) i RODO (dane KYC przetwarza Stripe, my jesteśmy administratorem danych konta).

**Ryzyka techniczne i operacyjne:**
- Responsibilities są nieodwracalne po utworzeniu konta. Zła konfiguracja wymaga utworzenia nowego konta.
- Niektóre komponenty otwierają popup uwierzytelnienia Stripe. Nasz nagłówek COOP nie może być ustawiony na `same-origin`.
- Strony pobrane przez narzędzie mogły zostać streszczone. Strona cennika US przekierowała do PL. Tabela walut rozliczeniowych i strona minimalnego wieku nie zostały pobrane w całości.

---

## Źródła (dostęp 2026-10-13)

- https://docs.stripe.com/connect/accounts-v2/connected-account-configuration
- https://docs.stripe.com/connect/charges
- https://docs.stripe.com/connect/destination-charges.md?platform=web&ui=elements
- https://docs.stripe.com/connect/integration-recommendations
- https://docs.stripe.com/connect/cross-border-payouts
- https://docs.stripe.com/connect/service-agreement-types
- https://docs.stripe.com/connect/account-capabilities
- https://docs.stripe.com/connect/supported-embedded-components.md?platform=web
- https://docs.stripe.com/connect/get-started-connect-embedded-components.md?platform=web
- https://docs.stripe.com/connect/build-full-embedded-integration
- https://docs.stripe.com/connect/merchant-of-record
- https://docs.stripe.com/connect/risk-management/managed-risk
- https://docs.stripe.com/connect/direct-charges-fee-payer-behavior
- https://docs.stripe.com/connect/accounts-v2
- https://docs.stripe.com/connect/statement-descriptors
- https://docs.stripe.com/connect/webhooks
- https://docs.stripe.com/connect/payouts-connected-accounts
- https://docs.stripe.com/connect/instant-payouts
- https://docs.stripe.com/connect/testing
- https://docs.stripe.com/connect/tax-reporting
- https://docs.stripe.com/connect/platform-tax-reporting
- https://docs.stripe.com/connect/required-verification-information
- https://docs.stripe.com/_endpoint/get-requirement-selections-for-platform-country?platformCountry=PL
- https://docs.stripe.com/_endpoint/get-requirement-selections-for-platform-country?platformCountry=US
- https://docs.stripe.com/_endpoint/get-requirements-for-setups (setup: v1, PL→PL, express, full, individual, card_payments+transfers)
- https://docs.stripe.com/payments/blik
- https://docs.stripe.com/payments/p24
- https://docs.stripe.com/payments/payment-methods/payment-method-connect-support
- https://docs.stripe.com/payments/managed-payments
- https://docs.stripe.com/payments/managed-payments/eligibility
- https://stripe.com/connect/pricing (wersja PL; stripe.com/us/connect/pricing przekierowało do PL)
- https://stripe.com/legal/restricted-businesses
- https://stripe.com/legal/connect-account
- https://support.stripe.com/questions/prohibited-and-restricted-businesses-list-faqs
- https://support.stripe.com/questions/requirements-for-accepting-tips-or-donations
- https://support.stripe.com/questions/age-requirement-to-create-a-stripe-account (tylko przez wyniki wyszukiwania)
- https://docs.stripe.com/tax/tax-codes (tylko przez wyniki wyszukiwania)
- https://www.podatki.gov.pl/podatkowa-wspolpraca-miedzynarodowa/dpi-digital-platform-information (przez wyszukiwanie)
- https://grantthornton.pl/publikacja/dac7-nowe-obowiazki-dla-operatorow-platform/ (przez wyszukiwanie)
- https://help.ko-fi.com/hc/en-us/articles/360007522474 (przez wyszukiwanie)
- https://www.podfeet.com/blog/2024/11/buy-me-a-coffee/ (przez wyszukiwanie)
- https://flexprice.io/blog/stripe-pricing-breakdown-2026 i https://drop-desk.com/blog/guides/stripe-fees-for-marketplace-operators/ (wtórne, cennik US)
- Nie załadowało się: https://docs.stripe.com/connect/dac7 (404).
