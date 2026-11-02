"""Dane dla ekranów OWL: pulpit 'Dzisiaj zarobiłem' i 'Podatki i składki'.

Każda metoda zwraca JEDEN słownik JSON (jedna transakcja, kilka zapytań agregujących). Teksty "skąd ta liczba"
(`why`) powstają tutaj, obok wzorów, żeby opis nie rozjechał się z obliczeniem.

Wszystko to SZACUNEK, NIE PORADA PODATKOWA.
"""

import datetime as dt

from odoo import api, fields, models
from odoo.exceptions import AccessError, UserError

from . import engine
from .calc import (MONTHS, MONTHS_GEN, ROMAN, CalcContext, _money, date_long, date_short, num, period_label)
from .engine import ZERO, dec

DISCLAIMER = "Szacunek, nie porada podatkowa."
RATE_WARNING = ("Stawka niepotwierdzona wiążącą interpretacją; ryzyko 15% (PKWiU 59.11.25.0 przesyłanie strumieni "
                "wideo: u nas własny streaming HLS). Potwierdź z księgowym.")
ZUS_LABELS = {
    engine.ZUS_NONE: "przed startem działalności",
    engine.ZUS_ULGA: "ulga na start",
    engine.ZUS_PREF: "preferencyjny ZUS",
    engine.ZUS_FULL: "pełny ZUS",
    engine.ZUS_MZP: "Mały ZUS Plus",
}
CONF_TEXT = {"P": "[P] potwierdzone", "PR": "[PR] prawdopodobne", "N": "[N] niepotwierdzone"}


class JdgDashboard(models.AbstractModel):
    _name = "jdg.dashboard"
    _description = "Dane pulpitu JDG"

    @api.model
    def _check_access(self):
        if not self.env.user.has_group("l10n_pl_jdg_ryczalt.group_jdg_user"):
            raise AccessError("Brak dostępu do modułu 'Firma'.")

    @api.model
    def _context(self, on_date, include_test):
        profile = self.env["jdg.profile"]._get(self.env.company)
        today = fields.Date.to_date(on_date) if on_date else fields.Date.context_today(self)
        return profile, today, CalcContext(self.env, profile, today, bool(include_test))

    @api.model
    def _meta(self, profile, today, ctx, include_test):
        self.env.flush_all()
        self.env.cr.execute(
            "SELECT COUNT(*) FILTER (WHERE is_test AND state = 'posted'), COUNT(*) FILTER (WHERE state = 'draft') "
            "FROM jdg_income_entry WHERE company_id = %s", (profile.company_id.id,))
        test_count, draft_count = self.env.cr.fetchone()
        summary = ctx.rules.summary()
        started = today >= profile.start_date
        return {
            "date": today.isoformat(),
            "date_long": date_long(today),
            "company": profile.company_id.name,
            "start_date": profile.start_date.isoformat(),
            "start_date_long": date_long(profile.start_date),
            "started": started,
            "days_to_start": (profile.start_date - today).days if not started else 0,
            "include_test": bool(include_test),
            "test_entries": test_count,
            "draft_entries": draft_count,
            "rules_since": summary["since"],
            "rules_confidence": summary["confidence"],
            "rules_confidence_text": CONF_TEXT[summary["confidence"]],
            "rules_unverified": summary["unverified"],
            "rules_unverified_labels": summary["unverified_labels"],
            "rules_drafts": summary["drafts"],
            "rhythm": profile.advance_rhythm,
            "rhythm_label": "kwartalnie" if profile.advance_rhythm == "quarterly" else "miesięcznie",
            "footer": "Wyniki informacyjne wg parametrów z tabeli reguł (obowiązujących od %s, pewność %s). %s "
                      "Zweryfikuj z księgowym." % (summary["since"] or "?", "[%s]" % summary["confidence"], DISCLAIMER),
            "disclaimer": DISCLAIMER,
        }

    # ------------------------------------------------------------------ pulpit "Dzisiaj zarobiłem"

    @api.model
    def get_data(self, on_date=None, include_test=False):
        self._check_access()
        try:
            return self._get_data(on_date, include_test)
        except UserError as err:
            return {"error": str(err.args[0] if err.args else err)}

    @api.model
    def _get_data(self, on_date, include_test):
        profile, today, ctx = self._context(on_date, include_test)
        month0, month1 = engine.month_start(today), engine.month_end(today)
        rate_rule = ctx.rules.rec(profile.ryczalt_rate_key, today)

        # --- dziś
        today_by_rate = ctx.rev_by_rate(today, today)
        rev_today = sum(today_by_rate.values(), ZERO)
        tax_today = engine.jdg_round(sum((r / 100 * v for r, v in today_by_rate.items()), ZERO))
        fees_today = ctx.fees(today, today)
        month = ctx.month_figures(today)
        contrib_month = month["health"].amount + month["social"].total
        contrib_today = ZERO
        if month["revenue"] > 0 and rev_today > 0:
            contrib_today = engine.jdg_round(contrib_month * rev_today / month["revenue"])

        # --- miesiąc i porównanie z poprzednim (do tego samego dnia)
        prev_start = engine.add_months(month0, -1)
        prev_same_day = min(prev_start.replace(day=1) + dt.timedelta(days=today.day - 1), engine.month_end(prev_start))
        prev_rev = ctx.rev(prev_start, prev_same_day)
        change = None
        if prev_rev > 0:
            change = round(float((month["revenue"] - prev_rev) / prev_rev * 100), 1)

        # --- kwartał / okres zaliczki i rok
        q0, q1 = engine.quarter_bounds(today)
        period = engine.period_bounds(today, profile.advance_rhythm)
        pa = ctx.period_advance(*period)
        year0 = dt.date(today.year, 1, 1)
        rev_year = ctx.rev(year0, today)
        thresholds = ctx.thresholds()
        shadow = self._shadow(ctx, profile, today, period, pa, month["advance"])
        health_threshold = next((t for t in thresholds if t["key"] == "health"), None)

        # --- rozbicie "ile mi zostaje" (SPEC 4.6)
        r_pct = float(rate_rule.value_num)
        social, health = month["social"], month["health"]
        variant_label = ZUS_LABELS[ctx.zus_variant(max(month0, profile.start_date))]
        free_rows = [
            {"key": "free", "label": "Wolne środki", "amount": num(month["free"]), "tone": "free",
             "why": "Przychód miesiąca minus zaliczka na ryczałt, składka zdrowotna, ZUS społeczne, opłaty Stripe "
                    "i rezerwa na zwroty. W miesiącu bez przychodu wychodzi na minus: to stałe koszty składek."},
            {"key": "pit", "label": "Zaliczka ryczałtu %s%% (po odliczeniach zapłaconych składek)" % _pct(r_pct),
             "amount": num(month["advance"]), "tone": "pit",
             "why": "Przyrost podatku narastająco w tym miesiącu. Podatek = stawka × (przychód narastająco − "
                    "zapłacone składki społeczne − 50%% zapłaconej zdrowotnej), liczone od pełnych złotych. "
                    "Odliczają się tylko składki faktycznie ZAPŁACONE (Firma > Zapłacone składki). Zaliczka = "
                    "podatek narastająco minus zaliczki za wcześniejsze okresy. Stawka %s%%: %s." % (
                        _pct(r_pct), CONF_TEXT[rate_rule.confidence])},
            {"key": "health", "label": ("Składka zdrowotna (próg %s%%)" % _pct(float(health.tier_pct))) if health.tier_pct
             else "Składka zdrowotna (przed startem działalności)",
             "amount": num(health.amount), "tone": "health",
             "why": "9%% × %s%% × przeciętne wynagrodzenie z IV kwartału roku poprzedniego (%s zł), nie mniej niż "
                    "9%% płacy minimalnej. Próg zależy od przychodu narastająco w roku (do 60 000 zł: 60%%)." % (
                        _pct(float(health.tier_pct)), _money(health.avg_wage))},
            {"key": "zus", "label": "ZUS społeczne (%s%s)" % (
                variant_label, ": do %s" % date_long(profile.ulga_end_date)
                if variant_label == "ulga na start" and profile.ulga_end_date else ""),
             "amount": num(social.social), "tone": "zus",
             "why": "Składki emerytalna, rentowa, wypadkowa i (jeśli włączona) chorobowa od podstawy zależnej od "
                    "wariantu ZUS. Ulga na start: 0 zł przez pierwsze 6 miesięcy; potem preferencyjny ZUS "
                    "(podstawa 30% płacy minimalnej) przez 24 miesiące."},
        ]
        if social.fp > 0:
            free_rows.append({"key": "fp", "label": "Fundusz Pracy", "amount": num(social.fp), "tone": "fp",
                              "why": "Składka na Fundusz Pracy (2,45% podstawy), tylko dla pełnego ZUS."})
        if month["reserve"] > 0:
            free_rows.append({"key": "reserve", "label": "Rezerwa na zwroty i spory (%s%%)" % _pct(profile.refund_reserve_pct),
                              "amount": num(month["reserve"]), "tone": "reserve",
                              "why": "Procent przychodu odkładany na zwroty i spory (ustawienie w profilu firmy)."})
        free_rows.append({"key": "fees", "label": "Opłaty Stripe (informacyjnie)", "amount": num(month["fees"]),
                          "tone": "fees",
                          "why": "Opłaty płatnicze zmniejszają kwotę, która realnie wpływa na konto, ale na ryczałcie "
                                 "NIE obniżają przychodu ani podatku."})
        set_aside = month["advance"] + health.amount + social.total
        bar = [r for r in free_rows if r["amount"] and r["amount"] > 0 and r["key"] != "free"]
        if month["free"] > 0:
            bar.insert(0, free_rows[0])

        # --- wykres dzienny
        days = []
        for n in range(1, month1.day + 1):
            d = month0.replace(day=n)
            days.append({"day": n, "date": d.isoformat(), "revenue": num(ctx.rev(d, d)), "future": d > today})

        # --- uwagi
        notes = []
        if not ctx.profile.start_date <= today:
            notes.append("Działalność startuje %s (za %d dni). Do tego czasu pulpit pokazuje tylko wpisy testowe, "
                         "jeśli je włączysz." % (date_long(profile.start_date), (profile.start_date - today).days))
        return {
            "meta": self._meta(profile, today, ctx, include_test),
            "notes": notes,
            "today": {
                "revenue": num(rev_today), "count": ctx.sales_count(today, today),
                "fees": num(fees_today), "after_fees": num(rev_today - fees_today),
                "set_aside_tax": num(tax_today), "set_aside_contrib": num(contrib_today),
                "set_aside_simple": num(engine.jdg_round(rev_today * dec(profile.set_aside_pct) / 100)),
                "set_aside_pct": profile.set_aside_pct,
                "tax_why": "Podatek od dzisiejszych wpłat bez odliczeń (stawka %s%% × przychód): ostrożnie, bo odliczenia "
                           "składek obniżą podatek dopiero przy rozliczeniu okresu." % _pct(r_pct),
                "contrib_why": "Dzisiejszy udział w składkach tego miesiąca (zdrowotna + ZUS), proporcjonalnie do "
                               "przychodu miesiąca.",
            },
            "month": {"revenue": num(month["revenue"]), "label": "%s %d" % (MONTHS[today.month - 1], today.year),
                      "prev_revenue": num(prev_rev), "change_pct": change},
            "period": {
                "label": period_label(pa["start"], pa["end"]), "revenue": num(ctx.rev(pa["start"], today)),
                "advance": num(pa["advance"]), "due_date": pa["due_date"].isoformat(),
                "due_date_long": date_long(pa["due_date"]), "rhythm": profile.advance_rhythm,
                "quarter_revenue": num(ctx.rev(q0, today)), "quarter_label": "%s kwartał %d" % (ROMAN[(q0.month - 1) // 3], q0.year),
            },
            "year": {"revenue": num(rev_year), "label": str(today.year),
                     "pct_of_health_limit": health_threshold and health_threshold["pct"]},
            "free": {
                "rows": free_rows, "bar": bar, "revenue": num(month["revenue"]), "set_aside": num(set_aside),
                "title": "Ile mi zostaje z tego miesiąca (szacunek)",
                "fixed_costs": num(set_aside) if month["revenue"] <= 0 else None,
            },
            "rate": {"pct": r_pct, "confidence": rate_rule.confidence, "unverified": not rate_rule.verified_on,
                     "note": rate_rule.source_note or ""},
            "shadow": shadow,
            "rate_warning": RATE_WARNING,
            "thresholds": thresholds,
            "donations": ctx.donations(today),
            "deadlines": ctx.upcoming_deadlines(limit=4),
            "chart": {"days": days, "label": "%s %d" % (MONTHS[today.month - 1], today.year),
                      "max": max([d["revenue"] for d in days] + [0.0])},
        }

    @api.model
    def _shadow(self, ctx, profile, today, period, pa, month_advance):
        """"Cień" stawki: ile wyniosłaby zaliczka, gdyby urząd uznał wyższą stawkę (15%). Różnica = możliwa dopłata."""
        rate = ctx.shadow_rate(today)
        if rate is None:
            return None
        sh = ctx.period_advance(*period, rate_override=rate)
        month_sh = ctx.month_advance_shadow(today, rate)
        return {
            "rate": num(rate),
            "period_advance": num(sh["advance"]),
            "period_diff": num(sh["advance"] - pa["advance"]),
            "month_advance": num(month_sh),
            "month_diff": num(month_sh - month_advance),
            "text": "Gdyby urząd uznał stawkę %s%%: zaliczka za ten okres %s zł, czyli o %s zł więcej niż przy %s%%." % (
                _pct(float(rate)), _money(sh["advance"]), _money(sh["advance"] - pa["advance"]),
                _pct(float(ctx.rules.num(profile.ryczalt_rate_key, today)))),
        }

    # ------------------------------------------------------------------ "Podatki i składki"

    @api.model
    def get_taxes(self, period_start=None, include_test=False, on_date=None):
        self._check_access()
        try:
            return self._get_taxes(period_start, on_date, include_test)
        except UserError as err:
            return {"error": str(err.args[0] if err.args else err)}

    @api.model
    def _get_taxes(self, period_start, on_date, include_test):
        profile, today, _ = self._context(on_date, include_test)
        rhythm = profile.advance_rhythm
        ref = fields.Date.to_date(period_start) if period_start else (today if today >= profile.start_date else profile.start_date)
        periods = engine.year_periods(ref.year, rhythm)
        start = engine.period_bounds(ref, rhythm)[0]
        end = next((pe for ps, pe in periods if ps == start), None)
        if end is None:
            raise UserError("Nieprawidłowy okres zaliczki.")
        as_of = min(end, today)
        ctx = CalcContext(self.env, profile, as_of, bool(include_test))
        pa = ctx.period_advance(start, end)
        tr = pa["tax_result"]
        rate_rule = ctx.rules.rec(profile.ryczalt_rate_key, end)
        due_label = pa["due_date"]

        steps = [
            {"kind": "base", "label": "Przychód narastająco od 1.01 (PLN po kursie NBP)", "amount": num(tr.revenue),
             "why": "Suma przychodu ze wszystkich zaksięgowanych wpisów od 1 stycznia do końca okresu, w złotych "
                    "po kursie NBP (tabela A, ostatni dzień roboczy przed dniem przychodu). Wpisy testowe nie wchodzą."},
            {"kind": "minus", "label": "− Składki społeczne zapłacone%s" % (
                " (ulga na start)" if ctx.zus_variant(max(engine.month_start(end), profile.start_date)) == engine.ZUS_ULGA else ""),
             "amount": num(tr.social_paid),
             "why": "100% ZAPŁACONYCH składek społecznych obniża podstawę ryczałtu. Liczą się płatności zapisane w "
                    "Firma > Zapłacone składki z datą zapłaty w okresie."},
            {"kind": "minus", "label": "− 50%% zapłaconej zdrowotnej (%s × 50%%)" % _money(tr.health_paid),
             "amount": num(tr.health_deduction),
             "why": "Połowa zapłaconych składek zdrowotnych obniża podstawę ryczałtu [PR]."},
            {"kind": "total", "label": "Podstawa (zaokr. do pełnych zł)", "amount": num(tr.base),
             "why": "Przychód − społeczne − 50% zdrowotnej, zaokrąglone do pełnych złotych (od 0,50 w górę)."},
            {"kind": "base", "label": "Podatek narastająco %s%%" % _pct(float(rate_rule.value_num)), "amount": num(tr.tax),
             "why": "Stawka ryczałtu × podstawa, do pełnych złotych. Stawka %s%% jest %s: %s" % (
                 _pct(float(rate_rule.value_num)), CONF_TEXT[rate_rule.confidence].lower(), rate_rule.source_note or "")},
            {"kind": "minus", "label": "− zaliczki za poprzednie okresy", "amount": num(pa["previous"]),
             "why": "Zaliczki z wcześniejszych okresów tego roku (zapłacone, a gdy ich nie zapisano: wyliczone)."},
            {"kind": "result", "label": "Zaliczka do zapłaty do %s" % date_short(due_label), "amount": num(pa["advance"]),
             "why": "Podatek narastająco minus wcześniejsze zaliczki, nigdy poniżej zera (po zwrotach zaliczka może wyjść 0). "
                    "Termin: 20. dzień po okresie; sobota, niedziela i święto przesuwają go na dzień roboczy."},
        ]

        # --- zdrowotna: miesiąc końca okresu
        last_month = engine.month_start(min(end, max(today, start)))
        health = ctx.health_for_month(last_month)
        tiers = [dec(x) for x in ctx.rules.json("health.tier_pct", last_month)]
        limits = [dec(x) for x in ctx.rules.json("health.tier_limits", last_month)]
        rate_h = ctx.rules.num("health.rate_pct", last_month)
        tier_amounts = [
            {"tier": num(t), "amount": num(engine.jdg_round(max(
                ctx.rules.num("health.min_pct_of_min_wage", last_month) / 100 * ctx.rules.num("min_wage", last_month),
                rate_h / 100 * t / 100 * health.avg_wage)))} for t in tiers]
        thresholds = next((t for t in ctx.thresholds() if t["key"] == "health"), None)

        # --- ZUS
        variant = ctx.zus_variant(max(last_month, profile.start_date))
        social = ctx.social_for_month(last_month)
        zus_lines = []
        if variant not in (engine.ZUS_NONE, engine.ZUS_ULGA):
            zus_lines = [
                {"label": "Emerytalna", "amount": num(social.pension)}, {"label": "Rentowa", "amount": num(social.disability)},
                {"label": "Wypadkowa", "amount": num(social.accident)},
                {"label": "Chorobowa (dobrowolna)", "amount": num(social.sickness)},
            ]
            if social.fp > 0:
                zus_lines.append({"label": "Fundusz Pracy", "amount": num(social.fp)})
        window = []
        if profile.uses_ulga_na_start and profile.ulga_end_date:
            window.append("ulga na start do %s" % date_long(profile.ulga_end_date))
        if profile.pref_end_date:
            window.append("preferencyjny ZUS do %s" % date_long(profile.pref_end_date))

        summary = ctx.rules.summary()
        shadow_rate = ctx.shadow_rate(end)
        shadow = None
        if shadow_rate is not None:
            sh = ctx.period_advance(start, end, rate_override=shadow_rate)
            shadow = {"rate": num(shadow_rate), "advance": num(sh["advance"]), "tax": num(sh["tax_result"].tax),
                      "diff": num(sh["advance"] - pa["advance"]),
                      "text": "Gdyby urząd uznał stawkę %s%%: zaliczka %s zł, o %s zł więcej niż przy %s%%." % (
                          _pct(float(shadow_rate)), _money(sh["advance"]), _money(sh["advance"] - pa["advance"]),
                          _pct(float(rate_rule.value_num)))}
        return {
            "meta": self._meta(profile, today, ctx, include_test),
            "shadow": shadow,
            "rate_warning": RATE_WARNING,
            "periods": [{"key": ps.isoformat(), "label": period_label(ps, pe),
                         "disabled": (pe < profile.start_date or ps > today) and ps != start} for ps, pe in periods],
            "period": start.isoformat(),
            "title": "%s: rozliczenie krok po kroku (szacunek)" % period_label(start, end),
            "steps": steps,
            "advance": {"amount": num(pa["advance"]), "due_date": pa["due_date"].isoformat(),
                        "due_date_long": date_long(pa["due_date"]), "recorded": num(pa["recorded"]) if pa["recorded"] is not None else None},
            "health": {
                "amount": num(health.amount), "tier_pct": num(health.tier_pct), "avg_wage": num(health.avg_wage),
                "basis": num(health.basis), "month_label": "%s %d" % (MONTHS[last_month.month - 1], last_month.year),
                "tiers": tier_amounts, "limits": [num(x) for x in limits], "threshold": thresholds,
                "why": "9%% × %s%% × W, gdzie W = przeciętne wynagrodzenie z IV kwartału roku poprzedniego "
                       "(%s zł). Próg wybiera przychód narastająco (po odjęciu społecznych): do %s zł, do %s zł, "
                       "powyżej. Nie mniej niż 9%% płacy minimalnej." % (
                           _pct(float(health.tier_pct)), _money(health.avg_wage), _money(limits[0], 0), _money(limits[1], 0)),
            },
            "zus": {
                "variant": variant, "variant_label": ZUS_LABELS[variant], "total": num(social.total),
                "social": num(social.social), "fp": num(social.fp), "base": num(social.base), "lines": zus_lines,
                "window": window, "month_label": "%s %d" % (MONTHS[last_month.month - 1], last_month.year),
                "why": "Wariant ZUS wynika z daty startu działalności (%s) i ustawień profilu: ulga na start, potem "
                       "24 miesiące preferencyjnego ZUS, potem pełny ZUS lub Mały ZUS Plus." % date_long(profile.start_date),
            },
            "rate": {"pct": float(rate_rule.value_num), "confidence": rate_rule.confidence,
                     "unverified": not rate_rule.verified_on, "since": rate_rule.valid_from.isoformat(),
                     "since_long": date_long(rate_rule.valid_from), "note": rate_rule.source_note or "",
                     "alternatives": "Potwierdź z księgowym (8,5% vs 12% vs 15%). Wynik zależy od klasyfikacji PKWiU."},
            "rules_confidence_text": CONF_TEXT[summary["confidence"]],
        }


def _pct(value):
    """8,5 / 12 / 60 (bez zbędnych zer)."""
    text = ("%.2f" % float(value)).rstrip("0").rstrip(".")
    return text.replace(".", ",")
