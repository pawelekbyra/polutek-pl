# Kolejka zadań

Jeden plik `.md` = jedno wykonywalne zadanie kodowe. Po wdrożeniu i weryfikacji
ticket **usuwa się z repo** — historią są commity, PR-y i GitHub issues.

Format ticketu: tytuł, `Why` (po co), `Scope` (co dokładnie), inwarianty,
które muszą przetrwać, oraz non-goals. Wzór:
[`MEDIA-THUMBNAILS-R2-MIGRATION-001.md`](MEDIA-THUMBNAILS-R2-MIGRATION-001.md).

## Status kolejki

Ta kolejka nie jest roadmapą produktu ani listą launch evidence. Rzeczy typu
legal/privacy/cookie copy, backup/restore evidence, operator drill, X6/X7 proof
i finalna decyzja launchowa są śledzone w GitHub issue #1269, dopóki nie zostaną
rozbite na małe, wykonywalne tickety kodowe.

## Otwarte tickety

| Ticket | Priorytet | Temat |
|---|---|---|
| [`MEDIA-THUMBNAILS-R2-MIGRATION-001`](MEDIA-THUMBNAILS-R2-MIGRATION-001.md) | MEDIUM | Migracja custom miniaturek z Vercel Blob do Cloudflare R2 (koszt/skala, nie correctness blocker) |

## Znane kierunki bez ticketu (do rozpisania przed realizacją)

- Cache/ISR strony głównej i `/watch` dla niezalogowanych (największa
  dźwignia skalowalności — patrz `docs/audit/POST-DEPLOY-AUDIT-2026-07-02.md`).
- Playback plan cache/rate-limit, event batching/collector, analytics
  aggregation (dalsze slice'y hardeningu playbacku).
