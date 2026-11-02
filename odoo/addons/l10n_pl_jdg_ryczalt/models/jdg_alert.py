import logging

from odoo import api, fields, models
from odoo.exceptions import UserError

from .calc import CalcContext, _money
from .engine import ZERO

_logger = logging.getLogger(__name__)

KINDS = [
    ("health60", "Zdrowotna: próg 60 000 zł"),
    ("health300", "Zdrowotna: próg 300 000 zł"),
    ("vat_limit", "Limit zwolnienia z VAT"),
    ("oss10k", "OSS: 10 000 EUR"),
    ("donation_limit", "Darowizny od jednej osoby"),
]
LEVELS = (70, 90, 100)


class JdgAlert(models.Model):
    """Alerty progów (SPEC 2.11): jedno powiadomienie na (próg, poziom 70/90/100%, rok).

    Wartość porównujemy z limitem z tabeli reguł (nigdy z liczby w kodzie). Alert zostaje jako ślad; „Przyjąłem do
    wiadomości” tylko oznacza, że właściciel go widział. Wpisy testowe nie liczą się do progów.
    """

    _name = "jdg.alert"
    _description = "Alert progu"
    _order = "triggered_on desc, level desc, id desc"

    _uniq = models.UniqueIndex("(company_id, kind, level, year)", "Ten alert już się pojawił w tym roku.")

    company_id = fields.Many2one("res.company", "Firma", required=True, default=lambda self: self.env.company, index=True)
    kind = fields.Selection(KINDS, "Próg", required=True, index=True)
    level = fields.Selection([("70", "70%"), ("90", "90%"), ("100", "100% (osiągnięty)")], "Poziom", required=True)
    year = fields.Integer("Rok", required=True, index=True)
    triggered_on = fields.Date("Kiedy", required=True)
    value_at_trigger = fields.Float("Wartość", digits=(16, 2))
    limit_value = fields.Float("Limit", digits=(16, 2))
    unit = fields.Char("Jednostka")
    title = fields.Char("Nazwa progu")
    message = fields.Text("Treść")
    acknowledged = fields.Boolean("Przyjęty do wiadomości", default=False)

    def action_acknowledge(self):
        self.write({"acknowledged": True})
        return True

    @api.model
    def _evaluate(self, company=None, today=None, notify=True):
        """Sprawdza progi na dzień `today` i zapisuje nowe alerty. Zwraca rekordy utworzone w tym przebiegu."""
        company = company or self.env.company
        today = today or fields.Date.context_today(self)
        profile = self.env["jdg.profile"]._get(company)
        try:
            ctx = CalcContext(self.env, profile, today, include_test=False)
            metrics = ctx.alert_metrics()
        except UserError as err:
            _logger.warning("jdg: alerty pominięte (%s)", err)
            return self.browse()
        created = self.browse()
        sudo = self.sudo()
        for metric in metrics:
            value, limit = metric["value"], metric["limit"]
            if limit <= 0 or value <= ZERO:
                continue
            pct = float(value / limit * 100)
            reached = [lv for lv in LEVELS if pct >= lv]
            if not reached:
                continue
            have = set(sudo.search([("company_id", "=", company.id), ("kind", "=", metric["kind"]),
                                    ("year", "=", today.year)]).mapped("level"))
            fresh = [lv for lv in reached if str(lv) not in have]
            if not fresh:
                continue
            top = max(fresh)
            unit = "zł" if metric["unit"] == "PLN" else metric["unit"]
            text = "%s: osiągnięto %d%% (%s %s z %s %s). %s" % (
                metric["title"], top, _money(value), unit, _money(limit, 0), unit, metric["text"])
            batch = sudo.browse()
            for lv in fresh:
                batch |= sudo.create({
                    "company_id": company.id, "kind": metric["kind"], "level": str(lv), "year": today.year,
                    "triggered_on": today, "value_at_trigger": float(value), "limit_value": float(limit),
                    "unit": metric["unit"], "title": metric["title"], "message": text,
                })
            created |= batch
            if notify:
                prefix = "Uwaga" if top < 100 else "Próg osiągnięty"
                self.env["jdg.notify"].post("%s. %s" % (prefix, text), company)
        return created

    @api.model
    def _check_after_post(self, company, day):
        """Szybki test po zaksięgowaniu wpisu. Błąd obliczeń nie może zablokować księgowania."""
        if self.env.context.get("jdg_no_alerts"):
            return
        try:
            with self.env.cr.savepoint():
                self._evaluate(company, max(fields.Date.context_today(self), day))
        except Exception:  # noqa: BLE001
            _logger.exception("jdg: sprawdzenie progów po księgowaniu nie powiodło się")
