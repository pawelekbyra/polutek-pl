from odoo import api, fields, models
from odoo.exceptions import UserError, ValidationError

from .engine import dec

CONFIDENCE = [
    ("P", "[P] potwierdzone"),
    ("PR", "[PR] prawdopodobne"),
    ("N", "[N] niepotwierdzone"),
]
CONFIDENCE_RANK = {"P": 3, "PR": 2, "N": 1}

# Pola, których po weryfikacji nie wolno zmieniać (zmiana wartości = NOWA wersja reguły z nową datą "od").
VALUE_FIELDS = {"key", "valid_from", "value_num", "value_char", "value_json", "unit", "company_id"}


class JdgTaxRule(models.Model):
    """Wersjonowana tabela parametrów: stawki, progi, podstawy ZUS, terminy.

    Zasady (SPEC 2.3):
      * kod zawiera tylko wzory, wszystkie liczby żyją tutaj;
      * każda reguła ma datę obowiązywania, źródło i poziom pewności [P]/[PR]/[N];
      * reguła niezweryfikowana (puste `verified_on`) działa, ale pulpit pokazuje żółtą plakietkę;
      * brak reguły na dany dzień = błąd (nigdy cicha wartość domyślna);
      * zweryfikowanej reguły nie edytujemy: dodajemy nową wersję od nowej daty.
    """

    _name = "jdg.tax.rule"
    _description = "Reguła podatkowa / parametr"
    _order = "group, key, valid_from desc"
    _rec_name = "label"

    _key_from_uniq = models.UniqueIndex(
        "(key, valid_from, COALESCE(company_id, 0))",
        "Taka reguła (klucz + data od) już istnieje. Zmianę wartości zapisz jako nową wersję z nową datą 'od'.",
    )

    key = fields.Char("Klucz", required=True, index=True,
                      help="Techniczna nazwa parametru, np. min_wage albo health.rate_pct. Używa jej kod obliczeń.")
    label = fields.Char("Nazwa", required=True, translate=False, help="Czytelna nazwa po polsku.")
    group = fields.Selection([
        ("podatek", "Podatek (ryczałt)"),
        ("zdrowotna", "Składka zdrowotna"),
        ("zus", "ZUS (społeczne)"),
        ("vat", "VAT i OSS"),
        ("terminy", "Terminy i kalendarz"),
        ("inne", "Inne"),
    ], string="Grupa", default="inne", required=True)
    company_id = fields.Many2one("res.company", "Firma",
                                 help="Puste = reguła globalna. Reguła przypisana do firmy ma pierwszeństwo.")
    valid_from = fields.Date("Obowiązuje od", required=True, index=True)
    valid_to = fields.Date("Obowiązuje do", help="Puste = bezterminowo.")
    value_num = fields.Float("Wartość (liczba)", digits=(16, 6))
    value_char = fields.Char("Wartość (tekst)")
    value_json = fields.Json("Wartość (lista / tabela)")
    unit = fields.Char("Jednostka", help="PLN, %, EUR, dzień, miesiące...")
    value_display = fields.Char("Wartość", compute="_compute_value_display")
    description = fields.Text("Do czego służy / skąd ta liczba")
    source_url = fields.Char("Źródło (link)")
    source_note = fields.Text("Źródło i uwagi", help="Akt prawny, komunikat, interpretacja albo uwaga księgowego.")
    confidence = fields.Selection(CONFIDENCE, "Pewność", required=True, default="PR")
    verified_by = fields.Char("Zweryfikował")
    verified_on = fields.Date("Zweryfikowano dnia", help="Puste = niezweryfikowane: pulpit pokaże ostrzeżenie.")
    state = fields.Selection([
        ("draft", "Projekt / prognoza"),
        ("active", "Obowiązuje"),
        ("retired", "Wycofana"),
    ], string="Stan", default="active", required=True,
        help="Projekt: wartość prognozowana lub z projektu aktu (liczona, ale z ostrzeżeniem). Wycofana: pomijana.")
    supersedes_id = fields.Many2one("jdg.tax.rule", "Zastępuje", ondelete="set null")
    is_unverified = fields.Boolean("Niezweryfikowana", compute="_compute_is_unverified", store=True)

    @api.depends("verified_on")
    def _compute_is_unverified(self):
        for rule in self:
            rule.is_unverified = not rule.verified_on

    @api.depends("value_num", "value_char", "value_json", "unit")
    def _compute_value_display(self):
        for rule in self:
            if rule.value_json:
                text = ", ".join(str(x) for x in rule.value_json) if isinstance(rule.value_json, list) else str(rule.value_json)
            elif rule.value_char:
                text = rule.value_char
            else:
                number = rule.value_num
                text = f"{number:,.2f}".replace(",", " ").replace(".", ",") if number != int(number) else f"{int(number):,}".replace(",", " ")
            rule.value_display = f"{text} {rule.unit}".strip() if rule.unit else text

    @api.constrains("valid_from", "valid_to")
    def _check_dates(self):
        for rule in self:
            if rule.valid_to and rule.valid_to < rule.valid_from:
                raise ValidationError("Data 'obowiązuje do' nie może być wcześniejsza niż 'obowiązuje od'.")

    def write(self, vals):
        if VALUE_FIELDS & set(vals):
            for rule in self:
                if rule.verified_on and not self.env.context.get("jdg_force_rule_edit"):
                    raise UserError(
                        "Reguła '%s' jest zweryfikowana, więc nie zmieniamy jej wartości. "
                        "Dodaj nową wersję z nową datą 'obowiązuje od' (stara dostanie datę 'do')." % rule.label)
        return super().write(vals)

    def action_verify(self):
        """Oznacza regułę jako sprawdzoną w źródle (kto i kiedy). Bez tego pulpit pokazuje ostrzeżenie."""
        for rule in self:
            rule.write({"verified_by": self.env.user.name, "verified_on": fields.Date.context_today(self),
                        "state": "active" if rule.state == "draft" else rule.state})
        return True

    def action_unverify(self):
        self.with_context(jdg_force_rule_edit=True).write({"verified_by": False, "verified_on": False})
        return True

    # ----- odczyt reguł (jedyny sposób, w jaki obliczenia pobierają parametry) -----

    @api.model
    def _lookup(self, key, on_date, company=None):
        """Zwraca rekord reguły obowiązującej `on_date` albo rzuca UserError (nigdy domyślnej wartości)."""
        company = company or self.env.company
        domain = [
            ("key", "=", key),
            ("state", "!=", "retired"),
            ("valid_from", "<=", on_date),
            "|", ("valid_to", "=", False), ("valid_to", ">=", on_date),
            "|", ("company_id", "=", False), ("company_id", "=", company.id),
        ]
        # reguła firmy ma pierwszeństwo przed globalną, potem najpóźniejsze "od"
        found = self.search(domain, order="valid_from desc, company_id asc", limit=5)
        if not found:
            raise UserError(
                "Brak reguły '%s' na dzień %s. Dodaj ją w menu Firma > Ustawienia > Reguły i parametry." % (key, on_date))
        mine = found.filtered(lambda r: r.company_id == company)
        return (mine or found)[0]


class RuleReader:
    """Pomocnik: czyta reguły dla jednej firmy, buforuje wyniki i zapamiętuje, których reguł użyto
    (do stopki 'wersja reguł, pewność' i plakietki 'parametry niezweryfikowane')."""

    def __init__(self, env, company):
        self.env = env
        self.company = company
        self._cache = {}
        self.used = {}  # id -> rekord

    def rec(self, key, on_date):
        cache_key = (key, on_date)
        if cache_key not in self._cache:
            rule = self.env["jdg.tax.rule"]._lookup(key, on_date, self.company)
            self._cache[cache_key] = rule
            self.used[rule.id] = rule
        return self._cache[cache_key]

    def num(self, key, on_date):
        return dec(self.rec(key, on_date).value_num)

    def json(self, key, on_date):
        return self.rec(key, on_date).value_json

    def char(self, key, on_date):
        return self.rec(key, on_date).value_char

    def summary(self):
        """Podsumowanie użytych reguł: najniższa pewność, liczba niezweryfikowanych, najnowsza data 'od'."""
        rules = list(self.used.values())
        if not rules:
            return {"confidence": "PR", "unverified": 0, "drafts": 0, "since": False, "unverified_labels": []}
        worst = min(rules, key=lambda r: CONFIDENCE_RANK[r.confidence]).confidence
        unverified = [r for r in rules if not r.verified_on]
        return {
            "confidence": worst,
            "unverified": len(unverified),
            "drafts": len([r for r in rules if r.state == "draft"]),
            "since": max(r.valid_from for r in rules).isoformat(),
            "unverified_labels": sorted({r.label for r in unverified})[:12],
        }
