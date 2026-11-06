"""Okresy rozliczeniowe (miesiąc, kwartał): zamykanie z migawką liczb, blokada edycji zamkniętych okresów.

Zamknięcie okresu (SPEC 2.7):
  * dozwolone dopiero po końcu okresu, po zamknięciu poprzednich okresów i gdy nie ma wpisów roboczych,
  * zapisuje migawkę (przychód, podatek narastająco, zdrowotna i ZUS za miesiące okresu, zaliczka, ustawienia
    profilu, użyte reguły z pewnością) oraz skrót SHA-256 liczb,
  * blokuje nowe wpisy i płatności z datą w okresie (korekta trafia do pierwszego otwartego okresu, `reverses_id`),
  * zamknięcie kwartału zamyka po kolei jego miesiące,
  * ponowne otwarcie: tylko właściciel, z powodem, wpis w historii (chatter), tylko od końca (najpóźniejszy okres).

Wszystko to SZACUNEK, NIE PORADA PODATKOWA.
"""

import datetime as dt
import hashlib
import json

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError

from . import engine
from .calc import MONTHS, CalcContext, _money, date_long, period_label
from .engine import ZERO

MANAGER_GROUP = "l10n_pl_jdg_ryczalt.group_jdg_manager"


def _s(value):
    """Decimal → tekst z dwoma miejscami (stabilny zapis do migawki i skrótu)."""
    return "%.2f" % engine.jdg_round(value)


class JdgPeriod(models.Model):
    _name = "jdg.period"
    _description = "Okres rozliczeniowy"
    _inherit = ["mail.thread"]
    _order = "date_from desc, kind"
    _mail_post_access = "read"

    _period_uniq = models.UniqueIndex("(company_id, kind, date_from)", "Taki okres już istnieje.")

    company_id = fields.Many2one("res.company", "Firma", required=True, default=lambda self: self.env.company, index=True)
    pln_currency_id = fields.Many2one("res.currency", compute="_compute_pln_currency", store=True)
    kind = fields.Selection([("month", "Miesiąc"), ("quarter", "Kwartał")], "Rodzaj", required=True, index=True)
    date_from = fields.Date("Od", required=True, index=True)
    date_to = fields.Date("Do", required=True)
    name = fields.Char("Okres", compute="_compute_name", store=True)
    state = fields.Selection([("open", "Otwarty"), ("closed", "Zamknięty")], "Stan", default="open", required=True,
                             tracking=True, index=True)
    is_ended = fields.Boolean("Okres się skończył", compute="_compute_is_ended")
    closed_at = fields.Datetime("Zamknięto", readonly=True)
    closed_by = fields.Many2one("res.users", "Zamknął", readonly=True)
    reopen_count = fields.Integer("Ponownych otwarć", readonly=True)

    entry_count = fields.Integer("Liczba wpisów", readonly=True)
    revenue = fields.Monetary("Przychód w okresie", currency_field="pln_currency_id", readonly=True)
    cum_revenue = fields.Monetary("Przychód narastająco", currency_field="pln_currency_id", readonly=True)
    tax_cum = fields.Monetary("Podatek narastająco", currency_field="pln_currency_id", readonly=True)
    advance_due = fields.Monetary("Zaliczka za okres", currency_field="pln_currency_id", readonly=True,
                                  help="Wypełnione tylko dla okresu zgodnego z rytmem zaliczek (profil firmy).")
    health_due = fields.Monetary("Składka zdrowotna (należna)", currency_field="pln_currency_id", readonly=True)
    social_due = fields.Monetary("Składki społeczne (należne)", currency_field="pln_currency_id", readonly=True)
    fp_due = fields.Monetary("Fundusz Pracy (należny)", currency_field="pln_currency_id", readonly=True)
    totals_json = fields.Json("Migawka liczb", readonly=True, copy=False)
    totals_hash = fields.Char("Skrót SHA-256", readonly=True, copy=False)
    rules_snapshot_json = fields.Json("Użyte reguły", readonly=True, copy=False)
    advance_ids = fields.One2many("jdg.tax.advance", "period_id", "Zaliczka", readonly=True)
    snapshot_text = fields.Text("Podsumowanie migawki", compute="_compute_snapshot_text")

    def _compute_pln_currency(self):
        pln = self.env.ref("base.PLN")
        for period in self:
            period.pln_currency_id = pln

    @api.depends("kind", "date_from", "date_to")
    def _compute_name(self):
        for period in self:
            period.name = period_label(period.date_from, period.date_to) if period.date_from and period.date_to else False

    def _compute_is_ended(self):
        today = fields.Date.context_today(self)
        for period in self:
            period.is_ended = bool(period.date_to) and period.date_to < today

    @api.depends("totals_json", "rules_snapshot_json")
    def _compute_snapshot_text(self):
        for period in self:
            data = period.totals_json
            if not data:
                period.snapshot_text = False
                continue
            lines = ["Przychód w okresie: %s zł (narastająco %s zł), wpisów: %s." % (
                _money(engine.dec(data["revenue"])), _money(engine.dec(data["cum_revenue"])), data["entry_count"]),
                "Podatek narastająco: %s zł (podstawa %s zł)." % (
                    _money(engine.dec(data["tax"]["cum_tax"])), _money(engine.dec(data["tax"]["base"])))]
            for item in data["months"]:
                year, month = (int(x) for x in item["month"].split("-"))
                lines.append("%s %d: zdrowotna %s zł, społeczne %s zł, FP %s zł." % (
                    MONTHS[month - 1].capitalize(), year, _money(engine.dec(item["health"])),
                    _money(engine.dec(item["social"])), _money(engine.dec(item["fp"]))))
            if data.get("advance"):
                adv = data["advance"]
                lines.append("Zaliczka na ryczałt: %s zł (termin %s)." % (
                    _money(engine.dec(adv["advance"])), date_long(dt.date.fromisoformat(adv["due_date"]))))
            period.snapshot_text = "\n".join(lines)

    # ------------------------------------------------------------------ tworzenie okresów

    @api.model
    def _ensure_periods(self, company=None, up_to=None):
        """Tworzy brakujące okresy (miesiące i kwartały) od miesiąca startu działalności do `up_to` (domyślnie dziś)."""
        company = company or self.env.company
        profile = self.env["jdg.profile"]._get(company)
        up_to = up_to or fields.Date.context_today(self)
        existing = {(p.kind, p.date_from) for p in self.sudo().search([("company_id", "=", company.id)])}
        vals, month = [], engine.month_start(profile.start_date)
        while month <= engine.month_start(up_to):
            q0, q1 = engine.quarter_bounds(month)
            for kind, d0, d1 in (("month", month, engine.month_end(month)), ("quarter", q0, q1)):
                if (kind, d0) not in existing:
                    existing.add((kind, d0))
                    vals.append({"company_id": company.id, "kind": kind, "date_from": d0, "date_to": d1})
            month = engine.add_months(month, 1)
        if vals:
            self.sudo().create(vals)
        return True

    @api.model
    def action_open_periods(self):
        self._ensure_periods()
        return {
            "type": "ir.actions.act_window", "name": "Zamykanie okresów", "res_model": "jdg.period",
            "view_mode": "list,form,pivot,graph", "domain": [("company_id", "=", self.env.company.id)],
            "context": {"search_default_months": 1},
        }

    # ------------------------------------------------------------------ blokada zamkniętych okresów (API dla innych modeli)

    @api.model
    def _closed_covering(self, company, day):
        return self.sudo().search([("company_id", "=", company.id), ("state", "=", "closed"),
                                   ("date_from", "<=", day), ("date_to", ">=", day)], order="kind", limit=1)

    @api.model
    def _first_open_date(self, company, day):
        """Pierwszy dzień >= `day` leżący w otwartym okresie (tam trafia korekta wpisu z zamkniętego okresu)."""
        for _i in range(60):
            closed = self._closed_covering(company, day)
            if not closed:
                return day
            day = closed.date_to + dt.timedelta(days=1)
        return day

    @api.model
    def _assert_open(self, company, day, what="Wpis"):
        closed = self._closed_covering(company, day)
        if closed:
            raise UserError(
                "%s z datą %s należy do zamkniętego okresu (%s), więc nie można go dodać ani zmienić. "
                "Błąd w zamkniętym okresie poprawia wpis korygujący w pierwszym otwartym okresie (od %s); "
                "w ostateczności właściciel może cofnąć zamknięcie okresu." % (
                    what, day, closed.name, date_long(self._first_open_date(company, day))))

    # ------------------------------------------------------------------ migawka

    def _compute_snapshot(self):
        """Liczy migawkę okresu na dzień jego końca (bez wpisów testowych). Zwraca (totals, vals, rules)."""
        self.ensure_one()
        profile = self.env["jdg.profile"]._get(self.company_id)
        d0, d1 = self.date_from, self.date_to
        ctx = CalcContext(self.env, profile, d1, include_test=False)
        first_month = engine.month_start(profile.start_date)
        months, health_sum, social_sum, fp_sum = [], ZERO, ZERO, ZERO
        month = engine.month_start(d0)
        while month <= d1:
            if month >= first_month:
                health, social = ctx.health_for_month(month), ctx.social_for_month(month)
                months.append({
                    "month": month.strftime("%Y-%m"), "health": _s(health.amount), "health_tier_pct": _s(health.tier_pct),
                    "health_basis": _s(health.basis), "avg_wage": _s(health.avg_wage), "social": _s(social.social),
                    "fp": _s(social.fp), "zus_variant": social.variant,
                })
                health_sum += health.amount
                social_sum += social.social
                fp_sum += social.fp
            month = engine.add_months(month, 1)
        tax = ctx.tax_cum(d1)
        by_rate = ctx.rev_by_rate(d0, d1)
        self.env.flush_all()
        self.env.cr.execute(
            "SELECT COUNT(*) FROM jdg_income_entry WHERE company_id = %s AND state = 'posted' AND NOT is_test "
            "AND income_date BETWEEN %s AND %s", (self.company_id.id, d0, d1))
        entry_count = self.env.cr.fetchone()[0]
        advance = shadow = None
        rhythm_kind = "month" if profile.advance_rhythm == "monthly" else "quarter"
        if self.kind == rhythm_kind and d1 >= profile.start_date:
            pa = ctx.period_advance(d0, d1)
            result = pa["tax_result"]
            advance = {
                "advance": _s(pa["advance"]), "previous_advances": _s(pa["previous"]), "due_date": pa["due_date"].isoformat(),
                "cum_revenue": _s(result.revenue), "cum_social_paid": _s(result.social_paid),
                "cum_health_paid": _s(result.health_paid), "base": _s(result.base), "cum_tax": _s(result.tax),
            }
            alt = ctx.shadow_rate(d1)
            if alt is not None:
                shadow = {"rate_pct": _s(alt), "advance": _s(ctx.period_advance(d0, d1, rate_override=alt)["advance"])}
        totals = {
            "period": {"kind": self.kind, "from": d0.isoformat(), "to": d1.isoformat()},
            "entry_count": entry_count,
            "revenue": _s(ctx.rev(d0, d1)), "cum_revenue": _s(ctx.cum(d1)),
            "by_rate": {_s(rate): _s(value) for rate, value in sorted(by_rate.items())},
            "tax": {"cum_tax": _s(tax.tax), "base": _s(tax.base), "base_raw": _s(tax.base_raw),
                    "social_paid": _s(tax.social_paid), "health_paid": _s(tax.health_paid),
                    "health_deduction": _s(tax.health_deduction)},
            "months": months,
            "health_due": _s(health_sum), "social_due": _s(social_sum), "fp_due": _s(fp_sum),
            "advance": advance, "shadow_15": shadow,
            "profile": {
                "start_date": profile.start_date.isoformat(), "rate_key": profile.ryczalt_rate_key,
                "advance_rhythm": profile.advance_rhythm, "tips_as_income": bool(profile.tips_as_income),
                "health_threshold_mode": profile.health_threshold_mode, "deduct_fp": bool(profile.deduct_fp),
                "uses_ulga_na_start": bool(profile.uses_ulga_na_start), "sickness_insurance": bool(profile.sickness_insurance),
            },
        }
        vals = {
            "entry_count": entry_count, "revenue": float(ctx.rev(d0, d1)), "cum_revenue": float(ctx.cum(d1)),
            "tax_cum": float(tax.tax), "advance_due": float(engine.dec(advance["advance"])) if advance else 0.0,
            "health_due": float(health_sum), "social_due": float(social_sum), "fp_due": float(fp_sum),
        }
        rules = [{
            "key": r.key, "label": r.label, "valid_from": r.valid_from.isoformat(),
            "valid_to": r.valid_to.isoformat() if r.valid_to else None, "value": r.value_display,
            "confidence": r.confidence, "verified_on": r.verified_on.isoformat() if r.verified_on else None, "state": r.state,
        } for r in sorted(ctx.rules.used.values(), key=lambda r: (r.key, r.valid_from))]
        return totals, vals, rules, advance, ctx

    @staticmethod
    def _hash(totals):
        return hashlib.sha256(json.dumps(totals, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()

    # ------------------------------------------------------------------ zamykanie i otwieranie

    @api.model
    def _check_manager(self):
        if not self.env.user.has_group(MANAGER_GROUP):
            raise AccessError("Okresy zamyka i otwiera tylko właściciel (grupa 'Właściciel').")

    def action_close(self):
        self._check_manager()
        for period in self.sorted(key=lambda p: (p.date_from, p.kind)):
            period._close_one()
        return True

    def _close_one(self):
        self.ensure_one()
        self = self.sudo()
        if self.state == "closed":
            return
        today = fields.Date.context_today(self)
        if self.date_to >= today:
            raise UserError("Okres %s jeszcze trwa (kończy się %s). Zamknąć można go dopiero po zakończeniu." % (
                self.name, date_long(self.date_to)))
        earlier = self.search([("company_id", "=", self.company_id.id), ("kind", "=", self.kind), ("state", "=", "open"),
                               ("date_to", "<", self.date_from)], order="date_from", limit=1)
        if earlier:
            raise UserError("Najpierw zamknij wcześniejszy okres: %s." % earlier.name)
        if self.kind == "quarter":
            months = self.search([("company_id", "=", self.company_id.id), ("kind", "=", "month"),
                                  ("date_from", ">=", self.date_from), ("date_to", "<=", self.date_to)], order="date_from")
            for month in months:
                month._close_one()
        drafts = self.env["jdg.income.entry"].sudo().search([
            ("company_id", "=", self.company_id.id), ("state", "=", "draft"), ("is_test", "=", False),
            ("income_date", ">=", self.date_from), ("income_date", "<=", self.date_to)], order="income_date")
        if drafts:
            raise UserError(
                "W okresie %s są niezaksięgowane wpisy (%d, najwcześniejszy z %s). Zaksięguj je albo usuń, a potem "
                "zamknij okres. Wpisy czekające na kurs NBP uzupełnią się po pobraniu kursów (Kursy NBP, Pobierz teraz)." % (
                    self.name, len(drafts), drafts[0].income_date))
        totals, vals, rules, advance, ctx = self._compute_snapshot()
        digest = self._hash(totals)
        self.write(dict(vals, state="closed", closed_at=fields.Datetime.now(), closed_by=self.env.uid,
                        totals_json=totals, totals_hash=digest, rules_snapshot_json=rules))
        if advance:
            self.env["jdg.tax.advance"]._from_snapshot(self, advance, totals.get("shadow_15"))
        self._close_deadline("todo").action_done()
        self.message_post(body=_(
            "Okres %(name)s zamknięty. Przychód %(rev)s zł, podatek narastająco %(tax)s zł, skrót %(hash)s.",
            name=self.name, rev=_money(engine.dec(totals["revenue"])), tax=_money(engine.dec(totals["tax"]["cum_tax"])),
            hash=digest[:12]))

    def _close_deadline(self, state):
        """Termin 'Zamknij miesiąc ...' odpowiadający miesięcznemu okresowi (w danym stanie)."""
        self.ensure_one()
        if self.kind != "month":
            return self.env["jdg.deadline"]
        return self.env["jdg.deadline"].sudo().search([
            ("company_id", "=", self.company_id.id), ("key", "=", "close:%s" % self.date_from.strftime("%Y-%m")),
            ("state", "=", state)])

    def action_verify(self):
        """Sprawdza, czy liczby zapisane przy zamknięciu zgadzają się z przeliczeniem z dzisiejszych danych i reguł."""
        self.ensure_one()
        if self.state != "closed":
            raise UserError("Spójność sprawdzamy tylko dla zamkniętego okresu.")
        totals = self._compute_snapshot()[0]
        ok = self._hash(totals) == self.totals_hash
        if ok:
            message, kind = _("Zgodne: przeliczenie daje te same liczby co migawka z dnia zamknięcia."), "success"
        else:
            changed = [key for key in totals if totals[key] != (self.totals_json or {}).get(key)]
            message = _("Różnica względem migawki w częściach: %s. Zmieniły się dane lub reguły po zamknięciu.", ", ".join(changed))
            kind = "warning"
        return {"type": "ir.actions.client", "tag": "display_notification",
                "params": {"title": _("Sprawdzenie okresu"), "message": message, "type": kind, "sticky": not ok}}

    def action_open_reopen_wizard(self):
        self._check_manager()
        self.ensure_one()
        return {"type": "ir.actions.act_window", "name": "Cofnij zamknięcie okresu", "res_model": "jdg.period.reopen.wizard",
                "view_mode": "form", "target": "new", "context": {"default_period_id": self.id}}

    def _reopen(self, reason):
        self._check_manager()
        self.ensure_one()
        period = self.sudo()
        if period.state != "closed":
            raise UserError("Ten okres nie jest zamknięty.")
        if not (reason or "").strip():
            raise UserError("Podaj powód cofnięcia zamknięcia (zapisze się w historii).")
        later = period.search([("company_id", "=", period.company_id.id), ("kind", "=", period.kind), ("state", "=", "closed"),
                               ("date_from", ">", period.date_from)], limit=1)
        if later:
            raise UserError("Najpierw cofnij zamknięcie późniejszego okresu: %s." % later.name)
        if period.kind == "month":
            quarter = period.search([("company_id", "=", period.company_id.id), ("kind", "=", "quarter"),
                                     ("state", "=", "closed"), ("date_from", "<=", period.date_from),
                                     ("date_to", ">=", period.date_to)], limit=1)
            if quarter:
                raise UserError("Miesiąc leży w zamkniętym kwartale (%s): najpierw cofnij zamknięcie kwartału." % quarter.name)
        old_hash = period.totals_hash
        advances = period.advance_ids
        advance_note = ""
        if advances:
            advance_note = " Zaliczka zapisana przy zamknięciu: %s zł." % _money(engine.dec(advances[0].advance_due))
            advances.with_context(jdg_allow_advance_unlink=True).unlink()
        period.message_post(body=_(
            "Cofnięto zamknięcie okresu %(name)s (%(user)s). Powód: %(reason)s. Skrót poprzedniej migawki: %(hash)s.%(adv)s",
            name=period.name, user=self.env.user.name, reason=reason.strip(), hash=(old_hash or "")[:12], adv=advance_note))
        period._close_deadline("done").action_reset()
        period.write({
            "state": "open", "closed_at": False, "closed_by": False, "reopen_count": period.reopen_count + 1,
            "totals_json": False, "totals_hash": False, "rules_snapshot_json": False,
            "entry_count": 0, "revenue": 0.0, "cum_revenue": 0.0, "tax_cum": 0.0, "advance_due": 0.0, "health_due": 0.0,
            "social_due": 0.0, "fp_due": 0.0,
        })
        return True

    def unlink(self):
        if any(p.state == "closed" for p in self):
            raise UserError("Zamkniętego okresu nie usuwamy. Najpierw cofnij jego zamknięcie (z powodem).")
        return super().unlink()


class JdgPeriodReopenWizard(models.TransientModel):
    _name = "jdg.period.reopen.wizard"
    _description = "Cofnięcie zamknięcia okresu"

    period_id = fields.Many2one("jdg.period", "Okres", required=True, readonly=True)
    reason = fields.Text("Powód cofnięcia", required=True, help="Zapisze się w historii okresu (audyt).")

    def action_confirm(self):
        self.ensure_one()
        self.period_id._reopen(self.reason)
        return {"type": "ir.actions.act_window", "res_model": "jdg.period", "res_id": self.period_id.id,
                "view_mode": "form", "target": "current"}
