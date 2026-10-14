# Odporność płatności: wielu dostawców i krypto (notatka, system NIEAKTYWNY)

Status: **pomysł zapisany do przemyślenia, nic z tego nie jest wdrażane ani planowane do wdrożenia** (decyzja właściciela, 2026-10-14). Dokument nie zmienia żadnych zasad z CLAUDE.md §4.x ani modelu sprzedaży z `multi-creator-platform.md`.

## 1. Pomysł wyjściowy

Router płatności z trzema warstwami: (1) bramka hybrydowa karta/Google Pay/Apple Pay/BLIK z rozliczeniem w stablecoinie (USDC) na własny portfel, (2) Stripe jako zapas z natychmiastową wypłatą ("instant drain"), (3) czysty checkout kryptowalutowy (BTCPay Server, Lightning, Monero) przy pełnej blokadzie systemów tradycyjnych. Cel: konwersja bliska Web2 i odporność na blokadę konta oraz chargebacki.

## 2. Co ustaliło badanie (2026-10-14)

Źródła wtórne i marketingowe, cenniki niezweryfikowane w oficjalnych dokumentach.

- **Ramp Network** (onramp karta → USDC): prowizja u klienta do ok. 3,9% przy karcie plus opłata sieciowa; rozliczenia w USDC/USDT na adres partnera; ryzyko sporów kartowych zwykle po stronie onrampu, ale zależy od umowy partnerskiej (nie znaleziono). https://rampnetwork.com/partners-terms-conditions
- **Helio / MoonPay Commerce**: karta → stablecoin, deklarowany brak chargebacków; cennik zmieniał się (0%, 0,75%, 2%). https://onramper.com/blog/helio-partners-with-onramper-to-power-unique-card-to-stablecoin-payments-for-global-merchants
- **CoinGate**: 1% prowizji, rozliczenie w krypto lub EUR/USD, zwroty obsługiwane ręcznie przez sprzedawcę (brak chargebacków). https://coingate.com/pricing
- **Triple-A**: rozliczenie w fiat następnego dnia, wymaga KYB. https://www.triple-a.io/marketplaces
- **Stripe**: przyjmuje USDC (wg źródeł wtórnych 1,5%), rozliczenie w USD lub USDC; to ten sam panel co dla kart. https://eco.com/support/en/articles/15083174-stripe-stablecoin-payments-2026
- **Prawo**: od 2 marca 2026 transakcje na stablecoinach typu EMT będące usługą płatniczą muszą spełniać PSD2 (samo MiCA CASP nie wystarcza). https://www.morganlewis.com/pubs/2026/02/eba-issues-supervisory-priorities-as-psd2-mica-transition-period-for-emt-activities-ends . W Polsce ustawa wyznaczająca organ nadzoru nad kryptoaktywami była zawetowana, polska licencja CASP nie jest obecnie dostępna (źródła rozbieżne, sprawdzić stan). https://comparic.pl/jest-kolejna-decyzja-ws-ustawy-o-kryptowalutach-w-polsce-prezydent-trzyma-twardo-na-swoim/

## 3. Dlaczego to nie pasuje do naszego modelu

- Jesteśmy sprzedawcą rozliczającym VAT (merchant of record). Konsument ma prawo do zwrotu (14 dni, treści cyfrowe z wyłączeniami), więc nieodwracalna płatność na portfelu nie zdejmuje z nas obowiązku zwrotów, tylko przenosi je na własne przelewy.
- Kupujący kartą u onrampu zwykle przechodzi KYC dostawcy; "prosty UX" nie jest gwarantowany.
- Prowizje nie są niższe niż standard kartowy w Stripe; zysk jest tylko w przeniesieniu ryzyka chargebacków, jeśli umowa tak stanowi.
- Przychód w krypto wymaga wyceny w PLN w dniu transakcji i ewidencji kursów; faktury i VAT liczy się od kwoty brutto w walucie fiducjarnej.
- "Instant drain" (natychmiastowe wypłaty całości salda) jest wzorcem, który wywołuje alerty AML; bezpieczniejsza jest codzienna wypłata z rezerwą na zwroty.
- Klucze prywatne to nowa odpowiedzialność (utrata = trwała strata, brak rzecznika).
- Warstwa 3 (BTCPay, Monero) pasuje do darowizn, nie do sprzedaży z fakturą VAT i prawem do zwrotu.

## 4. Lepsza ścieżka, gdyby wrócić do tematu

1. **Port dostawcy płatności** w module `lib/modules/sales` (już istnieje `providerRef`, idempotentne `recordOrderPaid`, `refundOrder` z wstrzykiwanym `issueRefund`). Router wybiera dostawcę z konfiguracji i wyłącza go po serii błędów (circuit breaker).
2. **Kolejność dostawców:** Stripe (karty, BLIK, P24) jako główny; drugi zwykły dostawca z BLIK i kartami jako zapas (np. Przelewy24, PayU, Mollie lub Adyen); dopiero na końcu krypto jako dodatkowy sposób dla napiwków i darowizn, bez obietnicy zwrotów, za wyłącznikiem.
3. **Ochrona środków:** codzienna wypłata z konta pośrednika, rezerwa na zwroty, Stripe Radar, monitoring sporów.
4. **Warunki wstępne:** decyzja o podmiocie prawnym i VAT (patrz `docs/audit/2026-10-13/`), opinia prawnika (PSD2/MiCA, AML, zwroty), umowa z dostawcą przenosząca ryzyko chargebacków na piśmie.

## 5. Pytania do prawnika i księgowego (zanim cokolwiek powstanie)

- Czy przyjmowanie USDC od licencjonowanego pośrednika w modelu merchant of record wymaga od nas jakiejkolwiek rejestracji (MiCA, ustawa o kryptoaktywach, AML)?
- Jak ujmować przychód w kryptowalucie (kurs, moment, VAT, PIT/CIT) i wypłaty twórcom w PLN?
- Czy wymaganą informację o prawie odstąpienia i wyłączeniu dla treści cyfrowych da się spełnić w checkoutach zewnętrznych dostawców?
- Czy "natychmiastowa wypłata" środków z konta pośrednika jest zgodna z jego regulaminem i nie narusza zasad AML?
