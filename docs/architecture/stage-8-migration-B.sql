-- ETAP 8, WDROZENIE B: GOTOWY, NIEURUCHOMIONY. To NIE jest migracja Prisma (nie leży w prisma/migrations).
-- Procedura: docs/architecture/stage-8-deploy-B.md (kopia zapasowa, zgoda właściciela, kolejność kroków).
--
-- Przed uruchomieniem sprawdź (tylko odczyt), że wdrożenie A działa od co najmniej doby:
--   SELECT value FROM "AppSetting" WHERE key = 'main_channel_id';   -- musi zwrócić id istniejącego kanału
--   SELECT id, status FROM "Creator" WHERE id = (SELECT value FROM "AppSetting" WHERE key = 'main_channel_id');
--
-- Na kolumnach "Creator"."isPrimary" i "Creator"."isApproved" nie ma żadnych indeksów, ograniczeń ani kluczy
-- (zweryfikowane w prisma/migrations: 0_init tworzy tylko kolumny, indeksy Creator to slug, stripeConnectId, handle).
-- Dlatego wystarczy samo DROP COLUMN; bez CASCADE, żeby nieprzewidziana zależność przerwała migrację.

ALTER TABLE "Creator" DROP COLUMN "isPrimary", DROP COLUMN "isApproved";
