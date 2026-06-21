# Polutek.pl

Polutek.pl to aktywny produkt VOD jednego twórcy po zakończonej stabilizacji dużego refaktoru: jedno oficjalne miejsce, jeden katalog wideo, jeden system patronów i dostępu, jedna społeczność, jedna lista mailingowa oraz jeden kokpit admina.

```txt
Polutek.pl is not a platform.
Polutek.pl is a place.
```

## Aktualny status

- Duży etap kodowania, refaktoru i stabilizacji fundamentów jest zakończony.
- Nie ma aktywnego dużego ticketu kodowego ani dużej kolejki refaktoru do ponownego otwierania.
- Dalszy rozwój powinien odbywać się małymi, izolowanymi PR-ami, z jasnym celem i walidacją.
- Public launch, produkcyjne smoke testy, dowody operatora, prawne treści oraz decyzja właściciela pozostają osobną ścieżką operacyjno-właścicielską.

## Gdzie szukać prawdy

| Pytanie | Kanoniczne źródło |
| --- | --- |
| Jaki jest obecny stan projektu? | [`docs/PROJECT-STATE.md`](docs/PROJECT-STATE.md) |
| Jaki jest masterplan, ryzyka i backlog? | [`docs/MASTERPLAN.md`](docs/MASTERPLAN.md) |
| Czy jest aktywny duży ticket kodowy? | [`docs/tickets/ready/README.md`](docs/tickets/ready/README.md) |
| Co zostało zamknięte po dużym refaktorze? | [`docs/reports/reconciliation/POST-1026-FINAL-STABILIZATION-CLOSEOUT.md`](docs/reports/reconciliation/POST-1026-FINAL-STABILIZATION-CLOSEOUT.md) |
| Jakie są zasady pracy agentów? | [`AGENTS.md`](AGENTS.md) |
| Jakie są decyzje właściciela? | [`docs/strategy/OWNER-DECISIONS.md`](docs/strategy/OWNER-DECISIONS.md) |
| Co zostało do launchu/operacji? | [`docs/roadmap/Launch-Execution-Backlog.md`](docs/roadmap/Launch-Execution-Backlog.md) |

## Zasady interpretacji dokumentów

1. Aktualny kod i testy na `main` są prawdą implementacyjną.
2. `README.md`, `docs/PROJECT-STATE.md`, `docs/MASTERPLAN.md` i `docs/tickets/ready/README.md` są obecnym wejściem do projektu.
3. Raporty w `docs/reports/reconciliation/` są evidence z konkretnego momentu. Starsze raporty są historyczne i nie mogą być używane jako obecny opis runtime.
4. Stare tickety w `docs/tickets/ready/**`, jeśli nie są wskazane w `docs/tickets/ready/README.md` jako aktywne, są historyczne.
5. Target architecture, specyfikacje i stare audyty nie oznaczają automatycznie, że dany stan istnieje w aktualnym runtime.

## Stan kolejki

Kanoniczna kolejka gotowych zadań znajduje się w [`docs/tickets/ready/README.md`](docs/tickets/ready/README.md). Obecnie wskazuje brak aktywnego dużego ticketu kodowego.

## Produkcja i operacje

Kod jest po stabilizacji, ale działania produkcyjne nadal wymagają osobnych dowodów operatora. Szczególnie ważne:

- workflow `Production DB Migrations` istnieje, ale wymaga skutecznego uruchomienia w środowisku produkcyjnym GitHub Actions;
- produkcyjne dowody Stripe, Cloudflare, Vercel, backup/restore i X7 Launch Evidence Pack pozostają poza samym kodowaniem;
- prawne treści, polityki i finalna decyzja launchowa pozostają po stronie właściciela.
