# Zwroty i spory Stripe: plan testu w test-mode

Dotyczy zmian z gałęzi `fix/payments-refund-dispute`: blokada wiersza `Payment` (`SELECT … FOR UPDATE`) w `handleRefund` i `handleDispute`
oraz brak drugiego odejmowania od `UserPaymentTotal`, gdy zwrot przychodzi po przegranym sporze (`CHARGEBACK_LOST`). Źródło: audyt AUDYT-3 (P3).
Testy automatyczne (`tests/postgres/payments.pg.test.ts`) zastępują Stripe atrapą; ten plan sprawdza prawdziwe zdarzenia Stripe. **Nigdy na kluczach LIVE.**

## Warunki
- Instancja z kluczami TEST (np. zestaw Premium `PREMIUM_PASS_STRIPE_*`, `PREMIUM_PASS_PAYMENTS=stripe`), webhook test-mode wskazujący tę instancję, osobne konto testowe.
  Na produkcji tylko za zgodą właściciela (zapisy trafiają do prawdziwej bazy). Płatność zawsze przez kasę aplikacji (musi istnieć `Payment` z `metadata.paymentId`).
- Karty: `4242 4242 4242 4242` (zwykła), `4000 0000 0000 0259` (płatność, na której Stripe od razu otwiera spór). Wynik sporu w test-mode: dowód
  `winning_evidence` albo `losing_evidence`: `stripe disputes update dp_… -d "evidence[uncategorized_text]=losing_evidence" -d submit=true`.
- Zwrot: Dashboard → Payments → Refund albo `stripe refunds create --payment-intent pi_… --amount <grosze>`. Ponowienie zdarzenia: `stripe events resend evt_…`
  albo Dashboard → Developers → Webhooks → zdarzenie → Resend. Podgląd: `stripe events list --limit 10`. Przed każdym scenariuszem zapisz T (suma użytkownika) i A (kwota).

## Zapytania kontrolne (tylko odczyt: `BEGIN READ ONLY; … ROLLBACK;`)
```sql
SELECT id, status, "amountMinor", "refundedAmountMinor", currency FROM "Payment" WHERE "stripeIntentId" = 'pi_…';
SELECT currency, "amountMinor" FROM "UserPaymentTotal" WHERE "userId" = '<userId>';
SELECT "createdAt", "revokedAt", "revokeReason" FROM "PatronGrant" WHERE "userId" = '<userId>' ORDER BY "createdAt";
SELECT value FROM "AppSetting" WHERE key = 'xp.premium_pass:<userId>';
SELECT id, type, status, error FROM "StripeEvent" ORDER BY "createdAt" DESC LIMIT 20;
```

## Scenariusze (oczekiwany wynik w bazie)
| # | Kroki | Oczekiwane |
|---|---|---|
| 1 | Płatność Premium kartą 4242 (T = suma przed płatnością) | `SUCCEEDED`; suma T+A; `xp.premium_pass` zawiera id płatności |
| 2 | Zwrot częściowy 30% | `PARTIALLY_REFUNDED`, `refundedAmountMinor`=0,3A; suma T+0,7A; dostęp zostaje |
| 3 | Dopełnienie do zwrotu pełnego | `REFUNDED`; suma T; id płatności znika z `xp.premium_pass` |
| 4 | Resend zdarzeń z kroków 2 i 3 | nic się nie zmienia; `StripeEvent` bez błędów |
| 5 | Dwie płatności Premium, pełny zwrot jednej | suma spada tylko o jedną; dostęp z drugiej zostaje (ok. 30 dni) |
| 6 | Karta 0259 (T = suma przed płatnością), spór otwarty | `DISPUTED`; suma T+A (spór otwarty jej nie zmienia) |
| 7 | Spór z 6 przegrany (`losing_evidence`) | `CHARGEBACK_LOST`; suma T (spadek dokładnie o A) |
| 8 | Po 7 próba zwrotu (Stripe zwykle odmawia) | jeśli przejdzie: `refundedAmountMinor` rośnie, status `CHARGEBACK_LOST`, suma nadal T |
| 9 | Nowa płatność 0259, spór wygrany (`winning_evidence`) | `DISPUTED`, potem `SUCCEEDED`; suma T+A |
| 10 | Zwrot częściowy r w czasie otwartego sporu, potem spór wygrany | `PARTIALLY_REFUNDED`; suma T+A−r |
| 11 | Zwrot częściowy r, potem spór przegrany | `CHARGEBACK_LOST`; suma T (nie T−r) |
| 12 | Poza kolejnością: wyłącz endpoint, zrób zwrot i spór, włącz, wyślij ponownie najpierw spór, potem zwrot | brak podwójnego odjęcia; suma jak w 11; ewentualne `PAYMENT_NOT_RECORDED_YET` znika po ponowieniu |
| 13 | Równolegle: `stripe events resend` dla zwrotu i `charge.dispute.closed` w tej samej chwili (dwa terminale) | brak deadlocka i błędów 5xx w logach; status i suma jak w 11 |
| 14 | Płatność Premium kartą 0259 (spór otwiera się od razu); konto bez innych wpłat Premium | `DISPUTED`; `xp.premium_pass` **bez zmian** (id płatności zostaje); film Premium: ekran zakupu (`PASS_REQUIRED`), `GET /api/user/premium-pass` = `expired`; brak plakietki VIP przy komentarzu i obwódki VIP awatara |
| 15 | Spór z 14 wygrany (`winning_evidence`) | `SUCCEEDED`; bez ręcznej zmiany: film Premium znów się odtwarza, status `active` z tą samą datą końca co przed sporem, VIP wraca |
| 16 | Nowa płatność 0259, spór przegrany (`losing_evidence`) | `CHARGEBACK_LOST`; id płatności znika z `xp.premium_pass`, `expiresAt` ≤ chwila zdarzenia; brak dostępu i VIP; ponowne wysłanie zdarzeń (`events resend`) nic nie zmienia |
| 17 | Dwie płatności Premium (4242, potem 0259 ze sporem) | spór otwarty: dostęp i VIP zostają, data końca ok. 30 dni (z 4242); po przegranej: w `xp.premium_pass` zostaje tylko id płatności 4242, dostęp ok. 30 dni |

## Poza zakresem tej zmiany
- Scenariusze 14–17 dotyczą gałęzi `feat/premium-dispute-access` (decyzja DP01): spór otwarty zawiesza dostęp Premium, wygrany przywraca, przegrany odbiera. Częściowy zwrot (scenariusz 2) dostępu nie zmienia.
- Uwaga do 14: token odtwarzania wydany przed sporem działa do końca swojego TTL; sprawdzaj nowe otwarcie filmu (świeży plan), nie odtwarzanie już trwające.
- Limity body i trasa webhooka (podpis, 1 MB) się tu nie zmieniają (paczka 1.3). Napiwki LIVE: po wdrożeniu tylko obejrzeć pierwszy żywy webhook (200).
