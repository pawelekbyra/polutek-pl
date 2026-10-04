# AGENTS.md

Przewodnik dla agentów AI to [`CLAUDE.md`](CLAUDE.md): przeczytaj go w całości przed zmianą kodu.

- Indeks dokumentacji: [`docs/README.md`](docs/README.md).
- Otwarte prace i decyzje: [`docs/operations/STATUS.md`](docs/operations/STATUS.md).
- Zmiany małe i izolowane; merge po zielonym CI najnowszego commita.
- Dokumenty opisują stan obecny. Historia jest w git; raportów z sesji nie zapisujemy w repo.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
