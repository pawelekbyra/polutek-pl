from odoo import api, fields, models
from odoo.exceptions import ValidationError

from . import engine

KINDS = [
    ("zus_social", "ZUS: składki społeczne"),
    ("zus_fp", "ZUS: Fundusz Pracy"),
    ("health", "Składka zdrowotna"),
    ("income_tax_advance", "Zaliczka na ryczałt"),
]


class JdgContributionPayment(models.Model):
    """Zapłacone składki i zaliczki: podstawa odliczeń od ryczałtu.

    Od przychodu odliczamy tylko składki ZAPŁACONE (100% społecznych, 50% zdrowotnej), więc sama należność
    nie wystarczy: zapisujemy fakt zapłaty i jej datę. Data zapłaty (`paid_on`) decyduje, w którym okresie
    odliczenie się liczy [PR]. Jedno kliknięcie 'Zapłaciłem' podpowiada kwotę należną.
    """

    _name = "jdg.contribution.payment"
    _description = "Zapłacona składka lub zaliczka"
    _order = "paid_on desc, id desc"

    _amount_check = models.Constraint("CHECK(amount >= 0)", "Kwota zapłaty nie może być ujemna.")

    company_id = fields.Many2one("res.company", "Firma", required=True, default=lambda self: self.env.company)
    currency_id = fields.Many2one("res.currency", compute="_compute_currency", store=True)
    kind = fields.Selection(KINDS, "Co zapłacono", required=True, default="health")
    for_month = fields.Date("Za miesiąc", required=True, default=lambda self: fields.Date.context_today(self).replace(day=1),
                            help="Miesiąc, którego dotyczy składka (dla zaliczki kwartalnej: pierwszy miesiąc kwartału). "
                                 "Zapisujemy pierwszy dzień miesiąca.")
    paid_on = fields.Date("Data zapłaty", required=True, default=fields.Date.context_today, index=True,
                          help="Dzień obciążenia konta. Od tej daty składka obniża podstawę ryczałtu.")
    amount = fields.Monetary("Zapłacona kwota", currency_field="currency_id", required=True)
    due_amount = fields.Monetary("Należność wg modułu", currency_field="currency_id", readonly=True,
                                 help="Szacunek należności z chwili zapisu (do porównania z przelewem).")
    reference = fields.Char("Dokument / referencja", help="Np. numer deklaracji DRA albo tytuł przelewu.")
    source = fields.Selection([("manual", "Ręcznie"), ("bank_import", "Import z banku")], default="manual", required=True)
    note = fields.Text("Uwagi")

    def _compute_currency(self):
        pln = self.env.ref("base.PLN")
        for payment in self:
            payment.currency_id = pln

    @api.constrains("for_month")
    def _check_first_day(self):
        for payment in self:
            if payment.for_month and payment.for_month.day != 1:
                raise ValidationError("Pole 'Za miesiąc' musi być pierwszym dniem miesiąca.")

    @api.onchange("for_month")
    def _onchange_month_normalize(self):
        for payment in self:
            if payment.for_month and payment.for_month.day != 1:
                payment.for_month = payment.for_month.replace(day=1)

    @api.onchange("kind", "for_month")
    def _onchange_suggest_amount(self):
        """Podpowiada kwotę należną ('Zapłaciłem' jednym kliknięciem). Szacunek, nie porada podatkowa."""
        for payment in self:
            if payment.kind and payment.for_month:
                suggestion = payment._suggested_amount()
                if suggestion is not None:
                    payment.amount = suggestion
                    payment.due_amount = suggestion

    def _suggested_amount(self):
        from .calc import CalcContext  # import lokalny: calc zależy od modeli

        self.ensure_one()
        month = self.for_month.replace(day=1)
        profile = self.env["jdg.profile"]._get(self.company_id or self.env.company)
        try:
            ctx = CalcContext(self.env, profile, engine.month_end(month))
            if self.kind == "health":
                return float(ctx.health_for_month(month).amount)
            if self.kind in ("zus_social", "zus_fp"):
                social = ctx.social_for_month(month)
                return float(social.social if self.kind == "zus_social" else social.fp)
            if self.kind == "income_tax_advance":
                start, end = engine.period_bounds(month, profile.advance_rhythm)
                return float(ctx.period_advance(start, end)["advance"])
        except Exception:  # podpowiedź nie może blokować formularza (np. brak reguły)
            return None
        return None

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("for_month"):
                month = fields.Date.to_date(vals["for_month"])
                vals["for_month"] = month.replace(day=1)
            paid_on = fields.Date.to_date(vals.get("paid_on")) or fields.Date.context_today(self)
            company = self.env["res.company"].browse(vals["company_id"]) if vals.get("company_id") else self.env.company
            self.env["jdg.period"]._assert_open(company, paid_on, "Płatność")
        records = super().create(vals_list)
        records._after_change()
        return records

    def write(self, vals):
        if {"paid_on", "amount", "kind", "for_month"} & set(vals):
            for payment in self:
                self.env["jdg.period"]._assert_open(payment.company_id, payment.paid_on, "Płatność")
                if vals.get("paid_on"):
                    self.env["jdg.period"]._assert_open(payment.company_id, fields.Date.to_date(vals["paid_on"]), "Płatność")
        res = super().write(vals)
        self._after_change()
        return res

    def unlink(self):
        for payment in self:
            self.env["jdg.period"]._assert_open(payment.company_id, payment.paid_on, "Płatność")
        companies = self.company_id
        res = super().unlink()
        for company in companies:
            self.env["jdg.tax.advance"]._sync_all(company)
        return res

    def _after_change(self):
        """Po zapisie płatności: odśwież stan zapisanych zaliczek i domknij odpowiadający termin."""
        for company in self.company_id:
            self.env["jdg.tax.advance"]._sync_all(company)
        for payment in self:
            self.env["jdg.deadline"]._mark_done_for_payment(payment)
