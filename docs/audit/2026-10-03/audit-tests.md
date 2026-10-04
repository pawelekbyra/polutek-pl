# Audyt testów i CI — pawelperfect.com (stan `main` @ 88c787d0, 2026-10-03)

Audyt tylko do odczytu. Jedyne operacje wykonane lokalnie: `npx vitest run` (pełny przebieg + ponowny przebieg 9 plików), odczyt `gh run list/view` i API GitHub (tylko odczyt). Nic w repo nie zostało zmienione.

---

## 1. Podsumowanie z liczbami

| Miara | Wartość |
|---|---|
| Pliki testowe w `tests/` | **329** (326 `tests/unit`, 2 `tests/integration`, 1 `tests/e2e`) + martwy `tests/setup.ts` |
| Pliki uruchamiane przez Vitest | 327 (e2e to Playwright; `admin-mux-health.test.ts` jest w `exclude` — martwy plik trzymany w repo) |
| Testy (przypadki) wg Vitest | **1960** (1945 zielonych, 13 czerwonych lokalnie, 2 pominięte). CLAUDE.md podaje nieaktualne „1480” |
| Asercje `expect(` | 5183, z czego 1088 (21%) to asercje na wywołania mocków (`toHaveBeenCalled*`, `.mock.calls`) |
| `as any` w testach | 626 (testy są wyłączone z typechecku — patrz §4) |
| Testy na prawdziwym Postgresie, które realnie się wykonują | **0** (jedyny plik DB jest zawsze `it.skip`) |
| E2E w CI | **0** (Playwright nie jest uruchamiany nigdzie) |
| Pliki usuwane przez PR #1614 (dostawcy wideo) | 30 usuniętych + 30 modyfikowanych (nie oceniam ich treści) |

### Klasyfikacja (kategoria główna; F = nakładka „duplikat”)

| Kat. | Opis | Plików | Udział |
|---|---|---|---|
| **a** | statyczne: czytają źródła jako tekst, szukają napisów/regexów | **32** | 10% |
| **b** | tak mocno zmockowane, że sprawdzają głównie mocki | **29** | 9% |
| **c** | testy zachowania na realnej logice (wartościowe) | **230** | 70% |
| **d** | integracyjne z prawdziwym Postgresem | **1** (zawsze pomijany) | 0,3% |
| **e** | testy martwych/usuniętych funkcji | **37** (30 z PR #1614 + 7 innych) | 11% |
| **f** | duplikaty (nakładka, pliki z dowolnej kategorii) | **~73 pliki w 19 grupach** | ~22% |

Do tego **13 plików „e-semantycznych”**: logika jest aktualna, ale nazwy/scenariusze opisują stary model „patron = dostęp” (np. „blocks non-patron from liking a comment on patron-only video” przy zmockowanym `checkVideoAccess`). Zostają w c/b, do przepisania nazw.

### Wynik `npm test` (lokalnie, Windows, 4 rdzenie, maszyna obciążona równoległymi agentami)

- Czas ściany: **1146 s** (transform 181 s, **import 1476 s**, environment 369 s, same testy 286 s). Suma czasów plików 270 s.
- **Test Files 8 failed | 318 passed | 1 skipped (327); Tests 13 failed | 1945 passed | 2 skipped (1960); 1 unhandled error** (`[vitest-pool]: Failed to start forks worker` dla `SupportModal.test.tsx` — timeout startu workera).
- Wszystkie 13 porażek to **`Test timed out in 5000ms` (1× 30000 ms)**, nie błędy logiki. Ponowny izolowany przebieg 9 plików: **15 porażek** w tych samych plikach (wolny dysk/AV + dynamiczny `await import()` w treści testu). W CI na Linuksie te same testy są zielone (job `tests/coverage` 2 min 10 s z `npm ci`).
- Przyczyna systemowa: 19 plików robi `await import(...)` wewnątrz `it(...)`, więc zimny import ciężkiego modułu (Better Auth, Prisma client, Stripe) wlicza się do 5-sekundowego limitu testu. To realna niestabilność (flakiness) zależna od maszyny.

Top 15 najwolniejszych plików (lokalnie):

| s | testów | plik | uwaga |
|---|---|---|---|
| 60,2 | 10 | unit/auth/auth-instance.test.ts | 53 s jeden test: import `@/lib/auth/auth` w teście |
| 51,5 | 4 | unit/modules/email/email-service-broadcast-consent-boundary.test.ts | dynamiczny import w każdym teście |
| 15,1 | 3 | unit/channel-layout-patron-grant.test.ts | dynamiczny import w każdym teście |
| 10,2 | 5 | unit/channel-layout-upcoming-section.test.ts | jw. |
| 7,2 | 3 | unit/components/admin/emails/TemplatesList.test.tsx | jsdom + pierwszy render |
| 6,6 | 4 | unit/components/hero-fundraising-bar.test.tsx | 10 `vi.mock` |
| 6,6 | 10 | unit/components/share-install-menus.test.tsx | |
| 6,5 | 2 | unit/components/hero-support-button.test.tsx | 10 `vi.mock` |
| 5,4 | 4 | unit/services/video-search-service.test.ts | dynamiczny import |
| 5,3 | 2 | unit/components/comments/EmbeddedComments-reaction-isolation.test.tsx | |
| 5,1 | 4 | unit/components/hero-like-dislike-aria.test.tsx | |
| 4,5 | 5 | unit/components/channel/SidebarPlaylist-shared-fetch.test.tsx | |
| 4,0 | 7 | unit/components/auth/account-profile-section.test.tsx | |
| 3,4 | 6 | unit/video-pipeline/finalize-self-hls.test.ts | |
| 3,2 | 2 | unit/components/channel/DonationBox-return-flow.test.tsx | |

Ostrzeżenia: 0 ostrzeżeń `act(...)` w wyjściu; 141 bloków `stderr` (głównie zamierzone logi błędów z testowanych ścieżek: `system-email-consent-boundary` 12, `resend-webhook-route` 8, `cover-upload` 8) — szum, który zasłania prawdziwe ostrzeżenia; 1 nieobsłużony błąd puli workerów; 9 plików używa `vi.useFakeTimers()` (wszystkie przywracają zegar). Pokrycie: patrz §3.0.

---

## 2. Tabela klasyfikacji i listy plików

Rekomendacje: **U** = usunąć, **P** = przepisać na test zachowania, **S** = scalić, **K** = zostawić (ew. przenieść do skryptu jakości).

### a) Testy statyczne (32)

**Strażnicy architektury — mają sens, ale to nie są testy jednostkowe; przenieść do `scripts/check-architecture.ts` (jeden raport, jeden job) albo do reguł ESLint (`no-restricted-imports`, `no-restricted-syntax`):**

| Plik | Rekomendacja |
|---|---|
| unit/admin-mutations-audit-static.test.ts | K → przenieść do check-architecture (sprawdza, że każda mutująca trasa admina woła audyt) |
| unit/admin-mutations-validation-static.test.ts | K → przenieść (każda mutacja ma schemat zod) |
| unit/admin-route-authorization-static.test.ts | K → przenieść |
| unit/modules/email/email-boundary.test.ts | K → `no-restricted-imports` |
| unit/modules/email/forbidden-mutations.test.ts | K → przenieść |
| unit/modules/users/user-deletion-guardrail.test.ts | K → `no-restricted-syntax` (`prisma.user.delete`) |
| unit/r7-boundary.test.ts | K → przenieść (granice modułów) |
| unit/build/current-main-build-safety.test.ts | S → zostawić tylko „brak zdalnych fontów / brak sekretów w plikach”, reszta U |
| unit/legal-docs-consistency.test.ts | K → ewentualnie P: renderować `LegalDocs` i sprawdzać tekst DOM zamiast źródła |
| unit/security/cron-routes-reach-handler.test.ts | S z `auth/middleware-gating.test.ts` (już testuje `/api/cron/x` jako publiczną) + tabela „każdy cron = 401 bez Bearer” (TEST-13) |

**Kruche testy sformułowań — pilnują napisów w JSX/CSS zamiast zachowania:**

| Plik | Co robi | Rekomendacja |
|---|---|---|
| unit/admin-user-access-actions-ui.test.ts | 39 dokładnych fragmentów JSX (`"type=\"button\" variant=\"outline\" ..."`) | P: RTL — otwórz dialog, Anuluj nie woła `fetch`, pusty powód blokuje, podwójny klik = 1 żądanie |
| unit/public-loading-state-ux.test.ts | 67 `toContain` na 9 plikach, w tym CSS | U (zachowanie pokrywają `page-reveal-gate`, `video-player-page-reveal`, `playback-viewer-cache-safety`) |
| unit/visual-system-ux.test.ts | 35 `toContain` | U; zostawić tylko regułę „color-mix ma fallback” jako stylelint/skrypt |
| unit/comments-ui-contract.test.ts | 35 `toContain` | P: RTL dla `CommentComposer`/`CommentItem` (błąd zostaje w polu, rollback optymistyczny) |
| unit/sidebar-search-cleanup-static.test.ts | 35 `toContain` | P: część „sidebar-order” to czysta funkcja — test jednostkowy; reszta U |
| unit/playback-plan-state-messaging.test.ts | 41 `toContain`, wciąż wspomina `PATRON_REQUIRED` | P: `playback-plan-state.ts` to czyste funkcje — test tabelaryczny stan → komunikat/akcja |
| unit/get-safe-playback-state.test.ts | sprawdza **kolejność `indexOf`** w źródle | P: wywołać `getSafePlaybackState()` z danymi (komentarz w pliku sam przyznaje, że to obejście) |
| unit/components/access-lock-overlay-cta.test.ts | regexy w TSX/CSS | S+P z `-source` → jeden test RTL `AccessLockOverlay` (klawiatura, `prefers-reduced-motion`) |
| unit/components/access-lock-overlay-source.test.ts | jw. | S+P |
| unit/components/comments-loading.test.ts | napisy w `EmbeddedComments.tsx` | U (jest `EmbeddedComments-reaction-isolation`) |
| unit/comments-access-harden.test.ts | pilnuje nazwy `isPatronDecorative` | U |
| unit/admin-videos-client-auth-gate.test.ts | 16 `toContain` | P: `renderHook(useAdminVideos)` z 401/403/500 |
| unit/admin-navigation-ux.test.ts | 13 `toContain` | U (zostawić „brak `confirm(`” jako regułę lint) |
| unit/admin-comments-ux.test.ts | debounce sprawdzany w tekście | P: fake timers + RTL albo U |
| unit/admin-dashboard.test.ts | 4 kafelki w źródle | U |
| unit/admin/admin-video-edit-flow-source.test.ts | linki w źródle | U |
| unit/channel-page.test.ts | flaga multi-creator w źródle | U |
| unit/single-channel-copy.test.ts | zakazane słowa w 10 plikach | U |
| unit/thumbnail-media-source.test.ts | zakaz fetch w miniaturach (tekst) | U |
| unit/security/access-source-contract.test.ts | „nie importuje płatności” w tekście | S → `check-architecture` (import boundary) |
| unit/video-player-cloudflare-view-counting.test.ts | tekst `VideoPlayer.tsx` | U (zachowanie: `video-player-view-threshold.test.ts`) |
| unit/comments-privacy.test.ts | mieszany (pół logiki, pół źródła) | P: zostawić część z `lib/comments-public-author` |

### b) Testy sprawdzające głównie mocki (29)

| Plik | Problem | Rekomendacja |
|---|---|---|
| integration/launch-candidate-critical-path.test.ts | 666 linii ręcznego, w pamięci „fałszywego Prismy” + 7 `vi.mock`; nazwa „integration” myli | P: zastąpić prawdziwym testem integracyjnym na Postgresie (TEST-03) |
| unit/modules/payments/fulfill-payment.test.ts | mock repozytorium + modułu patron | S z `.use-case` i P na real-DB |
| unit/modules/payments/fulfill-payment.use-case.test.ts | mock `@/lib/modules/patron` → „nadano grant” = wywołano mock; tytuł o Clerku | S+P |
| unit/modules/payments/payment-access-smoke.test.ts | „revoked grant blocks access” — model sprzed 2026-09-22; mocki | S (E-semantyczny) |
| unit/modules/payments/payment-safety-idempotency.test.ts | mock `stripe`, `fulfill`, `refund`, `dispute` → testuje tylko routing | S z `webhook-orchestration` |
| unit/modules/payments/webhook-orchestration.test.ts | mock `constructEvent` + ręczny prisma | S; podpis testować prawdziwym `generateTestHeaderString` (TEST-04) |
| unit/modules/email/email-service-broadcast-consent-boundary.test.ts | 100% asercji na mockach, 51 s lokalnie | P: real-DB (Subscription+EmailPreference) albo czysta funkcja selekcji odbiorców |
| unit/modules/users/account-deletion-cleanup.use-case.test.ts | 15/16 asercji na wywołaniach prisma | P: real-DB (TEST-11) |
| unit/operations/verify-restored-database.test.ts | 100% asercji na mockowanym `PrismaClient` | K tylko część „bezpieczeństwo env”, reszta U |
| unit/main-channel-maintenance.test.ts | 63% asercji na mockach | P lub U (narzędzie jednorazowe) |
| unit/video-publish-idempotency.test.ts | 100% asercji na mockach (modyfikowany przez #1614) | po #1614: P |
| unit/api-contracts.test.ts | 9 `vi.mock`; „kontrakt” to kształt zwracany przez mock | P: snapshot kluczy odpowiedzi na real-DB lub U (pokrywają testy tras) |
| unit/api-route-smoke.test.ts | „nie zwraca 500” przy wszystkim zmockowanym | U |
| unit/auth-route-boundaries-dynamic.test.ts | 6 mocków, dubluje testy aktora | S do F1 |
| unit/auth/auth-lifecycle-language.test.tsx | 7 mocków, 2 asercje na mockach | P lub U |
| unit/bola-protection.test.ts | mock modułu comments → trasa tylko przekazuje | S z `comments-route` |
| unit/comment-reactions-route.test.ts | 5 mocków, 1 test | S z `comments-route` |
| unit/subscriptions-route.test.ts | 5 mocków; tytuł „open Clerk sign-in” | S z `subscriptions-route-boundary` |
| unit/modules/payments/checkout-route.test.ts | 5 mocków, 2 testy | S w jeden test trasy checkout |
| unit/components/hero-fundraising-bar.test.tsx | 10 `vi.mock` (te same w 3 plikach) | S: jeden `Hero.test.tsx` ze wspólnym harnessem |
| unit/components/hero-like-dislike-aria.test.tsx | jw. | S |
| unit/components/hero-support-button.test.tsx | jw., 100% asercji na mockach | S |
| unit/components/channel-home-shallow-switch.test.tsx | 9 mocków (cały ekran wymockowany) | S: jeden `ChannelHome.test.tsx`; zachowanie lepiej w E2E |
| unit/components/channel-home-support-handoff.test.tsx | 10 mocków; dotyczy ścieżki wyłączonej flagą `TEMP_SUPPORT_AS_MODAL` | S; usunąć razem z flagą |
| unit/components/channel-home-support-modal.test.tsx | 9 mocków | S |
| unit/components/channel/DonationBox.test.tsx | 6 mocków; DonationBox nie jest dziś montowany (flaga) | S w 1 plik |
| unit/components/channel/DonationBox-deep-link-terms.test.tsx | jw. | S |
| unit/components/channel/DonationBox-return-flow.test.tsx | jw. | S |
| unit/hooks/useCheckoutFlow-close.test.tsx | 5 mocków, 67% na mockach | S z `useCheckoutFlow.test.tsx` |

### c) Testy zachowania (230) — wzorcowe przykłady

Najlepsze, warto je traktować jako wzór: `video-pipeline/*` (zwłaszcza `process-encode-job`, `upload-policy`, `multipart-uploader`, `encode-job-state`), `hls/hls-edge-worker` (token z aplikacji weryfikowany przez Workera), `playback-self-hls`, `playback-premiere-gate`, `auth/middleware-gating` (prawdziwy `middleware`), `auth/auth-hooks` (26 przypadków), `auth/nickname`, `auth/sso-return`, `api/admin-csrf`, `api/admin-rate-limit`, `api/admin-schemas`, `modules/access/check-video-access.use-case` (macierz), `modules/video/premiere`, `modules/video/fundraising`, `modules/media/r2-thumbnail`, `modules/video/sync-public-thumbnail.service`, `modules/payments/stripe-lifecycle-smoke`, `modules/payments/admin-refund.use-case`, `modules/subscriptions/signed-unsubscribe`, `components/channel/SupportModal`, `components/support/tip-flow-config`, `components/page-reveal-gate`, `security-headers`, `logger`.

Do grupy c zaliczam też ~40 cienkich testów tras (`api/admin/*-route`, `api/payments/payment-status-route` itd.), które mockują use-case i sprawdzają mapowanie błędów na HTTP — mają wartość, ale tylko razem z testem use-case.

### d) Prawdziwy Postgres (1)

| Plik | Stan |
|---|---|
| integration/email-event-idempotency.test.ts | `itWithDb = RUN_INTEGRATION_TESTS === 'true' ? it : it.skip`; **żaden workflow nie ustawia tej zmiennej**, a job `integration-postgres` uruchamia tylko `prisma migrate deploy && prisma generate && db:smoke`. W zwykłym `npm test` `beforeEach` próbuje połączyć się z `DATABASE_URL` i połyka błąd. Efekt: 0 testów DB. |

### e) Martwe funkcje (37)

**Usuwane przez PR #1614 (30, nie oceniam):** `admin-cloudflare-health`, `admin-mux-health`, `api/media-proxy-route`, `api/webhooks/cloudflare-stream`, `cloudflare-playback-source`, `cloudflare-signed-playback-token.service`, `modules/media/get-gated-media`, `modules/video/{attach-cloudflare-asset, cloudflare-lifecycle, cloudflare-status-mapping, cloudflare-stream-provider, cloudflare-sync-hardening, get-cloudflare-upload-url, handle-cloudflare-webhook, import-legacy-video-to-cloudflare, mux-client, mux-provider, video-distribution-backfill-service, video-distribution-orchestrator-service, video-distribution-plan-service, video-distribution-strategy, video-media-state-dto, video-provider-capabilities, video-provider-job-service, video-provider-reconciler-service, video-provider-webhook-mappers, video-provider-webhook-service, video-repository-assets-1n}`, `playback-access-coverage`, `security/multi-source-video-security`.
Uwaga: po scaleniu #1614 trzeba też usunąć `exclude: ['tests/unit/admin-mux-health.test.ts']` z `vitest.config.ts` i zmienne `MUX_*` z `env` w `ci.yml`.

**Inne martwe (7) — wszystkie U:**

| Plik | Dlaczego martwy |
|---|---|
| unit/stripe-webhook.test.ts | testuje `lib/services/payment.service.ts` — „deprecated bridge used only in tests” (jedyny użytkownik to ten test). Usunąć test **i** plik źródłowy. |
| unit/clerk-ui-guard.test.ts | Clerk usunięty, brak zależności `@clerk/*` |
| unit/regression/referral-decommissioning.test.ts | czyta nieistniejące `app/api/webhooks/clerk/route.ts`; program poleceń usunięty dawno |
| unit/access-policy-decommissioning.test.ts | pilnuje, by nie wróciły pliki usunięte w 2026-06 |
| unit/beta-scope.test.ts | koncepcja „private beta” nieaktualna; lista zakazanych słów w trasach (m.in. „fundraising”, „onboarding”) koliduje z obecnymi funkcjami |
| unit/subscription-patron-guard.test.ts | „Subscription nie daje Patrona” — patron nie daje już dostępu |
| e2e/beta-smoke.spec.ts | zakłada paywall („patron video blocks a non-patron”, „non-patron cannot comment on patron-only material” → 403), endpoint `POST /api/comments` z `videoId`, fallbackowe ID `v_fallback_00x`, YouTube w CRUD admina, `ENABLE_DEMO_FALLBACKS`. Sprzeczny z §4.4 — przepisać od zera (§4). |

**E-semantyczne (13, logika aktualna, opis z ery paywalla → P nazw/scenariuszy):** `modules/comments/{core-flows, r8-access-inheritance, list-comment-replies-public-read, patron-grant-write-access (454 linie testujące, że czegoś *nie* ma), comment-badge-safety, comment-anonymization}`, `modules/users/{get-admin-user-details, get-user-access-profile, list-admin-users, export-admin-users}` (porównują „cache `User.isPatron`” z prawdą, a kolumna nie istnieje od 2026-06-30), `channel-layout-patron-grant`, `modules/payments/payment-access-smoke`, `comment-names` (Clerkowe nazwy generowane — tylko dla legacy rekordów).

### f) Duplikaty (19 grup, ~73 pliki → docelowo ~25)

| Grupa | Pliki | Cel |
|---|---|---|
| F1 aktor/admin | admin-auth-actor-canonicalization, post-merge-verification, auth/admin-guard, admin-access, canonical-boundaries, auth-route-boundaries-dynamic | `auth/actor.test.ts` + `api/admin-guard.test.ts` |
| F2 PATRON = tylko logowanie | patron-grant-truth, access-source-of-truth, channel-layout-patron-grant, patron-tier-comments-sign-in, comments/patron-grant-write-access, comments/r8-access-inheritance, comments/core-flows, comments/list-comment-replies-public-read, security/access-source-contract | jedna macierz w `check-video-access.use-case.test.ts` + jedna macierz uprawnień komentarzy |
| F3 fulfillPayment | fulfill-payment, fulfill-payment.use-case, payment-access-smoke, integration/launch-candidate-critical-path (+ martwy stripe-webhook) | 1 unit + 1 real-DB |
| F4 webhook Stripe | stripe-webhook-route, r7-inventory-audit, payment-safety-idempotency, webhook-orchestration | `payments/stripe-webhook.test.ts` (prawdziwy podpis) |
| F5 webhook Resend / idempotencja | handle-resend-webhook, idempotency-hardening, concurrency-retries, reproduce-idempotency-race, email-event-lock.repository (+ integration/email-event-idempotency) | 1 unit + 1 real-DB |
| F6 refund admina | api/admin-refund-route-body, api/admin/payments-refund-route | 1 |
| F7 trasa subskrypcji | subscriptions-route, subscriptions/subscriptions-route-boundary (+ część api-contracts) | 1 |
| F8 polityka mediów | modules/media.test, media/media-certification, media/media-safety-hardening, thumbnail-hosts-config, media/self-hls-delivery-url | 1 tabelaryczny |
| F9 stan odtwarzacza (statyczne) | access-lock-overlay-cta, access-lock-overlay-source, playback-plan-state-messaging, public-loading-state-ux, get-safe-playback-state | 1 test czystych funkcji + 1 RTL |
| F10 kanał | modules/channel/channel, channel-certification | 1 |
| F11 audyt | modules/audit.test, audit/record-audit-event | 1 |
| F12 sitemap | sitemap, sitemap-security | 1 |
| F13 wyszukiwarka | services/public-video-search, services/video-search-service | 1 |
| F14 powrót SSO | auth/sso-return, auth/sso-callback (`sanitizeReturnPath` w obu) | 1+1 bez powtórzeń |
| F15 komponenty | DonationBox×3, Hero×3, ChannelHome×3, useCheckoutFlow×2, SidebarPlaylist×2 | po 1 pliku na komponent |
| F16 IP klienta | api/client-ip, api/admin-rate-limit (część `getAdminClientIp`) | 1 |
| F17 crony publiczne | security/cron-routes-reach-handler, auth/middleware-gating | 1 |
| F18 język | language-sync, modules/users.test (updateUserLanguage) | 1 |
| F19 komentarze trasa | comments-route, bola-protection, comment-reactions-route | 1 |

---

## 3. Luki w ścieżkach krytycznych

### 3.0 Pokrycie

`vitest.config.ts` zbiera pokrycie tylko dla `app/api/**`, `lib/modules/**`, `lib/services/**`, `lib/api/**`, `lib/auth-utils.ts`, `lib/webhooks/**` — **bez progów** (`thresholds`), więc spadek pokrycia nigdy nie zatrzyma CI. Poza zakresem pomiaru: `lib/auth/**` (Better Auth, hooki!), `middleware.ts`, `workers/**`, `scripts/video-worker.ts`, `lib/video-upload/**`, `app/components/**`. Raport jest tylko artefaktem do pobrania; nikt go nie czyta. Pomiar lokalny nie był tani (pełny przebieg 19 min na tej maszynie), dlatego oceniam luki na podstawie tego, co testy faktycznie wywołują:

Próba pobrania tabeli pokrycia z logu joba `tests/coverage` przez API GitHub kończyła się timeoutem TLS (sieć tej maszyny), więc procentów linii nie podaję. Zamiast tego policzyłem pokrycie **tras API** (czy jakikolwiek test importuje `route.ts`):

- **53 z 107 tras (50%)** ma test, który ją wywołuje. Bez żadnego testu m.in.: `api/user/first-sign-in` (jedyne miejsce wysyłki maila powitalnego i ustawienia pseudonimu), `api/user/nickname`, `api/user/avatar`, `api/avatars/[userId]`, `api/user/profile`, `api/user/notification-preferences`, `api/channel/sidebar`, `api/comments` (POST), `api/comments/[commentId]/{report,replies,context}`, `api/comments/image-upload`, trzy trasy `original-upload/**`, `api/cron/sync-public-thumbnails`, `api/admin/users*`, `api/admin/payments`, `api/admin/comments/[id]/{approve,hold}`, `api/auth/[...all]` (Better Auth handler).
- Trasy admina są dodatkowo pilnowane statycznie (audyt, schemat zod, `requireAdminForApi`), więc ryzyko jest tam mniejsze niż w trasach użytkownika.

### 3.1 Luki (ID, waga, co dopisać)

| ID | Waga | Obszar | Stan | Co dopisać |
|---|---|---|---|---|
| TEST-01 | **P1** | Postgres | 0 wykonywanych testów DB; job `integration-postgres` tylko migruje | Projekt Vitest `integration` z prawdziwym Postgresem 17 (Testcontainers lokalnie, `services: postgres:17` w CI), `prisma migrate deploy` raz w `globalSetup`, izolacja przez osobną bazę/schemat na workera, `RUN_INTEGRATION_TESTS` wywalić |
| TEST-02 | **P1** | kolejka `VideoEncodeJob` | `claimNext` (surowy SQL: `FOR UPDATE SKIP LOCKED`, `pg_try_advisory_xact_lock`, `NOT EXISTS` running, czas z DB), `markSucceeded`, `markFailedOrRetry`, `release`, `markCancelled`, `reportProgress` — **nieprzetestowane**; `enqueue`/`requeueStale` tylko na ręcznie złożonym fałszywym `tx` | Real-DB: (1) dwa równoległe `claimNext` → dokładnie 1 job RUNNING; (2) drugi job nie startuje, gdy jest świeży RUNNING, startuje po wygaśnięciu heartbeatu; (3) `nextAttemptAt` w przyszłości blokuje; (4) `markSucceeded` z obcym `workerId` nic nie zmienia; (5) `requestCancel` vs `claimNext` w wyścigu; (6) dwa równoległe `enqueue` tego samego oryginału → 1 job (advisory lock); (7) `requeueStale` przy zużytych próbach |
| TEST-03 | **P1** | `fulfillPayment` | idempotencja tylko na mockach repozytorium i modułu patron | Real-DB: ten sam `paymentId` 2× równolegle (webhook + fast-path z `GET /api/payments/[id]` + cron reconciliation) → 1 `PatronGrant`, 1 e-mail, `Payment.status=SUCCEEDED`; replay po `SUCCEEDED`; niezgodny `stripeIntentId` → odmowa; kwota poniżej progu → 0 grantów |
| TEST-04 | **P1** | webhook Stripe | `constructEvent` zmockowany we wszystkich testach; brak testu prawdziwego podpisu | Test trasy `POST /api/webhooks/stripe` z `stripe.webhooks.generateTestHeaderString({payload, secret})`: poprawny podpis → 200 i jedno wywołanie; zmieniony bajt treści → 400; zły sekret → 400; znacznik czasu poza tolerancją → 400; ten sam `event.id` 2× → `ALREADY_PROCESSED` (real-DB `StripeEvent`); obsługa `charge.refunded`, `charge.dispute.*` end-to-end do `PatronGrant` |
| TEST-05 | **P1** | `checkVideoAccess` + premiera + `PlaybackService` | dobre testy, ale rozproszone w 7 plikach i zorientowane na Cloudflare (`media-source-safety` 707 linii) | Po #1614 jedna macierz: tier × aktor (gość/user/usunięty/admin) × premiera (przeszła/przyszła) × asset (brak/processing/ready SELF_HLS) × `HLS_TOKEN_SECRET` (jest/brak) → odmowa nigdy nie zawiera `source`, URL, tokenu, `playbackSessionId`, nie tworzy sesji i nie liczy wyświetlenia; plus test trasy `/api/media-source/[videoId]`: brak `s-maxage`/`public` w `Cache-Control` (niezmiennik §4.3, dziś **niesprawdzany**) |
| TEST-06 | P2 | `workers/hls-edge/worker.mjs` | dobry test w Node z fałszywym `caches`/R2 | Uruchomić w prawdziwym workerd przez `@cloudflare/vitest-pool-workers` (≥0.13 wspiera Vitest 4); dopisać: HEAD, metoda inna niż GET/HEAD/OPTIONS, nieznany origin (brak CORS), token wideo A na ścieżce wideo B przez `fetch()` (dziś tylko na `verifyToken`) |
| TEST-07 | P2 | upload multipart | use-case’y świetnie pokryte; **trasy** `app/api/admin/videos/[id]/original-upload/**` (start, parts, complete) bez testów | Test tras: 401/403 dla nie-admina, 400 dla złego schematu, 409 podczas enkodowania, `complete` nie kolejkuje przy złych magic bytes |
| TEST-08 | P2 | worker enkodera | `scripts/video-worker.ts`, `encoder.adapter.ts`, `r2-storage.ts`, `r2-multipart.ts` bez testów; `encode-hls.test` testuje tylko argumenty | Jeden test „dymny” z prawdziwym `ffmpeg` (jest na `ubuntu-latest`): 2-sekundowy syntetyczny klip → `encodeHls()` → poprawny `master.m3u8` i segmenty; R2 przez MinIO lub fałszywy S3 w pamięci; SIGTERM → `release` bez zużycia próby |
| TEST-09 | P2 | Better Auth (`lib/auth/hooks.ts`, instancja) | hooki dobrze testowane na mockach (26); brak testu prawdziwej instancji na bazie; `auth-instance.test` wolny (53–73 s lokalnie) | Real-DB z wtyczką `testUtils` Better Auth: rejestracja → weryfikacja → logowanie → cookie `pp.*`; `EMAIL_TAKEN` (hook *after*, po captcha); pre-hijack guard przy linkowaniu Google do niezweryfikowanego konta; blokada po 10 nieudanych logowaniach; zmiana hasła unieważnia inne sesje |
| TEST-10 | P3 | `middleware.ts` | dobry test (13 przypadków na prawdziwym module) | Dopisać: obecność nagłówka CSP, 429 z limitu admina, `TRUST_CF_CONNECTING_IP` w ścieżce middleware |
| TEST-11 | P2 | usuwanie konta | trasa+reauth na mockach; cleanup sprawdzany wyłącznie przez wywołania prisma (15/16 asercji) | Real-DB: anonimizacja, usunięte `Session/Account/TwoFactor`, nagrobek nie może się zalogować, odmowa usunięcia ostatniego admina, idempotencja |
| TEST-12 | P3 | e-maile transakcyjne | `system-email-consent-boundary`, `email-content`, `auth-emails` — dobre | Tabelaryczny test „każdy slug × PL/EN: brak niewypełnionych `{{…}}`, brak List-Unsubscribe w mailach bezpieczeństwa, `Reply-To`”; snapshot HTML tylko jako kontrola wizualna |
| TEST-13 | P2 | crony | `sync-public-thumbnails` (trasa) bez testu; brak wspólnego testu „każdy cron” | Jeden test tabelaryczny po `app/api/cron/*/route.ts`: bez Bearer → 401 JSON, zły sekret → 401, brak `CRON_SECRET` → 401, poprawny → use-case wywołany; `?dryRun=1` niczego nie usuwa |
| TEST-14 | P2 | Server Actions | `lib/actions/interactions.ts` (polubienia) bez testu — tylko mockowany w testach Hero | Test akcji: gość odrzucony, brak dostępu → odmowa, przełączanie LIKE/DISLIKE nie rusza `likesCount` dla DISLIKE (§4.9) — najlepiej real-DB |
| TEST-15 | P3 | reakcje komentarzy | niezmiennik „DISLIKE nigdy nie zmienia `likesCount`” tylko na mockach | real-DB |
| TEST-16 | P2 | stabilność | 19 plików z `await import()` w teście → przekroczenia czasu na wolnych maszynach | statyczne importy + `vi.hoisted`/`vi.mock`, `vi.resetModules` tylko tam, gdzie env czytany przy imporcie; `testTimeout` jawnie w configu |
| TEST-18 | **P1** | trasy konta użytkownika | `api/user/first-sign-in`, `api/user/nickname`, `api/user/avatar`, `api/avatars/[userId]` bez testu trasy (use-case `completeOnboarding`/`updateNickname`/`updateAvatar` testowane) | Testy tras (najlepiej real-DB): drugi `first-sign-in` odrzucony i **mail powitalny wysłany dokładnie raz**; zajęty pseudonim → 409 bez względu na wielkość liter; avatar: zły typ/rozmiar/sygnatura → 400, `GET /api/avatars/[id]` z poprawnym `Content-Type` i cache; gość → 401; usunięty użytkownik → odmowa |
| TEST-17 | P3 | `support-mail-ingest` Worker | Worker przyjmujący pocztę supportu (od 2026-10-02 produkcyjny MX) bez żadnego testu | Test parsowania i przekazania (forward) w workerd |

---

## 4. CI: znaleziska i docelowy układ jobów

### 4.1 Stan obecny (`ci.yml`, ostatni przebieg `main` 37131876915: ściana **2 min 14 s**)

| Job | Czas | Ocena |
|---|---|---|
| environment validation | 44 s | waliduje env produkcyjny na **fikcyjnych** wartościach z `env:` workflow (w tym `MUX_*`, `REFERRAL_PATRON_THRESHOLD`, `PATRON_MIN_TIP_*`); sprawdza tylko, że skrypt działa. Scalić z „quality” |
| Prisma validation/generation | 44 s | `postinstall` już robi `prisma generate`; dubel. Scalić |
| strict escapes | 38 s | 145 wpisów w baseline; sens tylko jeśli baseline maleje — dodać „baseline nie może rosnąć” i plan wygaszania |
| hotspots | 36 s | 16+ wyjątków `maxLines` z uzasadnieniem „#948 temporary after Next 15 recovery”; scalić z lint |
| architecture boundaries | 30 s | dobre; przejąć tu statyczne testy z §2a |
| control-plane docs | 29 s | sprawdza obecność plików `.md` i fraz w CLAUDE.md — pilnuje dokumentacji, nie produktu; zwija się do 1 kroku w „quality” albo do usunięcia |
| typecheck | 55 s | **nie obejmuje `tests/`, `workers/`, `middleware.ts`, `instrumentation.ts`** (`tsconfig.typecheck.json` wyklucza `tests`, nie wymienia reszty) |
| tests/coverage | 2 min 10 s | jedyny długi; brak progów; artefakt bez konsumenta |
| lint | 62 s | ok |
| build | 51 s | `next build`, ale **nie buduje obrazu Dockera**, który faktycznie idzie na produkcję (`deploy/serwerek/Dockerfile`) |
| integration-postgres | 59 s | **Postgres 16**, produkcja ma **17**; uruchamia tylko migracje + `db:smoke`, **nie uruchamia testów integracyjnych** |
| npm audit/security | 35 s | ok |

Problemy przekrojowe:
1. **12 × `npm ci`** (≈25–30 s każdy) — ok. 6 min minut-runnera na samą instalację na przebieg.
2. **Brak `concurrency`**: każdy push do PR odpala pełny CI, a po merge CI biegnie drugi raz na `main` (np. `chore/ops-mergedeploy` miał 2 równoległe przebiegi PR + przebieg na `main`).
3. Trigger `push` na nieistniejące gałęzie `master`, `work`.
4. Brak `permissions:` na poziomie workflow (domyślny token ma szersze uprawnienia niż trzeba).
5. **Workflow `production-db-migrations.yml` jest martwy**: ręczny `prisma migrate deploy` na `secrets.DATABASE_URL` w środowisku GitHub `production` — to była baza Neon/Vercel. Produkcja to dziś lokalny Postgres na serwerku za tunelem; migracje robi `deploy.sh`. Ryzyko: ktoś kliknie i zmigruje nieaktualną bazę Neon. Usunąć workflow i sekrety środowiska `production`.
6. `npm test` = `vitest` (tryb watch, gdy jest TTY); `quality` dokleja `-- --run`. Skrypt powinien być `vitest run`.
7. Brak: testu migracji od zera z porównaniem do schematu (`prisma migrate diff --from-migrations --to-schema-datamodel --exit-code` — dziś tylko ręczny audyt 2026-09-26), sprawdzenia BOM w migracjach jako osobnego kroku, budowy obrazu Dockera, lintu/testów Workerów (`workers/*` to `.mjs` bez typów), typechecku skryptów `.mjs` i testów, E2E.
8. Brak `timeout-minutes` (domyślnie 360 min na zawieszony job).

### 4.2 Docelowy układ (`ci.yml`)

```yaml
on:
  pull_request:
  push: { branches: [main] }
permissions: { contents: read }
concurrency:
  group: ci-${{ github.workflow }}-${{ github.head_ref || github.run_id }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

| Job | Zawartość | Szac. czas |
|---|---|---|
| `quality` | jedno `npm ci`, potem: `tsc` (app+lib+scripts+**tests**+workers przez `checkJs`), `eslint .`, `check-architecture` (z przejętymi testami statycznymi, hotspots, strict-escapes, BOM w migracjach), `npm audit` | ~2 min |
| `unit` | `vitest run --project unit --project dom` z `--coverage` i **progami** dla `lib/modules/**`, `lib/auth/**`, `middleware.ts` (start = obecny poziom, ratchet w górę); sharding `--shard` tylko gdy >3 min | ~1,5 min |
| `integration` | `services: postgres:17-alpine`; `prisma migrate deploy` od zera + `prisma migrate diff ... --exit-code` (schemat = migracje) + `vitest run --project integration` | ~1,5 min |
| `workers` | `vitest run --project workers` w `@cloudflare/vitest-pool-workers` (hls-edge, support-mail-ingest) | ~1 min |
| `docker` | `docker/setup-buildx-action` + `docker/build-push-action` z `cache-from/to: type=gha,mode=max`, cele `runner` i `worker`; na PR tylko build, na `main` push do GHCR z tagiem SHA (+ `provenance`/SBOM); `deploy.sh` ściąga gotowy obraz zamiast budować na serwerze | ~3 min (z cache ~1 min) |
| `e2e` (po `docker`) | `docker compose -f deploy/serwerek/docker-compose.test.yml` na runnerze (obraz z poprzedniego joba), seed, Playwright tylko Chromium, 5–8 scenariuszy (§4.3) | ~3 min |
| `post-deploy-smoke` (osobny workflow, `workflow_dispatch` + wywoływany z `deploy.sh`) | Playwright **tylko do odczytu** przeciw `https://www.pawelperfect.com` | ~1 min |

Usunąć: `production-db-migrations.yml`, jobs `environment-validation`, `prisma-validation-generation`, `control-plane-docs`, `hotspots`, `strict-escapes` jako osobne joby (wchodzą do `quality`), zmienne `MUX_*`, `REFERRAL_*`, `MEDIA_BUCKET_HOST` z `env`.

### 4.3 E2E — stan i minimalny zestaw smoke

**Stan:** `playwright.config.ts` istnieje (webServer `npm run dev`, `ENABLE_DEMO_FALLBACKS=true`, Chromium), jeden plik `tests/e2e/beta-smoke.spec.ts` (19 testów), `scripts/validate-e2e-env.ts` wymaga `BETTER_AUTH_SECRET` + `DATABASE_URL` lub `E2E_BASE_URL` (komunikat wciąż odsyła do „Vercel/staging secrets”). **Nic z tego nie działa w CI ani nie jest uruchamiane lokalnie**; scenariusze testują model sprzed 2026-09-22 (paywall), endpoint `POST /api/comments` z `videoId`, ID-fallbacki demo, YouTube. Nadaje się do skasowania i napisania od nowa.

**Proponowany zestaw (7 scenariuszy):** stos z `deploy/serwerek/docker-compose.test.yml` na runnerze CI (Postgres 17 + obraz aplikacji + `prisma migrate deploy` + seed z 3 filmami: PUBLIC z SELF_HLS, LOGGED_IN, PATRON z `premiereAt` w przyszłości), zalogowanie przez **Better Auth `testUtils`/seed sesji** (bez UI Google i bez Turnstile — w testach klucz testowy Cloudflare `1x0000…AA` przepuszcza zawsze), Worker HLS zastąpiony atrapą statycznych plików.

1. **Gość, strona główna:** przejście przez bramkę „Follow the white rabbit”, odtwarzacz PUBLIC ładuje `master.m3u8` (żądanie 200), brak błędów konsoli.
2. **Gość, film LOGGED_IN:** widać ścianę logowania; `GET /api/media-source/<id>` → 401/403 bez pól `source`/`url`/`token`.
3. **Zalogowany, film PATRON bez wpłaty:** odtwarza się (to jest model biznesowy — test, który najmocniej chroni przed regresją do paywalla).
4. **Premiera:** zalogowany widzi kokpit COMING_SOON z datą, `media-source` bez źródła; po przestawieniu `premiereAt` w przeszłość (seed/endpoint testowy) film gra bez przeładowania.
5. **Komentarz:** gość widzi komentarze i CTA logowania; zalogowany dodaje komentarz, po odświeżeniu jest na liście; CSRF: `fetch` z obcym `Origin` na `/api/user/*` → 403.
6. **Admin:** `/admin` dla zwykłego usera nie pokazuje panelu, `/api/admin/*` bez sesji → 401 JSON; admin tworzy szkic, zmienia tytuł, archiwizuje.
7. **Bramka napiwku do kroku płatności:** kwota + zgoda → `create-intent` zwraca `clientSecret` (Stripe w trybie testowym lub atrapa przez `next/experimental/testmode/playwright` + MSW); sam Stripe Elements nie jest klikany.

**Smoke produkcyjny po deployu (tylko odczyt, bez logowania):** 1, 2, `GET /api/health` (lub `/api/cron/*` bez tokenu → 401 JSON, nie HTML), nagłówki CSP/HSTS, `robots.txt`/`sitemap.xml` bez prywatnych pól, `video.pawelperfect.com` bez tokenu → 403.

---

## 5. Konfiguracja testów (§6 zlecenia)

- **`tests/setup.ts` jest martwy:** `vitest.config.ts` nie ma `setupFiles`; 18 plików importuje `@testing-library/jest-dom` samodzielnie.
- **Jedno środowisko `node` + 46 docblocków `@vitest-environment jsdom`** zamiast projektów. Workspace jest w Vitest przestarzały od 3.2, zalecane `test.projects` (unit-node / dom / integration / workers).
- **Brak `restoreMocks`/`clearMocks`/`unstubEnvs` w configu** — 36 plików ręcznie ustawia `process.env.X = …` i część nie przywraca (ryzyko przecieków między testami w jednym workerze); zalecane `vi.stubEnv` + `unstubEnvs: true`.
- **Brak fabryk i helperów:** 34 pliki osobno mockują `@/lib/prisma`, 29 osobno `@/lib/logger`, ~20 buduje własny `ctx`/AppContext, 626 × `as any`. Brak katalogu `tests/support/` (fabryki `makeVideo/makeUser/makePayment`, `makeCtx(actor)`, wspólny mock loggera, harness `renderWithProviders`).
- **Aliasy:** `@` przez `test.alias`; Next.js w dokumentacji zaleca `vite-tsconfig-paths` (jedno źródło prawdy z `tsconfig.json`).
- **Wtyczka React:** `@vitejs/plugin-react-swc` — ok.
- **Nazewnictwo i układ:** mieszanka katalogów (`tests/unit/modules/…`, `tests/unit/api/…`) z ~90 plikami luzem w `tests/unit/` o nazwach historycznych (`r7-boundary`, `r8-access-inheritance`, `post-merge-verification`, `launch-security-boundaries`, „certification”, „hardening”, „smoke” dla testów jednostkowych). Nazwa powinna mówić, co jest testowane, nie z jakiego sprintu pochodzi.
- **Typy:** testy wyłączone z `tsc`, więc mocki mogą rozjechać się z prawdziwymi sygnaturami bez sygnału (przy `as any` nawet tego nie widać).

---

## 6. Strategia docelowa i kolejność prac

### 6.1 Zasady (zweryfikowane na październik 2026)

1. **Trofeum testów, nie piramida:** najwięcej testów integracyjnych (use-case + prawdziwy Postgres, trasa + prawdziwy moduł), mniej czystych unitów (tylko czyste funkcje i maszyny stanów), garść E2E, a na dole statyka (TypeScript, ESLint, `check-architecture`). Źródło: Kent C. Dodds, *The Testing Trophy and Testing Classifications* — https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications
2. **Vitest dla logiki, Server Actions i komponentów synchronicznych; async Server Components tylko w E2E** — oficjalne stanowisko dokumentacji Next.js 16.3.8 (aktualizacja 2026-08-25): „Vitest currently does not support them… we recommend using E2E tests for async components”. https://nextjs.org/docs/app/guides/testing/vitest
3. **Projekty Vitest zamiast docblocków i workspace** (workspace przestarzały od 3.2): https://vitest.dev/guide/projects
4. **Prawdziwy Postgres w testach integracyjnych.** Dwie dobre drogi:
   - Testcontainers (`@testcontainers/postgresql`, `postgres:17-alpine`) w `globalSetup`, `prisma migrate deploy`, przekazanie URL przez `provide`/env; baza na workera dla równoległości — https://zenn.dev/onozaty/articles/vitest-testcontainer-prisma?locale=en, https://blog.alexrusin.com/testcontainers-for-postgres/ . W CI prościej i szybciej: `services: postgres:17` + osobna baza na worker.
   - PGlite (Postgres w WASM, w procesie) — bardzo szybki, ale **nie nadaje się do testów kolejki** (`FOR UPDATE SKIP LOCKED`, advisory locks i współbieżność między połączeniami wymagają prawdziwego serwera) i wymaga adaptera Prisma, a projekt jest na Prisma 6 bez driver adapters. https://makerkit.dev/blog/tutorials/unit-testing-prisma-vitest . **Rekomendacja: prawdziwy Postgres 17** (zgodny z produkcją).
5. **Better Auth: oficjalna wtyczka `testUtils`** (fabryki, `login()` zwracający cookies/headers, przechwytywanie OTP) w osobnej, testowej konfiguracji instancji — zamiast ręcznego mockowania `auth()`. https://better-auth.com/docs/plugins/test-utils
6. **Stripe: prawdziwy podpis w testach** przez `stripe.webhooks.generateTestHeaderString` zamiast mockowania `constructEvent`. https://www.npmjs.com/package/stripe
7. **MSW 2 dla zewnętrznego HTTP** (Stripe, Resend, R2/S3, Google) w testach integracyjnych zamiast `vi.mock` modułów — test sprawdza nasze żądanie i naszą reakcję na odpowiedź, a nie wywołanie funkcji. W E2E z serwerem Next: `next/experimental/testmode/playwright` (proxy `fetch` serwera) — eksperymentalne, z ograniczeniami przy częściowym mockowaniu. https://github.com/vercel/next.js/blob/canary/packages/next/src/experimental/testmode/playwright/README.md , https://github.com/laststance/next-msw-integration
8. **Tryb przeglądarkowy Vitest 4 (stabilny) + `vitest-browser-react`** dla komponentów z prawdziwym DOM, CSS i media queries (odtwarzacz, bramka napiwku, `RotateDeviceGuard`, `prefers-reduced-motion`) — zastępuje jsdom tam, gdzie jsdom kłamie (brak layoutu: test `channel-home-support-handoff` musi stubować `offsetParent`). Migracja stopniowa, jsdom zostaje dla prostych komponentów. https://vitest.dev/guide/browser/ , https://github.com/vitest-community/vitest-browser-react
9. **Workers w workerd:** `@cloudflare/vitest-pool-workers` ≥0.13 wspiera Vitest 4, konfiguracja przez `defineConfig` + plugin `cloudflareTest`. https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-from-vitest-3-to-vitest-4/
10. **CI:** `concurrency` z anulowaniem tylko na PR; `setup-node` z `cache: npm`; jeden `npm ci` na job o dużej zawartości; Docker przez Buildx z `type=gha,mode=max` (z `ignore-error=true` dla eksportu cache), publikacja do GHCR. https://runs-on.com/github-actions/concurrency/ , https://docs.docker.com/build/ci/github-actions/cache/

### 6.2 Docelowy układ katalogów i nazw

```
tests/
  support/            # fabryki (makeUser, makeVideo, makePayment, makeEncodeJob), makeCtx(actor),
                      # db.ts (reset/transakcja na test), msw/handlers.ts, render.tsx (providers)
  unit/               # czyste funkcje i maszyny stanów; brak vi.mock modułów domenowych
    <moduł>/<plik>.test.ts       # lustrzane do lib/modules/<moduł>/...
  integration/        # use-case/trasa + prawdziwy Postgres 17 (+ MSW dla HTTP zewnętrznego)
    payments/  playback/  video-pipeline/  auth/  comments/  users/  cron/
  dom/                # komponenty (jsdom, później browser mode)
  workers/            # hls-edge, support-mail-ingest (workerd)
  e2e/                # Playwright: smoke.spec.ts (CI, stos docker), prod-readonly.spec.ts
```
Nazwa pliku = jednostka (`check-video-access.test.ts`, `stripe-webhook.route.test.ts`), nazwa testu = zachowanie („odmawia gościowi bez źródła i tokenu”). Zakaz nazw sprintowych (`r7-`, `post-merge-`, `-certification`, `-hardening`, `-smoke` dla unitów).

### 6.3 Kolejność prac

| Krok | Zakres | Efekt na liczbę plików |
|---|---|---|
| 0 | Scalić PR #1614 (−30 plików), usunąć `exclude` i `MUX_*` z CI | 329 → 299 |
| 1 | Szybkie wygrane (1 PR): usunąć 7 martwych z §2e, `tests/setup.ts` podłączyć jako `setupFiles`, `npm test` → `vitest run`, `concurrency` + `permissions` + `timeout-minutes`, usunąć `production-db-migrations.yml`, Postgres 16→17 | 299 → 292 |
| 2 | Infrastruktura: `test.projects` (unit/dom/integration/workers), `tests/support/` z fabrykami i `makeCtx`, `restoreMocks/unstubEnvs`, statyczne importy zamiast `await import` (TEST-16), tsconfig dla testów i typecheck testów | bez zmian |
| 3 | **Integracja na Postgresie (P1):** TEST-01, TEST-02 (kolejka), TEST-03 (`fulfillPayment`), TEST-04 (webhook Stripe z prawdziwym podpisem), TEST-11 (usuwanie konta); przy okazji usunąć `launch-candidate-critical-path` i zastąpić grupy F3/F4/F5 | −12, +6 |
| 4 | Macierz odtwarzania po #1614 (TEST-05) i wspólny test cronów (TEST-13); scalić F2, F8, F9 | −20, +3 |
| 5 | Przenieść strażników statycznych (§2a, 10 plików) do `check-architecture`/ESLint, usunąć kruche testy sformułowań (~14), przepisać 6 na RTL | −24, +6 |
| 6 | Scalić duplikaty komponentów i tras (F1, F6, F7, F10–F19), przepisać nazwy e-semantyczne | −30 |
| 7 | CI docelowe (§4.2): `quality`, `unit` z progami pokrycia, `integration`, `workers` (TEST-06, TEST-17), `docker` → GHCR, `e2e` 7 scenariuszy, smoke po deployu | +2 (e2e) |
| 8 | Tryb przeglądarkowy Vitest dla odtwarzacza i bramki napiwku; TEST-07/08/09/12/14/15 | +8 |

**Szacunek docelowy:** ok. **210–230 plików** (z ~295 po #1614): ~120 unit (czyste funkcje, maszyny stanów, polityki), ~45 integration (Postgres), ~45 dom/browser, ~4 workers, 2 e2e. Liczba przypadków podobna (ok. 1600–1800), ale udział asercji na mockach z 21% do <8%, testy statyczne 0 (wszystkie w `check-architecture`), testy DB z 0 do ~45 plików, E2E z 0 do 7 scenariuszy w CI + smoke produkcyjny. CI: ściana ~4–5 min z Dockerem i E2E (dziś 2 min 14 s bez nich), ale minut-runnera mniej (4–6 `npm ci` zamiast 12, anulowanie zbędnych przebiegów PR).
