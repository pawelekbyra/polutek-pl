"""Testy iteracji 4: faktury (na żądanie), numeracja bez luk, niezmienność, korekty, PDF (HTML szablonu), zgodność z ewidencją.
SZACUNEK / POMOC, NIE PORADA PODATKOWA ANI PRAWNA."""

import datetime as dt
from decimal import Decimal as D

from odoo.exceptions import UserError, ValidationError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import freeze_time
from odoo.tools import mute_logger

from odoo.addons.l10n_pl_jdg_ryczalt.models import engine

NIP_OK = "5260250995"
NIP_OK2 = "1234563218"
NIP_BAD = "5260250996"
DAY = dt.date(2027, 3, 9)
TODAY = "2027-03-10 12:00:00"


@tagged("post_install", "-at_install", "jdg_iter4")
class TestInvoiceEngine(TransactionCase):
    def test_nip(self):
        self.assertTrue(engine.nip_is_valid(NIP_OK))
        self.assertTrue(engine.nip_is_valid("PL 526-025-09-95"))
        self.assertFalse(engine.nip_is_valid(NIP_BAD))
        self.assertFalse(engine.nip_is_valid("123"))
        self.assertFalse(engine.nip_is_valid(""))
        self.assertEqual(engine.nip_normalize(" PL526-025-09-95 "), NIP_OK)

    def test_split_gross(self):
        self.assertEqual(engine.split_gross(123, 23), (D("100.00"), D("23.00")))
        self.assertEqual(engine.split_gross(50, 0), (D("50.00"), D("0")))
        net, vat = engine.split_gross(10, 23)
        self.assertEqual(net + vat, D("10.00"))
        net, vat = engine.split_gross(-123, 23)
        self.assertEqual((net, vat), (D("-100.00"), D("-23.00")))


class InvoiceCase(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env = cls.env(context=dict(cls.env.context, jdg_no_alerts=True))
        cls.Entry = cls.env["jdg.income.entry"]
        cls.Invoice = cls.env["jdg.invoice"]
        cls.profile = cls.env["jdg.profile"]._get()
        cls.eur = cls.env.ref("base.EUR")
        cls.pl = cls.env.ref("base.pl")

    def _fill_seller(self):
        self.profile.write({
            "seller_name": "Paweł Żółć Perfect", "seller_nip": "526-025-09-95", "seller_street": "Zażółcona 1/2",
            "seller_zip": "00-001", "seller_city": "Łódź", "seller_email": "firma@example.test",
        })

    def _entry(self, amount=49.0, day=DAY, post=True, **kw):
        vals = {"amount": amount, "income_date": day, "description": "Dostęp 30 dni", "buyer_type": "b2c"}
        vals.update(kw)
        entry = self.Entry.create(vals)
        if post:
            entry.action_post()
        return entry

    def _draft(self, entry=None, **kw):
        entry = entry or self._entry()
        inv = entry.action_create_invoice() and entry.invoice_ids
        vals = {"buyer_name": "Zenon Ślązak", "buyer_street": "Długa 5", "buyer_zip": "80-001", "buyer_city": "Gdańsk"}
        vals.update(kw)
        inv.write(vals)
        return inv

    def _issue(self, entry=None, **kw):
        inv = self._draft(entry, **kw)
        inv.action_issue()
        return inv


@tagged("post_install", "-at_install", "jdg_iter4")
class TestProfileSeller(InvoiceCase):
    def test_missing_and_validation(self):
        self.assertFalse(self.profile.seller_ok)
        self.assertIn("NIP sprzedawcy", self.profile.seller_missing)
        self.assertIn("miejscowość", self.profile.seller_missing)
        with self.assertRaises(ValidationError):
            self.profile.write({"seller_nip": NIP_BAD})
        self._fill_seller()
        self.assertEqual(self.profile.seller_nip, NIP_OK)  # znormalizowany
        self.assertTrue(self.profile.seller_ok)
        self.assertFalse(self.profile.seller_missing)


@tagged("post_install", "-at_install", "jdg_iter4")
class TestInvoiceIssue(InvoiceCase):
    @freeze_time(TODAY)
    def test_preview_without_seller_cannot_be_issued(self):
        inv = self._draft()
        self.assertEqual(inv.state, "draft")
        self.assertTrue(inv.is_preview)
        self.assertIn("NIP sprzedawcy", inv.seller_missing)
        with self.assertRaises(UserError) as cm:
            inv.action_issue()
        self.assertIn("tylko podglądem", str(cm.exception))
        self.assertFalse(inv.number)
        html = self.env["ir.actions.report"]._render_qweb_html("l10n_pl_jdg_ryczalt.action_report_jdg_invoice", inv.ids)[0].decode()
        self.assertIn("PODGLĄD", html)
        self.assertIn("NIE JEST FAKTURĄ", html)

    @freeze_time(TODAY)
    def test_issue_exempt_pln_numbering_and_snapshot(self):
        self._fill_seller()
        e1, e2 = self._entry(49), self._entry(99)
        income_before = (len(self.Entry.search([])), sum(self.Entry.search([]).mapped("tax_base_pln")))
        i1 = self._issue(e1)
        i2 = self._issue(e2)
        self.assertEqual((i1.number, i2.number), ("FV/2027/0001", "FV/2027/0002"))
        self.assertEqual((i1.seq_no, i2.seq_no), (1, 2))
        self.assertEqual(i1.vat_mode, "exempt")
        self.assertEqual((i1.amount_net, i1.amount_vat, i1.amount_gross), (49.0, 0.0, 49.0))
        self.assertEqual(i1.exempt_basis, "art. 113 ust. 1 ustawy o VAT")
        self.assertEqual(i1.sale_date, DAY)
        self.assertEqual(i1.issue_date, dt.date(2027, 3, 10))
        self.assertEqual(i1.seller_nip, NIP_OK)
        self.assertEqual(i1.entry_id, e1)
        self.assertEqual(e1.invoice_number, "FV/2027/0001")
        # faktura NIE zmienia przychodu
        income_after = (len(self.Entry.search([])), sum(self.Entry.search([]).mapped("tax_base_pln")))
        self.assertEqual(income_before, income_after)
        # dane sprzedawcy zamrożone: zmiana profilu nie rusza wystawionej faktury
        self.profile.write({"seller_city": "Kraków"})
        self.assertEqual(i1.seller_city, "Łódź")

    @freeze_time(TODAY)
    def test_failed_issue_does_not_consume_number(self):
        self._fill_seller()
        e1, e2 = self._entry(10), self._entry(20)
        bad = self._draft(e1, buyer_name=False)
        with self.assertRaises(UserError):
            bad.action_issue()
        good = self._issue(e2)
        self.assertEqual(good.number, "FV/2027/0001")
        bad.write({"buyer_name": "Jan Kowalski"})
        bad.action_issue()
        self.assertEqual(bad.number, "FV/2027/0002")
        nums = sorted(self.Invoice.search([("state", "=", "issued"), ("is_test", "=", False)]).mapped("seq_no"))
        self.assertEqual(nums, list(range(1, len(nums) + 1)))

    @freeze_time(TODAY)
    def test_immutable_and_undeletable(self):
        self._fill_seller()
        inv = self._issue()
        with self.assertRaises(UserError):
            inv.write({"buyer_name": "Ktoś inny"})
        with self.assertRaises(UserError):
            inv.line_ids.write({"name": "Zmiana"})
        with self.assertRaises(UserError):
            inv.unlink()
        inv.write({"note": "notatka", "ksef_number": "123"})  # wolno
        self.assertEqual(inv.note, "notatka")
        # druga linia obrony: trigger w bazie
        with mute_logger("odoo.sql_db"), self.assertRaises(Exception), self.cr.savepoint():
            self.env.cr.execute("UPDATE jdg_invoice SET buyer_name = 'x' WHERE id = %s", (inv.id,))
        with mute_logger("odoo.sql_db"), self.assertRaises(Exception), self.cr.savepoint():
            self.env.cr.execute("UPDATE jdg_invoice SET amount_gross = 1 WHERE id = %s", (inv.id,))
        with mute_logger("odoo.sql_db"), self.assertRaises(Exception), self.cr.savepoint():
            self.env.cr.execute("DELETE FROM jdg_invoice WHERE id = %s", (inv.id,))
        with mute_logger("odoo.sql_db"), self.assertRaises(Exception), self.cr.savepoint():
            self.env.cr.execute("UPDATE jdg_invoice_line SET name = 'x' WHERE invoice_id = %s", (inv.id,))

    @freeze_time(TODAY)
    def test_one_invoice_per_entry_and_rules(self):
        self._fill_seller()
        entry = self._entry()
        inv = self._draft(entry)
        self.assertEqual(entry.action_create_invoice()["res_id"], inv.id)  # drugi raz otwiera ten sam
        self.assertEqual(len(entry.invoice_ids), 1)
        donation = self._entry(5, kind="donation", income_category="tips")
        with self.assertRaises(UserError):
            self.Invoice._create_from_entry(donation)
        draft_entry = self._entry(post=False)
        with self.assertRaises(UserError):
            self.Invoice._create_from_entry(draft_entry)
        refund = self._entry(-10, kind="refund")
        with self.assertRaises(UserError):
            self.Invoice._create_from_entry(refund)

    @freeze_time(TODAY)
    def test_buyer_validation(self):
        self._fill_seller()
        inv = self._draft(buyer_type="b2b", buyer_tax_id=False)
        with self.assertRaises(UserError):
            inv.action_issue()
        with self.assertRaises(ValidationError):
            inv.write({"buyer_tax_id": NIP_BAD})
        inv.write({"buyer_tax_id": "PL " + NIP_OK2})
        self.assertEqual(inv.buyer_tax_id, NIP_OK2)
        self.assertTrue(inv.ksef_warning)
        inv.action_issue()
        self.assertEqual(inv.state, "issued")

    @freeze_time(TODAY)
    def test_dates(self):
        self._fill_seller()
        a, b = self._entry(10), self._entry(20)
        ia = self._draft(a)
        ia.issue_date = dt.date(2027, 3, 10)
        ia.action_issue()
        ib = self._draft(b)
        ib.issue_date = dt.date(2027, 3, 9)
        with self.assertRaises(UserError):  # wcześniej niż poprzednia w serii
            ib.action_issue()
        ib.issue_date = dt.date(2027, 3, 11)
        with self.assertRaises(UserError):  # z przyszłości
            ib.action_issue()
        ib.issue_date = dt.date(2027, 3, 10)
        ib.action_issue()
        self.assertEqual(ib.number, "FV/2027/0002")

    @freeze_time(TODAY)
    def test_vat_not_decided_blocks(self):
        self._fill_seller()
        self.profile.vat_status = "not_decided"
        inv = self._draft()
        with self.assertRaises(UserError):
            inv.action_issue()

    @freeze_time(TODAY)
    def test_active_vat_split(self):
        self._fill_seller()
        self.profile.vat_status = "active"
        entry = self._entry(123)
        self.assertTrue(entry.vat_due)
        inv = self._issue(entry)
        self.assertEqual(inv.vat_mode, "active")
        self.assertEqual((inv.amount_net, inv.amount_vat, inv.amount_gross), (100.0, 23.0, 123.0))
        self.assertFalse(inv.exempt_basis)
        self.assertEqual(inv._vat_label(), "23%")
        html = self.env["ir.actions.report"]._render_qweb_html("l10n_pl_jdg_ryczalt.action_report_jdg_invoice", inv.ids)[0].decode()
        self.assertNotIn("art. 113", html)

    @freeze_time(TODAY)
    def test_foreign_currency_pln_value(self):
        self._fill_seller()
        entry = self._entry(10, currency_id=self.eur.id, fx_rate=4.3, fx_table_no="049/A/NBP/2027")
        inv = self._issue(entry, buyer_country_id=self.env.ref("base.de").id, buyer_zip="10115", buyer_city="Berlin")
        self.assertEqual(inv.currency_id, self.eur)
        self.assertEqual(inv.fx_rate, 4.3)
        self.assertEqual(inv.amount_gross, 10.0)
        self.assertEqual(inv.amount_gross_pln, 43.0)
        html = self.env["ir.actions.report"]._render_qweb_html("l10n_pl_jdg_ryczalt.action_report_jdg_invoice", inv.ids)[0].decode()
        self.assertIn("Kurs średni NBP", html)
        self.assertIn("4,3000", html)
        self.assertIn("43,00", html)

    @freeze_time(TODAY)
    def test_test_invoices_have_own_series(self):
        # bez danych sprzedawcy: testowa faktura da się wystawić, ale nie zużywa numeru prawdziwej serii
        t = self._issue(self._entry(is_test=True))
        self.assertEqual(t.number, "TEST-FV/2027/0001")
        self.assertTrue(t.is_test)
        self._fill_seller()
        real = self._issue(self._entry(30))
        self.assertEqual(real.number, "FV/2027/0001")
        html = self.env["ir.actions.report"]._render_qweb_html("l10n_pl_jdg_ryczalt.action_report_jdg_invoice", t.ids)[0].decode()
        self.assertIn("NIE JEST FAKTURĄ", html)
        t.unlink()  # testową może usunąć właściciel (admin)


@tagged("post_install", "-at_install", "jdg_iter4")
class TestInvoiceCorrection(InvoiceCase):
    def _wizard(self, inv, **kw):
        vals = {"invoice_id": inv.id, "reason": "Zwrot na prośbę nabywcy"}
        vals.update(kw)
        return self.env["jdg.invoice.correction.wizard"].create(vals)

    @freeze_time(TODAY)
    def test_full_correction_cancels(self):
        self._fill_seller()
        inv = self._issue(self._entry(49))
        entries_before = self.Entry.search_count([])
        corr = self._wizard(inv, amount=49.0).action_confirm()
        correction = self.Invoice.browse(corr["res_id"])
        self.assertEqual(self.Entry.search_count([]), entries_before + 1)  # dokładnie jeden wpis zwrotu
        self.assertEqual(correction.doc_type, "correction")
        self.assertEqual(correction.journal, "FK")
        self.assertEqual((correction.before_gross, correction.after_gross, correction.amount_gross), (49.0, 0.0, -49.0))
        self.assertEqual(correction.entry_id.kind, "refund")
        self.assertEqual(correction.entry_id.reverses_id, inv.entry_id)
        correction.action_issue()
        self.assertEqual(correction.number, "FK/2027/0001")
        self.assertEqual(inv.correction_state, "full")
        self.assertEqual(inv.remaining_gross, 0.0)
        with self.assertRaises(UserError):
            inv.action_open_correction_wizard()
        html = self.env["ir.actions.report"]._render_qweb_html("l10n_pl_jdg_ryczalt.action_report_jdg_invoice", correction.ids)[0].decode()
        self.assertIn("Faktura korygująca", html)
        self.assertIn("przed korektą", html)
        self.assertIn("FV/2027/0001", html)

    @freeze_time(TODAY)
    def test_partial_corrections_chain_and_limit(self):
        self._fill_seller()
        inv = self._issue(self._entry(100))
        c1 = self.Invoice.browse(self._wizard(inv, amount=30.0).action_confirm()["res_id"])
        c1.action_issue()
        self.assertEqual(inv.correction_state, "partial")
        self.assertEqual(inv.remaining_gross, 70.0)
        with self.assertRaises(UserError):
            self._wizard(inv, amount=80.0).action_confirm()
        c2 = self.Invoice.browse(self._wizard(inv, amount=70.0).action_confirm()["res_id"])
        self.assertEqual((c2.before_gross, c2.after_gross), (70.0, 0.0))
        c2.action_issue()
        self.assertEqual(c2.number, "FK/2027/0002")
        self.assertEqual(inv.correction_state, "full")
        self.assertEqual(inv.correction_count, 2)

    @freeze_time(TODAY)
    def test_correction_from_existing_refund_entry(self):
        self._fill_seller()
        inv = self._issue(self._entry(50))
        wiz = self.env["jdg.income.correct.wizard"].create({
            "entry_id": inv.entry_id.id, "kind": "refund", "amount": 20.0, "income_date": DAY, "reason": "zwrot"})
        refund = self.Entry.browse(wiz.action_confirm()["res_id"])
        self.assertTrue(refund.can_correct_invoice)
        action = refund.action_create_correction_invoice()
        self.assertEqual(action["context"]["default_invoice_id"], inv.id)
        w = self.env["jdg.invoice.correction.wizard"].with_context(**action["context"]).create({"reason": "zwrot"})
        self.assertEqual(w.refund_entry_id, refund)
        w._onchange_refund_entry()
        self.assertEqual(w.amount, 20.0)
        correction = self.Invoice.browse(w.action_confirm()["res_id"])
        self.assertEqual(correction.amount_gross, -20.0)
        self.assertEqual(correction.after_gross, 30.0)
        self.assertEqual(self.Entry.search_count([("reverses_id", "=", inv.entry_id.id)]), 1)  # bez drugiego wpisu
        correction.write({"reason": False})
        with self.assertRaises(UserError):
            correction.action_issue()

    @freeze_time(TODAY)
    def test_foreign_correction_pln(self):
        self._fill_seller()
        inv = self._issue(self._entry(10, currency_id=self.eur.id, fx_rate=4.3), buyer_zip="10115")
        refund = self._entry(-10, kind="refund", currency_id=self.eur.id, fx_rate=4.3, reverses_id=inv.entry_id.id)
        correction = self.Invoice.browse(self._wizard(inv, refund_entry_id=refund.id, amount=10.0).action_confirm()["res_id"])
        self.assertEqual(correction.currency_id, self.eur)
        self.assertEqual(correction.amount_gross_pln, -43.0)
        correction.action_issue()
        self.assertEqual(correction.state, "issued")


@tagged("post_install", "-at_install", "jdg_iter4")
class TestInvoicePdfAndViews(InvoiceCase):
    @freeze_time(TODAY)
    def test_pdf_html_has_required_elements(self):
        self._fill_seller()
        inv = self._issue(self._entry(49))
        html = self.env["ir.actions.report"]._render_qweb_html("l10n_pl_jdg_ryczalt.action_report_jdg_invoice", inv.ids)[0].decode()
        for needle in ("Faktura", "FV/2027/0001", "10.03.2027", "09.03.2027", "Zenon Ślązak", "Dostęp 30 dni", "zw.",
                       "art. 113 ust. 1 ustawy o VAT", "Paweł Żółć Perfect", NIP_OK, "Należność ogółem", "49,00"):
            self.assertIn(needle, html)
        self.assertNotIn("PODGLĄD", html)
        self.assertIn("article", html)  # wrapper wymagany, by wkhtmltopdf dostał meta charset UTF-8 (polskie znaki)

    @freeze_time(TODAY)
    def test_views_and_actions_open(self):
        self._fill_seller()
        inv = self._issue(self._entry(49))
        self.assertIn("report_jdg_invoice_document", str(inv.action_print_pdf()))
        for mode in ("list", "kanban", "form", "search"):
            self.Invoice.get_view(view_type=mode)
        self.assertEqual(self.Invoice.search_count([("state", "=", "issued")]), 1)
