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
| [`PRISMA-SCHEMA-MIGRATION-DRIFT-001`](PRISMA-SCHEMA-MIGRATION-DRIFT-001.md) | HIGH | `schema.prisma` odjechał od historii migracji — 7 brakujących indeksów + drift NOT NULL/default, jeden pole (`VideoPlaybackSession.maxProgressMs`) ma już nieformalny null-handling w kodzie |
| [`MEDIA-THUMBNAILS-R2-MIGRATION-001`](MEDIA-THUMBNAILS-R2-MIGRATION-001.md) | MEDIUM | Migracja custom miniaturek z Vercel Blob do Cloudflare R2 (koszt/skala, nie correctness blocker) |
| [`VIDEO-PLAYBACK-SESSION-RETENTION-001`](VIDEO-PLAYBACK-SESSION-RETENTION-001.md) | LOW | Retencja/czyszczenie tabeli VideoPlaybackSession (rośnie bez ograniczeń przez preload) |
| [`PRISMA-MIGRATION-TIMESTAMP-DEDUP-001`](PRISMA-MIGRATION-TIMESTAMP-DEDUP-001.md) | LOW | Normalizacja duplikatów timestampów w historii migracji Prisma |
| [`ADMIN-EMAILS-VISUAL-DRIFT-001`](ADMIN-EMAILS-VISUAL-DRIFT-001.md) | LOW | `/admin/emails` ma inny język wizualny niż reszta panelu — decyzja: ujednolicić czy udokumentować jako celowe |
| [`ADMIN-LIST-SCAFFOLD-CONSOLIDATION-001`](ADMIN-LIST-SCAFFOLD-CONSOLIDATION-001.md) | LOW | Wspólny scaffold list/paginacji/filtrowania zamiast 4 niezależnych implementacji w panelu admina |
| [`ADMIN-DESIGN-SYSTEM-CONSISTENCY-001`](ADMIN-DESIGN-SYSTEM-CONSISTENCY-001.md) | LOW | Ujednolicenie stat-tile/nagłówków/zakładek/ikon/pustych-stanów w panelu admina |
| [`COMMENT-LIST-MEMOIZATION-001`](COMMENT-LIST-MEMOIZATION-001.md) | LOW | Brak memoizacji na liście komentarzy — globalny pending flag re-renderuje całą listę |
| [`TEST-COVERAGE-PAYMENTS-GAPS-001`](TEST-COVERAGE-PAYMENTS-GAPS-001.md) | LOW | Priorytety 1-3 zamknięte 2026-09-20; zostały tylko testy dla adapterów Mux/Cloudflare Stream |

## Znane kierunki bez ticketu (do rozpisania przed realizacją)

- Cache/ISR strony głównej i `/watch` dla niezalogowanych (największa
  dźwignia skalowalności — patrz `docs/audit/POST-DEPLOY-AUDIT-2026-07-02.md`).
- Playback plan cache/rate-limit, event batching/collector, analytics
  aggregation (dalsze slice'y hardeningu playbacku).
