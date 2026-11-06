import datetime as dt
from zoneinfo import ZoneInfo

from odoo import _, api, fields, models
from odoo.exceptions import UserError

from . import engine, nbp_client

# Ile dni wstecz szukamy tabeli A przed dniem przychodu (święta + weekendy, np. Wielkanoc = 4-5 dni bez tabeli).
MAX_LOOKBACK_DAYS = 10
WARSAW = ZoneInfo("Europe/Warsaw")
# NBP publikuje tabelę A około południa. Po tej godzinie uznajemy dzisiejszy dzień roboczy za „sprawdzony”,
# nawet gdyby tabeli nie było (np. awaria NBP): inaczej wpisy z jutra czekałyby w nieskończoność.
PUBLISH_DEADLINE = dt.time(15, 30)
# Przed tą godziną nie pytamy NBP o dzisiejszą tabelę (oszczędzamy zbędne zapytania).
FIRST_TRY = dt.time(11, 30)
FIRST_RUN_LOOKBACK_DAYS = 35
MAX_CHUNKS_PER_RUN = 25  # 25 x 93 dni ~ 6 lat wstecz w jednym przebiegu


class JdgFxFetch(models.Model):
    """Dziennik pobrań z NBP: co i do kiedy mamy sprawdzone.

    To jest klucz do reguły „ostatni dzień roboczy PRZED dniem przychodu”: kurs z bazy jest wiążący tylko wtedy, gdy
    wiemy, że żadna NOWSZA tabela (jeszcze przed dniem przychodu) nie została pominięta. Zakresy z udanych pobrań
    (`date_from`..`covered_until`) sumują się w „pokrycie kalendarza”. Brak pokrycia = wpis czeka (stan pending),
    zamiast dostać po cichu starszy kurs.
    """

    _name = "jdg.fx.fetch"
    _description = "Dziennik pobrań kursów NBP"
    _order = "fetched_at desc, id desc"

    date_from = fields.Date("Zakres od", required=True)
    date_to = fields.Date("Zakres do", required=True)
    covered_until = fields.Date("Sprawdzone do", help="Do którego dnia (włącznie) wiemy, że mamy komplet tabel. Puste, "
                                                       "gdy dzisiejsza tabela jeszcze się nie ukazała.")
    state = fields.Selection([("ok", "Udane"), ("error", "Błąd")], string="Wynik", required=True, default="ok")
    trigger = fields.Selection([("cron", "Harmonogram"), ("manual", "Ręcznie")], string="Uruchomienie", default="cron")
    tables_count = fields.Integer("Tabele")
    rates_created = fields.Integer("Nowe kursy")
    attempts = fields.Integer("Próby", default=1)
    message = fields.Char("Komunikat")
    fetched_at = fields.Datetime("Kiedy", default=fields.Datetime.now, readonly=True)

    @api.model
    def _has_any(self):
        return bool(self.sudo().search_count([("state", "=", "ok")]))

    @api.model
    def _covered_intervals(self):
        rows = self.sudo().search_read([("state", "=", "ok"), ("covered_until", "!=", False)], ["date_from", "covered_until"])
        spans = sorted((r["date_from"], r["covered_until"]) for r in rows if r["covered_until"] >= r["date_from"])
        merged = []
        for start, end in spans:
            if merged and start <= merged[-1][1] + dt.timedelta(days=1):
                merged[-1] = (merged[-1][0], max(merged[-1][1], end))
            else:
                merged.append((start, end))
        return merged

    @api.model
    def _is_covered(self, d0, d1):
        if d0 > d1:
            return True
        return any(s <= d0 and d1 <= e for s, e in self._covered_intervals())

    @api.model
    def _uncovered(self, d0, d1):
        """Części [d0, d1], których nie obejmuje żadne udane pobranie (do pobrania)."""
        gaps, cursor = [], d0
        for start, end in self._covered_intervals():
            if end < cursor:
                continue
            if start > d1:
                break
            if start > cursor:
                gaps.append((cursor, min(d1, start - dt.timedelta(days=1))))
            cursor = max(cursor, end + dt.timedelta(days=1))
            if cursor > d1:
                break
        if cursor <= d1:
            gaps.append((cursor, d1))
        return gaps

    @api.model
    def _last_covered(self):
        spans = self._covered_intervals()
        return spans[-1][1] if spans else None


class JdgFxRate(models.Model):
    """Kursy średnie NBP, tabela A: dopisywane, nie edytowane.

    Zasada [PR]: do przeliczenia przychodu w walucie obcej bierzemy kurs z ostatniego dnia roboczego
    PRZED dniem uzyskania przychodu, czyli z ostatniej opublikowanej tabeli A o dacie wcześniejszej niż dzień
    przychodu. Kursy pobiera automatycznie harmonogram (api.nbp.pl, co godzinę, z bramką czasu), można je też
    wpisać ręcznie. Dopóki nie mamy pewności, że tabela z właściwego dnia została pobrana, wpis czeka (pending).
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
        records = super().create(vals_list)
        if not self.env.context.get("jdg_no_recompute"):
            self.env["jdg.income.entry"].sudo()._recompute_pending_fx()
        return records

    def write(self, vals):
        raise UserError("Kursów NBP nie edytujemy (to dowód użyty do przeliczenia). Dodaj poprawny kurs "
                        "z inną datą tabeli albo usuń błędny, jeśli żaden wpis go nie używa.")

    # ------------------------------------------------------------------ wyszukiwanie kursu

    @api.model
    def _rate_for(self, currency, income_date):
        """Ostatnia tabela A o dacie ściśle wcześniejszej niż `income_date` (max MAX_LOOKBACK_DAYS dni wstecz).

        Zwraca rekord albo pusty recordset (wtedy wpis czeka na kurs: pending). Kurs z NBP jest uznany tylko wtedy,
        gdy dziennik pobrań potwierdza, że między datą tej tabeli a dniem przychodu nie ukazała się żadna nowsza
        (inaczej wpis dostałby cicho starszy kurs). Kurs wpisany ręcznie jest zawsze uznawany (ręczna decyzja).
        Dopóki harmonogram nie pobrał niczego (stary tryb ręczny), działa jak w iteracji 1.
        """
        if not currency or currency.name == "PLN":
            return self.browse()
        rate = self.search([
            ("currency_id", "=", currency.id),
            ("rate_date", "<", income_date),
            ("rate_date", ">=", income_date - dt.timedelta(days=MAX_LOOKBACK_DAYS)),
        ], order="rate_date desc", limit=1)
        if not rate or rate.source == "manual":
            return rate
        need_from, need_to = rate.rate_date + dt.timedelta(days=1), income_date - dt.timedelta(days=1)
        fetch = self.env["jdg.fx.fetch"]
        if need_from > need_to or not fetch._has_any() or fetch._is_covered(need_from, need_to):
            return rate
        return self.browse()

    # ------------------------------------------------------------------ pobieranie z NBP

    @api.model
    def _holidays_md(self, on_date):
        try:
            rule = self.env["jdg.tax.rule"]._lookup("holidays.PL", on_date, self.env.company)
        except UserError:
            return []
        return rule.value_json or []

    @api.model
    def _store_tables(self, tables, active):
        """Zapisuje kursy aktywnych walut z tabel (pomija istniejące). Zwraca liczbę nowych kursów."""
        if not tables:
            return 0
        dates = [t[1] for t in tables]
        existing = {(r["currency_id"][0], r["rate_date"]) for r in self.sudo().search_read(
            [("rate_date", ">=", min(dates)), ("rate_date", "<=", max(dates))], ["currency_id", "rate_date"])}
        vals = []
        for number, effective, rates in tables:
            for code, currency in active.items():
                mid = rates.get(code)
                if mid and (currency.id, effective) not in existing:
                    vals.append({"currency_id": currency.id, "rate_date": effective, "mid": mid, "table_no": number,
                                 "source": "nbp", "company_id": False})
        if vals:
            self.sudo().with_context(jdg_no_recompute=True).create(vals)
        return len(vals)

    @api.model
    def _plan_fetch(self, today):
        """Zakresy do pobrania: od końca ostatniego pokrycia do dziś, plus ewentualne zaległości wpisów czekających."""
        fetch = self.env["jdg.fx.fetch"]
        entry = self.env["jdg.income.entry"].sudo()
        pending = entry.search([("state", "=", "draft"), ("fx_source", "=", "missing")])
        last = fetch._last_covered()
        lookback = dt.timedelta(days=MAX_LOOKBACK_DAYS + 2)
        if last is None:
            lo = today - dt.timedelta(days=FIRST_RUN_LOOKBACK_DAYS)
            self.env.flush_all()
            self.env.cr.execute(
                "SELECT MIN(income_date) FROM jdg_income_entry e JOIN res_currency c ON c.id = e.currency_id "
                "WHERE c.name <> 'PLN'")
            earliest = self.env.cr.fetchone()[0]
            if earliest:
                lo = min(lo, earliest - lookback)
        else:
            lo = min(last + dt.timedelta(days=1), today)
        if pending:
            lo = min(lo, min(pending.mapped("income_date")) - lookback)
        return fetch._uncovered(lo, today)

    @api.model
    def _cron_fetch(self, now=None, trigger="cron", get=None, force=False):
        """Pobiera brakujące tabele A z api.nbp.pl i przelicza wpisy czekające na kurs.

        `now`: czas w strefie Europe/Warsaw (do testów), `get`: podstawka za requests.get (testy bez sieci),
        `force`: pomija bramkę czasu (przycisk „Pobierz teraz”). Błąd sieci nie przerywa harmonogramu: zapisuje się w
        dzienniku (z licznikiem prób), a wpisy dalej czekają.
        """
        self = self.sudo()
        now = now or dt.datetime.now(WARSAW)
        today = now.date()
        fetch = self.env["jdg.fx.fetch"]
        gaps = self._plan_fetch(today)
        business_today = engine.is_business_day(today, self._holidays_md(today))
        if (not force and gaps == [(today, today)] and business_today and now.time().replace(tzinfo=None) < FIRST_TRY):
            gaps = []  # poranek dnia roboczego: dzisiejsza tabela jeszcze się nie ukazała
        summary = {"tables": 0, "rates": 0, "error": False, "requests": 0}
        active = {c.name: c for c in self.env["res.currency"].search([("active", "=", True), ("name", "!=", "PLN")])}
        chunks = [piece for gap in gaps for piece in nbp_client.chunk_ranges(*gap)][:MAX_CHUNKS_PER_RUN]
        for start, end in chunks:
            summary["requests"] += 1
            try:
                tables = nbp_client.fetch_tables(start, end, get=get)
            except nbp_client.NbpError as err:
                self._log_error(start, end, str(err), trigger)
                summary["error"] = str(err)
                break
            created = self._store_tables(tables, active)
            covered = end
            if end >= today:
                has_today = any(t[1] == today for t in tables)
                if business_today and not has_today and now.time().replace(tzinfo=None) < PUBLISH_DEADLINE:
                    covered = today - dt.timedelta(days=1)
            fetch.create({
                "date_from": start, "date_to": end, "covered_until": covered if covered >= start else False,
                "state": "ok", "trigger": trigger, "tables_count": len(tables), "rates_created": created,
                "message": "OK" if tables else "Brak tabel w zakresie (święta lub dzień przed publikacją).",
            })
            summary["tables"] += len(tables)
            summary["rates"] += created
        recomputed = self.env["jdg.income.entry"].sudo()._recompute_pending_fx()
        summary["recomputed"] = len(recomputed)
        return summary

    @api.model
    def _log_error(self, start, end, message, trigger):
        fetch = self.env["jdg.fx.fetch"]
        last = fetch.search([], limit=1)
        if last and last.state == "error" and last.message == message and last.date_from == start:
            last.write({"attempts": last.attempts + 1, "fetched_at": fields.Datetime.now(), "date_to": end})
            return last
        return fetch.create({"date_from": start, "date_to": end, "state": "error", "message": message, "trigger": trigger})

    @api.model
    def action_fetch_now(self):
        """Przycisk „Pobierz teraz” (menu Kursy NBP)."""
        result = self._cron_fetch(trigger="manual", force=True)
        if result["error"]:
            message, kind = _("Nie udało się pobrać kursów: %s", result["error"]), "danger"
        else:
            message = _("Pobrano %(tables)s tabel, nowe kursy: %(rates)s, przeliczono wpisów: %(re)s.",
                        tables=result["tables"], rates=result["rates"], re=result["recomputed"])
            kind = "success"
        return {"type": "ir.actions.client", "tag": "display_notification",
                "params": {"title": _("Kursy NBP"), "message": message, "type": kind, "sticky": False}}
