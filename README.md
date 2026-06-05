# Kraufanding — prywatna platforma VOD i patronatu

Kraufanding to aplikacja **Next.js 14 App Router** dla prywatnego VOD, dobrowolnych napiwków i dostępu premium typu Patron. Repo jest w trybie **beta hardening**: priorytetem jest bezpieczeństwo release, spójność domenowa i pełna weryfikowalność prac kolejnych agentów AI.

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

Ta sekcja jest żywym backlogiem do prywatnej bety. Wykonane i odhaczone wcześniej pozycje zostały usunięte — poniżej zostają tylko aktualne braki potwierdzone ponowną analizą kodu oraz raportem gotowości.

Status całego projektu na dziś: **GOTOWE DO DALSZEJ PRACY NAD BETĄ**, nie gotowe do prywatnej bety ani production release.

Legenda:

- `[~]` — rozpoczęte / częściowo potwierdzone, ale nie wolno traktować jako gotowe,
- `[ ]` — otwarte,
- `ENV` — zablokowane brakiem prawdziwych zmiennych środowiskowych, bazy, sekretów albo stagingu.

## 0. P0 — admin authorization musi być spójne z finalnym modelem bezpieczeństwa

Obecny kod nadal nie spełnia finalnej deklaracji „immutable admin IDs only”. `requireAdmin()` bootstrappuje rolę `ADMIN` po `ADMIN_EMAIL`, `UserService.syncUser()` ufa `ADMIN_EMAIL` oraz `clerkRole=ADMIN`, część admin/content flows wyszukuje admina po emailu, a test admin access nadal uznaje bootstrap po emailu za oczekiwany scenariusz.

- [ ] Usunąć auto-promocję admina po `ADMIN_EMAIL` z runtime `requireAdmin()`; admin access ma wynikać z jawnej roli w DB i/lub `ADMIN_CLERK_USER_IDS`, bez email bootstrapu.
- [ ] Usunąć nadawanie roli `ADMIN` w `UserService.syncUser()` na podstawie `email === ADMIN_EMAIL` oraz `publicMetadata.role === 'ADMIN'` / `clerkRole=ADMIN`.
- [ ] Przejrzeć i przepiąć admin-centric flows, które nadal używają `ADMIN_EMAIL` do wyszukania użytkownika lub danych właściciela: admin creator route, admin videos route, content service, seed/ensure-admin scripts.
- [ ] Zmienić walidację produkcyjnego env z `ADMIN_EMAIL` na `ADMIN_CLERK_USER_IDS` albo jawnie opisać `ADMIN_EMAIL` jako wyłącznie legacy seed/migration value, nie źródło uprawnień.
- [ ] Usunąć fallback `ADMIN_EMAIL` jako finalny mechanizm z `.env.example`, `DEPLOY_CHECKLIST.md` i dokumentacji runtime albo oznaczyć go jako deprecated/non-auth.
- [ ] Zaktualizować testy admin access: user z `ADMIN_CLERK_USER_IDS` ma dostęp; user z tym samym emailem co `ADMIN_EMAIL`, ale bez allowlist ID/DB role, nie dostaje admina; Clerk metadata `role=ADMIN` samo w sobie nie nadaje admina.

## 1. P0 — jeden kanoniczny flow dla Subscription i language preference

Repo ma dwa równoległe modele wywołań. UI subskrypcji używa server actions i `UserService.toggleSubscription()`, podczas gdy `/api/subscriptions` ma osobny kontrakt follow/unfollow z rate limitingiem i jawnie semantyką email notifications. Zmiana języka ma podobny drift: route `/api/user/language` synchronizuje DB + Clerk metadata, a `lib/actions/user.ts` zapisuje tylko DB.

- [ ] Wybrać jeden kanoniczny backend dla subskrypcji: `/api/subscriptions` albo server action jako cienki adapter do tej samej usługi i tej samej semantyki.
- [ ] Przepiąć `SubscribeButton` tak, aby nie omijał rate limitingu/kontraktu API albo dodać równoważny rate limit i semantykę do wspólnej warstwy serwisowej.
- [ ] Usunąć dev-only auto-healing tworzenia default creator z `app/actions/subscription.ts` albo przenieść go do jawnego narzędzia seed/repair, poza normalny flow użytkownika.
- [ ] Ujednolicić response contract dla statusu subskrypcji: `creatorId`/`creatorSlug`, `purpose=EMAIL_NOTIFICATIONS`, `isSubscribed`, bez efektów na `User.isPatron`.
- [ ] Wybrać jeden kanoniczny backend dla zmiany języka i zapewnić, że UI, API oraz server action aktualizują DB i Clerk metadata spójnie albo świadomie nie dotykają Clerk metadata.
- [ ] Dodać regresje dla obu ścieżek: subskrypcja nie nadaje Patron access, patron unsubscribed nadal ma Patron access, language update zapisuje oczekiwane źródła prawdy.

## 2. P0 — staging smoke dla krytycznych ścieżek płatności, dostępu i admina

Unit tests i scaffolding E2E nie są dowodem bety. Nadal brakuje artefaktów ze stagingu z prawdziwymi sekretami, prawdziwą bazą, realną sesją Clerk, Stripe test mode i hostami mediów z allowlisty.

- [ ] `ENV` Uruchomić staging deploy na prawdziwej bazie i wykonać `npx prisma migrate deploy` bez driftu.
- [ ] `ENV` Uruchomić `npm run db:smoke` na staging/prod-like DB i zapisać wynik jako release evidence.
- [ ] `ENV` Przejść smoke: guest → login → komentarz → logout/redirect.
- [ ] `ENV` Przejść smoke: Stripe success → webhook → `Payment`/`PatronGrant` → `User.isPatron` → Clerk access sync → dostęp do materiału `PATRON`.
- [ ] `ENV` Przejść smoke: partial refund, full refund i lost dispute → cofnięcie albo korekta Patron access zgodnie z polityką.
- [ ] `ENV` Przejść smoke admin: login admina → creator/channel settings → video CRUD → widoczność opublikowanego materiału.
- [ ] `ENV` Przejść smoke media: public video, login-gated video, patron-gated video, media proxy/range request oraz fail-closed dla HLS/DASH bez signed delivery.

## 3. P1 — coverage, E2E i release evidence w CI

Vitest nie ma coverage config ani progów. Playwright smoke istnieje, ale pełny przebieg zależy od browserów i `E2E_*` state. CI istnieje, ale security audit jest nieblokujący, a realne zdalne artefakty/logi nadal muszą być traktowane jako brak dowodu, dopóki nie zostaną zapisane.

- [ ] Dodać coverage provider/script dla Vitest i minimalne progi jakościowe dla krytycznych folderów (`app/api`, `lib/services`, `lib/access`, webhooki).
- [ ] Publikować coverage report jako artefakt CI i wymagać progów przed merge.
- [ ] Rozbudować Playwright o nieskipowane case’y dla homepage, channel page, login-gated video, patron-gated video, subscriptions, comments, checkout/webhook smoke i admin CRUD.
- [ ] Dodać konfigurację `E2E_*` storage state/test user/test video IDs do staging checklisty, żeby smoke nie zależał od ręcznego stanu przeglądarki.
- [ ] Zebrać i podlinkować/zapisać pierwsze zielone zdalne przebiegi GitHub Actions dla quality, integration-postgres i E2E/staging smoke.

## 4. P1 — security gates i CSP enforce

Aktualny workflow security traktuje `npm audit --audit-level=high` jako nieblokujący sygnał. Middleware ustawia `Content-Security-Policy-Report-Only`, z szerokimi hostami dla mediów/obrazów. To jest hardening w toku, nie beta-ready security gate.

- [ ] Zmienić `npm audit --audit-level=high` w CI na blokujący gate albo dodać jawny allowlist/exception workflow dla znanych podatności.
- [ ] Dodać SAST/secret scanning jako wymagany gate albo opisać, gdzie jest wykonywany poza repo.
- [ ] Przejść z `Content-Security-Policy-Report-Only` na egzekwowany `Content-Security-Policy` po walidacji hostów Clerk/Stripe/media.
- [ ] Zwęzić CSP hosty mediów i obrazów tak, aby były zgodne z jawnie skonfigurowanymi allowlistami repo, a nie szerokimi wildcardami providerów.
- [ ] Dodać test albo snapshot nagłówków bezpieczeństwa dla middleware.

## 5. P1 — konfiguracja runtime, Node matrix i ukryte fallbacki

Runtime Node jest ujednolicony na Node 22 przez `.nvmrc`, `package.json#engines` i GitHub Actions (`actions/setup-node` czyta `.nvmrc`). `ClerkLocalizationProvider` nie używa już build-time placeholdera dla `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; brak klucza jest błędem walidacji env i jawnie zatrzymuje provider. Nadal trzeba potwierdzić produkcyjne zależności środowiskowe na realnym deployu.

- [ ] Potwierdzić produkcyjne Redis/KV dla rate limitów na realnym środowisku; memory fallback pozostaje wyłącznie dev/test.
- [ ] Potwierdzić produkcyjne allowlisty hostów mediów/obrazów w ENV, bez szerokich domen providerów.

## 6. P1 — formalizacja kontraktów API

Route handlers mają kontrakty w kodzie, ale nie ma jednej specyfikacji API. Drift między API i server actions pokazał, że repo potrzebuje jednego źródła prawdy dla request/response i konsumentów.

- [ ] Dodać tabelę kontraktów albo OpenAPI dla `/api/subscriptions`, `/api/user/language`, `/api/media-source/[videoId]`, `/api/checkout/create-intent`, webhooków i admin APIs.
- [ ] Dla każdego publicznego route opisać: auth, rate limit, input, output, error codes, efekty uboczne i owner service.
- [ ] Dodać testy kontraktowe dla najważniejszych response shapes, szczególnie public JSON bez prywatnych pól.

## 7. P1 — performance, observability i alertowalne sygnały

Logger i audit logi są dobrą bazą, ale nadal brakuje metryk, request IDs, tracingu i alertów dla flows, które decydują o pieniądzach, dostępie i mediach.

- [ ] Dodać request/correlation ID dla krytycznych route handlers i webhooków.
- [ ] Dodać metryki lub dashboardy dla: webhook processing time, duplicate/stale lock conflicts, payment failures, refund/dispute handling, 403/429 spikes, media upstream errors.
- [ ] Dodać alerty dla nieudanych webhooków Stripe/Clerk, błędów sync Clerk access, wysokiego 429 oraz błędów media proxy.
- [ ] Zebrać podstawowy profiling/budżety dla homepage, channel page, comments, player/media-source i checkout render.

## 8. P2 — scope bety, eksperymentalne funkcje i multi-creator

Repo nadal ma funkcje oznaczone jako eksperymentalne lub niedomknięte: campaign/zrzutka page, upload/transcoding pipeline, signed HLS/DASH delivery oraz ograniczony multi-creator. Beta powinna mieć zamrożony scope bez udawania, że niedomknięte ścieżki są gotowe.

- [ ] Spisać jawny beta scope: które funkcje są w becie, które są wyłączone/ukryte i które są świadomie poza zakresem.
- [ ] Ukryć albo domknąć campaign/zrzutka page przed prywatną betą.
- [ ] Domknąć upload pipeline albo jasno ograniczyć betę do administrator-provided trusted media URLs.
- [ ] Zaprojektować signed HLS/DASH delivery albo utrzymać fail-closed i opisać to jako ograniczenie bety.
- [ ] Wyczyścić hardcoded single-creator assumptions tylko wtedy, gdy beta ma wyjść poza jeden skonfigurowany kanał.

## 9. P2 — moduły, hotspoty i dług techniczny

Kod ma sensowne warstwy domenowe, ale duże serwisy i client components zwiększają ryzyko regresji przy kolejnych zmianach beta-hardening.

- [ ] Rozbić `UserService` na mniejsze moduły: profile sync, subscriptions, referrals, admin/bootstrap, language preference.
- [ ] Rozbić `PaymentService` na lifecycle checkout, webhook fulfillment, refund/dispute repair i access sync.
- [ ] Ograniczyć największe client components/hotspoty komentarzy/admin videos do mniejszych jednostek z testowalnymi granicami.
- [ ] Ustawić lokalne guardrails dla max LOC / complexity w krytycznych modułach albo przynajmniej dokumentować wyjątki.

## 10. P2 — dokumentacja, licencja i reconciliation pass

Dokumentacja była miejscami bardziej optymistyczna niż runtime. Po każdym hardeningu trzeba utrzymać zasadę: README/ENV/deploy docs opisują dokładnie to, co działa w kodzie i zostało zweryfikowane.

- [ ] Po naprawie admin auth zrobić pełny reconciliation pass README, `.env.example`, `DEPLOY_CHECKLIST.md`, `KNOWN_LIMITATIONS.md` i `ARCHITECTURE.md`.
- [ ] Usunąć z dokumentacji twierdzenia typu PASS, jeśli nie mają aktualnego testu/komendy albo staging evidence.
- [ ] Dodać jawny status licencyjny: `LICENSE`, `license` w `package.json` albo świadome oznaczenie proprietary/private.
- [ ] Zaktualizować nazwę/metadane pakietu, jeśli repo nie powinno dalej występować jako historyczne `polutek`.

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
