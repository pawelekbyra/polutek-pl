# Audyt kodu — 2026-07-03

Pełny audyt przeprowadzony równolegle przez trzech agentów (bezpieczeństwo playbacku/mediów, domena patron/płatności, jakość API) + weryfikację testów i typów. Agent od jakości API/frontendu nie ukończył pracy (limit sesji) — jego zakres pokryto częściowo ręczną weryfikacją (niezmiennik reakcji na komentarze, limity `findMany`).

## Werdykt ogólny

Fundamenty są solidne: **1135/1135 testów przechodzi**, kod produkcyjny typuje się czysto, wszystkie kluczowe niezmienniki z CLAUDE.md (PatronGrant jako źródło prawdy, brak wycieku `videoUrl`, cache media-source, thumbnail policy, idempotencja `fulfillPayment`, autoryzacja tras admina) są przestrzegane. Znaleziono jednak **2 realne luki bezpieczeństwa (Mux)** i **3 poważne błędy w ścieżce płatności** (cron reconciliation + obsługa eventów Stripe).

## Weryfikacja automatyczna

- `npx vitest run`: **214 plików / 1135 testów passed**, 2 pominięte, 0 porażek.
- `npx tsc --noEmit`: kod produkcyjny **czysty**; 4 błędy wyłącznie w testach (przestarzałe fixture'y — patrz N-y niżej).

## Znaleziska — WYSOKIE

### W1. Webhook Mux fail-open bez sekretu + brak anty-replay
`app/api/webhooks/mux/route.ts:28-37` — gdy `MUX_WEBHOOK_SECRET` nie jest ustawiony (także w produkcji), każdy POST jest akceptowany bez weryfikacji sygnatury. Kontrast: webhook Cloudflare Stream jest fail-closed (500 przy braku sekretu). Dodatkowo parser sygnatury (`:9-25`) ignoruje timestamp `t=` — brak okna tolerancji umożliwia replay przechwyconego payloadu. Atakujący może sfałszować `video.asset.ready` / `video.asset.errored` i manipulować stanem assetów (w tym auto-publikacją `publishAfterAssetReady`).
**Fix:** fail-closed w produkcji + tolerancja czasowa 300 s jak w webhookach Cloudflare/Stripe.

### W2. Niepodpisany, bezterminowy URL Mux dla treści PATRON
`lib/modules/playback/application/playback.service.ts:390-397` — gdy Mux signing nie jest skonfigurowany, budowany jest publiczny `https://stream.mux.com/{playbackId}.m3u8` bez tokenu i bez `expiresAt`, także dla wideo `tier=PATRON`. Cloudflare w analogicznej sytuacji zwraca ERROR — Mux nie. Redakcja `isProbablyRawMediaUrl` nie łapie `stream.mux.com`, więc URL wycieka w `playbackUrl` i może być udostępniony publicznie na zawsze.
**Fix:** dla PATRON blokować Mux bez signing (jak gałąź Cloudflare) lub wymuszać signed playback policy.

### W3. Cron reconciliation omija `fulfillPayment()` i ustawia SUCCEEDED gołym `updateMany`
`app/api/cron/stripe-reconciliation/route.ts:66-80` — gdy intent jest `succeeded`, ale user ma już jakikolwiek aktywny PatronGrant, cron robi `tx.payment.updateMany({ status: SUCCEEDED })` z pominięciem `fulfillPayment()`. Narusza wprost CLAUDE.md §10; pomija `incrementUserPaymentTotal` (trwały dryf `UserPaymentTotal`), nie tworzy PatronGrant powiązanego z płatnością (pełny refund starszej płatności odbierze patrona mimo drugiej kwalifikującej wpłaty), nie wysyła maila.
**Fix:** zawsze przechodzić przez `fulfillPayment()` — jest idempotentny, bypass jest zbędny.

### W4. `payment_intent.payment_failed` nadpisuje status bez CAS
`lib/modules/payments/application/handle-stripe-webhook.use-case.ts:99-106` — bezwarunkowy update na FAILED. Stripe nie gwarantuje kolejności eventów: `payment_failed` przetworzony po `succeeded` nadpisuje SUCCEEDED na FAILED i nic tego nie naprawia (cron skanuje tylko PENDING, replay `succeeded` odbija się o lock).
**Fix:** CAS `PENDING → FAILED` (jednolinijkowy, wzorzec już jest w reszcie modułu).

### W5. Cron oznacza `requires_payment_method` (>1h) jako FAILED bez ścieżki recovery
`app/api/cron/stripe-reconciliation/route.ts:96-109` — intent w `requires_payment_method` da się jeszcze sfinalizować (client_secret żyje do 24 h). Sekwencja: cron → FAILED po 1 h → user płaci → webhook `succeeded` → CAS na PENDING daje `count=0` → fulfillment zwraca null. **Pieniądze pobrane, patron nigdy nie nadany**, brak automatycznego odzysku.
**Fix:** wydłużyć okno do ≥24 h lub dodać ścieżkę recovery FAILED→SUCCEEDED dla potwierdzonego `intent.status === 'succeeded'`.

### W6. `PATRON_MIN_TIP_AMOUNT` / `PATRON_MIN_TIP_CURRENCY` to martwa konfiguracja
Walidowane w `lib/env/validation.ts:32-33,116-118`, opisane w CLAUDE.md §8 jako próg patrona, ale **nigdzie nie czytane w logice eligibility**. Rzeczywisty próg = `getPaymentCurrencyLimits()` (minimalna kwota checkoutu, `lib/constants.ts`), więc w praktyce każda udana płatność nadaje status patrona. Właściciel ustawiający `PATRON_MIN_TIP_AMOUNT=500` sądzi, że podnosi próg — env jest ignorowany.
**Fix (decyzja produktowa):** podpiąć env do polityki eligibility albo usunąć go z walidacji i dokumentacji.

## Znaleziska — ŚREDNIE

- **Ś1. `dispute.closed` ze statusem `warning_closed` trwale zawiesza patrona** — `handle-stripe-webhook.use-case.ts:86-97` + `handle-dispute.use-case.ts:100-113`: zamknięte *inquiry* (bez chargebacku) wpada do gałęzi domyślnej → płatność DISPUTED, granty revoked; reaktywacja działa tylko przy `isWon`. Niegroźne zapytanie banku = trwała utrata dożywotniego dostępu do ręcznej interwencji.
- **Ś2. Lock webhooka Stripe: CONFLICT → HTTP 200 = możliwa utrata eventu** — `stripe-event-lock.service.ts:31-56`: gdy pierwszy procesor umrze twardo, event wisi w PROCESSING; retry Stripe w oknie <10 min dostaje CONFLICT → 200 → Stripe kończy delivery. Cron-siatka istnieje tylko dla `payment_intent.succeeded` i **jest wyłączona na planie Hobby**. Bezpieczniej zwracać 500 przy CONFLICT.
- **Ś3. `getMediaClientIp` ufa `x-forwarded-for` bez walidacji zaufanego proxy** — `lib/media/rate-limit.ts:3-9`: obejście rate-limitów przez rotację fałszywego IP; w `playback-event` fingerprint anonimowej sesji liczony z nagłówków sterowanych przez klienta. Na Vercelu wiarygodny jest skrajny prawy człon XFF.
- **Ś4. Publiczna wyszukiwarka zwraca metadane wideo PATRON** — `lib/modules/video/application/video-search.service.ts:23,72-79`: tytuł/opis/miniatura treści patron-only widoczne dla każdego (playback nadal gated). Do potwierdzenia jako świadoma decyzja (odkrywalność) lub odfiltrowania.
- **Ś5. Brak zdarzenia audytowego przy nadaniu patrona** — `grant-patron.use-case.ts` nie woła `recordAuditEvent` (revoke woła `PATRON_REVOKED`); asymetria i luka w AuditLog dla operacji nadającej płatny dostęp.
- **Ś6. Fallback P2002 w `grantPatron` czyta z przerwanej transakcji** — `grant-patron.use-case.ts:93-113`: po P2002 w wariancie z `tx` kod odpytuje abortowaną transakcję (Postgres `25P02`) — ścieżka odzysku idempotencji jest z konstrukcji niesprawna (niskie prawdopodobieństwo trafienia, ale to fałszywe zabezpieczenie).

## Znaleziska — NISKIE

- **N1.** Cron: porównanie `CRON_SECRET` nie jest timing-safe (`stripe-reconciliation/route.ts:14`) — dla spójności użyć `timingSafeEqual`.
- **N2.** Cron nie weryfikuje kwoty/waluty względem Stripe — `stripe-reconciliation/route.ts:82-87` przekazuje lokalne wartości zamiast `intent.amount/currency`, więc kontrole mismatch porównują „lokalne z lokalnym".
- **N3.** Równoległe granty ADMIN mogą się zdublować (check-then-create bez unique; funkcjonalnie nieszkodliwe).
- **N4.** Nieaktualny komentarz w `prisma/schema.prisma:181` — odwołuje się do nieistniejącego `User.isPatron`; wprowadza w błąd przyszłych agentów.
- **N5.** Utracone maile fulfillmentu nie są ponawiane (`fulfill-payment.use-case.ts:150-174`) — grant się nie dubluje, jest audyt `EMAIL_SEND_FAILED`; świadomy trade-off.
- **N6.** `lib/services/payment.service.ts:240-243` (deprecated bridge) ustawia SUCCEEDED gołym `update` — nieużywany w produkcji, ale to drugi wzorzec łamiący niezmiennik czekający na przypadkowe użycie.
- **N7.** 4 błędy typów w testach (runtime przechodzi): `tests/unit/modules/users.test.ts:249` i `tests/unit/security/launch-security-boundaries.test.ts:189,208` odwołują się do usuniętego cache'a `isPatron`/starej sygnatury `buildPatronDiagnosticsReadModel`; `tests/unit/modules/video/video-repository-assets-1n.test.ts:7` — fixture bez nowych pól VideoAsset.
- **N8.** `redactInternalMediaSource`/`isProbablyRawMediaUrl` (`media.policy.ts:238-283`) nie klasyfikuje `stream.mux.com`/`videodelivery.net` jako raw — obrona głęboka powiązana z W2.

## Obszary zweryfikowane jako poprawne

1. **Niezmiennik PatronGrant** — kolumny legacy fizycznie usunięte; wszystkie wystąpienia `isPatron` w kodzie to pola DTO liczone z `patronGrants: { revokedAt: null }` lub filtry query. Zero zapisów/odczytów po stronie User; Clerk nigdzie nie gate'uje dostępu.
2. **Brak wycieku `videoUrl`** — `PublicVideoDto` z `videoUrl?: never`, `toPublicVideoDto` nie kopiuje pola, `assertPublicVideoDtoSafe` + redakcja jako obrona głęboka; `videoUrl` tylko w kodzie admina i server-side media-proxy.
3. **`/api/media/[...path]`** — brak path traversal, allowlista hostów, `checkVideoAccess`, poprawne użycie `isLegacyPrivatePlaybackFallbackAllowed()`, nagłówki `private, no-store`.
4. **`/api/media-source`** — `private, no-store` (bez `s-maxage`), `playbackSessionId` tylko dla planu READY, fingerprint wiązany przy tworzeniu sesji.
5. **Thumbnail proxy** — published→PUBLIC cache, draft→PRIVATE + admin-only; SSRF chronione allowlistą `ALLOWED_THUMBNAIL_HOSTS`, https-only, blokada prywatnych hostów.
6. **`checkVideoAccess` / PlaybackPlan** — tokeny/sesje dopiero po `hasAccess === true`; `recordPlaybackEvent` ponownie sprawdza dostęp, weryfikuje własność sesji i deduplikuje widoki przez Redis.
7. **Autoryzacja admina** — wszystkie 40+ tras `app/api/admin/*` używa `requireAdminForApi` + middleware `auth.protect()` na `/api/admin(.*)`; rola z DB, nie z metadanych Clerk.
8. **Webhooki Stripe/Cloudflare/Clerk/Resend** — sygnatury weryfikowane, fail-closed w produkcji (poza Mux — W1), Cloudflare z `timingSafeEqual` i tolerancją 300 s.
9. **Idempotencja `fulfillPayment`** — trzy warstwy (PK StripeEvent, CAS PENDING→SUCCEEDED w transakcji, unique `PatronGrant.paymentId`); podwójny webhook / race / częściowa awaria nie dublują granta ani totali.
10. **Kwoty/waluty** — spójnie minor units, porównania case-insensitive, uppercase do DB, lowercase do Stripe.
11. **E-maile** — audience patronów przez `patronGrants`, unsubscribe HMAC-SHA256 z `timingSafeEqual` i kontrolą exp/wersji/celu.
12. **Refund/chargeback** — CAS na `refundedAmountMinor`, clamp, `GREATEST(0, …)` na totalach, pełny refund → revoke per paymentId.
13. **Reakcje na komentarze** — DISLIKE nie dotyka `likesCount` (`comment.repository.ts:99-101`), delete dekrementuje tylko dla LIKE (`:102-107`), toggle w transakcji z unique `[userId, commentId]`; zapytania listujące mają `take`.
14. **Rate limiting** — fail-closed w produkcji przy braku Redis.

## Priorytety naprawy

1. **W1 + W2** (Mux) — realne wektory: integralność stanu assetów i wieczny wyciek treści patron-only.
2. **W3 + W4 + W5** (płatności) — trwały dryf danych finansowych i scenariusz „pieniądze pobrane, patron nie nadany".
3. **W6** — decyzja produktowa: podpiąć próg patrona albo usunąć martwy env.
4. **Ś1, Ś2** — poprawność obsługi dispute'ów i odporność na utratę eventów.
5. Reszta — porządki (testy N7, komentarz w schemacie N4, timing-safe N1).
