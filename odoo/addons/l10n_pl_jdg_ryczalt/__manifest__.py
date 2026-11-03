{
    "name": "Firma: JDG na ryczałcie (Polska)",
    "summary": "Ewidencja przychodów, szacunek podatku i składek oraz pulpit „Dzisiaj zarobiłem” dla JDG na ryczałcie",
    "description": """
Moduł dla jednoosobowej działalności gospodarczej na ryczałcie (Polska), Odoo 19 Community.

* Pulpit „Dzisiaj zarobiłem”: przychód dziś / miesiąc / okres / rok, szacunek zaliczki na ryczałt, składka zdrowotna,
  ZUS (ulga na start), kwota „odłóż na podatki i składki”, „wolne środki”, paski progów, najbliższe terminy.
* Ewidencja przychodów tylko dopisywana (append-only), waluty obce z automatycznym kursem NBP (tabela A, dzień roboczy przed przychodem).
* Zamykanie miesięcy i kwartałów z migawką liczb i zapisem zaliczek, blokada edycji zamkniętych okresów.
* Alerty progów (zdrowotna 60/300 tys., limit VAT, OSS 10 000 EUR, darowizny) i kalendarz terminów z powiadomieniami w Discuss (7/3/1 dzień).
* Faktury na żądanie kupującego (PDF po polsku, numeracja FV/rok/numer bez luk, korekty FK, dane stron zamrożone na dokumencie).
* Wszystkie stawki, progi i podstawy ZUS w wersjonowanej tabeli reguł z poziomem pewności i źródłem.

Wszystkie kwoty to SZACUNEK, NIE PORADA PODATKOWA. Parametry musi potwierdzić księgowy.
""",
    "version": "19.0.3.0.0",
    "category": "Accounting/Localizations",
    "author": "Paweł Perfect",
    "website": "https://www.pawelperfect.com",
    "license": "LGPL-3",
    "depends": ["base", "mail", "account", "contacts", "l10n_pl"],
    "data": [
        "security/security.xml",
        "security/ir.model.access.csv",
        "data/jdg_currencies.xml",
        "data/jdg_tax_rules_2026.xml",
        "data/jdg_tax_rules_2027.xml",
        "data/jdg_profile_data.xml",
        "data/jdg_cron.xml",
        "views/jdg_tax_rule_views.xml",
        "views/jdg_profile_views.xml",
        "views/jdg_income_entry_views.xml",
        "views/jdg_income_correct_wizard_views.xml",
        "views/jdg_invoice_views.xml",
        "views/jdg_invoice_report.xml",
        "views/jdg_contribution_payment_views.xml",
        "views/jdg_fx_rate_views.xml",
        "views/jdg_period_views.xml",
        "views/jdg_deadline_views.xml",
        "views/jdg_client_actions.xml",
        "views/menus.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "l10n_pl_jdg_ryczalt/static/src/scss/jdg.scss",
            "l10n_pl_jdg_ryczalt/static/src/js/format.js",
            "l10n_pl_jdg_ryczalt/static/src/js/dashboard.js",
            "l10n_pl_jdg_ryczalt/static/src/js/dashboard.xml",
            "l10n_pl_jdg_ryczalt/static/src/js/taxes.js",
            "l10n_pl_jdg_ryczalt/static/src/js/taxes.xml",
        ],
    },
    "post_init_hook": "post_init_hook",
    "application": True,
    "installable": True,
    "icon": "/l10n_pl_jdg_ryczalt/static/description/icon.png",
}
