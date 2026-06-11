# Architecture Decision Records — active

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE.

## ADR-001 — Single creator place, not platform

Decision: Polutek.pl pozostaje jednym miejscem jednego twórcy. Nie projektujemy marketplace, tenant onboarding ani multi-creator SaaS.

Consequence: wszystkie lane'y i tickety muszą odrzucać uogólnienia multi-tenant, chyba że właściciel wyda osobną decyzję.

## ADR-002 — PatronGrant is access truth

Decision: aktywny `PatronGrant` jest docelowym źródłem prawdy dla access. `User.isPatron` jest target-deprecated migration/diagnostic field.

Consequence: payment, Clerk metadata i Subscription nie mogą samodzielnie dawać access.

## ADR-003 — One-time support, not recurring subscription

Decision: patronat jest reward za kwalifikujące jednorazowe wsparcie/donację. Domyślne progi launch: 10 PLN/USD/EUR/CHF, admin-editable.

Consequence: nie budować recurring patron subscription model bez nowej decyzji właściciela.

## ADR-004 — Cloudflare first, Mux optional by design

Decision: Cloudflare Stream jest pierwszym providerem. Mux jest wspierany przez cienką abstrakcję per `VideoAsset`.

Consequence: nie budować ciężkiego enterprise frameworka i nie używać R2/S3 jako aktywnego prywatnego playback fallbacku.

## ADR-005 — Locked state is not an overlay on player

Decision: denied `PlaybackPlan` renderuje locked placeholder bez playera, streamu, tokenu i provider call.

Consequence: frontend nie może ukrywać realnego playera overlayem przy denied access.

## ADR-006 — Comments visible, writing gated

Decision: komentarze pod patron-only wideo są widoczne dla wszystkich, ale pisanie/reagowanie wymaga patrona/admina.

Consequence: `Comment visibility != comment permission` jest inwariantem specs i testów.

## ADR-007 — Admin cockpit starts with Access Diagnostics

Decision: Access Diagnostics jest pierwszym priorytetem admin cockpit. Generic dashboard jest później.

Consequence: owner ma diagnozować paid-but-locked bez ręcznego sprawdzania DB/Stripe/Clerk.
