from odoo import api, fields, models
from odoo.exceptions import UserError


class JdgInvoiceCorrectionWizard(models.TransientModel):
    """Szkic faktury korygującej do wystawionej faktury. Źródłem jest wpis zwrotu w ewidencji (kwota ujemna):
    wskaż istniejący albo pozwól dopisać go tutaj (jak w „Korekta lub zwrot”). Faktura korygująca nie zmienia przychodu sama."""

    _name = "jdg.invoice.correction.wizard"
    _description = "Faktura korygująca"

    invoice_id = fields.Many2one("jdg.invoice", "Faktura korygowana", required=True, readonly=True)
    currency_id = fields.Many2one(related="invoice_id.currency_id")
    refund_entry_id = fields.Many2one(
        "jdg.income.entry", "Wpis zwrotu w ewidencji",
        domain="[('reverses_id', '=', invoice_entry_id), ('state', '=', 'posted'), ('invoice_ids', '=', False)]",
        help="Zostaw puste, aby dopisać nowy wpis zwrotu na kwotę poniżej.")
    invoice_entry_id = fields.Many2one(related="invoice_id.entry_id")
    remaining = fields.Monetary("Pozostaje na fakturze", currency_field="currency_id", related="invoice_id.remaining_gross")
    kind = fields.Selection([("refund", "Zwrot"), ("dispute_lost", "Przegrany spór (chargeback)"),
                             ("adjustment", "Korekta ręczna")], "Rodzaj nowego wpisu", default="refund")
    amount = fields.Monetary("Kwota do odjęcia", currency_field="currency_id",
                             help="Dodatnia; w pełnej korekcie (anulowaniu) cała pozostała kwota.")
    income_date = fields.Date("Data zwrotu", default=fields.Date.context_today)
    reason = fields.Char("Przyczyna korekty", required=True, default="Zwrot płatności na prośbę nabywcy")

    @api.model
    def default_get(self, fields_list):
        res = super().default_get(fields_list)
        invoice = self.env["jdg.invoice"].browse(res.get("invoice_id") or self.env.context.get("default_invoice_id"))
        if invoice:
            if "amount" in fields_list and "amount" not in res:
                res["amount"] = invoice.remaining_gross
            if "refund_entry_id" in fields_list and "refund_entry_id" not in res:
                free = self.env["jdg.income.entry"].search([
                    ("reverses_id", "=", invoice.entry_id.id), ("state", "=", "posted"), ("invoice_ids", "=", False)], limit=2)
                if len(free) == 1:
                    res["refund_entry_id"] = free.id
        return res

    @api.onchange("refund_entry_id")
    def _onchange_refund_entry(self):
        if self.refund_entry_id:
            self.amount = -self.refund_entry_id.amount
            self.income_date = self.refund_entry_id.income_date

    def action_confirm(self):
        self.ensure_one()
        invoice = self.invoice_id
        if invoice.state != "issued" or invoice.doc_type != "invoice":
            raise UserError("Korektę wystawia się do wystawionej faktury sprzedaży.")
        entry = self.refund_entry_id
        if not entry:
            if self.amount <= 0:
                raise UserError("Podaj dodatnią kwotę korekty.")
            if self.amount - invoice.remaining_gross > 0.005:
                raise UserError("Kwota korekty przekracza wartość faktury pozostałą po poprzednich korektach.")
            wiz = self.env["jdg.income.correct.wizard"].create({
                "entry_id": invoice.entry_id.id, "kind": self.kind, "amount": self.amount,
                "income_date": self.income_date, "reason": self.reason,
            })
            action = wiz.action_confirm()
            entry = self.env["jdg.income.entry"].browse(action["res_id"])
        correction = self.env["jdg.invoice"]._create_correction(invoice, entry, self.reason)
        return correction._action_open()
