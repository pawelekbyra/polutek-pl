# Czyszczenie martwego schematu bazy (2026-10-05)

Migracja `prisma/migrations/20261005210000_cleanup_dead_schema/migration.sql`, gałąź `chore/db-cleanup-dead-schema`.
Podstawa: `docs/audit/2026-10-03/audit-database.md` (znaleziska DB-09, DB-10, DB-17 i część DB-02/DB-27 zniknęły z audytu, bo są naprawione) oraz decyzja właściciela: martwe tabele, kolumny i wartości enumów wolno usuwać migracją po backupie, kod przestaje ich używać, usunięcie w tym samym lub kolejnym wdrożeniu.

**Migracja jest destrukcyjna.** Jedyna droga powrotu to przywrócenie zrzutu sprzed wdrożenia. Przeczytaj „Lista kontrolna przed wdrożeniem”.

## 1. Co zostaje usunięte

Wszystkie obiekty zweryfikowałem ponownie na aktualnym kodzie (nie na audycie z 2026-10-03): grep po `app/`, `lib/`, `apps/`, `scripts/`, `workers/`, `services/`, `prisma/seed.ts`, `tests/`, `deploy/` (w tym `deploy/serwerek/admin/pp-admin-role.sql`) i po wszystkich `$queryRaw`/`$executeRaw` (żaden nie dotyka usuwanych obiektów; raw SQL używa tylko `VideoEncodeJob`, `PatronGrant`, `UserPaymentTotal`, `BroadcastEmail`, `User`). Tam, gdzie kod jeszcze coś robił, ta zmiana go usunęła (kolumna „Kod”).

| Obiekt | Dowód martwości | Kod |
|---|---|---|
| Tabele `VideoDistributionPlan`, `VideoDistributionTarget`, `VideoProviderJob`, `VideoProviderWebhookEvent` (+ 8 enumów: `VideoDistributionMode`, `VideoPlaybackSelectionPolicy`, `VideoAutopublishPolicy`, `VideoDistributionTargetStatus`, `VideoDistributionTargetRole`, `VideoProviderJobType`, `VideoProviderJobStatus`, `VideoProviderWebhookStatus`) | 0 trafień delegatów i nazw; dostawcy wideo usunięci 2026-10-02; skrypt `scripts/hls/delete-legacy-provider-rows.sql` już nie istnieje | brak zmian |
| Tabela `ClerkEvent` | 0 trafień; zawierała payloady webhooków Clerka (dane osobowe); Clerk usunięty 2026-10-02 | brak zmian |
| Tabele `CommentLike`, `CommentDislike` | 0 trafień delegatów (trafienia `commentLike` w kodzie to klucz szablonu powiadomień, nie tabela); zastąpione przez `CommentReaction` | brak zmian |
| `User.totalPaidMinor` (`legacyTotalPaidMinor_DoNotUse`), `User.canCreateChannel` | 0 trafień (`totalPaidMinor` w `list-admin-users` to pole DTO liczone z `Payment`) | brak |
| `Creator.bannerUrl` | okładka usunięta z kodu 2026-10-04; test `admin-channel.test.ts` pilnuje, że nic jej nie zapisuje (zostawiony bez zmian, nadal prawdziwy) | brak |
| `Creator.stripeConnectId` | 0 trafień | brak |
| `Comment.score`, `Comment.pinnedById` | `score` 0 trafień; `pinnedById` tylko zapisywane przy przypinaniu, nigdy czytane | `CommentRepository.pin()` nie przyjmuje już `pinnedById` |
| `Video.videoUrl`, `Video.publishAfterAssetReadyProvider` | nie czytane od przejścia na własny HLS; pole providera tylko przepisywane | usunięte z DTO admina, payloadu, repozytorium, seeda |
| `VideoOriginal.storageProvider`, `VideoOriginal.checksumSha256` | 0 trafień (tylko fixture testu) | brak |
| `VideoAsset`: `distributionTargetId`, `providerAssetId`, `providerPlaybackId`, `externalVideoId`, `externalUrl`, `muxUploadId`, `pendingPrimaryIntent`, `providerSyncedAt`, `processingStartedAt`, `fallbackPriority`, `mirrorSourceOriginalId`, `mirrorRequestedAt`, `mirrorCompletedAt`, `mirrorFailureReason` (14) | czytane tylko przy mapowaniu do DTO, którego żaden ekran nie używa (`apps/admin`, `app/`: 0 odczytów); zawsze `null`/domyślne dla własnego HLS | usunięte z `video.dto.ts`, `playback.dto.ts`, `playback.service.ts`, `video.policy.ts`, `finalize-self-hls.ts`, `activate-self-hls.sql`; z publicznego kontraktu planu odtwarzania zniknęły jawne `providerAssetId: null` i `providerPlaybackId: null` |
| `VideoPlaybackRoute.planId` | zawsze `null` | `activateRoute()` bez `planId` |
| `VideoPlaybackSession.endedAt` | 0 trafień | brak |
| `EmailPreference.resendContactId` | 0 trafień | brak |
| `BroadcastEmail.templateId` (+ relacja `EmailTemplate.broadcasts`) | 0 trafień | brak |
| `PaymentCurrencySetting.patronThresholdMinor`, `patronBoxMinMinor` | próg nieużywany od 2026-10-03; `patronBoxMinMinor` wpływał na minimalną kwotę, więc migracja najpierw **przenosi** jego wartość do `minAmountMinor` (`GREATEST`), a dopiero potem usuwa kolumnę: minimum widoczne dla użytkowników się nie zmienia | `effectiveMinMinor()` i `upsertCurrencyMinimum()` upraszczone |
| `AccessTier.PATRON` | od 20261004230000 żaden film go nie ma; `VideoPlaybackSession.accessTier` zachowuje historię, wiersze `PATRON` stają się `LOGGED_IN` (oba zachowywały się tak samo) | komentarze i typ w `access-explanation.ts`; `lib/access-tier.ts` pozostaje fail-closed i mapuje przestarzałe `PATRON` z klienta na `LOGGED_IN` |

Razem: 7 tabel, 8 typów enum, 30 kolumn, 1 wartość enuma (`PATRON`).

Zmiany addytywne w tej samej migracji: `VideoAsset.sizeBytes` `INTEGER` na `BIGINT` (HLS powyżej 2 GiB był zapisywany jako `NULL`; zapis w `finalize-self-hls.ts` jest teraz `BigInt`, a każdy czytelnik JSON konwertuje przez `assetSizeToNumber()` w `lib/modules/video/domain/asset-size.ts`: `JSON.stringify` rzuca na `bigint`; czytelnicy to `playback.service.ts`, `encode-queue.use-cases.ts`, `video.dto.ts`) oraz indeksy `Comment(authorId)`, `VideoPlaybackSession(countedAsView, startedAt)`, `Payment(status, createdAt)`. Indeks `BroadcastEmailRecipient(resendEmailId)` już istniał.

## 2. Co celowo zostaje

- Powiadomienia (`Notification`, `NotificationPreference`, `NotificationTemplate`, enum `NotificationKind`): decyzja właściciela „na później”.
- `UserPaymentTotal`, `PatronGrant` (ewidencja właściciela), `Subscription`, `InboundEmail`: żywy kod; ich zmiana to przepisywanie funkcji, nie czyszczenie.
- `BroadcastEmail.scheduledAt`: nigdy nie zapisywane, ale **czyta je nowy panel** (`admin-overview/infrastructure/overview.repository.ts`), więc zostaje (audyt uznawał ją za martwą).
- Wartości `StorageProvider` poza `SELF_HLS` i `PatronGrantSource.PAYMENT/REFERRAL/LEGACY`: usunięcie wymaga wiedzy o danych produkcyjnych (stare wiersze `VideoAsset`/`VideoPlaybackRoute` z dostawcami `MUX`/`YOUTUBE`... mogą istnieć). Zapytania kontrolne w sekcji 5, wzorzec migracji (`CREATE TYPE ..._new`, `USING col::text::...`) jak dla `AccessTier`.
- `User.username`, `Comment.imageUrl`, `VideoStatus.UNLISTED`, `VideoAsset.isPrimary`, `VideoPlaybackRoute.provider`, `VideoAssetProcessingState`: żywe lub wymagają decyzji.
- Nadmiarowe indeksy (DB-16) i nowe ograniczenia/indeksy unikalne (DB-03, DB-04, DB-11, DB-18, DB-19, DB-20): mogą się wysypać na danych produkcyjnych, osobne zadanie po zapytaniach kontrolnych.

## 3. Jak migracja jest zbudowana

- Jeden plik, jedna niejawna transakcja Prisma (cały plik idzie jednym zapytaniem; błąd = rollback wszystkiego; tak jak wszystkie migracje repo, bez `BEGIN/COMMIT`).
- Idempotentna: `DROP ... IF EXISTS`, `CREATE INDEX IF NOT EXISTS`, krok z danymi i wymiana enuma pod strażnikami `DO $$` (sprawdzają, czy kolumna/wartość jeszcze istnieje).
- Kolejność: przeniesienie `patronBoxMinMinor`, kolumny z kluczami obcymi, tabele (dzieci przed rodzicami, **bez `CASCADE`**, żeby nieprzewidziana zależność przerwała migrację, a nie cicho coś skasowała), typy enum, kolumny, `sizeBytes`, wymiana `AccessTier` (`Video.tier` dostaje z powrotem `DEFAULT 'PUBLIC'`), indeksy.
- Składnia (`DROP ... IF EXISTS`, `DO $$`, `ALTER COLUMN ... TYPE ... USING`, `CREATE INDEX IF NOT EXISTS`, `ALTER TYPE ... RENAME`) jest taka sama w PostgreSQL 16 i 17.

## 4. Test migracji na danych

Test automatyczny: `tests/postgres/db-cleanup-migration.pg.test.ts` (dane: `tests/postgres/fixtures/pre-cleanup-seed.sql`). Tworzy własną bazę (`CREATE DATABASE`; bez uprawnienia test się pomija z komunikatem), stosuje wszystkie migracje poza czyszczącą, wstawia wiersze do każdej usuwanej tabeli i kolumny oraz żywe wiersze obok (użytkownicy, filmy z tierami `PUBLIC`/`LOGGED_IN`/`PATRON`, zasoby `SELF_HLS` i `MUX`, plan/cel/zadanie/webhook dostawcy, komentarze ze `score`/`pinnedById` i lajkami/dislajkami, reakcje, `ClerkEvent`, ustawienia walut z `patronBoxMinMinor` wyższym od minimum, rozsyłka z `templateId` i `scheduledAt`, sesje odtwarzania z `PATRON`, płatności, patroni, powiadomienia, subskrypcje). Sprawdza:

1. atomowość: skrypt z dopisanym `SELECT 1/0` kończy się błędem i nic się nie zmienia;
2. `prisma migrate deploy` stosuje migrację;
3. zniknęły wszystkie tabele, typy i kolumny z sekcji 1;
4. żywe dane nienaruszone (liczby wierszy 17 tabel, wartości kluczowe, `scheduledAt` rozsyłki, przypięty komentarz);
5. `PATRON` na `LOGGED_IN` w `Video` i `VideoPlaybackSession`, enum `{PUBLIC, LOGGED_IN}`, default `PUBLIC`;
6. minimum EUR 400 (z 300 + `patronBoxMinMinor` 400), PLN 700, USD 500;
7. `sizeBytes` jest `bigint`, zapis 5 GiB przez klienta Prisma i odczyt jako `bigint`;
8. klient Prisma czyta i zapisuje przeniesione tabele;
9. nowe indeksy istnieją;
10. drugie uruchomienie pliku jest bez efektu (idempotentność);
11. `prisma migrate deploy` po wszystkim: „No pending migrations”, `prisma migrate diff` bazy względem `schema.prisma` jest pusty.

Wynik na PostgreSQL 16.15 (lokalnie; PostgreSQL 17 niedostępny): 12/12 testów zielone. Cały zestaw Postgres (`npx vitest run --config vitest.postgres.config.ts`) na świeżej bazie: 10 plików, 61 testów zielonych; `npm run db:smoke` zielony.
Poza testem zrobiłem to samo ręcznie na bazie scratch (`prisma migrate deploy`, ponowny `deploy`, ponowne wykonanie pliku przez `prisma db execute`, `migrate diff`).

**Czego nie sprawdziłem:** danych produkcyjnych (rzeczywista zawartość usuwanych tabel i kolumn, stare wiersze dostawców), PostgreSQL 17, zachowania `pp_admin` (rola z uprawnieniami do tabel; usuwane tabele znikają razem z uprawnieniami), działania starego obrazu na nowym schemacie.

## 5. Lista kontrolna przed wdrożeniem na produkcję

Wszystko tylko do odczytu, na produkcyjnej bazie (`docker compose exec db psql -U <owner> -d <db>`; sesja `SET default_transaction_read_only = on;`).

1. **Co zniknie** (liczby wierszy; zapisz wynik w `ai-log`):
   ```sql
   SELECT 'ClerkEvent' t, count(*) FROM "ClerkEvent" UNION ALL
   SELECT 'CommentLike', count(*) FROM "CommentLike" UNION ALL
   SELECT 'CommentDislike', count(*) FROM "CommentDislike" UNION ALL
   SELECT 'VideoDistributionPlan', count(*) FROM "VideoDistributionPlan" UNION ALL
   SELECT 'VideoDistributionTarget', count(*) FROM "VideoDistributionTarget" UNION ALL
   SELECT 'VideoProviderJob', count(*) FROM "VideoProviderJob" UNION ALL
   SELECT 'VideoProviderWebhookEvent', count(*) FROM "VideoProviderWebhookEvent";
   ```
   Niezerowe `CommentLike`/`CommentDislike` oznaczają reakcje, które nigdy nie zostały przeniesione do `CommentReaction`: zdecyduj, czy to akceptujesz.
2. **Kolumny z danymi** (czy zawierają coś, czego brak będzie boleć):
   ```sql
   SELECT count(*) FILTER (WHERE "videoUrl" IS NOT NULL) video_url, count(*) FILTER (WHERE "publishAfterAssetReadyProvider" IS NOT NULL) pub_provider FROM "Video";
   SELECT count(*) FILTER (WHERE "bannerUrl" IS NOT NULL) banner, count(*) FILTER (WHERE "stripeConnectId" IS NOT NULL) stripe_connect FROM "Creator";
   SELECT count(*) FILTER (WHERE "totalPaidMinor" <> 0) total_paid, count(*) FILTER (WHERE "canCreateChannel") can_create FROM "User";
   SELECT count(*) FILTER (WHERE "pinnedById" IS NOT NULL) pinned_by, count(*) FILTER (WHERE score <> 0) scored FROM "Comment";
   SELECT count(*) FILTER (WHERE "providerAssetId" IS NOT NULL OR "externalVideoId" IS NOT NULL OR "muxUploadId" IS NOT NULL) provider_ids,
          count(*) FILTER (WHERE provider <> 'SELF_HLS') legacy_assets FROM "VideoAsset";
   SELECT count(*) FILTER (WHERE "resendContactId" IS NOT NULL) FROM "EmailPreference";
   SELECT count(*) FILTER (WHERE "templateId" IS NOT NULL) FROM "BroadcastEmail";
   SELECT currency, "minAmountMinor", "patronThresholdMinor", "patronBoxMinMinor" FROM "PaymentCurrencySetting";
   ```
   Ostatnie zapytanie pokazuje, które minimum po migracji: `max(minAmountMinor, patronBoxMinMinor)` (panel i bramka pokażą tę wartość).
3. **Tier**: `SELECT tier, count(*) FROM "Video" GROUP BY 1;` (oczekiwane: bez `PATRON`) i `SELECT "accessTier", count(*) FROM "VideoPlaybackSession" GROUP BY 1;` (`PATRON` stanie się `LOGGED_IN`).
4. **Nic nie wskazuje na usuwane obiekty poza migracjami**: `SELECT c.relname, d.refobjid::regclass FROM pg_depend d JOIN pg_class c ON c.oid = d.objid WHERE c.relkind = 'v';` oraz `\dv`, `\df public.*`: oczekiwane 0 widoków i funkcji zależnych od usuwanych tabel (migracja przerwie się bez `CASCADE`, więc to tylko ostrzeżenie z wyprzedzeniem).
5. **Dane do późniejszych kroków** (nie blokują): `SELECT provider, count(*) FROM "VideoAsset" GROUP BY 1;` i to samo dla `"VideoPlaybackRoute"`; `SELECT source, count(*) FROM "PatronGrant" GROUP BY 1;`; duplikaty pseudonimów `SELECT lower(name), count(*) FROM "User" WHERE NOT "isDeleted" AND NOT "onboardingPending" AND name IS NOT NULL GROUP BY 1 HAVING count(*) > 1;` (DB-03: unikalność pseudonimu nadal pilnuje tylko aplikacja; unikalny indeks `lower(name)` dodawać dopiero, gdy to zapytanie zwraca 0 wierszy) i `SELECT lower(email), count(*) FROM "User" GROUP BY 1 HAVING count(*) > 1;`.
6. **Backup obowiązkowy**: ręczny `/opt/serwerek/scripts/backup.sh` (kopia lokalna + R2) i sprawdzenie, że plik istnieje i ma sensowny rozmiar. Potem `deploy.sh` sam robi `pre-deploy-<tag>-*.sql.gz`: przed wdrożeniem **zweryfikuj odtwarzalność** zrzutu (np. `gunzip -c <plik> | docker compose exec -T db psql -U <owner> postgres -c ... ` do tymczasowej bazy `restore_check`, porównaj liczby wierszy `User`, `Video`, `Comment`, `Payment`; potem `DROP DATABASE restore_check`). Przypomnij właścicielowi o snapshocie Hetznera.
7. Zatrzymaj inne wdrożenia i agentów. Okno: kilka sekund do minuty, w której stary kontener `app` (jeszcze stary obraz) działa na nowym schemacie (patrz „Kolejność”).

## 6. Kolejność wdrożenia i rollback

**Kolejność** (`deploy.sh <tag>`): obraz z tym commitem, `pg_dump` pre-deploy, `prisma migrate deploy` w jednorazowym kontenerze, restart `app` na nowym obrazie, `encoder` i `collector`. Migracja trwa ułamek sekundy (największe tabele mają kilkanaście tysięcy wierszy). W oknie między migracją a restartem działający stary obraz `app` dostanie błędy `P2022` (kolumna nie istnieje) na zapytaniach do `Video`, `VideoAsset`, `User`, `Creator`, `Comment`; serwis jest niepubliczny i okno jest krótkie, więc przyjmuję to; `encoder` (worker) też restartuje się po migracji.

**Rollback**: `./deploy.sh x --rollback` startuje poprzedni obraz, **nie cofa schematu**. Po tej migracji stary obraz nadal wybiera usunięte kolumny (Prisma wybiera wszystkie kolumny modelu), więc by się wywrócił: automatyczny powrót w `deploy.sh`, gdy nowy obraz nie wstanie w 150 s, również zostawi stary obraz niezdrowy. Prawidłowy powrót:
1. zatrzymaj `app`, `encoder`, `collector` (`docker compose stop app encoder collector`);
2. odtwórz bazę ze zrzutu `pre-deploy-<tag>-*.sql.gz` do nowej bazy, zweryfikuj liczby wierszy, podmień (`ALTER DATABASE ... RENAME`) albo `DROP`+`CREATE` + `psql < zrzut` (zrzut `pg_dump` bez `CREATE DATABASE`; schemat `telemetry` i `_prisma_migrations` są w zrzucie, więc po odtworzeniu `migrate status` pokaże brak migracji czyszczącej);
3. uruchom poprzedni obraz (`./deploy.sh <poprzedni-tag> --rollback` albo `deploy.sh` ze starym tagiem; stary obraz nie ma tej migracji w katalogu, więc `migrate deploy` nic nie zrobi);
4. dane zapisane między wdrożeniem a rollbackiem giną (okno z kroku wyżej).
Nowe wdrożenia po udanym rollbacku wymagają ponownej decyzji (migracja znów się zastosuje).

Rekomendacja na przyszłość (expand/contract, DB-02): przy kolejnych usunięciach najpierw wdrożyć kod bez użycia obiektu (schemat zostaje), po dobie stabilnej pracy wdrożyć samą migrację. Ta zmiana łączy oba kroki, bo nic nie jest publiczne i jest jeden użytkownik; kod tej zmiany powinien działać też na starym schemacie (kolumny usuwane mają domyślne wartości lub są nullable), ale **tego nie testowałem** (w szczególności odczyt `INTEGER` jako `BigInt` w `sizeBytes`).

## 7. Retencja `VideoPlaybackEvent` (DB-05)

Sprawdzone grepem po `app/ lib/ apps/ scripts/ workers/ services/ deploy/`: tabela jest tylko zapisywana (`video-playback.repository.ts: createEvent`), a żaden cron, timer systemd ani job nie kasuje jej wierszy (`prune-stale-playback-sessions` kasuje sesje, po czym zdarzenia tracą `sessionId` przez `SetNull`; `anonymize-technical-data` nie dotyka zdarzeń). Zatem rośnie bez końca. Nie wymyślam polityki: do decyzji właściciela, np. (a) przestać zapisywać zdarzenia poza `ERROR`/`PLAY_STARTED`, albo (b) job retencji 30-90 dni kasujący paczkami (`DELETE ... WHERE id IN (SELECT id ... LIMIT 5000)`). Przy ~10 tys. wierszy nie jest pilne.

## 8. Przyszłe zadanie: squash starych migracji do baseline (NIE wykonywać teraz)

Opłaca się (50 katalogów, duplikaty znaczników czasu, migracje naprawcze dryftu, 12 nadmiarowych wierszy w `_prisma_migrations`), ale wymaga kroków `prisma migrate resolve` na produkcji, których nie da się przetestować tutaj. Warunek wstępny: ta migracja wdrożona i sprawdzona na produkcji. Osobny PR i osobne okno serwisowe.

1. `npx prisma migrate status` na produkcji: „Database schema is up to date”; czysty `git status`; nikt nie wdraża (zatrzymaj agentów).
2. Kopia: `pg_dump -Fc` produkcji do `/opt/serwerek/backups/pre-squash-<data>.dump` i próbne odtworzenie do bazy `squash_check_prod`.
3. Baseline: `mkdir -p prisma/migrations_new/0_baseline` i `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations_new/0_baseline/migration.sql` (Prisma 7: `--to-schema`).
4. Dopisz ręczny SQL, którego Prisma nie modeluje, zapisany jako UTF-8 bez BOM: indeks częściowy `Comment_one_pinned_per_video_idx` (z `20260603120000_add_comment_pinning`) oraz wszystko, co dodały później migracje spoza modelu Prisma (przejrzyj grepem starych migracji: `WHERE`, `CHECK`, `lower(`, `TRIGGER`, `FUNCTION`, `EXTENSION`, `CREATE SCHEMA`). Uwaga: od tamtego audytu przybyły obiekty spoza modelu: schemat `telemetry` (`20261004210000_telemetry_schema`, `20261005120000_analytics_rollups`: funkcje, tabele, role), wyzwalacze niezmienności `AuditLog`/`AdminAuthEvent` (`20261004200000`, `20261005200000`) i rola `pp_admin`. `migrate diff` z pustej bazy ich nie wygeneruje: trzeba je przenieść ręcznie, inaczej baseline je zgubi.
5. Dowód równoważności: pusta baza `squash_check_new` + `migrate deploy` z nowym katalogiem; porównanie `pg_dump --schema-only --no-owner --no-privileges` (posortowane) z `squash_check_prod` i `prisma migrate diff --from-url <kopia prod> --to-url <nowa>` (pusty). Każda różnica to dryft do wyjaśnienia przed krokiem 7.
6. Podmiana w repo: usuń stare katalogi, przenieś `0_baseline`, zostaw `migration_lock.toml`, usuń `scripts/resolve-failed-migrations.ts` i `db:migrate:repair`. CI zielone (`integration-postgres` buduje bazę od zera). Ten test (`db-cleanup-migration.pg.test.ts`) zależy od historii migracji (odtwarza stan sprzed 20261005210000): po squashu usunąć go albo przepisać.
7. Produkcja (okno serwisowe, przed obrazem z nowym katalogiem): `CREATE TABLE "_prisma_migrations_archive_<data>" AS SELECT * FROM "_prisma_migrations"; DELETE FROM "_prisma_migrations";`, potem z kontenera migratora nowego obrazu `npx prisma migrate resolve --applied 0_baseline` i `npx prisma migrate status` (oczekiwane: up to date). Dopiero potem zwykły `deploy.sh`.
8. Inne bazy (lokalne, testowe, stary Neon): postawić od nowa albo potraktować jak krok 7.

Ryzyka: baseline różni się od produkcji (krok 5 obowiązkowy); utrata ręcznego SQL (krok 4 + test istnienia obiektów); edycja `0_baseline/migration.sql` po `resolve` daje ostrzeżenie o zmienionej sumie kontrolnej (nie edytować); wdrożenie starego obrazu po squashu każe `migrate deploy` wykonać 50 starych migracji na pełnej bazie (rollback tylko do obrazu zbudowanego po squashu albo najpierw przywrócić `_prisma_migrations` z tabeli archiwalnej); rollback całości: `TRUNCATE "_prisma_migrations"; INSERT INTO "_prisma_migrations" SELECT * FROM "_prisma_migrations_archive_<data>";` plus `git revert`.
