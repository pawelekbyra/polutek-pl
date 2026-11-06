"""Klient API NBP (tabela A kursów średnich). Czyste funkcje, bez ORM: łatwo testować z podstawionym `get`.

Dlaczego własny klient, a nie OCA `currency_rate_update_nbp` (decyzja iteracji 2):
  * OCA czyta tylko `LastA.xml` (dzisiejszą tabelę), bez historii i bez numeru tabeli,
  * zapisuje kurs odwrócony (1 / kurs) w `res.currency.rate` z dokładnością pola Odoo, a dowód podatkowy to kurs NBP
    z numerem tabeli i datą publikacji,
  * semantyka „ostatni dzień roboczy PRZED dniem przychodu” wymaga daty tabeli i wykrywania luk (święta, brak sieci).
OCA zostaje do kursów księgowych w fakturach Odoo; oba mechanizmy są niezależne (zależności modułu bez zmian).

API: https://api.nbp.pl/api/exchangerates/tables/A/{od}/{do}/?format=json (HTTPS, bez klucza, zakres max 93 dni,
HTTP 404 = brak tabel w zakresie, np. same święta).
"""

import datetime as dt
import logging

import requests

_logger = logging.getLogger(__name__)

NBP_URL = "https://api.nbp.pl/api/exchangerates/tables/A/{start}/{end}/?format=json"
MAX_RANGE_DAYS = 93
TIMEOUT = 15


class NbpError(Exception):
    """Błąd sieci lub odpowiedzi NBP (nie mylić z 404, które oznacza 'brak tabel w zakresie')."""


def chunk_ranges(start, end, max_days=MAX_RANGE_DAYS):
    """Dzieli [start, end] na kawałki po najwyżej `max_days` dni (limit API)."""
    result = []
    cursor = start
    while cursor <= end:
        stop = min(end, cursor + dt.timedelta(days=max_days - 1))
        result.append((cursor, stop))
        cursor = stop + dt.timedelta(days=1)
    return result


def parse_tables(payload):
    """Z odpowiedzi API robi listę (numer tabeli, data publikacji, {kod waluty: kurs}). Odrzuca śmieci."""
    if not isinstance(payload, list):
        raise NbpError("Nieoczekiwana odpowiedź NBP (to nie lista tabel).")
    tables = []
    for item in payload:
        try:
            effective = dt.date.fromisoformat(item["effectiveDate"])
            number = str(item["no"])
            rates = {}
            for row in item["rates"]:
                mid = float(row["mid"])
                if mid > 0:
                    rates[str(row["code"]).upper()] = mid
        except (KeyError, TypeError, ValueError) as err:
            raise NbpError("Nieczytelna tabela NBP: %s" % err) from err
        tables.append((number, effective, rates))
    tables.sort(key=lambda t: t[1])
    return tables


def fetch_tables(start, end, get=None, timeout=TIMEOUT):
    """Pobiera tabele A z zakresu [start, end] (max 93 dni). Zwraca [] przy 404 (brak tabel w zakresie).

    `get`: funkcja jak `requests.get` (do testów). Błędy sieci i HTTP inne niż 404 → NbpError.
    """
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise NbpError("Zakres dłuższy niż %d dni (limit API NBP)." % MAX_RANGE_DAYS)
    url = NBP_URL.format(start=start.isoformat(), end=end.isoformat())
    getter = get or requests.get
    try:
        response = getter(url, timeout=timeout, headers={"Accept": "application/json"})
    except requests.RequestException as err:
        raise NbpError("Brak połączenia z api.nbp.pl: %s" % err.__class__.__name__) from err
    status = response.status_code
    if status == 404:
        return []
    if status != 200:
        raise NbpError("api.nbp.pl odpowiedziało kodem HTTP %s." % status)
    try:
        payload = response.json()
    except ValueError as err:
        raise NbpError("api.nbp.pl zwróciło nieprawidłowy JSON.") from err
    return parse_tables(payload)
