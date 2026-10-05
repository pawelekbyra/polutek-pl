# Faza 3 panelu: Ustawienia, Przychody, Komunikacja, Powiadomienia, Bezpieczeństwo (+ tłumacz i szkice AI)

Stan: 2026-10-05, gałąź `feat/p3-obsluga`. Plan: [`admin-panel.md`](admin-panel.md) sekcja 4 „Faza 3”, parytet:
[`admin-parity.md`](admin-parity.md), wzorce: [`admin-phase2-content.md`](admin-phase2-content.md). Wygląd: prototyp
`docs/design/admin-panel/` (zakładki `#/przychody`, `#/komunikacja`, `#/bezpieczenstwo`, `#/ustawienia`).

## 1. Wspólne klocki

| Klocek | Gdzie | Co robi |
|---|---|---|
| Brama zapisu | `apps/admin/lib/actions/gate.ts` (`openGate`) | jedna kolejność dla każdej akcji: `requireAdmin` (sesja, 12 h, rola) → odmowa na danych przykładowych → limit wywołań na admina i akcję (`rate-limit.ts`, pamięć procesu) → opcjonalnie step-up → kontekst z IP, UA i `cf-ray`. Domyślnie tylko rola OWNER. Walidacja zod `.strict()` jest w każdej akcji zaraz po bramie. |
| Audyt z kontekstem | `AppContext.client` + `recordAuditEvent` | wiersz `AuditLog` dostaje IP i user agent z żądania panelu (naprawia ADM-14: 0 z 25 wpisów admina miało IP). Użycia z wcześniejszych faz nie zmieniają sygnatur. |
| Formularze | `components/form/{field,use-action-form}.tsx` | `useActionForm`: ręczne wysłanie (odrzucony zapis nie czyści pól), fokus na pierwszym błędzie, toast, przekierowanie do `/potwierdz` przy `STEP_UP_REQUIRED`. |
| Zakładki | `components/section-tabs.tsx` | zwykłe linki z `aria-current`, parametry w URL (`pickParam`). Ekrany są komponentami serwerowymi, bez `loading.tsx`. |
| CSV | `lib/modules/shared/csv.ts` | odporne na wstrzyknięcie formuł (komórka zaczynająca się od `= + - @ TAB CR` dostaje apostrof, [OWASP](https://owasp.org/www-community/attacks/CSV_Injection)), cudzysłowy podwajane, CRLF i BOM (RFC 4180). |
| CSS | `apps/admin/app/phase3.css` | jedyny nowy plik stylów; zero atrybutów `style=`. |

Wspólny sposób pokazywania niedostępnych danych: ekran mówi wprost „bez pomiaru” albo opisuje, czego nie ma i dlaczego (np. brak otwarć
maili, bo śledzenie jest wyłączone), nigdy zero. Pod `ADMIN_DEV_FIXTURES=1` ekrany tej fazy pokazują „Dane przykładowe” i odmawiają zapisu.

## 2. Ustawienia (`/ustawienia`, zakładki Kanał · Płatności · Panel i alerty · Integracje · Konto)

* **Kanał:** nazwa i opis (`updateAdminChannelSettings`, audyt z wartościami przed i po), domyślna miniatura przez **wgranie do prywatnego R2**
  (`lib/modules/admin-content/application/default-thumbnail.ts`, trasa `/api/settings/default-thumbnail`: magic bytes, 5 MB, nowy plik zapisany
  zanim stary zostanie usunięty, bez zapasowego Vercel Blob), konto kanału (`changeChannelOwner`: wyszukiwanie konta, wpisanie jego e-maila,
  powód, **step-up**, porównanie-i-zamiana na poprzednim właścicielu, audyt `CHANNEL_OWNER_CHANGED`), „Przelicz subskrybentów”.
* **Decyzje:** (a) **banner kanału: DROP.** Okładkę usunięto ze strony 2026-10-04 (#1668), `Creator.bannerUrl` jest martwe i test pilnuje, że
  nic go nie zapisuje; wgrywanie obrazu, którego nigdzie nie widać, byłoby martwą funkcją. (b) Opis tylko jeden (PL): w bazie nie ma pola opisu EN.
  (c) Licznik „wyświetlany” subskrybentów: DROP (wiersz parytetu już tak mówił). (d) Dawny adres URL miniatury na wierszu `Creator` **przesłaniał**
  wgrany plik (`resolveVideoThumbnailUrl`); zapis i usunięcie w panelu czyszczą go, a ekran ostrzega, dopóki istnieje.
* **Płatności:** minimalny napiwek ×5 walut (`updatePaymentSettings`, kwoty „12,50” → grosze bez błędu zmiennoprzecinkowego, ≤ stałe maksimum, audyt przed i po).
* **Progi alertów:** dysk, RAM, swap (ostrzeżenie i błąd, `AppSetting admin_alert_thresholds`); sterują kolorem kropki zdrowia, Centrum zdrowia i limitami w „Dzisiaj”
  (`OverviewDeps.limits`, domyślnie dotychczasowe `LIMITS`). **Godziny ciszy i kanały alertów: DROP do czasu, aż panel cokolwiek wysyła z alertów**
  (dziś nie ma do czego tego podłączyć). Próg Workera HLS: brak pomiaru, więc brak progu.
* **Integracje:** `getIntegrationStatus`: Stripe (tryb z publicznego prefiksu klucza, test na produkcji = ostrzeżenie), webhook, Resend, R2, Access, telemetria, Redis, PP Support;
  ostatnie ślady z naszych tabel. **Żadnej wartości sekretu i żadnego wywołania zewnętrznego przy wyświetlaniu** (test sprawdza, że sekrety nie trafiają do wyniku).
* **Konto:** twoje konto panelu (klucze, TOTP, rola, ostatnie logowanie) i instrukcja odzyskiwania (`admin-enroll --reset` przez SSH).

## 3. Przychody (`/przychody`: Przegląd · Wpłaty · Zwroty i spory · Stripe i webhooki)

**Jedna definicja przychodu** (`lib/modules/admin-revenue/revenue.ts`, ta sama stała `REVENUE_STATUSES` co „Dzisiaj”): napiwek liczy się, gdy ma status
`SUCCEEDED` albo `PARTIALLY_REFUNDED`, w kwocie `amountMinor − refundedAmountMinor`. `PENDING`, `FAILED`, `CANCELED` nie są przychodem; `DISPUTED`
(pieniądze zatrzymane przez bank), `REFUNDED` (w całości oddane) i `CHARGEBACK_LOST` pokazujemy osobno. „Brutto” to `amountMinor` tych samych wierszy,
„netto” to netto **po zwrotach, bez opłat Stripe** (nie przechowujemy `balance_transaction.fee`). Suma w zł po kursie orientacyjnym (`minorToPln`),
waluty bez kursu są wymienione, nie zgadywane.

| Element | Jak |
|---|---|
| Przegląd | kafle (netto zł, liczba, mediana, zwroty, spory), wykres dzienny, tabela walut, lejek bramki **z bazy** (rozpoczęte → w toku / nieudane → opłacone; odsłony bramki to telemetria w Analityce), ostatnie zwroty |
| Wpłaty | filtry w URL (szukaj po e-mailu, id, `pi_…`; status; waluta; daty), strony po 20, „Zobacz w Stripe” (link tylko dla id pasującego do `^(pi|ch|re|dp)_…`, `/test/` w trybie testowym) |
| **Zwrot** | okno: pełny albo częściowy (kwota z walidacją), powód Stripe + opis (≥ 3 znaki), ramka „Skutek”, **klucz idempotencji** tworzony przy otwarciu okna, **step-up**, limit 10 / 10 min. Akcja ponownie czyta wpłatę i sprawdza kwotę względem tego, co zostało (nie ufa oknu); wpłata `DISPUTED` bez zwrotu (odpowiedz w Stripe). `adminRefund` dostał `idempotencyKey`, `stripeReason`, audyt z powodem i stanem przed/po; klucz do Stripe to `refund-<paymentId>-<klucz okna>`. |
| Spory | lista `DISPUTED`/`CHARGEBACK_LOST`, najpierw otwarte z najbliższym terminem; **termin dowodów i powód zapisuje „Odśwież ze Stripe”** (`adminDisputeSync` zapisuje `Payment.metadata.dispute`; webhook niesie tylko status, więc bez synchronizacji termin jest „nieznany”); „Otwórz w Stripe” |
| Stripe i webhooki | ostatnie 40 zdarzeń z opóźnieniem i błędem, liczniki (nieudane 7 dni, zawieszone > 15 min) |
| Rekonsylacja | lokalna, **bez pytania Stripe**: PENDING > 15 min oraz zgodność sumy wpłat netto z sumami osób (`UserPaymentTotal`) per waluta |
| Eksport CSV | `/api/export/payments`: **step-up** (zawiera e-maile), limit 5 / 10 min, do 20 tys. wierszy, wpis `PAYMENTS_EXPORTED` (filtry, bez treści wyszukiwania) |

Testy zwrotu: Stripe jest zawsze mockowany (`getStripeClient`), żaden test nie wywołuje sieci. Semantyka: klucze idempotencji i `reason` według
[Stripe: refunds](https://docs.stripe.com/api/refunds/create) i [idempotent requests](https://docs.stripe.com/api/idempotent_requests).

## 4. Komunikacja (`/komunikacja`: Przegląd · Rozsyłki · Szablony · Wypisy i blokady · Powiadomienia)

* **Przegląd:** dostarczalność 30 dni z `EmailEvent` (wysłane, doręczone, odbicia ze celem < 4 %, skargi < 0,08 %, limity Resend Free 100/dzień i 3000/miesiąc,
  nadpisywalne `RESEND_DAILY_LIMIT` / `RESEND_MONTHLY_LIMIT`), kolejka rozsyłek, PP Support jako link (liczby wątków wymagają tokenu agenta, którego panel nie trzyma; czekają na kolektor).
  Otwarć i kliknięć **nie ma**: śledzenie jest wyłączone w Resend.
* **Szablony:** lista (systemowe z oznaczeniem „zmieniony/domyślny” i własne), edytor PL/EN, **podgląd na żywo** w `<iframe sandbox>` zasilanym przez
  `POST /api/email/preview` (HTML sanityzowany jak przy zapisie, wartości przykładowe z rejestru, odpowiedź z własnym CSP `default-src 'none'`; CSP panelu ma `frame-src 'self'`,
  `X-Frame-Options: SAMEORIGIN` tylko dla tej jednej trasy), **różnica względem domyślnego** (`lineDiff`, bez zależności), „Przywróć domyślny”, usuwanie własnego, nowy szablon rozsyłki.
  Audyt `TEMPLATE_SAVED` ma teraz przed/po (skróty i długości, nie pełne treści).
* **Rozsyłki:** kreator 4 kroków (odbiorcy → treść PL/EN → **test do siebie** → potwierdzenie ze **step-up**), historia z postępem (odświeżana co 10 s tylko, gdy coś trwa), „Anuluj”.
  **Panel tylko kolejkuje** (`createBroadcast`); prawdziwą wysyłkę robi zadanie `send-broadcasts` na stronie. Prawdziwy mail z panelu wychodzi wyłącznie przez (a) test do **własnego** adresu konta
  panelu (adres z sesji, nie z formularza; `.strict()` odrzuca podrobione pole; limit 6 / 10 min) i (b) utworzoną rozsyłkę za step-upem. Zgodność: stopka z wypisem i `List-Unsubscribe` +
  `List-Unsubscribe-Post` ([RFC 8058](https://www.rfc-editor.org/rfc/rfc8058), [wymagania Gmail/Yahoo](https://support.google.com/a/answer/81126)) dodaje nadawca, nie edytor; odbiorcy to tylko osoby ze zgodą, bez zablokowanych.
  **Termin wysyłki w przyszłości: DROP** (kolejka nie ma harmonogramu; rozsyłka rusza od razu). Testy nie wysyłają maili (Resend zamockowany).
* **Wypisy i blokady:** liczby zgód, lista zablokowanych po odbiciu/skardze i wypisanych. Ręczne zdejmowanie blokad: celowo poza panelem.
* **Powiadomienia:** ekran tylko do odczytu (szablony, ostatnie powiadomienia) z jasnym baner „wysyłka wyłączona”. **Decyzja:** dzwonek usunięto ze strony 2026-10-04, więc
  rozsyłka i edycja szablonów powiadomień są DROP; powrót dzwonka to osobna decyzja i zmiana.

## 5. Bezpieczeństwo (`/bezpieczenstwo`: Sesje i konta · Logowania do panelu · Dziennik audytu) i `/system/r2`

* **Sesje i konta:** aktywne sesje panelu (urządzenie opisane słowami, bez surowego UA; „Wyloguj” innej sesji, „Wyloguj inne”; bieżącej sesji nie da się ubić, a zdarzenie `ADMIN_SESSION_REVOKED`
  trafia do `AdminAuthEvent`), konta panelu (klucze, TOTP, rola), **konta ADMIN na stronie** z 2FA, kluczami i sesjami (ostrzeżenie o kontach bez 2FA do zdjęcia przed fazą 5).
* **Logowania:** `AdminAuthEvent` z filtrem wyniku, nieudane z 24 h, **sprawdzenie łańcucha skrótów** (ostatnie 200 wpisów: przepisany albo usunięty wiersz pęka).
* **Dziennik audytu:** filtry (szukaj po akcji/id obiektu/`requestId`/id aktora, typ aktora, typ obiektu, daty), 30 na stronę, szczegóły (metadane z przed/po) w rozwijanym bloku,
  eksport CSV ze step-upem i własnym wpisem `AUDIT_EXPORTED`.
* **Niezmienny `AuditLog`** (migracja `20261005200000_admin_phase3_roles_and_audit_immutable`): wyzwalacz odrzuca `UPDATE` (z jednym wyjątkiem: wyzerowanie `ip` i `userAgent` przez
  codzienne zadanie retencji, bo bez niego prywatność przestałaby działać), `DELETE` wierszy młodszych niż 400 dni i `TRUNCATE`. **Łańcucha skrótów na `AuditLog` jeszcze nie ma**:
  wymagałby wyzwalacza przy każdym zapisie w całej aplikacji, którego nie da się tu sprawdzić na prawdziwym Postgresie; zostaje następnym krokiem (nocny eksport do R2 z blokadą też).
  `AdminAuthEvent` ma łańcuch od fazy 1.
* **Diagnostyka R2** (`/system/r2`, przycisk także w Systemie i Bezpieczeństwie): zmienne (sekrety „ustawiona”), nazwy bucketów (URL zamiast nazwy = błąd), test `HeadBucket` na żądanie.

### Rola bazy `pp_admin`: jak ją nadać (nic nie wymaga jej do startu)

1. Migracja tworzy rolę `pp_admin NOLOGIN`, jeśli ma do tego prawo (inaczej pomija bez błędu; wtedy `CREATE ROLE pp_admin LOGIN PASSWORD '…'` ręcznie).
2. Raz jako właściciel bazy: `docker compose exec -T db psql -U <właściciel> -d <baza> -v ON_ERROR_STOP=1 -f - < deploy/serwerek/admin/pp-admin-role.sql`
   (nadaje SELECT/INSERT/UPDATE/DELETE na domenie, **odbiera UPDATE/DELETE/TRUNCATE na `AuditLog` i `AdminAuthEvent`**, `_prisma_migrations` zamknięte; skrypt jest idempotentny).
3. `ALTER ROLE pp_admin LOGIN PASSWORD '<wygenerowane>'`, w `admin.env` ustaw `DATABASE_URL=postgresql://pp_admin:…@db:5432/<baza>`, restart kontenera `admin`. Rollback: wróć do poprzedniego `DATABASE_URL`.
4. Sprawdzenie: `SELECT has_table_privilege('pp_admin','"AuditLog"','UPDATE')` ma zwrócić `false`. Migracje nadal robi zwykły `deploy.sh` właścicielem, nie `pp_admin`.

## 6. Tłumacz i szkice AI

* **Rola `TRANSLATOR`:** `AdminUser.role` (domyślnie `OWNER`) + `AdminLanguageGrant`. Konto powstaje tylko przez SSH:
  `admin-enroll --email t@x.pl --role translator --languages de,es` (passkey i TOTP jak u właściciela; w Cloudflare Access dopisz jego e-mail). Tłumacz widzi tylko `/tlumaczenia`
  („Do przetłumaczenia”, kolejka filmów z brakującym albo maszynowym językiem) i swoje języki; **nie zatwierdza**, nie wgrywa napisów, nie generuje AI.
  Egzekwowanie w trzech warstwach: (1) **proxy** sprawdza rolę przy każdym żądaniu (także nawigacji bez przeładowania) i odsyła tłumacza z każdej ścieżki poza krótką listą
  (`TRANSLATOR_PATHS`), więc nowa strona dodana przez kogoś jest domyślnie zamknięta; (2) `requireAdmin` bez jawnej listy ról wpuszcza tylko OWNER;
  (3) przypadek użycia (`saveFilmTranslation`) sprawdza `ctx.allowedLanguages`, `approveFilmTranslations` odmawia tłumaczowi.
* **„Generuj szkice AI”: Cloudflare Workers AI, model `@cf/meta/m2m100-1.2b`.** Powód: darmowe **10 000 neuronów dziennie bez karty** na planie Workers Free, po wyczerpaniu wywołania
  kończą się błędem (bez opłaty, reset 00:00 UTC) ([cennik](https://developers.cloudflare.com/workers-ai/platform/pricing/)); konto Cloudflare już jest, żadnych nowych usług. Tytuł i opis filmu to
  kilkaset tokenów, więc film to ułamek limitu. Odrzucone: Claude API (płatne, właściciel zabronił), inne darmowe plany z kartą lub niejasnymi limitami.
  **Domyślnie WYŁĄCZONE:** `TRANSLATION_AI_ENABLED=1` oraz `CLOUDFLARE_AI_ACCOUNT_ID` i `CLOUDFLARE_AI_API_TOKEN` (token z uprawnieniem Workers AI Read; tylko w `admin.env`). Interfejs
  `TranslationDraftProvider` (`lib/modules/translations/domain/draft-provider.ts`), implementacja `workers-ai-provider.ts`; w testach zawsze atrapa lub zamockowany `fetch`.
  Zasady: szkic to wiersz `AI_DRAFT`, **nigdy nie nadpisuje** wersji napisanej ani zatwierdzonej przez człowieka (ani angielskiego wpisanego w polach EN), nie wpływa na stronę (strona
  nadal czyta `Video.titleEn`, dopóki człowiek nie zapisze albo nie zatwierdzi), pierwszy błąd limitu przerywa serię, każdy przebieg ma wpis `TRANSLATION_AI_DRAFTS_GENERATED`.
  Zakres: tytuł i opis (napisów nie tłumaczymy). Jakość m2m100 jest przeciętna: stąd obowiązkowe zatwierdzenie.

## 7. Wdrożenie (kolejność, zmienne, migracje)

1. Migracja `20261005200000_admin_phase3_roles_and_audit_immutable` (addytywna, idempotentna) przez zwykły `deploy.sh`. **Uwaga:** od niej wiersze `AuditLog` młodsze niż 400 dni nie dadzą się
   usunąć; test postgres `privacy-retention` przestał kasować własne wiersze audytu (zostają w jednorazowej bazie CI).
2. Obraz panelu (`deploy-admin.sh`). Nowe zmienne w `admin.env`:
   `STRIPE_SECRET_KEY` (klucz **ograniczony**: Refunds zapis, Disputes i Charges odczyt, PaymentIntents odczyt; potrzebny do zwrotów i „Odśwież ze Stripe”),
   `RESEND_API_KEY` i `EMAIL_FROM` (tylko test rozsyłki do siebie), `NEXT_PUBLIC_APP_URL`, `CLOUDFLARE_R2_*` (komplet jak na stronie: wgrywanie domyślnej miniatury, diagnostyka),
   opcjonalnie `RESEND_DAILY_LIMIT` / `RESEND_MONTHLY_LIMIT`, `TRANSLATION_AI_ENABLED`, `CLOUDFLARE_AI_ACCOUNT_ID`, `CLOUDFLARE_AI_API_TOKEN`.
3. Opcjonalnie rola `pp_admin` (sekcja 5). Opcjonalnie konta tłumaczy (`admin-enroll --role translator …`).
4. CORS bucketu miniatur nie jest potrzebny (wgranie idzie przez serwer panelu, nie z przeglądarki).

## 8. Testy i czego nie zweryfikowano

`tests/unit/admin-phase3/*` (użycia, akcje, rola, proxy, atrapy AI/Stripe/Resend, komponenty jsdom), rozszerzone `tests/unit/modules/payments/admin-refund.use-case.test.ts`,
`tests/postgres/admin-phase3.pg.test.ts` (**napisany, nieuruchomiony: na tej maszynie nie ma Postgresa**; uruchamia CI „integration-postgres”). Nie sprawdzono w przeglądarce:
wygląd i układ (brak przeglądarki w środowisku), działanie `<dialog>`/iframe podglądu na żywo, passkey/step-up end to end, wywołanie prawdziwego Stripe/Resend/Workers AI.

## 9. Ryzyka

* Wyzwalacz `AuditLog` jest nieprzetestowany na prawdziwej bazie; błąd w nim blokowałby każdy zapis audytu (stąd prosta postać, wzorowana na działającym `AdminAuthEvent`). Pierwsze wdrożenie: sprawdź zapis audytu po migracji.
* Webhooki Stripe nie zapisują terminu sporu; do czasu „Odśwież ze Stripe” termin jest „nieznany” (alarm o sporze w „Dzisiaj” działa jak dotąd).
* Limit Resend liczony ze zdarzeń webhooka; jeśli webhook nie działa, liczniki są zaniżone (ekran pokazuje wiek ostatniego zdarzenia).
* Proxy sprawdza rolę zapytaniem do bazy na każde żądanie z ciasteczkiem poza ścieżkami tłumacza (jeden indeksowany odczyt; panel ma jednego-dwóch użytkowników).
* Szkice AI: przeciętna jakość tłumaczeń m2m100, limit dobowy; funkcja wyłączona, dopóki jej nie włączysz.
