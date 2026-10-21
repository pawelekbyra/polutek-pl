# Napiwki i płatności (Stripe)

Stan 2026-10-05. Serwis jest niekomercyjny: napiwek niczego nie odblokowuje. Płatności istnieją tylko jako dobrowolne wsparcie i prywatna ewidencja właściciela.
Źródło prawdy o nazwach: kod (`lib/modules/payments/`, `lib/modules/patron/`, `app/components/support/`). Audyt płatności: `../audit/2026-10-05/audit-payments.md`.

## Ewidencja wspierających (`PatronGrant`)

- Tabela `PatronGrant` jest jedynym źródłem informacji, że ktoś wspierał. **Nigdy nie decyduje o dostępie do filmów** (patrz `CLAUDE.md` §4.4).
  Nie wolno wprowadzać z powrotem `PatronGrant`/`getPatronStatus()` do `checkVideoAccess()` bez wyraźnej decyzji właściciela o odwróceniu modelu niekomercyjnego.
- Decyzja 2026-10-03 „wpłacił = patron”: każda udana wpłata oznacza płacącego (bez progu kwoty); wystarczy jeden aktywny grant `STRIPE_TIP` na użytkownika.
  Zwrot lub spór jednej wpłaty zdejmuje oznaczenie tylko wtedy, gdy nie zostaje żadna inna opłacona, w pełni niezwrócona wpłata (`lib/modules/payments/application/supporter-grant.ts`).
  Granty `ADMIN`/`LEGACY`/`MIGRATION` nigdy nie są tam odbierane. Odebranie zapisuje `revokedAt`/`revokeReason`/`revokedById`, nigdy nie zmienia `reason` grantu.
- Decyzja 2026-10-04: wpłata nie daje **żadnej** publicznej korzyści, nawet plakietki. Status wspierającego widzi tylko administrator (płacący widzi podziękowanie po własnej wpłacie).
  Nie umieszczaj go w publicznych DTO, `/api/user/profile`, układzie sidebara ani w tekstach UI. Odczyty administracyjne używają `patronGrants: { some: { revokedAt: null } }`.
- Pól `User.isPatron`, `User.patronSince`, `User.patronSource` nie ma (migracja `20260630000000_remove_legacy_user_patron_cache`). Nie zapisuj ani nie czytaj statusu z tabeli `User`.
  `recalculatePatronStatus()` to czysty odczyt. Pola DTO o nazwie `isPatron` mogą być tylko wyliczone z grantów albo roli.

## Cykl życia płatności

```
okno napiwku, krok kwoty -> POST /api/checkout/create-intent
  -> jedno Payment(PENDING) + jeden PaymentIntent na próbę (requestId klienta w sessionStorage;
     zmiana kwoty/waluty AKTUALIZUJE ten intent, nie otwiera nowego)
potwierdzenie w Stripe.js -> płatność udana w Stripe
  -> fulfillPayment(), z tego, co przyjdzie pierwsze (wszystko powtarzalne bez szkody):
       webhook payment_intent.succeeded | GET /api/payments/[id] (szybka ścieżka) | cron stripe-reconciliation
       -> CAS PENDING|FAILED|CANCELED -> SUCCEEDED (źródłem prawdy jest `succeeded` w Stripe ze sprawdzoną kwotą, walutą, intentem i użytkownikiem)
       -> znacznik wspierającego (PatronGrant STRIPE_TIP), jeśli nie ma aktywnego
       -> po zatwierdzeniu transakcji: e-mail z podziękowaniem i powiadomienie (nigdy wewnątrz transakcji)
```

- `fulfillPayment()` (`lib/modules/payments/application/fulfill-payment.use-case.ts`) jest idempotentne. Zawsze go używaj; nigdy ręcznych `updateMany({ status: 'SUCCEEDED' })`.
- `payment_intent.payment_failed` to jedna nieudana **próba**: płatność zostaje `PENDING` (intent wraca do `requires_payment_method`, kolejna próba może się udać).
  Nieopłacone napiwki zamyka cron uzgadniania po 24 h (intent anulowany w Stripe, wiersz `CANCELED`); `?scope=recover` sprawdza też `FAILED`/`CANCELED`.
- Webhook (`handleStripeWebhook`) weryfikuje podpis na surowym ciele (`Stripe.webhooks.constructEvent`), loguje każde przyjęte i odrzucone zdarzenie (tylko id i typy), ignoruje zdarzenia z innym `livemode`
  niż klucz oraz `succeeded` bez `metadata.paymentId` (200), a kod inny niż 2xx zwraca tylko gdy Stripe ma ponowić. Spory rozstrzyga się po aktualnym statusie z Stripe (zdarzenia mogą przyjść w złej kolejności).
  Zwroty administratora mają klucz idempotencji i zawsze trafiają do audytu.
- **Szybka ścieżka powrotu:** `getOwnedPaymentStatus()` (`GET /api/payments/[paymentId]`) dla własnej, nadal `PENDING` płatności z `stripeIntentId` pyta Stripe i przy `succeeded` woła `fulfillPayment()`;
  sprawdza też wiersze `FAILED`/`CANCELED`. Błąd Stripe/sieci jest połykany (wraca zwykłe odpytywanie): to najlepszy wysiłek, nie nowe źródło prawdy.
- **Komunikat na stronie powrotu ufa sygnałowi Stripe.** `useCheckoutFlow` czyta `redirect_status`: `succeeded` (lub brak przy zwykłej karcie) pokazuje pełne podziękowanie od razu, `failed` ekran porażki,
  `pending`/`processing` neutralny ekran przetwarzania. Pętla uzgadniania tylko **podnosi** ekran przetwarzania do sukcesu, nigdy nie cofa pokazanego sukcesu; do UI nie trafia surowy enum ani żargon „webhook”.
  Zamknięcie ekranu sukcesu robi pełne `window.location` do czystego adresu (nie `router.replace`), żeby wszystkie powierzchnie renderowane na serwerze wróciły świeże.

## Okno napiwku (ukryte od 2026-10-21, kod zostaje celowo)

Okno jest nieosiągalne z interfejsu: `TIP_GATE_ENABLED = false` (`app/components/channel/tip-gate.ts`), nic nie wysyła `polutek:open-support`, a `?support=1` i powrót ze Stripe nie otwierają go. Złoty przycisk „Kup se Premium” w Hero otwiera kasę strefy patrona (`patron-zone.md`). Część `app/components/support/*` (`TipPayStep`, `TipPayFrame`, `TipSelect`) jest współdzielona z tą kasą i działa. Poniżej opis okna, gdy jest włączone.

`app/components/channel/SupportModal.tsx` (+ `app/components/support/*`), otwierane zdarzeniem `polutek:open-support`, obsługiwane w `ChannelHome` (po włączeniu `TIP_GATE_ENABLED`).
Niezalogowany najpierw dostaje okno logowania. `ChannelHome` otwiera je też przy wejściu na `?support=1` (parametr jest od razu usuwany) i po powrocie ze Stripe (`?success=true&payment_id=...`, krok podziękowania; `UrlMask` zachowuje te parametry do tego czasu).
Montowane tylko, gdy otwarte; Stripe.js ładuje się leniwie stamtąd (`lib/payments/stripe-browser.ts`, `@stripe/stripe-js/pure`). **Nigdy nie dodawaj `loadStripe()` na poziomie modułu.**

Kroki (`STEPS`): adresat (pole zgody na Regulamin/Politykę; zgoda trafia na serwer przy `create-intent`: `recordTermsAcceptance`) → zastrzeżenie („napiwek niczego nie odblokowuje”) → kwota (waluta z `detectDefaultCurrency`,
dowolna kwota, minimum z `/api/payment-settings`) → metoda → formularz metody → podziękowanie. Krok kwoty tworzy lub aktualizuje PaymentIntent próby; kafelki metod pochodzą z jego `payment_method_types`
(`getTipMethodTiles()`) plus Apple Pay / Google Pay, gdy urządzenie je ma, oraz makieta „Crypto”, która nie pobiera pieniędzy. Każda metoda potwierdza ten sam intent własnym wywołaniem Stripe.js
(`TipPayStep.tsx`: BLIK, P24, karta, portfele przez `ExpressCheckoutElement`, reszta przez `PaymentElement`); ref chroni przed podwójnym potwierdzeniem.
Opis intentu buduje serwer (`tipIntentDescription()`), nigdy klient. Kod klienta używa `APP_NAME`, nie `MAIN_CREATOR_NAME` (to nie zmienna `NEXT_PUBLIC_`). Okno ma stałe wymiary na desktopie i pełny ekran na telefonie;
Regulamin i Polityka otwierają się w `TipLegalDialog` nad oknem.

**Jedno minimum na walutę.** `PaymentCurrencySetting.minAmountMinor` (panel: Ustawienia → Płatności) to minimum pokazywane w oknie i egzekwowane na serwerze (`getPaymentCurrencyLimits()`, `GET /api/payment-settings` → `{ limits }`).
Kolumny `patronThresholdMinor` (martwa) i `patronBoxMinMinor` (liczy się jako max(min, boxMin) do następnego zapisu w panelu) mają zniknąć w migracji czyszczącej.

## Pasek zbiórki

Opis i źródło danych (liczy wszystkie udane napiwki kanału): `premieres-and-fundraising.md`.

## Płatności strefy patrona

Za przełącznikiem `PREMIUM_PASS_PAYMENTS=stripe` (domyślnie `demo`, bez pieniędzy) ten sam stos obsługuje też prawdziwą płatność za dostęp do strefy patrona: `createCheckoutIntent({ purpose: "premium_pass" })`, ten sam webhook,
szybka ścieżka i cron. Płatność ma `metadata.purpose = "premium_pass"` (wiersz `Payment` i PaymentIntent). `fulfillPayment()` dla niej zamiast znacznika wspierającego i maila napiwkowego przyznaje dostęp
(`AppSetting xp.premium_pass:<userId>`, w tej samej transakcji), pełny zwrot zdejmuje jej 30 dni, a pasek zbiórki jej nie liczy (to sprzedaż, nie napiwek). Pełny opis, limity i włączanie: `patron-zone.md`; braki przed prawdziwą sprzedażą: `patron-zone-audit.md`.
