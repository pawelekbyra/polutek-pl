"""Faktury (iteracja 4): wystawiane NA ŻĄDANIE kupującego z zaksięgowanego wpisu ewidencji.

Zasady:
  * Faktura NIE zmienia przychodu: przychód wynika z wpisu ewidencji (`jdg.income.entry`), faktura tylko go dokumentuje
    i jest z nim powiązana (`entry_id`). Kwota faktury = kwota wpisu (sprawdzane przy wystawieniu).
  * Dane sprzedawcy (profil firmy) i nabywcy są ZAMRAŻANE na dokumencie przy wystawieniu. Bez kompletnych danych sprzedawcy
    (NIP, adres) fakturę można tylko obejrzeć jako podgląd (PDF z napisem), ale nie wystawić.
  * Numer `FV/rok/0001` (korekty `FK/rok/0001`) nadawany jest dopiero przy wystawieniu, w jednej transakcji, pod blokadą wiersza
    profilu: bez luk i bez dubli. Wystawionej faktury nie da się edytować ani usunąć (ORM + trigger w bazie); anulowanie to
    faktura korygująca. Faktury testowe mają własną numerację `TEST-FV/...`, żeby nie zużywały numerów prawdziwej serii.
  * Zwolnienie z VAT (art. 113): kwota brutto = netto, stawka „zw.”, na fakturze podstawa zwolnienia z profilu. Gdy wpis
    powstał przy czynnym VAT (vat_due): stawka z wpisu, netto/VAT wyliczone z brutto.
  * Waluta obca: kwoty w walucie sprzedaży + kurs NBP, numer tabeli, data kursu i wartość w PLN (kurs z wpisu ewidencji).

Wszystko to pomoc dla przedsiębiorcy, nie porada podatkowa ani prawna.
"""

import logging

from odoo import api, fields, models
from odoo.exceptions import UserError, ValidationError

from . import engine

_logger = logging.getLogger(__name__)

# Po wystawieniu wolno zmienić wyłącznie te pola (notatka wewnętrzna, numer KSeF dopisany później).
MUTABLE_AFTER_ISSUE = {"note", "ksef_number", "message_main_attachment_id"}

FROZEN_COLUMNS = [
    "state", "number", "seq_no", "seq_year", "journal", "company_id", "doc_type", "entry_id", "original_id",
    "issue_date", "sale_date", "payment_note", "currency_id", "vat_mode", "vat_rate_pct", "amount_net", "amount_vat",
    "amount_gross", "before_gross", "after_gross", "fx_rate", "fx_table_no", "fx_date", "amount_net_pln", "amount_vat_pln",
    "amount_gross_pln", "buyer_type", "buyer_name", "buyer_tax_id", "buyer_street", "buyer_zip", "buyer_city",
    "buyer_country_id", "buyer_email", "seller_name", "seller_nip", "seller_street", "seller_zip", "seller_city",
    "seller_country_id", "seller_email", "exempt_basis", "footer_text", "reason", "is_test",
]

GUARD_SQL = """
CREATE OR REPLACE FUNCTION jdg_invoice_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.state = 'issued' AND NOT OLD.is_test THEN
            RAISE EXCEPTION 'jdg: wystawiona faktura (id=%) nie moze byc usunieta. Anuluj ja faktura korygujaca.', OLD.id;
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.state = 'issued' AND (%(cond)s) THEN
        RAISE EXCEPTION 'jdg: wystawiona faktura (id=%) jest niezmienna. Wystaw fakture korygujaca.', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS jdg_invoice_guard ON jdg_invoice;
CREATE TRIGGER jdg_invoice_guard BEFORE UPDATE OR DELETE ON jdg_invoice
    FOR EACH ROW EXECUTE FUNCTION jdg_invoice_guard();
"""


LINE_GUARD_SQL = """
CREATE OR REPLACE FUNCTION jdg_invoice_line_guard() RETURNS trigger AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM jdg_invoice WHERE id = OLD.invoice_id AND state = 'issued' AND NOT is_test) THEN
        RAISE EXCEPTION 'jdg: pozycja wystawionej faktury (id=%) jest niezmienna.', OLD.id;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS jdg_invoice_line_guard ON jdg_invoice_line;
CREATE TRIGGER jdg_invoice_line_guard BEFORE UPDATE OR DELETE ON jdg_invoice_line
    FOR EACH ROW EXECUTE FUNCTION jdg_invoice_line_guard();
"""


def _f(value):
    return float(engine.jdg_round(value))


class JdgInvoice(models.Model):
    _name = "jdg.invoice"
    _description = "Faktura"
    _inherit = ["mail.thread"]
    _order = "issue_date desc, id desc"
    _mail_post_access = "read"

    _entry_uniq = models.UniqueIndex("(entry_id)", "Do tego wpisu ewidencji jest już faktura (jeden wpis = jeden dokument).")
    _number_uniq = models.UniqueIndex(
        "(company_id, journal, seq_year, seq_no, is_test) WHERE seq_no IS NOT NULL",
        "Numer faktury musi być unikalny w serii i roku.")
    _company_state_idx = models.Index("(company_id, state, issue_date)")

    name = fields.Char("Numer", compute="_compute_name")
    company_id = fields.Many2one("res.company", "Firma", required=True, default=lambda self: self.env.company, index=True)
    state = fields.Selection([("draft", "Szkic"), ("issued", "Wystawiona")], "Stan", default="draft", required=True,
                             index=True, copy=False, tracking=True)
    doc_type = fields.Selection([("invoice", "Faktura"), ("correction", "Faktura korygująca")], "Rodzaj", default="invoice",
                                required=True, index=True)
    journal = fields.Selection([("FV", "FV (sprzedaż)"), ("FK", "FK (korekty)")], "Dziennik", compute="_compute_journal",
                               store=True)
    is_test = fields.Boolean("Faktura testowa", index=True,
                             help="Dziedziczona z wpisu testowego. Ma własną numerację TEST-FV i nie jest prawdziwą fakturą.")
    number = fields.Char("Numer faktury", readonly=True, copy=False, index=True)
    seq_no = fields.Integer("Nr kolejny", readonly=True, copy=False)
    seq_year = fields.Integer("Rok numeracji", readonly=True, copy=False)
    issued_on = fields.Datetime("Wystawiono (czas)", readonly=True, copy=False)
    issued_by = fields.Many2one("res.users", "Wystawił", readonly=True, copy=False)

    entry_id = fields.Many2one("jdg.income.entry", "Wpis ewidencji", required=True, ondelete="restrict", index=True,
                               readonly=True, help="Faktura dokumentuje ten wpis; przychód liczy się z wpisu, nie z faktury.")
    original_id = fields.Many2one("jdg.invoice", "Faktura korygowana", readonly=True, ondelete="restrict", copy=False)
    correction_ids = fields.One2many("jdg.invoice", "original_id", "Korekty")
    corrected_gross = fields.Monetary("Skorygowano łącznie (brutto)", currency_field="currency_id",
                                      compute="_compute_correction_state")
    remaining_gross = fields.Monetary("Pozostaje po korektach (brutto)", currency_field="currency_id",
                                      compute="_compute_correction_state")
    correction_state = fields.Selection([("none", "Bez korekt"), ("partial", "Skorygowana częściowo"),
                                         ("full", "Skorygowana w całości (anulowana)")], compute="_compute_correction_state",
                                        string="Korekty")

    issue_date = fields.Date("Data wystawienia", default=fields.Date.context_today, copy=False)
    sale_date = fields.Date("Data sprzedaży", required=True,
                            help="Data dokonania dostawy / wykonania usługi lub otrzymania zapłaty (art. 106e ust. 1 pkt 6).")
    payment_note = fields.Char("Płatność", default="Zapłacono online (płatność kartą / szybka płatność)")

    currency_id = fields.Many2one("res.currency", "Waluta", required=True)
    pln_currency_id = fields.Many2one("res.currency", default=lambda self: self.env.ref("base.PLN"))
    is_foreign = fields.Boolean(compute="_compute_is_foreign")
    vat_mode = fields.Selection([("exempt", "Zwolniony z VAT"), ("active", "Czynny podatnik VAT")], "VAT", required=True,
                                default="exempt")
    vat_rate_pct = fields.Float("Stawka VAT (%)", digits=(5, 2), default=0.0)
    exempt_basis = fields.Char("Podstawa zwolnienia z VAT")
    line_ids = fields.One2many("jdg.invoice.line", "invoice_id", "Pozycje", copy=True)
    amount_net = fields.Monetary("Wartość netto", currency_field="currency_id")
    amount_vat = fields.Monetary("Kwota VAT", currency_field="currency_id")
    amount_gross = fields.Monetary("Razem brutto (należność)", currency_field="currency_id")
    before_gross = fields.Monetary("Brutto przed korektą", currency_field="currency_id")
    after_gross = fields.Monetary("Brutto po korekcie", currency_field="currency_id")
    fx_rate = fields.Float("Kurs NBP", digits=(12, 6), default=1.0)
    fx_table_no = fields.Char("Tabela NBP")
    fx_date = fields.Date("Data kursu NBP")
    amount_net_pln = fields.Monetary("Netto w PLN", currency_field="pln_currency_id")
    amount_vat_pln = fields.Monetary("VAT w PLN", currency_field="pln_currency_id")
    amount_gross_pln = fields.Monetary("Brutto w PLN", currency_field="pln_currency_id")

    buyer_type = fields.Selection([("b2c", "Konsument (B2C)"), ("b2b", "Firma (B2B)")], "Nabywca", default="b2c", required=True)
    buyer_name = fields.Char("Nabywca: nazwa lub imię i nazwisko")
    buyer_tax_id = fields.Char("Nabywca: NIP / numer VAT UE")
    buyer_street = fields.Char("Nabywca: ulica i numer")
    buyer_zip = fields.Char("Nabywca: kod pocztowy")
    buyer_city = fields.Char("Nabywca: miejscowość")
    buyer_country_id = fields.Many2one("res.country", "Nabywca: kraj", default=lambda self: self.env.ref("base.pl", raise_if_not_found=False))
    buyer_email = fields.Char("Nabywca: e-mail", help="Tylko do kontaktu; PDF pobierasz ręcznie (wysyłka e-mailem poza zakresem).")

    seller_name = fields.Char("Sprzedawca")
    seller_nip = fields.Char("Sprzedawca: NIP")
    seller_street = fields.Char("Sprzedawca: ulica i numer")
    seller_zip = fields.Char("Sprzedawca: kod")
    seller_city = fields.Char("Sprzedawca: miejscowość")
    seller_country_id = fields.Many2one("res.country", "Sprzedawca: kraj")
    seller_email = fields.Char("Sprzedawca: e-mail")
    footer_text = fields.Text("Stopka")

    reason = fields.Char("Przyczyna korekty")
    note = fields.Text("Notatka wewnętrzna", help="Nie drukuje się na fakturze; można edytować po wystawieniu.")
    ksef_number = fields.Char("Numer KSeF", help="Gdy fakturę B2B wystawisz w KSeF, wpisz tu jej numer (pole można dopisać po wystawieniu).")

    seller_missing = fields.Char("Brakuje danych sprzedawcy", compute="_compute_seller_missing")
    is_preview = fields.Boolean("Tylko podgląd", compute="_compute_seller_missing")
    ksef_warning = fields.Boolean(compute="_compute_ksef_warning")
    correction_count = fields.Integer(compute="_compute_correction_count")

    # ------------------------------------------------------------------ pola obliczane

    @api.depends("doc_type")
    def _compute_journal(self):
        for inv in self:
            inv.journal = "FK" if inv.doc_type == "correction" else "FV"

    @api.depends("number", "state", "doc_type", "is_test")
    def _compute_name(self):
        for inv in self:
            if inv.number:
                inv.name = inv.number
            else:
                inv.name = "Szkic korekty" if inv.doc_type == "correction" else "Szkic faktury"

    @api.depends("name", "buyer_name")
    def _compute_display_name(self):
        for inv in self:
            inv.display_name = inv.name

    @api.depends("currency_id")
    def _compute_is_foreign(self):
        for inv in self:
            inv.is_foreign = bool(inv.currency_id) and inv.currency_id.name != "PLN"

    @api.depends("correction_ids.state", "correction_ids.amount_gross", "amount_gross", "doc_type")
    def _compute_correction_state(self):
        for inv in self:
            issued = inv.correction_ids.filtered(lambda c: c.state == "issued")
            diff = sum(issued.mapped("amount_gross"))
            inv.corrected_gross = diff
            inv.remaining_gross = (inv.amount_gross + diff) if inv.doc_type == "invoice" else 0.0
            if inv.doc_type != "invoice" or not issued:
                inv.correction_state = "none"
            elif abs(inv.amount_gross + diff) < 0.005:
                inv.correction_state = "full"
            else:
                inv.correction_state = "partial"

    @api.depends("correction_ids")
    def _compute_correction_count(self):
        for inv in self:
            inv.correction_count = len(inv.correction_ids)

    @api.depends("state", "company_id", "is_test")
    def _compute_seller_missing(self):
        for inv in self:
            inv.seller_missing = False
            inv.is_preview = False
            if inv.state != "draft":
                continue
            missing = self.env["jdg.profile"]._get(inv.company_id)._seller_missing()
            if inv.is_test:
                missing = []
            inv.seller_missing = ", ".join(missing)
            inv.is_preview = bool(missing)

    @api.depends("buyer_type", "buyer_country_id", "buyer_tax_id", "doc_type")
    def _compute_ksef_warning(self):
        for inv in self:
            inv.ksef_warning = bool(
                inv.buyer_type == "b2b" and inv.buyer_country_id.code == "PL" and engine.nip_normalize(inv.buyer_tax_id))

    # ------------------------------------------------------------------ pomocniki do PDF

    def _fmt_num(self, value, digits=2):
        text = "{:,.{d}f}".format(value or 0.0, d=digits)
        return text.replace(",", " ").replace(".", ",")

    def _fmt_money(self, value, currency=None):
        currency = currency or self.currency_id
        return "%s %s" % (self._fmt_num(value), currency.name)

    def _fmt_date(self, value):
        return value.strftime("%d.%m.%Y") if value else ""

    def _party_lines(self, prefix):
        self.ensure_one()
        name, street, zip_, city = (self[prefix + k] for k in ("_name", "_street", "_zip", "_city"))
        country = self[prefix + "_country_id"]
        lines = [name or ""]
        lines.append(street or "")
        lines.append(" ".join(x for x in (zip_, city) if x))
        if country and country.code != "PL":
            lines.append(country.name)
        return [x for x in lines if x]

    def _tax_id_label(self, party):
        self.ensure_one()
        country = self.seller_country_id if party == "seller" else self.buyer_country_id
        return "NIP" if not country or country.code == "PL" else "Nr VAT / NIP"

    def _vat_label(self):
        self.ensure_one()
        if self.vat_mode == "exempt":
            return "zw."
        return "%s%%" % self._fmt_num(self.vat_rate_pct, 0 if self.vat_rate_pct == int(self.vat_rate_pct) else 2)

    def _split(self, gross):
        net, vat = engine.split_gross(gross, self.vat_rate_pct if self.vat_mode == "active" else 0)
        return float(net), float(vat)

    # ------------------------------------------------------------------ dane sprzedawcy

    @api.model
    def _seller_vals(self, company):
        profile = self.env["jdg.profile"]._get(company)
        return {
            "seller_name": profile._seller_display_name(),
            "seller_nip": engine.nip_normalize(profile.seller_nip) or False,
            "seller_street": profile.seller_street or False,
            "seller_zip": profile.seller_zip or False,
            "seller_city": profile.seller_city or False,
            "seller_country_id": profile.seller_country_id.id or False,
            "seller_email": profile.seller_email or False,
            "footer_text": profile.invoice_footer or False,
            "exempt_basis": profile.vat_exempt_basis or False,
        }

    def action_refresh_seller(self):
        for inv in self:
            if inv.state != "draft":
                raise UserError("Dane sprzedawcy odświeża się tylko w szkicu.")
            vals = self._seller_vals(inv.company_id)
            if inv.vat_mode != "exempt":
                vals.pop("exempt_basis", None)
            inv.write(vals)
        return True

    def action_open_profile(self):
        return self.env["jdg.profile"].action_open_my_profile()

    # ------------------------------------------------------------------ tworzenie szkicu

    @api.model
    def _create_from_entry(self, entry):
        """Szkic faktury sprzedaży z zaksięgowanego wpisu `sale`. Nie zmienia ewidencji."""
        entry.ensure_one()
        if entry.invoice_ids:
            return entry.invoice_ids[0]
        if entry.state != "posted":
            raise UserError("Fakturę wystawia się do zaksięgowanego wpisu. Najpierw kliknij „Zaksięguj”.")
        if entry.kind == "donation":
            raise UserError("Darowizna (napiwek) nie jest sprzedażą usługi, więc nie wystawiamy do niej faktury.")
        if entry.kind != "sale":
            raise UserError("Fakturę sprzedaży wystawiamy do wpisu typu „Sprzedaż”. Do zwrotu wystaw fakturę korygującą "
                            "(przycisk na wpisie zwrotu albo na fakturze).")
        if entry.amount <= 0:
            raise UserError("Kwota wpisu musi być dodatnia.")
        if entry.fx_source == "missing" or (entry.currency_id.name != "PLN" and entry.fx_rate <= 0):
            raise UserError("Wpis nie ma kursu NBP, więc nie da się podać wartości w PLN. Uzupełnij kurs i spróbuj ponownie.")
        active = bool(entry.vat_due)
        rate = entry.vat_rate_pct if active else 0.0
        net, vat = engine.split_gross(entry.amount, rate if active else 0)
        net_pln, vat_pln = engine.split_gross(entry.pln_amount, rate if active else 0)
        country = self.env["res.country"].search([("code", "=", (entry.country_code or "PL").upper())], limit=1)
        vals = {
            "company_id": entry.company_id.id, "entry_id": entry.id, "doc_type": "invoice", "is_test": entry.is_test,
            "sale_date": entry.income_date, "currency_id": entry.currency_id.id,
            "vat_mode": "active" if active else "exempt", "vat_rate_pct": rate,
            "amount_net": _f(net), "amount_vat": _f(vat), "amount_gross": _f(entry.amount),
            "fx_rate": entry.fx_rate or 1.0, "fx_table_no": entry.fx_table_no or entry.fx_rate_id.table_no or False,
            "fx_date": entry.fx_rate_id.rate_date or False,
            "amount_net_pln": _f(net_pln), "amount_vat_pln": _f(vat_pln), "amount_gross_pln": _f(entry.pln_amount),
            "buyer_type": entry.buyer_type or "b2c", "buyer_country_id": country.id or False,
            "line_ids": [(0, 0, {
                "name": entry.description or "Dostęp do materiałów wideo",
                "quantity": 1.0, "unit": "szt.", "unit_price": _f(net),
                "amount_net": _f(net), "amount_vat": _f(vat), "amount_gross": _f(entry.amount),
            })],
        }
        vals.update(self._seller_vals(entry.company_id))
        if active:
            vals["exempt_basis"] = False
        return self.create(vals)

    @api.model
    def _create_correction(self, original, refund_entry, reason):
        """Szkic faktury korygującej do `original` wynikającej z wpisu zwrotu (`refund_entry`, kwota ujemna)."""
        if original.doc_type != "invoice" or original.state != "issued":
            raise UserError("Korektę można wystawić tylko do wystawionej faktury sprzedaży.")
        if refund_entry.state != "posted" or refund_entry.amount >= 0:
            raise UserError("Korekta wynika ze wpisu zwrotu (zaksięgowany, kwota ujemna).")
        if refund_entry.reverses_id != original.entry_id:
            raise UserError("Wpis zwrotu musi korygować wpis, którego dotyczy faktura.")
        if refund_entry.invoice_ids:
            return refund_entry.invoice_ids[0]
        diff = refund_entry.amount
        before = original.remaining_gross
        after = before + diff
        if after < -0.005:
            raise UserError("Korekta (%.2f) przekracza wartość faktury pozostałą po poprzednich korektach (%.2f)." % (-diff, before))
        net, vat = original._split(diff)
        pln_net, pln_vat = engine.split_gross(
            refund_entry.pln_amount, original.vat_rate_pct if original.vat_mode == "active" else 0)
        vals = {
            "company_id": original.company_id.id, "entry_id": refund_entry.id, "doc_type": "correction",
            "original_id": original.id, "is_test": original.is_test, "sale_date": original.sale_date,
            "currency_id": original.currency_id.id, "vat_mode": original.vat_mode, "vat_rate_pct": original.vat_rate_pct,
            "exempt_basis": original.exempt_basis,
            "amount_net": net, "amount_vat": vat, "amount_gross": diff,
            "before_gross": before, "after_gross": after,
            "fx_rate": refund_entry.fx_rate or 1.0,
            "fx_table_no": refund_entry.fx_table_no or refund_entry.fx_rate_id.table_no or False,
            "fx_date": refund_entry.fx_rate_id.rate_date or False,
            "amount_net_pln": _f(pln_net), "amount_vat_pln": _f(pln_vat), "amount_gross_pln": _f(refund_entry.pln_amount),
            "reason": reason,
            "buyer_type": original.buyer_type, "buyer_name": original.buyer_name, "buyer_tax_id": original.buyer_tax_id,
            "buyer_street": original.buyer_street, "buyer_zip": original.buyer_zip, "buyer_city": original.buyer_city,
            "buyer_country_id": original.buyer_country_id.id, "buyer_email": original.buyer_email,
            "line_ids": [(0, 0, {
                "name": (original.line_ids[:1].name or original.entry_id.description or "Usługa"),
                "quantity": 1.0, "unit": "szt.", "unit_price": net, "amount_net": net, "amount_vat": vat, "amount_gross": diff,
            })],
        }
        vals.update(self._seller_vals(original.company_id))
        if original.vat_mode != "exempt":
            vals["exempt_basis"] = False
        return self.create(vals)

    def _action_open(self):
        self.ensure_one()
        return {"type": "ir.actions.act_window", "res_model": "jdg.invoice", "res_id": self.id, "view_mode": "form",
                "target": "current"}

    # ------------------------------------------------------------------ create / write / unlink

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("state") == "issued":
                raise UserError("Fakturę tworzymy jako szkic, a potem ją wystawiamy (przycisk „Wystaw fakturę”).")
            if vals.get("buyer_tax_id"):
                vals["buyer_tax_id"] = self._normalize_tax_id(vals["buyer_tax_id"], vals.get("buyer_country_id"))
        return super().create(vals_list)

    def _normalize_tax_id(self, value, country_id):
        country = self.env["res.country"].browse(country_id) if country_id else self.env.ref("base.pl")
        if not country or country.code == "PL":
            return engine.nip_normalize(value)
        return (value or "").strip().upper().replace(" ", "")

    def write(self, vals):
        issued = self.filtered(lambda i: i.state == "issued")
        if issued and not self.env.context.get("jdg_issuing"):
            blocked = set(vals) - MUTABLE_AFTER_ISSUE - {"write_uid", "write_date"}
            if blocked:
                raise UserError(
                    "Wystawiona faktura jest niezmienna (zapisana na stałe). Błąd? Wystaw fakturę korygującą. "
                    "Pola, których dotyczy próba zmiany: %s." % ", ".join(sorted(blocked)))
        if "buyer_tax_id" in vals and vals["buyer_tax_id"]:
            for inv in self:
                country_id = vals.get("buyer_country_id", inv.buyer_country_id.id)
                super(JdgInvoice, inv).write({"buyer_tax_id": self._normalize_tax_id(vals["buyer_tax_id"], country_id)})
            vals = {k: v for k, v in vals.items() if k != "buyer_tax_id"}
            if not vals:
                return True
        return super().write(vals)

    def unlink(self):
        for inv in self:
            if inv.state == "issued" and not inv.is_test:
                raise UserError(
                    "Wystawionej faktury nie można usunąć (numeracja jest ciągła). Anuluj ją fakturą korygującą.")
        if any(i.state == "issued" for i in self) and not self.env.user.has_group("l10n_pl_jdg_ryczalt.group_jdg_manager"):
            raise UserError("Usuwać testowe wystawione faktury może tylko właściciel (grupa „Firma: właściciel”).")
        return super().unlink()

    # ------------------------------------------------------------------ walidacje

    @api.constrains("buyer_tax_id", "buyer_country_id")
    def _check_buyer_tax_id(self):
        for inv in self:
            if inv.buyer_tax_id and (not inv.buyer_country_id or inv.buyer_country_id.code == "PL") \
                    and not engine.nip_is_valid(inv.buyer_tax_id):
                raise ValidationError("NIP nabywcy jest nieprawidłowy (10 cyfr, suma kontrolna). Popraw go albo zostaw puste.")

    # ------------------------------------------------------------------ wystawienie

    def _issue_checks(self):
        self.ensure_one()
        profile = self.env["jdg.profile"]._get(self.company_id)
        if not self.is_test:
            missing = profile._seller_missing()
            if missing:
                raise UserError(
                    "Nie można wystawić faktury: w profilu firmy brakuje danych sprzedawcy (%s). Uzupełnij je w Firma > "
                    "Ustawienia > Profil firmy. Do tego czasu ta faktura jest tylko podglądem (PDF z napisem PODGLĄD)."
                    % ", ".join(missing))
            if profile.vat_status == "not_decided":
                raise UserError("Status VAT w profilu firmy to „Jeszcze nie zdecydowano”. Wybierz zwolnienie albo czynnego "
                                "podatnika VAT, zanim wystawisz fakturę.")
        problems = []
        if not (self.buyer_name or "").strip():
            problems.append("nazwa lub imię i nazwisko nabywcy")
        if not (self.buyer_street or "").strip() or not (self.buyer_city or "").strip():
            problems.append("adres nabywcy (ulica, miejscowość)")
        if (not self.buyer_country_id or self.buyer_country_id.code == "PL") and not (self.buyer_zip or "").strip():
            problems.append("kod pocztowy nabywcy")
        if self.buyer_type == "b2b" and not (self.buyer_tax_id or "").strip():
            problems.append("NIP nabywcy (faktura B2B)")
        if problems:
            raise UserError("Uzupełnij dane nabywcy przed wystawieniem faktury: %s." % ", ".join(problems))
        entry = self.entry_id
        if entry.state != "posted":
            raise UserError("Wpis ewidencji nie jest zaksięgowany.")
        if not self.line_ids:
            raise UserError("Faktura nie ma pozycji.")
        if abs(sum(self.line_ids.mapped("amount_gross")) - self.amount_gross) > 0.005 or abs(self.amount_gross - entry.amount) > 0.005:
            raise UserError("Kwota faktury musi być równa kwocie wpisu ewidencji (faktura nie zmienia przychodu).")
        if self.doc_type == "correction":
            original = self.original_id
            if original.state != "issued":
                raise UserError("Faktura korygowana nie jest wystawiona.")
            if not (self.reason or "").strip():
                raise UserError("Podaj przyczynę korekty.")
            prior = sum(original.correction_ids.filtered(lambda c: c.state == "issued" and c != self).mapped("amount_gross"))
            if abs(self.before_gross - (original.amount_gross + prior)) > 0.005:
                raise UserError("Wcześniej wystawiono inną korektę do tej faktury. Usuń ten szkic i utwórz korektę od nowa.")
            if self.after_gross < -0.005:
                raise UserError("Korekta przekracza wartość faktury.")

    def action_issue(self):
        """Wystawia fakturę: sprawdza dane, zamraża sprzedawcę, nadaje numer bez luk i blokuje edycję."""
        today = fields.Date.context_today(self)
        for inv in self.sorted("id"):
            if inv.state == "issued":
                continue
            inv._issue_checks()
            issue_date = inv.issue_date or today
            if issue_date > today:
                raise UserError("Data wystawienia (%s) nie może być z przyszłości." % issue_date)
            if not inv.is_test:
                inv.write(self._seller_vals(inv.company_id) | ({"exempt_basis": False} if inv.vat_mode != "exempt" else {}))
            year = issue_date.year
            self.env.flush_all()
            # blokada wiersza profilu: numeracja bez luk i bez dubli także przy równoległych wystawieniach
            self.env.cr.execute("SELECT id FROM jdg_profile WHERE company_id = %s FOR UPDATE", (inv.company_id.id,))
            self.env.cr.execute(
                "SELECT COALESCE(MAX(seq_no), 0) + 1, MAX(issue_date) FROM jdg_invoice "
                "WHERE company_id = %s AND journal = %s AND seq_year = %s AND is_test = %s AND state = 'issued'",
                (inv.company_id.id, inv.journal, year, inv.is_test))
            seq_no, last_date = self.env.cr.fetchone()
            if last_date and issue_date < last_date:
                raise UserError(
                    "Data wystawienia (%s) jest wcześniejsza niż ostatnia wystawiona faktura w tej serii (%s). Numery mają "
                    "rosnąć razem z datami; ustaw datę nie wcześniejszą niż %s." % (issue_date, last_date, last_date))
            number = "%s%s/%d/%04d" % ("TEST-" if inv.is_test else "", inv.journal, year, seq_no)
            inv.with_context(jdg_issuing=True).write({
                "state": "issued", "number": number, "seq_no": seq_no, "seq_year": year, "issue_date": issue_date,
                "issued_on": fields.Datetime.now(), "issued_by": self.env.user.id,
            })
            inv.message_post(body="Wystawiono %s %s (wpis ewidencji %s)." % (
                "fakturę korygującą" if inv.doc_type == "correction" else "fakturę", number, inv.entry_id.name))
        return True

    def action_print_pdf(self):
        self.ensure_one()
        return self.env.ref("l10n_pl_jdg_ryczalt.action_report_jdg_invoice").report_action(self)

    def action_open_entry(self):
        self.ensure_one()
        return {"type": "ir.actions.act_window", "res_model": "jdg.income.entry", "res_id": self.entry_id.id,
                "view_mode": "form", "target": "current"}

    def action_open_original(self):
        self.ensure_one()
        return self.original_id._action_open()

    def action_open_corrections(self):
        self.ensure_one()
        return {"type": "ir.actions.act_window", "name": "Korekty", "res_model": "jdg.invoice", "view_mode": "list,form",
                "domain": [("original_id", "=", self.id)]}

    def action_open_correction_wizard(self):
        self.ensure_one()
        if self.doc_type != "invoice" or self.state != "issued":
            raise UserError("Korektę wystawia się do wystawionej faktury sprzedaży.")
        if self.correction_state == "full":
            raise UserError("Ta faktura jest już skorygowana w całości (anulowana).")
        return {
            "type": "ir.actions.act_window", "name": "Faktura korygująca", "res_model": "jdg.invoice.correction.wizard",
            "view_mode": "form", "target": "new", "context": {"default_invoice_id": self.id},
        }

    def init(self):
        """Triggery w bazie: druga linia obrony niezmienności wystawionych faktur (patrz GUARD_SQL)."""
        cond = " OR ".join("NEW.%s IS DISTINCT FROM OLD.%s" % (c, c) for c in FROZEN_COLUMNS)
        self.env.cr.execute(GUARD_SQL.replace("(%(cond)s)", "(" + cond + ")"))


class JdgInvoiceLine(models.Model):
    _name = "jdg.invoice.line"
    _description = "Pozycja faktury"
    _order = "sequence, id"

    invoice_id = fields.Many2one("jdg.invoice", "Faktura", required=True, ondelete="cascade", index=True)
    sequence = fields.Integer(default=10)
    currency_id = fields.Many2one(related="invoice_id.currency_id")
    name = fields.Char("Nazwa towaru lub usługi", required=True)
    quantity = fields.Float("Ilość", digits=(12, 3), default=1.0)
    unit = fields.Char("Miara", default="szt.")
    unit_price = fields.Monetary("Cena jedn. netto", currency_field="currency_id")
    amount_net = fields.Monetary("Wartość netto", currency_field="currency_id")
    amount_vat = fields.Monetary("VAT", currency_field="currency_id")
    amount_gross = fields.Monetary("Wartość brutto", currency_field="currency_id")

    def init(self):
        self.env.cr.execute(LINE_GUARD_SQL)

    def write(self, vals):
        if self.invoice_id.filtered(lambda i: i.state == "issued") and not self.env.context.get("jdg_issuing"):
            raise UserError("Pozycje wystawionej faktury są niezmienne. Wystaw fakturę korygującą.")
        if set(vals) - {"name", "unit", "sequence", "write_uid", "write_date"}:
            raise UserError("Kwoty pozycji wynikają z wpisu ewidencji i nie podlegają edycji (zmieniasz tylko nazwę i miarę).")
        return super().write(vals)

    def unlink(self):
        if self.invoice_id.filtered(lambda i: i.state == "issued") and not self.env.context.get("jdg_issuing"):
            if any(not i.is_test for i in self.invoice_id):
                raise UserError("Pozycje wystawionej faktury są niezmienne.")
        return super().unlink()
