# Baza danych i migracje

Stan 2026-10-05. Postgres 17 na serwerku (kontener `polutek-db-1`), schemat w `prisma/schema.prisma`, migracje w `prisma/migrations/`.

- **Migracje są wyłącznie addytywne i nigdy nie edytuje się istniejących.** Zawsze dodaj nowy plik. Migracja czyszcząca (usuwająca martwe tabele, kolumny, wartości enum) jest dozwolona po backupie i za zgodą właściciela,
  gdy kod już ich nie używa; lokalne CI wymaga w jej SQL komentarza `-- local-ci: allow-destructive <powód>` (bramka `migrations`, `docs/operations/LOCAL-CI.md`).
- Pliki migracji **bez BOM** (UTF-8), nazwa `<14 cyfr>_<snake_case>`, znacznik późniejszy niż ostatnia migracja. (2026-09-30 migracja z BOM zostawiła nieudany wiersz w `_prisma_migrations` i zablokowała kolejne wdrożenia.)
  `scripts/resolve-failed-migrations.ts` (`npm run db:migrate:repair`) naprawia tylko nazwy z listy `ROLLBACK_SAFE_FAILED_MIGRATIONS`.
- Zgodność schematu z historią migracji: odtworzenie od zera (`prisma migrate deploy` + `prisma migrate diff`) musi dawać zerową różnicę względem `schema.prisma` (uzgodnione 2026-09-26; zduplikowane znaczniki czasu starych migracji zostają, bo zmiana nazwy zastosowanej migracji zepsułaby `_prisma_migrations`).
- Migracje przy wdrożeniu uruchamia `deploy.sh` (kontener `migrator`, po zrzucie `pg_dump`); rollback obrazu nie cofa schematu.
- Schemat `telemetry` (role `pp_collector`, `pp_analytics_ro`) tworzy surowa migracja SQL, nie `schema.prisma`: `admin-telemetry.md`.
- Martwe i legacy elementy do usunięcia migracją czyszczącą (lista: `../audit/2026-10-03/audit-database.md`, `STATUS.md`): tabele dostawców wideo (`VideoDistributionPlan/Target`, `VideoProviderJob`, `VideoProviderWebhookEvent`),
  `ClerkEvent`, wartości `StorageProvider` inne niż `SELF_HLS`, `AccessTier.PATRON`, `Creator.bannerUrl`, `patronThresholdMinor`/`patronBoxMinMinor`, `Video.videoUrl`. Nie zapisuj do nich.
