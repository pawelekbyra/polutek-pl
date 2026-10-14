# Etap 8, wdrożenie B: usunięcie `Creator.isPrimary` i `Creator.isApproved`

Status: **przygotowane, NIEURUCHOMIONE.** Wymaga wyraźnej zgody właściciela w czacie (jedna zgoda na jedno działanie, CLAUDE.md §0, §4.0).
Gotowy SQL: [`stage-8-migration-B.sql`](stage-8-migration-B.sql) (celowo poza `prisma/migrations`).

## Warunki wstępne

1. Wdrożenie A (kod) działa na produkcji co najmniej dobę bez błędów: logi kontenera `app` bez błędów `main_channel_id`, strona główna, `/channel/<slug>`, Studio, panel `/kanaly` w porządku.
2. Migracja `20261014090000_main_channel_setting` jest zastosowana, a `SELECT value FROM "AppSetting" WHERE key='main_channel_id'` zwraca id istniejącego, publicznego kanału (`status` ACTIVE/LIMITED, `deletedAt` null).
3. Test dymny bez fallbacków: tymczasowo bez `MAIN_CREATOR_SLUG` w środowisku (zmienna nie jest już potrzebna) strona główna nadal pokazuje kanał główny.
4. Zgoda właściciela.

## Kroki

1. **Kopia zapasowa:** świeży zrzut bazy `pre-deploy-*` (`docs/operations/SERWEREK.md`, lista kontrolna z `db-cleanup-2026-10-05.md` sekcja 5), zweryfikowany.
2. **Kod (jedna zmiana, osobny PR):**
   - w `prisma/schema.prisma` usuń pola `isApproved` i `isPrimary` z `model Creator` (nie ruszaj `VideoAsset.isPrimary`: to inne pole);
   - usuń fallbacki oznaczone komentarzem „usunąć we wdrożeniu B” w `lib/modules/channel/infrastructure/channel.repository.ts` (`MAIN_CREATOR_SLUG` i `findFirst({ isPrimary: true })`);
   - w `prisma/seed.ts` nic więcej do usunięcia (zapisuje już tylko `status` i ustawienie);
   - usuń `MAIN_CREATOR_SLUG` z `.env.example` (komentarz), z `worker.env` na serwerze oraz ze wzmianek w `docs/operations/VIDEO-PIPELINE.md` i `WAKE-UP.md`;
   - w testach `tests/unit/modules/channel/active-channel.test.ts` usuń przypadki fallbacków;
   - zaktualizuj `CLAUDE.md` §4.24, `stage-8-cleanup-plan.md`, `multi-creator-platform.md` (etap 8: zrobiony).
3. **Migracja:** dodaj `prisma/migrations/<znacznik_czasu>_drop_creator_legacy_flags/migration.sql` z treścią `stage-8-migration-B.sql` (pliki bez BOM; po wdrożeniu kodu z kroku 2, bo stary kod czyta te kolumny).
4. **Kolejność wdrożenia:** `deploy.sh` z nowym kodem (bez pól w schemacie) działa na bazie, która jeszcze ma kolumny (Prisma ich nie wybiera), potem migracja usuwa kolumny. Dzięki temu oba stany są kompatybilne.
5. **Weryfikacja** (grep w repo, ma nie zwrócić nic poza schematem `VideoAsset`, historycznymi migracjami i dokumentacją):
   ```bash
   grep -rnE "isApproved|MAIN_CREATOR_SLUG" app apps lib scripts prisma/schema.prisma prisma/seed.ts
   grep -rnE "creator\??\.isPrimary|channel\.isPrimary|isPrimary: true.*creator" app apps lib scripts
   ```
   Oraz: `npm run typecheck`, `npx vitest run`, `npx tsx scripts/check-architecture.ts`, test dymny strony głównej, kanału, Studia i panelu.

## Wycofanie

`deploy.sh --rollback` przywraca tylko KOD; po migracji destrukcyjnej poprzedni obraz czyta usunięte kolumny i się wywróci (CLAUDE.md §4.0). Wycofanie = przywrócenie zrzutu `pre-deploy-*` z kroku 1 razem z poprzednim obrazem. Jeśli migracja jeszcze nie była uruchomiona, wystarczy rollback kodu.

## Czego to wdrożenie NIE robi

Nie zmienia enuma `SystemRole` ani `User.role`; nie usuwa `VideoAsset.isPrimary`; nie dotyka ksiąg sprzedaży.
