"""Testy czystego silnika (bez bazy). Parametry to FIXTURE 2026/2027, nie dane produkcyjne:
zmiana reguł w bazie nie psuje tych testów. SZACUNEK, NIE PORADA PODATKOWA."""

import datetime as dt
from decimal import Decimal as D

from odoo.tests import BaseCase, tagged

from odoo.addons.l10n_pl_jdg_ryczalt.models import engine as e

W = D("9228.64")  # IV kw. 2025 (stosowane w styczniu 2027)
MW = D("4806")
RATES = {"pension": D("19.52"), "disability": D("8"), "accident": D("1.67"), "sickness": D("2.45"), "fp": D("2.45")}
HOLIDAYS = ["01-01", "01-06", "05-01", "05-03", "08-15", "11-01", "11-11", "12-24", "12-25", "12-26"]


def tax(revenue, social=0, health=0, rate="8.5"):
    return e.ryczalt_cumulative({D(rate): D(revenue)}, D(social), D(health))


@tagged("post_install", "-at_install", "jdg_engine")
class TestEngine(BaseCase):
    # --- zaokrąglanie
    def test_rounding_half_up(self):
        self.assertEqual(e.jdg_round_zl("0.5"), D(1))
        self.assertEqual(e.jdg_round_zl("2.4999"), D(2))
        self.assertEqual(e.jdg_round("1.005"), D("1.01"))  # HALF_UP, nie bankierskie

    # --- T08-T10: progi zdrowotnej
    def test_health_tiers(self):
        self.assertEqual(e.health_due(D("60000.00"), W, MW).amount, D("498.35"))  # T08: do 60 000 włącznie
        self.assertEqual(e.health_due(D("60000.01"), W, MW).amount, D("830.58"))  # T09
        self.assertEqual(e.health_due(D("300000"), W, MW).amount, D("830.58"))
        self.assertEqual(e.health_due(D("300000.01"), W, MW).amount, D("1495.04"))  # T10
        self.assertEqual(e.health_due(0, W, MW).amount, D("498.35"))  # T01: bez przychodu też płaci

    def test_health_minimum(self):
        # gdy W jest bardzo małe, obowiązuje 9% płacy minimalnej
        self.assertEqual(e.health_due(0, D("1000"), MW).amount, D("432.54"))

    # --- T01-T06: zaliczka i wolne środki
    def test_t01_zero_revenue(self):
        self.assertEqual(tax(0).tax, 0)
        free, _ = e.free_funds(0, 0, D("498.35"), 0)
        self.assertEqual(free, D("-498.35"))

    def test_t02_t04_ulga_start(self):
        for revenue, adv, free in ((3000, 255, "2246.65"), (20000, 1700, "17801.65")):
            res = tax(revenue)
            self.assertEqual(res.tax, adv)
            self.assertEqual(e.free_funds(revenue, res.tax, D("498.35"), 0)[0], D(free))

    def test_t03_rate_15(self):
        res = tax(3000, rate="15")
        self.assertEqual(res.tax, 450)
        self.assertEqual(e.free_funds(3000, res.tax, D("498.35"), 0)[0], D("2051.65"))

    def test_t05_t06_preferential(self):
        # S = 469,85 zapłacone społeczne, Z = 498,35 zapłacona zdrowotna (50% = 249,18 po zaokrągleniu)
        res = tax(3000, "469.85", "498.35")
        self.assertEqual(res.base, 2281)
        self.assertEqual(res.tax, 194)
        self.assertEqual(e.free_funds(3000, res.tax, D("498.35"), D("469.85"))[0], D("1837.80"))
        res = tax(20000, "469.85", "498.35")
        self.assertEqual(res.base, 19281)
        self.assertEqual(res.tax, 1639)
        self.assertEqual(e.free_funds(20000, res.tax, D("498.35"), D("469.85"))[0], D("17392.80"))

    # --- T07: seria 4 x 20 000, zaliczki narastająco
    def test_t07_series(self):
        health_paid = [0, D("498.35"), D("996.70"), D("1495.05")]
        prev, advances = D(0), []
        for i, z in enumerate(health_paid):
            result = tax(20000 * (i + 1), 0, z)
            adv = e.advance_for_period(result.tax, prev)
            advances.append(adv)
            prev += adv
        self.assertEqual(advances, [1700, 1679, 1679, 1678])
        # zdrowotna w IV (80 000 > 60 000) przy crossing_month
        self.assertEqual(e.health_due(D(80000), W, MW).amount, D("830.58"))

    def test_advance_never_negative_after_refund(self):
        self.assertEqual(e.advance_for_period(D(100), D(300)), 0)

    def test_multi_rate_base_split(self):
        res = e.ryczalt_cumulative({D("8.5"): D(1000), D("15"): D(1000)}, D(0), D("200"))
        self.assertEqual(res.base, 1900)  # 2000 - 50% x 200
        self.assertEqual(sum(line[1] for line in res.by_rate), res.base)

    # --- T13/T14: ZUS
    def test_t13_full_zus_2027(self):
        res = e.social_due(e.ZUS_FULL, D("6019.80"), RATES, True, D("4950"))
        self.assertAlmostEqual(float(res.total), 2052.15, delta=0.02)

    def test_t14_preferential_2027(self):
        with_sick = e.social_due(e.ZUS_PREF, D("1485"), RATES, True, D("4950"))
        self.assertEqual(with_sick.social, D("469.85"))
        self.assertEqual(with_sick.fp, 0)  # FP tylko dla podstawy >= płaca min.
        without = e.social_due(e.ZUS_PREF, D("1485"), RATES, False, D("4950"))
        self.assertEqual(without.social, D("433.47"))

    def test_ulga_has_zero_social(self):
        self.assertEqual(e.social_due(e.ZUS_ULGA, 0, {}, True).total, 0)

    # --- T15: okna ZUS
    def test_t15_zus_windows(self):
        start = dt.date(2027, 1, 1)
        v = lambda d: e.zus_variant_on(d, start, True)  # noqa: E731
        self.assertEqual(v(dt.date(2026, 12, 31)), e.ZUS_NONE)
        self.assertEqual(v(dt.date(2027, 6, 30)), e.ZUS_ULGA)
        self.assertEqual(v(dt.date(2027, 7, 1)), e.ZUS_PREF)
        self.assertEqual(v(dt.date(2029, 6, 30)), e.ZUS_PREF)
        self.assertEqual(v(dt.date(2029, 7, 1)), e.ZUS_FULL)

    def test_start_date_is_a_setting(self):
        # zmiana daty startu przesuwa okna (bez zmiany kodu)
        start = dt.date(2027, 3, 15)
        self.assertEqual(e.zus_variant_on(dt.date(2027, 9, 14), start, True), e.ZUS_ULGA)
        self.assertEqual(e.zus_variant_on(dt.date(2027, 9, 15), start, True), e.ZUS_PREF)
        self.assertEqual(e.zus_variant_on(dt.date(2027, 3, 15), start, False), e.ZUS_PREF)

    # --- T22: terminy
    def test_t22_deadline_shift(self):
        self.assertEqual(dt.date(2027, 2, 20).weekday(), 5)  # sobota
        self.assertEqual(e.next_business_day(dt.date(2027, 2, 20), HOLIDAYS), dt.date(2027, 2, 22))

    def test_quarterly_due_dates(self):
        self.assertEqual(e.advance_due_date(dt.date(2027, 3, 31), 20, HOLIDAYS), dt.date(2027, 4, 20))
        self.assertEqual(e.advance_due_date(dt.date(2027, 12, 31), 20, HOLIDAYS), dt.date(2028, 1, 20))

    def test_holidays(self):
        self.assertEqual(e.easter_sunday(2027), dt.date(2027, 3, 28))
        self.assertFalse(e.is_business_day(dt.date(2027, 3, 29), HOLIDAYS))  # poniedziałek wielkanocny
        self.assertFalse(e.is_business_day(dt.date(2027, 12, 24), HOLIDAYS))  # Wigilia od 2025
        self.assertTrue(e.is_business_day(dt.date(2027, 4, 20), HOLIDAYS))

    def test_periods(self):
        self.assertEqual(len(e.year_periods(2027, "quarterly")), 4)
        self.assertEqual(len(e.year_periods(2027, "monthly")), 12)
        self.assertEqual(e.quarter_bounds(dt.date(2027, 5, 9)), (dt.date(2027, 4, 1), dt.date(2027, 6, 30)))

    def test_threshold_levels(self):
        self.assertEqual(e.threshold_level(50, 100)[1], "ok")
        self.assertEqual(e.threshold_level(70, 100)[1], "warn")
        self.assertEqual(e.threshold_level(90, 100)[1], "high")
        self.assertEqual(e.threshold_level(100, 100)[1], "high")
        self.assertEqual(e.threshold_level(100.01, 100)[1], "over")
