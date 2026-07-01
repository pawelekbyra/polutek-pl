# Polutek.pl — stan projektu

Status: **STABILIZACJA ZAKOŃCZONA — AKTYWNY PRODUKT**

Duży refaktor i stabilizacja fundamentów produktu są zakończone. Polutek.pl jest utrzymywany jako aktywny produkt VOD twórcy, a dalsze zmiany powinny być prowadzone w małych, izolowanych ticketach zgodnych z `AGENTS.md`.

## Co to oznacza

- Nie ma aktywnego dużego ticketu kodowego do ponownego otwierania.
- Jest aktywna kolejka **product/tech work** w `docs/tickets/ready/README.md`; ona ma pierwszeństwo przed historycznymi raportami i starą roadmapą refaktoryzacji.
- Dawna `docs/REFACTORING-ROADMAP.md` pozostaje ważną techniczną bazą długu i standardów, ale nie opisuje sama całej aktualnej roadmapy produktu.
- Public launch, operacje produkcyjne, dowody operatora i przegląd prawny pozostają decyzjami oraz ścieżkami właściciela.
- Bieżący kod i testy są implementation truth; aktualne issue i dokumenty roadmapy są product/specification truth.
- Historyczne raporty reconciliacji pozostają zachowane w `docs/reports/reconciliation/`.

## Stan kodu — 2026-07-01

Cała roadmapa techniczna z refaktoru jest zamknięta. `lib/services/` zredukowany do jednego pliku — deprecated bridge `payment.service.ts` (świadomie zachowany dla test coverage). Nowy moduł `lib/modules/playback/` przejął logikę odtwarzania. Kod jest w dobrym stanie i gotowy do testowania produkcyjnego.

## Aktualne kierunki produktu

- Pełny multi-source video system: admin create/edit, provider switch i playback end-to-end — kanonicznie #1204.
- Strategiczne provider work: Cloudflare Stream jako obecny core, YouTube dla public/non-private embed, Mux jako następny ważny full VOD provider, dalej R2 i Vimeo.
- Admin media UX: miniatury, private Blob, globalna domyślna miniatura i opcjonalne napisy PL/EN.
- Strefa Fenju / Thank You Zone: komunikowana jako bonus w podziękowaniu za wsparcie, nie jako zakup płatnej treści.
- Dług techniczny z refactoring roadmapy nadal obowiązuje, ale powinien być realizowany w małych slice’ach i nie wypierać decyzji właściciela.

## Linki

- Masterplan: `docs/MASTERPLAN.md`
- Kanoniczna kolejka ready: `docs/tickets/ready/README.md`
- Backlog launch/operacji: `docs/roadmap/Launch-Execution-Backlog.md`
- Refactoring debt baseline: `docs/REFACTORING-ROADMAP.md`
- Indeks raportów: `docs/reports/reconciliation/README.md`
