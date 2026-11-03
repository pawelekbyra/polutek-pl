"""Silnik obliczeń JDG na ryczałcie: CZYSTA logika, bez ORM i bez dostępu do bazy.

Wszystkie wzory podatkowe żyją TUTAJ (jedno miejsce), a wszystkie liczby (stawki, progi,
podstawy ZUS) przychodzą z tabeli reguł `jdg.tax.rule` jako argumenty funkcji. Dzięki temu:
  * testy jednostkowe nie potrzebują bazy (patrz tests/test_engine.py),
  * kod można czytać i zmieniać bez znajomości Odoo,
  * zmiana stawki lub progu to zmiana danych, nie kodu.

Kwoty liczymy na `decimal.Decimal`, zaokrąglanie zawsze HALF_UP (jak w przepisach PIT).

Wszystko to SZACUNEK, NIE PORADA PODATKOWA. Wzory pochodzą z PRAWO.md / SPEC.md (pewność [PR]);
sporne miejsca są oznaczone [N] i kontrolowane parametrami (np. tryb progu zdrowotnej).
"""

import calendar
import datetime as dt
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal

D = Decimal
ZERO = D(0)

# Warianty ZUS (patrz SPEC 4.4)
ZUS_NONE = "none"  # przed startem działalności: brak obowiązku
ZUS_ULGA = "ulga_na_start"
ZUS_PREF = "preferential"
ZUS_FULL = "full"
ZUS_MZP = "mzp"  # Mały ZUS Plus: w iteracji 1 liczony jak pełny (patrz README, pytanie P-Z10)

HEALTH_MODES = ("crossing_month", "next_month", "annual_true_up")


def dec(value):
    """Bezpieczna zamiana na Decimal (float przechodzi przez str, żeby nie ciągnąć błędu binarnego)."""
    if isinstance(value, Decimal):
        return value
    if value is None or value is False:
        return ZERO
    return D(str(value))


def jdg_round(value, places=2):
    """Zaokrąglenie HALF_UP do `places` miejsc (domyślnie grosze)."""
    return dec(value).quantize(D(1).scaleb(-places), rounding=ROUND_HALF_UP)


def jdg_round_zl(value):
    """Zaokrąglenie do pełnych złotych, HALF_UP (>= 0,50 w górę): reguła dla podstawy i podatku [PR]."""
    return dec(value).quantize(D(1), rounding=ROUND_HALF_UP)


# ---------------------------------------------------------------------------------------------
# Daty i kalendarz
# ---------------------------------------------------------------------------------------------

def month_start(d):
    return d.replace(day=1)


def month_end(d):
    return d.replace(day=calendar.monthrange(d.year, d.month)[1])


def add_months(d, months):
    """Przesuwa datę o `months` miesięcy; dzień obcinany do długości miesiąca (31.01 + 1 = 28.02)."""
    index = d.year * 12 + (d.month - 1) + months
    year, month = divmod(index, 12)
    month += 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return dt.date(year, month, day)


def easter_sunday(year):
    """Niedziela Wielkanocna (algorytm Meeusa/Jonesa/Butchera, kalendarz gregoriański)."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return dt.date(year, month, day + 1)


def holidays(year, fixed_md=()):
    """Dni ustawowo wolne w danym roku: stałe (lista 'MM-DD' z reguły holidays.PL) + ruchome."""
    result = set()
    for md in fixed_md:
        month, day = (int(x) for x in md.split("-"))
        result.add(dt.date(year, month, day))
    easter = easter_sunday(year)
    result.add(easter)  # niedziela (informacyjnie)
    result.add(easter + dt.timedelta(days=1))  # poniedziałek wielkanocny
    result.add(easter + dt.timedelta(days=49))  # Zielone Świątki (niedziela)
    result.add(easter + dt.timedelta(days=60))  # Boże Ciało
    return result


def is_business_day(d, fixed_md=()):
    """Dzień roboczy: nie sobota, nie niedziela, nie święto. Sobota jak dzień wolny [PR] (Ordynacja podatkowa art. 12)."""
    return d.weekday() < 5 and d not in holidays(d.year, fixed_md)


def next_business_day(d, fixed_md=()):
    """Jeśli termin wypada w dzień wolny, przesuwa go na najbliższy dzień roboczy."""
    while not is_business_day(d, fixed_md):
        d += dt.timedelta(days=1)
    return d


def quarter_bounds(d):
    first_month = 3 * ((d.month - 1) // 3) + 1
    start = dt.date(d.year, first_month, 1)
    return start, month_end(dt.date(d.year, first_month + 2, 1))


def period_bounds(d, rhythm):
    """Początek i koniec okresu zaliczki (miesiąc albo kwartał) zawierającego datę d."""
    if rhythm == "monthly":
        return month_start(d), month_end(d)
    return quarter_bounds(d)


def year_periods(year, rhythm):
    """Lista okresów zaliczek w roku: [(początek, koniec), ...]."""
    step = 1 if rhythm == "monthly" else 3
    periods = []
    for first_month in range(1, 13, step):
        start = dt.date(year, first_month, 1)
        periods.append((start, month_end(dt.date(year, first_month + step - 1, 1))))
    return periods


def advance_due_date(period_end, day=20, fixed_md=()):
    """Termin zaliczki za okres: `day`. następnego miesiąca po końcu okresu, przesunięty na dzień roboczy.
    Miesięcznie: 20. po miesiącu; kwartalnie: 20.04, 20.07, 20.10, 20.01 [PR]."""
    nxt = add_months(period_end.replace(day=1), 1).replace(day=day)
    return next_business_day(nxt, fixed_md)


# ---------------------------------------------------------------------------------------------
# ZUS (składki społeczne)
# ---------------------------------------------------------------------------------------------

def zus_variant_on(on_date, start_date, uses_ulga, ulga_months=6, pref_months=24, after_variant=ZUS_FULL):
    """Wariant ZUS obowiązujący w danym dniu (SPEC 4.4 i T15).

    start_date..+ulga_months: ulga na start (0 składek społecznych), potem pref_months preferencyjnego ZUS,
    potem pełny ZUS albo Mały ZUS Plus. Bez ulgi preferencyjny ZUS liczy się od startu. Przed startem: brak.
    """
    if on_date < start_date:
        return ZUS_NONE
    pref_from = start_date
    if uses_ulga:
        pref_from = add_months(start_date, ulga_months)
        if on_date < pref_from:
            return ZUS_ULGA
    if on_date < add_months(pref_from, pref_months):
        return ZUS_PREF
    return after_variant


@dataclass(frozen=True)
class SocialResult:
    """Składki społeczne za jeden miesiąc."""

    variant: str
    base: Decimal = ZERO
    pension: Decimal = ZERO  # emerytalna
    disability: Decimal = ZERO  # rentowa
    accident: Decimal = ZERO  # wypadkowa
    sickness: Decimal = ZERO  # chorobowa (dobrowolna)
    fp: Decimal = ZERO  # Fundusz Pracy (poza kwotą "społeczne", osobny przelew/pozycja)

    @property
    def social(self):
        """Suma składek społecznych (emerytalna + rentowa + wypadkowa + chorobowa), bez Funduszu Pracy."""
        return self.pension + self.disability + self.accident + self.sickness

    @property
    def total(self):
        return self.social + self.fp


def social_due(variant, base, rates, sickness=True, min_wage=ZERO):
    """Składki społeczne w miesiącu dla wariantu ZUS.

    rates: słownik procentów {pension, disability, accident, sickness, fp} (np. 19.52).
    base: podstawa wymiaru (dla ulgi i braku obowiązku ignorowana).
    Fundusz Pracy tylko dla pełnego ZUS / MZP, gdy podstawa >= płaca minimalna (SPEC 4.4) [PR].
    """
    if variant in (ZUS_NONE, ZUS_ULGA):
        return SocialResult(variant=variant)
    base = dec(base)

    def part(key):
        return jdg_round(base * dec(rates[key]) / 100)

    fp = ZERO
    if variant in (ZUS_FULL, ZUS_MZP) and base >= dec(min_wage):
        fp = part("fp")
    return SocialResult(
        variant=variant,
        base=base,
        pension=part("pension"),
        disability=part("disability"),
        accident=part("accident"),
        sickness=part("sickness") if sickness else ZERO,
        fp=fp,
    )


# ---------------------------------------------------------------------------------------------
# Składka zdrowotna ryczałtowca
# ---------------------------------------------------------------------------------------------

def health_tier(basis, limits=(D(60000), D(300000)), tiers=(D(60), D(100), D(180))):
    """Próg składki zdrowotnej wg przychodu narastająco (pomniejszonego o społeczne): 60/100/180 % W.
    'Do 60 000 zł' włącznie: dokładnie 60 000,00 to jeszcze pierwszy próg (T08), 60 000,01 to drugi (T09)."""
    basis = max(ZERO, dec(basis))
    if basis <= dec(limits[0]):
        return dec(tiers[0])
    if basis <= dec(limits[1]):
        return dec(tiers[1])
    return dec(tiers[2])


@dataclass(frozen=True)
class HealthResult:
    amount: Decimal  # należna składka za miesiąc
    tier_pct: Decimal  # 60 / 100 / 180
    basis: Decimal  # przychód narastająco użyty do wyboru progu
    avg_wage: Decimal  # W (przeciętne wynagrodzenie z IV kw. roku poprzedniego)
    by_tier: Decimal  # kwota wynikająca z progu
    minimum: Decimal  # dolna granica (9% płacy minimalnej)


def health_due(basis, avg_wage, min_wage, rate_pct=D(9), limits=(D(60000), D(300000)),
               tiers=(D(60), D(100), D(180)), min_pct_of_min_wage=D(9)):
    """Składka zdrowotna za miesiąc: max(9% x płaca min., 9% x próg% x W), HALF_UP do grosza (SPEC 4.3).
    Kontrola 2026 (W = 9 228,64): 498,35 / 830,58 / 1 495,04 [P]."""
    tier = health_tier(basis, limits, tiers)
    by_tier = dec(rate_pct) / 100 * tier / 100 * dec(avg_wage)
    minimum = dec(min_pct_of_min_wage) / 100 * dec(min_wage)
    return HealthResult(
        amount=jdg_round(max(minimum, by_tier)),
        tier_pct=tier,
        basis=max(ZERO, dec(basis)),
        avg_wage=dec(avg_wage),
        by_tier=jdg_round(by_tier),
        minimum=jdg_round(minimum),
    )


# ---------------------------------------------------------------------------------------------
# Podatek (ryczałt)
# ---------------------------------------------------------------------------------------------

@dataclass(frozen=True)
class TaxResult:
    """Podatek narastająco od 1 stycznia (SPEC 4.5)."""

    revenue: Decimal
    social_paid: Decimal
    health_paid: Decimal
    health_deduction: Decimal  # 50% zapłaconej zdrowotnej
    base_raw: Decimal
    base: Decimal  # zaokrąglona do pełnych zł
    tax: Decimal  # podatek narastająco (pełne zł)
    by_rate: tuple = field(default_factory=tuple)  # ((stawka %, podstawa, podatek), ...)


def ryczalt_cumulative(revenue_by_rate, social_paid=ZERO, health_paid=ZERO, health_deduct_pct=D(50)):
    """Ryczałt narastająco: podstawa = przychód - 100% zapłaconych społecznych - 50% zapłaconej zdrowotnej,
    do pełnych zł; podatek = stawka x podstawa, do pełnych zł. Przy wielu stawkach odliczenia rozkładane
    proporcjonalnie do przychodu każdej stawki [PR].

    revenue_by_rate: {stawka_proc: przychód_PLN_narastająco}. Zwroty zmniejszają przychód (mogą zejść poniżej 0).
    """
    revenue = sum((dec(v) for v in revenue_by_rate.values()), ZERO)
    social_paid, health_paid = dec(social_paid), dec(health_paid)
    health_deduction = jdg_round(health_paid * dec(health_deduct_pct) / 100)
    base_raw = max(ZERO, revenue - social_paid - health_deduction)
    base = jdg_round_zl(base_raw)
    positive = {dec(r): max(ZERO, dec(v)) for r, v in revenue_by_rate.items()}
    total_pos = sum(positive.values(), ZERO)
    if base == 0 or total_pos == 0:
        return TaxResult(revenue, social_paid, health_paid, health_deduction, base_raw, ZERO, ZERO)
    lines = []
    allocated = ZERO
    rates = sorted(positive)
    for idx, rate in enumerate(rates):
        if idx == len(rates) - 1:
            base_i = base - allocated  # ostatnia stawka bierze resztę, suma podstaw = podstawa
        else:
            base_i = jdg_round_zl(base * positive[rate] / total_pos)
            allocated += base_i
        lines.append((rate, base_i, jdg_round_zl(rate / 100 * base_i)))
    tax = sum((line[2] for line in lines), ZERO)
    return TaxResult(revenue, social_paid, health_paid, health_deduction, base_raw, base, tax, tuple(lines))


def advance_for_period(tax_cum, previous_advances=ZERO):
    """Zaliczka za okres = podatek narastająco - zaliczki za wcześniejsze okresy; nigdy ujemna (po zwrotach 0)."""
    return max(ZERO, dec(tax_cum) - dec(previous_advances))


# ---------------------------------------------------------------------------------------------
# Wolne środki i progi
# ---------------------------------------------------------------------------------------------

def free_funds(revenue, advance, health, social, fp=ZERO, fees=ZERO, reserve_pct=ZERO):
    """Wolne środki w miesiącu (SPEC 4.6): przychód - zaliczka - zdrowotna - społeczne [- FP]
    - opłaty Stripe (informacyjnie, nie obniżają podatku) - rezerwa na zwroty. Mogą być ujemne."""
    reserve = jdg_round(max(ZERO, dec(revenue)) * dec(reserve_pct) / 100)
    return jdg_round(dec(revenue) - dec(fees) - dec(advance) - dec(health) - dec(social) - dec(fp) - reserve), reserve


def threshold_level(value, limit):
    """Poziom paska progu: ok (<70%), warn (70-90%), high (90-100%), over (> limit). Kolor nigdy nie jest jedynym nośnikiem."""
    value, limit = dec(value), dec(limit)
    if limit <= 0:
        return 0.0, "ok"
    pct = float(value / limit * 100)
    if value > limit:
        return pct, "over"
    if pct >= 90:
        return pct, "high"
    if pct >= 70:
        return pct, "warn"
    return pct, "ok"


# ---------------------------------------------------------------------------------------------
# Faktury: NIP i podział brutto na netto + VAT
# ---------------------------------------------------------------------------------------------

def nip_normalize(value):
    """NIP bez prefiksu PL, spacji i myślników (same cyfry). Pusty tekst zostaje pusty."""
    text = (value or "").strip().upper().replace(" ", "").replace("-", "")
    if text.startswith("PL"):
        text = text[2:]
    return text


def nip_is_valid(value):
    """Polski NIP: 10 cyfr, suma kontrolna wagami 6,5,7,2,3,4,5,6,7 modulo 11 (reszta 10 = błędny)."""
    digits = nip_normalize(value)
    if len(digits) != 10 or not digits.isdigit():
        return False
    check = sum(int(d) * w for d, w in zip(digits, (6, 5, 7, 2, 3, 4, 5, 6, 7))) % 11
    return check != 10 and check == int(digits[9])


def split_gross(gross, vat_rate_pct=ZERO):
    """Brutto -> (netto, VAT). Stawka 0 (zwolnienie): netto = brutto, VAT = 0. VAT zaokrąglony do grosza, netto = brutto - VAT."""
    gross = jdg_round(gross)
    rate = dec(vat_rate_pct)
    if rate <= 0:
        return gross, ZERO
    vat = jdg_round(gross * rate / (100 + rate))
    return gross - vat, vat
