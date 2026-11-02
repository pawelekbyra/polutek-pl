from odoo import api, fields, models
from odoo.exceptions import UserError


class JdgIncomeCorrectWizard(models.TransientModel):
    """Korekta lub zwrot: dopisuje NOWY, ujemny wpis, bo zaksięgowanego wpisu nie edytujemy."""

    _name = "jdg.income.correct.wizard"
    _description = "Korekta lub zwrot wpisu przychodu"

    entry_id = fields.Many2one("jdg.income.entry", "Koryguję wpis", required=True, readonly=True)
    currency_id = fields.Many2one(related="entry_id.currency_id")
    kind = fields.Selection([("refund", "Zwrot"), ("dispute_lost", "Przegrany spór (chargeback)"),
                             ("adjustment", "Korekta ręczna")], "Rodzaj", required=True, default="refund")
    amount = fields.Monetary("Kwota do odjęcia", currency_field="currency_id", required=True,
                             help="Podaj kwotę dodatnią: wpis korygujący zapisze się jako ujemny.")
    income_date = fields.Date("Data zwrotu / korekty", required=True, default=fields.Date.context_today,
                              help="Przychód pomniejszamy w miesiącu zwrotu, kurs NBP z dnia roboczego przed tą datą [N: do "
                                   "potwierdzenia z księgowym, pytanie P-Z7].")
    reason = fields.Text("Powód", required=True)

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        entry = self.env["jdg.income.entry"].browse(res.get("entry_id") or self.env.context.get("default_entry_id"))
        if entry and "amount" in fields_list and "amount" not in res:
            res["amount"] = abs(entry.amount)
        return res

    def action_confirm(self):
        self.ensure_one()
        entry = self.entry_id
        if entry.state != "posted":
            raise UserError("Korygować można tylko zaksięgowany wpis. Wpis roboczy po prostu popraw lub usuń.")
        if self.amount <= 0:
            raise UserError("Kwota korekty musi być dodatnia (zapiszemy ją jako ujemną).")
        new = self.env["jdg.income.entry"].create({
            "kind": self.kind, "income_date": self.income_date, "currency_id": entry.currency_id.id,
            "amount": -self.amount, "description": "Korekta: %s" % (entry.description or entry.name),
            "doc_ref": entry.doc_ref, "income_category": entry.income_category, "rate_pct": entry.rate_pct,
            "is_test": entry.is_test, "reverses_id": entry.id, "note": self.reason,
            "buyer_type": entry.buyer_type, "country_code": entry.country_code,
        })
        new.action_post()
        return {"type": "ir.actions.act_window", "res_model": "jdg.income.entry", "res_id": new.id,
                "view_mode": "form", "target": "current"}
