# Polutek.pl — prywatna platforma VOD i patronatu

Polutek.pl to aplikacja **Next.js 14 App Router** dla prywatnego VOD, dobrowolnych napiwków i dostępu premium typu Patron. Repo jest w trybie **beta hardening**: priorytetem jest bezpieczeństwo release, spójność domenowa i pełna weryfikowalność prac kolejnych agentów AI.

## Start dla agentów AI — przeczytaj przed zmianami

Każdy agent rozpoczynający pracę musi wykonać poniższy protokół:

1. Przeczytaj `README.md` do końca, szczególnie sekcję **Roadmapa beta / release hardening**.
2. Przeczytaj dokumenty uzupełniające: `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `KNOWN_LIMITATIONS.md`, `DEPLOY_CHECKLIST.md` i `.env.example`.
3. Nie zakładaj, że aplikacja jest gotowa do bety. Status wynika wyłącznie z uruchomionych komend, testów i smoke testów.
4. Przed pracą sprawdź roadmapę na końcu README:
   - zadania z `[~]` są zaczęte, ale nie wolno traktować ich jako gotowych,
   - zadania z `[ ]` są otwarte,
   - wykonane elementy są usuwane z roadmapy, żeby backlog pokazywał wyłącznie aktualne braki.
5. Po zakończeniu pracy koniecznie zaktualizuj roadmapę na końcu README:
   - usuń punkt tylko wtedy, gdy faktycznie został wykonany i zweryfikowany,
   - jeśli coś nie przeszło przez brak env, DB albo sekretów, oznacz to jako ograniczenie środowiska, a nie jako PASS.
6. Nie wpisuj w kodzie nowych hardkodowanych nazw kanałów ani twórców. Slug/nazwa mają pochodzić z `MAIN_CREATOR_SLUG`, `MAIN_CREATOR_NAME`, `flags.mainCreatorSlug` albo z rekordu `Creator` w bazie.

## Aktualny tryb aplikacji

Aplikacja działa w prywatnej becie jako **single configured creator/channel VOD** z przygotowaniem modelu danych pod przyszły tryb multi-creator. `ENABLE_MULTI_CREATOR=false` jest prawidłowym trybem bety: homepage pokazuje główny skonfigurowany kanał, a `/channel/[MAIN_CREATOR_SLUG]` pozostaje dostępną stroną tego kanału i nie przekierowuje do `/`.

Wartość `MAIN_CREATOR_SLUG` jest wymagana dla spójnych danych produkcyjnych. Jeśli nie jest ustawiona poza produkcją, homepage wybiera zatwierdzonego primary/ostatnio aktualizowanego twórcę z bazy, bez hardkodowania sluga kanału. Model `Creator` traktujemy w becie jako publiczny profil kanału: `Video.creatorId` przypina film do kanału, `Payment.creatorId` przypina napiwek do kanału, a `Subscription.creatorId` przypina zgodę mailową do kanału. Relacje mogą pozostać jako architektura future multi-creator, ale beta nie dostarcza publicznego marketplace’u, onboardingu ani multi-creator dashboardu.

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

**Subscription = zgoda mailowa / obserwowanie kanału / newsletter opt-in.** Model `Subscription` nie może dawać dostępu do materiałów `PATRON`.

Endpoint `/api/subscriptions` obsługuje mailowe follow/unfollow: `GET` zwraca status, `POST` zapisuje zgodę na powiadomienia mailowe, a `DELETE` ją usuwa. Endpoint nie zmienia `User.isPatron` i nie nadaje dostępu premium.

### Out of beta scope: campaign/zrzutka/crowdfunding

Campaign, zrzutka, crowdfunding i fundraising są **poza zakresem prywatnej bety**. W becie nie jest dostarczana żadna campaign page ani crowdfunding page. Stripe zostaje wyłącznie jako dobrowolny napiwek / płatność Patron, czyli flow „Wesprzyj kanał”, „Przekaż napiwek”, „Zostań Patronem” i „Dostęp dla Patronów”.

### Media w prywatnej becie

Upload/transcoding pipeline jest poza zakresem prywatnej bety. Beta dopuszcza wyłącznie administrator-provided trusted media URLs: YouTube/Vimeo albo bezpośrednie pliki i manifesty HLS/DASH z hostów wpisanych w dokładnej allowliście mediów. Publiczne upload routes, onboarding twórców i marketplace multi-creator nie są częścią beta release.

### Twarda zasada

**Patron != Subscription.** Wymagane przypadki testowe do bety:

- subscribed non-patron → nie ma dostępu do `PATRON`,
- patron unsubscribed → nadal ma dostęp do `PATRON`,
- patron subscribed → ma dostęp do `PATRON` i jest zapisany na maile.

## Stack techniczny zgodny z repo

- Next.js 14 App Router, React 18, TypeScript
- Prisma 6.4.1, PostgreSQL
- Clerk auth i webhook
- Stripe checkout/webhook/refund/dispute handling
- Vercel Blob / zewnętrzne media przez bezpieczny proxy endpoint
- Resend email templates
- Tailwind CSS
- Vitest unit tests
- Playwright smoke E2E ma bazowe scenariusze public/gated/admin/media-source oraz ENV-gated scenariusze authenticated; pełne release evidence nadal wymaga stagingu i storage state

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

## Status prawny repo

Repo jest prywatne/proprietary. `package.json` ma `license: "UNLICENSED"`; bez osobnej pisemnej zgody nie zakładaj prawa do redystrybucji kodu.

## Prisma i deploy

Projekt używa Prisma z PostgreSQL i wymaga dwóch URL-i:

- `DATABASE_URL` — połączenie aplikacyjne, może być pooled,
- `DATABASE_URL_UNPOOLED` — bezpośrednie połączenie do migracji.

Manualny porządek deploy:

```bash
npm ci
npx prisma migrate deploy
npx prisma generate
npm run db:smoke
npm run build
```

Vercel powinien używać `npm run vercel-build`, które uruchamia naprawę migracji, deploy migracji, generowanie Prisma Client, `db:smoke` i dopiero potem `next build`.

## Bezpieczeństwo mediów

`/api/media/[...path]` nie jest generycznym proxy URL. Dozwolone są wyłącznie hosty HTTPS z allowlisty:

- `MEDIA_BUCKET_HOST`
- `NEXT_PUBLIC_R2_PUBLIC_HOST`
- `NEXT_PUBLIC_BLOB_PUBLIC_HOST`
- `ALLOWED_MEDIA_HOSTS`

Nie dodawaj szerokich domen providerów. Każdy bucket/CDN host musi być wpisany jawnie. Testy bezpieczeństwa proxy mediów są częścią krytycznej definicji beta.

