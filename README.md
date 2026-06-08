SEKCJA DO WKLEJENIA PO:

# Roadmapa refaktoryzacji architektury — modular monolith

# Stan repo po inspekcji kodu — ważne dla agentów AI

Ten README nie jest abstrakcyjną roadmapą. Poniższa mapa wynika z aktualnego układu repo.

Na moment tej inspekcji w repo nie ma jeszcze katalogu:

lib/modules/

To oznacza, że R1 jest realnym pierwszym krokiem implementacyjnym, a nie kosmetyką.

Aktualna logika domenowa jest rozproszona głównie w:

app/api/**/route.ts
lib/services/**
lib/channel/**
lib/access/**
lib/blob.ts
lib/media/**
lib/webhooks/**

Agent AI nie może zgadywać wzorców na podstawie losowo znalezionego starego route’a albo starego serwisu. Stare pliki są źródłem logiki do przeniesienia, ale nie są wzorcem docelowej architektury.

Jeżeli agent widzi konflikt między obecnym kodem a README, ma przyjąć:

1. README opisuje kierunek docelowy.
2. Aktualny kod pokazuje, skąd trzeba przenieść logikę.
3. Nie wolno kopiować starego stylu do nowych plików.
4. Nowy kod domenowy ma trafiać do lib/modules/**.
5. Stare lib/services/** mogą czasowo pozostać jako facade’y tylko wtedy, gdy są oznaczone jako deprecated i delegują do nowych modułów.

# Mapa migracji kodu — aktualne pliki do docelowych modułów

Ta mapa ma zmniejszyć ryzyko, że agent straci kontekst albo oprze się na złym pliku.

| Obecny plik / obszar                                | Aktualna rola                                                                                                                                   | Docelowy moduł                                                                                                               | Priorytet / etap                         | Uwaga dla agenta                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- |
| app/api/admin/videos/route.ts                       | Gruby admin route dla list/create/update/delete video. Zawiera Zod schema, auth, Prisma transaction, audit, media allowlist i response mapping. | lib/modules/video + lib/modules/media + lib/modules/audit + lib/api                                                          | R6, ale dopiero po R1/R2/R3/R4           | To jest główne źródło logiki do rozbicia. Nie traktować jako wzorca.                   |
| app/api/admin/videos/[id]/route.ts                  | Admin GET/DELETE pojedynczego video, częściowo przez VideosAdminService, częściowo bezpośrednio.                                                | lib/modules/video/use-cases/get-admin-video.ts, archive-video.ts                                                             | R6                                       | Route ma zostać cienki.                                                                |
| app/api/admin/videos/[id]/actions/route.ts          | Gruby route akcji video: PATCH, publish, unpublish, archive, restore, set-hero. Zawiera bezpośrednią Prismę i any.                              | lib/modules/video/use-cases/update-admin-video.ts, publish-video.ts, unpublish-video.ts, archive-video.ts, set-hero-video.ts | R6                                       | Krytyczny kandydat do refaktoru. Najpierw testy.                                       |
| app/api/admin/videos/reorder/route.ts               | Reorder video.                                                                                                                                  | lib/modules/video/use-cases/reorder-videos.ts                                                                                | R6                                       | Musi być scoped do mainChannel.id.                                                     |
| app/api/admin/videos/resync/route.ts                | Resync/admin maintenance video.                                                                                                                 | lib/modules/video albo osobny maintenance use-case                                                                           | R6 / maintenance                         | Nie mieszać z public runtime.                                                          |
| lib/services/admin/videos-admin.service.ts          | Admin query/listing DTO dla filmów.                                                                                                             | lib/modules/video/video.repository.ts + video.dto.ts + list-admin-videos.ts                                                  | R6                                       | Może być źródłem DTO/query, ale docelowo nie jako lib/services/admin.                  |
| lib/services/content.service.ts                     | Public content fetching / DTO mapping.                                                                                                          | lib/modules/video + lib/modules/channel                                                                                      | R6 / R4                                  | Oznaczyć deprecated po wprowadzeniu modułów.                                           |
| lib/services/content/video.service.ts               | Logika video content.                                                                                                                           | lib/modules/video                                                                                                            | R6                                       | Przenieść po R3/R4.                                                                    |
| lib/services/content/creator.service.ts             | Legacy creator/content helper.                                                                                                                  | lib/modules/channel                                                                                                          | R4                                       | Creator to technicznie MainChannel.                                                    |
| lib/access/access-policy.ts                         | Centralny content access policy.                                                                                                                | lib/modules/patron/patron.policy.ts + lib/modules/video/video.policy.ts albo lib/modules/shared/access-policy.ts             | R7 / R6                                  | Nie rozbić przypadkiem reguł Patron vs Subscription.                                   |
| lib/access/comment-access.ts                        | Access helper dla komentarzy.                                                                                                                   | lib/modules/comments/comment.policy.ts albo lib/modules/patron                                                               | R8                                       | Zachować rozdział Patron != Subscription.                                              |
| lib/blob.ts                                         | Media URL allowlist, local path safety, private hostname block, część proxy/NextResponse.                                                       | lib/modules/media/media-url.policy.ts + media-proxy helpers                                                                  | R3                                       | Uwaga: ten plik miesza pure policy z NextResponse. W module media nie importować Next. |
| lib/media/video-source.ts                           | Rozpoznawanie direct/HLS/DASH/YouTube/Vimeo.                                                                                                    | lib/modules/media/video-source.ts                                                                                            | R3                                       | Dobry kandydat do przeniesienia prawie 1:1.                                            |
| app/api/media/[...path]/route.ts                    | Public media proxy/gateway.                                                                                                                     | Cienki route + lib/modules/media use-case/service + lib/modules/video access                                                 | R3/R6                                    | Nie wystawiać direct videoUrl publicznie.                                              |
| app/api/media-source/[videoId]/route.ts             | Media source resolution.                                                                                                                        | lib/modules/media + lib/modules/video                                                                                        | R3/R6                                    | Access check musi zostać zachowany.                                                    |
| lib/channel/main-channel.service.ts                 | Aktualny strict single-channel read service.                                                                                                    | lib/modules/channel/main-channel.service.ts albo get-required-main-channel.ts                                                | R4                                       | To jest lepszy aktualny kierunek niż lib/services/main-creator.service.ts.             |
| lib/channel/main-channel.maintenance.ts             | Preview/apply maintenance main channel.                                                                                                         | lib/modules/channel/use-cases/preview-main-channel-maintenance.ts i apply-main-channel-maintenance.ts                        | R4                                       | Maintenance musi pozostać explicit, previewable, confirmed, auditable.                 |
| lib/channel/main-channel.policy.ts                  | Single-channel policy.                                                                                                                          | lib/modules/channel/main-channel.policy.ts                                                                                   | R4                                       | Przenieść i eksportować przez index.ts.                                                |
| lib/channel/main-channel.errors.ts                  | Błędy main channel.                                                                                                                             | lib/modules/channel/main-channel.errors.ts                                                                                   | R4                                       | Docelowo AppError albo mapowanie do AppError.                                          |
| lib/services/main-creator.service.ts                | Legacy facade wokół main channel.                                                                                                               | Deprecated facade do lib/modules/channel                                                                                     | R10 po R4                                | Nie rozwijać.                                                                          |
| app/api/admin/channel/route.ts                      | Admin channel route.                                                                                                                            | lib/modules/channel use-cases                                                                                                | R4                                       | Uważać, żeby admin GET nie robił repair/setup.                                         |
| app/api/admin/creator/route.ts                      | Legacy admin creator route.                                                                                                                     | lib/modules/channel albo maintenance-only                                                                                    | R4/B1                                    | Usunąć runtime create/repair/rename z normalnej ścieżki.                               |
| lib/services/channel/channel-layout.service.ts      | Sidebar/channel layout query.                                                                                                                   | lib/modules/channel + lib/modules/video/list-public-videos.ts                                                                | R4/R6                                    | Musi filtrować mainChannel.id, publishedAt <= now/null i public policy.                |
| app/api/subscriptions/route.ts                      | Follow/email opt-in głównego kanału. Obecnie route jest gruby i używa Prisma.                                                                   | lib/modules/channel + lib/modules/users albo lib/modules/subscriptions                                                       | R4/R5 lub osobny mały moduł subscription | Subscription nie daje Patron access. Nie przyjmować creatorId od klienta.              |
| lib/services/user/subscription.service.ts           | Subscription helper.                                                                                                                            | lib/modules/users/subscription albo lib/modules/channel/follow                                                               | R5/R4                                    | Rozdzielić od Patron.                                                                  |
| app/api/user/profile/route.ts                       | User profile route.                                                                                                                             | lib/modules/users/use-cases/get-user-profile.ts, update-profile.ts                                                           | R5                                       | Route ma być cienki.                                                                   |
| app/api/user/sync/route.ts                          | User sync.                                                                                                                                      | lib/modules/users/use-cases/sync-clerk-user.ts                                                                               | R5                                       | Clerk sync poza DB transaction, chyba że jawnie uzasadnione.                           |
| app/api/webhooks/clerk/route.ts                     | Clerk webhook.                                                                                                                                  | lib/modules/users/use-cases/handle-clerk-webhook.ts albo sync-clerk-user.ts                                                  | R5                                       | Idempotency zachować.                                                                  |
| lib/webhooks/clerk-idempotency.ts                   | Clerk idempotency helper.                                                                                                                       | lib/modules/users albo lib/modules/shared/idempotency                                                                        | R5/R1                                    | Nie zgubić atomic/idempotent behavior.                                                 |
| lib/services/user.service.ts                        | User facade.                                                                                                                                    | lib/modules/users                                                                                                            | R5/R10                                   | Oznaczyć deprecated po wprowadzeniu modułu.                                            |
| lib/services/user-access.service.ts                 | Patron recalculation + Clerk access sync.                                                                                                       | lib/modules/patron + lib/modules/users                                                                                       | R7/R5                                    | Patron source of truth to DB, Clerk jako cache/sync.                                   |
| lib/services/patron.service.ts                      | Patron access helper.                                                                                                                           | lib/modules/patron                                                                                                           | R7                                       | Nie mieszać z Subscription.                                                            |
| app/api/checkout/create-intent/route.ts             | Checkout intent route.                                                                                                                          | lib/modules/payments/use-cases/create-checkout-intent.ts                                                                     | R7                                       | Backend rozwiązuje main channel. Klient nie wybiera creatorId.                         |
| app/api/checkout/route.ts                           | Checkout API route.                                                                                                                             | lib/modules/payments                                                                                                         | R7                                       | Cienki route.                                                                          |
| app/api/webhooks/stripe/route.ts                    | Stripe webhook route, aktualnie raczej router do PaymentService.                                                                                | lib/modules/payments/use-cases/handle-stripe-webhook.ts                                                                      | R7                                       | Dobre miejsce na cienki route, ale PaymentService do rozbicia.                         |
| lib/services/payment.service.ts                     | Główna logika Stripe/payment/refund/dispute.                                                                                                    | lib/modules/payments + lib/modules/patron                                                                                    | R7                                       | Źródło logiki do rozbicia na osobne use-case’y.                                        |
| lib/services/payments/checkout.service.ts           | Checkout service.                                                                                                                               | lib/modules/payments/create-checkout-intent.ts                                                                               | R7                                       | Zachować idempotency.                                                                  |
| lib/services/payments/fulfillment.service.ts        | Payment fulfillment.                                                                                                                            | lib/modules/payments/handle-payment-succeeded.ts + lib/modules/patron/grant-patron-access.ts                                 | R7                                       | DB changes atomowe; Clerk sync po commicie.                                            |
| lib/services/payments/refund.service.ts             | Refund/dispute logic helper.                                                                                                                    | lib/modules/payments/handle-charge-refunded.ts, handle-dispute-closed.ts                                                     | R7                                       | Zachować CAS/idempotency.                                                              |
| app/api/comments/route.ts                           | Comments list/create entry.                                                                                                                     | lib/modules/comments/use-cases/list-comments.ts, create-comment.ts                                                           | R8                                       | Access check centralnie.                                                               |
| app/api/videos/[id]/comments/route.ts               | Gruby route komentarzy dla video, bezpośrednia Prisma.                                                                                          | lib/modules/comments + lib/modules/video + lib/modules/patron                                                                | R8                                       | Krytyczny kandydat. Nie zgubić Patron-gated comments.                                  |
| app/api/comments/[commentId]/**                     | Update/delete/reaction/report/pin/context/replies.                                                                                              | lib/modules/comments use-cases                                                                                               | R8                                       | Rozdzielić write, moderation, reactions, reports.                                      |
| lib/services/comments/comment.service.ts            | Główna logika komentarzy.                                                                                                                       | lib/modules/comments/comment.repository.ts + use-cases                                                                       | R8                                       | Źródło migracji.                                                                       |
| lib/services/comments/comment-reaction.service.ts   | Reactions.                                                                                                                                      | lib/modules/comments/react-to-comment.ts                                                                                     | R8                                       | Use-case osobno.                                                                       |
| lib/services/comments/comment-report.service.ts     | Reports.                                                                                                                                        | lib/modules/comments/report-comment.ts                                                                                       | R8                                       | Use-case osobno.                                                                       |
| lib/services/comments/comment-moderation.service.ts | Moderation.                                                                                                                                     | lib/modules/comments/moderate-comment.ts                                                                                     | R8                                       | Nie mieszać z public listing.                                                          |
| app/api/admin/emails/broadcast/route.ts             | Gruby broadcast route.                                                                                                                          | lib/modules/email/create-broadcast.ts, queue-broadcast.ts                                                                    | R9                                       | Nie wysyłać fire-and-forget z route.                                                   |
| app/api/webhooks/resend/route.ts                    | Resend webhook, bezpośrednia Prisma i status update.                                                                                            | lib/modules/email/handle-resend-webhook.ts                                                                                   | R9                                       | Wymagana idempotencja, żeby retry nie zawyżał statystyk.                               |
| lib/services/email.service.ts                       | Email templates, Resend client, broadcast.                                                                                                      | lib/modules/email                                                                                                            | R9                                       | Rozbić na template service, resend client, broadcast use-cases.                        |
| app/admin/videos/page.tsx                           | Duża strona admin video.                                                                                                                        | app/admin/videos/components + hooks + api                                                                                    | R11                                      | Frontend dopiero po backend boundary albo równolegle tylko jeśli user każe.            |

Jeżeli agent znajdzie plik, którego nie ma w tej tabeli, nie może traktować go automatycznie jako wzorca. Ma najpierw określić:

* czy plik jest route’em HTTP,
* czy zawiera logikę domenową,
* czy importuje Prisma,
* czy importuje NextResponse/next/server,
* do którego modułu docelowego należy,
* czy wymaga testów przed przeniesieniem.

# Definicja cienkiego route’a

Route jest cienki tylko wtedy, gdy robi wyłącznie warstwę HTTP.

Docelowy route może mieć:

* jedno wywołanie auth, np. requireAdmin albo requireUser,
* jedno parsowanie inputu, np. parseJson(req, schema),
* jedno utworzenie AppContext,
* jedno wywołanie use-case’a,
* jeden return response,
* prosty try/catch albo wrapper routeHandler, jeśli projekt go wprowadzi.

Route nie jest cienki, jeśli zawiera którekolwiek z poniższych:

* bezpośrednie prisma.* albo tx.*,
* więcej niż jedno zapytanie do bazy,
* transakcję prisma.$transaction,
* reguły biznesowe typu „jeśli video jest hero, to...”
* ręczne mapowanie dużych DTO,
* audit log bezpośrednio w route,
* rozbudowane switch/case akcji domenowych,
* logikę Stripe/Clerk/Resend,
* allowlist/security policy zaimplementowaną lokalnie,
* więcej niż 40 linii logiki wewnątrz handlera,
* lokalne any w input/output/error handling,
* import z lib/services/** w nowym kodzie, jeśli istnieje moduł docelowy.

Dopuszczalny wyjątek tymczasowy:

Stary route może pozostać gruby tylko do czasu migracji danego R*. Agent nie może jednak dopisywać do niego nowej logiki biznesowej, jeśli pracuje nad refaktoryzacją. W takim przypadku musi:

1. wydzielić use-case,
2. przepiąć route na use-case,
3. dodać albo zaktualizować test,
4. oznaczyć w README, co zostało przeniesione, a co jeszcze zostało w starym route.

Przykład cienkiego route’a:

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
const admin = await requireAdmin();
const input = await parseJson(req, updateAdminVideoSchema);
const result = await updateAdminVideo(
{ videoId: params.id, ...input },
createAppContext({ actorId: admin.userId })
);

return ok(result);
}

Przykład route’a, który NIE jest cienki:

export async function PATCH(req: NextRequest, { params }) {
const body = await req.json();
const result = schema.safeParse(body);

if (!result.success) {
return NextResponse.json(...);
}

const video = await prisma.video.findUnique(...);

if (video.creatorId !== mainChannel.id) {
return NextResponse.json(...);
}

const updated = await prisma.video.update(...);

await writeAuditLog(...);

return NextResponse.json(updated);
}

# Twarda zasada STOP przed przenoszeniem logiki

Nie wolno przenosić działającej logiki biznesowej, jeśli agent nie może porównać stanu przed i po zmianie.

Minimalny wymagany zestaw przed refaktorem logiki:

npx prisma validate
npm run typecheck
npm test -- --run
npm run lint

Minimalny wymagany zestaw po refaktorze logiki:

npx prisma validate
npm run typecheck
npm test -- --run
npm run lint

Dla większych zmian albo zmian w krytycznych ścieżkach dodatkowo:

npm run build

Jeżeli agent nie może uruchomić npm test -- --run z powodu braku ENV, DB, node_modules, Prisma Client albo sekretów, nie wolno mu przenosić logiki biznesowej między plikami bez jawnej zgody właściciela projektu.

W takim przypadku agent może wykonać tylko bezpieczne prace przygotowawcze:

* utworzyć pustą strukturę lib/modules/**,
* dodać typy,
* dodać AppContext i DbClient,
* dodać AppError,
* dodać helpery HTTP bez przepinania krytycznych route’ów,
* dodać testy opisujące obecne zachowanie,
* dodać TODO/checklistę do README,
* oznaczyć zadanie jako [!] albo [~], ale nie jako [x].

Przenoszenie działającej logiki bez testów jest dozwolone wyłącznie wtedy, gdy właściciel projektu wyraźnie napisze w poleceniu, że akceptuje refaktor bez uruchomionych testów.

Jeżeli testy przed zmianą już failują, agent może pracować tylko wtedy, gdy:

1. wklei do raportu dokładny baseline fail,
2. nie pogorszy liczby ani rodzaju failów,
3. po zmianie pokaże porównanie przed/po,
4. nie oznaczy zadania jako [x], jeśli nie ma realnego PASS lub zaakceptowanej blokady.

# Kolejność i zależności etapów R*

Agent nie może wybierać zadania wyłącznie dlatego, że wydaje się łatwe.

Obowiązuje poniższa kolejność zależności:

R0 — zasady i infrastruktura refaktoryzacji
Nie wymaga wcześniejszych R*.
Musi być minimalne. Nie wolno utknąć w dokumentacji.

R1 — shared, api boundary, errors, ctx
Wymaga ukończonego albo świadomie częściowego R0.
R1 blokuje wszystkie duże migracje domenowe.

R2 — audit
Wymaga R1.
Powinno być przed R6/R7/R9, bo video, payments i email potrzebują audit/logging.

R3 — media
Wymaga R1.
Powinno być przed pełnym R6, bo video używa media allowlist i source policy.

R4 — channel
Wymaga R1.
Powinno być przed pełnym R6 i R7, bo video i payments muszą rozwiązywać mainChannel po stronie backendu.

R5 — users
Wymaga R1.
Powinno być przed pełnym R7, jeżeli payments/patron dotykają Clerk sync albo user access sync.

R6 — video
Wymaga ukończonego R1.
Pełne R6 wymaga ukończonego R3 i R4.
R6 może zacząć tylko od analizy/testów, jeśli R3 albo R4 są [~], ale nie wolno przepinać krytycznych mutacji video, dopóki media/channel nie mają stabilnego public API.

R7 — patron + payments
Wymaga R1.
Pełne R7 wymaga R4 i najlepiej R5.
Payment succeeded/refund/dispute nie mogą zostać rozbite bez testów idempotencji.

R8 — comments
Wymaga R1.
Pełne R8 powinno znać wynik R6/R7, bo comments zależą od video access i Patron access.

R9 — email
Wymaga R1.
Jeżeli email dotyka user/subscription state, musi uwzględnić R5 i rozdział Subscription != Patron.

R10 — cleanup deprecated facade’ów
Wymaga zakończenia odpowiednich modułów domenowych.
Nie wolno usuwać starego facade, dopóki importy nie są przepięte i guard przechodzi.

R11 — admin frontend
Może być robione po R1, ale nie powinno wyprzedzać backendowych use-case’ów, jeśli zmiana dotyczy mutacji.
Frontend admin video najlepiej robić po R6 albo jako osobny etap tylko dla komponentów prezentacyjnych.

# Reguła blokady między agentami

Jeżeli README pokazuje zadanie jako [~], inny agent nie może założyć, że publiczne API tego modułu jest stabilne.

Przykład:

Jeśli R4 channel ma status [~], agent pracujący nad R6 video nie może masowo przepinać video na channel module, chyba że:

* używa tylko eksportów z index.ts,
* R4 wprost oznaczyło te eksporty jako stabilne,
* testy R4 przechodzą,
* agent dopisze w raporcie, które API channel uznał za kontrakt.

Jeżeli moduł zależny nie jest stabilny, agent ma:

* dopisać brakujący krok w zadaniu zależnym,
* ograniczyć pracę do testów/typów/analizy,
* nie robić dużych migracji na niestabilnym API.

ZASTĄP SEKCJĘ:

## R0 — zasady i infrastruktura refaktoryzacji

NASTĘPUJĄCĄ WERSJĄ:

## R0 — zasady i infrastruktura refaktoryzacji

R0 nie jest dużym etapem dokumentacyjnym. Celem jest tylko dopięcie zasad, guardów i raportowania, żeby można było bezpiecznie przejść do R1.

R0 ma być wykonane przed migracją domen.

Agent nie może oznaczyć R0 jako [x], jeśli nie przeczytał i nie porównał ARCHITECTURE.md z README.

Checklist:

* [ ] Przeczytać aktualny ARCHITECTURE.md i w raporcie zacytować jego aktualny stan własnymi słowami.
* [ ] Porównać ARCHITECTURE.md z zasadami modular monolith z README.
* [ ] Dopisać do ARCHITECTURE.md brakujące zasady modular monolith:

  * route -> use-case -> policy/service/repository -> Prisma,
  * lib/modules/** nie zna HTTP/Next,
  * transakcje należą do use-case’ów,
  * publiczne API modułu idzie przez index.ts,
  * deprecated facade’y w lib/services/** nie są wzorcem dla nowego kodu.
* [ ] Dopisać albo utrzymać w README statusy zadań [ ], [~], [x], [!], [?].
* [ ] Dopisać albo utrzymać minimalny template raportu agenta AI.
* [ ] Dodać do README definicję cienkiego route’a wraz z mierzalnymi progami.
* [ ] Dodać do README zasadę STOP: bez testów przed/po nie wolno przenosić logiki biznesowej.
* [ ] Dodać do README mapę migracji aktualnych plików do docelowych modułów.
* [ ] Dodać do README zależności między R*.
* [ ] Dodać zasadę: nowy kod domenowy ma trafiać do lib/modules/**, nie do starych lib/services/**.
* [ ] Oznaczyć stare facade’y jako deprecated w komentarzach albo dokumentacji, zanim zostaną fizycznie usunięte.
* [ ] Dodać albo zaplanować skrypt quality:no-deprecated-imports.
* [ ] Dodać albo zaplanować skrypt quality:architecture-boundaries.
* [ ] Dodać albo zaplanować plik REFACTORING_EXAMPLES.md z przykładami before/after.

Kryteria akceptacji:

* ARCHITECTURE.md zawiera ten sam kontrakt architektoniczny co README.
* README zawiera mapę obecny plik -> docelowy moduł.
* README zawiera mierzalną definicję cienkiego route’a.
* README zawiera zasadę STOP dla refaktoru bez testów.
* README zawiera zależności między etapami R*.
* Agent po R0 wie, że następny krok to R1, a nie domeny video/payments/email.
* Jeżeli nie da się dodać guardów technicznych w R0, muszą być dopisane jako jawne checklist itemy w R1 albo R10.

Po R0 następny krok:

R1 — shared, api boundary, errors, ctx.

Nie wolno po R0 przechodzić bezpośrednio do R6/R7/R9, chyba że właściciel projektu jawnie to nakaże.

DODAJ DO R1 POD CHECKLISTĄ:

Dodatkowe wymagania R1 wynikające z aktualnego repo:

* [ ] Utworzyć katalog lib/modules/.
* [ ] Utworzyć lib/modules/shared/.
* [ ] Upewnić się, że R1 nie przenosi jeszcze dużej logiki z admin video, payments, comments ani email.
* [ ] Dodać boundary guard dla lib/modules/**:

  * brak next/server,
  * brak next/navigation,
  * brak next/cache,
  * brak NextResponse,
  * brak importów z app/**.
* [ ] Dodać guard albo test skryptowy wykrywający bezpośrednie importy lib/modules/*/wewnętrzny-plik z zewnątrz modułu, jeśli nie idą przez index.ts.
* [ ] Dodać helper routeHandler albo standard try/catch, żeby route’y nie powielały error mappingu.
* [ ] Przykładowy route w R1 musi być mały i niskiego ryzyka. Nie wybierać admin video ani Stripe webhook jako pierwszy przykład.
* [ ] Przykładowy use-case musi mieć test z fake ctx.now i podstawionym ctx.prisma albo mockiem repository.

Sugerowane bezpieczne route’y przykładowe dla R1:

* app/api/payment-settings/route.ts
* app/api/access/route.ts
* mały route user/profile, jeśli nie wymaga skomplikowanej auth migracji

Nie wybierać na pierwszy przykład:

* app/api/admin/videos/route.ts
* app/api/admin/videos/[id]/actions/route.ts
* app/api/webhooks/stripe/route.ts
* app/api/webhooks/resend/route.ts
* app/api/videos/[id]/comments/route.ts
* app/api/subscriptions/route.ts

Powód:

Te route’y są krytyczne domenowo i powinny być migrowane dopiero po przygotowaniu wspólnych helperów, AppContext, AppError, media/channel/patron boundaries i testów.

DODAJ DO R6 NA POCZĄTKU SEKCJI:

Zależności R6:

R6 video wymaga ukończonego R1.
Pełna migracja R6 wymaga ukończonego R3 media i R4 channel.

Nie wolno zaczynać pełnego R6, jeśli R3 albo R4 mają status [~], chyba że praca ogranicza się do:

* analizy obecnych route’ów video,
* dopisania testów baseline,
* utworzenia pustej struktury modułu video,
* przeniesienia czystych typów/DTO bez zmiany runtime behavior,
* opisania brakujących kroków w README.

Aktualne główne źródła R6 w repo:

* app/api/admin/videos/route.ts
* app/api/admin/videos/[id]/route.ts
* app/api/admin/videos/[id]/actions/route.ts
* app/api/admin/videos/reorder/route.ts
* app/api/admin/videos/resync/route.ts
* lib/services/admin/videos-admin.service.ts
* lib/services/admin/videos-admin.dto.ts
* lib/services/admin/videos-diagnostics.service.ts
* lib/services/content.service.ts
* lib/services/content/video.service.ts
* app/api/media-source/[videoId]/route.ts
* app/api/media/[...path]/route.ts
* app/api/videos/[id]/playback-event/route.ts

Pierwszy bezpieczny krok R6:

1. Dodać testy baseline dla admin video scope:

   * update nie modyfikuje filmu spoza mainChannel,
   * delete/archive nie modyfikuje filmu spoza mainChannel,
   * reorder nie obejmuje filmów spoza mainChannel,
   * set-hero nie wybiera filmu spoza mainChannel,
   * isMainFeatured wymaga PUBLIC + PUBLISHED.
2. Dopiero potem przenosić logikę do use-case’ów.

Docelowe use-case’y R6:

* create-admin-video.ts
* update-admin-video.ts
* archive-video.ts
* publish-video.ts
* unpublish-video.ts
* set-hero-video.ts
* reorder-videos.ts
* get-admin-video.ts
* list-admin-videos.ts
* get-public-video.ts
* list-public-videos.ts
* resolve-video-media-source.ts
* record-video-playback-event.ts

Reguła dla admin video:

Każda mutacja admin video musi mieć mainChannel.id w warunku albo jawny pre-check w tej samej transakcji.

Nie wystarczy:

await prisma.video.update({ where: { id }, data })

Wymagane jest jedno z poniższych:

* updateMany z where: { id, creatorId: mainChannel.id } i sprawdzeniem count,
* wcześniejszy select w tej samej transakcji i odmowa, jeśli creatorId != mainChannel.id,
* repository method, która wymusza creatorId jako parametr obowiązkowy.

Reguła dla hero video:

Nie wolno ustawiać hero poza mainChannel.
Nie wolno ustawiać hero dla filmu innego niż PUBLIC + PUBLISHED.
Operacja set-hero musi być atomowa:

* wyczyścić isMainFeatured tylko w ramach mainChannel.id,
* ustawić hero tylko dla video id + mainChannel.id.

Reguła dla reorder:

Reorder może dotyczyć wyłącznie filmów z mainChannel.id.
Jeżeli input zawiera id filmu spoza mainChannel, use-case ma odrzucić całą operację.
Nie wolno częściowo zastosować reorder.

DODAJ NOWĄ SEKCJĘ PRZED:

# Minimalny template raportu agenta AI

# Wymagany plik REFACTORING_EXAMPLES.md

Agenci AI lepiej refaktoryzują przez analogię niż przez same zasady.

Dlatego repo powinno zawierać plik:

REFACTORING_EXAMPLES.md

Jeżeli plik nie istnieje, R0 albo R1 ma go utworzyć.
Jeżeli istnieje, agent ma go przeczytać przed większym refaktorem.

Minimalna zawartość pliku:

# Refactoring examples

Ten plik pokazuje docelowy styl refaktoryzacji w tym repo.

Przykłady są kontraktem stylu dla agentów AI.

Nie kopiować nazw 1:1 bez sprawdzenia aktualnego kodu, ale zachować przepływ:

route -> parse/auth -> use-case -> policy/service/repository -> Prisma

## Przykład 1 — Admin video update

PRZED:

app/api/admin/videos/[id]/actions/route.ts

Route robi za dużo:

* auth,
* req.json,
* Zod validation,
* main channel lookup,
* video lookup,
* creatorId check,
* updateData building,
* Prisma update,
* hero side effect,
* audit log,
* error response.

To nie jest docelowy styl.

PO:

app/api/admin/videos/[id]/actions/route.ts

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
const admin = await requireAdmin();
const input = await parseJson(req, updateAdminVideoSchema);

const result = await updateAdminVideo(
{ videoId: params.id, ...input },
createAppContext({ actorId: admin.userId })
);

return ok(result);
}

lib/modules/video/use-cases/update-admin-video.ts

export async function updateAdminVideo(input: UpdateAdminVideoInput, ctx: AppContext) {
const mainChannel = await getRequiredMainChannel(ctx);

return ctx.prisma.$transaction(async (tx) => {
const current = await videoRepository.findAdminVideoById(input.videoId, tx);

```
assertVideoBelongsToMainChannel(current, mainChannel.id);

const update = buildAdminVideoUpdate(input, current, ctx.now());

const updated = await videoRepository.updateVideoForMainChannel(
  {
    videoId: input.videoId,
    mainChannelId: mainChannel.id,
    data: update,
  },
  tx
);

if (input.isMainFeatured) {
  await assertCanBeHeroVideo(updated);
  await videoRepository.clearOtherHeroVideos(mainChannel.id, updated.id, tx);
}

await recordAuditEvent(
  {
    actorUserId: ctx.actorId,
    action: "VIDEO_UPDATED",
    targetType: "Video",
    targetId: updated.id,
    metadata: {
      changedFields: Object.keys(update),
      status: updated.status,
      tier: updated.tier,
    },
  },
  { ...ctx, prisma: tx }
);

return toAdminVideoDto(updated);
```

});
}

## Przykład 2 — Stripe webhook

PRZED:

Webhook albo payment service robi wiele rzeczy naraz:

* parsuje event,
* deduplikuje,
* zmienia Payment,
* nadaje Patron,
* synchronizuje Clerk,
* obsługuje refund/dispute.

PO:

app/api/webhooks/stripe/route.ts

export async function POST(req: NextRequest) {
const event = await parseStripeWebhook(req);

const result = await handleStripeWebhook(
{ event },
createAppContext()
);

return ok(result);
}

lib/modules/payments/use-cases/handle-stripe-webhook.ts

export async function handleStripeWebhook(input: HandleStripeWebhookInput, ctx: AppContext) {
switch (input.event.type) {
case "checkout.session.completed":
case "payment_intent.succeeded":
return handlePaymentSucceeded({ event: input.event }, ctx);

```
case "charge.refunded":
  return handleChargeRefunded({ event: input.event }, ctx);

case "charge.dispute.closed":
  return handleDisputeClosed({ event: input.event }, ctx);

default:
  return { ignored: true, type: input.event.type };
```

}
}

Zasady:

* idempotencja eventów jest centralna,
* DB changes są w transaction,
* Clerk sync jest po commicie,
* refund/dispute nie dopisują logiki Patron lokalnie, tylko wołają patron use-case/policy.

## Przykład 3 — Subscription != Patron

PRZED:

Route subscriptions miesza:

* auth,
* main channel lookup,
* Prisma,
* response,
* czasem semantykę follow/subscription myloną z Patron.

PO:

app/api/subscriptions/route.ts

export async function POST(req: NextRequest) {
const user = await requireUser();
const input = await parseJson(req, updateSubscriptionSchema);

const result = await subscribeToMainChannelEmails(
input,
createAppContext({ actorId: user.userId })
);

return ok(result);
}

lib/modules/channel/use-cases/subscribe-to-main-channel-emails.ts

export async function subscribeToMainChannelEmails(
input: SubscribeToMainChannelEmailsInput,
ctx: AppContext
) {
const mainChannel = await getRequiredMainChannel(ctx);

const subscription = await subscriptionRepository.upsertEmailSubscription(
{
userId: ctx.actorId,
creatorId: mainChannel.id,
emailConsent: input.emailConsent,
},
ctx.prisma
);

return toSubscriptionDto(subscription);
}

Zasady:

* klient nie wysyła creatorId,
* backend rozwiązuje mainChannel,
* Subscription nie zmienia User.isPatron,
* Patron access jest wyłącznie w patron/payment/user-access policy.

DODAJ DO TEMPLATE RAPORTU AGENTA, W SEKCJI "Review architektoniczne":

* Czy sprawdzono mapę migracji aktualny plik -> docelowy moduł:
* Czy route spełnia definicję cienkiego route’a:
* Jeśli route nie jest cienki, czy dopisano konkretny checklist item:
* Czy przed refaktorem uruchomiono baseline test/typecheck/lint:
* Czy po refaktorze uruchomiono test/typecheck/lint:
* Jeśli testów nie uruchomiono, czy agent powstrzymał się od przenoszenia logiki:
* Czy moduł zależny R* miał status [x], czy tylko [~]:
* Czy użyto wyłącznie publicznego API innego modułu przez index.ts:
* Czy nowe pliki lib/modules/** nie importują Next/HTTP:
* Czy stary lib/services/** został tylko jako deprecated facade albo źródło migracji:

DODAJ NOWĄ SEKCJĘ PO:

# Komendy walidacyjne po każdym etapie refaktoryzacji

# Komendy architektoniczne do dodania

Docelowo repo powinno mieć dodatkowe komendy jakościowe:

npm run quality:architecture-boundaries
npm run quality:no-deprecated-imports
npm run quality:thin-routes

Minimalne znaczenie:

quality:architecture-boundaries:

* fail, jeśli lib/modules/** importuje next/server, next/navigation, next/cache, NextResponse albo app/**,
* fail, jeśli moduł importuje wewnętrzne pliki innego modułu zamiast publicznego index.ts,
* fail, jeśli route importuje repository bezpośrednio.

quality:no-deprecated-imports:

* fail, jeśli nowy kod importuje deprecated lib/services/content.service.ts,
* fail, jeśli nowy kod importuje deprecated lib/services/payment.service.ts po R7,
* fail, jeśli nowy kod importuje deprecated lib/services/user.service.ts po R5,
* fail, jeśli nowy kod importuje deprecated lib/services/main-creator.service.ts po R4.

quality:thin-routes:

* ostrzeżenie albo fail, jeśli route.ts ma więcej niż 120 linii,
* fail, jeśli route.ts ma więcej niż 350 linii bez jawnego wyjątku,
* ostrzeżenie, jeśli route zawiera prisma.,
* ostrzeżenie, jeśli route zawiera prisma.$transaction,
* ostrzeżenie, jeśli route zawiera więcej niż jeden import z lib/services/**.

Uwaga:

Aktualne repo ma już quality:hotspots, ale jego limit route wynosi 350 linii. To jest dobry guard przed ekstremalnie dużymi plikami, ale za słaby jako definicja cienkiego route’a. Dlatego quality:thin-routes powinien być ostrzejszy i domenowy.

DODAJ DO SEKCJI:

# Definicja sukcesu refaktoryzacji

Dodatkowa definicja sukcesu dla agentów AI:

Agent AI może bezpiecznie wykonać kolejne zadanie, jeśli po otwarciu README widzi:

1. jaki jest pierwszy niezakończony R*,
2. od jakich R* zależy,
3. z których obecnych plików ma migrować logikę,
4. do którego lib/modules/** ma ją przenieść,
5. jakie testy baseline musi mieć,
6. jak wygląda cienki route,
7. kiedy musi się zatrzymać,
8. jak zaraportować PASS/FAIL/NIEURUCHOMIONE,
9. które stare pliki są tylko deprecated źródłem migracji,
10. jaki jest jeden następny krok po zakończeniu.

Jeśli agent musi samodzielnie eksplorować repo dłużej niż kilka minut, żeby ustalić skąd przenieść logikę, README jest niewystarczające i agent ma dopisać brak do mapy migracji przed implementacją.
