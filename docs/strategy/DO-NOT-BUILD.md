# Do Not Build

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE.

## Purpose

Ten dokument jest twardą listą zakazów produktowych i architektonicznych dla faz X1-X7. Ma chronić Polutek.pl przed scope creep, access leaks, overengineeringiem i myleniem target architecture z aktualnym runtime.

Wyjątek od tej listy wymaga jawnej decyzji właściciela oraz, jeśli dotyczy architektury, osobnej decyzji architektonicznej/ticketu. Agent nie może samodzielnie uznać wyjątku za dopuszczalny.

## Product do-not-build

Nie budować:

- marketplace,
- multi-creator SaaS,
- mini-Patreona,
- white-label CMS,
- tenant onboarding,
- tenant platformy,
- generic social network,
- recurring patron subscription model bez nowej decyzji właściciela,
- patronatu jako cyklicznej subskrypcji,
- automatycznego marketing opt-in dla patronów,
- newslettera jako źródła patron access,
- generic admin dashboard przed Access Diagnostics,
- public launch jako private beta workaround,
- rich community scope, który zmienia Polutek.pl w social network bez osobnej decyzji właściciela.

## Architecture do-not-build

Nie budować ani nie wprowadzać:

- ciężkiego enterprise multi-provider video frameworka,
- aktywnego R2/S3/Vercel Blob secure patron playback fallback bez decyzji architektonicznej,
- patron access opartego o `User.isPatron`,
- patron access opartego o Clerk metadata,
- patron access opartego o `Subscription`,
- patron access opartego o Payment alone,
- patron access opartego o Stripe state alone,
- patron access opartego o frontend state,
- modelu `Stripe webhook -> User.isPatron = true`,
- modelu `Subscription -> patron access`,
- below-threshold payment tworzącego `PatronGrant`,
- manual grant/suspend/reactivate/revoke bez reason + audit,
- full refund/dispute handling, które zostawia nieuprawniony aktywny grant,
- playera ukrytego pod overlayem dla locked content,
- realnego playera mountowanego dla denied `PlaybackPlan`,
- provider call / token request / stream fetch przed backendowym Access allow,
- view/playback tracking dla denied/locked state,
- DTO/API response ujawniającego `playbackUrl` albo `playbackToken` dla denied plan,
- logowania sekretów, tokenów albo prywatnych playback URL-i,
- mieszania marketing emails i transactional emails,
- broadcastu bez preview/test-send i audytu,
- email unsubscribe cofającego `PatronGrant`,
- moderation hide/delete/restore/dismiss bez audytu,
- shadow bans,
- target architecture przedstawianej jako aktualnie istniejący runtime.

## AI-agent do-not-build

Agentom AI nie wolno:

- robić mega-refactorów mieszających runtime, schema, package files, roadmapę, guardy i docs w jednym PR,
- pracować bez aktywnego ticketu,
- edytować ścieżek poza allowed paths ticketu,
- zmieniać `README.md`, `AGENTS.md`, roadmapy, schema, migrations, package files albo guardów bez jawnej zgody ticketu,
- rozwiązywać otwartych pytań właściciela jako własnej decyzji,
- oznaczać fazy jako done bez certyfikacji,
- twierdzić, że testy przeszły, jeśli nie zostały uruchomione,
- uruchamiać runtime work w docs-only ticketach,
- ukrywać package-lock/schema/migration changes w feature/docs ticketach,
- równoleglić prace dotykające tej samej route family, modułu, modelu Prisma, test suite, global doc, guard file, package files albo migrations,
- zmieniać product policy przy okazji refaktoru,
- poprawiać „wszystko” zamiast jednego ticketu.

## Examples of rejected directions

- „Dodajmy creator onboarding, bo potem łatwo będzie mieć wielu twórców.” — REJECT: multi-creator SaaS / tenant platforma.
- „Użyjmy `User.isPatron` jako szybkiej naprawy paid-but-locked.” — REJECT: legacy diagnostic nie jest access truth.
- „Skoro payment istnieje, frontend może odblokować player.” — REJECT: Payment alone i frontend state nie są access truth.
- „Ukryjmy player overlayem i nie pokazujmy kontrolek.” — REJECT: locked state musi być osobnym render tree.
- „Poprośmy Cloudflare/Mux o URL, a potem zdecydujmy w UI czy go pokazać.” — REJECT: provider call/token request/stream fetch dopiero po backend Access allow.
- „R2 będzie tymczasowym fallbackiem dla prywatnego patron playbacku.” — REJECT bez decyzji architektonicznej.
- „Zróbmy subscription patronat, bo Stripe to wspiera.” — REJECT bez nowej decyzji właściciela.
- „Unsubscribe usunie wszystkie relacje użytkownika, w tym patronat.” — REJECT: unsubscribe nigdy nie cofa `PatronGrant`.
- „Zróbmy dashboard z metrykami, a Access Diagnostics później.” — REJECT: admin cockpit zaczyna od support diagnostics.
- „W jednym PR poprawmy schema, paczki, runtime, roadmapę i docs.” — REJECT: mega-refactor i naruszenie single-writer/scope rules.

## How to handle exceptions

Jeżeli ticket, spec, runtime gap albo review sugeruje wyjątek od tej listy:

1. Nie implementuj wyjątku.
2. Oznacz wynik jako `BLOCKED` albo `FIX`, zależnie od instrukcji ticketu.
3. Opisz dokładnie konflikt, ryzyko i unblock condition.
4. Wskaż, czy wymagana jest decyzja właściciela, decyzja architektoniczna, osobny ticket, schema/package/guard owner albo docs reconciliation.
5. Kontynuuj tylko po jawnej decyzji właściciela i nowym ticket scope z dozwolonymi ścieżkami.
