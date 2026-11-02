from odoo import api, fields, models
from odoo.exceptions import UserError

from . import engine


class JdgTaxAdvance(models.Model):
    """Zaliczka na ryczałt za zamknięty okres (SPEC 2.8): zapisana przy zamknięciu, potem tylko stan płatności.

    Kwoty (przychód, odliczenia, podatek narastająco, poprzednie zaliczki, zaliczka) są zamrożone w chwili zamknięcia.
    Zmienia się wyłącznie część płatnicza (zapłacono, kiedy, stan), wyliczana z zapisanych płatności
    (`jdg.contribution.payment`, rodzaj 'Zaliczka na ryczałt', miesiąc w okresie).
    """

    _name = "jdg.tax.advance"
    _description = "Zaliczka na ryczałt za okres"
    _order = "date_from desc"

    _period_uniq = models.UniqueIndex("(period_id)", "Okres ma jedną zaliczkę.")

    period_id = fields.Many2one("jdg.period", "Okres", required=True, ondelete="cascade", index=True)
    company_id = fields.Many2one("res.company", related="period_id.company_id", store=True, index=True)
    date_from = fields.Date(related="period_id.date_from", store=True)
    date_to = fields.Date(related="period_id.date_to", store=True)
    pln_currency_id = fields.Many2one("res.currency", compute="_compute_pln_currency")
    name = fields.Char("Zaliczka", compute="_compute_name")
    cum_revenue = fields.Monetary("Przychód narastająco", currency_field="pln_currency_id", readonly=True)
    cum_social_paid = fields.Monetary("Zapłacone społeczne (odliczenie 100%)", currency_field="pln_currency_id", readonly=True)
    cum_health_paid = fields.Monetary("Zapłacona zdrowotna (odliczenie 50%)", currency_field="pln_currency_id", readonly=True)
    base_rounded = fields.Monetary("Podstawa (pełne zł)", currency_field="pln_currency_id", readonly=True)
    cum_tax = fields.Monetary("Podatek narastająco", currency_field="pln_currency_id", readonly=True)
    prev_advances = fields.Monetary("Zaliczki za wcześniejsze okresy", currency_field="pln_currency_id", readonly=True)
    advance_due = fields.Monetary("Zaliczka do zapłaty", currency_field="pln_currency_id", readonly=True)
    shadow_rate_pct = fields.Float("Stawka cienia (%)", digits=(5, 2), readonly=True)
    shadow_advance = fields.Monetary("Zaliczka wg stawki cienia", currency_field="pln_currency_id", readonly=True,
                                     help="Ile wyniosłaby zaliczka przy wyższej stawce (15%), gdyby księgowy uznał inną klasyfikację.")
    due_date = fields.Date("Termin płatności", readonly=True)
    paid_amount = fields.Monetary("Zapłacono", currency_field="pln_currency_id", readonly=True)
    paid_on = fields.Date("Ostatnia zapłata", readonly=True)
    state = fields.Selection([
        ("zero", "Brak zaliczki"),
        ("due", "Do zapłaty"),
        ("partial", "Zapłacona częściowo"),
        ("paid", "Zapłacona"),
    ], string="Stan", default="due", required=True, index=True)
    is_overdue = fields.Boolean("Po terminie", compute="_compute_is_overdue")

    def _compute_pln_currency(self):
        pln = self.env.ref("base.PLN")
        for adv in self:
            adv.pln_currency_id = pln

    def _compute_name(self):
        for adv in self:
            adv.name = "Zaliczka: %s" % (adv.period_id.name or "")

    def _compute_is_overdue(self):
        today = fields.Date.context_today(self)
        for adv in self:
            adv.is_overdue = adv.state in ("due", "partial") and bool(adv.due_date) and adv.due_date < today

    @api.model
    def _from_snapshot(self, period, advance, shadow):
        vals = {
            "period_id": period.id, "cum_revenue": float(engine.dec(advance["cum_revenue"])),
            "cum_social_paid": float(engine.dec(advance["cum_social_paid"])),
            "cum_health_paid": float(engine.dec(advance["cum_health_paid"])),
            "base_rounded": float(engine.dec(advance["base"])), "cum_tax": float(engine.dec(advance["cum_tax"])),
            "prev_advances": float(engine.dec(advance["previous_advances"])),
            "advance_due": float(engine.dec(advance["advance"])), "due_date": advance["due_date"],
            "shadow_rate_pct": float(engine.dec(shadow["rate_pct"])) if shadow else 0.0,
            "shadow_advance": float(engine.dec(shadow["advance"])) if shadow else 0.0,
        }
        record = self.sudo().create(vals)
        record._sync_payment()
        return record

    def _sync_payment(self):
        """Ustawia stan płatności na podstawie zapisanych płatności zaliczki z miesiącami w okresie."""
        for adv in self:
            payments = self.env["jdg.contribution.payment"].sudo().search([
                ("company_id", "=", adv.company_id.id), ("kind", "=", "income_tax_advance"),
                ("for_month", ">=", adv.date_from), ("for_month", "<=", adv.date_to)])
            paid = sum(payments.mapped("amount"))
            if adv.advance_due <= 0:
                state = "zero"
            elif paid >= adv.advance_due - 0.005:
                state = "paid"
            elif paid > 0:
                state = "partial"
            else:
                state = "due"
            adv.sudo().write({"paid_amount": paid, "paid_on": max(payments.mapped("paid_on")) if payments else False,
                              "state": state})

    @api.model
    def _sync_all(self, company):
        self.sudo().search([("company_id", "=", company.id)])._sync_payment()

    def unlink(self):
        if not self.env.context.get("jdg_allow_advance_unlink"):
            raise UserError("Zaliczki zapisanej przy zamknięciu nie usuwamy. Cofnij zamknięcie okresu (z powodem).")
        return super().unlink()

    def write(self, vals):
        locked = {"cum_revenue", "cum_social_paid", "cum_health_paid", "base_rounded", "cum_tax", "prev_advances",
                  "advance_due", "due_date", "period_id", "shadow_rate_pct", "shadow_advance"}
        if locked & set(vals):
            raise UserError("Kwoty zaliczki są zamrożone w chwili zamknięcia okresu.")
        return super().write(vals)
