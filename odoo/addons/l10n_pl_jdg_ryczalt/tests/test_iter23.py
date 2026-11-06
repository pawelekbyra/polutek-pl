"""Testy iteracji 2 (kursy NBP) i 3 (okresy, alerty, terminy). Sieć jest podstawiona (nigdy nie łączymy się z NBP),
czas zamrożony tam, gdzie liczy się „dziś”. SZACUNEK, NIE PORADA PODATKOWA."""

import datetime as dt
import re
from decimal import Decimal as D

import requests

from odoo.exceptions import AccessError, UserError
from odoo.tests import TransactionCase, tagged
from odoo.tests.common import freeze_time

from odoo.addons.l10n_pl_jdg_ryczalt.models import nbp_client
from odoo.addons.l10n_pl_jdg_ryczalt.models.jdg_fx_rate import WARSAW

# Tabele A (wymyślone, ale poprawne co do dni): 1 stycznia 2027 to piątek i święto; 2-3 stycznia to weekend.
MIDS = {
    dt.date(2026, 12, 28): 4.28, dt.date(2026, 12, 29): 4.29, dt.date(2026, 12, 30): 4.30, dt.date(2026, 12, 31): 4.31,
    dt.date(2027, 1, 4): 4.32, dt.date(2027, 1, 5): 4.33,
}


class FakeResponse:
    def __init__(self, status, payload):
        self.status_code, self._payload = status, payload

    def json(self):
        return self._payload


def make_get(mids=None, calls=None, error=None):
    """Podstawka za requests.get: zwraca tabele A z `mids` z zakresu z adresu URL (404, gdy pusto)."""
    mids = MIDS if mids is None else mids

    def get(url, timeout=None, headers=None):
        if calls is not None:
            calls.append(url)
        if error:
            raise error
        start, end = (dt.date.fromisoformat(x) for x in re.search(r"/A/(\d{4}-\d{2}-\d{2})/(\d{4}-\d{2}-\d{2})/", url).groups())
        days = sorted(d for d in mids if start <= d <= end)
        payload = [{
            "table": "A", "no": "%03d/A/NBP/%d" % (i + 1, d.year), "effectiveDate": d.isoformat(),
            "rates": [{"currency": "euro", "code": "EUR", "mid": mids[d]}, {"currency": "dolar", "code": "USD", "mid": 3.9}],
        } for i, d in enumerate(days)]
        return FakeResponse(200 if payload else 404, payload)

    return get


def at(day, hour=16, minute=30):
    return dt.datetime(day.year, day.month, day.day, hour, minute, tzinfo=WARSAW)


class JdgCase(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env = cls.env(context=dict(cls.env.context, jdg_no_alerts=True))
        cls.Entry = cls.env["jdg.income.entry"]
        cls.Rate = cls.env["jdg.fx.rate"]
        cls.Fetch = cls.env["jdg.fx.fetch"]
        cls.Period = cls.env["jdg.period"]
        cls.profile = cls.env["jdg.profile"]._get()
        cls.eur = cls.env.ref("base.EUR")
        cls.company = cls.env.company

    def _entry(self, amount, day, post=True, **kw):
        vals = {"amount": amount, "income_date": day, "description": "test"}
        vals.update(kw)
        entry = self.Entry.create(vals)
        if post:
            entry.action_post()
        return entry


@tagged("post_install", "-at_install", "jdg_iter2")
class TestNbpClient(TransactionCase):
    def test_chunks_respect_93_day_limit(self):
        chunks = nbp_client.chunk_ranges(dt.date(2026, 1, 1), dt.date(2026, 12, 31))
        self.assertTrue(all((e - s).days + 1 <= 93 for s, e in chunks))
        self.assertEqual(chunks[0][0], dt.date(2026, 1, 1))
        self.assertEqual(chunks[-1][1], dt.date(2026, 12, 31))
        self.assertEqual(sum((e - s).days + 1 for s, e in chunks), 365)

    def test_404_is_empty_and_errors_raise(self):
        self.assertEqual(nbp_client.fetch_tables(dt.date(2027, 1, 1), dt.date(2027, 1, 3), get=make_get({})), [])
        with self.assertRaises(nbp_client.NbpError):
            nbp_client.fetch_tables(dt.date(2027, 1, 1), dt.date(2027, 1, 3), get=make_get(error=requests.ConnectionError("x")))
        with self.assertRaises(nbp_client.NbpError):
            nbp_client.fetch_tables(dt.date(2026, 1, 1), dt.date(2026, 12, 31), get=make_get())  # 365 dni > limit
        with self.assertRaises(nbp_client.NbpError):
            nbp_client.parse_tables([{"effectiveDate": "zle", "no": "1", "rates": []}])

    def test_parse_skips_non_positive_rates(self):
        tables = nbp_client.parse_tables([{"effectiveDate": "2027-01-04", "no": "001/A/NBP/2027",
                                           "rates": [{"code": "eur", "mid": 4.3}, {"code": "XXX", "mid": 0}]}])
        self.assertEqual(tables[0][2], {"EUR": 4.3})


@tagged("post_install", "-at_install", "jdg_iter2")
class TestNbpFetch(JdgCase):
    def test_t16_monday_after_new_year_uses_last_table_before(self):
        """Poniedziałek 2027-01-04: kurs z ostatniej tabeli przed tą datą, czyli czwartku 2026-12-31 (1.01 święto, weekend)."""
        calls = []
        result = self.Rate._cron_fetch(now=at(dt.date(2027, 1, 5)), get=make_get(calls=calls))
        self.assertFalse(result["error"])
        self.assertEqual(self.Rate.search_count([("source", "=", "nbp"), ("currency_id", "=", self.eur.id)]), len(MIDS))
        entry = self._entry(10, dt.date(2027, 1, 4), currency_id=self.eur.id, post=False)
        self.assertEqual(entry.fx_source, "nbp")
        self.assertAlmostEqual(entry.fx_rate, 4.31)
        self.assertEqual(entry.fx_rate_id.rate_date, dt.date(2026, 12, 31))
        self.assertEqual(entry.fx_table_no.endswith("/A/NBP/2026"), True)
        self.assertAlmostEqual(entry.pln_amount, 43.10)
        entry.action_post()
        self.assertEqual(entry.state, "posted")

    def test_tuesday_uses_monday_table(self):
        self.Rate._cron_fetch(now=at(dt.date(2027, 1, 5)), get=make_get())
        entry = self._entry(10, dt.date(2027, 1, 5), currency_id=self.eur.id, post=False)
        self.assertAlmostEqual(entry.fx_rate, 4.32)  # tabela z 4 stycznia

    def test_stale_table_is_not_used_when_newer_may_be_missing(self):
        """Mamy tylko tabelę z 30.12 i dziennik pobrań do 30.12: wpis z 4.01 czeka (nie dostaje cicho starszego kursu)."""
        self.Fetch.create({"date_from": dt.date(2026, 12, 1), "date_to": dt.date(2026, 12, 30),
                           "covered_until": dt.date(2026, 12, 30), "state": "ok"})
        self.Rate.create({"currency_id": self.eur.id, "rate_date": dt.date(2026, 12, 30), "mid": 4.30, "source": "nbp",
                          "table_no": "250/A/NBP/2026", "company_id": False})
        entry = self._entry(10, dt.date(2027, 1, 4), currency_id=self.eur.id, post=False, post_when_rate_ready=True)
        self.assertEqual(entry.fx_source, "missing")
        self.assertEqual(entry.pln_amount, 0)
        with self.assertRaises(UserError):
            entry.action_post()
        # po pobraniu brakujących tabel wpis przelicza się i (flaga) księguje sam
        result = self.Rate._cron_fetch(now=at(dt.date(2027, 1, 4)), get=make_get())
        self.assertEqual(result["recomputed"], 1)
        self.assertEqual(entry.fx_source, "nbp")
        self.assertAlmostEqual(entry.fx_rate, 4.31)
        self.assertAlmostEqual(entry.pln_amount, 43.10)
        self.assertEqual(entry.state, "posted")

    def test_manual_rate_is_always_accepted(self):
        self.Fetch.create({"date_from": dt.date(2026, 12, 1), "date_to": dt.date(2026, 12, 20),
                           "covered_until": dt.date(2026, 12, 20), "state": "ok"})
        self.Rate.create({"currency_id": self.eur.id, "rate_date": dt.date(2026, 12, 30), "mid": 4.30})
        entry = self._entry(10, dt.date(2027, 1, 4), currency_id=self.eur.id, post=False)
        self.assertEqual(entry.fx_source, "nbp")  # dopasowano ręcznie wpisaną tabelę
        self.assertAlmostEqual(entry.fx_rate, 4.30)

    def test_manual_rate_resolves_pending_entry(self):
        self.Fetch.create({"date_from": dt.date(2026, 12, 1), "date_to": dt.date(2026, 12, 20),
                           "covered_until": dt.date(2026, 12, 20), "state": "ok"})
        entry = self._entry(10, dt.date(2027, 1, 4), currency_id=self.eur.id, post=False)
        self.assertEqual(entry.fx_source, "missing")
        self.Rate.create({"currency_id": self.eur.id, "rate_date": dt.date(2026, 12, 31), "mid": 4.31})
        self.assertEqual(entry.fx_source, "nbp")
        self.assertAlmostEqual(entry.pln_amount, 43.10)

    def test_morning_gate_skips_request(self):
        """Rano dnia roboczego, gdy wszystko do wczoraj jest pobrane, nie pytamy NBP o dzisiejszą tabelę."""
        self.Rate._cron_fetch(now=at(dt.date(2027, 1, 4)), get=make_get())
        calls = []
        self.Rate._cron_fetch(now=at(dt.date(2027, 1, 5), 9, 0), get=make_get(calls=calls))
        self.assertEqual(calls, [])
        self.Rate._cron_fetch(now=at(dt.date(2027, 1, 5), 12, 45), get=make_get(calls=calls))
        self.assertEqual(len(calls), 1)  # po południu pytamy
        self.Rate._cron_fetch(now=at(dt.date(2027, 1, 5), 17, 0), get=make_get(calls=calls))
        self.assertEqual(len(calls), 1)  # tabela z dziś jest, nic do pobrania
        self.assertTrue(self.Fetch._is_covered(dt.date(2027, 1, 5), dt.date(2027, 1, 5)))

    def test_network_error_is_logged_and_entry_waits(self):
        self.Fetch.create({"date_from": dt.date(2026, 12, 1), "date_to": dt.date(2026, 12, 20),
                           "covered_until": dt.date(2026, 12, 20), "state": "ok"})
        entry = self._entry(10, dt.date(2027, 1, 4), currency_id=self.eur.id, post=False)
        boom = make_get(error=requests.ConnectionError("brak sieci"))
        result = self.Rate._cron_fetch(now=at(dt.date(2027, 1, 4)), get=boom)
        self.assertTrue(result["error"])
        self.Rate._cron_fetch(now=at(dt.date(2027, 1, 4), 17, 30), get=boom)
        errors = self.Fetch.search([("state", "=", "error")])
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors.attempts, 2)
        self.assertEqual(entry.fx_source, "missing")
        # sieć wraca: uzupełnia się samo
        self.Rate._cron_fetch(now=at(dt.date(2027, 1, 4), 18, 0), get=make_get())
        self.assertEqual(entry.fx_source, "nbp")

    def test_holiday_only_range_is_covered(self):
        """Zakres bez tabel (404) też jest „sprawdzony”: sam fakt braku tabeli w święta nie blokuje kursów."""
        self.Rate._cron_fetch(now=at(dt.date(2027, 1, 3), 12, 0), get=make_get())
        self.assertTrue(self.Fetch._is_covered(dt.date(2027, 1, 1), dt.date(2027, 1, 3)))

    def test_posted_entry_is_not_recalculated(self):
        self.Rate._cron_fetch(now=at(dt.date(2027, 1, 5)), get=make_get())
        entry = self._entry(10, dt.date(2027, 1, 4), currency_id=self.eur.id)
        before = (entry.fx_rate, entry.pln_amount)
        self.Rate._cron_fetch(now=at(dt.date(2027, 1, 6), 17, 0), get=make_get({**MIDS, dt.date(2027, 1, 6): 9.9}))
        self.assertEqual((entry.fx_rate, entry.pln_amount), before)

    def test_only_active_currencies_stored(self):
        self.Rate._cron_fetch(now=at(dt.date(2027, 1, 5)), get=make_get())
        self.assertFalse(self.Rate.search([("currency_id.name", "=", "USD"), ("source", "=", "nbp")]).filtered(
            lambda r: not r.currency_id.active))

    def test_cron_is_registered(self):
        cron = self.env.ref("l10n_pl_jdg_ryczalt.cron_jdg_nbp")
        self.assertTrue(cron.active)
        self.assertEqual(cron.interval_type, "hours")
        self.assertTrue(self.env.ref("l10n_pl_jdg_ryczalt.cron_jdg_daily").active)


@tagged("post_install", "-at_install", "jdg_iter3")
class TestPeriods(JdgCase):
    def setUp(self):
        super().setUp()
        self.profile.write({"start_date": dt.date(2027, 1, 1), "advance_rhythm": "quarterly"})
        self.jan = self._entry(10000, dt.date(2027, 1, 12))
        self.feb = self._entry(5000, dt.date(2027, 2, 9))
        self.mar = self._entry(8000, dt.date(2027, 3, 20))
        self.Payment = self.env["jdg.contribution.payment"]
        for month, paid in ((1, dt.date(2027, 2, 18)), (2, dt.date(2027, 3, 18))):
            self.Payment.create({"kind": "health", "for_month": dt.date(2027, month, 1), "paid_on": paid, "amount": 498.35})

    def _period(self, kind, d0):
        self.Period._ensure_periods(self.company, dt.date(2027, 7, 1))
        return self.Period.search([("company_id", "=", self.company.id), ("kind", "=", kind), ("date_from", "=", d0)])

    def test_ensure_periods_creates_months_and_quarters(self):
        self.Period._ensure_periods(self.company, dt.date(2027, 4, 5))
        months = self.Period.search([("kind", "=", "month")])
        quarters = self.Period.search([("kind", "=", "quarter")])
        self.assertEqual(len(months), 4)
        self.assertEqual(len(quarters), 2)
        self.Period._ensure_periods(self.company, dt.date(2027, 4, 5))  # idempotentnie
        self.assertEqual(self.Period.search_count([("kind", "=", "month")]), 4)
        self.assertEqual(self._period("month", dt.date(2027, 1, 1)).name, "Styczeń 2027")
        self.assertEqual(self._period("quarter", dt.date(2027, 1, 1)).name, "I kwartał 2027")

    def test_cannot_close_running_or_out_of_order(self):
        jan, feb = self._period("month", dt.date(2027, 1, 1)), self._period("month", dt.date(2027, 2, 1))
        with freeze_time("2027-01-20 08:00:00"):
            with self.assertRaises(UserError):
                jan.action_close()  # styczeń jeszcze trwa
        with freeze_time("2027-03-05 08:00:00"):
            with self.assertRaises(UserError):
                feb.action_close()  # najpierw styczeń
            jan.action_close()
            feb.action_close()
        self.assertEqual((jan.state, feb.state), ("closed", "closed"))

    def test_draft_entries_block_closing(self):
        draft = self._entry(100, dt.date(2027, 1, 25), post=False)
        jan = self._period("month", dt.date(2027, 1, 1))
        with freeze_time("2027-02-03 08:00:00"):
            with self.assertRaises(UserError):
                jan.action_close()
            draft.action_post()
            jan.action_close()
        self.assertEqual(jan.state, "closed")

    def test_close_month_saves_snapshot_and_hash(self):
        jan = self._period("month", dt.date(2027, 1, 1))
        with freeze_time("2027-02-03 08:00:00"):
            jan.action_close()
        self.assertEqual(jan.state, "closed")
        self.assertEqual(jan.entry_count, 1)
        self.assertAlmostEqual(jan.revenue, 10000.0)
        self.assertAlmostEqual(jan.cum_revenue, 10000.0)
        self.assertAlmostEqual(jan.health_due, 498.35)
        self.assertAlmostEqual(jan.social_due, 0.0)  # ulga na start
        self.assertEqual(len(jan.totals_hash), 64)
        self.assertTrue(jan.rules_snapshot_json)
        self.assertEqual(jan.totals_json["months"][0]["health"], "498.35")
        self.assertFalse(jan.advance_ids)  # rytm kwartalny: zaliczka dopiero po kwartale
        self.assertEqual(self.Period._hash(jan._compute_snapshot()[0]), jan.totals_hash)
        self.assertEqual(jan.action_verify()["params"]["type"], "success")

    def test_close_quarter_saves_advance_and_closes_months(self):
        q1 = self._period("quarter", dt.date(2027, 1, 1))
        with freeze_time("2027-04-05 08:00:00"):
            q1.action_close()
        months = self.Period.search([("kind", "=", "month"), ("date_to", "<=", dt.date(2027, 3, 31))])
        self.assertEqual(set(months.mapped("state")), {"closed"})
        self.assertEqual(q1.state, "closed")
        self.assertAlmostEqual(q1.revenue, 23000.0)
        adv = q1.advance_ids
        self.assertEqual(len(adv), 1)
        # przychód 23 000 - 50% x zapłacona zdrowotna 996,70 (498,35) = 22 501,65 -> 22 502 zł x 8,5% = 1 912,67 -> 1 913
        self.assertAlmostEqual(adv.base_rounded, 22502.0)
        self.assertAlmostEqual(adv.advance_due, 1913.0)
        self.assertEqual(adv.due_date, dt.date(2027, 4, 20))
        self.assertEqual(adv.state, "due")
        self.assertGreater(adv.shadow_advance, adv.advance_due)  # cień 15%
        # zapłata zaliczki domyka kartę zaliczki
        self.Payment.create({"kind": "income_tax_advance", "for_month": dt.date(2027, 1, 1), "paid_on": dt.date(2027, 4, 19),
                             "amount": 1000})
        self.assertEqual((adv.state, adv.paid_amount), ("partial", 1000.0))
        self.Payment.create({"kind": "income_tax_advance", "for_month": dt.date(2027, 1, 1), "paid_on": dt.date(2027, 4, 19),
                             "amount": 913})
        self.assertEqual(adv.state, "paid")

    def test_monthly_rhythm_saves_advance_per_month(self):
        self.profile.advance_rhythm = "monthly"
        jan = self._period("month", dt.date(2027, 1, 1))
        with freeze_time("2027-02-03 08:00:00"):
            jan.action_close()
        self.assertEqual(len(jan.advance_ids), 1)
        self.assertEqual(jan.advance_ids.due_date, dt.date(2027, 2, 22))  # 20.02 to sobota

    def test_t20_closed_period_blocks_new_entries_and_corrections_move_forward(self):
        jan = self._period("month", dt.date(2027, 1, 1))
        with freeze_time("2027-02-03 08:00:00"):
            jan.action_close()
        with self.assertRaises(UserError):
            self._entry(100, dt.date(2027, 1, 28))
        with self.assertRaises(UserError):
            self._entry(100, dt.date(2027, 1, 28), post=False)
        draft = self._entry(100, dt.date(2027, 2, 2), post=False)
        with self.assertRaises(UserError):
            draft.income_date = dt.date(2027, 1, 30)
        # wpis testowy nie jest blokowany (nie liczy się do niczego)
        self._entry(100, dt.date(2027, 1, 28), is_test=True)
        # korekta zamkniętego okresu trafia do pierwszego otwartego
        wiz = self.env["jdg.income.correct.wizard"].create({
            "entry_id": self.jan.id, "kind": "refund", "amount": 500, "income_date": dt.date(2027, 1, 25), "reason": "zwrot"})
        wiz.action_confirm()
        correction = self.Entry.search([("reverses_id", "=", self.jan.id)])
        self.assertEqual(correction.income_date, dt.date(2027, 2, 1))
        self.assertAlmostEqual(correction.pln_amount, -500.0)
        self.assertIn("zamknięty", correction.note)

    def test_closed_period_blocks_payments_and_country_edit(self):
        jan = self._period("month", dt.date(2027, 1, 1))
        with freeze_time("2027-02-03 08:00:00"):
            jan.action_close()
        with self.assertRaises(UserError):
            self.Payment.create({"kind": "health", "for_month": dt.date(2027, 1, 1), "paid_on": dt.date(2027, 1, 31), "amount": 1})
        with self.assertRaises(UserError):
            self.jan.country_code = "DE"
        self.jan.note = "notatka"  # notatki wolno
        # płatność za styczeń zapłacona w lutym nie jest blokowana
        self.Payment.create({"kind": "zus_social", "for_month": dt.date(2027, 1, 1), "paid_on": dt.date(2027, 2, 15), "amount": 1})

    def test_reopen_rules(self):
        q1 = self._period("quarter", dt.date(2027, 1, 1))
        jan = self._period("month", dt.date(2027, 1, 1))
        mar = self._period("month", dt.date(2027, 3, 1))
        with freeze_time("2027-04-05 08:00:00"):
            q1.action_close()
        with self.assertRaises(UserError):
            jan._reopen("powód")  # miesiąc w zamkniętym kwartale
        with self.assertRaises(UserError):
            q1._reopen("   ")  # powód wymagany
        q1._reopen("brakował przychód")
        self.assertEqual(q1.state, "open")
        self.assertFalse(q1.advance_ids)
        self.assertEqual(q1.reopen_count, 1)
        self.assertAlmostEqual(q1.revenue, 0.0)
        self.assertTrue(any("Cofnięto zamknięcie" in (m.body or "") for m in q1.message_ids))
        with self.assertRaises(UserError):
            jan._reopen("za wcześnie")  # najpierw marzec
        mar._reopen("x")
        self._period("month", dt.date(2027, 2, 1))._reopen("x")
        jan._reopen("x")
        self._entry(100, dt.date(2027, 1, 28))  # odblokowane
        # ponowne zamknięcie liczy od nowa
        with freeze_time("2027-04-06 08:00:00"):
            q1.action_close()
        self.assertAlmostEqual(q1.revenue, 23100.0)

    def test_only_owner_can_close(self):
        group = self.env.ref("l10n_pl_jdg_ryczalt.group_jdg_user")
        user = self.env["res.users"].create({"name": "Pomocnik", "login": "pomocnik_jdg", "group_ids": [(6, 0, [group.id])]})
        jan = self._period("month", dt.date(2027, 1, 1))
        with freeze_time("2027-02-03 08:00:00"):
            with self.assertRaises(AccessError):
                jan.with_user(user).action_close()

    def test_closed_period_cannot_be_deleted(self):
        jan = self._period("month", dt.date(2027, 1, 1))
        with freeze_time("2027-02-03 08:00:00"):
            jan.action_close()
        with self.assertRaises(UserError):
            jan.unlink()

    def test_close_marks_deadline_done(self):
        jan = self._period("month", dt.date(2027, 1, 1))
        with freeze_time("2027-02-03 08:00:00"):
            self.env["jdg.deadline"]._generate(self.company, dt.date(2027, 2, 3))
            jan.action_close()
        self.assertEqual(self.env["jdg.deadline"].search([("key", "=", "close:2027-01")]).state, "done")


@tagged("post_install", "-at_install", "jdg_iter3")
class TestAlerts(JdgCase):
    def setUp(self):
        super().setUp()
        self.profile.write({"start_date": dt.date(2027, 1, 1)})
        self.Alert = self.env["jdg.alert"]
        self.today = dt.date(2027, 6, 10)

    def _levels(self, kind):
        return sorted(self.Alert.search([("kind", "=", kind)]).mapped("level"))

    def test_health60_levels_once_per_year(self):
        self._entry(42000, dt.date(2027, 3, 1))  # 70% z 60 000
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertEqual(self._levels("health60"), ["70"])
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertEqual(self._levels("health60"), ["70"])  # bez duplikatów
        self._entry(12500, dt.date(2027, 4, 1))  # 54 500 = 90,8%
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertEqual(self._levels("health60"), ["70", "90"])
        self._entry(6000, dt.date(2027, 5, 1))  # 60 500 > 60 000
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertEqual(self._levels("health60"), ["100", "70", "90"])
        self.assertFalse(self._levels("health300"))

    def test_skipping_levels_creates_all_reached(self):
        self._entry(58000, dt.date(2027, 3, 1))  # od razu 96,7%
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertEqual(self._levels("health60"), ["70", "90"])

    def test_test_entries_do_not_alert(self):
        self._entry(70000, dt.date(2027, 3, 1), is_test=True)
        self.assertFalse(self.Alert._evaluate(self.company, self.today, notify=False))

    def test_vat_limit_alert(self):
        self._entry(170000, dt.date(2027, 3, 1))  # 70,8%: VAT alarmuje dopiero od 80%
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertEqual(self._levels("vat_limit"), [])
        self._entry(30000, dt.date(2027, 3, 2))  # 200 000 = 83%
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertEqual(self._levels("vat_limit"), ["80"])
        self._entry(40000, dt.date(2027, 4, 1))  # 240 000 = 100%
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertEqual(self._levels("vat_limit"), ["100", "80", "90"])

    def test_vat_alert_off_when_active_vat(self):
        self.profile.vat_status = "active"
        self._entry(250000, dt.date(2027, 3, 1))
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertFalse(self._levels("vat_limit"))

    def test_t23_oss_threshold(self):
        self.Rate.create({"currency_id": self.eur.id, "rate_date": dt.date(2027, 2, 26), "mid": 4.3})
        self._entry(9000, dt.date(2027, 3, 1), currency_id=self.eur.id, country_code="DE", buyer_type="b2c")
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertEqual(self._levels("oss10k"), ["70", "90"])
        # sprzedaż do PL i B2B nie liczy się
        self._entry(5000, dt.date(2027, 3, 2), currency_id=self.eur.id, country_code="PL", buyer_type="b2c")
        self._entry(5000, dt.date(2027, 3, 3), currency_id=self.eur.id, country_code="DE", buyer_type="b2b")
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertEqual(self._levels("oss10k"), ["70", "90"])
        self._entry(1000.01, dt.date(2027, 3, 4), currency_id=self.eur.id, country_code="FR", buyer_type="b2c")
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertEqual(self._levels("oss10k"), ["100", "70", "90"])

    def test_oss_pln_entries_converted_with_eur_rate_and_missing_country_counted(self):
        self.Rate.create({"currency_id": self.eur.id, "rate_date": dt.date(2027, 2, 26), "mid": 4.0})
        self._entry(8000, dt.date(2027, 3, 1), country_code="DE", buyer_type="b2c")  # 8000 zł = 2000 EUR
        self.env.flush_all()
        from odoo.addons.l10n_pl_jdg_ryczalt.models.calc import CalcContext
        ctx = CalcContext(self.env, self.profile, self.today)
        oss = ctx.oss_totals(self.today)
        self.assertEqual(oss["value"], D("2000"))
        self._entry(10, dt.date(2027, 3, 2), currency_id=self.eur.id, buyer_type="b2c")  # bez kraju
        self.assertEqual(CalcContext(self.env, self.profile, self.today).oss_totals(self.today)["missing_country"], 1)

    def test_oss_item_in_dashboard_thresholds(self):
        self.Rate.create({"currency_id": self.eur.id, "rate_date": dt.date(2027, 2, 26), "mid": 4.3})
        self._entry(2500, dt.date(2027, 3, 1), currency_id=self.eur.id, country_code="DE", buyer_type="b2c")
        data = self.env["jdg.dashboard"].get_data(on_date=self.today)
        oss = [t for t in data["thresholds"] if t["key"] == "oss"]
        self.assertEqual(len(oss), 1)
        self.assertEqual(oss[0]["unit"], "EUR")
        self.assertAlmostEqual(oss[0]["pct"], 25.0)

    def test_donation_limit_alert(self):
        for day, amount in ((dt.date(2027, 2, 1), 3000), (dt.date(2027, 3, 1), 2000)):
            self._entry(amount, day, kind="donation", donor_key="K-1")
        self._entry(4000, dt.date(2027, 3, 5), kind="donation", donor_key="K-2")
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertEqual(self._levels("donation_limit"), ["70"])  # 5 000 z 5 733 = 87%
        self._entry(733, dt.date(2027, 4, 1), kind="donation", donor_key="K-1")  # 5 733 = 100%
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertEqual(self._levels("donation_limit"), ["100", "70", "90"])

    def test_alert_after_post_and_discuss_notification(self):
        env = self.env(context=dict(self.env.context, jdg_no_alerts=False))
        entry = env["jdg.income.entry"].create({"amount": 55000, "income_date": dt.date(2027, 3, 1)})
        entry.action_post()
        alerts = env["jdg.alert"].search([("kind", "=", "health60")])
        self.assertEqual(sorted(alerts.mapped("level")), ["70", "90"])
        channel = env["discuss.channel"].search([("name", "=", "Moja firma: terminy i alerty")])
        self.assertEqual(len(channel), 1)
        self.assertTrue(any("osiągnięto 90%" in (m.body or "") for m in channel.message_ids))

    def test_acknowledge(self):
        self._entry(58000, dt.date(2027, 3, 1))
        alerts = self.Alert._evaluate(self.company, self.today, notify=False)
        alerts.action_acknowledge()
        self.assertTrue(all(alerts.mapped("acknowledged")))


@tagged("post_install", "-at_install", "jdg_iter3")
class TestDeadlines(JdgCase):
    def setUp(self):
        super().setUp()
        self.profile.write({"start_date": dt.date(2027, 1, 1), "advance_rhythm": "quarterly", "oss_registered": True})
        self.Deadline = self.env["jdg.deadline"]
        self.today = dt.date(2027, 1, 10)

    def _dl(self, key):
        return self.Deadline.search([("company_id", "=", self.company.id), ("key", "=", key)])

    def test_t22_saturday_deadline_moves_to_monday(self):
        self.Deadline._generate(self.company, self.today)
        health = self._dl("health:2027-01")
        self.assertEqual(health.date_due, dt.date(2027, 2, 22))
        self.assertEqual(health.date_original, dt.date(2027, 2, 20))
        self.assertFalse(self._dl("zus:2027-01"))  # ulga na start: brak składek społecznych
        self.assertAlmostEqual(health.amount_estimate, 498.35)

    def test_kinds_generated(self):
        self.Deadline._generate(self.company, dt.date(2027, 6, 10))
        kinds = set(self.Deadline.search([]).mapped("kind"))
        self.assertTrue({"health", "zus", "advance", "pit28", "oss", "ulga_end", "gus_comm", "rules_review", "close"} <= kinds)
        self.assertEqual(self._dl("advance:2027-04").date_due, dt.date(2027, 7, 20))
        self.assertEqual(self._dl("advance:2027-07").date_due, dt.date(2027, 10, 20))
        self.assertFalse(self._dl("advance:2027-01"))  # dawny termin (ponad 45 dni temu) nie wraca
        self.assertTrue(self._dl("zus:2027-07"))  # po ulgach pojawia się ZUS
        self.assertEqual(self._dl("pit28:2027").date_due, dt.date(2028, 5, 2))  # 30.04 niedziela, 1.05 święto
        self.assertEqual(self._dl("oss:2027-04").date_due, dt.date(2027, 8, 2))  # 31.07 to sobota
        self.assertEqual(self._dl("ulga_end").date_due, dt.date(2027, 7, 1))
        self.assertEqual(self._dl("ulga_end_prep").date_due, dt.date(2027, 6, 1))

    def test_previous_year_q4_advance_listed_in_january(self):
        self.profile.start_date = dt.date(2026, 7, 1)
        self.Deadline._generate(self.company, dt.date(2027, 1, 5))
        self.assertEqual(self._dl("advance:2026-10").date_due, dt.date(2027, 1, 20))

    def test_generate_is_idempotent_and_keeps_done(self):
        self.Deadline._generate(self.company, self.today)
        count = self.Deadline.search_count([])
        self.Deadline._generate(self.company, self.today)
        self.assertEqual(self.Deadline.search_count([]), count)
        health = self._dl("health:2027-01")
        health.action_done()
        self.Deadline._generate(self.company, self.today + dt.timedelta(days=3))
        self.assertEqual(health.state, "done")

    def test_notifications_7_3_1(self):
        self.Deadline._generate(self.company, self.today)
        health = self._dl("health:2027-01")  # termin 22.02.2027
        self.assertNotIn(health, self.Deadline._notify_due(self.company, dt.date(2027, 2, 10)))
        sent = self.Deadline._notify_due(self.company, dt.date(2027, 2, 15))
        self.assertIn(health, sent)
        self.assertEqual(health.notified_stage, 7)
        self.assertTrue(health.activity_ids)
        self.assertFalse(self.Deadline._notify_due(self.company, dt.date(2027, 2, 15)))  # raz
        self.assertFalse(self.Deadline._notify_due(self.company, dt.date(2027, 2, 17)) & health)  # 5 dni: nadal poziom 7
        self.assertIn(health, self.Deadline._notify_due(self.company, dt.date(2027, 2, 19)))
        self.assertEqual(health.notified_stage, 3)
        self.assertIn(health, self.Deadline._notify_due(self.company, dt.date(2027, 2, 21)))
        self.assertEqual(health.notified_stage, 1)
        self.assertIn(health, self.Deadline._notify_due(self.company, dt.date(2027, 2, 22)))
        self.assertEqual(health.notified_stage, 0)
        channel = self.env["discuss.channel"].search([("name", "=", "Moja firma: terminy i alerty")])
        bodies = " ".join((m.body or "") for m in channel.message_ids)
        self.assertIn("Za 7 dni", bodies)
        self.assertIn("Jutro", bodies)
        self.assertIn("przesunięty", bodies)

    def test_catch_up_after_missed_days(self):
        self.Deadline._generate(self.company, self.today)
        health = self._dl("health:2027-01")
        self.Deadline._notify_due(self.company, dt.date(2027, 2, 20))  # 2 dni: od razu poziom 3
        self.assertEqual(health.notified_stage, 3)

    def test_done_items_not_notified(self):
        self.Deadline._generate(self.company, self.today)
        health = self._dl("health:2027-01")
        health.action_skip()
        self.assertNotIn(health, self.Deadline._notify_due(self.company, dt.date(2027, 2, 15)))

    def test_payment_marks_deadline_done(self):
        self.Deadline._generate(self.company, self.today)
        self.env["jdg.contribution.payment"].create({
            "kind": "health", "for_month": dt.date(2027, 1, 1), "paid_on": dt.date(2027, 2, 18), "amount": 498.35})
        health = self._dl("health:2027-01")
        self.assertEqual(health.state, "done")
        self.assertEqual(health.done_on, dt.date(2027, 2, 18))

    def test_daily_cron_runs_everything(self):
        self._entry(58000, dt.date(2027, 1, 12))
        self.env["jdg.deadline"]._cron_daily(dt.date(2027, 2, 15))
        self.assertTrue(self.env["jdg.period"].search([("kind", "=", "month")]))
        self.assertTrue(self.Deadline.search([("kind", "=", "health")]))
        self.assertTrue(self.env["jdg.alert"].search([("kind", "=", "health60")]))
        self.assertEqual(self._dl("health:2027-01").notified_stage, 7)

    def test_pending_fx_warning(self):
        self.Fetch.create({"date_from": dt.date(2026, 12, 1), "date_to": dt.date(2026, 12, 20),
                           "covered_until": dt.date(2026, 12, 20), "state": "ok"})
        self._entry(10, dt.date(2027, 1, 4), currency_id=self.eur.id, post=False)
        self.assertEqual(self.Deadline._warn_pending_fx(self.company, dt.date(2027, 1, 8)), 1)
        self.assertEqual(self.Deadline._warn_pending_fx(self.company, dt.date(2027, 1, 4)), 0)


@tagged("post_install", "-at_install", "jdg_iter3")
class TestViews(JdgCase):
    def test_all_new_views_compile(self):
        wanted = {
            "jdg.period": ["list", "form", "search", "pivot", "graph"],
            "jdg.tax.advance": ["list", "form", "graph", "pivot"],
            "jdg.deadline": ["list", "form", "calendar", "search"],
            "jdg.alert": ["list", "form", "search", "graph"],
            "jdg.fx.fetch": ["list"],
            "jdg.income.entry": ["list", "form", "pivot", "graph"],
        }
        for model, kinds in wanted.items():
            views = self.env[model].get_views([(False, kind) for kind in kinds])
            self.assertEqual(set(views["views"]), set(kinds), model)

    def test_entry_display_name_and_form_read(self):
        entry = self._entry(100, dt.date(2027, 3, 1), description="Dostęp 30 dni")
        self.assertEqual(entry.display_name, "%s Dostęp 30 dni" % entry.name)
        data = entry.web_read({"name": {}, "display_name": {}, "fx_info": {}, "state": {}})
        self.assertEqual(data[0]["state"], "posted")

    def test_actions_open(self):
        action = self.env["jdg.period"].action_open_periods()
        self.assertEqual(action["res_model"], "jdg.period")
        self.assertIn("pivot", action["view_mode"])
        self.assertEqual(self.env["jdg.fx.rate"].action_fetch_now.__name__, "action_fetch_now")


@tagged("post_install", "-at_install", "jdg_iter3", "jdg_vat")
class TestVatShadow(JdgCase):
    """VAT „w cieniu” (brutto x 23 / 123) i limit zwolnienia z VAT: pod limitem, równo na limicie, przekroczenie w roku."""

    def setUp(self):
        super().setUp()
        self.profile.write({"start_date": dt.date(2027, 1, 1), "vat_status": "exempt_113"})
        self.Alert = self.env["jdg.alert"]
        self.today = dt.date(2027, 8, 20)

    def _info(self, **kw):
        from odoo.addons.l10n_pl_jdg_ryczalt.models.calc import CalcContext
        return CalcContext(self.env, self.profile, self.today, **kw).vat_limit_info(self.today)

    def test_shadow_vat_math_and_flag(self):
        entry = self._entry(123, dt.date(2027, 2, 1))
        self.assertAlmostEqual(entry.vat_rate_pct, 23.0)
        self.assertAlmostEqual(entry.vat_shadow, 23.0)
        self.assertAlmostEqual(entry.vat_net, 100.0)
        self.assertFalse(entry.vat_due)
        self.assertAlmostEqual(entry.tax_base_pln, 123.0)  # zwolniony: przychód = cała cena
        odd = self._entry(49.99, dt.date(2027, 2, 2))
        self.assertAlmostEqual(odd.vat_shadow, 9.35)  # 49,99 x 23 / 123 = 9,347 -> 9,35
        self.assertAlmostEqual(odd.vat_net + odd.vat_shadow, 49.99)

    def test_refund_and_donation(self):
        refund = self._entry(-123, dt.date(2027, 2, 3), kind="refund")
        self.assertAlmostEqual(refund.vat_shadow, -23.0)
        gift = self._entry(100, dt.date(2027, 2, 4), kind="donation", donor_key="K-9")
        self.assertEqual((gift.vat_shadow, gift.vat_net, gift.vat_due), (0.0, 0.0, False))

    def test_active_vat_status_taxes_net(self):
        self.profile.vat_status = "active"
        entry = self._entry(123, dt.date(2027, 2, 1))
        self.assertTrue(entry.vat_due)
        self.assertAlmostEqual(entry.tax_base_pln, 100.0)  # przychód ryczałtowy bez VAT
        self.assertAlmostEqual(entry.pln_amount, 123.0)
        data = self.env["jdg.dashboard"].get_data(on_date=dt.date(2027, 2, 1))
        self.assertAlmostEqual(data["today"]["revenue"], 100.0)
        self.assertTrue(data["vat"]["active"])
        self.assertFalse(data["vat"]["banner"])
        self.assertFalse([t for t in data["thresholds"] if t["key"] == "vat"])

    def test_rate_is_a_rule_parameter(self):
        rule = self.env["jdg.tax.rule"]._lookup("vat.shadow_rate_pct", dt.date(2027, 2, 1))
        self.assertEqual(rule.value_num, 23.0)
        self.assertEqual(rule.group, "vat")

    def test_below_limit(self):
        self._entry(100000, dt.date(2027, 3, 1))
        info = self._info()
        self.assertFalse(info["exceeded"])
        self.assertFalse(info["reached"])
        self.assertEqual(info["used"], D("100000"))
        self.assertEqual(info["limit"], D("240000"))
        self.assertAlmostEqual(info["pct"], 41.7, places=1)
        self.assertEqual(info["remaining"], D("140000"))
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertFalse(self.Alert.search([("kind", "=", "vat_limit")]))
        data = self.env["jdg.dashboard"].get_data(on_date=self.today)
        self.assertFalse(data["vat"]["banner"])
        self.assertAlmostEqual(data["vat"]["year"], 100000 * 23 / 123, places=2)

    def test_exactly_at_limit_is_still_exempt(self):
        self._entry(120000, dt.date(2027, 3, 1))
        self._entry(120000, dt.date(2027, 4, 1))
        info = self._info()
        self.assertEqual(info["used"], D("240000"))
        self.assertTrue(info["reached"])
        self.assertFalse(info["exceeded"])  # przekroczenie dopiero „ponad” limit
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertEqual(sorted(self.Alert.search([("kind", "=", "vat_limit")]).mapped("level")), ["100", "80", "90"])
        banner = self.env["jdg.dashboard"].get_data(on_date=self.today)["vat"]["banner"]
        self.assertIn("osiągnięty", banner)

    def test_exceeded_mid_year_points_to_the_sale(self):
        self._entry(100000, dt.date(2027, 2, 10))
        self._entry(100000, dt.date(2027, 3, 10))
        self._entry(30000, dt.date(2027, 4, 10))  # 230 000
        over = self._entry(20000, dt.date(2027, 5, 10), doc_ref="FV-77")  # 250 000 > 240 000
        later = self._entry(5000, dt.date(2027, 6, 10))
        info = self._info()
        self.assertTrue(info["exceeded"])
        self.assertEqual(info["entry"]["id"], over.id)
        self.assertEqual(info["entry"]["date"], dt.date(2027, 5, 10))
        self.assertEqual(info["over_by"], D("10000"))
        # VAT w cieniu od sprzedaży, która przekroczyła limit, i od późniejszych
        self.assertAlmostEqual(float(info["vat_since"]), over.vat_shadow + later.vat_shadow, places=2)
        self.assertIn(over.name, info["text"])
        self.assertIn("art. 113 ust. 5", info["text"])
        self.assertIn("10 maja 2027", info["text"])
        self.Alert._evaluate(self.company, self.today, notify=False)
        alert = self.Alert.search([("kind", "=", "vat_limit"), ("level", "=", "100")])
        self.assertTrue(alert)
        self.assertIn(over.name, alert.message)
        data = self.env["jdg.dashboard"].get_data(on_date=self.today)
        self.assertTrue(data["vat"]["exceeded"])
        self.assertEqual(data["vat"]["since"]["date"], "2027-05-10")
        self.assertIn("LIMIT PRZEKROCZONY", data["vat"]["banner"])

    def test_refund_before_threshold_delays_exceedance(self):
        self._entry(200000, dt.date(2027, 2, 10))
        self._entry(-30000, dt.date(2027, 2, 20), kind="refund")
        self._entry(60000, dt.date(2027, 3, 10))  # 230 000: jeszcze nie
        self.assertFalse(self._info()["exceeded"])
        self._entry(20000, dt.date(2027, 3, 11))  # 250 000
        self.assertTrue(self._info()["exceeded"])

    def test_limit_prorated_in_start_year(self):
        self.profile.start_date = dt.date(2027, 7, 1)
        self._entry(100000, dt.date(2027, 7, 15))
        info = self._info()
        self.assertTrue(info["prorated"])
        self.assertEqual(info["days"], 184)
        self.assertAlmostEqual(float(info["limit"]), 240000 * 184 / 365, places=2)  # 120 986,30
        self._entry(25000, dt.date(2027, 7, 16))  # 125 000 > 120 986,30
        self.assertTrue(self._info()["exceeded"])

    def test_oss_alert_is_separate_from_vat(self):
        self.Rate.create({"currency_id": self.eur.id, "rate_date": dt.date(2027, 2, 26), "mid": 4.3})
        self._entry(9500, dt.date(2027, 3, 1), currency_id=self.eur.id, country_code="DE", buyer_type="b2c")
        self.Alert._evaluate(self.company, self.today, notify=False)
        self.assertTrue(self.Alert.search([("kind", "=", "oss10k")]))
        self.assertFalse(self.Alert.search([("kind", "=", "vat_limit")]))  # 9 500 EUR x 4,3 = 40 850 zł: daleko od limitu VAT
