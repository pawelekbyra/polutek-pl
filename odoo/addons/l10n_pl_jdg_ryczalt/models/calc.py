"""Kontekst obliczeń: wczytuje wpisy i zapłaty z bazy (jednym zapytaniem na rok) i składa wyniki
z czystych funkcji `engine.py` oraz parametrów z tabeli reguł.

Nie jest modelem Odoo: to zwykła klasa, więc łatwo ją testować i wołać z pulpitu, z formularzy
(podpowiedź kwoty) i z testów. Nic tu nie zapisuje do bazy.

Wszystko to SZACUNEK, NIE PORADA PODATKOWA.
"""

import datetime as dt
from decimal import Decimal

from odoo.exceptions import UserError

from . import engine
from .engine import ZERO, dec
from .jdg_income_entry import DONATION_KIND, TAXABLE_KINDS
from .jdg_tax_rule import RuleReader

MONTHS = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień",
          "październik", "listopad", "grudzień"]
MONTHS_GEN = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września",
              "października", "listopada", "grudnia"]
MONTHS_SHORT = ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"]
ROMAN = ["I", "II", "III", "IV"]


def date_long(d):
    """4 stycznia 2027"""
    return "%d %s %d" % (d.day, MONTHS_GEN[d.month - 1], d.year)


def date_short(d):
    """20 lut"""
    return "%d %s" % (d.day, MONTHS_SHORT[d.month - 1])


def period_label(start, end):
    if start.month == end.month:
        return "%s %d" % (MONTHS[start.month - 1].capitalize(), start.year)
    return "%s kwartał %d" % (ROMAN[(start.month - 1) // 3], start.year)


def num(value):
    return float(value) if isinstance(value, Decimal) else value


class CalcContext:
    """Obliczenia dla jednej firmy na dzień `as_of` (uwzględnia tylko wpisy z datą <= as_of)."""

    def __init__(self, env, profile, as_of, include_test=False, rules=None):
        self.env = env
        self.profile = profile
        self.company = profile.company_id
        self.as_of = as_of
        self.year = as_of.year
        self.include_test = include_test
        self.rules = rules or RuleReader(env, self.company)
        self._ctx_by_year = {}
        self._load()

    # ------------------------------------------------------------------ dane

    def taxable_kinds(self):
        """Rodzaje wpisów liczone do przychodu. Darowizny tylko gdy włączono 'traktuj napiwki jako przychód'."""
        kinds = list(TAXABLE_KINDS)
        if self.profile.tips_as_income:
            kinds.append(DONATION_KIND)
        return kinds

    def donations(self, today):
        """Darowizny (poza przychodem): sumy dziś/miesiąc/rok oraz największa suma od jednego darczyńcy w oknie
        kilku lat wobec limitu z reguł (SD-Z2). Szacunek, nie porada podatkowa."""
        self.env.flush_all()
        cr = self.env.cr
        flt = (self.company.id, DONATION_KIND, self.include_test)
        cr.execute(
            """SELECT COALESCE(SUM(pln_amount) FILTER (WHERE income_date = %s), 0),
                      COALESCE(SUM(pln_amount) FILTER (WHERE income_date >= %s), 0),
                      COALESCE(SUM(pln_amount) FILTER (WHERE income_date >= %s), 0),
                      COUNT(*) FILTER (WHERE income_date = %s)
                 FROM jdg_income_entry
                WHERE company_id = %s AND kind = %s AND state = 'posted' AND (%s OR NOT is_test)
                  AND income_date <= %s""",
            (today, engine.month_start(today), dt.date(today.year, 1, 1), today) + flt + (today,))
        day, month, year, count = cr.fetchone()
        limit = self.rules.num("donation.limit_pln", today)
        years = int(self.rules.num("donation.window_years", today))
        cr.execute(
            """SELECT donor_key, SUM(pln_amount) AS total FROM jdg_income_entry
                WHERE company_id = %s AND kind = %s AND state = 'posted' AND (%s OR NOT is_test)
                  AND donor_key IS NOT NULL AND income_date > %s AND income_date <= %s
             GROUP BY donor_key ORDER BY total DESC LIMIT 1""",
            flt + (engine.add_months(today, -12 * years), today))
        top = cr.fetchone()
        top_total = dec(top[1]) if top else ZERO
        pct, level = engine.threshold_level(top_total, limit)
        return {
            "today": num(dec(day)), "month": num(dec(month)), "year": num(dec(year)), "count": int(count),
            "tips_as_income": bool(self.profile.tips_as_income),
            "limit": num(limit), "window_years": years, "top_total": num(top_total), "pct": round(pct, 1), "level": level,
            "text": "Największa suma od jednego darczyńcy w ostatnich %d latach: %s zł z limitu %s zł." % (
                years, _money(top_total), _money(limit, 0)),
            "sdz2": "Po przekroczeniu limitu darowizn od jednej osoby w oknie %d lat sprawdź obowiązek zgłoszenia SD-Z2 "
                    "do urzędu skarbowego (szczegóły w raporcie ODPOWIEDZI.md; do potwierdzenia z księgowym). "
                    "Limit %s zł to parametr w tabeli reguł." % (years, _money(limit, 0)),
        }

    def _load(self):
        self.env.flush_all()  # surowy SQL niżej nie widzi zmian czekających w pamięci ORM
        cr = self.env.cr
        first = dt.date(self.year - 1, 12, 1)
        cr.execute(
            """
            SELECT income_date, rate_pct, COALESCE(SUM(tax_base_pln), 0),
                   COUNT(*) FILTER (WHERE kind = 'sale'), COALESCE(SUM(fee_pln), 0)
              FROM jdg_income_entry
             WHERE company_id = %s AND state = 'posted' AND kind = ANY(%s)
               AND income_date >= %s AND income_date <= %s AND (%s OR NOT is_test)
          GROUP BY income_date, rate_pct
            """,
            (self.company.id, self.taxable_kinds(), first, self.as_of, self.include_test))
        self.rows = [(d, dec(rate), dec(rev), int(cnt), dec(fee)) for d, rate, rev, cnt, fee in cr.fetchall()]
        cr.execute(
            """
            SELECT kind, for_month, paid_on, amount FROM jdg_contribution_payment
             WHERE company_id = %s AND paid_on >= %s AND paid_on <= %s
            """,
            (self.company.id, dt.date(self.year, 1, 1), self.as_of))
        self.payments = [(kind, fm, paid, dec(amount)) for kind, fm, paid, amount in cr.fetchall()]

    def holidays_md(self, on_date):
        return self.rules.json("holidays.PL", on_date) or []

    def _ctx_for(self, year):
        """Kontekst dla innego roku (np. grudzień poprzedniego roku w styczniowym terminie)."""
        if year == self.year:
            return self
        if year not in self._ctx_by_year:
            self._ctx_by_year[year] = CalcContext(
                self.env, self.profile, min(dt.date(year, 12, 31), self.as_of), self.include_test, self.rules)
        return self._ctx_by_year[year]

    # ------------------------------------------------------------------ sumy

    def rev_by_rate(self, d0, d1):
        result = {}
        for d, rate, rev, _cnt, _fee in self.rows:
            if d0 <= d <= d1:
                result[rate] = result.get(rate, ZERO) + rev
        return result

    def rev(self, d0, d1):
        return sum(self.rev_by_rate(d0, d1).values(), ZERO)

    def sales_count(self, d0, d1):
        return sum(cnt for d, _r, _v, cnt, _f in self.rows if d0 <= d <= d1)

    def fees(self, d0, d1):
        return sum((fee for d, _r, _v, _c, fee in self.rows if d0 <= d <= d1), ZERO)

    def cum_by_rate(self, upto):
        """Przychód narastająco od 1 stycznia roku `upto` do `upto` włącznie."""
        return self.rev_by_rate(dt.date(upto.year, 1, 1), upto)

    def cum(self, upto):
        return sum(self.cum_by_rate(upto).values(), ZERO)

    def paid(self, kind, upto):
        """Zapłacone narastająco od 1 stycznia do `upto` (wg daty zapłaty)."""
        return sum((amount for k, _fm, paid, amount in self.payments
                    if k == kind and dt.date(upto.year, 1, 1) <= paid <= upto), ZERO)

    def social_paid(self, upto):
        total = self.paid("zus_social", upto)
        if self.profile.deduct_fp:
            total += self.paid("zus_fp", upto)
        return total

    def recorded_advances(self, start, end):
        """Zapłacone zaliczki przypisane do okresu (po `for_month`); None, gdy nic nie zapisano."""
        rows = [amount for k, fm, _p, amount in self.payments if k == "income_tax_advance" and start <= fm <= end]
        return sum(rows, ZERO) if rows else None

    # ------------------------------------------------------------------ ZUS i zdrowotna

    def zus_variant(self, on_date):
        profile = self.profile
        return engine.zus_variant_on(
            on_date, profile.start_date, profile.uses_ulga_na_start,
            int(self.rules.num("ulga.months", profile.start_date)),
            int(self.rules.num("pref.months", profile.start_date)),
            profile.zus_after_variant)

    def social_for_month(self, month):
        m = engine.month_start(month)
        variant = self.zus_variant(max(m, self.profile.start_date))
        base = ZERO
        if variant == engine.ZUS_PREF:
            base = self.rules.num("zus.pref.base", m)
        elif variant in (engine.ZUS_FULL, engine.ZUS_MZP):
            base = self.rules.num("zus.full.base", m)
        rates = {}
        if variant not in (engine.ZUS_NONE, engine.ZUS_ULGA):
            rates = {
                "pension": self.rules.num("zus.rate.pension", m),
                "disability": self.rules.num("zus.rate.disability", m),
                "accident": dec(self.profile.accident_rate_pct),
                "sickness": self.rules.num("zus.rate.sickness", m),
                "fp": self.rules.num("zus.rate.fp", m),
            }
        min_wage = self.rules.num("min_wage", m) if variant in (engine.ZUS_FULL, engine.ZUS_MZP) else ZERO
        return engine.social_due(variant, base, rates, self.profile.sickness_insurance, min_wage)

    def health_for_month(self, month):
        """Składka zdrowotna za miesiąc (SPEC 4.3). Przed startem działalności: 0."""
        m = engine.month_start(month)
        if m < engine.month_start(self.profile.start_date):
            return engine.HealthResult(ZERO, ZERO, ZERO, ZERO, ZERO, ZERO)
        if m.year < self.year:
            return self._ctx_for(m.year).health_for_month(m)
        upto = min(engine.month_end(m), self.as_of)
        mode = self.profile.health_threshold_mode
        ref = upto if mode == "crossing_month" else m - dt.timedelta(days=1)
        if m.year > self.year or ref.year != m.year:
            basis = ZERO  # nowy rok: przychód narastająco zaczyna się od zera
        else:
            basis = max(ZERO, self.cum(ref) - self.social_paid(ref))
        return engine.health_due(
            basis,
            avg_wage=self.rules.num("gus_avg_wage_q4", m),
            min_wage=self.rules.num("min_wage", m),
            rate_pct=self.rules.num("health.rate_pct", m),
            limits=tuple(dec(x) for x in self.rules.json("health.tier_limits", m)),
            tiers=tuple(dec(x) for x in self.rules.json("health.tier_pct", m)),
            min_pct_of_min_wage=self.rules.num("health.min_pct_of_min_wage", m),
        )

    # ------------------------------------------------------------------ podatek

    def tax_cum(self, upto, rate_override=None):
        """Podatek narastająco. `rate_override`: "cień", czyli cały przychód po innej stawce (np. 15% zamiast 8,5%)."""
        by_rate = self.cum_by_rate(upto)
        if rate_override is not None:
            by_rate = {dec(rate_override): sum(by_rate.values(), ZERO)}
        return engine.ryczalt_cumulative(by_rate, self.social_paid(upto), self.paid("health", upto))

    def shadow_rate(self, on_date):
        """Stawka "cienia" (wyższa alternatywa 15%) albo None, gdy bieżąca stawka jest już najwyższa."""
        alt = self.rules.num("ryczalt.rate.vod_15", on_date)
        current = self.rules.num(self.profile.ryczalt_rate_key, on_date)
        return alt if alt > current else None

    def month_advance_shadow(self, month, rate):
        m0 = engine.month_start(month)
        upto = min(engine.month_end(m0), self.as_of)
        prev_end = m0 - dt.timedelta(days=1)
        prev = self.tax_cum(prev_end, rate).tax if prev_end.year == m0.year else ZERO
        return max(ZERO, self.tax_cum(upto, rate).tax - prev)

    def period_advance(self, start, end, rate_override=None):
        """Zaliczka za okres zaliczkowy [start, end] (narastająco, SPEC 4.5)."""
        rhythm = self.profile.advance_rhythm
        prev_sum = ZERO
        for ps, pe in engine.year_periods(start.year, rhythm):
            upto = min(pe, self.as_of)
            result = self.tax_cum(upto, rate_override)
            computed = engine.advance_for_period(result.tax, prev_sum)
            if ps == start:
                due_date = engine.advance_due_date(
                    pe, int(self.rules.num("deadline.advance_day", pe)), self.holidays_md(pe))
                return {
                    "start": ps, "end": pe, "upto": upto, "tax_result": result, "previous": prev_sum,
                    "advance": computed, "due_date": due_date, "recorded": self.recorded_advances(ps, pe),
                }
            recorded = None if rate_override is not None else self.recorded_advances(ps, pe)
            prev_sum += recorded if recorded is not None else computed
        raise UserError("Nie znaleziono okresu zaliczki zaczynającego się %s." % start)

    def month_figures(self, month):
        """Liczby miesiąca dla pulpitu: przychód, zaliczka (przyrost podatku), składki, wolne środki."""
        m0 = engine.month_start(month)
        upto = min(engine.month_end(m0), self.as_of)
        revenue = self.rev(m0, upto)
        prev_end = m0 - dt.timedelta(days=1)
        tax_now = self.tax_cum(upto).tax
        tax_prev = self.tax_cum(prev_end).tax if prev_end.year == m0.year else ZERO
        advance = max(ZERO, tax_now - tax_prev)
        health = self.health_for_month(m0)
        social = self.social_for_month(m0)
        fees = self.fees(m0, upto)
        free, reserve = engine.free_funds(
            revenue, advance, health.amount, social.social, social.fp, fees, dec(self.profile.refund_reserve_pct))
        return {
            "revenue": revenue, "advance": advance, "health": health, "social": social,
            "fees": fees, "reserve": reserve, "free": free,
        }

    # ------------------------------------------------------------------ progi

    def thresholds(self):
        items = []
        upto = self.as_of
        basis = max(ZERO, self.cum(upto) - self.social_paid(upto))
        limits = [dec(x) for x in self.rules.json("health.tier_limits", upto)]
        health_now = self.health_for_month(upto)
        limit = limits[0] if basis <= limits[0] else limits[1]
        pct, level = engine.threshold_level(basis, limit)
        # kwota składki po przekroczeniu bieżącego progu
        after = engine.health_due(
            limit + dec("0.01"), health_now.avg_wage, self.rules.num("min_wage", upto),
            self.rules.num("health.rate_pct", upto), tuple(limits),
            tuple(dec(x) for x in self.rules.json("health.tier_pct", upto)),
            self.rules.num("health.min_pct_of_min_wage", upto))
        if basis > limits[1]:
            text = "Najwyższy próg: składka %s zł miesięcznie (180%% przeciętnego wynagrodzenia)." % _money(health_now.amount)
            limit = limits[1]
            pct, level = 100.0, "over"
        elif basis > limits[0]:
            lowest = engine.health_due(
                ZERO, health_now.avg_wage, self.rules.num("min_wage", upto), self.rules.num("health.rate_pct", upto),
                tuple(limits), tuple(dec(x) for x in self.rules.json("health.tier_pct", upto)),
                self.rules.num("health.min_pct_of_min_wage", upto))
            text = ("Próg %s zł przekroczony: składka zdrowotna %s zł miesięcznie (zamiast %s zł). "
                    "Następny próg: %s zł przychodu." % (
                        _money(limits[0], 0), _money(health_now.amount), _money(lowest.amount), _money(limits[1], 0)))
        else:
            text = "Po przekroczeniu %s zł przychodu składka zdrowotna wyniesie %s zł miesięcznie (dziś %s zł)." % (
                _money(limit, 0), _money(after.amount), _money(health_now.amount))
        items.append({
            "key": "health", "title": "Składka zdrowotna: próg %s zł" % _money(limit, 0), "value": num(basis),
            "limit": num(limit), "pct": round(pct, 1), "level": level, "unit": "zł", "text": text,
            "why": "Przychód narastająco od 1 stycznia minus zapłacone składki społeczne. Po przekroczeniu progu "
                   "podstawa składki rośnie z 60% do 100% przeciętnego wynagrodzenia (potem 180%). Moment zmiany: "
                   "ustawienie 'Moment zmiany progu' w profilu firmy [N].",
        })
        if self.profile.vat_status == "exempt_113":
            vat_limit = self.rules.num("vat.exempt_limit", upto)
            ref_year = max(upto, self.profile.start_date).year  # przed startem pokazujemy limit roku startu
            start = max(self.profile.start_date, dt.date(ref_year, 1, 1))
            days = (dt.date(ref_year, 12, 31) - start).days + 1
            prorated = vat_limit * min(Decimal(1), Decimal(days) / Decimal(365))
            sales = max(ZERO, self.cum(upto))
            pct, level = engine.threshold_level(sales, prorated)
            items.append({
                "key": "vat", "title": "Zwolnienie z VAT (limit %s zł)" % _money(prorated, 0), "value": num(sales),
                "limit": num(prorated), "pct": round(pct, 1), "level": level, "unit": "zł",
                "text": "Sprzedaż od 1 stycznia: %s zł z limitu %s zł (proporcjonalnie do dni działalności w roku)." % (
                    _money(sales), _money(prorated, 0)),
                "why": "Limit zwolnienia podmiotowego z VAT (art. 113): %s zł rocznie, w roku startu proporcjonalnie "
                       "do liczby dni działalności. Liczymy sprzedaż bez VAT narastająco od 1 stycznia." % _money(vat_limit, 0),
            })
        return items

    # ------------------------------------------------------------------ terminy

    def upcoming_deadlines(self, limit=4, horizon_months=14):
        profile = self.profile
        today = self.as_of
        events = []

        def safe(fn):
            try:
                return fn()
            except UserError:
                return None

        # ZUS i składka zdrowotna (zawsze miesięcznie)
        first = max(engine.month_start(profile.start_date), engine.add_months(engine.month_start(today), -1))
        month = first
        end = engine.add_months(today, horizon_months)
        while month <= end:
            day_key = "deadline.zus_day_employer" if profile.has_employees else "deadline.zus_day"
            due_raw = engine.add_months(month, 1).replace(day=int(self.rules.num(day_key, month)))
            due = engine.next_business_day(due_raw, self.holidays_md(due_raw))
            if due >= today:
                def amounts(month=month):
                    return self.health_for_month(month).amount, self.social_for_month(month)
                got = safe(amounts)
                amount = None
                label = "Składka zdrowotna za %s" % MONTHS_GEN[month.month - 1]
                if got:
                    health, social = got
                    amount = num(health + social.total)
                    if social.total > 0:
                        label = "ZUS i składka zdrowotna za %s" % MONTHS_GEN[month.month - 1]
                events.append({"kind": "zus", "date": due, "label": label, "amount": amount})
            month = engine.add_months(month, 1)

        # zaliczki na ryczałt
        for year in (today.year, today.year + 1):
            for ps, pe in engine.year_periods(year, profile.advance_rhythm):
                if pe < profile.start_date:
                    continue
                try:
                    due_raw = engine.add_months(pe.replace(day=1), 1).replace(
                        day=int(self.rules.num("deadline.advance_day", pe)))
                except UserError:
                    continue
                due = engine.next_business_day(due_raw, self.holidays_md(due_raw))
                if due < today or due > end:
                    continue
                amount = None
                if ps <= today:
                    got = safe(lambda ps=ps, pe=pe: self._ctx_for(year).period_advance(ps, pe)["advance"])
                    amount = num(got) if got is not None else None
                events.append({"kind": "advance", "date": due, "amount": amount,
                               "label": "Zaliczka na ryczałt za %s" % (
                                   MONTHS_GEN[ps.month - 1] if profile.advance_rhythm == "monthly"
                                   else "%s kwartał %d" % (ROMAN[(ps.month - 1) // 3], ps.year))})

        # PIT-28 za każdy rok działalności
        for year in range(max(profile.start_date.year, today.year - 1), today.year + 2):
            raw = safe(lambda year=year: self.rules.char("deadline.pit28", dt.date(year + 1, 1, 1)))
            if not raw:
                continue
            month_n, day_n = (int(x) for x in raw.split("-"))
            due_raw = dt.date(year + 1, month_n, day_n)
            due = engine.next_business_day(due_raw, self.holidays_md(due_raw))
            if today <= due <= end:
                events.append({"kind": "pit28", "date": due, "label": "PIT-28 za %d" % year, "amount": None})

        # koniec ulgi na start
        if profile.uses_ulga_na_start and profile.ulga_end_date and today <= profile.ulga_end_date + dt.timedelta(days=1) <= end:
            nxt = profile.ulga_end_date + dt.timedelta(days=1)
            social = safe(lambda: self.social_for_month(nxt))
            events.append({
                "kind": "info", "date": nxt, "amount": num(social.total) if social else None,
                "label": "Koniec ulgi na start: od tego dnia ZUS preferencyjny",
            })

        events.sort(key=lambda e: (e["date"], e["kind"]))
        result = []
        for ev in events[:limit]:
            days = (ev["date"] - today).days
            result.append({
                "kind": ev["kind"], "label": ev["label"], "amount": ev["amount"], "date": ev["date"].isoformat(),
                "date_short": date_short(ev["date"]), "date_long": date_long(ev["date"]), "days": days,
                "level": "soon" if days <= 7 else ("near" if days <= 30 else "far"),
            })
        return result


def _money(value, places=2):
    """1 234,56 (spacja jako separator tysięcy, przecinek dziesiętny)."""
    value = engine.jdg_round(value, places)
    text = f"{value:,.{places}f}".replace(",", " ").replace(".", ",")
    return text
