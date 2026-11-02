"""Testy modeli i pulpitu na bazie (dane startowe modułu: reguły 2026/2027, profil z ulgą na start od 2027-01-01).
Styczeń 2027 liczy się jeszcze z W z IV kw. 2025 (9 228,64), więc liczby są stabilne. SZACUNEK, NIE PORADA PODATKOWA."""

import datetime as dt
from decimal import Decimal as D


from odoo.exceptions import UserError
from odoo.tests import TransactionCase, tagged
from odoo.tools import mute_logger

from odoo.addons.l10n_pl_jdg_ryczalt.models.calc import CalcContext

JAN = dt.date(2027, 1, 15)


@tagged("post_install", "-at_install", "jdg_models")
class TestJdgModels(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.Entry = cls.env["jdg.income.entry"]
        cls.Rule = cls.env["jdg.tax.rule"]
        cls.profile = cls.env["jdg.profile"]._get()
        cls.eur = cls.env.ref("base.EUR")

    def _entry(self, amount, day=JAN, post=True, **kw):
        vals = {"amount": amount, "income_date": day, "description": "test"}
        vals.update(kw)
        entry = self.Entry.create(vals)
        if post:
            entry.action_post()
        return entry

    def _dash(self, day=JAN, **kw):
        return self.env["jdg.dashboard"].get_data(on_date=day, **kw)

    # ----- reguły
    def test_rules_seeded_and_lookup(self):
        rule = self.Rule._lookup("gus_avg_wage_q4", dt.date(2027, 1, 31))
        self.assertAlmostEqual(rule.value_num, 9228.64)
        self.assertEqual(rule.state, "active")
        draft = self.Rule._lookup("gus_avg_wage_q4", dt.date(2027, 2, 1))
        self.assertEqual(draft.state, "draft")
        self.assertEqual(draft.confidence, "N")

    def test_t12_january_2028_uses_q4_2026(self):
        rule = self.Rule._lookup("gus_avg_wage_q4", dt.date(2028, 1, 31))
        self.assertEqual(rule.valid_from, dt.date(2027, 2, 1))

    def test_t24_missing_rule_raises(self):
        with self.assertRaises(UserError):
            self.Rule._lookup("gus_avg_wage_q4", dt.date(2031, 1, 1))

    def test_verified_rule_is_frozen(self):
        rule = self.Rule._lookup("min_wage", dt.date(2026, 6, 1))
        rule.action_verify()
        with self.assertRaises(UserError):
            rule.write({"value_num": 1})

    def test_rate_rules_exist_unverified(self):
        for key, pct in (("ryczalt.rate.vod_85", 8.5), ("ryczalt.rate.vod_12", 12), ("ryczalt.rate.vod_15", 15)):
            rule = self.Rule._lookup(key, JAN)
            self.assertAlmostEqual(rule.value_num, pct)
            self.assertFalse(rule.verified_on)
            self.assertTrue(rule.source_note)
        self.assertEqual(self.Rule._lookup("ryczalt.rate.vod_85", JAN).confidence, "PR")

    def test_shadow_rate_15(self):
        self._entry(3000)
        data = self._dash(dt.date(2027, 3, 31))
        sh = data["shadow"]
        self.assertEqual(data["period"]["advance"], 255.0)
        self.assertEqual((sh["rate"], sh["period_advance"], sh["period_diff"]), (15.0, 450.0, 195.0))
        self.assertIn("15%", data["rate_warning"])
        self.assertIn("ryzyko 15%", data["rate_warning"])

    def test_no_shadow_when_rate_is_already_15(self):
        self.profile.ryczalt_rate_key = "ryczalt.rate.vod_15"
        self.assertIsNone(self._dash()["shadow"])

    # ----- profil
    def test_profile_defaults_are_owner_decisions(self):
        p = self.profile
        self.assertEqual(p.start_date, dt.date(2027, 1, 1))
        self.assertEqual(p.advance_rhythm, "quarterly")
        self.assertTrue(p.uses_ulga_na_start)
        self.assertEqual(p.ryczalt_rate_key, "ryczalt.rate.vod_85")
        self.assertEqual(p.invoice_policy, "on_request")
        self.assertFalse(p.tips_as_income)
        self.assertEqual(p.ulga_end_date, dt.date(2027, 6, 30))
        self.assertEqual(p.pref_end_date, dt.date(2029, 6, 30))

    # ----- wpisy
    def test_post_numbers_entries_without_gaps(self):
        a, b = self._entry(10), self._entry(20)
        self.assertEqual((a.seq_no, b.seq_no), (1, 2))
        self.assertEqual(a.name, "WP/2027/0001")

    def test_t21_posted_entry_is_immutable_orm(self):
        entry = self._entry(100)
        with self.assertRaises(UserError):
            entry.write({"amount": 1})
        with self.assertRaises(UserError):
            entry.unlink()
        entry.write({"note": "wolno"})  # notatka dozwolona

    def test_t21_posted_entry_is_immutable_sql(self):
        entry = self._entry(100)
        with self.assertRaises(Exception), mute_logger("odoo.sql_db"), self.env.cr.savepoint():
            self.env.cr.execute("UPDATE jdg_income_entry SET amount = 1 WHERE id = %s", (entry.id,))
        with self.assertRaises(Exception), mute_logger("odoo.sql_db"), self.env.cr.savepoint():
            self.env.cr.execute("DELETE FROM jdg_income_entry WHERE id = %s", (entry.id,))

    def test_test_entry_can_be_deleted(self):
        entry = self._entry(100, is_test=True)
        entry.unlink()
        self.assertFalse(entry.exists())

    def test_before_start_is_blocked_unless_test(self):
        with self.assertRaises(UserError):
            self._entry(10, day=dt.date(2026, 11, 2))
        self._entry(10, day=dt.date(2026, 11, 2), is_test=True)

    def test_sign_constraint(self):
        with self.assertRaises(Exception), mute_logger("odoo.sql_db"), self.env.cr.savepoint():
            self.Entry.create({"amount": 5, "kind": "refund", "income_date": JAN})

    def test_t16_fx_uses_last_table_before_income_day(self):
        Fx = self.env["jdg.fx.rate"]
        Fx.create({"currency_id": self.eur.id, "rate_date": dt.date(2026, 12, 30), "mid": 4.20, "table_no": "A1"})
        Fx.create({"currency_id": self.eur.id, "rate_date": dt.date(2026, 12, 31), "mid": 4.25, "table_no": "A2"})
        Fx.create({"currency_id": self.eur.id, "rate_date": dt.date(2027, 1, 4), "mid": 4.40, "table_no": "A3"})
        entry = self._entry(10, day=dt.date(2027, 1, 4), currency_id=self.eur.id)
        self.assertEqual(entry.fx_rate_id.rate_date, dt.date(2026, 12, 31))  # nie z tego samego dnia
        self.assertEqual(entry.pln_amount, 42.5)
        self.assertEqual(entry.fx_source, "nbp")

    def test_foreign_entry_without_rate_cannot_be_posted(self):
        entry = self._entry(10, currency_id=self.eur.id, post=False)
        self.assertEqual(entry.fx_source, "missing")
        with self.assertRaises(UserError):
            entry.action_post()

    def test_manual_rate(self):
        entry = self._entry(10, currency_id=self.eur.id, fx_rate=4.5)
        self.assertEqual(entry.fx_source, "manual")
        self.assertEqual(entry.pln_amount, 45.0)

    def test_correction_wizard_adds_negative_entry(self):
        entry = self._entry(100)
        wiz = self.env["jdg.income.correct.wizard"].create(
            {"entry_id": entry.id, "amount": 40, "reason": "zwrot", "income_date": JAN})
        wiz.action_confirm()
        refund = self.Entry.search([("reverses_id", "=", entry.id)])
        self.assertEqual(refund.pln_amount, -40)
        self.assertEqual(refund.state, "posted")

    # ----- pulpit: przykład ze SPEC (3 000 zł w ulgę na start)
    def test_dashboard_example_3000_ulga(self):
        self._entry(3000)
        data = self._dash()
        self.assertEqual(data["today"]["revenue"], 3000.0)
        rows = {r["key"]: r["amount"] for r in data["free"]["rows"]}
        self.assertEqual(rows["pit"], 255.0)
        self.assertEqual(rows["health"], 498.35)
        self.assertEqual(rows["zus"], 0.0)
        self.assertEqual(rows["free"], 2246.65)

    def test_dashboard_quarter_advance_q1(self):
        self._entry(3000)
        data = self._dash(dt.date(2027, 3, 31))
        self.assertEqual(data["period"]["advance"], 255.0)
        self.assertEqual(data["period"]["due_date"], "2027-04-20")

    def test_t17_test_entries_excluded_unless_shown(self):
        self._entry(5000, is_test=True)
        self.assertEqual(self._dash()["month"]["revenue"], 0.0)
        self.assertEqual(self._dash(include_test=True)["month"]["revenue"], 5000.0)

    def test_drafts_not_counted(self):
        self._entry(700, post=False)
        data = self._dash()
        self.assertEqual(data["month"]["revenue"], 0.0)
        self.assertEqual(data["meta"]["draft_entries"], 1)

    def test_refund_reduces_revenue(self):
        entry = self._entry(100)
        self.env["jdg.income.correct.wizard"].create(
            {"entry_id": entry.id, "amount": 100, "reason": "x", "income_date": JAN}).action_confirm()
        data = self._dash()
        self.assertEqual(data["month"]["revenue"], 0.0)
        rows = {r["key"]: r["amount"] for r in data["free"]["rows"]}
        self.assertEqual(rows["pit"], 0.0)  # zaliczka nigdy ujemna

    def test_paid_contributions_reduce_tax(self):
        self._entry(20000)
        self.env["jdg.contribution.payment"].create(
            {"kind": "health", "for_month": dt.date(2027, 1, 1), "paid_on": dt.date(2027, 1, 20), "amount": 498.35})
        data = self._dash(dt.date(2027, 1, 31))
        rows = {r["key"]: r["amount"] for r in data["free"]["rows"]}
        self.assertEqual(rows["pit"], 1679.0)  # (20 000 - 249,18) x 8,5% = 1 678,8 zł -> 1 679

    def test_health_threshold_modes(self):
        self._entry(60000.01)
        self.profile.health_threshold_mode = "crossing_month"
        calc = CalcContext(self.env, self.profile, JAN)
        self.assertEqual(calc.health_for_month(JAN).amount, D("830.58"))
        self.profile.health_threshold_mode = "next_month"
        calc = CalcContext(self.env, self.profile, JAN)
        self.assertEqual(calc.health_for_month(JAN).amount, D("498.35"))

    def test_zus_after_ulga_window(self):
        calc = CalcContext(self.env, self.profile, dt.date(2027, 7, 15))
        self.assertEqual(calc.social_for_month(dt.date(2027, 6, 1)).social, 0)
        self.assertEqual(calc.social_for_month(dt.date(2027, 7, 1)).social, D("469.85"))

    def test_rate_switch_applies_to_new_entries_only(self):
        old = self._entry(1000)
        self.profile.ryczalt_rate_key = "ryczalt.rate.vod_15"
        new = self._entry(1000)
        self.assertEqual((old.rate_pct, new.rate_pct), (8.5, 15.0))

    # ----- darowizny (decyzja właściciela)
    def test_donations_excluded_from_revenue_by_default(self):
        self._entry(500, kind="donation", donor_key="k1")
        data = self._dash()
        self.assertEqual(data["month"]["revenue"], 0.0)
        self.assertEqual(data["donations"]["month"], 500.0)
        self.assertEqual(data["donations"]["top_total"], 500.0)

    def test_tips_as_income_switch(self):
        self._entry(500, kind="donation", donor_key="k1")
        self.profile.tips_as_income = True
        self.assertEqual(self._dash()["month"]["revenue"], 500.0)

    def test_donation_limit_alert(self):
        self._entry(3000, kind="donation", donor_key="k1")
        self._entry(2000, kind="donation", donor_key="k1", day=dt.date(2027, 1, 20))
        don = self._dash(dt.date(2027, 1, 31))["donations"]
        self.assertEqual(don["top_total"], 5000.0)
        self.assertEqual(don["limit"], 5733.0)
        self.assertEqual(don["level"], "warn")  # 87%: blisko, ale poniżej 90%

    def test_menu_and_groups(self):
        self.assertTrue(self.env.ref("l10n_pl_jdg_ryczalt.menu_jdg_root").name == "Firma")
        self.assertIn(self.env.ref("base.user_admin"), self.env.ref("l10n_pl_jdg_ryczalt.group_jdg_manager").user_ids)
