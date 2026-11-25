# Strefa Premium: włączenie prawdziwej sprzedaży (go-live)

Stan na **2026-11-25** (`main` = `f3a1ab58`). Dokument tylko opisuje; nic nie zostało włączone. Odczyty produkcji i Stripe były wyłącznie do odczytu (żądania GET, bez wypisywania kluczy).
Szczegóły działania: [`../architecture/patron-zone.md`](../architecture/patron-zone.md); pełna lista braków z 2026-10-21: [`../architecture/patron-zone-audit.md`](../architecture/patron-zone-audit.md).

## 1. Jak działa bramka (w skrócie)

- Kasa Premium pobiera pieniądze tylko przy `PREMIUM_PASS_PAYMENTS=stripe` (`resolvePremiumPayments`, `lib/modules/patron-zone/domain/payments-mode.ts`). Wymaga: klucz secret i publishable tego samego trybu, sekret webhooka, a przy kluczach **live** dodatkowo `PLATFORM_GATE_SALES=on` (`lib/platform-gates.ts`). Brak czegokolwiek = kasa „Płatności chwilowo niedostępne” (nigdy nie wraca do demo).
- Dwa zestawy kluczy (`lib/payments/stripe-key-sets.ts`): `default` = `STRIPE_*` (dziś **live**, napiwki) i `premium` = `PREMIUM_PASS_STRIPE_SECRET_KEY` + `NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY` + `PREMIUM_PASS_STRIPE_WEBHOOK_SECRET` (dziś **test**). Premium działa tylko, gdy ustawione są wszystkie trzy; inaczej kasa bierze zestaw `default`.
- Kluczy testowych bramka nie blokuje: stąd dzisiejszy napis „Tryb testowy: bez prawdziwej płatności”. Przy kluczach live napis znika sam, w karcie sprzedawcy jest „Bezpieczna płatność”.
- `PLATFORM_GATE_SALES` nie dotyczy napiwków (`/api/checkout/create-intent` jej nie sprawdza). Moduł `lib/modules/sales` też jej używa, ale nie ma do niego żadnej trasy ani ekranu, więc w praktyce bramka otwiera tylko kasę Premium.
- `NEXT_PUBLIC_*` są wkompilowane w przeglądarkę przy budowie (`build.env`, lista dozwolonych w `deploy/release/release-build.sh`). Serwer czyta je w trakcie działania z `app.env`. Zmiana klucza publishable = nowy obraz; zmiana flag i kluczy secret = tylko restart `app`.
- Webhook `/api/webhooks/stripe`: próbuje po kolei `STRIPE_WEBHOOK_SECRET`, potem `PREMIUM_PASS_STRIPE_WEBHOOK_SECRET`; pierwszy pasujący wybiera zestaw. Zdarzenie z innym trybem (test/live) niż klucz zestawu albo dla płatności z drugiego zestawu jest ignorowane z alarmem.
- Obsługiwane zdarzenia: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, `charge.refund.updated`, `refund.created`, `refund.updated`, `refund.failed`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`.
- Pełny zwrot i przegrany spór odbierają dostęp (`revokePatronAccessForPayment`); otwarty spór go zawiesza. Cron `polutek-cron-stripe-reconciliation.timer` (co 15 min) uzgadnia płatności, każdą jej własnym zestawem kluczy.

## 2. Stan produkcji (odczyt 2026-11-25)

| Rzecz | Stan |
|---|---|
| `PLATFORM_GATE_SALES` | **nieustawione = off** |
| `PREMIUM_PASS_PAYMENTS` / `PREMIUM_PASS_EXPERIMENT` | `stripe` / `all` |
| `STRIPE_*` (napiwki) | `sk_live`, `pk_live`, webhook secret ustawiony (app.env i build.env) |
| `PREMIUM_PASS_STRIPE_*` | komplet **testowy** (`sk_test`, `pk_test` w app.env i build.env, webhook secret) |
| `NEXT_PUBLIC_PLATFORM_VAT_STATUS` | nieustawione = `exempt` (domyślne z `lib/config/vat.ts`) |
| Konto Stripe live | PL, `individual` (osoba fizyczna), nazwa „Paweł Perfect”, płatności i wypłaty włączone, brak zaległych wymagań KYC; wypłaty ręczne |
| Metody na koncie live | aktywne: karta, BLIK, P24, Apple/Google Pay, Link, Klarna, Revolut Pay i in. |
| Profil Stripe do poprawy | opis na wyciągu `WWWW.PAWELPERFECT.PL` (cztery „W”), strona `www.pawelperfect.pl` (serwis działa na `.com`), MCC 7929 (artyści), brak NIP |
| Webhook **live** | tylko 5 zdarzeń: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed` |
| Webhook **test** (premium) | wszystkie 11 zdarzeń |

## 3. Co musi być prawdą przed włączeniem

**Biznes i prawo (właściciel, księgowa, prawnik)**
- [ ] JDG zarejestrowana (CEIDG, start 2027-01-01), jest NIP i adres do doręczeń. Zgłoszenie złożyć w grudniu z datą rozpoczęcia 1.01.2027.
- [ ] Księgowa potwierdza: zwolnienie podmiotowe z VAT dla tej usługi (art. 113), sprzedaż do klientów z UE w EUR/GBP/CHF/USD (próg 10 000 EUR, potem VAT kraju klienta/OSS), zwolnienie z kasy fiskalnej przy płatności przez operatora, ewidencja przychodów, faktury na żądanie (Odoo) i ewentualnie KSeF.
- [ ] Regulamin Strefy Premium ostateczny (dziś „(projekt)”, `PassTermsContent.tsx`, wersja `patron-2026-10-draft`), zatwierdzony przez prawnika; poprawiony regulamin serwisu i polityka prywatności (płatności, zgody, sprzedawca); podniesione `LEGAL_DOCUMENTS_VERSION` i `PASS_TERMS_VERSION`.
- [ ] Brzmienie zgody na utratę prawa odstąpienia zatwierdzone przez prawnika. Dziś: „Chcę dostępu od razu. Wiem, że gdy zacznę oglądać, tracę prawo odstąpienia” (`PassPaymentStep.tsx`); dostęp startuje przy płatności, nie przy oglądaniu. Zgoda jest wymagana przez serwer i zapisywana w płatności (to działa).
- [ ] Decyzja o zwrotach (np. zwrot na prośbę w 14 dni, jeśli klient nie oglądał) wpisana do regulaminu.

**Dane w kodzie (dev, po JDG)**
- [ ] `PATRON_SELLER.nip` i adres w `app/components/premium-pass/pass-copy.ts`; usunąć dopisek „(dane demo)” z `sellerName()` (ekran sukcesu).
- [ ] Mail „Potwierdzenie zakupu” (trwały nośnik, art. 21 u.p.k.): dziś nie istnieje, `fulfillPayment()` pomija maile dla Premium. Bez niego klient nie traci prawa odstąpienia. **Blokuje.**
- [ ] Napis o zwolnieniu z VAT („sprzedawca zwolniony z VAT”) zaakceptowany przez księgową.
- [ ] Logotypy Visa/Mastercard (`PassTrustRow.tsx`) podmienione na oficjalne pliki od organizacji kartowych.
- [ ] Testowe wiersze dostępu (DEMO i z kluczy testowych) usunięte z produkcji albo świadomie zostawione.

**Stripe (właściciel, w panelu)**
- [ ] Profil konta zaktualizowany na JDG: NIP, adres, strona `www.pawelperfect.com`, opis na wyciągu bez literówki, MCC dla treści cyfrowych (np. 5815), opis działalności „sprzedaż dostępu do filmów”.
- [ ] Webhook live: dodać brakujące zdarzenia `payment_intent.canceled`, `charge.refund.updated`, `refund.created`, `refund.updated`, `refund.failed`, `charge.dispute.updated`.
- [ ] Metody: BLIK i P24 aktywne (są); sprawdzić w ustawieniach metod, że są włączone dla domyślnej konfiguracji; domena `www.pawelperfect.com` zarejestrowana dla Apple Pay.
- [ ] Potwierdzenia e-mail Stripe dla klientów: włączone albo świadomie wyłączone (jeśli wysyłamy własny mail).

**Technika (dev)**
- [ ] Pełny test na kluczach testowych zielony: zakup BLIK i kartą, dostęp, pełny zwrot (dostęp znika), spór testowy (zawieszenie, przegrana = odebranie).
- [ ] Cron uzgadniania działa (timer aktywny, ostatni przebieg bez błędu).

## 4. Procedura włączenia (wariant zalecany: jedno konto Stripe live)

Zakłada, że konto Stripe live zostaje (zaktualizowane na JDG). Kasa przechodzi na zestaw `default` (ten sam co napiwki, jeden webhook).
1. Kopia `app.env` i `build.env`: `cp app.env app.env.bak-$(date +%F)` (w `/opt/serwerek/apps/polutek`).
2. W `app.env`: usunąć (zakomentować) wszystkie trzy `PREMIUM_PASS_STRIPE_*`; dopisać `PLATFORM_GATE_SALES=on`. `PREMIUM_PASS_PAYMENTS=stripe` zostaje.
3. W `build.env`: usunąć `NEXT_PUBLIC_PREMIUM_PASS_STRIPE_PUBLISHABLE_KEY` (porządek; przeglądarka i tak użyje klucza live, bo serwer nie wskaże zestawu premium). Nowy obraz nie jest konieczny do włączenia; przy najbliższym wdrożeniu zniknie testowy klucz z paczki.
4. Restart: `docker compose up -d --force-recreate app`; poczekać na `healthy`.
5. Sprawdzić `/premium`: brak napisu „Tryb testowy”, karta „Bezpieczna płatność”, sprzedawca z NIP.
6. Zakup próbny: właściciel kupuje 30 dni za 14,99 zł BLIK-iem na własnym koncie. Sprawdzić: płatność w panelu Stripe live, w logu `[StripeWebhook] Received ... payment_intent.succeeded`, dostęp w „Moje konto → Strefa Premium”, mail potwierdzenia.
7. Zwrot z panelu admina (albo Stripe): sprawdzić, że dostęp zniknął, a płatność ma status `REFUNDED`.
8. W Stripe (tryb testowy) wyłączyć testowy endpoint webhooka, żeby nie sypał błędami podpisu.
9. Dopiero potem ogłoszenie.

Wariant B (osobne konto Stripe dla JDG, napiwki zostają na obecnym): klucze live nowego konta do `PREMIUM_PASS_STRIPE_*`, nowy endpoint webhooka na tym koncie (11 zdarzeń, jego sekret do `PREMIUM_PASS_STRIPE_WEBHOOK_SECRET`), `pk_live` nowego konta do `build.env` i **przebudowa obrazu** przed krokiem 4. Nie wpisywać kluczy tego samego konta do obu zestawów (podwójne dostarczanie zdarzeń i alarmy).

## 5. Wyłączenie w 2 minuty (rollback)

1. W `app.env`: `PLATFORM_GATE_SALES=off` (albo usunąć linię).
2. `docker compose up -d --force-recreate app`. Kasa pokaże „Płatności chwilowo niedostępne”; napiwki działają dalej.
3. **Nigdy** nie cofać przez `PREMIUM_PASS_PAYMENTS=demo`: tryb demo daje dostęp bez pieniędzy.
Opłaceni klienci zachowują dostęp; webhooki zwrotów i sporów działają dalej przy zamkniętej bramce.

## 6. Ryzyka

- **VAT:** ceny są końcowe, napis „zwolniony z VAT”. Po przekroczeniu 240 000 zł (proporcjonalnie w pierwszym roku) albo 10 000 EUR sprzedaży do UE trzeba VAT; przełącznik `NEXT_PUBLIC_PLATFORM_VAT_STATUS=active` zmienia tylko teksty (przebudowa), kwoty trzeba przeliczyć osobno.
- **Zwroty:** bez maila potwierdzającego z treścią zgody klient może odstąpić w 14 dni nawet po obejrzeniu.
- **Spory:** przegrany spór odbiera dostęp automatycznie (działa); opłata Stripe za spór zostaje po stronie sprzedawcy. Brak `charge.dispute.updated` na live opóźnia aktualizację statusu sporu do zamknięcia.
- **Zwroty nieudane:** bez `refund.failed` na live nieudany zwrot zobaczy dopiero cron uzgadniania.
- **Sprzedawca:** konto Stripe jako osoba fizyczna, a sprzedaje JDG: niespójność danych przy weryfikacji i fakturach, dopóki profil nie zostanie zmieniony.

## 7. Rekomendacja terminu

Nie włączać przed **1.01.2027** (start JDG). Grudzień: rejestracja JDG z datą 1.01, decyzje księgowej, regulamin od prawnika, mail potwierdzenia i dane sprzedawcy w kodzie (na kluczach testowych), test end-to-end, poprawa profilu i webhooka Stripe. **1.01.2027 rano**: kroki 1-8 i zakup próbny właściciela; ogłoszenie dopiero po udanym zwrocie. Jeśli regulamin albo mail potwierdzenia nie będą gotowe, przesunąć włączenie (premiera filmów może ruszyć bez sprzedaży).
