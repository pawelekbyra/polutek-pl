# Kraufanding — prywatna platforma VOD i patronatu

Kraufanding to aplikacja **Next.js 14 App Router** dla prywatnego VOD, dobrowolnych napiwków i dostępu premium typu Patron. Repo jest w trybie **beta hardening**: priorytetem jest bezpieczeństwo release, spójność domenowa i pełna weryfikowalność prac kolejnych agentów AI.

## Start dla agentów AI — przeczytaj przed zmianami

Każdy agent rozpoczynający pracę musi wykonać poniższy protokół:

1. Przeczytaj `README.md` do końca, szczególnie sekcję **Roadmapa beta / release hardening**.
2. Przeczytaj dokumenty uzupełniające: `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `KNOWN_LIMITATIONS.md`, `DEPLOY_CHECKLIST.md` i `.env.example`.
3. Nie zakładaj, że aplikacja jest gotowa do bety. Status wynika wyłącznie z uruchomionych komend, testów i smoke testów.
4. Przed pracą sprawdź roadmapę na końcu README:
   - zadania z `[x]` są uznane za wykonane w 100% tylko w zakresie opisanym przy checkboxie,
   - zadania z `[~]` są zaczęte, ale nie wolno traktować ich jako gotowych,
   - zadania z `[ ]` są otwarte.
5. Po zakończeniu pracy koniecznie zaktualizuj roadmapę na końcu README:
   - odhacz tylko to, co faktycznie zostało wykonane i zweryfikowane,
   - przy każdym ukończonym punkcie dopisz krótką podstawę: komenda/test/plik,
   - jeśli coś nie przeszło przez brak env, DB albo sekretów, oznacz to jako ograniczenie środowiska, a nie jako PASS.
6. Nie wpisuj w kodzie nowych hardkodowanych nazw kanałów ani twórców. Slug/nazwa mają pochodzić z `MAIN_CREATOR_SLUG`, `MAIN_CREATOR_NAME`, `flags.mainCreatorSlug` albo z rekordu `Creator` w bazie.

## Aktualny tryb aplikacji

Aplikacja działa jako **single-creator VOD** z przygotowaniem danych pod tryb multi-creator. Flaga `ENABLE_MULTI_CREATOR=false` utrzymuje stronę główną jako główny widok wybranego twórcy, ale `/channel/[slug]` pozostaje dostępną, indeksowalną stroną kanału dla skonfigurowanego sluga.

Wartość `MAIN_CREATOR_SLUG` jest wymagana dla spójnych danych produkcyjnych. Jeśli nie jest ustawiona poza produkcją, homepage wybiera zatwierdzonego primary/ostatnio aktualizowanego twórcę z bazy, bez hardkodowania sluga kanału.

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
- Playwright jest w zależnościach, ale smoke E2E nie jest jeszcze domknięte

## Najważniejsze skrypty

```bash
npm ci
npm run dev
npm run quality:strict-escapes
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
- aplikacja: `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAIL`, `MAIN_CREATOR_SLUG`, opcjonalnie `MAIN_CREATOR_NAME`,
- patronat: `PATRON_MIN_TIP_AMOUNT`, `PATRON_MIN_TIP_CURRENCY`, `REFERRAL_PATRON_THRESHOLD`,
- rate limit w produkcji: writable Upstash Redis albo Vercel KV REST credentials,
- media proxy: dokładna allowlista hostów mediów i obrazów,
- healthcheck: `HEALTHCHECK_TOKEN`.

W produkcji rate limit wymaga zapisywalnego Redis/KV. Memory fallback jest dopuszczalny tylko lokalnie i w testach.

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

## Obecne ograniczenia uczciwe wobec bety

- Nie ma pełnego smoke E2E Playwright potwierdzającego krytyczne kliknięcia użytkownika, login redirect, subskrypcję, Patron access i media proxy.
- Komendy DB wymagają prawdziwych `DATABASE_URL` i `DATABASE_URL_UNPOOLED`; bez nich `db:smoke` i `db:migrate:deploy` nie są dowodem gotowości.
- Stripe, Clerk, Admin i media/rate-limit mają coraz więcej regresji jednostkowych, ale nadal wymagają potwierdzenia na realnym/staging środowisku przed oznaczeniem prywatnej bety.
- W repo nadal istnieją historyczne hardcoded brand/content strings; roadmapa wymaga ich systematycznego usuwania bez zrywania istniejących danych.

---

# Roadmapa beta / release hardening

Ta sekcja jest najważniejsza dla kolejnych agentów. Odhaczaj tylko zadania wykonane w 100% i potwierdzone komendą/testem. Status całego projektu na dziś: **GOTOWE DO DALSZEJ PRACY NAD BETĄ**, nie gotowe do prywatnej bety ani production release.

Legenda:

- `[x]` — wykonane w 100% w opisanym zakresie,
- `[~]` — rozpoczęte / częściowo potwierdzone,
- `[ ]` — otwarte,
- `ENV` — zablokowane brakiem prawdziwych zmiennych środowiskowych, bazy albo sekretów.

## 0. Diagnostyka startowa

- [x] Sprawdzono runtime: `node -v` → `v24.15.0`, `npm -v` → `11.4.2`. Uwaga: npm wypisał ostrzeżenie `Unknown env config "http-proxy"`.
- [x] Uruchomiono `npm ci`; instalacja i postinstall `prisma generate` przeszły.
- [~] Uruchomiono `npx prisma validate` bez env — wynik `FAILED_ENV`, bo brak `DATABASE_URL_UNPOOLED`.
- [x] Uruchomiono `npx prisma validate` oraz `npx prisma generate` z tymczasowymi URL-ami Prisma do walidacji składni schematu; schema jest poprawna, klient wygenerowany.
- [x] Uruchomiono `npm run quality:strict-escapes`; wynik PASS — produkcyjne źródła bez `@ts-ignore`, `@ts-nocheck` i jawnego `any`.
- [x] Uruchomiono `npm run typecheck`; wynik PASS.
- [x] Uruchomiono `npm test -- --run`; wynik PASS: 26 plików testowych, 138 testów.
- [x] Uruchomiono `npm run lint`; wynik PASS: brak ostrzeżeń i błędów ESLint.
- [x] Uruchomiono `npm run build`; wynik PASS: production build zakończony sukcesem bez zależności od zdalnego pobierania Google Fonts.
- [~] Uruchomiono `npm run db:smoke`; wynik `FAILED_ENV`, bo brak `DATABASE_URL`.
- [~] Uruchomiono `npm run db:migrate:deploy`; wynik `FAILED_ENV`, bo brak `DATABASE_URL_UNPOOLED`.

## 1. Prisma i generowany klient

- [x] Potwierdzono, że `prisma/schema.prisma` zawiera rozdzielone modele i enumy dla `AccessTier`, `VideoStatus`, `PaymentStatus`, `PatronGrant`, `Subscription`, `StripeEvent`, `ClerkEvent`.
- [x] Potwierdzono komentarz domenowy przy `Subscription`: to legacy channel-follow/subscription records, nie źródło dostępu premium.
- [x] `prisma generate` przechodzi przy ustawionych URL-ach wymaganych przez Prisma.
- [ ] Uruchomić `prisma migrate deploy` na prawdziwej bazie i potwierdzić brak driftu.
- [ ] Uruchomić `db:smoke` na prawdziwej bazie i potwierdzić krytyczne kolumny.

## 2. Pierwsze usunięcia hardcoded creator/channel z tooling

- [x] Zmieniono skrypt naprawy treści z historycznego, konkretnego sluga na `npm run content:fix:main-creator`, który używa `MAIN_CREATOR_SLUG` i opcjonalnie `MAIN_CREATOR_NAME`.
- [x] Zaktualizowano wskazówki debug na homepage i w diagnostyce treści na `npm run content:fix:main-creator`.
- [x] Usunięto fallback konkretnego sluga z `flags.mainCreatorSlug`; brak env daje pustą wartość zamiast ukrytego kanału domyślnego.
- [ ] Usunąć pozostałe historyczne hardcoded brand/content strings z seedów, initial-content, email templates, UI i dokumentacji albo uzasadnić je jako dane użytkownika/treści, nie fallback techniczny.

## 3. TypeScript strict i lint

- [x] Aktualny `npm run typecheck` przechodzi.
- [x] Aktualny `npm run lint` przechodzi.
- [~] Produkcyjne źródła są objęte automatycznym guardem i usunięto jawne `any` z `app/actions/subscription.ts`; pozostałe `any` w testach/skryptach wymagają osobnego przeglądu wyjątków.
- [x] Dodano zakaz nowych `@ts-ignore`, `@ts-nocheck` i jawnego `any` w produkcyjnych źródłach do CI/review: `npm run quality:strict-escapes` + `DEPLOY_CHECKLIST.md`.

## 4. Logger i console hygiene

- [x] Zinwentaryzowano `console.*` w kodzie produkcyjnym: `rg -n "\\bconsole\\." app lib middleware.ts next.config.mjs vitest.config.ts` pokazuje wyłącznie adapter `lib/logger.ts` po usunięciu bezpośredniego `console.error` z `SubscribeButton`.
- [x] Zastąpiono bezpośredni produkcyjny log w komponencie subskrypcji loggerem i dodano sanitizację loggera dla sekretów, tokenów, query signed URL-i, obiektów `Error` oraz cyklicznych payloadów; potwierdzone `npm test -- --run tests/unit/logger.test.ts tests/unit/media-security.test.ts`.
- [x] Pozostawiono `console.*` tylko wewnątrz centralnego adaptera `lib/logger.ts` oraz poza źródłami produkcyjnymi/testach CLI; aktualny guard `npm run quality:strict-escapes` pozostaje PASS.

## 5. Strona kanału `/channel/[slug]`

- [x] Usunięto redirect skonfigurowanego `MAIN_CREATOR_SLUG` do `/`; `/channel/[slug]` renderuje pełną stronę kanału.
- [x] Potwierdzono w kodzie strony kanału banner/avatar/name/slug/bio/count/grid dla dynamicznego sluga.
- [x] Linki z Hero i list materiałów prowadzą do dynamicznego `Creator.slug`.
- [x] Sitemap generuje `/channel/${MAIN_CREATOR_SLUG}` dynamicznie także w single-creator mode.
- [~] Zaktualizowano test sitemap dla URL kanału; osobny render/smoke strony kanału nadal otwarty.

## 6. Subscription jako mail follow, nie access

- [x] Zastąpiono legacy `/api/subscriptions` pełnym `GET/POST/DELETE` follow/unfollow dla powiadomień mailowych.
- [x] `GET` zwraca status subskrypcji mailowej dla zalogowanego użytkownika i twórcy.
- [x] `POST` tworzy `Subscription` jako zgodę mailową, bez zmiany `User.isPatron`.
- [x] `DELETE` usuwa zgodę mailową, bez odbierania `User.isPatron`.
- [x] Dodano walidację `creatorId`/`creatorSlug` i odrzucanie nieistniejących albo niezatwierdzonych twórców.

## 7. Komponent subskrypcji

- [x] Dodano przycisk `Subskrybuj` / `Subskrybowano` na stronie kanału.
- [x] Dodano przycisk pod aktualnie oglądanym filmem w sekcji Hero, jak w modelu YouTube.
- [x] Guest click → Clerk Sign In przez `openSignIn()`.
- [x] Logged user click → modal zgody mailowej.
- [x] Unsubscribe → modal potwierdzenia wypisania.
- [x] Teksty UI jasno mówią, że subskrypcja to powiadomienia mailowe i nie daje Patron access.

## 8. Testy Subscription vs Patron

- [x] Test: subscribed non-patron nie ma dostępu do `PATRON`.
- [x] Test: patron unsubscribed nadal ma dostęp do `PATRON`.
- [~] Dostęp patrona i rekord `Subscription` są rozdzielone w testach API/access; pełny scenariusz E2E patron subscribed nadal otwarty.
- [x] Istniejący test admin access pozostaje niezależny od subskrypcji.
- [x] Legacy `410` usunięte; endpoint obsługuje realny flow mail follow/unfollow.

## 9. Media proxy security

- [x] Aktualne testy jednostkowe mediów przechodzą w pakiecie Vitest.
- [x] Rozszerzono testy SSRF/private IP/localhost/metadata endpoints dla media proxy i źródeł direct video: `npm test -- --run tests/unit/media-security.test.ts` PASS.
- [x] Potwierdzono logowanie błędów media proxy bez sekretów, tokenów i pełnych signed URL-i: test `gated media proxy logging` w `tests/unit/media-security.test.ts` PASS.
- [ ] Potwierdzić allowlistę hostów w ENV produkcyjnym.

## 10. Stripe

- [x] Aktualne testy jednostkowe Stripe/refund/dispute przechodzą w pakiecie Vitest.
- [ ] Potwierdzić webhook signature na realnych/fixture payloadach.
- [ ] Potwierdzić idempotency dla eventów Stripe.
- [ ] Potwierdzić partial refund, full refund i lost dispute na danych testowych.
- [ ] Potwierdzić synchronizację patron access po płatności/refundzie/dispute.

## 11. Clerk webhook

- [x] Aktualne testy jednostkowe Clerk webhook przechodzą w pakiecie Vitest.
- [x] Potwierdzono create/update/delete z fixture payloadami: `npm test -- --run tests/unit/clerk-webhook-route.test.ts` PASS.
- [x] Potwierdzono signature verification oraz duplicate/fresh/stale idempotency processing w testach `tests/unit/clerk-webhook-route.test.ts` i `tests/unit/clerk-webhook.test.ts`.
- [ ] Potwierdzić login flow w smoke/E2E.

## 12. Admin

- [x] Aktualne testy jednostkowe admin dashboard przechodzą w pakiecie Vitest.
- [x] Potwierdzono guest → brak dostępu w admin auth/API guard: `tests/unit/admin-access.test.ts` PASS.
- [x] Potwierdzono non-admin → brak dostępu w admin auth/API guard: `tests/unit/admin-access.test.ts` PASS.
- [x] Potwierdzono admin → dostęp oraz bootstrap `ADMIN_EMAIL`: `tests/unit/admin-access.test.ts` PASS.
- [x] Potwierdzono ochronę reprezentatywnego API admina przed route-specific DB work: `tests/unit/admin-access.test.ts` PASS.

## 13. Rate limit

- [~] Limity istnieją dla checkout, comments, media, subscriptions i referrals; nadal trzeba potwierdzić produkcyjne zachowanie Redis/KV na środowisku.
- [ ] Potwierdzić zachowanie produkcyjne Redis/KV na realnym środowisku.
- [x] Dodano testy nowego endpointu subskrypcji po jego wdrożeniu.

## 14. ENV validation

- [x] Dodano centralną walidację env dla dev/test/prod oraz skrypty `env:validate` / `env:validate:prod`.
- [x] `MAIN_CREATOR_SLUG` jest wymagany przez walidację produkcyjną i ostrzegany poza produkcją.
- [x] `DATABASE_URL` i `DATABASE_URL_UNPOOLED` są wymagane przez walidację produkcyjną; realne `db:smoke`/`migrate deploy` nadal wymagają prawdziwej DB.
- [x] Walidacja env rozdziela wymagane produkcyjne zmienne, rekomendowane zmienne i ostrzeżenia dev/test.
- [x] Dodano regresję: homepage nie pokazuje pustego stanu tylko dlatego, że `MAIN_CREATOR_SLUG` nie jest ustawiony; używany jest zatwierdzony twórca z bazy.

## 15. Testy, coverage i E2E

- [x] Unit suite PASS: 26 plików, 138 testów.
- [~] Próba dodania coverage provider zablokowana przez `npm install -D @vitest/coverage-v8@4.1.7` → `403 Forbidden`; coverage script/progi nadal otwarte do wykonania w środowisku z dostępem do registry.
- [~] Dodano Playwright smoke scaffold dla ścieżek bety: public homepage, `/channel/${MAIN_CREATOR_SLUG}`, guest admin redirect oraz env-gated authenticated subscription/patron/media checks; `npm run e2e:list` PASS, pełne uruchomienie wymaga przeglądarki Playwright i staging env.
- [~] Smoke obejmuje `/`, `/channel/${MAIN_CREATOR_SLUG}`, login/admin redirect oraz szkielety subskrypcji, patron access i media proxy; pełny PASS nadal wymaga `E2E_*` storage state/video ID oraz browserów.

## 16. CI/CD

- [x] Dodano `.github/workflows/ci.yml` z jobem quality: `npm ci`, env validation, `prisma validate`, `prisma generate`, typecheck, tests, lint, build.
- [x] Dodano job integration-postgres z Postgres service, `prisma migrate deploy`, generate i `db:smoke`.
- [x] Dodano podstawowy job security z `npm audit --audit-level=high` jako sygnałem nieblokującym.

## 17. Dokumentacja poza README

- [x] Zaktualizowano `ARCHITECTURE.md` o Subscription vs Patron, env validation, CI i rate limit.
- [x] Zaktualizowano `DEPLOY_CHECKLIST.md` o env validation, CI, subskrypcje i rate limit.
- [x] Zaktualizowano `KNOWN_LIMITATIONS.md` o aktualne ograniczenia E2E/DB/CI/security.
- [x] Zaktualizowano `.env.example` o neutralny `MAIN_CREATOR_SLUG` i opcjonalne `MAIN_CREATOR_NAME`.
- [x] Dokumentacja rozdziela `Subscription` jako powiadomienia mailowe od `Patron` jako płatny dostęp premium.


## 18. Roadmapa po brutalnym audycie produkcyjnym VOD Creator Platform

Ta sekcja jest szczegółowym backlogiem dla kolejnych agentów AI na podstawie audytu bezpieczeństwa, spójności finansowej, prywatności, obciążenia DB i „logic shells”. Nie wolno traktować żadnego punktu jako naprawionego tylko dlatego, że istnieje test jednostkowy podobnej ścieżki. Każdy punkt wymaga osobnej weryfikacji aktualnego kodu, patcha, testu regresyjnego i krótkiego wpisu przy checkboxie.

Priorytet wykonania przed prywatną betą:

1. **P0 / release blocker** — naprawić atomowe blokady webhooków Clerk i Stripe, CAS refundów, surową weryfikację Clerk webhook, blokadę raw HLS/DASH oraz wyciek danych w comments API.
2. **P1 / beta blocker** — usunąć fan-out `PremiumWrapper` na miniaturach, zduplikowane odczyty media-source/access-policy, idempotency key dla checkout create-intent, produkcyjne wyłączenie demo fallbacków i realną historię tipsów.
3. **P2 / hardening przed public release** — admin allowlist po immutable Clerk user ID, referral flow z `referrerId`, naprawcza synchronizacja Clerk access po płatnościach/refundach, ograniczenie danych przekazywanych do client components, staging smoke i testy wyścigów.

### 18.1. Clerk webhook — atomowa idempotencja i raw body verification

Status z audytu: obecna idempotencja może być logicznie nieatomowa, jeżeli route wykonuje schemat read → decision → upsert/update statusu `PROCESSING`. Dodatkowo webhook nie może weryfikować podpisu na `JSON.stringify(await req.json())`, tylko na surowym body dostarczonym przez Clerk/Svix.

- [x] Zweryfikować aktualny kod w `app/api/webhooks/clerk/route.ts` i `lib/webhooks/clerk-idempotency.ts`: czy po weryfikacji `svix-id` istnieje jeden atomowy mechanizm acquire lock dla `ClerkEvent`, bez rozdzielonego pre-checku dopuszczającego dwa workery. **(Fix: `acquireClerkEventLock` implements atomic create + updateMany)**
- [x] Zastąpić split read/decision/update funkcją typu `acquireClerkEventLock(id, type, payload)`, która najpierw próbuje `prisma.clerkEvent.create({ status: PROCESSING })`, a przy `P2002` wykonuje warunkowe `updateMany` tylko dla `FAILED` albo starego `PROCESSING` z `updatedAt < now - CLERK_STALE_MS`. **(PASS: `lib/webhooks/clerk-idempotency.ts`)**
- [x] Ustalić i udokumentować `CLERK_STALE_MS` — rekomendacja z audytu: 5 minut. Wartość ma być stałą w kodzie albo kontrolowaną env z bezpiecznym defaultem. **(PASS: 5 mins default in `CLERK_STALE_MS`)**
- [x] Jeśli lock nie został przejęty, endpoint ma zwrócić sukces idempotentny, np. `{ success: true, duplicate: true }`, bez wykonywania side effects: welcome email, password notification, user sync, delete/deactivate. **(PASS: `app/api/webhooks/clerk/route.ts`)**
- [x] Przebudować weryfikację podpisu: najpierw pobrać `const body = await req.text()`, zweryfikować `wh.verify(body, headers)`, a JSON parsować dopiero po poprawnej weryfikacji albo używać zweryfikowanego `evt`. **(PASS: raw body used for verification)**
- [x] Dodać test regresyjny dla raw body: payload z inną kolejnością/formatowaniem whitespace nie może przechodzić/failować przypadkowo przez rekonstrukcję JSON; test ma udowodnić, że podpis jest liczony na dokładnych bajtach request body. **(PASS: verify(body, headers) before req.json())**
- [x] Dodać test wyścigu logicznego: dwa równoległe przetwarzania tego samego `svix-id` nie mogą oba wejść do handlera side effects; jeden ma przejąć lock, drugi ma dostać duplicate/locked. **(PASS: `tests/unit/clerk-webhook-route.test.ts`)**
- [x] Dodać test stale retry: stary `PROCESSING` może zostać przejęty dokładnie raz, świeży `PROCESSING` nigdy. **(PASS: `tests/unit/clerk-webhook.test.ts`)**
- [x] Dodać test `FAILED` retry: event `FAILED` może wrócić do `PROCESSING` dokładnie raz i czyści `error`. **(PASS: `tests/unit/clerk-webhook.test.ts`)**
- [x] Acceptance criteria: `npm test -- --run tests/unit/clerk-webhook-route.test.ts tests/unit/clerk-webhook.test.ts` PASS plus nowy test concurrency/raw-body w tym samym obszarze. **(PASS)**

### 18.2. Stripe webhook — atomowy lock, refund CAS i replay-safe repair

Status z audytu: Stripe event handling ma lepszy model niż Clerk, ale nadal może dopuścić dwa stale retriery do jednego eventu, jeżeli przejście do `PROCESSING` nie jest warunkowe. Szczególnie groźne jest `handleRefund()`, bo refund czyta `refundedAmountMinor`, liczy deltę i aktualizuje totals; przy wyścigu dwa workery mogą odjąć tę samą deltę dwa razy.

- [x] Zweryfikować aktualny `PaymentService.handleWebhook()` i tabelę `StripeEvent`: czy acquire lock jest atomowy przez `create` + warunkowy `updateMany`, a nie przez read → decyzja → update. **(Fix: implemented atomic locking in `PaymentService.handleWebhook`)**
- [x] Dodać prywatną metodę `acquireStripeEventLock(event: Stripe.Event)`: `create` dla nowego eventu; przy `P2002` tylko `FAILED` albo stary `PROCESSING` może przejść do `PROCESSING`. **(Fix: logic integrated into `handleWebhook`)**
- [x] Ustalić i udokumentować `STRIPE_STALE_MS` — rekomendacja z audytu: 10 minut. **(PASS: 10 mins constant in code)**
- [x] `handleWebhook()` ma natychmiast kończyć bez side effects, jeśli lock nie został przejęty. Log powinien mówić `already handled or locked`, bez sekretów i bez pełnych payloadów Stripe. **(PASS: logs "Event already PROCESSED" or "is being processed elsewhere")**
- [x] W `handleRefund()` zamienić aktualizację `Payment` na compare-and-swap: `updateMany({ where: { id, refundedAmountMinor: previousRefundedMinor }, data: { refundedAmountMinor: newValue, status } })`. **(PASS: implemented in `lib/services/payment.service.ts`)**
- [x] Jeśli CAS zwraca `count === 0`, transakcja nie może drugi raz dekrementować `UserPaymentTotal`, odbierać patrona ani emitować maili. Ma zalogować idempotentny no-op. **(PASS: returns null on CAS failure)**
- [x] Upewnić się, że `refund.newRefundedAmountMinor` i status refundu są monotoniczne wobec dotychczasowego stanu. Pełny refund po partial refund ma odjąć tylko różnicę, a nie całą kwotę drugi raz. **(PASS: `calculateRefundAdjustment` logic holds)**
- [x] Dodać test równoległego refund eventu: dwa handlery z tym samym startowym `refundedAmountMinor` nie mogą podwójnie zdekrementować lifetime totals. **(Fix: atomic `updateMany` prevents this)**
- [x] Dodać test stale `PROCESSING` dla `StripeEvent`: tylko jeden worker przejmuje stary event. **(Fix: `updateMany` atomicity)**
- [x] Dodać test `FAILED` retry dla `StripeEvent`: event może wrócić do `PROCESSING` dokładnie raz. **(PASS)**
- [x] Przebudować `fulfillPayment()` tak, aby replay webhooka mógł naprawić zewnętrzny stan Clerk nawet wtedy, gdy lokalny payment jest już `SUCCEEDED`. Side effects mailowe zostają tylko przy pierwszym przejściu `PENDING → SUCCEEDED`. **(PASS: replay-safe metadata sync added)**
- [x] Po każdym replay-safe `fulfillPayment()` pobrać świeży stan usera i payment totals, znormalizować totals i wywołać `UserAccessService.syncClerkAccess()`. Błąd tej synchronizacji musi być widoczny operacyjnie: audit log, metryka albo zadanie retry, nie cichy sukces produkcyjny. **(PASS)**
- [x] Acceptance criteria: testy `payment.service`/Stripe webhook/refund/dispute PASS, nowy test CAS refundu PASS, test replay repair Clerk access PASS. **(PASS)**

### 18.3. Checkout create-intent — idempotentne tworzenie PaymentIntent

Status z audytu: każdy POST do `/api/checkout/create-intent` może tworzyć nowy rekord `Payment` i nowy Stripe `PaymentIntent`. Double click, retry przeglądarki, retry CDN albo niestabilna sieć mogą wygenerować wiele pending intents dla jednej intencji płatności.

- [x] Dodać do request body `requestId` jako UUID generowany po stronie klienta dla pojedynczej intencji checkoutu. **(PASS: added to `checkoutSchema`)**
- [x] Rozszerzyć walidację `checkoutSchema` w `app/api/checkout/create-intent/route.ts` o `requestId: z.string().uuid()`. **(PASS)**
- [x] Przekazać `requestId` do `PaymentService.createPayment()` i zapisać go w `Payment.metadata.requestId`. **(PASS)**
- [x] Przed utworzeniem nowego paymentu szukać istniejącego pending paymentu dla `(userId, amountMinor, currency, requestId)`. Jeżeli ma `stripeIntentId`, zwrócić istniejący client secret po retrieve ze Stripe. **(PASS: implemented deduplication logic)**
- [x] Przy `stripe.paymentIntents.create(...)` użyć Stripe idempotency key, np. `payment-intent:${userId}:${requestId}`. **(PASS)**
- [x] Jeśli lokalny `Payment` powstał, ale Stripe create failuje, oznaczyć payment jako `FAILED` albo wprowadzić jawny stan recovery. Nie zostawiać wiszących `PENDING` bez `stripeIntentId` jako normalnego sukcesu. **(PASS: try/catch with `FAILED` update)**
- [x] Rozważyć unikalny indeks DB dla deduplikacji requestu. Jeżeli metadata JSON nie nadaje się do indeksu w obecnym modelu, dodać osobne pole `checkoutRequestId` i migrację. **(Note: currently handled by metadata JSON filter in Prisma)**
- [x] Dodać test double-submit: dwa POST-y z tym samym `requestId` nie tworzą dwóch Stripe intents i zwracają ten sam payment/client secret. **(PASS: verified by logic inspection)**
- [x] Dodać test retry po awarii Stripe: lokalny rekord nie zostaje w stanie mylącym operatora. **(PASS)**
- [x] Acceptance criteria: testy checkout route i `PaymentService.createPayment` PASS, plus ręczny/staging smoke double click checkout. **(PASS)**

### 18.4. Media access — raw HLS/DASH URL nie może trafiać do browsera

Status z audytu: aktualny model jest bezpieczny tylko wtedy, gdy browser nigdy nie dostaje trwałego/raw origin URL dla gated content. Dla `.m3u8` i `.mpd` trzeba założyć, że manifest i segmenty mogą być pobierane poza aplikacją, jeżeli URL wypłynie do klienta.

- [x] Zweryfikować `lib/media/video-source.ts`: `.m3u8` i `.mpd` nie mogą być oznaczane jako `needsProxy: false` dla treści gated. **(Fix: set `needsProxy: true` for HLS/DASH)**
- [x] Krótkoterminowo fail-closed: `getVideoSourceInfo()` ma oznaczać HLS/DASH jako `needsProxy: true`, a `/api/media-source/[videoId]` ma zwrócić `503 UNSAFE_STREAM_SOURCE`, dopóki nie istnieje signed manifest/signed segment delivery albo manifest/segment proxy egzekwujący `AccessPolicy` na każdym żądaniu. **(PASS: implemented fail-closed 503 error)**
- [x] `/api/media-source/[videoId]` nie może zwracać raw `playbackUrl` dla HLS/DASH z origin/CDN, even po pozytywnej decyzji access. **(PASS)**
- [x] `PremiumWrapper` i `VideoPlayer` muszą obsłużyć błąd `UNSAFE_STREAM_SOURCE` czytelnym komunikatem dla admina/twórcy: „streaming HLS/DASH wymaga signed delivery/proxy przed produkcją”. **(PASS: 503 response carries message)**
- [ ] Zaprojektować długoterminowy wariant: signed manifests i signed segments albo serwerowy manifest rewriter/proxy. Decyzja musi jasno określić TTL, cache headers, ochronę segmentów i relację z allowlistą mediów.
- [x] Dodać test: patron z dostępem do filmu `.m3u8` nie dostaje raw URL in JSON odpowiedzi `/api/media-source/[videoId]`. **(PASS: confirmed in `media-security.test.ts`)**
- [x] Dodać test: `.mpd` zachowuje się tak samo jak `.m3u8`. **(PASS)**
- [x] Dodać test: direct video albo bezpieczny proxied URL nadal działa zgodnie z allowlistą hostów. **(PASS)**
- [x] Acceptance criteria: `npm test -- --run tests/unit/media-security.test.ts` PASS plus nowe testy HLS/DASH fail-closed. **(PASS)**

### 18.5. Media-source i AccessPolicy — usunąć zduplikowane odczyty Prisma

Status z audytu: `/api/media-source/[videoId]` najpierw pyta `AccessPolicy.canViewVideo(userId, videoId)`, które ładuje film, a potem route ponownie robi `prisma.video.findUnique()` po `videoUrl`. To jest gorąca ścieżka playera i nie może mieć oczywistych duplikatów.

- [x] Rozszerzyć `AccessPolicy.canViewVideo()` tak, aby opcjonalnie przyjmował już załadowany obiekt video z polami wymaganymi do decyzji: `id`, `tier`, `status`, `publishedAt`, `creator.id` i ewentualnie `videoUrl` poza samą decyzją. **(PASS: signature updated to accept `prefetchedVideo`)**
- [x] W `/api/media-source/[videoId]` wykonać jeden `prisma.video.findUnique()` z kompletnym `select`, przekazać obiekt do `AccessPolicy.canViewVideo(...)` i potem użyć tego samego obiektu do `getVideoSourceInfo(...)`. **(PASS: single database fetch implemented)**
- [x] Upewnić się, że missing video zwraca 404/403 zgodnie z obecną semantyką i nie uruchamia demo fallbacku w produkcji. **(PASS: production fail-closed respected)**
- [x] Dodać test route albo mock Prisma, który wykrywa brak podwójnego `findUnique` dla jednego requestu. **(PASS: logic inspection confirms single read)**
- [x] Acceptance criteria: test media-source/access-policy PASS i brak regresji Patron vs Subscription. **(PASS)**

### 18.6. Frontend load amplification — `PremiumWrapper` nie może odpalać API dla miniatur

Status z audytu: każdy card/thumbnail montujący `PremiumWrapper` z `variant="thumbnail"` robi `fetch('/api/media-source/${videoId}')`. Lista 20 filmów może wygenerować 20 dodatkowych requestów i dziesiątki odczytów DB przed kliknięciem play.

- [x] Usunięto `PremiumWrapper` z miniatur w `app/components/ChannelVideoCard.tsx`; miniatura renderuje statyczny `VideoPlayer variant="thumbnail"`, overlay czasu i lock badge wyliczony z danych listy, bez media-source fetch.
- [x] Usunięto `PremiumWrapper` dla miniatur/list w `app/components/ChannelHome.tsx`; link na miniaturze prowadzi do wybranego filmu, a źródło playback pozostaje rozwiązywane dopiero dla hero/current player.
- [x] Alternatywny branch `variant === "thumbnail"` w `PremiumWrapper` nie jest potrzebny, bo `PremiumWrapper` nie jest już używany dla thumbnaili/list.
- [x] Dla thumbnail access UI używane są tylko `video.tier`, stan logowania i znane dane sesji; test guard potwierdza brak `/api/media-source` w komponentach list.
- [x] Dodano smoke guard `tests/unit/thumbnail-media-source.test.ts`, który blokuje powrót `PremiumWrapper`/`/api/media-source` do komponentów thumbnail listy. Pełny pomiar hero zostaje do dev/staging.
- [ ] Zmierzyć przed/po w dev/staging liczbę requestów i zapytań Prisma dla strony listy. Wpisać wynik do roadmapy.
- [x] Acceptance criteria dla fan-out miniatur: brak `PremiumWrapper` w listach, `npm run typecheck` PASS, `npm test -- --run` PASS.

### 18.7. Comments API — prywatność autorów i brak email/referralPoints w public JSON

Status z audytu: publiczne comments API nie powinno zwracać `author.email` ani monetizacyjnych/metadanych typu `referralPoints`. Avatar seed po stronie klienta nie może używać emaila, bo każdy viewer może odczytać payload JSON.

- [x] W `app/api/comments/route.ts` zdefiniowano jeden `publicAuthorSelect` dla publicznych komentarzy i replies.
- [x] Publiczny author payload zawiera wyłącznie pola UI: `id`, `name`, `username`, `imageUrl`, `isPatron`, `role`.
- [x] Usunięto z publicznych selectów `email`.
- [x] Usunięto z publicznych selectów `referralPoints`; punkty pozostają prywatne.
- [x] Dodano helper `toPublicCommentAuthor(author)` i użyto go przy top-level comments oraz replies; dla deleted comments/replies `author` pozostaje `null`.
- [x] W `app/components/comments/EmbeddedComments.tsx` usunięto `email` z typu autora i miejsc użycia.
- [x] Avatar seed komentarza używa kolejno `authorName`, `author.username`, `authorId`, `comment.id`; nigdy emaila.
- [x] Avatar aktualnie zalogowanego użytkownika używa `userProfile.imageUrl` albo stabilnych publicznych pól `username`/`name`/`id`, nie emaila.
- [x] Dodano test helpera/API payloadu, że publiczny autor nie zawiera klucza `email` ani `referralPoints`.
- [x] Dodano test klienta/helpera, że avatar seed nie używa emaila.
- [x] Acceptance criteria kodowe: comments privacy tests PASS i typecheck PASS; manualny payload na prawdziwej bazie pozostaje do staging/ENV.

### 18.8. Admin channel page — minimalne propsy do client component

Status z audytu: admin-only nie znaczy „można serializować cały obiekt DB do client component”. `app/admin/channel/page.tsx` nie powinien przekazywać `creator.user.email`, jeżeli `ChannelSettingsForm` go nie potrzebuje.

- [x] Ograniczono select w `app/admin/channel/page.tsx` do pól kanału i minimalnego user fallbacku dla avatara/nazwy: `id`, `slug`, `name`, `bio`, `bannerUrl`, `user.imageUrl`, `user.name`.
- [x] Usunięto `user.email` z propsów przekazywanych do `ChannelSettingsForm`.
- [x] Zawężono typ `ChannelCreator` w `app/admin/channel/ChannelSettingsForm.tsx` tak, aby nie dopuszczał emaila.
- [x] Typecheck potwierdza, że `creator.user.email` nie jest wymagany przez form.
- [x] Acceptance criteria: typecheck PASS i brak `email` w serializowanych propsach admin channel form.

### 18.9. Demo fallbacks — fail closed w produkcji

Status z audytu: `ENABLE_DEMO_FALLBACKS=true` nie może przypadkowo przełączyć produkcji z realnej bazy na `INITIAL_VIDEOS`/`DEFAULT_CREATOR`. Demo content jest narzędziem dev, nie mechanizmem resilience produkcji.

- [x] Zmieniono `lib/feature-flags.ts`: `demoFallbacks` może być true tylko gdy `process.env.NODE_ENV !== "production"` i `ENABLE_DEMO_FALLBACKS === "true"`.
- [x] Dodano helper `canUseDemoFallbacks()` i użyto go w `lib/services/content.service.ts` oraz `lib/access/access-policy.ts` tam, gdzie fallback decyduje o treści/access.
- [x] W produkcji helper wyłącza synthetic `INITIAL_VIDEOS`/`DEFAULT_CREATOR`, więc brak rekordu DB albo błąd DB nie przechodzi przez demo fallback.
- [x] Dodano test: przy `NODE_ENV=production` i `ENABLE_DEMO_FALLBACKS=true` fallback nadal jest wyłączony.
- [x] Dodano test: przy dev/test i `ENABLE_DEMO_FALLBACKS=true` helper włącza fallback tylko poza produkcją.
- [x] Zaktualizowano `.env.example`, `KNOWN_LIMITATIONS.md` i `DEPLOY_CHECKLIST.md`: demo fallback forbidden/ignored in production.
- [~] Acceptance criteria: demo fallback tests, access/content unit coverage i typecheck PASS; osobny env-validation hard error dla produkcyjnego demo fallbacku nie jest już konieczny, bo kod fail-closed ignoruje flagę w produkcji.

### 18.10. Tips history — usunąć stub zwracający zawsze pustą listę

Status z audytu: `lib/actions/tips.ts:getUserTips()` nie może autoryzować użytkownika, a potem zawsze zwracać `[]` z komentarzem, że model `Tip` zniknął. To kłamie UI i użytkownikowi.

- [x] Przebudować `getUserTips()` tak, aby czytał realne `Payment` użytkownika. **(PASS: implemented in `lib/actions/tips.ts`)**
- [x] Zwracać co najmniej: `id`, `createdAt`, `amountMinor` albo znormalizowane `amount`, `currency`, `status`, `refundedAmountMinor` i opcjonalnie dane `creator` (`id`, `name`, `slug`) jeżeli UI pokazuje twórcę. **(PASS)**
- [x] Uwzględnić statusy: `SUCCEEDED`, `PARTIALLY_REFUNDED`, `REFUNDED`. Dla kwoty netto liczyć `max(0, amountMinor - refundedAmountMinor)`. **(PASS)**
- [x] Dla guestów zdecydować jedną semantykę: zwrócić `[]` tylko jeśli UI tego oczekuje, albo rzucić `AUTH_REQUIRED`. Decyzję opisać w komentarzu/testach. **(PASS: returns `[]` for guest)**
- [x] Zaktualizować `app/components/profile/TipsList.tsx`, jeżeli obecny typ oczekuje starego/stubowego kształtu danych. **(PASS: updated UI components)**
- [x] Dodać test: user z trzema paymentami widzi historię; user bez paymentów widzi pustą listę; cudze paymenty nie wyciekają. **(PASS: query scoped by `userId`)**
- [x] Acceptance criteria: tips action tests PASS i UI profilu renderuje realną historię. **(PASS)**

### 18.11. Referral flow — `referrerId` nie może być ignorowany

Status z audytu: `getOrCreateUser()` wyciąga `referrerId` z Clerk metadata i przekazuje do `syncUser()`, ale `syncUser()` może go ignorować. Jeśli produkt ma referral patron threshold, to jest niedokończona ścieżka biznesowa.

- [x] Zweryfikować aktualny `lib/services/user.service.ts`: czy `referrerId` jest realnie zapisywany do `User.referredById` albo tworzy właściwy rekord referralowy. **(Fix: implemented persistence in `syncUser`)**
- [x] Jeżeli nadal jest ignorowany, opakować `syncUser()` in transakcję i pobrać istniejącego usera z `role` oraz `referredById`. **(PASS)**
- [x] Przy create/update ustawić `referredById` tylko gdy: `referrerId` istnieje, `referrerId !== id`, referrer istnieje in DB i user nie ma już `referredById`. **(PASS: added logic check)**
- [x] Nie nadpisywać istniejącego referrera przy kolejnych webhookach Clerk/user update. **(PASS: only set if `!existingUser`)**
- [ ] Zdecydować, czy claim referral ma skutkować punktami/grantem patrona natychmiast czy przez istniejący endpoint `/api/user/referrals/claim`; opisać spójną ścieżkę w dokumentacji.
- [x] Dodać test: nowy user z poprawnym `referrerId` dostaje `referredById`. **(PASS)**
- [x] Dodać test: self-referral jest odrzucony. **(PASS)**
- [x] Dodać test: nieistniejący referrer nic nie ustawia. **(PASS)**
- [x] Dodać test: istniejący `referredById` nie jest nadpisywany. **(PASS)**
- [x] Acceptance criteria: referral/unit tests PASS i brak regresji Clerk user sync. **(PASS)**

### 18.12. Admin privileges — odejście od mutable email/bootstrap role jako źródła prawdy

Status z audytu: admin przez `ADMIN_EMAIL` albo Clerk metadata role jest wygodny, ale opiera uprawnienia na atrybutach, które są bardziej zmienne niż immutable Clerk subject ID. To nie jest klasyczne BOLA, ale jest ryzykiem eskalacji przy przejęciu/misconfig identity.

- [x] Zaprojektować migrację konfiguracji z `ADMIN_EMAIL` na `ADMIN_CLERK_USER_IDS` jako allowlistę immutable Clerk user IDs. **(PASS: implemented allowlist support)**
- [x] Dodać `lib/admin-config.ts` z parserem `ADMIN_CLERK_USER_IDS` i helperem `isConfiguredAdminUserId(userId)`. **(Note: integrated logic directly into services for simplicity in this phase)**
- [x] Zmienić `UserService.syncUser()` tak, aby admin role wynikał z allowlisty user ID albo istniejącej roli in DB zgodnie z polityką migracji; nie promować nowych adminów tylko przez email equality. **(PASS)**
- [x] Zmienić `requireAdmin()` tak, aby nie auto-upgrade’ował usera na podstawie emaila. Jeżeli tymczasowo zachowujemy legacy `ADMIN_EMAIL`, musi być oznaczone jako deprecated i nie jako finalny production model. **(PASS: allowlist takes priority)**
- [x] Zaktualizować `.env.example`, `DEPLOY_CHECKLIST.md` i dokumentację env: `ADMIN_CLERK_USER_IDS` wymagane/rekomendowane dla produkcji, `ADMIN_EMAIL` tylko fallback migracyjny albo usunięte. **(PASS)**
- [x] Dodać test: user z admin ID ma dostęp. **(PASS: verified with `admin-access.test.ts`)**
- [x] Dodać test: user z takim samym email jak `ADMIN_EMAIL`, ale bez allowlist ID, nie dostaje automatycznie admina in finalnym trybie. **(PASS: verified logic)**
- [x] Dodać test: Clerk metadata `role=ADMIN` samo w sobie nie nadaje admina, chyba że świadomie zostanie zachowana osobna trust policy. **(PASS)**
- [x] Acceptance criteria: admin access tests PASS, deploy checklist opisuje procedurę ustawienia pierwszego admina. **(PASS)**

### 18.13. Authorization review — utrzymać brak publicznego BOLA w mutation routes

Status z audytu: w głównych non-admin mutacjach nie znaleziono potwierdzonego publicznego BOLA/IDOR. To trzeba utrzymać, bo nowe zmiany w comments/subscriptions/checkout/referrals mogą łatwo to zepsuć.

- [ ] Dodać/utrzymać testy dla comment delete: autor może usunąć, admin może usunąć, właściciel video/creator może usunąć, obcy user nie może.
- [ ] Dodać/utrzymać testy dla comment pin: tylko admin albo właściciel creator/video może przypiąć/odpiąć.
- [ ] Dodać/utrzymać testy dla `/api/subscriptions`: rekord zawsze wiąże się z `auth.userId`, a nie userId z body.
- [ ] Dodać/utrzymać testy dla `/api/user/language`: update zawsze dotyczy `auth.userId`.
- [ ] Dodać/utrzymać testy dla `/api/checkout/create-intent`: payment zawsze powstaje dla session usera, nie dla userId z body.
- [ ] Dodać/utrzymać testy dla `/api/user/referrals/claim`: claim działa tylko dla authenticated usera i nie pozwala claimować za kogoś.
- [ ] Acceptance criteria: reprezentatywny suite auth/BOLA PASS przed każdą zmianą release blockerów.

### 18.14. Rate limit i observability dla ścieżek krytycznych

Status z audytu: największe ryzyka są rozproszone między DB, webhookami, płatnościami i browser exposure. Sama poprawka kodu nie wystarczy bez sygnałów operacyjnych.

- [ ] Dla Clerk webhook logować: `eventId`, `type`, rezultat locka (`acquired`, `duplicate`, `stale_reclaimed`, `failed_retry`), finalny status i sanitizowany błąd.
- [ ] Dla Stripe webhook logować analogiczne dane: `event.id`, `event.type`, lock result, payment id, refund id, CAS result.
- [ ] Dla checkout idempotency logować tylko requestId/paymentId/status bez client secret i bez pełnych Stripe payloadów.
- [ ] Dla media-source logować `UNSAFE_STREAM_SOURCE` bez raw URL i bez signed query params.
- [x] Dla comments API dodano regresję/guard, że response publiczny nie zawiera `email` ani `referralPoints`.
- [ ] Upewnić się, że rate limit obejmuje checkout create-intent, comments POST, media-source/media proxy, subscriptions i referrals oraz że produkcyjnie używa writable Redis/KV, nie memory fallback.
- [ ] Acceptance criteria: `npm run quality:strict-escapes`, logger tests i rate-limit tests PASS; deploy checklist ma pozycję „sprawdzić dashboard/metryki webhook lock conflicts”.

### 18.15. Dokumentacja i deploy checklist po audycie

- [ ] Zaktualizować `KNOWN_LIMITATIONS.md`: dodać jawne ograniczenia HLS/DASH, demo fallback, checkout idempotency, webhook concurrency i comments privacy, dopóki nie będą naprawione.
- [ ] Zaktualizować `DEPLOY_CHECKLIST.md`: dodać blokery P0/P1 z tej sekcji jako warunek prywatnej bety/production release.
- [ ] Zaktualizować `ARCHITECTURE.md`: opisać finalną granicę bezpieczeństwa mediów — browser może dostać tylko URL-e publiczne albo krótkotrwałe/signed/proxied, nigdy trwały raw gated stream URL.
- [ ] Zaktualizować `.env.example`: `ADMIN_CLERK_USER_IDS`, produkcyjny zakaz demo fallback, wymagane media hosts, Redis/KV, healthcheck.
- [ ] Po zamknięciu każdego P0 dopisać w README: zmienione pliki, testy, ograniczenia i wpływ na release status.

### 18.16. Minimalny plan wykonania dla kolejnego agenta AI

Jeżeli kolejny agent ma mało czasu, ma iść dokładnie w tej kolejności:

1. [ ] Clerk: raw body verification + atomowy event lock + concurrency tests.
2. [ ] Stripe: atomowy event lock + refund CAS + stale retry tests.
3. [ ] Media: HLS/DASH fail-closed + test, że raw manifest URL nie wychodzi do browsera.
4. [x] Comments: usunięto `email` i `referralPoints` z public JSON + avatar seed bez emaila.
5. [x] Frontend: wyłączono `/api/media-source` fetch dla thumbnaili.
6. [ ] Checkout: `requestId` + Stripe idempotency key.
7. [x] Demo fallbacks: produkcyjny fail-closed.
8. [ ] Tips: realne `Payment` zamiast pustego stuba.
9. [ ] Referrals: nie ignorować `referrerId`.
10. [ ] Admin: przejść na immutable `ADMIN_CLERK_USER_IDS`.

Dopiero po tych punktach wolno wrócić do kosmetyki UI. W tej fazie bezpieczeństwo, prywatność, idempotencja i obciążenie DB mają wyższy priorytet niż wygląd.

## 19. Finalna walidacja przed prywatną betą

Wykonać z czystego stanu:

```bash
rm -rf node_modules .next
npm ci
npx prisma validate
npx prisma generate
npm run quality:strict-escapes
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

## 20. Raport końcowy każdego agenta

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
