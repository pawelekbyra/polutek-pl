# LANE-launch-readiness

Status: ACTIVE — POST-R AI DELIVERY CONTROL PLANE.

## Lane identity

- Lane ID: `launch-readiness`
- Primary phase: X7
- Goal: public launch final gate, manual QA, runbooks, certification
- Parallel safety: SERIAL

## Product rules

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

## Domain invariants

Inwarianty domenowe:

```txt
Payment = money/support event
PatronGrant = access/right/status
Subscription = mailing/follow/newsletter consent
```

Zakazane modele:

```txt
Stripe webhook -> User.isPatron = true
Subscription -> patron access
Clerk metadata -> backend access truth
Payment alone -> patron access
frontend state -> patron access
```

Poprawny model docelowy:

```txt
Stripe webhook
  -> verify signature/raw body
  -> record StripeEvent / webhook ledger
  -> record Payment as financial fact
  -> Patron eligibility policy checks amount/currency/status
  -> Patron module creates PatronGrant
  -> Access module reads active PatronGrant
```

Źródło prawdy dostępu patrona:

```txt
exists ACTIVE PatronGrant
```

Nie: `User.isPatron`, Clerk metadata, Subscription, Payment alone, Stripe state alone ani frontend state. `User.isPatron` może istnieć migracyjnie, ale docelowo jest legacy/mismatch diagnostic, nie backend source of truth.



## Allowed work in active control plane

- Inventory current code vs specs.
- Gap analysis.
- One route family/use-case/repository/policy migration per ticket.
- Test-only hardening tickets.
- Docs reconciliation after merged work.
- Certification support as read-only evidence.

## Forbidden work

- Mega-refactor.
- Product policy changes without owner decision.
- Schema/package/guard/global roadmap changes unless ticket explicitly allows.
- Runtime work without active ticket.
- Marking target architecture as current implementation.

## Launch-critical checks

- Does this lane preserve Payment/PatronGrant/Subscription separation?
- Does it preserve denied PlaybackPlan no URL/token/provider call where relevant?
- Does it avoid Clerk/User.isPatron/Subscription as access truth?
- Does it create audit trail for admin/manual actions where relevant?
- Does it avoid parallel conflicts listed in `Parallel-Work-Matrix.md`?

## Seed ticket direction

Initial tickets should be inventory/spec/gap-analysis until X0 activation is complete. Runtime implementation tickets may be created only after current-state inventory and owner/Planner approval.
