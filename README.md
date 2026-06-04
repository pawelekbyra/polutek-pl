# Paweł Perfect - Private VOD & Donation Platform

## Important for AI coding agents
Before changing code, read `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `KNOWN_LIMITATIONS.md`, and `DEPLOY_CHECKLIST.md`.
This project should be developed according to product behavior, not only technical stack.

A modern, responsive media platform for exclusive content, built with Next.js 14, Tailwind CSS, and Prisma. This project is designed with a professional "YouTube-style" aesthetic and features a permanent content locking mechanism for supporters based on lifetime donation value.

## Project Vision
Paweł Perfect is a private service. It serves as a central hub for exclusive media where users can gain permanent access to restricted "Materials" by leaving a voluntary donation.

### Key Concept: Reward for Support
- **Not a Subscription**: We don't sell access as a service. Instead, we accept voluntary donations and grant permanent access as a token of gratitude.
- **Patron Status**: Patron status is currently granted by a single qualifying donation. Payment totals are tracked per currency (`UserPaymentTotal`) which is the primary source of truth for total value.
- **Public Discovery**: One primary featured video is always public, serving as a gateway to the platform.

## Current App Mode
The portal currently runs as a **single-creator / monokanał VOD**. By default, `ENABLE_MULTI_CREATOR=false` keeps the homepage scoped to the creator configured in `MAIN_CREATOR_SLUG` (currently `polutek`) and redirects that creator's channel URL back to `/` to avoid duplicate SEO content.

Multi-creator support remains a future platform mode and should be enabled explicitly with `ENABLE_MULTI_CREATOR=true` only when open creator discovery/onboarding is ready.

## Architecture & Scalability
The platform is built with future growth and high performance in mind:

- **Multi-Tenancy**: The current production scenario is one primary channel. The data model prepares for selected users to create channels in the future, but full multi-creator onboarding is not implemented yet.
- **Clean Architecture**: Business logic is decoupled from API routes into a dedicated Service Layer (`lib/services/`), facilitating testing and maintainability.
- **Connection Pooling**: Optimized for serverless environments using connection pooling to prevent database exhaustion.
- **Secure VOD Delivery**: Secure media delivery through `/api/media/:videoId` with access checks and range-request support. HLS/DASH can be added later.
- **Social Features**: Multi-level threaded comments, image attachments, and likes for high community engagement.

## Technology Stack
- **Framework**: [Next.js 14 (App Router)](https://nextjs.org/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Database**: [Postgres (Neon/Supabase)](https://neon.tech/) with [Prisma 6+](https://www.prisma.io/)
- **Payments**: [Stripe](https://stripe.com/)
- **Storage**: [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
- **Email**: [Resend](https://resend.com/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [shadcn/ui](https://ui.shadcn.com/)

## Database Configuration

This project uses Prisma with PostgreSQL. It requires two database connection strings in your environment variables:

- `DATABASE_URL`: Can be a pooled connection string (e.g., using Prisma Accelerate or Neon's connection pooling).
- `DATABASE_URL_UNPOOLED`: Should be a direct/unpooled connection string. This is used by Prisma for migrations and other direct database operations.
  - *Note: If your environment does not provide a separate direct URL, you can temporarily set `DATABASE_URL_UNPOOLED` to the same value as `DATABASE_URL`, but a dedicated direct URL is recommended for production.*

## Getting Started

### Prerequisites
- Node.js 18+
- Postgres instance
- Clerk project keys
- Stripe account & webhook secret

### Installation
```bash
npm install
npx prisma generate
npm run dev
```

### Database Migrations
For local development, create/apply migrations with:
```bash
npm run db:migrate:dev
```
For production environments, deploy checked-in migrations only:
```bash
npm run db:migrate:deploy
# equivalent: npx prisma migrate deploy
```

On Vercel, the project build command must be `npm run vercel-build`; this repository enforces that in `vercel.json`. The command intentionally runs `prisma migrate deploy`, `prisma generate`, `db:smoke`, then `next build`, so migrations are applied before Next.js reads Prisma models during build. For production preflight, run either:
```bash
npm run predeploy:prod
npm run build
```
or:
```bash
npm run vercel-build
```
`npm run db:push` / `npx prisma db push` is reserved for local prototyping only and must not be used for production deploys.

*Note: Production deployments must use `prisma migrate deploy` to ensure database schema consistency. Hard delete of production data is discouraged; prefer status updates (e.g., `VideoStatus.ARCHIVED`).*

### Creator Studio v1 Features
The admin panel at `/admin` includes several enhancements for content management:
- **Scoped Hero Videos**: Toggling a video as "Hero" (isMainFeatured) only unsets other featured videos for the **same creator**, supporting multi-creator environments.
- **Manual Sidebar Ordering**: Use the `sidebarOrder` field to manually prioritize videos in the sidebar. Sorting follows `sidebarOrder` (desc), then `publishedAt` (desc).
- **Smart Creator Selection**: New videos are automatically assigned to the primary creator (`isPrimary: true`) or fallback to the creator configured by `MAIN_CREATOR_SLUG`.
- **Safety Constraints**: The system prevents setting non-public or non-published videos as the main featured material.

### Local content for the homepage
The homepage reads real `PUBLISHED` videos from the database. Demo fallback data remains opt-in only and is not enabled by omission. To get visible materials locally, use one of these paths:

1. **Seed MVP Content (Paweł Perfect)**:
   This is the recommended path for the initial setup. It initializes the "Paweł Perfect" channel and populates the main featured video.
   ```bash
   # 1. Ensure migrations are applied
   npm run db:migrate:dev

   # 2. Run the main seed script
   npm run db:seed

   # 3. Run the content fix script to ensure MVP branding
   npm run content:fix:polutek
   ```
   The seed creates the primary `polutek` creator named "Paweł Perfect" and sets the main featured video using its R2 URL.

2. Add a video in the admin panel with status `PUBLISHED`; the backend sets `publishedAt` automatically and attaches it to the approved creator.
3. For local/demo development only, explicitly opt in to fallback content:
   ```env
   ENABLE_DEMO_FALLBACKS=true
   ```
   Do not rely on this in production.

### Testing
Run unit tests with Vitest:
```bash
npm test
```

## Verification Checklist
1. [ ] Homepage loads correctly with a featured video.
2. [ ] Homepage shows "No materials" state when the database is empty.
3. [ ] Public videos play via `/api/media/:id`.
4. [ ] Direct `videoUrl` is not present in public component props or DTOs.
5. [ ] `REGISTERED` tier videos show paywall for guest users.
6. [ ] `PATRON` tier videos show paywall for regular logged-in users.
7. [ ] `PATRON` tier videos are accessible to patrons.
8. [ ] Stripe webhook correctly fulfills payments and grants Patron status.
9. [ ] Reaching the referral goal (5 points) grants Patron status and syncs to Clerk.
10. [ ] Webhook idempotency prevents double-processing of Stripe events.

## Legal
The platform operates on a donation basis. All "Tips" or "Donations" are voluntary contributions to the creator, not payments for services or products. Detailed terms are available on the `/regulamin` page.

## Production hardening requirements

### Rate limiting
Production rate limiting requires writable Upstash Redis REST credentials. Configure either `UPSTASH_REDIS_REST_URL` plus `UPSTASH_REDIS_REST_TOKEN`, or the Vercel KV fallback names `KV_REST_API_URL` plus `KV_REST_API_TOKEN`. Do not use `KV_REST_API_READ_ONLY_TOKEN` for rate limiting because the limiter must write counters. If no writable pair is available with `NODE_ENV=production`, the application logs `Missing Redis env vars: set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN.` and fails fast instead of falling back to an in-memory limiter. The in-memory limiter exists only for local development and tests because serverless memory is per-instance and resets on cold starts.

`/api/media/:videoId` is rate-limited per authenticated user (or client IP for guests) and per media id. The limit is intentionally higher than comment limits to allow normal video player `Range` requests while still bounding streaming costs.

### Media host allowlist
The media proxy is not a generic image or URL proxy. It accepts only exact HTTPS hosts configured through:

```env
MEDIA_BUCKET_HOST=
NEXT_PUBLIC_R2_PUBLIC_HOST=
NEXT_PUBLIC_BLOB_PUBLIC_HOST=
ALLOWED_MEDIA_HOSTS=
```

Configure concrete bucket/CDN hosts such as `my-bucket.example.r2.dev` or `media.example.com`; do not configure broad provider domains such as `r2.dev`, `r2.cloudflarestorage.com`, or `vercel-storage.com`. Subdomains are not implicitly trusted—add each required host explicitly.

### Refund and dispute policy
Payments store `refundedAmountMinor` so refund webhooks are idempotent by amount. A repeated Stripe refund event does not subtract totals twice.

- Partial refund: payment status becomes `PARTIALLY_REFUNDED`, `UserPaymentTotal.amountMinor` is reduced to net paid totals, and patron grants are retained.
- Full refund: payment status becomes `REFUNDED`, net totals are reduced, and patron grants tied to that payment are revoked.
- Lost chargeback/dispute: payment status becomes `CHARGEBACK_LOST`, the remaining net paid amount (`amountMinor - refundedAmountMinor`) is removed from `UserPaymentTotal.amountMinor`, and patron grants tied to that payment are revoked.

Clerk `publicMetadata.totalPaid` is synchronized from net normalized payment totals after refund/dispute handling.

### Clerk webhook idempotency
`ClerkEvent` records webhook delivery ids and prevents duplicate side effects. `PROCESSED` events are skipped, `FAILED` events can be retried, and `PROCESSING` events are retried after a five-minute staleness timeout so a crashed worker cannot block an event forever.

### Production deploy order
Vercel uses the `vercel-build` npm script, which runs production migrations before building. A deploy must fail rather than build against a database that has not received the current Prisma migrations.

Use this order for manual deployments and when debugging Vercel builds:

```bash
npm ci
npx prisma migrate deploy
npx prisma generate
npm run db:smoke
npm run build
```

The `db:smoke` check performs minimal Prisma `findFirst` queries that select critical columns including `User.isPatron`, `User.patronSince`, `User.patronSource`, `Video.titleEn`, `Video.descriptionEn`, `PatronGrant.paymentId`, and `PatronGrant.referralId`. A `P2022` failure means the active `DATABASE_URL` still has schema drift and must be migrated before traffic is promoted.

Required production environment groups: database URLs available during the Vercel build (`DATABASE_URL` and, when used, `DATABASE_URL_UNPOOLED`), Clerk keys and webhook secret, Stripe keys and webhook secret, Resend email settings, writable Redis REST URL/token (`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` or Vercel `KV_REST_API_URL`/`KV_REST_API_TOKEN`), exact media host allowlist values, `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAIL=pawel.perfect@gmail.com`, `PATRON_MIN_TIP_AMOUNT=500`, `PATRON_MIN_TIP_CURRENCY=EUR`, `REFERRAL_PATRON_THRESHOLD=5`, `DISPLAY_USD_TO_PLN_RATE=4.0`, and `HEALTHCHECK_TOKEN`.

Before promoting the deployment, verify `/`, `/admin`, `/admin/videos`, `/admin/channel`, `/admin/users`, `/admin/emails`, `/api/media/:videoId`, and `/api/checkout/create-intent` do not return 500 responses, and confirm Vercel logs no longer contain missing-column `P2022` errors such as `Video.titleEn` or `User.patronSource`.
UWAGA NAJWAZNIEJSZE. CHEMY DOKONCZYC BETE. REALIZUJ PONIŻSZY PROMPT DZIELĄC GO NA KOLEJNE ZADNIA. PO ZAKONCZONEJ PRACY AI AGENTA ZMIEN README TAK ABY ODZNACZYC JUZ ZROBIONE RZECZY: MASTER PROMPT — KRAUFANDING-MAIN 62(8) BETA / RELEASE HARDENING

## Kontekst repo

Pracujesz na repozytorium:

kraufanding-main

To aplikacja:

Next.js 14 App Router
React 18
TypeScript
Prisma 6.4.1
PostgreSQL
Clerk
Stripe
Vitest
Playwright dependency already present
Vercel

W repo istnieją już m.in.:

app/
lib/
prisma/
tests/unit/
scripts/
README.md
ARCHITECTURE.md
DEPLOY_CHECKLIST.md
KNOWN_LIMITATIONS.md
.env.example

W package.json są już skrypty:

{
"dev": "next dev",
"build": "next build",
"start": "next start",
"lint": "next lint",
"typecheck": "tsc --noEmit",
"test": "vitest",
"db:push": "prisma db push",
"db:seed": "prisma db seed",
"db:verify": "npx ts-node scripts/verify_db.ts",
"db:smoke": "tsx scripts/db-smoke.ts",
"db:generate": "prisma generate",
"db:setup:dev": "npm run db:push && npm run db:seed",
"db:migrate:dev": "prisma migrate dev",
"db:migrate:repair": "tsx scripts/resolve-failed-migrations.ts",
"db:migrate:deploy": "prisma migrate deploy",
"predeploy:prod": "npm run db:migrate:repair && npm run db:migrate:deploy && npm run db:generate && npm run db:smoke && npm run emails:ensure-required",
"postinstall": "prisma generate",
"content:diagnose": "npx tsx scripts/diagnose-home-content.ts",
"content:fix:main-creator": "npx tsx scripts/fix-main-creator-content.ts",
"content:ensure:welcome": "npx tsx scripts/ensure-welcome-template.ts",
"emails:ensure-required": "npx tsx scripts/ensure-required-emails.ts",
"clerk:resync": "npx tsx scripts/resync-clerk-access.ts",
"db:validate": "prisma validate",
"vercel-build": "npm run db:migrate:repair && npm run db:migrate:deploy && npm run db:generate && npm run db:smoke && next build"
}

Jeżeli w repo istnieją skrypty, pliki, testy lub wpisy dokumentacyjne zawierające hardkodowany slug kanału/twórcy, zmień je tak, aby korzystały z `process.env.MAIN_CREATOR_SLUG`, `flags.mainCreatorSlug` albo `Creator.slug`.

W repo istnieją migracje:

prisma/migrations/0_init
prisma/migrations/20260603120000_add_comment_pinning
prisma/migrations/20260603130000_refactor_email_templates
prisma/migrations/20260603140000_add_video_presentation_columns
prisma/migrations/20260604120000_add_user_patron_source
prisma/migrations/20260605000000_production_sync
prisma/migrations/20260605001000_production_schema_drift_guard

Nie zakładaj, że projekt jest gotowy. Masz go doprowadzić do możliwie bezpiecznego stanu beta/release.

## GLOBALNA ZASADA DOTYCZĄCA NAZW KANAŁÓW/TWÓRCÓW

W całym procesie zabronione jest hardkodowanie nazw kanałów/twórców.

Nie wolno wpisywać na sztywno żadnej konkretnej nazwy kanału ani twórcy.

Nie używaj też opisowych zamienników typu „główny kanał”, „główny twórca” ani nazw własnych kanału/twórcy jako fallbacku, przykładu lub stałej wartości.

Zamiast tego zawsze używaj wartości dynamicznej:

process.env.MAIN_CREATOR_SLUG
flags.mainCreatorSlug
wartości pobranej z bazy danych, np. Creator.slug

Dotyczy to całego kodu, testów, seedów, skryptów, sitemap, Playwright smoke tests, komunikatów UI, modali, dokumentacji i raportów końcowych.

Jeżeli potrzebny jest slug kanału/twórcy, musi on pochodzić z env albo z bazy danych. Nie wolno wpisywać go ręcznie.

## ROLA

Pracujesz jako Staff / Principal Full-Stack Engineer oraz Release Engineer.

Specjalizujesz się w:

Next.js App Router
TypeScript strict
Prisma
PostgreSQL
Stripe
Clerk
Vercel
Security Engineering
CI/CD
Test Automation
Release Readiness

Twoim zadaniem jest naprawić realne problemy w tym repo, dodać brakujące testy, usunąć legacy blokady subskrypcji, rozdzielić domenowo Subscription od Patron, poprawić stronę kanału, uruchomić walidację release i przygotować raport końcowy.

## NAJWAŻNIEJSZE ZASADY

### Nie wolno

Nie wolno:

wyłączać TypeScript strict
dodawać skipLibCheck jako ukrycia błędów
używać @ts-ignore
usuwać testów tylko po to, żeby przechodziły
ukrywać błędów przez any
dodawać any bez uzasadnienia
zmieniać logiki biznesowej bez testów
usuwać funkcji użytkowych bez uzasadnienia
oznaczać PASS, jeśli komenda nie została uruchomiona
logować sekretów, tokenów, signed URL-i, danych kart, pełnych webhook payloadów
mieszać Subscription z Patron
hardkodować nazw kanałów/twórców
używać nazw kanałów/twórców jako fallbacków, przykładów lub wartości testowych
używać określeń „główny kanał” albo „główny twórca”

### Wolno

Możesz:

dodawać testy
dodawać migracje
poprawiać schema.prisma
poprawiać serwisy
tworzyć komponenty
dodawać logger
dodawać env validation
dodawać CI
dodawać Playwright smoke tests
dodawać coverage
aktualizować dokumentację

## DEFINICJE DOMENOWE DLA TEGO REPO

### Patron

Patron oznacza płatny dostęp premium.

Źródłem prawdy dla patron access jest obecnie:

User.isPatron

oraz powiązana logika:

lib/access/access-policy.ts
lib/access/comment-access.ts
lib/services/patron.service.ts
lib/services/payment.service.ts
lib/services/user-access.service.ts

AccessPolicy.canViewVideo() już używa User.isPatron dla AccessTier.PATRON. Nie wolno tego zastąpić subskrypcją.

### Subscription

Subscription w prisma/schema.prisma istnieje jako:

model Subscription {
id        String   @id @default(uuid())
userId    String
creatorId String
createdAt DateTime @default(now())

user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
creator Creator @relation(fields: [creatorId], references: [id], onDelete: Cascade)

@@unique([userId, creatorId])
@@index([userId])
@@index([creatorId])
}

W komentarzu model jest opisany jako legacy channel-follow/subscription records.

Od teraz Subscription ma oznaczać wyłącznie:

zgodę mailową / obserwowanie kanału / newsletter opt-in

Nie może dawać patron access.

### Twarda zasada

Patron != Subscription

Wymagane przypadki:

subscribed non-patron -> NIE ma patron access
patron unsubscribed -> nadal ma patron access
patron subscribed -> ma patron access i jest zapisany na maile

## ETAP 0 — PEŁNA DIAGNOZA STARTOWA

Na początku uruchom:

node -v
npm -v

npm ci

npx prisma validate
npx prisma generate

npm run typecheck
npm test -- --run
npm run lint
npm run build

Uruchom też istniejące skrypty:

npm run db:validate
npm run db:generate
npm run db:smoke
npm run db:migrate:deploy

Jeżeli środowisko nie ma bazy/secrets i komendy DB nie mogą przejść, oznacz je jako SKIPPED albo FAILED_ENV, nie jako PASS.

Zapisz wyniki do raportu:

komenda
status
najważniejszy output
czy jest blokerem

## ETAP 1 — PRISMA I GENEROWANY KLIENT

Zweryfikuj:

prisma/schema.prisma

W tym repo schemat zawiera już enumy:

enum AccessTier {
PUBLIC
LOGGED_IN
PATRON
}

enum VideoStatus {
DRAFT
PUBLISHED
UNLISTED
ARCHIVED
}

enum SystemRole {
ADMIN
USER
}

enum PaymentStatus {
PENDING
SUCCEEDED
FAILED
CANCELED
REFUNDED
PARTIALLY_REFUNDED
DISPUTED
CHARGEBACK_LOST
}

Jeżeli pojawiają się błędy typu:

Cannot find module '.prisma/client/default'
Module '"@prisma/client"' has no exported member 'AccessTier'
Module '"@prisma/client"' has no exported member 'PrismaClient'
Module '"@prisma/client"' has no exported member 'VideoStatus'

to nie usuwaj importów z aplikacji. Napraw generowanie Prisma:

npx prisma validate
npx prisma generate

Sprawdź:

lib/prisma.ts
prisma.config.ts.bak
package.json postinstall

Dodaj brakujące aliasy skryptów, jeżeli potrzebne:

{
"scripts": {
"prisma:validate": "prisma validate",
"prisma:generate": "prisma generate"
}
}

Zweryfikuj migracje:

npx prisma migrate status
npx prisma migrate deploy

Szczególnie zwróć uwagę na:

20260605000000_production_sync
20260605001000_production_schema_drift_guard
scripts/resolve-failed-migrations.ts

## ETAP 2 — TYPECHECK

Doprowadź do:

npm run typecheck

PASS.

Szczególnie sprawdź realne miejsca z ryzykiem any:

app/admin/videos/page.tsx
app/api/admin/videos/route.ts
app/api/media/[...path]/route.ts
app/components/profile/TipsList.tsx
app/components/playlist/CheckoutModal.tsx
lib/blob.ts
lib/actions/interactions.ts
lib/actions/user.ts
lib/services/payment.service.ts
lib/services/content.service.ts
lib/services/user.service.ts
tests/unit/**/*.test.ts

Znane przykłady do poprawy:

const [videos, setVideos] = useState<any[]>([]);
const handleEdit = (vid: any) => { ... }
const handleDuplicate = (vid: any) => { ... }
} catch (error: any) {
prefetchedVideo?: any

Zastępuj any przez:

unknown + walidacja
Prisma.VideoGetPayload<...>
Prisma.UserGetPayload<...>
Prisma.TransactionClient
z.infer<typeof schema>
lokalne DTO

Nie dodawaj skipLibCheck.

## ETAP 3 — LOGGER I USUNIĘCIE PRODUKCYJNYCH CONSOLE

W repo istnieje:

lib/logger.ts

Obecnie logger jest cienkim wrapperem na console.*.

Popraw go tak, żeby wspierał:

logger.debug()
logger.info()
logger.warn()
logger.error()

i dawał bezpieczne logowanie w production.

Następnie zamień produkcyjne console.* na logger szczególnie w:

app/admin/emails/page.tsx
app/admin/layout.tsx
app/admin/users/UserPatronActions.tsx
app/admin/videos/page.tsx
app/api/access/route.ts
app/api/admin/**
app/api/comments/**
app/api/health/route.ts
app/api/media/[...path]/route.ts
app/api/user/**
app/api/webhooks/clerk/route.ts
app/api/webhooks/stripe/route.ts
lib/actions/**
lib/blob.ts
lib/errors.ts
lib/rate-limit.ts
lib/services/**

Nie loguj:

sekretów
tokenów
signed URL
pełnych payloadów webhooków
danych kart
pełnych nagłówków auth

Webhooki loguj tylko przez metadane:

event id
event type
user id
payment id
status
sanitized error

## ETAP 4 — STRONA KANAŁU /channel/[slug]

Realny plik:

app/channel/[slug]/page.tsx

Obecnie na początku jest logika:

if (!flags.multiCreator && params.slug === flags.mainCreatorSlug) {
redirect('/');
}

Usuń ten redirect.

Wymaganie:

/channel/${process.env.MAIN_CREATOR_SLUG}

ma działać również przy:

ENABLE_MULTI_CREATOR=false

Strona kanału ma pokazywać:

banner
avatar
nazwę
slug
bio
liczbę filmów
grid wszystkich opublikowanych filmów
przycisk Subskrybuj/Subskrybowano

Obecnie plik używa <img> dla banneru i avatara. Zamień na next/image, jeżeli lint tego wymaga.

Sprawdź też:

app/components/Hero.tsx
app/components/ChannelHome.tsx
app/sitemap.ts

W Hero.tsx linki do kanału już są:

href={video.creator?.slug ? `/channel/${video.creator.slug}` : "#"}

Upewnij się, że działają dla wartości pochodzącej z `Creator.slug`.

W app/sitemap.ts obecnie ścieżka /channel/${flags.mainCreatorSlug} jest dodawana tylko gdy flags.multiCreator jest true:

...(flags.multiCreator ? [`/channel/${flags.mainCreatorSlug}`] : [])

Zmień tak, aby ścieżka /channel/${flags.mainCreatorSlug} była w sitemapie niezależnie od ENABLE_MULTI_CREATOR.

Dodaj test, że:

/channel/${process.env.MAIN_CREATOR_SLUG}

nie redirectuje do / przy:

ENABLE_MULTI_CREATOR=false
MAIN_CREATOR_SLUG ustawionym w env testowym

Nie wpisuj na sztywno konkretnej nazwy kanału w teście. Pobierz slug z process.env.MAIN_CREATOR_SLUG albo użyj wartości Creator.slug z danych testowych.

## ETAP 5 — SUBSKRYPCJA MAILOWA: USUNIĘCIE LEGACY BLOKAD

Realne pliki legacy:

app/actions/subscription.ts
app/api/subscriptions/route.ts
lib/services/user.service.ts

Obecnie app/actions/subscription.ts zwraca:

{
success: false,
error: 'SUBSCRIPTIONS_LEGACY',
message: 'Subskrypcje nie są już mechanizmem dostępu...'
}

Obecnie app/api/subscriptions/route.ts dla POST zwraca:

{ error: 'SUBSCRIPTIONS_LEGACY', ... }

status 410

Obecnie lib/services/user.service.ts zawiera legacy:

static async toggleSubscription(_userId: string, _creatorId: string) {
return { isSubscribed: false, legacy: true };
}

static async isSubscribed(_userId: string, _creatorId: string) {
return false;
}

To trzeba naprawić.

### Nowe znaczenie

Subskrypcja oznacza:

zgodę na otrzymywanie maili z nowościami z danego kanału/twórcy

Nie oznacza patron access.

### Backend

Zaimplementuj realne operacje na modelu Subscription.

POST /api/subscriptions ma przyjmować:

{
creatorId?: string
creatorSlug?: string
subscribe: boolean
}

Jeżeli brak creatorId, użyj creatorSlug albo flags.mainCreatorSlug.

POST ma zwracać:

{
isSubscribed: boolean,
subscribersCount: number
}

GET ma zwracać:

{
isSubscribed: boolean
}

Wymagania:

guest -> 401 albo login flow po stronie UI
logged user -> może subskrybować
POST subscribe=true -> tworzy Subscription idempotentnie
POST subscribe=false -> usuwa Subscription idempotentnie
Creator.subscribersCount jest aktualizowany spójnie
brak duplikatów dzięki @@unique([userId, creatorId])
subskrypcja nie modyfikuje User.isPatron
odsubskrybowanie nie modyfikuje User.isPatron

W UserService zastąp legacy:

toggleSubscription()
isSubscribed()

prawdziwą implementacją.

Rozważ dodanie metod:

UserService.toggleChannelSubscription(userId, creatorId, subscribe)
UserService.getChannelSubscriptionStatus(userId, creatorId)

## ETAP 6 — KOMPONENT SUBSKRYPCJI

Dodaj komponent, np.:

app/components/SubscribeButton.tsx

albo w podobnym miejscu.

Ma obsługiwać:

Subskrybuj
Subskrybowano
loading
error
guest login
modal zgody
modal odsubskrybowania

### Guest flow

Jeżeli użytkownik nie jest zalogowany:

kliknięcie Subskrybuj -> Clerk Sign In
po loginie -> powrót na tę samą stronę

Użyj Clerk openSignIn() albo odpowiedniego redirect URL.

### Zalogowany user

Po kliknięciu Subskrybuj pokaż modal:

Subskrypcja kanału

Subskrybując, zgadzasz się na otrzymywanie maili z nowościami z tego kanału.

Możesz zrezygnować w każdej chwili.

Przyciski:

Anuluj
Zgadzam się i subskrybuję

Po sukcesie:

Subskrybowano

### Odsubskrybowanie

Po kliknięciu Subskrybowano pokaż modal:

Cofnąć subskrypcję?

Nie będziesz otrzymywać maili z nowościami z tego kanału.

Przyciski:

Anuluj
Cofnij subskrypcję

Po sukcesie wróć do:

Subskrybuj

### Gdzie dodać

Dodaj przycisk na:

app/channel/[slug]/page.tsx
app/components/Hero.tsx

Na stronie kanału przycisk powinien być obok informacji o kanale.

Na stronie filmu w Hero.tsx przycisk powinien być obok nazwy twórcy lub obok akcji like/share.

Nie hardkoduj nazwy kanału w tekście modala. Jeżeli chcesz pokazać nazwę kanału, pobierz ją z danych twórcy, np. Creator.name albo Creator.slug.

## ETAP 7 — TESTY SUBSCRIPTION VS PATRON

W repo istnieją już testy:

tests/unit/access-policy.test.ts
tests/unit/comment-access.test.ts
tests/unit/patron-service.test.ts
tests/unit/payments.test.ts
tests/unit/refunds.test.ts
tests/unit/user-service.test.ts
tests/unit/media-security.test.ts
tests/unit/clerk-webhook.test.ts
tests/unit/admin-dashboard.test.ts

Dodaj lub rozszerz testy.

### Obowiązkowe testy

#### Subscribed non-patron

Warunek:

User.isPatron=false
Subscription istnieje
Video.tier=PATRON

Oczekiwane:

AccessPolicy.canViewVideo -> allowed=false
reason=PATRON_REQUIRED

#### Patron unsubscribed

Warunek:

User.isPatron=true
Subscription nie istnieje
Video.tier=PATRON

Oczekiwane:

AccessPolicy.canViewVideo -> allowed=true

#### Patron subscribed

Warunek:

User.isPatron=true
Subscription istnieje
Video.tier=PATRON

Oczekiwane:

AccessPolicy.canViewVideo -> allowed=true

#### Toggle subscription

Testuj UserService.toggleSubscription() lub nową metodę:

subscribe tworzy rekord
subscribe drugi raz jest idempotentne
unsubscribe usuwa rekord
unsubscribe drugi raz jest idempotentne
subscribersCount jest poprawny
User.isPatron nie zmienia się

#### API /api/subscriptions

Testuj:

GET guest
GET logged user
POST guest
POST subscribe=true
POST subscribe=false
POST invalid creator
POST idempotency

W testach nie używaj konkretnej nazwy kanału. Użyj process.env.MAIN_CREATOR_SLUG albo dynamicznego Creator.slug.

## ETAP 8 — MEDIA PROXY SECURITY

Realne pliki:

lib/blob.ts
app/api/media/[...path]/route.ts
tests/unit/media-security.test.ts
lib/media/video-source.ts
lib/media/rate-limit.ts

W lib/blob.ts istnieją funkcje:

parseMediaHosts()
getAllowedMediaHosts()
isAllowedMediaUrl()
isAllowedVideoSourceUrl()
isAllowedCommentImageUrl()
isAllowedAvatarUrl()
isAllowedThumbnailUrl()
getGatedBlobResponse()

Obecnie isAllowedMediaUrl() dopuszcza tylko https i hosty z allowlisty, co jest dobrym początkiem, ale trzeba jawnie dopiąć SSRF hardening.

Wymagania:

blokuj localhost
blokuj 127.0.0.1
blokuj ::1
blokuj private IPv4
blokuj private IPv6
blokuj link-local
blokuj 169.254.169.254
blokuj metadata endpoints
blokuj hosty spoza allowlisty
blokuj http:
blokuj file:
blokuj protocol-relative URLs
nie bądź open proxy
nie przekazuj niezwalidowanych user headers
nie loguj pełnego targetUrl ani signed URL

W getGatedBlobResponse() jest:

prefetchedVideo?: any
console.error(...)
console.log(`[MediaProxy] Fetching configured media host: ${targetHost} ...`)

Zmień any na konkretny typ.

Zamień console.* na logger.

Nie loguj blobUrl ani targetUrl.

Rozszerz:

tests/unit/media-security.test.ts

o przypadki SSRF i allowlist.

## ETAP 9 — STRIPE

Realny plik:

lib/services/payment.service.ts
app/api/webhooks/stripe/route.ts
app/api/checkout/route.ts
app/api/checkout/create-intent/route.ts
tests/unit/payments.test.ts
tests/unit/refunds.test.ts

Wymagania:

checkout success
webhook signature validation
webhook idempotency
payment success nadaje User.isPatron
refund aktualizuje payment status
refund odbiera patron grant, jeżeli access wynikał z tej płatności
chargeback/dispute obsłużony
duplicate event nie zmienia stanu drugi raz
nie logować pełnych payloadów Stripe

W payment.service.ts są już statusy:

REFUNDED
PARTIALLY_REFUNDED
DISPUTED
CHARGEBACK_LOST

Są też logi console.log, console.warn. Zamień je na logger.

Sprawdź minimum:

PaymentService.handleStripeEvent()
PatronService
StripeEvent idempotency
Payment.status transitions
PatronGrant revocation

Dodaj testy dla:

checkout.session.completed
payment_intent.succeeded
charge.refunded
charge.dispute.created
charge.dispute.closed / lost
duplicate event

Jeżeli eventy mają inne nazwy w obecnym kodzie, trzymaj się realnej implementacji, ale pokryj refund i dispute.

## ETAP 10 — CLERK WEBHOOK

Realne pliki:

app/api/webhooks/clerk/route.ts
lib/webhooks/clerk-idempotency.ts
lib/services/user.service.ts
tests/unit/clerk-webhook.test.ts

W app/api/webhooks/clerk/route.ts są liczne console.log i console.error.

Wymagania:

verify Svix signature
idempotency po svix_id
user.created
user.updated
user.deleted
brak duplikatów
soft delete działa
nie logować pełnych payloadów
welcome email failure nie wywraca całego webhooka, jeśli obecna logika tak zakłada

Zamień logi na logger.

Dodaj lub popraw testy:

duplicate Clerk event
invalid signature
missing email
user.created sync
user.updated sync
user.deleted soft delete

## ETAP 11 — ADMIN

Realne pliki:

app/admin/layout.tsx
app/admin/page.tsx
app/admin/videos/page.tsx
app/admin/users/page.tsx
app/admin/users/UserPatronActions.tsx
app/admin/channel/page.tsx
app/admin/channel/ChannelSettingsForm.tsx
app/api/admin/**
lib/auth-utils.ts
tests/unit/admin-dashboard.test.ts

Wymagania:

guest -> 401 albo redirect login
non-admin -> 403 albo redirect zgodny z obecną konwencją
admin -> dostęp
API admina chronione
brak any w app/admin/videos/page.tsx
brak produkcyjnych console

app/admin/videos/page.tsx ma obecnie useState<any[]> i handlery z any. Zdefiniuj typ AdminVideoDTO zgodny z API /api/admin/videos.

W app/api/admin/videos/route.ts jest catch (error: any). Zmień na unknown + bezpieczne parsowanie błędu.

## ETAP 12 — RATE LIMIT

Realne pliki:

lib/rate-limit.ts
lib/media/rate-limit.ts
app/api/checkout/create-intent/route.ts
app/api/user/referrals/claim/route.ts

W lib/rate-limit.ts istnieje komunikat o memory store i Redis env.

Zweryfikuj:

production nie może cicho działać na memory-only limiterze, jeśli Redis jest wymagany
brak Redis w production -> czytelny błąd
development/test może mieć fallback memory, ale jawnie

Sprawdź rate limit dla:

checkout
comments
media
referrals
webhooki, jeśli dotyczy
subscriptions
admin actions, jeśli dotyczy

Dodaj rate limit dla /api/subscriptions, jeśli go nie ma.

Rozszerz:

tests/unit/rate-limit.test.ts

## ETAP 13 — ENV VALIDATION

Dodaj centralną walidację env, np.:

lib/env.ts

albo:

lib/config/env.ts

Waliduj przynajmniej:

DATABASE_URL
DATABASE_URL_UNPOOLED
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_APP_URL
APP_URL
MEDIA_BUCKET_HOST
NEXT_PUBLIC_R2_PUBLIC_HOST
NEXT_PUBLIC_BLOB_PUBLIC_HOST
ALLOWED_MEDIA_HOSTS
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
REDIS_URL
HEALTHCHECK_TOKEN
MAIN_CREATOR_SLUG
ENABLE_MULTI_CREATOR
ENABLE_DEMO_FALLBACKS
PATRON_MIN_TIP_AMOUNT

Rozróżnij:

development
test
production
Vercel preview/staging

Nie wymagaj sekretów Stripe/Clerk w testach jednostkowych, jeśli testy ich mockują.

W production brak krytycznych ENV ma dawać czytelny błąd bez wypisywania wartości sekretu.

Zaktualizuj .env.example.

MAIN_CREATOR_SLUG ma być źródłem sluga kanału/twórcy używanego jako domyślny kontekst działania aplikacji. Nie dodawaj fallbacku z konkretną nazwą kanału.

## ETAP 14 — LINT

Doprowadź do:

npm run lint

PASS.

W tym repo szczególnie sprawdź:

app/channel/[slug]/page.tsx - <img>
app/admin/videos/page.tsx - any, unused imports
app/components/Hero.tsx - console.error, useEffect deps
app/components/VideoPlayer.tsx - next/image external hosts config
app/sitemap.ts

Nie wyłączaj reguł globalnie tylko po to, żeby lint przeszedł.

## ETAP 15 — TESTY I COVERAGE

Doprowadź do:

npm test -- --run

PASS.

Obecnie skrypt test to:

"test": "vitest"

npm test -- --run powinno uruchamiać Vitest jednorazowo.

Dodaj skrypt:

{
"coverage": "vitest run --coverage"
}

Jeżeli potrzeba, dodaj dev dependency:

npm i -D @vitest/coverage-v8

W coverage uwzględnij:

lib/access/**
lib/services/payment.service.ts
lib/services/patron.service.ts
lib/services/user.service.ts
lib/blob.ts
app/api/subscriptions/route.ts
app/api/webhooks/**
app/api/admin/**

Nie wymagaj nierealnych progów od razu, ale raport ma pokazać wynik coverage i luki.

## ETAP 16 — PLAYWRIGHT SMOKE

W package.json są już zależności:

"@playwright/test": "^1.58.2",
"playwright": "^1.58.2"

Ale nie ma widocznego playwright.config.ts ani tests/e2e.

Dodaj:

playwright.config.ts
tests/e2e/smoke.spec.ts

Dodaj skrypt:

{
"e2e": "playwright test"
}

Minimalne smoke tests:

/ ładuje się bez 500
/channel/${process.env.MAIN_CREATOR_SLUG} ładuje się i nie redirectuje do /
kliknięcie nazwy kanału w Hero prowadzi do /channel/${Creator.slug}
kliknięcie avatara w Hero prowadzi do /channel/${Creator.slug}
guest klikający Subskrybuj trafia do Clerk Sign In
logged user może zobaczyć modal zgody
logged user może subskrybować
logged user może odsubskrybować
non-admin nie wchodzi do /admin/videos
admin wchodzi do /admin/videos, jeśli dostępne dane testowe

Jeżeli Clerk/Stripe wymagają staging secrets, przygotuj testy i oznacz w raporcie, czego brakuje do ich uruchomienia.

Nie hardkoduj sluga kanału w Playwright. Pobierz go z process.env.MAIN_CREATOR_SLUG albo z danych testowych.

## ETAP 17 — CI/CD

W repo nie ma widocznego .github/workflows/ci.yml.

Dodaj:

.github/workflows/ci.yml

Minimalny job quality:

npm ci
npx prisma validate
npx prisma generate
npm run typecheck
npm test -- --run
npm run lint
npm run build

Dodaj też, jeśli skonfigurowane:

npm run coverage
npm run e2e

Rekomendowana struktura:

quality
integration-postgres
security

### quality

ubuntu-latest
Node 20 albo 22
npm ci
prisma validate
prisma generate
typecheck
unit tests
lint
build

### integration-postgres

Postgres service
DATABASE_URL
DATABASE_URL_UNPOOLED
prisma migrate deploy
db:smoke
opcjonalnie Playwright

### security

Jeżeli możliwe:

npm audit --audit-level=high
npm sbom --package-lock-only --sbom-format cyclonedx

Opcjonalnie:

CodeQL
Dependabot
Gitleaks
Semgrep
OSV-Scanner

Nie oznaczaj skanów jako PASS, jeśli nie zostały realnie uruchomione.

## ETAP 18 — DOKUMENTACJA

Zaktualizuj:

README.md
ARCHITECTURE.md
DEPLOY_CHECKLIST.md
KNOWN_LIMITATIONS.md
.env.example

Dokumentacja musi jasno mówić:

Subscription = zgoda mailowa / obserwowanie kanału
Patron = płatny dostęp premium
Patron != Subscription

Zaktualizuj też informacje o:

Node/npm
npm ci
Prisma validate/generate
migrate deploy
db:smoke
testy
coverage
E2E
CI
Stripe webhook
Clerk webhook
media proxy allowlist
rate limit
logger
ENV validation
MAIN_CREATOR_SLUG jako dynamiczne źródło sluga kanału/twórcy
zakazie hardkodowania nazw kanałów/twórców

W KNOWN_LIMITATIONS.md wpisz uczciwie wszystko, czego nie udało się domknąć.

## ETAP 19 — FINALNA WALIDACJA

Na końcu uruchom z czystego stanu:

rm -rf node_modules .next

npm ci

npx prisma validate
npx prisma generate

npm run typecheck
npm test -- --run
npm run lint
npm run build

Jeżeli istnieją po zmianach:

npm run coverage
npm run e2e
npm run db:validate
npm run db:generate
npm run db:smoke
npm run db:migrate:deploy

uruchom również.

Nie używaj db push jako dowodu release readiness.

## DEFINITION OF DONE

Możesz zakończyć wyłącznie, jeśli masz faktyczne wyniki:

PASS npm ci
PASS prisma validate
PASS prisma generate
PASS typecheck
PASS tests
PASS lint
PASS build

Oraz dla funkcji krytycznych:

PASS /channel/${process.env.MAIN_CREATOR_SLUG}
PASS brak redirectu /channel/${process.env.MAIN_CREATOR_SLUG} -> /
PASS Subskrybuj na stronie kanału
PASS Subskrybuj na stronie filmu
PASS guest -> Clerk Sign In
PASS logged user -> modal zgody
PASS subscribe
PASS unsubscribe
PASS Subscription nie daje patron access
PASS Patron unsubscribed nadal ma patron access
PASS media proxy security tests
PASS Stripe payment/refund/dispute tests
PASS Clerk webhook tests
PASS admin access tests
PASS brak hardkodowanych nazw kanałów/twórców w kodzie, testach i dokumentacji

Jeżeli coś nie przechodzi, nie wolno dać statusu GOTOWE DO MAŁEGO PRODUCTION RELEASE.

## RAPORT KOŃCOWY

Przygotuj raport:

# Release Readiness Report

## Status

Wybierz dokładnie jeden:

* NIEGOTOWE
* GOTOWE DO DALSZEJ PRACY NAD BETĄ
* GOTOWE DO PRYWATNEJ BETY
* GOTOWE DO MAŁEGO PRODUCTION RELEASE
* GOTOWE DO PUBLICZNEGO RELEASE

## Podstawa statusu

Krótko: status wynika z konkretnych komend, testów, builda i smoke testów.

## Komendy przed zmianami

| Komenda | Status | Wynik | Bloker |
| ------- | ------ | ----- | ------ |

## Komendy po zmianach

| Komenda | Status | Wynik | Bloker |
| ------- | ------ | ----- | ------ |

## Zmienione pliki

Lista plików i opis zmian.

## Naprawione problemy

Lista konkretnych problemów.

## Prisma review

* validate
* generate
* migrate status/deploy
* schema changes
* migrations

## TypeScript review

* typecheck result
* usunięte any
* pozostawione any z uzasadnieniem

## Subscription vs Patron review

Potwierdź:

* Subscription = zgoda mailowa / channel follow
* Patron = płatny dostęp premium
* Patron != Subscription
* subscribed non-patron nie ma patron access
* patron unsubscribed nadal ma patron access
* patron subscribed działa normalnie

## Channel page review

* /channel/${process.env.MAIN_CREATOR_SLUG}
* brak redirectu
* banner/avatar/name/slug/bio/count/grid
* linki z Hero i ChannelHome
* sitemap
* brak hardkodowania nazwy kanału/twórcy

## Stripe review

* checkout
* webhook
* idempotency
* refund
* dispute/chargeback
* patron access

## Clerk review

* create
* update
* delete
* signature
* idempotency
* login flow

## Media proxy security review

* allowed hosts
* private IP
* localhost
* metadata endpoints
* SSRF
* logging

## Admin review

* guest
* non-admin
* admin
* API protection

## Rate limit review

* checkout
* comments
* media
* subscriptions
* referrals
* production Redis behavior

## ENV validation review

* required env
* optional env
* test/dev/prod differences
* missing env behavior
* MAIN_CREATOR_SLUG
* brak fallbacku na hardkodowaną nazwę kanału/twórcy

## Testy dodane lub poprawione

Lista.

## Coverage

* czy działa
* wynik
* luki

## E2E / Smoke

| Obszar | Test | Status | Uwagi |
| ------ | ---- | ------ | ----- |

## CI/CD

* czy workflow istnieje
* joby
* co blokuje merge
* czego brakuje

## Dokumentacja

Lista zaktualizowanych plików.

## Pozostawione console

Lista i uzasadnienie.

## Pozostawione any

Lista i uzasadnienie.

## Hardcoded channel/creator names review

Potwierdź:

* brak hardkodowanych nazw kanałów/twórców w aplikacji
* brak hardkodowanych nazw kanałów/twórców w testach
* brak hardkodowanych nazw kanałów/twórców w seedach/skryptach
* brak hardkodowanych nazw kanałów/twórców w dokumentacji
* używane są process.env.MAIN_CREATOR_SLUG, flags.mainCreatorSlug albo Creator.slug
* nie są używane opisowe zamienniki typu „główny kanał” albo „główny twórca”

## Znane ograniczenia

Lista.

## Blokery public release

Lista.

## Następny krok

Jedna konkretna rekomendacja.

Ocena ma wynikać wyłącznie z wyników komend i testów. Nie pisz „powinno działać”. Pisz tylko, co faktycznie przeszło, co nie przeszło i czego nie udało się uruchomić.
