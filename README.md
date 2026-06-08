# Polutek.pl — prywatna platforma VOD i patronatu jednego twórcy

Polutek.pl to aplikacja Next.js 14 App Router dla prywatnego VOD, dobrowolnych napiwków i dostępu premium typu Patron. Produkt jest projektowany jako strict single-channel creator hub: jedno oficjalne miejsce twórcy, z własnym katalogiem wideo, patronatem, komentarzami i bezpośrednią relacją z widzami.

Repo jest w trybie beta hardening. Priorytetem są: bezpieczeństwo release, spójność domenowa, odporność na regresje oraz pełna weryfikowalność prac kolejnych agentów AI.

---

## Start dla agentów AI — przeczytaj przed zmianami

Każdy agent rozpoczynający pracę musi wykonać poniższy protokół:

1. Przeczytaj README.md do końca, szczególnie sekcję Roadmapa beta / release hardening.
2. Przeczytaj dokumenty uzupełniające: PROJECT_CONTEXT.md, ARCHITECTURE.md, KNOWN_LIMITATIONS.md, DEPLOY_CHECKLIST.md i .env.example.
3. Nie zakładaj, że aplikacja jest gotowa do bety. Status wynika wyłącznie z uruchomionych komend, testów i smoke testów.
4. Przed pracą sprawdź roadmapę na końcu README.
5. Po zakończeniu pracy zaktualizuj roadmapę.
6. Nie wpisuj w kodzie nowych hardkodowanych nazw kanałów ani twórców. Slug/nazwa mają pochodzić z MAIN_CREATOR_SLUG, MAIN_CREATOR_NAME, flags.mainCreatorSlug albo z rekordu Creator w bazie.
7. Nie wprowadzaj ponownie mechanizmów multi-creator marketplace.
8. Nie dodawaj fallbacków wybierających innego twórcę, jeśli główny kanał nie istnieje.
9. Nie wywołuj setupu, repair ani maintenance z poziomu normalnego runtime'u stron/API.
10. Nie przyjmuj creatorId od publicznych klientów w checkoutcie ani subskrypcjach.
11. Nie oznaczaj pracy jako zakończonej bez realnych wyników komend jakościowych albo jasnego opisu, dlaczego nie mogły zostać uruchomione.

---

## Aktualny tryb aplikacji: strict single-channel

Polutek.pl jest strict single-channel VOD. Prisma Creator pozostaje w bazie jako legacy techniczna reprezentacja głównego kanału, ale produkt nie wspiera publicznego marketplace'u twórców, onboardingu twórców, stron dowolnych twórców, publicznego wyboru twórcy ani płatności na rzecz twórcy wskazanego przez klienta.

W praktyce:

- MAIN_CREATOR_SLUG jest wymagany.
- Skonfigurowany kanał musi istnieć w bazie.
- Skonfigurowany kanał musi mieć isApproved = true.
- Skonfigurowany kanał musi mieć isPrimary = true.
- Publiczne filmy muszą należeć do skonfigurowanego głównego kanału.
- Playback/media access dla nie-adminów musi odrzucać filmy spoza głównego kanału.
- Checkout/płatność musi rozwiązywać główny kanał po stronie backendu.
- Follow/subscription musi dotyczyć głównego kanału po stronie backendu.
- /channel/[MAIN_CREATOR_SLUG] może działać jako alias/route dla głównego kanału.
- Inne strony /channel/[slug] muszą zwracać 404 albo być jawnie niewspierane.
- Creator to legacy nazwa techniczna dla MainChannel.

### Twardy invariant single-channel

```ts
/*
 * This app is strict single-channel.
 *
 * Creator is a legacy Prisma model used as the database representation
 * of the MainChannel.
 *
 * Runtime page loads and normal API requests may read the main channel,
 * but must never create, rename, approve, demote, mark primary, or reassign
 * creators/videos/comments as a side effect.
 *
 * Setup and ownership repair are maintenance-only operations. They must be
 * explicit, previewable, confirmed, and auditable.
 */
```

### Zakazane w normalnym runtime

Poniższe operacje nie mogą występować w zwykłych page loadach, publicznych API, adminowych GET-ach ani normalnych mutation routes:

- creator.create()
- creator.update({ slug: ... })
- creator.update({ isApproved: true })
- creator.update({ isPrimary: true })
- creator.updateMany({ isPrimary: false })
- video.updateMany({ creatorId: ... })
- comment.updateMany({ creatorId: ... })

Są dopuszczalne wyłącznie w:

- explicit maintenance service,
- explicit maintenance admin action,
- ręcznych skryptach,
- migracjach,
- jednorazowym kontrolowanym backfillu.

### Docelowy model mentalny

| Warstwa | Nazwa |
| :--- | :--- |
| Produkt | MainChannel / główny kanał |
| Prisma legacy | Creator |
| Video.creatorId | technicznie: przypięcie filmu do kanału |
| Payment.creatorId | technicznie: przypięcie napiwku/płatności do kanału |
| Subscription.creatorId | technicznie: follow/newsletter opt-in dla kanału |
| Comment.creatorId | legacy albo denormalizacja kanału komentarza |

## Definicje domenowe — najważniejsza spójność do bety

### Patron

**Patron = płatny dostęp premium.** Źródłem prawdy dla dostępu premium jest `User.isPatron` oraz logika usług dostępu i płatności:

- `lib/access/access-policy.ts`
- `lib/access/comment-access.ts`
- `lib/services/patron.service.ts`
- `lib/services/payment.service.ts`
- `lib/services/user-access.service.ts`

Patron może wynikać z kwalifikującego napiwku Stripe, grantu admina, migracji albo rekomendacji, zgodnie z modelem `PatronGrant`.

### Subscription

**Subscription = zgoda mailowa / obserwowanie głównego kanału / newsletter opt-in.** Model `Subscription` nie może dawać dostępu do materiałów `PATRON`.

Endpoint `/api/subscriptions` obsługuje mailowe follow/unfollow głównego kanału:

- `GET` zwraca status follow/subscription dla głównego kanału,
- `POST` zapisuje zgodę na powiadomienia mailowe dla głównego kanału,
- `DELETE` usuwa zgodę dla głównego kanału.

Endpoint nie zmienia `User.isPatron` i nie nadaje dostępu premium.

### Patron != Subscription

Wymagane przypadki testowe do bety:

- subscribed non-patron → nie ma dostępu do `PATRON`,
- patron unsubscribed → nadal ma dostęp do `PATRON`,
- patron subscribed → ma dostęp do `PATRON` i jest zapisany na maile.

### Out of beta scope: campaign/zrzutka/crowdfunding

Campaign, zrzutka, crowdfunding i fundraising są poza zakresem prywatnej bety. W becie nie jest dostarczana żadna campaign page ani crowdfunding page. Stripe zostaje wyłącznie jako dobrowolny napiwek / płatność Patron, czyli flow „Wesprzyj kanał”, „Przekaż napiwek”, „Zostań Patronem” i „Dostęp dla Patronów”.

### Media w prywatnej becie

Upload/transcoding pipeline jest poza zakresem prywatnej bety. Beta dopuszcza wyłącznie administrator-provided trusted media URLs:

- YouTube,
- Vimeo,
- bezpośrednie pliki z hostów wpisanych w allowlistę,
- manifesty HLS/DASH z hostów wpisanych w allowlistę.

Publiczne upload routes, onboarding twórców i marketplace multi-creator nie są częścią beta release.

## Stack techniczny zgodny z repo

- Next.js 14 App Router, React 18, TypeScript
- Prisma 6.4.1, PostgreSQL
- Clerk auth i webhook
- Stripe checkout/webhook/refund/dispute handling
- Vercel Blob / zewnętrzne media przez bezpieczny proxy endpoint
- Cloudflare R2 albo inny jawnie allowlistowany storage/CDN dla mediów, jeśli hosty są wpisane w `ALLOWED_MEDIA_HOSTS` / `MEDIA_BUCKET_HOST`
- Vercel hosting
- Resend email templates
- Tailwind CSS
- Vitest unit tests
- Playwright smoke E2E: bazowe scenariusze public/gated/admin/media-source oraz ENV-gated scenariusze authenticated; pełne release evidence nadal wymaga stagingu i storage state

## Najważniejsze skrypty

```bash
npm ci
npm run dev
npm run quality:strict-escapes
npm run quality:hotspots
npm run typecheck
npm test -- --run
npm run lint
npm run build
npm run db:validate
npm run db:generate
npm run db:smoke
npm run db:migrate:deploy
npm run e2e:list
npm run e2e
npm run content:diagnose
npm run content:fix:main-creator
```

`npm run db:push` jest dopuszczalne tylko do lokalnego prototypowania. Nie wolno używać go jako dowodu gotowości release.

## Konfiguracja środowiska

Wymagane grupy zmiennych:

- baza danych: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`,
- Clerk: klucze publiczne/sekretne i webhook secret,
- Stripe: secret key, publishable key, webhook secret,
- Resend/email: `RESEND_API_KEY`, `EMAIL_FROM`,
- aplikacja: `NEXT_PUBLIC_APP_URL`, `ADMIN_CLERK_USER_IDS`, `MAIN_CREATOR_SLUG`, opcjonalnie `MAIN_CREATOR_NAME` i bootstrapowe `ADMIN_EMAIL`,
- patronat: `PATRON_MIN_TIP_AMOUNT`, `PATRON_MIN_TIP_CURRENCY`, `REFERRAL_PATRON_THRESHOLD`,
- rate limit w produkcji: writable Upstash Redis albo Vercel KV REST credentials,
- media proxy: dokładna allowlista hostów mediów i obrazów,
- healthcheck: `HEALTHCHECK_TOKEN`.

W produkcji rate limit wymaga zapisywalnego Redis/KV. Memory fallback jest dopuszczalny tylko lokalnie i w testach.

`ENABLE_MULTI_CREATOR` został usunięty z runtime. Kod aplikacji nie wspiera już trybu multi-creator.

## Status prawny repo

Repo jest prywatne/proprietary. `package.json` ma `license: "UNLICENSED"`; bez osobnej pisemnej zgody nie zakładaj prawa do redystrybucji kodu.

## Prisma i deploy

Projekt używa Prisma z PostgreSQL i wymaga dwóch URL-i:

- `DATABASE_URL` — połączenie aplikacyjne, może być pooled,
- `DATABASE_URL_UNPOOLED` — bezpośrednie połączenie do migracji.

### Manualny porządek deploy

```bash
npm ci
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run db:smoke
npm run build
```

### Ważne: build nie powinien mutować DB

Build aplikacji i migracje DB powinny być rozdzielone.

Zalecane:

```json
{
  "vercel-build": "npm run db:generate && next build"
}
```

Migracje powinny być wykonywane w osobnym, kontrolowanym kroku CI/CD albo manualnym predeploy:

```bash
npm ci
npx prisma validate
npx prisma migrate deploy
npx prisma generate
npm run db:smoke
```

Nie należy odpalać automatycznego repair migracji, deploy migracji ani smoke DB jako side effectu zwykłego Vercel builda. Build może być powtarany, równoległy albo dotyczyć preview deploymentu, więc nie powinien samodzielnie mutować produkcyjnej bazy.

## Bezpieczeństwo mediów

`/api/media/[...path]` nie jest generycznym proxy URL. Dozwolone są wyłącznie hosty HTTPS z allowlisty:

- `MEDIA_BUCKET_HOST`
- `NEXT_PUBLIC_R2_PUBLIC_HOST`
- `NEXT_PUBLIC_BLOB_PUBLIC_HOST`
- `ALLOWED_MEDIA_HOSTS`

Nie dodawaj szerokich domen providerów. Każdy bucket/CDN host musi być wpisany jawnie. Testy bezpieczeństwa proxy mediów są częścią krytycznej definicji beta.

### Playback/media-source/media-proxy muszą używać access policy scoped do głównego kanału:

- film musi należeć do `mainChannel.id`,
- film musi spełniać status/publishedAt,
- tier access musi przejść,
- nie-admin nie może dostać playbacku do filmu spoza głównego kanału.

## Obecne ograniczenia uczciwe wobec bety

- Nie ma pełnego smoke E2E Playwright potwierdzającego krytyczne kliknięcia użytkownika, login redirect, subskrypcję, Patron access i media proxy.
- Komendy DB wymagają prawdziwych `DATABASE_URL` i `DATABASE_URL_UNPOOLED`; bez nich `db:smoke` i `db:migrate:deploy` nie są dowodem gotowości.
- Stripe, Clerk, Admin i media/rate-limit mają coraz więcej regresji jednostkowych, ale nadal wymagają potwierdzenia na realnym/staging środowisku przed oznaczeniem prywatnej bety.
- W repo nadal istnieją historyczne hardcoded brand/content strings; roadmapa wymaga ich systematycznego usuwania bez zrywania istniejących danych.
- Refaktor strict single-channel musi zostać domknięty w runtime: publiczne listy, sidebar, playback/access, checkout, subscriptions, komentarze i admin video actions muszą konsekwentnie używać głównego kanału.

---

# Roadmapa beta / release hardening

Ta sekcja jest żywym backlogiem do prywatnej bety. Wykonane i odhaczone wcześniej pozycje zostały usunięte — poniżej zostają tylko aktualne braki potwierdzone ponowną analizą kodu oraz raportem gotowości.

Status całego projektu na dziś: **GOTOWE DO DALSZEJ PRACY NAD BETĄ**, nie gotowe do prywatnej bety ani production release.

Legenda:

- `[~]` — rozpoczęte / częściowo potwierdzone, ale nie wolno traktować jako gotowe,
- `[ ]` — otwarte,
- `ENV` — zablokowane brakiem prawdziwych zmiennych środowiskowych, bazy, sekretów albo stagingu.

## 1. P0 — domknąć strict single-channel refactor

Refaktor single-channel został zakończony. Wszystkie normalne runtime flows używają jednego głównego kanału, a mechanizmy multi-creator zostały usunięte z runtime.

- [x] Usunąć `MainCreatorService` i jego wywołania z normalnych page loadów i API routes.
- [x] Usunąć `repairSingleChannelContent` i mutations z normalnego runtime; repair tylko przez explicit maintenance.
- [x] Przepisać `app/api/admin/creator/route.ts` na `MainChannelService.getRequired()`.
- [x] Usunąć `flags.multiCreator` i `ENABLE_MULTI_CREATOR` z runtime.
- [x] Dopiąć `ChannelLayoutService.getSidebarLayout()` do `mainChannel.id` i publikacji.
- [x] Dopiąć admin video actions do `mainChannel.id`.
- [x] Dodać allowlist validation dla media/thumbnail w admin paths.
- [x] Uprościć `/api/subscriptions` i `SubscribeButton`.
- [x] Ustalić strategię dla `Comment.creatorId` (przypisanie z filmu).
- [x] Dodać maintenance preview/apply dla main channel z confirmation phrase.
- [x] Dodać testy regresyjne single-channel.

## 2. P0 — staging smoke dla krytycznych ścieżek płatności, dostępu i admina

Unit tests i scaffolding E2E nie są dowodem bety. Nadal brakuje artefaktów ze stagingu z prawdziwymi sekretami, prawdziwą bazą, realną sesją Clerk, Stripe test mode i hostami mediów z allowlisty.

- [ ] `ENV` Uruchomić staging deploy na prawdziwej bazie i wykonać `npx prisma migrate deploy` bez driftu.
- [ ] `ENV` Uruchomić `npm run db:smoke` na staging/prod-like DB i zapisać wynik jako release evidence.
- [ ] `ENV` Przejść smoke: guest → login → komentarz → logout/redirect.
- [ ] `ENV` Przejść smoke: Stripe success → webhook → `Payment`/`PatronGrant` → `User.isPatron` → Clerk access sync → dostęp do materiału `PATRON`.
- [ ] `ENV` Przejść smoke: partial refund, full refund i lost dispute → cofnięcie albo korekta Patron access zgodnie z polityką.
- [ ] `ENV` Przejść smoke admin: login admina → channel settings → video CRUD → widoczność opublikowanego materiału.
- [ ] `ENV` Przejść smoke media: public video, login-gated video, patron-gated video, media proxy/range request oraz HLS/DASH z dozwolonego hosta.

## 3. P1 — coverage, E2E i release evidence w CI

Vitest posiada konfigurację coverage i progi jakościowe. CI publikuje raport jako artefakt.

- [~] Rozbudować Playwright smoke: zrealizowane homepage, channel page, public video, guest blocks dla login-gated/patron-gated, subscription vs Patron access, comments access, checkout unauthorized guard, admin block, media-source denial, ENV-gated non-patron/admin checks oraz ENV-gated admin video CRUD mutation.
- [ ] Zebrać i podlinkować/zapisać pierwsze zielone zdalne przebiegi GitHub Actions dla quality, integration-postgres i E2E/staging smoke.

## 4. P1 — konfiguracja runtime, Node matrix i ukryte fallbacki

Runtime Node jest ujednolicony na Node 22 przez `.nvmrc`, `package.json#engines` i GitHub Actions (`actions/setup-node` czyta `.nvmrc`). `ClerkLocalizationProvider` nie używa już build-time placeholdera dla `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; brak klucza jest błędem walidacji env i jawnie zatrzymuje provider. Nadal trzeba potwierdzić produkcyjne zależności środowiskowe na realnym deployu.

- [ ] Potwierdzić produkcyjne Redis/KV dla rate limitów na realnym środowisku; memory fallback pozostaje wyłącznie dev/test.
- [ ] Potwierdzić produkcyjne allowlisty hostów mediów/obrazów w ENV, bez szerokich domen providerów.

## 5. P1 — deploy safety i migracje poza buildem

Build aplikacji nie powinien naprawiać ani migrować produkcyjnej bazy.

- [ ] Zmienić `vercel-build` na `npm run db:generate && next build`.
- [ ] Wydzielić migracje do osobnego kontrolowanego kroku predeploy/CI.
- [ ] Usunąć automatyczny repair migracji z build pipeline.
- [ ] Potwierdzić `npx prisma migrate deploy` i `npm run db:smoke` na staging/prod-like DB jako osobne release evidence.

## 6. P1 — performance, observability i alertowalne sygnały

Logger i audit logi są dobrą bazą, ale nadal brakuje metryk, request IDs, tracingu i alertów dla flows, które decydują o pieniądzach, dostępie i mediach.

- [ ] Dodać request ID / correlation ID do krytycznych flows.
- [ ] Dodać alertowalne sygnały dla Stripe webhook failure, PatronGrant failure, media proxy denial spike, auth/webhook failures i email broadcast failures.
- [ ] Uporządkować dashboard/observability dla staging i produkcji.

## 7. Finalna walidacja przed prywatną betą

Wykonać z czystego stanu:

```bash
rm -rf node_modules .next
npm ci
npx prisma validate
npx prisma generate
npm run quality:strict-escapes
npm run quality:hotspots
npm run typecheck
npm test -- --run
npm run lint
npm run build
npm run db:validate
npm run db:generate
npm run db:smoke
npm run db:migrate:deploy
```

Nie wolno oznaczyć statusu **GOTOWE DO PRYWATNEJ BETY**, dopóki wszystkie komendy jakościowe i DB nie mają faktycznego PASS albo jawnie zaakceptowanego środowiska testowego.

## 8. Raport końcowy każdego agenta

Każdy agent kończący większy etap ma dopisać w PR/odpowiedzi:

- status: `NIEGOTOWE`, `GOTOWE DO DALSZEJ PRACY NAD BETĄ`, `GOTOWE DO PRYWATNEJ BETY`, `GOTOWE DO MAŁEGO PRODUCTION RELEASE` albo `GOTOWE DO PUBLICZNEGO RELEASE`,
- komendy przed/po zmianach i ich realny wynik,
- zmienione pliki,
- naprawione problemy,
- Prisma review,
- TypeScript review,
- Subscription vs Patron review,
- Channel page review,
- Stripe review,
- Clerk review,
- Media proxy security review,
- Admin review,
- Rate limit review,
- ENV validation review,
- testy dodane/poprawione,
- coverage/E2E/CI status,
- pozostawione `console.*` i `any`,
- znane ograniczenia,
- blokery public release,
- jeden konkretny następny krok.
