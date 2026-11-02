"""Kalendarz terminów (SPEC 2.10, 3.6, 4.8): ZUS, zdrowotna, zaliczka na ryczałt, PIT-28, OSS, koniec ulgi na start,
przegląd reguł, komunikat GUS, zamknięcie okresu. Terminy są wyliczane z reguł i profilu (nie wpisywane z ręki),
przesuwane na dzień roboczy, z powiadomieniami w Discuss na 7, 3 i 1 dzień przed terminem.

Wszystko to SZACUNEK, NIE PORADA PODATKOWA.
"""

import datetime as dt
import logging

from odoo import api, fields, models
from odoo.exceptions import UserError

from . import engine
from .calc import MONTHS, ROMAN, CalcContext, _money, date_long

_logger = logging.getLogger(__name__)

KINDS = [
    ("zus", "ZUS (składki społeczne)"),
    ("health", "Składka zdrowotna"),
    ("advance", "Zaliczka na ryczałt"),
    ("pit28", "PIT-28"),
    ("oss", "OSS (VAT UE)"),
    ("ulga_end", "Koniec ulgi na start"),
    ("gus_comm", "Komunikat GUS"),
    ("rules_review", "Przegląd reguł"),
    ("close", "Zamknięcie okresu"),
]
# Poziomy powiadomień (dni do terminu): 7, 3, 1 oraz 0 = dzień terminu lub po terminie.
STAGES = (7, 3, 1, 0)
NEVER = 99


def _stage(days):
    """Najbliższy poziom powiadomienia dla liczby dni do terminu (<= 7), albo None."""
    if days > 7:
        return None
    if days > 3:
        return 7
    if days > 1:
        return 3
    if days == 1:
        return 1
    return 0


class JdgDeadline(models.Model):
    _name = "jdg.deadline"
    _description = "Termin (ZUS, zaliczka, PIT-28 i inne)"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "date_due, kind, id"

    _key_uniq = models.UniqueIndex("(company_id, key)", "Taki termin już istnieje.")

    company_id = fields.Many2one("res.company", "Firma", required=True, default=lambda self: self.env.company, index=True)
    pln_currency_id = fields.Many2one("res.currency", compute="_compute_pln_currency", store=True)
    key = fields.Char("Klucz", required=True, index=True, readonly=True,
                      help="Techniczny identyfikator (rodzaj + okres), dzięki któremu generator nie dubluje terminów.")
    name = fields.Char("Nazwa terminu", required=True)
    kind = fields.Selection(KINDS, "Rodzaj", required=True, index=True)
    date_due = fields.Date("Termin", required=True, index=True)
    date_original = fields.Date("Termin przed przesunięciem", help="Gdy termin wypada w dzień wolny, przesuwamy go na "
                                                                    "najbliższy dzień roboczy.")
    amount_estimate = fields.Monetary("Szacunek kwoty", currency_field="pln_currency_id")
    state = fields.Selection([("todo", "Do zrobienia"), ("done", "Zrobione"), ("skipped", "Pominięte")], "Stan",
                             default="todo", required=True, index=True, tracking=True)
    done_on = fields.Date("Zrobiono dnia")
    note = fields.Text("Notatka")
    days_left = fields.Integer("Dni do terminu", compute="_compute_days_left")
    level = fields.Selection([("soon", "Pilne"), ("near", "Wkrótce"), ("far", "Później"), ("closed", "Załatwione")],
                             compute="_compute_days_left")
    notified_stage = fields.Integer("Ostatnie powiadomienie (dni przed)", default=NEVER, readonly=True,
                                    help="99 = jeszcze nie powiadamiano; 7, 3, 1, 0 = ostatni wysłany poziom.")

    def _compute_pln_currency(self):
        pln = self.env.ref("base.PLN")
        for dl in self:
            dl.pln_currency_id = pln

    @api.depends("date_due", "state")
    def _compute_days_left(self):
        today = fields.Date.context_today(self)
        for dl in self:
            if dl.state != "todo" or not dl.date_due:
                dl.days_left, dl.level = 0, "closed"
                continue
            dl.days_left = (dl.date_due - today).days
            dl.level = "soon" if dl.days_left <= 7 else ("near" if dl.days_left <= 30 else "far")

    # ------------------------------------------------------------------ akcje

    def action_done(self):
        today = fields.Date.context_today(self)
        for dl in self:
            dl.write({"state": "done", "done_on": today})
            dl.activity_feedback(["mail.mail_activity_data_todo"])
        return True

    def action_skip(self):
        self.write({"state": "skipped"})
        self.activity_unlink(["mail.mail_activity_data_todo"])
        return True

    def action_reset(self):
        self.write({"state": "todo", "done_on": False, "notified_stage": NEVER})
        return True

    # ------------------------------------------------------------------ generator

    @api.model
    def _generate(self, company=None, today=None, months=12):
        """Tworzy i odświeża terminy na `months` miesięcy do przodu. Zrobionych i pominiętych nie rusza."""
        company = company or self.env.company
        today = today or fields.Date.context_today(self)
        profile = self.env["jdg.profile"]._get(company)
        ctx = CalcContext(self.env, profile, today, include_test=False)
        horizon = engine.add_months(today, months)
        recent = today - dt.timedelta(days=45)
        wanted = {}

        def hol(d):
            return ctx.holidays_md(d)

        def safe(fn):
            try:
                return fn()
            except UserError:
                return None

        def add(key, kind, name, raw, amount=None, bump=True):
            due = engine.next_business_day(raw, hol(raw)) if bump else raw
            if due < recent or due > horizon:
                return
            wanted[key] = {"key": key, "kind": kind, "name": name, "date_due": due,
                           "date_original": raw if due != raw else False,
                           "amount_estimate": float(amount) if amount is not None else 0.0}

        start_month = engine.month_start(profile.start_date)

        # ZUS i składka zdrowotna: co miesiąc, do 20. (15. przy pracownikach) następnego miesiąca
        day_key = "deadline.zus_day_employer" if profile.has_employees else "deadline.zus_day"
        month = max(start_month, engine.add_months(engine.month_start(today), -2))
        while month <= horizon:
            label = "%s %d" % (MONTHS[month.month - 1], month.year)
            raw = safe(lambda month=month: engine.add_months(month, 1).replace(day=int(ctx.rules.num(day_key, month))))
            if raw:
                social = safe(lambda month=month: ctx.social_for_month(month))
                if social and social.total > 0:
                    add("zus:%s" % month.strftime("%Y-%m"), "zus", "ZUS (składki społeczne) za %s" % label, raw,
                        social.social + social.fp)
                health = safe(lambda month=month: ctx.health_for_month(month))
                add("health:%s" % month.strftime("%Y-%m"), "health", "Składka zdrowotna za %s" % label, raw,
                    health.amount if health else None)
            month = engine.add_months(month, 1)

        # zaliczki na ryczałt (rytm z profilu); zamknięty okres bierze zamrożoną kwotę
        for year in (today.year - 1, today.year, today.year + 1):
            for ps, pe in engine.year_periods(year, profile.advance_rhythm):
                if pe < profile.start_date:
                    continue
                raw = safe(lambda pe=pe: engine.add_months(pe.replace(day=1), 1).replace(
                    day=int(ctx.rules.num("deadline.advance_day", pe))))
                if not raw:
                    continue
                amount = None
                frozen = self.env["jdg.tax.advance"].sudo().search([
                    ("company_id", "=", company.id), ("date_from", "=", ps), ("date_to", "=", pe)], limit=1)
                if frozen:
                    amount = frozen.advance_due
                elif ps <= today:
                    got = safe(lambda ps=ps, pe=pe, year=year: ctx._ctx_for(year).period_advance(ps, pe)["advance"])
                    amount = got
                label = (MONTHS[ps.month - 1] + " %d" % ps.year) if profile.advance_rhythm == "monthly" \
                    else "%s kwartał %d" % (ROMAN[(ps.month - 1) // 3], ps.year)
                add("advance:%s" % ps.strftime("%Y-%m"), "advance", "Zaliczka na ryczałt za %s" % label, raw, amount)

        # PIT-28 za każdy rok działalności
        for year in range(max(profile.start_date.year, today.year - 1), today.year + 2):
            rule = safe(lambda year=year: ctx.rules.char("deadline.pit28", dt.date(year + 1, 1, 1)))
            if rule:
                month_n, day_n = (int(x) for x in rule.split("-"))
                add("pit28:%d" % year, "pit28", "PIT-28 za %d" % year, dt.date(year + 1, month_n, day_n))

        # OSS: deklaracja kwartalna do końca miesiąca po kwartale (tylko gdy firma jest zarejestrowana w OSS)
        if profile.oss_registered:
            for year in (today.year - 1, today.year, today.year + 1):
                for ps, pe in engine.year_periods(year, "quarterly"):
                    if pe < profile.start_date:
                        continue
                    raw = engine.month_end(engine.add_months(pe.replace(day=1), 1))
                    add("oss:%s" % ps.strftime("%Y-%m"), "oss", "Deklaracja OSS za %s kwartał %d" % (ROMAN[(ps.month - 1) // 3], ps.year), raw)

        # koniec ulgi na start (30 dni wcześniej i w dniu zmiany)
        if profile.uses_ulga_na_start and profile.ulga_end_date:
            nxt = profile.ulga_end_date + dt.timedelta(days=1)
            social = safe(lambda: ctx.social_for_month(nxt))
            amount = (social.social + social.fp) if social else None
            add("ulga_end", "ulga_end", "Koniec ulgi na start: od %s płacisz ZUS preferencyjny" % date_long(nxt), nxt, amount, bump=False)
            add("ulga_end_prep", "ulga_end", "Za 30 dni kończy się ulga na start: przygotuj przelewy ZUS", nxt - dt.timedelta(days=30),
                amount, bump=False)

        # przeglądy reguł (15 stycznia i 1 września) i komunikat GUS (1 lutego)
        for year in (today.year, today.year + 1):
            add("rules_review:%d-01" % year, "rules_review", "Przegląd reguł podatkowych na rok %d (Reguły i parametry)" % year,
                dt.date(year, 1, 15), bump=False)
            add("rules_review:%d-09" % year, "rules_review", "Przegląd reguł podatkowych przed końcem roku", dt.date(year, 9, 1), bump=False)
            add("gus_comm:%d" % year, "gus_comm", "Sprawdź komunikat GUS o przeciętnym wynagrodzeniu (IV kwartał) i wpisz W do reguł",
                dt.date(year, 2, 1), bump=False)

        # zamknięcie miesiąca w module: do 10. następnego miesiąca
        month = max(start_month, engine.add_months(engine.month_start(today), -2))
        while month <= horizon:
            raw = engine.add_months(month, 1).replace(day=10)
            add("close:%s" % month.strftime("%Y-%m"), "close", "Zamknij miesiąc: %s %d (menu Zamykanie okresów)" % (
                MONTHS[month.month - 1], month.year), raw)
            month = engine.add_months(month, 1)

        # zapis do bazy: dodaj, odśwież niezałatwione, usuń niepotrzebne (tylko niezałatwione, bez powiadomień)
        existing = {d.key: d for d in self.sudo().search([("company_id", "=", company.id)])}
        create_vals = []
        for key, item in wanted.items():
            record = existing.get(key)
            if record is None:
                create_vals.append(dict(item, company_id=company.id))
            elif record.state == "todo":
                changes = {k: v for k, v in item.items() if k not in ("key", "date_original") and record[k] != v}
                if record.date_original != (item["date_original"] or False):
                    changes["date_original"] = item["date_original"]
                if changes:
                    if "date_due" in changes:
                        changes["notified_stage"] = NEVER
                    record.write(changes)
        created = self.sudo().create(create_vals) if create_vals else self.browse()
        stale = self.sudo().browse([d.id for k, d in existing.items()
                                    if k not in wanted and d.state == "todo" and d.date_due >= today and d.notified_stage == NEVER])
        stale.unlink()
        return created

    # ------------------------------------------------------------------ powiadomienia

    @api.model
    def _notify_due(self, company=None, today=None):
        """Powiadamia na 7, 3, 1 dzień przed terminem i w dniu/po terminie. Każdy poziom raz na termin."""
        company = company or self.env.company
        today = today or fields.Date.context_today(self)
        sent = self.browse()
        owners = self.env["jdg.notify"]._owners(company)
        todo = self.sudo().search([("company_id", "=", company.id), ("state", "=", "todo"),
                                   ("date_due", "<=", today + dt.timedelta(days=7)),
                                   ("date_due", ">=", today - dt.timedelta(days=30))], order="date_due")
        for dl in todo:
            days = (dl.date_due - today).days
            stage = _stage(days)
            if stage is None or stage >= dl.notified_stage:
                continue
            amount = (" Szacunek: %s zł." % _money(engine.dec(dl.amount_estimate))) if dl.amount_estimate else ""
            if days > 1:
                when = "Za %d dni (%s)" % (days, date_long(dl.date_due))
            elif days == 1:
                when = "Jutro (%s)" % date_long(dl.date_due)
            elif days == 0:
                when = "Dziś (%s)" % date_long(dl.date_due)
            else:
                when = "Po terminie od %d dni (termin był %s)" % (-days, date_long(dl.date_due))
            shifted = (" Termin przesunięty z %s na dzień roboczy." % date_long(dl.date_original)) if dl.date_original else ""
            self.env["jdg.notify"].post("%s: %s.%s%s (szacunek, nie porada podatkowa)" % (when, dl.name, amount, shifted), company)
            dl.write({"notified_stage": stage})
            if stage == 7 and owners:
                try:
                    with self.env.cr.savepoint():
                        dl.activity_schedule("mail.mail_activity_data_todo", date_deadline=dl.date_due, summary=dl.name,
                                             user_id=owners[0].id)
                except Exception:  # noqa: BLE001
                    _logger.exception("jdg: nie udało się utworzyć aktywności dla terminu %s", dl.key)
            sent |= dl
        return sent

    @api.model
    def _mark_done_for_payment(self, payment):
        """Zapisana płatność domyka odpowiadający jej termin (składka lub zaliczka za dany miesiąc/okres)."""
        if payment.amount <= 0:
            return
        month = payment.for_month
        profile = self.env["jdg.profile"]._get(payment.company_id)
        if payment.kind == "health":
            key = "health:%s" % month.strftime("%Y-%m")
        elif payment.kind == "zus_social":
            key = "zus:%s" % month.strftime("%Y-%m")
        elif payment.kind == "income_tax_advance":
            start, _end = engine.period_bounds(month, profile.advance_rhythm)
            key = "advance:%s" % start.strftime("%Y-%m")
        else:
            return
        deadline = self.sudo().search([("company_id", "=", payment.company_id.id), ("key", "=", key), ("state", "=", "todo")], limit=1)
        if deadline:
            deadline.action_done()
            deadline.write({"done_on": payment.paid_on})

    # ------------------------------------------------------------------ cron dzienny

    @api.model
    def _cron_daily(self, today=None):
        """Codziennie rano: okresy, terminy, alerty progów, powiadomienia, ostrzeżenie o wpisach czekających na kurs."""
        today = today or fields.Date.context_today(self)
        for company in self.env["res.company"].sudo().search([]):
            if not self.env["jdg.profile"].sudo().search_count([("company_id", "=", company.id)]):
                continue
            company_env = self.with_company(company)
            try:
                with self.env.cr.savepoint():
                    company_env.env["jdg.period"]._ensure_periods(company, today)
                    company_env._generate(company, today)
                    company_env.env["jdg.alert"]._evaluate(company, today)
                    company_env._notify_due(company, today)
                    company_env._warn_pending_fx(company, today)
            except Exception:  # noqa: BLE001 - jedna firma nie zatrzymuje pozostałych
                _logger.exception("jdg: dzienny przebieg nie powiódł się (firma %s)", company.id)
        return True

    @api.model
    def _warn_pending_fx(self, company, today):
        pending = self.env["jdg.income.entry"].sudo().search([
            ("company_id", "=", company.id), ("state", "=", "draft"), ("fx_source", "=", "missing"),
            ("income_date", "<", today - dt.timedelta(days=1))])
        if pending:
            self.env["jdg.notify"].post(
                "%d wpisów czeka na kurs NBP dłużej niż dobę (najstarszy z %s). Sprawdź Firma > Kursy NBP > Pobierz teraz "
                "albo wpisz kurs ręcznie." % (len(pending), min(pending.mapped("income_date"))), company)
        return len(pending)
