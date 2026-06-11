# Owner Timeline — Post-R AI Delivery Control Plane

Status: STAGED ONLY. Not active until R-phase handoff.

## At a glance

- Where are we? Staging przyszłego Post-R control plane w `_tmp/ai-control-plane-staging/`.
- What is done? Szkic docs, specs, lanes, workflows i seed tickets przygotowane do aktywacji.
- What is active? Nadal root README R-phase. Ten timeline nie jest aktywny.
- What is blocked? Aktywacja czeka na R10/R11 handoff/certification albo jawną zgodę właściciela.
- What is next? Po zgodzie: uruchomić X0 activation checklist.
- Is product ready to launch? Nie. X1-X7 muszą przejść przez tickety, walidację i certyfikację.
- What should owner click/start next? Po aktywacji: pierwszy ticket `X0-READY-001-r-phase-handoff-inventory.md`.

## Owner decisions

Decyzje właściciela, wiążące dopóki właściciel jawnie ich nie zmieni:

- Patronat nie jest subskrypcją cykliczną.
- Patronat jest nagrodą za kwalifikujące jednorazowe wsparcie/donację.
- Dostęp patrona jest permanentny/lifetime/no-expiry domyślnie, chyba że zostanie zawieszony lub cofnięty polityką.
- Próg kwalifikującego wsparcia jest admin-konfigurowalny per waluta; domyślne wartości launch: 10 PLN, 10 USD, 10 EUR, 10 CHF.
- Cloudflare Stream jest pierwszym providerem wideo.
- Mux ma być wspierany projektowo per `VideoAsset`, bez budowania ciężkiego enterprise multi-provider frameworka.
- R2/S3/Vercel Blob mogą istnieć jako legacy/migracja, ale nie są aktywnym bezpiecznym providerem prywatnego playbacku patronów bez przyszłej decyzji architektonicznej.
- Komentarze pod patron-only wideo są widoczne dla wszystkich; komentowanie/reagowanie/pisanie wymaga patrona lub admina.
- Launch jest publiczny, nie prywatna beta.
- Cel jakości: produkt excellent, nie szybkie minimum; excellence osiągane fazami i ticketami, nie jednym wielkim PR-em.

## Phase map

| Phase | Owner meaning | Status now | Next owner action |
| --- | --- | --- | --- |
| R0-R11 | Current foundation/refactor | Active outside staging | Complete/certify R10/R11 or approve handoff |
| X0 | Make truth agree and activate control plane | Staged | Start activation checklist after handoff |
| X0.5 | Product standard and research synthesis | Staged | Lock owner decisions/specs |
| X1 | Payments / Patron Safety | Staged | Inventory payment/patron side effects |
| X2 | Access / Patron Hard Reset | Staged | Inventory access truth and mismatches |
| X3 | Video Provider Foundation | Staged | Inventory provider/media usage |
| X4 | PlaybackPlan / Player | Staged | Inventory current player/locked states |
| X5 | Admin Cockpit | Staged | Inventory admin diagnostics gaps |
| X6 | Product Excellence | Staged | Run UX/mobile/a11y/performance passes |
| X7 | Launch Readiness / Final Certification | Staged | Gap analysis, manual QA, final cert |

## What remains until public launch

1. R-phase handoff.
2. X0 activation.
3. X0.5 product standard lock.
4. X1-X5 critical domain safety.
5. X6 excellence passes.
6. X7 final launch gate.

## Owner operating rule

Do not ask Codex to "continue". Choose one ticket. One ticket creates one branch and one PR. Merge only after Reviewer verdict `MERGE` and owner review.
