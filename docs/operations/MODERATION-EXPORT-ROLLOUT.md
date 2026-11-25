# Wdrożenie: moderacja z identyfikatorem decyzji (K24) + eksport danych v5 (K27, U4-U6)

Migracja: `prisma/migrations/20261106190000_moderation_decision_fencing` (po `20261106160000_video_asset_cleanup_reservation`, więc kolejność nazw = kolejność stosowania; brak „out of order”).
Zmienia: `Creator.statusDecisionId TEXT NULL`, `Video.moderationDecisionId TEXT NULL` (bez FK, bez defaultu: zmiana tylko w katalogu, bez przepisywania tabeli, `IF NOT EXISTS`) + jednorazowe, deterministyczne uzupełnienie z `AuditLog`.
Stan produkcji 2026-11-25: 0 `ModerationDecision`, 0 wpisów `AuditLog` o akcjach moderacyjnych/kanałowych, 1 kanał, 5 filmów, więc UPDATE nie zmieni żadnego wiersza.

## Kolejność
1. Próba na kopii bazy (niżej). Bez niej nie wdrażać.
2. Przed oknem: brak długich transakcji na "Creator"/"Video" (ALTER czeka na nie w kolejce i blokuje innych):
   `SELECT pid, now()-xact_start AS t, state, left(query,60) FROM pg_stat_activity WHERE xact_start IS NOT NULL ORDER BY t DESC LIMIT 5;`
3. Kopia: `/opt/serwerek/scripts/backup.sh`, potem zwykłe `deploy.sh` (migrate deploy przed startem nowej aplikacji).
4. Kontrola po wdrożeniu (tylko odczyt):
   - `SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY migration_name DESC LIMIT 2;`
   - `SELECT table_name, column_name FROM information_schema.columns WHERE (table_name, column_name) IN (('Creator','statusDecisionId'), ('Video','moderationDecisionId'));` (2 wiersze)
   - `SELECT count(*) FROM "Creator" WHERE "statusDecisionId" IS NOT NULL;` i `SELECT count(*) FROM "Video" WHERE "moderationDecisionId" IS NOT NULL;` (oczekiwane 0)
   - eksport: zalogowany użytkownik, `/api/user/export`: `schemaVersion: 5`, nagłówki `X-Export-Truncated: none`, `X-Export-Skipped-Records: 0`.

## Zmiany zachowania
- Uwzględnione odwołanie cofa decyzję tylko, gdy na kanale/filmie wisi dokładnie ta decyzja (`statusDecisionId`/`moderationDecisionId`); stare odwołanie nie cofnie nowszej decyzji (także przy powrocie do tego samego statusu).
- Starsze decyzje, których backfill nie dopasuje, admin cofa ręcznie (na produkcji takich nie ma).
- Zdjęcie filmu ze zgłoszenia, gdy film już nie istnieje: 404 `VIDEO_NOT_FOUND` zamiast mylącego 409 (U6).
- Eksport (schema 5): kategorie „dziennikowe” (`videoViews`, `playbackSessions`, `playbackEvents`, `notifications`, `emailEvents`, `broadcastEmailRecipients`) maks. 10 000 najnowszych wierszy każda; obcięte są wymienione w `truncatedCategories` i w nagłówku `X-Export-Truncated` (U4). Nieeksportowalny zapisany obraz jest pomijany z wpisem w `skippedRecords` (typ, id właściciela, powód), reszta eksportu działa (U5).

## Cofnięcie
- Kod: poprzedni obraz przez `deploy.sh <stary tag>`. Stary kod ignoruje nowe kolumny, więc można je zostawić (zalecane).
- Pełne cofnięcie schematu (tylko gdy konieczne, po cofnięciu kodu, w jednej transakcji):
  ```sql
  BEGIN;
  ALTER TABLE "Creator" DROP COLUMN IF EXISTS "statusDecisionId";
  ALTER TABLE "Video" DROP COLUMN IF EXISTS "moderationDecisionId";
  DELETE FROM _prisma_migrations WHERE migration_name = '20261106190000_moderation_decision_fencing';
  COMMIT;
  ```
  Po DROP znikają powiązania decyzja-zasób zapisane po wdrożeniu: odwołania od tych decyzji trzeba rozpatrywać ręcznie.

## Próba na kopii bazy (wzór: /opt/claude/migration-rehearsal-2026-11-24.md)
- Najnowsza kopia z `/opt/serwerek/backups` do osobnego kontenera `postgres:17-alpine` (127.0.0.1, tmpfs, limit 1 CPU / 1 GB, losowe hasło w pliku chmod 600), import `gunzip -c | psql`.
- Zastosować `migration.sql` w transakcji z `\timing` i podglądem `pg_locks`; spisać liczności przed i po.
- Testy w transakcji z ROLLBACK: (1) ponowne uruchomienie migracji = bez błędu i bez zmian (idempotencja); (2) syntetyczny `AuditLog` `CHANNEL_STATUS_CHANGED` z `decisionId` i `after.status` = bieżący status: backfill ustawia `statusDecisionId`; (3) nowszy `CHANNEL_RESTORED`: NULL; (4) film: `VIDEO_MODERATION_CHANGED`, potem `MODERATION_APPEAL_RESOLVED` z `reverted=true`: NULL.
- Cofnięcie (SQL wyżej), sprawdzenie `\d "Creator"` i `\d "Video"`, ponowne zastosowanie. Sprzątanie: kontener, sieć, pliki, hasło. Raport bez danych osobowych.

## Czego nie sprawdzi CI
Zachowania na danych produkcyjnych (backfill, blokady), nagłówków przez Cloudflare Tunnel, pamięci przy eksporcie konta z ponad 10 000 zdarzeń (sonda K37 z gałęzi audytu nie jest przeniesiona).
