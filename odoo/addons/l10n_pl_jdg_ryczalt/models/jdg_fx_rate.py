import datetime as dt

from odoo import api, fields, models
from odoo.exceptions import UserError

# Ile dni wstecz szukamy tabeli A przed dniem przychodu (święta + weekendy, np. Wielkanoc = 4-5 dni bez tabeli).
MAX_LOOKBACK_DAYS = 10


class JdgFxRate(models.Model):
    """Kursy średnie NBP, tabela A: dopisywane, nie edytowane.

    Zasada [PR]: do przeliczenia przychodu w walucie obcej bierzemy kurs z ostatniego dnia roboczego
    PRZED dniem uzyskania przychodu, czyli z ostatniej opublikowanej tabeli A o dacie wcześniejszej niż dzień
    przychodu. W iteracji 1 kursy wpisuje się ręcznie (można wkleić z nbp.pl); iteracja 2 doda automatyczne
    pobieranie z api.nbp.pl.
    """

    _name = "jdg.fx.rate"
    _description = "Kurs NBP (tabela A)"
    _order = "rate_date desc, currency_id"
    _rec_name = "display_name"

    _currency_date_uniq = models.UniqueIndex(
        "(currency_id, rate_date)", "Kurs tej waluty z tego dnia już istnieje.")

    currency_id = fields.Many2one("res.currency", "Waluta", required=True, ondelete="restrict",
                                  domain="[('name', '!=', 'PLN')]")
    rate_date = fields.Date("Data tabeli NBP", required=True, index=True,
                            help="Data publikacji tabeli A (nie dzień przychodu).")
    mid = fields.Float("Kurs średni (zł za 1 jednostkę)", required=True, digits=(12, 6))
    table_no = fields.Char("Numer tabeli", help="Np. 001/A/NBP/2027.")
    source = fields.Selection([("manual", "Wpisany ręcznie"), ("nbp", "Pobrany z api.nbp.pl")],
                              string="Źródło", default="manual", required=True)
    fetched_at = fields.Datetime("Dodano", default=fields.Datetime.now, readonly=True)
    company_id = fields.Many2one("res.company", "Firma", default=lambda self: self.env.company)

    @api.depends("currency_id", "rate_date", "mid")
    def _compute_display_name(self):
        for rate in self:
            rate.display_name = "%s %s: %s" % (rate.currency_id.name or "", rate.rate_date or "", rate.mid)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("mid") is not None and vals["mid"] <= 0:
                raise UserError("Kurs musi być większy od zera.")
        return super().create(vals_list)

    def write(self, vals):
        raise UserError("Kursów NBP nie edytujemy (to dowód użyty do przeliczenia). Dodaj poprawny kurs "
                        "z inną datą tabeli albo usuń błędny, jeśli żaden wpis go nie używa.")

    @api.model
    def _rate_for(self, currency, income_date):
        """Ostatnia tabela A o dacie ściśle wcześniejszej niż `income_date` (max MAX_LOOKBACK_DAYS dni wstecz).
        Zwraca rekord albo pusty recordset (wtedy kurs trzeba wpisać ręcznie)."""
        if not currency or currency.name == "PLN":
            return self.browse()
        return self.search([
            ("currency_id", "=", currency.id),
            ("rate_date", "<", income_date),
            ("rate_date", ">=", income_date - dt.timedelta(days=MAX_LOOKBACK_DAYS)),
        ], order="rate_date desc", limit=1)
