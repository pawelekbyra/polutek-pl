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

Aplikacja działa jako **single-creator VOD** z przygotowaniem danych pod tryb multi-creator. Flaga `ENABLE_MULTI_CREATOR=false` utrzymuje stronę główną jako główny widok wybranego twórcy. W aktualnym kodzie `/channel/[slug]` przekierowuje na `/`, gdy `ENABLE_MULTI_CREATOR=false` i `params.slug === flags.mainCreatorSlug`; brak redirectu dla tego sluga jest wymaganiem roadmapy, ale nie jest jeszcze wdrożony.

Wartość `MAIN_CREATOR_SLUG` jest wymagana dla spójnych danych produkcyjnych. Kod nie powinien polegać na fallbacku do konkretnego sluga kanału.

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

Aktualny endpoint `/api/subscriptions` jest endpointem legacy: `GET` zwraca `isSubscribed: false`, a `POST` zwraca `410 SUBSCRIPTIONS_LEGACY`. Roadmapa wymaga zastąpienia tego pełnym flow mailowego follow/unfollow z modalem zgody.

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
npm run typecheck
npm test -- --run
npm run lint
npm run build
npm run db:validate
npm run db:generate
npm run db:smoke
npm run db:migrate:deploy
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

- Strona `/channel/[slug]` nadal przekierowuje skonfigurowany slug na `/` w trybie single-creator.
- Flow subskrypcji mailowej nie jest gotowy; endpoint jest legacy i zwraca `410` dla `POST`.
- Nie ma pełnego smoke E2E Playwright potwierdzającego kliknięcia użytkownika.
- Komendy DB wymagają prawdziwych `DATABASE_URL` i `DATABASE_URL_UNPOOLED`; bez nich `db:smoke` i `db:migrate:deploy` nie są dowodem gotowości.
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
- [x] Uruchomiono `npm run typecheck`; wynik PASS.
- [x] Uruchomiono `npm test -- --run`; wynik PASS: 21 plików testowych, 108 testów.
- [x] Uruchomiono `npm run lint`; wynik PASS: brak ostrzeżeń i błędów ESLint.
- [x] Uruchomiono `npm run build`; wynik PASS: production build zakończony sukcesem.
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
- [ ] Przejrzeć pozostawione `any` i opisać każdy świadomy wyjątek albo usunąć.
- [ ] Dodać zakaz nowych `@ts-ignore`, nieuzasadnionych `any` i obchodzenia strict mode do checklisty CI/review.

## 4. Logger i console hygiene

- [ ] Zinwentaryzować `console.*` w kodzie produkcyjnym.
- [ ] Zastąpić produkcyjne logi loggerem bez sekretów, signed URL-i, tokenów, danych kart i pełnych payloadów webhooków.
- [ ] Pozostawić `console.*` tylko w skryptach CLI/testach albo z uzasadnieniem w raporcie.

## 5. Strona kanału `/channel/[slug]`

- [ ] Usunąć redirect skonfigurowanego `MAIN_CREATOR_SLUG` do `/` i zapewnić pełną stronę kanału.
- [ ] Potwierdzić banner/avatar/name/slug/bio/count/grid dla `/channel/${MAIN_CREATOR_SLUG}`.
- [ ] Dodać linki z Hero i ChannelHome do dynamicznego sluga twórcy.
- [ ] Upewnić się, że sitemap generuje dynamiczny URL kanału bez hardcoded sluga.
- [ ] Dodać testy jednostkowe/smoke dla strony kanału.

## 6. Subscription jako mail follow, nie access

- [ ] Zastąpić legacy `/api/subscriptions` pełnym `GET/POST/DELETE` follow/unfollow.
- [ ] `GET` ma zwracać status subskrypcji mailowej dla zalogowanego użytkownika i twórcy.
- [ ] `POST` ma tworzyć `Subscription` jako zgodę mailową, bez zmiany `User.isPatron`.
- [ ] `DELETE` ma usuwać/wyłączać zgodę mailową, bez odbierania `User.isPatron`.
- [ ] Dodać walidację `creatorId`/slug i ochronę przed zapisaniem do nieistniejącego twórcy.

## 7. Komponent subskrypcji

- [ ] Dodać przycisk `Subskrybuj` / `Subskrybowano` na stronie kanału.
- [ ] Dodać analogiczny entrypoint na stronie filmu/playlisty, jeśli UX tego wymaga.
- [ ] Guest click → Clerk Sign In.
- [ ] Logged user click → modal zgody mailowej.
- [ ] Unsubscribe → modal potwierdzenia wypisania.
- [ ] Teksty UI muszą jasno mówić, że subskrypcja to maile/obserwowanie, nie patron access.

## 8. Testy Subscription vs Patron

- [ ] subscribed non-patron nie ma dostępu do `PATRON`.
- [ ] patron unsubscribed nadal ma dostęp do `PATRON`.
- [ ] patron subscribed ma dostęp do `PATRON` i ma rekord `Subscription`.
- [ ] Admin access pozostaje niezależny od subskrypcji.
- [ ] Legacy endpoint nie może udawać gotowego flow.

## 9. Media proxy security

- [x] Aktualne testy jednostkowe mediów przechodzą w pakiecie Vitest.
- [ ] Rozszerzyć testy SSRF/private IP/localhost/metadata endpoints, jeśli brakuje przypadków.
- [ ] Potwierdzić logowanie bez sekretów i bez pełnych signed URL-i.
- [ ] Potwierdzić allowlistę hostów w ENV produkcyjnym.

## 10. Stripe

- [x] Aktualne testy jednostkowe Stripe/refund/dispute przechodzą w pakiecie Vitest.
- [ ] Potwierdzić webhook signature na realnych/fixture payloadach.
- [ ] Potwierdzić idempotency dla eventów Stripe.
- [ ] Potwierdzić partial refund, full refund i lost dispute na danych testowych.
- [ ] Potwierdzić synchronizację patron access po płatności/refundzie/dispute.

## 11. Clerk webhook

- [x] Aktualne testy jednostkowe Clerk webhook przechodzą w pakiecie Vitest.
- [ ] Potwierdzić create/update/delete z fixture payloadami.
- [ ] Potwierdzić signature verification i idempotency/stale processing.
- [ ] Potwierdzić login flow w smoke/E2E.

## 12. Admin

- [x] Aktualne testy jednostkowe admin dashboard przechodzą w pakiecie Vitest.
- [ ] Potwierdzić guest → brak dostępu.
- [ ] Potwierdzić non-admin → brak dostępu.
- [ ] Potwierdzić admin → dostęp.
- [ ] Potwierdzić ochronę API admina, nie tylko UI.

## 13. Rate limit

- [ ] Potwierdzić limity dla checkout, comments, media, subscriptions i referrals.
- [ ] Potwierdzić zachowanie produkcyjne Redis/KV.
- [ ] Dodać testy dla nowego endpointu subskrypcji po jego wdrożeniu.

## 14. ENV validation

- [ ] Dodać centralną walidację env dla dev/test/prod.
- [ ] Wymusić `MAIN_CREATOR_SLUG` tam, gdzie jest wymagany.
- [ ] Wymusić DB URLs dla migracji/smoke/deploy.
- [ ] Jasno rozdzielić opcjonalne i wymagane zmienne.

## 15. Testy, coverage i E2E

- [x] Unit suite PASS: 21 plików, 108 testów.
- [ ] Dodać coverage script i raport minimalnych progów albo świadomie oznaczyć brak progu jako limitation.
- [ ] Dodać Playwright smoke dla krytycznych ścieżek bety.
- [ ] Smoke musi objąć `/`, `/channel/${MAIN_CREATOR_SLUG}`, login redirect, subskrypcję, patron access i media proxy.

## 16. CI/CD

- [ ] Dodać `.github/workflows/ci.yml` z jobem quality: `npm ci`, `prisma validate`, `prisma generate`, `typecheck`, tests, lint, build.
- [ ] Dodać job integration-postgres z Postgres service, migrations i `db:smoke`.
- [ ] Dodać podstawowy job security albo udokumentować brak.

## 17. Dokumentacja poza README

- [ ] Zaktualizować `ARCHITECTURE.md`.
- [ ] Zaktualizować `DEPLOY_CHECKLIST.md`.
- [ ] Zaktualizować `KNOWN_LIMITATIONS.md`.
- [x] Zaktualizowano `.env.example` o neutralny `MAIN_CREATOR_SLUG` i opcjonalne `MAIN_CREATOR_NAME`.
- [ ] Upewnić się, że dokumentacja wszędzie rozdziela `Subscription` od `Patron`.

## 18. Finalna walidacja przed prywatną betą

Wykonać z czystego stanu:

```bash
rm -rf node_modules .next
npm ci
npx prisma validate
npx prisma generate
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

## 19. Raport końcowy każdego agenta

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
