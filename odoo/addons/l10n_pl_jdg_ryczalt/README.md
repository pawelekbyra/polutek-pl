# Firma: JDG na ryczałcie (`l10n_pl_jdg_ryczalt`)

Moduł Odoo 19 Community dla jednoosobowej działalności gospodarczej na ryczałcie (Polska).
Właściciel jest własnym księgowym wspieranym przez AI, więc moduł ma być czytelny, testowalny i uczciwy:
**każda kwota to szacunek, nie porada podatkowa**, a każda liczba ma podpowiedź „skąd ta liczba”.

Wersja: 19.0.3.0.0 (iteracje 0-4). Licencja LGPL-3. Zależności: `base, mail, account, contacts, l10n_pl` (tylko Community).

## Co działa (iteracje 0–1)

* Menu **Firma**: Dzisiaj, Ewidencja przychodów, Podatki i składki, Zapłacone składki, Kursy NBP, Ustawienia (Profil firmy, Reguły i parametry).
* **Pulpit „Dzisiaj zarobiłem”** (klient-akcja OWL): przychód dziś / miesiąc / kwartał (okres zaliczki) / rok, szacunek zaliczki
  na ryczałt, składka zdrowotna, ZUS (ulga na start = 0 społecznych), „odłóż na podatki i składki”, „wolne środki”,
  paski progów (zdrowotna 60 000 / 300 000 zł, zwolnienie z VAT), najbliższe terminy, karta darowizn.
  Pole „Na dzień” pozwala obejrzeć pulpit w dowolnym dniu (np. w styczniu 2027), „Pokaż dane testowe” dołącza wpisy testowe.
* **Podatki i składki**: rozliczenie okresu krok po kroku (przychód → odliczenia → podstawa → podatek → zaliczka), karty zdrowotnej, ZUS i stawki.
* **Ewidencja przychodów**: wpis ręczny (data, opis, kwota, waluta), kurs NBP (z tabeli `jdg.fx.rate` albo wpisany ręcznie),
  kwota w PLN, księgowanie (numer kolejny w roku), **append-only** (ORM + trigger w bazie), korekta/zwrot wpisem ujemnym.
* **Waluty obce od początku**: przychód zapisany w walucie oryginalnej + kurs + kwota PLN. Kursy NBP wpisujesz ręcznie
  (automatyczne pobieranie: iteracja 2). Różnice kursowe wypłat Stripe: [N], w pytaniach do księgowego.
* **Reguły** w tabeli `jdg.tax.rule` (od/do, źródło, pewność [P]/[PR]/[N], kto i kiedy zweryfikował). Reguły 2026 i projekt 2027.
* **Darowizny**: napiwki bez świadczenia zwrotnego to osobny rodzaj wpisu, domyślnie poza przychodem (przełącznik w profilu).

## Decyzje właściciela wbudowane w ustawienia

| Decyzja | Gdzie zmienić |
|---|---|
| Data startu działalności (domyślnie 2027-01-01) liczy ulgę na start (6 mies.) i preferencyjny ZUS (24 mies.) | Firma > Ustawienia > Profil firmy > Data rozpoczęcia |
| Stawka ryczałtu jako parametr: 8,5% (domyślnie, „do potwierdzenia”), 12%, 15% | Profil firmy > Stawka ryczałtu; wartości: Reguły i parametry (`ryczalt.rate.*`) |
| Zaliczki kwartalnie (domyślnie) albo miesięcznie; ZUS i zdrowotna zawsze miesięcznie | Profil firmy > Rytm zaliczek |
| Faktury tylko na żądanie kupującego (B2B z NIP); potwierdzenie e-mailem to nie faktura | Profil firmy > Faktury; dane sprzedawcy: Profil firmy > Dane sprzedawcy na fakturze |
| Napiwki to darowizny, nie przychód (wyrok NSA, sygnatura do weryfikacji) | Profil firmy > Traktuj napiwki jako przychód |

## Jak to jest zbudowane (dla dewelopera i AI)

```
models/engine.py      CZYSTA logika (Decimal, bez ORM): zaokrąglanie, zdrowotna, ZUS, ryczałt, terminy. Testy bez bazy.
models/calc.py        CalcContext: wczytuje wpisy i zapłaty (1 zapytanie na rok) i składa wyniki z engine + reguł.
models/jdg_dashboard.py  Dane ekranów OWL (jedna metoda = jeden JSON) wraz z tekstami „skąd ta liczba”.
models/jdg_tax_rule.py   Tabela reguł + RuleReader (jedyny sposób odczytu parametrów; brak reguły = błąd).
models/jdg_income_entry.py  Ewidencja, kurs i PLN, księgowanie, blokada edycji + trigger SQL.
models/nbp_client.py  Klient api.nbp.pl (tabela A, zakresy do 93 dni); jdg_fx_rate.py: kursy, dziennik pobrań, cron, pending.
models/jdg_period.py, jdg_tax_advance.py  Zamykanie okresów z migawką, zaliczki zapisane przy zamknięciu.
models/jdg_alert.py, jdg_deadline.py, jdg_notify.py  Alerty progów, kalendarz terminów, powiadomienia w Discuss.
static/src/js/        OWL: dashboard.*, taxes.*, format.js (formatowanie 1 234,56 zł). scss: jdg.scss.
data/                 Reguły (noupdate=1: Twoje edycje przetrwają aktualizację), profil startowy, waluty.
tests/                test_engine.py (bez bazy), test_models.py, test_iter23.py, test_iter4.py (faktury).
```

Zasady:
1. **Wzory w `engine.py`, liczby w tabeli reguł.** Nowa stawka lub próg to nowy rekord reguły, nie zmiana kodu.
2. **Brak reguły = błąd** (`UserError`), nigdy cicha wartość domyślna.
3. **Zweryfikowanej reguły nie edytujemy**: dodajemy nową z nową datą „obowiązuje od”.
4. **Zaksięgowany wpis jest niezmienny**; błąd poprawia wpis korygujący. Wpisy testowe (`is_test`) są poza obliczeniami.
5. Każdy ekran z kwotą podatkową ma stopkę „Szacunek, nie porada podatkowa” i pokazuje wersję i pewność reguł.

### Jak dodać regułę na nowy rok (np. po komunikacie GUS)
1. Firma > Ustawienia > Reguły i parametry. Znajdź `gus_avg_wage_q4` z oznaczeniem „Projekt”.
2. Wpisz prawdziwą wartość, ustaw stan „Obowiązuje”, wpisz źródło i kliknij „Oznacz jako zweryfikowaną”.
3. Dla nowego roku: dodaj plik `data/jdg_tax_rules_2028.xml` (nowe `xml_id` z sufiksem wersji) i dopisz go w manifeście.

### Testy
```bash
odoo/deploy/run-tests.sh            # tymczasowy kontener Odoo + własny Postgres, sprząta po sobie
```
Pokrycie: T01–T15, T16 (kurs sprzed dnia przychodu), T17 (testowe poza obliczeniami), T21 (append-only: ORM i SQL),
T22 (przesunięcie terminu), T24 (brak reguły), przykład 3 000 zł w ulgę na start, tryby progu zdrowotnej, darowizny.

### Wdrożenie / aktualizacja
```bash
odoo/deploy/deploy-odoo-addon.sh    # kopia bazy + modułu, -i/-u, restart Odoo, rollback katalogu przy błędzie
```

## Czego jeszcze nie ma (kolejne iteracje)
4: faktury PDF (na żądanie, B2B z NIP). 5: integracja Stripe (płatności, zwroty, wypłaty PLN jako dane przepływów).
6: eksport dla księgowego, symulator „co jeśli”, porównanie form opodatkowania. 7 (opcja): KSeF, JPK_EWP, deklaracje OSS.
Gotowe: 2 (kursy NBP), 3 (zamykanie okresów, alerty, terminy).

## Ograniczenia i pytania do księgowego
Stawka ryczałtu (8,5/12/15%) [N], moment zmiany progu zdrowotnej [N], definicja dochodu dla Małego ZUS Plus [N], kurs NBP (dzień
roboczy przed przychodem) [PR], odliczanie Funduszu Pracy [N], zwroty i spory (miesiąc pomniejszenia) [N], różnice kursowe z wypłat
Stripe [N], darowizny a przychód i SD-Z2 [N], VAT/OSS dla zwolnionego [N], W na 2027 (do komunikatu GUS) [N].
Pełna lista: `SPEC.md` sekcja 8 (poza repozytorium) i tabela reguł (pole „Źródło i uwagi”).

## Faktury (iteracja 4)

Faktura powstaje z zaksięgowanego wpisu sprzedaży (przycisk „Wystaw fakturę”). Zanim wystawisz pierwszą: wpisz NIP i adres sprzedawcy w Profilu firmy
(bez nich dokument jest tylko podglądem). Numeracja FV/rok/numer, korekty FK/rok/numer, anulowanie = korekta do zera. Faktura nie zmienia przychodu.
B2B z polskim NIP wymaga w praktyce KSeF (poza zakresem modułu). Podstawa „art. 113 ust. 1 ustawy o VAT” na fakturze jest zalecana, nie obowiązkowa
(źródła wtórne: potwierdź z księgowym).
