import datetime as dt

from odoo import api, fields, models

from . import engine

RATE_KEYS = [
    ("ryczalt.rate.vod_85", "8,5% (usługi niewymienione inaczej, np. PKWiU 63.11.19.0)"),
    ("ryczalt.rate.vod_12", "12% (oprogramowanie i usługi IT, art. 12 ust. 1 pkt 2b)"),
    ("ryczalt.rate.vod_15", "15% (np. PKWiU 59.11.25.0 / 59.20.36.0)"),
]


class JdgProfile(models.Model):
    """Ustawienia firmy JDG: jeden rekord na firmę. Data startu, forma, rytm zaliczek, ZUS, stawka.

    To są USTAWIENIA (zmieniasz je w formularzu, bez zmiany kodu). Liczby prawne (progi, podstawy ZUS,
    stawki) leżą w tabeli reguł `jdg.tax.rule`, a tutaj wybierasz, których używać.
    """

    _name = "jdg.profile"
    _description = "Profil firmy JDG (ustawienia)"

    _company_uniq = models.UniqueIndex("(company_id)", "Jedna firma ma jeden profil JDG.")

    company_id = fields.Many2one("res.company", "Firma", required=True, default=lambda self: self.env.company,
                                 ondelete="cascade")
    owner_name = fields.Char("Właściciel", help="Imię i nazwisko przedsiębiorcy (do wydruków i eksportów).")

    start_date = fields.Date(
        "Data rozpoczęcia działalności", required=True, default=dt.date(2027, 1, 1),
        help="Od tej daty liczy się ulga na start (6 miesięcy bez składek społecznych), potem preferencyjny ZUS "
             "(24 miesiące). Zmiana daty przelicza terminy i warianty ZUS; wpisy sprzed daty startu są blokowane "
             "(chyba że oznaczone jako testowe).")
    tax_form = fields.Selection([
        ("ryczalt", "Ryczałt od przychodów ewidencjonowanych"),
        ("skala", "Skala podatkowa 12/32% (tylko porównanie, w przygotowaniu)"),
        ("liniowy", "Podatek liniowy 19% (tylko porównanie, w przygotowaniu)"),
    ], string="Forma opodatkowania", default="ryczalt", required=True,
        help="Moduł liczy dziś wyłącznie ryczałt. Pozostałe formy pojawią się w symulatorze (iteracja 6).")
    ryczalt_rate_key = fields.Selection(
        RATE_KEYS, "Stawka ryczałtu", default="ryczalt.rate.vod_85", required=True,
        help="Którą stawkę z tabeli reguł stosować do NOWYCH wpisów. Stawka NIE jest rozstrzygnięta (8,5% / 12% / 15% "
             "zależy od klasyfikacji PKWiU): potwierdź z księgowym. Wpis zapamiętuje stawkę z chwili utworzenia.")
    ryczalt_rate_pct = fields.Float("Stawka (%)", compute="_compute_rate_info", digits=(5, 2))
    ryczalt_rate_confidence = fields.Char("Pewność stawki", compute="_compute_rate_info")
    ryczalt_rate_note = fields.Text("Uwagi do stawki", compute="_compute_rate_info")
    advance_rhythm = fields.Selection([
        ("quarterly", "Kwartalnie (do 20. po kwartale)"),
        ("monthly", "Miesięcznie (do 20. następnego miesiąca)"),
    ], string="Rytm zaliczek na ryczałt", default="quarterly", required=True,
        help="Zaliczki na podatek: kwartalnie albo miesięcznie. ZUS i składka zdrowotna są ZAWSZE miesięczne.")

    vat_status = fields.Selection([
        ("exempt_113", "Zwolniony z VAT (art. 113 ustawy o VAT)"),
        ("active", "Czynny podatnik VAT"),
        ("not_decided", "Jeszcze nie zdecydowano"),
    ], string="Status VAT", default="exempt_113", required=True)
    vat_exempt_basis = fields.Char("Podstawa zwolnienia z VAT (na fakturze)", default="art. 113 ust. 1 ustawy o VAT")
    oss_registered = fields.Boolean(
        "Zarejestrowany w OSS", default=False,
        help="Włącza terminy deklaracji OSS (koniec miesiąca po kwartale) i stały pasek progu 10 000 EUR na pulpicie. "
             "Próg 10 000 EUR liczy się i tak, gdy są wpisy B2C z innych państw UE (kraj klienta).")
    invoice_policy = fields.Selection([
        ("on_request", "Tylko na żądanie kupującego (B2B z NIP)"),
        ("always", "Zawsze"),
    ], string="Faktury", default="on_request", required=True,
        help="Potwierdzenie zakupu e-mailem (sprzedaż cyfrowa B2C) to nie faktura. Faktura z NIP dla B2B na żądanie.")

    uses_ulga_na_start = fields.Boolean(
        "Korzystam z ulgi na start", default=True,
        help="Ulga na start: 6 miesięcy bez składek społecznych (płacisz tylko zdrowotną). Wymaga m.in. braku "
             "działalności w ostatnich 60 miesiącach. Właściciel potwierdził korzystanie z ulgi.")
    ulga_end_date = fields.Date("Koniec ulgi na start", compute="_compute_zus_dates")
    pref_end_date = fields.Date("Koniec preferencyjnego ZUS", compute="_compute_zus_dates")
    zus_after_variant = fields.Selection([
        ("full", "Pełny ZUS"),
        ("mzp", "Mały ZUS Plus (liczony jak pełny, do dopracowania)"),
    ], string="ZUS po okresie preferencyjnym", default="full", required=True)
    sickness_insurance = fields.Boolean(
        "Chorobowa dobrowolna", default=True,
        help="Składka chorobowa 2,45% podstawy. Domyślnie TAK (tak liczą przykłady w specyfikacji: 469,85 zł "
             "w preferencyjnym ZUS); odznacz, jeśli rezygnujesz.")
    accident_rate_pct = fields.Float("Stawka wypadkowa (%)", default=1.67, digits=(5, 2),
                                     help="Zależy od płatnika; 1,67% to wartość standardowa [PR].")
    has_employees = fields.Boolean("Zatrudniam pracowników", help="Zmienia termin ZUS z 20. na 15. dnia miesiąca.")
    deduct_fp = fields.Boolean("Odliczaj Fundusz Pracy", default=False,
                               help="Czy Fundusz Pracy odliczać od przychodu jak składki społeczne. Domyślnie nie "
                                    "(ostrożnie) [N].")
    health_threshold_mode = fields.Selection([
        ("crossing_month", "Od miesiąca przekroczenia progu (ostrożnie)"),
        ("next_month", "Od następnego miesiąca po przekroczeniu"),
        ("annual_true_up", "Rozliczenie roczne (jak next_month + ostrzeżenie)"),
    ], string="Moment zmiany progu składki zdrowotnej", default="crossing_month", required=True,
        help="Źródła są sprzeczne co do momentu, od którego obowiązuje wyższa składka po przekroczeniu 60 000 zł "
             "[N]. Domyślnie ostrożnie: od miesiąca przekroczenia. Potwierdź z księgowym lub kalkulatorem ZUS.")

    set_aside_pct = fields.Float("Szybka rezerwa na podatki i składki (%)", default=25.0, digits=(5, 1),
                                 help="Tryb uproszczony pulpitu: ile procent każdej wpłaty odkładać 'na wszelki wypadek'.")
    refund_reserve_pct = fields.Float("Rezerwa na zwroty i spory (%)", default=0.0, digits=(5, 1),
                                      help="Procent przychodu odejmowany w 'wolnych środkach' na zwroty i spory. "
                                           "Domyślnie 0, żeby liczby zgadzały się z przykładami.")
    tips_as_income = fields.Boolean(
        "Traktuj napiwki jako przychód", default=False,
        help="Domyślnie WYŁĄCZONE (decyzja właściciela): napiwki i wsparcie od widzów bez świadczenia zwrotnego to "
             "darowizny, nie przychód ryczałtowy (wyrok NSA z 7.07.2026, III FSK 113/26: sygnatura do weryfikacji). "
             "Włącz, gdy interpretacja KIS lub księgowy uznają inaczej: darowizny wejdą wtedy do przychodu.")
    note = fields.Text("Notatki")

    @api.depends("company_id")
    def _compute_display_name(self):
        for profile in self:
            profile.display_name = "Profil JDG: %s" % (profile.company_id.name or "")

    @api.depends("ryczalt_rate_key", "start_date")
    def _compute_rate_info(self):
        today = fields.Date.context_today(self)
        for profile in self:
            profile.ryczalt_rate_pct = 0.0
            profile.ryczalt_rate_confidence = False
            profile.ryczalt_rate_note = False
            if not profile.ryczalt_rate_key:
                continue
            try:
                rule = self.env["jdg.tax.rule"]._lookup(profile.ryczalt_rate_key, today, profile.company_id)
            except Exception:  # brak reguły: formularz ma się otworzyć, błąd zobaczysz w tabeli reguł
                continue
            profile.ryczalt_rate_pct = rule.value_num
            profile.ryczalt_rate_confidence = "[%s]%s" % (rule.confidence, "" if rule.verified_on else " do potwierdzenia")
            profile.ryczalt_rate_note = rule.source_note

    @api.depends("start_date", "uses_ulga_na_start")
    def _compute_zus_dates(self):
        for profile in self:
            profile.ulga_end_date = profile.pref_end_date = False
            if not profile.start_date:
                continue
            ulga_months = pref_months = None
            try:
                rules = self.env["jdg.tax.rule"]
                ulga_months = int(rules._lookup("ulga.months", profile.start_date, profile.company_id).value_num)
                pref_months = int(rules._lookup("pref.months", profile.start_date, profile.company_id).value_num)
            except Exception:
                continue
            pref_from = profile.start_date
            if profile.uses_ulga_na_start:
                pref_from = engine.add_months(profile.start_date, ulga_months)
                profile.ulga_end_date = pref_from - dt.timedelta(days=1)
            profile.pref_end_date = engine.add_months(pref_from, pref_months) - dt.timedelta(days=1)

    @api.model
    def _get(self, company=None):
        """Profil firmy (tworzy domyślny, jeśli go nie ma)."""
        company = company or self.env.company
        profile = self.sudo().search([("company_id", "=", company.id)], limit=1)
        if not profile:
            profile = self.sudo().create({"company_id": company.id, "owner_name": company.name})
        return profile

    @api.model
    def action_open_my_profile(self):
        profile = self._get()
        return {
            "type": "ir.actions.act_window",
            "name": "Profil firmy JDG",
            "res_model": "jdg.profile",
            "res_id": profile.id,
            "view_mode": "form",
            "target": "current",
        }
