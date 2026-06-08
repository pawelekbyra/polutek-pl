# Polutek.pl — kompletny masterplan architektury i refaktoryzacji

## 0. Cel dokumentu

Ten dokument opisuje docelową wizję architektury Polutek.pl.

Ma służyć jako briefing dla agentów AI, programistów i przyszłych refaktorów.

Nie jest to lista rzeczy do zrobienia naraz.

To jest całościowy masterplan:

1. czym jest produkt,
2. jaki jest aktualny kierunek refaktoryzacji,
3. jakie są reguły architektoniczne,
4. jak mają wyglądać moduły,
5. jak zarządzać błędami, transakcjami, side effectami i testami,
6. czego nie robić,
7. jak wygląda późniejszy poziom „architecture excellence”.

Najważniejsza zasada:

> Polutek.pl ma być maksymalnie jasnym, praktycznym modularnym monolitem dla prywatnej platformy jednego twórcy, a nie korporacyjnym systemem z nadmiarem abstrakcji.

---

# 1. Czym jest Polutek.pl

Polutek.pl to prywatna platforma VOD, patronatu, komentarzy i mailingu dla jednego twórcy.

Produktowo jest to:

> strict single-channel creator hub

czyli:

* jeden oficjalny kanał,
* jeden twórca,
* jeden katalog treści,
* jeden system patronatu,
* jedna społeczność,
* jedno miejsce, do którego najwierniejsi widzowie mogą wracać niezależnie od dużych platform.

To nie jest:

* marketplace wielu twórców,
* platforma onboardingowa dla creatorów,
* mini-Patreon dla wielu profili,
* publiczny multi-channel social network.

To jest:

> prywatny system medialny jednego twórcy.

W bazie może nadal istnieć model `Creator`, ale należy go traktować jako legacy techniczną reprezentację `MainChannel`.

Nie należy od razu robić migracji Prisma:

```txt
Creator -> Channel
creatorId -> channelId
```

To może być późny etap. Na teraz ważniejsze jest uporządkowanie zachowania i architektury.

---

# 2. Product invariant — strict single-channel

Produkt jest single-channel.

W runtime nie wolno:

* tworzyć creatorów,
* automatycznie przemianowywać creatorów,
* automatycznie zatwierdzać creatorów,
* automatycznie ustawiać `isPrimary`,
* demotować innych creatorów,
* przepinać ownershipu filmów/komentarzy/płatności/subskrypcji,
* zgadywać fallback creatora,
* odpalać maintenance z normalnego page load/API route.

`Creator` w bazie to legacy `MainChannel`.

Publiczne filmy muszą należeć do `mainChannel.id`.

Checkout nie może przyjmować `creatorId` od klienta.

Subscription/follow nie może oznaczać Patron access.

```txt
Subscription != Patron
```

Maintenance/setup/repair musi być:

* explicit,
* previewable,
* confirmed,
* auditable.

Normalny runtime może czytać main channel, ale nie może go tworzyć, naprawiać, przepinać ani zgadywać.

---

# 3. Aktualny cel architektoniczny

Celem jest praktyczny modularny monolit.

Nie mikroserwisy.

Nie enterprise DDD.

Nie wielki DI container.

Nie event sourcing wszędzie.

Nie CQRS na siłę.

Docelowy prosty przepływ:

```txt
route -> use-case -> policy/service/repository -> Prisma
```

Route ma być cienki.

Use-case ma być głównym wejściem do logiki biznesowej.

Policy trzyma reguły.

Repository dotyka bazy.

DTO oddziela API/UI od Prisma.

Moduł eksportuje publiczne API przez `index.ts`.

---

# 4. Główna roadmapa refaktoryzacji R0–R11

Refaktoryzacja modular monolith ma stworzyć strukturę:

```txt
lib/
  api/
    auth.ts
    parse-json.ts
    response.ts
    errors.ts
    route-helpers.ts

  modules/
    shared/
    audit/
    media/
    channel/
    users/
    video/
    patron/
    payments/
    comments/
    email/
```

Kolejność prac powinna wynikać z zależności:

```txt
R0 — zasady i infrastruktura
R1 — shared, api boundary, errors, ctx
R2 — audit
R3 — media
R4 — channel
R5 — users
R6 — video
R7 — patron + payments
R8 — comments
R9 — email
R10 — cleanup deprecated facade’ów
R11 — admin frontend
```

Nie wolno zaczynać dużej migracji `video`, `payments`, `comments` ani `email`, jeśli fundament `R1` nie jest stabilny.

Nie wolno oznaczać etapu jako `[x]`, jeśli istnieją tylko foldery, ale nie ma testów, boundary guardów, realnej integracji i aktualizacji README.

---

# 5. Reguły modular monolith

## 5.1 Use-case jako port wejściowy

Route nie woła repository.

Route nie powinien bezpośrednio używać Prisma.

Route woła use-case.

Przykład cienkiego route’a:

```ts
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  const input = await parseJson(req, updateAdminVideoSchema);

  const result = await updateAdminVideo(
    { videoId: params.id, ...input },
    createAppContext({ actor: { type: "admin", userId: admin.userId } })
  );

  return fromUseCaseResult(result);
}
```

Route nie powinien zawierać:

* rozbudowanego `switch/case` domenowego,
* bezpośredniego `prisma.*`,
* `prisma.$transaction`,
* lokalnej implementacji access policy,
* lokalnej implementacji media allowlist,
* ręcznego dużego mapowania DTO,
* ręcznego audit logu,
* logiki Stripe/Clerk/Resend,
* wielokrokowej mutacji biznesowej.

## 5.2 Use-case przyjmuje `input` i `ctx`

Każdy use-case powinien mieć prosty kontrakt:

```ts
export async function updateAdminVideo(
  input: UpdateAdminVideoInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDto, UpdateAdminVideoError>> {
  // business logic
}
```

Use-case ma znać logikę biznesową.

Route ma znać HTTP.

Te warstwy nie powinny się mieszać.

## 5.3 Prosty `AppContext`

Nie używać ciężkiego dependency injection.

Wystarczy:

```ts
export type AppContext = {
  prisma: PrismaClient;
  actor: Actor;
  now: () => Date;
  logger?: Logger;
};
```

W testach można podstawić:

* fake `now`,
* mock logger,
* testową Prismę,
* fake actor,
* mock repository, jeśli dany use-case został tak zaprojektowany.

## 5.4 Jeden model aktora

Zamiast przekazywać luźne `userId`, `actorId`, `admin`, `session`, `currentUser`, warto używać jednego typu:

```ts
export type Actor =
  | { type: "guest" }
  | { type: "user"; userId: string; isPatron: boolean }
  | { type: "admin"; userId: string }
  | { type: "system"; reason: string };
```

Use-case dostaje:

```ts
ctx.actor
```

Dzięki temu policy i testy mogą jasno rozróżnić:

* gościa,
* zalogowanego użytkownika,
* patrona,
* admina,
* systemowy job/outbox.

## 5.5 Result Pattern dla przewidywalnych błędów domenowych

Use-case nie powinien rzucać wyjątków dla normalnych, przewidywalnych błędów domenowych.

Zalecany standard:

```ts
export type UseCaseResult<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E };
```

Przykład:

```ts
export async function updateAdminVideo(
  input: UpdateAdminVideoInput,
  ctx: AppContext
): Promise<UseCaseResult<AdminVideoDto, UpdateAdminVideoError>> {
  const video = await videoRepository.findById(input.videoId, ctx.prisma);

  if (!video) {
    return {
      ok: false,
      error: appError("VIDEO_NOT_FOUND", "Video not found"),
    };
  }

  if (video.creatorId !== input.mainChannelId) {
    return {
      ok: false,
      error: appError("VIDEO_NOT_ON_MAIN_CHANNEL", "Video is outside main channel"),
    };
  }

  const updated = await ctx.prisma.$transaction(async (tx) => {
    return videoRepository.updateForMainChannel(input, tx);
  });

  return {
    ok: true,
    data: toAdminVideoDto(updated),
  };
}
```

Route tłumaczy wynik przez helper:

```ts
return fromUseCaseResult(result);
```

## 5.6 Kiedy używać Result, a kiedy throw

Przewidywalny błąd domenowy:

```txt
VIDEO_NOT_FOUND
VIDEO_NOT_ON_MAIN_CHANNEL
NOT_PATRON
PAYMENT_ALREADY_PROCESSED
STRIPE_EVENT_DUPLICATE
COMMENT_HIDDEN
USER_SOFT_DELETED
BROADCAST_ALREADY_SENT
MAINTENANCE_CONFIRMATION_MISMATCH
```

powinien wracać jako:

```ts
{ ok: false, error }
```

Nieoczekiwana awaria infrastrukturalna może nadal rzucać wyjątek:

* brak ENV,
* bug programistyczny,
* nieobsłużony wyjątek biblioteki,
* awaria połączenia DB,
* invariant violation, którego nigdy nie powinno być.

Czyli:

```txt
Predictable domain failure -> Result
Unexpected infrastructure/programmer failure -> throw
```

## 5.7 Typy błędów per use-case

W krytycznych domenach warto definiować unie błędów per use-case.

Przykład:

```ts
type UpdateAdminVideoError =
  | AppError<"VIDEO_NOT_FOUND">
  | AppError<"VIDEO_NOT_ON_MAIN_CHANNEL">
  | AppError<"VIDEO_URL_NOT_ALLOWED">
  | AppError<"VALIDATION_FAILED">;
```

Nie trzeba od razu robić tego wszędzie.

Priorytet:

* payments,
* patron,
* access,
* video admin actions,
* comments,
* email/broadcast,
* maintenance.

## 5.8 Transakcja należy do use-case’a

Repository nie decyduje o dużej transakcji biznesowej.

Use-case zna pełną operację i on zarządza transakcją.

Nie robić ukrytych transakcji w repository, jeśli operacja dotyka wielu tabel/modułów.

Przykład:

```ts
export async function handlePaymentSucceeded(input: PaymentSucceededInput, ctx: AppContext) {
  const result = await ctx.prisma.$transaction(async (tx) => {
    await paymentRepository.markSucceeded(input.paymentId, tx);
    await patronRepository.createGrant(input.grant, tx);
    await userRepository.setPatron(input.userId, true, tx);
    await auditRepository.log({ action: "PATRON_GRANTED", userId: input.userId }, tx);

    return { userId: input.userId };
  });

  return {
    ok: true,
    data: result,
  };
}
```

## 5.9 Ochrona transakcji na poziomie typów

Wspólne typy:

```ts
export type ReadDb = PrismaClient | Prisma.TransactionClient;
export type WriteTx = Prisma.TransactionClient;
```

Read methods mogą przyjmować `ReadDb`:

```ts
export async function findVideoById(id: string, db: ReadDb) {
  return db.video.findUnique({ where: { id } });
}
```

Krytyczne write methods powinny przyjmować `WriteTx`:

```ts
export async function updateVideoForMainChannel(
  input: UpdateVideoForMainChannelInput,
  tx: WriteTx
) {
  return tx.video.updateMany({
    where: {
      id: input.videoId,
      creatorId: input.mainChannelId,
    },
    data: input.data,
  });
}
```

Zasada:

```txt
Read methods -> ReadDb
Critical write methods -> WriteTx
Use-case owns transaction boundary
```

Domeny, gdzie write powinien preferować `WriteTx`:

* payments,
* patron,
* user merge,
* maintenance apply,
* admin video multi-step mutation,
* email broadcast queue/batch status,
* comment moderation with audit.

## 5.10 Moduły domenowe nie znają HTTP

Pliki w `lib/modules/**` nie mogą importować:

```txt
next/server
next/navigation
next/cache
NextResponse
app/**
```

Use-case nie zwraca `NextResponse`.

Use-case zwraca `UseCaseResult`.

HTTP mapping jest w `lib/api/**`.

Tę zasadę należy wymuszać technicznie przez ESLint albo skrypt:

```txt
quality:architecture-boundaries
```

## 5.11 Publiczne API modułu idzie przez `index.ts`

Z zewnątrz importować:

```ts
import { updateAdminVideo } from "@/lib/modules/video";
```

Nie importować:

```ts
import { videoRepository } from "@/lib/modules/video/video.repository";
```

Repository i raw Prisma queries są prywatne dla modułu, chyba że istnieje jawny orchestrator wielomodułowy.

## 5.12 Side effecty zewnętrzne nie siedzą w DB transaction

Nie wołać bezmyślnie Clerk, Resend, Stripe ani storage wewnątrz DB transaction.

Wzorzec:

1. transaction zapisuje prawdę w DB,
2. transaction zapisuje audit,
3. transaction zapisuje outbox event albo zwraca post-commit task,
4. po commicie wykonuje się side effect albo outbox go retryuje.

---

# 6. Najważniejsze domeny i ich docelowe role

## 6.1 `shared`

Odpowiada za:

* `AppContext`,
* `Actor`,
* `UseCaseResult`,
* `AppError`,
* `ReadDb`,
* `WriteTx`,
* wspólne typy,
* podstawowe helpers.

Nie powinien zawierać logiki biznesowej konkretnej domeny.

## 6.2 `api`

Odpowiada za HTTP boundary:

* auth helpers,
* parse JSON,
* mapowanie Zod errors,
* mapowanie `UseCaseResult` na HTTP,
* response helpers,
* route handler wrapper.

`lib/api/**` może znać Next.

`lib/modules/**` nie może znać Next.

## 6.3 `channel`

Odpowiada za:

* `MainChannel`,
* strict single-channel invariant,
* public/runtime read-only access,
* maintenance preview/apply,
* channel policy,
* channel errors.

Nie wolno traktować `channel` jako multi-creator marketplace.

## 6.4 `media`

Odpowiada za:

* allowed video source URLs,
* allowed thumbnail URLs,
* HLS/DASH detection,
* direct source detection,
* media proxy safety,
* range request rules,
* local/private host blocking.

Walidacja mediów nie może być rozproszona po route’ach.

## 6.5 `video`

Odpowiada za:

* admin video CRUD,
* public video lists,
* hero video,
* reorder,
* publish/unpublish/archive,
* public DTO,
* admin DTO,
* video policy.

Każda mutacja admin video musi być scoped do `mainChannel.id`.

Nie wystarczy:

```ts
prisma.video.update({ where: { id }, data })
```

Wymagane jest:

* `updateMany` z `where: { id, creatorId: mainChannel.id }`,
* albo pre-check w tej samej transakcji,
* albo repository method wymuszająca `mainChannelId`.

Hero video:

* tylko main channel,
* tylko `PUBLIC`,
* tylko `PUBLISHED`,
* operacja atomowa.

Reorder:

* tylko main channel,
* jeśli input zawiera film spoza main channel, odrzucić całą operację,
* nie robić częściowego reorder.

## 6.6 `access`

Access ma być pierwszorzędną domeną bezpieczeństwa.

Nie tylko helper.

Docelowo:

```txt
lib/modules/access/
  access-matrix.ts
  access-policy.ts
  access-reasons.ts
  access.errors.ts
```

Decyzja access powinna mieć powód:

```ts
type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: AccessDeniedReason };
```

Powody:

```txt
NOT_LOGGED_IN
NOT_PATRON
VIDEO_NOT_PUBLISHED
VIDEO_ARCHIVED
VIDEO_NOT_ON_MAIN_CHANNEL
USER_SOFT_DELETED
ADMIN_ONLY
```

To pozwala testować nie tylko `false`, ale też dlaczego odmówiono.

## 6.7 `patron`

Odpowiada za:

* Patron access,
* `User.isPatron`,
* `PatronGrant`,
* grant/revoke/recompute,
* access source of truth.

Nie mieszać z `Subscription`.

Patron może wynikać z:

* płatności,
* grantu admina,
* migracji,
* rekomendacji,
* ręcznej decyzji.

## 6.8 `payments`

Odpowiada za:

* Stripe checkout,
* webhook routing,
* payment succeeded,
* refund,
* dispute,
* idempotency,
* money/accounting,
* powiązanie z patron access.

Stripe webhook ma być routerem eventów, nie wielkim serwisem.

Osobne use-case’y:

```txt
create-checkout-intent
handle-stripe-webhook
handle-payment-succeeded
handle-charge-refunded
handle-dispute-closed
```

DB changes przy payment succeeded muszą być atomowe.

Clerk sync/access sync po commicie albo przez outbox.

## 6.9 `idempotency`

Wspólna domena dla eventów zewnętrznych:

* Stripe,
* Clerk,
* Resend,
* outbox jobs.

Cel:

* brak double grant,
* brak double refund,
* brak double email stats,
* łatwiejsze retry.

Przykład:

```ts
await claimExternalEvent(
  { provider: "stripe", eventId: input.event.id },
  ctx
);
```

## 6.10 `outbox`

Post-commit side effect layer.

Eventy:

```txt
CLERK_ACCESS_SYNC_REQUESTED
PATRON_GRANTED_EMAIL_REQUESTED
EMAIL_BROADCAST_BATCH_REQUESTED
VIDEO_PUBLISHED_NOTIFICATION_REQUESTED
```

Use-case zapisuje event w DB w transakcji.

Worker/processor wykonuje side effect z retry.

Nie robić enterprise event bus. Wystarczy prosty, jawny outbox.

## 6.11 `users`

Odpowiada za:

* local user,
* Clerk sync,
* user profile,
* user merge,
* soft delete,
* user interaction state.

Clerk sync nie powinien być bezmyślnie wykonywany wewnątrz DB transaction.

User merge musi być osobnym, dobrze testowanym use-case’em.

## 6.12 `comments`

Odpowiada za:

* list comments,
* create comment,
* update/delete,
* react,
* report,
* moderate,
* pin/heart,
* DTO,
* comment access policy.

Nie mieszać listing/read z moderation/write.

Komentarze pod Patron content muszą respektować access policy.

## 6.13 `email`

Email/broadcast to proces, nie zwykły request.

Use-case’y:

```txt
create-broadcast
queue-broadcast
send-broadcast-batch
handle-resend-webhook
handle-inbound-email
```

Admin route nie powinien robić fire-and-forget broadcast.

Resend webhook musi być idempotentny.

Retry webhooków nie może zawyżać statystyk.

## 6.14 `audit`

Audit powinien być wspólny i transakcyjny.

Krytyczne akcje:

* payment,
* patron grant/revoke,
* admin video update,
* maintenance,
* comment moderation,
* broadcast,
* security denial spike.

## 6.15 `release`

W mistrzowskiej wersji release też jest procesem.

Docelowo można mieć:

```txt
lib/modules/release/
  collect-release-evidence.ts
  validate-release-readiness.ts
```

Albo przynajmniej skrypty, które zbierają:

* commit SHA,
* typecheck,
* tests,
* lint,
* build,
* Prisma validate,
* migrate deploy,
* db smoke,
* staging smoke,
* known blockers.

---

# 7. Quality gates

Nie polegać na pamięci agentów. Zasady powinny być wymuszane skryptami.

Docelowe komendy:

```txt
quality:architecture-boundaries
quality:no-deprecated-imports
quality:thin-routes
quality:no-direct-prisma-in-routes
quality:access-matrix
quality:env-production-safety
```

## 7.1 `quality:architecture-boundaries`

Powinien failować, jeśli:

* `lib/modules/**` importuje `next/server`,
* `lib/modules/**` importuje `next/navigation`,
* `lib/modules/**` importuje `next/cache`,
* `lib/modules/**` importuje `NextResponse`,
* `lib/modules/**` importuje `app/**`,
* route importuje repository bezpośrednio,
* moduł importuje wewnętrzne pliki innego modułu zamiast publicznego `index.ts`.

## 7.2 `quality:no-deprecated-imports`

Powinien failować, jeśli nowy kod importuje deprecated facade’y:

* `lib/services/content.service.ts`,
* `lib/services/payment.service.ts`,
* `lib/services/user.service.ts`,
* `lib/services/main-creator.service.ts`.

## 7.3 `quality:thin-routes`

Powinien:

* ostrzegać, jeśli route ma więcej niż 120 linii,
* failować, jeśli route ma więcej niż 350 linii bez jawnego wyjątku,
* ostrzegać, jeśli route zawiera `prisma.`,
* ostrzegać, jeśli route zawiera `prisma.$transaction`,
* ostrzegać, jeśli route importuje `lib/services/**`.

## 7.4 `quality:no-direct-prisma-in-routes`

Powinien wykrywać bezpośrednie użycia Prisma w route’ach poza świadomie oznaczonymi wyjątkami.

## 7.5 `quality:access-matrix`

Powinien uruchamiać testy centralnej macierzy dostępu.

## 7.6 `quality:env-production-safety`

Powinien sprawdzać:

* brak `ENABLE_MULTI_CREATOR`,
* `vercel-build` nie robi migracji,
* brak unsafe dev fallbacków w produkcji,
* wymagane ENV są walidowane.

---

# 8. Testy jako prawda produktu

Testy powinny opisywać scenariusze produktu, nie tylko implementację.

Priorytetowe testy:

```txt
guest-cannot-watch-patron-video.test.ts
patron-can-watch-patron-video.test.ts
subscribed-non-patron-cannot-watch-patron-video.test.ts
refund-revokes-patron-access.test.ts
video-outside-main-channel-is-not-public.test.ts
admin-cannot-accidentally-update-legacy-video.test.ts
resend-webhook-retry-is-idempotent.test.ts
stripe-webhook-duplicate-does-not-double-grant.test.ts
subscription-never-grants-patron-access.test.ts
checkout-never-uses-client-creator-id.test.ts
runtime-never-calls-maintenance-apply.test.ts
```

Testy powinny chronić:

* access,
* payments,
* patron,
* comments,
* media,
* admin video,
* email,
* maintenance,
* single-channel invariant.

---

# 9. Poziom mistrzowski po modular monolith — roadmapa X

Po zakończeniu `R0–R11` można wejść w roadmapę `X`.

To nie jest refaktor dla samego refaktoru.

To jest dopracowanie projektu do poziomu:

> samopilnujący się system medialny jednego twórcy.

## X1 — Access Matrix

Jedna centralna macierz dostępu + testy:

```txt
guest
user
patron
admin
soft-deleted user
```

wobec:

```txt
PUBLIC
LOGIN_REQUIRED
PATRON_REQUIRED
DRAFT
ARCHIVED
FUTURE_PUBLISHED
NON_MAIN_CHANNEL
```

Cel:

* jeden model dostępu,
* mniej wyjątków,
* łatwiejszy security review.

## X2 — Actor model + access reasons

Jeden model `Actor`.

Każda odmowa access ma powód.

Cel:

* lepszy UX,
* lepsze testy,
* mniej ifów w route’ach.

## X3 — Outbox / post-commit side effects

Clerk, Resend, broadcast, notifications, external sync przez outbox.

Cel:

* retry,
* odporność,
* mniej utraconych side effectów.

## X4 — Idempotency module

Jeden standard dla Stripe/Clerk/Resend/outbox.

Cel:

* brak podwójnych eventów,
* stabilne webhooki.

## X5 — Observability domenowe

Structured logs i eventy domenowe.

Payments:

```txt
stripe_webhook_received
stripe_webhook_duplicate
payment_fulfilled
patron_granted
refund_processed
dispute_closed
patron_revoke_failed
```

Media:

```txt
media_access_denied
media_proxy_error
range_request_failed
invalid_media_host_blocked
```

Email:

```txt
broadcast_queued
broadcast_batch_sent
broadcast_partial_failed
resend_webhook_duplicate
inbound_email_received
```

Admin:

```txt
admin_video_updated
admin_video_archived
maintenance_applied
```

Cel:

* diagnoza awarii,
* alerty,
* dowody produkcyjne.

## X6 — Quality gates

Skrypty pilnujące architektury:

```txt
quality:architecture-boundaries
quality:no-deprecated-imports
quality:thin-routes
quality:no-direct-prisma-in-routes
quality:access-matrix
quality:env-production-safety
```

Cel:

* agent AI może zapomnieć,
* skrypt nie zapomina.

## X7 — Product scenario tests

Testy językiem produktu.

Cel:

* testy jako dokumentacja prawdy produktu,
* agent AI rozumie intencję,
* edge-case’y są utrwalone.

## X8 — Admin cockpit

Admin jako centrum sterowania:

```txt
Dzisiaj:
- 3 nowe komentarze
- 1 zgłoszony komentarz
- 2 nowe płatności
- 1 failed webhook
- 1 email batch retry
- 0 media errors
- ostatni smoke: PASS
```

Sekcje:

* system health,
* failed webhooks,
* outbox queue,
* failed jobs,
* recent audit,
* broadcast status,
* payment dashboard,
* patron dashboard,
* media health,
* release readiness,
* maintenance panel.

## X9 — Runbooks

Pliki:

```txt
RUNBOOK.md
SECURITY_CHECKLIST.md
RELEASE_CHECKLIST.md
DECISIONS.md
AGENTS.md
```

Runbooki dla:

* Stripe webhook failure,
* Resend broadcast stuck,
* media proxy 403/500,
* migration failed,
* Clerk sync failed,
* patron lacks access,
* outbox backlog.

## X10 — Release readiness jako proces

Release nie jest „mam nadzieję, że działa”.

Release ma mieć evidence:

```txt
commit SHA
build PASS
typecheck PASS
tests PASS
lint PASS
Prisma validate PASS
migration deploy PASS
db smoke PASS
staging smoke PASS
known blockers
```

Może być widoczne w admin cockpit.

## X11 — Semantic schema cleanup

Późny etap.

Możliwe zmiany:

```txt
Creator -> Channel
creatorId -> channelId
Subscription -> ChannelFollow albo EmailSubscription
Payment -> SupportPayment / PatronPayment
```

Warunek:

* modular monolith stabilny,
* testy mocne,
* access matrix gotowe,
* payments/outbox stabilne,
* migration risk niski.

---

# 10. Czego nie robić

Nie robić overengineeringu.

Nie iść w:

* mikroserwisy,
* osobne bazy per domena,
* event sourcing wszędzie,
* CQRS na siłę,
* ciężki DI container,
* abstrakcję nad każdym Prisma query,
* enterprise DDD z pięcioma warstwami dla prostych operacji.

Nie przenosić logiki tylko po to, żeby zmienić foldery.

Nie oznaczać zadań jako `[x]`, jeśli nie ma testów, guardów i realnego runtime check.

Nie zaczynać X1–X11 przed ukończeniem R0–R11 bez jawnej decyzji właściciela projektu.

Najlepsza wersja Polutek.pl to:

> maksymalnie jasny modularny monolit, nie mini-korporacyjna architektura.

Idealnie nie znaczy najwięcej wzorców.

Idealnie znaczy:

> najmniej miejsc, gdzie można się pomylić.

---

# 11. Pytania kontrolne dla każdej krytycznej operacji

Każda krytyczna operacja powinna mieć odpowiedź:

```txt
Kto to robi?
Na czym to działa?
Jakie policy musi przejść?
Czy wynik jest UseCaseResult?
Jakie przewidywalne błędy może zwrócić?
Czy jest transaction?
Czy write repository wymaga WriteTx?
Jakie side effecty powstają?
Czy side effecty są po commicie albo w outbox?
Jaki audit powstaje?
Jak to obserwujemy?
Jaki test to chroni?
Jaki runbook opisuje awarię?
```

Jeśli operacja nie ma tych odpowiedzi, nie jest jeszcze mistrzowsko zaprojektowana.

---

# 12. Docelowa wizja repo

```txt
app/
  api/
    thin HTTP routes only
  admin/
    cockpit + content management

lib/
  api/
    auth
    parse
    response
    errors

  modules/
    access/
    actor/
    audit/
    channel/
    comments/
    email/
    idempotency/
    media/
    outbox/
    patron/
    payments/
    release/
    users/
    video/
    shared/

tests/
  scenarios/
  invariants/
  modules/
  e2e/

docs/
  AGENTS.md
  ARCHITECTURE.md
  DECISIONS.md
  REFACTORING_EXAMPLES.md
  RUNBOOK.md
  SECURITY_CHECKLIST.md
  RELEASE_CHECKLIST.md
```

Repo powinno mieć cztery warstwy prawdy:

```txt
1. Kod domenowy
2. Testy scenariuszy
3. Quality gates
4. Runbooki/observability
```

---

# 13. Definicja sukcesu

Na początku projekt był działającą aplikacją z historią i chaosem po zmianie koncepcji.

Po obecnej refaktoryzacji ma być dobrą, czystą aplikacją modular monolith.

Po wersji mistrzowskiej Polutek.pl ma być:

> produktowym systemem operacyjnym dla własnej platformy twórcy.

Czyli:

* spójny produkt,
* bezpieczny dostęp,
* odporne płatności,
* kontrolowany mailing,
* przejrzysty admin,
* monitoring,
* runbooki,
* testy scenariuszy produktu,
* repo prowadzące agentów AI,
* minimum miejsc, gdzie można się pomylić.

To jest poziom, którego większość twórców nigdy nie będzie miała.
