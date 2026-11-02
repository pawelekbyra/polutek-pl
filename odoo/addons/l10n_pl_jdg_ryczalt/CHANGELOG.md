# Zmiany

Wersjonowanie: `19.0.MAJOR.MINOR.PATCH`. Zmiana wzorów = MINOR + wpis tutaj. Reguły roczne to NOWE pliki `data/jdg_tax_rules_<rok>.xml`
z nowymi `xml_id` (nigdy nadpisanie zweryfikowanej reguły).

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
