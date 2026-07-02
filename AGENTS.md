# AGENTS.md

Przewodnik dla agentów AI pracujących nad Polutek.pl to **[`CLAUDE.md`](CLAUDE.md)** —
przeczytaj go w całości przed zmianą kodu (stack, mapa modułów, krytyczne
inwarianty, czego nie robić).

Pozostałe zasady:

- Indeks dokumentacji produktu: [`docs/README.md`](docs/README.md).
- Otwarte zadania: [`docs/tickets/ready/`](docs/tickets/ready/) — jeden plik
  na zadanie, usuwany po wdrożeniu.
- Zmiany małe i izolowane; pełne CI musi przejść. Krytyczne inwarianty z
  CLAUDE.md §4 są nienegocjowalne.
- Raporty z sesji AI nie trafiają do repo. Trwałe wnioski wprowadzaj do
  CLAUDE.md, KNOWN_LIMITATIONS.md albo `docs/audit/`.

Historyczny „Post-R AI Delivery Control Plane" (protokoły ról, kolejki
rekonsyliacyjne, statusy certyfikacji) został wycofany 2026-07-02 — nie
odtwarzaj go; historia jest w git.
