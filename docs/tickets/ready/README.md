# Kolejka zadań

Jeden plik `.md` = jedno wykonywalne zadanie. Po wdrożeniu i weryfikacji
ticket **usuwa się z repo** — historią są commity i PR-y.

Format ticketu: tytuł, `Why` (po co), `Scope` (co dokładnie), inwarianty,
które muszą przetrwać, oraz non-goals. Wzór:
[`MEDIA-THUMBNAILS-R2-MIGRATION-001.md`](MEDIA-THUMBNAILS-R2-MIGRATION-001.md).

## Otwarte tickety

| Ticket | Priorytet | Temat |
|---|---|---|
| [`MEDIA-THUMBNAILS-R2-MIGRATION-001`](MEDIA-THUMBNAILS-R2-MIGRATION-001.md) | MEDIUM | Migracja miniaturek z Vercel Blob do Cloudflare R2 (darmowy egress) |

## Znane kierunki bez ticketu (do rozpisania przed realizacją)

- Cache/ISR strony głównej i `/watch` dla niezalogowanych (największa
  dźwignia skalowalności — patrz `docs/audit/POST-DEPLOY-AUDIT-2026-07-02.md`).
- Playback plan cache/rate-limit, event batching/collector, analytics
  aggregation (dalsze slice'y hardeningu playbacku).
