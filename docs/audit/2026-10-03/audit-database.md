# Audyt warstwy danych: pawelperfect.com (stan `main` @ 88c787d0, 2026-10-03)

Audyt tylko do odczytu. Nic nie zmieniono w repo, na serwerze ani w bazie. Dowody pochodzą z grepa (`rg`) po `app/`, `lib/`, `scripts/`, `middleware.ts`, `prisma/seed.ts` (bez testów) oraz z `git grep` na gałęzi PR #1614 `origin/chore/remove-third-party-video` (dalej: **PR**). Liczby wierszy produkcji pochodzą z briefu (2026-10-03).

Ograniczenie metody: masowe liczenie użyć kolumn (skrypt po 293 nazwach pól) zostało przerwane przez limit czasu po 262 nazwach. Kolumny z pozostałej, alfabetycznie ostatniej grupy (np. `totalWatchMs`, `unsubscribedAt`, `videoUrl`, `uploadPart*`, `verifiedAt`) sprawdziłem osobnymi, celowanymi grepami. Twierdzenia "martwe" w tabeli poniżej mają zawsze konkretny dowód.

---

## 1. Podsumowanie

- **Schemat:** 45 modeli, 30 enumów, 50 katalogów migracji (w `_prisma_migrations` jest 62 wiersze; nadmiar to wycofane próby i usunięta migracja `20260627000000_video_sources_youtube`). Klient Prisma `6.19.3` (najnowsza stabilna to 7.10, a 8 ma status RC). Postgres 17 w Docker Compose.
- **Martwe, jeszcze do usunięcia (wymagają danych produkcyjnych lub decyzji):** siedem wartości `StorageProvider` poza `SELF_HLS` (stare wiersze dostawców w `VideoAsset`/`VideoPlaybackRoute`), `PatronGrantSource.PAYMENT/REFERRAL/LEGACY`, `Comment.imageUrl`, `VideoStatus.UNLISTED`. Martwe tabele i kolumny usunęła migracja `20261005210000_cleanup_dead_schema` (opis: `docs/architecture/db-cleanup-2026-10-05.md`).
- **Najpoważniejsze sygnały:**
  1. `StripeEvent = 0` i `UserPaymentTotal = 0` przy 147 płatnościach i 8 patronach. Albo webhooki Stripe nie dochodzą do serwerka, albo przywrócenie bazy z Neona było niepełne. Do pilnego sprawdzenia (DB-01).
  2. Unikalność pseudonimu jest sprawdzana tylko w aplikacji, a nie w bazie (wyścig TOCTOU).
  3. `VideoPlaybackEvent` rośnie bez końca, a nikt tego nie czyta.
  4. Stan "aktywnego źródła wideo" jest trzymany w trzech miejscach naraz.
  5. `VideoAsset.sizeBytes` to `Int`, więc HLS większy niż 2 GB zapisuje się jako `null`.
  6. Po zgodzie na migracje destrukcyjne `deploy.sh --rollback` przestaje być bezpieczny (komentarz w skrypcie zakłada migracje addytywne).
- **Squash do baseline:** opłaca się, nakład S/M, ryzyko niskie przy jednej produkcji i pełnych zrzutach. Warunek: najpierw migracja czyszcząca, potem squash, osobno, z ręcznym przeniesieniem SQL, którego Prisma nie modeluje (indeks częściowy `Comment_one_pinned_per_video_idx` i nowe CHECK-i).

---

## 2. Żywe / martwe: modele, kolumny, enumy

Legenda: **Ż** żywe; **M** martwe (0 trafień); **M-PR** martwe po PR #1614; **Z** tylko zapis (nikt nie czyta); **D** duplikat innej struktury; **BA** używane przez Better Auth wewnętrznie przez adapter Prisma (zero trafień w naszym kodzie to norma).

### 2.1 Modele

| Model | Wiersze | Status | Dowód / uwagi |
|---|---|---|---|
| User | 35 | Ż | 54 wywołania delegata |
| Session, Account, Verification, TwoFactor | 3/6/0/0 | Ż (BA) | `lib/auth/auth.ts:56` `prismaAdapter(prisma)`; `account-deletion-cleanup.use-case.ts:57-59` |
| UserAvatar | 0 | Ż | `PUT /api/user/avatar`, 4 wywołania |
| Payment | 147 | Ż | 30 wywołań |
| StripeEvent | **0** | Ż (!) | `lib/modules/payments/infrastructure/stripe-event-lock.service.ts:14` tworzy wiersz przy **każdym** zweryfikowanym webhooku; 0 wierszy oznacza anomalię, patrz DB-01 |
| PatronGrant | 8 | Ż | 21 wywołań; księgowe oznaczenie wspierającego |
| AuditLog | 758 | Ż | `lib/modules/audit/infrastructure/audit.repository.ts:25,42,50` |
| AppSetting | 1 | Ż | `default-thumbnail.service.ts:25`, `encode-queue.use-cases.ts:140` (heartbeat workera) |
| Creator | 1 | Ż | 35 wywołań |
| Subscription | 6 | Ż + D | `app/api/subscriptions/route.ts`, `subscribe.use-case.ts:43`; komentarz w schemacie "LEGACY" jest nieaktualny. Dubluje zgodę z `EmailPreference.marketingEmails` (broadcast wymaga obu: `legacy-email-service-provider.ts:175-194`) |
| Notification | 14 | Ż (UI ukryte) | zapisywane przez `sendNotification`; dzwonek ukryty `Navbar.tsx:23` (`TEMP_HIDE_NOTIFICATIONS_BELL`) |
| NotificationPreference | 0 | Ż | `app/api/user/notification-preferences/route.ts`, `NotificationsAccountSection.tsx` |
| NotificationTemplate | 0 | Ż | `app/admin/notifications/NotificationTemplatesEditor.tsx` |
| Video | 4 | Ż | 103 wywołania |
| VideoAsset | 7 | Ż | rdzeń `SELF_HLS` |
| VideoOriginal | 2 | Ż | pipeline `original-upload.use-cases.ts` |
| VideoEncodeJob | 1 | Ż | `encode-job.repository.ts` |
| VideoPlaybackRoute | 7 | Ż | `video-playback-route.service.ts` |
| VideoLike, VideoDislike | 2/3 | Ż + D | `comment.repository.ts:51-72`; dwie tabele zamiast jednej `VideoReaction(type)` (wzorzec `CommentReaction`) |
| Comment | 19 | Ż | |
| CommentReaction | 5 | Ż | `comment.repository.ts:104-116` |
| CommentReport | 0 | Ż | `report-comment.use-case.ts` |
| VideoView | 94 | Ż + D | zapis `video-playback.repository.ts:44`, odczyt tylko `resync-admin-video-stats.use-case.ts:36`; dubluje `VideoPlaybackSession.countedAsView` |
| UserPaymentTotal | **0** | Ż + D (!) | zapis `fulfill-payment.use-case.ts:90`, odczyt w statystykach admina `get-admin-users-stats.use-case.ts:40`; zdenormalizowana suma z `Payment`, przy 0 wierszach statystyki pokazują 0 |
| PaymentCurrencySetting | 5 | Ż | `lib/payments/currency-settings.ts:44` |
| EmailSuppression | 0 | Ż | `EmailPolicy.isSuppressed`, webhook Resend |
| EmailTemplate | 7 | Ż | |
| BroadcastEmail / BroadcastEmailRecipient | 3/4 | Ż | |
| EmailPreference | 7 | Ż | `email-preference.repository.ts` |
| **InboundEmail** | 0 | Ż w kodzie, martwe w praktyce | zapis `handle-resend-webhook.use-case.ts:285` przy `email.received` z Resend; od 2026-10-02 poczta idzie Cloudflare Email Routing → PP Support, więc nic tu już nie trafi |
| EmailEvent | 19 | Ż (Z) | tylko blokada idempotencji `email-event-lock.service.ts:15-90`; payload nie jest czytany |
| VideoPlaybackSession | 3215 | Ż | |
| **VideoPlaybackEvent** | 9928 | **Z** | jedyny dostęp to `createEvent` (`video-playback.repository.ts:26`); 0 odczytów w app/lib/scripts |

### 2.2 Kolumny martwe, tylko zapisywane lub zduplikowane

| Kolumna | Status | Dowód |
|---|---|---|
| `User.username` | Ż, legacy/D | czytane w `lib/comments-public-author.ts:40` jako fallback; zapisywane tylko przy usuwaniu konta (`account-deletion-cleanup.use-case.ts:79`); dubluje `name` (pseudonim Better Auth) |
| `User.id` komentarz "clerkUserId" | nieaktualny komentarz | `schema.prisma:12` |
| `Creator.isApproved`, `isPrimary` | Ż | `video-content.service.ts:26`, `check-video-access.use-case.ts:40`; przy jednym kanale to strażnicy redundantni, ale działają |
| `Comment.imageUrl` | Ż (ukryte) | API przyjmuje (`app/api/videos/[id]/comments/route.ts:25`), UI tego nie udostępnia (`create-video-comment.use-case.ts:88`) |
| `Comment.creatorId` | Ż / D | przy jednym kanale równe `Video.creatorId` |
| `Video.duration` (String "12:45") | Ż | JSON-LD `app/[locale]/(home)/page.tsx:27`; typ słaby (lepiej `durationSeconds Int`) |
| `VideoAsset.isPrimary` | Ż / D | trzecia kopia "aktywnego źródła" (DB-15) |
| `VideoPlaybackRoute.provider` | D | kopia `VideoAsset.provider` |
| `EmailPreference.systemEmails` | Z | 1 trafienie (default przy create) |
| `EmailSuppression.firstSeenAt`, `lastSeenAt` | Z | 0 trafień; ustawiane przez defaulty/`@updatedAt` |
| `BroadcastEmail.scheduledAt` | M | 0 trafień |
| `BroadcastEmailRecipient.deliveredAt/openedAt/clickedAt/bouncedAt/complainedAt` | Z | 1 trafienie każde (zapis w webhooku) |

### 2.3 Enumy i wartości

| Enum / wartość | Status | Dowód |
|---|---|---|
| `StorageProvider`: `R2, S3, VERCEL_BLOB, CLOUDFLARE_STREAM, MUX, YOUTUBE, VIMEO` | M-PR | na PR jedyne trafienia to komentarz `video-asset.constants.ts:13` |
| `PatronGrantSource.PAYMENT, REFERRAL, LEGACY` | nieużywane w zapisie | mapa `grant-patron.use-case.ts:16-18` zna tylko `STRIPE_TIP, ADMIN, MIGRATION`; przed usunięciem sprawdzić dane SQL-em |
| `VideoStatus.UNLISTED` | tylko etykieta w UI | `VideoTable.tsx`, `VideoFilters.tsx`; brak logiki |
| `VideoPlaybackRouteActivatedBy.FALLBACK, RECONCILER, MIGRATION` | typ dopuszcza, nikt nie przekazuje na PR (poza `POLICY`/`ADMIN` i skryptami SQL) | do weryfikacji danych |
| `VideoAssetProcessingState.PENDING/UPLOADING/PROCESSING` | na PR tylko filtr admina `video.repository.ts:201`; pipeline tworzy od razu `READY` | prawdopodobnie martwe |
| `WebhookEventStatus` | Ż | StripeEvent, EmailEvent (ClerkEvent znika) |
| `InboundEmailStatus` | zależy od decyzji o `InboundEmail` | |

---

## 3. Znaleziska

Format: **ID | waga | miejsce | problem | naprawa | nakład | pewność**

### P1

**DB-01 | P1 | `stripe-event-lock.service.ts:14`, `fulfill-payment.use-case.ts:90` | `StripeEvent=0` i `UserPaymentTotal=0` przy `Payment=147` i `PatronGrant=8`.**
Każdy zweryfikowany webhook Stripe tworzy wiersz `StripeEvent`, a nic go nie kasuje. Każde udane `fulfillPayment` robi upsert `UserPaymentTotal`. Zera w obu tabelach oznaczają jedną z trzech rzeczy:
- (a) od odtworzenia bazy na serwerku nie było udanego webhooka;
- (b) zrzut z Neona nie zawierał tych tabel (niepełne przywrócenie);
- (c) webhooki padają przed blokadą: zły `STRIPE_WEBHOOK_SECRET`, zły URL albo Cloudflare/Tunnel blokuje POST.

Wariant (c) oznacza, że tylko "szybka ścieżka" strony powrotu i cron co 15 minut ratują płatności, a zwroty i spory (`charge.refunded`, `charge.dispute.*`) w ogóle nie są obsługiwane.

Naprawa:
1. W panelu Stripe sprawdź log dostarczeń endpointu `/api/webhooks/stripe` od 2026-10-01.
2. Uruchom `SELECT status, count(*) FROM "Payment" GROUP BY 1;` oraz `... WHERE "createdAt" > '2026-10-01'`.
3. Porównaj liczby wierszy wszystkich tabel z nieaktualnym Neonem (`scripts/verify-restored-database.ts`).
4. Jeśli to (b): odbuduj `UserPaymentTotal` z `Payment` albo usuń tabelę (DB-21).

Nakład S. Pewność anomalii wysoka, przyczyny nieznana.

### P2

**DB-03 | P2 | `lib/auth/hooks.ts:80`, `update-user-profile.use-case.ts:34`, `check-nickname-availability.use-case.ts:17`; brak indeksu w `schema.prisma:15` | Unikalność pseudonimu (`User.name`, bez rozróżniania wielkości liter) jest sprawdzana tylko w aplikacji: `findFirst ... mode: "insensitive"`, potem zapis.**
Dwa równoległe onboardingi z tym samym nickiem przejdą (TOCTOU). Przy okazji `ILIKE`-równość robi skan sekwencyjny.

Naprawa:
1. Zdeduplikuj stare wiersze: `SELECT lower(name), count(*) FROM "User" WHERE NOT "isDeleted" GROUP BY 1 HAVING count(*)>1`.
2. Dodaj w migracji ręczny SQL: `CREATE UNIQUE INDEX "User_name_lower_active_key" ON "User"(lower("name")) WHERE "isDeleted" = false AND "onboardingPending" = false AND "name" IS NOT NULL;`. Placeholder pseudonimu w trakcie onboardingu jest wyłączony z warunku.
3. W `completeOnboarding`/`updateNickname` łap P2002 i zwracaj 409 "nick zajęty".

Dlaczego nie `citext` ani kolacja niedeterministyczna: w PG17 kolacje niedeterministyczne nie wspierają `LIKE`/`ILIKE`, a panel admina szuka po `name` przez `contains ... insensitive` (`list-admin-users.use-case.ts:215`). Indeks wyrażeniowy `lower()` niczego nie psuje. Prisma nie modeluje indeksów wyrażeniowych, więc to SQL w migracji ("unsupported database features"); po dodaniu sprawdź `prisma migrate diff`, żeby Prisma nie generowała `DROP INDEX`.

Nakład S. Pewność wysoka.

**DB-04 | P2 | `schema.prisma:13` (`email @unique`, wrażliwe na wielkość liter) | Better Auth zapisuje e-maile małymi literami, ale wiersze z czasów Clerka mogły mieć wielkie litery.**
Wtedy `Jan@x.pl` i `jan@x.pl` mogą istnieć jednocześnie. Naprawa: sprawdź `SELECT lower(email), count(*) ... HAVING count(*)>1` oraz `WHERE email <> lower(email)`; znormalizuj dane; dodaj `CREATE UNIQUE INDEX ON "User"(lower(email))`. Nakład S. Pewność średnia (zależy od danych).

**DB-05 | P2 | `video-playback.repository.ts:25`, brak crona | `VideoPlaybackEvent` (9928 wierszy, każdy z JSON `metadata`) tylko rośnie, a nikt go nie czyta.**
Po pruningu sesji (`onDelete: SetNull`) zdarzenia tracą nawet powiązanie z sesją. Naprawa, do wyboru:
- (a) przestać zapisywać zdarzenia poza `ERROR`/`PLAY_STARTED`;
- (b) cron retencji 30-90 dni z kasowaniem w paczkach (`DELETE ... WHERE id IN (SELECT id ... LIMIT 5000)`).

Partycjonowanie (pg_partman) ma sens dopiero przy milionach wierszy. Nakład S. Pewność wysoka.

**DB-06 | P2 | `prune-stale-playback-sessions.use-case.ts:30`, `video-playback.repository.ts:44` | Dwie struktury zapisują ten sam fakt "wyświetlenie":** `VideoView` (94) i `VideoPlaybackSession.countedAsView=true`. Sesje zaliczone jako wyświetlenie nie są nigdy kasowane, a pozostałe po 30 dniach tak.

Naprawa: `VideoView` zostaje trwałym rejestrem wyświetleń, a sesje stają się tymczasowe i są kasowane wszystkie (także zaliczone) po 30 dniach. Indeks pod pruning: `(countedAsView, startedAt)` zamiast osobnych `[countedAsView]`/`[isAdminPreview]` na wartościach logicznych. Alternatywa: usunąć `VideoView` i liczyć `countedAsView`. Ale `markSessionAsViewed` (gałąź deduplikacji przez Redis, `record-playback-event.use-case.ts:236`) oznacza sesje bez zwiększania licznika, więc przeliczenie by zawyżało. Nakład S. Pewność wysoka.

**DB-07 | P2 | brak cronów | Brak retencji dla `AuditLog` (ip, userAgent), `EmailEvent` (pełny payload Resend z adresami e-mail), `Session` i `Verification` (Better Auth kasuje wygasłe tylko leniwie, przy odczycie), `StripeEvent`, `Notification`, `ClerkEvent`.**
Naprawa: jeden cron `prune-telemetry` (systemd timer, jak pozostałe):
- `Session`/`Verification` z `expiresAt < now()-7d`;
- `EmailEvent` > 90 dni;
- `StripeEvent` `PROCESSED` > 90 dni;
- w `AuditLog` wyzerowanie `ip`/`userAgent` po 90 dniach i kasowanie akcji `AUTH_SIGN_IN`/`AUTH_SIGN_OUT` po 180 dniach, przy zachowaniu akcji admina i płatności;
- `Notification` przeczytane > 180 dni.

Nakład M. Pewność wysoka.

**DB-08 | P2 (RODO) | `account-deletion-cleanup.use-case.ts:40-82` | Usunięcie konta anonimizuje `User` i kasuje sesje i zgody, ale zostawia oryginalny adres e-mail** w `BroadcastEmailRecipient.email`, `EmailEvent.email` i `payload`, `InboundEmail.fromEmail`, a także `AuditLog.ip`/`userAgent` oraz `Notification`. Naprawa: w tej samej transakcji `UPDATE "BroadcastEmailRecipient" SET email = <tombstone> WHERE "userId" = $1 OR email = $orig`, analogicznie `EmailEvent`, plus `DELETE` z `Notification`. Retencja z DB-07 domyka resztę. Nakład S. Pewność wysoka.

**DB-11 | P2 | `video-playback-route.service.ts:26-44` | Trzy źródła prawdy dla aktywnego źródła wideo: `Video.activePlaybackRouteId`, `VideoPlaybackRoute.status='ACTIVE'` i `VideoAsset.isPrimary`.** Synchronizuje je tylko kod, w jednej transakcji, a w bazie nie ma ograniczenia "jedna ACTIVE trasa na film". Naprawa: zostaw `Video.activePlaybackRouteId` jako jedyne źródło, usuń `VideoAsset.isPrimary` (i `pendingPrimaryIntent`) po przepisaniu `primary-playable-asset.ts`/`video.repository.ts:487-541`, a do czasu usunięcia dodaj `CREATE UNIQUE INDEX ON "VideoPlaybackRoute"("videoId") WHERE status='ACTIVE'`. Nakład M. Pewność wysoka.

**DB-12 | P2 | `get-admin-users-stats.use-case.ts:40` vs `get-admin-dashboard-stats.use-case.ts:29-33` | Dwie różne liczby przychodu.** Statystyki użytkowników czytają `UserPaymentTotal` (0 wierszy, więc pokazują 0). Dashboard sumuje `Payment.SUCCEEDED` bez odejmowania zwrotów i bez `PARTIALLY_REFUNDED` (inaczej niż `fundraising-progress.service`). Naprawa: jedna funkcja `sumNetTips()` po `Payment` (`groupBy currency`, `amountMinor - refundedAmountMinor`, statusy `SUCCEEDED|PARTIALLY_REFUNDED`) i usunięcie `UserPaymentTotal` (DB-21). Nakład S. Pewność wysoka.

**DB-13 | P2 | `.github/workflows/production-db-migrations.yml`, `scripts/vercel-build.mjs`, `vercel.json`, `scripts/validate-vercel-production-env.mjs`, `schema.prisma:8` (`directUrl = env("DATABASE_URL_UNPOOLED")`), `lib/env/validation.ts:19`, `scripts/resolve-failed-migrations.ts` | Resztki Neona i Vercela.**
Workflow "Production DB Migrations" używa sekretów GitHuba `DATABASE_URL`, czyli dziś nieaktualnego Neona. Ręczne uruchomienie migrowałoby zły serwer, a na prawdziwą produkcję nie działa. `directUrl` wymusza duplikat `DATABASE_URL_UNPOOLED` w `app.env`.

Naprawa:
1. Usuń workflow, `vercel-build.mjs`, `vercel.json` i walidator Vercela.
2. Usuń `directUrl` i zmienną `DATABASE_URL_UNPOOLED` (bez PgBouncera nie ma czego rozdzielać).
3. Usuń `db:migrate:repair` (lista dozwolonych naprawy dotyczy historycznych incydentów na Neonie; po squashu traci sens).
4. W polityce prywatności (`app/components/legal/LegalDocs.tsx:199,424`) nadal widnieją "Vercel (hosting), Neon (baza danych)" jako podmioty przetwarzające, a to jest już nieprawda. Poza zakresem bazy, ale do poprawy.

Nakład S. Pewność wysoka.

**DB-14 | P2 | `lib/prisma.ts:3-7`, `docker-compose.yml:13` (`max_connections=60`) | Brak jawnego `connection_limit`/`pool_timeout`, `statement_timeout`, `idle_in_transaction_session_timeout` i logowania wolnych zapytań.**
Domyślna pula Prisma 6 to `2 × CPU + 1` na proces. Działają app, worker, migrator i skrypty, a każdy z nich tworzy własnego `new PrismaClient()` (`scripts/*.ts`).

Naprawa:
1. W `DATABASE_URL`: `?connection_limit=10&pool_timeout=10`.
2. Na roli: `ALTER ROLE <app> SET statement_timeout='15s'; ALTER ROLE <app> SET idle_in_transaction_session_timeout='30s';` (worker osobna rola albo dłuższy limit).
3. W Postgresie: `-c log_min_duration_statement=500 -c shared_preload_libraries=pg_stat_statements`.

Nakład S. Pewność wysoka.

**DB-15 | P2 | `schema.prisma:1-9`, `package.json` (`@prisma/client ^6.19.3`) | Prisma 6 a obecny stan.** Najnowsza stabilna to 7.10 (2026-08-26), Prisma 8 jest w RC, a Prisma 7 ma 18 miesięcy wsparcia po GA ósemki. Wersja 7 to klient bez Rusta, generator `prisma-client` z `output`, obowiązkowy adapter (`@prisma/adapter-pg`), `prisma.config.ts`, cache zapytań (7.4) i indeksy częściowe w schemacie (7.4, preview `partialIndexes`). Rekomendacja: po squashu zrobić upgrade do 7.x, z pulą na `pg.Pool` (`max`, `statement_timeout` w konfiguracji). Ósemkę odłożyć do GA. Nakład M. Pewność wysoka.

### P3

**DB-16 | P3 | `schema.prisma` | Indeksy nadmiarowe, pokryte przez unique albo złożony indeks z tym samym prefiksem:**
- `User[email]` (jest `@unique`)
- `Video[slug]` (jest `@unique`)
- `Video[activeOriginalId]`, `Video[activePlaybackRouteId]` (są `@unique`)
- `Video[creatorId]` (jest `[creatorId,status]`)
- `Payment[userId]` (jest `[userId,status]` i `@@unique([userId,requestId])`)
- `PatronGrant[userId]` (jest `[userId,revokedAt]`)
- `Comment[videoId]` (są `[videoId,createdAt]` i `[videoId,pinnedAt,createdAt]`)
- `Comment[parentId]` (jest `[parentId,createdAt]`)
- `VideoOriginal[videoId]` i `[videoId,version]` (jest `@@unique([videoId,version])`)
- `VideoAsset[videoId]` (jest `[videoId,isPrimary]`)
- `[userId]` w `VideoLike`, `VideoDislike`, `CommentReaction`, `CommentLike`, `Subscription` (pokryte przez unikalny `[userId, X]`)
- `CommentReport[commentId]` (jest unique `[commentId,reporterId]`)
- `EmailPreference[email]` (jest `@unique`)
- `PaymentCurrencySetting[updatedAt]` (5 wierszy)
- `VideoPlaybackSession[countedAsView]`, `[isAdminPreview]` (wartości logiczne)

Naprawa: `DROP INDEX` w migracji czyszczącej. Nakład S. Pewność wysoka.

**DB-18 | P3 | Brak CHECK-ów:**
- `Payment.amountMinor > 0`
- `0 <= refundedAmountMinor <= amountMinor`
- `currency ~ '^[A-Z]{3}$'` (także w `UserPaymentTotal`, `PaymentCurrencySetting`, `Video.fundraisingGoalCurrency`)
- `Video.fundraisingManualPercent BETWEEN 0 AND 100`, `fundraisingGoalMinor > 0`
- `VideoEncodeJob.progressPercent BETWEEN 0 AND 100`
- liczniki `likesCount/dislikesCount/views/repliesCount/subscribersCount >= 0`
- `PaymentCurrencySetting.minAmountMinor > 0`

Prisma nie modeluje CHECK-ów, więc to ręczny SQL (`ADD CONSTRAINT ... NOT VALID; VALIDATE CONSTRAINT ...`). Pieniądze w `Int` jako jednostki groszowe to dobry wybór; nie zamieniać na `Decimal`. Nakład S. Pewność wysoka.

**DB-19 | P3 | `fulfill-payment.use-case.ts:100-112` | Wyścig: dwie równoległe kwalifikujące się płatności tego samego użytkownika widzą `alreadyPatron=false` (Read Committed) i tworzą dwa aktywne `PatronGrant`.** Skutek jest kosmetyczny (dwa maile powitalne). Naprawa: `CREATE UNIQUE INDEX ON "PatronGrant"("userId") WHERE "revokedAt" IS NULL` i obsługa P2002 jako "już patron". Przy okazji `getPaymentCurrencyLimits()` (`:94`) czyta globalnym `prisma` poza transakcją, co przy dużym obciążeniu zajmuje drugie połączenie z puli. Nakład S. Pewność wysoka.

**DB-20 | P3 | `encode-job.repository.ts:44-79, 155-194, 204-236` | Kolejka `VideoEncodeJob` jest poprawna:** atomowy `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING`, heartbeat, reaper, CAS na `workerId`. Zastrzeżenia:
- (a) "jedno aktywne kodowanie na film" pilnuje tylko advisory lock w `enqueue`; lepiej dodać inwariant w bazie `CREATE UNIQUE INDEX ON "VideoEncodeJob"("videoId") WHERE status IN ('QUEUED','RUNNING')`;
- (b) `claimNext` liczy czas zegarem bazy, a `requeueStale`/`reportProgress` zegarem aplikacji, więc przy rozjechanych zegarach reaper może się pomylić; lepiej wszędzie używać `now()` z bazy;
- (c) `pg_try_advisory_xact_lock` w `WHERE` podzapytania wykonuje się dla każdego wiersza-kandydata i zależy od planu zapytania; czytelniej wywołać go raz, w osobnym CTE;
- (d) indeks częściowy `(createdAt) WHERE status='QUEUED'` dopiero przy dużej kolejce.

Nakład S. Pewność wysoka.

**DB-21 | P3 | `UserPaymentTotal` | Zdenormalizowana suma z `Payment`** (147 wierszy, `groupBy` kosztuje mikrosekundy) z ręczną korektą przy zwrotach (`payment-adjustments.ts:41-47`, `decrementUserPaymentTotal` raw SQL). Dziś jest pusta. Naprawa: usunąć tabelę, a `normalizePaymentTotals(user.paymentTotals)` (około 15 miejsc: `fulfill-payment`, `grant-patron`, `patron.repository`, `list-admin-users`, `HomeExperience.tsx:106`, ...) zastąpić jedną funkcją agregującą `Payment`. Nakład M. Pewność wysoka.

**DB-22 | P3 | `Subscription` + `EmailPreference` | Zgoda na powiadomienia treściowe jest zapisana dwa razy.** `subscribe.use-case.ts` zapisuje oba miejsca w jednej transakcji, a broadcast wymaga obu (`legacy-email-service-provider.ts:175-194`). `EmailPreference.userId` nie ma klucza obcego, więc mogą zostać sieroty. `Creator.subscribersCount` to kolejna denormalizacja. Naprawa: zostawić `EmailPreference` z kluczem obcym `ON DELETE CASCADE`, usunąć `Subscription`, a licznik wyliczać. To decyzja właściciela (patrz §4). Nakład M. Pewność wysoka.

**DB-23 | P3 | `handle-resend-webhook.use-case.ts:285`, `list-inbound-emails.use-case.ts`, `app/admin/emails` (InboundInbox) | `InboundEmail`: po przeniesieniu poczty do PP Support nic już tu nie wpada.** Naprawa: usunąć tabelę, enum, handler `email.received` oraz zdarzenie `received` z subskrypcji webhooka Resend. Nakład S. Pewność wysoka.

**DB-24 | P3 | `Navbar.tsx:23` | Powiadomienia są zapisywane (14), ale UI jest ukryte.** `NotificationTemplate` i `NotificationPreference` są puste. Decyzja właściciela: przywrócić dzwonek albo usunąć cały moduł (3 tabele + enum). Nakład S/M. Pewność wysoka.

**DB-25 | P3 | wszystkie `DateTime` | `timestamp(3)` bez strefy.** Prisma zapisuje UTC, a raw SQL świadomie używa `now() AT TIME ZONE 'UTC'` (`encode-job.repository.ts:54`). Działa, ale każda ręczna sesja `psql` z `TimeZone` innym niż UTC pomyli `now()`. Naprawa przy squashu albo upgradzie: `@db.Timestamptz(3)` i `ALTER COLUMN ... TYPE timestamptz USING col AT TIME ZONE 'UTC'`. Alternatywa minimum: `ALTER DATABASE ... SET timezone='UTC'`. Nakład M. Pewność wysoka.

**DB-26 | P3 | `app/api/cron/stripe-reconciliation/route.ts:33-90` | Porzucone intenty są oznaczane jako `FAILED` zamiast `CANCELED`** i nie są anulowane w Stripe (`paymentIntents.cancel`). Starsze niż 7 dni wiszą jako `PENDING` na zawsze. `findMany` nie ma `select` ani `take`. Każda zmiana kwoty w bramce to nowy `Payment`; prawdopodobnie większość ze 147 wierszy to porzucone intenty. Naprawa: `select`, `take: 200`, status `CANCELED` i anulowanie intentu. Nakład S. Pewność wysoka.

**DB-28 | P3 | `channel-layout.service.ts:72-82`, `video-content.service.ts:48-66` | Brak `select`:** pobierane są pełne wiersze `Video` z `include: { creator: true }`, a sitemap dociąga e-mail właściciela kanału (`user: { select: { imageUrl, email } }`), choć DTO go nie potrzebuje. Naprawa: wąskie `select`. Nakład S. Pewność wysoka.

**DB-29 | P3 | `finalize-self-hls.ts:40-74` | Zapis `VideoAsset` i aktywacja trasy nie są w jednej transakcji** (jest akcja kompensująca `delete`). Nie ma też `@@unique([videoId, provider, objectKey])`, więc idempotencja opiera się na `findFirst`. Naprawa: unikalność plus `upsert`, a utworzenie assetu i aktywacja trasy w jednej transakcji. Nakład S. Pewność wysoka.

**DB-30 | P3 | `comment.repository.ts:104-119`, `toggle-comment-like.use-case.ts:50` | Liczniki i reakcje są poprawne** (transakcja, unikalność `[userId,commentId]`, podwójny klik daje P2002 i rollback). Jednak `Comment.score` to martwy duplikat `likesCount`, a `VideoLike` + `VideoDislike` to dwie tabele. Wzajemne wykluczenie like/dislike pilnuje tylko kod, a przy wyścigu użytkownik może mieć oba. Naprawa: `VideoReaction(userId, videoId, type)` z `@@unique([userId, videoId])`, jak `CommentReaction`. Nakład M. Pewność wysoka.

**DB-31 | P3 | `lib/services/payment.service.ts`, `scripts/strict-escapes-baseline.jsonc:189-371`, `audit.repository.ts:25` i `stripe-event-lock.service.ts:14-70` (`(this.db as any)`) | Duplikat logiki blokady Stripe** (używany tylko w `tests/unit/stripe-webhook.test.ts`) i rzutowania `any` na delegatach, które dziś istnieją w typach. Naprawa: usunąć `payment.service.ts`, usunąć `as any`, odświeżyć baseline. Nakład S. Pewność wysoka.

**DB-32 | P3 | `prisma/migrations` | Historia migracji jest nieuporządkowana:**
- zduplikowane znaczniki czasu: `20260620000000` ×3 (`add_comment_is_hearted`, `payment_request_id`, `video_publish_after_asset_ready`) i `20260628000000` ×2;
- dwie migracje `payment_request_id` (`20260620000000_payment_request_id` i `20260625121500_add_payment_request_id`);
- migracje naprawcze dryftu (`production_sync`, `production_schema_drift_guard`, `fix_schema_consistency`, trzy `20260926120000-2`);
- 12 nadmiarowych wierszy w `_prisma_migrations` (wycofane próby);
- obiekt spoza schematu: indeks częściowy `Comment_one_pinned_per_video_idx` (`20260603120000_add_comment_pinning/migration.sql:6`);
- brak BOM w plikach (sprawdzone dla pierwszych 17).

Naprawa: squash do baseline (§5.2). Nakład S/M. Pewność wysoka.

**DB-33 | P3 | `schema.prisma` | Nieaktualne komentarze:** `User.id` ("clerkUserId"), `AccessTier.LOGGED_IN` ("Clerk mail"), `PATRON` ("isPatron status granted"), `Subscription` ("LEGACY"), `PaymentCurrencySetting` ("grants lifetime patron access"), `StorageProvider` (na main), `.env`/README. Nakład S.

---

## 4. Docelowy, minimalny schemat i pytania do właściciela

### 4.1 Do usunięcia

Zrobione (migracja `20261005210000_cleanup_dead_schema`, `docs/architecture/db-cleanup-2026-10-05.md`): martwe tabele, enumy dystrybucji, kolumny, `AccessTier.PATRON`, `VideoAsset.sizeBytes` na `BIGINT`, brakujące indeksy. Zostają: wartości `StorageProvider` poza `SELF_HLS` (po sprawdzeniu `SELECT provider, count(*) FROM "VideoAsset" GROUP BY 1` i `"VideoPlaybackRoute"` na produkcji; wzorzec `_new` jak w migracji), `PatronGrantSource` (sprawdzić `SELECT source, count(*) FROM "PatronGrant" GROUP BY 1`), nadmiarowe indeksy z DB-16 i inwarianty z DB-03/04/11/18/19/20.

### 4.2 Do scalenia lub przemianowania (rekomendowane, wymaga kodu)

| Zmiana | Za | Przeciw |
|---|---|---|
| Usunąć `UserPaymentTotal`, sumy liczyć z `Payment` | jedno źródło prawdy, znika rozjazd (DB-01/12), mniej kodu korygującego zwroty | około 15 wywołań do przepisania |
| `VideoLike` + `VideoDislike` → `VideoReaction(type)` | spójne z `CommentReaction`, wykluczenie wymuszone w bazie | migracja danych (5 wierszy), przepisanie repozytorium |
| Jedno źródło aktywnego wideo (`Video.activePlaybackRouteId`); usunąć `VideoAsset.isPrimary` i `VideoPlaybackRoute.provider` | koniec trzech kopii stanu | zmiana w `primary-playable-asset.ts` i panelu admina |
| `VideoView` jako trwały log; sesje tymczasowe (kasowane po 30 dniach); retencja `VideoPlaybackEvent` | koniec nieograniczonego wzrostu | utrata surowej telemetrii po 30-90 dniach (dziś nikt jej nie czyta) |
| `User.username` → wchłonięte przez `name` | jeden pseudonim | trzeba uzupełnić `name` tam, gdzie jest `null`, i poprawić `comments-public-author.ts` |
| `Video.duration` (String) → `durationSeconds Int` | typ liczbowy, łatwy JSON-LD | zmiana formularza admina |

### 4.4 `PatronGrant` (funkcja księgowa)

- **Opcja 1: zostawić tabelę, uprościć.**
  - Zakres: `source` ∈ {`TIP`, `ADMIN`}, unikalny aktywny grant na użytkownika (DB-19), nadawany przy **każdym** udanym napiwku (bez progu) albo przy progu (pytanie 2).
  - Za: historia nadania i odebrania z audytem, ręczne nadanie przez admina.
  - Przeciw: druga struktura obok `Payment`.
- **Opcja 2: usunąć tabelę, "wspierający" = `EXISTS Payment SUCCEEDED/PARTIALLY_REFUNDED` plus kolumna `User.supporterOverride` (admin).**
  - Za: jedno źródło prawdy, zero synchronizacji.
  - Przeciw: utrata historii odebrania, przepisanie sporej części kodu (`grant/revoke/recalculate`, filtry admina, broadcast `PATRONS/NON_PATRONS`).
- **Rekomendacja:** opcja 1 (mniejsze ryzyko, zachowuje audyt).

### 4.5 Pytania do właściciela

1. **DB-01:** czy od 2026-10-01 była jakaś udana wpłata? Czy możesz sprawdzić w panelu Stripe, czy webhook na `www.pawelperfect.com/api/webhooks/stripe` dostaje odpowiedzi 2xx?
2. Czy "patron" ma oznaczać **każdą** udaną wpłatę (bez progu), czy wpłatę powyżej progu? Od tego zależy, czy `patronThresholdMinor` zostaje.
3. (rozstrzygnięte 2026-10-04: dwa poziomy dostępu, `PATRON` usunięty migracją 2026-10-05)
4. Czy zostawiamy przycisk "Subskrybuj" jako zapis na powiadomienia e-mail? Jeśli tak, scalić `Subscription` z `EmailPreference` (DB-22)?
5. Powiadomienia w serwisie (dzwonek ukryty): przywracamy czy usuwamy moduł (`Notification*`)?
6. `InboundEmail` i skrzynka w panelu admina: usunąć, skoro poczta jest w PP Support?
7. Komentarze z obrazkiem (`Comment.imageUrl`, API przyjmuje, UI nie pokazuje): usunąć?
8. `VideoStatus.UNLISTED` (tylko etykieta): usunąć?
9. Retencja: czy 30-90 dni dla telemetrii odtwarzania i 180 dni dla logowań w `AuditLog` jest OK?
10. Upgrade do Prisma 7 (adapter `pg`, nowy generator): po squashu, jako osobne zadanie?

---

## 5. Szkic migracji czyszczącej i procedura squasha

### 5.1 Migracja czyszcząca

Wykonana jako `20261005210000_cleanup_dead_schema` (opis, dowody, test na danych i lista kontrolna przed wdrożeniem: `docs/architecture/db-cleanup-2026-10-05.md`). Z niedokończonego szkicu zostają do zrobienia (osobno, po sprawdzeniu danych produkcyjnych): zawężenie `StorageProvider` do `SELF_HLS`, usunięcie nadmiarowych indeksów (DB-16) i unikalne indeksy częściowe z DB-03/04/11/19/20 oraz CHECK-i z DB-18. Przed pierwszym z nich uruchomić SELECT-y kontrolne z tego dokumentu (duplikaty `lower(name)`, `lower(email)`, wiele `ACTIVE` tras na film, płatności z `amountMinor <= 0`).

### 5.2 Squash do jednej migracji bazowej

**Czy warto:** tak. Dziś historia to 50 plików, w tym trzy migracje naprawcze dryftu, duplikaty znaczników czasu, migracja usunięta z repo i lista dozwolonych naprawy w `resolve-failed-migrations.ts`, a `_prisma_migrations` ma 12 nadmiarowych wierszy. Produkcja jest jedna, mała (26 MB) i ma pełne zrzuty. Zysk: szybsze i pewniejsze `migrate deploy` od zera (CI, nowe środowiska, odtwarzanie z backupu), koniec skryptu naprawczego, czytelna baza dla upgrade'u do Prisma 7. Historia zostaje w gicie. Nakład S/M.

**Kolejność:** najpierw migracja czyszcząca (5.1), wdrożona i sprawdzona; potem squash, osobnym PR i osobnym oknem serwisowym.

**Procedura:**

1. **Warunki wstępne:** `npx prisma migrate status` na produkcji pokazuje "Database schema is up to date". `git status` jest czysty. Nikt nie wdraża w tym czasie (zatrzymaj automaty i agentów).
2. **Kopia:** `pg_dump -Fc` produkcji do `/opt/serwerek/backups/pre-squash-<data>.dump` i **próbne odtworzenie** do bazy roboczej `squash_check_prod` (`pg_restore`).
3. **Wygenerowanie bazy:**
   ```bash
   mkdir -p prisma/migrations_new/0_baseline
   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script \
     > prisma/migrations_new/0_baseline/migration.sql
   ```
   W Prisma 7 flaga nazywa się `--to-schema`.
4. **Dopisanie ręcznego SQL**, którego Prisma nie generuje: `Comment_one_pinned_per_video_idx` (indeks częściowy z `20260603120000_add_comment_pinning`), wszystkie indeksy częściowe i wyrażeniowe oraz CHECK-i z 5.1 (kroki 7-8). Grep starych migracji po `WHERE`, `CHECK`, `lower(`, `TRIGGER`, `FUNCTION`, `EXTENSION`: dziś jedynym takim obiektem jest wspomniany indeks. Plik zapisać jako UTF-8 bez BOM.
5. **Dowód równoważności:**
   - utwórz pustą bazę `squash_check_new` i zrób w niej `prisma migrate deploy` z nowym katalogiem;
   - porównaj `pg_dump --schema-only --no-owner --no-privileges` obu baz (`squash_check_new` vs `squash_check_prod`) po posortowaniu, plus `npx prisma migrate diff --from-url <prod_copy> --to-url <new> --script` (musi być pusty);
   - każda różnica oznacza dryft, który trzeba wyjaśnić przed krokiem 7.
6. **Podmiana w repo:** usuń stare katalogi z `prisma/migrations`, przenieś `0_baseline`, zostaw `migration_lock.toml`. Usuń `scripts/resolve-failed-migrations.ts`, `db:migrate:repair` i odwołania w `vercel-build.mjs` (jeśli jeszcze istnieje). PR, CI zielone (job `integration-postgres` zbuduje bazę od zera z baseline).
7. **Produkcja (okno serwisowe, przed wdrożeniem obrazu z nowym katalogiem):**
   ```sql
   CREATE TABLE "_prisma_migrations_archive_20261003" AS SELECT * FROM "_prisma_migrations";
   DELETE FROM "_prisma_migrations";
   ```
   potem z kontenera migratora nowego obrazu:
   ```bash
   npx prisma migrate resolve --applied 0_baseline
   npx prisma migrate status   # oczekiwane: up to date
   ```
   Dopiero potem zwykły `deploy.sh` (jego `migrate deploy` nie ma nic do zrobienia).
8. **Inne bazy:** lokalne bazy deweloperskie i testowe oraz nieaktualny Neon trzeba albo postawić od nowa (`migrate reset`), albo potraktować tak samo jak w kroku 7. Nieaktualny Neon najlepiej wyłączyć.

**Ryzyka i jak je ograniczyć:**

| Ryzyko | Ograniczenie |
|---|---|
| Baseline różni się od produkcji (obiekty dodane ręcznie lub dryft) i przyszłe migracje trafią w niespodziankę | krok 5 (porównanie schematów z kopią produkcji) jest obowiązkowy |
| Utrata ręcznego SQL (indeks częściowy, CHECK-i) | krok 4 plus test, który sprawdza istnienie `Comment_one_pinned_per_video_idx` |
| Suma kontrolna: `migrate resolve` zapisuje checksum pliku, a późniejsza edycja `0_baseline/migration.sql` da ostrzeżenie o zmodyfikowanej migracji | po kroku 7 nie edytować pliku baseline |
| Wdrożenie starego obrazu (ze starym katalogiem migracji) po squashu: `migrate deploy` uzna 50 starych migracji za niezastosowane i spróbuje je wykonać na pełnej bazie | rollback po squashu tylko do obrazu zbudowanego **po** squashu; albo przywrócić `_prisma_migrations` z tabeli archiwalnej przed rollbackiem kodu |
| Rollback całości | `TRUNCATE "_prisma_migrations"; INSERT INTO "_prisma_migrations" SELECT * FROM "_prisma_migrations_archive_20261003";` plus `git revert` |

---

## Lepsze rozwiązania (źródła, stan na październik 2026)

- **Squash i baseline w Prisma:** oficjalna procedura (`migrate diff --from-empty --to-schema ... --script` + `migrate resolve --applied`) i ostrzeżenie, że ręczny SQL ginie:
  - https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/squashing-migrations
  - https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining
- **Obiekty, których Prisma nie modeluje (indeksy częściowe i wyrażeniowe, CHECK):** dodawać w dostosowanej migracji: https://www.prisma.io/docs/orm/prisma-migrate/workflows/unsupported-database-features. Prisma 7.4 dodała `partialIndexes` (preview; znany błąd z ciągłym dryftem dla `VarChar` w składni obiektowej): https://www.prisma.io/changelog/2026-02-11, https://github.com/prisma/orm/issues/29415. Indeksów wyrażeniowych (`lower()`) Prisma nadal nie wspiera: https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes
- **Prisma 7** (bez Rusta, obowiązkowy adapter `@prisma/adapter-pg`, generator `prisma-client` z `output`, `prisma.config.ts`): https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7, https://www.prisma.io/changelog/2025-11-19. 7.10 jest najnowszą stabilną, Prisma 8 w RC, Prisma 7 ma 18 miesięcy wsparcia po GA ósemki: https://github.com/prisma/orm/releases, https://github.com/prisma/web/pull/8381
- **Usuwanie wartości enum w Postgresie:** nie ma `DROP VALUE`; nowy typ + `USING col::text::new_type`. Prisma generuje wzorzec `_new`/`_old`, ma też znany błąd przy jednoczesnym tworzeniu tabeli: https://github.com/prisma/orm/issues/15731, https://github.com/prisma/prisma/issues/8137
- **Unikalność bez rozróżniania wielkości liter w PG17:** dokumentacja zaleca kolacje niedeterministyczne zamiast `citext`, ale w PG17 nie wspierają one `LIKE`/`ILIKE`, czego używa panel admina. Dlatego tu rekomenduję unikalny indeks na `lower(name)`:
  - https://www.postgresql.org/docs/17/citext.html (oraz https://access.crunchydata.com/documentation/postgresql17/17.11/citext.html)
  - https://www.cybertec-postgresql.com/en/can-collations-be-used-over-citext/
  - https://aws.amazon.com/blogs/database/manage-case-insensitive-data-in-postgresql/
- **Kolejka na `SKIP LOCKED`:** atomowe `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING`, krótka transakcja przejęcia, reaper z limitem czasu i heartbeatem, indeks częściowy na oczekujących, archiwizacja skończonych zadań. Obecna implementacja to spełnia; brakuje indeksu częściowego i inwariantu "jedno aktywne zadanie na film":
  - https://www.matthewswong.com/en/blog/postgres-skip-locked-job-queue/
  - https://kaleji.dev/posts/for-update-skip-locked-and-when-it-stops-working/
  - https://faizahmed.in/postgres-queue-skip-locked/
- **Retencja tabel zdarzeń:** partycjonowanie czasowe (pg_partman, DROP partycji zamiast DELETE) opłaca się przy dużych wolumenach; przy dziesiątkach tysięcy wierszy wystarczy cron z kasowaniem w paczkach:
  - https://blog.sequinstream.com/time-based-retention-strategies-in-postgres/
  - https://access.crunchydata.com/documentation/pg-partman/latest/pg_partman/
