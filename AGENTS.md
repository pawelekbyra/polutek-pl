# AGENTS.md

Przewodnik dla agentów AI to [`CLAUDE.md`](CLAUDE.md): przeczytaj go w całości przed zmianą kodu.

- Indeks dokumentacji: [`docs/README.md`](docs/README.md).
- Otwarte prace i decyzje: [`docs/operations/STATUS.md`](docs/operations/STATUS.md).
- Zmiany małe i izolowane; praca na gałęzi, scalanie do `main` lokalnie po zielonym `npm run quality` (bez GitHuba i bez GitHub Actions).
- Dokumenty opisują stan obecny. Historia jest w git; raportów z sesji nie zapisujemy w repo.
- **Logo: powrót do okularków.** Hasło „przywróć okularki” / „okularki wracają” = `BRAND_LOGO_VARIANT = "glasses"` w `lib/ui-flags.ts`, aktualizacja testu w `tests/unit/components/brand-name.test.tsx`, sprawdzenie topbara (47 px telefon, 49 px desktop), wdrożenie; „przywróć nowe logo” = `"wordmark-blue"`. Pełny opis i lista plików: sekcja „Logo: powrót do okularków” w `CLAUDE.md`; kopia zasobów: `public/brand/archive/glasses/`.
