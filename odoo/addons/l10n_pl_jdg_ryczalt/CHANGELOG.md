# Zmiany

Wersjonowanie: `19.0.MAJOR.MINOR.PATCH`. Zmiana wzorów = MINOR + wpis tutaj. Reguły roczne to NOWE pliki `data/jdg_tax_rules_<rok>.xml`
z nowymi `xml_id` (nigdy nadpisanie zweryfikowanej reguły).

## 19.0.2.0.0 (2026-11-02): iteracje 2 i 3
* Kursy NBP (tabela A) pobierane automatycznie z api.nbp.pl (cron co godzinę z bramką czasu, zakresy do 93 dni, numer tabeli),
  dziennik pobrań `jdg.fx.fetch` (pokrycie kalendarza). Reguła „ostatni dzień roboczy przed dniem przychodu”: kurs jest uznany tylko
  wtedy, gdy wiadomo, że żadna nowsza tabela nie została pominięta; inaczej wpis czeka (pending) i przelicza się po pobraniu kursu
  (opcjonalnie sam się księguje). Przycisk „Pobierz kursy NBP teraz”. OCA `currency_rate_update_nbp` zostaje osobno (kursy księgowe).
* Zamykanie okresów (miesiąc, kwartał): migawka liczb ze skrótem SHA-256, zaliczka na ryczałt zapisana przy zamknięciu
  (`jdg.tax.advance`, stan płatności z zapisanych płatności), blokada nowych wpisów i płatności w zamkniętym okresie, korekta do
  pierwszego otwartego okresu, cofnięcie zamknięcia tylko przez właściciela z powodem (historia w chatterze).
* Alerty progów 70/90/100% (`jdg.alert`): zdrowotna 60 000 / 300 000 zł, limit VAT, OSS 10 000 EUR, limit darowizn od jednej osoby.
* Kalendarz terminów (`jdg.deadline`): ZUS, zdrowotna, zaliczka, PIT-28, OSS, koniec ulgi, przegląd reguł, komunikat GUS, zamknięcie
  miesiąca; powiadomienia w Discuss i aktywności na 7, 3 i 1 dzień przed terminem; widok kalendarza.
* Pasek OSS na pulpicie, poprawka: termin zaliczki za IV kwartał poprzedniego roku (20 stycznia) widoczny na pulpicie.
* Widoki pivot i graph: okresy, zaliczki, alerty.

## 19.0.1.0.1 (2026-11-02)
* Stawka 8,5% z pewnością [PR], wyraźne ostrzeżenie o ryzyku 15%, „cień” 15% na pulpicie i w rozliczeniu (kwota i różnica). Migracja opisów reguł.

## 19.0.1.0.0 (2026-11-02): iteracje 0 i 1
* Szkielet modułu, grupy (Użytkownik / Właściciel), reguły dostępu i reguły wielofirmowe, i18n pl.
* Tabela reguł `jdg.tax.rule` (2026 + projekt 2027, pewność i źródła), profil firmy `jdg.profile` (data startu jako ustawienie).
* Ewidencja `jdg.income.entry` append-only (ORM + trigger), waluty obce z kursem NBP (`jdg.fx.rate`, ręcznie), korekta/zwrot.
* Zapłacone składki `jdg.contribution.payment`.
* Silnik `engine.py` (zdrowotna, ZUS z ulgą na start, ryczałt narastająco, terminy), `calc.py`.
* Pulpit „Dzisiaj zarobiłem” i ekran „Podatki i składki” (OWL).
* Darowizny (napiwki bez świadczenia zwrotnego) poza przychodem, przełącznik „Traktuj napiwki jako przychód”, limit z reguł.
* Skrypty: `odoo/deploy/run-tests.sh`, `odoo/deploy/deploy-odoo-addon.sh`.
